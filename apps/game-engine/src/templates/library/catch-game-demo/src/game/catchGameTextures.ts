import { isDataUrlAsset } from "@mashedgames/shared";
import Phaser from "phaser";
import { getRuntimeAssets } from "../../../../../bridge/runtime-assets.ts";
import { reloadTexture } from "../../../../../utils/AssetLoader.ts";

const PLAYER_TEXTURE_KEY = "player";
const GROUND_TEXTURE_KEY = "ground";
const GOOD_TEXTURE_PREFIX = "item-good-";
const BAD_TEXTURE_PREFIX = "item-bad-";

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

type CatchGameTextureContext = {
  projectId?: string;
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
  context: CatchGameTextureContext,
): void {
  const runtimeAssets = getRuntimeAssets();
  let pendingLoads = 0;
  let finished = false;

  const maybeFinish = () => {
    if (finished || pendingLoads > 0) return;
    finished = true;
    hooks.onGroundReady();
  };

  const trackPathLoad = (src: string) => {
    if (isDataUrlAsset(src)) {
      return;
    }
    pendingLoads += 1;
  };

  const onPathApplied = () => {
    pendingLoads = Math.max(0, pendingLoads - 1);
    maybeFinish();
  };

  const sharedOptions = {
    scene,
    projectId: context.projectId,
    runtimeAssets,
  };

  const wrapPathApplied =
    (src: string, onApplied: (key: string) => void) => (key: string) => {
      if (!isDataUrlAsset(src)) {
        onPathApplied();
      }
      onApplied(key);
    };

  trackPathLoad(assets.player);
  reloadTexture({
    ...sharedOptions,
    textureKey: isDataUrlAsset(assets.player)
      ? `${PLAYER_TEXTURE_KEY}-custom`
      : PLAYER_TEXTURE_KEY,
    src: assets.player,
    fallbackTextureKey: PLAYER_TEXTURE_KEY,
    loaderKind: "spritesheet",
    spritesheetFrame: {
      frameWidth: assets.playerSprite.frameWidth,
      frameHeight: assets.playerSprite.frameHeight,
    },
    onApplied: wrapPathApplied(assets.player, hooks.onPlayerTexture),
  });

  trackPathLoad(assets.ground.image);
  reloadTexture({
    ...sharedOptions,
    textureKey: isDataUrlAsset(assets.ground.image)
      ? `${GROUND_TEXTURE_KEY}-custom`
      : GROUND_TEXTURE_KEY,
    src: assets.ground.image,
    fallbackTextureKey: GROUND_TEXTURE_KEY,
    loaderKind: "image",
    onApplied: wrapPathApplied(assets.ground.image, () => undefined),
  });

  const applyItemSheet = (prefix: string, index: number, item: ItemConfig) => {
    const key = `${prefix}${index}`;
    trackPathLoad(item.image);
    reloadTexture({
      ...sharedOptions,
      textureKey: isDataUrlAsset(item.image) ? `${key}-custom` : key,
      src: item.image,
      fallbackTextureKey: key,
      loaderKind: "spritesheet",
      spritesheetFrame: {
        frameWidth: item.frameWidth,
        frameHeight: item.frameHeight,
      },
      onApplied: wrapPathApplied(item.image, () => undefined),
    });
  };

  assets.goodItems.forEach((item, index) =>
    applyItemSheet(GOOD_TEXTURE_PREFIX, index, item),
  );
  assets.badItems.forEach((item, index) =>
    applyItemSheet(BAD_TEXTURE_PREFIX, index, item),
  );

  if (pendingLoads === 0) {
    maybeFinish();
  }
}

export function applyCatchGameTextures(
  scene: Phaser.Scene,
  assets: CatchGameAssets,
  hooks: CatchGameTextureHooks,
  context: CatchGameTextureContext = {},
): void {
  whenLoaderIdle(scene, () =>
    applyCatchGameTexturesNow(scene, assets, hooks, context),
  );
}
