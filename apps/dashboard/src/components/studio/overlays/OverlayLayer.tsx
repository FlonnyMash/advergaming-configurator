"use client";

import { useConfigStore } from "@/store/useConfigStore";
import type { createDashboardMessenger } from "@/bridge/messenger";
import { HighscoreTable } from "./HighscoreTable";
import { LeadCaptureForm } from "./LeadCaptureForm";
import { StartScreen } from "./StartScreen";

type DashboardMessenger = ReturnType<typeof createDashboardMessenger>;

export interface OverlayLayerProps {
  messenger: DashboardMessenger;
}

/**
 * Renders all active HTML overlay components inside the phone screen.
 *
 * Subscribes to `useConfigStore` with a whole-config selector so any flat key
 * change (visibility toggles, text, colors, bold/italic/underline) triggers an
 * immediate re-render. Each overlay component self-gates via its own
 * `showXxx` flag and returns null when disabled.
 */
export function OverlayLayer({ messenger }: OverlayLayerProps) {
  const config = useConfigStore((state) => state.config);

  return (
    <>
      <StartScreen config={config} messenger={messenger} />
      <HighscoreTable config={config} messenger={messenger} />
      <LeadCaptureForm config={config} messenger={messenger} />
    </>
  );
}
