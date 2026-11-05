// Advisory models are deliberately separate from bank-specific underwriting.
let adviceReady=false, adviceDefaults={};
const adviceElements=()=>[...document.querySelectorAll('[data-advice]')];
const checked=id=>$(id).checked;
const textValue=id=>$(id).value.trim();
function optionalNumber(id,label,min=0,max=1e12){const x=val(id);return x===null?null:need(x,label,min,max)}
function numberInput(id,label,min=0,max=1e12){return need(val(id),label,min,max)}
function integerInput(id,label,min=1,max=600){const x=numberInput(id,label,min,max);if(!Number.isInteger(x))throw Error(label+': zadejte celé číslo.');return x}
function mortgageProfile(){
 const income=optionalNumber('qIncome','Čistý příjem'),co=checked('qCo'),coIncome=co?optionalNumber('qCoIncome','Příjem spolužadatele'):0;
 const eligible=optionalNumber('qEligible','Započitatelný příjem')??income,coEligible=co?(optionalNumber('qCoEligible','Započitatelný příjem spolužadatele')??coIncome):0;
 const other=numberInput('qOtherIncome','Další příjmy'),otherEligible=numberInput('qOtherEligible','Další započitatelné příjmy');
 const actual=income===null||coIncome===null?null:income+coIncome+other,recognized=eligible===null||coEligible===null?null:eligible+coEligible+otherEligible;
 const living=optionalNumber('qLiving','Životní výdaje'),housing=optionalNumber('qHousing','Výdaje na bydlení'),saving=numberInput('qSaving','Tvorba rezerv'),debt=numberInput('qDebtBalance','Stávající dluhy'),debtPayment=numberInput('qDebtPayment','Stávající splátky'),credit=numberInput('qCreditLimits','Úvěrové limity'),secured=numberInput('qSecuredExisting','Zajištěné stávající dluhy');
 if(secured>debt)throw Error('Dluh zajištěný stejnou nemovitostí je podmnožina ostatních dluhů; nesmí je převyšovat.');
 const own=numberInput('qOwn','Vlastní prostředky'),price=optionalNumber('qPrice','Cena záměru'),works=numberInput('qWorks','Další výdaje'),cost=price===null?null:price+works;
 const age=numberInput('qAge','Věk žadatele',18,100),coAge=co?numberInput('qCoAge','Věk spolužadatele',18,100):0;
 const purpose=$('qPurpose').value,owned=integerInput('qOwned','Počet vlastněných nemovitostí',0,1000),dependent=integerInput('qDependents','Počet vyživovaných osob',0,100);
 const investmentProperty=purpose==='rent'||(['own','rent'].includes(purpose)&&owned>=2)||(purpose==='refiup'&&checked('qInvestmentProperty'));
 const youngEligible=checked('qYoung')&&purpose==='own'&&Math.min(age,co?coAge:age)<36;
 const statutoryLtv=youngEligible?90:80,recommendedLtv=investmentProperty?70:null;
 const customLtv=optionalNumber('customLtv','Vlastní LTV',1,200),customDti=numberInput('customDti','Vlastní DTI',.1,100),customDsti=numberInput('customDsti','Vlastní DSTI',1,200);
 const old=existingLoan(),retained=old?.treatment==='keep',baseCost=cost;
 return {actual,recognized,living,housing,saving,baseDebt:debt,baseDebtPayment:debtPayment,baseSecured:secured,old,debt:debt+(retained?old.P:0),debtPayment:debtPayment+(retained?old.rows[0].payment:0),debtCash:debtPayment+(retained?old.rows[0].cash:0),credit,secured:secured+(retained&&old.samePledge?old.P:0),own,baseCost,cost:cost===null?null:cost+(old&&!retained?old.P:0),age,coAge,dependent,purpose,owned,investmentProperty,youngEligible,statutoryLtv,recommendedLtv,customLtv:customLtv??recommendedLtv??statutoryLtv,customDti,customDsti,
 ageForLoan:Math.max(eligible>0?age:0,coEligible>0?coAge:0)||age,
 reserve:optionalNumber('qReserve','Ponechaná rezerva'),reserveMonths:numberInput('qReserveMonths','Počet měsíců rezervy',0,60),budget:optionalNumber('qBudget','Pohodlný rozpočet'),value:optionalNumber('qValue','Odhadní hodnota',1),
 expenses:living===null||housing===null?null:living+housing,
 assumedIncome:val('qEligible')===null||(co&&val('qCoEligible')===null)};
}
function buildingLoan(){
 const cash=numberInput('bsCash','Použité stavební spoření');if(!checked('bsEnabled'))return {cash,P:0,rows:[],upfront:0,deposit:0,secured:false};
 const P=numberInput('bsAmount','Úvěr stavebního spoření',1,1e10),r=numberInput('bsRate','Sazba řádného úvěru',0,100),n=integerInput('bsMonths','Délka řádné fáze'),fee=numberInput('bsFee','Náklady stavebního úvěru'),upfront=numberInput('bsUpfront','Vstupní náklady stavebního úvěru');
 const bridge=$('bsType').value==='bridge',bn=bridge?integerInput('bsBridgeMonths','Délka překlenovací fáze',1,360):0,br=bridge?numberInput('bsBridgeRate','Sazba meziúvěru',0,100):0,deposit=bridge?numberInput('bsDeposit','Vázané úspory'):0,save=bridge?numberInput('bsSave','Dospořování'):0;
 if(bn+n>600)throw Error('Celá doba stavebního úvěru nesmí v modelu překročit 600 měsíců.');
 const credited=deposit+save*bn,remaining=P-credited;if(remaining<=0)throw Error('Vázané úspory a dospořování již pokryjí celý meziúvěr. Upravte délku fáze / výši úvěru podle nabídky.');
 const out=[];
 for(let m=1;m<=bn;m++)out.push({i:m,phase:'překlenovací',payment:P*br/1200,interest:P*br/1200,principal:m===bn?credited:0,saving:save,fee,balance:m===bn?remaining:P,cash:P*br/1200+save+fee});
 const A=pay(remaining,r,n);amortize(remaining,r,n,A).forEach(x=>out.push({...x,i:x.i+bn,phase:'řádná',saving:0,fee,cash:x.payment+fee}));
 return {cash,P,r,n,bn,br,save,deposit,credited,remaining,upfront,fee,A,bridge,rows:out,secured:checked('bsSecured'),name:textValue('bsProvider')||'Úvěr ze stavebního spoření'};
}
function consumerLoan(){
 if(!checked('consumerEnabled'))return {P:0,rows:[],upfront:0};
 const P=numberInput('consumerAmount','Spotřebitelský úvěr',1,1e10),r=numberInput('consumerRate','Sazba spotřebitelského úvěru',0,100),n=integerInput('consumerMonths','Splatnost spotřebitelského úvěru'),fee=numberInput('consumerFee','Náklady spotřebitelského úvěru'),upfront=numberInput('consumerUpfront','Vstupní náklady spotřebitelského úvěru');
 const A=pay(P,r,n);return {P,r,n,fee,upfront,A,name:textValue('consumerProvider')||'Spotřebitelský úvěr',rows:amortize(P,r,n).map(x=>({...x,fee,cash:x.payment+fee}))};
}
function portfolioValue(initial,monthly,months,gross,fee,entry,tax,shock=0){
 const annual=(1+gross/100)*(1-fee/100),growth=Math.pow(annual,1/12);let value=initial*(1-entry/100),out=[],basis=initial;
 for(let m=1;m<=months;m++){const contribution=Array.isArray(monthly)?(monthly[m-1]||0):monthly;value=value*growth+contribution*(1-entry/100);basis+=contribution;out.push(value)}
 value*=1-shock/100;const charge=Math.max(0,value-basis)*tax/100;
 return {gross:value,net:value-charge,tax:charge,basis,netReturn:(annual-1)*100,series:out};
}
function investmentModel(main=result){
 if(!checked('investEnabled'))return null;if(!main)throw Error('Investiční model vyžaduje platnou hypotéku.');
 const X=numberInput('investAmount','Investiční navýšení',1,1e10),years=numberInput('investYears','Investiční horizont',1/12,50),n=Math.round(years*12);
 if(Math.abs(n-years*12)>1e-7)throw Error('Investiční horizont musí odpovídat celým měsícům.');if(n>main.n)throw Error('Investiční horizont přesahuje splatnost hypotéky. Zkraťte jej nejvýše na '+fmt(main.n/12,2)+' let.');
 const gross=numberInput('investReturn','Výnos investice',-50,50),fee=numberInput('investFee','Roční nákladovost',0,20),entry=numberInput('investEntry','Vstupní poplatek',0,50),tax=numberInput('investTax','Daň ze zisku',0,100),exit=numberInput('investExit','Náklady předčasného splacení');
 const A=main.A*X/main.P,debtRows=amortize(X,main.r,main.n,A),debt=debtRows[n-1]?.balance||0,paid=debtRows.slice(0,n).reduce((s,x)=>s+x.payment,0),interest=debtRows.slice(0,n).reduce((s,x)=>s+x.interest,0);
 const cases=[['Zadaný scénář',gross,0],['Nulový hrubý výnos',0,0],['Pokles −3 % ročně',-3,0],['Zadaný výnos, pak propad −30 %',gross,30]].map(([name,g,s])=>{
  const p=portfolioValue(X,0,n,g,fee,entry,tax,s),alt=portfolioValue(0,debtRows.slice(0,n).map(x=>x.payment),n,g,fee,entry,tax,s);return {name,g,shock:s,p,alt,equity:p.net-debt-exit,difference:p.net-debt-exit-alt.net};
 });
 const b=bank(),limit=extraLimit(main.P,'base',b.pct,b.basis,b.cap),warnings=[];
 if(!checked('investPermitted'))warnings.push('Použití navýšení na investici nebylo smluvně ověřeno. Jde o hypotetický scénář.');
 if(b.kind==='housing')warnings.push(b.name+': výchozí doplňková část je určena na bydlení. Nelze ji automaticky použít k investování; je potřebná jiná, skutečně neúčelová nabídka.');
 else if(b.kind!=='free')warnings.push('Volné použití navýšení k investování není ve výchozích podkladech banky potvrzeno.');
 if(Number.isFinite(limit)&&X>limit+.01)warnings.push('Navýšení převyšuje výchozí limit doplňkové části o '+money(X-limit)+'. Je nutné ověřit jiný produkt / podmínky.');
 if(!Number.isFinite(limit))warnings.push('Výše bankovního limitu navýšení není doložena; ověřte konkrétní nabídku.');
 if(checked('investPermitted')&&!textValue('investOffer'))warnings.push('Doplňte konkrétní smlouvu / nabídku, o kterou se potvrzení účelu opírá.');
 const mainDebt=amortize(main.P,main.r,main.n,main.A)[n-1]?.balance||0;
 return {X,A,n,years,gross,fee,entry,tax,exit,debt,paid,interest,cases,warnings,limit,fullDebt:mainDebt+debt,rows:debtRows};
}
function combinedPlan(main=result){
 const q=mortgageProfile(),bs=buildingLoan(),consumer=consumerLoan(),additional=standaloneLoan(null,q),inv=investmentModel(main);
 if(!main)return {q,bs,consumer,inv,additional,missing:true};
 if(q.old&&q.old.treatment!=='keep'&&main.P<q.old.P-.01)throw Error('Refinancovaná jistina nepokrývá doplacení starého úvěru. Přeneste znovu variantu refinancování.');
 if(q.old?.treatment==='separate'&&Math.abs(main.P-q.old.P)>.01)throw Error('Samostatné refinancování musí odpovídat zůstatku starého úvěru. Použijte znovu variantu ze srovnání.');
 const X=inv?.X||0,P=main.P+X,mortgageRows=amortize(P,main.r,main.n,main.A*P/main.P),n=Math.max(main.n,bs.rows.length,consumer.rows.length,additional.rows.length,q.old?.treatment==='keep'?q.old.n:0),combined=[];
 for(let i=0;i<n;i++){
  const h=mortgageRows[i],s=bs.rows[i],c=consumer.rows[i],a=additional.rows[i],retained=retainedAt(q,i);
  combined.push({i:i+1,mortgage:h?.payment||0,building:s?.payment||0,consumer:c?.payment||0,additional:a?.payment||0,retained:retained.old,retainedFee:retained.oldFee,retainedCash:retained.cash,retainedService:retained.payment,retainedBalance:retained.balance,saving:s?.saving||0,fee:(h?main.monthly:0)+(s?.fee||0)+(c?.fee||0)+(a?.fee||0),interest:(h?.interest||0)+(s?.interest||0)+(c?.interest||0)+(a?.interest||0),principal:(h?.principal||0)+(s?.principal||0)+(c?.principal||0)+(a?.principal||0),balance:(h?.balance||0)+(s?.balance||0)+(c?.balance||0)+(a?.balance||0)});
 }
 combined.forEach(x=>{x.debtService=x.mortgage+x.building+x.consumer+x.additional;x.cash=x.debtService+x.saving+x.fee;x.householdCash=x.cash+x.retainedCash;x.householdDebtService=x.debtService+x.retainedService});
 const first=combined[0],peak=Math.max(...combined.map(x=>x.cash)),peakDebt=Math.max(...combined.map(x=>x.debtService));
 const funding=main.P+bs.P+consumer.P+additional.P+q.own+bs.cash,gap=q.cost===null?null:q.cost-funding;
 const ltv=main.prop?100*(P+(bs.secured?bs.P:0)+(additional.secured?additional.P:0)+q.secured)/main.prop:null,dti=q.recognized>0?(P+bs.P+consumer.P+additional.P+q.debt+q.credit)/(q.recognized*12):null,dsti=q.recognized>0?100*(first.debtService+q.debtPayment)/q.recognized:null,peakDsti=q.recognized>0?100*Math.max(...combined.map(x=>x.householdDebtService))/q.recognized:null;
 const remaining=q.actual===null||q.expenses===null?null:q.actual-q.expenses-q.saving-first.householdCash;
 const remainingAtPeak=q.actual===null||q.expenses===null?null:q.actual-q.expenses-q.saving-Math.max(...combined.map(x=>x.householdCash));
 const reserveNeed=q.expenses===null?null:(q.expenses+Math.max(...combined.map(x=>x.householdCash)))*q.reserveMonths;
 const warnings=[];if(q.old?.partial)warnings.push(q.old.notice);
 if(main.prop===null)warnings.push('Hodnota zástavy není doplněná: LTV a skutečnou dostupnost úvěru nelze ověřit.');
 const capacity=capacityModel(q,bs,consumer,main.r,main.n,main.monthly,main.prop,additional);
 if(!capacity.missing&&main.P>capacity.P+.01)warnings.push('NAD MODELOVOU KAPACITOU: zadaná hypotéka překračuje prostor po závazcích a nastavených hranicích. Omezuje '+capacity.binding+'. Modelová splátka nejvýše '+money(capacity.A)+'. Tento scénář není dostupná nabídka.');
 if(gap!==null&&gap>1)warnings.push('Na financovaný záměr chybí '+money(gap)+'.');
 if(gap!==null&&gap < -1)warnings.push('Zdroje převyšují záměr o '+money(-gap)+'. Ověřte účel a čerpání přebytku.');
 if(ltv!==null&&ltv>q.statutoryLtv+1e-8)warnings.push('LTV překračuje obecnou závaznou hranici '+q.statutoryLtv+' %. Výjimka není nároková.');
 if(q.investmentProperty&&((ltv!==null&&ltv>70)||(dti!==null&&dti>7)))warnings.push('Překročeno doporučení pro investiční / třetí nemovitost (LTV 70 %, DTI 7); 5% objemová výjimka se zde neuplatní.');
 if(ltv!==null&&ltv>q.customLtv+1e-8)warnings.push('LTV je nad vlastní hranicí '+fmt(q.customLtv)+' %.');
 if(dti!==null&&dti>q.customDti+1e-8)warnings.push('DTI je nad vlastní hranicí '+fmt(q.customDti,1)+'.');
 if(peakDsti!==null&&peakDsti>q.customDsti+1e-8)warnings.push('DSTI v nejvyšší splátkové fázi je nad vlastní hranicí '+fmt(q.customDsti)+' %.');
 if(remaining!==null&&remaining<0)warnings.push('Měsíční rozpočet je v deficitu '+money(-remaining)+'.');
 if(remainingAtPeak!==null&&remainingAtPeak<0&&remaining!==null&&remaining>=0)warnings.push('Po přechodu do vyšší splátkové fáze bude měsíční deficit '+money(-remainingAtPeak)+'.');
 if(q.budget!==null&&peak>q.budget)warnings.push('Nejvyšší měsíční zatížení překračuje pohodlný rozpočet o '+money(peak-q.budget)+'.');
 if(q.reserve!==null&&reserveNeed!==null&&q.reserve<reserveNeed)warnings.push('Ponechaná likvidní rezerva je pod zvoleným cílem o '+money(reserveNeed-q.reserve)+'.');
 if(q.actual===null||q.recognized===null||q.expenses===null)warnings.push('Rozpočet není úplný: doplňte příjmy a běžné výdaje. Bonitu ani volný měsíční zůstatek nelze plně vyhodnotit.');
 if(q.recognized===0)warnings.push('Započitatelný příjem je nulový; DTI a DSTI nelze vypočítat.');
 if(Math.abs(q.ageForLoan-val('age'))>.01)warnings.push('Věk v kalkulačce se liší od rozhodného věku dotazníku. Ověřte žadatele a přeneste aktuální zadání.');
 if(q.value!==null&&Math.abs(q.value-(main.prop||0))>1)warnings.push('Hodnota zástavy v kalkulačce se liší od dotazníku; LTV používá hodnotu z kalkulačky.');
 if(consumer.P>0||(additional.P>0&&additional.type==='consumer'))warnings.push('Spotřebitelský úvěr je další zadlužení, nikoli vlastní zdroje. Kombinaci musí přijmout banka.');
 if(bs.bridge)warnings.push('Datum přechodu meziúvěru je modelové. Úroky a státní podpora spoření nejsou započtené; skutečné přidělení musí potvrdit spořitelna.');
 if(q.purpose==='refi'&&X>0)warnings.push('Navýšení mění refinancování bez navýšení. Upravte účel a prověřte režim investiční nemovitosti.');
 const fixMonth=Math.min(main.n,Math.round(main.fix*12)),balanceAtFix=mortgageRows[fixMonth-1]?.balance||0,stressDelta=numberInput('stressRate','Změna sazby při refixaci',0,20);
 const stressed=fixMonth<main.n?pay(balanceAtFix,main.r+stressDelta,main.n-fixMonth):0,otherAtFix=combined[fixMonth];
 const stressCash=fixMonth<main.n?stressed+main.monthly+(otherAtFix?.building||0)+(otherAtFix?.consumer||0)+(otherAtFix?.additional||0)+(otherAtFix?.saving||0)+((otherAtFix?.fee||0)-main.monthly):0;
 const stressRemaining=q.actual===null||q.expenses===null?null:q.actual-q.expenses-q.saving-retainedAt(q,fixMonth).cash-stressCash;
 const upfront=main.upfront+bs.upfront+consumer.upfront+additional.upfront,totalCash=combined.reduce((s,x)=>s+x.cash,0)+upfront+bs.deposit,interest=combined.reduce((s,x)=>s+x.interest,0);
 return {q,bs,consumer,additional,capacity,inv,P,X,combined,mortgageRows,first,peak,peakDebt,funding,gap,ltv,dti,dsti,peakDsti,remaining,remainingAtPeak,reserveNeed,warnings,fixMonth,balanceAtFix,stressDelta,stressed,stressCash,stressRemaining,upfront,totalCash,interest};
}
function amountOrDash(x){return x===null?'Nedoplněno':money(x)}
function keyMetric(label,value,bad=false,note=''){return '<div class="ad-metric '+(bad?'risk':'')+'"><small>'+label+'</small><b>'+value+'</b>'+(note?'<span>'+note+'</span>':'')+'</div>'}
function ratioCards(p){const q=p.q;return '<div class="ratio-grid">'+keyMetric('LTV',p.ltv===null?'—':fmt(p.ltv,1)+' %',p.ltv!==null&&p.ltv>Math.min(q.statutoryLtv,q.recommendedLtv??Infinity,q.customLtv)+1e-8,'Závazné '+q.statutoryLtv+' %'+(q.recommendedLtv?' · doporučené 70 %':'')+' · vlastní '+fmt(q.customLtv)+' %')+keyMetric('DTI',p.dti===null?'—':fmt(p.dti,2)+'×',p.dti!==null&&p.dti>Math.min(q.customDti,q.investmentProperty?7:Infinity)+1e-8,(q.investmentProperty?'Doporučené 7× · ':'Obecný limit deaktivován · ')+'vlastní '+fmt(q.customDti,1)+'×')+keyMetric('DSTI · nejvyšší fáze',p.peakDsti===null?'—':fmt(p.peakDsti,1)+' %',p.peakDsti!==null&&p.peakDsti>q.customDsti+1e-8,'Obecný limit deaktivován · vlastní '+fmt(q.customDsti)+' %')+'</div>'}
function comparisonRatios(s){try{
 const q=mortgageProfile(),bs=buildingLoan(),c=consumerLoan(),additional=standaloneLoan(null,q),prop=optionalNumber('property','Zástava',1),n=Math.max(s.n,bs.rows.length,c.rows.length,additional.rows.length,q.old?.treatment==='keep'?q.old.n:0);
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,(i<s.n?s.A:0)+(bs.rows[i]?.payment||0)+(c.rows[i]?.payment||0)+(additional.rows[i]?.payment||0)+retainedAt(q,i).payment);
 const p={q,ltv:prop?100*(s.P+(bs.secured?bs.P:0)+(additional.secured?additional.P:0)+q.secured)/prop:null,dti:q.recognized>0?(s.P+bs.P+c.P+additional.P+q.debt+q.credit)/(q.recognized*12):null,peakDsti:q.recognized>0?100*peak/q.recognized:null};
 return ratioCards(p)+'<p class="note">Ukazatele zahrnují ponechané závazky a zapnuté další úvěry. Bez automatického investičního navýšení.</p>';
 }catch(e){return '<p class="note">Ukazatele: '+esc(e.message)+'</p>'}}
