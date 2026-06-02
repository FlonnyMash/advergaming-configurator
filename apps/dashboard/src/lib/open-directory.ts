import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function openDirectoryInFileExplorer(
  directoryPath: string,
): { ok: true } | { ok: false; error: string } {
  if (!existsSync(directoryPath)) {
    return { ok: false, error: "Directory does not exist." };
  }

  const platform = process.platform;
  let result;

  if (platform === "win32") {
    result = spawnSync("explorer.exe", [directoryPath], { shell: false });
  } else if (platform === "darwin") {
    result = spawnSync("open", [directoryPath], { shell: false });
  } else {
    result = spawnSync("xdg-open", [directoryPath], { shell: false });
  }

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  return { ok: true };
}

type IdeLauncher = {
  command: string;
  args: string[];
  label: string;
};

function uniqueExistingPaths(candidates: string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    if (existsSync(candidate)) {
      resolved.push(candidate);
    }
  }

  return resolved;
}

function windowsIdeCandidates(): Array<{ exe: string; label: string }> {
  const localAppData =
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const programFiles =
    process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";

  const cursorPaths = uniqueExistingPaths([
    path.join(localAppData, "Programs", "cursor", "Cursor.exe"),
    path.join(localAppData, "Programs", "Cursor", "Cursor.exe"),
    path.join(
      localAppData,
      "Programs",
      "cursor",
      "resources",
      "app",
      "bin",
      "cursor.cmd",
    ),
  ]).map((exe) => ({ exe, label: "Cursor" }));

  const codePaths = uniqueExistingPaths([
    path.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe"),
    path.join(programFiles, "Microsoft VS Code", "Code.exe"),
    path.join(programFilesX86, "Microsoft VS Code", "Code.exe"),
    path.join(
      localAppData,
      "Programs",
      "Microsoft VS Code",
      "bin",
      "code.cmd",
    ),
  ]).map((exe) => ({ exe, label: "VS Code" }));

  return [...cursorPaths, ...codePaths];
}

function darwinIdeCandidates(): Array<{ exe: string; label: string }> {
  const cursorPaths = uniqueExistingPaths([
    "/Applications/Cursor.app/Contents/MacOS/Cursor",
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
  ]).map((exe) => ({ exe, label: "Cursor" }));

  const codePaths = uniqueExistingPaths([
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    "/usr/local/bin/code",
  ]).map((exe) => ({ exe, label: "VS Code" }));

  return [...cursorPaths, ...codePaths];
}

function linuxIdeCandidates(): Array<{ exe: string; label: string }> {
  const cursorPaths = uniqueExistingPaths([
    "/usr/bin/cursor",
    "/usr/local/bin/cursor",
    path.join(os.homedir(), ".local", "bin", "cursor"),
  ]).map((exe) => ({ exe, label: "Cursor" }));

  const codePaths = uniqueExistingPaths([
    "/usr/bin/code",
    "/usr/local/bin/code",
    "/snap/bin/code",
    path.join(os.homedir(), ".local", "bin", "code"),
  ]).map((exe) => ({ exe, label: "VS Code" }));

  return [...cursorPaths, ...codePaths];
}

function ideLaunchers(directoryPath: string): IdeLauncher[] {
  const platform = process.platform;
  const candidates =
    platform === "win32"
      ? windowsIdeCandidates()
      : platform === "darwin"
        ? darwinIdeCandidates()
        : linuxIdeCandidates();

  const launchers = candidates.map(({ exe, label }) => ({
    command: exe,
    args: [directoryPath],
    label,
  }));

  if (platform === "darwin") {
    launchers.push(
      {
        command: "open",
        args: ["-a", "Cursor", directoryPath],
        label: "Cursor",
      },
      {
        command: "open",
        args: ["-a", "Visual Studio Code", directoryPath],
        label: "VS Code",
      },
    );
  }

  launchers.push(
    { command: "cursor", args: [directoryPath], label: "Cursor" },
    { command: "code", args: [directoryPath], label: "VS Code" },
  );

  return launchers;
}

function spawnIdeLauncher(launcher: IdeLauncher) {
  if (launcher.command.endsWith(".cmd")) {
    return spawnSync("cmd.exe", ["/d", "/s", "/c", launcher.command, ...launcher.args], {
      shell: false,
      windowsHide: true,
    });
  }

  return spawnSync(launcher.command, launcher.args, {
    shell: false,
    windowsHide: true,
  });
}

export function openDirectoryInIde(
  directoryPath: string,
):
  | { ok: true; launcher: string }
  | { ok: false; error: string } {
  if (!existsSync(directoryPath)) {
    return { ok: false, error: "Directory does not exist." };
  }

  let lastError =
    "Could not open in an IDE. Install Cursor or VS Code, or add its command-line launcher to PATH.";

  for (const launcher of ideLaunchers(directoryPath)) {
    const result = spawnIdeLauncher(launcher);

    if (result.error) {
      if (result.error.message.includes("ENOENT")) {
        continue;
      }
      lastError = result.error.message;
      continue;
    }

    if (result.status !== null && result.status !== 0) {
      lastError = `Failed to launch ${launcher.label}.`;
      continue;
    }

    return { ok: true, launcher: launcher.label };
  }

  return { ok: false, error: lastError };
}
