import type {
  DevToolkitAssetConfigBinding,
  DevToolkitAssetLayout,
  GameMasterConfig,
} from "@advergaming/shared";

function configRootPath(binding: DevToolkitAssetConfigBinding): string {
  if (binding.itemKind === "playerSprite") {
    return "catchGame.assets.playerSprite";
  }
  const list =
    binding.itemKind === "goodItem"
      ? "catchGame.assets.goodItems"
      : "catchGame.assets.badItems";
  return `${list}.${binding.itemIndex ?? 0}`;
}

export function patchAssetLayoutInConfig(
  patchPath: (
    scope: DevToolkitAssetConfigBinding["scope"],
    path: string,
    value: unknown,
  ) => void,
  binding: DevToolkitAssetConfigBinding,
  layout: DevToolkitAssetLayout,
): void {
  const root = configRootPath(binding);

  if (layout.hitbox) {
    for (const [key, value] of Object.entries(layout.hitbox)) {
      if (value !== undefined) {
        patchPath(binding.scope, `${root}.hitbox.${key}`, value);
      }
    }
  }

  if (layout.centerOffset) {
    for (const [key, value] of Object.entries(layout.centerOffset)) {
      if (value !== undefined) {
        patchPath(binding.scope, `${root}.centerOffset.${key}`, value);
      }
    }
  }

  if (layout.rotationAnchor) {
    for (const [key, value] of Object.entries(layout.rotationAnchor)) {
      if (value !== undefined) {
        patchPath(binding.scope, `${root}.rotationAnchor.${key}`, value);
      }
    }
  }
}

/** Writes layout fields to both branding and system slices (manifest uses mixed categories). */
export function patchAssetLayoutToStudioStore(
  patchBrandingPath: (path: string, value: unknown) => void,
  patchSystemPath: (path: string, value: unknown) => void,
  binding: DevToolkitAssetConfigBinding,
  layout: DevToolkitAssetLayout,
): void {
  patchAssetLayoutInConfig((_scope, path, value) => {
    patchBrandingPath(path, value);
    patchSystemPath(path, value);
  }, binding, layout);
}

function readPath(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      current = current[Number(part)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

function readVec2(value: unknown): { x?: number; y?: number } | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    x: typeof record.x === "number" ? record.x : undefined,
    y: typeof record.y === "number" ? record.y : undefined,
  };
}

function readHitbox(value: unknown): DevToolkitAssetLayout["hitbox"] | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    width: typeof record.width === "number" ? record.width : undefined,
    height: typeof record.height === "number" ? record.height : undefined,
    offsetX: typeof record.offsetX === "number" ? record.offsetX : undefined,
    offsetY: typeof record.offsetY === "number" ? record.offsetY : undefined,
  };
}

function readLayoutEntry(entry: unknown): DevToolkitAssetLayout | undefined {
  if (typeof entry !== "object" || entry === null) {
    return undefined;
  }
  const record = entry as Record<string, unknown>;
  const layout: DevToolkitAssetLayout = {
    hitbox: readHitbox(record.hitbox),
    centerOffset: readVec2(record.centerOffset),
    rotationAnchor: readVec2(record.rotationAnchor),
  };
  if (layout.hitbox || layout.centerOffset || layout.rotationAnchor) {
    return layout;
  }
  return undefined;
}

/** Reads layout from branding, then system (same precedence as runtime). */
export function readAssetLayoutFromStudioConfig(
  config: GameMasterConfig,
  binding: DevToolkitAssetConfigBinding,
): DevToolkitAssetLayout | undefined {
  const root = configRootPath(binding);
  for (const slice of [
    config.branding as unknown as Record<string, unknown>,
    config.system as unknown as Record<string, unknown>,
  ]) {
    const entry = readPath(slice, root);
    const layout = readLayoutEntry(entry);
    if (layout) {
      return layout;
    }
  }
  return undefined;
}

export function layoutsEqual(
  a: DevToolkitAssetLayout,
  b: DevToolkitAssetLayout,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
