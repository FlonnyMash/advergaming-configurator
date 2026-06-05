import type {
  DevToolkitAssetConfigBinding,
  DevToolkitAssetLayout,
  DevToolkitPickedAsset,
} from "@mashedgames/shared";
import type { GameConfig } from "@mashedgames/shared";
import Phaser from "phaser";
import { readRuntimeArcadeBodyLayout } from "../../game/arcadeSpriteLayout.ts";

const GOOD_TEXTURE_PREFIX = "item-good-";
const BAD_TEXTURE_PREFIX = "item-bad-";
const PLAYER_TEXTURE_KEY = "player";

type LayoutRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LayoutRecord {
  return typeof value === "object" && value !== null;
}

function readVec2(
  value: unknown,
): { x?: number; y?: number } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    x: typeof value.x === "number" ? value.x : undefined,
    y: typeof value.y === "number" ? value.y : undefined,
  };
}

function readHitbox(value: unknown): DevToolkitAssetLayout["hitbox"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    width: typeof value.width === "number" ? value.width : undefined,
    height: typeof value.height === "number" ? value.height : undefined,
    offsetX: typeof value.offsetX === "number" ? value.offsetX : undefined,
    offsetY: typeof value.offsetY === "number" ? value.offsetY : undefined,
  };
}

function readLayoutFromConfigEntry(entry: unknown): DevToolkitAssetLayout | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const layout: DevToolkitAssetLayout = {
    hitbox: readHitbox(entry.hitbox),
    centerOffset: readVec2(entry.centerOffset),
    rotationAnchor: readVec2(entry.rotationAnchor),
  };

  if (layout.hitbox || layout.centerOffset || layout.rotationAnchor) {
    return layout;
  }

  return undefined;
}

function readCatchGameAssets(config: GameConfig): LayoutRecord | undefined {
  const slice = config.catchGame;
  if (!isRecord(slice)) {
    return undefined;
  }
  const assets = slice.assets;
  if (isRecord(assets)) {
    return assets;
  }
  return undefined;
}

function resolveCatchGameBinding(
  textureKey: string,
  itemType: string | undefined,
  itemIndex: number | undefined,
  config: GameConfig,
): DevToolkitAssetConfigBinding | null {
  if (textureKey === PLAYER_TEXTURE_KEY || textureKey.startsWith(`${PLAYER_TEXTURE_KEY}-`)) {
    return { scope: "branding", itemKind: "playerSprite" };
  }

  let kind: "goodItem" | "badItem" | null = null;
  let index = itemIndex;

  if (textureKey.startsWith(GOOD_TEXTURE_PREFIX)) {
    kind = "goodItem";
    index ??= Number.parseInt(textureKey.slice(GOOD_TEXTURE_PREFIX.length), 10);
  } else if (textureKey.startsWith(BAD_TEXTURE_PREFIX)) {
    kind = "badItem";
    index ??= Number.parseInt(textureKey.slice(BAD_TEXTURE_PREFIX.length), 10);
  } else if (itemType === "good" || itemType === "bad") {
    kind = itemType === "good" ? "goodItem" : "badItem";
  }

  if (!kind || index === undefined || Number.isNaN(index)) {
    return null;
  }

  const assets = readCatchGameAssets(config);
  const list = kind === "goodItem" ? assets?.goodItems : assets?.badItems;
  if (!Array.isArray(list) || index < 0 || index >= list.length) {
    return null;
  }

  return { scope: "branding", itemKind: kind, itemIndex: index };
}

function mergeLayoutSlices(
  systemLayout: DevToolkitAssetLayout | undefined,
  brandingLayout: DevToolkitAssetLayout | undefined,
): DevToolkitAssetLayout | undefined {
  if (!systemLayout && !brandingLayout) {
    return undefined;
  }

  return {
    hitbox: { ...systemLayout?.hitbox, ...brandingLayout?.hitbox },
    centerOffset: {
      ...systemLayout?.centerOffset,
      ...brandingLayout?.centerOffset,
    },
    rotationAnchor: {
      ...systemLayout?.rotationAnchor,
      ...brandingLayout?.rotationAnchor,
    },
    origin: {
      ...systemLayout?.origin,
      ...(brandingLayout?.origin ?? brandingLayout?.rotationAnchor),
    },
  };
}

