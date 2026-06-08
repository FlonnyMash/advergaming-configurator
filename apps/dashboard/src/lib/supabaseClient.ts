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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
