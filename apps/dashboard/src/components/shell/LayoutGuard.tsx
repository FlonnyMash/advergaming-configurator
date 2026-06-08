"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";

// Routes that are rendered without the AppShell chrome and without auth checks.
const PUBLIC_PATHS = new Set(["/login"]);

/**
 * Top-level layout switch used by the root layout.
 *
 * - Public routes (/login): render children as-is — no AppShell, no auth.
 * - All other routes: wrap children in AuthGuard → AppShell, so the session
 *   is validated before any protected content is shown.
 */
export function LayoutGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
