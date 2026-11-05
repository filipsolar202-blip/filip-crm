from pathlib import Path
from html.parser import HTMLParser
import json
p=Path(__file__).parent
class Forms(HTMLParser):
 def __init__(self):super().__init__();self.els={};self.sel=None;self.ids=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:
   self.ids.append(a['id']);self.els[a['id']]={'tagName':tag.upper(),'value':a.get('value',''),'type':a.get('type','text'),'checked':'checked' in a,'advice':'data-advice' in a,'options':[]}
  if tag=='select':self.sel=a.get('id')
  if tag=='option' and self.sel:
   self.els[self.sel]['options'].append({'value':a.get('value','')})
   if len(self.els[self.sel]['options'])==1:self.els[self.sel]['value']=a.get('value','')
 def handle_endtag(self,tag):
  if tag=='select':self.sel=None
s=(p/'Uverove-studio.html').read_text();f=Forms();f.feed(s)
assert len(f.ids)==len(set(f.ids)),'Duplicate IDs'
(p/'test-dom.json').write_text(json.dumps(f.els,ensure_ascii=False))
