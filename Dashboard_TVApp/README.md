# Dashboard TV App

Aplicație Python de administrare pentru **TV App** (Digital Signage). Actualizează directorul **WORKSPACE** (echipe și playlist-uri) în funcție de input. Poate fi rulată ca server web local sau împachetată ca `.exe` cu PyInstaller.

## Cerințe

- Python 3.10+ (recomandat 3.11+)

## Instalare și rulare

### 1. Creare mediu virtual (sandbox)

În directorul `Dashboard_TVApp`:

```powershell
python -m venv venv
.\venv\Scripts\activate
```

### 2. Instalare dependențe

```powershell
pip install -r requirements.txt
```

### 3. Configurare cale WORKSPACE

Copiază fișierul de exemplu și setează calea către directorul WORKSPACE al TV App:

```powershell
copy .env.example .env
```

Editează `.env`:

- Dacă `Dashboard_TVApp` este **în interiorul** proiectului TV_App: `WORKSPACE_PATH=../WORKSPACE`
- Dacă este **alături** de TV_App: `WORKSPACE_PATH=../TV_App/WORKSPACE`
- Sau cale absolută: `WORKSPACE_PATH=D:\Projects\2026\TV_App\WORKSPACE`

### 4. Pornire aplicație

```powershell
python app.py
```

Deschide în browser: **http://127.0.0.1:5000**

## Funcționalități

- **Echipe**: listare, creare (cu foldere `documents`, `photos`, `videos` și `playlist.json`), ștergere.
- **Playlist**: pentru fiecare echipă – vizualizare și editare slide-uri (tip, src, duration, title, subtitle). Tipuri: `image`, `video`, `web_url`, `pdf`, `pptx`, `word`, `excel`, `vimeo`, `hls`.

Modificările se scriu direct în directorul WORKSPACE; TV App (Electron) citește același WORKSPACE.

## Construire .exe (PyInstaller)

Pentru a obține un executabil Windows:

```powershell
pip install pyinstaller
pyinstaller --onefile --name "Dashboard_TVApp" --add-data "templates;templates" app.py
```

- `--onefile`: un singur fișier `.exe`
- `--add-data "templates;templates"`: include folderul `templates` în .exe (pe Windows separatorul este `;`)

După build, `.exe` se găsește în `dist/Dashboard_TVApp.exe`.

**Important**: la rularea din .exe, aplicația pornește din folderul în care se află `.exe`. Setează `WORKSPACE_PATH` în `.env` **în același folder** cu `.exe`, sau folosește cale absolută. Alternativ, poți citi calea din config sau din linia de comandă (ex. `Dashboard_TVApp.exe --workspace "D:\...\WORKSPACE"`).

## Structură proiect

```
Dashboard_TVApp/
  app.py              # Aplicația Flask
  requirements.txt
  .env.example
  .env                # (creat de tine) WORKSPACE_PATH=...
  templates/
    dashboard.html    # Pagina de administrare
  venv/               # (creat de tine) mediu virtual Python
```
