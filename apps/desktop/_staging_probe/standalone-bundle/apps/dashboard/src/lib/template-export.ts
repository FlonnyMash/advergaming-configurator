import AdmZip from "adm-zip";
import { isTemplateManifest, type GameMasterConfig } from "@mashedgames/shared";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeStudioConfigIntoLegacyConfig } from "@/lib/legacy-config-merge";
import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";
import {
  isNestedTemplateMirrorPath,
  shouldSkipTemplatePath,
} from "@/lib/template-import-shared";

const dashboardRoot = path.resolve(process.cwd());
const libraryRoot = path.resolve(
  dashboardRoot,
  "../game-engine/src/templates/library",
);

/** Portable index: no monorepo legacy bridge — re-imports cleanly via standard importer. */
export function buildPortableIndexTs(
  templateId: string,
  playSceneImportPath = "./src/game/scenes/PlayScene.ts",
): string {
  const sceneImport = playSceneImportPath.replace(/\\/g, "/");
  const entryKey = `${templateId}-entry`;

  return `import Phaser from "phaser";
import manifest from "./manifest.json";
import legacyConfig from "./public/config.json";
import { PlayScene } from "${sceneImport}";

/**
 * Portable entry scene: sets registry config then starts PlayScene.
 * Generated for zip export — re-imports cleanly via Studio without monorepo-only paths.
 */
export class Scene extends Phaser.Scene {
  constructor() {
    super({ key: "${entryKey}" });
  }

  create(): void {
    this.game.registry.set("config", legacyConfig);
    this.scene.add("PlayScene", PlayScene, true);
  }
}

export { manifest };
export { Scene };
`;
}

function stripSelfTemplateImportPrefix(
  importPath: string,
  templateId: string,
): string {
  const bogus = `./${templateId}/`;
  if (importPath.startsWith(bogus)) {
    return `./${importPath.slice(bogus.length)}`;
  }
  return importPath;
}

function detectPlaySceneImportPath(
  templateDir: string,
  templateId: string,
): string {
  const defaultPath = "./src/game/scenes/PlayScene.ts";
  const defaultAbsolute = path.join(templateDir, "src/game/scenes/PlayScene.ts");
  if (existsSync(defaultAbsolute)) {
    return defaultPath;
  }

  const indexPath = path.join(templateDir, "index.ts");
  if (!existsSync(indexPath)) {
    return defaultPath;
  }

  const source = readFileSync(indexPath, "utf8");
  const fromIndex = /from\s+["'](\.\/[^"']*PlayScene[^"']*)["']/.exec(source);
  if (fromIndex?.[1]) {
    let p = stripSelfTemplateImportPrefix(
      fromIndex[1].replace(/\\/g, "/"),
      templateId,
    );
    p = p.endsWith(".ts") ? p : `${p}.ts`;
    const resolved = path.join(templateDir, p.replace(/^\.\//, ""));
    if (existsSync(resolved)) {
      return p;
    }
  }

  return defaultPath;
}

function listFilesRecursive(dir: string, baseDir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(baseDir, absolute).replace(/\\/g, "/");

    if (shouldSkipTemplatePath(relative)) continue;

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolute, baseDir));
      continue;
    }

    files.push(relative);
  }

  return files;
}

