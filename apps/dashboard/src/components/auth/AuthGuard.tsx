"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Enums } from "@/lib/supabaseClient";
import { isStudioMode } from "@/lib/app-mode";
import { useAuthStore } from "@/store/useAuthStore";

type UserRole = Enums<"user_role">;

// Role required for this build mode. null = no restriction.
const REQUIRED_ROLE: UserRole | null = isStudioMode() ? "studio_admin" : null;

type GuardStatus = "loading" | "authenticated" | "redirecting";

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div
      className="flex h-full min-h-dvh items-center justify-center bg-zinc-50"
      aria-label="Checking session…"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthGuard
// ---------------------------------------------------------------------------

/**
 * Dual-path session guard:
 *
 * - Web context: subscribes to `supabase.auth.onAuthStateChange`. On sign-in
 *   it fetches the user's role from `public.profiles` and syncs it into the
 *   store. On sign-out it redirects to /login.
 *
 * - Electron context: calls `syncAuthStatus()` (IPC) once on mount. Role and
 *   userId remain null in Electron because the session tokens live entirely in
 *   the main process and the renderer's anon client has no authenticated
 *   session.
 *
 * Shows a spinner while the initial session state is being resolved to
 * prevent a flash of protected content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<GuardStatus>("loading");
  const setSession = useAuthStore((s) => s.setSession);
  const syncAuthStatus = useAuthStore((s) => s.syncAuthStatus);
  // Track whether the component is still mounted to avoid state updates after
  // unmount (e.g. if the user navigates away during the async profile fetch).
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // ------------------------------------------------------------------
    // Detect runtime context
    // ------------------------------------------------------------------
    const isElectron =
      typeof window !== "undefined" &&
      !!(window as Window & { electron?: { ipcRenderer?: unknown } }).electron
        ?.ipcRenderer;

    // ------------------------------------------------------------------
    // Electron path: delegate to IPC-based syncAuthStatus
    // ------------------------------------------------------------------
    if (isElectron) {
      syncAuthStatus().then(() => {
        if (!mountedRef.current) return;
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
          setStatus("authenticated");
        } else {
          setStatus("redirecting");
          router.replace("/login");
        }
      });
      return () => {
        mountedRef.current = false;
      };
    }

    // ------------------------------------------------------------------
    // Web path: Supabase onAuthStateChange
    // ------------------------------------------------------------------
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      if (session?.user) {
        // Fetch the user's role from public.profiles.
        // RLS allows a user to SELECT their own row once the session is active.
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!mountedRef.current) return;

        if (profileError) {
          console.error("[AuthGuard] Profile fetch error:", JSON.stringify(profileError));
        }

        const role = (profile?.role ?? null) as Enums<"user_role"> | null;

        // Role-gate: if this build mode requires a specific role and the user
        // doesn't have it, sign them out and send them back to /login.
        if (REQUIRED_ROLE && role !== REQUIRED_ROLE) {
          console.warn(
            `[AuthGuard] Role mismatch — required "${REQUIRED_ROLE}", got "${role ?? "null"}". Signing out.`,
          );
          await supabase.auth.signOut();
          setSession({ isAuthenticated: false, email: null, userId: null, role: null });
          setStatus("redirecting");
          router.replace("/login?error=access_denied");
          return;
        }

        setSession({
          isAuthenticated: true,
          email: session.user.email ?? null,
          userId: session.user.id,
          role,
        });
        setStatus("authenticated");
      } else {
        setSession({
          isAuthenticated: false,
          email: null,
          userId: null,
          role: null,
        });
        setStatus("redirecting");
        router.replace("/login");
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [router, setSession, syncAuthStatus]);

  if (status === "loading" || status === "redirecting") {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
