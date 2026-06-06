import {
  parseTemplateManifest,
  type TemplateManifest,
  type TemplateManifestStatus,
} from "@mashedgames/shared";
import { openDirectoryInFileExplorer } from "@/lib/open-directory";
import { ensureWorkspaceExists } from "@/lib/project-paths";
import {
  nextVersionForPublish,
  writePublishedSystemJson,
} from "@/lib/template-publish";
import {
  isMonorepoTemplateLibraryOnDisk,
  monorepoRoot,
  templateLibraryRoot,
} from "@/lib/template-library-root";
import { runSyncManifestRegistry } from "@/lib/template-sync-registry";
import { isWorkspaceDesktop } from "@/lib/runtime-env";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";
import type { TemplateOverviewEntry } from "@/lib/template-overview-types";

const engineRoot = path.resolve(process.cwd(), "../game-engine");
const previewsRoot = path.join(engineRoot, "public/previews");

export type TemplateLocation = {
  templateId: string;
  directoryPath: string;
  repositoryPath: string;
};

export type TemplateDetails = TemplateLocation & {
  manifest: TemplateManifest;
  createdAt: string;
  updatedAt: string;
  manifestUpdatedAt: string;
};

function readManifestFile(manifestPath: string): TemplateManifest | null {
  if (!existsSync(manifestPath)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    return parseTemplateManifest(parsed);
  } catch {
    return null;
  }
}

function isoStatTime(
  filePath: string,
  field: "mtime" | "birthtime" = "mtime",
): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const stat = statSync(filePath);
    const value = field === "birthtime" ? stat.birthtime : stat.mtime;
    return value.toISOString();
  } catch {
    return null;
  }
}

function repositoryPathForTemplate(templateDir: string): string {
  if (isWorkspaceDesktop()) {
    return path
      .relative(templateLibraryRoot, templateDir)
      .split(path.sep)
      .join("/");
  }
  return path.relative(monorepoRoot, templateDir).split(path.sep).join("/");
}

export function resolveTemplateLocation(
  templateId: string,
): TemplateLocation | null {
  if (!TEMPLATE_ID_PATTERN.test(templateId)) return null;

  const templateDir = path.join(templateLibraryRoot, templateId);
  if (existsSync(templateDir) && statSync(templateDir).isDirectory()) {
    return {
      templateId,
      directoryPath: templateDir,
      repositoryPath: repositoryPathForTemplate(templateDir),
    };
  }

  return null;
}

export function getTemplateDetails(
  templateId: string,
):
  | { ok: true; data: TemplateDetails }
  | { ok: false; error: string; status: number } {
  const location = resolveTemplateLocation(templateId);
  if (!location) {
    return { ok: false, error: "Template not found.", status: 404 };
  }

  const manifestPath = path.join(location.directoryPath, "manifest.json");
  const manifest = readManifestFile(manifestPath);
  if (!manifest) {
    return { ok: false, error: "Invalid or missing manifest.json.", status: 500 };
  }

  const createdAt =
    isoStatTime(location.directoryPath, "birthtime") ??
    isoStatTime(location.directoryPath) ??
    new Date().toISOString();
  const manifestUpdatedAt =
    isoStatTime(manifestPath) ?? createdAt;
  const dirUpdatedAt = isoStatTime(location.directoryPath) ?? manifestUpdatedAt;
  const updatedAt =
    manifestUpdatedAt > dirUpdatedAt ? manifestUpdatedAt : dirUpdatedAt;

  return {
    ok: true,
    data: {
      ...location,
      manifest,
      createdAt,
      updatedAt,
      manifestUpdatedAt,
    },
  };
}

