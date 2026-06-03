import { writeFileSync } from "node:fs";
import { PlatformConfigSchema } from "@advergaming/shared";
import type { NextRequest } from "next/server";
import { getPlatformConfigPath } from "@/lib/platform-config-path";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("Not Found", { status: 404 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = PlatformConfigSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "Invalid platform config payload." },
        { status: 400 },
      );
    }

    writeFileSync(
      getPlatformConfigPath(),
      `${JSON.stringify(parsed.data, null, 2)}\n`,
      "utf8",
    );

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
}
