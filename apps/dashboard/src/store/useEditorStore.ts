"use client";

import {
  DEFAULT_EDITOR_STATE,
  encodeEntityId,
  type DevToolkitAssetConfigBinding,
  type EditorState,
} from "@advergaming/shared";
import { create } from "zustand";

type EditorStore = EditorState & {
  setWorkspaceMode: (mode: EditorState["workspaceMode"]) => void;
  setAssetInspectorActive: (active: boolean) => void;
  setActiveEntityId: (entityId: string | null) => void;
  openAssetInspector: (binding: DevToolkitAssetConfigBinding) => void;
  closeAssetInspector: () => void;
  reset: () => void;
};

export const useEditorStore = create<EditorStore>((set) => ({
  ...DEFAULT_EDITOR_STATE,
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  setAssetInspectorActive: (isAssetInspectorActive) =>
    set({ isAssetInspectorActive }),
  setActiveEntityId: (activeEntityId) => set({ activeEntityId }),
  openAssetInspector: (binding) =>
    set({
      isAssetInspectorActive: true,
      activeEntityId: encodeEntityId(binding),
    }),
  closeAssetInspector: () =>
    set({ isAssetInspectorActive: false, activeEntityId: null }),
  reset: () => set({ ...DEFAULT_EDITOR_STATE }),
}));
