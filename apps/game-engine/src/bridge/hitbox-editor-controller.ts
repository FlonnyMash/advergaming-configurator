import {
  encodeEntityId,
  parseEntityId,
  type EditorState,
  type GameConfig,
} from "@mashedgames/shared";
import Phaser from "phaser";
import {
  applyArcadeSpriteLayout,
  readRuntimeArcadeBodyLayout,
} from "../game/arcadeSpriteLayout.ts";
import { postHitboxUpdated } from "./messenger.ts";

const HANDLE_DEPTH = 20_000;
const OUTLINE_DEPTH = 19_999;
const HANDLE_SIZE = 10;

type ArcadeTarget =
  | Phaser.Physics.Arcade.Image
  | Phaser.Physics.Arcade.Sprite;

type DragHandleKey = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

function isArcadeTarget(value: unknown): value is ArcadeTarget {
  return (
    value instanceof Phaser.Physics.Arcade.Image ||
    value instanceof Phaser.Physics.Arcade.Sprite
  );
}

function readCatchItemIndex(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function entityIdForObject(
  object: Phaser.GameObjects.GameObject,
  masterConfig: GameConfig,
): string | null {
  if (!("getData" in object) || typeof object.getData !== "function") {
    return null;
  }

  const textureKey =
    "texture" in object &&
    object.texture instanceof Phaser.Textures.Texture
      ? object.texture.key
      : undefined;

  if (textureKey === "player" || textureKey?.startsWith("player-")) {
    return encodeEntityId({ scope: "branding", itemKind: "playerSprite" });
  }

  const itemType = object.getData("catchItemType") as string | undefined;
  const itemIndex = readCatchItemIndex(object.getData("catchItemIndex"));

  if (itemType === "good" && itemIndex !== undefined) {
    return encodeEntityId({
      scope: "branding",
      itemKind: "goodItem",
      itemIndex,
    });
  }

  if (itemType === "bad" && itemIndex !== undefined) {
    return encodeEntityId({
      scope: "branding",
      itemKind: "badItem",
      itemIndex,
    });
  }

  const sceneRecord = object.scene as Phaser.Scene & { player?: Phaser.GameObjects.GameObject };
  if (sceneRecord.player === object) {
    return encodeEntityId({ scope: "branding", itemKind: "playerSprite" });
  }

  void masterConfig;
  return null;
}

function findTargetSprite(
  game: Phaser.Game,
  entityId: string,
  masterConfig: GameConfig,
): ArcadeTarget | null {
  const parsed = parseEntityId(entityId);
  if (!parsed) {
    return null;
  }

  const matchesEntity = (candidateId: string | null): boolean => {
    if (!candidateId) {
      return false;
    }
    if (candidateId === entityId) {
      return true;
    }
    const candidateParsed = parseEntityId(candidateId);
    return (
      candidateParsed !== null &&
      candidateParsed.itemKind === parsed.itemKind &&
      candidateParsed.itemIndex === parsed.itemIndex
    );
  };

  for (const scene of game.scene.scenes) {
    if (!scene.scene.isActive() && !scene.scene.isPaused()) {
      continue;
    }

    for (const child of scene.children.list) {
      if (!isArcadeTarget(child)) {
        continue;
      }
      if (matchesEntity(entityIdForObject(child, masterConfig))) {
        return child;
      }
    }

    const sceneRecord = scene as Phaser.Scene & { player?: ArcadeTarget };
    if (sceneRecord.player && isArcadeTarget(sceneRecord.player)) {
      if (matchesEntity(entityIdForObject(sceneRecord.player, masterConfig))) {
        return sceneRecord.player;
      }
    }
  }

  return null;
}

export class HitboxEditorController {
  private readonly game: Phaser.Game;
  private readonly getMasterConfig: () => GameConfig;
  private activeEntityId: string | null = null;
  private target: ArcadeTarget | null = null;
  private outline: Phaser.GameObjects.Graphics | null = null;
  private inputScene: Phaser.Scene | null = null;
  private handles = new Map<DragHandleKey, Phaser.GameObjects.Rectangle>();
  private activeHandle: DragHandleKey | null = null;
  private dragStartPointer = new Phaser.Math.Vector2();
  private dragStartHitbox = {
    width: 1,
    height: 1,
    offsetX: 0,
    offsetY: 0,
  };

  constructor(game: Phaser.Game, getMasterConfig: () => GameConfig) {
    this.game = game;
    this.getMasterConfig = getMasterConfig;
  }

  destroy(): void {
    this.clearEditor();
  }

  applyEditorState(state: EditorState): void {
    if (window.parent === window) {
      return;
    }

    if (state.workspaceMode !== "studio") {
      this.clearEditor();
      return;
    }

    if (!state.isAssetInspectorActive || !state.activeEntityId) {
      this.clearEditor();
      return;
    }

    if (
      state.activeEntityId === this.activeEntityId &&
      this.target?.active
    ) {
      this.refreshOverlay();
      return;
    }

    this.clearEditor();
    const target = findTargetSprite(
      this.game,
      state.activeEntityId,
      this.getMasterConfig(),
    );
    if (!target) {
      return;
    }

    this.activeEntityId = state.activeEntityId;
    this.target = target;
    this.inputScene = target.scene;

    this.createOverlay();
    this.bindHandleEvents();
  }

  private clearEditor(): void {
    this.unbindHandleEvents();
    for (const handle of this.handles.values()) {
      handle.destroy();
    }
    this.handles.clear();
    this.outline?.destroy();
    this.outline = null;
    this.activeHandle = null;
    this.target = null;
    this.activeEntityId = null;
    this.inputScene = null;
  }

  private createOverlay(): void {
    const target = this.target;
    if (!target) {
      return;
    }

    const scene = target.scene;
    this.outline = scene.add.graphics();
    this.outline.setDepth(OUTLINE_DEPTH);

    const corners: DragHandleKey[] = [
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
    ];
    for (const key of corners) {
      const handle = scene.add.rectangle(0, 0, HANDLE_SIZE, HANDLE_SIZE, 0x22c55e, 1);
      handle.setDepth(HANDLE_DEPTH);
      handle.setInteractive({ useHandCursor: true });
      handle.setData("handleKey", key);
      this.handles.set(key, handle);
    }

    this.refreshOverlay();
  }

  private bindHandleEvents(): void {
    if (!this.inputScene) {
      return;
    }

    for (const [key, handle] of this.handles.entries()) {
      handle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        this.activeHandle = key;
        this.dragStartPointer.set(pointer.worldX, pointer.worldY);
        const current = readRuntimeArcadeBodyLayout(this.target!);
        this.dragStartHitbox = {
          width: current?.width ?? 1,
          height: current?.height ?? 1,
          offsetX: current?.offsetX ?? 0,
          offsetY: current?.offsetY ?? 0,
        };
      });
    }

    this.inputScene.input.on("pointermove", this.onPointerMove);
    this.inputScene.input.on("pointerup", this.onPointerUp);
  }

  private unbindHandleEvents(): void {
    this.inputScene?.input.off("pointermove", this.onPointerMove);
    this.inputScene?.input.off("pointerup", this.onPointerUp);
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.activeHandle || !this.target) {
      return;
    }

    const target = this.target;
    const displayW = Math.max(target.displayWidth, 1);
    const displayH = Math.max(target.displayHeight, 1);
    const deltaX = (pointer.worldX - this.dragStartPointer.x) / displayW;
    const deltaY = (pointer.worldY - this.dragStartPointer.y) / displayH;

    let nextHitbox = { ...this.dragStartHitbox };

    switch (this.activeHandle) {
      case "bottomRight":
        nextHitbox.width = Phaser.Math.Clamp(
          this.dragStartHitbox.width + deltaX,
          0.05,
          2,
        );
        nextHitbox.height = Phaser.Math.Clamp(
          this.dragStartHitbox.height + deltaY,
          0.05,
          2,
        );
        break;
      case "bottomLeft":
        nextHitbox.width = Phaser.Math.Clamp(
          this.dragStartHitbox.width - deltaX,
          0.05,
          2,
        );
        nextHitbox.height = Phaser.Math.Clamp(
          this.dragStartHitbox.height + deltaY,
          0.05,
          2,
        );
        nextHitbox.offsetX = Phaser.Math.Clamp(
          this.dragStartHitbox.offsetX + deltaX,
          -1,
          2,
        );
        break;
      case "topRight":
        nextHitbox.width = Phaser.Math.Clamp(
          this.dragStartHitbox.width + deltaX,
          0.05,
          2,
        );
        nextHitbox.height = Phaser.Math.Clamp(
          this.dragStartHitbox.height - deltaY,
          0.05,
          2,
        );
        nextHitbox.offsetY = Phaser.Math.Clamp(
          this.dragStartHitbox.offsetY + deltaY,
          -1,
          2,
        );
        break;
      case "topLeft":
        nextHitbox.width = Phaser.Math.Clamp(
          this.dragStartHitbox.width - deltaX,
          0.05,
          2,
        );
        nextHitbox.height = Phaser.Math.Clamp(
          this.dragStartHitbox.height - deltaY,
          0.05,
          2,
        );
        nextHitbox.offsetX = Phaser.Math.Clamp(
          this.dragStartHitbox.offsetX + deltaX,
          -1,
          2,
        );
        nextHitbox.offsetY = Phaser.Math.Clamp(
          this.dragStartHitbox.offsetY + deltaY,
          -1,
          2,
        );
        break;
    }

    applyArcadeSpriteLayout(target, {
      frameWidth: target.width,
      frameHeight: target.height,
      displayWidth: target.displayWidth,
      layout: { hitbox: nextHitbox },
    });

    this.refreshOverlay();
  };

  private onPointerUp = (): void => {
    if (!this.activeHandle || !this.target || !this.activeEntityId) {
      this.activeHandle = null;
      return;
    }

    this.activeHandle = null;
    const hitbox = readRuntimeArcadeBodyLayout(this.target);
    if (!hitbox) {
      return;
    }

    postHitboxUpdated({
      entityId: this.activeEntityId,
      width: hitbox.width ?? 1,
      height: hitbox.height ?? 1,
      offsetX: hitbox.offsetX ?? 0,
      offsetY: hitbox.offsetY ?? 0,
    });
  };

  private refreshOverlay(): void {
    const target = this.target;
    const outline = this.outline;
    if (!target || !outline) {
      return;
    }

    const body = target.body;
    if (!body) {
      return;
    }

    outline.clear();
    outline.lineStyle(2, 0x22c55e, 1);
    outline.strokeRect(body.x, body.y, body.width, body.height);

    const corners: Record<DragHandleKey, { x: number; y: number }> = {
      topLeft: { x: body.x, y: body.y },
      topRight: { x: body.x + body.width, y: body.y },
      bottomLeft: { x: body.x, y: body.y + body.height },
      bottomRight: { x: body.x + body.width, y: body.y + body.height },
    };

    for (const [key, handle] of this.handles.entries()) {
      const point = corners[key];
      handle.setPosition(point.x, point.y);
    }
  }
}
