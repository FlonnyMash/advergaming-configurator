"use client";

import { ConfiguratorToolsShell } from "@/components/configurator/ConfiguratorToolsShell";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import {
  FlatConfigIpcError,
  getProjectListViaElectron,
  loadFlatConfigViaElectron,
  saveFlatConfigViaElectron,
} from "@/lib/flat-config-ipc";
import { saveProjectAssetWithFallback } from "@/lib/import-project-asset-client";
import {
  pushRuntimeAssetsToPreview,
  usePreviewBridgeStore,
} from "@/lib/preview-bridge-store";
import { isWorkspaceDesktopClient } from "@/lib/runtime-env";
import { useConfigStore } from "@/store/useConfigStore";
import {
  ConfiguratorSidebar,
  useConfiguratorStore,
} from "@mashedgames/configurator-engine";
import { useCallback, useEffect, useState } from "react";

export function ConfiguratorWorkspace({
  suspended = false,
}: {
  suspended?: boolean;
}) {
  const initialTemplateId =
    useConfiguratorStore.getState().selectedTemplateId;
  const selectedTemplateId = useConfiguratorStore(
    (state) => state.selectedTemplateId,
  );

  const projectId = useConfiguratorStore((state) => state.projectId);
  const setAssetSaveHandler = useConfiguratorStore(
    (state) => state.setAssetSaveHandler,
  );

  const [availableProjects, setAvailableProjects] = useState<string[]>([]);

  const isDesktop = typeof window !== "undefined" && Boolean(window.electron);

  useEffect(() => {
    if (!isDesktop) return;
    getProjectListViaElectron()
      .then(setAvailableProjects)
      .catch(() => setAvailableProjects([]));
  }, [isDesktop]);

  const handleSave = useCallback(async (projectName: string) => {
    const config = useConfiguratorStore.getState().config;
    await saveFlatConfigViaElectron(projectName, config);
    getProjectListViaElectron()
      .then(setAvailableProjects)
      .catch(() => undefined);
  }, []);

  const handleLoad = useCallback(async (projectName: string) => {
    try {
      const config = await loadFlatConfigViaElectron(projectName);
      useConfiguratorStore.getState().setConfig(config);
    } catch (error) {
      const message =
        error instanceof FlatConfigIpcError || error instanceof Error
          ? error.message
          : "Load failed.";
      window.alert(message);
    }
  }, []);

  useEffect(() => {
    const syncFromConfigurator = (
      state: ReturnType<typeof useConfiguratorStore.getState>,
    ) => {
      useConfigStore.getState().setSelectedTemplateId(state.selectedTemplateId);
      useConfigStore.getState().setConfig(state.config);
    };
    syncFromConfigurator(useConfiguratorStore.getState());
    return useConfiguratorStore.subscribe(syncFromConfigurator);
  }, []);

  useEffect(() => {
    if (!projectId || !isWorkspaceDesktopClient()) {
      setAssetSaveHandler(null);
      return;
    }

    setAssetSaveHandler(async (input) => {
      const data = await saveProjectAssetWithFallback({
        projectId: input.projectId,
        file: input.file,
        targetPath: input.fieldKey,
      });

      const runtimeAssets =
        data.manifest?.runtimeAssets ??
        {
          ...usePreviewBridgeStore.getState().runtimeAssets,
          [data.relativePath]: data.absolutePath,
        };

      usePreviewBridgeStore.getState().setRuntimeAssets(runtimeAssets);
      pushRuntimeAssetsToPreview();

      const messenger = usePreviewBridgeStore.getState().messenger;
      if (data.textureKey && messenger) {
        messenger.sendLoadExternalAsset(data.textureKey, data.absolutePath);
      }

      return data;
    });

    return () => setAssetSaveHandler(null);
  }, [projectId, setAssetSaveHandler]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <ConfiguratorToolsShell
        availableProjects={isDesktop ? availableProjects : undefined}
        onSave={isDesktop ? handleSave : undefined}
        onLoad={isDesktop ? handleLoad : undefined}
      />
      <CenterWorkspace
        appMode="configurator"
        initialTemplateId={initialTemplateId}
        previewSuspended={suspended}
      />
      <ConfiguratorSidebar />
    </div>
  );
}
