import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { materializeStandaloneBundle } from "./materialize-standalone-bundle.mjs";

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneAppDir = path.join(
  dashboardRoot,
  ".next",
  "standalone",
  "apps",
  "dashboard",
);

function copyDir(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing build output: ${from}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

copyDir(
  path.join(dashboardRoot, ".next", "static"),
  path.join(standaloneAppDir, ".next", "static"),
);
copyDir(path.join(dashboardRoot, "public"), path.join(standaloneAppDir, "public"));

const strayGameEngineDir = path.join(standaloneAppDir, "..", "game-engine");
if (fs.existsSync(strayGameEngineDir)) {
  fs.rmSync(strayGameEngineDir, { recursive: true, force: true });
}

materializeStandaloneBundle();
