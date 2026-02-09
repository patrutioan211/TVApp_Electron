const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPlaylist: () => ipcRenderer.invoke('get-playlist'),
  getTeams: () => ipcRenderer.invoke('get-teams'),
  getSelectedTeam: () => ipcRenderer.invoke('get-selected-team'),
  setSelectedTeam: (team) => ipcRenderer.invoke('set-selected-team', team),
  onPlaylistUpdated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('playlist-updated', listener);
    return () => ipcRenderer.removeListener('playlist-updated', listener);
  },
  quitApp: () => ipcRenderer.invoke('quit-app')
});

