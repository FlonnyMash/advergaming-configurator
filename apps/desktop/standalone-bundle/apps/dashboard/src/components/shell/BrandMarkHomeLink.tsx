"use client";

import { APP_TITLE } from "@/components/shell/BrandMark";
import { UnsavedChangesDialog } from "@/components/studio/UnsavedChangesDialog";
import {
  collectHomeNavigationUnsaved,
  discardAllForHomeNavigation,
  saveAllForHomeNavigation,
} from "@/lib/home-navigation-unsaved";
import type { UnsavedChangeItem } from "@/lib/template-unsaved-changes";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BrandMarkHomeLink() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unsavedItems, setUnsavedItems] = useState<UnsavedChangeItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goHome = () => {
    setDialogOpen(false);
    router.push("/");
  };

  const handleHomeClick = () => {
    const items = collectHomeNavigationUnsaved();
    if (items.length > 0) {
      setUnsavedItems(items);
      setError(null);
      setDialogOpen(true);
      return;
    }
    goHome();
  };

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

  return (
    <>
      <button
        type="button"
        onClick={handleHomeClick}
        className="rounded-lg outline-offset-2 hover:opacity-90"
        aria-label={`${APP_TITLE} — back to home`}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/mashed-games-logo.png"
            alt={APP_TITLE}
            width={137}
            height={48}
            className="block shrink-0 object-contain invert"
            style={{ height: 48, width: "auto", maxWidth: 137 }}
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            {APP_TITLE}
          </span>
        </div>
      </button>

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
    </>
  );
}
