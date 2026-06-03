import {
  controlsForMode,
  gameSchemaFromManifestForMode,
  getConfigValue,
  listSchemaControlChanges,
  type ParentDriftItem,
  type ParentDriftReport,
} from "@mashedgames/shared";
import { buildLiveParentConfig } from "@/lib/project-parent-config";
import { loadProject } from "@/lib/project-io";

export async function computeParentDrift(
  projectId: string,
): Promise<
  | { ok: true; report: ParentDriftReport }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadProject(projectId);
  if (!loaded.ok) {
    return loaded;
  }

  const { manifest, config: projectConfig, parentLock } = loaded.data;
  const { manifest: liveManifest, config: liveParent } = buildLiveParentConfig(
    manifest.parentTemplateId,
  );

  const schema = gameSchemaFromManifestForMode(liveManifest, "configurator");
  const brandingControls = controlsForMode(schema, "configurator").filter(
    (c) => c.targetCategory === "branding",
  );

  const baselineConfig = parentLock?.config ?? projectConfig;
  const lockedVersion = parentLock?.parentVersion ?? manifest.parentVersion;
  const liveVersion = liveManifest.version;

  const items: ParentDriftItem[] = [];

  if (lockedVersion !== liveVersion) {
    items.push({
      kind: "version-bump",
      label: `Parent template ${lockedVersion} → ${liveVersion}`,
      detail: manifest.parentTemplateId,
      required: false,
    });
  }

  const lockedSchemaVersion =
    parentLock?.parentSchemaVersion ?? manifest.parentSchemaVersion;
  if (lockedSchemaVersion !== liveParent.meta.schemaVersion) {
    items.push({
      kind: "schema-bump",
      label: `Schema ${lockedSchemaVersion} → ${liveParent.meta.schemaVersion}`,
      required: false,
    });
  }

  for (const change of listSchemaControlChanges(
    schema,
    "configurator",
    baselineConfig,
    liveParent,
  )) {
    if (change.targetCategory !== "branding") {
      continue;
    }
    items.push({
      kind: "default-changed",
      label: change.label,
      targetPath: change.targetPath,
      detail: "Parent template default changed",
      savedValue: change.savedValue,
      currentValue: change.currentValue,
      required: false,
    });
  }

  const baselinePaths = new Set(
    controlsForMode(schema, "configurator")
      .filter((c) => c.targetCategory === "branding")
      .map((c) => c.targetPath),
  );

  for (const control of brandingControls) {
    const hadControlAtLock = parentLock
      ? getConfigValue(parentLock.config, control) !== undefined
      : baselinePaths.has(control.targetPath);

    if (!hadControlAtLock && parentLock) {
      items.push({
        kind: "new-control",
        label: control.label,
        targetPath: control.targetPath,
        currentValue: getConfigValue(liveParent, control),
        required: true,
      });
      continue;
    }

    const projectValue = getConfigValue(projectConfig, control);
    const liveValue = getConfigValue(liveParent, control);
    if (projectValue !== liveValue && projectValue !== undefined) {
      const alreadyListed = items.some(
        (item) =>
          item.targetPath === control.targetPath && item.kind === "value-mismatch",
      );
      if (!alreadyListed) {
        items.push({
          kind: "value-mismatch",
          label: control.label,
          targetPath: control.targetPath,
          savedValue: projectValue,
          currentValue: liveValue,
          required: false,
        });
      }
    }
  }

  const hasBlockingItems = items.some((item) => item.required);

  return {
    ok: true,
    report: {
      projectId,
      parentTemplateId: manifest.parentTemplateId,
      lockedVersion,
      liveVersion,
      items,
      hasBlockingItems,
    },
  };
}
