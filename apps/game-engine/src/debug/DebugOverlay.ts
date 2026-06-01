import Phaser from "phaser";

export interface DebugOverlayFlags {
  hitboxes: boolean;
  origins: boolean;
  pivots: boolean;
  physicsDebug: boolean;
}

const DEFAULT_FLAGS: DebugOverlayFlags = {
  hitboxes: false,
  origins: false,
  pivots: false,
  physicsDebug: false,
};

export class DebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private flags: DebugOverlayFlags = { ...DEFAULT_FLAGS };
  private boundDraw: () => void;

  private readonly game: Phaser.Game;

  constructor(game: Phaser.Game) {
    this.game = game;
    const scene = game.scene.scenes[0];
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10_000);

    this.boundDraw = () => this.draw();
    game.events.on("poststep", this.boundDraw);
  }

  setFlags(flags: Partial<DebugOverlayFlags>): void {
    this.flags = { ...this.flags, ...flags };
    const scene = this.game.scene.scenes[0];
    if (scene.physics?.world) {
      scene.physics.world.debugGraphic?.clear();
      scene.physics.world.drawDebug = this.flags.physicsDebug;
    }
  }

  getFlags(): DebugOverlayFlags {
    return { ...this.flags };
  }

  destroy(): void {
    this.game.events.off("poststep", this.boundDraw);
    this.graphics.destroy();
  }

  private draw(): void {
    const scene = this.game.scene.scenes[0];
    if (!scene) return;

    this.graphics.clear();

    if (!this.flags.hitboxes && !this.flags.origins && !this.flags.pivots) {
      return;
    }

    for (const child of scene.children.list) {
      if (!(child instanceof Phaser.GameObjects.GameObject)) continue;
      const go = child as Phaser.GameObjects.Components.Transform &
        Phaser.GameObjects.GameObject;

      if (!("getBounds" in go) || typeof go.getBounds !== "function") continue;

      const bounds = (
        go as Phaser.GameObjects.GameObject & {
          getBounds: () => Phaser.Geom.Rectangle;
        }
      ).getBounds();

      if (this.flags.hitboxes) {
        this.graphics.lineStyle(1, 0x22c55e, 1);
        this.graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }

      if (this.flags.origins || this.flags.pivots) {
        const x = (go as Phaser.GameObjects.Sprite).x ?? bounds.centerX;
        const y = (go as Phaser.GameObjects.Sprite).y ?? bounds.centerY;
        this.graphics.fillStyle(0xef4444, 1);
        this.graphics.fillCircle(x, y, 4);
      }
    }
  }
}
