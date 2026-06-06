import type { ConfigRootCategory, ControlFieldSchema } from "./types";

export interface ControlGroup {
  key: string;
  label: string;
  category: ConfigRootCategory;
  controls: ControlFieldSchema[];
}

const SECTION_LABEL_OVERRIDES: Record<string, string> = {
  theme: "Theme",
  domOverlay: "Start screen & overlay",
  mechanics: "Mechanics",
  localization: "Localization",
  gamification: "Gamification",
  physics: "Physics",
  gameplay: "Gameplay",
  assets: "Assets",
  game: "Game settings",
  animations: "Animations",
  playerSprite: "Player sprite",
  goodItems: "Good items",
  badItems: "Bad items",
  goodItem0: "Good item 1",
  badItem0: "Bad item 1",
  player: "Player",
  ground: "Ground",
  catchableItems: "Catchable items",
  hazardItems: "Hazard items",
  playerEntity: "Player entity",
};

function getGroupKeyFromPath(targetPath: string): string {
  const segments = targetPath.split(".").filter(Boolean);
  if (segments.length <= 1) return segments[0] ?? "general";
  return segments.slice(0, -1).join(".");
}

function findCommonPrefixLength(allSegments: string[][]): number {
  if (allSegments.length === 0) return 0;
  const first = allSegments[0]!;
  let prefixLen = 0;
  while (prefixLen < first.length) {
    const segment = first[prefixLen];
    if (!allSegments.every((segments) => segments[prefixLen] === segment)) {
      break;
    }
    prefixLen += 1;
  }
  return prefixLen;
}

function humanizeSegment(segment: string): string {
  if (SECTION_LABEL_OVERRIDES[segment]) return SECTION_LABEL_OVERRIDES[segment];
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatGroupLabel(groupKey: string, allGroupKeys: string[]): string {
  const segments = groupKey.split(".").filter(Boolean);
  if (segments.length === 0) return "General";

  const commonPrefixLen = findCommonPrefixLength(
    allGroupKeys.map((key) => key.split(".").filter(Boolean)),
  );
  const relativeSegments = segments.slice(commonPrefixLen);
  const labelSegments =
    relativeSegments.length > 0 ? relativeSegments : segments;

  const last = labelSegments[labelSegments.length - 1]!;
  if (/^\d+$/.test(last) && labelSegments.length >= 2) {
    const parent = labelSegments[labelSegments.length - 2]!;
    const parentLabel = humanizeSegment(parent).replace(/s$/, "");
    return `${parentLabel} ${Number(last) + 1}`;
  }

  return humanizeSegment(last);
}

/** Group dashboard controls by their parent config path (one expandable section per element). */
export function groupControlsByElement(
  controls: ControlFieldSchema[],
): ControlGroup[] {
  const groupMap = new Map<string, ControlGroup>();

  for (const control of controls) {
    const key = getGroupKeyFromPath(control.targetPath);
    const existing = groupMap.get(key);
    if (existing) {
      existing.controls.push(control);
      continue;
    }
    groupMap.set(key, {
      key,
      label: "",
      category: control.targetCategory,
      controls: [control],
    });
  }

  const groups = [...groupMap.values()];
  const allKeys = groups.map((group) => group.key);
  for (const group of groups) {
    group.label = formatGroupLabel(group.key, allKeys);
  }

  return groups;
}
