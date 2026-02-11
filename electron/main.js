const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
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
const { initGitSync } = require('./playlistService');
const workspaceService = require('./workspaceService');
const trafficService = require('./trafficService');
const authService = require('./authService');
const isDev = process.env.USE_DEV_SERVER === '1';
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
    backgroundColor: '#f5f5f5',
    autoHideMenuBar: true,
    ...(iconPath && { icon: iconPath }),
    title: 'AumovioTVApp',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
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

app.whenReady().then(() => {
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

  createWindow(getBaseUrl());

  // Git pull la 30 min → trimite 'playlist-updated' → view reîncarcă playlist + toate secțiunile
  initGitSync(() => {
    if (mainWindow) mainWindow.webContents.send('playlist-updated');
  });
  // Fallback: refresh conținut din disk la 1h chiar dacă git pull lipsește sau eșuează
  setInterval(() => {
    if (mainWindow) mainWindow.webContents.send('playlist-updated');
  }, 60 * 60 * 1000);

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
