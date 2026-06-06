import {
  isDataUrlAsset,
  resolveCatchGameEntities,
  type CatchableItem,
  type GameConfig,
  type HazardItem,
  type PlayerEntity,
} from "@mashedgames/shared";
import Phaser from "phaser";
import { resolveTextureUrl } from "../../../bridge/asset-loader.ts";
import { getRuntimeAssets } from "../../../bridge/runtime-assets.ts";
import type { TemplateScene } from "../../../templates/types.ts";
import {
  initCatchGameUi,
  unmountCatchGameOverlay,
} from "../../../templates/catch-game-demo/src/catchGameOverlay.ts";
import {
  PLAYER_TOUCH_EVENT,
  type PlayerTouchPayload,
} from "../../../templates/catch-game-demo/src/ui/touchControls.ts";

type SpawnableItem = CatchableItem | HazardItem;

const SCENE_KEY = "CatchGameScene";
const FALLBACK_CATCHABLE_KEY = "__fallback_catchable";
const FALLBACK_HAZARD_KEY = "__fallback_hazard";
const FALLBACK_PLAYER_KEY = "__fallback_player";
const PLAYER_TEXTURE_KEY = "catch_player";
const GROUND_TEXTURE_KEY = "catch_ground";
const GROUND_HEIGHT = 36;
const ITEM_DISPLAY_SIZE = 48;
const PLAYER_DISPLAY_WIDTH = 80;
const DEFAULT_SPAWN_RATE_MS = 1500;
const DEFAULT_ROUND_SECONDS = 30;

function textureKeyForItem(item: { id: string }): string {
  return `catch_entity_${item.id}`;
}

function textureKeyForPlayer(): string {
  return PLAYER_TEXTURE_KEY;
}

function entitiesSignature(
  catchableItems: CatchableItem[],
  hazardItems: HazardItem[],
  playerEntity: PlayerEntity,
): string {
  return JSON.stringify({ catchableItems, hazardItems, playerEntity });
}

export class CatchGameScene extends Phaser.Scene implements TemplateScene {
  private latestConfig: GameConfig | null = null;
  private catchableItems: CatchableItem[] = [];
  private hazardItems: HazardItem[] = [];
  private playerEntity: PlayerEntity = { assetUrl: "", speed: 320 };
  private entitySignature = "";

  private player!: Phaser.Physics.Arcade.Sprite;
  private groundCollider!: Phaser.Physics.Arcade.Sprite;
  private groundTopY = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private itemGroup!: Phaser.Physics.Arcade.Group;

  private isPlaying = false;
  private score = 0;
  private timeRemaining = DEFAULT_ROUND_SECONDS;
  private spawnTimerEvent?: Phaser.Time.TimerEvent;
  private countdownTimerEvent?: Phaser.Time.TimerEvent;
  private spawnRateMs = DEFAULT_SPAWN_RATE_MS;

  private touchActive = false;
  private touchTargetX: number | null = null;
  private uiInitialized = false;

  private readonly textureKeyByItemId = new Map<string, string>();
  private pendingTextureLoads = 0;

  private readonly onPlayRequested = (): void => {
    this.startRound();
  };

  private readonly onPlayerTouch = (payload: PlayerTouchPayload): void => {
    if (
      !this.isPlaying ||
      !this.sys.isActive() ||
      !this.player?.active
    ) {
      return;
    }

    if (payload.active) {
      this.touchActive = true;
      this.touchTargetX = payload.gameX;
      return;
    }

    this.clearTouchInput();
  };

  constructor() {
    super(SCENE_KEY);
  }

