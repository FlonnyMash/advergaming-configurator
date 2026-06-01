"use client";

import { DevicePreview } from "@/components/shell/DevicePreview";
import { getAppEnv } from "@/lib/env";
import { StudioSidebar, useStudioConfigStore } from "@advergaming/studio-engine";

export default function StudioPage() {
  const initialTemplateId = useStudioConfigStore.getState().selectedTemplateId;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <StudioSidebar catalogEnv={getAppEnv()} />
      <DevicePreview
        appMode="studio"
        initialTemplateId={initialTemplateId}
        getConfig={() => useStudioConfigStore.getState().config}
        subscribe={(listener) =>
          useStudioConfigStore.subscribe((state) =>
            listener({
              config: state.config,
              selectedTemplateId: state.selectedTemplateId,
            }),
          )
        }
        configUpdateMode="full"
      />
    </div>
  );
}
