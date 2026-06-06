import { CatchGameScene } from "../../../game/scenes/templates/CatchGameScene.ts";
import Phaser from "phaser";
import "./style.css";

const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: 360,
  height: 640,
  backgroundColor: "#000080",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [CatchGameScene],
};

new Phaser.Game(phaserConfig);