  updateConfig(config: GameConfig): void {
    if (import.meta.env.DEV) {
      console.log("[CatchGameScene] Received Config:", config.catchableItems);
    }
    this.latestConfig = config;
    const resolved = resolveCatchGameEntities(config);
    const nextSignature = entitiesSignature(
      resolved.catchableItems,
      resolved.hazardItems,
      resolved.playerEntity,
    );

    const spawnRate = this.readSpawnRateMs(config);
    const roundSeconds = this.readRoundSeconds(config);

    this.catchableItems = resolved.catchableItems;
    this.hazardItems = resolved.hazardItems;
    this.playerEntity = resolved.playerEntity;
    this.spawnRateMs = spawnRate;

    if (!this.isPlaying && this.timeRemaining <= 0) {
      this.timeRemaining = roundSeconds;
      this.emitTimer();
    }

    const bg = typeof config.themeColor === "string" ? config.themeColor : null;
    if (bg) {
      this.cameras.main.setBackgroundColor(bg);
    }

    if (nextSignature !== this.entitySignature) {
      this.entitySignature = nextSignature;
      this.loadEntityTextures(resolved.catchableItems, FALLBACK_CATCHABLE_KEY);
      this.loadEntityTextures(resolved.hazardItems, FALLBACK_HAZARD_KEY);
      this.loadPlayerTexture(resolved.playerEntity);
    } else if (this.player?.active) {
      this.applyPlayerSpeed(resolved.playerEntity.speed);
    }

    if (this.isPlaying) {
      this.restartSpawnTimer();
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.ensureFallbackTextures();
    this.createGround(width, height);

    this.physics.world.bounds.setTo(0, 0, width, height);

    this.player = this.physics.add.sprite(
      width / 2,
      this.groundTopY - PLAYER_DISPLAY_WIDTH / 2,
      FALLBACK_PLAYER_KEY,
    );
    this.player.setCollideWorldBounds(true);
    this.player.setImmovable(true);
    this.player.setGravity(0, 0);
    this.player.setDisplaySize(PLAYER_DISPLAY_WIDTH, PLAYER_DISPLAY_WIDTH);
    this.player.setDepth(1);

    this.cursors =
      this.input.keyboard?.createCursorKeys() ??
      ({} as Phaser.Types.Input.Keyboard.CursorKeys);
    this.itemGroup = this.physics.add.group({ allowGravity: false });

    this.physics.add.overlap(
      this.player,
      this.itemGroup,
      this.handleItemCaught as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    this.physics.add.overlap(
      this.itemGroup,
      this.groundCollider,
      this.handleItemHitGround as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    this.initUiIfNeeded();
    this.game.events.on(PLAYER_TOUCH_EVENT, this.onPlayerTouch);
    this.game.events.on("uiPlayRequested", this.onPlayRequested);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(PLAYER_TOUCH_EVENT, this.onPlayerTouch);
      this.game.events.off("uiPlayRequested", this.onPlayRequested);
      this.clearRoundTimers();
      this.clearTouchInput();
      if (this.uiInitialized) {
        unmountCatchGameOverlay();
        this.uiInitialized = false;
      }
    });

    this.emitScore();
    this.emitTimer();

    if (this.latestConfig) {
      this.updateConfig(this.latestConfig);
    } else {
      const defaults = resolveCatchGameEntities({
        activeTemplateId: "catch-game-demo",
      });
      this.catchableItems = defaults.catchableItems;
      this.hazardItems = defaults.hazardItems;
      this.playerEntity = defaults.playerEntity;
      this.entitySignature = entitiesSignature(
        defaults.catchableItems,
        defaults.hazardItems,
        defaults.playerEntity,
      );
    }
  }

  update(): void {
    if (!this.isPlaying || !this.player?.active) {
      return;
    }

    const speed = this.playerEntity.speed;

    if (this.touchActive && this.touchTargetX !== null) {
      const halfWidth = this.player.displayWidth / 2;
      const clampedX = Phaser.Math.Clamp(
        this.touchTargetX,
        halfWidth,
        this.scale.width - halfWidth,
      );
      this.player.x = clampedX;
      this.player.setVelocityX(0);
    } else {
      const movingLeft = this.cursors.left?.isDown ?? false;
      const movingRight = this.cursors.right?.isDown ?? false;
      const horizontalVelocity =
        (Number(movingRight) - Number(movingLeft)) * speed;
      this.player.setVelocityX(horizontalVelocity);
    }

    for (const child of this.itemGroup.getChildren()) {
      const item = child as Phaser.Physics.Arcade.Image;
      if (item.active && this.getItemBottomY(item) >= this.groundTopY) {
        item.destroy();
      }
    }
  }

  private initUiIfNeeded(): void {
    if (this.uiInitialized) {
      return;
    }
    try {
      initCatchGameUi(this.game, false);
      this.uiInitialized = true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[CatchGameScene] UI init skipped:", error);
      }
    }
  }

  private readSpawnRateMs(config: GameConfig): number {
    const raw = (config as Record<string, unknown>).itemSpawnRateMs;
    return typeof raw === "number" && raw > 0 ? raw : DEFAULT_SPAWN_RATE_MS;
  }

  private readRoundSeconds(config: GameConfig): number {
    const raw = (config as Record<string, unknown>).durationSeconds;
    return typeof raw === "number" && raw > 0 ? raw : DEFAULT_ROUND_SECONDS;
  }

