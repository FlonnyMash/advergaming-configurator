import "./style.css";
import {
  DEFAULT_GAME_CONFIG,
  getPrimaryBrandColor,
  normalizeGameConfig,
  parseGameTemplateId,
  patchConfig,
  type GameConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import Phaser from "phaser";
import {
  engineMessenger,
  setupBridge,
  setBridgeTemplateId,
} from "./bridge/messenger.ts";
import { HitboxEditorController } from "./bridge/hitbox-editor-controller.ts";
import { setupGameChromeBridge } from "./bridge/game-chrome-bridge.ts";
import { getEngineMode } from "./env/app-mode.ts";
import { createGameConfig } from "./game/config.ts";
import { bindGamePreviewResize } from "./game/previewResize.ts";
import { updatePhaserMechanics } from "./game/applyMechanics.ts";
import {
  findSceneWithStart,
  MainScene,
  MAIN_SCENE_KEY,
} from "./game/scenes/MainScene.ts";
import { initUIInteractions, updateDomOverlays } from "./overlays/ui-manager.ts";
import {
  getCatalogEntry,
  getPublishedSystemDefaults,
} from "./templates/schema-index.ts";
import {
  isRegisteredTemplate,
  TEMPLATE_CATALOG_IDS,
} from "./templates/registry.ts";

let currentTemplateId: GameTemplateId = parseGameTemplateId(
  new URLSearchParams(window.location.search).get("game"),
  TEMPLATE_CATALOG_IDS,
);
setBridgeTemplateId(currentTemplateId);
let game: Phaser.Game | null = null;
let mainScene: MainScene | null = null;
let latestConfig: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  activeTemplateId: currentTemplateId,
};

let debugTeardown: (() => void) | null = null;
let hitboxEditor: HitboxEditorController | null = null;
setupGameChromeBridge();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveGameBackgroundColor(config: GameConfig): string {
  const catchGame = config.catchGame;
  if (isRecord(catchGame)) {
    const gameSection = catchGame.game;
    if (isRecord(gameSection) && typeof gameSection.backgroundColor === "string") {
      return gameSection.backgroundColor;
    }
  }
  if (typeof config.backgroundColor === "string") {
    return config.backgroundColor;
  }
  return getPrimaryBrandColor(config);
}

function applyLegacyArcadeDebug(config: GameConfig): void {
  if (!game?.config.physics?.arcade) return;
  const catchGame = config.catchGame;
  if (!isRecord(catchGame)) return;
  const physics = catchGame.physics;
  if (isRecord(physics) && typeof physics.debug === "boolean") {
    game.config.physics.arcade.debug = physics.debug;
  }
}

function freezeConfiguratorSystem(config: GameConfig, templateId: GameTemplateId): GameConfig {
  const frozen = getPublishedSystemDefaults(templateId);
  return patchConfig(config, frozen as Partial<GameConfig>);
}

function canLoadTemplate(id: GameTemplateId): boolean {
  if (!isRegisteredTemplate(id)) return false;
  if (getEngineMode() === "studio") return true;
  const entry = getCatalogEntry(id);
  return entry?.manifest.status === "production";
}

function getMainScene(): MainScene | null {
  if (!game) return null;
  const scene = game.scene.getScene(MAIN_SCENE_KEY) as MainScene | undefined;
  return scene ?? null;
}

async function mountStudioToolkit(phaserGame: Phaser.Game): Promise<void> {
  if (window.parent === window) return;

  const [
    { setupDevToolkitBridge, postDevToolkitState, postDevToolkitAssetPicked },
    { DevToolkitController },
    { AssetPickerController },
    { DebugOverlay },
    { GameFreezeController },
  ] = await Promise.all([
    import("./bridge/dev-toolkit-bridge.ts"),
    import("./debug/dev-toolkit/DevToolkitController.ts"),
    import("./debug/dev-toolkit/AssetPickerController.ts"),
    import("./debug/DebugOverlay.ts"),
    import("./debug/GameFreezeController.ts"),
  ]);

  let controller: InstanceType<typeof DevToolkitController> | null = null;
  const bridgeTeardown = setupDevToolkitBridge(() => controller);

  const overlay = new DebugOverlay(phaserGame);
  const freeze = new GameFreezeController(phaserGame);
  const assetPicker = new AssetPickerController(
    phaserGame,
    (asset) => {
      postDevToolkitAssetPicked(asset);
    },
    () => latestConfig,
  );
  controller = new DevToolkitController(overlay, freeze, assetPicker, () => {
    if (controller) {
      postDevToolkitState(controller.getState());
    }
  });

  debugTeardown = () => {
    bridgeTeardown();
    controller?.destroy();
    controller = null;
    freeze.destroy();
    overlay.destroy();
    debugTeardown = null;
  };
}

