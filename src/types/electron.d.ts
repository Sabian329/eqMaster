export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: NodeJS.Platform;
    };
  }
}
