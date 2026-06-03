import { resolveTextureUrl } from "../../../../../bridge/asset-loader.ts";
import { getRuntimeAssets } from "../../../../../bridge/runtime-assets.ts";
import { reloadBase64Texture } from "../../../../../game/reloadBase64Texture.ts";
import Phaser from "phaser";

const PLAYER_TEXTURE_KEY = "player";
const GROUND_TEXTURE_KEY = "ground";
const GOOD_TEXTURE_PREFIX = "item-good-";
const BAD_TEXTURE_PREFIX = "item-bad-";

function isDataUrl(src: string): boolean {
  return src.startsWith("data:");
}

type ItemConfig = {
  image: string;
  frameWidth: number;
  frameHeight: number;
};

type CatchGameAssets = {
  ground: { image: string };
  player: string;
  playerSprite: { frameWidth: number; frameHeight: number };
  goodItems: ItemConfig[];
  badItems: ItemConfig[];
};

type CatchGameTextureHooks = {
  onPlayerTexture: (key: string) => void;
  onGroundReady: () => void;
};

function whenLoaderIdle(scene: Phaser.Scene, run: () => void): void {
  const loader = scene.load;
  if (!loader.isLoading()) {
    run();
    return;
  }

  loader.once(Phaser.Loader.Events.COMPLETE, run);
}

function applyCatchGameTexturesNow(
  scene: Phaser.Scene,
  assets: CatchGameAssets,
  hooks: CatchGameTextureHooks,
): void {
  const loader = scene.load;
  let pendingLoads = 0;
  let finished = false;

  const maybeFinish = () => {
    if (finished || pendingLoads > 0) return;
    finished = true;
    hooks.onGroundReady();
  };

  const queueLoad = () => {
    pendingLoads += 1;
  };

  const finishLoad = () => {
    pendingLoads = Math.max(0, pendingLoads - 1);
    maybeFinish();
  };

  const applyPlayer = (src: string) => {
    if (isDataUrl(src)) {
      reloadBase64Texture({
        scene,
        textureKey: `${PLAYER_TEXTURE_KEY}-custom`,
        dataUrl: src,
        fallbackTextureKey: PLAYER_TEXTURE_KEY,
        onApplied: hooks.onPlayerTexture,
      });
      return;
    }

    if (scene.textures.exists(PLAYER_TEXTURE_KEY)) {
      scene.textures.remove(PLAYER_TEXTURE_KEY);
    }
    queueLoad();
    loader.spritesheet(
      PLAYER_TEXTURE_KEY,
      resolveTextureUrl(src, getRuntimeAssets()),
      {
        frameWidth: assets.playerSprite.frameWidth,
        frameHeight: assets.playerSprite.frameHeight,
      },
    );
  };

  const applyGround = (src: string) => {
    if (isDataUrl(src)) {
      reloadBase64Texture({
        scene,
        textureKey: `${GROUND_TEXTURE_KEY}-custom`,
        dataUrl: src,
        fallbackTextureKey: GROUND_TEXTURE_KEY,
        onApplied: () => undefined,
      });
      return;
    }

    if (scene.textures.exists(GROUND_TEXTURE_KEY)) {
      scene.textures.remove(GROUND_TEXTURE_KEY);
    }
    queueLoad();
    loader.image(
      GROUND_TEXTURE_KEY,
      resolveTextureUrl(src, getRuntimeAssets()),
    );
  };

  const applyItemSheet = (prefix: string, index: number, item: ItemConfig) => {
    const key = `${prefix}${index}`;
    const src = item.image;

    if (isDataUrl(src)) {
      reloadBase64Texture({
        scene,
        textureKey: `${key}-custom`,
        dataUrl: src,
        fallbackTextureKey: key,
        onApplied: () => undefined,
      });
      return;
    }

    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    queueLoad();
    loader.spritesheet(key, resolveTextureUrl(src, getRuntimeAssets()), {
      frameWidth: item.frameWidth,
      frameHeight: item.frameHeight,
    });
  };

  applyPlayer(assets.player);
  applyGround(assets.ground.image);
  assets.goodItems.forEach((item, index) =>
    applyItemSheet(GOOD_TEXTURE_PREFIX, index, item),
  );
  assets.badItems.forEach((item, index) =>
    applyItemSheet(BAD_TEXTURE_PREFIX, index, item),
  );

  if (pendingLoads > 0) {
    loader.once(Phaser.Loader.Events.COMPLETE, finishLoad);
    loader.start();
  } else {
    maybeFinish();
  }
}

export function applyCatchGameTextures(
  scene: Phaser.Scene,
  assets: CatchGameAssets,
  hooks: CatchGameTextureHooks,
): void {
  whenLoaderIdle(scene, () => applyCatchGameTexturesNow(scene, assets, hooks));
}
