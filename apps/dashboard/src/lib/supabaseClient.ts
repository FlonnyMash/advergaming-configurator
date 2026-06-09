import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// ---------------------------------------------------------------------------
// Re-export helper types so call-sites never need to import from two places.
// ---------------------------------------------------------------------------

export type { Database };

/** A fully-typed row from any public table. Usage: Tables<"profiles"> */
export type { Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database.types";

// ---------------------------------------------------------------------------
// Singleton anon client — safe for browser / React Server Components.
// Uses NEXT_PUBLIC_* vars only; never touches the service-role key.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to apps/dashboard/.env.local.",
  );
}

// Derive the project ref from the Supabase URL (e.g. "abcdefghij" from
// "https://abcdefghij.supabase.co") and lock it as the localStorage key.
// This matches the supabase-js v2 default (`sb-<ref>-auth-token`) and is set
// explicitly so the key stays stable if the URL ever changes between
// environments (dev/staging/prod) — a silent key change would cause the
// client to boot without a session.
//
// Electron context: the renderer's Supabase client is intentionally anonymous
// (tokens live in the main process via safeStorage). `persistSession: true`
// is a no-op there because auth state is never written to localStorage from
// the renderer — it's fine to leave on.
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

// Explicit localStorage adapter — no auto-detection.
// @supabase/ssr's createBrowserClient is intentionally NOT used here because:
//   1. It uses cookie-based storage, not localStorage, which would break
//      existing sessions and require server-side middleware.
//   2. This app is entirely client-side ("use client") and has no SSR auth flow.
// window.localStorage is always available at this call-site because this module
// is only ever imported from client components (it has no "server" export path).
const browserStorage =
  typeof window !== "undefined" ? window.localStorage : undefined;

const createSupabaseClient = () =>
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Web: persists the session to localStorage under `storageKey`.
      // Electron: no-op — the renderer never holds a live session.
      persistSession: true,
      autoRefreshToken: true,
      // Picks up tokens from the URL fragment after email-confirmation links.
      detectSessionInUrl: true,
      storageKey: `sb-${projectRef}-auth-token`,
      // Explicit adapter — no reliance on Supabase's internal environment sniffing.
      storage: browserStorage,
    },
  });

// Avoid creating multiple GoTrue clients in the same browser context.
// Multiple instances with one storage key can race and produce inconsistent
// auth state (hidden profile UI, dropped refreshes, transient 401s).
const globalForSupabase = globalThis as typeof globalThis & {
  __mashedgamesSupabase?: ReturnType<typeof createSupabaseClient>;
};

export const supabase =
  globalForSupabase.__mashedgamesSupabase ?? createSupabaseClient();

if (!globalForSupabase.__mashedgamesSupabase) {
  globalForSupabase.__mashedgamesSupabase = supabase;
}
