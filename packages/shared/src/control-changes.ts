import { filterSchemaControls } from "./permissions";
import { getConfigValue } from "./config-utils";
import type { GameConfig } from "./game-config-bridge";
import type {
  AppMode,
  ControlFieldSchema,
  ControlValue,
  GameSchema,
} from "./game-schema";

export type ControlChange = {
  label: string;
  targetPath: string;
  targetCategory: ControlFieldSchema["targetCategory"];
  savedValue: ControlValue;
  currentValue: ControlValue;
};

function controlValuesEqual(a: ControlValue, b: ControlValue): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a === b;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a === b;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b;
  }
  return a === b;
}

export function controlsForMode(
  schema: GameSchema,
  mode: AppMode,
): ControlFieldSchema[] {
  return filterSchemaControls(schema.controls, mode);
}

export function listControlChanges(
  controls: ControlFieldSchema[],
  saved: GameConfig,
  current: GameConfig,
): ControlChange[] {
  const changes: ControlChange[] = [];

  for (const control of controls) {
    const savedValue = getConfigValue(saved, control);
    const currentValue = getConfigValue(current, control);
    if (!controlValuesEqual(savedValue, currentValue)) {
      changes.push({
        label: control.label,
        targetPath: control.targetPath,
        targetCategory: control.targetCategory,
        savedValue,
        currentValue,
      });
    }
  }

  return changes;
}

export function listSchemaControlChanges(
  schema: GameSchema,
  mode: AppMode,
  saved: GameConfig,
  current: GameConfig,
): ControlChange[] {
  return listControlChanges(controlsForMode(schema, mode), saved, current);
}
