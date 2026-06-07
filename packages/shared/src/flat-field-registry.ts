import type { AppMode } from "./flat-game-config";
import type { GameConfig } from "./flat-game-config";

export type FlatFieldType = "color" | "image" | "slider" | "text" | "number";

export type FlatFieldSurface = "studio" | "configurator" | "both";

export type FlatFieldDefinition = {
  key: keyof GameConfig & string;
  type: FlatFieldType;
  surface: FlatFieldSurface;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

export const FLAT_FIELD_REGISTRY: FlatFieldDefinition[] = [
  {
    key: "themeColor",
    type: "color",
    surface: "both",
    label: "Theme color",
  },
  {
    key: "backgroundColor",
    type: "color",
    surface: "studio",
    label: "Background color",
  },
  {
    key: "logoUrl",
    type: "image",
    surface: "both",
    label: "Logo",
  },
  {
    key: "startScreenTitle",
    type: "text",
    surface: "both",
    label: "Start screen title",
    placeholder: "Ready to play?",
  },
  {
    key: "startScreenSubtitle",
    type: "text",
    surface: "both",
    label: "Start screen subtitle",
    placeholder: "Tap start when you are ready.",
  },
  {
    key: "ctaLabel",
    type: "text",
    surface: "both",
    label: "CTA label",
    placeholder: "Start Game",
  },
  {
    key: "playerSpeed",
    type: "slider",
    surface: "studio",
    label: "Player speed",
    min: 100,
    max: 600,
    step: 10,
  },
  {
    key: "gameDurationSeconds",
    type: "number",
    surface: "studio",
    label: "Game duration (seconds)",
    min: 10,
    max: 300,
    step: 5,
  },
];

export function fieldsForMode(mode: AppMode): FlatFieldDefinition[] {
  const allowed: FlatFieldSurface[] =
    mode === "studio" ? ["studio", "both"] : ["configurator", "both"];
  return FLAT_FIELD_REGISTRY.filter((field) => allowed.includes(field.surface));
}
