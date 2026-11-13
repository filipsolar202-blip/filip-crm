/* Calendar mapping is independent of storage, credentials and the UI. */
(function(root){
'use strict';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const day=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!isNaN(Date.parse(d));
function nextDay(d){return new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
function localTime(value){
 if(!value)return '';
 if(!/([zZ]|[+-]\d\d:\d\d)$/.test(value))return value.slice(0,16);
 const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
 return p.replace(' ','T');
}
function shape(e){return {summary:e.summary||'',description:e.description||'',location:e.location||'',start:e.start?.date||localTime(e.start?.dateTime),end:e.end?.date||localTime(e.end?.dateTime),allDay:!!e.start?.date};}
function payload(a,client){
 if(!day(a.date))throw Error('Chybí platné datum.');
 const summary=(a.completed?'✓ ':'')+(a.calendarTitle||[a.type||'Úkol',client].filter(Boolean).join(' · '));
 const body={summary,description:a.text||'',location:a.location||'',transparency:a.completed||!a.time?'transparent':'opaque',extendedProperties:{private:{filipCrmActivity:a.syncId,filipCrmApp:'filip-crm-v1'}}};
 if(a.time){
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time))throw Error('Neplatný čas.');
  const duration=Number(a.duration)||30;
  if(duration<1||duration>1440)throw Error('Délka musí být 1 až 1440 minut.');
  const start=a.date+'T'+a.time+':00',end=new Date(Date.parse(start+'Z')+duration*60000).toISOString().slice(0,19);
  body.start={dateTime:start,timeZone:'Europe/Prague'};body.end={dateTime:end,timeZone:'Europe/Prague'};
 }else{body.start={date:a.date};body.end={date:nextDay(a.date)};}
 return body;
}
function decide(base,local,remote){
 if(!remote||remote.status==='cancelled')return 'removed';
 const r=shape(remote),l=shape(local);
 if(equal(l,r))return 'same';
 if(!base)return 'conflict';
 const lc=!equal(l,base),rc=!equal(r,base);
 return lc&&rc?'conflict':lc?'push':rc?'pull':'same';
}
function pull(a,event){
 const s=shape(event);
 if(!s.start||!s.end)throw Error('Událost nemá platný termín.');
 if(s.allDay&&s.end!==nextDay(s.start))throw Error('Vícedenní úkol vyžaduje ruční kontrolu.');
 const duration=s.allDay?a.duration:(Date.parse(s.end+'Z')-Date.parse(s.start+'Z'))/60000;
 if(!s.allDay&&(!Number.isFinite(duration)||duration<1||duration>1440))throw Error('Délka události vyžaduje ruční kontrolu.');
 return {...a,date:s.start.slice(0,10),time:s.allDay?'':s.start.slice(11,16),duration,calendarTitle:s.summary.replace(/^✓\s*/,''),text:s.description,location:s.location,completed:s.summary.startsWith('✓ '),completedAt:s.summary.startsWith('✓ ')?a.completedAt||new Date().toISOString().slice(0,10):'',updatedAt:new Date().toISOString()};
}
function candidate(a,client,e){
 if(e.status==='cancelled')return false;
 const s=shape(e),name=String(client||'').toLocaleLowerCase('cs');
 return s.start?.slice(0,10)===a.date&&(s.summary===payload(a,client).summary||(name.length>3&&(s.summary+' '+s.description).toLocaleLowerCase('cs').includes(name)));
}
function overlap(body,event){
 if(event.status==='cancelled'||event.transparency==='transparent'||!body.start.dateTime||!event.start?.dateTime)return false;
 const a=shape(body),b=shape(event);return a.start<b.end&&b.start<a.end;
}
const api={equal,day,nextDay,shape,payload,decide,pull,candidate,overlap};
if(typeof module==='object')module.exports=api;else root.CrmCalendarCore=api;
})(globalThis);
