## Digital Signage App (Electron + Vite + React)

A digital signage application intended for a mini PC connected to a TV.

- **Electron** main process handles:
  - Reading `playlist.json` from the local filesystem
  - Periodically syncing a Git repository (assets + JSON) via `simple-git`
- **Renderer (React + Vite + Tailwind)**:
  - Requests playlist data from the main process via secure IPC
  - Displays a full-screen loop of slides (`image`, `video`, `web_url`) with per-slide durations
  - Smooth fade transitions between slides in a dark-themed UI

---

### 1. Prerequisites

- Node.js (LTS recommended)
- Git installed and on your `PATH`

---

### 2. Install Dependencies

From the project root (`D:\\Projects\\2026\\TV_App`):

```bash
npm install
```

This installs:

- Electron
- Vite + React
- Tailwind / PostCSS
- simple-git
- dev helpers (`concurrently`, `wait-on`)

---

### 3. Set Up the Content Git Repository

1. Inside the project root, create a `content` folder that will be a Git clone of your signage assets repo:

   ```bash
   cd D:\Projects\2026\TV_App
   git clone https://your.git.server/your-signage-repo.git content
   ```

2. Ensure the cloned repo contains:

   - `playlist.json` at the root of the `content` folder
   - Assets (images, videos, etc.) referenced by `playlist.json`

   Example structure:

   ```text
   TV_App/
     content/        # <- Git repo
       .git/
       playlist.json
       assets/
         welcome.jpg
         promo.mp4
         ...
   ```

3. The app expects `content/playlist.json` with structure:

   ```json
   {
     "slides": [
       {
         "id": "slide-1",
         "type": "image",
         "src": "./content/assets/welcome.jpg",
         "duration": 10,
         "title": "Welcome",
         "subtitle": "Subtext"
       }
     ]
   }
   ```

   - `type`: `"image" | "video" | "web_url"`
   - `src`: path to the asset (for image/video) or URL (for web_url)
   - `duration`: duration **in seconds** the slide should show
   - `title` / `subtitle`: optional text overlays

---

### 4. How Git Sync Works (pull → WORKSPACE → view)

- Repo-ul Git este **rădăcina proiectului** (același folder ca aplicația .exe); **WORKSPACE** este în acest repo (ex. `WORKSPACE/<team>/playlist.json`, secțiuni, etc.).
- **Dashboard-ul** face push la Git cu modificările (playlist, secțiuni). Aplicația **.exe pe TV**:
  1. Face **pull** la repo (înainte de fiecare refresh al view-ului).
  2. După pull, citește **din WORKSPACE** (playlist + toate secțiunile).
  3. Trimite **playlist-updated** către view; view-ul reîncarcă datele din main process (care le-a citit din WORKSPACE).
- La pornire: se face un **pull** la repo, apoi se deschide fereastra (prima afișare e deja cu datele proaspăt după pull).
- La fiecare **15 minute**: **pull** → apoi **playlist-updated** → view reîncarcă playlist + secțiuni din WORKSPACE.
- La **1 oră**: din nou pull apoi refresh view (fallback).

Rezumat: **dashboard push → TV pull → TV citește din WORKSPACE → view se actualizează.** Conținutul afișat vine întotdeauna din WORKSPACE (repo), după ce s-a făcut pull.

> Note: Repo-ul trebuie să fie deja un clone Git cu remote configurat. Aplicația nu face clone-ul inițial.

---

### 4b. Restaurant of the Day (optional)

The app can recommend a **Restaurant of the Day** per team using **Google Places API** (reviews, price level, quality). It runs **once per 24 hours** (around 00:05–00:25) and updates `WORKSPACE/<team>/canteen_menu/content.json` with a chosen restaurant; the last **20** selections are kept so the same restaurant is not repeated for 20 days. On multiple TVs sharing the same Git repo, whichever instance runs first after midnight updates the file and pushes; the others see `restaurantLastUpdated` and skip.

- In the **dashboard**, set only **Location** (e.g. `Sibiu`) for the Canteen menu section; name and description are filled by the algorithm.
- Folosește **aceeași cheie** ca pentru Traffic/Locations: `GOOGLE_MAPS_API_KEY` din `.env`. În Google Cloud activează și **Places API** (vezi mai jos).
- History is stored in `WORKSPACE/<team>/canteen_menu/restaurant_history.json`.

