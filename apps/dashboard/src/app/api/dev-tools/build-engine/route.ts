import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { NextRequest } from "next/server";
import { resolveWorkspaceRoot } from "@/lib/platform-config-path";

export const runtime = "nodejs";

const execAsync = promisify(exec);

export async function POST(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("Not Found", { status: 404 });

  const workspaceRoot = resolveWorkspaceRoot();

  try {
    const { stdout, stderr } = await execAsync("pnpm run build:desktop", {
      cwd: workspaceRoot,
      maxBuffer: 10 * 1024 * 1024,
    });

    return Response.json({ ok: true, stdout, stderr });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Build command failed.";
    const stdout =
      error && typeof error === "object" && "stdout" in error
        ? String((error as { stdout?: unknown }).stdout ?? "")
        : "";
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr ?? "")
        : "";

    return Response.json(
      { ok: false, error: message, stdout, stderr },
      { status: 500 },
    );
  }
}
