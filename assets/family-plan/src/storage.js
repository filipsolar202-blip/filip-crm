import {embedded,ready,snapshot,saveToCrm} from './crm-bridge.js';
import {validate} from './engine.js';
export class CaseRepository {
 async db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('rodinny-plan-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('cases',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Lokální úložiště není dostupné. Exportujte JSON.'));});}
 async run(mode,fn){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('cases',mode);let result;const req=fn(tx.objectStore('cases'));req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(Error('Uložení selhalo. Exportujte JSON.'));};tx.onabort=tx.onerror;});}
 all(){if(embedded)return ready.then(()=>[snapshot()]);return this.run('readonly',s=>s.getAll());}
 put(c){if(embedded)return saveToCrm(c);return this.run('readwrite',s=>s.put(c));}
 remove(id){if(embedded)throw Error('Klientský plán spravujte v CRM.');return this.run('readwrite',s=>s.delete(id));}
}
export function parseCase(text){if(text.length>5_000_000)throw Error('Soubor je příliš velký (maximum 5 MB).');const c=JSON.parse(text);const errors=validate(c);if(errors.length)throw Error(errors.join('\n'));if(typeof c.name!=='string'||!c.manual||typeof c.manual!=='object'||Object.values(c.manual).some(x=>typeof x!=='string'))throw Error('Neplatná metadata případu.');return c;}
