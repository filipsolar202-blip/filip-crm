/* OAuth token stays in memory. No mail scopes, invitations, automatic deletions or background server. */
const CrmCalendar=(()=>{
'use strict';
const WORK_CALENDAR='4c5sjddqejkk65ghl68dd1tl64@group.calendar.google.com';
const C=CrmCalendarCore,CONFIG='filip_crm_calendar_connection_v1',API='https://www.googleapis.com/calendar/v3';
let token='',expires=0,busy=false,preview=[],calendars=[],stale=false,lastMessage='Kalendář zatím není připojený.',timer;
const DEFAULT_CLIENT_ID='416837933224-ucmiskrd4c4q2901m64m5vpin7d8a7qd.apps.googleusercontent.com';
const config=()=>{try{return {clientId:DEFAULT_CLIENT_ID,...JSON.parse(localStorage.getItem(CONFIG)||'{}')};}catch{return {clientId:DEFAULT_CLIENT_ID};}};
const active=()=>!!config().calendarId;
const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activity=id=>state.activities.find(a=>a.syncId===id);
function message(s){lastMessage=s;const el=document.getElementById('calendarSyncStatus');if(el)el.textContent=s;}
function valid(){if(stale)throw Error('CRM změnila jiná karta. Obnovte aktuální data před synchronizací.');if(!token||Date.now()>expires)throw Error('Přihlaste se ke Google Kalendáři. Přístup vypršel nebo není připojený.');}
async function request(path,method='GET',body,etag){
 valid();const headers={Authorization:'Bearer '+token};if(body)headers['Content-Type']='application/json';if(etag)headers['If-Match']=etag;
 const r=await fetch(API+path,{method,headers,body:body?JSON.stringify(body):undefined});
 if(r.status===401){token='';throw Error('Přihlášení vypršelo. Připojte Google znovu.');}
 if(method==='GET'&&(r.status===404||r.status===410))return null;
 if(!r.ok){const e=Error(r.status===412?'Událost se mezitím změnila. Načtěte nový náhled.':'Google Kalendář vrátil chybu '+r.status+'. Zkuste načíst nový náhled.');e.status=r.status;throw e;}
 return r.status===204?{}:r.json();
}
const path=(calendar,id)=>'/calendars/'+encodeURIComponent(calendar)+'/events'+(id?'/'+encodeURIComponent(id):'');
async function list(pathname,params={}){let items=[],pageToken;do{const r=await request(pathname+'?'+new URLSearchParams({...params,maxResults:'250',...(pageToken?{pageToken}:{})}));if(!r)throw Error('Kalendář není dostupný.');items.push(...r.items||[]);pageToken=r.nextPageToken;}while(pageToken);return items;}
async function eventId(syncId){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('filip-crm-v1:'+syncId));return 'fc'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function save(){if(!persist())throw Error('CRM nelze uložit. Synchronizace byla zastavena.');}
function mount(){
 const host=document.getElementById('calendarSyncPanel');if(!host)return;const cfg=config();
 host.innerHTML=`<div class="eyebrow">Propojení</div><h2>Google Kalendář</h2><p class="note">Úkoly s časem jako události; bez času jako celodenní připomínky. Změny propojených položek se přenášejí oběma směry. E-mail ani pozvánky se neodesílají.</p><details><summary>Jednorázové nastavení připojení</summary><label class="field">Google OAuth Client ID<input id="calendarClientId" value="${escHtml(cfg.clientId||'')}" placeholder="…apps.googleusercontent.com"></label></details><div class="actions"><button class="btn" onclick="CrmCalendar.connect()">Přihlásit Google</button><button class="btn" onclick="CrmCalendar.disconnect()">Odpojit</button></div><label class="field">Pracovní kalendář<select id="calendarSelection" onchange="CrmCalendar.selectCalendar()"><option value="">Vyberte kalendář…</option>${calendars.length?calendars.map(c=>`<option value="${escHtml(c.id)}" ${c.id===cfg.calendarId?'selected':''}>${escHtml(c.summary)}</option>`).join(''):cfg.calendarId?`<option selected value="${escHtml(cfg.calendarId)}">${escHtml(cfg.calendarName||cfg.calendarId)}</option>`:''}</select></label><div class="actions"><button class="btn primary" onclick="CrmCalendar.review()">Porovnat s kalendářem</button><button class="btn" onclick="CrmCalendar.toggleAuto()">${cfg.auto?'Pozastavit':'Zapnout'} průběžnou synchronizaci propojených</button></div><label class="check-row"><input type="checkbox" ${cfg.autoNew?'checked':''} onchange="CrmCalendar.toggleNew(this.checked)"> Nové kroky od zapnutí automaticky přidávat do kalendáře</label><p id="calendarSyncStatus" role="status">${escHtml(lastMessage)}</p><p class="note">Starší úkoly nejprve propojte v náhledu. Nové lze přidávat automaticky po zapnutí této volby. Průběžná synchronizace běží pouze při otevřeném CRM a platném přihlášení. V kalendáři označte hotovou položku prefixem ✓ v názvu. Pozastavené kroky mají ⏸, zrušené × a neblokují čas. Smazaná událost se automaticky neobnoví.</p><div id="calendarSyncPreview"></div>`;
}
async function connect(){try{
 const clientId=document.getElementById('calendarClientId').value.trim();if(!clientId.endsWith('.apps.googleusercontent.com'))throw Error('Doplňte OAuth Client ID z Google Cloud. Návod je v google-calendar/README.md.');
 if(location.protocol==='file:')throw Error('Přihlášení Google vyžaduje webovou adresu CRM, například stávající GitHub Pages. Soubor file:// není podporovaný.');
 localStorage.setItem(CONFIG,JSON.stringify({...config(),clientId}));
 if(!window.google?.accounts?.oauth2)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>reject(Error('Nepodařilo se načíst přihlášení Google.'));document.head.appendChild(s);});
 google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',include_granted_scopes:false,error_callback:()=>message('Přihlášení bylo zrušeno nebo se nepodařilo.'),callback:async r=>{try{if(r.error)throw Error('Google přihlášení nebylo potvrzené.');token=r.access_token;expires=Date.now()+(Number(r.expires_in)-60)*1000;calendars=(await list('/users/me/calendarList')).filter(x=>x.id===WORK_CALENDAR&&['owner','writer'].includes(x.accessRole));if(!calendars.length)throw Error('Účet nemá přístup ke kalendáři Filip pracovní. Přihlaste správný Google účet.');const previous=config();localStorage.setItem(CONFIG,JSON.stringify({...previous,calendarId:WORK_CALENDAR,calendarName:'Filip pracovní',...(previous.calendarId!==WORK_CALENDAR?{auto:false,autoNew:false}:{})}));message('Připojeno ke kalendáři Filip pracovní. Otevřete náhled propojení.');mount();}catch(e){message(e.message);}}}).requestAccessToken({prompt:'select_account'});
 }catch(e){message(e.message);}}
