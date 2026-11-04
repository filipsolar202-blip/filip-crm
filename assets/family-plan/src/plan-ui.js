import {advisorOf,crisisOf,crisisTables,planPeople} from './plan-data.js';
import {htmlEscape as e} from './presentation.js';
import {fairLifeLogo} from './brand-assets.js';
export function planLaunch(c){
 const people=planPeople(c);
 return `<section class="plan-launch"><div><div class="eyebrow">Jeden případ · dva hotové plány</div><h2>${people.map(p=>e(p.name)).join(' & ')||'Začněte rodinou a majetkem'}</h2><p>Údaje zadáte jednou. Dědický plán ukáže rozdělení majetku. Krizový plán pomůže rodině jednat.</p></div><div class="plan-launch-actions"><button data-report-type="inheritance"><b>Dědický plán</b><small>Majetek → dědicové → možnosti</small><span>Otevřít →</span></button><button data-report-type="crisis"><b>Krizový plán</b><small>Kontakty → smlouvy → postupy</small><span>Otevřít →</span></button></div></section>`;
}
export function crisisEditor(c){
 const data=crisisOf(c);
 return `<section class="panel"><div class="panel-head"><div><div class="eyebrow">Rodinná příručka</div><h2>Vše podstatné pro chvíli, kdy je potřeba pomoc.</h2><p>Údaje se automaticky propíší do krizového plánu. Nevyplněná položka bude označená jako neuvedená.</p></div><button data-report-type="crisis">Otevřít krizový plán →</button></div></section><div class="crisis-grid">${Object.entries(crisisTables).map(([key,s])=>`<section class="panel"><div class="panel-head"><h2>${e(s.title)}</h2><button class="small" data-crisis-add="${key}">+ Přidat</button></div>${data[key].map((r,i)=>`<div class="result-row"><div><b>${e(r.name||r.person||r.service||r.task||r.provider||'Záznam '+(i+1))}</b><small>${e(r.role||r.type||r.source||r.holder||r.owner||'')}${r.phone?' · '+e(r.phone):''}</small></div><button class="small" data-crisis-key="${key}" data-crisis-index="${i}">Upravit</button></div>`).join('')||'<p class="empty-inline">Zatím neuvedeno. Doplnit můžete nyní nebo při další schůzce.</p>'}</section>`).join('')}</div>`;
}
const field=(k,l,v,type='text')=>`<label>${l}<input name="${k}" value="${e(v||'')}" type="${type}" maxlength="2000"></label>`;
export function crisisRecordForm(key,row={}){
 return `<p>Vyplňte, co víte. Částku nebo údaj, který neznáte, nechte prázdný.</p><div class="form-grid">${Object.entries(crisisTables[key].fields).map(([k,l])=>['notes','coverage','location','basis'].includes(k)?`<label>${e(l)}<textarea name="${k}" maxlength="2000">${e(row[k]||'')}</textarea></label>`:field(k,l,row[k])).join('')}</div>`;
}
export function reportSettings(c){
 const people=planPeople(c),a=advisorOf(c),options=(id,blank=false)=>`${blank?'<option value="">Bez druhé osoby</option>':''}${c.people.filter(p=>!p.dead&&!p.death).map(p=>`<option value="${e(p.id)}" ${id===p.id?'selected':''}>${e(p.name)}</option>`).join('')}`;
 return `<details class="panel report-settings"><summary>Osoby ve výstupu, kontakty a aktualizace</summary><form id="plan-form"><div class="form-grid"><label>Hlavní klient<select name="primary" required>${options(people[0]?.id)}</select></label><label>Druhý samostatný scénář<select name="partner">${options(people[1]?.id,true)}</select></label>${field('reviewDate','Příští společná kontrola',c.plan?.reviewDate,'date')}${field('name','Zpracoval',a.name)}${field('phone','Telefon poradce',a.phone,'tel')}${field('email','Pracovní e-mail',a.email,'email')}${field('web','Web',a.web)}${field('address','Adresa (nepovinná)',a.address)}</div><button class="primary">Uložit údaje výstupu</button></form></details>`;
}
export const brandHtml=()=>`<img class="fairlife-brand" src="${fairLifeLogo}" alt="FairLife"><small>DĚDICKÝ A KRIZOVÝ PLÁN</small>`;
