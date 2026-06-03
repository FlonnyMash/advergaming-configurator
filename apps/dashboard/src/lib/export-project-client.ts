import type { ExportProjectResult } from "@/types/electron";

export class ExportProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportProjectError";
  }
}

export async function exportProjectToZip(
  projectId: string,
): Promise<ExportProjectResult> {
  const electron = window.electron?.ipcRenderer;
  if (!electron) {
    throw new ExportProjectError(
      "Export is only available in the Mashed Games Studio desktop app.",
    );
  }

  const result = await electron.invoke("export-project", { projectId });

  if (result.ok) {
    return result;
  }

  if ("canceled" in result && result.canceled) {
    return result;
  }

  throw new ExportProjectError("Export failed.");
}
