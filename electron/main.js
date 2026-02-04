const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initGitSync, readPlaylist } = require('./playlistService');

const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#050816',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Initialize git sync service (5 min pull) once the app is ready
  initGitSync(() => {
    if (mainWindow) {
      // Notify renderer that playlist (and assets) might have changed
      mainWindow.webContents.send('playlist-updated');
    }
  });

  // IPC: renderer asking for playlist
  ipcMain.handle('get-playlist', async () => {
    const playlist = await readPlaylist();
    return playlist;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

