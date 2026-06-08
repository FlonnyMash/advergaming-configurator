import Link from "next/link";
import { BrandMark } from "@/components/shell/BrandMark";
import { STUDIO_MODE_ENABLED } from "@/lib/studio-mode";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-md text-center">
        <div className="flex justify-center">
          <BrandMark size="lg" linkHome={false} layout="stacked" />
        </div>
        <p className="mt-4 text-sm text-zinc-600">
          Browse licensed game templates, or open an environment to edit and
          preview.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/dashboard/store"
          className="rounded-xl border border-zinc-200 bg-white px-8 py-4 text-center shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="block text-sm font-semibold text-zinc-900">
            Template Store
          </span>
          <span className="mt-1 block text-xs text-zinc-500">
            Browse owned & available games
          </span>
        </Link>
        {STUDIO_MODE_ENABLED ? (
          <Link
            href="/studio/templates"
            className="rounded-xl border border-zinc-200 bg-white px-8 py-4 text-center shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="block text-sm font-semibold text-zinc-900">
              Studio
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              Mechanics, templates, dev tools
            </span>
          </Link>
        ) : null}
        <Link
          href="/configurator/projects"
          className="rounded-xl border border-zinc-200 bg-white px-8 py-4 text-center shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="block text-sm font-semibold text-zinc-900">
            Configurator
          </span>
          <span className="mt-1 block text-xs text-zinc-500">
            Client projects & branding
          </span>
        </Link>
      </div>
    </div>
  );
}