**Google Cloud:** activează **Places API** (nu doar Maps/Distance Matrix): [APIs & Services → Library](https://console.cloud.google.com/apis/library) → caută „Places API” → Enable. Aceeași cheie (API key) poate fi folosită pentru Maps, Distance Matrix și Places.

**Preț:** Google oferă un **credit lunar gratuit** (circa 200 USD/lună) pentru Maps Platform. Pentru câteva request-uri la 5 minute (Text Search + Place Details), consumul rămâne de obicei în creditul gratuit. După ce creditul e epuizat, se facturează per request (vezi [Places API – Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)).

**Sincronizare pe mai multe TV-uri (același departament):** Toate TV-urile folosesc același repo Git (pull la 15 min). Restaurant of the Day rulează **o dată pe 24h** (în jur de 00:05–00:25, cu random). Fiecare TV:

1. Face **pull** la ora programată.
2. Verifică în `content.json` câmpul **`restaurantLastUpdated`**: dacă e data zilei de azi → nu face nimic (alt TV a făcut deja update-ul).
3. Dacă nu e setat pentru azi → acest TV apelează API-ul, scrie restaurantul și **face push** în Git. Celelalte TV-uri vor vedea la următorul pull același restaurant.

Nu e nevoie de variabile de mediu: orice TV poate fi cel care face update-ul; detecția e automată după dată. Asigură-te că toate au acces la **push** în același repo (credentiale Git configurate).

---

### 4c. Versionare și update automat

- În rădăcina proiectului există **`version.json`** cu câmpul `version` (ex. `"1.0.0"`).
- Aplicația face **pull** la fiecare **30 minute** și compară versiunea din `version.json` cu cea la care a pornit.
- **Dacă versiunea s-a schimbat**:
  - **Implicit**: aplicația folosește **GitHub Releases** (același repo: `patrutioan211/TVApp_Electron`) – descarcă noul installer de acolo și repornește. **Nu trebuie să setezi `UPDATE_FEED_URL`** pe TV-uri.
  - Dacă în `.env` e setat **`UPDATE_FEED_URL`**, se folosește acel server (generic) în loc de GitHub.

**Cum folosești update-ul (cu GitHub):**

1. Actualizezi versiunea: în **`version.json`** și **`package.json`** pui aceeași versiune (ex. `"1.0.1"`).
2. Build: `npm run dist:win`. În **`release/`** apar installer-ul (exe) și **`latest.yml`**.
3. Publicare pe GitHub:
   - **Cu GitHub CLI (gh):** `npm run release:github` (creează release-ul și uploadează exe + latest.yml). Necesită [gh](https://cli.github.com/) instalat și `gh auth login`.
   - **Manual:** pe [Releases · TVApp_Electron](https://github.com/patrutioan211/TVApp_Electron/releases) → New release → tag `v1.0.1`, uploadezi fișierele din `release/` (exe + `latest.yml`).
4. Push cod: `git add version.json package.json` → `git commit -m "Release v1.0.1"` → `git push`.
5. Pe TV-uri: în maxim **30 de minute** fiecare instanță face pull, vede noua versiune, descarcă installer-ul de pe GitHub Releases și se repornește.

Pe TV-uri **nu** e nevoie de `UPDATE_FEED_URL` dacă folosești GitHub. Pentru un server propriu, pune în `.env`: `UPDATE_FEED_URL=https://your-server.com/path-to-releases`.

---

### 5. Running the App in Development

From the project root:

```bash
npm run dev
```

This will:

1. Start the Vite dev server at `http://localhost:5173`.
2. Once the dev server is ready, start Electron and load that URL.

For convenience:

- Edit React code under `src/` – it will hot-reload.
- Edit `playlist.json` or commit/push/pull changes in the `content` repo.
- The main process will automatically pull changes every 5 minutes and notify the renderer.

To run Electron against the last built frontend (without dev server):

```bash
npm run build
npm start
```

---

### 6. Security / IPC Design

- `BrowserWindow` is created with:
  - `contextIsolation: true`
  - `nodeIntegration: false`
- A `preload.js` script exposes a **minimal API** on `window.api`:
  - `getPlaylist()` – async function to fetch playlist data from `playlist.json`.
  - `onPlaylistUpdated(callback)` – subscribe to playlist updates (fires after git pulls).
- The renderer cannot access Node APIs directly; all filesystem and Git access happens in `electron/playlistService.js`.

---

### 7. Slideshow Behavior

- Slides are displayed full-screen (`image`, `video`, or `web_url` via `<iframe>`).
- Each slide's `duration` (seconds) is respected using a timer.
- Transition:
  - Fade-out (`~0.7s`) -> switch slide -> fade-in.
- Videos:
  - Use `autoPlay`, `muted`, `loop` attributes.
  - Because the `key` of the video element uses `src`, the video restarts when re-entering a slide with the same source.
- Web URLs (including Power BI):
  - Rendered in an `<iframe>` filling the entire window.

---

### 8. Customization

- **Tailwind Theme**:
  - Configured in `tailwind.config.cjs` with a dark palette.
  - Adjust `colors.background`, `colors.surface`, `colors.accent` to match your branding.

- **Overlay UI**:
  - Slide titles/subtitles are rendered as a gradient overlay at the bottom of the screen.
  - You can disable or restyle this in `src/components/Slide.jsx`.

- **Timers**:
  - Default duration if not supplied is 10 seconds.
  - Modify logic in `src/components/SlidePlayer.jsx` if you need more complex scheduling.

---

### 9. Packaging și update

- **Build instalabil (Windows x64):**
  ```bash
  npm run dist:win
  ```
  Output în `release/` (exe NSIS + `latest.yml`).

- **Update feed**: implicit aplicația verifică **GitHub Releases** (repo `patrutioan211/TVApp_Electron`). Nu e nevoie de `.env` pe TV-uri. După build, publică release-ul cu:
  ```bash
  npm run release:github
  ```
  (necesită [GitHub CLI](https://cli.github.com/) instalat și autentificat). Sau creezi release-ul manual pe GitHub și uploadezi exe + `latest.yml` din `release/`. Opțional, pentru server propriu: `UPDATE_FEED_URL=https://...` în `.env`.

---

### 10. Troubleshooting

- **Blank Screen**:
  - Check DevTools (`Ctrl+Shift+I` in dev mode) for console errors.
  - Ensure `playlist.json` is valid JSON and has a `slides` array.

- **Git Errors in Console**:
  - Verify that `content` is a valid Git repo with a remote.
  - Ensure the machine can reach your Git server and has correct credentials.

- **Assets Not Showing**:
  - Confirm the `src` paths are correct relative to where Electron loads files.
  - For local files, you may use relative paths like `./content/assets/image.jpg` or `file:///C:/...` absolute paths.
  - For web content, include full URLs (`https://...`).

---

Happy signage!

