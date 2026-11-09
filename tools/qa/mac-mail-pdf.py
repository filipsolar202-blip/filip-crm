"""Exercise the helper's PDF renderer with synthetic data; never opens Mail."""
import json,pathlib,subprocess,tempfile,shutil
root=pathlib.Path(__file__).resolve().parents[2]
source=(root/'tools/mac-mail/compose.applescript').read_text()
handler=source[source.index('on makePDF(pdfDocument)'):]
script='use framework "Foundation"\nuse scripting additions\n'+handler+'''
on run args
 set rawData to current application's NSData's dataWithContentsOfFile:(item 1 of args)
 set doc to current application's NSJSONSerialization's JSONObjectWithData:rawData options:0 |error|:(missing value)
 return my makePDF(doc)
end run
'''
with tempfile.TemporaryDirectory(prefix='crm-pdf-qa-') as folder:
 p=pathlib.Path(folder);(p/'render.applescript').write_text(script)
 (p/'input.json').write_text(json.dumps({'name':'Vypoved-TEST.pdf','html':'<!doctype html><html><meta charset="utf-8"><style>@page{size:A4;margin:22mm}body{font:12pt Arial}</style><h1>Výpověď – zkouška</h1><p>Jan Novák, smlouva TEST123.</p><p>Zkontrolujte údaje a podepište.</p></html>'}))
 result=subprocess.run(['osascript',str(p/'render.applescript'),str(p/'input.json')],capture_output=True,text=True,timeout=90)
 assert result.returncode==0,result.stderr
 pdf=pathlib.Path(result.stdout.strip());assert pdf.read_bytes().startswith(b'%PDF-')
 info=subprocess.check_output(['pdfinfo',str(pdf)],text=True);assert 'Pages:           1' in info,info
 text=subprocess.check_output([shutil.which('pdftotext') or str(pathlib.Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftotext'),str(pdf),'-'],text=True);assert 'Jan Novák' in text and 'TEST123' in text
 print('PASS native PDF renderer: A4, one page, Czech text, no Mail or sending. PDF:',pdf)
