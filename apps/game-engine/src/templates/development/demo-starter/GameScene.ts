import { getPrimaryBrandColor, type GameMasterConfig } from "@mashedgames/shared";
import Phaser from "phaser";
import type { TemplateScene } from "../../types.ts";

export const DEMO_STARTER_SCENE_KEY = "DemoStarter";

function hexToPhaserColor(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class DemoStarterScene extends Phaser.Scene implements TemplateScene {
  private titleText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: DEMO_STARTER_SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;
    this.titleText = this.add
      .text(width / 2, height / 2, "Demo Starter", {
        fontSize: "28px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  updateConfig(payload: GameMasterConfig): void {
    this.cameras.main.setBackgroundColor(
      hexToPhaserColor(getPrimaryBrandColor(payload)),
    );
    this.titleText.setText(payload.branding.domOverlay.startScreenTitle);
  }
}
