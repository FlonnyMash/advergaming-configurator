"use client";

import {
  useDevToolkitBridge,
  useDevToolkitControls,
} from "@/hooks/useDevToolkitBridge";
import { openDevToolsPopout } from "@/lib/dev-toolkit-sync";
import type { DevToolkitFlags } from "@mashedgames/shared";
import { ExternalLink, RotateCcw } from "lucide-react";

const FLAG_LABELS: {
  key: keyof DevToolkitFlags;
  label: string;
  hint?: string;
}[] = [
  { key: "hitboxes", label: "Hitboxes" },
  { key: "origins", label: "Origins" },
  { key: "pivots", label: "Pivots" },
  { key: "physicsDebug", label: "Physics debug" },
  { key: "freeze", label: "Freeze game" },
  {
    key: "assetPicker",
    label: "Asset picker",
    hint: "Click sprites in the preview to inspect textures",
  },
];

export interface DevToolkitPanelProps {
  relayToGame?: boolean;
  showPopoutButton?: boolean;
  compact?: boolean;
}

export function DevToolkitPanel({
  relayToGame = true,
  showPopoutButton = true,
  compact = false,
}: DevToolkitPanelProps) {
  if (relayToGame) {
    return (
      <DevToolkitPanelView
        compact={compact}
        showPopoutButton={showPopoutButton}
        useBridge={useDevToolkitControls}
      />
    );
  }

  return (
    <PopoutDevToolkitPanel compact={compact} showPopoutButton={showPopoutButton} />
  );
}

function PopoutDevToolkitPanel({
  compact = false,
  showPopoutButton = true,
}: Pick<DevToolkitPanelProps, "compact" | "showPopoutButton">) {
  const bridge = useDevToolkitBridge({ relayToGame: false });
  return (
    <DevToolkitPanelView
      compact={compact}
      showPopoutButton={showPopoutButton}
      useBridge={() => bridge}
    />
  );
}

function DevToolkitPanelView({
  compact,
  showPopoutButton,
  useBridge,
}: {
  compact: boolean;
  showPopoutButton: boolean;
  useBridge: () => {
    flags: DevToolkitFlags;
    sendFlags: (patch: Partial<DevToolkitFlags>) => void;
    resetFlags: () => void;
  };
}) {
  const { flags, sendFlags, resetFlags } = useBridge();

  const activeCount = FLAG_LABELS.filter(({ key }) => flags[key]).length;

  const onToggle = (key: keyof DevToolkitFlags, checked: boolean) => {
    sendFlags({ [key]: checked });
  };

  return (
    <div className={compact ? "space-y-4" : "flex h-full flex-col"}>
      <div
        className={
          compact
            ? "space-y-3"
            : "flex items-start justify-between gap-3 border-b border-zinc-200 px-1 pb-4"
        }
      >
        <div className="min-w-0">
          <h2
            className={
              compact
                ? "text-sm font-semibold text-zinc-900"
                : "text-lg font-semibold text-zinc-900"
            }
          >
            Dev Toolkit
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Debug overlays and asset inspection for the game preview
          </p>
          {activeCount > 0 ? (
            <p className="mt-1 text-[11px] font-medium text-indigo-600">
              {activeCount} tool{activeCount === 1 ? "" : "s"} active
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={resetFlags}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            title="Reset all dev tools"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
          {showPopoutButton ? (
            <button
              type="button"
              onClick={() => openDevToolsPopout()}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
              title="Open dev tools in a separate window"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Pop out
            </button>
          ) : null}
        </div>
      </div>

      <div className={compact ? "space-y-4" : "flex-1 space-y-6 overflow-y-auto py-1"}>
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Debug overlays
          </p>
          <div className="space-y-1">
            {FLAG_LABELS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-zinc-800">{label}</span>
                  {hint ? (
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {hint}
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                  checked={flags[key]}
                  onChange={(event) => onToggle(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </section>

        {flags.assetPicker ? (
          <p className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-3 text-[11px] leading-relaxed text-indigo-800">
            Click sprites in the game preview — each opens a new center workspace
            tab (switch between them at the top).
          </p>
        ) : null}
      </div>
    </div>
  );
}
