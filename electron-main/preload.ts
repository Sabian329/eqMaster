const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  copyText: (text: string) =>
    ipcRenderer.invoke('clipboard:writeText', text) as Promise<boolean>,
});

export {};
