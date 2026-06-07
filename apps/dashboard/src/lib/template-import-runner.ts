export async function runTemplateImport(_input: {
  buffer: Buffer;
  fileName: string;
}): Promise<{ ok: false; error: string }> {
  return {
    ok: false,
    error: "Template import is unavailable after the architectural reset.",
  };
}

export async function peekTemplateImport(
  _buffer: Buffer,
  _fileName: string,
  _options?: unknown,
  _onProgress?: unknown,
): Promise<{ ok: false; error: string }> {
  return {
    ok: false,
    error: "Template import is unavailable after the architectural reset.",
  };
}
