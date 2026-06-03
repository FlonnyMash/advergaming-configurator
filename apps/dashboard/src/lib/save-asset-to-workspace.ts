"use client";

import type { SaveProjectAssetResult } from "@/types/electron";

export class AssetWorkspaceSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetWorkspaceSaveError";
  }
}

export async function saveAssetToWorkspace(
  projectId: string,
  file: File,
  type: "image" | "audio" = "image",
): Promise<SaveProjectAssetResult> {
  const electron = window.electron?.ipcRenderer;
  if (!electron) {
    throw new AssetWorkspaceSaveError(
      "Electron IPC bridge is not available in this environment.",
    );
  }

  const buffer = await file.arrayBuffer();
  const result = await electron.invoke("save-project-asset", {
    projectId,
    fileName: file.name,
    buffer,
    type,
  });

  if (
    !result ||
    typeof result.relativePath !== "string" ||
    typeof result.absolutePath !== "string"
  ) {
    throw new AssetWorkspaceSaveError("Invalid response from save-project-asset.");
  }

  return result;
}
