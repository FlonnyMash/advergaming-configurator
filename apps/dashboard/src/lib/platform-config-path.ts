import { existsSync } from "node:fs";
import path from "node:path";

export function getPlatformConfigPath(): string {
  return path.normalize(
    path.join(process.cwd(), "src", "config", "platform-config.json"),
  );
}

function hasWorkspaceMarker(root: string): boolean {
  return existsSync(path.join(root, "pnpm-workspace.yaml"));
}

export function resolveWorkspaceRoot(): string {
  const cwd = process.cwd();
  const candidates = [
    path.basename(cwd) === "dashboard" ? path.resolve(cwd, "../..") : cwd,
    path.normalize(path.resolve(cwd, "../..")),
    cwd,
  ];

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (hasWorkspaceMarker(normalized)) {
      return normalized;
    }
  }

  return path.normalize(
    path.basename(cwd) === "dashboard" ? path.resolve(cwd, "../..") : cwd,
  );
}
