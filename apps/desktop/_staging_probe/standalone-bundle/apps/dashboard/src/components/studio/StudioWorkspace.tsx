"use client";

import { DevToolkitBridgeHost } from "@/components/studio/DevToolkitBridgeHost";
import { StudioToolsPanel } from "@/components/studio/StudioToolsPanel";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import { GameChromeOverlayPanel } from "@/components/shell/GameChromeOverlayPanel";
import { useSaveGameControls } from "@/hooks/useSaveGameControls";
import { useAssetLayoutSavedStore } from "@/lib/asset-layout-saved-store";
import {
  GAME_PREVIEW_PANE_ID,
  useWorkspaceCenterStore,
} from "@/lib/workspace-center-store";
import { StudioSidebar, useStudioConfigStore } from "@mashedgames/studio-engine";
import { useCallback, useEffect } from "react";

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

  const getConfig = useCallback(
    () => useStudioConfigStore.getState().config,
    [],
  );

  const subscribe = useCallback(
    (
      listener: (state: {
        config: ReturnType<typeof getConfig>;
        selectedTemplateId: typeof initialTemplateId;
      }) => void,
    ) =>
      useStudioConfigStore.subscribe((state) =>
        listener({
          config: state.config,
          selectedTemplateId: state.selectedTemplateId,
        }),
      ),
    [],
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
        getConfig={getConfig}
        subscribe={subscribe}
        configUpdateMode="full"
        previewSuspended={suspended}
      />
      <StudioToolsPanel />
    </div>
  );
}
