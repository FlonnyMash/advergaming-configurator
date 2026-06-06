import type { TemplateManifestStatus } from "@mashedgames/shared";

export const PHASE_HELPER_TEXT: Record<TemplateManifestStatus, string> = {
  draft:
    "Draft: Only visible in the Studio Editor. Safe for active development and breaking changes.",
  published:
    "Published: Live in the Configurator Library. Ready and visible for Sales and B2B clients.",
};

export function phaseBadgeClass(status: TemplateManifestStatus): string {
  return status === "published"
    ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
    : "bg-amber-100 text-amber-800 ring-amber-200";
}

export function phaseToggleLabel(status: TemplateManifestStatus): string {
  return status === "published" ? "Mark as draft" : "Publish template";
}

export function phaseToggleTitle(status: TemplateManifestStatus): string {
  return status === "published"
    ? "Move back to draft — hides from Configurator"
    : "Publish — makes template visible in Configurator";
}

export async function patchTemplatePhase(
  templateId: string,
  next: TemplateManifestStatus,
): Promise<{
  ok: boolean;
  error?: string;
  manifest?: { status?: TemplateManifestStatus; version?: string };
}> {
  const response = await fetch(
    `/api/templates/${encodeURIComponent(templateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    },
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    manifest?: { status?: TemplateManifestStatus; version?: string };
  };

  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      error: payload.error ?? "Could not update template phase.",
    };
  }

  return { ok: true, manifest: payload.manifest };
}
