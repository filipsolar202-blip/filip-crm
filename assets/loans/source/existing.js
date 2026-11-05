// Existing obligations are counted once: retained, or explicitly replaced by funded refinancing.
const treatmentNames={keep:'Zachovat stávající + nová hypotéka',merge:'Refinancovat a navýšit',separate:'Refinancovat + samostatný úvěr'};
function loanSchedule(P,r,n,fee=0,A=null){if(!P)return [];return amortize(P,r,n,A??pay(P,r,n)).map(x=>({...x,fee,cash:x.payment+fee}))}
function existingLoan(){
 if(!checked('oldEnabled'))return null;
 if(!['keep','merge','separate'].includes($('oldTreatment').value))throw Error('Neplatná varianta stávající hypotéky.');
 let P=numberInput('oldPrincipal','Zůstatek stávající hypotéky',1,1e10),A=val('oldPayment'),r=val('oldRate'),n=val('oldMonths'),m=$('oldSolve').value;
 if(m==='observed'){
  need(A,'Aktuální anuitní splátka',.01,1e9);
  const fee=numberInput('oldFee','Náklady stávající hypotéky');
  if($('oldTreatment').value!=='keep')throw Error('Před refinancováním ověřte údaje stávající hypotéky a zvolte dopočet.');
  let detail='Chybí údaje pro ověření splátkového kalendáře.';
  if(r!==null&&n!==null){try{const expected=solveMonths(P,A,r);detail=Math.abs(expected-n)>1?'Zadaná splatnost '+n+' měsíců nesouhlasí se zůstatkem, sazbou a splátkou (anuitně přibližně '+expected+' měsíců).':'Ověřte fixaci a potvrďte dopočet splátkového kalendáře.'}catch{detail='Sazba, splátka a zůstatek neumožňují standardní anuitní splácení.'}}
  const notice=detail+' Pro bonitu počítáme uvedenou splátku a náklady jednou, konzervativně po celý horizont nového úvěru. Budoucí zůstatek a úsporu refinancování zatím nevyčíslujeme.';
  return {P,A,r,n:0,fee,fix:val('oldFix'),after:null,partial:true,notice,rows:Array.from({length:600},(_,i)=>({i:i+1,payment:A,cash:A+fee,fee,balance:P})),name:textValue('oldName')||'Stávající hypotéka',samePledge:checked('oldSamePledge'),treatment:'keep'};
 }
 if(m!=='payment')need(A,'Aktuální anuitní splátka',.01,1e9);if(m!=='rate')need(r,'Aktuální sazba',0,100);if(m!=='months'){need(n,'Zbývající splatnost',1,600);if(!Number.isInteger(n))throw Error('Zbývající splatnost musí být v celých měsících.');}
 if(m==='payment')A=pay(P,r,n);else if(m==='rate')r=solveRate(P,A,n);else n=solveMonths(P,A,r);
 need(n,'Dopočtená zbývající doba',1,600);$('old'+{months:'Months',payment:'Payment',rate:'Rate'}[m]).value=m==='months'?String(n):fmt(m==='payment'?A:r,m==='rate'?6:2);
 const fee=numberInput('oldFee','Náklady stávající hypotéky'),fix=integerInput('oldFix','Konec stávající fixace',0,600),after=optionalNumber('oldAfterRate','Sazba po fixaci',0,100)??r;
 if(fix>n)throw Error('Konec stávající fixace je později než konec splatnosti. Opravte zbývající měsíce.');
 let rows=loanSchedule(P,r,n,fee,A);
 if(fix<n&&Math.abs(after-r)>1e-10){const prefix=rows.slice(0,fix),balance=fix?prefix.at(-1).balance:P;rows=[...prefix,...loanSchedule(balance,after,n-fix,fee).map(x=>({...x,i:x.i+fix}))]}
 return {P,A,r,n,fee,fix,after,rows,name:textValue('oldName')||'Stávající hypotéka',samePledge:checked('oldSamePledge'),treatment:$('oldTreatment').value||'keep'};
}
function retainedAt(q,i=0){const row=q.old?.treatment==='keep'?q.old.rows[i]:null;return {payment:q.baseDebtPayment+(row?.payment||0),cash:q.baseDebtPayment+(row?.cash||0),old:row?.payment||0,oldFee:row?.fee||0,balance:row?.balance||0}}
function variantInputs(q=mortgageProfile()){
 const old=q.old;if(old?.partial)throw Error(old.notice);if(!old)throw Error('Nejprve zapněte a vyplňte stávající hypotéku v dotazníku.');
 const b=BANKS.find(x=>x.id===$('variantBank').value);if(!b)throw Error('Vyberte banku nové hypotéky.');
 const h=policyHorizon(b,q.ageForLoan,b.age??70,b.term??30,false),r=need(val('variantRate')??b.rate,'Nabídnutá sazba',0,100),n=val('variantMonths')??h;
 validateTerm(b,n,h);const amount=numberInput('variantAmount','Nové peníze',0,1e10),fee=numberInput('variantFee','Náklady nové hypotéky'),costs=numberInput('variantCosts','Vstupní náklady hypotéky'),exit=numberInput('variantExit','Náklady změny starého úvěru'),horizon=integerInput('variantHorizon','Společný horizont',1,600);
 return {old,b,h,r,n,amount,fee,costs,exit,horizon};
}
function standaloneLoan(amount=null,q=null){
 if(amount===null){if(!checked('oldEnabled')||$('oldTreatment').value!=='separate')return {P:0,rows:[],upfront:0,secured:false};amount=numberInput('variantAmount','Nové peníze',0,1e10)}
 if(!amount)return {P:0,rows:[],upfront:0,secured:false};
 const type=$('variantExtraType').value,r=numberInput('variantExtraRate','Sazba samostatného úvěru',0,100),n=integerInput('variantExtraMonths','Doba samostatného úvěru',1,600),fee=numberInput('variantExtraFee','Náklady samostatného úvěru'),upfront=numberInput('variantExtraCosts','Vstupní náklady samostatného úvěru');
 if(type==='mortgage'){q??=mortgageProfile();const b=BANKS.find(x=>x.id===$('variantBank').value);if(!b)throw Error('Vyberte banku další hypotéky.');validateTerm(b,n,policyHorizon(b,q.ageForLoan,b.age??70,b.term??30,false))}
 return {P:amount,r,n,fee,upfront,type,A:pay(amount,r,n),secured:type==='mortgage'||(type==='building'&&checked('variantExtraSecured')),name:{mortgage:'Samostatná další hypotéka',consumer:'Samostatný spotřebitelský úvěr',building:'Samostatný řádný stavební úvěr'}[type],rows:loanSchedule(amount,r,n,fee)};
}
function capacityModel(q,bs,c,r,n,fee,prop,extra=standaloneLoan(null,q)){
 if(q.actual===null||q.expenses===null||q.recognized===null)return {missing:true};
 const invest=checked('investEnabled')?numberInput('investAmount','Investiční navýšení',1):0,investA=invest?pay(invest,r,n):0;
 const debtLimit=q.recognized*q.customDsti/100;let cash=Infinity,dsti=Infinity;
 for(let i=0;i<n;i++){
  const retained=retainedAt(q,i),otherCash=(bs.rows[i]?.cash||0)+(c.rows[i]?.cash||0)+(extra.rows[i]?.cash||0),otherDebt=(bs.rows[i]?.payment||0)+(c.rows[i]?.payment||0)+(extra.rows[i]?.payment||0);
  cash=Math.min(cash,q.actual-q.expenses-q.saving-retained.cash-otherCash-fee-investA,(q.budget??Infinity)-otherCash-fee-investA);
  dsti=Math.min(dsti,debtLimit-retained.payment-otherDebt-investA);
 }
 const dtiLimit=Math.min(q.customDti,q.investmentProperty?7:Infinity),dtiPrincipal=q.recognized*12*dtiLimit-q.debt-q.credit-bs.P-c.P-extra.P-invest;
 const ltvPrincipal=prop===null?Infinity:prop*q.customLtv/100-q.secured-(bs.secured?bs.P:0)-(extra.secured?extra.P:0)-invest;
 const bounds=[{name:'Rozpočet po výdajích a závazcích',A:cash},{name:'Splátková kapacita dle DSTI',A:dsti},{name:'Celkový dluh dle DTI',A:pay(Math.max(0,dtiPrincipal),r,n)},...(Number.isFinite(ltvPrincipal)?[{name:'Zástava dle zvoleného LTV',A:pay(Math.max(0,ltvPrincipal),r,n)}]:[])];
 const binding=bounds.reduce((a,b)=>a.A<b.A?a:b),A=Math.max(0,binding.A),P=principal(A,r,n);
 return {missing:false,A,P,cash,dsti,dtiPrincipal,ltvPrincipal,bounds,binding:binding.name,debtLimit,retained:retainedAt(q),invest,extra};
}
function currentCapacity(q=mortgageProfile(),bs=buildingLoan(),c=consumerLoan()){
 const n=getHorizon();validateTerm(bank(),n,n);return capacityModel(q,bs,c,numberInput('rate','Sazba hypotéky',0,100),n,numberInput('monthlyFee','Náklady hypotéky'),optionalNumber('property','Zástava',1));
}
function capacitySummary(q,bs,c){try{
 const cap=currentCapacity(q,bs,c);if(cap.missing)return '<p class="note">Kapacita dle závazků a DSTI: doplňte příjmy a výdaje.</p>';
 return keyMetric('Splátkový prostor dle DSTI po závazcích',money(Math.max(0,cap.dsti)),cap.dsti<0,'Započitatelný příjem '+money(q.recognized)+' × '+fmt(q.customDsti)+' % = '+money(cap.debtLimit)+' pro všechny splátky. Ponechané splátky nyní '+money(cap.retained.payment)+'.')+keyMetric('Modelová kapacita hlavní hypotéky',money(cap.A)+'/měs.',false,'Omezuje: '+esc(cap.binding)+'. DTI a rozpočet jsou zahrnuty; '+(q.value===null?'zástava chybí, LTV nelze ověřit.':'zadaná zástava je zahrnuta.')+' Nejde o potvrzenou nabídku.')+(q.old?.treatment==='separate'?'<p class="note">Hlavní hypotéka je zde refinancování. Tlačítko podle rozpočtu dopočte maximální samostatný úvěr navíc.</p>':'');
 }catch(e){return '<p class="note">Kapacitu nelze zatím určit: '+esc(e.message)+'</p>'}}
