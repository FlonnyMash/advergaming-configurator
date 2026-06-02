"use client";

import { StudioToolsPanel } from "@/components/studio/StudioToolsPanel";
import { DevicePreview } from "@/components/shell/DevicePreview";
import { GameChromeOverlayPanel } from "@/components/shell/GameChromeOverlayPanel";
import { getAppEnv } from "@/lib/env";
import { StudioSidebar, useStudioConfigStore } from "@advergaming/studio-engine";
import { useCallback } from "react";

export default function StudioPage() {
  const initialTemplateId = useStudioConfigStore.getState().selectedTemplateId;

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
      <StudioSidebar previewSlot={<GameChromeOverlayPanel />} />
      <DevicePreview
        appMode="studio"
        initialTemplateId={initialTemplateId}
        getConfig={getConfig}
        subscribe={subscribe}
        configUpdateMode="full"
      />
      <StudioToolsPanel catalogEnv={getAppEnv()} />
    </div>
  );
}
