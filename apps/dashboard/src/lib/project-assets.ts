import type { GameConfig } from "@mashedgames/shared";
import { patchFlatConfig } from "@mashedgames/shared";
import { createHash } from "node:crypto";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROJECT_FILES, resolveProjectDir } from "@/lib/project-paths";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function copyDroppedFileToProjectAssets(
  projectId: string,
  fileName: string,
  sourceAbsolutePath: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const assetsDir = path.join(resolveProjectDir(projectId), PROJECT_FILES.assetsDir);
  await mkdir(assetsDir, { recursive: true });
  const safeName = sanitizeFileName(fileName);
  const hash = createHash("sha256")
    .update(sourceAbsolutePath)
    .digest("hex")
    .slice(0, 8);
  const destName = `${hash}-${safeName}`;
  const absolutePath = path.join(assetsDir, destName);
  await copyFile(sourceAbsolutePath, absolutePath);
  return {
    relativePath: `${PROJECT_FILES.assetsDir}/${destName}`.replace(/\\/g, "/"),
    absolutePath,
  };
}

export async function persistBufferToProjectAssets(
  projectId: string,
  buffer: Buffer,
  hintName: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const assetsDir = path.join(resolveProjectDir(projectId), PROJECT_FILES.assetsDir);
  await mkdir(assetsDir, { recursive: true });
  const safeName = sanitizeFileName(hintName);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 8);
  const ext = path.extname(safeName) || ".png";
  const base = ext ? safeName.replace(/\.[^.]+$/, "") : safeName;
  const destName = `${hash}-${base}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const absolutePath = path.join(assetsDir, destName);
  await writeFile(absolutePath, buffer);
  return {
    relativePath: `${PROJECT_FILES.assetsDir}/${destName}`.replace(/\\/g, "/"),
    absolutePath,
  };
}

export async function migrateClientBrandingAssets(
  projectId: string,
  client: GameConfig,
  existingRuntime: Record<string, string>,
): Promise<{ branding: GameConfig; runtimeAssets: Record<string, string> }> {
  void projectId;
  return {
    branding: client,
    runtimeAssets: existingRuntime,
  };
}

export function setFlatConfigField(
  config: GameConfig,
  key: keyof GameConfig,
  value: GameConfig[keyof GameConfig],
): GameConfig {
  return patchFlatConfig(config, key, value);
}
