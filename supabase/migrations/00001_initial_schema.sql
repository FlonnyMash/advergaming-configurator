-- =============================================================================
-- Migration: 00001_initial_schema
-- Mashed Games Studio — DRM & Licensing Foundation
--
-- Tables:
--   public.organizations — B2B client organisations
--   public.profiles      — 1:1 extension of auth.users; org membership + role
--   public.templates     — Template Registry (published .mgt bundles)
--   public.licenses      — Org → Template entitlement mapping
--   public.campaigns     — Export DRM kill-switch records
--
-- All tables have Row Level Security (RLS) enabled.
-- Policy design principle:
--   • Authenticated users may only read/write rows that belong to them
--     (via their profile's organization_id).
--   • studio_admin role may read/write the template registry.
--   • service_role (backend API routes) bypasses RLS for server-side writes.
--
-- NOTE: All tables are created first; RLS policies are applied after all
-- tables exist, because several policies cross-reference public.profiles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Custom types
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_role       AS ENUM ('studio_admin', 'b2b_user');
CREATE TYPE public.org_plan        AS ENUM ('starter', 'growth', 'enterprise');
CREATE TYPE public.template_tier   AS ENUM ('free', 'premium', 'enterprise');
CREATE TYPE public.campaign_status AS ENUM ('active', 'expired', 'suspended');

-- ---------------------------------------------------------------------------
-- SECTION 1: Tables
-- (No RLS policies here — all policies come after all tables are defined.)
-- ---------------------------------------------------------------------------

-- public.organizations
-- Must be created before profiles (FK dependency).

CREATE TABLE public.organizations (
  id          text        PRIMARY KEY,  -- 'org_' prefix, e.g. 'org_acme'
  name        text        NOT NULL,
  plan        public.org_plan NOT NULL DEFAULT 'starter',
  valid_until timestamptz,              -- NULL = no expiry
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.organizations IS 'One row per B2B client organisation.';
COMMENT ON COLUMN public.organizations.id IS 'Stable org identifier with org_ prefix. Set by service_role at provisioning time.';
COMMENT ON COLUMN public.organizations.valid_until IS 'NULL means the subscription does not expire. Past this timestamp the org is considered lapsed.';

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------

-- public.profiles
-- 1:1 with auth.users. Auto-created via trigger on auth.users INSERT.

CREATE TABLE public.profiles (
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id text        REFERENCES public.organizations(id) ON DELETE SET NULL,
  role            public.user_role NOT NULL DEFAULT 'b2b_user',
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS '1:1 extension of auth.users. Holds org membership and internal role.';
COMMENT ON COLUMN public.profiles.organization_id IS 'NULL until the user is assigned to an org by an admin.';
COMMENT ON COLUMN public.profiles.role IS 'studio_admin: internal Mashed staff. b2b_user: external B2B client.';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-create a profile row when a new auth.users row is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------

-- public.templates  (Template Registry)

CREATE TABLE public.templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug    text        NOT NULL UNIQUE,  -- stable templateId used in bundles
  version          text        NOT NULL,          -- semver, e.g. '1.2.0'
  tier             public.template_tier NOT NULL DEFAULT 'free',
  manifest         jsonb       NOT NULL DEFAULT '{}',
  storage_key      text        NOT NULL,          -- object storage path: '{slug}/{version}.mgt'
  checksum         text        NOT NULL,          -- SHA-256 of bundle contents
  bundle_signature text        NOT NULL,          -- HMAC-SHA256 signed by server private key
  is_latest        boolean     NOT NULL DEFAULT true,
  published_at     timestamptz NOT NULL DEFAULT now(),
  yanked           boolean     NOT NULL DEFAULT false
);

COMMENT ON TABLE  public.templates IS 'Registry of all published .mgt template bundles.';
COMMENT ON COLUMN public.templates.template_slug IS 'Stable identifier across versions, e.g. "catch-game". Matches templateId in manifest.json.';
COMMENT ON COLUMN public.templates.is_latest IS 'True for the head (newest) version of each template_slug. Used by the registry index.';
COMMENT ON COLUMN public.templates.yanked IS 'Soft-delete. Yanked templates are excluded from the registry index and cannot be downloaded.';
COMMENT ON COLUMN public.templates.bundle_signature IS 'HMAC-SHA256 of bundle contents using the server-side private key. Verified by Electron before expanding.';

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------

-- public.licenses
-- Maps an organisation to the template tiers/versions it is entitled to use.

CREATE TABLE public.licenses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id     uuid        NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  max_projects    integer     NOT NULL DEFAULT -1,  -- -1 = unlimited
  valid_until     timestamptz,                       -- NULL = perpetual
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, template_id)
);

