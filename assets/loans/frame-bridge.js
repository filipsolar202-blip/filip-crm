/* Same-origin CRM adapter. The supplied loan model remains isolated in this frame. */
(()=>{
 'use strict';
 if(parent===window){document.getElementById('crmLoanBar')?.remove();document.body.classList.remove('crm-embedded');return;}
 document.body.classList.add('crm-embedded');
 let token=null,ready=false,silent=false,last='';
 const send=(type,extra={})=>parent.postMessage({channel:'filip-loans',token,type,...extra},location.origin);
 const snapshot=()=>JSON.parse(JSON.stringify(state()));
 function publish(type='save'){if(!ready||silent)return;const data=snapshot(),raw=JSON.stringify(data);if(type==='save'&&raw===last)return;last=raw;send(type,{data});}
 function replace(data,identity){
  silent=true;
  try{if(data)applyState(data);else{
    applyState(JSON.parse(JSON.stringify(initialState)));
    for(const el of adviceElements())if(el.id.startsWith('q')){if(el.type==='checkbox')el.checked=false;else if(el.tagName!=='SELECT')el.value='';}
    $('qName').value=identity.name||'';$('clientName').value=identity.name||'';
    $('qAge').value=identity.age==null?'':String(identity.age);$('age').value=$('qAge').value;
    $('qReserveMonths').value='6';$('principal').value='';$('payment').value='';$('property').value='';
    calculate();
    $('advisorName').value=identity.advisor||'Filip Solár';
   }
   showPage('questionnaire');
  }finally{silent=false;}
 }
 const bar=document.createElement('div');bar.id='crmLoanBar';bar.className='crm-loan-bar';bar.innerHTML='<strong>Úvěrové studio · propojeno s kartou klienta</strong><span id="crmLoanStatus">Načítám uloženou kalkulaci…</span><button class="btn" id="crmLoanSave">Uložit ke klientovi</button><button class="btn" id="crmLoanProposal">Uložit návrh</button>';
 document.body.prepend(bar);
 document.getElementById('crmLoanSave').onclick=()=>publish('saveNow');
 document.getElementById('crmLoanProposal').onclick=()=>publish('proposal');
 // Do not allow interaction with initial demonstration defaults before CRM initialization.
 document.querySelector('main')?.setAttribute('inert','');
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin||e.data?.channel!=='filip-loans')return;
  const m=e.data;if(m.type!=='init'&&(!token||m.token!==token))return;
  const before=snapshot();
  try{
   if(m.type==='init'){token=m.token;replace(m.data,m.identity||{});ready=true;document.querySelector('main')?.removeAttribute('inert');publish('loaded');}
   if(m.type==='import'){silent=true;importClientIntake(m.data);silent=false;publish('imported');}
   if(m.type==='replace'){replace(m.data,m.identity||{});publish('replaced');}
   if(m.type==='ack')document.getElementById('crmLoanStatus').textContent=m.ok?'Změny jsou uložené u klienta.':'Uložení se nepodařilo. Stáhněte rozpracovanou kalkulaci.';
  }catch(err){silent=true;try{applyState(before);}finally{silent=false;}send('error',{message:err.message});}
 });
 for(const name of ['input','change','click'])document.addEventListener(name,()=>queueMicrotask(()=>publish()));
 document.addEventListener('click',e=>{
  if(e.target.closest('#resetAll')){e.preventDefault();e.stopImmediatePropagation();send('newCalculation');}
  if(e.target.closest('#saveHtml')){e.preventDefault();e.stopImmediatePropagation();const doc=document.documentElement.cloneNode(true);doc.querySelector('#crmLoanBar')?.remove();doc.querySelector('body').classList.remove('crm-embedded');doc.querySelectorAll('script[src*="frame-bridge"]').forEach(x=>x.remove());doc.querySelector('#savedState').textContent=JSON.stringify(state()).replace(/</g,'\\u003c');doc.querySelector('#toast').hidden=true;download('<!doctype html>\n'+doc.outerHTML,intakeFilename($('clientName').value,false).replace(/\.json$/,'-kalkulace.html'),'text/html;charset=utf-8');}
  if(e.target.closest('#importIntake,#importJson')){e.preventDefault();e.stopImmediatePropagation();send('chooseImport');}
  if(e.target.closest('#exportJson')){e.preventDefault();e.stopImmediatePropagation();publish('export');}
  if(e.target.closest('#clientPdf')&&ready){renderClientReport();if(result&&!$('clientPdf').disabled)publish('proposal');}
 },true);
 window.addEventListener('beforeunload',()=>publish('saveNow'));
 window.CrmLoanFrame={snapshot:()=>ready?snapshot():null};
 send('ready');
})();
