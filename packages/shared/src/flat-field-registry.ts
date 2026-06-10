import type { AppMode } from "./flat-game-config";
import type { GameConfig } from "./flat-game-config";

export type FlatFieldType =
  | "color"
  | "image"
  | "slider"
  | "text"
  | "number"
  | "toggle"
  | "styled-text";

export type FlatFieldSurface = "studio" | "configurator" | "both";

/**
 * Declares which flat GameConfig keys control inline style properties for a
 * `"styled-text"` field. All bindings are optional; the toolbar renders only
 * the controls whose key is declared. The underlying data stays flat — no
 * nested objects, no HTML strings.
 */
export type StyleBindings = {
  /** Key of a hex-color string field (e.g. `"startScreenTitleColor"`). */
  colorKey?: keyof GameConfig & string;
  /** Key of a boolean field that drives `fontWeight: bold`. */
  boldKey?: keyof GameConfig & string;
  /** Key of a boolean field that drives `fontStyle: italic`. */
  italicKey?: keyof GameConfig & string;
  /** Key of a boolean field that drives `textDecoration: underline`. */
  underlineKey?: keyof GameConfig & string;
};

export type FlatFieldDefinition = {
  key: keyof GameConfig & string;
  type: FlatFieldType;
  surface: FlatFieldSurface;
  label: string;
  /** Group this field belongs to. Ungrouped fields are rendered outside any accordion. */
  group?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /**
   * Only valid when `type === "styled-text"`. Declares which additional flat
   * keys drive inline color/bold/italic styling on this text field. The bound
   * keys are NOT rendered as separate rows — the `StyledTextInput` toolbar
   * owns their controls.
   */
  styleBindings?: StyleBindings;
};

// ---------------------------------------------------------------------------
// Group definitions
//
// Declares logical sections for the sidebar panel. The masterVisibilityKey
// must be a boolean GameConfig key; when present it is rendered as a toggle
// in the group header rather than inside the body, and its value controls
// whether nested fields are interactive.
// ---------------------------------------------------------------------------

export type GroupDefinition = {
  /** Unique group identifier referenced by FlatFieldDefinition.group. */
  id: string;
  /** Human-readable heading shown in the accordion header. */
  label: string;
  /** Surface visibility — same semantics as FlatFieldDefinition.surface. */
  surface: FlatFieldSurface;
  /**
   * A boolean GameConfig key whose value acts as master visibility for this group.
   * When defined the toggle is rendered in the group header. Turning it off
   * visually disables all body fields and writes the false value to flat config.
   */
  masterVisibilityKey?: keyof GameConfig & string;
  /** When true the accordion is collapsed by default. */
  defaultCollapsed?: boolean;
};

export const GROUP_REGISTRY: GroupDefinition[] = [
  {
    id: "branding",
    label: "Branding",
    surface: "both",
  },
  {
    id: "startScreen",
    label: "Start Screen",
    surface: "both",
    masterVisibilityKey: "showStartScreen",
  },
  {
    id: "gameplay",
    label: "Gameplay",
    surface: "studio",
    defaultCollapsed: true,
  },
  {
    id: "highscore",
    label: "Highscore Board",
    surface: "both",
    masterVisibilityKey: "showHighscore",
    defaultCollapsed: true,
  },
  {
    id: "leadCapture",
    label: "Lead Capture",
    surface: "both",
    masterVisibilityKey: "showLeadCapture",
    defaultCollapsed: true,
  },
  {
    id: "timer",
    label: "Countdown Timer",
    surface: "both",
    masterVisibilityKey: "showCountdownTimer",
    defaultCollapsed: true,
  },
];

export const FLAT_FIELD_REGISTRY: FlatFieldDefinition[] = [
  // ── Branding ──────────────────────────────────────────────────────────────
  {
    key: "themeColor",
    type: "color",
    surface: "both",
    label: "Theme color",
    group: "branding",
  },
  {
    key: "backgroundColor",
    type: "color",
    surface: "studio",
    label: "Background color",
    group: "branding",
  },
  {
    key: "logoUrl",
    type: "image",
    surface: "both",
    label: "Logo",
    group: "branding",
  },
  // ── Start Screen ──────────────────────────────────────────────────────────
  // showStartScreen is the masterVisibilityKey — rendered in the group header,
  // not in this list.
  // Color/bold/italic keys are NOT separate rows — they live inside the
  // StyledTextInput toolbar via styleBindings.
  {
    key: "startScreenTitle",
    type: "styled-text",
    surface: "both",
    label: "Title",
    placeholder: "Ready to play?",
    group: "startScreen",
    styleBindings: {
      colorKey: "startScreenTitleColor",
      boldKey: "startScreenTitleBold",
      italicKey: "startScreenTitleItalic",
      underlineKey: "startScreenTitleUnderline",
    },
  },
  {
    key: "startScreenSubtitle",
    type: "styled-text",
    surface: "both",
    label: "Subtitle",
    placeholder: "Tap start when you are ready.",
    group: "startScreen",
    styleBindings: {
      colorKey: "startScreenSubtitleColor",
      boldKey: "startScreenSubtitleBold",
      italicKey: "startScreenSubtitleItalic",
      underlineKey: "startScreenSubtitleUnderline",
    },
  },
  {
    key: "ctaLabel",
    type: "styled-text",
    surface: "both",
    label: "CTA label",
    placeholder: "Start Game",
    group: "startScreen",
    styleBindings: {
      colorKey: "ctaTextColor",
      boldKey: "ctaLabelBold",
      italicKey: "ctaLabelItalic",
      underlineKey: "ctaLabelUnderline",
    },
  },
  // ── Gameplay ──────────────────────────────────────────────────────────────
  {
    key: "playerSpeed",
    type: "slider",
    surface: "studio",
    label: "Player speed",
    min: 100,
    max: 600,
    step: 10,
    group: "gameplay",
  },
  {
    key: "gameDurationSeconds",
    type: "number",
    surface: "studio",
    label: "Game duration (seconds)",
    min: 10,
    max: 300,
    step: 5,
    group: "gameplay",
  },
  // ── Highscore, Lead Capture, Timer ────────────────────────────────────────
  // These groups only carry their masterVisibilityKey (header toggle) for now.
  // Future fields (e.g. highscoreLimit, leadCaptureHeading) are added here.
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fieldsForMode(mode: AppMode): FlatFieldDefinition[] {
  const allowed: FlatFieldSurface[] =
    mode === "studio" ? ["studio", "both"] : ["configurator", "both"];
  return FLAT_FIELD_REGISTRY.filter((f) => allowed.includes(f.surface));
}

export function groupsForMode(mode: AppMode): GroupDefinition[] {
  const allowed: FlatFieldSurface[] =
    mode === "studio" ? ["studio", "both"] : ["configurator", "both"];
  return GROUP_REGISTRY.filter((g) => allowed.includes(g.surface));
}

/**
 * Returns the body fields for a given group in the correct surface context.
 * The masterVisibilityKey field is intentionally excluded — it lives in the
 * group header, not the body.
 */
export function fieldsForGroup(
  groupId: string,
  mode: AppMode,
): FlatFieldDefinition[] {
  return fieldsForMode(mode).filter((f) => f.group === groupId);
}

/**
 * Returns fields that carry no group assignment for the given mode.
 * These are rendered above all accordion groups.
 */
export function ungroupedFields(mode: AppMode): FlatFieldDefinition[] {
  return fieldsForMode(mode).filter((f) => !f.group);
}
