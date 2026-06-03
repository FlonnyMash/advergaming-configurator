import type { createDashboardMessenger } from "@/bridge/messenger";
import type { GameMasterConfig } from "@mashedgames/shared";

export type DashboardMessenger = ReturnType<typeof createDashboardMessenger>;

export interface TemplateOverlayProps {
  config: GameMasterConfig;
  messenger: DashboardMessenger | null;
  disabled?: boolean;
}
