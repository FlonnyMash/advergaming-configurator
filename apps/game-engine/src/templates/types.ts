import type { GameMasterConfig } from "@advergaming/shared";
import type Phaser from "phaser";

export interface TemplateScene extends Phaser.Scene {
  updateConfig?(config: GameMasterConfig): void;
  start?(): void;
}
