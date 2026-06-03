"use client";

import { UnsavedChangesDialog } from "@/components/studio/UnsavedChangesDialog";
import {
  collectHomeNavigationUnsaved,
  discardAllForHomeNavigation,
  saveAllForHomeNavigation,
} from "@/lib/home-navigation-unsaved";
import type { UnsavedChangeItem } from "@/lib/template-unsaved-changes";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function useHomeNavigation() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unsavedItems, setUnsavedItems] = useState<UnsavedChangeItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goHome = useCallback(() => {
    setDialogOpen(false);
    router.push("/");
  }, [router]);

  const requestHomeNavigation = useCallback(() => {
    const items = collectHomeNavigationUnsaved();
    if (items.length > 0) {
      setUnsavedItems(items);
      setError(null);
      setDialogOpen(true);
      return;
    }
    goHome();
  }, [goHome]);

  const handleSaveAllAndGoHome = async () => {
    setSaving(true);
    setError(null);

    const result = await saveAllForHomeNavigation();
    if (!result.ok) {
      setError(result.error ?? "Save failed.");
      setSaving(false);
      return;
    }

    setSaving(false);
    goHome();
  };

  const homeNavigationDialog = (
    <UnsavedChangesDialog
      open={dialogOpen}
      items={unsavedItems}
      saving={saving}
      error={error}
      description="Save open studio and configurator work before returning home, stay where you are, or leave without saving."
      primaryLabel="Save all & go home"
      cancelLabel="Stay"
      discardLabel="Leave anyway"
      onPrimary={() => void handleSaveAllAndGoHome()}
      onDiscard={() => {
        if (!saving) {
          discardAllForHomeNavigation();
          goHome();
        }
      }}
      onCancel={() => {
        if (!saving) {
          setDialogOpen(false);
        }
      }}
    />
  );

  return { requestHomeNavigation, homeNavigationDialog };
}
