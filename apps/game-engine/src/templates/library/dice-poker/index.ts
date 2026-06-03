import manifest from "./manifest.json";
import { DicePokerScene as Scene, DICE_POKER_SCENE_KEY } from "./GameScene.ts";

export const phaserSceneMap = { [DICE_POKER_SCENE_KEY]: Scene };

export { manifest };
export { Scene };
