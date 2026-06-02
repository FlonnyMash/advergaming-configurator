import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";

export type SceneBinding = {
  /** Relative path from template root, no extension (e.g. ./src/game/scenes/PlayScene) */
  importPath: string;
  /** Named export identifier in the scene module */
  exportName: string;
  defaultExport: boolean;
};

const SCENE_BASENAMES = [
  "PlayScene",
  "MainScene",
  "GameScene",
  "BootScene",
  "PreloadScene",
] as const;

function slugifyFolderName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * e.g. `catch-game-demo-xyz` → `catch-game-demo` by dropping short trailing suffix segments.
 */
export function parseTemplateIdFromFolderName(folderName: string): string {
  const parts = slugifyFolderName(folderName).split("-").filter(Boolean);
  if (parts.length === 0) {
    return "imported-game";
  }

  // Drop one short trailing suffix (e.g. catch-game-demo-xyz → catch-game-demo).
  if (parts.length > 3) {
    const last = parts[parts.length - 1]!;
    const candidate = parts.join("-");
    if (
      TEMPLATE_ID_PATTERN.test(candidate) &&
      last.length <= 4 &&
      /^[a-z0-9]+$/.test(last)
    ) {
      parts.pop();
    }
  }

  const candidate = parts.join("-");
  if (TEMPLATE_ID_PATTERN.test(candidate)) {
    return candidate;
  }

  const minimal = parts[0]!;
  return TEMPLATE_ID_PATTERN.test(minimal) ? minimal : "imported-game";
}

export function buildRawScaffoldManifest(
  templateId: string,
  displayName?: string,
): Record<string, unknown> {
  const name = displayName?.trim() || templateId.replace(/-/g, " ");
  return {
    meta: {
      templateId,
      name,
      version: "0.1.0",
    },
    branding: {
      primaryColor: { type: "color", value: "#6366f1" },
      backgroundColor: { type: "color", value: "#0f172a" },
    },
    system: {
      gameSpeed: { type: "slider", value: 200, min: 50, max: 800 },
      gravity: { type: "slider", value: 0, min: -1000, max: 1000 },
    },
  };
}

function stripExtension(relativePath: string): string {
  return relativePath.replace(/\.(tsx?|jsx?)$/, "");
}

function sceneScore(basename: string): number {
  const index = SCENE_BASENAMES.indexOf(
    basename as (typeof SCENE_BASENAMES)[number],
  );
  return index === -1 ? 100 : index;
}

function parseSceneExport(
  filePath: string,
  basename: string,
): SceneBinding | null {
  if (!existsSync(filePath)) return null;

  const source = readFileSync(filePath, "utf8");
  const defaultClass = new RegExp(
    `export\\s+default\\s+class\\s+(\\w+)`,
    "m",
  ).exec(source);
  if (defaultClass) {
    return {
      importPath: "",
      exportName: defaultClass[1]!,
      defaultExport: true,
    };
  }

  if (/export\s+default\s+/.test(source)) {
    return {
      importPath: "",
      exportName: basename,
      defaultExport: true,
    };
  }

  const namedClass = new RegExp(`export\\s+class\\s+(\\w+)`, "m").exec(source);
  if (namedClass) {
    return {
      importPath: "",
      exportName: namedClass[1]!,
      defaultExport: false,
    };
  }

  return {
    importPath: "",
    exportName: basename,
    defaultExport: false,
  };
}

function findSceneRelativePaths(relativeFiles: string[]): string[] {
  const scenePaths: string[] = [];

  for (const file of relativeFiles) {
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    const normalized = file.replace(/\\/g, "/");
    const basename = path.posix.basename(normalized, path.posix.extname(normalized));
    if (!basename.endsWith("Scene")) continue;
    if (normalized.includes("node_modules/")) continue;
    scenePaths.push(normalized);
  }

  return scenePaths.sort((a, b) => {
    const scoreA = sceneScore(path.posix.basename(a, path.posix.extname(a)));
    const scoreB = sceneScore(path.posix.basename(b, path.posix.extname(b)));
    if (scoreA !== scoreB) return scoreA - scoreB;
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    if (depthA !== depthB) return depthA - depthB;
    return a.localeCompare(b);
  });
}

