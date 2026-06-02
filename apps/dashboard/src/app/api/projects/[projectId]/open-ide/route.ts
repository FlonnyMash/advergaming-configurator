import { openDirectoryInIde } from "@/lib/open-directory";
import { getProjectLocation } from "@/lib/project-location";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const location = getProjectLocation(projectId);

  if (!location.ok) {
    return Response.json(
      { ok: false, error: location.error },
      { status: location.status },
    );
  }

  const opened = openDirectoryInIde(location.data.directoryPath);
  if (!opened.ok) {
    return Response.json({ ok: false, error: opened.error }, { status: 500 });
  }

  return Response.json({
    ok: true,
    directoryPath: location.data.directoryPath,
    repositoryPath: location.data.repositoryPath,
    launcher: opened.launcher,
  });
}
