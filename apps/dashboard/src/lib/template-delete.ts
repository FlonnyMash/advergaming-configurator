import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";
import { runSyncManifestRegistry } from "@/lib/template-sync-registry";
import { resolveTemplateLocation } from "@/lib/template-studio-meta";

const engineRoot = path.resolve(process.cwd(), "../game-engine");
const previewsRoot = path.join(engineRoot, "public/previews");

export type DeleteGameTemplateResult =
  | { ok: true; templateId: string; repositoryPath: string }
  | { ok: false; error: string; status: number };

function removePreviewAssets(templateId: string): void {
  for (const ext of [".svg", ".png", ".webp"]) {
    const previewPath = path.join(previewsRoot, `${templateId}${ext}`);
    if (existsSync(previewPath)) {
      rmSync(previewPath, { force: true });
    }
  }
}

export function deleteGameTemplate(templateId: string): DeleteGameTemplateResult {
  if (!TEMPLATE_ID_PATTERN.test(templateId)) {
    return { ok: false, error: "Invalid template ID.", status: 400 };
  }

  const location = resolveTemplateLocation(templateId);
  if (!location) {
    return { ok: false, error: "Template not found.", status: 404 };
  }

  try {
    rmSync(location.directoryPath, { recursive: true, force: true });
    removePreviewAssets(templateId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Could not remove template files: ${message}`,
      status: 500,
    };
  }

  const syncResult = runSyncManifestRegistry();
  if (!syncResult.ok) {
    return { ok: false, error: syncResult.error, status: 500 };
  }

  return {
    ok: true,
    templateId,
    repositoryPath: location.repositoryPath,
  };
}
