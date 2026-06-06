import {
  resolvePhaserSceneKeys,
  type GameConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import Phaser from "phaser";
import { gameChromeOverlayManager } from "../../bridge/game-chrome-bridge.ts";
import { updatePhaserMechanics } from "../applyMechanics.ts";
import {
  preloadTemplateAssets,
  purgeTemplateTextures,
} from "../templateAssetLoader.ts";
import {
  restoreEngineDefaultOverlay,
  updateDomOverlays,
} from "../../overlays/ui-manager.ts";
import { getCatalogEntry } from "../../templates/schema-index.ts";
import { resolvePhaserScenes } from "./PhaserSceneRegistry.ts";
import type { TemplateScene } from "../../templates/types.ts";

export const MAIN_SCENE_KEY = "MainScene";

export type MainSceneLoadCompleteHandler = () => void;

export class MainScene extends Phaser.Scene {
  private loading = false;
  private pendingLoad: { templateId: GameTemplateId; config: GameConfig } | null = null;
  private onLoadComplete: MainSceneLoadCompleteHandler | null = null;
  private previousTemplateId: GameTemplateId | null = null;

  constructor() {
    super({ key: MAIN_SCENE_KEY });
  }

  get isLoading(): boolean {
    return this.loading;
  }

  setOnLoadComplete(handler: MainSceneLoadCompleteHandler | null): void {
    this.onLoadComplete = handler;
  }

  async loadTemplate(
    templateId: GameTemplateId,
    config: GameConfig,
  ): Promise<void> {
    if (this.loading) {
      // Last-wins: discard any previous pending and queue this one.
      this.pendingLoad = { templateId, config };
      return;
    }

    const entry = getCatalogEntry(templateId);
    if (!entry) {
      console.warn(`[MainScene] Unknown template: ${templateId}`);
      return;
    }

    this.loading = true;

    if (
      this.previousTemplateId === "catch-game-demo" &&
      templateId !== "catch-game-demo"
    ) {
      restoreEngineDefaultOverlay();
    }

    this.unmountChildScenes();
    gameChromeOverlayManager.clear();
    purgeTemplateTextures(this);

    this.previousTemplateId = templateId;

    const sceneKeys = resolvePhaserSceneKeys(entry.manifest);
    const SceneClasses = resolvePhaserScenes(sceneKeys);

    if (SceneClasses.length === 0) {
      console.warn(`[MainScene] No scenes resolved for ${templateId}`);
      this.loading = false;
      this.onLoadComplete?.();
      return;
    }

    try {
      await preloadTemplateAssets(this, templateId, config);
    } catch (err) {
      console.warn("[MainScene] Asset preload failed", err);
    }

    const primaryKey = sceneKeys[0]!;
    const PrimaryScene = SceneClasses[0]!;

    if (this.scene.get(primaryKey)) {
      this.scene.remove(primaryKey);
    }
    this.scene.add(primaryKey, PrimaryScene, true);

    if (templateId !== "catch-game-demo") {
      updateDomOverlays(config);
    }
    updatePhaserMechanics(config, this.game);

    this.loading = false;

    // If a newer template was requested while we were loading, skip
    // onLoadComplete for this intermediate result and run the pending load
    // instead. ENGINE_READY will be sent once the final template settles.
    if (this.pendingLoad) {
      const next = this.pendingLoad;
      this.pendingLoad = null;
      void this.loadTemplate(next.templateId, next.config);
      return;
    }

    this.onLoadComplete?.();
  }

  notifyConfigUpdate(config: GameConfig): void {
    for (const scene of this.scene.manager.scenes) {
      if (scene.scene.key === MAIN_SCENE_KEY) continue;
      const typed = scene as TemplateScene;
      if (typeof typed.updateConfig === "function") {
        typed.updateConfig(config);
      }
    }
  }

  private unmountChildScenes(): void {
    for (const scene of [...this.scene.manager.scenes]) {
      if (scene.scene.key === MAIN_SCENE_KEY) continue;
      if (scene.scene.isActive() || scene.scene.isVisible()) {
        scene.scene.stop();
      }
      this.scene.remove(scene.scene.key);
    }
  }
}

export function findSceneWithStart(game: Phaser.Game): TemplateScene | undefined {
  for (const scene of game.scene.scenes) {
    if (scene.scene.key === MAIN_SCENE_KEY) continue;
    const typed = scene as TemplateScene;
    if (typeof typed.start === "function") {
      return typed;
    }
  }
  return undefined;
}
