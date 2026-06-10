"use client";

import { StudioToolsPanel } from "@/components/studio/StudioToolsPanel";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import {
  FlatConfigIpcError,
  getProjectListViaElectron,
  loadFlatConfigViaElectron,
  saveFlatConfigViaElectron,
} from "@/lib/flat-config-ipc";
import { useConfigStore } from "@/store/useConfigStore";
import { StudioSidebar, useStudioConfigStore } from "@mashedgames/studio-engine";
import { useCallback, useEffect, useState } from "react";

export function StudioWorkspace({ suspended = false }: { suspended?: boolean }) {
  const initialTemplateId = useStudioConfigStore.getState().selectedTemplateId;
  const selectedTemplateId = useStudioConfigStore(
    (state) => state.selectedTemplateId,
  );
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);

  const isDesktop = typeof window !== "undefined" && Boolean(window.electron);

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

  // Refresh the save list whenever the desktop runtime loads or the active
  // template changes — each template owns its own isolated save slot list.
  useEffect(() => {
    if (!isDesktop) return;
    getProjectListViaElectron("studio", { templateId: selectedTemplateId })
      .then(setAvailableProjects)
      .catch(() => setAvailableProjects([]));
  }, [isDesktop, selectedTemplateId]);

  const handleSave = useCallback(
    async (projectName: string) => {
      const config = useStudioConfigStore.getState().config;
      await saveFlatConfigViaElectron(projectName, config);
      getProjectListViaElectron("studio", { templateId: selectedTemplateId })
        .then(setAvailableProjects)
        .catch(() => undefined);
    },
    [selectedTemplateId],
  );

  const handleLoad = useCallback(async (projectName: string) => {
    try {
      const config = await loadFlatConfigViaElectron(projectName);
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
      <StudioToolsPanel
        availableProjects={isDesktop ? availableProjects : undefined}
        onSave={isDesktop ? handleSave : undefined}
        onLoad={isDesktop ? handleLoad : undefined}
      />
      <CenterWorkspace
        appMode="studio"
        initialTemplateId={initialTemplateId}
        previewSuspended={suspended}
      />
      <StudioSidebar />
    </div>
  );
}
