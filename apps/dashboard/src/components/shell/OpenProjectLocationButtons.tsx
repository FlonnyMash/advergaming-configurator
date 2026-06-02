"use client";

import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import { useState } from "react";

type WorkspaceKind = "template" | "project";

type OpenProjectLocationButtonsProps = {
  kind: WorkspaceKind;
  id: string;
};

function apiBase(kind: WorkspaceKind, id: string): string {
  return kind === "template"
    ? `/api/templates/${encodeURIComponent(id)}`
    : `/api/projects/${encodeURIComponent(id)}`;
}

export function OpenProjectLocationButtons({
  kind,
  id,
}: OpenProjectLocationButtonsProps) {
  const [openingFolder, setOpeningFolder] = useState(false);
  const [openingIde, setOpeningIde] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (
    action: "open-folder" | "open-ide",
    setLoading: (value: boolean) => void,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase(kind, id)}/${action}`, {
        method: "POST",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Request failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const buttonClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={openingFolder || openingIde}
        onClick={() => void runAction("open-folder", setOpeningFolder)}
        className={buttonClass}
      >
        {openingFolder ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <FolderOpen className="h-4 w-4" aria-hidden />
        )}
        Open project folder
      </button>
      <button
        type="button"
        disabled={openingFolder || openingIde}
        onClick={() => void runAction("open-ide", setOpeningIde)}
        className={buttonClass}
      >
        {openingIde ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ExternalLink className="h-4 w-4" aria-hidden />
        )}
        Open in IDE
      </button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
