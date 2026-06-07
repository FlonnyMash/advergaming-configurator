import AdmZip from "adm-zip";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ImportProgressEvent } from "@/lib/template-import-events";
import { formatBytes } from "@/lib/template-import-events";
import {
  dedupeNestedTemplateRoot,
  normalizeTemplateDirectory,
  resolveTemplateIdFromManifest,
  TEMPLATE_ID_PATTERN,
} from "@/lib/template-import-normalize";
import {
  buildManifestFromLegacyConfig,
  readLegacyConfigFromDir,
} from "@/lib/legacy-config-manifest";
import {
  buildRawIndexTs,
  buildRawScaffoldManifest,
  detectSceneBinding,
  listRelativeFilePaths,
  RAW_FALLBACK_GAME_SCENE_TS,
  resolveRawTemplateId,
} from "@/lib/template-import-raw";

export type ProgressEmitter = (event: ImportProgressEvent) => void;

export type TemplateImportOptions = {
  overwrite?: boolean;
};

export type PeekTemplateImportResult =
  | { ok: true; templateId: string; exists: boolean }
  | { ok: false; error: string; status: number };

const dashboardRoot = path.resolve(process.cwd());
const engineTemplatesRoot = path.resolve(
  dashboardRoot,
  "../game-engine/src/templates",
);
const libraryRoot = path.join(engineTemplatesRoot, "library");
const SYNC_COMMAND = "pnpm sync-manifest-registry";
const SYNC_CWD = path.join(dashboardRoot, "../game-engine");

function normalizeZipEntryName(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\/+/, "");
}

function findManifestEntries(zip: AdmZip): AdmZip.IZipEntry[] {
  return zip
    .getEntries()
    .filter(
      (entry) =>
        !entry.isDirectory &&
        normalizeZipEntryName(entry.entryName).endsWith("manifest.json"),
    );
}

function findCanonicalManifestEntry(zip: AdmZip): AdmZip.IZipEntry | null {
  const entries = findManifestEntries(zip);
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0]!;

  const shallow = entries.filter((entry) => {
    const name = normalizeZipEntryName(entry.entryName);
    if (name === "manifest.json") return true;
    const parts = name.split("/");
    return parts.length === 2 && parts[1] === "manifest.json";
  });
  if (shallow.length === 1) return shallow[0]!;

  const doubleWrapped = entries.filter((entry) => {
    const parts = normalizeZipEntryName(entry.entryName).split("/");
    return (
      parts.length === 3 &&
      parts[0] === parts[1] &&
      parts[2] === "manifest.json"
    );
  });
  if (doubleWrapped.length === 1) return doubleWrapped[0]!;

  return null;
}

function readManifestFromZip(zip: AdmZip, entry: AdmZip.IZipEntry): unknown {
  return JSON.parse(entry.getData().toString("utf8"));
}

function detectStripPrefixOnce(entryNames: string[]): string | null {
  const files = entryNames.filter((name) => name.length > 0 && !name.endsWith("/"));
  if (files.length === 0) return null;
  const root = files[0]!.split("/")[0];
  if (!root || root.includes("..")) return null;
  const allUnderRoot = files.every(
    (name) => name === root || name.startsWith(`${root}/`),
  );
  if (!allUnderRoot) return null;
  const hasNested = files.some(
    (name) => name.startsWith(`${root}/`) && name.split("/").length > 2,
  );
  if (!hasNested && files.every((name) => name.split("/").length === 1)) {
    return null;
  }
  return `${root}/`;
}

function detectStripPrefix(entryNames: string[]): string | null {
  let names = entryNames;
  let combined: string | null = null;

  for (;;) {
    const prefix = detectStripPrefixOnce(names);
    if (!prefix) break;
    combined = combined ? `${combined}${prefix}` : prefix;
    names = names
      .map((name) => (name.startsWith(prefix) ? name.slice(prefix.length) : name))
      .filter((name) => name.length > 0);
  }

  return combined;
}

