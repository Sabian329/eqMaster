export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: NodeJS.Platform;
      copyText: (text: string) => Promise<boolean>;
    };
  }
}
