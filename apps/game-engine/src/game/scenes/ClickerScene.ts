import Phaser from "phaser";

export const CLICKER_SCENE_KEY = "Clicker";

export class ClickerScene extends Phaser.Scene {
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
}
