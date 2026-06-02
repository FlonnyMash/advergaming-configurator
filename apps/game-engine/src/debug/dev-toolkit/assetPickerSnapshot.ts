import Phaser from "phaser";

/** Keep postMessage payloads under typical browser limits. */
const PREVIEW_MAX_EDGE = 1024;

function isCanvasSource(
  image: TexImageSource | null,
): image is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement;
}

function isImageSource(
  image: TexImageSource | null,
): image is HTMLImageElement {
  return typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement;
}

type TexImageSource = CanvasImageSource;

export function textureFrameToDataUrl(
  texture: Phaser.Textures.Texture,
  frameName: string | number,
): string | null {
  const frame = texture.get(frameName);
  if (!frame) {
    return null;
  }
  const sourceImage = frame.source.image;
  if (!isCanvasSource(sourceImage) && !isImageSource(sourceImage)) {
    return null;
  }

  const cutW = frame.cutWidth;
  const cutH = frame.cutHeight;
  if (cutW <= 0 || cutH <= 0) {
    return null;
  }

  const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(cutW, cutH));
  const outW = Math.max(1, Math.round(cutW * scale));
  const outH = Math.max(1, Math.round(cutH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(
    sourceImage,
    frame.cutX,
    frame.cutY,
    cutW,
    cutH,
    0,
    0,
    outW,
    outH,
  );

  return canvas.toDataURL("image/png");
}
