import "./style.css";
import {
  DEFAULT_GAME_MASTER_CONFIG,
  getPrimaryBrandColor,
  parseGameTemplateId,
  type GameMasterConfig,
  type GameTemplateId,
} from "@advergaming/shared";
import Phaser from "phaser";
import { setupBridge, setBridgeTemplateId } from "./bridge/messenger.ts";
import {
  gameChromeOverlayManager,
  setupGameChromeBridge,
} from "./bridge/game-chrome-bridge.ts";
import { getEngineMode } from "./env/app-mode.ts";
import { createGameConfig } from "./game/config.ts";
import { bindGamePreviewResize } from "./game/previewResize.ts";
import { updatePhaserMechanics } from "./game/applyMechanics.ts";
import {
  initUIInteractions,
  restoreEngineDefaultOverlay,
  updateDomOverlays,
} from "./overlays/ui-manager.ts";
import {
  getCatalogEntry,
  getPublishedSystemDefaults,
} from "./templates/schema-index.ts";
import {
  getTemplateDefinition,
  isRegisteredTemplate,
  TEMPLATE_CATALOG_IDS,
} from "./templates/registry.ts";
import type { TemplateScene } from "./templates/types.ts";

let currentTemplateId: GameTemplateId = parseGameTemplateId(
  new URLSearchParams(window.location.search).get("game"),
  TEMPLATE_CATALOG_IDS,
);
setBridgeTemplateId(currentTemplateId);
let game: Phaser.Game | null = null;
let latestConfig: GameMasterConfig = {
  ...DEFAULT_GAME_MASTER_CONFIG,
  meta: {
    ...DEFAULT_GAME_MASTER_CONFIG.meta,
    templateId: currentTemplateId,
  },
};

let debugTeardown: (() => void) | null = null;
let previewResizeTeardown: (() => void) | null = null;
let gameBooting = false;
setupGameChromeBridge();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveGameBackgroundColor(config: GameMasterConfig): string {
  const branding = config.branding as unknown as Record<string, unknown>;
  const system = config.system as unknown as Record<string, unknown>;
  for (const catchGame of [branding.catchGame, system.catchGame]) {
    if (!isRecord(catchGame)) continue;
    const gameSection = catchGame.game;
    if (isRecord(gameSection) && typeof gameSection.backgroundColor === "string") {
      return gameSection.backgroundColor;
    }
  }
  return getPrimaryBrandColor(config);
}

function findSceneWithStart(gameInstance: Phaser.Game): TemplateScene | undefined {
  for (const scene of gameInstance.scene.scenes) {
    const typed = scene as TemplateScene;
    if (typeof typed.start === "function") {
      return typed;
    }
  }
  return undefined;
}

function applyLegacyArcadeDebug(config: GameMasterConfig): void {
  if (!game?.config.physics?.arcade) return;
  const system = config.system as unknown as Record<string, unknown>;
  const catchGame = system.catchGame;
  if (!isRecord(catchGame)) return;
  const physics = catchGame.physics;
  if (isRecord(physics) && typeof physics.debug === "boolean") {
    game.config.physics.arcade.debug = physics.debug;
  }
}

function canLoadTemplate(id: GameTemplateId): boolean {
  if (!isRegisteredTemplate(id)) return false;
  if (getEngineMode() === "studio") return true;
  const entry = getCatalogEntry(id);
  return entry?.manifest.status === "production";
}

async function mountStudioToolkit(phaserGame: Phaser.Game): Promise<void> {
  // Dashboard embeds the engine in an iframe; standalone play has no parent.
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

function loadTemplate(id: GameTemplateId, config: GameMasterConfig): void {
  if (!canLoadTemplate(id)) return;

  if (debugTeardown) {
    debugTeardown();
  }

  if (previewResizeTeardown) {
    previewResizeTeardown();
    previewResizeTeardown = null;
  }

  gameChromeOverlayManager.clear();

  if (currentTemplateId === "catch-game-demo" && id !== "catch-game-demo") {
    restoreEngineDefaultOverlay();
  }

  if (game) {
    game.destroy(true);
    game = null;
  }

  currentTemplateId = id;
  setBridgeTemplateId(id);
  latestConfig = {
    ...config,
    meta: { ...config.meta, templateId: id },
  };

  if (getEngineMode() === "configurator") {
    latestConfig.system = structuredClone(getPublishedSystemDefaults(id));
  }

  gameBooting = true;

  const { Scene } = getTemplateDefinition(id);
  game = new Phaser.Game(
    createGameConfig({
      parent: "game-container",
      backgroundColor: resolveGameBackgroundColor(latestConfig),
      scene: Scene,
    }),
  );

  previewResizeTeardown = bindGamePreviewResize(game);

  game.events.once("ready", async () => {
    gameBooting = false;
    applyLegacyArcadeDebug(latestConfig);
    if (game) {
      if (currentTemplateId !== "catch-game-demo") {
        updateDomOverlays(latestConfig);
      }
      updatePhaserMechanics(latestConfig, game);
      window.dispatchEvent(new Event("resize"));
      await mountStudioToolkit(game);
    }
  });
}

let configApplyTimer: ReturnType<typeof setTimeout> | null = null;

function applyConfigNow(config: GameMasterConfig): void {
  latestConfig = config;
  const requestedTemplateId = config.meta.templateId;

  if (requestedTemplateId !== currentTemplateId) {
    loadTemplate(requestedTemplateId, config);
    return;
  }

  if (currentTemplateId !== "catch-game-demo") {
    updateDomOverlays(config);
  }

  if (!game) {
    loadTemplate(currentTemplateId, config);
    return;
  }

  if (gameBooting) {
    return;
  }

  applyLegacyArcadeDebug(config);
  updatePhaserMechanics(config, game);
}

function applyConfig(config: GameMasterConfig): void {
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
    meta: { ...latestConfig.meta, templateId },
  });
}

window.addEventListener("GAME_START", () => {
  if (!game) return;
  findSceneWithStart(game)?.start?.();
});

setupBridge({
  onUpdate: applyConfig,
  onLoadTemplate: handleLoadTemplate,
  getCurrentConfig: () => latestConfig,
  getCurrentTemplateId: () => currentTemplateId,
});

applyConfig(latestConfig);
initUIInteractions();
