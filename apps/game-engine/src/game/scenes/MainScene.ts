import {
  resolvePhaserSceneKeys,
  type GameMasterConfig,
  type GameTemplateId,
} from "@advergaming/shared";
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
  private currentTemplateId: GameTemplateId | null = null;
  private loading = false;
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
    config: GameMasterConfig,
  ): Promise<void> {
    if (this.loading) return;

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

    this.currentTemplateId = templateId;
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
    this.onLoadComplete?.();
  }

  updateConfig(config: GameMasterConfig): void {
    if (this.loading || !this.game) return;

    if (this.currentTemplateId !== "catch-game-demo") {
      updateDomOverlays(config);
    }
    updatePhaserMechanics(config, this.game);
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
