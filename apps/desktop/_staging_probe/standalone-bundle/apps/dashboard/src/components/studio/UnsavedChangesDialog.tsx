"use client";

import type { UnsavedChangeItem } from "@/lib/template-unsaved-changes";
import { Loader2 } from "lucide-react";

export function UnsavedChangesDialog({
  open,
  items,
  saving,
  error,
  title = "Unsaved changes",
  description,
  primaryLabel,
  cancelLabel = "Cancel",
  discardLabel,
  onPrimary,
  onCancel,
  onDiscard,
}: {
  open: boolean;
  items: UnsavedChangeItem[];
  saving: boolean;
  error: string | null;
  title?: string;
  description: string;
  primaryLabel: string;
  cancelLabel?: string;
  /** Destructive third action — leave without saving (workspace exit flows only). */
  discardLabel?: string;
  onPrimary: () => void;
  onCancel: () => void;
  onDiscard?: () => void;
}) {
  if (!open) {
    return null;
  }

  const gameControls = items.filter((item) => item.kind === "game-control");
  const assetLayouts = items.filter((item) => item.kind === "asset-layout");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-labelledby="unsaved-changes-title"
        aria-modal="true"
        className="max-h-[min(90vh,32rem)] w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        <header className="border-b border-zinc-100 px-5 py-4">
          <h2 id="unsaved-changes-title" className="text-base font-semibold text-zinc-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </header>

        <div className="max-h-64 overflow-y-auto px-5 py-4 text-sm">
          {gameControls.length > 0 ? (
            <section className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Game controls
              </h3>
              <ul className="mt-2 space-y-1">
                {gameControls.map((item) => (
                  <li key={`gc-${item.label}-${item.detail}`} className="text-zinc-800">
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {assetLayouts.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Asset layouts
              </h3>
              <ul className="mt-2 space-y-1">
                {assetLayouts.map((item) => (
                  <li key={`al-${item.label}`} className="text-zinc-800">
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {error ? (
          <p className="px-5 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="flex flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 sm:order-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:order-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {saving ? "Saving…" : primaryLabel}
          </button>
          {onDiscard && discardLabel ? (
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 sm:order-3"
            >
              {discardLabel}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
