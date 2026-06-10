import { DEFAULT_GAME_TEMPLATE_ID } from "@mashedgames/shared";

export function getProductionTemplateOptions(): Array<{ id: string; label: string }> {
  return [{ id: DEFAULT_GAME_TEMPLATE_ID, label: "Default template" }];
}

export function getStudioTemplateOptions(): Array<{ id: string; label: string }> {
  return [{ id: DEFAULT_GAME_TEMPLATE_ID, label: "Default template" }];
}
