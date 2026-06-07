"use client";

import { create } from "state";

type EditorStore = {
  reset: () => void;
  closeAssetInspector: () => void;
};

export const useEditorStore = create<EditorStore>(() => ({
  reset: () => {},
  closeAssetInspector: () => {},
}));
