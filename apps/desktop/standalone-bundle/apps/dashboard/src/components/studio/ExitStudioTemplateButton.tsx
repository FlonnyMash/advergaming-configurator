"use client";

import { UnsavedChangesDialog } from "@/components/studio/UnsavedChangesDialog";
import { saveTemplateConfigNow } from "@/hooks/useSaveGameControls";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";
import {
  collectUnsavedTemplateChanges,
  discardStudioUnsavedChanges,
  markAllTemplateChangesSaved,
  type UnsavedChangeItem,
} from "@/lib/template-unsaved-changes";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExitStudioTemplateButton() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unsavedItems, setUnsavedItems] = useState<UnsavedChangeItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishExit = () => {
    useWorkspaceSessionStore.getState().clearStudioSession();
    setDialogOpen(false);
    router.push("/studio/templates");
  };

  const handleExit = () => {
    const items = collectUnsavedTemplateChanges();
    if (items.length > 0) {
      setUnsavedItems(items);
      setError(null);
      setDialogOpen(true);
      return;
    }
    finishExit();
  };

  const handleSaveAllAndExit = async () => {
    setSaving(true);
    setError(null);

    const saveResult = await saveTemplateConfigNow();
    if (!saveResult.ok) {
      setError(saveResult.error ?? "Save failed.");
      setSaving(false);
      return;
    }

    markAllTemplateChangesSaved();
    setSaving(false);
    finishExit();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleExit}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        Exit template
      </button>
      <p className="text-center text-xs text-zinc-500">
        Return to the template list. Your work stays in memory until you exit.
      </p>

      <UnsavedChangesDialog
        open={dialogOpen}
        items={unsavedItems}
        saving={saving}
        error={error}
        description="Save everything below to the template library before leaving, stay in this template, or leave without saving."
        primaryLabel="Save all & exit"
        cancelLabel="Stay in template"
        discardLabel="Leave anyway"
        onPrimary={() => void handleSaveAllAndExit()}
        onDiscard={() => {
          if (!saving) {
            discardStudioUnsavedChanges();
            finishExit();
          }
        }}
        onCancel={() => {
          if (!saving) {
            setDialogOpen(false);
          }
        }}
      />
    </>
  );
}
