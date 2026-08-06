const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  copyText: (text: string) =>
    ipcRenderer.invoke('clipboard:writeText', text) as Promise<boolean>,
  readSavedMeasurements: () =>
    ipcRenderer.invoke('saved-measurements:read') as Promise<unknown[]>,
  writeSavedMeasurements: (items: unknown[]) =>
    ipcRenderer.invoke('saved-measurements:write', items) as Promise<boolean>,
});

export {};
