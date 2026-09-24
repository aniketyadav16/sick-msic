const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("musicApp", {
  listLibrary: () => ipcRenderer.invoke("library:list"),
  listImages: () => ipcRenderer.invoke("images:list"),
  download: (queryOrUrl) => ipcRenderer.invoke("download:start", queryOrUrl),
  reveal: (filePath) => ipcRenderer.invoke("library:reveal", filePath),
  onLibraryUpdated: (callback) => {
    const handler = (_event, tracks) => callback(tracks);
    ipcRenderer.on("library:updated", handler);
    return () => ipcRenderer.removeListener("library:updated", handler);
  },
  onImagesUpdated: (callback) => {
    const handler = (_event, images) => callback(images);
    ipcRenderer.on("images:updated", handler);
    return () => ipcRenderer.removeListener("images:updated", handler);
  },
});

