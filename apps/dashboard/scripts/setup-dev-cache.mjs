import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  shouldUseLocalDevCache,
  ensureLocalDevCacheJunction,
} from "./local-dev-cache-dir.mjs";

const dashboardRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const monorepoRoot = path.join(dashboardRoot, "../..");

if (shouldUseLocalDevCache(monorepoRoot)) {
  const junctionPath = ensureLocalDevCacheJunction(dashboardRoot);
  console.log(`[setup-dev-cache] Junction ready: ${junctionPath}`);
}
