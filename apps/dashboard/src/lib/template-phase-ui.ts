import type { TemplateManifestStatus } from "@/lib/template-overview-types";

export function phaseLabelForStatus(status: TemplateManifestStatus): string {
  return status === "published" ? "Published" : "Draft";
}
