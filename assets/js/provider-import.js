/* Provider reports are proposals first. Parsing and planning never mutate CRM. */
(function () {
  'use strict';
  const s = value => String(value ?? '').trim();
  const normal = value => s(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
  const header = value => normal(value).replace(/[^a-z0-9]/g,'');
  const copy = value => JSON.parse(JSON.stringify(value));
  const same = (a,b) => s(a)===s(b);
  const timestamp = () => new Date().toISOString();
  const uuid = () => crypto.randomUUID();
  const empty = value => value==null || s(value)==='';
  const near = (a,b,tolerance=.005) => a!==null&&b!==null&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
  const canonical = value => JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((out,k)=>(out[k]=v[k],out),{}):v);
  function hash(value) {const text=typeof value==='string'?value:canonical(value);let a=2166136261,b=2246822519;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),3266489917);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
  function number(value) {
    if(empty(value))return null;if(typeof value==='number')return Number.isFinite(value)?value:null;
    let text=s(value).replace(/[\s\u00a0\u202f]/g,'').replace(/(?:Kč|CZK|EUR|USD|%)$/i,'');
    if(text.includes(',')&&text.includes('.'))text=text.lastIndexOf(',')>text.lastIndexOf('.')?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
    else text=text.replace(',','.');
    return /^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(text)&&Number.isFinite(+text)?+text:null;
  }
  function identifier(value) {
    if(empty(value))return '';
    if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?String(value):'';
    const text=s(value).replace(/[\s/\-]/g,'');
    return /^\d+$/.test(text)?text:'';
  }
  function iso(year,month,day) {const d=new Date(Date.UTC(+year,+month-1,+day));return d.getUTCFullYear()===+year&&d.getUTCMonth()===+month-1&&d.getUTCDate()===+day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';}
  function date(value,date1904=false) {
    if(empty(value))return '';
    if(value instanceof Date)return Number.isFinite(+value)?iso(value.getUTCFullYear(),value.getUTCMonth()+1,value.getUTCDate()):'';
    if(typeof value==='number'){
      if(!Number.isFinite(value)||value<1||(!date1904&&Math.floor(value)===60))return '';
      const serial=Math.floor(value),base=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,31),offset=date1904?serial:serial-(serial>60?1:0),d=new Date(base+offset*86400000);
      return d.getUTCFullYear()>=1900&&d.getUTCFullYear()<=2200?iso(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()):'';
    }
    const text=s(value);let m=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);if(m)return iso(m[1],m[2],m[3]);
    m=text.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);return m?iso(m[3],m[2],m[1]):'';
  }
  function rowObjects(raw) {
    if(!Array.isArray(raw))return [];
    if(Array.isArray(raw[0])){const keys=raw[0].map(s);return raw.slice(1).map((r,i)=>({data:Object.fromEntries(keys.map((k,j)=>[k,r[j]??''])),rowNumber:i+2})).filter(x=>Object.values(x.data).some(v=>!empty(v)));}
    return raw.filter(r=>r&&typeof r==='object').map((r,i)=>({data:r,rowNumber:Number.isInteger(r.__rowNum__)?r.__rowNum__+1:i+2}));
  }
  function read(row,...names) {const namesSet=new Set(names.map(header));const key=Object.keys(row).find(k=>namesSet.has(header(k)));return key===undefined?'':row[key];}
  function normalizedIds(row) {const birthId=identifier(read(row,'RČ','RC','Rodné číslo','birthId')),companyId=identifier(read(row,'IČO','ICO','companyId'));return {birthId,companyId,strongIds:[...(birthId?['rc:'+birthId]:[]),...(companyId?['ico:'+companyId]:[])]};}
  const txName = value => ({platba:'Platba',odkup:'Odkup',konverze:'Konverze',prevod:'Převod'})[normal(value)]||s(value);
  const txDirection = row => Math.sign(row.units||row.amount||row.current||0);
  function sourceKey(row) {return row.strongIds.length&&row.isin&&row.orderId?JSON.stringify(['avant',row.strongIds.slice().sort(),row.isin,row.orderId,normal(row.transactionType),row.direction]):'';}
  function parsedBase(provider,options) {return {schemaVersion:1,provider,area:options.area||'fki',fileName:s(options.fileName),reportDate:date(options.reportDate),rows:[],errors:[],warnings:[]};}
  function providerImportParseAvant(rawrows,options={}) {
    const result=parsedBase('avant',options),objects=rowObjects(rawrows),first=objects[0]?.data||{};
    const required=['Investor','ISIN','Pokyn','Fond','Typ transakce','Čistá investice','Počet vydaných CP/Počet odkupovaných CP','Aktuální hodnota investice'];
    const missing=required.filter(name=>!Object.keys(first).some(key=>header(key)===header(name)));
    if(missing.length){result.errors.push('Chybí sloupce Avant: '+missing.join(', '));return result;}
    for(const {data:r,rowNumber} of objects){
      const ids=normalizedIds(r),row={rowNumber,...ids,investor:s(read(r,'Investor')),isin:s(read(r,'ISIN')).toUpperCase().replace(/\s/g,''),fund:s(read(r,'Fond')),securityType:s(read(r,'Typ CP')),orderId:identifier(read(r,'Pokyn')),contractRef:identifier(read(r,'Spis')),transactionType:txName(read(r,'Typ transakce')),currency:s(read(r,'Měna')).toUpperCase(),amount:number(read(r,'Čistá investice')),units:number(read(r,'Počet vydaných CP/Počet odkupovaných CP')),issueNav:number(read(r,'Emisní kurs Platba/Odkup')),nav:number(read(r,'Poslední schválená hodnota CP')),current:number(read(r,'Aktuální hodnota investice')),entryFee:number(read(r,'Vstupní poplatek')),paymentDate:date(read(r,'Datum připsání platby/datum podání žádosti o odkup'),options.date1904),emissionDate:date(read(r,'Datum emise/zpětného odkupu'),options.date1904),valuationDate:date(read(r,'Poslední schválená hodnota do'),options.date1904),errors:[],warnings:[]};
      row.direction=txDirection(row);row.key=sourceKey(row);
      if(!row.strongIds.length)row.errors.push('Chybí jednoznačné RČ nebo IČO.');
      if(row.birthId&&row.companyId)row.errors.push('Řádek obsahuje současně RČ a IČO; ověř vlastníka.');
      if(!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(row.isin))row.errors.push('Chybí platný formát ISIN.');
      if(!row.orderId)row.errors.push('Chybí identifikátor pokynu.');
      if(!row.paymentDate||!row.emissionDate||!row.valuationDate)row.errors.push('Chybí nebo není platné datum platby, emise či ocenění.');
      if(row.amount===null||row.units===null||row.current===null||row.issueNav===null||row.nav===null)row.errors.push('Některá číselná hodnota chybí nebo není platná; prázdná hodnota není nula.');
      if(row.currency!=='CZK')row.errors.push('Měna není CZK; import bez převodu měny vyžaduje ruční kontrolu.');
      if(['Platba','Odkup'].includes(row.transactionType)){
        const expected=row.transactionType==='Odkup'?-1:1;
        if([row.amount,row.units,row.current].some(v=>v!==null&&v!==0&&Math.sign(v)!==expected))row.errors.push('Znaménko částky nebo CP neodpovídá typu transakce.');
      }else row.warnings.push('Převod, konverze nebo jiná transakce vyžaduje ruční zpracování.');
      result.rows.push(row);
    }
    const byKey=new Map();result.rows.forEach(r=>{if(!r.key)return;if(!byKey.has(r.key))byKey.set(r.key,[]);byKey.get(r.key).push(r);});
    byKey.forEach(rows=>{if(rows.length>1)rows.forEach(row=>row.errors.push('Stejná identita transakce je ve výpisu vícekrát.'));});
    const dates=result.rows.map(r=>r.valuationDate).filter(Boolean).sort();result.reportDate=result.reportDate||dates.at(-1)||'';
    return result;
  }
  function codyaArea(name) {return /vigo public|retail opf|otevreny podilovy|\bopf\b/.test(normal(name))?'investice':'fki';}
  function providerImportParseCodya(rawrows,options={}) {
    const result=parsedBase('codya',options),objects=rowObjects(rawrows),meta=new Set(['rodnecislo','jmeno','prijmeni','datumsmlouvy','majetekvczk','poslednitransakce','datumposlednitransakce','ico']);
    if(!result.reportDate)result.errors.push('Vyber skutečné datum ocenění výpisu Codya.');
    if(!objects.length||!Object.keys(objects[0].data).some(k=>header(k)==='rodnecislo')){result.errors.push('Chybí sloupec RODNÉ ČÍSLO.');return result;}
    for(const {data:r,rowNumber} of objects){
      const ids=normalizedIds(r),investor=[read(r,'JMÉNO'),read(r,'PŘÍJMENÍ','PŘIJMENÍ')].map(s).filter(Boolean).join(' ');
      Object.entries(r).forEach(([fund,value])=>{
        if(meta.has(header(fund))||fund.startsWith('__')||codyaArea(fund)!==result.area)return;
        const row={rowNumber,...ids,investor,isin:'',fund:s(fund),current:number(value),blank:empty(value),currency:'CZK',valuationDate:result.reportDate,errors:[],warnings:[],key:JSON.stringify(['codya',ids.strongIds.slice().sort(),normal(fund),result.area])};
        if(!ids.strongIds.length)row.errors.push('Chybí jednoznačné RČ nebo IČO.');
        if(ids.birthId&&ids.companyId)row.errors.push('Současné RČ a IČO vyžaduje ověření vlastníka.');
        if(!row.blank&&row.current===null)row.errors.push('Aktuální hodnota není platné číslo.');
        if(row.current!==null&&row.current<0)row.errors.push('Záporný souhrnný majetek vyžaduje ruční kontrolu.');
        if(!row.valuationDate)row.errors.push('Chybí datum ocenění.');result.rows.push(row);
      });
    }
    return result;
  }

  function clientIds(client) {const generic=identifier(client.birthId||client['RČ']||client.rc||''),ico=identifier(client.companyId||client.ico||client['IČO']||'');return {generic,ico};}
  function clientMatches(client,row) {const ids=clientIds(client);return row.birthId?ids.generic===row.birthId:!!row.companyId&&(ids.ico===row.companyId||ids.generic===row.companyId);}
  function recordOwner(record,client,row) {
    const ids=normalizedIds(record),rc=ids.birthId||(/^RC[_-]/i.test(s(record.ClientID))?identifier(s(record.ClientID).replace(/^RC[_-]/i,'')):'');
    if(ids.birthId&&row.birthId&&ids.birthId!==row.birthId||ids.companyId&&row.companyId&&ids.companyId!==row.companyId)return false;
    if(record._providerClientId!=null)return same(record._providerClientId,client.id);
    if(row.birthId&&rc)return rc===row.birthId;
    if(row.companyId&&ids.companyId)return ids.companyId===row.companyId;
    return !!(record.ClientID!=null&&!/^RC[_-]/i.test(s(record.ClientID))&&same(record.ClientID,client.id));
  }
  function strictRecordClients(source,record) {
    const ids=normalizedIds(record),prefixed=/^RC[_-]/i.test(s(record.ClientID))?identifier(s(record.ClientID).replace(/^RC[_-]/i,'')):'';
    return (source.clients||[]).filter(client=>{
      if(record._providerClientId!=null&&!same(record._providerClientId,client.id))return false;
      if(ids.birthId||ids.companyId||prefixed)return clientMatches(client,{...ids,birthId:ids.birthId||prefixed});
      return record._providerClientId!=null?same(record._providerClientId,client.id):/^\d+$/.test(s(record.ClientID))&&same(record.ClientID,client.id);
    });
  }
  const recordIsin = record => s(record.ISIN||record['rp.ISIN']||record.isin).toUpperCase();
  const recordFund = record => s(record.Fond||record.fund||record.Produkt||record.product);
  function rawRecordKey(record) {
    if(typeof invRecordKey==='function')return invRecordKey(record);
    return hash(record);
  }
  function recordBasis(record) {
    const transactionType=txName(record['Typ transakce']||record.transactionType||'Platba'),withdrawal=transactionType==='Odkup';
    let amount=number(record['Čistá investice']??record.investment??record.amount),units=number(record['Počet vydaných CP']??record.qty);
    if(withdrawal){if(amount!==null)amount=-Math.abs(amount);if(units!==null)units=-Math.abs(units);}
    return {amount,units,issueNav:number(record['Upisovací hodnota']??record.subscribeValue),paymentDate:date(record['Datum připsání platby']||record.paymentDate||record.date),emissionDate:date(record['Datum emise']||record.emissionDate),transactionType};
  }
  function exactLegacy(record,row) {
    const base=recordBasis(record),order=identifier(record.Pokyn||record.orderId||''),contract=identifier(record.Spis||record.contractRef||'');
    if(normal(base.transactionType)!==normal(row.transactionType))return false;
    if(order)return order===row.orderId&&(!contract||!row.contractRef||contract===row.contractRef)&&Math.sign(base.units||base.amount||0)===row.direction;
    return near(base.amount,row.amount)&&near(base.units,row.units,.000001)&&!!base.paymentDate&&base.paymentDate===row.paymentDate;
  }
  function targetFor(record,kind='record') {return {kind,key:kind==='record'?rawRecordKey(record):s(record.id)};}
  function findTarget(source,target) {
    if(!target)return null;
    const rows=target.kind==='snapshot'?(source.investmentSnapshots||[]):(source.investmentRecords||[]);
    const found=rows.filter(record=>target.kind==='snapshot'?same(record.id,target.key):rawRecordKey(record)===target.key);
    return found.length===1?found[0]:null;
  }
  function signature(source) {return hash({clients:source.clients||[],records:source.investmentRecords||[],snapshots:source.investmentSnapshots||[],fundValues:source.fundValues||{},opportunities:source.opportunities||[],deals:source.deals||[],contracts:source.contracts||[]});}
  const LABELS={transactionType:'Typ transakce',amount:'Čistá investice',units:'Počet CP',issueNav:'Upisovací hodnota CP',paymentDate:'Datum platby / žádosti',emissionDate:'Datum emise / odkupu',current:'Aktuální hodnota',nav:'Aktuální hodnota CP',valuationDate:'Datum ocenění'};
  const firstNumber = (...values) => values.map(number).find(v=>v!==null) ?? null;
  function valuationOf(record,kind,source) {
    let current=kind==='snapshot'?number(record.current):record.fkiValuationMode==='manual'?firstNumber(record.fkiManualCurrent,record.providerValuation?.current,record['Aktuální hodnota investice']):firstNumber(record.providerValuation?.current,record.codyaImportedCurrent,record['Aktuální hodnota investice'],record.current);
    if(kind==='record'&&source&&typeof providerStorageCurrentValue==='function')current=providerStorageCurrentValue(record,source);
    return {current,nav:firstNumber(record.providerValuation?.nav,record['Poslední schválená hodnota CP']),valuationDate:date(record.providerValuation?.date||record.codyaImportDate||record['Poslední schválená hodnota do']||record.date)};
  }
  function changesFor(record,row,kind='record',source) {
    const before={...(kind==='record'?recordBasis(record):{}),...valuationOf(record,kind,source)},fields=kind==='record'&&row.amount!==undefined?Object.keys(LABELS):['current','valuationDate'];
    return fields.filter(field=>row[field]!==undefined&&row[field]!==null&&row[field]!==''&&(typeof row[field]==='number'?!near(before[field],row[field],field==='units'||field==='issueNav'||field==='nav'?.000001:.005):before[field]!==row[field])).map(field=>({field,label:LABELS[field],before:before[field]??null,after:row[field]}));
  }
  function manual(record,kind) {return kind==='snapshot'?!!(record.manualAumOverride&&!record._providerSource)||!!record.manualPerformanceOverride:record.fkiValuationMode==='manual'||record.fkiManualCurrent!==undefined&&record.fkiManualCurrent!==null&&record.fkiManualCurrent!=='';}
  function newestValuationDate(source,record,kind) {
    const dates=[valuationOf(record,kind).valuationDate];
    if(kind==='record')relatedFunds(source,recordIsin(record),record).forEach(([,f])=>dates.push(date(f.date)));
    return dates.filter(Boolean).sort().at(-1)||'';
  }
  function relatedFunds(source,isin,record) {const key=record&&typeof invPositionKey==='function'?invPositionKey(record):'',fund=record?normal(recordFund(record)):'';return Object.entries(source.fundValues||{}).filter(([k,f])=>k===key||isin&&(k==='isin|'+s(isin).toLowerCase()||s(f.isin).toUpperCase()===s(isin).toUpperCase())||!isin&&fund&&normal(f.fond||f.product||f.fund)===fund);}
  function contextHash(source,clientId,isin,record) {const c=(source.clients||[]).find(c=>same(c.id,clientId));return hash({client:c?clientIds(c):null,funds:relatedFunds(source,isin,record)});}
  function sourceComparable(row) {const clean=copy(row);['rowNumber','provider','errors','warnings'].forEach(k=>delete clean[k]);return clean;}
  function newEntry(row) {return {id:uuid(),clientId:null,isin:row.isin||'',fund:row.fund,status:'pending',reason:'',changes:Object.keys(LABELS).filter(field=>!empty(row[field])).map(field=>({field,label:LABELS[field],before:null,after:row[field]})),incoming:copy(row),targetKey:null,recordKey:'',canAccept:false,createdAt:timestamp(),updatedAt:timestamp()};}
  function sameSourceRecord(record,row) {return record._providerSource&&canonical(sourceComparable(record._providerSource))===canonical(sourceComparable(row));}
  function finishExisting(entry,record,kind,source,provider) {
    const row=entry.incoming;entry.targetKey=targetFor(record,kind);entry.recordKey=kind==='record'?entry.targetKey.key:'';entry.targetHash=hash(record);entry.contextHash=contextHash(source,entry.clientId,entry.isin,record);entry.changes=changesFor(record,row,kind,source);entry.canAccept=true;
    if(!entry.changes.length&&sameSourceRecord(record,row)){entry.status='unchanged';entry.reason='Tato data již jsou uložená.';return;}
    if(!entry.changes.length){entry.status='auto';entry.reason='Ověřená transakce; doplní se pouze vazba na výpis.';return;}
    if(row.current===0){entry.reason='Nulová aktuální hodnota existující pozice vyžaduje potvrzení.';return;}
    if(entry.changes.some(x=>['amount','units','issueNav','paymentDate','emissionDate'].includes(x.field))){entry.reason='Liší se vklad, CP nebo data transakce. Nejprve ověř změnu.';return;}
    if(manual(record,kind)){entry.reason='V CRM je ručně upravené ocenění nebo výnos; výpis je automaticky nepřepíše.';return;}
    const latest=newestValuationDate(source,record,kind);
    if(latest&&row.valuationDate<latest){entry.reason='Výpis má starší datum ocenění než CRM.';return;}
    if(latest&&row.valuationDate===latest&&entry.changes.some(x=>x.field==='current'||x.field==='nav')){entry.reason='Jiné ocenění ke stejnému datu vyžaduje kontrolu.';return;}
    if(record._providerSource){
      const prior=record._providerSource,local=kind==='record'?{...recordBasis(record),...valuationOf(record,kind)}:valuationOf(record,kind);
      if(Object.keys(LABELS).some(field=>prior[field]!=null&&local[field]!=null&&(typeof prior[field]==='number'?!near(prior[field],local[field],.000001):prior[field]!==local[field]))){entry.reason='Údaje v CRM byly od posledního výpisu změněny.';return;}
    }else if(record._source==='local-fki'&&record._updatedAt){entry.reason='Lokální záznam byl ručně upraven; zkontroluj první spojení s výpisem.';return;}
    entry.status='auto';entry.reason='Jednoznačná shoda a novější ocenění při stejném základu investice.';
  }
  function providerImportBuildPlan(source,parsed) {
    const stamp=timestamp(),batch={id:uuid(),schemaVersion:1,provider:parsed.provider,area:parsed.area,fileName:parsed.fileName,reportDate:parsed.reportDate,createdAt:stamp,updatedAt:stamp,fingerprint:'',entries:[],errors:[...(parsed.errors||[])],warnings:[...(parsed.warnings||[])],sourceSignature:signature(source)};
    const normalizedRows=(parsed.rows||[]).map(row=>{const x=copy(row);delete x.rowNumber;return x;}).sort((a,b)=>canonical(a).localeCompare(canonical(b)));
    batch.fingerprint=parsed.provider+':'+hash({area:parsed.area,reportDate:parsed.provider==='codya'?parsed.reportDate:'',rows:normalizedRows});
    const previous=(source.providerImports||[]).find(b=>b.fingerprint===batch.fingerprint);
    if(previous){batch.id=previous.id;batch.createdAt=previous.createdAt;batch.replacesBatchId=previous.id;if(previous.appliedStateSignature===batch.sourceSignature){batch.duplicateOf=previous.id;batch.entries=copy(previous.entries||[]);return batch;}}
    const addressed=new Set(),strongClients=new Set();
    for(const row of parsed.rows||[]){
      const entry=newEntry(row);batch.entries.push(entry);
      const clients=(source.clients||[]).filter(c=>clientMatches(c,row));
      if(parsed.provider==='codya'&&clients.length!==1&&(row.blank||row.current===0)){batch.entries.pop();continue;}
      if(clients.length!==1){entry.reason=clients.length?'Více klientů má stejné silné ID. Vyřeš duplicitu klientů.':'Klienta nelze jednoznačně spojit podle RČ/IČO. Jméno samo nestačí.';continue;}
      const client=clients[0];entry.clientId=client.id;entry.contextHash=contextHash(source,client.id,entry.isin,row);strongClients.add(s(client.id));
      const owned=(source.investmentRecords||[]).filter(r=>!r.portfolioReplacedBy&&recordOwner(r,client,row));
      if(parsed.provider==='avant'){
        const fundRows=owned.filter(r=>recordIsin(r)===row.isin),exact=fundRows.filter(r=>r._providerTransactionKey===row.key),legacy=exact.length?[]:fundRows.filter(r=>!r._providerTransactionKey&&exactLegacy(r,row)),matches=exact.length?exact:legacy;
        fundRows.forEach(r=>{if(matches.includes(r))addressed.add(rawRecordKey(r));});
        if(row.errors?.length){entry.reason=row.errors.join(' ');continue;}
        if(batch.errors.length){entry.reason=batch.errors.join(' ');continue;}
        if(!['Platba','Odkup'].includes(row.transactionType)){entry.reason='Převod nebo konverzi zpracuj ručně po kontrole obou stran pohybu. Výpis se uchová pro kontrolu.';continue;}
        if(matches.length>1){entry.reason='Více pozic odpovídá jedné transakci. Vyber správnou vazbu ručně v evidenci.';continue;}
        if(matches.length===1){finishExisting(entry,matches[0],'record',source,'avant');continue;}
        const otherSameFund=owned.filter(r=>recordIsin(r)===row.isin);
        const ambiguous=otherSameFund.some(r=>{const basis=recordBasis(r),order=identifier(r.Pokyn||r._providerSource?.orderId),contract=identifier(r.Spis||r._providerSource?.contractRef);return !order||order===row.orderId||basis.paymentDate===row.paymentDate||contract&&row.contractRef===contract;});
        entry.canAccept=!!row.key&&!ambiguous&&(row.transactionType!=='Odkup'||otherSameFund.length>0);
        entry.newPosition=true;entry.reason=otherSameFund.length?'Nový nebo nespárovaný pokyn u existujícího fondu. Potvrď pouze pokud jde o samostatnou novou transakci.':'Ve výpisu je nová pozice. Vytvoří se pouze po tvém potvrzení.';
        if(!entry.canAccept)entry.reason='Nelze vyloučit existující ruční pozici nebo chybí původní nákup. Nejprve oprav vazbu v evidenci; nová kopie se nevytvoří.';
      }else{
        const records=owned.filter(r=>normal(recordFund(r))===normal(row.fund)),snapshots=(source.investmentSnapshots||[]).filter(r=>same(r.clientId,client.id)&&normal(r.product)===normal(row.fund)),kind=parsed.area==='investice'?'snapshot':'record',matches=kind==='snapshot'?snapshots:records;
        records.forEach(r=>addressed.add(rawRecordKey(r)));
        if(!matches.length&&(row.blank||row.current===0)){batch.entries.pop();continue;}
        if(row.errors?.length){entry.reason=row.errors.join(' ');continue;}
        if(batch.errors.length){entry.reason=batch.errors.join(' ');continue;}
        if(row.blank){entry.reason='Prázdná buňka není nula; CRM se nezmění.';continue;}
        if(matches.length!==1){entry.reason=matches.length?'Souhrnnou hodnotu fondu nelze automaticky rozdělit mezi více pozic.':'Není jednoznačná shoda celého názvu fondu včetně třídy. Hodnota se nepřiřadí podle podobnosti.';continue;}
        const target=matches[0];entry.isin=recordIsin(target)||s(target.isin);entry.incoming.isin=entry.isin;
        finishExisting(entry,target,kind,source,'codya');
      }
    }
    // Absence in a full report is a review item, never an instruction to remove assets.
    const belongsToProvider=record=>{const company=normal(s(typeof invCompany==='function'?invCompany(record):record['Investiční společnost']||record['Investicni spolecnost']||record.Společnost||record.Spolecnost||record.Producent||record.company).split(/\s[-–]\s/)[0]);return record._providerSource?.provider===parsed.provider||record.providerValuation?.provider===parsed.provider||(parsed.provider==='avant'?/^avant(?:a)?(?:$| invest)/.test(company):['codya','codie','kodya'].includes(company))||parsed.provider==='codya'&&parsed.area==='investice'&&company==='vigo public';};
    (source.investmentRecords||[]).filter(belongsToProvider).forEach(record=>{
      if(parsed.provider==='codya'&&parsed.area==='investice')return;
      if(record.portfolioReplacedBy||addressed.has(rawRecordKey(record)))return;
      const entry=newEntry({key:'missing:'+rawRecordKey(record),missing:true,isin:recordIsin(record),fund:recordFund(record),errors:[]});
      const candidates=strictRecordClients(source,record);
      entry.clientId=candidates.length===1?candidates[0].id:null;entry.targetKey=targetFor(record);entry.recordKey=entry.targetKey.key;entry.targetHash=hash(record);entry.contextHash=contextHash(source,entry.clientId,entry.isin,record);entry.reason='Pozice vedená v CRM v tomto výpisu chybí. CRM ji ponechává beze změny.';batch.entries.push(entry);
    });
    if(parsed.provider==='codya'&&parsed.area==='investice')(source.investmentSnapshots||[]).filter(belongsToProvider).forEach(record=>{if(batch.entries.some(e=>e.targetKey?.kind==='snapshot'&&same(e.targetKey.key,record.id)))return;const entry=newEntry({key:'missing-snapshot:'+record.id,missing:true,isin:recordIsin(record),fund:s(record.product),errors:[]});entry.clientId=(source.clients||[]).some(c=>same(c.id,record.clientId))?record.clientId:null;entry.targetKey=targetFor(record,'snapshot');entry.targetHash=hash(record);entry.contextHash=contextHash(source,entry.clientId,entry.isin,record);entry.reason='Pozice vedená v CRM v tomto výpisu chybí. Zůstává beze změny.';batch.entries.push(entry);});
    const targetCounts=new Map();batch.entries.filter(e=>e.targetKey&&!e.incoming.missing).forEach(e=>{const key=canonical(e.targetKey);targetCounts.set(key,(targetCounts.get(key)||0)+1);});
    batch.entries.forEach(entry=>{
      if(entry.targetKey&&!entry.incoming.missing&&targetCounts.get(canonical(entry.targetKey))>1){entry.status='pending';entry.canAccept=false;entry.reason='Více řádků výpisu míří na stejnou pozici CRM. Nejprve ověř jednotlivé pokyny.';}
      entry.inputFingerprint=hash({provider:batch.provider,clientId:entry.clientId,incoming:sourceComparable(entry.incoming)});
      const old=(source.providerImports||[]).flatMap(b=>b.entries||[]).find(e=>e.inputFingerprint===entry.inputFingerprint&&['kept','accepted'].includes(e.status)&&e.targetHash===entry.targetHash&&e.contextHash===entry.contextHash);
      if(old&&(old.status==='kept'||entry.status==='unchanged')){entry.status=old.status;entry.reason=old.status==='kept'?'U stejného údaje a nezměněné pozice bylo dříve zvoleno ponechání CRM.':'Stejná data byla již přijata.';entry.resolvedAt=old.resolvedAt;}
    });
    return batch;
  }

  function sourceSnapshot(row,provider) {return {...sourceComparable(row),provider};}
  function remapReferences(oldKey,newKey,currentBatch) {
    if(!oldKey||!newKey||oldKey===newKey||typeof providerStorageRemapRecordReferences!=='function')return;
    const changed=(state.investmentRecords||[]).filter(r=>r.redemptionSourceRecordKey===oldKey||r['Odkup z nákupu']===oldKey).map(record=>({record,beforeHash:hash(record),beforeKey:rawRecordKey(record)}));
    providerStorageRemapRecordReferences(oldKey,newKey);
    // Only the reference rewrite performed here may refresh another preview's hash.
    // A record already changed by the user never passes the beforeHash comparison.
    const batches=new Set([...(state.providerImports||[]),currentBatch]);
    changed.forEach(({record,beforeHash,beforeKey})=>{const afterKey=rawRecordKey(record),afterHash=hash(record);batches.forEach(batch=>(batch?.entries||[]).forEach(entry=>{if(entry.targetKey?.kind==='record'&&[beforeKey,afterKey].includes(entry.targetKey.key)&&entry.targetHash===beforeHash){entry.targetKey={kind:'record',key:afterKey};entry.recordKey=afterKey;entry.targetHash=afterHash;}}));});
  }
  function applyEntry(entry,batch,selectedFields) {
    const row=entry.incoming,client=(state.clients||[]).find(c=>same(c.id,entry.clientId));
    if(!client||!clientMatches(client,row))throw new Error('Klient nebo jeho identita se změnila. Načti výpis znovu.');
    let record=findTarget(state,entry.targetKey),kind=entry.targetKey?.kind||'record';
    if(entry.contextHash&&contextHash(state,entry.clientId,entry.isin,record||row)!==entry.contextHash)throw new Error('Identita klienta nebo aktuální údaje fondu se změnily. Načti výpis znovu.');
    if(entry.targetKey&&!record)throw new Error('Původní investice již není jednoznačně dostupná. Načti výpis znovu.');
    if(record&&entry.targetHash&&hash(record)!==entry.targetHash)throw new Error('Investice byla po náhledu změněna. Načti výpis znovu.');
    if(!record){
      if(!entry.newPosition||batch.provider!=='avant'||!row.key||!['Platba','Odkup'].includes(row.transactionType))throw new Error('Tuto položku nelze vytvořit importem.');
      if((state.investmentRecords||[]).some(r=>r._providerTransactionKey===row.key))throw new Error('Transakce již existuje. Načti výpis znovu.');
      const liveFund=(state.investmentRecords||[]).filter(r=>!r.portfolioReplacedBy&&recordOwner(r,client,row)&&recordIsin(r)===row.isin);
      if(liveFund.some(r=>!r._providerTransactionKey&&(exactLegacy(r,row)||recordBasis(r).paymentDate===row.paymentDate)))throw new Error('Od náhledu byla doplněna odpovídající ruční pozice. Načti výpis znovu, aby nevznikla duplicita.');
      if(row.transactionType==='Odkup'&&!liveFund.some(r=>txName(r['Typ transakce']||r.transactionType||'Platba')==='Platba'))throw new Error('Není dostupný původní nákup pro tento odkup. Nejprve ověř transakce.');
      record={Investor:client.name||row.investor,'RČ':row.birthId,'IČO':row.companyId,ClientID:row.birthId?'RC_'+row.birthId:s(client.id),'Investiční společnost':'Avant',Fond:row.fund,ISIN:row.isin,'Typ CP':row.securityType,'Typ produktu':'FKI','Typ transakce':row.transactionType,Spis:row.contractRef,Pokyn:row.orderId,_source:'provider-import',_createdAt:timestamp()};
      state.investmentRecords=state.investmentRecords||[];state.investmentRecords.push(record);
    }
    const oldKey=kind==='record'&&!entry.newPosition?rawRecordKey(record):'',fields=new Set(Array.isArray(selectedFields)?selectedFields:entry.changes.map(x=>x.field));
    if(entry.newPosition)Object.keys(LABELS).forEach(field=>fields.add(field));
    if(!Array.isArray(selectedFields))['current','nav','valuationDate'].forEach(field=>{if(!empty(row[field]))fields.add(field);});
    const mapping={amount:'Čistá investice',units:'Počet vydaných CP',issueNav:'Upisovací hodnota',paymentDate:'Datum připsání platby',emissionDate:'Datum emise'};
    if(kind==='record')Object.entries(mapping).forEach(([field,key])=>{if(fields.has(field)&&row[field]!==undefined&&row[field]!==null&&row[field]!=='')record[key]=row[field];});
    const valuationChanged=['current','nav','valuationDate'].some(field=>fields.has(field));
    if(valuationChanged){
      const prior=record.providerValuation||{},valuation={...prior,provider:batch.provider,date:row.valuationDate||prior.date};
      if(fields.has('current')&&row.current!==null&&row.current!==undefined){valuation.current=row.current;if(kind==='snapshot'){record.current=row.current;record.currentBeforeRedemption=row.current;if(Number.isFinite(+record.invested)&&!record.manualPerformanceOverride){record.gainAmount=row.current-Number(record.invested);record.gainPct=+record.invested?record.gainAmount/+record.invested*100:0;}}else {record['Aktuální hodnota investice']=row.current;if(record.fkiValuationMode==='manual')record.fkiManualCurrent=Math.max(0,row.current);}}
      if(fields.has('nav')&&row.nav!==null&&row.nav!==undefined)valuation.nav=row.nav;
      if(kind==='snapshot')record.date=valuation.date;else record['Poslední schválená hodnota do']=valuation.date;
      record.providerValuation=valuation;
    }
    if(row.transactionType==='Odkup'&&(fields.has('amount')||valuationChanged)){record.providerValuation=record.providerValuation||{provider:batch.provider,date:row.valuationDate};record.providerValuation.redemptionValue=Math.abs(number(record['Čistá investice'])||0);}
    record._providerClientId=client.id;if(batch.provider==='avant')record._providerTransactionKey=row.key;
    record._providerSource=sourceSnapshot(row,batch.provider);record._providerImportedAt=timestamp();record._updatedAt=timestamp();
    if(kind==='record'&&!manual(record,kind))record.fkiValuationMode='statement';
    const nextTarget=targetFor(record,kind);if(kind==='record')remapReferences(oldKey,nextTarget.key,batch);
    entry.targetKey=nextTarget;entry.recordKey=kind==='record'?nextTarget.key:'';entry.targetHash=hash(record);entry.contextHash=contextHash(state,entry.clientId,entry.isin,record);entry.updatedAt=timestamp();
    return record;
  }
  function atomic(change) {
    const before=copy(state);
    try {const result=change();if(typeof persist!=='function'||persist()===false)throw new Error('Uložení se nezdařilo. Data zůstala beze změny.');return result;}
    catch(error){state=before;return {ok:false,error:error.message||String(error)};}
  }
  function providerImportCommit(batch) {
    if(!batch||!Array.isArray(batch.entries))return {ok:false,error:'Chybí platný náhled importu.'};
    if(batch.errors?.length)return {ok:false,error:batch.errors.join(' ')};
    if(signature(state)!==batch.sourceSignature)return {ok:false,error:'CRM se během náhledu změnilo. Načti výpis znovu před potvrzením.'};
    const existing=(state.providerImports||[]).find(b=>b.fingerprint===batch.fingerprint);
    if(batch.duplicateOf&&existing&&existing.appliedStateSignature===signature(state))return {ok:true,batchId:existing.id,applied:0,duplicate:true};
    if(existing&&!same(existing.id,batch.replacesBatchId))return {ok:false,error:'Výpis již byl uložen. Načti náhled znovu.'};
    return atomic(()=>{const saved=copy(batch);let applied=0;for(const entry of saved.entries){if(entry.status==='auto'){applyEntry(entry,saved);applied++;}}saved.updatedAt=timestamp();saved.appliedStateSignature=signature(state);delete saved.sourceSignature;delete saved.duplicateOf;state.providerImports=state.providerImports||[];const index=state.providerImports.findIndex(b=>same(b.id,saved.id));if(index>=0)state.providerImports[index]=saved;else state.providerImports.push(saved);return {ok:true,batchId:saved.id,applied,duplicate:false};});
  }
  function providerImportResolve(batchId,entryId,action,selectedFields) {
    if(!['accept','keep'].includes(action))return {ok:false,error:'Neznámé rozhodnutí.'};
    const batch=(state.providerImports||[]).find(b=>same(b.id,batchId)),entry=batch?.entries?.find(e=>same(e.id,entryId));
    if(!entry)return {ok:false,error:'Položka kontroly nebyla nalezena.'};
    if(entry.status!=='pending')return {ok:true,batchId:batch.id,applied:0,duplicate:true};
    if(action==='accept'&&!entry.canAccept)return {ok:false,error:'Tato položka vyžaduje ruční doplnění nebo opravu vazby v CRM.'};
    if(Array.isArray(selectedFields)&&selectedFields.some(field=>!Object.hasOwn(LABELS,field)))return {ok:false,error:'Vybrané pole není součástí importu.'};
    if(action==='accept'&&Array.isArray(selectedFields)){
      if(!selectedFields.length)return {ok:false,error:'Vyber alespoň jedno pole nebo ponech CRM.'};
      const valuationFields=['current','nav','valuationDate'].filter(field=>!empty(entry.incoming[field]));
      if(valuationFields.some(field=>selectedFields.includes(field))&&!valuationFields.every(field=>selectedFields.includes(field)))return {ok:false,error:'Aktuální hodnotu, NAV a datum ocenění přijmi společně, aby se datum nepřiřadilo ke staré hodnotě.'};
      if(entry.newPosition)return {ok:false,error:'Nová transakce se přijímá jako celek.'};
    }
    return atomic(()=>{if(action==='accept')applyEntry(entry,batch,selectedFields);entry.status=action==='accept'?'accepted':'kept';entry.resolvedAt=timestamp();entry.updatedAt=entry.resolvedAt;entry.acceptedFields=action==='accept'?(Array.isArray(selectedFields)?selectedFields:entry.changes.map(x=>x.field)):[];batch.updatedAt=entry.resolvedAt;batch.appliedStateSignature=signature(state);return {ok:true,batchId:batch.id,applied:action==='accept'?1:0,duplicate:false};});
  }
  Object.assign(window,{providerImportParseAvant,providerImportParseCodya,providerImportBuildPlan,providerImportCommit,providerImportResolve});
})();
