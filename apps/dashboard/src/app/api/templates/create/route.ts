import { createGameTemplate } from "@/lib/template-create";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const name =
    typeof body === "object" &&
    body !== null &&
    "name" in body &&
    typeof body.name === "string"
      ? body.name
      : "";
  const templateId =
    typeof body === "object" &&
    body !== null &&
    "templateId" in body &&
    typeof body.templateId === "string"
      ? body.templateId
      : "";

  const result = createGameTemplate({ name, templateId });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    templateId: result.templateId,
    repositoryPath: result.repositoryPath,
  });
}
