/* Read-only weekly queue. Contract + review cycle is the identity; only confirmed
   dispatch in CrmForms consumes it. Opening this view never writes client data. */
window.CrmAnniversaries=(()=>{
 const start='2026-11-16',same=(a,b)=>String(a)===String(b);
 function monday(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  const d=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day));let back=(d.getUTCDay()+6)%7;if(!back&&+parts.hour<9)back=7;d.setUTCDate(d.getUTCDate()-back);return d.toISOString().slice(0,10);
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
   let guard=0;while(cycle&&cycle<=end&&sent.some(r=>r.reviewCycle===cycle||(!r.reviewCycle&&r.sentDate<=cycle&&(new Date(cycle)-new Date(r.sentDate))/86400000<=80))&&guard++<100){cycle=contractReviewDate({...contract,lastReviewAnniversary:cycle},start);}
   if(cycle&&cycle>end)continue;
   const warnings=[];if(!cycle)warnings.push('Doplnit výročí');if(!client)warnings.push('Chybí klient');else if(!client.email)warnings.push('Doplnit e-mail');
   if(getStatuses(contract).some(x=>['vypoved','nechce','neprepojistuje'].includes(x))||(contract.terminations||[]).some(t=>['submitted','received'].includes(t.status)))warnings.push('Ověřit stav smlouvy / výpověď');
   if(getStatuses(contract).includes('email')&&!sent.length)warnings.push('Ověřit dřívější odeslání');
   out.push({contract,client,cycle,warnings,key:contract.id+'|'+(cycle||'unknown')});
  }return out.sort((a,b)=>(a.cycle||'9999').localeCompare(b.cycle||'9999')||clientName(a.client).localeCompare(clientName(b.client),'cs'));
 }
 function prepare(id){const r=rows().find(x=>same(x.contract.id,id));if(!r?.client||!r.cycle)return;CrmForms.prepareAnniversary(r.client.id,r.contract.id,r.cycle);}
 function render(query=''){
  const all=rows(),list=all.filter(r=>!query||norm([clientName(r.client),r.client?.email,r.contract.number,r.contract.company,r.contract.product].join(' ')).includes(query));
  byId('contractMetrics').innerHTML=`<div class="metric"><span class="note">K oslovení</span><b>${all.length}</b></div><div class="metric"><span class="note">Nutná kontrola</span><b>${all.filter(r=>r.warnings.length).length}</b></div>`;
  const html=`<div class="notice"><b>Výročí · pondělní výběr ${esc(monday())}</b><p>Auta každý rok, majetek každé dva roky, 80 dnů před výročím. Nevyřízené položky zůstávají až do potvrzení odeslání. Příprava e-mailu nic neodesílá.</p></div>`+list.map(({contract:s,client:c,cycle,warnings})=>`<article class="mini-card" style="margin:12px 0"><div class="toolbar"><div><h3>${esc(c?clientName(c):'Klient chybí')}</h3><b>${esc(s.product||s.type)}</b> · ${esc(s.company||'')}<p class="note">Smlouva ${esc(s.number||'bez čísla')} · Výročí ${esc(cycle||'neuvedeno')} · ${esc(c?.email||'bez e-mailu')}</p><div class="chips">${warnings.map(w=>`<span class="badge orange">${esc(w)}</span>`).join('')}</div></div><div class="actions">${c&&cycle?`<button class="btn primary" onclick="CrmAnniversaries.prepare(${Number(s.id)})">Připravit e-mail</button>`:''}${c?`<button class="btn" onclick="openClientModal(${Number(c.id)})">Upravit kontakt</button>`:''}<button class="btn" onclick="openContractModal(${Number(s.clientId)},${Number(s.id)})">Smlouva</button></div></div></article>`).join('')+(list.length?'':'<p>Žádné smlouvy k oslovení v tomto výběru.</p>');
  const wrap=byId('contractsTable')?.closest('.table-wrap');if(wrap)wrap.outerHTML='<div class="contracts-list" id="contractsList"></div>';byId('contractsList').innerHTML=html;
 }
 return {rows,monday,render,prepare};
})();
