import { type TemplateSchema } from "@mashedgames/shared";

export const catchGameManifest = {
  templateId: "catch-game",
  version: "1.0.0",
  displayName: "Catch Game",
  lockedFields: ["activeTemplateId", "schemaVersion"],
  supportsUI: [],
  supportedEvents: [],
  assetRestrictions: [],
  meta: {},
  configFieldHints: {},
} satisfies TemplateSchema;

export type CatchGameManifest = typeof catchGameManifest;
