import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene.ts";

function hexToPhaserColor(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export function createGameConfig(options: {
  parent: string;
  backgroundColor: string;
}): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: options.parent,
    backgroundColor: hexToPhaserColor(options.backgroundColor),
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MainScene],
  };
}