function safeTargetPath(targetDir: string, relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..") || path.isAbsolute(normalized)) return null;
  const resolved = path.resolve(targetDir, normalized);
  const base = path.resolve(targetDir);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

import { shouldSkipTemplatePath } from "@/lib/template-import-shared";

function shouldSkipExtractedPath(relativePath: string): boolean {
  return shouldSkipTemplatePath(relativePath);
}

function extractZipToDirectory(
  zip: AdmZip,
  targetDir: string,
  stripPrefix: string | null,
  emit: ProgressEmitter,
  templateId: string,
): string | null {
  const entries = zip.getEntries().filter((entry) => {
    let relative = normalizeZipEntryName(entry.entryName);
    if (!relative || relative.endsWith("/")) return false;
    if (stripPrefix && relative.startsWith(stripPrefix)) {
      relative = relative.slice(stripPrefix.length);
    }
    if (!relative || shouldSkipExtractedPath(relative)) return false;
    return !entry.isDirectory;
  });

  const total = entries.length;
  emit({
    type: "progress",
    step: "extract",
    message: `Extracting ${total} file(s) to apps/game-engine/src/templates/library/${templateId}/`,
    detail: `Skipping node_modules, .git, dist, build…`,
  });

  mkdirSync(targetDir, { recursive: true });
  let written = 0;

  for (const entry of zip.getEntries()) {
    let relative = normalizeZipEntryName(entry.entryName);
    if (!relative || relative.endsWith("/")) continue;
    if (stripPrefix && relative.startsWith(stripPrefix)) {
      relative = relative.slice(stripPrefix.length);
    }
    if (!relative) continue;
    if (shouldSkipExtractedPath(relative)) continue;
    if (
      relative.includes("..") ||
      /^[a-zA-Z]:/.test(relative) ||
      relative.startsWith("/")
    ) {
      return "Archive contains unsafe paths.";
    }
    const destPath = safeTargetPath(targetDir, relative);
    if (!destPath) return "Archive contains unsafe paths.";
    if (entry.isDirectory) {
      mkdirSync(destPath, { recursive: true });
      continue;
    }
    mkdirSync(path.dirname(destPath), { recursive: true });
    writeFileSync(destPath, entry.getData());
    written += 1;
    if (written % 25 === 0 || written === total) {
      emit({
        type: "progress",
        step: "extract",
        message: `Extracted ${written} / ${total} files…`,
      });
    }
  }

  emit({
    type: "progress",
    step: "extract",
    message: `Finished extracting ${written} file(s).`,
  });

  return null;
}

function runSyncManifestRegistry(emit: ProgressEmitter): {
  ok: true;
} | { ok: false; error: string } {
  emit({
    type: "progress",
    step: "sync",
    message: "Regenerating manifest registry for Studio…",
    command: SYNC_COMMAND,
    detail: `cwd: apps/game-engine`,
  });

  const result = spawnSync("pnpm", ["sync-manifest-registry"], {
    cwd: SYNC_CWD,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    return {
      ok: false,
      error: detail
        ? `Failed to sync manifest registry: ${detail}`
        : "Failed to sync manifest registry.",
    };
  }

  const summary = (result.stdout || "").trim();
  emit({
    type: "progress",
    step: "sync",
    message: summary || "Manifest registry updated.",
  });

  return { ok: true };
}

function injectRawTemplateFiles(
  targetDir: string,
  templateId: string,
  relativeFiles: string[],
  emit: ProgressEmitter,
): void {
  emit({
    type: "progress",
    step: "raw",
    message: "No manifest.json — enabling raw project fallback.",
  });

  const scene = detectSceneBinding(relativeFiles, targetDir);
  if (scene) {
    emit({
      type: "progress",
      step: "raw",
      message: `Detected scene entry: ${scene.importPath}`,
      detail: scene.defaultExport
        ? "default export"
        : `named export ${scene.exportName}`,
    });
  } else {
    emit({
      type: "progress",
      step: "raw",
      message: "No scene entry found — creating placeholder GameScene.ts",
    });
  }

  const legacyConfig = readLegacyConfigFromDir(targetDir);
  const manifest =
    legacyConfig !== null
      ? buildManifestFromLegacyConfig(
          templateId,
          legacyConfig,
          templateId.replace(/-/g, " "),
        )
      : buildRawScaffoldManifest(templateId, templateId.replace(/-/g, " "));

  writeFileSync(
    path.join(targetDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  if (legacyConfig !== null && scene) {
    const indexTs = `import manifest from "./manifest.json";
import legacyConfig from "./public/config.json";
import { createLegacyBridgeScene } from "../../legacy/LegacyTemplateBridgeScene.ts";
import { ${scene.exportName} } from "${scene.importPath}";

const Scene = createLegacyBridgeScene({
  templateId: manifest.id,
  baseConfig: legacyConfig as Record<string, unknown>,
  assetUrlPrefix: "/template-assets/${templateId}",
  SceneClass: ${scene.exportName},
  sceneKey: "PlayScene",
});

export { manifest };
export { Scene };
`;
    writeFileSync(path.join(targetDir, "index.ts"), indexTs, "utf8");
    emit({
      type: "progress",
      step: "raw",
      message: "Wrote legacy bridge manifest, index.ts, and mapped config.json controls.",
    });
  } else {
    if (!scene) {
      writeFileSync(
        path.join(targetDir, "GameScene.ts"),
        RAW_FALLBACK_GAME_SCENE_TS,
        "utf8",
      );
    }
    writeFileSync(
      path.join(targetDir, "index.ts"),
      buildRawIndexTs(templateId, scene),
      "utf8",
    );
    emit({
      type: "progress",
      step: "raw",
      message: "Wrote manifest.json and index.ts",
    });
  }
}

function openZipBuffer(buffer: Buffer): AdmZip | null {
  try {
    return new AdmZip(buffer);
  } catch {
    return null;
  }
}

function resolveTemplateIdFromArchive(
  zip: AdmZip,
  entryNames: string[],
  stripPrefix: string | null,
  fileName: string,
): { ok: true; templateId: string } | { ok: false; error: string; status: number } {
  const allManifestEntries = findManifestEntries(zip);
  if (allManifestEntries.length > 1 && !findCanonicalManifestEntry(zip)) {
    return {
      ok: false,
      error:
        "Multiple manifest.json files found. Use a single template root or a raw project zip.",
      status: 400,
    };
  }

  const canonicalManifest = findCanonicalManifestEntry(zip);
  if (canonicalManifest) {
    let manifestRaw: unknown;
    try {
      manifestRaw = readManifestFromZip(zip, canonicalManifest);
    } catch {
      return { ok: false, error: "manifest.json is not valid JSON.", status: 400 };
    }

    const templateId = resolveTemplateIdFromManifest(manifestRaw);
    if (!templateId) {
      return {
        ok: false,
        error: "manifest.json must include meta.templateId or id.",
        status: 400,
      };
    }

    if (!TEMPLATE_ID_PATTERN.test(templateId)) {
      return {
        ok: false,
        error: "Template ID must be kebab-case (e.g. my-game).",
        status: 400,
      };
    }

    return { ok: true, templateId };
  }

  const templateId = resolveRawTemplateId(entryNames, stripPrefix, fileName);
  if (!TEMPLATE_ID_PATTERN.test(templateId)) {
    return {
      ok: false,
      error: "Could not derive a valid template ID from the zip folder name.",
      status: 400,
    };
  }

  return { ok: true, templateId };
}

export function peekTemplateImport(
  fileName: string,
  buffer: Buffer,
): PeekTemplateImportResult {
  const zip = openZipBuffer(buffer);
  if (!zip) {
    return { ok: false, error: "Invalid or corrupted zip archive.", status: 400 };
  }

  const entryNames = zip
    .getEntries()
    .map((entry) => normalizeZipEntryName(entry.entryName))
    .filter((name) => name.length > 0);

  if (entryNames.length === 0) {
    return { ok: false, error: "Zip archive contains no files.", status: 400 };
  }

  const stripPrefix = detectStripPrefix(entryNames);
  const resolved = resolveTemplateIdFromArchive(zip, entryNames, stripPrefix, fileName);
  if (!resolved.ok) {
    return resolved;
  }

  const targetDir = path.join(libraryRoot, resolved.templateId);
  return {
    ok: true,
    templateId: resolved.templateId,
    exists: existsSync(targetDir),
  };
}

function removeExistingTemplate(
  templateId: string,
  emit: ProgressEmitter,
): void {
  const targetDir = path.join(libraryRoot, templateId);
  if (!existsSync(targetDir)) {
    return;
  }

  emit({
    type: "progress",
    step: "overwrite",
    message: `Removing existing template "${templateId}"…`,
    detail: `apps/game-engine/src/templates/library/${templateId}/`,
  });
  rmSync(targetDir, { recursive: true, force: true });
  emit({
    type: "progress",
    step: "overwrite",
    message: `Removed previous "${templateId}" installation.`,
  });
}

function ensureTargetAvailable(
  templateId: string,
  overwrite: boolean,
  emit: ProgressEmitter,
): boolean {
  const targetDir = path.join(libraryRoot, templateId);
  if (!existsSync(targetDir)) {
    return true;
  }

  if (!overwrite) {
    emit({
      type: "error",
      ok: false,
      error: `Template "${templateId}" already exists in library/.`,
      status: 409,
    });
    return false;
  }

  removeExistingTemplate(templateId, emit);
  return true;
}

function finalizeImport(
  targetDir: string,
  templateId: string,
  emit: ProgressEmitter,
): { ok: true; status: "IMPORTED" | "RAW_CONVERTED" } | { ok: false; error: string; status: number } {
  emit({
    type: "progress",
    step: "normalize",
    message: "Normalizing manifest and template entry (index.ts)…",
  });

  dedupeNestedTemplateRoot(targetDir, templateId);

  const normalizeResult = normalizeTemplateDirectory(targetDir, templateId);
  if (!normalizeResult.ok) {
    rmSync(targetDir, { recursive: true, force: true });
    return { ok: false, error: normalizeResult.error, status: 400 };
  }

  emit({
    type: "progress",
    step: "normalize",
    message: "Template manifest validated.",
  });

  const syncResult = runSyncManifestRegistry(emit);
  if (!syncResult.ok) {
    rmSync(targetDir, { recursive: true, force: true });
    runSyncManifestRegistry(emit);
    return { ok: false, error: syncResult.error, status: 500 };
  }

  return { ok: true, status: "IMPORTED" };
}

export async function runTemplateImport(
  file: File,
  buffer: Buffer,
  emit: ProgressEmitter,
  options: TemplateImportOptions = {},
): Promise<void> {
  const overwrite = options.overwrite === true;

  emit({
    type: "progress",
    step: "upload",
    message: `Received ${file.name} (${formatBytes(buffer.length)})`,
  });

  emit({ type: "progress", step: "parse", message: "Opening zip archive…" });
  const zip = openZipBuffer(buffer);
  if (!zip) {
    emit({
      type: "error",
      ok: false,
      error: "Invalid or corrupted zip archive.",
      status: 400,
    });
    return;
  }

  const entryNames = zip
    .getEntries()
    .map((entry) => normalizeZipEntryName(entry.entryName))
    .filter((name) => name.length > 0);
  const stripPrefix = detectStripPrefix(entryNames);
  const fileCount = zip.getEntries().filter((e) => !e.isDirectory).length;

  emit({
    type: "progress",
    step: "parse",
    message: `Archive contains ${fileCount} entries.`,
    detail: stripPrefix ? `Root folder: ${stripPrefix.replace(/\/$/, "")}` : "Flat layout",
  });

  if (entryNames.length === 0) {
    emit({
      type: "error",
      ok: false,
      error: "Zip archive contains no files.",
      status: 400,
    });
    return;
  }

  const resolved = resolveTemplateIdFromArchive(zip, entryNames, stripPrefix, file.name);
  if (!resolved.ok) {
    emit({ type: "error", ok: false, error: resolved.error, status: resolved.status });
    return;
  }

  const { templateId } = resolved;
  const canonicalManifest = findCanonicalManifestEntry(zip);

  if (canonicalManifest) {
    emit({
      type: "progress",
      step: "detect",
      message: "Found manifest.json — standard template import.",
    });

    emit({
      type: "progress",
      step: "detect",
      message: `Template ID: ${templateId}`,
    });

    if (!ensureTargetAvailable(templateId, overwrite, emit)) {
      return;
    }

    const targetDir = path.join(libraryRoot, templateId);

    const extractError = extractZipToDirectory(
      zip,
      targetDir,
      stripPrefix,
      emit,
      templateId,
    );
    if (extractError) {
      emit({ type: "error", ok: false, error: extractError, status: 400 });
      return;
    }

    const result = finalizeImport(targetDir, templateId, emit);
    if (!result.ok) {
      emit({ type: "error", ok: false, error: result.error, status: result.status });
      return;
    }

    emit({
      type: "done",
      ok: true,
      status: "IMPORTED",
      templateId,
    });
    return;
  }

  emit({
    type: "progress",
    step: "detect",
    message: `Raw legacy project — template ID: ${templateId}`,
  });

  if (!ensureTargetAvailable(templateId, overwrite, emit)) {
    return;
  }

  const targetDir = path.join(libraryRoot, templateId);

  const extractError = extractZipToDirectory(
    zip,
    targetDir,
    stripPrefix,
    emit,
    templateId,
  );
  if (extractError) {
    emit({ type: "error", ok: false, error: extractError, status: 400 });
    return;
  }

  const relativeFiles = listRelativeFilePaths(entryNames, stripPrefix);
  injectRawTemplateFiles(targetDir, templateId, relativeFiles, emit);

  const result = finalizeImport(targetDir, templateId, emit);
  if (!result.ok) {
    emit({ type: "error", ok: false, error: result.error, status: result.status });
    return;
  }

  emit({
    type: "done",
    ok: true,
    status: "RAW_CONVERTED",
    templateId,
  });
}
