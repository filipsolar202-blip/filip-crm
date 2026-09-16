// In-memory protocol test; never connects to Google.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
class Sheet {
 constructor(){this.rows=[]}
 getLastRow(){return this.rows.length}
 appendRow(row){this.rows.push(row)}
 setFrozenRows(){}
 getRange(row,col,count,width){const sheet=this;return {getValues(){return Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>sheet.rows[row-1+i]?.[col-1+j]??''))},setValues(values){values.forEach((r,i)=>{sheet.rows[row-1+i]||=[];r.forEach((x,j)=>sheet.rows[row-1+i][col-1+j]=x)})}}}
}
const sheets=new Map();const spreadsheet={getSheetByName:n=>sheets.get(n),insertSheet(n){const s=new Sheet();sheets.set(n,s);return s}};
const ctx={SpreadsheetApp:{openById:()=>spreadsheet},Utilities:{getUuid:()=> 'qa-backup'},ContentService:{MimeType:{JAVASCRIPT:'js'},createTextOutput:text=>({text,setMimeType(){return this}})},HtmlService:{createHtmlOutput:text=>({text})}};
const source=fs.readFileSync(path.join(__dirname,'../../google-sync/Code.gs'),'utf8').replace('PASTE_GOOGLE_SHEET_ID_HERE','qa-sheet').replace('CHANGE_THIS_PRIVATE_KEY','qa-key');
vm.createContext(ctx);vm.runInContext(source,ctx);
const state={clients:[{id:1,name:'Synthetic QA'}],contracts:[],notes:[{text:'test '.repeat(20000)}]};
const saved=ctx.doPost({parameter:{action:'save',key:'qa-key',app:'filip_crm',payload:JSON.stringify({version:'qa',state})}});
assert(saved.text.includes('byla ulozena'));
function read(action,key='qa-key'){const text=ctx.doGet({parameter:{action,key,app:'filip_crm',callback:'qa'}}).text;return JSON.parse(text.slice(3,-2))}
assert(read('status').ok);assert.deepEqual(read('load').backup.state,state);assert(!read('load','bad-key').ok);
sheets.get('backup_chunks').rows.pop();assert(!read('load').ok);
console.log('PASS: Google protocol save/load over multiple chunks, metadata, wrong key and incomplete backup rejection.');
