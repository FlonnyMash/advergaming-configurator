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

type ArcadeWorld = Phaser.Physics.Arcade.World;

function isTransformObject(
  value: unknown,
): value is Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.GameObject & {
    getBounds: () => Phaser.Geom.Rectangle;
  } {
  return (
    typeof value === "object" &&
    value !== null &&
    "getBounds" in value &&
    typeof (value as { getBounds?: unknown }).getBounds === "function"
  );
}

export class DebugOverlay {
  private flags: DebugOverlayFlags = { ...DEFAULT_FLAGS };
  private readonly boundDraw: () => void;
  private readonly game: Phaser.Game;
  private readonly graphicsBySceneKey = new Map<
    string,
    Phaser.GameObjects.Graphics
  >();

  constructor(game: Phaser.Game) {
    this.game = game;
    this.boundDraw = () => this.draw();
    game.events.on("poststep", this.boundDraw);
  }

  setFlags(flags: Partial<DebugOverlayFlags>): void {
    this.flags = { ...this.flags, ...flags };

    if ("physicsDebug" in flags) {
      this.syncPhysicsDebug(this.flags.physicsDebug);
    }
  }

  getFlags(): DebugOverlayFlags {
    return { ...this.flags };
  }

  destroy(): void {
    this.game.events.off("poststep", this.boundDraw);
    this.syncPhysicsDebug(false);

    for (const graphics of this.graphicsBySceneKey.values()) {
      graphics.destroy();
    }
    this.graphicsBySceneKey.clear();
  }

  private getOverlayScenes(): Phaser.Scene[] {
    return this.game.scene.scenes.filter(
      (scene) => scene.sys.isActive() || scene.sys.isPaused(),
    );
  }

  private forEachPhysicsWorld(
    callback: (scene: Phaser.Scene, world: ArcadeWorld) => void,
  ): void {
    for (const scene of this.getOverlayScenes()) {
      const world = scene.physics?.world;
      if (world) {
        callback(scene, world);
      }
    }
  }

  private syncPhysicsDebug(enabled: boolean): void {
    const arcadeConfig = this.game.config.physics?.arcade;
    if (arcadeConfig) {
      arcadeConfig.debug = enabled;
    }

    this.forEachPhysicsWorld((_scene, world) => {
      if (enabled) {
        if (!world.debugGraphic) {
          world.createDebugGraphic();
        } else {
          world.drawDebug = true;
          world.debugGraphic.setVisible(true);
        }
        return;
      }

      world.drawDebug = false;
      const debugGraphic = world.debugGraphic;
      if (!debugGraphic) {
        return;
      }

      debugGraphic.clear();
      debugGraphic.destroy();
      world.debugGraphic = undefined;
    });
  }

  private getGraphicsForScene(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const sceneKey = scene.scene.key;
    const existing = this.graphicsBySceneKey.get(sceneKey);
    if (existing) {
      return existing;
    }

    const graphics = scene.add.graphics();
    graphics.setDepth(10_000);
    this.graphicsBySceneKey.set(sceneKey, graphics);
    return graphics;
  }

  private draw(): void {
    const overlayScenes = this.getOverlayScenes();
    const overlaySceneKeys = new Set(
      overlayScenes.map((scene) => scene.scene.key),
    );

    for (const [sceneKey, graphics] of this.graphicsBySceneKey) {
      if (!overlaySceneKeys.has(sceneKey)) {
        graphics.destroy();
        this.graphicsBySceneKey.delete(sceneKey);
      }
    }

    const shouldDrawVisuals =
      this.flags.hitboxes || this.flags.origins || this.flags.pivots;

    for (const scene of overlayScenes) {
      const graphics = this.getGraphicsForScene(scene);
      graphics.clear();

      if (!shouldDrawVisuals) {
        continue;
      }

      for (const child of scene.children.list) {
        if (!isTransformObject(child)) continue;
        if (child === graphics) continue;

        const bounds = child.getBounds();

        if (this.flags.hitboxes) {
          graphics.lineStyle(1, 0x22c55e, 1);
          graphics.strokeRect(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
          );
        }

        if (this.flags.origins || this.flags.pivots) {
          const x = "x" in child && typeof child.x === "number" ? child.x : bounds.centerX;
          const y = "y" in child && typeof child.y === "number" ? child.y : bounds.centerY;
          graphics.fillStyle(0xef4444, 1);
          graphics.fillCircle(x, y, 4);
        }
      }
    }
  }
}
