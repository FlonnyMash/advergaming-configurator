"use client";

import { useSaveGameProject } from "@/hooks/useSaveGameProject";
import { useConfiguratorStore } from "@mashedgames/configurator-engine";
import { Loader2, Save } from "lucide-react";
import { useMemo } from "react";

export function SaveProjectButton() {
  const projectId = useConfiguratorStore((s) => s.projectId);
  const config = useConfiguratorStore((s) => s.config);
  const savedClient = useConfiguratorStore((s) => s.savedClient);
  const hasUnsaved = useMemo(
    () => useConfiguratorStore.getState().hasUnsavedClient(),
    [config, savedClient],
  );
  const { saveProject, saving, status, error } = useSaveGameProject();

  if (!projectId) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveProject()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save project
        {hasUnsaved ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
            unsaved
          </span>
        ) : null}
      </button>
      {status ? <p className="text-xs text-zinc-500">{status}</p> : null}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
