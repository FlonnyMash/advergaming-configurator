import { listTemplateOverviewFromDisk } from "@/lib/template-studio-meta";

export const runtime = "nodejs";

export async function GET() {
  const templates = listTemplateOverviewFromDisk();
  return Response.json({ ok: true, templates });
}
