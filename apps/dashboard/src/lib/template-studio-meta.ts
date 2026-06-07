import type { TemplateManifestStatus } from "@/lib/template-overview-types";
import path from "node:path";
import { existsSync } from "node:fs";
import { templateLibraryRoot } from "@/lib/project-paths";

export type TemplateStudioMeta = {
  id: string;
  version: string;
  status: TemplateManifestStatus;
};

export type TemplateManifestPatch = Partial<TemplateStudioMeta>;

type TemplateDetailsData = {
  templateId: string;
  directoryPath: string;
  repositoryPath: string;
  manifest: TemplateStudioMeta;
  createdAt: string;
  updatedAt: string;
  manifestUpdatedAt: string;
};

export function readTemplateStudioMeta(templateId: string): TemplateStudioMeta {
  return {
    id: templateId,
    version: "2.0.0",
    status: "published",
  };
}

export function getTemplateDetails(templateId: string):
  | { ok: true; data: TemplateDetailsData }
  | { ok: false; error: string; status: number } {
  const directoryPath = path.join(templateLibraryRoot, templateId);
  if (!existsSync(directoryPath)) {
    return { ok: false, error: `Template "${templateId}" not found.`, status: 404 };
  }

  const now = new Date().toISOString();
  const manifest = readTemplateStudioMeta(templateId);

  return {
    ok: true,
    data: {
      templateId,
      directoryPath,
      repositoryPath: directoryPath,
      manifest,
      createdAt: now,
      updatedAt: now,
      manifestUpdatedAt: now,
    },
  };
}

export function resolveTemplateLocation(templateId: string): string {
  return path.join(templateLibraryRoot, templateId);
}

export function listTemplateOverviewFromDisk(): Array<{
  id: string;
  displayName: string;
  status: TemplateManifestStatus;
}> {
  return [{ id: "default", displayName: "Default template", status: "published" }];
}

export async function publishTemplate(_templateId: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export function patchTemplateManifest(
  templateId: string,
  patch: TemplateManifestPatch,
):
  | { ok: true; manifest: TemplateStudioMeta }
  | { ok: false; error: string; status: number } {
  const current = readTemplateStudioMeta(templateId);
  return {
    ok: true,
    manifest: { ...current, ...patch, id: templateId },
  };
}

export function openTemplateDirectory(templateId: string):
  | { ok: true; data: { directoryPath: string } }
  | { ok: false; error: string; status: number } {
  const details = getTemplateDetails(templateId);
  if (!details.ok) {
    return details;
  }
  return {
    ok: true,
    data: { directoryPath: details.data.directoryPath },
  };
}

export function saveTemplatePreviewPng(
  _templateId: string,
  _buffer: Buffer,
):
  | { ok: true; previewUrl: string }
  | { ok: false; error: string; status: number } {
  return {
    ok: false,
    error: "Preview capture is unavailable after architectural reset.",
    status: 501,
  };
}
