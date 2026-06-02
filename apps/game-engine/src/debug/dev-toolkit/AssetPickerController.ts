import type { DevToolkitPickedAsset, GameMasterConfig } from "@advergaming/shared";
import Phaser from "phaser";
import { textureFrameToDataUrl } from "./assetPickerSnapshot.ts";
import { enrichPickedAsset } from "./resolvePickedAssetLayout.ts";

const DEBUG_GRAPHICS_DEPTH = 10_000;

type PickableObject = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform & {
    getBounds: () => Phaser.Geom.Rectangle;
    visible?: boolean;
    active?: boolean;
    name?: string;
    type?: string;
  };

function isPickableObject(value: unknown): value is PickableObject {
  return (
    typeof value === "object" &&
    value !== null &&
    "getBounds" in value &&
    typeof (value as { getBounds?: unknown }).getBounds === "function"
  );
}

function hasTextureComponent(
  value: PickableObject,
): value is PickableObject & {
  texture: Phaser.Textures.Texture;
  frame?: Phaser.Textures.Frame | string | number;
} {
  return "texture" in value && value.texture instanceof Phaser.Textures.Texture;
}

function resolveFrameName(
  obj: PickableObject & { frame?: Phaser.Textures.Frame | string | number },
): string | number | undefined {
  const frame = obj.frame;
  if (frame instanceof Phaser.Textures.Frame) {
    return frame.name;
  }
  if (typeof frame === "string" || typeof frame === "number") {
    return frame;
  }
  return undefined;
}

function getObjectDepth(child: PickableObject): number | undefined {
  if (!("depth" in child)) {
    return undefined;
  }
  const depth = (child as { depth?: unknown }).depth;
  return typeof depth === "number" ? depth : undefined;
}

export class AssetPickerController {
  private enabled = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly game: Phaser.Game;
  private readonly onPicked: (asset: DevToolkitPickedAsset) => void;
  private readonly getMasterConfig: () => GameMasterConfig | null;
  private readonly sceneHandlers = new Map<
    string,
    (pointer: Phaser.Input.Pointer) => void
  >();

  constructor(
    game: Phaser.Game,
    onPicked: (asset: DevToolkitPickedAsset) => void,
    getMasterConfig: () => GameMasterConfig | null,
  ) {
    this.game = game;
    this.onPicked = onPicked;
    this.getMasterConfig = getMasterConfig;
    this.canvas = game.canvas as HTMLCanvasElement;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;
    if (enabled) {
      this.bindActiveScenes();
      this.game.events.on("poststep", this.boundBindScenes);
      this.canvas.style.cursor = "crosshair";
    } else {
      this.game.events.off("poststep", this.boundBindScenes);
      this.unbindAllScenes();
      this.canvas.style.cursor = "";
    }
  }

  destroy(): void {
    this.setEnabled(false);
  }

  private readonly boundBindScenes = (): void => {
    if (!this.enabled) {
      return;
    }
    this.bindActiveScenes();
  };

  private bindActiveScenes(): void {
    for (const scene of this.getActiveScenes()) {
      const sceneKey = scene.scene.key;
      if (this.sceneHandlers.has(sceneKey)) {
        continue;
      }

      const handler = (pointer: Phaser.Input.Pointer) => {
        this.handlePointerDown(pointer);
      };
      scene.input.on("pointerdown", handler);
      this.sceneHandlers.set(sceneKey, handler);
    }
  }

  private unbindAllScenes(): void {
    for (const scene of this.getActiveScenes()) {
      const handler = this.sceneHandlers.get(scene.scene.key);
      if (handler) {
        scene.input.off("pointerdown", handler);
      }
    }
    this.sceneHandlers.clear();
  }

  private getActiveScenes(): Phaser.Scene[] {
    return this.game.scene.scenes.filter(
      (scene) => scene.sys.isActive() || scene.sys.isPaused(),
    );
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) {
      return;
    }

    const picked = this.pickAt(pointer.worldX, pointer.worldY);
    if (!picked) {
      return;
    }

    pointer.event.preventDefault();
    pointer.event.stopPropagation();

    const asset = this.describePick(picked.scene, picked.object);
    if (asset) {
      this.onPicked(asset);
    }
  }

  private pickAt(
    worldX: number,
    worldY: number,
  ): { scene: Phaser.Scene; object: PickableObject } | null {
    for (const scene of this.getActiveScenes()) {
      const hit = this.pickInDisplayList(scene.children.list, worldX, worldY);
      if (hit) {
        return { scene, object: hit };
      }
    }
    return null;
  }

  private pickInDisplayList(
    list: Phaser.GameObjects.GameObject[],
    worldX: number,
    worldY: number,
  ): PickableObject | null {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const child = list[index];
      if (!isPickableObject(child)) {
        continue;
      }

      if ("list" in child && Array.isArray((child as { list?: unknown }).list)) {
        const containerHit = this.pickInDisplayList(
          (child as Phaser.GameObjects.Container).list,
          worldX,
          worldY,
        );
        if (containerHit) {
          return containerHit;
        }
      }

      if (child.visible === false || child.active === false) {
        continue;
      }

      const depth = getObjectDepth(child);
      if (depth !== undefined && depth >= DEBUG_GRAPHICS_DEPTH) {
        continue;
      }

      const bounds = child.getBounds();
      if (!bounds.contains(worldX, worldY)) {
        continue;
      }

      return child;
    }

    return null;
  }

  private describePick(
    scene: Phaser.Scene,
    object: PickableObject,
  ): DevToolkitPickedAsset | null {
    const bounds = object.getBounds();
    const scaleX =
      "scaleX" in object && typeof object.scaleX === "number" ? object.scaleX : 1;
    const scaleY =
      "scaleY" in object && typeof object.scaleY === "number" ? object.scaleY : 1;

    let textureKey: string | undefined;
    let frameName: string | number | undefined;
    let sourceWidth: number | undefined;
    let sourceHeight: number | undefined;
    let previewDataUrl: string | undefined;

    if (hasTextureComponent(object)) {
      textureKey = object.texture.key;
      frameName = resolveFrameName(object);
      const resolvedFrame =
        frameName !== undefined ? object.texture.get(frameName) : object.texture.get();
      sourceWidth = resolvedFrame.cutWidth;
      sourceHeight = resolvedFrame.cutHeight;
      if (frameName !== undefined) {
        previewDataUrl =
          textureFrameToDataUrl(object.texture, frameName) ?? undefined;
      }
    }

    const base: DevToolkitPickedAsset = {
      sceneKey: scene.scene.key,
      objectType: object.type ?? object.constructor.name,
      name: object.name || undefined,
      textureKey,
      frameName,
      x: object.x,
      y: object.y,
      displayWidth: bounds.width,
      displayHeight: bounds.height,
      sourceWidth,
      sourceHeight,
      scaleX,
      scaleY,
      previewDataUrl,
    };

    return enrichPickedAsset(base, object, this.getMasterConfig());
  }
}
