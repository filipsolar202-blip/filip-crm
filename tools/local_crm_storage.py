#!/usr/bin/env python3
import base64
import getpass
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


PORT = int(os.environ.get("FILIP_CRM_STORAGE_PORT", "48730"))
DEFAULT_BASE_DIR = Path.home() / "Library" / "Application Support" / "FILIP CRM" / "data"
BASE_DIR = Path(os.environ.get("FILIP_CRM_DATA_DIR", str(DEFAULT_BASE_DIR))).expanduser()
STATE_FILE = BASE_DIR / "state" / "crm-state.json"
BACKUP_DIR = BASE_DIR / "backups"
ATTACHMENT_DIR = BASE_DIR / "attachments"
LOG_DIR = BASE_DIR / "logs"
MAX_BODY = 250 * 1024 * 1024
MAX_AUDIO_INPUT_BYTES = 100 * 1024 * 1024
MAX_OPENAI_AUDIO_BYTES = 24 * 1024 * 1024
FFMPEG = os.environ.get("FILIP_CRM_FFMPEG", "/opt/homebrew/bin/ffmpeg")
OPENAI_TRANSCRIBE_MODEL = os.environ.get("FILIP_CRM_TRANSCRIBE_MODEL", "gpt-4o-transcribe")
OPENAI_ANALYSIS_MODEL = os.environ.get("FILIP_CRM_AI_MODEL", "gpt-4o-mini")
ALLOW_OPENAI_FALLBACK = os.environ.get("FILIP_CRM_ALLOW_OPENAI_FALLBACK", "").strip() == "1"
KEYCHAIN_SERVICE = "filip-crm-openai"
MACWHISPER_CLI = os.environ.get("FILIP_CRM_MACWHISPER_CLI", "/usr/local/bin/mw")
WHISPER_CPP_CLI = os.environ.get("FILIP_CRM_WHISPER_CPP_CLI", "/opt/homebrew/bin/whisper-cli")
WHISPER_CPP_MODEL = Path(os.environ.get(
    "FILIP_CRM_WHISPER_CPP_MODEL",
    str(Path.home() / "Library" / "Application Support" / "FILIP CRM" / "models" / "ggml-large-v3-turbo-q5_0.bin"),
)).expanduser()
ALLOWED_ORIGINS = {"https://filipsolar202-blip.github.io", "http://127.0.0.1:48730", "http://localhost:48730", "null"}
AI_JOBS = {}
AI_JOBS_LOCK = threading.Lock()
AI_JOB_TTL_SECONDS = 24 * 60 * 60


def now_stamp():
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def safe_name(value, fallback="soubor"):
    value = str(value or fallback)
    value = re.sub(r"[^\w.\-() ]+", "_", value, flags=re.UNICODE).strip(" .")
    return value[:120] or fallback


def ensure_dirs():
    for path in (STATE_FILE.parent, BACKUP_DIR, ATTACHMENT_DIR, LOG_DIR):
        path.mkdir(parents=True, exist_ok=True)


