import "./style.css";
import {
  DEFAULT_GAME_CONFIG,
  normalizeGameConfig,
  type GameConfig,
} from "@mashedgames/shared";
import Phaser from "phaser";
import { engineMessenger, setupBridge } from "./bridge/messenger.ts";
import { createGameConfig } from "./game/config.ts";
import { bindGamePreviewResize } from "./game/previewResize.ts";
import {
  getMainScene,
  MainScene,
  MAIN_SCENE_KEY,
} from "./game/scenes/MainScene.ts";
import {
  applyOverlayConfig,
  initOverlayShell,
  onOverlayGameStart,
} from "./overlays/overlay-shell.ts";

let game: Phaser.Game | null = null;
let latestConfig: GameConfig = { ...DEFAULT_GAME_CONFIG };

function applyRuntimeConfig(config: GameConfig): void {
  latestConfig = config;
  applyOverlayConfig(config);
  if (game) {
    getMainScene(game)?.applyConfig(config);
  }
}

function ensureGame(): Phaser.Game {
  if (game) {
    return game;
  }

  game = new Phaser.Game(
    createGameConfig({
      parent: "game-container",
      backgroundColor: latestConfig.backgroundColor,
      scene: MainScene,
    }),
  );

  bindGamePreviewResize(game);

  game.events.once("ready", () => {
    const mainScene = getMainScene(game!);
    mainScene?.applyConfig(latestConfig);
    applyOverlayConfig(latestConfig);
    engineMessenger.sendEngineReady();
  });

  onOverlayGameStart(() => {
    game?.events.emit("game-start");
  });

  return game;
}

initOverlayShell();

setupBridge({
  onConfigUpdate: applyRuntimeConfig,
  getCurrentConfig: () => latestConfig,
  getCurrentTemplateId: () => latestConfig.activeTemplateId,
  getGame: () => game,
});

ensureGame();

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

export { MAIN_SCENE_KEY };
