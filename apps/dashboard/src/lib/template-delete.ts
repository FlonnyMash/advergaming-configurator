import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";
import { resolveTemplateLocation } from "@/lib/template-studio-meta";
import { existsSync, rmSync } from "node:fs";

export function deleteGameTemplate(templateId: string):
  | { ok: true; templateId: string; repositoryPath: string }
  | { ok: false; error: string; status: number } {
  if (!TEMPLATE_ID_PATTERN.test(templateId)) {
    return { ok: false, error: "Invalid template id.", status: 400 };
  }

  const repositoryPath = resolveTemplateLocation(templateId);
  if (!existsSync(repositoryPath)) {
    return { ok: false, error: `Template "${templateId}" not found.`, status: 404 };
  }

  try {
    rmSync(repositoryPath, { recursive: true, force: true });
    return { ok: true, templateId, repositoryPath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Delete failed.",
      status: 500,
    };
  }
}
