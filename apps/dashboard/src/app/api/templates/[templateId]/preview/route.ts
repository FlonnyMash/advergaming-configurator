import { saveTemplatePreviewPng } from "@/lib/template-studio-meta";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { templateId } = await context.params;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { ok: false, error: "Missing preview image file." },
      { status: 400 },
    );
  }

  if (file.type !== "image/png") {
    return Response.json(
      { ok: false, error: "Only PNG previews are supported." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = saveTemplatePreviewPng(templateId, buffer);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return Response.json({ ok: true, previewUrl: result.previewUrl });
}
