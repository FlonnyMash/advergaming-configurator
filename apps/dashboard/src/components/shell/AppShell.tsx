"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { BrandMarkHomeLink } from "@/components/shell/BrandMarkHomeLink";
import { PersistentWorkspaces } from "@/components/shell/PersistentWorkspaces";
import {
  configuratorWorkspaceHref,
  rehydrateWorkspaceSessionFromStorage,
  studioWorkspaceHref,
  useWorkspaceSessionStore,
} from "@/lib/workspace-session-store";
import { usePlatformStore } from "@/store/usePlatformStore";
import { Lock } from "lucide-react";

const navLinkClass = (active: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? "text-white shadow-sm"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
  }`;

export function AppShell({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    rehydrateWorkspaceSessionFromStorage();
  }, []);

  const pathname = usePathname();
  const isStudio = pathname.startsWith("/studio");
  const isConfigurator = pathname.startsWith("/configurator");
  const primaryColor = usePlatformStore((s) => s.primaryColor);
  const enableLeadGen = usePlatformStore((s) => s.features.enableLeadGen);
  const activeStudioTemplateId = useWorkspaceSessionStore(
    (s) => s.activeStudioTemplateId,
  );
  const activeConfiguratorProjectId = useWorkspaceSessionStore(
    (s) => s.activeConfiguratorProjectId,
  );
  const studioHref = studioWorkspaceHref(activeStudioTemplateId);
  const configuratorHref = configuratorWorkspaceHref(activeConfiguratorProjectId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <BrandMarkHomeLink />
          <nav
            className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1"
            aria-label="Environment"
          >
            <Link
              href={studioHref}
              className={navLinkClass(isStudio)}
              style={
                isStudio
                  ? { backgroundColor: primaryColor }
                  : undefined
              }
            >
              Studio
            </Link>
            <Link
              href={configuratorHref}
              className={navLinkClass(isConfigurator)}
              style={
                isConfigurator
                  ? { backgroundColor: primaryColor }
                  : undefined
              }
            >
              Configurator
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!enableLeadGen}
            title={
              enableLeadGen
                ? "Lead generation"
                : "Upgrade your license to enable lead generation"
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              enableLeadGen
                ? "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                : "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400 opacity-50"
            }`}
          >
            {!enableLeadGen ? (
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : null}
            Lead Generation
          </button>
          <p className="hidden text-xs text-zinc-500 sm:block">
            {isStudio
              ? "Build mechanics & publish templates"
              : "White-label branding for clients"}
          </p>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PersistentWorkspaces>{children}</PersistentWorkspaces>
      </main>
    </div>
  );
}
