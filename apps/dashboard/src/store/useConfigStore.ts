"use client";

import { getBridgePostMessageTargetOrigin } from "@/bridge/messenger";
import {
  BRIDGE_MESSAGE_TYPE,
  GameConfigSchema,
  cloneForBridgePostMessage,
  type GameConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import { create } from "state";

const isDev = process.env.NODE_ENV === "development";

function devWarn(label: string, detail: unknown): void {
  if (!isDev) return;
  console.warn(`[useConfigStore] ${label}:`, detail);
}

export interface ConfigStore {
  config: GameConfig;
  selectedTemplateId: GameTemplateId;
  iframeTarget: Window | null;
  engineReady: boolean;
  setConfig: (next: GameConfig) => void;
  patchConfig: (patch: Partial<GameConfig>) => void;
  patchConfigPath: (path: string, value: unknown) => void;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  setIframeTarget: (win: Window | null) => void;
  setEngineReady: (ready: boolean) => void;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: GameConfigSchema.parse({
    activeTemplateId: "catch-game-demo",
    themeColor: "#6366f1",
    schemaVersion: "1.0.0",
  }),
  selectedTemplateId: "catch-game-demo",
  iframeTarget: null,
  engineReady: false,

  setConfig: (next) => {
    const parsed = GameConfigSchema.safeParse(next);
    if (!parsed.success) {
      devWarn("Rejected setConfig payload", parsed.error.flatten());
      return;
    }
    set({ config: parsed.data });
  },

  patchConfig: (patch) => {
    const current = get().config;
    const merged = { ...current, ...patch };
    const parsed = GameConfigSchema.safeParse(merged);
    if (!parsed.success) {
      devWarn("Rejected patchConfig payload", parsed.error.flatten());
      return;
    }
    set({ config: parsed.data });
  },

  patchConfigPath: (path, value) => {
    const next = cloneForBridgePostMessage(get().config);
    const parts = path.split(".");
    let cursor: Record<string, unknown> = next as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]!;
      if (
        !(key in cursor) ||
        typeof cursor[key] !== "object" ||
        cursor[key] === null
      ) {
        cursor[key] = {};
      }
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]!] = value;
    const parsed = GameConfigSchema.safeParse(next);
    if (!parsed.success) {
      devWarn("Rejected patchConfigPath", parsed.error.flatten());
      return;
    }
    set({ config: parsed.data });
  },

  setSelectedTemplateId: (id) => {
    set((state) => ({
      selectedTemplateId: id,
      config: {
        ...state.config,
        activeTemplateId: id,
      },
    }));
  },

  setIframeTarget: (win) => set({ iframeTarget: win }),
  setEngineReady: (ready) => set({ engineReady: ready }),
}));

function postConfigToIframe(config: GameConfig): void {
  const { iframeTarget, engineReady } = useConfigStore.getState();
  if (!iframeTarget || iframeTarget === window) {
    // Config often updates before the preview iframe loads; useBridgeSync flushes on bind.
    if (isDev && engineReady) {
      devWarn("Skipped CONFIG_UPDATED — iframe contentWindow not bound", null);
    }
    return;
  }

  const parsed = GameConfigSchema.safeParse(config);
  if (!parsed.success) {
    devWarn("Skipped CONFIG_UPDATED — invalid config", parsed.error.flatten());
    return;
  }

  const message = {
    type: BRIDGE_MESSAGE_TYPE.CONFIG_UPDATED,
    payload: cloneForBridgePostMessage(parsed.data),
  };
  const targetOrigin = getBridgePostMessageTargetOrigin();

  if (isDev) {
    console.log(
      "[Dashboard Bridge] Sending CONFIG_UPDATED:",
      message.payload,
      "→ iframe",
      targetOrigin,
    );
  }

  iframeTarget.postMessage(message, targetOrigin);
}

useConfigStore.subscribe((state, prev) => {
  if (state.config === prev.config) return;
  postConfigToIframe(state.config);
});

export function flushConfigToIframe(): void {
  postConfigToIframe(useConfigStore.getState().config);
}