function disconnect(){token='';expires=0;const c=config();c.auto=false;localStorage.setItem(CONFIG,JSON.stringify(c));preview=[];message('Odpojeno v tomto CRM. Existující události a vazby zůstávají zachované.');mount();}
function selectCalendar(){const id=document.getElementById('calendarSelection').value,c=calendars.find(x=>x.id===id);if(!c||id!==WORK_CALENDAR)return;localStorage.setItem(CONFIG,JSON.stringify({...config(),calendarId:id,calendarName:c.summary,auto:false,autoNew:false}));preview=[];message('Kalendář vybrán. Nejdříve porovnejte úkoly; zatím nic nebylo zapsáno.');mount();}
function toggleNew(enabled){const c=config();if(!c.calendarId){mount();return message('Nejdříve vyberte kalendář.');}c.autoNew=enabled;if(enabled){c.autoNewSince=new Date().toISOString();c.knownActivities=state.activities.map(a=>a.syncId).filter(Boolean);c.auto=true;}localStorage.setItem(CONFIG,JSON.stringify(c));mount();}
function toggleAuto(){const c=config();if(!c.calendarId)return message('Nejdříve vyberte kalendář.');c.auto=!c.auto;localStorage.setItem(CONFIG,JSON.stringify(c));mount();}
function eligible(a){return (a.recordKind!=='history'||!!a.calendarLink)&&!a.deletedAt&&C.day(a.date)&&a.syncId;}
function assertCurrent(row){const a=activity(row.syncId);if(!a||JSON.stringify(a)!==row.before)throw Error('Úkol se mezitím změnil. Načtěte nový náhled.');valid();return a;}
async function build(managedOnly=false){
 valid();const cfg=config();if(cfg.calendarId!==WORK_CALENDAR)throw Error('Připojte kalendář Filip pracovní.');
 const rows=state.activities.filter(a=>eligible(a)&&(a.calendarLink?.calendarId===cfg.calendarId||!a.calendarLink&&!a.completed&&(!a.automation||a.automation.status==='open')&&(!managedOnly||cfg.autoNew&&(!(cfg.knownActivities||[]).includes(a.syncId)||cfg.autoNewSince&&a.automation?.calendarRequestedAt>=cfg.autoNewSince))));
 if(rows.length>300)throw Error('Náhled obsahuje přes 300 úkolů. Nejdříve uzavřete nebo upravte staré neaktuální aktivity.');
 const result=[],cache=new Map();
 const owned=await list(path(cfg.calendarId),{privateExtendedProperty:'filipCrmApp=filip-crm-v1',showDeleted:'true'});
 for(const original of rows){
  const a=structuredClone(original),name=clientName(findClient(a.clientId)),body=C.payload(a,name),link=a.calendarLink;
  const row={syncId:a.syncId,before:JSON.stringify(a),calendarId:cfg.calendarId,body,name,kind:'create'};
  const date=a.date;if(!cache.has(date))cache.set(date,await list(path(cfg.calendarId),{timeMin:date+'T00:00:00+02:00',timeMax:C.nextDay(date)+'T01:00:00+01:00',singleEvents:'true',showDeleted:'false'}));
  const daily=cache.get(date);
  const recovered=owned.filter(e=>e.extendedProperties?.private?.filipCrmActivity===a.syncId);
  if(recovered.length>1){row.kind='restricted';result.push(row);continue;}
  row.remote=await request(path(cfg.calendarId,link?.eventId||recovered[0]?.id||await eventId(a.syncId)));
  if(recovered.some(e=>e.status==='cancelled')&&!row.remote){row.kind='removed';}
  else if(link){row.kind=C.decide(link.base,body,row.remote);if(['paused','cancelled'].includes(a.automation?.status)&&row.kind==='pull'&&C.shape(row.remote).summary!==C.shape(body).summary)row.kind='conflict';}
  else if(row.remote){row.kind=row.remote.extendedProperties?.private?.filipCrmActivity===a.syncId?C.decide(null,body,row.remote):'conflict';}
  else{row.candidates=daily.filter(e=>C.candidate(a,name,e));if(row.candidates.length)row.kind='candidate';}
  row.overlaps=daily.filter(e=>e.id!==row.remote?.id&&C.overlap(body,e));
  if(row.kind==='create'&&row.overlaps.length)row.kind='busy';
  if(row.remote?.extendedProperties?.private?.filipCrmActivity&&row.remote.extendedProperties.private.filipCrmActivity!==a.syncId)row.kind='restricted';
  if(row.remote?.recurrence||row.remote?.recurringEventId||row.remote?.attendees?.length||row.remote?.eventType&&row.remote.eventType!=='default')row.kind='restricted';
  result.push(row);
 }
 return result;
}
const labels={create:'Vytvořit',push:'CRM → Google',pull:'Google → CRM',same:'Shodné / potvrdit vazbu',conflict:'Změny na obou stranách — zvolte zdroj',candidate:'Možná existující událost — propojit',removed:'Smazáno v Google — ponecháno v CRM ke kontrole',busy:'Časový konflikt — upravte termín',restricted:'Pozvánka nebo opakovaná událost — upravte ručně'};
function showPreview(){const el=document.getElementById('calendarSyncPreview');if(!el)return;
 el.innerHTML=preview.map((r,i)=>`<div class="card" style="margin-top:8px"><b>${escHtml(r.body.summary)}</b><p>${escHtml(C.shape(r.body).start)} · ${escHtml(labels[r.kind])}</p>${r.remote?`<p>Google: ${escHtml(r.remote.summary)} · ${escHtml(C.shape(r.remote).start)}</p>`:''}${r.overlaps?.length?`<p>Obsazený čas: ${r.overlaps.map(e=>escHtml(e.summary||'Událost')).join(', ')}</p>`:''}<div class="actions">${['create','push','pull','same'].includes(r.kind)?`<button class="btn" onclick="CrmCalendar.apply(${i})">${r.kind==='same'?'Potvrdit propojení':'Provést změnu'}</button>`:''}${r.kind==='conflict'?`<button class="btn" onclick="CrmCalendar.apply(${i},'pull')">Použít Google</button><button class="btn" onclick="CrmCalendar.apply(${i},'push')">Použít CRM</button>`:''}${r.kind==='candidate'?(r.candidates||[]).map((e,j)=>`<button class="btn" onclick="CrmCalendar.pair(${i},${j})">Propojit: ${escHtml(e.summary)}</button>`).join(''):''}</div></div>`).join('')||'<p>Žádné otevřené úkoly k propojení.</p>';}
