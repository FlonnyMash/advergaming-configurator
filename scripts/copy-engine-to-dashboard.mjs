import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineDist = path.join(repoRoot, "apps/game-engine/dist");
const dashboardPublic = path.join(repoRoot, "apps/dashboard/public");

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

copyDir(engineDist, path.join(dashboardPublic, "engine"));

const templateAssetsSrc = path.join(engineDist, "template-assets");
const templateAssetsDest = path.join(dashboardPublic, "template-assets");
if (fs.existsSync(templateAssetsSrc)) {
  copyDir(templateAssetsSrc, templateAssetsDest);
}
