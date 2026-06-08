"use client";

import type { Enums } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/useAuthStore";

type Props = {
  allow: Enums<"user_role">;
  children: React.ReactNode;
};

/**
 * Renders children only when the authenticated user's role matches `allow`.
 * Returns null in all other cases — unauthenticated, wrong role, or Electron
 * context where role is not resolved.
 */
export function RoleGate({ allow, children }: Props) {
  const role = useAuthStore((s) => s.role);
  return role === allow ? <>{children}</> : null;
}
