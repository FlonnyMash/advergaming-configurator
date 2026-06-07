"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type SaveButtonStatus = "idle" | "saving" | "success" | "error";

function useAsyncSaveButton(
  onSave: ((name: string) => Promise<void>) | undefined,
  projectName: string,
) {
  const [status, setStatus] = useState<SaveButtonStatus>("idle");
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearResetTimeout(), [clearResetTimeout]);

  const handleSave = useCallback(async () => {
    if (!onSave || !projectName.trim() || status === "saving") {
      return;
    }

    clearResetTimeout();
    setStatus("saving");

    try {
      await onSave(projectName);
      setStatus("success");
      resetTimeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      resetTimeoutRef.current = setTimeout(() => setStatus("idle"), 3000);
    }
  }, [onSave, projectName, status, clearResetTimeout]);

  return { status, handleSave };
}

function saveButtonClassName(status: SaveButtonStatus) {
  const base =
    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 shrink-0";

  switch (status) {
    case "saving":
      return `${base} border-zinc-200 bg-zinc-50 text-zinc-500`;
    case "success":
      return `${base} border-green-200 bg-green-50 text-green-700`;
    case "error":
      return `${base} border-red-200 bg-red-50 text-red-700`;
    default:
      return `${base} border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50`;
  }
}

export type WorkspaceProjectControlsProps = {
  availableProjects?: string[];
  onSave?: (projectName: string) => Promise<void>;
  onLoad?: (projectName: string) => Promise<void>;
};

export function WorkspaceProjectControls({
  availableProjects = [],
  onSave,
  onLoad,
}: WorkspaceProjectControlsProps) {
  const [saveProjectName, setSaveProjectName] = useState("");
  const [loadSelectedProject, setLoadSelectedProject] = useState(
    () => availableProjects[0] ?? "",
  );

  useEffect(() => {
    if (availableProjects.length === 0) {
      setLoadSelectedProject("");
      return;
    }
    setLoadSelectedProject((prev) =>
      availableProjects.includes(prev) ? prev : (availableProjects[0] ?? ""),
    );
  }, [availableProjects]);

  const { status: saveStatus, handleSave } = useAsyncSaveButton(
    onSave,
    saveProjectName,
  );

  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const handleLoad = useCallback(async () => {
    if (!onLoad || !loadSelectedProject || loadStatus === "loading") return;
    setLoadStatus("loading");
    try {
      await onLoad(loadSelectedProject);
      setLoadStatus("idle");
    } catch {
      setLoadStatus("error");
      setTimeout(() => setLoadStatus("idle"), 3000);
    }
  }, [onLoad, loadSelectedProject, loadStatus]);

  if (!onSave && !onLoad) {
    return null;
  }

  return (
    <div className="space-y-3">
      {onSave ? (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Save
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveProjectName}
              onChange={(e) => setSaveProjectName(e.target.value)}
              placeholder="project-name"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!saveProjectName.trim() || saveStatus === "saving"}
              className={saveButtonClassName(saveStatus)}
              aria-live="polite"
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : saveStatus === "success" ? (
                "Saved!"
              ) : saveStatus === "error" ? (
                "Failed"
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      ) : null}
      {onLoad ? (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Load
          </p>
          <div className="flex gap-2">
            <select
              value={loadSelectedProject}
              onChange={(e) => setLoadSelectedProject(e.target.value)}
              disabled={availableProjects.length === 0}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
            >
              {availableProjects.length === 0 ? (
                <option value="">No saved projects</option>
              ) : (
                availableProjects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => void handleLoad()}
              disabled={!loadSelectedProject || loadStatus === "loading"}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadStatus === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Loading…
                </>
              ) : loadStatus === "error" ? (
                "Failed"
              ) : (
                "Load"
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
