"use client";

import { readTemplateStudioMeta } from "@/lib/template-studio-meta";
import { useStudioConfigStore } from "@mashedgames/studio-engine";
import { TemplatePhaseControl } from "@/components/studio/TemplatePhaseControl";

export function TemplateStatusControl() {
  const selectedTemplateId = useStudioConfigStore((state) => state.selectedTemplateId);
  const status = readTemplateStudioMeta(selectedTemplateId).status;

  return (
    <TemplatePhaseControl templateId={selectedTemplateId} status={status} />
  );
}
