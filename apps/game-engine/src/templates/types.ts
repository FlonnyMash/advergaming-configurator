import type { GameConfig } from "@mashedgames/shared";
import type Phaser from "phaser";

export interface TemplateScene extends Phaser.Scene {
  updateConfig?(config: GameConfig): void;
  start?(): void;
}
