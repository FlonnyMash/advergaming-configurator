"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, LogOut, User } from "lucide-react";
import { supabase, type Tables } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/useAuthStore";
import { RoleGate } from "./RoleGate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrgRow = Pick<Tables<"organizations">, "name" | "plan">;

type FetchState =
  | { status: "loading" }
  | { status: "success"; org: OrgRow | null }
  | { status: "error" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_LABELS: Record<Tables<"organizations">["plan"], string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

const ROLE_LABELS: Record<Tables<"profiles">["role"], string> = {
  studio_admin: "Studio Admin",
  b2b_user: "Partner",
};

// ---------------------------------------------------------------------------
// Skeleton sub-component
// ---------------------------------------------------------------------------

function FieldSkeleton() {
  return <span className="inline-block h-4 w-28 animate-pulse rounded bg-zinc-200" />;
}

// ---------------------------------------------------------------------------
// ProfilePanel
// ---------------------------------------------------------------------------

/**
 * Displays authenticated user data: email, role, organisation name and plan.
 * Fetches organisation details on mount via a single profles→organizations join.
 * Renders a skeleton loader while fetching and an error state on failure.
 * Includes a Logout button and an Admin Panel link gated by RoleGate.
 *
 * Drop into any Sidebar or Header — the card is self-contained.
 */
export function ProfilePanel() {
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.userId);

  const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Fetch org on mount. Skip entirely when userId is null (Electron IPC path
  // where the session lives in main process and the anon client has no session).
  useEffect(() => {
    if (!userId) {
      setFetchState({ status: "success", org: null });
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("organizations(name, plan)")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[ProfilePanel] Failed to fetch organisation:", error);
        setFetchState({ status: "error" });
        return;
      }

      // The join returns organizations as a nested object or null.
      const raw = data?.organizations;
      const org: OrgRow | null =
        raw && !Array.isArray(raw) ? (raw as OrgRow) : null;

      setFetchState({ status: "success", org });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      // AuthGuard's onAuthStateChange subscription fires after signOut and
      // redirects to /login. Reset store state eagerly so UI reflects the
      // signed-out status immediately.
      useAuthStore.getState().setSession({
        isAuthenticated: false,
        email: null,
        userId: null,
        role: null,
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleRetry = () => {
    setFetchState({ status: "loading" });
    // Re-trigger effect by toggling a dummy dep isn't clean — instead just
    // re-run the fetch directly here.
    if (!userId) {
      setFetchState({ status: "success", org: null });
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("organizations(name, plan)")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[ProfilePanel] Retry: failed to fetch organisation:", error);
        setFetchState({ status: "error" });
        return;
      }

      const raw = data?.organizations;
      const org: OrgRow | null =
        raw && !Array.isArray(raw) ? (raw as OrgRow) : null;

      setFetchState({ status: "success", org });
    })();
  };

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const displayEmail = email ?? "—";
  const displayRole = role ? (ROLE_LABELS[role] ?? role) : "—";

  const isLoading = fetchState.status === "loading";
  const isError = fetchState.status === "error";
  const org = fetchState.status === "success" ? fetchState.org : null;

  const displayOrg = isLoading ? null : org?.name ?? "—";
  const displayPlan = isLoading
    ? null
    : org?.plan
      ? (PLAN_LABELS[org.plan] ?? org.plan)
      : "—";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full min-w-[260px] max-w-sm rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100">
          <User className="h-4 w-4 text-zinc-500" aria-hidden />
        </span>
        <span
          className="truncate text-sm font-medium text-zinc-900"
          title={displayEmail}
        >
          {displayEmail}
        </span>
      </div>

      {/* Error banner */}
      {isError ? (
        <div className="mx-5 mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs text-red-700">Failed to load profile.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="ml-3 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Fields */}
      <dl className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <dt className="shrink-0 text-xs font-medium text-zinc-500">Role</dt>
          <dd className="text-right text-xs text-zinc-800">{displayRole}</dd>
        </div>

        <div className="flex items-center justify-between gap-4">
          <dt className="shrink-0 text-xs font-medium text-zinc-500">Organisation</dt>
          <dd className="text-right text-xs text-zinc-800">
            {isLoading ? <FieldSkeleton /> : displayOrg}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-4">
          <dt className="shrink-0 text-xs font-medium text-zinc-500">Plan</dt>
          <dd className="text-right text-xs text-zinc-800">
            {isLoading ? <FieldSkeleton /> : displayPlan}
          </dd>
        </div>
      </dl>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-zinc-100 px-5 py-4">
        <RoleGate allow="studio_admin">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
          >
            Admin Panel
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </Link>
        </RoleGate>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoggingOut ? (
            <span
              className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-zinc-700"
              aria-hidden
            />
          ) : (
            <LogOut className="h-3 w-3 shrink-0" aria-hidden />
          )}
          {isLoggingOut ? "Signing out…" : "Log out"}
        </button>
      </div>
    </div>
  );
}
