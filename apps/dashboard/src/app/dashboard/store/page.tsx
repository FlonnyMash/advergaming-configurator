"use client";

import { TemplateStorefront } from "@/components/store/TemplateStorefront";
import Link from "next/link";

export default function StorePage() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto p-8">
      <header className="mb-8">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-800">
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Game Templates
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Browse all available game templates. Owned games can be opened
          directly in the engine — locked ones can be unlocked by contacting
          your account manager.
        </p>
      </header>

      <TemplateStorefront />
    </div>
  );
}
