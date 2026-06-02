import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const gameEngineRoot = path.dirname(fileURLToPath(import.meta.url));
const templateLibraryRoot = path.join(
  gameEngineRoot,
  "src/templates/library",
);

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

export default defineConfig({
  plugins: [tailwindcss(), templatePublicAssetsPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [gameEngineRoot],
    },
  },
});
