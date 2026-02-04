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

### 4. How Git Sync Works

- The **Electron main process** uses `simple-git` with base directory `content/`.
- On app start:
  - It runs an initial `git fetch` + `git pull`.
  - After each successful pull, it notifies the renderer via the `playlist-updated` IPC event.
- Every **5 minutes**, it repeats the sync process (`fetch` + `pull`) automatically.
- After a pull, the renderer:
  - Calls `getPlaylist` again via IPC.
  - Updates the slideshow with the latest `playlist.json` and assets.

> Note: The repo must already be a valid Git clone (with a remote configured). This app **does not** perform the initial clone for you.

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

### 9. Packaging (Optional)

This example includes only minimal scripts for development and running with built files.

If you want to package a distributable app:

1. Add `electron-builder` configuration in `package.json` or a dedicated config file.
2. Add a `build:electron` or `dist` script.
3. Follow `electron-builder` docs for app IDs, icons, and platform targets.

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

