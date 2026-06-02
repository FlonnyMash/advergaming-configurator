"use client";

import { useStudioConfigStore } from "@advergaming/studio-engine";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

export function ExportTemplateButton() {
  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const config = useStudioConfigStore((s) => s.config);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/templates/export?templateId=${encodeURIComponent(selectedTemplateId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        },
      );

      if (!response.ok) {
        let message = "Export failed.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          /* ignore */
        }
        setError(message);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedTemplateId}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not reach the export API. Is the dashboard running locally?");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {exporting ? "Exporting…" : "Export template (.zip)"}
      </button>
      <p className="text-xs text-zinc-500">
        Downloads a portable archive of the selected template (manifest, source,
        assets, and current Studio settings) for local development or re-import.
      </p>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
