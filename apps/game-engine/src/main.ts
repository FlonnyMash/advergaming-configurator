import "./style.css";
import {
  DEFAULT_GAME_CONFIG,
  normalizeGameConfig,
  type GameConfig,
} from "@mashedgames/shared";
import Phaser from "phaser";
import { engineMessenger, setupBridge } from "./bridge/messenger.ts";
import { createGameConfig } from "./game/config.ts";
import { resolveTemplateScene } from "./game/template-registry.ts";
import { bindGamePreviewResize } from "./game/previewResize.ts";
import { getMainScene, MAIN_SCENE_KEY } from "./game/scenes/MainScene.ts";
import {
  applyOverlayConfig,
  hideStartScreen,
  initOverlayShell,
  onOverlayGameStart,
} from "./overlays/overlay-shell.ts";

/** Canonical local start event inside the iframe. Dispatched by the bridge on
 *  ENGINE_CONTROL { action: "START_GAME" } and by the built-in overlay CTA. */
const ENGINE_START_GAME_EVENT = "ENGINE_START_GAME";

let game: Phaser.Game | null = null;
let latestConfig: GameConfig = { ...DEFAULT_GAME_CONFIG };

function applyRuntimeConfig(config: GameConfig): void {
  latestConfig = config;
  applyOverlayConfig(config);
  if (game) {
    getMainScene(game)?.applyConfig(config);
  }
}

function getTemplateIdFromUrl(): string {
  return (
    new URLSearchParams(window.location.search).get("template") ??
    latestConfig.activeTemplateId
  );
}

async function ensureGame(): Promise<Phaser.Game> {
  if (game) {
    return game;
  }

  const templateId = getTemplateIdFromUrl();
  const scene = await resolveTemplateScene(templateId);

  game = new Phaser.Game(
    createGameConfig({
      parent: "game-container",
      backgroundColor: latestConfig.backgroundColor,
      scene,
    }),
  );

  bindGamePreviewResize(game);

  game.events.once("ready", () => {
    getMainScene(game!)?.applyConfig(latestConfig);
    applyOverlayConfig(latestConfig);
    engineMessenger.sendEngineReady();
  });

  return game;
}

function handleLoadTemplate(templateId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("template", templateId);
  window.location.assign(url.toString());
}

initOverlayShell();

// Single local start path: whether the start command comes from the dashboard
// React overlay (via the postMessage bridge) or the engine's built-in HTML
// overlay, ENGINE_START_GAME is the one event scenes react to.
window.addEventListener(ENGINE_START_GAME_EVENT, () => {
  hideStartScreen();
  game?.events.emit("game-start");
});

onOverlayGameStart(() => {
  window.dispatchEvent(new CustomEvent(ENGINE_START_GAME_EVENT));
});

void (async () => {
  setupBridge({
    onConfigUpdate: applyRuntimeConfig,
    getCurrentConfig: () => latestConfig,
    getCurrentTemplateId: () =>
      getTemplateIdFromUrl() as GameConfig["activeTemplateId"],
    getGame: () => game,
    onLoadTemplate: handleLoadTemplate,
  });

  await ensureGame();

  if (window.parent === window) {
    fetch("./config.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          applyRuntimeConfig(normalizeGameConfig(data, latestConfig));
        }
      })
      .catch(() => {
        applyRuntimeConfig(latestConfig);
      });
  }
})();

export { MAIN_SCENE_KEY };
