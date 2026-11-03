/* Explicit bridge for the trusted, bundled calculator. No client record is stored in the URL. */
(function(){
 'use strict';
 let token='',ready=false,last='',revision=0;
 const send=(type,extra={})=>parent.postMessage({channel:'filip-life',type,token,...extra},location.origin);
 function publish(){if(!ready)return;const data=JSON.parse(JSON.stringify(d)),serialized=JSON.stringify(data);if(serialized===last)return;last=serialized;send('save',{data,revision:++revision});}
 function controls(){
  document.querySelectorAll('[data-action="save"],[data-action="load"],[data-action="prepare-client"],[data-client-link]').forEach(el=>el.hidden=true);
  if(!document.getElementById('crmLifeActions')){const box=document.createElement('div');box.id='crmLifeActions';box.className='notice no-print';box.innerHTML='<b>Kalkulace je propojená s otevřeným klientem CRM.</b><div class="actions"><button id="crmLifeSave" disabled>Uložit ke klientovi</button><button id="crmLifeCase" class="primary" disabled>Vybranou variantu → obchodní případ</button></div><small id="crmLifeStatus">Načítám údaje klienta…</small>';document.querySelector('nav').before(box);box.querySelector('#crmLifeSave').onclick=()=>{last='';publish();};box.querySelector('#crmLifeCase').onclick=()=>{publish();send('case',{data:JSON.parse(JSON.stringify(d))});};}
 }
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin||e.data?.channel!=='filip-life')return;
  const msg=e.data;
  if(msg.type==='init'&&!ready){token=msg.token;d=L.normalize(msg.data);L.syncCoverage(d);ready=true;last=JSON.stringify(d);render();controls();document.getElementById('crmLifeStatus').textContent='Změny se ukládají ke klientovi.';document.getElementById('crmLifeCase').disabled=false;document.getElementById('crmLifeSave').disabled=false;}
  if(!ready||msg.token!==token)return;
  if(msg.type==='saved')document.getElementById('crmLifeStatus').textContent=msg.ok?'Uloženo v CRM.':'Uložení se nepovedlo. Nezavírej kalkulaci; stáhni ji nebo zkus uložit znovu.';
  if(msg.type==='replace'){d=L.normalize(msg.data);L.syncCoverage(d);last=JSON.stringify(d);render();controls();}
 });
 ['input','change','click','life:changed'].forEach(type=>document.addEventListener(type,()=>setTimeout(()=>{controls();publish();},0)));
 window.addEventListener('life:changed',()=>setTimeout(publish,0));
 // Route imports through the parent preview so answers never erase existing offers unnoticed.
 document.addEventListener('click',e=>{const b=e.target.closest('[data-action="import"],[data-action="import-text"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();send('import');},true);
 controls();send('ready');
})();
