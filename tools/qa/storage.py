"""Exercise storage helpers using disposable synthetic data; never start the service."""
import ast
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[2]
for source in (root / 'tools').glob('*.py'):
    ast.parse(source.read_text())
with tempfile.TemporaryDirectory(prefix='filip-crm-qa-') as folder:
    os.environ['FILIP_CRM_DATA_DIR'] = folder
    spec = importlib.util.spec_from_file_location('crm_storage_test', root / 'tools/local_crm_storage.py')
    storage = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(storage)
    assert storage.BASE_DIR == Path(folder)
    storage.ensure_dirs()
    assert storage.read_state() is None
    state = {'clients': [{'id': 1, 'name': 'Synthetic QA'}], 'contracts': [{'id': 2, 'attachments': [{'id': 'qa', 'name': 'test.txt', 'dataUrl': 'data:text/plain;base64,dGVzdA=='}]}], 'insuranceClaims': [{'id': 3, 'syncId': 'qa-claim', 'clientId': 1, 'history': [{'id': 'entry', 'text': 'Synthetic update'}], 'attachments': [{'id': 'qa', 'name': 'test.txt', 'dataUrl': 'data:text/plain;base64,Y2xhaW0='}]}]}
    assert storage.externalize_attachments(state) == 2
    attachment = state['contracts'][0]['attachments'][0]
    assert (storage.ATTACHMENT_DIR / attachment['fileRef']).read_bytes() == b'test'
    assert 'dataUrl' not in attachment
    claim_attachment = state['insuranceClaims'][0]['attachments'][0]
    assert (storage.ATTACHMENT_DIR / claim_attachment['fileRef']).read_bytes() == b'claim'
    assert claim_attachment['fileRef'].startswith('insuranceClaims/')
    assert claim_attachment['dataUrl'] == 'data:text/plain;base64,Y2xhaW0=', 'Google/JSON claim backups must contain portable file contents'
    assert storage.externalize_attachments(state) == 0, 'repeat autosave must not rewrite unchanged attachments'
    original_claim_ref = claim_attachment['fileRef']
    claim_attachment['dataUrl'] = 'data:text/plain;base64,dXBkYXRlZA=='
    assert storage.externalize_attachments(state) == 1
    assert claim_attachment['fileRef'] != original_claim_ref, 'edited file keeps the historical backup attachment intact'
    assert (storage.ATTACHMENT_DIR / original_claim_ref).read_bytes() == b'claim'
    assert (storage.ATTACHMENT_DIR / claim_attachment['fileRef']).read_bytes() == b'updated'
    storage.atomic_write(storage.STATE_FILE, json.dumps(state))
    assert storage.read_state() == state
    backup = storage.backup_state_file('qa')
    assert json.loads(Path(backup).read_text()) == state
    assert len(storage.list_backups()) == 1
    assert storage.counts(state)['attachments'] == 2
    assert storage.counts(state)['insuranceClaims'] == 1
print('PASS: Python syntax; temporary disk state, contract/claim attachments, portable claim backups, unchanged-file skip, historical-file preservation, atomic write and backup readback.')
