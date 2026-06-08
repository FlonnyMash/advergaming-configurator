"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { canBrowseStoreWithoutAuth } from "@/lib/dev-store-access";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/useAuthStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateRow = Tables<"templates">;

type ManifestShape = {
  displayName?: string;
  description?: string;
  image_url?: string;
};

type EnrichedTemplate = TemplateRow & { isLicensed: boolean };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseManifest(manifest: unknown): ManifestShape {
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    return manifest as ManifestShape;
  }
  return {};
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Tier badge config
// ---------------------------------------------------------------------------

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  free: {
    label: "Free",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  premium: {
    label: "Premium",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  enterprise: {
    label: "Enterprise",
    cls: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="h-40 bg-zinc-100" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 rounded bg-zinc-200" />
        <div className="h-3 w-full rounded bg-zinc-100" />
        <div className="h-3 w-2/3 rounded bg-zinc-100" />
        <div className="mt-4 h-8 w-full rounded-lg bg-zinc-200" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

function TemplateCard({ template }: { template: EnrichedTemplate }) {
  const manifest = parseManifest(template.manifest);
  const displayName = manifest.displayName ?? slugToTitle(template.template_slug);
  const description = manifest.description ?? null;
  const imageUrl = manifest.image_url ?? null;
  const tierInfo = TIER_BADGE[template.tier] ?? TIER_BADGE.premium;

  function handleUnlock() {
    toast.info("Contact Mashed Games Studio to unlock access.", {
      description:
        "Reach out to your account manager or visit mashedgames.com to upgrade your plan or purchase this template.",
      duration: 7000,
    });
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        template.isLicensed ? "border-zinc-200" : "border-zinc-200"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative h-40 w-full overflow-hidden bg-zinc-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-zinc-300">
              <svg
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
              <span className="text-xs font-mono">{template.template_slug}</span>
            </div>
          </div>
        )}

        {/* Lock overlay for unlicensed templates */}
        {!template.isLicensed && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/25 backdrop-blur-[1px]">
            <div className="rounded-full bg-white/20 p-2">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-zinc-900">
            {displayName}
          </h3>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {template.isLicensed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Owned
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Locked
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tierInfo.cls}`}
            >
              {tierInfo.label}
            </span>
          </div>
        </div>

        {description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {description}
          </p>
        ) : (
          <p className="text-xs text-zinc-400">v{template.version}</p>
        )}

        <div className="mt-auto pt-3">
          {template.isLicensed ? (
            <button
              type="button"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              Open in Engine
            </button>
          ) : (
            <button
              type="button"
              onClick={handleUnlock}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
            >
              Unlock / Request Access
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main storefront component
// ---------------------------------------------------------------------------

export function TemplateStorefront() {
  const userId = useAuthStore((s) => s.userId);
  const devStorePreview = canBrowseStoreWithoutAuth();
  const [templates, setTemplates] = useState<EnrichedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId && !devStorePreview) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTemplatesCatalog() {
      const templatesResult = await supabase
        .from("templates")
        .select(
          "id, template_slug, tier, version, manifest, published_at, is_latest, storage_key, checksum, bundle_signature, yanked",
        )
        .eq("is_latest", true)
        .eq("yanked", false)
        .order("published_at", { ascending: false });

      if (templatesResult.error) {
        throw templatesResult.error;
      }

      return templatesResult.data ?? [];
    }

    async function loadLicensedTemplateIds(activeUserId: string) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", activeUserId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const organizationId = profile?.organization_id ?? null;
      if (!organizationId) {
        return new Set<string>();
      }

      const { data: licenses, error: licensesError } = await supabase
        .from("licenses")
        .select("template_id, valid_until")
        .eq("organization_id", organizationId);

      if (licensesError) {
        throw licensesError;
      }

      const now = new Date();
      return new Set(
        (licenses ?? [])
          .filter(
            (license) =>
              license.valid_until === null ||
              new Date(license.valid_until) > now,
          )
          .map((license) => license.template_id),
      );
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const catalog = await loadTemplatesCatalog();
        const activeLicensedIds = userId
          ? await loadLicensedTemplateIds(userId)
          : new Set<string>();

        const enriched: EnrichedTemplate[] = catalog.map((template) => ({
          ...template,
          isLicensed: activeLicensedIds.has(template.id),
        }));

        if (!cancelled) {
          setTemplates(enriched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load templates.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [devStorePreview, userId]);

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">Failed to load templates</p>
        <p className="mt-1 text-xs text-red-500">{error}</p>
      </div>
    );
  }

  // --- Unauthenticated (production only) ---
  if (!userId && !devStorePreview) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-12 text-center">
        <p className="text-sm font-medium text-zinc-600">Sign in to view templates</p>
      </div>
    );
  }

  // --- Empty state ---
  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-12 text-center">
        <p className="text-sm font-medium text-zinc-600">No templates available</p>
        <p className="mt-1 text-xs text-zinc-400">
          Templates published by Mashed Games Studio will appear here.
        </p>
      </div>
    );
  }

  const owned = templates.filter((t) => t.isLicensed);
  const available = templates.filter((t) => !t.isLicensed);

  return (
    <div className="space-y-10">
      {owned.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your Games
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {owned.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-500">
              Available to Unlock
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              {available.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