const PREFERRED_RELATIVE = [
  "src/game/scenes/PlayScene.ts",
  "src/game/scenes/PlayScene.tsx",
  "src/game/scenes/MainScene.ts",
  "src/game/scenes/GameScene.ts",
  "src/scenes/PlayScene.ts",
  "src/scenes/MainScene.ts",
  "src/scenes/GameScene.ts",
  "src/GameScene.ts",
  "GameScene.ts",
];

export function detectSceneBinding(
  relativeFiles: string[],
  targetDir: string,
): SceneBinding | null {
  const normalizedSet = new Set(
    relativeFiles.map((f) => f.replace(/\\/g, "/")),
  );

  for (const preferred of PREFERRED_RELATIVE) {
    if (!normalizedSet.has(preferred)) continue;
    const absolute = path.join(targetDir, preferred);
    const basename = path.posix.basename(preferred, path.posix.extname(preferred));
    const parsed = parseSceneExport(absolute, basename);
    if (!parsed) continue;
    return {
      ...parsed,
      importPath: `./${stripExtension(preferred)}`,
    };
  }

  const candidates = findSceneRelativePaths(
    relativeFiles.map((f) => f.replace(/\\/g, "/")),
  );
  for (const relative of candidates) {
    const absolute = path.join(targetDir, relative);
    const basename = path.posix.basename(relative, path.posix.extname(relative));
    const parsed = parseSceneExport(absolute, basename);
    if (!parsed) continue;
    return {
      ...parsed,
      importPath: `./${stripExtension(relative)}`,
    };
  }

  return null;
}

export function buildRawIndexTs(
  templateId: string,
  scene: SceneBinding | null,
): string {
  if (!scene) {
    return `import manifest from "./manifest.json";
import { GameScene as Scene } from "./GameScene";

export { manifest };
export { Scene };
`;
  }

  if (scene.defaultExport) {
    return `import manifest from "./manifest.json";
import Scene from "${scene.importPath}";

export { manifest };
export { Scene };
`;
  }

  return `import manifest from "./manifest.json";
import { ${scene.exportName} as Scene } from "${scene.importPath}";

export { manifest };
export { Scene };
`;
}

export const RAW_FALLBACK_GAME_SCENE_TS = `import Phaser from "phaser";

/** Auto-generated placeholder when no legacy scene entry point was found. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0f172a");
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        "Legacy project imported\\n(scene entry not detected)",
        { align: "center", color: "#e2e8f0" },
      )
      .setOrigin(0.5);
  }
}
`;

export function resolveRawTemplateId(
  entryNames: string[],
  stripPrefix: string | null,
  zipBaseName?: string,
): string {
  if (stripPrefix) {
    const folder = stripPrefix.replace(/\/$/, "");
    return parseTemplateIdFromFolderName(folder);
  }

  if (zipBaseName) {
    const stem = zipBaseName.replace(/\.zip$/i, "");
    const parsed = parseTemplateIdFromFolderName(stem);
    if (parsed !== "imported-game") return parsed;
  }

  const firstSegment = entryNames
    .map((n) => n.replace(/\\/g, "/").split("/")[0])
    .find((segment) => segment && segment.length > 0);

  if (firstSegment) {
    return parseTemplateIdFromFolderName(firstSegment);
  }

  return "imported-game";
}

export function listRelativeFilePaths(
  entryNames: string[],
  stripPrefix: string | null,
): string[] {
  const files: string[] = [];
  for (const name of entryNames) {
    const normalized = name.replace(/\\/g, "/");
    if (!normalized || normalized.endsWith("/")) continue;

    let relative = normalized;
    if (stripPrefix && relative.startsWith(stripPrefix)) {
      relative = relative.slice(stripPrefix.length);
    }
    if (!relative || relative.includes("..")) continue;
    files.push(relative);
  }
  return files;
}
