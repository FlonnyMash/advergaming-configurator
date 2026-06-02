import { listProjectIds } from "@/lib/project-io";
import { loadProject } from "@/lib/project-io";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ids = await listProjectIds();
    const projects = await Promise.all(
      ids.map(async (projectId) => {
        const loaded = await loadProject(projectId);
        if (!loaded.ok) {
          return { projectId, error: loaded.error };
        }
        return {
          projectId,
          displayName: loaded.data.manifest.displayName,
          parentTemplateId: loaded.data.manifest.parentTemplateId,
          parentVersion: loaded.data.manifest.parentVersion,
        };
      }),
    );
    return Response.json({ ok: true, projects });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list projects.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
