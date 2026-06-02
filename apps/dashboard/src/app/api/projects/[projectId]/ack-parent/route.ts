import { ackParentLock } from "@/lib/project-io";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const result = await ackParentLock(projectId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return Response.json({
    ok: true,
    manifest: result.data.manifest,
    parentLock: result.data.parentLock,
  });
}
