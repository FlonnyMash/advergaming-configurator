import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Advergaming Platform
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Choose an environment to open the live editor and game preview.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/studio"
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
          href="/configurator"
          className="rounded-xl border border-zinc-200 bg-white px-8 py-4 text-center shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="block text-sm font-semibold text-zinc-900">
            Configurator
          </span>
          <span className="mt-1 block text-xs text-zinc-500">
            Client branding & diagnostics
          </span>
        </Link>
      </div>
    </div>
  );
}
