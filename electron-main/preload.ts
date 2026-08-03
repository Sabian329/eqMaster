const { contextBridge } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});

export {};
