const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');

// Suprimă warning-ul "Bad value, for custom key AAPL:Keywords" (metadate macOS, inofensiv pe Windows)
const origEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (name === 'warning' && data && typeof data.message === 'string' && data.message.includes('AAPL:Keywords')) {
    return false;
  }
  return origEmit.apply(this, [name, data, ...args]);
};

// Aplicat înainte de orice
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Evită eroarea "GPU state invalid after WaitForGetOffsetInRange" (Chromium/Windows)
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { Readable } = require('stream');
const { initGitSync, doGitSync } = require('./playlistService');
const workspaceService = require('./workspaceService');
const trafficService = require('./trafficService');
const authService = require('./authService');
const restaurantRecommendation = require('./restaurantRecommendationService');
const canteenMenuPdf = require('./canteenMenuPdfService');
const { autoUpdater } = require('electron-updater');
const isDev = process.env.USE_DEV_SERVER === '1';
const UPDATE_FEED_URL = process.env.UPDATE_FEED_URL || '';
const DIST_PATH = path.resolve(__dirname, '..', 'dist');

app.setName('AumovioTVApp');

// Scheme-uri înregistrate și în dev ca workspace:// să funcționeze (inclusiv video)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, supportFetchAPI: true } },
  { scheme: 'workspace', privileges: { standard: true, supportFetchAPI: true, stream: true } }
]);

let mainWindow = null;

function getBaseUrl() {
  return isDev ? 'http://localhost:5174' : 'app://./index.html';
}

function createAdminWindow() {
  const url = getBaseUrl() + '#/admin';
  const adminIconPath = getAppIconPath();
  const adminWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
    ...(adminIconPath && { icon: adminIconPath }),
    title: 'AumovioTVApp',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  adminWindow.loadURL(url);
}

