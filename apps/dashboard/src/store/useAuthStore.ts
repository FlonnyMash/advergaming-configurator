"use client";

import { getAuthStatusViaIpc, loginViaIpc, logoutViaIpc } from "@/lib/auth-ipc";
import type { Enums } from "@/lib/supabaseClient";
import { create } from "state";

type UserRole = Enums<"user_role">;

type AuthStore = {
  /** True when the user holds a valid session (Electron IPC or Supabase web). */
  isAuthenticated: boolean;
  /** Signed-in user's email address. Null when unauthenticated. */
  email: string | null;
  /**
   * Supabase auth user ID (UUID). Populated via the web auth path.
   * Null in Electron context until an IPC channel for user ID is added.
   */
  userId: string | null;
  /**
   * Role from public.profiles. Populated via the web auth path after the
   * profile row is fetched. Null in Electron context (tokens stay in main
   * process and the renderer's anon client has no authenticated session).
   */
  role: UserRole | null;
  /**
   * True while the store is waiting for an auth operation to complete
   * (IPC call, Supabase sign-in, or initial session check).
   */
  isLoading: boolean;

  // ---------------------------------------------------------------------------
  // Web auth path — called by AuthGuard via supabase.auth.onAuthStateChange
  // ---------------------------------------------------------------------------

  /**
   * Synchronises store state from a Supabase session event.
   * Called by AuthGuard whenever the Supabase client fires onAuthStateChange.
   * Never call this directly from UI — go through AuthGuard.
   */
  setSession: (params: {
    isAuthenticated: boolean;
    email: string | null;
    userId: string | null;
    role: UserRole | null;
  }) => void;

  // ---------------------------------------------------------------------------
  // Electron IPC auth path — delegates to the Electron main process
  // ---------------------------------------------------------------------------

  /**
   * Queries the Electron main process for the current auth state and updates
   * the store. Safe to call on every app boot — the main process has already
   * restored any persisted session before the renderer window opens.
   *
   * No-op (sets unauthenticated) when Electron is not present (web dev context).
   */
  syncAuthStatus: () => Promise<void>;

  /**
   * Sends login credentials to the Electron main process, which authenticates
   * via Supabase and persists the resulting tokens with safeStorage.
   * Tokens never reach this store — only the boolean result does.
   *
   * Returns an error string on failure, or null on success.
   * Returns a "desktop app only" message in a web dev context.
   */
  login: (email: string, password: string) => Promise<string | null>;

  /**
   * Signs out via the Electron main process, which clears the in-memory
   * session and deletes the encrypted token file from disk.
   */
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  email: null,
  userId: null,
  role: null,
  isLoading: false,

  setSession: ({ isAuthenticated, email, userId, role }) => {
    set({ isAuthenticated, email, userId, role });
  },

  syncAuthStatus: async () => {
    set({ isLoading: true });
    try {
      const status = await getAuthStatusViaIpc();
      if (status === null) {
        set({ isAuthenticated: false, email: null, userId: null, role: null, isLoading: false });
        return;
      }
      set({
        isAuthenticated: status.isAuthenticated,
        email: status.email,
        // userId and role remain null in Electron context — tokens live in main
        userId: null,
        role: null,
        isLoading: false,
      });
    } catch {
      set({ isAuthenticated: false, email: null, userId: null, role: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const status = await loginViaIpc(email, password);
      if (status === null) {
        set({ isLoading: false });
        return "Login is only available in the desktop app.";
      }
      set({
        isAuthenticated: status.isAuthenticated,
        email: status.email,
        userId: null,
        role: null,
        isLoading: false,
      });
      return status.error ?? null;
    } catch (err) {
      set({ isAuthenticated: false, email: null, userId: null, role: null, isLoading: false });
      return err instanceof Error ? err.message : "Login failed.";
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await logoutViaIpc();
    } finally {
      set({ isAuthenticated: false, email: null, userId: null, role: null, isLoading: false });
    }
  },
}));
