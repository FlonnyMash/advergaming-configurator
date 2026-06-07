"use client";

import { create } from "state";

export const GAME_PREVIEW_PANE_ID = "game-preview";

type WorkspaceCenterStore = {
  activePaneId: string;
  reset: () => void;
};

export const useWorkspaceCenterStore = create<WorkspaceCenterStore>(() => ({
  activePaneId: GAME_PREVIEW_PANE_ID,
  reset: () => {},
}));
