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
    state = {'clients': [{'id': 1, 'name': 'Synthetic QA'}], 'contracts': [{'id': 2, 'attachments': [{'id': 'qa', 'name': 'test.txt', 'dataUrl': 'data:text/plain;base64,dGVzdA=='}]}]}
    assert storage.externalize_attachments(state) == 1
    attachment = state['contracts'][0]['attachments'][0]
    assert (storage.ATTACHMENT_DIR / attachment['fileRef']).read_bytes() == b'test'
    assert 'dataUrl' not in attachment
    storage.atomic_write(storage.STATE_FILE, json.dumps(state))
    assert storage.read_state() == state
    backup = storage.backup_state_file('qa')
    assert json.loads(Path(backup).read_text()) == state
    assert len(storage.list_backups()) == 1
    assert storage.counts(state)['attachments'] == 1
print('PASS: Python syntax; temporary disk state, attachment extraction, atomic write and backup readback.')
