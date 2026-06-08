import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORG_ID_RE = /^org_[a-z0-9_-]{1,64}$/;

type ProvisionPayload = {
  org_id: string;
  template_id: string;
  max_projects?: number;
  valid_until?: string | null;
};

function validatePayload(body: unknown): ProvisionPayload | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const { org_id, template_id, max_projects, valid_until } = body as Record<
    string,
    unknown
  >;

  if (typeof org_id !== "string" || !ORG_ID_RE.test(org_id)) {
    return {
      error:
        'org_id must be a string matching the pattern "org_<slug>" (e.g. "org_acme").',
    };
  }

  if (typeof template_id !== "string" || !UUID_RE.test(template_id)) {
    return { error: "template_id must be a valid UUID v4 string." };
  }

  if (max_projects !== undefined) {
    if (
      typeof max_projects !== "number" ||
      !Number.isInteger(max_projects) ||
      max_projects < -1
    ) {
      return {
        error: "max_projects must be an integer ≥ -1 (use -1 for unlimited).",
      };
    }
  }

  if (valid_until !== undefined && valid_until !== null) {
    if (typeof valid_until !== "string" || isNaN(Date.parse(valid_until))) {
      return { error: "valid_until must be an ISO 8601 date string or null." };
    }
  }

  return {
    org_id,
    template_id,
    max_projects: typeof max_projects === "number" ? max_projects : -1,
    valid_until: valid_until ?? null,
  };
}

// ---------------------------------------------------------------------------
// Authorization: verify bearer token and confirm studio_admin role
// ---------------------------------------------------------------------------

/**
 * Verifies the incoming JWT against Supabase Auth (using the anon client),
 * then checks the caller's profile role in the database (using the service-role
 * client to bypass RLS for the lookup).
 *
 * Returns the verified user ID on success, or an error string on failure.
 * Both clients are created locally — neither is ever assigned to a module-
 * level variable.
 */
async function verifyStudioAdmin(
  bearerToken: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ userId: string } | { error: string; status: number }> {
  // Use the caller's own JWT as the session so the profile lookup goes through
  // the existing RLS policy ("users can SELECT their own row"). The service-role
  // key has no GRANT on public.profiles (42501), so we avoid it here.
  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData?.user) {
    return { error: "Invalid or expired token.", status: 401 };
  }

  const userId = userData.user.id;

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[provision-license] Profile lookup error:", {
      userId,
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

  return { userId };
}

// ---------------------------------------------------------------------------
// Core provisioning logic
// ---------------------------------------------------------------------------

/**
 * Inserts a license row into public.licenses using a service-role client.
 *
 * The service-role client is created inside this function and scoped to
 * this call — it is never held in a module-level or closure variable.
 *
 * @param org_id        - The organisation ID (e.g. 'org_acme')
 * @param template_id   - UUID of the template row in public.templates
 * @param max_projects  - Per-org project cap; -1 = unlimited
 * @param valid_until   - ISO 8601 expiry date, or null for perpetual
 * @param supabaseUrl   - Injected from env (avoids global module state)
 * @param serviceRoleKey - Injected from env (avoids global module state)
 */
async function provisionOrgLicense(
  org_id: string,
  template_id: string,
  max_projects: number,
  valid_until: string | null,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ ok: true; licenseId: string } | { ok: false; error: string }> {
  // Service-role client is created locally — bypasses RLS for the insert.
  const serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await serviceClient
    .from("licenses")
    .insert({
      organization_id: org_id,
      template_id,
      max_projects,
      valid_until: valid_until ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Unique constraint violation: license already exists for this org+template.
    if (error.code === "23505") {
      return {
        ok: false,
        error: `License for org '${org_id}' and template '${template_id}' already exists.`,
      };
    }
    // FK violation: org or template ID does not exist in the database.
    if (error.code === "23503") {
      return {
        ok: false,
        error: `org_id or template_id not found. Verify both exist before provisioning.`,
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, licenseId: data.id };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // --- Environment guard ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error(
      "[provision-license] Missing required environment variables. " +
        "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and " +
        "SUPABASE_SERVICE_ROLE_KEY must all be set.",
    );
    return Response.json(
      { ok: false, error: "Server misconfiguration." },
      { status: 500 },
    );
  }

  // --- Authorization ---
  const authHeader = request.headers.get("Authorization");
  const bearerToken =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!bearerToken) {
    return Response.json(
      { ok: false, error: "Authorization header with Bearer token required." },
      { status: 401 },
    );
  }

  const authResult = await verifyStudioAdmin(bearerToken, supabaseUrl, anonKey);

  if ("error" in authResult) {
    return Response.json(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }

  // --- Input validation ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const validated = validatePayload(body);
  if ("error" in validated) {
    return Response.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const { org_id, template_id, max_projects, valid_until } = validated;

  // --- Provision ---
  const result = await provisionOrgLicense(
    org_id,
    template_id,
    max_projects,
    valid_until ?? null,
    supabaseUrl,
    serviceRoleKey,
  );

  if (!result.ok) {
    // Distinguish client errors (bad IDs) from unexpected server errors.
    const isClientError =
      result.error.includes("already exists") ||
      result.error.includes("not found");
    return Response.json(
      { ok: false, error: result.error },
      { status: isClientError ? 409 : 500 },
    );
  }

  // --- Audit log ---
  // org_id is already validated against ORG_ID_RE — safe to log.
  console.info(
    `[provision-license] License provisioned: org=${org_id} ` +
      `template=${template_id} max_projects=${max_projects} ` +
      `valid_until=${valid_until ?? "perpetual"} ` +
      `license_id=${result.licenseId} ` +
      `granted_by=${authResult.userId}`,
  );

  return Response.json({ ok: true, licenseId: result.licenseId }, { status: 201 });
}
