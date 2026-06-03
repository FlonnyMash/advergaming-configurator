import {
  AssetReadyPayloadSchema,
  BRIDGE_MESSAGE_TYPE,
} from "@advergaming/shared";
import Phaser from "phaser";
import type { Game as PhaserGame } from "phaser";
import { getOSAssetUrl, withCacheBust } from "./asset-loader.ts";
import { getParentTargetOrigin } from "./dashboard-origin.ts";

function findLoadableScene(game: PhaserGame): Phaser.Scene | null {
  const preferred = game.scene.getScene("PlayScene");
  if (preferred?.load) return preferred;
  return game.scene.scenes.find((s) => Boolean(s.load)) ?? null;
}

export function loadExternalAsset(
  game: PhaserGame,
  key: string,
  absolutePath: string,
): boolean {
  const scene = findLoadableScene(game);
  if (!scene) return false;

  const loader = scene.load;
  const url = withCacheBust(getOSAssetUrl(absolutePath));

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }

  const onComplete = () => {
    loader.off(Phaser.Loader.Events.COMPLETE, onComplete);
    const payload = AssetReadyPayloadSchema.parse({ key });
    window.parent.postMessage(
      { type: BRIDGE_MESSAGE_TYPE.ASSET_READY, payload },
      getParentTargetOrigin(),
    );
  };

  loader.off(Phaser.Loader.Events.COMPLETE, onComplete);
  loader.once(Phaser.Loader.Events.COMPLETE, onComplete);
  loader.image(key, url);
  if (!loader.isLoading()) {
    loader.start();
  }
  return true;
}
