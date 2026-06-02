import type { ImportProgressEvent } from "@/lib/template-import-events";
import {
  peekTemplateImport,
  runTemplateImport,
} from "@/lib/template-import-runner";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function isZipFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

function readOverwriteFlag(form: FormData): boolean {
  const value = form.get("overwrite");
  return value === "1" || value === "true";
}

function createNdjsonResponse(
  file: File,
  buffer: Buffer,
  overwrite: boolean,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ImportProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await runTemplateImport(file, buffer, emit, { overwrite });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected import failure.";
        emit({ type: "error", ok: false, error: message, status: 500 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  const isPreview = request.nextUrl.searchParams.get("preview") === "1";
  const useStream =
    request.nextUrl.searchParams.get("stream") === "1" ||
    request.headers.get("accept")?.includes("application/x-ndjson");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid form data.", 400);
  }

  const fileValue = form.get("file");
  if (!(fileValue instanceof File)) {
    return jsonError("Missing zip file (field name: file).", 400);
  }

  if (!isZipFile(fileValue)) {
    return jsonError("Only .zip archives are accepted.", 400);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await fileValue.arrayBuffer());
  } catch {
    return jsonError("Could not read uploaded file.", 400);
  }

  if (buffer.length === 0) {
    return jsonError("Uploaded file is empty.", 400);
  }

  if (isPreview) {
    const preview = peekTemplateImport(fileValue.name, buffer);
    if (!preview.ok) {
      return jsonError(preview.error, preview.status);
    }
    return Response.json({
      ok: true,
      templateId: preview.templateId,
      exists: preview.exists,
    });
  }

  const overwrite = readOverwriteFlag(form);

  if (useStream) {
    return createNdjsonResponse(fileValue, buffer, overwrite);
  }

  type ImportResultEvent = Exclude<ImportProgressEvent, { type: "progress" }>;
  let finalEvent: ImportResultEvent | null = null;

  await runTemplateImport(
    fileValue,
    buffer,
    (event) => {
      if (event.type === "done" || event.type === "error") {
        finalEvent = event;
      }
    },
    { overwrite },
  );

  // Callback assignment isn't visible to TypeScript control flow.
  const outcome = finalEvent as ImportResultEvent | null;
  if (!outcome) {
    return jsonError("Import failed unexpectedly.", 500);
  }

  if (outcome.type === "error") {
    return jsonError(outcome.error, outcome.status);
  }

  return Response.json({
    ok: true,
    status: outcome.status,
    templateId: outcome.templateId,
  });
}
