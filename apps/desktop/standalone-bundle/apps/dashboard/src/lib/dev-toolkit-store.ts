"use client";

import {
  DEFAULT_DEV_TOOLKIT_FLAGS,
  type DevToolkitFlags,
  type DevToolkitSetFlagsPayload,
} from "@mashedgames/shared";
import { create } from "state";

type DevToolkitStore = {
  flags: DevToolkitFlags;
  setFlags: (flags: DevToolkitFlags) => void;
  patchFlags: (patch: DevToolkitSetFlagsPayload) => void;
  reset: () => void;
};

export const useDevToolkitStore = create<DevToolkitStore>((set) => ({
  flags: DEFAULT_DEV_TOOLKIT_FLAGS,
  setFlags: (flags) => set({ flags }),
  patchFlags: (patch) =>
    set((state) => ({
      flags: { ...state.flags, ...patch },
    })),
  reset: () =>
    set({
      flags: DEFAULT_DEV_TOOLKIT_FLAGS,
    }),
}));
