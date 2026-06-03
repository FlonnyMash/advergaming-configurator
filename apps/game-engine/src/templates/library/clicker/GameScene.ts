import { getPrimaryBrandColor, type GameMasterConfig } from "@mashedgames/shared";
import Phaser from "phaser";
import type { TemplateScene } from "../../types.ts";

export const CLICKER_SCENE_KEY = "Clicker";

function hexToPhaserColor(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class ClickerScene extends Phaser.Scene implements TemplateScene {
  constructor() {
    super({ key: CLICKER_SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "Clicker Engine", {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  updateConfig(payload: GameMasterConfig): void {
    this.cameras.main.setBackgroundColor(
      hexToPhaserColor(getPrimaryBrandColor(payload)),
    );
  }
}
