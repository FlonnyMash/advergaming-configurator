import { useConfiguratorStore } from "@mashedgames/configurator-engine";
import { useStudioConfigStore } from "@mashedgames/studio-engine";

export type UnsavedChangeItem = {
  id: string;
  label: string;
  detail?: string;
  kind?: string;
};

export function hasUnsavedConfiguratorClient(): boolean {
  return useConfiguratorStore.getState().hasUnsavedClient();
}

export function hasUnsavedStudioConfig(): boolean {
  return false;
}

export function collectUnsavedTemplateChanges(): UnsavedChangeItem[] {
  return [];
}

export function discardConfiguratorUnsavedChanges(): void {
  useConfiguratorStore.getState().resetBranding();
}

export function discardStudioUnsavedChanges(): void {
  useStudioConfigStore.getState().resetConfig();
}

export function markAllTemplateChangesSaved(): void {
  useConfiguratorStore.getState().markClientSaved();
  markStudioConfigSaved();
}

export function markStudioConfigSaved(): void {
  /* no-op until template persistence returns */
}

export function resetStudioUnsavedTracking(): void {
  discardStudioUnsavedChanges();
}
