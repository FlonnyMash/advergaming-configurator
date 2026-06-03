import type { GameMasterConfig } from "@mashedgames/shared";
import type Phaser from "phaser";
import type { TemplateScene } from "../templates/types.ts";

function collectTemplateScenes(gameInstance: Phaser.Game): TemplateScene[] {
  const seen = new Set<Phaser.Scene>();
  const scenes: TemplateScene[] = [];

  for (const scene of [
    ...gameInstance.scene.getScenes(true),
    ...gameInstance.scene.getScenes(false),
  ]) {
    if (seen.has(scene)) continue;
    seen.add(scene);

    const typed = scene as TemplateScene;
    if (typeof typed.updateConfig === "function") {
      scenes.push(typed);
    }
  }

  // Bridge scenes must run before play scenes so registry-backed templates pick up changes.
  scenes.sort((a, b) => {
    const aBridge = a.scene.key.includes("legacy-bridge") ? 0 : 1;
    const bBridge = b.scene.key.includes("legacy-bridge") ? 0 : 1;
    return aBridge - bBridge;
  });

  return scenes;
}

export function updatePhaserMechanics(
  config: GameMasterConfig,
  gameInstance: Phaser.Game,
): void {
  for (const scene of collectTemplateScenes(gameInstance)) {
    scene.updateConfig!(config);
  }
}
