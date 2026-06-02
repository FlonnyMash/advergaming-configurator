import Phaser from "phaser";

export const DEV_TOOLKIT_FROZEN_REGISTRY_KEY = "devToolkitFrozen";

export class GameFreezeController {
  private frozen = false;
  private readonly pausedSceneKeys = new Set<string>();
  readonly game: Phaser.Game;

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  setFrozen(frozen: boolean): void {
    if (this.frozen === frozen) {
      return;
    }

    this.frozen = frozen;
    this.game.registry.set(DEV_TOOLKIT_FROZEN_REGISTRY_KEY, frozen);

    if (frozen) {
      this.pausedSceneKeys.clear();

      for (const scene of this.game.scene.getScenes(true)) {
        const key = scene.scene.key;
        this.pausedSceneKeys.add(key);
        scene.physics?.world?.pause();
        scene.time.timeScale = 0;
        scene.anims.pauseAll();
        scene.tweens.pauseAll();
      }
    } else {
      for (const key of this.pausedSceneKeys) {
        const scene = this.game.scene.getScene(key);
        if (!scene) {
          continue;
        }

        scene.time.timeScale = 1;
        scene.anims.resumeAll();
        scene.tweens.resumeAll();
        scene.physics?.world?.resume();
      }

      this.pausedSceneKeys.clear();
    }

    this.game.events.emit("debugFreezeChanged", { frozen });
  }

  destroy(): void {
    this.game.registry.remove(DEV_TOOLKIT_FROZEN_REGISTRY_KEY);
    if (this.frozen) {
      this.setFrozen(false);
    }
  }
}
