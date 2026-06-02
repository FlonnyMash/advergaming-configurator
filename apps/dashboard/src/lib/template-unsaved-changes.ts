import {
  assetBindingKey,
  useAssetLayoutSavedStore,
} from "@/lib/asset-layout-saved-store";
import {
  assetPaneLabel,
  useWorkspaceCenterStore,
} from "@/lib/workspace-center-store";
import {
  layoutsEqual,
  readAssetLayoutFromStudioConfig,
} from "@/lib/patch-asset-layout";
import {
  getStudioGameSchema,
  hasUnsavedGameControls,
  listGameControlChanges,
  useStudioConfigStore,
} from "@advergaming/studio-engine";
import type { DevToolkitAssetLayout } from "@advergaming/shared";

export type UnsavedChangeItem = {
  kind: "game-control" | "asset-layout";
  label: string;
  detail?: string;
};

export function collectUnsavedTemplateChanges(): UnsavedChangeItem[] {
  const { config, savedConfig, selectedTemplateId } = useStudioConfigStore.getState();
  const schema = getStudioGameSchema(selectedTemplateId);
  const items: UnsavedChangeItem[] = [];

  if (hasUnsavedGameControls(schema, savedConfig, config)) {
    for (const change of listGameControlChanges(schema, savedConfig, config)) {
      items.push({
        kind: "game-control",
        label: change.label,
        detail: change.targetPath,
      });
    }
  }

  const savedLayouts = useAssetLayoutSavedStore.getState().savedLayouts;
  const panes = useWorkspaceCenterStore.getState().panes;

  for (const pane of panes) {
    if (pane.kind !== "asset" || !pane.asset.configBinding) {
      continue;
    }

    const binding = pane.asset.configBinding;
    const key = assetBindingKey(binding);
    const savedLayout: DevToolkitAssetLayout =
      savedLayouts[key] ??
      readAssetLayoutFromStudioConfig(savedConfig, binding) ??
      pane.asset.layout ??
      {};
    const currentLayout: DevToolkitAssetLayout =
      readAssetLayoutFromStudioConfig(config, binding) ?? pane.asset.layout ?? {};

    if (!layoutsEqual(savedLayout, currentLayout)) {
      items.push({
        kind: "asset-layout",
        label: assetPaneLabel(pane.asset),
        detail: binding.itemKind,
      });
    }
  }

  return items;
}

export function markAllTemplateChangesSaved(): void {
  const config = useStudioConfigStore.getState().config;
  useStudioConfigStore.getState().markGameControlsSaved();

  const savedLayouts = useAssetLayoutSavedStore.getState().savedLayouts;
  const panes = useWorkspaceCenterStore.getState().panes;
  const nextLayouts = { ...savedLayouts };

  for (const pane of panes) {
    if (pane.kind !== "asset" || !pane.asset.configBinding) {
      continue;
    }
    const binding = pane.asset.configBinding;
    const key = assetBindingKey(binding);
    const layout: DevToolkitAssetLayout =
      readAssetLayoutFromStudioConfig(config, binding) ?? pane.asset.layout ?? {};
    nextLayouts[key] = structuredClone(layout);
  }

  useAssetLayoutSavedStore.setState({ savedLayouts: nextLayouts });
}
