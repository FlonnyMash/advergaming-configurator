export interface ThemeConfig {
  primaryColor: string;
  playerTexture: string | null;
}

export interface GameplayConfig {
  playerSpeed: number;
}

export interface DOMOverlayConfig {
  startScreenTitle: string;
  showLeadForm: boolean;
  ctaButtonText: string;
  showHighscores: boolean;
}

export interface GameMasterConfig {
  theme: ThemeConfig;
  gameplay: GameplayConfig;
  domOverlay: DOMOverlayConfig;
}

export const BRIDGE_MESSAGE_TYPE = {
  UPDATE_CONFIG: "UPDATE_CONFIG",
  IFRAME_READY: "IFRAME_READY",
} as const;

export interface UpdateConfigMessage {
  type: typeof BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG;
  payload: GameMasterConfig;
}

export interface IframeReadyMessage {
  type: typeof BRIDGE_MESSAGE_TYPE.IFRAME_READY;
}

export type BridgeMessage = UpdateConfigMessage | IframeReadyMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isGameMasterConfig(data: unknown): data is GameMasterConfig {
  if (!isRecord(data)) return false;
  const theme = data.theme;
  const gameplay = data.gameplay;
  const domOverlay = data.domOverlay;
  if (!isRecord(theme) || typeof theme.primaryColor !== "string") return false;
  const playerTexture = theme.playerTexture;
  if (playerTexture !== null && typeof playerTexture !== "string") return false;
  if (!isRecord(gameplay) || typeof gameplay.playerSpeed !== "number")
    return false;
  if (!isRecord(domOverlay)) return false;
  if (typeof domOverlay.startScreenTitle !== "string") return false;
  if (typeof domOverlay.showLeadForm !== "boolean") return false;
  if (typeof domOverlay.ctaButtonText !== "string") return false;
  if (typeof domOverlay.showHighscores !== "boolean") return false;
  return true;
}

export function isUpdateConfigMessage(
  data: unknown,
): data is UpdateConfigMessage {
  return (
    isRecord(data) &&
    data.type === BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG &&
    isGameMasterConfig(data.payload)
  );
}

export function isIframeReadyMessage(data: unknown): data is IframeReadyMessage {
  return isRecord(data) && data.type === BRIDGE_MESSAGE_TYPE.IFRAME_READY;
}

export const DEFAULT_GAME_MASTER_CONFIG: GameMasterConfig = {
  theme: { primaryColor: "#6366f1", playerTexture: null },
  gameplay: { playerSpeed: 200 },
  domOverlay: {
    startScreenTitle: "Play Now",
    showLeadForm: false,
    ctaButtonText: "Start Game",
    showHighscores: true,
  },
};

export const GAME_TEMPLATE_IDS = ["dice-poker", "clicker"] as const;
export type GameTemplateId = (typeof GAME_TEMPLATE_IDS)[number];

export const GAME_TEMPLATES: { id: GameTemplateId; label: string }[] = [
  { id: "dice-poker", label: "Dice Poker" },
  { id: "clicker", label: "Clicker" },
];

export function isGameTemplateId(value: string): value is GameTemplateId {
  return (GAME_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function parseGameTemplateId(
  value: string | null | undefined,
): GameTemplateId {
  if (value && isGameTemplateId(value)) return value;
  return "dice-poker";
}

export type ControlType = "slider" | "color" | "text" | "image";

export interface ControlSchema {
  key: keyof GameMasterConfig | string;
  label: string;
  type: ControlType;
  targetCategory: "theme" | "gameplay" | "domOverlay";
  min?: number;
  max?: number;
}

export const GAME_SCHEMAS: Record<GameTemplateId, ControlSchema[]> = {
  "dice-poker": [
    {
      key: "playerSpeed",
      label: "Player speed",
      type: "slider",
      targetCategory: "gameplay",
      min: 50,
      max: 400,
    },
    {
      key: "primaryColor",
      label: "Primary color",
      type: "color",
      targetCategory: "theme",
    },
    {
      key: "startScreenTitle",
      label: "Start screen title",
      type: "text",
      targetCategory: "domOverlay",
    },
  ],
  clicker: [
    {
      key: "primaryColor",
      label: "Brand color",
      type: "color",
      targetCategory: "theme",
    },
    {
      key: "playerTexture",
      label: "Clicker sprite",
      type: "image",
      targetCategory: "theme",
    },
    {
      key: "ctaButtonText",
      label: "CTA button text",
      type: "text",
      targetCategory: "domOverlay",
    },
    {
      key: "playerSpeed",
      label: "Tap sensitivity",
      type: "slider",
      targetCategory: "gameplay",
      min: 100,
      max: 600,
    },
  ],
};
