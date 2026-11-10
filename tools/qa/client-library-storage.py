import importlib.util,tempfile,pathlib,base64
spec=importlib.util.spec_from_file_location('storage',pathlib.Path(__file__).resolve().parents[1]/'local_crm_storage.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
with tempfile.TemporaryDirectory() as folder:
 s.ATTACHMENT_DIR=pathlib.Path(folder)
 data={'name':'nabidka.txt','dataUrl':'data:text/plain;base64,'+base64.b64encode(b'test').decode()}
 a=s.store_client_file(123,data);assert (s.ATTACHMENT_DIR/a['fileRef']).read_bytes()==b'test'
 assert s.store_client_file(123,data)==a
 assert s.store_client_file(124,data)['fileRef']!=a['fileRef']
 try:s.store_client_file(123,dict(data,name='evil.html'));raise AssertionError()
 except ValueError:pass
 state={'clients':[{'id':123,'documents':[{'file':data,'revisions':[{'file':data}]}]}]}
 assert s.externalize_attachments(state)==2
 assert 'dataUrl' not in state['clients'][0]['documents'][0]['file']
 assert s.externalize_attachments(state)==0
 print('PASS client file storage, immutable references, owner separation and portable-backup restore.')
# Exercise the public HTTP route in an isolated store.
import threading,json,urllib.request
with tempfile.TemporaryDirectory() as folder:
 s.BASE_DIR=pathlib.Path(folder);s.ATTACHMENT_DIR=s.BASE_DIR/'attachments';s.STATE_FILE=s.BASE_DIR/'state/crm-state.json';s.BACKUP_DIR=s.BASE_DIR/'backups';s.LOG_DIR=s.BASE_DIR/'logs'
 server=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 try:
  base='http://127.0.0.1:'+str(server.server_port)
  req=urllib.request.Request(base+'/client-file',data=json.dumps(dict(data,clientId=1)).encode(),headers={'Content-Type':'application/json','Origin':'https://filipsolar202-blip.github.io'})
  file=json.load(urllib.request.urlopen(req))['file']
  assert urllib.request.urlopen(base+'/file?ref='+file['fileRef']).read()==b'test'
 finally:server.shutdown();server.server_close()
 print('PASS HTTP upload and download on isolated disk store.')
