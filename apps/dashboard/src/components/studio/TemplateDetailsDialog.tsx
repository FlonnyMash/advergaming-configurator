"use client";

import type { TemplateOverview } from "@/lib/template-overview-types";

export function TemplateDetailsDialog({
  template,
}: {
  template: TemplateOverview | null;
}) {
  if (!template) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
      <p className="font-semibold text-zinc-900">{template.displayName}</p>
      <p className="text-zinc-600">{template.id}</p>
    </div>
  );
}
