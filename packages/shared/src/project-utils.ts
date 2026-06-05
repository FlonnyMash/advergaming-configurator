import { patchConfig } from "./config-utils";
import type { GameConfig } from "./game-config-bridge";
import type { GameSchema, GameTemplateId } from "./game-schema";
import type { ClientProjectPayload, GameProjectManifest } from "./game-project";
import { DEFAULT_SCHEMA_VERSION } from "./types";
import { buildConfigWithFrozenSystem, exportClientPayload } from "./config-utils";

export function slugifyProjectId(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  if (!slug) {
    return "project";
  }
  if (/^[a-z]/.test(slug)) {
    return slug;
  }
  return `project-${slug}`;
}

export function enrichClientMeta(
  config: GameConfig,
  project: Pick<GameProjectManifest, "projectId" | "parentTemplateId"> & {
    parentPinnedVersion?: string;
  },
): GameConfig {
  return {
    ...config,
    activeTemplateId: project.parentTemplateId,
    projectId: project.projectId,
    parentTemplateId: project.parentTemplateId,
    parentPinnedVersion:
      project.parentPinnedVersion ?? config.parentPinnedVersion,
    lastParentSyncAt: config.lastParentSyncAt,
  };
}

export function buildInitialClientPayload(
  project: Pick<GameProjectManifest, "projectId" | "parentTemplateId">,
  config: GameConfig,
  parentPinnedVersion: string,
): ClientProjectPayload {
  const payload = exportClientPayload(config);
  return enrichClientMeta(
    {
      ...payload,
      lastParentSyncAt: new Date().toISOString(),
      parentPinnedVersion,
    },
    project,
  );
}

export function buildProjectConfigFromClient(
  schema: GameSchema,
  systemDefaults: Record<string, unknown>,
  client: ClientProjectPayload,
  parentTemplateId: GameTemplateId,
): GameConfig {
  const base = buildConfigWithFrozenSystem(
    schema,
    systemDefaults,
    parentTemplateId,
  );
  return patchConfig(base, {
    ...client,
    activeTemplateId: parentTemplateId,
    schemaVersion: client.schemaVersion ?? base.schemaVersion,
  });
}

export function defaultProjectManifestFields(
  parentTemplateId: GameTemplateId,
  parentVersion: string,
  parentSchemaVersion: string = DEFAULT_SCHEMA_VERSION,
): Pick<
  GameProjectManifest,
  "parentTemplateId" | "parentVersion" | "parentSchemaVersion" | "lastParentAckAt"
> {
  const now = new Date().toISOString();
  return {
    parentTemplateId,
    parentVersion,
    parentSchemaVersion,
    lastParentAckAt: now,
  };
}