export function writeTemplateManifest(
  templateId: string,
  manifest: TemplateManifest,
): { ok: true } | { ok: false; error: string; status: number } {
  if (isWorkspaceDesktop()) {
    ensureWorkspaceExists();
  }

  const location = resolveTemplateLocation(templateId);
  if (!location) {
    return { ok: false, error: "Template not found.", status: 404 };
  }

  if (manifest.id !== templateId) {
    return { ok: false, error: "Manifest id cannot be changed.", status: 400 };
  }

  const manifestPath = path.join(location.directoryPath, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { ok: true };
}

export type TemplateManifestPatch = {
  label?: string;
  description?: string;
  status?: TemplateManifestStatus;
  author?: string;
};

export function patchTemplateManifest(
  templateId: string,
  patch: TemplateManifestPatch,
):
  | { ok: true; manifest: TemplateManifest }
  | { ok: false; error: string; status: number } {
  const details = getTemplateDetails(templateId);
  if (!details.ok) {
    return details;
  }

  const { manifest, directoryPath } = details.data;
  const next: TemplateManifest = { ...manifest };

  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) {
      return { ok: false, error: "Name is required.", status: 400 };
    }
    next.label = label;
  }

  if (patch.description !== undefined) {
    next.description = patch.description.trim() || undefined;
  }

  if (patch.author !== undefined) {
    const author = patch.author.trim();
    if (!author) {
      return { ok: false, error: "Author is required.", status: 400 };
    }
    next.author = author;
  }

  if (patch.status !== undefined) {
    if (patch.status !== "draft" && patch.status !== "published") {
      return { ok: false, error: "Invalid status.", status: 400 };
    }

    if (patch.status === "published" && manifest.status !== "published") {
      next.version = nextVersionForPublish(manifest);
    }

    next.status = patch.status;
  }

  const write = writeTemplateManifest(templateId, next);
  if (!write.ok) return write;

  if (next.status === "published") {
    writePublishedSystemJson(directoryPath, next);
  }

  if (isMonorepoTemplateLibraryOnDisk()) {
    const syncResult = runSyncManifestRegistry();
    if (!syncResult.ok) {
      return { ok: false, error: syncResult.error, status: 500 };
    }
  }

  return { ok: true, manifest: next };
}

export function saveTemplatePreviewPng(
  templateId: string,
  pngBuffer: Buffer,
):
  | { ok: true; previewUrl: string }
  | { ok: false; error: string; status: number } {
  const location = resolveTemplateLocation(templateId);
  if (!location) {
    return { ok: false, error: "Template not found.", status: 404 };
  }

  if (!pngBuffer.length) {
    return { ok: false, error: "Empty image file.", status: 400 };
  }

  mkdirSync(previewsRoot, { recursive: true });
  const previewFileName = `${templateId}.png`;
  const previewAbsolute = path.join(previewsRoot, previewFileName);
  writeFileSync(previewAbsolute, pngBuffer);

  const previewUrl = `/previews/${previewFileName}`;
  const details = getTemplateDetails(templateId);
  if (!details.ok) {
    return details;
  }

  const nextManifest: TemplateManifest = {
    ...details.data.manifest,
    previewUrl,
  };
  const write = writeTemplateManifest(templateId, nextManifest);
  if (!write.ok) return write;

  return { ok: true, previewUrl };
}

export function openTemplateDirectory(
  directoryPath: string,
): { ok: true } | { ok: false; error: string } {
  return openDirectoryInFileExplorer(directoryPath);
}

export type { TemplateOverviewEntry } from "@/lib/template-overview-types";

const SKIP_TEMPLATE_DIRS = new Set(["library", "development", "legacy"]);

/** Live template list from disk — status reflects manifest.json, not the build-time registry. */
export function listTemplateOverviewFromDisk(): TemplateOverviewEntry[] {
  if (!existsSync(templateLibraryRoot)) {
    return [];
  }

  const entries: TemplateOverviewEntry[] = [];

  for (const dirent of readdirSync(templateLibraryRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory() || SKIP_TEMPLATE_DIRS.has(dirent.name)) {
      continue;
    }

    const manifestPath = path.join(templateLibraryRoot, dirent.name, "manifest.json");
    const manifest = readManifestFile(manifestPath);
    if (!manifest) {
      continue;
    }

    entries.push({
      id: manifest.id,
      label: manifest.label,
      description: manifest.description,
      previewUrl: manifest.previewUrl,
      version: manifest.version,
      author: manifest.author,
      status: manifest.status,
    });
  }

  return entries.sort((a, b) => a.label.localeCompare(b.label));
}
