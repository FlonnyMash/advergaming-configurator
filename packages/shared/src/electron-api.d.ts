export interface SaveProjectAssetPayload {
  projectId: string;
  fileName: string;
  buffer: ArrayBuffer;
  type: "image" | "audio";
}

export interface SaveProjectAssetResult {
  relativePath: string;
  absolutePath: string;
}

export interface ElectronAPI {
  ipcRenderer: {
    invoke(
      channel: "save-project-asset",
      payload: SaveProjectAssetPayload,
    ): Promise<SaveProjectAssetResult>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
