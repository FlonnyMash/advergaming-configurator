"use client";

import { ConfiguratorToolsShell } from "@/components/configurator/ConfiguratorToolsShell";
import { DevToolkitBridgeHost } from "@/components/studio/DevToolkitBridgeHost";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import { GameChromeOverlayPanel } from "@/components/shell/GameChromeOverlayPanel";
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
import { useEffect } from "react";

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

  const projectId = useConfiguratorStore((s) => s.projectId);
  const setAssetSaveHandler = useConfiguratorStore((s) => s.setAssetSaveHandler);

  const imageUploadMode = isWorkspaceDesktopClient() ? "workspace-file" : "base64";

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
    if (!projectId || imageUploadMode !== "workspace-file") {
      setAssetSaveHandler(null);
      return;
    }

    setAssetSaveHandler(async (input) => {
      const data = await saveProjectAssetWithFallback(input);

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
  }, [imageUploadMode, projectId, setAssetSaveHandler]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DevToolkitBridgeHost
        resetKey={selectedTemplateId}
        enabled={!suspended}
      />
      <ConfiguratorSidebar
        previewSlot={<GameChromeOverlayPanel />}
        imageUploadMode={imageUploadMode}
      />
      <CenterWorkspace
        appMode="configurator"
        initialTemplateId={initialTemplateId}
        previewSuspended={suspended}
      />
      <ConfiguratorToolsShell />
    </div>
  );
}
