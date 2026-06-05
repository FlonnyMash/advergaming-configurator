import { z } from "zod";
import { GameConfigSchema } from "./game-config-bridge";
import { GameTemplateIdSchema } from "./game-schema";

/** Kebab-case slug for project folder names (same rules as template ids). */
export const PROJECT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const GameProjectManifestSchema = z.object({
  projectId: z.string().regex(PROJECT_ID_PATTERN),
  displayName: z.string().min(1),
  parentTemplateId: GameTemplateIdSchema,
  parentVersion: z.string(),
  parentSchemaVersion: z.string(),
  parentContentHash: z.string().optional(),
  lastParentAckAt: z.string(),
  createdAt: z.string(),
  deployRepoUrl: z.string().url().optional(),
  /** Relative asset path (e.g. assets/logo.png) → absolute OS path for Electron preview. */
  runtimeAssets: z.record(z.string(), z.string()).optional(),
});

export type GameProjectManifest = z.infer<typeof GameProjectManifestSchema>;

export const ClientProjectPayloadSchema = GameConfigSchema;

export type ClientProjectPayload = z.infer<typeof ClientProjectPayloadSchema>;

export const ParentLockSnapshotSchema = z.object({
  lockedAt: z.string(),
  parentTemplateId: GameTemplateIdSchema,
  parentVersion: z.string(),
  parentSchemaVersion: z.string(),
  config: GameConfigSchema,
});

export type ParentLockSnapshot = z.infer<typeof ParentLockSnapshotSchema>;

export const ParentDriftItemSchema = z.object({
  kind: z.enum([
    "version-bump",
    "schema-bump",
    "new-control",
    "default-changed",
    "value-mismatch",
  ]),
  label: z.string(),
  targetPath: z.string().optional(),
  detail: z.string().optional(),
  savedValue: z.unknown().optional(),
  currentValue: z.unknown().optional(),
  required: z.boolean().optional(),
});

export type ParentDriftItem = z.infer<typeof ParentDriftItemSchema>;

export const ParentDriftReportSchema = z.object({
  projectId: z.string(),
  parentTemplateId: GameTemplateIdSchema,
  lockedVersion: z.string(),
  liveVersion: z.string(),
  items: z.array(ParentDriftItemSchema),
  hasBlockingItems: z.boolean(),
});

export type ParentDriftReport = z.infer<typeof ParentDriftReportSchema>;
