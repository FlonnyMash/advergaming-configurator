let runtimeAssets: Record<string, string> = {};

export function setRuntimeAssets(map: Record<string, string>): void {
  runtimeAssets = { ...map };
}

export function getRuntimeAssets(): Record<string, string> {
  return runtimeAssets;
}
