import type { ParentDriftReport } from "@mashedgames/shared";
import { loadProject } from "@/lib/project-io";
import { buildLiveParentConfig } from "@/lib/project-parent-config";

export function computeParentDriftReport(input: {
  projectId: string;
  parentTemplateId: string;
  lockedVersion: string;
  liveVersion: string;
}): ParentDriftReport {
  return {
    projectId: input.projectId,
    parentTemplateId: input.parentTemplateId,
    lockedVersion: input.lockedVersion,
    liveVersion: input.liveVersion,
    items: [],
    hasBlockingItems: false,
  };
}

export async function computeParentDrift(projectId: string): Promise<
  | { ok: true; report: ParentDriftReport }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadProject(projectId);
  if (!loaded.ok) {
    return loaded;
  }

  const { manifest } = loaded.data;
  const { manifest: liveManifest } = buildLiveParentConfig(manifest.parentTemplateId);

  return {
    ok: true,
    report: computeParentDriftReport({
      projectId,
      parentTemplateId: manifest.parentTemplateId,
      lockedVersion: manifest.parentVersion,
      liveVersion: liveManifest.version,
    }),
  };
}
