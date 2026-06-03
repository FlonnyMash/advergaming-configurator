"use client";

import { Loader2, Package } from "lucide-react";

export type ExportGameButtonProps = {
  disabled?: boolean;
  exporting: boolean;
  exportLabel?: string;
  desktopOnly?: boolean;
  message?: string | null;
  error?: string | null;
  onExport: () => void;
};

export function ExportGameButton({
  disabled = false,
  exporting,
  exportLabel = "Export Game",
  desktopOnly = false,
  message,
  error,
  onExport,
}: ExportGameButtonProps) {
  const isDisabled = disabled || exporting || desktopOnly;

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isDisabled}
        title={
          desktopOnly
            ? "Export is available in the Mashed Games Studio desktop app."
            : undefined
        }
        onClick={() => onExport()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Package className="h-4 w-4" />
        )}
        {exporting ? "Zipping game..." : exportLabel}
      </button>
      {message ? (
        <p className="text-xs text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
