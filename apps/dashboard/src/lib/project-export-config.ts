import { flattenLegacyConfig, type GameConfig } from "@mashedgames/shared";
import { loadProject } from "@/lib/project-io";

function rewriteAssetPathsForFlatExport(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("/assets/")) {
      return value.slice(1);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => rewriteAssetPathsForFlatExport(entry));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = rewriteAssetPathsForFlatExport(child);
    }
    return out;
  }

  return value;
}

export type BuildProjectExportConfigResult =
  | { ok: true; configJson: string }
  | { ok: false; error: string; status: number };

export async function buildProjectExportConfigJson(
  projectId: string,
): Promise<BuildProjectExportConfigResult> {
  const loaded = await loadProject(projectId);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error, status: loaded.status };
  }

  const config = rewriteAssetPathsForFlatExport(
    loaded.data.config,
  ) as GameConfig;

  return {
    ok: true,
    configJson: `${JSON.stringify(config, null, 2)}\n`,
  };
}
