"use client";

import { DevToolkitPanel } from "@/components/studio/DevToolkitPanel";
import { useDevToolkitStore } from "@/lib/dev-toolkit-store";
import { ChevronDown, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DevToolkitMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const flags = useDevToolkitStore((state) => state.flags);

  const activeCount = [
    flags.hitboxes,
    flags.origins,
    flags.pivots,
    flags.physicsDebug,
    flags.freeze,
    flags.assetPicker,
  ].filter(Boolean).length;

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
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(100vw-2rem,22rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
          <DevToolkitPanel compact showPopoutButton />
        </div>
      ) : null}
    </div>
  );
}
