const fs = require("node:fs/promises");
const path = require("node:path");
const {
  PROJECTS_DIR_NAME,
  PROJECT_ID_PATTERN,
} = require("./constants");

const ASSETS_DIR_NAME = "assets";
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const IMAGE_ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg"]);
const AUDIO_ASSET_EXTENSIONS = new Set([".mp3"]);

function isPathInsideWorkspace(filePath, workspacePath) {
  const resolvedFile = path.resolve(filePath);
  const resolvedWorkspace = path.resolve(workspacePath);
  const relative = path.relative(resolvedWorkspace, resolvedFile);
  if (!relative || relative === "") {
    return true;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return true;
}

function sanitizeAssetFileName(raw, type) {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  let base = path.basename(raw.replace(/\\/g, "/"));
  if (!base || base.includes("..")) {
    return null;
  }

  base = base.toLowerCase().replace(/\s+/g, "");
  const ext = path.extname(base);
  const allowed =
    type === "audio" ? AUDIO_ASSET_EXTENSIONS : IMAGE_ASSET_EXTENSIONS;
  if (!allowed.has(ext)) {
    return null;
  }

  const nameWithoutExt = base.slice(0, -ext.length);
  const sanitizedName = nameWithoutExt.replace(/[^a-z0-9._-]/g, "_");
  if (!sanitizedName) {
    return null;
  }

  return `${sanitizedName}${ext}`;
}

function resolveProjectAssetPath(workspacePath, projectId, fileName) {
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return null;
  }
  if (!fileName || fileName.includes("..")) {
    return null;
  }

  const assetsDir = path.join(
    workspacePath,
    PROJECTS_DIR_NAME,
    projectId,
    ASSETS_DIR_NAME,
  );
  const resolved = path.normalize(path.join(assetsDir, fileName));

  if (!isPathInsideWorkspace(resolved, workspacePath)) {
    return null;
  }

  const relativeToAssets = path.relative(assetsDir, resolved);
  if (
    !relativeToAssets ||
    relativeToAssets.startsWith("..") ||
    path.isAbsolute(relativeToAssets)
  ) {
    return null;
  }

  return resolved;
}

function bufferFromIpcPayload(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return Buffer.from(buffer);
  }
  if (ArrayBuffer.isView(buffer)) {
    return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return null;
}

async function saveProjectAsset(workspacePath, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }

  const { projectId, fileName, buffer, type } = payload;
  if (typeof projectId !== "string" || typeof fileName !== "string") {
    throw new Error("Invalid projectId or fileName.");
  }
  if (type !== "image" && type !== "audio") {
    throw new Error("Invalid asset type.");
  }

  const bytes = bufferFromIpcPayload(buffer);
  if (!bytes) {
    throw new Error("Invalid buffer.");
  }
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new Error("Asset must be 4 MB or smaller.");
  }

  const safeName = sanitizeAssetFileName(fileName, type);
  if (!safeName) {
    throw new Error("Invalid file name or extension.");
  }

  const resolvedPath = resolveProjectAssetPath(
    workspacePath,
    projectId,
    safeName,
  );
  if (!resolvedPath) {
    throw new Error("Invalid asset path.");
  }

  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, bytes);

  const relativePath = `${ASSETS_DIR_NAME}/${safeName}`.replace(/\\/g, "/");
  return { relativePath, absolutePath: resolvedPath };
}

module.exports = {
  ASSETS_DIR_NAME,
  MAX_ASSET_BYTES,
  AUDIO_ASSET_EXTENSIONS,
  IMAGE_ASSET_EXTENSIONS,
  bufferFromIpcPayload,
  isPathInsideWorkspace,
  resolveProjectAssetPath,
  sanitizeAssetFileName,
  saveProjectAsset,
};
