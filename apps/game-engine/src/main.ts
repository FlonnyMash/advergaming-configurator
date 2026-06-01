import "./style.css";
import {
  DEFAULT_GAME_MASTER_CONFIG,
  getDomOverlayForUi,
  getPrimaryBrandColor,
  parseGameTemplateId,
  type GameMasterConfig,
  type GameTemplateId,
} from "@advergaming/shared";
import Phaser from "phaser";
import { setupBridge, setBridgeTemplateId } from "./bridge/messenger.ts";
import { getEngineMode } from "./env/app-mode.ts";
import { createGameConfig } from "./game/config.ts";
import { initUIInteractions, updateUI } from "./overlays/ui-manager.ts";
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
let game: Phaser.Game | null = null;
let latestConfig: GameMasterConfig = {
  ...DEFAULT_GAME_MASTER_CONFIG,
  meta: {
    ...DEFAULT_GAME_MASTER_CONFIG.meta,
    templateId: currentTemplateId,
  },
};

let debugTeardown: (() => void) | null = null;

function getActiveScene(): TemplateScene | undefined {
  if (!game) return undefined;
  const activeScenes = game.scene.getScenes(true);
  const scene = activeScenes[0] ?? game.scene.getScenes(false)[0];
  return scene as TemplateScene | undefined;
}

function canLoadTemplate(id: GameTemplateId): boolean {
  if (!isRegisteredTemplate(id)) return false;
  if (getEngineMode() === "studio") return true;
  const entry = getCatalogEntry(id);
  return entry?.manifest.status === "production";
}

async function mountStudioToolkit(phaserGame: Phaser.Game): Promise<void> {
  if (getEngineMode() !== "studio") return;
  const [{ mountDevToolkit }, { DebugOverlay }] = await Promise.all([
    import("./debug/dev-toolkit/DevToolkitHost.ts"),
    import("./debug/DebugOverlay.ts"),
  ]);
  const overlay = new DebugOverlay(phaserGame);
  const toolkit = mountDevToolkit(overlay);
  debugTeardown = () => {
    toolkit.destroy();
    overlay.destroy();
    debugTeardown = null;
  };
}

function loadTemplate(id: GameTemplateId, config: GameMasterConfig): void {
  if (!canLoadTemplate(id)) return;

  if (debugTeardown) {
    debugTeardown();
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

  const { Scene } = getTemplateDefinition(id);
  game = new Phaser.Game(
    createGameConfig({
      parent: "game-container",
      backgroundColor: getPrimaryBrandColor(latestConfig),
      scene: Scene,
    }),
  );

  game.events.once("ready", async () => {
    getActiveScene()?.updateConfig?.(latestConfig);
    if (game) {
      await mountStudioToolkit(game);
    }
  });
}

function applyConfig(config: GameMasterConfig): void {
  latestConfig = config;
  updateUI(getDomOverlayForUi(config));

  if (!game) {
    loadTemplate(currentTemplateId, config);
    return;
  }

  getActiveScene()?.updateConfig?.(config);
}

function handleLoadTemplate(templateId: GameTemplateId): void {
  if (!canLoadTemplate(templateId)) return;
  loadTemplate(templateId, latestConfig);
}

window.addEventListener("GAME_START", () => {
  getActiveScene()?.start?.();
});

setupBridge({
  onUpdate: applyConfig,
  onLoadTemplate: handleLoadTemplate,
  getCurrentConfig: () => latestConfig,
  getCurrentTemplateId: () => currentTemplateId,
});

applyConfig(latestConfig);
initUIInteractions();
