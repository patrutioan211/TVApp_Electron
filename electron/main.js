const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs').promises;
const { initGitSync } = require('./playlistService');
const workspaceService = require('./workspaceService');

const isDev = process.env.USE_DEV_SERVER === '1';
const DIST_PATH = path.resolve(__dirname, '..', 'dist');

if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, supportFetchAPI: true } },
    { scheme: 'workspace', privileges: { standard: true, supportFetchAPI: true } }
  ]);
}

let mainWindow = null;

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

  mainWindow.loadURL(loadUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle('app', (request) => {
      let p = request.url.slice('app://'.length).replace(/^\/+/, '').replace(/^\.\/?/, '') || 'index.html';
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

  const loadUrl = isDev ? 'http://localhost:5174' : 'app://./index.html';
  createWindow(loadUrl);

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
  ipcMain.handle('quit-app', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(isDev ? 'http://localhost:5174' : 'app://./index.html');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
