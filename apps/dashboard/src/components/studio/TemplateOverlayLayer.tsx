"use client";

import { usePreviewBridgeStore } from "@/lib/preview-bridge-store";
import { useTemplateBridgeStore } from "@/store/useTemplateBridgeStore";
import type { TemplateManifest } from "@advergaming/shared";
import { resolveOverlayComponent } from "./OverlayRegistry";
import type { TemplateOverlayProps } from "./overlays/types";

export interface TemplateOverlayLayerProps {
  manifest: TemplateManifest | null;
  getConfig: () => TemplateOverlayProps["config"];
}

export function TemplateOverlayLayer({
  manifest,
  getConfig,
}: TemplateOverlayLayerProps) {
  const messenger = usePreviewBridgeStore((s) => s.messenger);
  const templateChangeInProgress = useTemplateBridgeStore(
    (s) => s.templateChangeInProgress,
  );

  if (!manifest || manifest.uiOverlayComponents.length === 0) {
    return null;
  }

  const config = getConfig();

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {manifest.uiOverlayComponents.map((key) => {
        const Component = resolveOverlayComponent(key);
        if (!Component) return null;
        return (
          <Component
            key={key}
            config={config}
            messenger={messenger}
            disabled={templateChangeInProgress}
          />
        );
      })}
    </div>
  );
}
