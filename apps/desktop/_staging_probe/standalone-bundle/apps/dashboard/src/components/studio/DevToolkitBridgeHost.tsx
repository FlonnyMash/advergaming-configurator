"use client";

import { useDevToolkitBridge } from "@/hooks/useDevToolkitBridge";

export interface DevToolkitBridgeHostProps {
  resetKey: string;
  enabled?: boolean;
}

/** Mount once per app page so preview ↔ dev tools stay in sync. */
export function DevToolkitBridgeHost({
  resetKey,
  enabled = true,
}: DevToolkitBridgeHostProps) {
  useDevToolkitBridge({ relayToGame: true, resetKey, enabled });
  return null;
}
