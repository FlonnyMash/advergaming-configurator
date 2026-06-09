"use client";

import { dashboardMessenger, getBridgePostMessageTargetOrigin } from "@/bridge/messenger";
import {
  BRIDGE_MESSAGE_TYPE,
  DEFAULT_GAME_CONFIG,
  GameConfigSchema,
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
  patchConfigKey: <K extends keyof GameConfig>(
    key: K,
    value: GameConfig[K],
  ) => void;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  setIframeTarget: (win: Window | null) => void;
  setEngineReady: (ready: boolean) => void;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: GameConfigSchema.parse(DEFAULT_GAME_CONFIG),
  selectedTemplateId: DEFAULT_GAME_CONFIG.activeTemplateId,
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
    const merged = { ...get().config, ...patch };
    const parsed = GameConfigSchema.safeParse(merged);
    if (!parsed.success) {
      devWarn("Rejected patchConfig payload", parsed.error.flatten());
      return;
    }
    set({ config: parsed.data });
  },

  patchConfigKey: (key, value) => {
    const merged = { ...get().config, [key]: value };
    const parsed = GameConfigSchema.safeParse(merged);
    if (!parsed.success) {
      devWarn("Rejected patchConfigKey", parsed.error.flatten());
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
    if (isDev && engineReady) {
      devWarn("Skipped UPDATE_CONFIG — iframe contentWindow not bound", null);
    }
    return;
  }

  const parsed = GameConfigSchema.safeParse(config);
  if (!parsed.success) {
    devWarn("Skipped UPDATE_CONFIG — invalid config", parsed.error.flatten());
    return;
  }

  const message = {
    type: BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG,
    payload: parsed.data,
  };
  const targetOrigin = getBridgePostMessageTargetOrigin();

  if (isDev) {
    console.log(
      "[Dashboard Bridge] Sending UPDATE_CONFIG:",
      message.payload,
      "→ iframe",
      targetOrigin,
    );
  }

  iframeTarget.postMessage(message, targetOrigin);
}

let configSyncSequenceId = 0;

useConfigStore.subscribe((state, prev) => {
  if (state.config === prev.config) return;
  postConfigToIframe(state.config);
  const projectId = state.config.projectId;
  if (projectId) {
    dashboardMessenger.sendConfigSync({
      mode: "full",
      config: state.config,
      projectId,
      sequenceId: ++configSyncSequenceId,
      timestamp: Date.now(),
    });
  }
});

export function flushConfigToIframe(): void {
  postConfigToIframe(useConfigStore.getState().config);
}
