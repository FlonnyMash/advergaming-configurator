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

export interface ExportProjectPayload {
  projectId: string;
}

export type ExportProjectResult =
  | { ok: true; savePath: string }
  | { ok: false; canceled: true };

export interface ElectronAPI {
  ipcRenderer: {
    invoke(
      channel: "save-project-asset",
      payload: SaveProjectAssetPayload,
    ): Promise<SaveProjectAssetResult>;
    invoke(
      channel: "export-project",
      payload: ExportProjectPayload,
    ): Promise<ExportProjectResult>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
