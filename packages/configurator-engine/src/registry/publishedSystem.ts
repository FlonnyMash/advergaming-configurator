import type { GameTemplateId, SystemSettings } from "@mashedgames/shared";
import { getPublishedSystemDefaults } from "@mashedgames/game-engine/templates/schemas";

export function loadPublishedSystemDefaults(
  templateId: GameTemplateId,
): SystemSettings {
  return getPublishedSystemDefaults(templateId);
}
