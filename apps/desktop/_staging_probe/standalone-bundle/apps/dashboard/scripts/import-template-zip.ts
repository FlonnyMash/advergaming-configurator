#!/usr/bin/env node
/**
 * Install a template zip into game-engine library/ (CLI alternative to Studio import).
 *
 * Usage: pnpm import-template <path-to.zip> [--overwrite]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ImportProgressEvent } from "../src/lib/template-import-events.ts";
import { runTemplateImport } from "../src/lib/template-import-runner.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(scriptDir, "..");

function parseArgs(argv: string[]): { zipPath: string; overwrite: boolean } {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const zipPath = positional[0];
  if (!zipPath) {
    console.error("Usage: pnpm import-template <path-to.zip> [--overwrite]");
    process.exit(1);
  }
  const candidates = path.isAbsolute(zipPath)
    ? [zipPath]
    : [
        path.resolve(process.cwd(), zipPath),
        path.resolve(dashboardRoot, zipPath),
        path.resolve(dashboardRoot, "..", "..", zipPath),
      ];
  const resolved =
    candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
  return {
    zipPath: resolved,
    overwrite: flags.includes("--overwrite"),
  };
}

function logEvent(event: ImportProgressEvent): void {
  if (event.type === "progress") {
    const detail = event.detail ? ` (${event.detail})` : "";
    console.log(`[${event.step}] ${event.message}${detail}`);
    return;
  }
  if (event.type === "error") {
    console.error(`ERROR: ${event.error}`);
    process.exit(event.status === 409 ? 2 : 1);
  }
  if (event.type === "done") {
    console.log(`Done: ${event.templateId} (${event.status})`);
  }
}

async function main(): Promise<void> {
  const { zipPath, overwrite } = parseArgs(process.argv.slice(2));
  const buffer = readFileSync(zipPath);
  const fileName = path.basename(zipPath);
  const file = new File([buffer], fileName, { type: "application/zip" });

  await runTemplateImport(file, buffer, logEvent, { overwrite });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
