"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinkClass = (active: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-indigo-600 text-white shadow-sm"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
  }`;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname.startsWith("/studio");
  const isConfigurator = pathname.startsWith("/configurator");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            Advergaming Platform
          </span>
          <nav
            className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1"
            aria-label="Environment"
          >
            <Link href="/studio" className={navLinkClass(isStudio)}>
              Studio
            </Link>
            <Link href="/configurator" className={navLinkClass(isConfigurator)}>
              Configurator
            </Link>
          </nav>
        </div>
        <p className="hidden text-xs text-zinc-500 sm:block">
          {isStudio
            ? "Build mechanics & publish templates"
            : "White-label branding for clients"}
        </p>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
