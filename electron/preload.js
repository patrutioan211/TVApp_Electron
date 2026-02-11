const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPlaylist: () => ipcRenderer.invoke('get-playlist'),
  getPlaylistForTeam: (team) => ipcRenderer.invoke('get-playlist-for-team', team),
  getTeams: () => ipcRenderer.invoke('get-teams'),
  getSelectedTeam: () => ipcRenderer.invoke('get-selected-team'),
  setSelectedTeam: (team) => ipcRenderer.invoke('set-selected-team', team),
  onPlaylistUpdated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('playlist-updated', listener);
    return () => ipcRenderer.removeListener('playlist-updated', listener);
  },
  getTrafficData: () => ipcRenderer.invoke('get-traffic-data'),
  getSectionContent: (team, sectionId) => ipcRenderer.invoke('get-section-content', team, sectionId),
  getAllSectionsContent: (team) => ipcRenderer.invoke('get-all-sections-content', team),
  getWorkspaceFolderImages: (path) => ipcRenderer.invoke('get-workspace-folder-images', path),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  openAdminWindow: () => ipcRenderer.invoke('open-admin-window'),
  authRegister: (email, password) => ipcRenderer.invoke('auth-register', email, password),
  authLogin: (email, password) => ipcRenderer.invoke('auth-login', email, password),
  authCheck: (token) => ipcRenderer.invoke('auth-check', token),
  authLogout: (token) => ipcRenderer.invoke('auth-logout', token),
  authForgotPassword: (email) => ipcRenderer.invoke('auth-forgot-password', email),
  authResetPassword: (token, newPassword) => ipcRenderer.invoke('auth-reset-password', token, newPassword),
  adminCreateTeam: (name) => ipcRenderer.invoke('admin-create-team', name),
  adminDeleteTeam: (name) => ipcRenderer.invoke('admin-delete-team', name),
  adminSavePlaylist: (teamName, data) => ipcRenderer.invoke('admin-save-playlist', teamName, data)
});

