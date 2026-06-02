"use client";

import {
  assetBindingKey,
  useAssetLayoutSavedStore,
} from "@/lib/asset-layout-saved-store";
import {
  layoutsEqual,
  patchAssetLayoutToStudioStore,
  readAssetLayoutFromStudioConfig,
} from "@/lib/patch-asset-layout";
import { useDevToolkitStore } from "@/lib/dev-toolkit-store";
import { useWorkspaceCenterStore } from "@/lib/workspace-center-store";
import { useDevToolkitControls } from "@/hooks/useDevToolkitBridge";
import type { DevToolkitAssetLayout, DevToolkitPickedAsset } from "@advergaming/shared";
import { useActiveConfigPatch } from "@/hooks/useActiveConfigPatch";
import { useConfiguratorStore } from "@advergaming/configurator-engine";
import { useStudioConfigStore } from "@advergaming/studio-engine";
import { Loader2, Redo2, Save, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_LAYOUT_HISTORY = 50;

type OverlayToggles = {
  hitbox: boolean;
  anchor: boolean;
  origin: boolean;
};

export function AssetLayoutEditor({
  paneId,
  asset,
  isActive,
  layoutDraft,
  onLayoutDraftChange,
  overlays,
  onOverlaysChange,
}: {
  paneId: string;
  asset: DevToolkitPickedAsset;
  isActive: boolean;
  layoutDraft: DevToolkitAssetLayout;
  onLayoutDraftChange: (layout: DevToolkitAssetLayout) => void;
  overlays: OverlayToggles;
  onOverlaysChange: (overlays: OverlayToggles) => void;
}) {
  const binding = asset.configBinding;
  const editable = Boolean(binding);

  const {
    patchBrandingPath,
    patchSystemPath,
    selectedTemplateId,
    saveTarget,
    saveLayout: saveLayoutToDisk,
  } = useActiveConfigPatch();
  const savedConfig = useStudioConfigStore((state) => state.savedConfig);
  const configuratorConfig = useConfiguratorStore((state) => state.config);
  const projectMode = saveTarget === "project";
  const baselineConfig = projectMode ? configuratorConfig : savedConfig;
  const setSavedLayout = useAssetLayoutSavedStore((state) => state.setSavedLayout);
  const updateAssetPane = useWorkspaceCenterStore((state) => state.updateAssetPane);
  const { sendFlags } = useDevToolkitControls();

  const flags = useDevToolkitStore((state) => state.flags);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyPast, setHistoryPast] = useState<DevToolkitAssetLayout[]>([]);
  const [historyFuture, setHistoryFuture] = useState<DevToolkitAssetLayout[]>([]);
  const layoutDraftRef = useRef(layoutDraft);
  layoutDraftRef.current = layoutDraft;

  const bindingKey = binding
    ? `${binding.itemKind}:${binding.itemIndex ?? ""}`
    : "none";

  useEffect(() => {
    setHistoryPast([]);
    setHistoryFuture([]);
  }, [paneId, bindingKey]);

  useEffect(() => {
    if (!binding) {
      return;
    }
    const key = assetBindingKey(binding);
    const existing = useAssetLayoutSavedStore.getState().savedLayouts[key];
    if (existing) {
      return;
    }
    const baseline =
      readAssetLayoutFromStudioConfig(baselineConfig, binding) ??
      asset.layout ??
      layoutDraft;
    setSavedLayout(key, baseline);
  }, [asset.layout, baselineConfig, binding, bindingKey, layoutDraft, setSavedLayout]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    sendFlags({
      hitboxes: overlays.hitbox,
      pivots: overlays.anchor,
      origins: overlays.origin,
      assetPicker: flags.assetPicker,
    });
  }, [flags.assetPicker, isActive, overlays, sendFlags]);

  const applyLayout = useCallback(
    (next: DevToolkitAssetLayout) => {
      onLayoutDraftChange(next);
      const nextAsset: DevToolkitPickedAsset = { ...asset, layout: next };
      updateAssetPane(paneId, nextAsset);

      if (!binding) {
        return;
      }

      patchAssetLayoutToStudioStore(
        patchBrandingPath,
        patchSystemPath,
        binding,
        next,
      );
    },
    [
      asset,
      binding,
      onLayoutDraftChange,
      paneId,
      patchBrandingPath,
      patchSystemPath,
      updateAssetPane,
    ],
  );

  const commitLayout = useCallback(
    (next: DevToolkitAssetLayout) => {
      const current = layoutDraftRef.current;
      if (!layoutsEqual(current, next)) {
        setHistoryPast((past) => [...past.slice(-(MAX_LAYOUT_HISTORY - 1)), current]);
        setHistoryFuture([]);
      }
      applyLayout(next);
    },
    [applyLayout],
  );

  const undo = useCallback(() => {
    if (historyPast.length === 0) {
      return;
    }
    const previous = historyPast[historyPast.length - 1]!;
    setHistoryPast((past) => past.slice(0, -1));
    setHistoryFuture((future) => [layoutDraftRef.current, ...future]);
    applyLayout(previous);
  }, [applyLayout, historyPast]);

  const redo = useCallback(() => {
    if (historyFuture.length === 0) {
      return;
    }
    const next = historyFuture[0]!;
    setHistoryFuture((future) => future.slice(1));
    setHistoryPast((past) => [...past, layoutDraftRef.current]);
    applyLayout(next);
  }, [applyLayout, historyFuture]);

  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  useEffect(() => {
    if (!isActive || !editable) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        if (historyPast.length === 0) {
          return;
        }
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        if (historyFuture.length === 0) {
          return;
        }
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editable, historyFuture.length, historyPast.length, isActive, redo, undo]);

  const saveToTemplate = useCallback(async () => {
    if (!binding) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    patchAssetLayoutToStudioStore(
      patchBrandingPath,
      patchSystemPath,
      binding,
      layoutDraft,
    );

    try {
      const ok = await saveLayoutToDisk();
      if (!ok) {
        setSaveError(
          projectMode
            ? "Could not save layout to project."
            : "Could not save layout to template.",
        );
        return;
      }

      setSavedLayout(assetBindingKey(binding), layoutDraft);
      setSaveMessage(
        projectMode
          ? "Saved layout to project client.json"
          : `Saved to apps/game-engine/src/templates/library/${selectedTemplateId}/public/config.json`,
      );
    } catch {
      setSaveError(
        "Could not reach the save API. Run the dashboard locally to write files.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    binding,
    layoutDraft,
    patchBrandingPath,
    patchSystemPath,
    projectMode,
    saveLayoutToDisk,
    selectedTemplateId,
    setSavedLayout,
  ]);

  const setHitbox = (patch: Partial<NonNullable<DevToolkitAssetLayout["hitbox"]>>) => {
    commitLayout({
      ...layoutDraft,
      hitbox: { width: 1, height: 1, ...layoutDraft.hitbox, ...patch },
    });
  };

  const setCenter = (patch: Partial<NonNullable<DevToolkitAssetLayout["centerOffset"]>>) => {
    commitLayout({
      ...layoutDraft,
      centerOffset: { x: 0, y: 0, ...layoutDraft.centerOffset, ...patch },
    });
  };

  const setAnchor = (patch: Partial<NonNullable<DevToolkitAssetLayout["rotationAnchor"]>>) => {
    const nextAnchor = { x: 0.5, y: 0.5, ...layoutDraft.rotationAnchor, ...patch };
    commitLayout({
      ...layoutDraft,
      rotationAnchor: nextAnchor,
      origin: nextAnchor,
    });
  };

  if (!editable) {
    return (
      <section className="shrink-0 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
        Layout editing is available for catch-game items picked in the preview. Use
        Dev Toolkit toggles (hitboxes, origins, pivots) for other sprites.
      </section>
    );
  }

  return (
    <section className="shrink-0 space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">Layout</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo layout change"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo layout change"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Redo
          </button>
          <button
            type="button"
            onClick={() => void saveToTemplate()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-800 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            {saving ? "Saving…" : "Save to template"}
          </button>
          <div className="flex flex-wrap gap-2 text-[11px]">
          <OverlayToggle
            label="Hitbox"
            checked={overlays.hitbox}
            onChange={(hitbox) => onOverlaysChange({ ...overlays, hitbox })}
          />
          <OverlayToggle
            label="Anchor"
            checked={overlays.anchor}
            onChange={(anchor) => onOverlaysChange({ ...overlays, anchor })}
          />
          <OverlayToggle
            label="Origin"
            checked={overlays.origin}
            onChange={(origin) => onOverlaysChange({ ...overlays, origin })}
          />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FieldGroup title="Hitbox">
          <NumberField
            label="Width"
            value={layoutDraft.hitbox?.width ?? 1}
            step={0.05}
            min={0.05}
            max={2}
            onChange={(width) => setHitbox({ width })}
          />
          <NumberField
            label="Height"
            value={layoutDraft.hitbox?.height ?? 1}
            step={0.05}
            min={0.05}
            max={2}
            onChange={(height) => setHitbox({ height })}
          />
          <NumberField
            label="Offset X"
            value={layoutDraft.hitbox?.offsetX ?? (1 - (layoutDraft.hitbox?.width ?? 1)) / 2}
            step={0.01}
            min={0}
            max={1}
            onChange={(offsetX) => setHitbox({ offsetX })}
          />
          <NumberField
            label="Offset Y"
            value={layoutDraft.hitbox?.offsetY ?? (1 - (layoutDraft.hitbox?.height ?? 1)) / 2}
            step={0.01}
            min={0}
            max={1}
            onChange={(offsetY) => setHitbox({ offsetY })}
          />
        </FieldGroup>

        <FieldGroup title="Rotation anchor">
          <NumberField
            label="X"
            value={layoutDraft.rotationAnchor?.x ?? 0.5}
            step={0.01}
            min={0}
            max={1}
            onChange={(x) => setAnchor({ x })}
          />
          <NumberField
            label="Y"
            value={layoutDraft.rotationAnchor?.y ?? 0.5}
            step={0.01}
            min={0}
            max={1}
            onChange={(y) => setAnchor({ y })}
          />
        </FieldGroup>

        <FieldGroup title="Center offset">
          <NumberField
            label="X"
            value={layoutDraft.centerOffset?.x ?? 0}
            step={0.01}
            min={-1}
            max={1}
            onChange={(x) => setCenter({ x })}
          />
          <NumberField
            label="Y"
            value={layoutDraft.centerOffset?.y ?? 0}
            step={0.01}
            min={-1}
            max={1}
            onChange={(y) => setCenter({ y })}
          />
        </FieldGroup>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Edits update the live preview immediately.{" "}
        <span className="font-medium text-zinc-700">Undo</span> or{" "}
        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px]">
          Ctrl+Z
        </kbd>{" "}
        reverts layout steps;{" "}
        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px]">
          Ctrl+Shift+Z
        </kbd>{" "}
        redoes. Use <span className="font-medium text-zinc-700">Save to template</span>{" "}
        to write values into{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">
          public/config.json
        </code>
        .
      </p>
      {saveMessage ? (
        <p className="text-[11px] text-emerald-700" role="status">
          {saveMessage}
        </p>
      ) : null}
      {saveError ? (
        <p className="text-[11px] text-red-600" role="alert">
          {saveError}
        </p>
      ) : null}
    </section>
  );
}

function OverlayToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-200 px-2 py-1">
      <input
        type="checkbox"
        className="h-3 w-3 accent-indigo-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-zinc-600">{label}</span>
    </label>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-zinc-600">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="rounded-md border border-zinc-200 px-2 py-1 font-mono text-xs text-zinc-900"
      />
    </label>
  );
}
