export interface ThemeConfig {
  primaryColor: string;
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

export function isUpdateConfigMessage(
  data: unknown,
): data is UpdateConfigMessage {
  if (!isRecord(data)) return false;
  if (data.type !== BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG) return false;
  const payload = data.payload;
  if (!isRecord(payload)) return false;
  const theme = payload.theme;
  const gameplay = payload.gameplay;
  const domOverlay = payload.domOverlay;
  if (!isRecord(theme) || typeof theme.primaryColor !== "string") return false;
  if (!isRecord(gameplay) || typeof gameplay.playerSpeed !== "number")
    return false;
  if (!isRecord(domOverlay)) return false;
  if (typeof domOverlay.startScreenTitle !== "string") return false;
  if (typeof domOverlay.showLeadForm !== "boolean") return false;
  if (typeof domOverlay.ctaButtonText !== "string") return false;
  if (typeof domOverlay.showHighscores !== "boolean") return false;
  return true;
}

export function isIframeReadyMessage(data: unknown): data is IframeReadyMessage {
  return isRecord(data) && data.type === BRIDGE_MESSAGE_TYPE.IFRAME_READY;
}

export const DEFAULT_GAME_MASTER_CONFIG: GameMasterConfig = {
  theme: { primaryColor: "#6366f1" },
  gameplay: { playerSpeed: 200 },
  domOverlay: {
    startScreenTitle: "Play Now",
    showLeadForm: false,
    ctaButtonText: "Start Game",
    showHighscores: true,
  },
};
