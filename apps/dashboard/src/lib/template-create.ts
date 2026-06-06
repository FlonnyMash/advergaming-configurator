import type { TemplateManifest } from "@mashedgames/shared";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeTemplateDirectory } from "@/lib/template-import-normalize";
import { buildCursorInstructions } from "@/lib/template-generator";
import { slugifyTemplateId, TEMPLATE_ID_PATTERN } from "@/lib/template-id";
import { runSyncManifestRegistry } from "@/lib/template-sync-registry";

const dashboardRoot = path.resolve(process.cwd());
const engineRoot = path.resolve(dashboardRoot, "../game-engine");
const templatesRoot = path.join(engineRoot, "src/templates");
const previewsRoot = path.join(engineRoot, "public/previews");

export type CreateGameTemplateInput = {
  name: string;
  templateId: string;
};

export type CreateGameTemplateResult =
  | { ok: true; templateId: string; repositoryPath: string }
  | { ok: false; error: string; status: number };

function toSceneKey(templateId: string): string {
  const key = templateId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return key || "Game";
}

function buildPreviewSvg(label: string): string {
  const safeLabel =
    label.length > 14 ? `${label.slice(0, 12)}…` : label || "Game";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="16" fill="#6366f1"/>
  <circle cx="60" cy="52" r="22" fill="#ffffff" opacity="0.9"/>
  <text x="60" y="98" text-anchor="middle" fill="white" font-family="system-ui" font-size="11" font-weight="600">${safeLabel.replace(/[<>&"]/g, "")}</text>
</svg>
`;
}

function buildManifest(name: string, templateId: string, sceneKey: string): TemplateManifest {
  return {
    id: templateId,
    version: "0.1.0",
    author: "Mashed Games Studio",
    previewUrl: `/previews/${templateId}.svg`,
    status: "draft",
    label: name,
    description: "New game template scaffold. Edit mechanics in Studio or extend GameScene.ts.",
    phaserScenes: [sceneKey],
    uiOverlayComponents: [],
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        branding: {
          type: "object",
          properties: {
            theme: {
              type: "object",
              properties: {
                primaryColor: {
                  type: "string",
                  default: "#6366f1",
                  "x-control": {
                    type: "color",
                    label: "Primary color",
                    targetCategory: "branding",
                    targetPath: "theme.primaryColor",
                    surface: "both",
                  },
                },
              },
            },
            domOverlay: {
              type: "object",
              properties: {
                startScreenTitle: {
                  type: "string",
                  default: name,
                  "x-control": {
                    type: "text",
                    label: "Start screen title",
                    targetCategory: "branding",
                    targetPath: "domOverlay.startScreenTitle",
                    surface: "configurator",
                    placeholder: name,
                  },
                },
              },
            },
          },
        },
        system: {
          type: "object",
          properties: {
            mechanics: {
              type: "object",
              properties: {
                playerSpeed: {
                  type: "number",
                  default: 200,
                  minimum: 50,
                  maximum: 800,
                  "x-control": {
                    type: "slider",
                    label: "Motion speed",
                    targetCategory: "system",
                    targetPath: "mechanics.playerSpeed",
                    surface: "studio",
                    step: 10,
                  },
                },
              },
            },
            physics: {
              type: "object",
              properties: {
                gravity: {
                  type: "number",
                  default: 0,
                  minimum: -1000,
                  maximum: 1000,
                  "x-control": {
                    type: "slider",
                    label: "Gravity",
                    targetCategory: "system",
                    targetPath: "physics.gravity.y",
                    surface: "studio",
                    step: 10,
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function buildIndexTs(sceneKey: string, sceneClassName: string): string {
  return `import manifest from "./manifest.json";
import { ${sceneClassName} as Scene, SCENE_KEY } from "./GameScene.ts";

export const phaserSceneMap = { [SCENE_KEY]: Scene };

export { manifest };
export { Scene };
`;
}

function buildGameSceneTs(sceneKey: string, sceneClassName: string, label: string): string {
  return `import {
  getPrimaryBrandColor,
  type GameConfig,
} from "@mashedgames/shared";
import Phaser from "phaser";
import type { TemplateScene } from "../types.ts";

export const SCENE_KEY = "${sceneKey}";

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class ${sceneClassName} extends Phaser.Scene implements TemplateScene {
  private titleText!: Phaser.GameObjects.Text;
  private accentGraphics?: Phaser.GameObjects.Graphics;
  private motionSpeed = 200;
  private gravity = 0;

  constructor() {
    super({ key: SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;
    this.titleText = this.add
      .text(width / 2, height / 2 - 24, ${JSON.stringify(label)}, {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.drawAccent();
  }

  updateConfig(config: GameConfig): void {
    this.cameras.main.setBackgroundColor(getPrimaryBrandColor(config));
    const domOverlay =
      typeof config.domOverlay === "object" && config.domOverlay !== null
        ? config.domOverlay
        : {};
    this.titleText.setText(
      typeof domOverlay.startScreenTitle === "string"
        ? domOverlay.startScreenTitle
        : ${JSON.stringify(label)},
    );
    this.motionSpeed = readNumber(
      typeof config.playerSpeed === "number" ? config.playerSpeed : undefined,
      this.motionSpeed,
    );
    const physics =
      typeof config.physics === "object" && config.physics !== null
        ? config.physics
        : {};
    const gravity =
      typeof physics.gravity === "object" && physics.gravity !== null
        ? physics.gravity
        : {};
    this.gravity = readNumber(
      typeof gravity.y === "number" ? gravity.y : undefined,
      this.gravity,
    );
    if (this.physics?.world) {
      this.physics.world.gravity.y = this.gravity;
    }
    this.drawAccent();
  }

  update(_time: number, delta: number): void {
    if (!this.accentGraphics) return;
    this.accentGraphics.rotation += this.motionSpeed * (delta / 1000) * 0.002;
  }

  private drawAccent(): void {
    const { width, height } = this.scale;
    this.accentGraphics?.destroy();
    this.accentGraphics = this.add.graphics();
    this.accentGraphics.fillStyle(0xffffff, 0.35);
    this.accentGraphics.fillCircle(width / 2, height / 2 + 36, 36);
  }
}
`;
}

export function createGameTemplate(
  input: CreateGameTemplateInput,
): CreateGameTemplateResult {
  const name = input.name.trim();
  const templateId = slugifyTemplateId(input.templateId || name);

  if (!name) {
    return { ok: false, error: "Template name is required.", status: 400 };
  }
  if (!templateId || !TEMPLATE_ID_PATTERN.test(templateId)) {
    return {
      ok: false,
      error: "Template ID must be kebab-case (e.g. my-game), starting with a letter.",
      status: 400,
    };
  }

  if (!existsSync(engineRoot)) {
    return {
      ok: false,
      error:
        "Game engine source is not available. Run Studio from the monorepo or rebuild the desktop app with template authoring enabled.",
      status: 503,
    };
  }

  const targetDir = path.join(templatesRoot, templateId);
  if (existsSync(targetDir)) {
    return {
      ok: false,
      error: `Template "${templateId}" already exists.`,
      status: 409,
    };
  }

  const sceneKey = toSceneKey(templateId);
  const sceneClassName = `${sceneKey}Scene`;

  try {
    mkdirSync(path.join(targetDir, "public/assets"), { recursive: true });
    writeFileSync(
      path.join(targetDir, "manifest.json"),
      `${JSON.stringify(buildManifest(name, templateId, sceneKey), null, 2)}\n`,
      "utf8",
    );
    writeFileSync(path.join(targetDir, "index.ts"), buildIndexTs(sceneKey, sceneClassName), "utf8");
    writeFileSync(
      path.join(targetDir, "GameScene.ts"),
      buildGameSceneTs(sceneKey, sceneClassName, name),
      "utf8",
    );
    writeFileSync(path.join(targetDir, "public/assets/.gitkeep"), "", "utf8");
    writeFileSync(
      path.join(targetDir, "CURSOR.md"),
      buildCursorInstructions(name, templateId, sceneKey),
      "utf8",
    );

    mkdirSync(previewsRoot, { recursive: true });
    writeFileSync(
      path.join(previewsRoot, `${templateId}.svg`),
      buildPreviewSvg(name),
      "utf8",
    );
  } catch (error) {
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not write template files: ${message}`, status: 500 };
  }

  const normalizeResult = normalizeTemplateDirectory(targetDir, templateId);
  if (!normalizeResult.ok) {
    rmSync(targetDir, { recursive: true, force: true });
    return { ok: false, error: normalizeResult.error, status: 400 };
  }

  const syncResult = runSyncManifestRegistry();
  if (!syncResult.ok) {
    rmSync(targetDir, { recursive: true, force: true });
    runSyncManifestRegistry();
    return { ok: false, error: syncResult.error, status: 500 };
  }

  const repositoryPath = path
    .relative(path.resolve(dashboardRoot, "../.."), targetDir)
    .split(path.sep)
    .join("/");

  return { ok: true, templateId, repositoryPath };
}
