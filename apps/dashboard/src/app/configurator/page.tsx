"use client";

import { DevicePreview } from "@/components/shell/DevicePreview";
import { GameChromeOverlayPanel } from "@/components/shell/GameChromeOverlayPanel";
import {
  ConfiguratorSidebar,
  ConfiguratorToolsPanel,
  useConfiguratorStore,
} from "@advergaming/configurator-engine";
import { useCallback } from "react";

export default function ConfiguratorPage() {
  const initialTemplateId =
    useConfiguratorStore.getState().selectedTemplateId;

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
      <ConfiguratorSidebar previewSlot={<GameChromeOverlayPanel />} />
      <DevicePreview
        appMode="configurator"
        initialTemplateId={initialTemplateId}
        getConfig={getConfig}
        subscribe={subscribe}
        configUpdateMode="branding-patch"
      />
      <ConfiguratorToolsPanel />
    </div>
  );
}
