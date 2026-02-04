const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPlaylist: async () => {
    return ipcRenderer.invoke('get-playlist');
  },
  onPlaylistUpdated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('playlist-updated', listener);
    return () => {
      ipcRenderer.removeListener('playlist-updated', listener);
    };
  }
});