function readManifest(templateDir: string, templateId: string): object {
  const manifestPath = path.join(templateDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json in ${templateId}.`);
  }

  const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isTemplateManifest(raw)) {
    throw new Error(`Invalid manifest.json for ${templateId}.`);
  }

  if (raw.id !== templateId) {
    return { ...raw, id: templateId };
  }

  return raw;
}

function buildConfigJsonForZip(
  templateDir: string,
  templateId: string,
  studioConfig?: GameMasterConfig,
): string | null {
  const configPath = path.join(templateDir, "public", "config.json");
  if (!existsSync(configPath) && !studioConfig) {
    return null;
  }

  let base: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    base = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  }

  if (studioConfig) {
    base = mergeStudioConfigIntoLegacyConfig(base, studioConfig);
  }

  return `${JSON.stringify(base, null, 2)}\n`;
}

export type BuildTemplateZipResult =
  | { ok: true; buffer: Buffer; fileCount: number }
  | { ok: false; error: string; status: number };

export type ExportTemplateToDirectoryResult =
  | { ok: true; fileCount: number; destDir: string }
  | { ok: false; error: string; status: number };

async function writeExportFile(
  destDir: string,
  relative: string,
  content: string | Buffer,
): Promise<void> {
  const absolute = path.join(destDir, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content);
}

export async function exportTemplateToDirectory(
  templateId: string,
  destDir: string,
  studioConfig?: GameMasterConfig,
): Promise<ExportTemplateToDirectoryResult> {
  if (!TEMPLATE_ID_PATTERN.test(templateId)) {
    return { ok: false, error: "Invalid template ID.", status: 400 };
  }

  const templateDir = path.join(libraryRoot, templateId);
  if (!existsSync(templateDir) || !statSync(templateDir).isDirectory()) {
    return {
      ok: false,
      error: `Template "${templateId}" is not installed in library/.`,
      status: 404,
    };
  }

  try {
    let fileCount = 0;
    const manifest = readManifest(templateDir, templateId);
    await writeExportFile(
      destDir,
      "manifest.json",
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    fileCount += 1;

    const portableIndex = buildPortableIndexTs(
      templateId,
      detectPlaySceneImportPath(templateDir, templateId),
    );
    await writeExportFile(destDir, "index.ts", portableIndex);
    fileCount += 1;

    const configJson = buildConfigJsonForZip(templateDir, templateId, studioConfig);
    if (configJson) {
      await writeExportFile(destDir, "public/config.json", configJson);
      fileCount += 1;
    }

    const relativeFiles = listFilesRecursive(templateDir, templateDir);
    const skipFiles = new Set(["manifest.json", "index.ts", "public/config.json"]);

    for (const relative of relativeFiles) {
      if (skipFiles.has(relative.replace(/\\/g, "/"))) {
        continue;
      }
      if (isNestedTemplateMirrorPath(relative, templateId)) {
        continue;
      }
      const absolute = path.join(templateDir, relative);
      await writeExportFile(destDir, relative, readFileSync(absolute));
      fileCount += 1;
    }

    return { ok: true, fileCount, destDir };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export template.";
    return { ok: false, error: message, status: 500 };
  }
}

export function buildTemplateZip(
  templateId: string,
  studioConfig?: GameMasterConfig,
): BuildTemplateZipResult {
  if (!TEMPLATE_ID_PATTERN.test(templateId)) {
    return {
      ok: false,
      error: "Invalid template ID.",
      status: 400,
    };
  }

  const templateDir = path.join(libraryRoot, templateId);
  if (!existsSync(templateDir) || !statSync(templateDir).isDirectory()) {
    return {
      ok: false,
      error: `Template "${templateId}" is not installed in library/.`,
      status: 404,
    };
  }

  try {
    const zip = new AdmZip();
    const zipRoot = `${templateId}/`;
    let fileCount = 0;

    const manifest = readManifest(templateDir, templateId);
    zip.addFile(
      `${zipRoot}manifest.json`,
      Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    );
    fileCount += 1;

    const portableIndex = buildPortableIndexTs(
      templateId,
      detectPlaySceneImportPath(templateDir, templateId),
    );
    zip.addFile(`${zipRoot}index.ts`, Buffer.from(portableIndex, "utf8"));
    fileCount += 1;

    const configJson = buildConfigJsonForZip(templateDir, templateId, studioConfig);
    if (configJson) {
      zip.addFile(`${zipRoot}public/config.json`, Buffer.from(configJson, "utf8"));
      fileCount += 1;
    }

    const relativeFiles = listFilesRecursive(templateDir, templateDir);
    const skipInZip = new Set(["manifest.json", "index.ts", "public/config.json"]);

    for (const relative of relativeFiles) {
      if (skipInZip.has(relative.replace(/\\/g, "/"))) {
        continue;
      }
      if (isNestedTemplateMirrorPath(relative, templateId)) {
        continue;
      }

      const absolute = path.join(templateDir, relative);
      zip.addFile(`${zipRoot}${relative}`, readFileSync(absolute));
      fileCount += 1;
    }

    return { ok: true, buffer: zip.toBuffer(), fileCount };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build template archive.";
    return { ok: false, error: message, status: 500 };
  }
}
