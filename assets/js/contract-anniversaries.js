/* Read-only weekly queue. Contract + review cycle is the identity; confirmed dispatch or completion consumes it. Opening this view never writes client data. */
window.CrmAnniversaries=(()=>{
 const start='2026-11-16',same=(a,b)=>String(a)===String(b);
 function monday(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  const d=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day));let back=(d.getUTCDay()+6)%7;if(!back&&+parts.hour<9)back=7;d.setUTCDate(d.getUTCDate()-back);return d.toISOString().slice(0,10);
 }
 function completedCycle(contract,cycle){
  if(!cycle||!getStatuses(contract).includes('vyrizeno'))return false;
  const previous=new Date(cycle+'T12:00:00Z');previous.setUTCFullYear(previous.getUTCFullYear()-contractReviewYears(contract));
  const entries=(contract.log||[]).filter(x=>/^(Stav: Vyřízeno|Vyřízeno výročí)/i.test(x.t||''));
  const records=entries.length?entries:[{d:contract.updatedAt}];
  return records.some(x=>x.reviewCycle?x.reviewCycle===cycle:x.d&&x.d>previous.toISOString().slice(0,10)&&x.d<=cycle);
 }
 function handled(contract,client,cycle,s){
  const statuses=getStatuses(contract);
  if(statuses.some(x=>['reseni','prepojistit','vypoved','nabidka','ceka_nabidka','ceka_podklady','domluveno','nechce','neprepojistuje'].includes(x)))return true;
  if((contract.terminations||[]).some(t=>['client','submitted','received','confirmed'].includes(t.status)))return true;
  if((s.opportunities||[]).some(o=>same(o.clientId,contract.clientId)&&[o.contractId,o.replacesContractId].some(id=>id!=null&&same(id,contract.id))&&isOpenOpportunity(o)))return true;
  const previous=cycle?new Date(cycle+'T12:00:00Z'):null;if(previous)previous.setUTCFullYear(previous.getUTCFullYear()-contractReviewYears(contract));
  const inCycle=date=>!date||!previous||String(date).slice(0,10)>previous.toISOString().slice(0,10);
  // Older completed reviews predate the explicit cycle field. Keep them out
  // of this cycle, but allow the next annual/biennial review to return.
  if(statuses.includes('vyrizeno')){const done=(contract.log||[]).filter(x=>/^(Stav: Vyřízeno|Vyřízeno výročí)/i.test(x.t||''));if(done.length?done.some(x=>x.reviewCycle?x.reviewCycle===cycle:inCycle(x.d)):inCycle(contract.updatedAt))return true;}
  const mails=(contract.log||[]).filter(x=>/^(email klientovi|odeslán e-mail|odeslan email|stav: e-?mail)/i.test(x.t||''));
  if(mails.some(x=>inCycle(x.d)))return true;
  // An old generic Email status must not hide every future annual review.
  if(statuses.includes('email')&&!mails.length&&!(client?.clientForms||[]).some(r=>same(r.contractId,contract.id)&&r.sentDate))return true;
  return (s.activities||[]).some(a=>a.completed&&a.type==='Email'&&same(a.clientId,contract.clientId)&&[a.contractId,a.sourceContractId].some(id=>id!=null&&same(id,contract.id))&&inCycle(a.completedAt||a.date));
 }
 function rows(s=state,now=new Date()){
  const cutoff=monday(now);if(cutoff<start)return [];
  const limit=new Date(cutoff+'T12:00:00Z');limit.setUTCDate(limit.getUTCDate()+80);const end=limit.toISOString().slice(0,10),out=[];
  for(const contract of s.contracts){if(!['auto','majetek'].includes(contract.type))continue;
   if(contract.deletedAt||(contract.terminations||[]).some(t=>t.status==='confirmed'&&t.confirmedEnd&&t.confirmedEnd<=cutoff))continue;
   const client=s.clients.find(c=>same(c.id,contract.clientId));let cycle=contractReviewDate(contract,start);
   // Older confirmed sends might not yet have lastReviewAnniversary. Consume
   // their exact cycle from the dispatch history without changing the contract.
   const sent=(client?.clientForms||[]).filter(r=>r.anniversary&&same(r.contractId,contract.id)&&r.sentDate);
   let guard=0;while(cycle&&cycle<=end&&(completedCycle(contract,cycle)||sent.some(r=>r.reviewCycle===cycle||(!r.reviewCycle&&r.sentDate<=cycle&&(new Date(cycle)-new Date(r.sentDate))/86400000<=80)))&&guard++<100){cycle=contractReviewDate({...contract,lastReviewAnniversary:cycle},start);}
   if(cycle&&cycle>end)continue;
   if(handled(contract,client,cycle,s))continue;
   const warnings=[];if(!cycle)warnings.push('Doplnit výročí');if(!client)warnings.push('Chybí klient');else if(!client.email)warnings.push('Doplnit e-mail');
   out.push({contract,client,cycle,warnings,key:contract.id+'|'+(cycle||'unknown')});
  }return out.sort((a,b)=>(a.cycle||'9999').localeCompare(b.cycle||'9999')||clientName(a.client).localeCompare(clientName(b.client),'cs'));
 }
 function prepare(id){const r=rows().find(x=>same(x.contract.id,id));if(!r?.client||!r.cycle)return;CrmForms.prepareAnniversary(r.client.id,r.contract.id,r.cycle);}
 function render(query=''){
  const all=rows(),list=all.filter(r=>!query||norm([clientName(r.client),r.client?.email,r.contract.number,r.contract.company,r.contract.product].join(' ')).includes(query));
  byId('contractMetrics').innerHTML=`<div class="metric"><span class="note">K oslovení</span><b>${all.length}</b></div><div class="metric"><span class="note">Nutná kontrola</span><b>${all.filter(r=>r.warnings.length).length}</b></div>`;
  const html=`<p class="note anniversary-caption">Pondělní výběr ${esc(monday())} · pouze smlouvy k prvnímu oslovení</p>`+list.map(({contract:s,client:c,cycle})=>`<article class="anniversary-row"><div class="anniversary-client"><b>${esc(c?clientName(c):'Klient chybí')}</b>${c&&!c.email?`<button class="anniversary-missing-email" title="Chybí e-mail – doplnit kontakt" aria-label="Chybí e-mail – doplnit kontakt" onclick="openClientModal(${Number(c.id)})"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></button>`:''}</div><div class="anniversary-policy"><span>${esc(s.product||s.type)}${s.company?' · '+esc(s.company):''}</span><small>Smlouva ${esc(s.number||'bez čísla')}</small></div><div class="anniversary-date"><small>Výročí</small><b>${esc(cycle?cycle.split('-').reverse().join('. '):'Doplnit datum')}</b></div><div class="actions">${c&&cycle?`<button class="btn slim primary" onclick="CrmAnniversaries.prepare(${Number(s.id)})">Připravit e-mail</button>`:''}<button class="btn slim" onclick="openContractModal(${Number(s.clientId)},${Number(s.id)})">Smlouva</button></div></article>`).join('')+(list.length?'':'<p>Žádné smlouvy k oslovení v tomto výběru.</p>');
  const wrap=byId('contractsTable')?.closest('.table-wrap');if(wrap)wrap.outerHTML='<div class="contracts-list" id="contractsList"></div>';byId('contractsList').innerHTML=html;
 }
 return {rows,monday,render,prepare};
})();
