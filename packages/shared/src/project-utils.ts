import {
  buildConfigWithFrozenSystem,
  exportClientPayload,
  mergeBrandingPatch,
} from "./config-utils";
import type {
  BrandingSettings,
  GameMasterConfig,
  GameMasterConfigMeta,
  GameSchema,
  GameTemplateId,
  SystemSettings,
} from "./game-schema";
import type { ClientProjectPayload, GameProjectManifest } from "./game-project";
import { DEFAULT_SCHEMA_VERSION } from "./types";

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
  meta: GameMasterConfigMeta,
  project: Pick<GameProjectManifest, "projectId" | "parentTemplateId"> & {
    parentPinnedVersion?: string;
  },
): GameMasterConfigMeta {
  return {
    ...meta,
    templateId: project.parentTemplateId,
    projectId: project.projectId,
    parentTemplateId: project.parentTemplateId,
    parentPinnedVersion: project.parentPinnedVersion ?? meta.parentPinnedVersion,
    lastParentSyncAt: meta.lastParentSyncAt,
  };
}

export function buildInitialClientPayload(
  project: Pick<GameProjectManifest, "projectId" | "parentTemplateId">,
  config: GameMasterConfig,
  parentPinnedVersion: string,
): ClientProjectPayload {
  const payload = exportClientPayload(config);
  return {
    meta: {
      ...enrichClientMeta(payload.meta, {
        ...project,
        parentPinnedVersion,
      }),
      lastParentSyncAt: new Date().toISOString(),
    },
    branding: payload.branding,
  };
}

export function buildProjectConfigFromClient(
  schema: GameSchema,
  systemDefaults: SystemSettings,
  client: ClientProjectPayload,
  parentTemplateId: GameTemplateId,
): GameMasterConfig {
  const base = buildConfigWithFrozenSystem(
    schema,
    systemDefaults,
    parentTemplateId,
  );
  base.meta = {
    ...base.meta,
    ...client.meta,
    templateId: parentTemplateId,
    schemaVersion: client.meta.schemaVersion ?? base.meta.schemaVersion,
  };
  return mergeBrandingPatch(base, client.branding as Partial<BrandingSettings>);
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
