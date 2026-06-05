import type { GameConfig } from "@mashedgames/shared";
import type Phaser from "phaser";
import { MAIN_SCENE_KEY } from "./scenes/MainScene.ts";
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

    // MainScene dispatches updates; including it would recurse infinitely.
    if (scene.scene.key === MAIN_SCENE_KEY) continue;

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

let dispatchingConfigUpdate = false;

export function updatePhaserMechanics(
  config: GameConfig,
  gameInstance: Phaser.Game,
): void {
  if (dispatchingConfigUpdate) {
    if (import.meta.env.DEV) {
      console.warn(
        "[updatePhaserMechanics] Skipped re-entrant CONFIG_UPDATED dispatch",
      );
    }
    return;
  }

  dispatchingConfigUpdate = true;
  try {
    const scenes = collectTemplateScenes(gameInstance);
    if (scenes.length === 0 && import.meta.env.DEV) {
      console.warn(
        "[updatePhaserMechanics] No template scenes registered yet — config queued until scene mount",
      );
    }
    for (const scene of scenes) {
      scene.updateConfig!(config);
    }
  } finally {
    dispatchingConfigUpdate = false;
  }
}