function calculateSeparateCapacity(){
 const q=mortgageProfile(),v=variantInputs(q),bs=buildingLoan(),c=consumerLoan();if(q.actual===null||q.recognized===null||q.expenses===null)throw Error('Doplňte příjmy a výdaje.');
 const allowed=X=>capacityModel(q,bs,c,v.r,v.n,v.fee,q.value,standaloneLoan(X,q)).P>=q.old.P-1e-7;
 if(!allowed(0))throw Error('Zadané hranice nepokrývají ani refinancování stávajícího úvěru.');
 let lo=0,hi=1e10;for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(allowed(mid))lo=mid;else hi=mid}
 $('variantAmount').value=String(Math.floor(lo*100)/100);useExistingVariant('separate');toast('Samostatný úvěr dopočten po rezervování splátky refinancované hypotéky a ostatních závazků.');
}
function scenarioComparison(){
 const q=mortgageProfile(),v=variantInputs(q),bs=buildingLoan(),c=consumerLoan(),extra=standaloneLoan(v.amount,q),old=v.old;
 const cases=[{id:'baseline',name:'Dnes · beze změny',loans:[old.rows],P:old.P,secured:old.samePledge?old.P:0,upfront:0,newMoney:0},
 {id:'keep',name:treatmentNames.keep,loans:[old.rows,loanSchedule(v.amount,v.r,v.n,v.fee)],P:old.P+v.amount,secured:v.amount+(old.samePledge?old.P:0),upfront:v.amount?v.costs:0,newMoney:v.amount},
 {id:'merge',name:treatmentNames.merge,loans:[loanSchedule(old.P+v.amount,v.r,v.n,v.fee)],P:old.P+v.amount,secured:old.P+v.amount,upfront:v.costs+v.exit,newMoney:v.amount},
 {id:'separate',name:treatmentNames.separate,loans:[loanSchedule(old.P,v.r,v.n,v.fee),extra.rows],P:old.P+extra.P,secured:old.P+(extra.secured?extra.P:0),upfront:v.costs+v.exit+extra.upfront,newMoney:v.amount}];
 for(const s of cases){
  if(s.id!=='baseline'){s.loans.push(bs.rows,c.rows);s.P+=bs.P+c.P;s.secured+=bs.secured?bs.P:0;s.upfront+=bs.upfront+c.upfront+bs.deposit}
  const n=Math.max(...s.loans.map(x=>x.length)),monthly=[];for(let i=0;i<n;i++)monthly.push({payment:s.loans.reduce((sum,x)=>sum+(x[i]?.payment||0),0),cash:s.loans.reduce((sum,x)=>sum+(x[i]?.cash||0),0),interest:s.loans.reduce((sum,x)=>sum+(x[i]?.interest||0),0),balance:s.loans.reduce((sum,x)=>sum+(x[i]?.balance||0),0)});
  s.n=n;s.rows=monthly;s.first=monthly[0].cash;s.household=s.first+q.baseDebtPayment;s.peak=Math.max(...monthly.map(x=>x.cash))+q.baseDebtPayment;
  s.dsti=q.recognized>0?100*(Math.max(...monthly.map(x=>x.payment))+q.baseDebtPayment)/q.recognized:null;s.dti=q.recognized>0?(s.P+q.baseDebt+q.credit)/(q.recognized*12):null;s.ltv=q.value?100*(s.secured+q.baseSecured)/q.value:null;
  s.paidH=s.upfront+monthly.slice(0,v.horizon).reduce((t,x)=>t+x.cash,0);s.balanceH=monthly[v.horizon-1]?.balance||0;s.costH=s.paidH+s.balanceH-s.P;s.total=s.upfront+monthly.reduce((t,x)=>t+x.cash,0);s.cost=s.total-s.P;
  s.free=q.actual===null||q.expenses===null?null:q.actual-q.expenses-q.saving-s.household;
  s.over=(s.dsti!==null&&s.dsti>q.customDsti+1e-8)||(s.dti!==null&&s.dti>Math.min(q.customDti,q.investmentProperty?7:Infinity)+1e-8)||(s.ltv!==null&&s.ltv>Math.min(q.customLtv,q.statutoryLtv,q.recommendedLtv??Infinity)+1e-8)||(s.free!==null&&s.free<0);
 }
 return {q,v,old,extra,cases};
}
function variantTable(model,print=false){const {cases,v}=model,rows=[['Nové peníze',x=>money(x.newMoney)],['Úvěry této varianty / měsíc',x=>money(x.first)],['Všechny závazky / měsíc',x=>money(x.household)],['DSTI · nejvyšší fáze',x=>x.dsti===null?'—':fmt(x.dsti,1)+' %'],['DTI',x=>x.dti===null?'—':fmt(x.dti,2)+'×'],['LTV použité zástavy',x=>x.ltv===null?'—':fmt(x.ltv,1)+' %'],['Zbývá po výdajích a závazcích',x=>x.free===null?'—':money(x.free)],['Zaplaceno do '+duration(v.horizon),x=>money(x.paidH)],['Dluh v horizontu '+duration(v.horizon),x=>money(x.balanceH)],['Úroky a náklady do horizontu¹',x=>money(x.costH)],['Úroky a náklady do splacení¹',x=>money(x.cost)],['Doba do poslední splátky',x=>duration(x.n)]];
 return '<div class="'+(print?'':'tablewrap')+'"><table class="'+(print?'proposal-table':'ad-table')+'"><thead><tr><th>Stejný okamžik porovnání</th>'+cases.map(s=>'<th>'+esc(s.name)+(s.id===$('oldTreatment').value?'<br>POUŽITÝ REŽIM':'')+'</th>').join('')+'</tr></thead><tbody>'+rows.map(([name,fn])=>'<tr><td>'+name+'</td>'+cases.map(s=>'<td'+((name==='DSTI · nejvyšší fáze'&&s.dsti!==null&&s.dsti>model.q.customDsti+1e-8)||(name==='DTI'&&s.dti!==null&&s.dti>Math.min(model.q.customDti,model.q.investmentProperty?7:Infinity)+1e-8)||(name==='LTV použité zástavy'&&s.ltv!==null&&s.ltv>Math.min(model.q.customLtv,model.q.statutoryLtv,model.q.recommendedLtv??Infinity)+1e-8)||(name==='Zbývá po výdajích a závazcích'&&s.free!==null&&s.free<0)?' class="red-text"':'')+'>'+fn(s)+'</td>').join('')+'</tr>').join('')+(print?'':'<tr><td>Přenést do kalkulace</td>'+cases.map(s=>'<td>'+(s.id==='baseline'?'Referenční stav':s.id==='keep'&&v.amount===0?'Bez nového úvěru':'<button class="btn '+(s.id===$('oldTreatment').value?'primary':'')+'" data-variant="'+s.id+'">Použít variantu</button>')+'</td>').join('')+'</tr>')+'</tbody></table></div>';
}
function variantNotes(m,print=false){return '<p class="proposal-note note">'+(print?'Porovnání samostatných nabídek. Parametry vybraného financování najdete na předchozí straně; mohou se lišit od těchto srovnávacích nabídek.':'Srovnání používá výše zadané nabídky. Hlavní návrh může mít jiné ručně upravené parametry; přenos provedete tlačítkem Použít variantu.')+'</p><p class="proposal-note note">¹ Zaplacené částky + zbývající dluh − počáteční jistiny. Obsahují úroky, vyplněné průběžné a jednorázové náklady. Nižší splátka při delší době nemusí znamenat nižší cenu. Výchozí stav bez nových peněz nesrovnává stejný objem financování.</p><p class="proposal-note note">Stávající sazba '+fmt(m.old.r,3)+' %, do fixace '+duration(m.old.fix)+', poté modelově '+fmt(m.old.after,3)+' %. Nová hypotéka '+fmt(m.v.r,3)+' % po '+duration(m.v.n)+', sazba v modelu neměnná. Náklady změny '+money(m.v.exit)+', vstup nové hypotéky '+money(m.v.costs)+'. Samostatný úvěr: '+esc(m.extra.name||'bez nových peněz')+(m.extra.P?' · '+fmt(m.extra.r,2)+' % · '+duration(m.extra.n):'')+'.</p><p class="proposal-note note">DTI a DSTI zahrnují ostatní ponechané závazky z dotazníku; jejich neznámý splátkový kalendář není v součtu budoucích nákladů. Nové doplňkové produkty ze sekce Finanční plán jsou zahrnuty shodně ve třech návrhových variantách. Samostatné investiční navýšení do tohoto srovnání nevstupuje. Schválení a případnou výjimku potvrzuje banka.</p>'}
function renderExisting(){
 $('oldFields').hidden=!checked('oldEnabled');for(const [mode,id]of Object.entries({payment:'oldPayment',rate:'oldRate',months:'oldMonths'}))$(id).readOnly=mode===$('oldSolve').value;
 if(!checked('oldEnabled')){$('oldSummary').innerHTML='';$('variantComparison').innerHTML='<div class="callout">Nejprve zapněte stávající hypotéku v dotazníku.</div>';$('variantDetail').innerHTML='';return}
 try{const old=existingLoan();if(old.partial){$('oldSummary').innerHTML='<div class="callout"><b>Stávající hypotéka · započtena jednou</b><br>'+money(old.P)+' · splátka '+money(old.A)+' + náklady '+money(old.fee)+'/měs.<br>'+esc(old.notice)+'</div>';$('variantComparison').innerHTML='<div class="callout">'+esc(old.notice)+'</div>';$('variantDetail').innerHTML='';return}$('oldSummary').innerHTML='<div class="callout"><b>'+esc(treatmentNames[old.treatment])+'</b><br>Stávající splátka '+money(old.A)+' + náklady '+money(old.fee)+'/měs. · zůstatek '+money(old.P)+' · zbývá '+duration(old.n)+'. '+(old.treatment==='keep'?'Tento dluh a splátka se přičítají k ostatním závazkům.':'Starý dluh se nahrazuje refinancovanou částí, nepočítá se podruhé.')+'</div>';
 const m=scenarioComparison();$('variantComparison').innerHTML=variantTable(m);const keep=m.cases.find(x=>x.id==='keep');$('variantDetail').innerHTML='<div class="ad-grid">'+m.cases.filter(x=>['merge','separate'].includes(x.id)).map(x=>keyMetric(x.name+(keep.first>=x.first?' · nižší splátka':' · vyšší splátka'),money(Math.abs(keep.first-x.first))+'/měs.',keep.first<x.first,(keep.cost>x.cost?'Nižší':'Vyšší')+' úroky a náklady do splacení o '+money(Math.abs(keep.cost-x.cost))+' při stejných nových penězích.')).join('')+'</div>'+variantNotes(m);
 }catch(e){$('variantComparison').innerHTML='<div class="callout error">'+esc(e.message)+'</div>';$('variantDetail').innerHTML='';try{existingLoan()}catch(e2){$('oldSummary').innerHTML='<div class="callout error">'+esc(e2.message)+'</div>'}}
}
function useExistingVariant(id){try{
 if(!['keep','merge','separate'].includes(id))return;const q=mortgageProfile(),v=variantInputs(q),bs=buildingLoan(),c=consumerLoan();if(id==='separate')standaloneLoan(v.amount,q);if(id==='keep'&&v.amount<=0)throw Error('Bez nových peněz je zachování referenční stav ve srovnání.');
 if(!q.value)throw Error('Doplňte hodnotu zástavy v dotazníku.');
 const P=id==='keep'?v.amount:id==='merge'?v.old.P+v.amount:v.old.P;
 $('oldTreatment').value=id;$('bankSelect').value=v.b.id;$('rate').value=String(v.r);$('principal').value=String(P);$('months').value=String(v.n);$('age').value=String(q.ageForLoan);$('ageLimit').value=String(v.b.age??70);$('maxTerm').value=String(v.b.term??30);$('ageException').checked=false;$('monthlyFee').value=String(v.fee);$('upfrontFee').value=String(v.costs+(id==='keep'?0:v.exit));$('fixation').value=String(v.b.fix??3);$('property').value=String(q.value);
 $('extraPct').value=v.b.pct??'';$('extraBasis').value=v.b.basis||'total';$('extraCap').value=v.b.cap??'';
 $('qPrice').value=String(v.amount+q.own+bs.cash+bs.P+c.P);$('qWorks').value='0';if(id!=='keep'){$('qPurpose').value=v.amount>0?'refiup':'refi';$('qInvestmentProperty').checked=q.investmentProperty;}$('compareAge').value=String(q.ageForLoan);$('compareMode').value='principal';$('compareValue').value=String(P);$('clientName').value=$('qName').value;
 setMode('payment');showPage('calculator');refreshAdvice();toast('Přeneseno: '+treatmentNames[id]+'. Stávající závazek je započten právě jednou.');
 }catch(e){toast(e.message)}}
function initializeExisting(){
 $('variantComparison').addEventListener('click',e=>{const b=e.target.closest('[data-variant]');if(b)useExistingVariant(b.dataset.variant)});
 $('oldEnabled').addEventListener('change',()=>{if(!checked('oldEnabled'))$('oldTreatment').value='keep';refreshAdvice()});
}
