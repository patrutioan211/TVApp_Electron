require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs').promises;
const { initGitSync } = require('./playlistService');
const workspaceService = require('./workspaceService');
const trafficService = require('./trafficService');
const authService = require('./authService');
const isDev = process.env.USE_DEV_SERVER === '1';
const DIST_PATH = path.resolve(__dirname, '..', 'dist');

if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, supportFetchAPI: true } },
    { scheme: 'workspace', privileges: { standard: true, supportFetchAPI: true } }
  ]);
}

let mainWindow = null;

function getBaseUrl() {
  return isDev ? 'http://localhost:5174' : 'app://./index.html';
}

function createAdminWindow() {
  const url = getBaseUrl() + '#/admin';
  const adminWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  adminWindow.loadURL(url);
}

function createWindow(loadUrl) {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#f5f5f5',
    autoHideMenuBar: true,
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

  // Protocol workspace:// – fișiere din WORKSPACE/<echipa selectată>
  protocol.handle('workspace', async (request) => {
    const raw = request.url.slice('workspace://'.length).replace(/^\/+/, '').replace(/^\.\/?/, '');
    const filePath = await workspaceService.getWorkspaceFilePath(raw);
    if (!filePath) return new Response('Not found', { status: 404 });
    try {
      await fs.access(filePath);
      return net.fetch(pathToFileURL(filePath).href);
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow(getBaseUrl());

  // Git sync (5 min) + actualizare playlist o dată pe oră
  initGitSync(() => {
    if (mainWindow) mainWindow.webContents.send('playlist-updated');
  });
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
