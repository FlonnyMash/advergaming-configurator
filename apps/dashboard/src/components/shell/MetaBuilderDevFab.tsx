"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const MetaBuilderPanel = dynamic(
  () =>
    import("@/components/meta-builder/MetaBuilderPanel").then((m) => m.MetaBuilderPanel),
  { ssr: false },
);

export function MetaBuilderDevFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const hideOnMetaBuilderPage = pathname.startsWith("/meta-builder");

  useEffect(() => {
    if (open) {
      setPanelMounted(true);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (hideOnMetaBuilderPage) {
    return null;
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close Meta-Builder"
          className="fixed inset-0 z-[9998] cursor-default bg-black/25"
          onClick={close}
        />
      ) : null}

      <aside
        id="meta-builder-dev-panel"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[9999] flex w-full max-w-md flex-col border-l border-zinc-200 bg-zinc-50 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Meta-Builder</h2>
            <p className="text-xs text-zinc-500">Platform branding &amp; license flags</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {panelMounted ? <MetaBuilderPanel /> : null}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="meta-builder-dev-panel"
        title={open ? "Close Meta-Builder" : "Open Meta-Builder"}
        className={`fixed bottom-4 right-4 z-[10000] flex items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg ring-1 ring-black/10 transition-all duration-300 hover:bg-zinc-800 ${
          open
            ? "h-9 w-9"
            : "h-9 w-9 hover:scale-105"
        }`}
      >
        {open ? (
          <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="text-sm font-bold leading-none" aria-hidden>
            M
          </span>
        )}
        <span className="sr-only">Meta-Builder</span>
      </button>
    </>
  );
}
