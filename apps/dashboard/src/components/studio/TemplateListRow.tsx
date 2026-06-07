"use client";

import type { TemplateOverview } from "@/lib/template-overview-types";
import Link from "next/link";

export function TemplateListRow({
  template,
  onUpdated: _onUpdated,
  onDeleted: _onDeleted,
}: {
  template: TemplateOverview;
  onUpdated?: () => void;
  onDeleted?: (templateId: string) => void;
}) {
  return (
    <Link
      href={`/studio?template=${encodeURIComponent(template.id)}`}
      className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50"
    >
      <p className="font-medium text-zinc-900">{template.displayName}</p>
      <p className="text-xs text-zinc-500">{template.id}</p>
    </Link>
  );
}