function ensureGame(): void {
  if (game) return;

  game = new Phaser.Game(
    createGameConfig({
      parent: "game-container",
      backgroundColor: resolveGameBackgroundColor(latestConfig),
      scene: MainScene,
    }),
  );

  bindGamePreviewResize(game);

  game.events.once("ready", async () => {
    mainScene = getMainScene();
    if (!mainScene) return;

    mainScene.setOnLoadComplete(() => {
      applyLegacyArcadeDebug(latestConfig);
      applyConfigNow(latestConfig);
      if (game) {
        if (!hitboxEditor) {
          hitboxEditor = new HitboxEditorController(game, () => latestConfig);
        }
        window.dispatchEvent(new Event("resize"));
        void mountStudioToolkit(game);
        engineMessenger.sendEngineReady();
      }
    });

    void mainScene.loadTemplate(currentTemplateId, latestConfig);
  });
}

function loadTemplate(
  id: GameTemplateId,
  config: GameConfig,
  options?: { preserveSystem?: boolean },
): void {
  if (!canLoadTemplate(id)) return;

  if (debugTeardown) {
    debugTeardown();
    debugTeardown = null;
  }

  currentTemplateId = id;
  setBridgeTemplateId(id);
  latestConfig = {
    ...config,
    activeTemplateId: id,
  };

  if (!options?.preserveSystem && getEngineMode() === "configurator") {
    latestConfig = freezeConfiguratorSystem(latestConfig, id);
  }

  game?.registry.set("config", latestConfig);
  game?.registry.set("projectId", latestConfig.projectId ?? null);

  ensureGame();

  const scene = getMainScene();
  if (scene) {
    void scene.loadTemplate(id, latestConfig);
  }
}

let configApplyTimer: ReturnType<typeof setTimeout> | null = null;

function applyConfigNow(config: GameConfig): void {
  latestConfig = config;
  const requestedTemplateId = config.activeTemplateId;

  // Template scenes own registry shape (legacy bridge writes CatchGameTemplateConfig).
  game?.registry.set("projectId", latestConfig.projectId ?? null);

  if (requestedTemplateId !== currentTemplateId) {
    loadTemplate(requestedTemplateId, config);
    return;
  }

  ensureGame();

  const scene = getMainScene();
  if (scene?.isLoading) {
    // latestConfig is stored; onLoadComplete will call applyConfigNow again.
    return;
  }

  if (currentTemplateId !== "catch-game-demo") {
    updateDomOverlays(config);
  }

  if (!game) {
    loadTemplate(currentTemplateId, config);
    return;
  }

  applyLegacyArcadeDebug(config);
  updatePhaserMechanics(config, game);
}

function applyConfig(config: GameConfig): void {
  if (configApplyTimer) {
    clearTimeout(configApplyTimer);
  }
  configApplyTimer = setTimeout(() => {
    configApplyTimer = null;
    applyConfigNow(config);
  }, 80);
}

function handleLoadTemplate(templateId: GameTemplateId): void {
  if (!canLoadTemplate(templateId)) return;
  if (configApplyTimer) {
    clearTimeout(configApplyTimer);
    configApplyTimer = null;
  }
  loadTemplate(templateId, {
    ...latestConfig,
    activeTemplateId: templateId,
  });
}

window.addEventListener("GAME_START", () => {
  if (!game) return;
  findSceneWithStart(game)?.start?.();
});

setupBridge({
  onConfigUpdate: applyConfig,
  onLoadTemplate: handleLoadTemplate,
  getCurrentConfig: () => latestConfig,
  getCurrentTemplateId: () => currentTemplateId,
  getGame: () => game,
});

async function bootstrapStandaloneExport(): Promise<void> {
  if (window.parent !== window) {
    loadTemplate(currentTemplateId, latestConfig);
    return;
  }

  try {
    const response = await fetch(new URL("./config.json", window.location.href));
    if (!response.ok) {
      loadTemplate(currentTemplateId, latestConfig);
      return;
    }

    const data: unknown = await response.json();
    const urlTemplateId = parseGameTemplateId(
      new URLSearchParams(window.location.search).get("game"),
      TEMPLATE_CATALOG_IDS,
    );
    const config = normalizeGameConfig(data, urlTemplateId);
    if (!config) {
      console.warn("[engine] config.json is not a valid GameConfig.");
      loadTemplate(currentTemplateId, latestConfig);
      return;
    }

    const templateId = parseGameTemplateId(
      config.activeTemplateId,
      TEMPLATE_CATALOG_IDS,
    );
    loadTemplate(templateId, config, { preserveSystem: true });
  } catch (error) {
    console.warn("[engine] Failed to load standalone config.json", error);
    loadTemplate(currentTemplateId, latestConfig);
  }
}

void bootstrapStandaloneExport();
initUIInteractions();
