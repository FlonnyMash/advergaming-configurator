import type { GameMasterConfig } from "@advergaming/shared";
import type Phaser from "phaser";
import { resolveTextureUrl } from "../bridge/asset-loader.ts";
import { getRuntimeAssets } from "../bridge/runtime-assets.ts";

const RESERVED_TEXTURE_KEYS = new Set([
  "__DEFAULT",
  "__MISSING",
  "__WHITE",
]);

const trackedTextureKeys = new Set<string>();

export function trackTextureKey(key: string): void {
  if (!RESERVED_TEXTURE_KEYS.has(key)) {
    trackedTextureKeys.add(key);
  }
}

export function purgeTemplateTextures(scene: Phaser.Scene): void {
  const manager = scene.textures;
  for (const key of [...trackedTextureKeys]) {
    if (manager.exists(key)) {
      manager.remove(key);
    }
    trackedTextureKeys.delete(key);
  }
}

function collectImageUrls(value: unknown, urls: Set<string>): void {
  if (typeof value === "string") {
    if (
      value.startsWith("data:") ||
      value.startsWith("http") ||
      value.startsWith("/") ||
      value.startsWith("assets/")
    ) {
      urls.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectImageUrls(item, urls);
    }
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      collectImageUrls(child, urls);
    }
  }
}

function textureKeyFromUrl(url: string, index: number): string {
  const base = url.split("/").pop()?.split("?")[0] ?? `asset-${index}`;
  const safe = base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return `tpl_${index}_${safe}`;
}

/**
 * Preload image URLs referenced in config and runtime assets before starting template scenes.
 */
export function preloadTemplateAssets(
  scene: Phaser.Scene,
  templateId: string,
  config: GameMasterConfig,
): Promise<void> {
  const urls = new Set<string>();
  collectImageUrls(config.branding, urls);
  collectImageUrls(config.system, urls);

  const runtimeAssets = getRuntimeAssets();
  for (const rel of Object.keys(runtimeAssets)) {
    urls.add(`assets/${rel.replace(/^\//, "")}`);
  }

  const entries = [...urls].map((src, index) => ({
    key: textureKeyFromUrl(src, index),
    url: resolveTextureUrl(src, runtimeAssets),
  }));

  if (entries.length === 0) {
    return Promise.resolve();
  }

  void templateId;

  return new Promise((resolve) => {
    for (const { key, url } of entries) {
      if (url.startsWith("data:")) {
        if (!scene.textures.exists(key)) {
          scene.textures.addBase64(key, url);
          trackTextureKey(key);
        }
        continue;
      }
      if (!scene.textures.exists(key)) {
        scene.load.image(key, url);
        trackTextureKey(key);
      }
    }

    if (!scene.load.isLoading() && scene.load.totalToLoad === 0) {
      resolve();
      return;
    }

    scene.load.once("complete", () => resolve());
    if (scene.load.isLoading()) {
      return;
    }
    scene.load.start();
  });
}
