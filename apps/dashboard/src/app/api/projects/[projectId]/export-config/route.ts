import { buildProjectExportConfigJson } from "@/lib/project-export-config";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const result = await buildProjectExportConfigJson(projectId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return Response.json({
    ok: true,
    configJson: result.configJson,
  });
}
