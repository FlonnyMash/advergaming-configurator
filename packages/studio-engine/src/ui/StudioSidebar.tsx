"use client";

import { getStudioGameSchema } from "../registry/studioSchemaRegistry";
import { useStudioConfigStore } from "../store/useStudioConfigStore";
import { SchemaControlPanel } from "./SchemaControlPanel";
import { Loader2, Redo2, Save, Undo2 } from "lucide-react";
import { useCallback, useEffect } from "react";

export function StudioSidebar({
  previewSlot,
  onSaveGameControls,
  savingGameControls = false,
  historyShortcutsActive = true,
}: {
  previewSlot?: React.ReactNode;
  onSaveGameControls?: () => Promise<{ ok: boolean; error?: string }>;
  savingGameControls?: boolean;
  /** When false, Ctrl+Z / redo shortcuts are handled by the asset layout editor instead. */
  historyShortcutsActive?: boolean;
}) {
  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const config = useStudioConfigStore((s) => s.config);
  const patchBrandingPathFromControls = useStudioConfigStore(
    (s) => s.patchBrandingPathFromControls,
  );
  const patchSystemPathFromControls = useStudioConfigStore(
    (s) => s.patchSystemPathFromControls,
  );
  const undoGameControl = useStudioConfigStore((s) => s.undoGameControl);
  const redoGameControl = useStudioConfigStore((s) => s.redoGameControl);
  const controlHistoryPast = useStudioConfigStore((s) => s.controlHistoryPast);
  const controlHistoryFuture = useStudioConfigStore((s) => s.controlHistoryFuture);

  const gameSchema = getStudioGameSchema(selectedTemplateId);
  const canUndo = controlHistoryPast.length > 0;
  const canRedo = controlHistoryFuture.length > 0;

  const handleControlChange = (
    control: import("@mashedgames/shared").ControlFieldSchema,
    value: import("@mashedgames/shared").ControlValue,
  ) => {
    if (control.targetCategory === "system") {
      patchSystemPathFromControls(control.targetPath, value);
      return;
    }
    patchBrandingPathFromControls(control.targetPath, value);
  };

  const undo = useCallback(() => {
    undoGameControl();
  }, [undoGameControl]);

  const redo = useCallback(() => {
    redoGameControl();
  }, [redoGameControl]);

  useEffect(() => {
    if (!historyShortcutsActive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        if (controlHistoryPast.length === 0) {
          return;
        }
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        if (controlHistoryFuture.length === 0) {
          return;
        }
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    controlHistoryFuture.length,
    controlHistoryPast.length,
    historyShortcutsActive,
    redo,
    undo,
  ]);

  const handleSave = () => {
    if (!onSaveGameControls) {
      return;
    }
    void onSaveGameControls();
  };

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 px-6 py-5">
        <h1 className="text-lg font-semibold text-zinc-900">Game controls</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Live tweaks for the preview</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <section className="mb-4 shrink-0 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Controls</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo game control change"
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo game control change"
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Redo2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Redo
              </button>
              {onSaveGameControls ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={savingGameControls}
                  title="Save game controls as the new template default"
                  className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-800 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingGameControls ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  {savingGameControls ? "Saving…" : "Save"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Edits update the live preview immediately.{" "}
            <span className="font-medium text-zinc-700">Undo</span> or{" "}
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px]">
              Ctrl+Z
            </kbd>{" "}
            reverts control steps;{" "}
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px]">
              Ctrl+Shift+Z
            </kbd>{" "}
            redoes. Use <span className="font-medium text-zinc-700">Save</span> to
            write values into the template library.
          </p>
        </section>

        <SchemaControlPanel
          schema={gameSchema}
          config={config}
          onControlChange={handleControlChange}
        />
        {previewSlot}
      </div>
    </aside>
  );
}
