"use client";

import { useEffect, useRef, useState } from "react";
import { ProfilePanel } from "@/components/auth/ProfilePanel";
import { useAuthStore } from "@/store/useAuthStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the uppercase first character of the email local-part. */
function getInitials(email: string | null): string {
  if (!email) return "?";
  return email[0].toUpperCase();
}

// ---------------------------------------------------------------------------
// UserMenu
// ---------------------------------------------------------------------------

/**
 * Avatar button that toggles a floating panel containing the full ProfilePanel.
 *
 * Closes on:
 *   - Click / tap outside the popover
 *   - Escape key
 *   - User becoming unauthenticated (logout redirect)
 *
 * Only rendered when the user is authenticated — callers don't need to guard.
 */
export function UserMenu() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const email = useAuthStore((s) => s.email);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-close when the user logs out (AuthGuard will redirect, but this
  // snaps the popover shut immediately before navigation completes).
  useEffect(() => {
    if (!isAuthenticated) setOpen(false);
  }, [isAuthenticated]);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Don't render anything for unauthenticated users.
  if (!isAuthenticated) return null;

  const initials = getInitials(email);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`User menu — ${email ?? "account"}`}
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center rounded-full
          border border-zinc-200 bg-zinc-100
          text-xs font-semibold text-zinc-700
          transition-colors
          hover:border-zinc-300 hover:bg-zinc-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2
          ${open ? "border-zinc-300 bg-zinc-200" : ""}
        `}
      >
        {initials}
      </button>

      {/* Popover */}
      {open ? (
        <div
          role="dialog"
          aria-label="User profile"
          className="
            absolute right-0 top-full z-50
            mt-2
            w-max
            animate-popover-in
          "
        >
          {/*
            ProfilePanel is fully self-contained — it manages its own fetch,
            skeleton, error, and logout states. No props needed.
          */}
          <ProfilePanel />
        </div>
      ) : null}
    </div>
  );
}