async function locked(fn){if(busy)return;busy=true;try{if(!navigator.locks)throw Error('Pro synchronizaci použijte prohlížeč s podporou bezpečného zámku (aktuální Chrome nebo Safari).');await navigator.locks.request('filip-crm-calendar-sync',{ifAvailable:true},async lock=>{if(!lock)throw Error('Synchronizace právě běží v jiné kartě.');await fn();});}catch(e){message(e.message);}finally{busy=false;}}
async function review(){return locked(async()=>{message('Porovnávám úkoly a existující události…');preview=await build();message('Náhled připraven. Zatím žádné změny.');showPreview();});}
async function perform(row,choice){
 let a=assertCurrent(row),mode=choice||row.kind;
 if(!['create','push','pull','same'].includes(mode))throw Error('Tato položka vyžaduje ruční kontrolu.');
 let remote=row.remote;
 if(remote){const fresh=await request(path(row.calendarId,remote.id));if(!fresh||fresh.etag!==remote.etag)throw Error('Událost se mezitím změnila. Načtěte nový náhled.');remote=fresh;}
 assertCurrent(row);
 if(remote?.extendedProperties?.private?.filipCrmActivity&&remote.extendedProperties.private.filipCrmActivity!==a.syncId)throw Error('Událost patří jinému CRM úkolu. Obnovte náhled.');
 if(mode==='pull')C.pull(a,remote); // Validate before any mutation.
 // Durable pre-operation snapshot; no remote write when local storage is full.
 localStorage.setItem('filip_crm_calendar_before_sync',JSON.stringify({version:2,at:new Date().toISOString(),calendarId:row.calendarId,activity:structuredClone(a)}));
 if(mode==='push'||mode==='create'){
  const checks=await list(path(row.calendarId),{timeMin:a.date+'T00:00:00+02:00',timeMax:C.nextDay(a.date)+'T01:00:00+01:00',singleEvents:'true'});
  if(checks.some(e=>e.id!==remote?.id&&(C.overlap(row.body,e)||mode==='create'&&C.candidate(a,row.name,e))))throw Error('Termín je obsazený nebo existuje podobná událost. Načtěte nový náhled.');
  assertCurrent(row);
  if(mode==='create')remote=await request(path(row.calendarId)+'?sendUpdates=none','POST',{...row.body,id:await eventId(a.syncId)});
  else remote=await request(path(row.calendarId,remote.id)+'?sendUpdates=none','PATCH',{...row.body,extendedProperties:{private:{...(remote.extendedProperties?.private||{}),...row.body.extendedProperties.private}}},remote.etag);
 }
 if(remote.extendedProperties?.private?.filipCrmActivity!==a.syncId){
  remote=await request(path(row.calendarId,remote.id)+'?sendUpdates=none','PATCH',{extendedProperties:{private:{...(remote.extendedProperties?.private||{}),...row.body.extendedProperties.private}}},remote.etag);
 }
 a=assertCurrent(row);const before=structuredClone(a),next=mode==='pull'?C.pull(a,remote):a;
 Object.assign(a,next,{calendarLink:{calendarId:row.calendarId,eventId:remote.id,htmlLink:remote.htmlLink||'',base:C.shape(remote),syncedAt:new Date().toISOString()}});
 try{save();}catch(e){Object.keys(a).forEach(k=>delete a[k]);Object.assign(a,before);throw e;}
}
async function apply(index,choice){return locked(async()=>{await perform(preview[index],choice);message('Změna uložena. Načtěte náhled pro další porovnání.');preview=[];showPreview();});}
async function pair(index,candidateIndex){return locked(async()=>{const r=preview[index],e=r.candidates[candidateIndex];assertCurrent(r);if(e.attendees?.length||e.recurringEventId||e.recurrence||e.eventType&&e.eventType!=='default')throw Error('Pozvánky a opakované události nelze automaticky převzít.');if(state.activities.some(a=>a.calendarLink?.calendarId===r.calendarId&&a.calendarLink?.eventId===e.id))throw Error('Událost už patří jinému úkolu.');if(e.extendedProperties?.private?.filipCrmActivity&&e.extendedProperties.private.filipCrmActivity!==r.syncId)throw Error('Událost má vazbu na jiný CRM úkol.');r.remote=e;r.kind=C.decide(null,r.body,e);showPreview();message('Vyberte zdroj údajů pro existující událost.');});}
async function auto(){if(!config().auto||!token||Date.now()>expires||document.hidden||busy||stale)return;return locked(async()=>{const rows=await build(true);let count=0;for(const r of rows)if(['create','push','pull'].includes(r.kind)){await perform(r);count++;}const conflicts=rows.filter(r=>!['create','push','pull','same'].includes(r.kind));if(conflicts.length){preview=conflicts;showPreview();}message(`Synchronizováno ${count} změn; ${conflicts.length} položek vyžaduje kontrolu.`);});}
function changed(){clearTimeout(timer);timer=setTimeout(auto,1500);}
window.addEventListener('storage',e=>{if(e.key==='filip_crm_main_v1'){stale=true;message('Data změnila jiná karta. Synchronizace pozastavena; načtěte aktuální CRM.');}});
window.addEventListener('focus',auto);setInterval(auto,60000);
async function availability(from,to){valid();if(config().calendarId!==WORK_CALENDAR)throw Error("Připoj kalendář Filip pracovní.");return list(path(WORK_CALENDAR),{timeMin:from+"T00:00:00+02:00",timeMax:C.nextDay(to)+"T01:00:00+01:00",singleEvents:"true",showDeleted:"false"});}
return {availability,mount,connect,disconnect,selectCalendar,toggleAuto,toggleNew,review,apply,pair,changed,active};
})();
