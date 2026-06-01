import "./style.css";
import {
  DEFAULT_GAME_MASTER_CONFIG,
  parseGameTemplateId,
  type GameMasterConfig,
} from "@advergaming/shared";
import Phaser from "phaser";
import { setupBridge } from "./bridge/messenger.ts";
import { createGameConfig } from "./game/config.ts";
import { ClickerScene } from "./game/scenes/ClickerScene.ts";
import { MAIN_SCENE_KEY, MainScene } from "./game/scenes/MainScene.ts";
import { initUIInteractions, updateUI } from "./overlays/ui-manager.ts";

const activeTemplate = parseGameTemplateId(
  new URLSearchParams(window.location.search).get("game"),
);

function resolveScene(): typeof MainScene | typeof ClickerScene {
  return activeTemplate === "clicker" ? ClickerScene : MainScene;
}

let game: Phaser.Game | null = null;

function getMainScene(): MainScene | undefined {
  if (!game) return undefined;
  const scene = game.scene.getScene(MAIN_SCENE_KEY);
  return scene instanceof MainScene ? scene : undefined;
}

function applyConfig(config: GameMasterConfig): void {
  updateUI({
    ...config.domOverlay,
    primaryColor: config.theme.primaryColor,
  });

  if (!game) {
    game = new Phaser.Game(
      createGameConfig({
        parent: "game-container",
        backgroundColor: config.theme.primaryColor,
        scene: resolveScene(),
      }),
    );
    game.events.once("ready", () => {
      getMainScene()?.updateConfig(config);
    });
    return;
  }

  getMainScene()?.updateConfig(config);
}

window.addEventListener("GAME_START", () => {
  getMainScene()?.start();
});

setupBridge(applyConfig);
applyConfig(DEFAULT_GAME_MASTER_CONFIG);
initUIInteractions();
