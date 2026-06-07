"use client";

import { saveProjectClientNow } from "@/hooks/useSaveGameProject";
import {
  ExportProjectError,
  exportProjectToZip,
} from "@/lib/export-project-client";
import { useConfiguratorStore } from "@mashedgames/configurator-engine";
import { useCallback, useState } from "react";

export function ExportGameButton() {
  const projectId = useConfiguratorStore((state) => state.projectId);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportGame = useCallback(async () => {
    if (!projectId) {
      setError("Open a project before exporting.");
      return;
    }

    if (!window.electron) {
      setError("Export is only available in the desktop app.");
      return;
    }

    setExporting(true);
    setError(null);
    setMessage(null);

    try {
      await saveProjectClientNow(projectId);
      const result = await exportProjectToZip(projectId);
      if (!result.ok) {
        if ("canceled" in result && result.canceled) {
          return;
        }
        throw new ExportProjectError("Export failed.");
      }
      setMessage(`Game exported to ${result.savePath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [projectId]);

  if (!projectId) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void exportGame()}
        disabled={exporting}
        className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
      >
        {exporting ? "Exporting…" : "Export game"}
      </button>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
