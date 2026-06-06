import {
  DevToolkitAssetLayoutSchema,
  type DevToolkitAssetLayout,
  type GameConfig as BridgeGameConfig,
} from '@mashedgames/shared';
import Phaser from 'phaser';
import { applyArcadeSpriteLayout } from '../../../../../game/arcadeSpriteLayout.ts';
import type { TemplateScene } from '../../../../types.ts';
import { PLAYER_TOUCH_EVENT, type PlayerTouchPayload } from '../../ui/touchControls';
import { resolveTextureUrl } from '../../../../../bridge/asset-loader.ts';
import { getRuntimeAssets } from '../../../../../bridge/runtime-assets.ts';
import { applyCatchGameTextures } from '../catchGameTextures';

type ItemType = 'good' | 'bad';

interface SpriteFrameConfig {
  frameWidth: number;
  frameHeight: number;
  displayWidth?: number;
}

type ItemLayoutConfig = Pick<
  DevToolkitAssetLayout,
  'hitbox' | 'centerOffset' | 'rotationAnchor'
>;

interface GoodItemConfig extends SpriteFrameConfig, ItemLayoutConfig {
  image: string;
}

interface BadItemConfig extends GoodItemConfig {
  fallSpeed: number;
  rotateWhileFalling?: boolean;
  /** Degrees per second; random spin direction when omitted uses ±1. */
  fallRotationSpeed?: number;
}

interface PlayerSpriteConfig extends SpriteFrameConfig {
  /** When true, mirror the sprite while moving right; when false, mirror while moving left. */
  flipXWhenMovingRight?: boolean;
  walkAnimation: {
    start: number;
    end: number;
    frameRate: number;
  };
}

interface GroundConfig {
  image: string;
  height: number;
}

interface AssetConfig {
  ground: GroundConfig;
  player: string;
  playerSprite: PlayerSpriteConfig;
  goodItems: GoodItemConfig[];
  badItems: BadItemConfig[];
}

interface PhysicsConfig {
  debug?: boolean;
  goodItemSpawnRateMs: number;
  badItemSpawnRateMs: number;
  itemFallSpeedMin: number;
  itemFallSpeedMax: number;
}

interface GameplayConfig {
  durationSeconds: number;
  scorePerGoodItem: number;
  scorePerBadItem: number;
}

interface GameViewportConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

interface CatchGameTemplateConfig {
  game?: GameViewportConfig;
  assets: AssetConfig;
  physics: PhysicsConfig;
  gameplay: GameplayConfig;
}

interface FallingItemData {
  type: ItemType;
}

const PLAYER_TEXTURE_KEY = 'player';
const PLAYER_WALK_ANIM_KEY = 'player-walk';
const GROUND_TEXTURE_KEY = 'ground';
const GOOD_TEXTURE_PREFIX = 'item-good-';
const BAD_TEXTURE_PREFIX = 'item-bad-';

