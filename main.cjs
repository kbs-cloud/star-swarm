const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 700,
    minWidth: 480,
    minHeight: 360,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow ES module scripts to load over file:// protocol
    },
    backgroundColor: '#000000',
    title: 'Star-Swarm: Tactical Conquest'
  });

  // Hide the default menu bar
  win.setMenuBarVisibility(false);

  // Always load static assets directly from the filesystem (no server/hosting needed)
  win.loadFile(path.join(__dirname, 'dist', 'index.html')).catch((err) => {
    console.error('Failed to load local built assets:', err);
  });

  // Intercept navigation to external URLs (like OAuth redirects) and open in default OS browser
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Intercept window.open calls to open in default OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('file://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
