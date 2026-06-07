import { createProject } from "@/lib/project-io";
import type { GameTemplateId } from "@mashedgames/shared";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      displayName?: string;
      parentTemplateId?: string;
      projectId?: string;
    };

    if (!body.displayName?.trim()) {
      return Response.json(
        { ok: false, error: "displayName is required." },
        { status: 400 },
      );
    }
    if (!body.parentTemplateId) {
      return Response.json(
        { ok: false, error: "parentTemplateId is required." },
        { status: 400 },
      );
    }

    const result = await createProject({
      displayName: body.displayName,
      parentTemplateId: body.parentTemplateId as GameTemplateId,
      projectId: body.projectId,
    });

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }

    return Response.json({
      ok: true,
      projectId: result.data.manifest.projectId,
      manifest: result.data.manifest,
      client: result.data.client,
    });
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
}