  private ensureFallbackTextures(): void {
    this.ensureColoredFallback(FALLBACK_CATCHABLE_KEY, 0x22c55e);
    this.ensureColoredFallback(FALLBACK_HAZARD_KEY, 0xef4444);
    this.ensureColoredFallback(FALLBACK_PLAYER_KEY, 0x6366f1);

    if (!this.textures.exists(GROUND_TEXTURE_KEY)) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0x334155, 1);
      graphics.fillRect(0, 0, 64, GROUND_HEIGHT);
      graphics.generateTexture(GROUND_TEXTURE_KEY, 64, GROUND_HEIGHT);
      graphics.destroy();
    }
  }

  private ensureColoredFallback(key: string, color: number): void {
    if (this.textures.exists(key)) {
      return;
    }

    const size = 32;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private createGround(width: number, height: number): void {
    this.groundTopY = height - GROUND_HEIGHT;
    const groundCenterY = this.groundTopY + GROUND_HEIGHT / 2;

    this.add.tileSprite(
      width / 2,
      groundCenterY,
      width,
      GROUND_HEIGHT,
      GROUND_TEXTURE_KEY,
    );

    this.groundCollider = this.physics.add.staticSprite(
      width / 2,
      groundCenterY,
      GROUND_TEXTURE_KEY,
    );
    this.groundCollider.setDisplaySize(width, GROUND_HEIGHT);
    this.groundCollider.setVisible(false);
    this.groundCollider.refreshBody();
  }

  private resolveTextureContext(): {
    projectId?: string;
    runtimeAssets: Record<string, string>;
  } {
    return {
      projectId: this.latestConfig?.projectId,
      runtimeAssets: getRuntimeAssets(),
    };
  }

  private loadEntityTextures(
    items: SpawnableItem[],
    fallbackKey: string,
  ): void {
    for (const item of items) {
      const key = textureKeyForItem(item);
      this.textureKeyByItemId.set(item.id, key);
      this.loadAssetTexture(item.assetUrl, key, fallbackKey, (resolvedKey) => {
        this.textureKeyByItemId.set(item.id, resolvedKey);
      });
    }
  }

  private loadPlayerTexture(player: PlayerEntity): void {
    const key = textureKeyForPlayer();
    this.loadAssetTexture(player.assetUrl, key, FALLBACK_PLAYER_KEY, (resolvedKey) => {
      if (this.player?.active) {
        this.player.setTexture(resolvedKey);
        this.player.setDisplaySize(PLAYER_DISPLAY_WIDTH, PLAYER_DISPLAY_WIDTH);
      }
    });
    this.applyPlayerSpeed(player.speed);
  }

  private applyPlayerSpeed(speed: number): void {
    this.playerEntity = { ...this.playerEntity, speed };
  }

  private loadAssetTexture(
    assetUrl: string,
    textureKey: string,
    fallbackKey: string,
    onApplied?: (key: string) => void,
  ): void {
    const trimmed = assetUrl.trim();
    if (!trimmed) {
      onApplied?.(fallbackKey);
      return;
    }

    if (this.textures.exists(textureKey)) {
      onApplied?.(textureKey);
      return;
    }

    const context = this.resolveTextureContext();
    const resolvedUrl = resolveTextureUrl(trimmed, context);

    if (isDataUrlAsset(resolvedUrl)) {
      try {
        this.textures.addBase64(textureKey, resolvedUrl);
        onApplied?.(textureKey);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[CatchGameScene] Base64 texture failed:", error);
        }
        onApplied?.(fallbackKey);
      }
      return;
    }

    if (this.textures.exists(textureKey)) {
      onApplied?.(textureKey);
      return;
    }

    this.pendingTextureLoads += 1;
    this.load.once(`filecomplete-image-${textureKey}`, () => {
      this.pendingTextureLoads = Math.max(0, this.pendingTextureLoads - 1);
      onApplied?.(textureKey);
    });
    this.load.once(`loaderror`, (file: { key?: string }) => {
      if (file.key !== textureKey) {
        return;
      }
      this.pendingTextureLoads = Math.max(0, this.pendingTextureLoads - 1);
      if (import.meta.env.DEV) {
        console.warn(`[CatchGameScene] Texture load failed: ${textureKey}`);
      }
      onApplied?.(fallbackKey);
    });

    if (!this.load.isLoading()) {
      this.load.image(textureKey, resolvedUrl);
      this.load.start();
    } else {
      this.load.image(textureKey, resolvedUrl);
    }
  }

  private getSpawnPool(): SpawnableItem[] {
    const catchable = this.catchableItems.filter((item) => item.spawnWeight > 0);
    const hazard = this.hazardItems.filter((item) => item.spawnWeight > 0);
    return [...catchable, ...hazard];
  }

  private pickWeightedItem(pool: SpawnableItem[]): SpawnableItem | null {
    const totalWeight = pool.reduce((sum, item) => sum + item.spawnWeight, 0);
    if (totalWeight <= 0 || pool.length === 0) {
      return null;
    }

    let roll = Math.random() * totalWeight;
    for (const item of pool) {
      roll -= item.spawnWeight;
      if (roll <= 0) {
        return item;
      }
    }

    return pool[pool.length - 1] ?? null;
  }

  private resolveItemTextureKey(item: SpawnableItem): string {
    const mapped = this.textureKeyByItemId.get(item.id);
    if (mapped && this.textures.exists(mapped)) {
      return mapped;
    }

    const key = textureKeyForItem(item);
    if (this.textures.exists(key)) {
      return key;
    }

    const isHazard = item.scoreValue < 0;
    return isHazard ? FALLBACK_HAZARD_KEY : FALLBACK_CATCHABLE_KEY;
  }

  private spawnItem(): void {
    if (!this.isPlaying) {
      return;
    }

    const pool = this.getSpawnPool();
    const item = this.pickWeightedItem(pool);
    if (!item) {
      return;
    }

    const textureKey = this.resolveItemTextureKey(item);
    const x = Phaser.Math.Between(24, Math.max(24, this.scale.width - 24));
    const y = -16;

    const sprite = this.itemGroup.create(
      x,
      y,
      textureKey,
    ) as Phaser.Physics.Arcade.Image | null;
    if (!sprite) {
      return;
    }

    sprite.setActive(true);
    sprite.setVisible(true);
    sprite.setDisplaySize(ITEM_DISPLAY_SIZE, ITEM_DISPLAY_SIZE);
    sprite.setGravity(0, 0);
    sprite.setVelocityY(item.dropSpeed);
    sprite.setData("scoreValue", item.scoreValue);
    sprite.setData("itemId", item.id);
  }

  private startRound(): void {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.score = 0;
    this.timeRemaining = this.latestConfig
      ? this.readRoundSeconds(this.latestConfig)
      : DEFAULT_ROUND_SECONDS;
    this.itemGroup.clear(true, true);
    this.player.setVelocityX(0);
    this.clearTouchInput();

    this.emitScore();
    this.emitTimer();
    this.game.events.emit("gameStarted");

    this.restartSpawnTimer();
    this.countdownTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tickTimer,
      callbackScope: this,
    });
  }

  private restartSpawnTimer(): void {
    this.spawnTimerEvent?.remove();
    const pool = this.getSpawnPool();
    if (pool.length === 0) {
      this.spawnTimerEvent = undefined;
      return;
    }

    this.spawnTimerEvent = this.time.addEvent({
      delay: this.spawnRateMs,
      loop: true,
      callback: () => this.spawnItem(),
      callbackScope: this,
    });
  }

  private tickTimer(): void {
    if (!this.isPlaying) {
      return;
    }

    this.timeRemaining -= 1;
    this.emitTimer();

    if (this.timeRemaining <= 0) {
      this.endRound();
    }
  }

  private endRound(): void {
    if (!this.isPlaying) {
      return;
    }

    this.isPlaying = false;
    this.clearRoundTimers();
    this.itemGroup.clear(true, true);
    this.player.setVelocityX(0);
    this.clearTouchInput();
    this.game.events.emit("gameOver", { score: this.score });
  }

  private clearRoundTimers(): void {
    this.spawnTimerEvent?.remove();
    this.spawnTimerEvent = undefined;
    this.countdownTimerEvent?.remove();
    this.countdownTimerEvent = undefined;
  }

  private clearTouchInput(): void {
    this.touchActive = false;
    this.touchTargetX = null;
  }

  private handleItemHitGround(
    object1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    object2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    if (!this.isPlaying) {
      return;
    }

    const item = this.getFallingItemFromOverlap(object1, object2);
    item?.destroy();
  }

  private getFallingItemFromOverlap(
    object1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    object2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): Phaser.Physics.Arcade.Image | null {
    for (const object of [object1, object2]) {
      if (!("getData" in object)) {
        continue;
      }

      const candidate = object as Phaser.Physics.Arcade.Image;
      const scoreValue = candidate.getData("scoreValue");
      if (typeof scoreValue === "number") {
        return candidate;
      }
    }

    return null;
  }

  private handleItemCaught(
    _player: Phaser.Physics.Arcade.Body | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    itemTarget: Phaser.Physics.Arcade.Body | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    if (!this.isPlaying || !("getData" in itemTarget)) {
      return;
    }

    const item = itemTarget as Phaser.Physics.Arcade.Image;
    const scoreValue = item.getData("scoreValue");
    if (typeof scoreValue !== "number") {
      item.destroy();
      return;
    }

    item.destroy();
    this.score = Math.max(0, this.score + scoreValue);
    this.emitScore();
    this.game.events.emit("itemCaught", {
      itemId: item.getData("itemId"),
      scoreValue,
    });
  }

  private getItemBottomY(item: Phaser.Physics.Arcade.Image): number {
    const body = item.body;
    if (body) {
      return body.bottom;
    }

    return item.y + item.displayHeight / 2;
  }

  private emitScore(): void {
    this.game.events.emit("scoreUpdated", this.score);
  }

  private emitTimer(): void {
    this.game.events.emit("timerUpdated", this.timeRemaining);
  }
}
