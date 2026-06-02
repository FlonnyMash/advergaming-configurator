import {
  getTemplateDetails,
  patchTemplateManifest,
  type TemplateManifestPatch,
} from "@/lib/template-studio-meta";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { templateId } = await context.params;
  const result = getTemplateDetails(templateId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  const { data } = result;
  return Response.json({
    ok: true,
    templateId: data.templateId,
    source: data.source,
    directoryPath: data.directoryPath,
    repositoryPath: data.repositoryPath,
    manifest: data.manifest,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    manifestUpdatedAt: data.manifestUpdatedAt,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { templateId } = await context.params;

  let body: TemplateManifestPatch;
  try {
    body = (await request.json()) as TemplateManifestPatch;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const result = patchTemplateManifest(templateId, body);
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return Response.json({ ok: true, manifest: result.manifest });
}
