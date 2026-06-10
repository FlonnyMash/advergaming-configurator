import Phaser from "phaser";

export const CATCH_GAME_SCENE_KEY = "catch-game-scene";

export interface CatchGameSceneInitData {
  // Add init data fields here
}

export class CatchGameScene extends Phaser.Scene {
  constructor() {
    super({ key: CATCH_GAME_SCENE_KEY });
  }

  preload(): void {
    // Load assets for Catch Game here
  }

  create(_data?: CatchGameSceneInitData): void {
    this.cameras.main.setBackgroundColor("#0f172a");
  }

  update(_time: number, _delta: number): void {
    // Game loop logic for Catch Game
  }
}
