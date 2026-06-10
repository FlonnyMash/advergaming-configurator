import Phaser from "phaser";

export const FG_SCENE_KEY = "fg-scene";

export interface FgSceneInitData {
  // Add init data fields here
}

export class FgScene extends Phaser.Scene {
  constructor() {
    super({ key: FG_SCENE_KEY });
  }

  preload(): void {
    // Load assets for fg here
  }

  create(_data?: FgSceneInitData): void {
    this.cameras.main.setBackgroundColor("#0f172a");
  }

  update(_time: number, _delta: number): void {
    // Game loop logic for fg
  }
}
