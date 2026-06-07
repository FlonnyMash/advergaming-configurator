const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const {
  MAX_ASSET_BYTES,
  resolveProjectAssetPath,
  sanitizeAssetFileName,
  saveProjectAsset,
} = require("./asset-ipc-utils");

test("sanitizeAssetFileName strips path segments and invalid extensions", () => {
  assert.equal(sanitizeAssetFileName("../../evil.png", "image"), "evil.png");
  assert.equal(sanitizeAssetFileName("logo.exe", "image"), null);
  assert.equal(sanitizeAssetFileName("My Logo.png", "image"), "mylogo.png");
  assert.equal(sanitizeAssetFileName("brand.svg", "image"), "brand.svg");
  assert.equal(sanitizeAssetFileName("track.mp3", "audio"), "track.mp3");
  assert.equal(sanitizeAssetFileName("track.png", "audio"), null);
});

test("resolveProjectAssetPath stays inside workspace", () => {
  const workspace = path.join(os.tmpdir(), "mg-studio-verify");
  assert.equal(
    resolveProjectAssetPath(workspace, "demo-project", "logo.png"),
    path.normalize(
      path.join(workspace, "Projects", "demo-project", "assets", "logo.png"),
    ),
  );
  assert.equal(
    resolveProjectAssetPath(workspace, "../evil", "logo.png"),
    null,
  );
  assert.equal(
    resolveProjectAssetPath(workspace, "demo-project", "../evil.png"),
    null,
  );
});

test("saveProjectAsset writes file and returns relative assets path", async () => {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "mg-asset-ipc-primary-"),
  );
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const buffer = pngBytes.buffer.slice(
    pngBytes.byteOffset,
    pngBytes.byteOffset + pngBytes.byteLength,
  );

  const result = await saveProjectAsset(workspace, {
    projectId: "catch-demo",
    fileName: "Player Logo.png",
    buffer,
    type: "image",
  });

  assert.equal(result.relativePath, "assets/playerlogo.png");
  assert.deepEqual(await fs.readFile(result.absolutePath), pngBytes);
  assert.ok(result.absolutePath.includes(`${path.sep}Projects${path.sep}`));
  assert.ok(result.absolutePath.endsWith(`${path.sep}assets${path.sep}playerlogo.png`));
});

test("saveProjectAsset rejects oversize buffers", async () => {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "mg-asset-ipc-size-"),
  );
  const oversize = new ArrayBuffer(MAX_ASSET_BYTES + 1);

  await assert.rejects(
    () =>
      saveProjectAsset(workspace, {
        projectId: "catch-demo",
        fileName: "big.png",
        buffer: oversize,
        type: "image",
      }),
    /4 MB or smaller/,
  );
});

test("saveProjectAsset keeps traversal file names inside project assets", async () => {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "mg-asset-ipc-security-"),
  );
  const buffer = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer;

  const result = await saveProjectAsset(workspace, {
    projectId: "catch-demo",
    fileName: "../../evil.png",
    buffer,
    type: "image",
  });

  assert.equal(result.relativePath, "assets/evil.png");
  assert.ok(result.absolutePath.startsWith(path.resolve(workspace)));
  assert.ok(
    result.absolutePath.endsWith(
      path.join("Projects", "catch-demo", "assets", "evil.png"),
    ),
  );
});

test("saveProjectAsset rejects invalid project ids", async () => {
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "mg-asset-ipc-project-id-"),
  );
  const buffer = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer;

  await assert.rejects(
    () =>
      saveProjectAsset(workspace, {
        projectId: "../escape",
        fileName: "logo.png",
        buffer,
        type: "image",
      }),
    /Invalid asset path/,
  );
});
