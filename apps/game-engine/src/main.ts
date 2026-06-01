import "./style.css";
import { DEFAULT_GAME_MASTER_CONFIG, type GameMasterConfig } from "@advergaming/shared";
import Phaser from "phaser";
import { setupBridge } from "./bridge/messenger.ts";
import { createGameConfig } from "./game/config.ts";
import { MAIN_SCENE_KEY, MainScene } from "./game/scenes/MainScene.ts";
import { initUIInteractions, updateUI } from "./overlays/ui-manager.ts";

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
      }),
    );
    game.events.once("ready", () => {
      const scene = getMainScene();
      scene?.updateConfig(config.gameplay);
      scene?.updateTheme(config.theme);
    });
    return;
  }

  const scene = getMainScene();
  scene?.updateConfig(config.gameplay);
  scene?.updateTheme(config.theme);
}

window.addEventListener("GAME_START", () => {
  getMainScene()?.start();
});

setupBridge(applyConfig);
applyConfig(DEFAULT_GAME_MASTER_CONFIG);
initUIInteractions();
