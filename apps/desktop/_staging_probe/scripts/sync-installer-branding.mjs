/**
 * Generates Windows installer branding from the single manual logo source.
 *
 * Paste your PNG here (only place you edit by hand):
 *   apps/dashboard/public/mashed-games-logo.png
 *
 * Outputs (generated — do not edit):
 *   apps/desktop/nsis/icon.ico              — app .exe + taskbar (rounded white plate)
 *   apps/desktop/nsis/installerIcon.ico       — setup .exe (rounded white plate)
 *   apps/desktop/nsis/uninstallerIcon.ico     — uninstaller (rounded white plate)
 *   apps/desktop/nsis/installerSidebar.bmp    — transparent logo on panel fill
 *   apps/desktop/nsis/uninstallerSidebar.bmp
 *   apps/desktop/nsis/installerHeader.bmp
 *
 * Rounded white background applies ONLY to .ico shell icons. UI logo, favicon,
 * and installer BMPs keep the source PNG alpha (BMP panels use a flat fill).
 */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";
import { BRAND_LOGO_FILENAME } from "../constants.js";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const logoPng = path.join(
  desktopRoot,
  "..",
  "dashboard",
  "public",
  BRAND_LOGO_FILENAME,
);
const nsisDir = path.join(desktopRoot, "nsis");

const SIDEBAR = { width: 164, height: 314 };
const HEADER = { width: 150, height: 57 };
const ICON_SIZES = [256, 128, 64, 48, 32, 16];
const ICON_CORNER_RADIUS_RATIO = 0.2;

function roundedRectSvg(size, radius, fill = "#ffffff") {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${fill}"/>
    </svg>`,
  );
}

function writeBmp24(filePath, width, height, rgbBuffer) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowSize * height;
  const fileSize = 14 + 40 + imageSize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write("BM", 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(54, 10);

  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(imageSize, 34);

  let offset = 54;
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      buffer[offset++] = rgbBuffer[i + 2];
      buffer[offset++] = rgbBuffer[i + 1];
      buffer[offset++] = rgbBuffer[i];
    }
    offset += rowSize - width * 3;
  }

  writeFileSync(filePath, buffer);
}

async function writeInstallerPanelBmp({ width, height, panelFill, invertLogo, outFile }) {
  const paddingX = Math.round(width * 0.12);
  const paddingY = Math.round(height * 0.1);
  const maxLogoW = width - paddingX * 2;
  const maxLogoH = height - paddingY * 2;

  let pipeline = sharp(logoPng)
    .ensureAlpha()
    .resize(maxLogoW, maxLogoH, { fit: "inside", withoutEnlargement: false });
  if (invertLogo) {
    pipeline = pipeline.negate({ alpha: false });
  }
  const logo = await pipeline.toBuffer();

  const { width: logoW, height: logoH } = await sharp(logo).metadata();
  const left = Math.max(0, Math.floor((width - logoW) / 2));
  const top = Math.max(0, Math.floor((height - logoH) / 2));

  const { data } = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: panelFill,
    },
  })
    .composite([{ input: logo, left, top }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  writeBmp24(outFile, width, height, data);
}

/** Windows shell icons only — rounded white plate behind the logo. */
async function composeShellIconLayer(size) {
  const inset = Math.max(1, Math.round(size * 0.08));
  const inner = size - inset * 2;
  const radius = Math.max(2, Math.round(size * ICON_CORNER_RADIUS_RATIO));
  const logo = await sharp(logoPng)
    .ensureAlpha()
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const { width: logoW, height: logoH } = await sharp(logo).metadata();
  const left = Math.max(0, Math.floor((size - logoW) / 2));
  const top = Math.max(0, Math.floor((size - logoH) / 2));

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: roundedRectSvg(size, radius), top: 0, left: 0 },
      { input: logo, left, top },
    ])
    .png()
    .toBuffer();
}

async function buildShellIcons() {
  const pngLayers = await Promise.all(
    ICON_SIZES.map((size) => composeShellIconLayer(size)),
  );
  return toIco(pngLayers);
}

if (!existsSync(logoPng)) {
  console.error(
    `[sync-installer-branding] Missing logo source:\n  ${logoPng}\n` +
      `Paste your PNG there, then run this script again (or pnpm --filter desktop build).`,
  );
  process.exit(1);
}

await writeInstallerPanelBmp({
  ...SIDEBAR,
  panelFill: { r: 255, g: 255, b: 255 },
  invertLogo: false,
  outFile: path.join(nsisDir, "installerSidebar.bmp"),
});

await writeInstallerPanelBmp({
  ...SIDEBAR,
  panelFill: { r: 255, g: 255, b: 255 },
  invertLogo: false,
  outFile: path.join(nsisDir, "uninstallerSidebar.bmp"),
});

await writeInstallerPanelBmp({
  ...HEADER,
  panelFill: { r: 255, g: 255, b: 255 },
  invertLogo: false,
  outFile: path.join(nsisDir, "installerHeader.bmp"),
});

const iconPath = path.join(nsisDir, "icon.ico");
writeFileSync(iconPath, await buildShellIcons());
copyFileSync(iconPath, path.join(nsisDir, "installerIcon.ico"));
copyFileSync(iconPath, path.join(nsisDir, "uninstallerIcon.ico"));

copyFileSync(logoPng, path.join(desktopRoot, "splash-logo.png"));

console.log(`[sync-installer-branding] source: ${logoPng}`);
console.log(`[sync-installer-branding] wrote icons + BMPs under ${nsisDir}`);
