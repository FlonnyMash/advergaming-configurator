import { applyPath, type GameConfig } from "@mashedgames/shared";
import { createHash } from "node:crypto";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROJECT_FILES, resolveProjectDir } from "@/lib/project-paths";

const DATA_URL_RE = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i;

export function isDataUrlImage(value: unknown): value is string {
  return typeof value === "string" && DATA_URL_RE.test(value);
}

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

export async function persistDataUrlToProjectAssets(
  projectId: string,
  dataUrl: string,
  hintName: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) {
    throw new Error("Invalid image data URL.");
  }
  const ext = match[1] === "jpeg" || match[1] === "jpg" ? "jpg" : "png";
  const buffer = Buffer.from(match[2], "base64");
  return persistBufferToProjectAssets(
    projectId,
    buffer,
    `${hintName}.${ext}`,
  );
}

export async function migrateClientBrandingAssets(
  projectId: string,
  branding: GameConfig,
  existingRuntime: Record<string, string>,
): Promise<{ branding: GameConfig; runtimeAssets: Record<string, string> }> {
  const runtimeAssets = { ...existingRuntime };
  const cloned = structuredClone(branding) as Record<string, unknown>;

  async function walk(node: unknown, pathPrefix: string): Promise<void> {
    if (typeof node === "string") {
      if (isDataUrlImage(node) && pathPrefix) {
        const hint = pathPrefix.split(".").pop() ?? "asset";
        const { relativePath, absolutePath } =
          await persistDataUrlToProjectAssets(projectId, node, hint);
        applyPath(cloned, pathPrefix, relativePath);
        runtimeAssets[relativePath] = absolutePath;
      }
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        await walk(node[i], `${pathPrefix}.${i}`);
      }
      return;
    }

    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        await walk(value, nextPath);
      }
    }
  }

  await walk(cloned, "");
  return { branding: cloned as GameConfig, runtimeAssets };
}
