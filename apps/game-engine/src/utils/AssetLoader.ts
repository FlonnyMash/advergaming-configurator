import {
  coerceAssetReference,
  parseAssetReference,
} from "@mashedgames/shared";
import Phaser from "phaser";
import {
  resolveTextureUrl,
  type ResolveTextureContext,
} from "../bridge/asset-loader.ts";
import { reloadBase64Texture } from "../game/reloadBase64Texture.ts";

export type ReloadTextureOptions = {
  scene: Phaser.Scene;
  textureKey: string;
  src: string | null;
  fallbackTextureKey: string;
  projectId?: string;
  runtimeAssets?: Record<string, string>;
  loaderKind?: "image" | "spritesheet";
  spritesheetFrame?: { frameWidth: number; frameHeight: number };
  onApplied: (textureKey: string) => void;
};

function buildResolveContext(
  projectId?: string,
  runtimeAssets?: Record<string, string>,
): ResolveTextureContext {
  return { projectId, runtimeAssets };
}

function whenLoaderIdle(scene: Phaser.Scene, run: () => void): void {
  const loader = scene.load;
  if (!loader.isLoading()) {
    run();
    return;
  }
  loader.once(Phaser.Loader.Events.COMPLETE, run);
}

function reloadPathTextureNow(options: ReloadTextureOptions): void {
  const {
    scene,
    textureKey,
    src,
    fallbackTextureKey,
    projectId,
    runtimeAssets,
    loaderKind = "image",
    spritesheetFrame,
    onApplied,
  } = options;

  if (!src) {
    if (scene.textures.exists(textureKey)) {
      scene.textures.remove(textureKey);
    }
    onApplied(fallbackTextureKey);
    return;
  }

  const parsed = parseAssetReference(src);
  if (!parsed || parsed.kind === "inline") {
    onApplied(fallbackTextureKey);
    return;
  }

  const url = resolveTextureUrl(
    parsed.relativePath,
    buildResolveContext(projectId, runtimeAssets),
  );

  if (scene.textures.exists(textureKey)) {
    scene.textures.remove(textureKey);
  }

  const loader = scene.load;
  const onComplete = () => {
    loader.off(Phaser.Loader.Events.COMPLETE, onComplete);
    if (scene.textures.exists(textureKey)) {
      onApplied(textureKey);
    } else {
      onApplied(fallbackTextureKey);
    }
  };

  loader.off(Phaser.Loader.Events.COMPLETE, onComplete);
  loader.once(Phaser.Loader.Events.COMPLETE, onComplete);

  if (loaderKind === "spritesheet" && spritesheetFrame) {
    loader.spritesheet(textureKey, url, spritesheetFrame);
  } else {
    loader.image(textureKey, url);
  }

  if (!loader.isLoading()) {
    loader.start();
  }
}

function reloadPathTexture(options: ReloadTextureOptions): void {
  whenLoaderIdle(options.scene, () => reloadPathTextureNow(options));
}

export function reloadTexture(options: ReloadTextureOptions): void {
  const { scene, textureKey, src, fallbackTextureKey, onApplied } = options;

  if (!src) {
    if (scene.textures.exists(textureKey)) {
      scene.textures.remove(textureKey);
    }
    onApplied(fallbackTextureKey);
    return;
  }

  const ref = coerceAssetReference(src);
  if (ref.kind === "inline") {
    reloadBase64Texture({
      scene,
      textureKey,
      dataUrl: ref.dataUrl,
      fallbackTextureKey,
      onApplied,
    });
    return;
  }

  reloadPathTexture({
    ...options,
    src: ref.relativePath,
  });
}
