export type ImportProgressEvent =
  | {
      type: "progress";
      step: string;
      message: string;
      command?: string;
      detail?: string;
    }
  | {
      type: "done";
      ok: true;
      status: "IMPORTED" | "RAW_CONVERTED";
      templateId: string;
    }
  | {
      type: "error";
      ok: false;
      error: string;
      status: number;
    };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
