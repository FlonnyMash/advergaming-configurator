import {
  applyPath,
  filterSchemaControls,
  getConfigValue,
  type ControlFieldSchema,
  type ControlValue,
  type GameConfig,
  type GameSchema,
} from "@mashedgames/shared";

const STUDIO_MODE = "studio" as const;

export type GameControlsSnapshot = Record<string, ControlValue>;

export function controlSnapshotKey(control: ControlFieldSchema): string {
  return `${control.targetCategory}:${control.targetPath}`;
}

export function cloneGameConfig(config: GameConfig): GameConfig {
  return structuredClone(config);
}

export function captureGameControlsSnapshot(
  config: GameConfig,
  controls: ControlFieldSchema[],
): GameControlsSnapshot {
  const snapshot: GameControlsSnapshot = {};
  for (const control of controls) {
    snapshot[controlSnapshotKey(control)] = getConfigValue(config, control);
  }
  return snapshot;
}

export function applyGameControlsSnapshot(
  config: GameConfig,
  controls: ControlFieldSchema[],
  snapshot: GameControlsSnapshot,
): GameConfig {
  const next = cloneGameConfig(config);
  const root = next as Record<string, unknown>;
  for (const control of controls) {
    const value = snapshot[controlSnapshotKey(control)];
    if (value === undefined) {
      continue;
    }
    applyPath(root, control.targetPath, value);
  }
  return next;
}

export function findStudioControl(
  controls: ControlFieldSchema[],
  targetCategory: ControlFieldSchema["targetCategory"],
  targetPath: string,
): ControlFieldSchema | undefined {
  return controls.find(
    (control) =>
      control.targetCategory === targetCategory && control.targetPath === targetPath,
  );
}

export function studioControlsForSchema(schema: GameSchema): ControlFieldSchema[] {
  return filterSchemaControls(schema.controls, STUDIO_MODE);
}

export function mergeGameControlsFromSaved(
  current: GameConfig,
  saved: GameConfig,
  controls: ControlFieldSchema[],
): GameConfig {
  const next = cloneGameConfig(current);

  for (const control of controls) {
    const value = getConfigValue(saved, control);
    applyPath(next as Record<string, unknown>, control.targetPath, value);
  }

  return next;
}

export type GameControlChange = {
  label: string;
  targetPath: string;
  savedValue: ControlValue;
  currentValue: ControlValue;
};

export function listGameControlChanges(
  schema: GameSchema,
  saved: GameConfig,
  current: GameConfig,
): GameControlChange[] {
  const controls = studioControlsForSchema(schema);
  const changes: GameControlChange[] = [];

  for (const control of controls) {
    const savedValue = getConfigValue(saved, control);
    const currentValue = getConfigValue(current, control);
    if (!controlValuesEqual(savedValue, currentValue)) {
      changes.push({
        label: control.label,
        targetPath: control.targetPath,
        savedValue,
        currentValue,
      });
    }
  }

  return changes;
}

export function hasUnsavedGameControls(
  schema: GameSchema,
  saved: GameConfig,
  current: GameConfig,
): boolean {
  return listGameControlChanges(schema, saved, current).length > 0;
}

export function controlValuesEqual(a: ControlValue, b: ControlValue): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a === b;
  }
  if (typeof a === "number" && typeof b === "number") {
    return Object.is(a, b);
  }
  return a === b;
}