def openai_api_key():
    env_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if env_key:
        return env_key
    try:
        result = subprocess.run(["/usr/bin/security", "find-generic-password", "-a", getpass.getuser(), "-s", KEYCHAIN_SERVICE, "-w"], capture_output=True, text=True, timeout=8)
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def save_openai_api_key(key):
    key = str(key or "").strip()
    if not key.startswith("sk-") or len(key) < 20:
        raise RuntimeError("Klíč nemá očekávaný formát OpenAI API klíče.")
    result = subprocess.run(["/usr/bin/security", "add-generic-password", "-U", "-a", getpass.getuser(), "-s", KEYCHAIN_SERVICE, "-w", key], capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError("Klíč se nepodařilo uložit do Klíčenky macOS: " + result.stderr.strip())
    return True


def macwhisper_cli():
    configured = Path(MACWHISPER_CLI)
    if configured.exists() and os.access(configured, os.X_OK):
        return str(configured)
    found = shutil.which("mw")
    return found or ""


def whisper_cpp_cli():
    configured = Path(WHISPER_CPP_CLI)
    if configured.exists() and os.access(configured, os.X_OK):
        return str(configured)
    found = shutil.which("whisper-cli")
    return found or ""


def local_transcription_backend():
    if whisper_cpp_cli() and WHISPER_CPP_MODEL.exists():
        return "whisper.cpp"
    if macwhisper_cli():
        return "macwhisper"
    return ""


def origin_allowed(handler):
    origin = handler.headers.get("Origin")
    return not origin or origin in ALLOWED_ORIGINS


def atomic_write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def read_state():
    if not STATE_FILE.exists():
        return None
    with STATE_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def backup_state_file(reason="auto"):
    if not STATE_FILE.exists():
        return None
    target = BACKUP_DIR / f"{now_stamp()}_{safe_name(reason)}_crm-state.json"
    shutil.copy2(STATE_FILE, target)
    return str(target)


def backup_info(path: Path):
    state = None
    try:
        with path.open("r", encoding="utf-8") as f:
            state = json.load(f)
    except Exception:
        state = None
    return {
        "name": path.name,
        "path": str(path),
        "size": path.stat().st_size,
        "updatedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
        "counts": counts(state),
    }


def list_backups():
    if not BACKUP_DIR.exists():
        return []
    return [
        backup_info(path)
        for path in sorted(BACKUP_DIR.glob("*_crm-state.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if path.is_file()
    ]


def backup_path_from_name(name):
    safe = Path(str(name or "")).name
    target = (BACKUP_DIR / safe).resolve()
    root = BACKUP_DIR.resolve()
    if not str(target).startswith(str(root)) or not target.exists() or not target.is_file():
        return None
    return target


def decode_data_url(data_url):
    if not isinstance(data_url, str) or not data_url.startswith("data:") or "," not in data_url:
        return None, None
    meta, raw = data_url.split(",", 1)
    mime = "application/octet-stream"
    m = re.match(r"data:([^;]+)", meta)
    if m:
        mime = m.group(1)
    return mime, base64.b64decode(raw)


def openai_json(path, payload):
    api_key = openai_api_key()
    if not api_key:
        raise RuntimeError("Lokální pomocník nemá nastavený OPENAI_API_KEY.")
    request = urllib.request.Request(
        "https://api.openai.com/v1" + path,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:1200]
        raise RuntimeError("OpenAI API odmítlo požadavek: " + detail) from error


def transcribe_audio_part(binary, filename, mime, api_key):
    if len(binary) > MAX_OPENAI_AUDIO_BYTES:
        raise RuntimeError("Část nahrávky je stále větší než 24 MB.")
    boundary = "----FilipCrm" + uuid.uuid4().hex
    parts = []
    def field(name, value):
        parts.extend([f"--{boundary}\r\n".encode(), f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(), str(value).encode("utf-8"), b"\r\n"])
    field("model", OPENAI_TRANSCRIBE_MODEL)
    field("language", "cs")
    field("response_format", "json")
    parts.extend([f"--{boundary}\r\n".encode(), f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"), f"Content-Type: {mime}\r\n\r\n".encode(), binary, b"\r\n", f"--{boundary}--\r\n".encode()])
    request = urllib.request.Request("https://api.openai.com/v1/audio/transcriptions", data=b"".join(parts), headers={"Authorization":"Bearer "+api_key,"Content-Type":"multipart/form-data; boundary="+boundary}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:1200]
        raise RuntimeError("Přepis audia selhal: " + detail) from error
    return str(result.get("text") or "").strip()


def split_large_audio(binary, filename):
    ffmpeg = FFMPEG if Path(FFMPEG).exists() else shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("Nahrávka je větší než 24 MB a na Macu chybí FFmpeg pro její automatické rozdělení.")
    suffix = Path(filename).suffix.lower()
    if suffix not in {".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".wav", ".webm", ".ogg", ".flac"}:
        suffix = ".m4a"
    with tempfile.TemporaryDirectory(prefix="filip-crm-audio-") as tmp:
        tmp_path = Path(tmp)
        source = tmp_path / ("source" + suffix)
        source.write_bytes(binary)
        pattern = tmp_path / "cast-%03d.mp3"
        command = [
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "libmp3lame", "-b:a", "48k", "-f", "segment",
            "-segment_time", "1800", "-reset_timestamps", "1", str(pattern),
        ]
        result = subprocess.run(command, capture_output=True, text=True, timeout=900)
        if result.returncode != 0:
            raise RuntimeError("Velkou nahrávku se nepodařilo připravit: " + result.stderr.strip()[-800:])
        chunks = [(path.name, path.read_bytes(), "audio/mpeg") for path in sorted(tmp_path.glob("cast-*.mp3"))]
        if not chunks:
            raise RuntimeError("Po rozdělení nahrávky nevznikla žádná zvuková část.")
        if any(len(chunk[1]) > MAX_OPENAI_AUDIO_BYTES for chunk in chunks):
            raise RuntimeError("Nahrávku se nepodařilo rozdělit na dostatečně malé části.")
        return chunks


def transcribe_audio_whisper_cpp_file(source, filename, progress=None):
    cli = whisper_cpp_cli()
    if not cli or not WHISPER_CPP_MODEL.exists():
        raise RuntimeError("Bezplatný místní model Whisper zatím není nainstalovaný.")
    source = Path(source)
    if not source.exists() or not source.stat().st_size:
        raise RuntimeError("Audio soubor je prázdný nebo ho nelze přečíst.")
    if source.stat().st_size > MAX_AUDIO_INPUT_BYTES:
        raise RuntimeError("Audio je větší než 100 MB. Rozděl nahrávku na části.")
    filename = safe_name(filename or source.name or "nahravka.m4a")
    suffix = Path(filename).suffix.lower() or ".m4a"
    ffmpeg = FFMPEG if Path(FFMPEG).exists() else shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("Na Macu chybí FFmpeg pro přípravu nahrávky.")
    with tempfile.TemporaryDirectory(prefix="filip-crm-whisper-") as tmp:
        tmp_path = Path(tmp)
        prepared = tmp_path / "nahravka.wav"
        if progress:
            progress("preparing", "Připravuji zvuk pro přepis")
        convert = subprocess.run([
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(prepared),
        ], capture_output=True, text=True, timeout=1800)
        if convert.returncode != 0:
            raise RuntimeError("Nahrávku se nepodařilo připravit: " + convert.stderr.strip()[-800:])
        output = tmp_path / "prepis"
        if progress:
            progress("transcribing", "Místní Whisper přepisuje nahrávku")
        command = [
            cli, "-ng", "-m", str(WHISPER_CPP_MODEL), "-f", str(prepared), "-l", "cs",
            "-otxt", "-of", str(output), "-nt", "-np", "-sns",
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=7200)
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("Místní přepis trval déle než dvě hodiny a byl ukončen.") from error
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "Neznámá chyba místního Whisperu.").strip()[-1200:]
            raise RuntimeError("Místní přepis selhal: " + detail)
        transcript_file = Path(str(output) + ".txt")
        transcript = transcript_file.read_text(encoding="utf-8").strip() if transcript_file.exists() else result.stdout.strip()
        if not transcript:
            raise RuntimeError("Místní Whisper nevrátil žádný rozpoznaný text.")
        return transcript


def transcribe_audio_whisper_cpp(audio):
    mime, binary = decode_data_url(audio.get("dataUrl"))
    if not binary:
        raise RuntimeError("Audio soubor je prázdný nebo má neplatný formát.")
    filename = safe_name(audio.get("name") or "nahravka.m4a")
    suffix = Path(filename).suffix.lower() or ".m4a"
    with tempfile.TemporaryDirectory(prefix="filip-crm-upload-") as tmp:
        source = Path(tmp) / ("nahravka" + suffix)
        source.write_bytes(binary)
        return transcribe_audio_whisper_cpp_file(source, filename)


def transcribe_audio_macwhisper_file(source, progress=None):
    cli = macwhisper_cli()
    if not cli:
        raise RuntimeError("MacWhisper CLI není nainstalovaný.")
    if progress:
        progress("transcribing", "Místní MacWhisper přepisuje nahrávku")
    result = subprocess.run([cli, "transcribe", str(source), "--language", "cs", "--no-speakers"], capture_output=True, text=True, timeout=7200)
    if result.returncode != 0:
        raise RuntimeError("Místní přepis selhal: " + (result.stderr or result.stdout).strip()[-1200:])
    return result.stdout.strip()


def transcribe_audio_macwhisper(audio):
    mime, binary = decode_data_url(audio.get("dataUrl"))
    if not binary:
        raise RuntimeError("Audio soubor je prázdný nebo má neplatný formát.")
    filename = safe_name(audio.get("name") or "nahravka.m4a")
    suffix = Path(filename).suffix.lower() or ".m4a"
    with tempfile.TemporaryDirectory(prefix="filip-crm-macwhisper-") as tmp:
        source = Path(tmp) / ("nahravka" + suffix)
        source.write_bytes(binary)
        return transcribe_audio_macwhisper_file(source)


def transcribe_audio_local(audio):
    backend = local_transcription_backend()
    if backend == "whisper.cpp":
        return transcribe_audio_whisper_cpp(audio)
    if backend == "macwhisper":
        return transcribe_audio_macwhisper(audio)
    raise RuntimeError("Bezplatný místní přepis zatím není nainstalovaný.")


def ai_job_public(job):
    return {key: value for key, value in job.items() if key not in {"sourcePath"}}


def ai_job_update(job_id, **values):
    with AI_JOBS_LOCK:
        job = AI_JOBS.get(job_id)
        if job:
            job.update(values)
            job["updatedAt"] = datetime.now().isoformat(timespec="seconds")


def ai_job_cleanup():
    cutoff = time.time() - AI_JOB_TTL_SECONDS
    with AI_JOBS_LOCK:
        stale = [job_id for job_id, job in AI_JOBS.items() if job.get("createdUnix", 0) < cutoff]
        for job_id in stale:
            job = AI_JOBS.pop(job_id, None) or {}
            source = Path(job.get("sourcePath") or "")
            if source.exists():
                try:
                    source.unlink()
                except OSError:
                    pass


def cleanup_orphaned_transcriptions():
    upload_dir = BASE_DIR / "temporary-transcriptions"
    if not upload_dir.exists():
        return
    for source in upload_dir.iterdir():
        if source.is_file():
            try:
                source.unlink()
            except OSError:
                pass


def ai_job_worker(job_id):
    with AI_JOBS_LOCK:
        job = dict(AI_JOBS.get(job_id) or {})
    source = Path(job.get("sourcePath") or "")
    try:
        ai_job_update(job_id, status="running", phase="preparing", message="Připravuji nahrávku")
        backend = local_transcription_backend()
        progress = lambda phase, message: ai_job_update(job_id, status="running", phase=phase, message=message)
        if backend == "whisper.cpp":
            transcript = transcribe_audio_whisper_cpp_file(source, job.get("fileName") or source.name, progress)
        elif backend == "macwhisper":
            transcript = transcribe_audio_macwhisper_file(source, progress)
        else:
            raise RuntimeError("Bezplatný místní přepis zatím není nainstalovaný.")
        ai_job_update(job_id, status="done", phase="done", message="Přepis je hotový", transcript=transcript, finishedAt=datetime.now().isoformat(timespec="seconds"))
    except Exception as error:
        ai_job_update(job_id, status="error", phase="error", message="Přepis se nezdařil", error=str(error), finishedAt=datetime.now().isoformat(timespec="seconds"))
    finally:
        if source.exists():
            try:
                source.unlink()
            except OSError:
                pass


def transcribe_audio(audio):
    api_key = openai_api_key()
    if not api_key:
        raise RuntimeError("Lokální pomocník nemá nastavený OPENAI_API_KEY.")
    mime, binary = decode_data_url(audio.get("dataUrl"))
    if not binary:
        raise RuntimeError("Audio soubor je prázdný nebo má neplatný formát.")
    if len(binary) > MAX_AUDIO_INPUT_BYTES:
        raise RuntimeError("Audio je větší než 100 MB. Rozděl nahrávku na části.")
    filename = safe_name(audio.get("name") or "nahravka.m4a")
    if len(binary) <= MAX_OPENAI_AUDIO_BYTES:
        return transcribe_audio_part(binary, filename, mime or audio.get("type") or "audio/mp4", api_key)
    chunks = split_large_audio(binary, filename)
    transcripts = []
    for chunk_name, chunk_binary, chunk_mime in chunks:
        text = transcribe_audio_part(chunk_binary, chunk_name, chunk_mime, api_key)
        if text:
            transcripts.append(text)
    if not transcripts:
        raise RuntimeError("Přepis velké nahrávky nevrátil žádný text.")
    return "\n\n".join(transcripts)


def meeting_schema():
    text_item = {"type":"object","additionalProperties":False,"properties":{"title":{"type":"string"},"detail":{"type":"string"},"date":{"type":"string"}},"required":["title","detail","date"]}
    opportunity = {"type":"object","additionalProperties":False,"properties":{"title":{"type":"string"},"detail":{"type":"string"},"category":{"type":"string"},"amount":{"type":"number"},"date":{"type":"string"}},"required":["title","detail","category","amount","date"]}
    return {"type":"object","additionalProperties":False,"properties":{
        "clientName":{"type":"string"},"summary":{"type":"string"},"discussed":{"type":"array","items":{"type":"string"}},"agreed":{"type":"array","items":{"type":"string"}},"newClientInfo":{"type":"array","items":{"type":"string"}},"opportunities":{"type":"array","items":opportunity},"tasks":{"type":"array","items":text_item},"clientTasks":{"type":"array","items":{"type":"string"}},"documents":{"type":"array","items":{"type":"string"}},"followUp":text_item,"nextMeeting":text_item,"emailDraft":{"type":"string"},"smsDraft":{"type":"string"},"questions":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{"text":{"type":"string"},"answer":{"type":"string"}},"required":["text","answer"]}}
    },"required":["clientName","summary","discussed","agreed","newClientInfo","opportunities","tasks","clientTasks","documents","followUp","nextMeeting","emailDraft","smsDraft","questions"]}


def analyze_transcript(transcript, context):
    system = """Jsi pečlivý asistent českého finančního poradce. Z přepisu připrav pouze věcné návrhy k ruční kontrole. Nic si nedomýšlej. Nejasné částky, termíny, produkty nebo identitu klienta přidej jako otázku. Rozliš úkol poradce, úkol klienta, obchodní příležitost, další schůzku a požadovaný dokument. Datum zapisuj YYYY-MM-DD; pokud není jisté, nech prázdné a polož otázku. Návrh e-mailu a SMS nesmí tvrdit nic, co v přepisu nezaznělo."""
    user = "Datum: {date}\nTyp: {kind}\nPředvolený klient: {client}\n\nPŘEPIS:\n{transcript}".format(date=context.get("date") or "", kind=context.get("meetingType") or "", client=context.get("clientName") or "neurčen", transcript=transcript)
    result = openai_json("/responses", {"model":OPENAI_ANALYSIS_MODEL,"store":False,"input":[{"role":"system","content":system},{"role":"user","content":user}],"text":{"format":{"type":"json_schema","name":"crm_meeting_analysis","strict":True,"schema":meeting_schema()}}})
    output_text = result.get("output_text") or ""
    if not output_text:
        for item in result.get("output") or []:
            for content in item.get("content") or []:
                if content.get("type") == "output_text": output_text += content.get("text") or ""
    if not output_text:
        raise RuntimeError("AI analýza nevrátila použitelný výstup.")
    return json.loads(output_text)


def attachment_ref(contract_id, attachment):
    att_id = safe_name(attachment.get("id") or now_stamp(), "priloha")
    name = safe_name(attachment.get("name") or "priloha")
    return f"contracts/{safe_name(contract_id, 'bez-smlouvy')}/{att_id}_{name}"


def externalize_attachments(state):
    changed = 0
    for contract in state.get("contracts", []) if isinstance(state, dict) else []:
        contract_id = contract.get("id") or "bez-smlouvy"
        attachments = contract.get("attachments")
        if not isinstance(attachments, list):
            continue
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            data_url = attachment.get("dataUrl")
            if not data_url:
                continue
            mime, payload = decode_data_url(data_url)
            if not payload:
                continue
            ref = attachment.get("fileRef") or attachment_ref(contract_id, attachment)
            target = ATTACHMENT_DIR / ref
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("wb") as f:
                f.write(payload)
            attachment["fileRef"] = ref
            attachment["storage"] = "disk"
            attachment["type"] = attachment.get("type") or mime
            attachment["size"] = attachment.get("size") or len(payload)
            attachment["savedAt"] = datetime.now().isoformat(timespec="seconds")
            attachment.pop("dataUrl", None)
            changed += 1
    return changed


def counts(state):
    state = state or {}
    contracts = state.get("contracts") or []
    attachments = sum(len(c.get("attachments") or []) for c in contracts if isinstance(c, dict))
    return {
        "clients": len(state.get("clients") or []),
        "contracts": len(contracts),
        "deals": len(state.get("deals") or []),
        "opportunities": len(state.get("opportunities") or []),
        "notes": len(state.get("notes") or []),
        "attachments": attachments,
    }


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    origin = handler.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    handler.send_header("Access-Control-Allow-Private-Network", "true")
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    server_version = "FILIPCRMStorage/1.0"

    def log_message(self, fmt, *args):
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            with (LOG_DIR / "local-storage.log").open("a", encoding="utf-8") as f:
                f.write("[%s] %s\n" % (datetime.now().isoformat(timespec="seconds"), fmt % args))
        except OSError:
            pass

    def do_OPTIONS(self):
        if not origin_allowed(self):
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self):
        ensure_dirs()
        parsed = urlparse(self.path)
        if parsed.path == "/status":
            state = read_state()
            json_response(self, 200, {
                "ok": True,
                "baseDir": str(BASE_DIR),
                "stateFile": str(STATE_FILE),
                "hasState": state is not None,
                "updatedAt": datetime.fromtimestamp(STATE_FILE.stat().st_mtime).isoformat(timespec="seconds") if STATE_FILE.exists() else "",
                "counts": counts(state),
                "aiConfigured": bool(openai_api_key()),
                "cloudTranscriptionEnabled": bool(ALLOW_OPENAI_FALLBACK and openai_api_key()),
                "localTranscriptionConfigured": bool(local_transcription_backend()),
                "localTranscriptionBackend": local_transcription_backend(),
                "transcriptionMode": "local" if local_transcription_backend() else ("openai" if ALLOW_OPENAI_FALLBACK and openai_api_key() else "none"),
            })
            return
        if parsed.path.startswith("/ai/jobs/"):
            ai_job_cleanup()
            job_id = parsed.path.rsplit("/", 1)[-1]
            with AI_JOBS_LOCK:
                job = dict(AI_JOBS.get(job_id) or {})
            if not job:
                json_response(self, 404, {"ok": False, "error": "Přepis už není dostupný. Zkus nahrávku odeslat znovu."})
                return
            json_response(self, 200, {"ok": True, "job": ai_job_public(job)})
            return
        if parsed.path == "/state":
            state = read_state()
            json_response(self, 200, {
                "ok": True,
                "state": state,
                "hasState": state is not None,
                "updatedAt": datetime.fromtimestamp(STATE_FILE.stat().st_mtime).isoformat(timespec="seconds") if STATE_FILE.exists() else "",
                "counts": counts(state),
            })
            return
        if parsed.path == "/backups":
            json_response(self, 200, {
                "ok": True,
                "backups": list_backups(),
            })
            return
        if parsed.path == "/file":
            qs = parse_qs(parsed.query)
            ref = unquote((qs.get("ref") or [""])[0])
            target = (ATTACHMENT_DIR / ref).resolve()
            root = ATTACHMENT_DIR.resolve()
            if not str(target).startswith(str(root)) or not target.exists():
                json_response(self, 404, {"ok": False, "error": "Soubor nenalezen."})
                return
            mime = "application/octet-stream"
            name = target.name.lower()
            if name.endswith(".pdf"):
                mime = "application/pdf"
            elif name.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
                mime = "image/" + ("jpeg" if name.endswith((".jpg", ".jpeg")) else name.rsplit(".", 1)[-1])
            payload = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(payload)))
            origin = self.headers.get("Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.end_headers()
            self.wfile.write(payload)
            return
        json_response(self, 404, {"ok": False, "error": "Neznámá adresa."})

    def do_POST(self):
        ensure_dirs()
        parsed = urlparse(self.path)
        if not origin_allowed(self):
            json_response(self, 403, {"ok": False, "error": "Tento web nemá povolený přístup k lokálnímu CRM pomocníkovi."})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            json_response(self, 413, {"ok": False, "error": "Data jsou moc velká."})
            return
        if parsed.path == "/ai/jobs":
            if not local_transcription_backend():
                json_response(self, 503, {"ok": False, "error": "Místní Whisper zatím není připravený."})
                return
            if length <= 0:
                json_response(self, 400, {"ok": False, "error": "Nahrávka je prázdná."})
                return
            if length > MAX_AUDIO_INPUT_BYTES:
                json_response(self, 413, {"ok": False, "error": "Nahrávka je větší než 100 MB. Rozděl ji na dvě části."})
                return
            qs = parse_qs(parsed.query)
            file_name = safe_name(unquote((qs.get("name") or ["nahravka.m4a"])[0]))
            suffix = Path(file_name).suffix.lower() or ".m4a"
            upload_dir = BASE_DIR / "temporary-transcriptions"
            upload_dir.mkdir(parents=True, exist_ok=True)
            job_id = uuid.uuid4().hex
            source = upload_dir / (job_id + suffix)
            try:
                remaining = length
                with source.open("wb") as output:
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        output.write(chunk)
                        remaining -= len(chunk)
                if remaining or source.stat().st_size != length:
                    raise RuntimeError("Nahrávku se nepodařilo celou přijmout.")
                now = datetime.now().isoformat(timespec="seconds")
                job = {
                    "id": job_id,
                    "status": "queued",
                    "phase": "queued",
                    "message": "Nahrávka byla přijata a čeká na místní přepis",
                    "fileName": file_name,
                    "fileSize": length,
                    "sourcePath": str(source),
                    "createdAt": now,
                    "updatedAt": now,
                    "createdUnix": time.time(),
                }
                ai_job_cleanup()
                with AI_JOBS_LOCK:
                    AI_JOBS[job_id] = job
                threading.Thread(target=ai_job_worker, args=(job_id,), daemon=True).start()
                json_response(self, 202, {"ok": True, "job": ai_job_public(job)})
            except Exception as error:
                if source.exists():
                    try:
                        source.unlink()
                    except OSError:
                        pass
                json_response(self, 500, {"ok": False, "error": str(error)})
            return
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception as e:
            json_response(self, 400, {"ok": False, "error": "Neplatný JSON: " + str(e)})
            return
        if parsed.path == "/ai/config":
            try:
                save_openai_api_key(payload.get("apiKey"))
                json_response(self, 200, {"ok": True, "aiConfigured": True})
            except Exception as error:
                json_response(self, 400, {"ok": False, "error": str(error)})
            return
        if parsed.path == "/ai/process":
            try:
                audio = payload.get("audio") or {}
                local_mode = bool(local_transcription_backend())
                if not local_mode and not ALLOW_OPENAI_FALLBACK:
                    raise RuntimeError("Místní přepis zatím není připravený. Placená cloudová záloha je vypnutá.")
                transcript = transcribe_audio_local(audio) if local_mode else transcribe_audio(audio)
                if not transcript:
                    raise RuntimeError("V nahrávce se nepodařilo rozpoznat žádný text.")
                analysis = None if local_mode else analyze_transcript(transcript, payload)
                # Audio zůstává pouze v paměti po dobu požadavku. Na disk se neukládá.
                json_response(self, 200, {"ok": True, "transcript": transcript, "analysis": analysis, "analysisMode": "local" if local_mode else "openai", "audioStored": False})
            except Exception as error:
                json_response(self, 500, {"ok": False, "error": str(error)})
            return
        if parsed.path == "/state":
            state = payload.get("state")
            if not isinstance(state, dict):
                json_response(self, 400, {"ok": False, "error": "Chybí CRM data."})
                return
            previous_backup = None
            if STATE_FILE.exists() and payload.get("backup", True):
                previous_backup = backup_state_file(payload.get("reason") or "pred-ulozenim")
            attachment_count = externalize_attachments(state)
            state.setdefault("_diskStorage", {})
            state["_diskStorage"].update({
                "savedAt": datetime.now().isoformat(timespec="seconds"),
                "baseDir": str(BASE_DIR),
                "attachmentsExternalized": attachment_count,
            })
            atomic_write(STATE_FILE, json.dumps(state, ensure_ascii=False, indent=2))
            json_response(self, 200, {
                "ok": True,
                "state": state,
                "stateFile": str(STATE_FILE),
                "backup": previous_backup,
                "counts": counts(state),
                "attachmentsExternalized": attachment_count,
            })
            return
        if parsed.path == "/backup":
            target = backup_state_file(payload.get("reason") or "manual")
            json_response(self, 200, {"ok": True, "backup": target, "backups": list_backups()})
            return
        if parsed.path == "/restore-backup":
            target = backup_path_from_name(payload.get("name"))
            if not target:
                json_response(self, 404, {"ok": False, "error": "Záloha nenalezena."})
                return
            previous_backup = backup_state_file("pred-obnovou-ze-zalohy")
            shutil.copy2(target, STATE_FILE)
            state = read_state()
            json_response(self, 200, {
                "ok": True,
                "state": state,
                "restored": backup_info(target),
                "backup": previous_backup,
                "counts": counts(state),
            })
            return
        json_response(self, 404, {"ok": False, "error": "Neznámá adresa."})


def main():
    ensure_dirs()
    cleanup_orphaned_transcriptions()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"FILIP CRM lokální úložiště běží.")
    print(f"Data: {BASE_DIR}")
    print(f"Kontrola: http://127.0.0.1:{PORT}/status")
    server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
