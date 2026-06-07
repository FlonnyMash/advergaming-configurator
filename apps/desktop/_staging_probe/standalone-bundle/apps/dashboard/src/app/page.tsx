import Link from "next/link";
import { BrandMark } from "@/components/shell/BrandMark";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-md text-center">
        <div className="flex justify-center">
          <BrandMark size="lg" linkHome={false} />
        </div>
        <p className="mt-4 text-sm text-zinc-600">
          Choose an environment to open the live editor and game preview.
        </p>
      </div>
      <div className="flex gap-4">
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
