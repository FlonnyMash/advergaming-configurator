import { saveProjectClientNow } from "@/hooks/useSaveGameProject";
import {
  collectUnsavedTemplateChanges,
  discardConfiguratorUnsavedChanges,
  discardStudioUnsavedChanges,
  type UnsavedChangeItem,
} from "@/lib/template-unsaved-changes";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";
import { useConfiguratorStore } from "@mashedgames/configurator-engine";

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
      id: "configurator-client",
      label: "Configurator · client branding & project settings",
    });
  }

  return items;
}

export async function saveAllForHomeNavigation(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { activeConfiguratorProjectId } = useWorkspaceSessionStore.getState();

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

export function discardAllForHomeNavigation(): void {
  const { activeStudioTemplateId, activeConfiguratorProjectId } =
    useWorkspaceSessionStore.getState();

  if (activeStudioTemplateId) {
    discardStudioUnsavedChanges();
  }

  if (
    activeConfiguratorProjectId &&
    useConfiguratorStore.getState().hasUnsavedClient()
  ) {
    discardConfiguratorUnsavedChanges();
  }
}
