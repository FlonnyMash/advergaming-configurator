import Phaser from "phaser";
import type { GameConfig } from "@mashedgames/shared";

export const CATCH_GAME_SCENE_KEY = "catch-game-scene";

/** Local DOM event dispatched by the engine bridge when the dashboard overlay
 *  sends ENGINE_CONTROL { action: "START_GAME" } across the iframe boundary. */
export const ENGINE_START_GAME_EVENT = "ENGINE_START_GAME";

const ITEM_FALL_SPEED = 260;
const ITEM_SPAWN_INTERVAL_MS = 700;
const ITEM_RADIUS = 14;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 18;
const PADDLE_BOTTOM_MARGIN = 36;

export interface CatchGameSceneInitData {
  config?: GameConfig;
}

export class CatchGameScene extends Phaser.Scene {
  private paddle: Phaser.GameObjects.Rectangle | null = null;
  private items: Phaser.Physics.Arcade.Group | null = null;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private runtimeConfig: GameConfig | null = null;
  private gameStarted = false;
  private score = 0;

  /** Stable reference so the window listener can be removed on shutdown. */
  private readonly handleEngineStartGame = (): void => {
    this.startGame();
  };

  private readonly handleBridgeConfigUpdate = (config: GameConfig): void => {
    this.applyConfig(config);
  };

  constructor() {
    super({ key: CATCH_GAME_SCENE_KEY });
  }

  init(data?: CatchGameSceneInitData): void {
    if (data?.config) {
      this.runtimeConfig = data.config;
    }
  }

  preload(): void {
    // All visuals are generated at runtime — no binary assets to load.
  }

  create(): void {
    this.cameras.main.setBackgroundColor(
      this.runtimeConfig?.backgroundColor ?? "#0f172a",
    );

    this.createPaddle();
    this.items = this.physics.add.group();

    if (this.paddle) {
      this.physics.add.overlap(this.paddle, this.items, (_paddle, item) => {
        this.catchItem(item as Phaser.GameObjects.Arc);
      });
    }

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.movePaddleTo(pointer.x);
    });

    // Drop spawner stays dormant until START_GAME arrives over the bridge.
    this.spawnTimer = this.time.addEvent({
      delay: ITEM_SPAWN_INTERVAL_MS,
      loop: true,
      paused: true,
      callback: () => {
        this.spawnItem();
      },
    });

    // Hold the simulation until the React overlay's Start button fires
    // ENGINE_CONTROL -> ENGINE_START_GAME inside this iframe.
    this.physics.world.pause();

    window.addEventListener(ENGINE_START_GAME_EVENT, this.handleEngineStartGame);
    this.game.events.on("bridge:config-update", this.handleBridgeConfigUpdate);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.teardown();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.teardown();
    });
  }

  update(): void {
    if (!this.gameStarted || !this.items) {
      return;
    }

    const cullY = this.scale.height + ITEM_RADIUS * 2;
    for (const item of this.items.getChildren()) {
      const arc = item as Phaser.GameObjects.Arc;
      if (arc.y > cullY) {
        this.items.remove(arc, true, true);
      }
    }
  }

  applyConfig(config: GameConfig): void {
    this.runtimeConfig = config;
    this.cameras.main.setBackgroundColor(config.backgroundColor);
    this.paddle?.setFillStyle(
      Phaser.Display.Color.HexStringToColor(config.themeColor).color,
    );
  }

  private startGame(): void {
    if (this.gameStarted || !this.sys.isActive()) {
      return;
    }
    this.gameStarted = true;
    this.score = 0;

    // Unpause the physics simulation and start dropping items.
    this.physics.world.resume();
    if (this.spawnTimer) {
      this.spawnTimer.paused = false;
    }
  }

  private createPaddle(): void {
    const themeColor = this.runtimeConfig?.themeColor ?? "#6366f1";
    this.paddle = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height - PADDLE_BOTTOM_MARGIN,
      PADDLE_WIDTH,
      PADDLE_HEIGHT,
      Phaser.Display.Color.HexStringToColor(themeColor).color,
    );
    this.physics.add.existing(this.paddle, false);

    const body = this.paddle.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
  }

  private movePaddleTo(x: number): void {
    if (!this.paddle) return;
    const halfWidth = PADDLE_WIDTH / 2;
    this.paddle.x = Phaser.Math.Clamp(x, halfWidth, this.scale.width - halfWidth);
    (this.paddle.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
  }

  private spawnItem(): void {
    if (!this.items || !this.gameStarted) {
      return;
    }

    const x = Phaser.Math.Between(ITEM_RADIUS, Math.max(ITEM_RADIUS, this.scale.width - ITEM_RADIUS));
    const item = this.add.circle(x, -ITEM_RADIUS, ITEM_RADIUS, 0xfacc15);
    this.items.add(item);

    const body = item.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityY(ITEM_FALL_SPEED + Phaser.Math.Between(-40, 80));
  }

  private catchItem(item: Phaser.GameObjects.Arc): void {
    this.items?.remove(item, true, true);
    this.score += 1;
  }

  private teardown(): void {
    window.removeEventListener(ENGINE_START_GAME_EVENT, this.handleEngineStartGame);
    this.game.events.off("bridge:config-update", this.handleBridgeConfigUpdate);
    this.spawnTimer?.remove();
    this.spawnTimer = null;
    this.paddle = null;
    this.items = null;
    this.gameStarted = false;
  }
}
