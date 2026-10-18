const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('musicApp', {
  getApiBase: () => ipcRenderer.invoke('music:api-base'),
});
