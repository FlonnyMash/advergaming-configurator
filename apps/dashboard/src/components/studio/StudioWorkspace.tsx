"use client";

import { StudioToolsPanel } from "@/components/studio/StudioToolsPanel";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import {
  FlatConfigIpcError,
  loadFlatConfigViaElectron,
  saveFlatConfigViaElectron,
} from "@/lib/flat-config-ipc";
import { useConfigStore } from "@/store/useConfigStore";
import { StudioSidebar, useStudioConfigStore } from "@mashedgames/studio-engine";
import { useCallback, useEffect } from "react";

const STUDIO_SESSION_PROJECT_ID = "studio-session";

export function StudioWorkspace({ suspended = false }: { suspended?: boolean }) {
  const initialTemplateId = useStudioConfigStore.getState().selectedTemplateId;

  useEffect(() => {
    const syncFromStudio = (
      state: ReturnType<typeof useStudioConfigStore.getState>,
    ) => {
      useConfigStore.getState().setSelectedTemplateId(state.selectedTemplateId);
      useConfigStore.getState().setConfig(state.config);
    };
    syncFromStudio(useStudioConfigStore.getState());
    return useStudioConfigStore.subscribe(syncFromStudio);
  }, []);

  const isDesktop = typeof window !== "undefined" && Boolean(window.electron);

  const handleSave = useCallback(async () => {
    const config = useStudioConfigStore.getState().config;
    try {
      await saveFlatConfigViaElectron(STUDIO_SESSION_PROJECT_ID, config);
    } catch (error) {
      const message =
        error instanceof FlatConfigIpcError || error instanceof Error
          ? error.message
          : "Save failed.";
      window.alert(message);
    }
  }, []);

  const handleLoad = useCallback(async () => {
    try {
      const config = await loadFlatConfigViaElectron(STUDIO_SESSION_PROJECT_ID);
      useStudioConfigStore.getState().hydrateConfig(config);
    } catch (error) {
      const message =
        error instanceof FlatConfigIpcError || error instanceof Error
          ? error.message
          : "Load failed.";
      window.alert(message);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <StudioSidebar
        onSave={isDesktop ? handleSave : undefined}
        onLoad={isDesktop ? handleLoad : undefined}
      />
      <CenterWorkspace
        appMode="studio"
        initialTemplateId={initialTemplateId}
        previewSuspended={suspended}
      />
      <StudioToolsPanel />
    </div>
  );
}
