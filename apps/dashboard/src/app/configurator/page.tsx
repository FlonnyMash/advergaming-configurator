"use client";

import { DevicePreview } from "@/components/shell/DevicePreview";
import {
  ConfiguratorSidebar,
  useConfiguratorStore,
} from "@advergaming/configurator-engine";

export default function ConfiguratorPage() {
  const initialTemplateId =
    useConfiguratorStore.getState().selectedTemplateId;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <ConfiguratorSidebar />
      <DevicePreview
        appMode="configurator"
        initialTemplateId={initialTemplateId}
        getConfig={() => useConfiguratorStore.getState().config}
        subscribe={(listener) =>
          useConfiguratorStore.subscribe((state) =>
            listener({
              config: state.config,
              selectedTemplateId: state.selectedTemplateId,
            }),
          )
        }
        configUpdateMode="branding-patch"
      />
    </div>
  );
}
