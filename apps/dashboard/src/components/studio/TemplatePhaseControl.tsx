"use client";

import type { TemplateManifestStatus } from "@/lib/template-overview-types";

export function TemplatePhaseControl({
  templateId,
  status,
}: {
  templateId: string;
  status: TemplateManifestStatus;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
      <p className="font-medium text-zinc-900">{templateId}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{status}</p>
    </div>
  );
}
