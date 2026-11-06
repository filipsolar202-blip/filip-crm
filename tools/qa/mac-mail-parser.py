"""Validate the URL parser without opening Mail, inspecting accounts, or creating drafts."""
import base64,json,pathlib,subprocess,tempfile
source=(pathlib.Path(__file__).resolve().parents[2]/'tools/mac-mail/compose.applescript').read_text()
source=source.replace('on «event GURLGURL» incomingURL','on decodeDraft(incomingURL)').replace('end «event GURLGURL»','end decodeDraft')
a=source.index('  tell application "Mail"');b=source.index(' on error errorText',a)
source=source[:a]+'  return fromAddress & "|" & toAddress & "|" & titleText\n'+source[b:]
a=source.index('  display dialog errorText');b=source.index('\n end try',a);source=source[:a]+'  error errorText'+source[b:]
source=source[:source.index('\non run')]+ '\non run args\n return my decodeDraft(item 1 of args)\nend run\n'
with tempfile.TemporaryDirectory(prefix='crm-mail-qa-') as directory:
 p=pathlib.Path(directory)/'parser.applescript';p.write_text(source)
 def parse(d):
  payload=base64.b64encode(json.dumps(d,ensure_ascii=False).encode()).decode()
  return subprocess.run(['osascript',str(p),'filipcrm-mail://compose?payload='+payload],text=True,capture_output=True)
 data={'from':'f.solar@fair-life.cz','to':'test@example.invalid','subject':'Žluťoučký test','body':'Ahoj,\nzkouška.','bcc':['copy@example.invalid']}
 result=parse(data);assert result.returncode==0,result.stderr
 assert result.stdout.strip()=='f.solar@fair-life.cz|test@example.invalid|Žluťoučký test'
 for patch in [{'from':'filip.solar@mantra-finance.cz'}]:assert parse(dict(data,**patch)).returncode==0
 for patch in [{'from':'wrong@example.invalid'},{'subject':'Test\nBcc: wrong@example.invalid'},{'bcc':['a@example.invalid\nBcc: b@example.invalid']}]:assert parse(dict(data,**patch)).returncode!=0
print('PASS Mac helper URL decoding, UTF-8, two allowed senders, header rejection. Mail never opened.')
