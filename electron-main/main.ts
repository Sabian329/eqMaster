const { app, BrowserWindow, Menu, clipboard, ipcMain, session, shell } =
  require('electron') as typeof import('electron');
import type { BrowserWindow as BrowserWindowType, Menu as MenuType } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const SAVED_MEASUREMENTS_FILE = 'saved-measurements.json';

let mainWindow: BrowserWindowType | null = null;

function savedMeasurementsPath(): string {
  return path.join(app.getPath('userData'), SAVED_MEASUREMENTS_FILE);
}

function readSavedMeasurementsFile(): unknown[] {
  const filePath = savedMeasurementsPath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedMeasurementsFile(items: unknown): boolean {
  const filePath = savedMeasurementsPath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(items ?? [], null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 960,
    minHeight: 680,
    title: 'Room EQ Measure',
    backgroundColor: '#0b0d12',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu(): MenuType {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Plik',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }],
    },
    {
      label: 'Edycja',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'Widok',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Okno',
      role: 'window' as const,
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

app.whenReady().then(() => {
  ipcMain.handle('clipboard:writeText', (_event, text: unknown) => {
    clipboard.writeText(typeof text === 'string' ? text : String(text ?? ''));
    return true;
  });

  ipcMain.handle('saved-measurements:read', () => readSavedMeasurementsFile());
  ipcMain.handle('saved-measurements:write', (_event, items: unknown) =>
    writeSavedMeasurementsFile(items),
  );

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(
      permission === 'media' ||
        permission === 'mediaKeySystem' ||
        permission === 'clipboard-sanitized-write',
    );
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return (
      permission === 'media' ||
      permission === 'mediaKeySystem' ||
      permission === 'clipboard-sanitized-write'
    );
  });

  Menu.setApplicationMenu(buildMenu());
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

export {};
