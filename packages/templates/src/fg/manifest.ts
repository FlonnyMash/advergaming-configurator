import { type TemplateSchema } from "@mashedgames/shared";

export const fgManifest = {
  templateId: "fg",
  version: "1.0.0",
  displayName: "fg",
  lockedFields: ["activeTemplateId", "schemaVersion"],
  supportsUI: [],
  supportedEvents: [],
  assetRestrictions: [],
  meta: {},
  configFieldHints: {},
} satisfies TemplateSchema;

export type FgManifest = typeof fgManifest;