function getAppIconPath() {
  const isWin = process.platform === 'win32';
  const candidates = isWin
    ? [
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'icons', 'icon.ico'),
        path.join(__dirname, '..', 'public', 'icon.ico'),
        path.join(__dirname, 'icon.png'),
        path.join(__dirname, '..', 'public', 'icon.png')
      ]
    : [
        path.join(__dirname, 'icon.png'),
        path.join(__dirname, 'icons', 'icon.png'),
        path.join(__dirname, '..', 'public', 'icon.png')
      ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function createWindow(loadUrl) {
  const iconPath = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    frame: false,
    backgroundColor: '#f5f5f5',
    autoHideMenuBar: true,
    ...(iconPath && { icon: iconPath }),
    title: 'AumovioTVApp',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  // Allow iframe to load sites that send X-Frame-Options / CSP (aumovio etc.)
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    {
      urls: ['https://www.aumovio.com/*', 'https://aumovio.com/*']
    },
    (details, callback) => {
      const h = details.responseHeaders || {};
      const lower = (k) => Object.keys(h).find((x) => x.toLowerCase() === k.toLowerCase());
      ['x-frame-options', 'content-security-policy'].forEach((name) => {
        const key = lower(name);
        if (key) delete h[key];
      });
      callback({ cancel: false, responseHeaders: h });
    }
  );

  mainWindow.loadURL(loadUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    protocol.handle('app', (request) => {
      let p = request.url.slice('app://'.length).replace(/#.*$/, '').replace(/^\/+/, '').replace(/^\.\/?/, '') || 'index.html';
      const filePath = path.resolve(DIST_PATH, p);
      if (!filePath.startsWith(DIST_PATH)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(filePath).href);
    });
  }

  // Protocol workspace:// – fișiere din WORKSPACE/<echipa selectată> (cu Content-Type + Range pentru video)
  const MIME_BY_EXT = {
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
    '.pdf': 'application/pdf'
  };
  protocol.handle('workspace', async (request) => {
    const raw = request.url.slice('workspace://'.length).replace(/^\/+/, '').replace(/^\.\/?/, '').replace(/#.*$/, '');
    const decoded = decodeURIComponent(raw);
    const filePath = await workspaceService.getWorkspaceFilePath(decoded);
    if (!filePath) return new Response('Not found', { status: 404 });
    try {
      await fsPromises.access(filePath);
    } catch {
      return new Response('Not found', { status: 404 });
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';
    const stat = await fsPromises.stat(filePath);
    const size = stat.size;
    const rangeHeader = request.headers.get('range');
    if (rangeHeader && ext in MIME_BY_EXT && contentType.startsWith('video/')) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        let start = parseInt(match[1], 10) || 0;
        let end = match[2] ? parseInt(match[2], 10) : size - 1;
        if (end >= size) end = size - 1;
        if (start > end) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        }
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        const webStream = Readable.toWeb(stream);
        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes'
          }
        });
      }
    }
    const stream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(stream);
    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    });
  });

  // Pull la repo (inclusiv WORKSPACE) înainte de prima afișare – view-ul citește apoi din WORKSPACE
  await doGitSync();

  createWindow(getBaseUrl());

  // La 15 min: pull apoi 'playlist-updated' → view reîncarcă playlist + secțiuni din WORKSPACE (dashboard push → TV pull → view refresh)
  initGitSync(() => {
    if (mainWindow) mainWindow.webContents.send('playlist-updated');
  });
  // La 1h: pull apoi refresh view (fallback)
  setInterval(async () => {
    await doGitSync();
    if (mainWindow) mainWindow.webContents.send('playlist-updated');
  }, 60 * 60 * 1000);

  // Versionare + update: la 30 min pull și verificăm version.json; dacă s-a schimbat, verificăm update (electron-updater) sau repornim
  const VERSION_FILE = path.join(__dirname, '..', 'version.json');
  let currentAppVersion = '1.0.0';
  try {
    const raw = fs.readFileSync(VERSION_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (data && typeof data.version === 'string') currentAppVersion = data.version.trim();
  } catch (e) {
    console.warn('[Version] Could not read version at startup:', e.message);
  }

  if (!isDev && UPDATE_FEED_URL) {
    autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL.replace(/\/$/, '') });
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info) => {
      console.log('[Update] Update available:', info.version);
    });
    autoUpdater.on('update-downloaded', () => {
      console.log('[Update] Update downloaded. Installing and restarting.');
      autoUpdater.quitAndInstall(false, true);
    });
    autoUpdater.on('error', (err) => {
      console.warn('[Update] Error:', err.message);
    });
  }

  setInterval(async () => {
    if (isDev) return;
    try {
      await doGitSync();
      const raw = fs.readFileSync(VERSION_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const newVersion = data && typeof data.version === 'string' ? data.version.trim() : null;
      if (!newVersion || newVersion === currentAppVersion) return;
      console.log('[Version] Detected new version', newVersion, '(current', currentAppVersion + ').');
      if (UPDATE_FEED_URL) {
        autoUpdater.checkForUpdates().catch((e) => {
          console.warn('[Update] checkForUpdates failed:', e.message);
          app.relaunch();
          app.exit(0);
        });
      } else {
        app.relaunch();
        app.exit(0);
      }
    } catch (e) {
      console.warn('[Version] Check failed:', e.message);
    }
  }, 30 * 60 * 1000);

  // Restaurant of the Day: o dată pe 24h (00:05 + random 0–20 min). Pull → dacă nu e setat azi, acest TV face API + push; restul la pull văd data și nu mai rulează
  function runRestaurantOncePerDay() {
    restaurantRecommendation
      .runOncePerDayIfNeeded()
      .then((results) => {
        const anyUpdated = Array.isArray(results) && results.some((r) => r && r.updated === true);
        if (anyUpdated && mainWindow) mainWindow.webContents.send('playlist-updated');
      })
      .catch((err) => {
        console.error('[RestaurantRecommendation]', err);
      });
  }
  function scheduleNextRestaurantRun() {
    const now = new Date();
    let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 5, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const randomMs = Math.floor(Math.random() * 20 * 60 * 1000);
    const ms = (next.getTime() - now.getTime()) + randomMs;
    setTimeout(() => {
      runRestaurantOncePerDay();
      scheduleNextRestaurantRun();
    }, Math.max(0, ms));
  }
  setTimeout(runRestaurantOncePerDay, 60 * 1000);
  scheduleNextRestaurantRun();

  // Canteen menu PDF: la orele din slots, clean + download PDF(s) + convert to images, apoi show popup
  let lastCanteenSlotKey = '';
  function parseDurationMinutes(str) {
    if (typeof str === 'number' && !Number.isNaN(str)) return Math.max(1, Math.min(120, str));
    if (!str || typeof str !== 'string') return 15;
    const num = parseInt(String(str).replace(/\D/g, ''), 10);
    return Number.isNaN(num) || num < 1 ? 15 : num;
  }
  /** Parse slot time: "10:30", "10:30 AM", "2:30 PM", "14:30" → { hour24, minute } or null. */
  function parseSlotTime(timeStr) {
    const s = (timeStr || '').trim();
    if (!s) return null;
    const upper = s.toUpperCase();
    const isAm = upper.endsWith(' AM');
    const isPm = upper.endsWith(' PM');
    let numPart = s;
    if (isAm || isPm) numPart = s.slice(0, -3).trim();
    const colon = numPart.indexOf(':');
    const hStr = colon >= 0 ? numPart.slice(0, colon).trim() : numPart;
    const mStr = colon >= 0 ? numPart.slice(colon + 1).trim().replace(/\D/g, '').slice(0, 2) : '0';
    let h = parseInt(hStr.replace(/\D/g, ''), 10);
    const m = parseInt(mStr, 10) || 0;
    if (Number.isNaN(h)) return null;
    if (isAm) {
      if (h === 12) h = 0;
    } else if (isPm) {
      if (h !== 12) h += 12;
    }
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { hour24: h, minute: m };
  }
  function getSlotKey(date, timeStr) {
    const parsed = parseSlotTime(timeStr);
    if (!parsed) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}_${parsed.hour24}_${parsed.minute}`;
  }
  function isTimeMatch(slotTime, now) {
    const parsed = parseSlotTime(slotTime);
    if (!parsed) return false;
    return now.getHours() === parsed.hour24 && now.getMinutes() === parsed.minute;
  }
  function tickCanteenMenuSlots() {
    if (!mainWindow) return;
    workspaceService.getSelectedTeam().then((team) => {
      if (!team) return;
      workspaceService.getSectionContent(team, 'canteen_menu').then((content) => {
        const slots = (content && content.slots && Array.isArray(content.slots)) ? content.slots : [];
        let menuPdfItems = (content && content.menuPdfItems && Array.isArray(content.menuPdfItems))
          ? content.menuPdfItems.filter((it) => it && typeof it.url === 'string' && it.url.trim())
          : [];
        if (menuPdfItems.length === 0 && content && content.menuPdfUrls && Array.isArray(content.menuPdfUrls)) {
          const urls = content.menuPdfUrls.filter((u) => typeof u === 'string' && u.trim());
          menuPdfItems = urls.map((url) => ({ url: url.trim(), range: 'all' }));
        }
        if (menuPdfItems.length === 0) return;
        const now = new Date();
        for (const slot of slots) {
          const slotTime = slot && slot.time ? slot.time : null;
          if (!slotTime || !isTimeMatch(slotTime, now)) continue;
          const slotKey = getSlotKey(now, slotTime);
          if (slotKey === lastCanteenSlotKey) continue;
          lastCanteenSlotKey = slotKey;
          const durationMinutes = parseDurationMinutes(slot.duration);
          canteenMenuPdf.runCanteenMenuRefresh(team, menuPdfItems).then((result) => {
            if (result.ok) {
              mainWindow.webContents.send('canteen-menu-show', {
                durationMinutes,
                slotTime
              });
            } else {
              mainWindow.webContents.send('canteen-menu-load-failed', {
                error: result.error || 'Failed to load menu PDF'
              });
            }
          }).catch((err) => {
            console.error('[CanteenMenuPdf]', err);
            mainWindow.webContents.send('canteen-menu-load-failed', {
              error: err.message || 'Failed to load menu PDF'
            });
          });
          break;
        }
      });
    });
  }
  setInterval(tickCanteenMenuSlots, 60 * 1000);
  setTimeout(tickCanteenMenuSlots, 5 * 1000);

  // IPC: echipe și playlist din WORKSPACE
  ipcMain.handle('get-teams', () => workspaceService.getTeams());
  ipcMain.handle('get-selected-team', () => workspaceService.getSelectedTeam());
  ipcMain.handle('set-selected-team', (_, team) => workspaceService.setSelectedTeam(team));
  ipcMain.handle('get-playlist', async () => {
    const team = await workspaceService.getSelectedTeam();
    return workspaceService.getPlaylistForTeam(team);
  });
  ipcMain.handle('get-playlist-for-team', (_, team) => workspaceService.getPlaylistForTeam(team));
  ipcMain.handle('get-traffic-data', () => trafficService.getTrafficData());
  ipcMain.handle('get-section-content', (_, team, sectionId) => workspaceService.getSectionContent(team, sectionId));
  ipcMain.handle('get-all-sections-content', (_, team) => workspaceService.getAllSectionsContent(team));
  ipcMain.handle('get-workspace-folder-images', (_, relativePath) =>
    workspaceService.getWorkspaceFolderImages(relativePath)
  );
  // Uptime: check if page URL exists and returns content (no CORS in main process)
  ipcMain.handle('check-uptime-url', async (_, url) => {
    if (!url || typeof url !== 'string') return { ok: false };
    const u = url.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) return { ok: false };
    try {
      const res = await fetch(u, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'AumovioTV-UptimeCheck/1.0' }
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  });
  ipcMain.handle('quit-app', () => app.quit());
  ipcMain.handle('open-admin-window', () => createAdminWindow());
  ipcMain.handle('auth-register', (_, email, password) => authService.register(email, password));
  ipcMain.handle('auth-login', (_, email, password) => authService.login(email, password));
  ipcMain.handle('auth-check', (_, token) => authService.checkSession(token));
  ipcMain.handle('auth-logout', (_, token) => authService.logout(token));
  ipcMain.handle('auth-forgot-password', (_, email) => authService.forgotPassword(email));
  ipcMain.handle('auth-reset-password', (_, token, newPassword) => authService.resetPassword(token, newPassword));
  ipcMain.handle('admin-create-team', (_, name) => workspaceService.createTeam(name));
  ipcMain.handle('admin-delete-team', (_, name) => workspaceService.deleteTeam(name));
  ipcMain.handle('admin-save-playlist', (_, teamName, data) => workspaceService.savePlaylist(teamName, data));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(getBaseUrl());
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
