"use client";

import { notFound } from "next/navigation";
import { STUDIO_MODE_ENABLED } from "@/lib/studio-mode";

export default function StudioDevToolsPage() {
  if (!STUDIO_MODE_ENABLED) notFound();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8">
      <p className="max-w-md text-center text-sm text-zinc-600">
        Studio dev toolkit was removed in the architectural reset. Use the flat
        configuration sidebar in Studio instead.
      </p>
    </div>
  );
}
