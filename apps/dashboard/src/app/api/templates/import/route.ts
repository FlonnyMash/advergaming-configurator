import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  return Response.json(
    {
      ok: false,
      error: "Template import is unavailable after the architectural reset.",
    },
    { status: 501 },
  );
}
