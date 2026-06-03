import { loadProject } from "@/lib/project-io";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const result = await loadProject(projectId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return Response.json({
    ok: true,
    manifest: result.data.manifest,
    client: result.data.client,
    config: result.data.config,
    parentLock: result.data.parentLock,
    runtimeAssets: result.data.runtimeAssets,
  });
}
