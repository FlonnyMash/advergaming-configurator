"use client";

import { useStudioConfigStore } from "@mashedgames/studio-engine";
import { patchAssetLayoutToStudioStore } from "@/lib/patch-asset-layout";
import { parseEntityId, type HitboxUpdatePayload } from "@mashedgames/shared";
import { useEffect } from "react";

type HitboxMessenger = {
  onHitboxUpdated: (
    handler: (payload: HitboxUpdatePayload) => void,
  ) => () => void;
};

export interface UseHitboxInboundBridgeOptions {
  messenger: HitboxMessenger | null;
  enabled?: boolean;
  appMode: "studio" | "configurator";
}

export function useHitboxInboundBridge({
  messenger,
  enabled = true,
  appMode,
}: UseHitboxInboundBridgeOptions): void {
  useEffect(() => {
    if (!enabled || !messenger || appMode !== "studio") {
      return;
    }

    return messenger.onHitboxUpdated((payload) => {
      const binding = parseEntityId(payload.entityId);
      if (!binding) {
        return;
      }

      patchAssetLayoutToStudioStore(
        useStudioConfigStore.getState().patchBrandingPath,
        useStudioConfigStore.getState().patchSystemPath,
        binding,
        {
          hitbox: {
            width: payload.width,
            height: payload.height,
            offsetX: payload.offsetX,
            offsetY: payload.offsetY,
          },
        },
      );
    });
  }, [appMode, enabled, messenger]);
}