function renderInvestment(inv){
 if(!inv)return '';
 return '<div class="ad-grid">'+keyMetric('Splátka navýšení navíc',money(inv.A)+'/měs.')+keyMetric('Zůstatek navýšení za '+duration(inv.n),money(inv.debt))+'</div><table class="ad-table"><thead><tr><th>Scénář za '+duration(inv.n)+'</th><th>Portfolio po dani</th><th>Po úhradě navýšení¹</th><th>Bez navýšení²</th></tr></thead><tbody>'+inv.cases.map(s=>'<tr><td>'+esc(s.name)+'</td><td>'+money(s.p.net)+'</td><td class="'+(s.equity<0?'red-text':'')+'">'+money(s.equity)+'</td><td>'+money(s.alt.net)+'</td></tr>').join('')+'</tbody></table><p class="note">¹ Portfolio minus zbývající dluh navýšení a zadané náklady splacení. ² Pravidelná investice '+money(inv.A)+'/měs. bez navýšení úvěru, se stejnou nákladovostí a daní.</p>'+inv.warnings.map(w=>'<div class="callout warn">'+esc(w)+'</div>').join('');
}
function refreshAdvice(){
 if(!adviceReady)return;
 renderExisting();
 $('coFields').hidden=!checked('qCo');$('bsFields').hidden=!checked('bsEnabled');$('bridgeFields').hidden=$('bsType').value!=='bridge';$('consumerFields').hidden=!checked('consumerEnabled');$('openInvestment').disabled=!checked('investEnabled');
 try{
  const q=mortgageProfile(),bs=buildingLoan(),c=consumerLoan(),budget=q.actual===null||q.expenses===null?null:q.actual-q.expenses-q.debtCash-q.saving;
  const needLoan=q.cost===null?null:Math.max(0,q.cost-q.own-bs.cash-bs.P-c.P-standaloneLoan(null,q).P);
  $('questionSummary').innerHTML=keyMetric('Příjmy domácnosti',amountOrDash(q.actual))+keyMetric('Započitatelný příjem · model',amountOrDash(q.recognized))+keyMetric('Zůstatek rozpočtu po ponechaných závazcích',amountOrDash(budget),budget!==null&&budget<0)+capacitySummary(q,bs,c)+keyMetric('Hypotéka potřebná na záměr',amountOrDash(needLoan))+'<div class="callout">'+(q.investmentProperty?'Investiční / třetí nemovitost: doporučení LTV 70 %, DTI 7.':'Obecná závazná hranice LTV '+q.statutoryLtv+' %.')+'</div>'+(q.assumedIncome?'<p class="note">Započitatelný příjem obsahuje nepotvrzený předpoklad. U OSVČ ani dalších příjmů nenahrazuje metodiku banky.</p>':'');
  const p=combinedPlan();$('comboCsv').disabled=p.missing;
  if(p.missing){$('fundingSummary').innerHTML='<div class="callout error">Nejprve doplňte platnou hypotéku. Kombinace se nevypočítá ze starých výsledků.</div>';$('comboTimeline').innerHTML='';$('adviceQuick').innerHTML='<p class="note">Nejprve opravte hlavní výpočet.</p>';$('investmentSummary').innerHTML='';$('investmentResult').innerHTML='';if(activePage==='client')renderClientReport();return}
  $('fundingSummary').innerHTML=keyMetric('Celé nové financování / měsíc',money(p.first.cash))+keyMetric('Ponechané závazky / měsíc',money(p.first.retainedCash))+keyMetric('Všechny splátky a náklady / měsíc',money(p.first.householdCash))+(Math.abs(Math.max(...p.combined.map(x=>x.householdCash))-p.first.householdCash)>.01?keyMetric('Nejvyšší zatížení všech závazků',money(Math.max(...p.combined.map(x=>x.householdCash)))):'')+keyMetric('Zůstává po výdajích a rezervách',amountOrDash(p.remaining),p.remaining!==null&&p.remaining<0)+ratioCards(p)+(p.gap!==null?keyMetric(p.gap>1?'Chybí do záměru':p.gap < -1?'Přebytek zdrojů':'Financování záměru',Math.abs(p.gap)>1?money(Math.abs(p.gap)):'Pokryto',Math.abs(p.gap)>1):'')+p.warnings.map(w=>'<div class="callout error">'+esc(w)+'</div>').join('');
  $('investmentSummary').innerHTML=p.inv?'<div class="callout">Navýšení '+money(p.inv.X)+' · splátka navíc '+money(p.inv.A)+'/měs. · horizont '+duration(p.inv.n)+'.</div>':'';
  $('investmentResult').innerHTML=p.inv?renderInvestment(p.inv):'';
  const phases=[];p.combined.forEach(x=>{const last=phases[phases.length-1];if(last&&Math.abs(last.householdCash-x.householdCash)<.02&&Math.abs(last.cash-x.cash)<.02){last.end=x.i;last.balance=x.balance}else phases.push({...x,start:x.i,end:x.i})});
  $('comboTimeline').innerHTML='<div class="tablewrap"><table><thead><tr><th>Měsíce</th><th>Hypotéka</th><th>Stavební úvěr</th><th>Spotřebitelský</th><th>Samostatný navíc</th><th>Dospořování</th><th>Náklady nových</th><th>Ponechané závazky</th><th>Celkem / měs.</th></tr></thead><tbody>'+phases.map(x=>'<tr><td>'+x.start+(x.end!==x.start?'–'+x.end:'')+'</td>'+['mortgage','building','consumer','additional','saving','fee','retainedCash','householdCash'].map(k=>'<td>'+money(x[k],2)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="note">Celkem zahrnuje i ponechanou hypotéku a ostatní závazky. Ostatní závazky bez známé doby se konzervativně drží po celý horizont. Již vázané úspory při přechodu meziúvěru: '+money(bs.deposit)+'. Celkem odteď včetně těchto úspor a vstupních nákladů: '+money(p.totalCash)+'.</p>';
  $('adviceQuick').innerHTML=(p.capacity&&!p.capacity.missing&&result.P>p.capacity.P+.01?'<div class="callout error"><b>NAD MODELOVOU KAPACITOU</b> · '+esc(p.capacity.binding)+'. Závazky jsou započteny. Ruční scénář není dostupná nabídka.</div>':'')+'<div class="sectionhead"><h3>Rozpočet a celá kombinace</h3><button class="btn subtle" data-goto-funding>Upravit financování →</button></div>'+ratioCards(p)+capacitySummary(q,bs,c)+'<p class="note">Nové financování: <b>'+money(p.first.cash)+'/měs.</b> + ponechané závazky '+money(p.first.retainedCash)+'/měs. = celkem <b>'+money(p.first.householdCash)+'/měs.</b> · po výdajích a rezervách '+amountOrDash(p.remaining)+(p.inv?' · hypotéka včetně navýšení '+money(p.P):'')+'</p>';
 }catch(e){for(const id of ['questionSummary','fundingSummary','investmentResult','adviceQuick'])$(id).innerHTML='<div class="callout error">'+esc(e.message)+'</div>';$('comboTimeline').innerHTML='';$('investmentSummary').innerHTML='';$('comboCsv').disabled=true;}
 if(activePage==='client')renderClientReport();
}
function applyQuestionnaire(){try{
 const q=mortgageProfile(),bs=buildingLoan(),c=consumerLoan();if(q.cost===null)throw Error('Doplňte cenu / financovaný záměr.');if(q.value===null)throw Error('Doplňte odhadní hodnotu zástavy.');
 const P=q.cost-q.own-bs.cash-bs.P-c.P-standaloneLoan(null,q).P;if(P<=0)throw Error('Záměr je pokrytý bez hypotéky. Tato kalkulačka vyžaduje kladnou hypoteční část; upravte kombinaci.');
 $('principal').value=fmt(P,2);$('age').value=String(q.ageForLoan);$('compareAge').value=String(q.ageForLoan);$('property').value=String(q.value);$('ltvLimit').value=String(Math.min(100,q.customLtv));$('clientName').value=$('qName').value;
 const h=getHorizon();$('months').value=Math.min(val('months')||h,h);setMode('payment');$('compareMode').value='principal';$('compareValue').value=String(P);showPage('calculator');refreshAdvice();toast('Přeneseno: záměr, vlastní prostředky, kombinace, věk a zástava. Splatnost respektuje limit banky.');
 }catch(e){toast(e.message)}}
function calculateFromBudget(){try{
 const q=mortgageProfile(),bs=buildingLoan(),c=consumerLoan();
 if(q.old?.treatment==='separate'){calculateSeparateCapacity();return}
 $('age').value=String(q.ageForLoan);$('compareAge').value=String(q.ageForLoan);$('property').value=q.value===null?'':String(q.value);$('clientName').value=$('qName').value;
 const cap=currentCapacity(q,bs,c);if(cap.missing)throw Error('Doplňte skutečné i započitatelné příjmy a běžné výdaje.');
 if(cap.A<=0||cap.P<=0)throw Error('Po odečtení závazků a použití nastavených hranic nezbývá kapacita pro další hypotéku.');
 if(q.old?.treatment==='merge'&&cap.P<q.old.P)throw Error('Modelová kapacita nestačí ani k refinancování stávajícího zůstatku.');
 $('months').value=getHorizon();$('payment').value=String(cap.A);setMode('principal');showPage('calculator');refreshAdvice();toast('Kapacitu omezuje: '+cap.binding+'. Ponechané závazky byly odečteny; nejde o schválení banky.');
 }catch(e){if(checked('capacityAuto')){$('principal').value='';setMode('payment')}toast(e.message)}}
function exportCombined(){try{const p=combinedPlan();if(p.missing)throw Error('Nejprve opravte hypotéku.');const cols=['i','mortgage','building','consumer','additional','saving','fee','cash','retainedCash','householdCash','interest','principal','balance'];const csv=[['Měsíc','Hypotéka Kč','Stavební úvěr Kč','Spotřebitelský úvěr Kč','Samostatný úvěr navíc Kč','Dospořování Kč','Náklady Kč','Nové financování Kč','Ponechané závazky Kč','Celkem závazky Kč','Úroky Kč','Umořená jistina Kč','Zůstatek Kč'],...p.combined.map(x=>cols.map(k=>k==='i'?x[k]:x[k].toFixed(2).replace('.',',')))].map(x=>x.join(';')).join('\r\n');download('\ufeff'+csv,'Financni-plan-kalendar.csv','text/csv;charset=utf-8')}catch(e){toast(e.message)}}
const basicCalculate=calculate;calculate=function(){basicCalculate();refreshAdvice()};
const basicState=state;state=function(){return {...basicState(),adviceVersion:2,advice:Object.fromEntries(adviceElements().map(x=>[x.id,x.type==='checkbox'?x.checked:x.value]))}};
const basicApplyState=applyState;applyState=function(s){
 const clean={...adviceDefaults};if(s.advice!==undefined){if(!s.advice||typeof s.advice!=='object'||Array.isArray(s.advice))throw Error('Neplatný dotazník.');for(const el of adviceElements()){const value=s.advice[el.id];if(value===undefined)continue;if(el.type==='checkbox'){if(typeof value!=='boolean')throw Error('Neplatná volba v dotazníku.')}else if(typeof value!=='string'||value.length>(el.id==='intakeRaw'?40000:el.id==='intakeNotice'?8000:2000))throw Error('Neplatný vstup dotazníku.');if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===value))throw Error('Neplatná možnost dotazníku.');clean[el.id]=value}}
 for(const el of adviceElements()){if(el.type==='checkbox')el.checked=clean[el.id];else el.value=clean[el.id]}
 basicApplyState(s);if(!s.advice){$('qName').value=$('clientName').value;$('qAge').value=$('age').value;$('qValue').value=$('property').value}refreshAdvice();
};
function initializeAdvice(){
 adviceDefaults=Object.fromEntries(adviceElements().map(x=>[x.id,x.type==='checkbox'?x.checked:x.value]));adviceReady=true;
 for(const el of adviceElements())el.addEventListener('input',()=>{if(el.id==='qName')$('clientName').value=el.value;refreshAdvice()});
 $('clientName').addEventListener('input',()=>{$('qName').value=$('clientName').value});
 $('applyQuestionnaire').addEventListener('click',applyQuestionnaire);$('budgetQuestionnaire').addEventListener('click',calculateFromBudget);$('mortgageBudget').addEventListener('click',()=>useCapacity($('capacityMode').value));$('comboCsv').addEventListener('click',exportCombined);
 const open=()=>{if(checked('investEnabled')){refreshAdvice();$('investmentDialog').showModal()}};
 $('investEnabled').addEventListener('change',open);$('openInvestment').addEventListener('click',open);
 for(const id of ['closeInvestment','saveInvestment'])$(id).addEventListener('click',()=>{$('investmentDialog').close();refreshAdvice()});
 $('adviceQuick').addEventListener('click',e=>{if(e.target.closest('[data-goto-funding]'))showPage('funding')});
}