function readLayoutForBinding(
  binding: DevToolkitAssetConfigBinding,
  config: GameConfig,
): DevToolkitAssetLayout | undefined {
  const fromSystem = readLayoutForScope(binding, config, "system");
  const fromBranding = readLayoutForScope(binding, config, "branding");
  const merged = mergeLayoutSlices(fromSystem, fromBranding);

  if (merged) {
    return {
      hitbox: merged.hitbox ?? { width: 1, height: 1 },
      centerOffset: merged.centerOffset ?? { x: 0, y: 0 },
      rotationAnchor: merged.rotationAnchor ?? { x: 0.5, y: 0.5 },
      origin: merged.origin ?? merged.rotationAnchor ?? { x: 0.5, y: 0.5 },
    };
  }

  return undefined;
}

function readLayoutForScope(
  binding: DevToolkitAssetConfigBinding,
  config: GameConfig,
  scope: DevToolkitAssetConfigBinding["scope"],
): DevToolkitAssetLayout | undefined {
  void scope;
  const slice = config.catchGame;

  if (!isRecord(slice) || !isRecord(slice.assets)) {
    return undefined;
  }

  const assets = slice.assets;

  if (binding.itemKind === "playerSprite") {
    const anchor = readVec2(assets.playerSprite) ?? { x: 0.5, y: 0.5 };
    return {
      rotationAnchor: anchor,
      origin: anchor,
    };
  }

  const list =
    binding.itemKind === "goodItem" ? assets.goodItems : assets.badItems;
  if (!Array.isArray(list) || binding.itemIndex === undefined) {
    return undefined;
  }

  return readLayoutFromConfigEntry(list[binding.itemIndex]);
}

function readOriginFromObject(
  object: Phaser.GameObjects.GameObject,
): { x: number; y: number } {
  if ("originX" in object && "originY" in object) {
    const originX = (object as { originX?: number }).originX;
    const originY = (object as { originY?: number }).originY;
    if (typeof originX === "number" && typeof originY === "number") {
      return { x: originX, y: originY };
    }
  }
  return { x: 0.5, y: 0.5 };
}

export function enrichPickedAsset(
  base: DevToolkitPickedAsset,
  object: Phaser.GameObjects.GameObject,
  masterConfig: GameConfig | null,
): DevToolkitPickedAsset {
  try {
    return enrichPickedAssetUnsafe(base, object, masterConfig);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[DevToolkit] enrichPickedAsset failed:", error);
    }
    return base;
  }
}

function enrichPickedAssetUnsafe(
  base: DevToolkitPickedAsset,
  object: Phaser.GameObjects.GameObject,
  masterConfig: GameConfig | null,
): DevToolkitPickedAsset {
  const itemType =
    "getData" in object && typeof object.getData === "function"
      ? (object.getData("catchItemType") as string | undefined)
      : undefined;
  const itemIndexRaw =
    "getData" in object && typeof object.getData === "function"
      ? object.getData("catchItemIndex")
      : undefined;
  const itemIndex =
    typeof itemIndexRaw === "number"
      ? itemIndexRaw
      : typeof itemIndexRaw === "string"
        ? Number.parseInt(itemIndexRaw, 10)
        : undefined;

  const origin = readOriginFromObject(object);
  const runtimeHitbox =
    "displayWidth" in object &&
    typeof (object as { displayWidth?: unknown }).displayWidth === "number" &&
    (object as { body?: Phaser.Physics.Arcade.Body }).body
      ? readRuntimeArcadeBodyLayout(
          object as Phaser.Physics.Arcade.Image | Phaser.Physics.Arcade.Sprite,
        )
      : undefined;

  let configBinding: DevToolkitAssetConfigBinding | undefined;
  let layout: DevToolkitAssetLayout | undefined;

  if (masterConfig && base.textureKey) {
    const binding = resolveCatchGameBinding(
      base.textureKey,
      itemType,
      itemIndex,
      masterConfig,
    );
    if (binding) {
      configBinding = binding;
      layout = readLayoutForBinding(binding, masterConfig);
    }
  }

  if (!layout) {
    layout = {
      origin,
      rotationAnchor: { ...origin },
      hitbox: runtimeHitbox ?? { width: 1, height: 1 },
      centerOffset: { x: 0, y: 0 },
    };
  } else {
    layout = {
      ...layout,
      origin: layout.rotationAnchor ?? layout.origin ?? origin,
    };
  }

  return {
    ...base,
    layout,
    configBinding,
  };
}
