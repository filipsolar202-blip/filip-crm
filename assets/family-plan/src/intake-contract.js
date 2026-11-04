import {exchangeErrors,contactErrors,draftShapeErrors,parseExchangeJSON} from './exchange-contract.js';
import {blankCrisis,extensionErrors} from './plan-data.js';
export const intakeType='family-plan-questionnaire';
export const choices=[['yes','Ano'],['no','Ne'],['unknown','Nevím, potřebuji pomoct']];
export const roles={child:'Moje dítě',spouse:'Manžel / manželka',partner:'Partner / partnerka (bez svatby)',ex:'Bývalý partner / manželství',parent:'Můj rodič',sibling:'Můj sourozenec',other:'Jiný člen rodiny nebo domácnosti'};
export const criticalQuestions={children:'Máte děti? Počítejte i děti z dřívějších vztahů a děti, které už zemřely.',otherFamily:'Patří do příběhu další lidé? Například rodiče, sourozenci, vnoučata nebo děti partnera.',will:'Máte závěť, dědickou smlouvu nebo jiný dokument o dědictví?',maritalProperty:'Máte smlouvu, která mění společné vlastnictví manželů?',gifts:'Darovali jste někomu větší majetek nebo převedli majetek mezi partnery?',exceptions:'Je v rodině osvojení, vydědění, odmítnutí nebo zřeknutí se dědictví?',international:'Má někdo důležitý vztah k zahraničí? Třeba tam bydlí nebo vlastní majetek.',assets:'Máte nějaký majetek? Třeba bydlení, peníze, auto nebo firmu.',debts:'Máte dluh, hypotéku nebo za někoho ručíte?'};
export const budgetLabels={expenses:'Kolik domácnost každý měsíc utratí?',income:'Kolik by měsíčně přicházelo bez vašeho příjmu?',months:'Na kolik měsíců chcete rodinu zajistit?',oneOff:'Kolik si připravit na jednorázové výdaje?',reserve:'Kolik peněz by rodina mohla hned použít?',insurance:'Kolik by podle pojistky rodina mohla dostat?'};
export function newIntake(){return {type:intakeType,version:1,status:'draft',date:new Date().toISOString().slice(0,10),self:{name:'',birth:'',birthUnknown:false,status:'',marriageDate:'',marriageUnknown:false},people:[],answers:{},assets:[],budget:Object.fromEntries(Object.keys(budgetLabels).map(k=>[k,{value:'',unknown:false}])),manual:{contact:'',children:'',documents:'',payments:'',insurance:'',access:'',firstDays:'',notary:'',notes:''},confirm:{family:false,property:false,truth:false,delivery:false},notes:''};}
const dateOK=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const textOK=(x,max=4000)=>typeof x==='string'&&x.length<=max;
const amountOK=x=>typeof x==='string'&&x.trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=1e12;
export function intakeErrors(d,step=null){
 const out=[],at=(n,msg)=>{if(step===null||step===n)out.push(msg);};
 if(!d||d.type!==intakeType||d.version!==1||!d.self||!Array.isArray(d.people)||!d.answers||!Array.isArray(d.assets)||!d.budget||!d.manual||!d.confirm)return ['Neplatný soubor dotazníku.'];
 if([d.self,d.answers,d.budget,d.manual,d.confirm].some(v=>typeof v!=='object'||Array.isArray(v)))return ['Neplatná struktura dotazníku.'];
 for(const message of [...exchangeErrors(d.exchange),...contactErrors(d.self)])at(0,message);
 for(const message of extensionErrors({crisis:d.crisis}))at(5,message);
 if(d.people.length>100||d.assets.length>500)return ['Dotazník je příliš velký.'];
 if(!textOK(d.self.name,120)||!d.self.name.trim())at(0,'Napište, jak vám máme říkat.');
 if(!d.self.birthUnknown&&(!dateOK(d.self.birth)||d.self.birth>d.date))at(0,'Doplňte narození, nebo zvolte Nevím.');
 if(!['single','married','partner','divorced','widowed','registered','unknown'].includes(d.self.status))at(0,'Vyberte svou rodinnou situaci.');
 if(d.self.status==='married'&&!d.self.marriageUnknown&&(!dateOK(d.self.marriageDate)||d.self.marriageDate>d.date))at(0,'Doplňte datum svatby, nebo zvolte Nevím.');
 if(d.people.some(p=>!p||typeof p!=='object')||d.assets.some(a=>!a||!['asset','debt'].includes(a.kind)))return ['Poškozený seznam osob nebo majetku.'];
 if([d.self.birthUnknown,d.self.marriageUnknown,...d.people.map(p=>p.birthUnknown),...d.assets.map(a=>a.valueUnknown),...Object.values(d.budget).map(b=>b?.unknown)].some(v=>typeof v!=='boolean'))return ['Neplatné označení neznámých údajů.'];
 if(d.people.some(p=>!textOK(p.note||''))||d.assets.some(a=>!textOK(a.note||'')||!textOK(a.category||'',120)))return ['Příliš dlouhý popis.'];
 const ids=d.people.map(p=>p.id);if(new Set(ids).size!==ids.length)at(1,'Osoby mají duplicitní identifikátory.');
 for(const p of d.people){if(!p||!textOK(p.id,100)||!textOK(p.name,120)||!p.name.trim()||!Object.hasOwn(roles,p.role)){at(1,'U každé osoby vyplňte jméno a vztah.');continue;}
 if(!['alive','dead','unknown'].includes(p.life))at(1,`U osoby ${p.name} vyberte, zda žije.`);
 if(!p.birthUnknown&&(!dateOK(p.birth)||p.birth>d.date))at(1,`Doplňte narození osoby ${p.name}, nebo zvolte Nevím.`);
 if(p.role==='child'&&!['only','unknown',...ids.filter(x=>x!==p.id)].includes(p.otherParent))at(1,`U dítěte ${p.name} označte druhého rodiče, nebo zvolte Nevím.`);
 if(p.role==='other'&&(!textOK(p.note)||!p.note.trim()))at(1,`U osoby ${p.name} popište vztah k rodině.`);
 if(p.role==='partner'&&(!['yes','no','unknown'].includes(p.year)||!['yes','no','unknown'].includes(p.care)))at(1,`U partnera ${p.name} doplňte společné bydlení.`);}
 if(d.people.filter(p=>p.role==='spouse').length>1)at(1,'Uveďte jen jednoho současného manžela nebo manželku.');
 if(d.people.filter(p=>p.role==='parent').length>2)at(1,'Více než dva rodiče popište jako jiného člena rodiny.');
 if(d.self.status==='married'&&!d.people.some(p=>p.role==='spouse'))at(1,'Přidejte svého manžela nebo manželku.');
 if(d.self.status==='partner'&&!d.people.some(p=>p.role==='partner'))at(1,'Přidejte svého partnera nebo partnerku.');
 for(const k of ['children','otherFamily'])if(!['yes','no','unknown'].includes(d.answers[k]))at(1,'Odpovězte na obě otázky o rodině.');
 if(d.answers.children==='yes'&&!d.people.some(p=>p.role==='child'))at(1,'Přidejte alespoň jedno dítě.');
 if(d.answers.children==='no'&&d.people.some(p=>p.role==='child'))at(1,'Máte uvedené dítě, ale odpověď je Ne. Opravte odpověď.');
 if(d.answers.otherFamily==='yes'&&!d.people.some(p=>['parent','sibling','other','ex'].includes(p.role)))at(1,'Přidejte dalšího člena rodiny a jeho vztah.');
 for(const [n,kind,key] of [[2,'asset','assets'],[3,'debt','debts']]){if(!['yes','no','unknown'].includes(d.answers[key]))at(n,'Vyberte Ano, Ne nebo Nevím.');const items=d.assets.filter(a=>a.kind===kind);if(d.answers[key]==='yes'&&!items.length)at(n,'Přidejte alespoň jednu položku.');if(d.answers[key]==='no'&&items.length)at(n,'Máte vyplněné položky. Opravte odpověď Ne.');
 for(const a of items){if(!textOK(a.category,120)||!a.category.trim())at(n,'U každé položky vyberte, co to je.');if(!textOK(a.name,120)||!a.name.trim())at(n,'Pojmenujte každou položku.');if(!a.valueUnknown&&!amountOK(a.value))at(n,`U položky ${a.name} doplňte částku nebo Nevím.`);if(!['CZK','EUR','USD'].includes(a.currency))at(n,'Vyberte měnu.');if(!['me','person','joint','shares','unknown'].includes(a.owner))at(n,`U položky ${a.name} vyberte vlastníka nebo Nevím.`);if(['person','shares'].includes(a.owner)&&!ids.includes(a.person))at(n,`U položky ${a.name} vyberte druhou osobu.`);if(a.owner==='joint'&&!d.people.some(p=>p.role==='spouse'))at(n,'Společné jmění vyžaduje uvedeného manžela nebo manželku.');if(a.owner==='shares'&&(!amountOK(a.share)||Number(a.share)<=0||Number(a.share)>=100))at(n,'Váš podíl musí být větší než 0 a menší než 100 %.');if(!['purchase','before','gift','inheritance','unknown'].includes(a.acquisition))at(n,'U každé položky vyberte původ majetku nebo okolnost vzniku dluhu.');}}
 for(const k of ['will','maritalProperty','gifts','exceptions','international'])if(!['yes','no','unknown'].includes(d.answers[k]))at(4,'Odpovězte na každou důležitou otázku.');
 if(Object.values(d.manual).some(v=>!textOK(v))||!textOK(d.notes))at(5,'Poznámky mohou mít nejvýše 4 000 znaků.');
 for(const k of Object.keys(budgetLabels)){const b=d.budget[k];if(!b||!b.unknown&&!amountOK(b.value))at(5,`Doplňte: ${budgetLabels[k]} Nebo zvolte Nevím.`);if(k==='months'&&b&&!b.unknown&&(!Number.isInteger(Number(b.value))||Number(b.value)<1||Number(b.value)>600))at(5,'Doba zajištění musí být 1 až 600 celých měsíců.');}
 for(const k of ['family','property','truth','delivery'])if(d.confirm[k]!==true)at(6,'Na konci potvrďte všechny čtyři body.');if(!dateOK(d.date))at(0,'Neplatné datum dotazníku.');return [...new Set(out)];
}
export function draftErrors(d){return [...draftShapeErrors(d),...extensionErrors({crisis:d?.crisis})];}
export function parseIntake(text,{draft=false}={}){
 if(text.length>5_000_000)throw Error('Maximum 5 MB.');const d=parseExchangeJSON(text);
 if(d?.type!==intakeType||d.version!==1)throw Error('Nejde o podporovaný dotazník.');
 if(!draft&&d.status!=='submitted')throw Error('Toto je rozpracovaný dotazník. Klient musí stáhnout hotové odpovědi v posledním kroku.');
 const errors=draft?draftErrors(d):[...draftErrors(d),...intakeErrors(d)];if(errors.length)throw Error(errors.join('\n'));return d;
}
