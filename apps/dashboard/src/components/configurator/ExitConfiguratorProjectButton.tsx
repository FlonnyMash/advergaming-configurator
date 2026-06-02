"use client";

import { UnsavedChangesDialog } from "@/components/studio/UnsavedChangesDialog";
import { saveProjectClientNow } from "@/hooks/useSaveGameProject";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";
import type { UnsavedChangeItem } from "@/lib/template-unsaved-changes";
import { useConfiguratorStore } from "@advergaming/configurator-engine";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExitConfiguratorProjectButton() {
  const router = useRouter();
  const projectId = useConfiguratorStore((s) => s.projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!projectId) {
    return null;
  }

  const finishExit = () => {
    useWorkspaceSessionStore.getState().clearConfiguratorSession();
    useConfiguratorStore.getState().clearProject();
    setDialogOpen(false);
    router.push("/configurator/projects");
  };

  const handleExit = () => {
    if (useConfiguratorStore.getState().hasUnsavedClient()) {
      setError(null);
      setDialogOpen(true);
      return;
    }
    finishExit();
  };

  const handleSaveAndExit = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveProjectClientNow(projectId);
      setSaving(false);
      finishExit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
    }
  };

  const unsavedItems: UnsavedChangeItem[] = [
    {
      kind: "game-control",
      label: "Client branding & project settings",
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={handleExit}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        Exit project
      </button>
      <p className="text-center text-xs text-zinc-500">
        Return to the project list. Switching to Studio keeps this project open.
      </p>

      <UnsavedChangesDialog
        open={dialogOpen}
        items={unsavedItems}
        saving={saving}
        error={error}
        description="Save client branding to disk before leaving, or stay in this project."
        primaryLabel="Save & exit"
        cancelLabel="Stay in project"
        onPrimary={() => void handleSaveAndExit()}
        onCancel={() => {
          if (!saving) {
            setDialogOpen(false);
          }
        }}
      />
    </>
  );
}
