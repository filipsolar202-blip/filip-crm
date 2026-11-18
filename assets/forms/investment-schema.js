window.InvestmentSchema={
  "title": "Investice podle Vašich plánů",
  "steps": [
    "O vás a podklady",
    "Co mají peníze splnit",
    "Vaše finanční zázemí",
    "Zkušenosti a klid při investování",
    "Kontrola a odeslání"
  ],
  "fields": [
    {
      "id": "clientName",
      "label": "Jméno a příjmení",
      "type": "text",
      "step": 0,
      "required": true
    },
    {
      "id": "email",
      "label": "E-mail",
      "type": "email",
      "step": 0,
      "required": false
    },
    {
      "id": "phone",
      "label": "Telefon",
      "type": "tel",
      "step": 0,
      "required": false
    },
    {
      "id": "address",
      "label": "Adresa",
      "type": "text",
      "step": 0,
      "required": false
    },
    {
      "id": "bankAccount",
      "label": "Účet, ze kterého budou odcházet peníze (číslo/kód banky nebo IBAN)",
      "type": "text",
      "step": 0,
      "required": true
    },
    {
      "id": "accountOwner",
      "label": "Komu tento účet patří?",
      "type": "text",
      "step": 0,
      "required": true
    },
    {
      "id": "taxCountry",
      "label": "Ve které zemi platíte daně?",
      "type": "text",
      "step": 0,
      "required": false
    },
    {
      "id": "sourceMoney",
      "label": "Odkud jsou peníze k investování?",
      "type": "select",
      "step": 0,
      "required": false,
      "options": [
        [
          "0",
          "Z výplaty / podnikání"
        ],
        [
          "1",
          "Z prodeje majetku"
        ],
        [
          "2",
          "Z dědictví / daru"
        ],
        [
          "3",
          "Z předchozích investic"
        ],
        [
          "4",
          "Jiný zdroj – doplním níže"
        ],
        [
          "5",
          "Chci probrat osobně"
        ]
      ]
    },
    {
      "id": "sourceDetails",
      "label": "Další informace k původu peněz",
      "type": "textarea",
      "step": 0,
      "required": false
    },
    {
      "id": "goal",
      "label": "Na co mají peníze jednou sloužit?",
      "type": "textarea",
      "step": 1,
      "required": true
    },
    {
      "id": "oneOff",
      "label": "Kolik chcete vložit jednorázově? (Kč, 0 = nic)",
      "type": "number",
      "step": 1,
      "required": false
    },
    {
      "id": "monthly",
      "label": "Kolik chcete posílat každý měsíc? (Kč, 0 = nic)",
      "type": "number",
      "step": 1,
      "required": false
    },
    {
      "id": "horizon",
      "label": "Kdy budete peníze nejdříve potřebovat?",
      "type": "select",
      "step": 1,
      "required": true,
      "options": [
        [
          "0",
          "Do 1 roku"
        ],
        [
          "1",
          "Za 1–3 roky"
        ],
        [
          "2",
          "Za 3–5 let"
        ],
        [
          "3",
          "Za 5–10 let"
        ],
        [
          "4",
          "Za více než 10 let"
        ],
        [
          "5",
          "Nevím – chci to probrat"
        ]
      ]
    },
    {
      "id": "targetAmount",
      "label": "Kolik byste chtěli mít v cíli? (Kč)",
      "type": "number",
      "step": 1,
      "required": false
    },
    {
      "id": "expectedReturn",
      "label": "Jaký výsledek by Vám dával smysl? Např. částka v cíli nebo roční výnos. Je to přání, ne slib.",
      "type": "textarea",
      "step": 1,
      "required": false
    },
    {
      "id": "liquidity",
      "label": "Kdyby bylo potřeba peníze vybrat, jak dlouho můžete čekat?",
      "type": "select",
      "step": 1,
      "required": true,
      "options": [
        [
          "0",
          "Několik dnů"
        ],
        [
          "1",
          "Do měsíce"
        ],
        [
          "2",
          "Několik měsíců"
        ],
        [
          "3",
          "Rok i déle"
        ],
        [
          "4",
          "Nevím"
        ]
      ]
    },
    {
      "id": "plannedCosts",
      "label": "Čeká Vás větší výdaj? Kdy a přibližně kolik?",
      "type": "textarea",
      "step": 1,
      "required": false
    },
    {
      "id": "income",
      "label": "Kolik Vám měsíčně přichází po odečtení daní? (Kč)",
      "type": "number",
      "step": 2,
      "required": false
    },
    {
      "id": "incomeSource",
      "label": "Z čeho máte pravidelný příjem?",
      "type": "textarea",
      "step": 2,
      "required": false
    },
    {
      "id": "incomeStable",
      "label": "Jak jistý je Váš příjem v příštích letech?",
      "type": "select",
      "step": 2,
      "required": true,
      "options": [
        [
          "0",
          "Spíše stabilní"
        ],
        [
          "1",
          "Mění se měsíc od měsíce"
        ],
        [
          "2",
          "Čekám pokles / odchod do důchodu"
        ],
        [
          "3",
          "Nemám pravidelný příjem"
        ],
        [
          "4",
          "Nevím"
        ]
      ]
    },
    {
      "id": "expenses",
      "label": "Kolik měsíčně vydáte včetně všech splátek? (Kč)",
      "type": "number",
      "step": 2,
      "required": false
    },
    {
      "id": "reserve",
      "label": "Kolik zůstane na účtu jako rychle dostupná rezerva PO této investici? (Kč)",
      "type": "number",
      "step": 2,
      "required": false
    },
    {
      "id": "propertyValue",
      "label": "Odhad ceny Vašich nemovitostí (Kč)",
      "type": "number",
      "step": 2,
      "required": false
    },
    {
      "id": "otherInvestments",
      "label": "Hodnota již vlastněných investic (Kč)",
      "type": "number",
      "step": 2,
      "required": false
    },
    {
      "id": "otherAssets",
      "label": "Další majetek a jeho přibližná hodnota",
      "type": "textarea",
      "step": 2,
      "required": false
    },
    {
      "id": "debts",
      "label": "Kolik celkem ještě dlužíte? (Kč)",
      "type": "number",
      "step": 2,
      "required": false
    },
    {
      "id": "dependents",
      "label": "Koho finančně podporujete?",
      "type": "textarea",
      "step": 2,
      "required": false
    },
    {
      "id": "lossCapacity",
      "label": "Kdybyste o část investice přišli natrvalo, ohrozí to bydlení, splátky nebo rodinné výdaje?",
      "type": "select",
      "step": 2,
      "required": true,
      "options": [
        [
          "0",
          "Ano, i malá ztráta by byla problém"
        ],
        [
          "1",
          "Menší ztrátu zvládnu, větší by byla problém"
        ],
        [
          "2",
          "Ztrátu této částky zvládnu bez omezení základních potřeb"
        ],
        [
          "3",
          "Nevím – potřebuji to spočítat"
        ]
      ]
    },
    {
      "id": "maxLoss",
      "label": "Jakou trvalou ztrátu ještě finančně zvládnete? (Kč, volitelné)",
      "type": "number",
      "step": 2,
      "required": false
    },
    {
      "id": "reaction",
      "label": "Ze 100 000 Kč je dočasně 80 000 Kč. Co byste nejspíš udělali?",
      "type": "select",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Chtěl/a bych vše prodat"
        ],
        [
          "1",
          "Chtěl/a bych část vybrat"
        ],
        [
          "2",
          "Nejdřív bych to probral/a s poradcem"
        ],
        [
          "3",
          "Počkal/a bych, pokud se můj plán nezměnil"
        ],
        [
          "4",
          "Zvažoval/a bych další nákup"
        ],
        [
          "5",
          "Nevím"
        ]
      ]
    },
    {
      "id": "tolerance",
      "label": "Jak velký dočasný pokles by pro Vás byl ještě přijatelný?",
      "type": "select",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Žádný – potřebuji jistotu"
        ],
        [
          "1",
          "Asi 5 % (100 000 → 95 000 Kč)"
        ],
        [
          "2",
          "Asi 10 % (100 000 → 90 000 Kč)"
        ],
        [
          "3",
          "Asi 20 % (100 000 → 80 000 Kč)"
        ],
        [
          "4",
          "I více než 20 %"
        ],
        [
          "5",
          "Nevím"
        ]
      ]
    },
    {
      "id": "experience",
      "label": "S čím už máte osobní zkušenost?",
      "type": "checks",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Zatím s ničím"
        ],
        [
          "1",
          "Spořicí účet / termínovaný vklad"
        ],
        [
          "2",
          "Podílové fondy / ETF"
        ],
        [
          "3",
          "Akcie"
        ],
        [
          "4",
          "Dluhopisy"
        ],
        [
          "5",
          "FKI"
        ],
        [
          "6",
          "Složitější produkty / deriváty"
        ]
      ]
    },
    {
      "id": "experienceDetails",
      "label": "U použitých produktů: jak dlouho, kolik nákupů za poslední 3 roky a přibližně za kolik?",
      "type": "textarea",
      "step": 3,
      "required": false
    },
    {
      "id": "education",
      "label": "Pomohlo Vám s investicemi studium, kurz nebo práce? Jak?",
      "type": "textarea",
      "step": 3,
      "required": false
    },
    {
      "id": "knowledgeLoss",
      "label": "Může běžná investice ztratit část hodnoty?",
      "type": "select",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Ano"
        ],
        [
          "1",
          "Ne"
        ],
        [
          "2",
          "Nevím"
        ]
      ]
    },
    {
      "id": "knowledgeSpread",
      "label": "Co obvykle znamená dát všechny peníze do jedné firmy?",
      "type": "select",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Větší závislost na výsledku jediné firmy"
        ],
        [
          "1",
          "Jistější výnos než u více různých firem"
        ],
        [
          "2",
          "Nevím"
        ]
      ]
    },
    {
      "id": "knowledgeCurrency",
      "label": "Investice je v eurech, ale utrácíte koruny. Může změna kurzu ovlivnit výsledek v korunách?",
      "type": "select",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Ano"
        ],
        [
          "1",
          "Ne"
        ],
        [
          "2",
          "Nevím"
        ]
      ]
    },
    {
      "id": "knowledgeExit",
      "label": "Může nastat situace, kdy fond peníze nevyplatí hned?",
      "type": "select",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Ano"
        ],
        [
          "1",
          "Ne"
        ],
        [
          "2",
          "Nevím"
        ]
      ]
    },
    {
      "id": "sustainability",
      "label": "Záleží Vám také na dopadu investic na přírodu nebo lidi?",
      "type": "select",
      "step": 3,
      "required": true,
      "options": [
        [
          "0",
          "Ne, nemám zvláštní preference"
        ],
        [
          "1",
          "Ano – chci možnosti probrat"
        ],
        [
          "2",
          "Nevím, potřebuji vysvětlení"
        ]
      ]
    },
    {
      "id": "sustainabilityDetails",
      "label": "Co je pro Vás důležité a čemu se chcete vyhnout?",
      "type": "textarea",
      "step": 3,
      "required": false
    },
    {
      "id": "notes",
      "label": "Co dalšího máme vědět?",
      "type": "textarea",
      "step": 3,
      "required": false
    }
  ]
};
