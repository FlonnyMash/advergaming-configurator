import {
  filterSchemaControls,
  getConfigValue,
  type ControlFieldSchema,
  type ControlValue,
  type GameMasterConfig,
  type GameSchema,
} from "@advergaming/shared";

const STUDIO_MODE = "studio" as const;

export type GameControlsSnapshot = Record<string, ControlValue>;

export function controlSnapshotKey(control: ControlFieldSchema): string {
  return `${control.targetCategory}:${control.targetPath}`;
}

export function cloneGameMasterConfig(config: GameMasterConfig): GameMasterConfig {
  return structuredClone(config);
}

export function captureGameControlsSnapshot(
  config: GameMasterConfig,
  controls: ControlFieldSchema[],
): GameControlsSnapshot {
  const snapshot: GameControlsSnapshot = {};
  for (const control of controls) {
    snapshot[controlSnapshotKey(control)] = getConfigValue(config, control);
  }
  return snapshot;
}

export function applyGameControlsSnapshot(
  config: GameMasterConfig,
  controls: ControlFieldSchema[],
  snapshot: GameControlsSnapshot,
): GameMasterConfig {
  const next = cloneGameMasterConfig(config);
  for (const control of controls) {
    const value = snapshot[controlSnapshotKey(control)];
    if (value === undefined) {
      continue;
    }
    const slice =
      control.targetCategory === "system"
        ? (next.system as unknown as Record<string, unknown>)
        : (next.branding as unknown as Record<string, unknown>);
    applyControlValue(slice, control.targetPath, value);
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
  current: GameMasterConfig,
  saved: GameMasterConfig,
  controls: ControlFieldSchema[],
): GameMasterConfig {
  const next = cloneGameMasterConfig(current);

  for (const control of controls) {
    const value = getConfigValue(saved, control);
    const slice =
      control.targetCategory === "system"
        ? (next.system as unknown as Record<string, unknown>)
        : (next.branding as unknown as Record<string, unknown>);
    applyControlValue(slice, control.targetPath, value);
  }

  return next;
}

function applyControlValue(
  slice: Record<string, unknown>,
  path: string,
  value: ControlValue,
): void {
  const parts = path.split(".");
  let current: unknown = slice;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const nextKey = parts[i + 1]!;
    const nextIsIndex = /^\d+$/.test(nextKey);

    if (Array.isArray(current)) {
      const index = Number(key);
      if (
        current[index] === undefined ||
        (typeof current[index] !== "object" && !Array.isArray(current[index]))
      ) {
        current[index] = nextIsIndex ? [] : {};
      }
      current = current[index];
      continue;
    }

    if (typeof current !== "object" || current === null) {
      return;
    }

    const record = current as Record<string, unknown>;
    if (
      !(key in record) ||
      record[key] === null ||
      (typeof record[key] !== "object" && !Array.isArray(record[key]))
    ) {
      record[key] = nextIsIndex ? [] : {};
    }
    current = record[key];
  }

  const last = parts[parts.length - 1]!;
  if (Array.isArray(current)) {
    current[Number(last)] = value;
    return;
  }
  if (typeof current === "object" && current !== null) {
    (current as Record<string, unknown>)[last] = value;
  }
}

export type GameControlChange = {
  label: string;
  targetPath: string;
  savedValue: ControlValue;
  currentValue: ControlValue;
};

export function listGameControlChanges(
  schema: GameSchema,
  saved: GameMasterConfig,
  current: GameMasterConfig,
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
  saved: GameMasterConfig,
  current: GameMasterConfig,
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
