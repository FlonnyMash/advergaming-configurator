"use client";

import { gameEngineOrigin } from "@/bridge/messenger";
import { useGameChromeOverlayStore } from "@/lib/game-chrome-overlay-store";
import {
  DEFAULT_DEV_TOOLKIT_FLAGS,
  DEV_TOOLKIT_BRIDGE_EVENTS,
  parseDevToolkitFlags,
  type DevToolkitFlags,
} from "@advergaming/shared";
import { useStudioConfigStore } from "@advergaming/studio-engine";
import { ChevronDown, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const FLAG_LABELS: { key: keyof DevToolkitFlags; label: string }[] = [
  { key: "hitboxes", label: "hitboxes" },
  { key: "origins", label: "origins" },
  { key: "pivots", label: "pivots" },
  { key: "physicsDebug", label: "physicsDebug" },
  { key: "freeze", label: "freeze" },
];

export function DevToolkitMenu() {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<DevToolkitFlags>(DEFAULT_DEV_TOOLKIT_FLAGS);
  const menuRef = useRef<HTMLDivElement>(null);
  const messenger = useGameChromeOverlayStore((state) => state.messenger);
  const selectedTemplateId = useStudioConfigStore(
    (state) => state.selectedTemplateId,
  );

  const sendFlags = useCallback(
    (patch: Partial<DevToolkitFlags>) => {
      messenger?.sendGameEvent(DEV_TOOLKIT_BRIDGE_EVENTS.SET_FLAGS, patch);
    },
    [messenger],
  );

  const resetFlags = useCallback(() => {
    setFlags(DEFAULT_DEV_TOOLKIT_FLAGS);
    sendFlags(DEFAULT_DEV_TOOLKIT_FLAGS);
  }, [sendFlags]);

  useEffect(() => {
    resetFlags();
  }, [selectedTemplateId, resetFlags]);

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin !== gameEngineOrigin) return;

      const data = event.data;
      if (
        typeof data !== "object" ||
        data === null ||
        (data as { type?: string }).type !== "GAME_EVENT"
      ) {
        return;
      }

      const record = data as { eventName?: string; data?: unknown };
      if (record.eventName !== DEV_TOOLKIT_BRIDGE_EVENTS.STATE) {
        return;
      }

      const next = parseDevToolkitFlags(record.data);
      if (next) {
        setFlags(next);
      }
    };

    window.addEventListener("message", onWindowMessage);
    return () => window.removeEventListener("message", onWindowMessage);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onToggle = (key: keyof DevToolkitFlags, checked: boolean) => {
    setFlags((current) => ({ ...current, [key]: checked }));
    sendFlags({ [key]: checked });
  };

  const activeCount = FLAG_LABELS.filter(({ key }) => flags[key]).length;

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <Wrench className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
        <span>Dev Toolkit</span>
        {activeCount > 0 ? (
          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
            {activeCount}
          </span>
        ) : null}
        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-900 shadow-xl">
          <p className="mb-2 font-semibold uppercase tracking-wide text-zinc-500">
            Debug overlays
          </p>
          <div className="space-y-1.5">
            {FLAG_LABELS.map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-zinc-50"
              >
                <span className="text-zinc-700">{label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-indigo-600"
                  checked={flags[key]}
                  onChange={(event) => onToggle(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
