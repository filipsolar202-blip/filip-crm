// Only synthetic records. Never load a real browser profile or CRM data directory.
module.exports = {
 nextId:100,settings:{bjCoef:150},plans:{2026:{bjCoef:150,clients:10,investment:1000000,mortgage:3000000,categories:{}}},
 clients:[{id:1,name:'Testovací klient Alfa',birthId:'9001010001',email:'alfa@example.test',phone:'+420000000001',createdAt:'2026-01-01'}, {id:2,name:'Testovací klient Beta',birthId:'9001010002',email:'beta@example.test',createdAt:'2026-01-01'}],
 contracts:[{id:10,clientId:1,type:'životní',source:'zivot',company:'Test pojišťovna',product:'Test život',number:'TEST-INS-1',status:'vyrizeno',amount:'1200',anniv:'2026-10-01',log:[]}, {id:11,clientId:1,type:'hypotéka',source:'hypoteky',company:'Test banka',product:'Test hypotéka',number:'TEST-MORT-1',status:'reseni',amount:'2000000',rate:'5',anniv:'2026-10-01',log:[]}, {id:12,clientId:1,type:'DPS',company:'Test penze',product:'DPS',number:'TEST-PEN-1',status:'vyrizeno',amount:'1500',anniv:'2026-01-01',log:[]}],
 deals:[{id:20,clientId:1,category:'Investice',company:'Test invest',product:'Test klasický fond',date:'2026-01-10',amount:100000,bj:100,actualCommission:15000,commissionPaid:true},{id:21,clientId:1,category:'FKI',company:'Test FKI',product:'Test FKI fond',date:'2026-02-10',amount:200000,bj:150,actualCommission:22500,commissionPaid:false}],
 opportunities:[{id:30,clientId:1,category:'Hypotéky',product:'Nová hypotéka',company:'Test banka',amount:2500000,bj:100,status:'Oportunita',statusDate:'2026-09-16',note:'Test návrh'}],
 activities:[{id:40,clientId:1,type:'Telefon',date:'2026-09-16',text:'Test hovor',completed:false}],
 notes:[{id:50,clientId:1,title:'Test poznámka',text:'Testovací text <bez HTML>',date:'2026-09-16',tags:'test'}],
 referrals:[],referrerPayouts:[],investmentRecords:[],investmentSnapshots:[],commissionImports:[],analysisEntries:[],analysisPlans:{},lockedFunds:{},trailSettings:{},
 fundValues:{'test-classic':{area:'investice',company:'Test invest',fond:'Test klasický fond',isin:'TEST00000001',typ:'Podílový list',nav:120,date:'2026-09-01',expectedRate:5,comment:'Test komentář'},'test-fki':{area:'fki',company:'Test FKI',fond:'Test FKI fond',isin:'TEST00000002',typ:'Investiční akcie',nav:110,date:'2026-09-01',expectedRate:7,comment:'Test FKI komentář'}}
};
