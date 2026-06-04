export type SseHandler = (event: string, data: string) => void;

export async function consumeSseStream(
  response: Response,
  onEvent: SseHandler,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Build stream unavailable.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const dispatchBlock = (block: string) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    let event = "message";
    const dataLines: string[] = [];

    for (const line of trimmed.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length > 0) {
      onEvent(event, dataLines.join("\n"));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      dispatchBlock(block);
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    dispatchBlock(buffer);
  }
}
