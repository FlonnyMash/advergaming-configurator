import type { Types } from "phaser";

const sceneRegistry = new Map<string, Types.Scenes.SceneType>();

export function registerPhaserScene(
  key: string,
  SceneClass: Types.Scenes.SceneType,
): void {
  sceneRegistry.set(key, SceneClass);
}

export function registerPhaserSceneMap(
  map: Record<string, Types.Scenes.SceneType>,
): void {
  for (const [key, SceneClass] of Object.entries(map)) {
    registerPhaserScene(key, SceneClass);
  }
}

export function resolvePhaserScenes(
  keys: string[],
): Types.Scenes.SceneType[] {
  const resolved: Types.Scenes.SceneType[] = [];
  for (const key of keys) {
    const SceneClass = sceneRegistry.get(key);
    if (!SceneClass) {
      console.warn(`[PhaserSceneRegistry] Unknown scene key: ${key}`);
      continue;
    }
    resolved.push(SceneClass);
  }
  return resolved;
}

export function getRegisteredPhaserSceneKeys(): string[] {
  return [...sceneRegistry.keys()];
}

export function hasPhaserScene(key: string): boolean {
  return sceneRegistry.has(key);
}
