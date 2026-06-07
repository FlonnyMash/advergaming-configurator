import { DEFAULT_GAME_CONFIG } from "@mashedgames/shared";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureWorkspaceExists, templateLibraryRoot } from "@/lib/project-paths";
import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";

export async function createTemplateFromGenerator(input: {
  templateId: string;
  displayName: string;
}): Promise<
  | { ok: true; templateId: string; repositoryPath: string }
  | { ok: false; error: string; status: number }
> {
  return createGameTemplate({
    name: input.displayName,
    templateId: input.templateId,
  });
}

export function createGameTemplate(input: {
  name: string;
  templateId: string;
}):
  | { ok: true; templateId: string; repositoryPath: string }
  | { ok: false; error: string; status: number } {
  const templateId = input.templateId.trim();
  const name = input.name.trim();

  if (!name) {
    return { ok: false, error: "Template name is required.", status: 400 };
  }
  if (!TEMPLATE_ID_PATTERN.test(templateId)) {
    return { ok: false, error: "Invalid template id.", status: 400 };
  }

  try {
    ensureWorkspaceExists();
    const templateDir = path.join(templateLibraryRoot, templateId);
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(
      path.join(templateDir, "config.json"),
      `${JSON.stringify({ ...DEFAULT_GAME_CONFIG, activeTemplateId: templateId }, null, 2)}\n`,
      "utf8",
    );
    return { ok: true, templateId, repositoryPath: templateDir };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Create failed.",
      status: 500,
    };
  }
}
