import {
  getTemplateDetails,
  openTemplateDirectory,
} from "@/lib/template-studio-meta";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { templateId } = await context.params;
  const details = getTemplateDetails(templateId);

  if (!details.ok) {
    return Response.json(
      { ok: false, error: details.error },
      { status: details.status },
    );
  }

  const opened = openTemplateDirectory(details.data.directoryPath);
  if (!opened.ok) {
    return Response.json({ ok: false, error: opened.error }, { status: 500 });
  }

  return Response.json({
    ok: true,
    directoryPath: details.data.directoryPath,
    repositoryPath: details.data.repositoryPath,
  });
}
