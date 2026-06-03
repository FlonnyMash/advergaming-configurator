import manifest from "./manifest.json";
import legacyConfig from "./public/config.json";
import { createLegacyBridgeScene } from "../../legacy/LegacyTemplateBridgeScene.ts";
import { PlayScene } from "./src/game/scenes/PlayScene.ts";
import {
  initCatchGameUi,
  unmountCatchGameOverlay,
} from "./src/catchGameOverlay.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPhysicsDebug(config: Record<string, unknown>): boolean {
  const physics = config.physics;
  return isRecord(physics) && physics.debug === true;
}

const Scene = createLegacyBridgeScene({
  templateId: manifest.id,
  baseConfig: legacyConfig as Record<string, unknown>,
  assetUrlPrefix: "/template-assets/catch-game-demo",
  SceneClass: PlayScene,
  sceneKey: "PlayScene",
  onMountUi: (game, config) => {
    initCatchGameUi(game, readPhysicsDebug(config));
  },
  onUnmountUi: () => {
    unmountCatchGameOverlay();
  },
});

export const phaserSceneMap = {
  [`${manifest.id}-legacy-bridge`]: Scene,
  PlayScene,
};

export { manifest };
export { Scene };
