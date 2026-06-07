export type TemplateManifestStatus = "published" | "draft";

export type TemplateOverview = {
  id: string;
  displayName: string;
  status: TemplateManifestStatus;
};

export type TemplateOverviewEntry = TemplateOverview;
