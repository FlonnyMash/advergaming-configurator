import {
  isTemplateManifest,
  type TemplateManifest,
  type TemplateManifestStatus,
} from "@advergaming/shared";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";

const dashboardRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(dashboardRoot, "../..");
const engineRoot = path.resolve(dashboardRoot, "../game-engine");
const engineTemplatesRoot = path.join(engineRoot, "src/templates");
const libraryRoot = path.join(engineTemplatesRoot, "library");
const developmentRoot = path.join(engineTemplatesRoot, "development");
const previewsRoot = path.join(engineRoot, "public/previews");

export type TemplateLocation = {
  templateId: string;
  source: "library" | "development";
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
    return isTemplateManifest(parsed) ? parsed : null;
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

export function resolveTemplateLocation(
  templateId: string,
): TemplateLocation | null {
  if (!TEMPLATE_ID_PATTERN.test(templateId)) return null;

  const libraryDir = path.join(libraryRoot, templateId);
  if (existsSync(libraryDir) && statSync(libraryDir).isDirectory()) {
    return {
      templateId,
      source: "library",
      directoryPath: libraryDir,
      repositoryPath: path
        .relative(repoRoot, libraryDir)
        .split(path.sep)
        .join("/"),
    };
  }

  const developmentDir = path.join(developmentRoot, templateId);
  if (existsSync(developmentDir) && statSync(developmentDir).isDirectory()) {
    return {
      templateId,
      source: "development",
      directoryPath: developmentDir,
      repositoryPath: path
        .relative(repoRoot, developmentDir)
        .split(path.sep)
        .join("/"),
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

  const { manifest } = details.data;
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
    if (patch.status !== "development" && patch.status !== "production") {
      return { ok: false, error: "Invalid status.", status: 400 };
    }
    next.status = patch.status;
  }

  const write = writeTemplateManifest(templateId, next);
  if (!write.ok) return write;

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
  if (!existsSync(directoryPath)) {
    return { ok: false, error: "Directory does not exist." };
  }

  const platform = process.platform;
  let result;

  if (platform === "win32") {
    result = spawnSync("explorer.exe", [directoryPath], { shell: false });
  } else if (platform === "darwin") {
    result = spawnSync("open", [directoryPath], { shell: false });
  } else {
    result = spawnSync("xdg-open", [directoryPath], { shell: false });
  }

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  return { ok: true };
}
