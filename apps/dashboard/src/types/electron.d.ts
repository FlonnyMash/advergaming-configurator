import type { GameConfig } from "@mashedgames/shared";

export interface SaveFlatConfigPayload {
  projectId: string;
  config: GameConfig;
}

export type SaveFlatConfigResult =
  | { ok: true }
  | { ok: false; error: string };

export interface LoadFlatConfigPayload {
  projectId: string;
}

export type LoadFlatConfigResult =
  | { ok: true; raw: string }
  | { ok: false; error: string };

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
    invoke(
      channel: "save-flat-config",
      payload: SaveFlatConfigPayload,
    ): Promise<SaveFlatConfigResult>;
    invoke(
      channel: "load-flat-config",
      payload: LoadFlatConfigPayload,
    ): Promise<LoadFlatConfigResult>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
