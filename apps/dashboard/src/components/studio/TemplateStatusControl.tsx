"use client";

import { getCatalogEntry } from "@mashedgames/game-engine/templates/schemas";
import { useStudioConfigStore } from "@mashedgames/studio-engine";
import { useMemo } from "react";
import { TemplatePhaseControl } from "@/components/studio/TemplatePhaseControl";

export function TemplateStatusControl() {
  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);

  const catalogStatus = useMemo(
    () => getCatalogEntry(selectedTemplateId)?.manifest.status ?? "draft",
    [selectedTemplateId],
  );

  return (
    <TemplatePhaseControl
      templateId={selectedTemplateId}
      status={catalogStatus}
    />
  );
}
