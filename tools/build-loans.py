"""Rebuild supplied v3.2 without modifying its financial calculation model."""
from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[1];target=root/'assets/loans';source=target/'source'
for script in ['build-intake.py','finish.py','prepare-test-dom.py']:
 subprocess.run([sys.executable,str(source/script)],check=True,cwd=source)
studio=(source/'Uverove-studio.html').read_text()
studio=studio.replace('</head>','<style>body.crm-embedded .hero{display:none}.crm-loan-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 20px;background:#e8f4f8;color:#18486a}.crm-loan-bar span{flex:1;font-size:13px}body{min-width:0}@media print{.crm-loan-bar{display:none!important}.proposal-page:has(.budget-hero) .proposal-body{font-size:9pt;line-height:1.35;padding-top:5mm;padding-bottom:3mm}.proposal-page:has(.budget-hero) .proposal-body p{margin:1.5mm 0}.proposal-page:has(.budget-hero) .proposal-body h3{margin:3mm 0 2mm}}</style></head>')
studio=studio.replace('</body>','<script src="frame-bridge.js?v=2026.11.05-4"></script></body>')
(target/'studio.html').write_text(studio)
form=(source/'Klientsky-dotaznik-v3.0.html').read_text()
form=form.replace('function dl(payload,name){',"function dl(payload,name){const request=new URLSearchParams(location.hash.slice(1)).get('request');if(request&&/^[a-f0-9-]{36}$/.test(request))payload.crmFormRequest=request;")
guide='''<details id="clientHelp" class="glass" style="padding:16px;margin:0 0 20px"><summary>Jak dotazník vyplnit a poslat zpět</summary><ol><li>Otevřete odkaz na telefonu nebo počítači v prohlížeči.</li><li>Postupujte tlačítkem Pokračovat. Neznámé nepovinné údaje nechte prázdné; nula znamená skutečně nulu. Stávající hypotéku nezapočítávejte znovu do ostatních úvěrů.</li><li>Pro přestávku zvolte Uložit rozpracované. Příště přes Načíst rozpracované otevřete uložený JSON.</li><li>Na konci zkontrolujte odpovědi a stiskněte Dokončit a stáhnout podklady pro poradce. Soubor se uloží zpravidla do Stažených souborů; na iPhonu ho najdete v aplikaci Soubory.</li><li>Odpovězte na zprávu poradce a přiložte stažený JSON pomocí sponky. Teprve po stisknutí Odeslat poradce odpovědi dostane.</li></ol><p>Stažení není odeslání. Není potřeba JSON ručně číst ani upravovat.</p></details>'''
form=form.replace('<main>','<main>'+guide)
form=form.replace('</style>','body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#26354a}.glass{border:1px solid #ccdbe8;border-radius:22px;box-shadow:0 12px 35px #29456b0a}h1{font-size:clamp(28px,5vw,40px);letter-spacing:-.8px}h2{font-size:23px}</style>')
(target/'questionnaire.html').write_text(form)
(target/'intake-schema.js').write_text('(function(){\n'+(source/'intake-schema.js').read_text()+'\nwindow.LoanIntake={fields:INTAKE_FIELDS,parse:parseIntake,validate:intakeValidate,active:intakeActive,filename:intakeFilename};\n})();\n')
