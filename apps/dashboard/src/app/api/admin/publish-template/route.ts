import { createClient } from "@supabase/supabase-js";
import { createHmac, createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { listTemplateOverviewFromDisk } from "@/lib/template-studio-meta";
import { gameEngineRoot } from "@/lib/template-library-root";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PublishRequest = {
  templateId: string;
  tier?: "free" | "premium" | "enterprise";
};

type PublishResponse =
  | { ok: true; templateRowId: string; version: string; storageKey: string }
  | { ok: false; error: string };

const VALID_TIERS = new Set<string>(["free", "premium", "enterprise"]);
const STORAGE_BUCKET = "template-bundles";

// ---------------------------------------------------------------------------
// Auth — same pattern as /api/admin/ref-data
// ---------------------------------------------------------------------------

async function verifyStudioAdmin(
  bearerToken: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ userId: string } | { error: string; status: number }> {
  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return { error: "Invalid or expired token.", status: 401 };
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "User profile not found.", status: 403 };
  }
  if (profile.role !== "studio_admin") {
    return { error: "Forbidden: studio_admin role required.", status: 403 };
  }

  return { userId: userData.user.id };
}

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

function bumpPatchVersion(version: string): string {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "1.0.1";
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

async function resolveNextVersion(
  serviceClient: ReturnType<typeof createClient<Database>>,
  templateSlug: string,
): Promise<string> {
  const { data } = await serviceClient
    .from("templates")
    .select("version")
    .eq("template_slug", templateSlug)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.version) return "1.0.0";
  return bumpPatchVersion(data.version);
}

// ---------------------------------------------------------------------------
// Bundle builder — packages the compiled game-engine dist as a JSON manifest
// ---------------------------------------------------------------------------

type BundleEntry = { path: string; sizeBytes: number };

function collectDistFiles(dir: string, base: string): BundleEntry[] {
  const entries: BundleEntry[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.join(base, name).replace(/\\/g, "/");
    const stat = statSync(full);
    if (stat.isDirectory()) {
      entries.push(...collectDistFiles(full, rel));
    } else {
      entries.push({ path: rel, sizeBytes: stat.size });
    }
  }
  return entries;
}

function buildEngineBundle(
  templateSlug: string,
  displayName: string,
): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  const distDir = path.join(gameEngineRoot, "dist");

  if (!existsSync(distDir)) {
    return {
      ok: false,
      error:
        "Game engine dist not found. Run `pnpm build` inside apps/game-engine first.",
    };
  }

  // Read index.html to capture the entry point and asset references.
  const indexPath = path.join(distDir, "index.html");
  const indexHtml = existsSync(indexPath)
    ? readFileSync(indexPath, "utf8")
    : null;

  const files = collectDistFiles(distDir, "");

  const manifest = {
    templateSlug,
    displayName,
    bundledAt: new Date().toISOString(),
    entrypoint: "index.html",
    files,
    indexHtml,
  };

  return { ok: true, buffer: Buffer.from(JSON.stringify(manifest), "utf8") };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json<PublishResponse>(
      { ok: false, error: "Server misconfiguration." },
      { status: 500 },
    );
  }

  // --- Auth ---
  const authHeader = request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!bearerToken) {
    return Response.json<PublishResponse>(
      { ok: false, error: "Authorization header with Bearer token required." },
      { status: 401 },
    );
  }

  const authResult = await verifyStudioAdmin(bearerToken, supabaseUrl, anonKey);
  if ("error" in authResult) {
    return Response.json<PublishResponse>(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }

  // --- Input ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json<PublishResponse>(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { templateId, tier = "free" } = (body ?? {}) as Partial<PublishRequest>;

  if (!templateId || typeof templateId !== "string") {
    return Response.json<PublishResponse>(
      { ok: false, error: "templateId is required." },
      { status: 400 },
    );
  }

  if (!VALID_TIERS.has(tier)) {
    return Response.json<PublishResponse>(
      { ok: false, error: 'tier must be "free", "premium", or "enterprise".' },
      { status: 400 },
    );
  }

  // Validate the templateId exists on disk.
  const knownTemplates = listTemplateOverviewFromDisk();
  const templateMeta = knownTemplates.find((t) => t.id === templateId);
  if (!templateMeta) {
    return Response.json<PublishResponse>(
      { ok: false, error: `Template "${templateId}" not found on disk.` },
      { status: 404 },
    );
  }

  // --- Build bundle ---
  // The "template" in this project is the compiled game-engine dist.
  // We package it as a JSON manifest pointing to the asset files so the
  // DRM runtime knows what to load without shipping the binaries themselves.
  const bundleResult = buildEngineBundle(templateId, templateMeta.displayName);
  if (!bundleResult.ok) {
    return Response.json<PublishResponse>(
      { ok: false, error: bundleResult.error },
      { status: 422 },
    );
  }

  const bundleBuffer = bundleResult.buffer;

  // Checksum: SHA-256 hex of the raw bundle bytes.
  const checksum = createHash("sha256").update(bundleBuffer).digest("hex");

  // Bundle signature: HMAC-SHA256 using the service role key as the signing
  // secret. Verifiable server-side; never exposed to clients.
  const bundleSignature = createHmac("sha256", serviceRoleKey)
    .update(bundleBuffer)
    .digest("hex");

  // --- Service-role client for DB + Storage ---
  const serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Determine version ---
  const version = await resolveNextVersion(serviceClient, templateId);
  const storageKey = `${templateId}/v${version}.json`;

  // --- Ensure bucket exists (create it if missing) ---
  const { data: buckets, error: listError } =
    await serviceClient.storage.listBuckets();

  if (!listError && !buckets?.find((b) => b.name === STORAGE_BUCKET)) {
    const { error: createError } = await serviceClient.storage.createBucket(
      STORAGE_BUCKET,
      { public: false },
    );
    if (createError) {
      console.error("[publish-template] Failed to create storage bucket:", createError);
      return Response.json<PublishResponse>(
        { ok: false, error: `Could not create storage bucket: ${createError.message}` },
        { status: 500 },
      );
    }
    console.info(`[publish-template] Created storage bucket "${STORAGE_BUCKET}".`);
  }

  // --- Upload to Supabase Storage ---
  const { error: uploadError } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, bundleBuffer, {
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) {
    console.error("[publish-template] Storage upload failed:", uploadError);
    return Response.json<PublishResponse>(
      { ok: false, error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // --- Mark previous latest as stale ---
  await serviceClient
    .from("templates")
    .update({ is_latest: false })
    .eq("template_slug", templateId)
    .eq("is_latest", true);

  // --- Insert new template row ---
  const manifest = {
    id: templateId,
    displayName: templateMeta.displayName,
    version,
    publishedAt: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await serviceClient
    .from("templates")
    .insert({
      template_slug: templateId,
      version,
      tier,
      checksum,
      bundle_signature: bundleSignature,
      storage_key: storageKey,
      manifest,
      is_latest: true,
      yanked: false,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[publish-template] Insert failed:", insertError);
    // Roll back the storage upload.
    await serviceClient.storage.from(STORAGE_BUCKET).remove([storageKey]);
    return Response.json<PublishResponse>(
      { ok: false, error: insertError?.message ?? "Database insert failed." },
      { status: 500 },
    );
  }

  console.info(
    `[publish-template] Published: slug=${templateId} v=${version} ` +
      `tier=${tier} id=${inserted.id} by=${authResult.userId}`,
  );

  return Response.json<PublishResponse>(
    { ok: true, templateRowId: inserted.id, version, storageKey },
    { status: 201 },
  );
}
