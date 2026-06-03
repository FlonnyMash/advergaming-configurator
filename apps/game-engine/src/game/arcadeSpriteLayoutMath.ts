import type { DevToolkitAssetLayout } from "@mashedgames/shared";

export type ArcadeSpriteLayoutSlice = Pick<
  DevToolkitAssetLayout,
  "hitbox" | "centerOffset" | "rotationAnchor"
>;

export interface ApplyArcadeSpriteLayoutOptions {
  frameWidth: number;
  frameHeight: number;
  displayWidth?: number;
  layout?: ArcadeSpriteLayoutSlice;
}

export interface ArcadeBodyLayoutResult {
  displayW: number;
  displayH: number;
  frameW: number;
  frameH: number;
  bodyW: number;
  bodyH: number;
  offsetFrameX: number;
  offsetFrameY: number;
  onlyShrinkCentered: boolean;
  hasCustomLayout: boolean;
}

/** Computes arcade body size/offset in frame space from fractional layout config. */
export function computeArcadeBodyLayout(
  options: ApplyArcadeSpriteLayoutOptions,
  frameW: number,
  frameH: number,
  displayW: number,
  displayH: number,
): ArcadeBodyLayoutResult {
  const hitbox = options.layout?.hitbox;
  const centerOffsetX = (options.layout?.centerOffset?.x ?? 0) * displayW;
  const centerOffsetY = (options.layout?.centerOffset?.y ?? 0) * displayH;
  const widthFrac = hitbox?.width ?? 1;
  const heightFrac = hitbox?.height ?? 1;
  const hitDisplayW = displayW * widthFrac;
  const hitDisplayH = displayH * heightFrac;

  const offsetDisplayX =
    (hitbox?.offsetX !== undefined
      ? hitbox.offsetX * displayW
      : (displayW - hitDisplayW) / 2) + centerOffsetX;
  const offsetDisplayY =
    (hitbox?.offsetY !== undefined
      ? hitbox.offsetY * displayH
      : (displayH - hitDisplayH) / 2) + centerOffsetY;

  const toFrameX = (displayPx: number): number => (displayPx / displayW) * frameW;
  const toFrameY = (displayPx: number): number => (displayPx / displayH) * frameH;

  const hasCustomLayout =
    Boolean(hitbox) ||
    centerOffsetX !== 0 ||
    centerOffsetY !== 0 ||
    widthFrac !== 1 ||
    heightFrac !== 1;

  const onlyShrinkCentered =
    hitbox !== undefined &&
    hitbox.offsetX === undefined &&
    hitbox.offsetY === undefined &&
    centerOffsetX === 0 &&
    centerOffsetY === 0 &&
    (widthFrac !== 1 || heightFrac !== 1);

  return {
    displayW,
    displayH,
    frameW,
    frameH,
    bodyW: toFrameX(hitDisplayW),
    bodyH: toFrameY(hitDisplayH),
    offsetFrameX: toFrameX(offsetDisplayX),
    offsetFrameY: toFrameY(offsetDisplayY),
    onlyShrinkCentered,
    hasCustomLayout,
  };
}

const clampHitboxFraction = (value: number): number =>
  Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : 1;

/** Reads fractional hitbox from frame-space body metrics (inverse of computeArcadeBodyLayout). */
export function readFractionalHitboxFromBodyMetrics(
  frameW: number,
  frameH: number,
  displayW: number,
  displayH: number,
  bodyW: number,
  bodyH: number,
  offsetFrameX: number,
  offsetFrameY: number,
): DevToolkitAssetLayout["hitbox"] {
  const toDisplayX = (framePx: number) => (framePx / frameW) * displayW;
  const toDisplayY = (framePx: number) => (framePx / frameH) * displayH;

  return {
    width: clampHitboxFraction(toDisplayX(bodyW) / displayW),
    height: clampHitboxFraction(toDisplayY(bodyH) / displayH),
    offsetX: clampHitboxFraction(toDisplayX(offsetFrameX) / displayW),
    offsetY: clampHitboxFraction(toDisplayY(offsetFrameY) / displayH),
  };
}
