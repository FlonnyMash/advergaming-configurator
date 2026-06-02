import { saveProjectClientNow } from "@/hooks/useSaveGameProject";
import { saveTemplateConfigNow } from "@/hooks/useSaveGameControls";
import {
  collectUnsavedTemplateChanges,
  discardConfiguratorUnsavedChanges,
  discardStudioUnsavedChanges,
  markAllTemplateChangesSaved,
  type UnsavedChangeItem,
} from "@/lib/template-unsaved-changes";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";
import { useConfiguratorStore } from "@advergaming/configurator-engine";

export function collectHomeNavigationUnsaved(): UnsavedChangeItem[] {
  const { activeStudioTemplateId, activeConfiguratorProjectId } =
    useWorkspaceSessionStore.getState();
  const items: UnsavedChangeItem[] = [];

  if (activeStudioTemplateId) {
    for (const item of collectUnsavedTemplateChanges()) {
      items.push({
        ...item,
        label: `Studio · ${item.label}`,
      });
    }
  }

  if (
    activeConfiguratorProjectId &&
    useConfiguratorStore.getState().hasUnsavedClient()
  ) {
    items.push({
      kind: "game-control",
      label: "Configurator · client branding & project settings",
    });
  }

  return items;
}

export async function saveAllForHomeNavigation(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { activeStudioTemplateId, activeConfiguratorProjectId } =
    useWorkspaceSessionStore.getState();

  if (activeStudioTemplateId && collectUnsavedTemplateChanges().length > 0) {
    const saveResult = await saveTemplateConfigNow();
    if (!saveResult.ok) {
      return { ok: false, error: saveResult.error ?? "Could not save studio template." };
    }
    markAllTemplateChangesSaved();
  }

  if (
    activeConfiguratorProjectId &&
    useConfiguratorStore.getState().hasUnsavedClient()
  ) {
    try {
      await saveProjectClientNow(activeConfiguratorProjectId);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not save configurator project.",
      };
    }
  }

  return { ok: true };
}

/** Revert unsaved in-memory edits for active workspaces (does not write to disk). */
export function discardAllForHomeNavigation(): void {
  const { activeStudioTemplateId, activeConfiguratorProjectId } =
    useWorkspaceSessionStore.getState();

  if (activeStudioTemplateId && collectUnsavedTemplateChanges().length > 0) {
    discardStudioUnsavedChanges();
  }

  if (
    activeConfiguratorProjectId &&
    useConfiguratorStore.getState().hasUnsavedClient()
  ) {
    discardConfiguratorUnsavedChanges();
  }
}
