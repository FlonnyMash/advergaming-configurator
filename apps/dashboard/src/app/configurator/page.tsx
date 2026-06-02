"use client";

import { ConfiguratorProjectGate } from "@/components/configurator/ConfiguratorProjectGate";
import { ConfiguratorToolsShell } from "@/components/configurator/ConfiguratorToolsShell";
import { DevToolkitBridgeHost } from "@/components/studio/DevToolkitBridgeHost";
import { CenterWorkspace } from "@/components/shell/CenterWorkspace";
import { GameChromeOverlayPanel } from "@/components/shell/GameChromeOverlayPanel";
import {
  ConfiguratorSidebar,
  useConfiguratorStore,
} from "@advergaming/configurator-engine";
import { Suspense, useCallback } from "react";

function ConfiguratorWorkspace() {
  const initialTemplateId =
    useConfiguratorStore.getState().selectedTemplateId;
  const selectedTemplateId = useConfiguratorStore(
    (state) => state.selectedTemplateId,
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
      <DevToolkitBridgeHost resetKey={selectedTemplateId} />
      <ConfiguratorSidebar previewSlot={<GameChromeOverlayPanel />} />
      <CenterWorkspace
        appMode="configurator"
        initialTemplateId={initialTemplateId}
        getConfig={getConfig}
        subscribe={subscribe}
        configUpdateMode="branding-patch"
      />
      <ConfiguratorToolsShell />
    </div>
  );
}

export default function ConfiguratorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <ConfiguratorProjectGate>
        <ConfiguratorWorkspace />
      </ConfiguratorProjectGate>
    </Suspense>
  );
}
