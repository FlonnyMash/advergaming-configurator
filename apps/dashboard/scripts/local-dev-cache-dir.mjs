import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Relative distDir name; junctioned to %LOCALAPPDATA% on W:\ (Next rejects absolute distDir on Windows). */
export const LOCAL_DEV_DIST_DIR = ".mashed-next-dev";

/** True when hot dev caches should live off the repo drive (e.g. W:\). */
export function shouldUseLocalDevCache(projectDir) {
  if (process.env.MASHEDGAMES_DEV_CACHE_LOCAL === "0") {
    return false;
  }
  if (process.env.MASHEDGAMES_DEV_CACHE_LOCAL === "1") {
    return true;
  }
  if (process.platform !== "win32") {
    return false;
  }
  const root = path.parse(path.resolve(projectDir)).root.toLowerCase();
  return root !== "c:\\";
}

export function localDevCacheRoot(appSlug) {
  const base = process.env.LOCALAPPDATA ?? os.tmpdir();
  return path.join(base, "MashedGamesStudio", "dev-cache", appSlug);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Points dashboard `distDir` at local disk via a directory junction (Windows-safe).
 */
export function ensureLocalDevCacheJunction(dashboardRoot) {
  const linkPath = path.join(dashboardRoot, LOCAL_DEV_DIST_DIR);
  const targetPath = localDevCacheRoot("dashboard-next");
  ensureDir(targetPath);

  if (fs.existsSync(linkPath)) {
    try {
      const linked = fs.readlinkSync(linkPath);
      const resolved = path.resolve(path.dirname(linkPath), linked);
      if (path.resolve(resolved) === path.resolve(targetPath)) {
        return linkPath;
      }
    } catch {
      /* not a junction — recreate */
    }
    fs.rmSync(linkPath, { recursive: true, force: true });
  }

  fs.symlinkSync(targetPath, linkPath, "junction");
  return linkPath;
}