export class PlayScene extends Phaser.Scene implements TemplateScene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private groundCollider!: Phaser.Physics.Arcade.Sprite;
  private groundTopY = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private itemGroup!: Phaser.Physics.Arcade.Group;
  private config!: CatchGameTemplateConfig;
  private minFallSpeed = 0;
  private maxFallSpeed = 0;
  private isPlaying = false;
  private score = 0;
  private timeRemaining = 0;
  private goodSpawnTimerEvent?: Phaser.Time.TimerEvent;
  private badSpawnTimerEvent?: Phaser.Time.TimerEvent;
  private countdownTimerEvent?: Phaser.Time.TimerEvent;
  private touchActive = false;
  private touchTargetX: number | null = null;
  private isDebugFrozen = false;
  private textureSignature = '';
  private liveConfigReady = false;
  private readonly onPlayRequested = (): void => {
    this.startRound();
  };
  private readonly onDebugFreezeToggled = (): void => {
    if (!this.isPhysicsDebugEnabled() || !this.isPlaying) {
      return;
    }

    this.setDebugFrozen(!this.isDebugFrozen);
  };
  private isSimulationFrozen(): boolean {
    return (
      this.isDebugFrozen ||
      this.game.registry.get("devToolkitFrozen") === true
    );
  }

  private readonly onPlayerTouch = (payload: PlayerTouchPayload): void => {
    if (
      !this.isPlaying ||
      this.isSimulationFrozen() ||
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
    super('PlayScene');
  }

  updateConfig(_config: BridgeGameConfig): void {
    // Legacy bridge scene owns live config; avoid double-applying (breaks Phaser loader).
  }

  private buildTextureSignature(config: CatchGameTemplateConfig): string {
    return JSON.stringify({
      player: config.assets.player,
      ground: config.assets.ground.image,
      good: config.assets.goodItems.map((item) => item.image),
      bad: config.assets.badItems.map((item) => item.image),
    });
  }

  /** Apply physics, gameplay, and background tweaks without touching textures. */
  private applyRuntimeSettings(config: CatchGameTemplateConfig): void {
    this.config = config;

    const bg = config.game?.backgroundColor;
    if (bg) {
      this.cameras.main.setBackgroundColor(bg);
    }

    const debug = config.physics.debug === true;
    if (this.game.config.physics?.arcade) {
      this.game.config.physics.arcade.debug = debug;
    }

    this.minFallSpeed = config.physics.itemFallSpeedMin;
    this.maxFallSpeed = config.physics.itemFallSpeedMax;

    if (this.isPlaying) {
      this.goodSpawnTimerEvent = this.restartSpawnTimer(
        this.goodSpawnTimerEvent,
        "good",
        config.physics.goodItemSpawnRateMs,
      );
      this.badSpawnTimerEvent = this.restartSpawnTimer(
        this.badSpawnTimerEvent,
        "bad",
        config.physics.badItemSpawnRateMs,
      );
    } else if (!this.isPlaying && this.timeRemaining <= 0) {
      this.timeRemaining = config.gameplay.durationSeconds;
      this.emitTimer();
    }
  }

  /** Hot-reload registry config from Studio without restarting the scene. */
  applyLiveConfig(): void {
    if (!this.liveConfigReady) {
      return;
    }

    let nextConfig: CatchGameTemplateConfig;
    try {
      nextConfig = this.getConfig();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[PlayScene] Live config rejected:", error);
      }
      return;
    }

    this.applyRuntimeSettings(nextConfig);
    this.refreshActiveItemLayouts();

    const nextSignature = this.buildTextureSignature(nextConfig);
    if (nextSignature === this.textureSignature) {
      return;
    }
    this.textureSignature = nextSignature;

    try {
      const projectId = this.game.registry.get("projectId") as string | undefined;
      applyCatchGameTextures(this, nextConfig.assets, {
        onPlayerTexture: (key) => {
          if (this.player?.active) {
            this.player.setTexture(key);
            this.player.setFrame(nextConfig.assets.playerSprite.walkAnimation.start);
          }
        },
        onGroundReady: () => {
          if (this.groundCollider?.active) {
            const groundKey = this.textures.exists(`${GROUND_TEXTURE_KEY}-custom`)
              ? `${GROUND_TEXTURE_KEY}-custom`
              : GROUND_TEXTURE_KEY;
            this.groundCollider.setTexture(groundKey);
          }
        },
      }, { projectId });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[PlayScene] Texture live reload failed:", error);
      }
    }
  }

  preload(): void {
    this.config = this.getConfig();
    const runtimeAssets = getRuntimeAssets();
    const projectId = this.game.registry.get("projectId") as string | undefined;
    const resolveContext = { projectId, runtimeAssets };
    const { frameWidth, frameHeight } = this.config.assets.playerSprite;
    this.load.spritesheet(
      PLAYER_TEXTURE_KEY,
      resolveTextureUrl(this.config.assets.player, resolveContext),
      {
        frameWidth,
        frameHeight,
      },
    );

    this.config.assets.goodItems.forEach((item, index) => {
      this.load.spritesheet(
        `${GOOD_TEXTURE_PREFIX}${index}`,
        resolveTextureUrl(item.image, resolveContext),
        {
          frameWidth: item.frameWidth,
          frameHeight: item.frameHeight,
        },
      );
    });

    this.config.assets.badItems.forEach((item, index) => {
      this.load.spritesheet(
        `${BAD_TEXTURE_PREFIX}${index}`,
        resolveTextureUrl(item.image, resolveContext),
        {
          frameWidth: item.frameWidth,
          frameHeight: item.frameHeight,
        },
      );
    });

    this.load.image(
      GROUND_TEXTURE_KEY,
      resolveTextureUrl(this.config.assets.ground.image, resolveContext),
    );
  }

  create(): void {
    try {
      this.config = this.getConfig();
    } catch {
      // Keep config loaded during preload.
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const bg = this.config.game?.backgroundColor;
    if (bg) {
      this.cameras.main.setBackgroundColor(bg);
    }
    const worldBounds = this.physics.world.bounds;
    worldBounds.setTo(0, 0, width, height);

    this.createPlayerAnimations();
    this.createGround(width, height);

    const { frameWidth, frameHeight, displayWidth } = this.config.assets.playerSprite;
    const targetWidth = displayWidth ?? frameWidth;
    const targetHeight = (targetWidth / frameWidth) * frameHeight;

    this.player = this.physics.add.sprite(
      width / 2,
      this.groundTopY - targetHeight / 2,
      PLAYER_TEXTURE_KEY,
    );
    this.player.setCollideWorldBounds(true);
    this.player.setImmovable(true);
    this.player.setGravity(0, 0);
    this.player.setVelocity(0, 0);

    this.player.setDisplaySize(targetWidth, targetHeight);
    this.player.setDepth(1);
    this.player.setFrame(this.config.assets.playerSprite.walkAnimation.start);

    this.cursors = this.input.keyboard?.createCursorKeys() ?? ({} as Phaser.Types.Input.Keyboard.CursorKeys);
    this.itemGroup = this.physics.add.group({ allowGravity: false });

    this.minFallSpeed = this.config.physics.itemFallSpeedMin;
    this.maxFallSpeed = this.config.physics.itemFallSpeedMax;
    this.timeRemaining = this.config.gameplay.durationSeconds;

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

    this.game.events.on(PLAYER_TOUCH_EVENT, this.onPlayerTouch);
    this.game.events.on('uiPlayRequested', this.onPlayRequested);
    this.game.events.on('debugFreezeToggled', this.onDebugFreezeToggled);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(PLAYER_TOUCH_EVENT, this.onPlayerTouch);
      this.game.events.off('uiPlayRequested', this.onPlayRequested);
      this.game.events.off('debugFreezeToggled', this.onDebugFreezeToggled);
      this.releaseDebugFreeze();
      this.clearTouchInput();
      this.clearRoundTimers();
    });

    this.emitScore();
    this.emitTimer();

    this.textureSignature = this.buildTextureSignature(this.config);
    this.liveConfigReady = true;

    try {
      this.applyRuntimeSettings(this.getConfig());
    } catch {
      // Preload config remains active.
    }
  }

  update(): void {
    if (!this.isPlaying || this.isSimulationFrozen() || !this.player?.active) {
      return;
    }

    const speed = 320;

    if (this.touchActive && this.touchTargetX !== null) {
      const halfWidth = this.player.displayWidth / 2;
      const clampedX = Phaser.Math.Clamp(
        this.touchTargetX,
        halfWidth,
        this.scale.width - halfWidth,
      );
      const dx = clampedX - this.player.x;
      this.player.x = clampedX;
      this.player.setVelocityX(0);
      const animVelocity = Math.abs(dx) < 0.5 ? 0 : Math.sign(dx) * speed;
      this.updatePlayerAnimation(animVelocity);
    } else {
      const movingLeft = this.cursors.left?.isDown ?? false;
      const movingRight = this.cursors.right?.isDown ?? false;
      const horizontalVelocity = (Number(movingRight) - Number(movingLeft)) * speed;
      this.player.setVelocityX(horizontalVelocity);
      this.updatePlayerAnimation(horizontalVelocity);
    }

    this.itemGroup.getChildren().forEach((child) => {
      const item = child as Phaser.Physics.Arcade.Image;
      if (item.active && this.getItemBottomY(item) >= this.groundTopY) {
        item.destroy();
      }
    });
  }

  private startRound(): void {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.releaseDebugFreeze();
    this.score = 0;
    this.timeRemaining = this.config.gameplay.durationSeconds;
    this.itemGroup.clear(true, true);
    this.player.setVelocityX(0);
    this.updatePlayerAnimation(0);
    this.clearTouchInput();

    this.emitScore();
    this.emitTimer();
    this.game.events.emit('gameStarted');

    this.goodSpawnTimerEvent = this.time.addEvent({
      delay: this.config.physics.goodItemSpawnRateMs,
      loop: true,
      callback: () => this.spawnItem('good'),
      callbackScope: this,
    });

    this.badSpawnTimerEvent = this.time.addEvent({
      delay: this.config.physics.badItemSpawnRateMs,
      loop: true,
      callback: () => this.spawnItem('bad'),
      callbackScope: this,
    });

    this.countdownTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tickTimer,
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
    this.releaseDebugFreeze();
    this.clearRoundTimers();
    this.itemGroup.clear(true, true);
    this.player.setVelocityX(0);
    this.updatePlayerAnimation(0);
    this.clearTouchInput();
    this.game.events.emit('gameOver', { score: this.score });
  }

  private clearTouchInput(): void {
    this.touchActive = false;
    this.touchTargetX = null;
  }

  private isPhysicsDebugEnabled(): boolean {
    return this.config.physics.debug === true;
  }

  private setDebugFrozen(frozen: boolean): void {
    if (this.isDebugFrozen === frozen) {
      return;
    }

    this.isDebugFrozen = frozen;

    if (frozen) {
      this.physics.world.pause();
      this.time.timeScale = 0;
      this.anims.pauseAll();
      this.player.setVelocity(0, 0);
      this.clearTouchInput();
    } else {
      this.physics.world.resume();
      this.time.timeScale = 1;
      this.anims.resumeAll();
    }

    this.game.events.emit('debugFreezeChanged', { frozen });
  }

  private releaseDebugFreeze(): void {
    if (!this.isDebugFrozen) {
      if (this.time.timeScale === 0) {
        this.time.timeScale = 1;
      }
      if (this.physics.world.isPaused) {
        this.physics.world.resume();
      }
      return;
    }

    this.isDebugFrozen = false;
    this.physics.world.resume();
    this.time.timeScale = 1;
    this.anims.resumeAll();
    this.game.events.emit('debugFreezeChanged', { frozen: false });
  }

  private createGround(width: number, height: number): void {
    const groundHeight = this.config.assets.ground.height;
    this.groundTopY = height - groundHeight;
    const groundCenterY = this.groundTopY + groundHeight / 2;

    this.add.tileSprite(width / 2, groundCenterY, width, groundHeight, GROUND_TEXTURE_KEY);

    this.groundCollider = this.physics.add.staticSprite(width / 2, groundCenterY, GROUND_TEXTURE_KEY);
    this.groundCollider.setDisplaySize(width, groundHeight);
    this.groundCollider.setVisible(false);
    this.groundCollider.refreshBody();
  }

  private handleItemHitGround(
    object1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    object2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    if (!this.isPlaying) {
      return;
    }

    const item = this.getFallingItemFromOverlap(object1, object2);
    if (item?.active) {
      item.destroy();
    }
  }

  private getFallingItemFromOverlap(
    object1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    object2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): Phaser.Physics.Arcade.Image | null {
    for (const object of [object1, object2]) {
      if (!('getData' in object)) {
        continue;
      }

      const candidate = object as Phaser.Physics.Arcade.Image;
      const itemType = candidate.getData('type') as ItemType | undefined;
      if (itemType === 'good' || itemType === 'bad') {
        return candidate;
      }
    }

    return null;
  }

  private createPlayerAnimations(): void {
    const { walkAnimation } = this.config.assets.playerSprite;

    if (this.anims.exists(PLAYER_WALK_ANIM_KEY)) {
      return;
    }

    this.anims.create({
      key: PLAYER_WALK_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(PLAYER_TEXTURE_KEY, {
        start: walkAnimation.start,
        end: walkAnimation.end,
      }),
      frameRate: walkAnimation.frameRate,
      repeat: -1,
    });
  }

  private updatePlayerAnimation(horizontalVelocity: number): void {
    const idleFrame = this.config.assets.playerSprite.walkAnimation.start;

    if (horizontalVelocity === 0) {
      this.player.anims.stop();
      this.player.setFrame(idleFrame);
      return;
    }

    const flipWhenMovingRight = this.config.assets.playerSprite.flipXWhenMovingRight ?? true;
    const movingRight = horizontalVelocity > 0;
    this.player.setFlipX(flipWhenMovingRight ? movingRight : !movingRight);

    if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== PLAYER_WALK_ANIM_KEY) {
      this.player.play(PLAYER_WALK_ANIM_KEY);
    }
  }

  private restartSpawnTimer(
    timerEvent: Phaser.Time.TimerEvent | undefined,
    itemType: ItemType,
    delayMs: number,
  ): Phaser.Time.TimerEvent {
    timerEvent?.remove();
    return this.time.addEvent({
      delay: delayMs,
      loop: true,
      callback: () => this.spawnItem(itemType),
      callbackScope: this,
    });
  }

  private clearRoundTimers(): void {
    this.goodSpawnTimerEvent?.remove();
    this.goodSpawnTimerEvent = undefined;
    this.badSpawnTimerEvent?.remove();
    this.badSpawnTimerEvent = undefined;
    this.countdownTimerEvent?.remove();
    this.countdownTimerEvent = undefined;
  }

  private spawnItem(itemType: ItemType): void {
    if (!this.isPlaying) {
      return;
    }
    const { textureKey, itemConfig, itemIndex } = this.pickRandomItem(itemType);
    const x = Phaser.Math.Between(24, Math.max(24, this.scale.width - 24));
    const y = -16;

    const item = this.itemGroup.create(x, y, textureKey) as Phaser.Physics.Arcade.Image | null;
    if (!item) {
      return;
    }

    item.setActive(true);
    item.setVisible(true);
    item.setFrame(0);
    this.applyItemLayout(item, itemConfig);
    item.setGravity(0, 0);
    item.setVelocityY(this.getFallSpeed(itemType, itemConfig));
    item.setData('type', itemType);
    item.setData('catchItemType', itemType);
    item.setData('catchItemIndex', itemIndex);

    if (itemType === 'bad') {
      this.applyBadItemFallRotation(item, itemConfig as BadItemConfig);
    }
  }

  private getFallSpeed(itemType: ItemType, itemConfig: GoodItemConfig | BadItemConfig): number {
    if (itemType === 'bad') {
      return (itemConfig as BadItemConfig).fallSpeed;
    }

    return Phaser.Math.Between(this.minFallSpeed, this.maxFallSpeed);
  }

  private applyBadItemFallRotation(item: Phaser.Physics.Arcade.Image, itemConfig: BadItemConfig): void {
    if (!itemConfig.rotateWhileFalling) {
      return;
    }

    const speed = itemConfig.fallRotationSpeed ?? 120;
    const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    const body = item.body;
    if (body && 'setAllowRotation' in body) {
      body.setAllowRotation(true);
    }
    item.setAngularVelocity(speed * direction);
  }

  private getItemBottomY(item: Phaser.Physics.Arcade.Image): number {
    const body = item.body;
    if (body) {
      return body.bottom;
    }

    return item.y + item.displayHeight / 2;
  }

  private applyItemLayout(item: Phaser.Physics.Arcade.Image, itemConfig: GoodItemConfig): void {
    applyArcadeSpriteLayout(item, {
      frameWidth: itemConfig.frameWidth,
      frameHeight: itemConfig.frameHeight,
      displayWidth: itemConfig.displayWidth,
      layout: {
        hitbox: itemConfig.hitbox,
        centerOffset: itemConfig.centerOffset,
        rotationAnchor: itemConfig.rotationAnchor,
      },
    });
  }

  private pickRandomItem(itemType: ItemType): {
    textureKey: string;
    itemConfig: GoodItemConfig | BadItemConfig;
    itemIndex: number;
  } {
    const items = itemType === 'good' ? this.config.assets.goodItems : this.config.assets.badItems;
    const prefix = itemType === 'good' ? GOOD_TEXTURE_PREFIX : BAD_TEXTURE_PREFIX;

    if (items.length === 0) {
      throw new Error(`No ${itemType} items defined in config.assets.${itemType}Items`);
    }

    const index = Phaser.Math.Between(0, items.length - 1);
    return {
      textureKey: `${prefix}${index}`,
      itemConfig: items[index],
      itemIndex: index,
    };
  }

  private refreshActiveItemLayouts(): void {
    if (!this.itemGroup) {
      return;
    }

    for (const child of this.itemGroup.getChildren()) {
      const item = child as Phaser.Physics.Arcade.Image;
      const itemType = item.getData('catchItemType') as ItemType | undefined;
      const itemIndex = item.getData('catchItemIndex') as number | undefined;
      if (!itemType || itemIndex === undefined) {
        continue;
      }

      const items =
        itemType === 'good' ? this.config.assets.goodItems : this.config.assets.badItems;
      const itemConfig = items[itemIndex];
      if (!itemConfig) {
        continue;
      }

      this.applyItemLayout(item, itemConfig);
    }
  }

  private handleItemCaught(
    _player: Phaser.Physics.Arcade.Body | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    itemTarget: Phaser.Physics.Arcade.Body | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    if (!this.isPlaying || !('getData' in itemTarget)) {
      return;
    }

    const item = itemTarget as Phaser.Physics.Arcade.Image;
    const itemType = item.getData('type') as FallingItemData['type'] | undefined;
    if (!itemType) {
      item.destroy();
      return;
    }

    item.destroy();

    if (itemType === 'good') {
      this.score += this.config.gameplay.scorePerGoodItem;
    } else {
      this.score = Math.max(0, this.score - this.config.gameplay.scorePerBadItem);
    }

    this.emitScore();
    this.game.events.emit('itemCaught', { type: itemType });
  }

  private emitScore(): void {
    this.game.events.emit('scoreUpdated', this.score);
  }

  private emitTimer(): void {
    this.game.events.emit('timerUpdated', this.timeRemaining);
  }

  private getConfig(): CatchGameTemplateConfig {
    const rawConfig = this.game.registry.get('config');
    if (!rawConfig) {
      throw new Error('Game config is not available in registry under key "config".');
    }

    const config = structuredClone(rawConfig) as Partial<CatchGameTemplateConfig>;
    if (
      config.assets &&
      config.assets.goodItems &&
      !Array.isArray(config.assets.goodItems) &&
      typeof config.assets.goodItems === 'object'
    ) {
      config.assets.goodItems = Object.values(config.assets.goodItems) as GoodItemConfig[];
    }
    if (
      config.assets &&
      config.assets.badItems &&
      !Array.isArray(config.assets.badItems) &&
      typeof config.assets.badItems === 'object'
    ) {
      config.assets.badItems = Object.values(config.assets.badItems) as BadItemConfig[];
    }

    if (
      typeof config.assets?.ground?.image !== 'string' ||
      typeof config.assets.ground.height !== 'number' ||
      config.assets.ground.height <= 0 ||
      !config.assets?.player ||
      typeof config.assets.playerSprite?.frameWidth !== 'number' ||
      typeof config.assets.playerSprite?.frameHeight !== 'number' ||
      typeof config.assets.playerSprite?.walkAnimation?.start !== 'number' ||
      typeof config.assets.playerSprite?.walkAnimation?.end !== 'number' ||
      typeof config.assets.playerSprite?.walkAnimation?.frameRate !== 'number' ||
      !this.isValidGoodItems(config.assets.goodItems) ||
      !this.isValidBadItems(config.assets.badItems) ||
      typeof config.physics?.goodItemSpawnRateMs !== 'number' ||
      typeof config.physics?.badItemSpawnRateMs !== 'number' ||
      typeof config.physics.itemFallSpeedMin !== 'number' ||
      typeof config.physics.itemFallSpeedMax !== 'number' ||
      typeof config.gameplay?.durationSeconds !== 'number' ||
      typeof config.gameplay.scorePerGoodItem !== 'number' ||
      typeof config.gameplay.scorePerBadItem !== 'number'
    ) {
      throw new Error('Invalid config shape. Verify assets, physics, and gameplay values in public/config.json.');
    }

    return config as CatchGameTemplateConfig;
  }

  private isValidGoodItems(items: unknown): items is GoodItemConfig[] {
    return (
      Array.isArray(items) &&
      items.length > 0 &&
      items.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as GoodItemConfig).image === 'string' &&
          typeof (item as GoodItemConfig).frameWidth === 'number' &&
          typeof (item as GoodItemConfig).frameHeight === 'number' &&
          ((item as GoodItemConfig).displayWidth === undefined ||
            typeof (item as GoodItemConfig).displayWidth === 'number') &&
          this.isValidItemLayoutFields(item as GoodItemConfig),
      )
    );
  }

  private isValidItemLayoutFields(item: GoodItemConfig): boolean {
    const { hitbox, centerOffset, rotationAnchor } = item;
    if (hitbox === undefined && centerOffset === undefined && rotationAnchor === undefined) {
      return true;
    }

    return DevToolkitAssetLayoutSchema.safeParse({
      hitbox,
      centerOffset,
      rotationAnchor,
    }).success;
  }

  private isValidBadItems(items: unknown): items is BadItemConfig[] {
    return (
      this.isValidGoodItems(items) &&
      (items as BadItemConfig[]).every(
        (item) =>
          typeof item.fallSpeed === 'number' &&
          (item.rotateWhileFalling === undefined || typeof item.rotateWhileFalling === 'boolean') &&
          (item.fallRotationSpeed === undefined || typeof item.fallRotationSpeed === 'number'),
      )
    );
  }
}