COMMENT ON TABLE  public.licenses IS 'Entitlement mapping: which templates an organisation may access.';
COMMENT ON COLUMN public.licenses.max_projects IS '-1 means unlimited project instances of this template.';
COMMENT ON COLUMN public.licenses.valid_until IS 'NULL means the license never expires. Past this date the entitlement lapses.';

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------

-- public.campaigns
-- Export DRM kill-switch records. Created at export time by the Electron app
-- (via POST /api/campaigns). Read by the /drm/ping endpoint.

CREATE TABLE public.campaigns (
  id              text        PRIMARY KEY,  -- 'camp_' prefix, embedded in exported drm.js
  project_id      text        NOT NULL,
  organization_id text        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status          public.campaign_status NOT NULL DEFAULT 'active',
  start_date      timestamptz NOT NULL DEFAULT now(),
  end_date        timestamptz NOT NULL,
  allowed_origins text[]      NOT NULL DEFAULT '{}',
  ping_count      bigint      NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.campaigns IS 'DRM kill-switch records. One row per exported game bundle with DRM enabled.';
COMMENT ON COLUMN public.campaigns.id IS 'camp_ prefixed ID embedded in the exported drm.js config blob. Immutable after export.';
COMMENT ON COLUMN public.campaigns.status IS 'active: game runs. expired: past end_date (auto-set by server). suspended: manually killed.';
COMMENT ON COLUMN public.campaigns.allowed_origins IS 'Allowed deployment origins for server-side domain validation on /drm/ping. Empty array = allow all.';
COMMENT ON COLUMN public.campaigns.ping_count IS 'Running total of /drm/ping calls. Used for analytics only.';

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SECTION 2: RLS Policies
-- All tables exist at this point so cross-table subqueries are safe.
-- ---------------------------------------------------------------------------

-- organizations: org members may read their own org row.
CREATE POLICY "org members can view own org"
  ON public.organizations
  FOR SELECT
  USING (
    id = (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );
-- Only service_role may INSERT or UPDATE organisations (provisioning is backend-only).
-- No explicit INSERT/UPDATE policy → defaults to deny for authenticated users.

-- ---------------------------------------------------------------------------

-- profiles: users may read and update their own row only.
CREATE POLICY "users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------

-- templates: authenticated users browse the registry (non-yanked, latest only).
CREATE POLICY "authenticated users can view registry"
  ON public.templates
  FOR SELECT
  TO authenticated
  USING (yanked = false AND is_latest = true);

-- studio_admin may read all rows (including yanked, old versions).
CREATE POLICY "studio admins can view all templates"
  ON public.templates
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'studio_admin'
  );

-- studio_admin may publish (insert) new template rows.
CREATE POLICY "studio admins can publish templates"
  ON public.templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'studio_admin'
  );

-- studio_admin may update (e.g. yank a template, flip is_latest).
CREATE POLICY "studio admins can update templates"
  ON public.templates
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'studio_admin'
  );

-- ---------------------------------------------------------------------------

-- licenses: org members may read their own entitlements.
CREATE POLICY "org members can view own licenses"
  ON public.licenses
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );
-- Only service_role may INSERT/UPDATE/DELETE license rows.

-- ---------------------------------------------------------------------------

-- campaigns: org members may read, update, and create their own campaigns.
CREATE POLICY "org members can view own campaigns"
  ON public.campaigns
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "org members can update own campaigns"
  ON public.campaigns
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "org members can create campaigns"
  ON public.campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- SECTION 3: Table-level privileges
-- RLS policies narrow what each role can see/write, but PostgreSQL requires
-- the underlying table privilege to be granted first.
-- service_role bypasses RLS entirely (Supabase default) and needs no grants.
-- ---------------------------------------------------------------------------

GRANT SELECT                    ON public.organizations TO authenticated;
GRANT SELECT, UPDATE            ON public.profiles      TO authenticated;
GRANT SELECT                    ON public.templates     TO authenticated;
GRANT SELECT                    ON public.licenses      TO authenticated;
GRANT SELECT, INSERT, UPDATE    ON public.campaigns     TO authenticated;

-- anon role: no direct table access — all data goes through authenticated sessions.

-- ---------------------------------------------------------------------------
-- SECTION 4: Indexes
-- ---------------------------------------------------------------------------

-- Registry index query: non-yanked, latest templates.
CREATE INDEX idx_templates_registry
  ON public.templates (is_latest, yanked)
  WHERE is_latest = true AND yanked = false;

-- License manifest lookup: all licenses for a given org.
CREATE INDEX idx_licenses_org
  ON public.licenses (organization_id);

-- Campaign lookup by org (campaign management UI).
CREATE INDEX idx_campaigns_org
  ON public.campaigns (organization_id);

-- /drm/ping lookup: status + end_date check (auto-expire path).
CREATE INDEX idx_campaigns_status
  ON public.campaigns (status, end_date);
