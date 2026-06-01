import type { GameplayConfig, ThemeConfig } from "@advergaming/shared";
import Phaser from "phaser";

export const MAIN_SCENE_KEY = "Main";

function hexToPhaserColor(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private direction = 1;
  private playerSpeed = 200;

  constructor() {
    super({ key: MAIN_SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;
    this.player = this.add.circle(width / 2, height / 2, 24, 0xffffff);
    this.player.setStrokeStyle(4, 0x000000, 0.25);
  }

  update(_time: number, delta: number): void {
    const { width } = this.scale;
    const step = this.playerSpeed * (delta / 1000) * this.direction;
    this.player.x += step;

    const margin = 24;
    if (this.player.x >= width - margin) {
      this.player.x = width - margin;
      this.direction = -1;
    } else if (this.player.x <= margin) {
      this.player.x = margin;
      this.direction = 1;
    }
  }

  updateGameConfig(gameplay: GameplayConfig): void {
    this.playerSpeed = gameplay.playerSpeed;
  }

  updateTheme(theme: ThemeConfig): void {
    this.cameras.main.setBackgroundColor(hexToPhaserColor(theme.primaryColor));
  }
}
