"use client";

import { DevToolkitBridgeHost } from "@/components/studio/DevToolkitBridgeHost";
import { StudioToolsPanel } from "@/components/studio/StudioToolsPanel";
import { TemplateOverlayLayer } from "@/components/studio/TemplateOverlayLayer";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import { GameChromeOverlayPanel } from "@/components/shell/GameChromeOverlayPanel";
import { useSaveGameControls } from "@/hooks/useSaveGameControls";
import { useAssetLayoutSavedStore } from "@/lib/asset-layout-saved-store";
import {
  GAME_PREVIEW_PANE_ID,
  useWorkspaceCenterStore,
} from "@/lib/workspace-center-store";
import { useConfigStore } from "@/store/useConfigStore";
import { getCatalogEntry } from "@mashedgames/game-engine/templates/schemas";
import { StudioSidebar, useStudioConfigStore } from "@mashedgames/studio-engine";
import { useEffect, useMemo } from "react";

export function StudioWorkspace({ suspended = false }: { suspended?: boolean }) {
  const initialTemplateId = useStudioConfigStore.getState().selectedTemplateId;
  const selectedTemplateId = useStudioConfigStore(
    (state) => state.selectedTemplateId,
  );
  const activePaneId = useWorkspaceCenterStore((state) => state.activePaneId);
  const { saveGameControls, saving, status, error } = useSaveGameControls();

  useEffect(() => {
    useAssetLayoutSavedStore.getState().clearSavedLayouts();
  }, [selectedTemplateId]);

  useEffect(() => {
    const syncFromStudio = (state: ReturnType<typeof useStudioConfigStore.getState>) => {
      useConfigStore.getState().setSelectedTemplateId(state.selectedTemplateId);
      useConfigStore.getState().setConfig(state.config);
    };
    syncFromStudio(useStudioConfigStore.getState());
    return useStudioConfigStore.subscribe(syncFromStudio);
  }, []);

  const activeManifest = useMemo(
    () => getCatalogEntry(selectedTemplateId)?.manifest ?? null,
    [selectedTemplateId],
  );

  const templateOverlaySlot = (
    <TemplateOverlayLayer
      manifest={activeManifest}
      getConfig={() => useStudioConfigStore.getState().config}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DevToolkitBridgeHost
        resetKey={selectedTemplateId}
        enabled={!suspended}
      />
      <StudioSidebar
        previewSlot={
          <>
            <GameChromeOverlayPanel />
            {status ? (
              <p className="mt-4 text-[11px] text-emerald-700" role="status">
                {status}
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 text-[11px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {saving ? (
              <p className="mt-2 text-[11px] text-zinc-500">Saving game controls…</p>
            ) : null}
          </>
        }
        historyShortcutsActive={activePaneId === GAME_PREVIEW_PANE_ID}
        onSaveGameControls={saveGameControls}
        savingGameControls={saving}
      />
      <CenterWorkspace
        appMode="studio"
        initialTemplateId={initialTemplateId}
        previewSuspended={suspended}
        overlaySlot={templateOverlaySlot}
      />
      <StudioToolsPanel />
    </div>
  );
}
