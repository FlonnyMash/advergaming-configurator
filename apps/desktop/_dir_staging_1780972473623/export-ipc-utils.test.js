const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const AdmZip = require("adm-zip");
const {
  exportProjectToZip,
  resolveProjectAssetsDir,
  resolveProjectDir,
} = require("./export-ipc-utils");

test("resolveProjectDir validates project IDs", () => {
  const workspace = path.join(os.tmpdir(), "mg-export-verify");
  assert.equal(
    resolveProjectDir(workspace, "demo-project"),
    path.normalize(path.join(workspace, "Projects", "demo-project")),
  );
  assert.equal(resolveProjectDir(workspace, "../evil"), null);
});

test("exportProjectToZip writes flat engine, config, and project assets", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mg-export-zip-"));
  const workspacePath = path.join(root, "workspace");
  const engineDir = path.join(root, "engine");
  const projectId = "demo-project";
  const assetsDir = path.join(
    workspacePath,
    "Projects",
    projectId,
    "assets",
  );

  await fs.mkdir(path.join(engineDir, "assets"), { recursive: true });
  await fs.writeFile(
    path.join(engineDir, "index.html"),
    '<script src="./assets/index.js"></script>',
    "utf8",
  );
  await fs.writeFile(
    path.join(engineDir, "assets", "index.js"),
    "console.log('engine');",
    "utf8",
  );
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, "logo.png"), "png-bytes", "utf8");

  const zipPath = path.join(root, "demo-project-export.zip");
  const configJson = '{"meta":{"templateId":"catch-game-demo","schemaVersion":1}}\n';

  await exportProjectToZip({
    workspacePath,
    engineDir,
    destZipPath: zipPath,
    configJson,
    projectId,
  });

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().map((entry) => entry.entryName).sort();

  assert.ok(entries.includes("index.html"));
  assert.ok(entries.includes("assets/index.js"));
  assert.ok(entries.includes("config.json"));
  assert.ok(entries.includes("assets/logo.png"));

  assert.equal(
    zip.readAsText("config.json"),
    configJson,
  );
});

test("resolveProjectAssetsDir stays inside workspace", () => {
  const workspace = path.join(os.tmpdir(), "mg-export-assets");
  assert.equal(
    resolveProjectAssetsDir(workspace, "demo-project"),
    path.normalize(
      path.join(workspace, "Projects", "demo-project", "assets"),
    ),
  );
  assert.equal(resolveProjectAssetsDir(workspace, "../evil"), null);
});
