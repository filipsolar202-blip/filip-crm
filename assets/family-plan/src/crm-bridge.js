import {readExchangeFile} from './wealth-exchange.js';
export const embedded=parent!==window;
let token='',data=null,ui=null,serial=0;const requests=new Map();let readyResolve;
export const ready=new Promise(r=>readyResolve=r);
const send=(type,extra={})=>parent.postMessage({channel:'filip-family',token,type,...extra},location.origin);
export function snapshot(){return data?structuredClone(data):null;}
export function initialUi(){return ui;}
export function saveToCrm(value){data=structuredClone(value);const requestId=++serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{requests.delete(requestId);reject(Error('CRM nepotvrdilo uložení. Zkuste uložit znovu nebo exportujte JSON.'));},15000);requests.set(requestId,{resolve,reject,timer});send('save',{data,requestId});});}
export function saveUi(value){if(!token)return;send('ui',{ui:value});}
export function transfer(value){send('apply',{document:value});}
if(embedded){document.documentElement.classList.add('crm-embedded');window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.channel!=='filip-family')return;const m=e.data;if(m.type==='init'&&!token){token=m.token;ui=m.ui;data=m.data||readExchangeFile(JSON.stringify(m.document)).candidate;readyResolve(data);}else if(m.token===token&&m.type==='ack'){const q=requests.get(m.requestId);if(q){clearTimeout(q.timer);requests.delete(m.requestId);m.ok?q.resolve():q.reject(Error(m.error||'Uložení se nepovedlo.'));}}else if(m.token===token&&m.type==='replace'){data=m.data;window.CrmFamilyFrame?.replace(data);}});send('ready');}else readyResolve(null);
