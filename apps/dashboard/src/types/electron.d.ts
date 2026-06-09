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

export type GetProjectListResult = string[];

export interface MashedRuntimeBridge {
  devStorePreview: boolean;
  usesExternalDashboard: boolean;
}

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
    invoke(channel: "get-project-list"): Promise<GetProjectListResult>;
    // Electron auto-updater
    invoke(channel: "updater:check"): Promise<{
      ok: boolean;
      updateAvailable?: boolean;
      version?: string | null;
      error?: string;
    }>;
    invoke(channel: "updater:download"): Promise<{ ok: boolean; error?: string }>;
    invoke(channel: "updater:quit-and-install"): Promise<void>;
    // Game template OTA updates
    invoke(
      channel: "template:check-version",
      payload: { templateSlug: string },
    ): Promise<{
      ok: boolean;
      templateId?: string;
      version?: string;
      storageKey?: string;
      checksum?: string | null;
      error?: string;
    }>;
    invoke(
      channel: "template:get-installed-version",
      payload: { templateSlug: string },
    ): Promise<{ ok: boolean; version?: string | null; error?: string }>;
    invoke(
      channel: "template:install",
      payload: { templateSlug: string },
    ): Promise<{ ok: boolean; version?: string; error?: string }>;
    // Fallback overload for any other channel (returns unknown)
    invoke(channel: string, payload?: unknown): Promise<unknown>;

    /**
     * Subscribes to push events sent from the main process.
     * Only channels explicitly allowed in the preload are accepted.
     */
    on(channel: string, listener: (...args: unknown[]) => void): void;

    /**
     * Removes a previously registered push event listener.
     */
    removeListener(
      channel: string,
      listener: (...args: unknown[]) => void,
    ): void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
    mashedRuntime?: MashedRuntimeBridge;
  }
}

export {};
