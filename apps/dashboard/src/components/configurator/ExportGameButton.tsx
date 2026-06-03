"use client";

import { saveProjectClientNow } from "@/hooks/useSaveGameProject";
import {
  ExportProjectError,
  exportProjectToZip,
} from "@/lib/export-project-client";
import { ExportGameButton as ExportGameButtonView } from "@mashedgames/configurator-engine";
import { useConfiguratorStore } from "@mashedgames/configurator-engine";
import { useCallback, useState } from "react";

export function ExportGameButton() {
  const projectId = useConfiguratorStore((s) => s.projectId);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktopOnly = typeof window !== "undefined" && !window.electron;

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
    <ExportGameButtonView
      exporting={exporting}
      desktopOnly={desktopOnly}
      message={message}
      error={error}
      onExport={() => void exportGame()}
    />
  );
}
