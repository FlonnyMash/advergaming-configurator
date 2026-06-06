import {
  getPrimaryBrandColor,
  type GameConfig,
} from "@mashedgames/shared";
import Phaser from "phaser";
import type { TemplateScene } from "../types.ts";

export const SCENE_KEY = "Dgf";

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class DgfScene extends Phaser.Scene implements TemplateScene {
  private titleText!: Phaser.GameObjects.Text;
  private accentGraphics?: Phaser.GameObjects.Graphics;
  private motionSpeed = 200;
  private gravity = 0;

  constructor() {
    super({ key: SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;
    this.titleText = this.add
      .text(width / 2, height / 2 - 24, "dgf", {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.drawAccent();
  }

  updateConfig(config: GameConfig): void {
    this.cameras.main.setBackgroundColor(getPrimaryBrandColor(config));
    const domOverlay =
      typeof config.domOverlay === "object" && config.domOverlay !== null
        ? config.domOverlay
        : {};
    this.titleText.setText(
      typeof domOverlay.startScreenTitle === "string"
        ? domOverlay.startScreenTitle
        : "dgf",
    );
    this.motionSpeed = readNumber(
      typeof config.playerSpeed === "number" ? config.playerSpeed : undefined,
      this.motionSpeed,
    );
    const physics =
      typeof config.physics === "object" && config.physics !== null
        ? config.physics
        : {};
    const gravity =
      typeof physics.gravity === "object" && physics.gravity !== null
        ? physics.gravity
        : {};
    this.gravity = readNumber(
      typeof gravity.y === "number" ? gravity.y : undefined,
      this.gravity,
    );
    if (this.physics?.world) {
      this.physics.world.gravity.y = this.gravity;
    }
    this.drawAccent();
  }

  update(_time: number, delta: number): void {
    if (!this.accentGraphics) return;
    this.accentGraphics.rotation += this.motionSpeed * (delta / 1000) * 0.002;
  }

  private drawAccent(): void {
    const { width, height } = this.scale;
    this.accentGraphics?.destroy();
    this.accentGraphics = this.add.graphics();
    this.accentGraphics.fillStyle(0xffffff, 0.35);
    this.accentGraphics.fillCircle(width / 2, height / 2 + 36, 36);
  }
}
