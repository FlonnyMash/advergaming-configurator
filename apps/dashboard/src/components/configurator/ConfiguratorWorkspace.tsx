"use client";

import { ConfiguratorToolsShell } from "@/components/configurator/ConfiguratorToolsShell";
import { DevToolkitBridgeHost } from "@/components/studio/DevToolkitBridgeHost";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import { GameChromeOverlayPanel } from "@/components/shell/GameChromeOverlayPanel";
import {
  pushRuntimeAssetsToPreview,
  usePreviewBridgeStore,
} from "@/lib/preview-bridge-store";
import { isWorkspaceDesktopClient } from "@/lib/runtime-env";
import {
  ConfiguratorSidebar,
  useConfiguratorStore,
} from "@mashedgames/configurator-engine";
import type { ControlFieldSchema, GameProjectManifest } from "@mashedgames/shared";
import { useCallback } from "react";

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
  const patchBrandingPath = useConfiguratorStore((s) => s.patchBrandingPath);
  const updateProjectManifest = useConfiguratorStore(
    (s) => s.updateProjectManifest,
  );

  const imageUploadMode = isWorkspaceDesktopClient() ? "workspace-file" : "base64";

  const handleImageFile = useCallback(
    async (file: File, control: ControlFieldSchema) => {
      if (!projectId) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetPath", control.targetPath);

      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/import-asset`,
        { method: "POST", body: formData },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        relativePath?: string;
        absolutePath?: string;
        textureKey?: string | null;
        manifest?: GameProjectManifest;
      };

      if (!response.ok || !data.ok || !data.relativePath || !data.absolutePath) {
        throw new Error(data.error ?? "Failed to import asset.");
      }

      patchBrandingPath(control.targetPath, data.relativePath);
      if (data.manifest?.projectId) {
        updateProjectManifest(data.manifest);
      }

      const runtimeAssets = data.manifest?.runtimeAssets ?? {};
      usePreviewBridgeStore.getState().setRuntimeAssets(runtimeAssets);
      pushRuntimeAssetsToPreview();

      const messenger = usePreviewBridgeStore.getState().messenger;
      if (data.textureKey && messenger) {
        messenger.sendLoadExternalAsset(data.textureKey, data.absolutePath);
      }
    },
    [patchBrandingPath, projectId, updateProjectManifest],
  );

  const getConfig = useCallback(
    () => useConfiguratorStore.getState().config,
    [],
  );

  const subscribe = useCallback(
    (
      listener: (state: {
        config: ReturnType<typeof getConfig>;
        selectedTemplateId: typeof initialTemplateId;
      }) => void,
    ) =>
      useConfiguratorStore.subscribe((state) =>
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
      <ConfiguratorSidebar
        previewSlot={<GameChromeOverlayPanel />}
        imageUploadMode={imageUploadMode}
        onImageFile={imageUploadMode === "workspace-file" ? handleImageFile : undefined}
      />
      <CenterWorkspace
        appMode="configurator"
        initialTemplateId={initialTemplateId}
        getConfig={getConfig}
        subscribe={subscribe}
        configUpdateMode="branding-patch"
        previewSuspended={suspended}
      />
      <ConfiguratorToolsShell />
    </div>
  );
}
