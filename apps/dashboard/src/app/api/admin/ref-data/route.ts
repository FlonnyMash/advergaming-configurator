import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

type OrgOption = { id: string; name: string };
type TemplateOption = { id: string; template_slug: string };

type RefDataResponse =
  | { ok: true; orgs: OrgOption[]; templates: TemplateOption[] }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Authorization — identical pattern to /api/provision-license
// ---------------------------------------------------------------------------

async function verifyStudioAdmin(
  bearerToken: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ userId: string } | { error: string; status: number }> {
  // Use the caller's own JWT as the session — this lets us read their profile
  // row via the existing RLS policy ("users can SELECT their own row") without
  // needing service-role GRANT on public.profiles.
  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
  });

  const { data: userData, error: userError } =
    await userClient.auth.getUser();

  if (userError || !userData?.user) {
    return { error: "Invalid or expired token.", status: 401 };
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[admin/ref-data] Profile lookup error:", {
      userId: userData.user.id,
      code: profileError.code,
      message: profileError.message,
    });
    return { error: "Profile lookup failed.", status: 403 };
  }

  if (!profile) {
    return { error: "User profile not found.", status: 403 };
  }

  if (profile.role !== "studio_admin") {
    return { error: "Forbidden: studio_admin role required.", status: 403 };
  }

  return { userId: userData.user.id };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json<RefDataResponse>(
      { ok: false, error: "Server misconfiguration." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  const bearerToken =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!bearerToken) {
    return Response.json<RefDataResponse>(
      { ok: false, error: "Authorization header with Bearer token required." },
      { status: 401 },
    );
  }

  // Auth check uses the caller's JWT so the profile lookup goes through RLS
  // ("users can SELECT their own row") — service_role has no GRANT on profiles.
  const authResult = await verifyStudioAdmin(bearerToken, supabaseUrl, anonKey);

  if ("error" in authResult) {
    return Response.json<RefDataResponse>(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }

  // Data queries use the service-role client to bypass per-tenant RLS policies
  // (e.g. "users only see their own org"). Requires:
  //   GRANT SELECT ON public.organizations TO service_role;
  //   GRANT SELECT ON public.templates     TO service_role;
  const serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [orgsResult, templatesResult] = await Promise.all([
    serviceClient.from("organizations").select("id, name").order("name"),
    serviceClient
      .from("templates")
      .select("id, template_slug")
      .order("template_slug"),
  ]);

  if (orgsResult.error || templatesResult.error) {
    console.error("[admin/ref-data] Fetch failed:", {
      orgsError: orgsResult.error,
      templatesError: templatesResult.error,
    });
    return Response.json<RefDataResponse>(
      { ok: false, error: "Failed to fetch reference data." },
      { status: 500 },
    );
  }

  return Response.json<RefDataResponse>({
    ok: true,
    orgs: orgsResult.data ?? [],
    templates: templatesResult.data ?? [],
  });
}
