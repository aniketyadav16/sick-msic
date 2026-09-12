const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("musicApp", {
  listLibrary: () => ipcRenderer.invoke("library:list"),
  download: (url) => ipcRenderer.invoke("download:start", url),
  reveal: (filePath) => ipcRenderer.invoke("library:reveal", filePath),
});
