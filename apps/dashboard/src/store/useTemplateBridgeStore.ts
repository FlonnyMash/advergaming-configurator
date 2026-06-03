"use client";

import type { GameTemplateId } from "@advergaming/shared";
import { create } from "zustand";

type TemplateBridgeStore = {
  templateChangeInProgress: boolean;
  pendingTemplateId: GameTemplateId | null;
  setTemplateChangeInProgress: (inProgress: boolean) => void;
  setPendingTemplateId: (id: GameTemplateId | null) => void;
  beginTemplateChange: (templateId: GameTemplateId) => void;
  completeTemplateChange: (templateId: GameTemplateId) => void;
};

export const useTemplateBridgeStore = create<TemplateBridgeStore>((set) => ({
  templateChangeInProgress: false,
  pendingTemplateId: null,
  setTemplateChangeInProgress: (templateChangeInProgress) =>
    set({ templateChangeInProgress }),
  setPendingTemplateId: (pendingTemplateId) => set({ pendingTemplateId }),
  beginTemplateChange: (templateId) =>
    set({
      templateChangeInProgress: true,
      pendingTemplateId: templateId,
    }),
  completeTemplateChange: (templateId) =>
    set((state) => {
      if (
        state.pendingTemplateId !== null &&
        state.pendingTemplateId !== templateId
      ) {
        return state;
      }
      return {
        templateChangeInProgress: false,
        pendingTemplateId: null,
      };
    }),
}));
