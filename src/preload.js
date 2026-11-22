const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('musicApp', {
  getApiBase: () => ipcRenderer.invoke('music:api-base'),
  startVoice: (id, locale) => ipcRenderer.invoke('voice:start', id, locale),
  stopVoice: () => ipcRenderer.invoke('voice:stop'),
  onVoiceEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('voice:event', listener);
    return () => ipcRenderer.removeListener('voice:event', listener);
  },
});
