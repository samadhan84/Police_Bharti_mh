// Electron shell: loads the built React app (frontend/dist). Build the frontend first: cd frontend && npm run build
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({ width: 1200, height: 850, autoHideMenuBar: true, webPreferences: { contextIsolation: true } });
  const packaged = path.join(__dirname, 'app', 'index.html');
  const dev = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  win.loadFile(fs.existsSync(packaged) ? packaged : dev);
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
