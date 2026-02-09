WORKSPACE – conținut per echipă pentru Digital Signage

Fiecare subdirector = o echipă (ex: BSW, CAIRs, ESB).
La prima pornire a aplicației se alege echipa pentru TV; selecția se salvează.

În fiecare director de echipă:
  - playlist.json   = ce se afișează pe TV (liste de slide-uri)
  - ppt/            = prezentări PowerPoint
  - word/           = documente Word
  - excel/          = fișiere Excel
  - photos/         = imagini (referențiate în playlist.json cu src "photos/nume.jpg")

Exemplu playlist.json:
  {
    "slides": [
      { "id": "1", "type": "image", "src": "photos/echipa.jpg", "duration": 10, "title": "Echipa", "subtitle": "" },
      { "id": "2", "type": "web_url", "src": "https://...", "duration": 15, "title": "...", "subtitle": "..." }
    ]
  }

Căile din "src" sunt relative la directorul echipei (ex: photos/1.jpg, ppt/prez.pptx).
Conținutul se reîmprospătează la pull Git și o dată pe oră.
