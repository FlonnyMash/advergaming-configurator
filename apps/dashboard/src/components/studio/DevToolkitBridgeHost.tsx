"use client";

import { useDevToolkitBridge } from "@/hooks/useDevToolkitBridge";

export interface DevToolkitBridgeHostProps {
  resetKey: string;
}

/** Mount once per app page so preview ↔ dev tools stay in sync. */
export function DevToolkitBridgeHost({ resetKey }: DevToolkitBridgeHostProps) {
  useDevToolkitBridge({ relayToGame: true, resetKey });
  return null;
}
