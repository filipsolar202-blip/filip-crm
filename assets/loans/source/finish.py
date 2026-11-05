from pathlib import Path
import json
p=Path(__file__).parent
banks=json.loads((p/'banks.json').read_text())
banks.extend([
dict(id='mbank',name='mBank',color='#bc3b51',rate=5.59,fix=3,term=40,age=70,min=1,kind='check',pct=30,basis='base',cap=None,verified=True,rateNote='Sazebník účinný 22. 10. 2026: 5,59 % pro 3 roky a LTV do 80 %. 1 rok 5,99 %, 5 let 5,79 %.',note='Až 40 let; splacení do 70 let nejstaršího žadatele. Peníze navíc do 30 % hlavního investičního záměru (účelové části), stejná sazba. Libovolné použití nebylo ve zdroji výslovně potvrzeno.',sources=[['Produkt, věk a část navíc','https://www.mbank.cz/osobni/hypoteky/hypoteka-na-bydleni/'],['Sazebník','https://www.mbank.cz/informace-k-produktum/urokovy-listek/osobni-finance/urokovy_listek_aktualni.pdf']]),
dict(id='fio',name='Fio banka',color='#325c97',rate=4.98,fix=3,term=30,age=70,min=10,kind='unknown',pct=None,basis='total',cap=None,verified=False,rateNote='Sazebník od 1. 10. 2026: 4,98 % bez pojištění, 4,78 % s pojištěním pro fixaci 1, 2 či 3 roky. LTV do 80 %. Úvěr min. 1,5 mil. Kč, výstavba / stavební úpravy min. 3 mil. Kč.',note='Splatnost 10–30 let, do 70 let včetně. Limit doplňkové části nedoložen. Samostatná americká hypotéka není doplňková část.',sources=[['Produkt','https://www.fio.cz/bankovni-sluzby/uvery/hypoteky'],['Sazby','https://www.fio.cz/docs/cz/urokove_sazby_FO.pdf'],['Věk a splatnost','https://www.fio.cz/spolecnost-fio/servis-pro-klienty/faq/bankovni-sluzby/5-uvery']]),
dict(id='rb',name='Raiffeisenbank',color='#b69b31',rate=4.99,fix=None,term=30,age=70,min=1,kind='housing',pct=30,basis='base',cap=1000000,verified=True,rateNote='Hypodny 1. 10.–20. 12. 2026: od 4,99 % po slevě 0,1 p. b. za kompletní PENB. Fixace této headline sazby není uvedena; potvrďte v nabídce.',note='Standardně do 70 let nejstaršího žadatele se započítaným příjmem, včetně čerpání. Výjimky s mladším spolužadatelem. Produkt 30+: do 30 % účelové části, max. 1 mil. Kč, na drobnou investici do bydlení; za podmínek i splacení nejvýše 3 nebytových úvěrů (ne KTK/KK).',sources=[['Sazba a kampaň','https://www.rb.cz/promo/hypodny'],['Splatnost','https://www.rb.cz/povinne-zverejnovane-informace/informace-trvale-pristupne-spotrebiteli'],['30+ metodika 260619','https://poradci.rb.cz/attachments/hypotecni-uvery/metodika/typy-uveru/rb-hu-tricet-plus.pdf'],['Věk, metodika 260814','https://poradci.rb.cz/attachments/hypotecni-uvery/metodika/ostatni-metodika/rb-zadatele-a-spoluzadatele.pdf']]),
dict(id='unicredit',name='UniCredit Bank',color='#b44b51',rate=5.39,fix=3,term=30,age=None,min=1,kind='free',pct=None,basis='total',cap=None,verified=False,rateNote='5,39 % pro 3 roky a LTV do 80 %; 2 roky 5,29 %, 5 let 5,79 %. Podmínkou pojištění splácení, měsíční příjem na účet alespoň 1,5násobku splátky a 3 platby kartou. Pro LTV 81–90 % +0,5 p. b.',note='Až 30 let, věkový limit veřejně nepotvrzen. Produkt potvrzuje peníze navíc na cokoli, ale číselný limit v dostupném oficiálním zdroji neuvádí. Doplňte podle nabídky.',sources=[['Úrokové sazby','https://www.unicreditbank.cz/cs/ostatni/urokove-sazby.html'],['Produkt','https://www.unicreditbank.cz/cs/obcane/hypoteky/hypoteka-nove-penize.html']]),
dict(id='ober',name='Oberbank',color='#ab4b43',rate=None,fix=None,term=30,age=None,min=5,kind='unknown',pct=None,basis='total',cap=None,verified=False,rateNote='Aktuální veřejná sazba nebyla spolehlivě ověřena; zadejte individuální nabídku. Starší reprezentativní příklad nebyl použit jako současná sazba.',note='Standardní hypotéka 5–30 let; investiční 5–25 let. Věk a doplňková část neověřeny. Samostatná neúčelová FlexiHypotéka má splatnost 8–20 let a LTV do 75 %; neslučovat s doplňkem standardní hypotéky.',sources=[['Hypoteční produkty','https://www.oberbank.cz/hypotecni-uvery']]),
dict(id='partners',name='Partners Banka',color='#427f8a',rate=None,fix=None,term=35,age=None,min=5,kind='unknown',pct=None,basis='total',cap=None,verified=False,rateNote='Aktuální sazbu se nepodařilo potvrdit otevřením stránky (přístup omezen). Vyhledávací náhled potvrzuje splatnost 5–35 let, sazbu zadejte z nabídky.',note='Max. 20 mil. Kč a 5–35 let dle veřejného náhledu produktové stránky. Věkový limit a aktuální limit doplňkové části nebyly potvrzeny; zadejte podle nabídky banky.',sources=[['Hypotéka – zdroj vyhledávacího náhledu','https://www.partnersbanka.cz/hypoteky']])])
banks=[b for b in banks if b['id'] not in ('air','moneta','partners')]
banks.sort(key=lambda b: b['id']!='kb')
for b in banks:
 if b['id'] in ('kb','csob'):
  b['age']=75 if b['id']=='kb' else 72
  b['reviewAge']=65
  b.pop('exceptionAge',None)
  b.pop('exceptionNote',None)
 if b['id']=='kb':
  b['note']='Maximálně 360 měsíců a doplacení nejpozději v 75 letech u žadatele se započítaným příjmem (metodika KB 13/2026). Vyšší věk se posuzuje individuálně. Hypotéka 2 v 1: do 30 % účelové části, max. 2 mil. Kč, výdaje související s bydlením.'
