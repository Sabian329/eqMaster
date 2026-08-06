export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: NodeJS.Platform;
      copyText: (text: string) => Promise<boolean>;
      readSavedMeasurements: () => Promise<unknown[]>;
      writeSavedMeasurements: (items: unknown[]) => Promise<boolean>;
    };
  }
}
