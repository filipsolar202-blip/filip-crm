import {exchangeErrors,contactErrors} from './exchange-contract.js';
// Optional extension of v1 records. Older case files remain readable.
export const advisorDefaults={name:'Filip Solár',brand:'Fair Life',phone:'+420 602 190 240',email:'f.solar@fair-life.cz',web:'www.filipsolar.cz',address:''};
export const crisisTables={
 contacts:{title:'Důležité kontakty',single:'kontakt',fields:{name:'Jméno / instituce',role:'S čím pomůže',phone:'Telefon',email:'E-mail',notes:'Kdy se obrátit / poznámka'}},
 policies:{title:'Pojistné smlouvy',single:'pojistnou smlouvu',fields:{person:'Pojištěná osoba / majetek',type:'Druh pojištění',provider:'Pojišťovna',number:'Číslo smlouvy',coverage:'Rizika a sjednané částky',beneficiary:'Obmyšlená osoba',phone:'Asistence / hlášení',location:'Kde je smlouva',notes:'Výluky, čekací doba, poznámka'}},
 services:{title:'Provoz domácnosti',single:'provozní smlouvu',fields:{service:'Služba (energie, telefon…)',provider:'Dodavatel',holder:'Na koho je smlouva',number:'Číslo smlouvy / zákazníka',payment:'Částka a splatnost',phone:'Kontakt na dodavatele',location:'Kde je smlouva',notes:'Jak převést / další pokyny'}},
 access:{title:'Peníze a dokumenty dostupné hned',single:'místo / zdroj',fields:{name:'Účet, rezerva nebo dokument',holder:'Majitel',provider:'Banka / instituce / úložiště',authorized:'Oprávněná osoba',amount:'Dostupná částka (Kč, pokud znáte)',location:'Kde je návod / dokument',notes:'Podmínky přístupu (bez hesel)'}},
 benefits:{title:'Státní a soukromé zabezpečení',single:'nárok / odhad',fields:{person:'Koho se týká',event:'Situace',source:'Zdroj plnění',amount:'Částka (Kč, pokud znáte)',period:'Za den / měsíc / jednorázově',status:'Odhad / potvrzeno / k ověření',basis:'Podklad a datum výpočtu',notes:'Podmínky a postup žádosti'}},
 tasks:{title:'Dohodnuté další kroky',single:'úkol',fields:{task:'Co je potřeba udělat',owner:'Kdo to zařídí',due:'Do kdy',status:'Stav',notes:'Poznámka'}}
};
export function blankCrisis(){return Object.fromEntries(Object.keys(crisisTables).map(k=>[k,[]]));}
export function crisisOf(c){return {...blankCrisis(),...(c.crisis||{})};}
export function advisorOf(c){return {...advisorDefaults,...(c.advisor||{})};}
export function planPeople(c){
 const living=c.people.filter(p=>!p.dead&&!p.death&&p.id!=='STATE');
 const primary=living.find(p=>p.id===c.plan?.primary)||living[0];
 if(!primary)return [];
 const relation=c.relations.find(r=>[r.a,r.b].includes(primary.id)&&r.start<=c.date&&(!r.end||r.end>c.date)&&living.some(p=>p.id===(r.a===primary.id?r.b:r.a)));
 const partner=c.plan?.partner===''?null:living.find(p=>p.id===(c.plan?.partner|| (relation?.a===primary.id?relation?.b:relation?.a)));
 return [primary,...partner&&partner.id!==primary.id?[partner]:[]];
}
export function extensionErrors(c){
 const out=[...exchangeErrors(c.exchange),...contactErrors(c.contact)];
 if(c.crisis!==undefined){
  if(!c.crisis||typeof c.crisis!=='object'||Array.isArray(c.crisis))return ['Neplatná data krizového plánu.'];
  for(const [key,schema] of Object.entries(crisisTables)){
   const rows=c.crisis[key];if(rows===undefined)continue;
   if(!Array.isArray(rows)||rows.length>200){out.push('Neplatný seznam: '+schema.title);continue;}
   if(rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)||Object.entries(row).some(([k,v])=>k!=='id'&&!Object.hasOwn(schema.fields,k)||typeof v!=='string'||v.length>2000)))out.push('Neplatný záznam: '+schema.title);
  }
 }
 if(c.advisor!==undefined&&(!c.advisor||typeof c.advisor!=='object'||Array.isArray(c.advisor)||Object.values(c.advisor).some(v=>typeof v!=='string'||v.length>4000)))out.push('Neplatné kontakty poradce.');
 if(c.plan!==undefined&&(!c.plan||typeof c.plan!=='object'||Array.isArray(c.plan)||Object.values(c.plan).some(v=>typeof v!=='string'||v.length>4000)))out.push('Neplatné nastavení výstupů.');
 return out;
}
export function disclaimer(c){
 const a=advisorOf(c);
 return `Zpracoval ${a.name} · ${a.brand}. Tento plán je informační a finanční pomůckou sestavenou z údajů klienta ke dni ${c.date}. Není závětí, dědickou smlouvou ani individuálním právním stanoviskem. Výpočty zachycují uvedené modelové předpoklady; skutečné vypořádání SJM, dědictví a dluhů určí příslušné řízení a platné dokumenty. Právní provedení řešení projednejte s notářem nebo advokátem. Nároky na státní dávky a pojistné plnění posuzuje příslušná instituce podle konkrétních podmínek. Částky bez doloženého podkladu jsou odhady. Při změně rodiny, majetku či smluv plán aktualizujte.`;
}
