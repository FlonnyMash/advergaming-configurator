"use client";

import { useEditorStore } from "@/store/useEditorStore";
import type { DevToolkitPickedAsset } from "@advergaming/shared";
import { create } from "zustand";

export const GAME_PREVIEW_PANE_ID = "game-preview";

export type GamePreviewPane = {
  kind: "game-preview";
  id: typeof GAME_PREVIEW_PANE_ID;
};

export type AssetInspectorPane = {
  kind: "asset";
  id: string;
  asset: DevToolkitPickedAsset;
};

export type WorkspacePane = GamePreviewPane | AssetInspectorPane;

export function assetPaneLabel(asset: DevToolkitPickedAsset): string {
  const short = asset.name || asset.textureKey || asset.objectType;
  return short.length > 22 ? `${short.slice(0, 20)}…` : short;
}

type WorkspaceCenterStore = {
  activePaneId: string;
  panes: WorkspacePane[];
  nextAssetPaneSeq: number;
  setActivePane: (paneId: string) => void;
  openAssetPane: (
    asset: DevToolkitPickedAsset,
    options?: { activate?: boolean },
  ) => void;
  closePane: (paneId: string) => void;
  updateAssetPane: (paneId: string, asset: DevToolkitPickedAsset) => void;
  reset: () => void;
};

const DEFAULT_PANES: WorkspacePane[] = [{ kind: "game-preview", id: GAME_PREVIEW_PANE_ID }];

export const useWorkspaceCenterStore = create<WorkspaceCenterStore>((set, get) => ({
  activePaneId: GAME_PREVIEW_PANE_ID,
  panes: [...DEFAULT_PANES],
  nextAssetPaneSeq: 0,
  setActivePane: (paneId) => {
    const exists = get().panes.some((pane) => pane.id === paneId);
    if (!exists) {
      return;
    }
    set({ activePaneId: paneId });
  },
  openAssetPane: (asset, options) => {
    const activate = options?.activate ?? true;
    const seq = get().nextAssetPaneSeq;
    const paneId = `asset--${seq}`;
    const nextPane: AssetInspectorPane = { kind: "asset", id: paneId, asset };

    set({
      nextAssetPaneSeq: seq + 1,
      panes: [...get().panes, nextPane],
      activePaneId: activate ? paneId : get().activePaneId,
    });
  },
  closePane: (paneId) => {
    if (paneId === GAME_PREVIEW_PANE_ID) {
      return;
    }

    const panes = get().panes.filter((pane) => pane.id !== paneId);
    const activePaneId =
      get().activePaneId === paneId ? GAME_PREVIEW_PANE_ID : get().activePaneId;

    const closedAssetPane = get().panes.find(
      (pane) => pane.kind === "asset" && pane.id === paneId,
    );
    if (closedAssetPane?.kind === "asset") {
      const remainingAssetPanes = panes.filter((pane) => pane.kind === "asset");
      if (remainingAssetPanes.length === 0) {
        useEditorStore.getState().closeAssetInspector();
      }
    }

    set({ panes, activePaneId });
  },
  updateAssetPane: (paneId, asset) => {
    set({
      panes: get().panes.map((pane) =>
        pane.kind === "asset" && pane.id === paneId ? { ...pane, asset } : pane,
      ),
    });
  },
  reset: () => {
    useEditorStore.getState().reset();
    set({
      activePaneId: GAME_PREVIEW_PANE_ID,
      panes: [...DEFAULT_PANES],
      nextAssetPaneSeq: 0,
    });
  },
}));
