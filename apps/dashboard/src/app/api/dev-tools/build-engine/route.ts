import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";
import { resolveWorkspaceRoot } from "@/lib/platform-config-path";

export const runtime = "nodejs";

function formatSseEvent(event: string, data: string): string {
  const lines = data.split(/\r?\n/);
  const payload = lines.map((line) => `data: ${line}`).join("\n");
  return `event: ${event}\n${payload}\n\n`;
}

export async function POST(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("Not Found", { status: 404 });

  const workspaceRoot = resolveWorkspaceRoot();
  const shell = process.platform === "win32";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const enqueue = (event: string, data: string) => {
        controller.enqueue(encoder.encode(formatSseEvent(event, data)));
      };

      enqueue(
        "status",
        `Running pnpm run build:desktop in ${workspaceRoot}…`,
      );

      const child = spawn("pnpm", ["run", "build:desktop"], {
        cwd: workspaceRoot,
        shell,
        env: {
          ...process.env,
          NODE_ENV: "production",
          CI: process.env.CI ?? "1",
        },
      });

      const forward = (event: "stdout" | "stderr", chunk: Buffer) => {
        const text = chunk.toString("utf8");
        if (text.length > 0) {
          enqueue(event, text);
        }
      };

      child.stdout?.on("data", (chunk: Buffer) => forward("stdout", chunk));
      child.stderr?.on("data", (chunk: Buffer) => forward("stderr", chunk));

      child.on("error", (error) => {
        const message =
          error instanceof Error ? error.message : "Failed to start build process.";
        enqueue("error", message);
        controller.close();
      });

      child.on("close", (code) => {
        if (code === 0) {
          enqueue("done", JSON.stringify({ ok: true }));
        } else {
          enqueue(
            "error",
            `Build exited with code ${code ?? "unknown"}.`,
          );
          enqueue("done", JSON.stringify({ ok: false, exitCode: code }));
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
