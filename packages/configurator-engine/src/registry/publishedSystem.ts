import type { GameTemplateId, SystemSettings } from "@advergaming/shared";
import { getPublishedSystemDefaults } from "@advergaming/game-engine/templates/schemas";

export function loadPublishedSystemDefaults(
  templateId: GameTemplateId,
): SystemSettings {
  return getPublishedSystemDefaults(templateId);
}