(p/'banks-all.json').write_text(json.dumps(banks,ensure_ascii=False,indent=2))
html=(p/'template.html').read_text().replace('<!--BANKS-->',json.dumps(banks,ensure_ascii=False)).replace('<!--FONT-->',(p/'font-fragment.txt').read_text())
import runpy
ui=runpy.run_path(str(p/'advisory-ui.py'))
existing=runpy.run_path(str(p/'existing-ui.py'))
ui['questionnaire']=ui['questionnaire'].replace('<article class="glass"><div class="ad-section"><span>03</span><h2>Nemovitost',existing['existing_card']+'<article class="glass"><div class="ad-section"><span>04</span><h2>Nemovitost')
ui['questionnaire']+=existing['refinancing']
workflow=runpy.run_path(str(p/'workflow-ui.py'))
ui['questionnaire']=ui['questionnaire'].replace('<section id="questionnaire" class="page">','<section id="questionnaire" class="page">'+workflow['import_controls'])
ui['report_controls']+=workflow['report_controls']
html=html.replace('<!--CAPACITY_CONTROLS-->',workflow['capacity_controls'])
for key,value in {'<!--ADVISORY_PAGES-->':ui['questionnaire']+ui['funding'],'<!--INVESTMENT_DIALOG-->':ui['dialog'],'<!--PROPOSAL_CONTROLS-->':ui['report_controls'],'/*ADVISORY_CSS*/':(p/'advisory.css').read_text(),'/*ADVISORY_JS*/':(p/'advisory.js').read_text(),'/*EXISTING_JS*/':(p/'existing.js').read_text(),'/*PROPOSAL_JS*/':(p/'proposal.js').read_text(),'/*WORKFLOW_JS*/':(p/'intake-schema.js').read_text()+'\n'+(p/'workflow.js').read_text()}.items():
 html=html.replace(key,value)
(p/'Uverove-studio.html').write_text(html)
print('HTML bytes:',len(html.encode()))
