import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const gameEngineRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(gameEngineRoot, "../..");

function resolveViteCacheDir(): string | undefined {
  if (process.env.MASHEDGAMES_DEV_CACHE_LOCAL === "0") {
    return undefined;
  }
  if (
    process.env.MASHEDGAMES_DEV_CACHE_LOCAL === "1" ||
    (process.platform === "win32" &&
      path.parse(path.resolve(monorepoRoot)).root.toLowerCase() !== "c:\\")
  ) {
    const base = process.env.LOCALAPPDATA ?? os.tmpdir();
    return path.join(base, "MashedGamesStudio", "dev-cache", "game-engine-vite");
  }
  return undefined;
}
const templateLibraryRoot = path.join(
  gameEngineRoot,
  "src/templates/library",
);

function copyTemplatePublicAssetsPlugin(): Plugin {
  return {
    name: "copy-template-public-assets",
    closeBundle() {
      const libraryEntries = fs.readdirSync(templateLibraryRoot, {
        withFileTypes: true,
      });
      for (const entry of libraryEntries) {
        if (!entry.isDirectory()) continue;
        const publicDir = path.join(templateLibraryRoot, entry.name, "public");
        if (!fs.existsSync(publicDir)) continue;
        const targetDir = path.join(
          gameEngineRoot,
          "dist",
          "template-assets",
          entry.name,
        );
        fs.mkdirSync(targetDir, { recursive: true });
        fs.cpSync(publicDir, targetDir, { recursive: true });
      }
    },
  };
}

function templatePublicAssetsPlugin(): Plugin {
  return {
    name: "template-public-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        const match = /^\/template-assets\/([^/]+)\/(.*)$/.exec(url);
        if (!match) {
          next();
          return;
        }

        const templateId = match[1]!;
        const assetPath = match[2]!;
        if (
          !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(templateId) ||
          assetPath.includes("..")
        ) {
          res.statusCode = 400;
          res.end("Bad request");
          return;
        }

        const filePath = path.join(
          templateLibraryRoot,
          templateId,
          "public",
          assetPath,
        );
        if (!filePath.startsWith(templateLibraryRoot) || !fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".webp": "image/webp",
          ".json": "application/json",
          ".svg": "image/svg+xml",
        };
        res.setHeader("Content-Type", mime[ext] ?? "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/engine/" : "/",
  cacheDir: command === "serve" ? resolveViteCacheDir() : undefined,
  plugins: [
    tailwindcss(),
    templatePublicAssetsPlugin(),
    copyTemplatePublicAssetsPlugin(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [gameEngineRoot],
    },
  },
}));
