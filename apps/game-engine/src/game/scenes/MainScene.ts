import Phaser from "phaser";
import type { GameConfig } from "@mashedgames/shared";

export const MAIN_SCENE_KEY = "MainScene";

export class MainScene extends Phaser.Scene {
  private runtimeConfig: GameConfig | null = null;
  private gameStarted = false;

  constructor() {
    super({ key: MAIN_SCENE_KEY });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0f172a");
    this.events.on("game-start", () => {
      this.gameStarted = true;
    });
  }

  update(_time: number, delta: number): void {
    if (!this.gameStarted || !this.runtimeConfig) {
      return;
    }
    void delta;
  }

  applyConfig(config: GameConfig): void {
    this.runtimeConfig = config;
    this.cameras.main.setBackgroundColor(config.backgroundColor);
  }
}

export function getMainScene(game: Phaser.Game): MainScene | null {
  const scene = game.scene.getScene(MAIN_SCENE_KEY);
  return scene instanceof MainScene ? scene : null;
}
