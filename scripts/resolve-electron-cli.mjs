import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Resolve the Electron CLI entry for local dev launches.
 * Tries desktop-local install first, then monorepo root (pnpm hoisting).
 */
export function resolveElectronCli(desktopRoot = path.join(repoRoot, "apps", "desktop")) {
  const candidates = [
    path.join(desktopRoot, "node_modules", "electron", "cli.js"),
    path.join(repoRoot, "node_modules", "electron", "cli.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Electron CLI not found. Run `pnpm install` from the monorepo root.",
  );
}

export function resolveDesktopRoot() {
  return path.join(repoRoot, "apps", "desktop");
}
