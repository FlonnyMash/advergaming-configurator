import type { DevToolkitAssetLayout } from "@advergaming/shared";
import Phaser from "phaser";
import {
  computeArcadeBodyLayout,
  readFractionalHitboxFromBodyMetrics,
  type ApplyArcadeSpriteLayoutOptions,
} from "./arcadeSpriteLayoutMath.ts";

export type {
  ApplyArcadeSpriteLayoutOptions,
  ArcadeBodyLayoutResult,
  ArcadeSpriteLayoutSlice,
} from "./arcadeSpriteLayoutMath.ts";

export { computeArcadeBodyLayout } from "./arcadeSpriteLayoutMath.ts";

/** Applies display size, rotation anchor (origin), and optional custom arcade body layout. */
export function applyArcadeSpriteLayout(
  sprite: Phaser.Physics.Arcade.Image | Phaser.Physics.Arcade.Sprite,
  options: ApplyArcadeSpriteLayoutOptions,
): void {
  const targetWidth = options.displayWidth ?? options.frameWidth;
  const targetHeight = (targetWidth / options.frameWidth) * options.frameHeight;
  sprite.setDisplaySize(targetWidth, targetHeight);

  const rotationAnchor = options.layout?.rotationAnchor;
  if (rotationAnchor) {
    sprite.setOrigin(rotationAnchor.x ?? 0.5, rotationAnchor.y ?? 0.5);
  }

  sprite.refreshBody();

  const body = sprite.body;
  if (!body) {
    return;
  }

  const frameW = sprite.width;
  const frameH = sprite.height;
  const displayW = sprite.displayWidth;
  const displayH = sprite.displayHeight;

  const computed = computeArcadeBodyLayout(
    options,
    frameW,
    frameH,
    displayW,
    displayH,
  );

  if (!computed.hasCustomLayout) {
    return;
  }

  if (computed.onlyShrinkCentered) {
    body.setSize(computed.bodyW, computed.bodyH, true);
    return;
  }

  body.setSize(computed.bodyW, computed.bodyH);
  body.setOffset(computed.offsetFrameX, computed.offsetFrameY);
}

/** Reads fractional hitbox layout from a live arcade body (inverse of applyArcadeSpriteLayout). */
export function readRuntimeArcadeBodyLayout(
  sprite: Phaser.Physics.Arcade.Image | Phaser.Physics.Arcade.Sprite,
): DevToolkitAssetLayout["hitbox"] | undefined {
  const body = sprite.body;
  if (!body) {
    return undefined;
  }

  const displayW = sprite.displayWidth;
  const displayH = sprite.displayHeight;
  if (displayW <= 0 || displayH <= 0) {
    return undefined;
  }

  return readFractionalHitboxFromBodyMetrics(
    sprite.width,
    sprite.height,
    displayW,
    displayH,
    body.width,
    body.height,
    body.offset.x,
    body.offset.y,
  );
}
