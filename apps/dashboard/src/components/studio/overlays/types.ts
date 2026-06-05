import type { createDashboardMessenger } from "@/bridge/messenger";
import type { GameConfig } from "@mashedgames/shared";

export type DashboardMessenger = ReturnType<typeof createDashboardMessenger>;

export interface TemplateOverlayProps {
  config: GameConfig;
  messenger: DashboardMessenger | null;
  disabled?: boolean;
}
