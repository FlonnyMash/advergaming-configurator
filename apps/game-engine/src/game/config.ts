import Phaser from "phaser";

function hexToPhaserColor(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export function createGameConfig(options: {
  parent: string;
  backgroundColor: string;
  scene: Phaser.Types.Scenes.SceneType | Phaser.Types.Scenes.SceneType[];
}): Phaser.Types.Core.GameConfig {
  const scene = Array.isArray(options.scene) ? options.scene : [options.scene];

  return {
    type: Phaser.AUTO,
    parent: options.parent,
    backgroundColor: hexToPhaserColor(options.backgroundColor),
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene,
  };
}
