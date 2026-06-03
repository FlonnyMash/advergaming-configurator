import path from "node:path";

export function getPlatformConfigPath(): string {
  return path.join(process.cwd(), "src", "config", "platform-config.json");
}

export function resolveWorkspaceRoot(): string {
  const cwd = process.cwd();
  if (path.basename(cwd) === "dashboard") {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}
