import type { GameConfig } from "@mashedgames/shared";
import Phaser from "phaser";
import type { TemplateScene } from "../types.ts";
import { rewriteLegacyAssetUrls } from "./legacyAssetUrls.ts";

export type LegacyGameConfig = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (Array.isArray(target) && Array.isArray(source)) {
    const maxLen = Math.max(target.length, source.length);
    const result: unknown[] = new Array(maxLen);

    for (let i = 0; i < maxLen; i += 1) {
      const existing = target[i];
      const incoming = source[i];

      if (incoming === undefined) {
        result[i] = existing;
        continue;
      }
      if (existing === undefined) {
        result[i] = incoming;
        continue;
      }
      if (isPlainObject(existing) && isPlainObject(incoming)) {
        result[i] = deepMerge(existing, incoming);
        continue;
      }
      result[i] = incoming;
    }

    return result;
  }

  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source;
  }

  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;

    const existing = result[key];
    if (Array.isArray(existing) && Array.isArray(value)) {
      result[key] = deepMerge(existing, value);
      continue;
    }
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
      continue;
    }
    result[key] = value;
  }

  return result;
}

function readCatchGameSlice(config: GameConfig): Record<string, unknown> {
  const slice = config.catchGame;
  return isPlainObject(slice) ? slice : {};
}

export function mergeLegacyConfigFromMaster(
  base: LegacyGameConfig,
  master: GameConfig,
): LegacyGameConfig {
  let merged = structuredClone(base) as LegacyGameConfig;
  const fromCatchGame = readCatchGameSlice(master);

  if (Object.keys(fromCatchGame).length > 0) {
    merged = deepMerge(merged, fromCatchGame) as LegacyGameConfig;
  }

  return merged;
}

export interface LegacyPlaySceneLike extends Phaser.Scene {
  applyLiveConfig?(): void;
}

export interface LegacyBridgeOptions {
  templateId: string;
  baseConfig: LegacyGameConfig;
  assetUrlPrefix: string;
  SceneClass: typeof Phaser.Scene;
  sceneKey: string;
  onMountUi?: (game: Phaser.Game, config: LegacyGameConfig) => void;
  onUnmountUi?: () => void;
}

export function createLegacyBridgeScene(
  options: LegacyBridgeOptions,
): new () => Phaser.Scene & TemplateScene {
  const {
    templateId,
    baseConfig,
    assetUrlPrefix,
    SceneClass,
    sceneKey,
    onMountUi,
    onUnmountUi,
  } = options;

  class LegacyBridgeScene extends Phaser.Scene implements TemplateScene {
    private workingConfig: LegacyGameConfig = structuredClone(baseConfig);
    private playSceneLaunched = false;

    constructor() {
      super({ key: `${templateId}-legacy-bridge` });
    }

    private resolvedConfig(): LegacyGameConfig {
      return rewriteLegacyAssetUrls(
        this.workingConfig,
        assetUrlPrefix,
      ) as LegacyGameConfig;
    }

    private getPlayScene(): LegacyPlaySceneLike | undefined {
      const scene = this.scene.get(sceneKey);
      return scene as LegacyPlaySceneLike | undefined;
    }

    private syncRegistry(): void {
      this.game.registry.set("config", this.resolvedConfig());
    }

    private launchPlayScene(): void {
      if (this.scene.get(sceneKey)) {
        this.scene.remove(sceneKey);
      }
      this.scene.add(sceneKey, SceneClass, true);
      this.playSceneLaunched = true;
    }

    create(): void {
      this.syncRegistry();
      onMountUi?.(this.game, this.resolvedConfig());
      this.launchPlayScene();

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        onUnmountUi?.();
        this.playSceneLaunched = false;
      });
    }

    updateConfig(config: GameConfig): void {
      this.workingConfig = mergeLegacyConfigFromMaster(baseConfig, config);
      this.game.registry.set("projectId", config.projectId ?? null);
      this.syncRegistry();

      const playScene = this.getPlayScene();
      if (playScene?.applyLiveConfig) {
        playScene.applyLiveConfig();
      } else if (!this.playSceneLaunched) {
        this.launchPlayScene();
      }
    }

    start(): void {
      this.game.events.emit("uiPlayRequested");
    }
  }

  return LegacyBridgeScene;
}
