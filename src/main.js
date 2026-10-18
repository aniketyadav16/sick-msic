require('dotenv').config({ quiet: true });
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { startServer } = require('../server');
let backend;
let apiBase;
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1240, height: 780, minWidth: 940, minHeight: 640,
    title: 'Aria', backgroundColor: '#08090d', titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}
ipcMain.handle('music:api-base', () => apiBase);
app.whenReady().then(async () => {
  apiBase = process.env.MUSIC_API_URL;
  if (!apiBase) {
    backend = await startServer({ port: 0, host: '127.0.0.1', allowFileOrigin: true });
    apiBase = `http://127.0.0.1:${backend.server.address().port}`;
  }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
let closing = false;
app.on('before-quit', (event) => {
  if (!backend || closing) return;
  event.preventDefault(); closing = true;
  backend.close().finally(() => app.quit());
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
