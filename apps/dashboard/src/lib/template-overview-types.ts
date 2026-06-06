import type { TemplateManifestStatus } from "@mashedgames/shared";

export type TemplateOverviewEntry = {
  id: string;
  label: string;
  description?: string;
  previewUrl: string;
  version: string;
  author: string;
  status: TemplateManifestStatus;
};
