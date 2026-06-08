# Mashed Games Studio — Cloud, DRM & Distribution Architecture Blueprint

> **Classification:** Internal Architecture Reference  
> **Status:** Proposal — Pre-Implementation  
> **Audience:** Engineering Lead, Solutions Architect  
> **Last Updated:** 2026-06-08

---

## Executive Summary

This document defines the technical architecture for the next evolution of Mashed Games Studio: a **cloud-backed distribution layer** that spans template publishing, B2B license enforcement, export-level DRM, and over-the-air (OTA) versioning. All design decisions are anchored to our existing stack — a pnpm monorepo with an Electron shell (`apps/desktop`), an embedded Next.js dashboard (`apps/dashboard`), a Vite/Phaser game engine (`apps/game-engine`), and shared Zod contracts (`packages/shared`) — and must degrade gracefully to our current strict offline mode.

The four pillars are independent but composable:

| Pillar | Secures | Primary Actor |
|---|---|---|
| **1. Template Registry & Cloud** | Authoring + Publishing | Studio user (internal) |
| **2. Licensing & Electron Client** | Distribution + Access Control | B2B Configurator user |
| **3. Export DRM (Kill-Switch)** | Deployed games | End-user browser / campaign manager |
| **4. OTA Versioning** | Config + Template lifecycle | Both |

---

## Architectural Constraints & Principles

Before detailing each pillar, the following constraints govern every design decision:

1. **Offline-first is non-negotiable.** The Electron app must remain fully functional without internet. Cloud features are additive layers, never blocking ones.
2. **The engine is a black box to the end-user.** Exported static bundles must not expose editable source. The Phaser build is a compiled artifact; `config.json` is its runtime interface.
3. **Zod is the single source of truth for data contracts.** All cloud payloads must be validated against schemas in `packages/shared` before being trusted by any consumer.
4. **The Electron preload bridge is the security boundary.** No untrusted content in the renderer process may access the filesystem. IPC channels are the only sanctioned pathway.
5. **DRM must be layered, not singular.** No single mechanism is unbreakable. Defence-in-depth across obfuscation, runtime checks, and server validation is the goal.

---

## Pillar 1 — Template Registry & Cloud

### 1.1 Concept

The **Studio** is the internal authoring environment used by the Mashed Games team. When a template reaches a publishable state, the Studio user triggers a "Push to Registry" action. This packages the template into a **Template Bundle** and uploads it to the central backend. B2B clients' Electron apps subsequently discover and download templates from this registry.

### 1.2 The Template Bundle Format

A Template Bundle is a versioned, self-describing artifact. It is a `.mgt` file (Mashed Games Template — a renamed `.zip`) with the following structure:

```
{templateId}@{semver}.mgt
├── manifest.json          # Registry metadata (see schema below)
├── config.json            # Canonical flat GameConfig (Zod v2 schema)
├── schema.json            # Exported Zod schema shape (field definitions from FLAT_FIELD_REGISTRY)
├── assets/
│   ├── preview.png        # 16:9 thumbnail shown in Configurator template picker
│   └── {assetFile}        # All template binary assets
└── BUNDLE_SIGNATURE       # HMAC-SHA256 of the above, signed with server private key
```

**`manifest.json` schema (extends existing `TemplateManifestSchema`):**

```
{
  id:               string (nanoid, stable across versions),
  version:          string (semver, e.g. "1.2.0"),
  displayName:      string,
  description:      string,
  category:         enum("arcade" | "puzzle" | "idle" | "quiz"),
  tier:             enum("free" | "premium" | "enterprise"),
  engineVersion:    string (semver range, e.g. ">=4.0.0"),
  publishedAt:      ISO8601,
  authorId:         string,
  checksum:         string (SHA-256 of config.json + assets),
  changelog:        string,
  compatibleSchemaVersion: number (must match packages/shared schemaVersion)
}
```

The `tier` field is the licensing hook. The registry serves metadata for all templates; the bundle payload is gated by tier (see Pillar 2).

### 1.3 Publishing Flow (Studio → Backend)

```
Studio User
    │
    ▼
[Studio UI] "Publish Template" button
    │
    ├─→ Validate active template's config.json against GameConfig Zod schema
    ├─→ Call GET /api/templates/{id}/export-config to serialize the bundle payload
    ├─→ Bundle: zip config.json + schema.json + assets/ + manifest.json
    ├─→ Compute SHA-256 checksum of bundle contents
    │
    ▼
[POST /api/templates/{id}/publish]  ← New Next.js API route
    │
    ├─→ Auth: Require valid Studio JWT (internal staff only, separate from B2B auth)
    ├─→ Validate manifest fields server-side (Zod)
    ├─→ Upload bundle to object storage (e.g. Supabase Storage, S3-compatible)
    │       bucket: "template-bundles" / key: "{id}/{version}.mgt"
    ├─→ Generate HMAC-SHA256 bundle signature (server private key, never exposed)
    ├─→ Upsert row in `template_registry` table:
    │       {id, version, tier, manifest JSON, storage_key, checksum, signature, published_at}
    ├─→ Invalidate CDN cache for /registry/index.json
    │
    ▼
[Registry Index Updated]  ← Clients poll this on startup
```

### 1.4 Backend Data Model (`template_registry` table)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Stable template identity |
| `version` | `text` | semver string |
| `tier` | `enum` | `free \| premium \| enterprise` |
| `manifest` | `jsonb` | Full manifest.json content |
| `storage_key` | `text` | Object storage path |
| `checksum` | `text` | SHA-256 of bundle |
| `bundle_signature` | `text` | HMAC-SHA256 server signature |
| `is_latest` | `boolean` | True for the head version of each template |
| `published_at` | `timestamptz` | |
| `yanked` | `boolean` | Soft-delete / pull from circulation |

### 1.5 Registry Index API

The **Registry Index** is a lightweight, publicly readable JSON document listing all non-yanked, latest templates (metadata only, no bundle content):

```
GET /api/registry/index.json
→ Cache-Control: max-age=300, stale-while-revalidate=3600

Response:
{
  "generatedAt": "ISO8601",
  "templates": [
    {
      "id": "...", "version": "1.2.0", "displayName": "...",
      "tier": "premium", "category": "arcade", "engineVersion": ">=4.0.0",
      "previewUrl": "https://cdn.mashedgames.io/previews/{id}.png",
      "checksum": "sha256:..."
    },
    ...
  ]
}
```

The Electron client fetches this on launch (non-blocking, falls back to locally cached copy). No authentication is required to read the index — tier gating applies only at download time.

---

## Pillar 2 — Licensing & Electron Client

### 2.1 Concept

B2B clients use the Configurator desktop app (Electron). When authenticated, the app fetches a **License Manifest** that describes the templates the organisation is entitled to use. Premium templates are downloaded as **encrypted bundles** and decrypted in-memory only — the raw source never touches the user's disk in a readable form.

### 2.2 Authentication Flow

The Electron app bootstraps a lightweight auth session on startup. We use **short-lived JWTs + refresh tokens**, persisted in the OS credential store (via `keytar` or Electron's `safeStorage` API — not `localStorage`).

```
[App Launch]
    │
    ├─→ Check OS credential store for { accessToken, refreshToken }
    │
    ├─→ [If no tokens] → Show Login screen (hosted web auth in a minimal BrowserWindow)
    │       OAuth2 / Magic Link via Supabase Auth
    │       On success: receive accessToken (15min TTL) + refreshToken (30day TTL)
    │       Persist both tokens via Electron safeStorage to OS credential store
    │
    ├─→ [If tokens exist] → POST /api/auth/refresh with refreshToken
    │       → New accessToken returned; update credential store
    │       → On network failure: use last known token (offline grace period)
    │
    └─→ Continue app boot with valid accessToken in memory (never in renderer process)
```

The access token is **only held in the main process**. The renderer/dashboard never sees it. All authenticated API calls are proxied through IPC: the renderer asks the main process to make the call.

### 2.3 License Manifest

After authentication, the main process fetches the organization's license entitlements:

```
GET /api/licenses/me
Authorization: Bearer {accessToken}

Response:
{
  "organizationId": "org_...",
  "plan": "growth",
  "validUntil": "2027-01-01T00:00:00Z",
  "entitlements": [
    { "templateId": "tmpl_abc", "tier": "premium", "maxProjects": 5 },
    { "templateId": "tmpl_xyz", "tier": "enterprise", "maxProjects": -1 }
  ],
  "featureFlags": {
    "enableLeadGen": true,
    "enableCustomCSS": true,
    "maxTemplates": 10,
    "exportWatermark": false
  }
}
```

This response maps directly to our existing `PlatformConfig.features` shape in `packages/shared/src/platform-schema.ts`, which already gates UI features. The cloud becomes the authoritative source for what was previously a static local config.

**The license manifest is cached locally** (`{workspace}/license.json`) and has a TTL of 24 hours. If the app is offline within TTL, it uses the cache. Past TTL offline, features gracefully degrade (no new premium template downloads; existing projects remain editable).

### 2.4 Premium Template Download (Encrypted Delivery)

When a user selects a premium template they are entitled to:

```
[User selects premium template in Template Picker]
    │
    ▼
[Renderer → IPC: "download-template" { templateId, version }]
    │
    ▼
[Main Process]
    ├─→ Validate entitlement against cached license manifest
    ├─→ If not entitled: return error to renderer ("Upgrade required")
    │
    ├─→ POST /api/templates/{id}/download
    │       Body: { version, organizationId }
    │       Authorization: Bearer {accessToken}
    │
    ▼
[Backend /api/templates/{id}/download]
    ├─→ Verify JWT + check entitlement in DB
    ├─→ Generate a signed, time-limited download URL (e.g. 5-minute S3 presigned URL)
    │       for the encrypted bundle at storage_key: "{id}/{version}.mgt.enc"
    ├─→ Generate a per-org, per-download AES-256-GCM key, encrypted with org's public key
    ├─→ Log download event (audit trail)
    └─→ Return: { downloadUrl: "...", encryptedKey: "...", iv: "..." }
    │
    ▼
[Main Process]
    ├─→ Fetch bundle from presigned URL (binary stream)
    ├─→ Decrypt encryptedKey using org's private key (stored in OS keychain)
    ├─→ Decrypt bundle in memory using AES-256-GCM
    ├─→ Verify HMAC bundle signature against server's known public key
    ├─→ Verify SHA-256 checksum of decrypted contents
    ├─→ Expand bundle to {workspace}/Templates/{id}/  (assets/ + config.json + manifest.json)
    │       NOTE: config.json is plaintext (needed for Configurator editing)
    │       NOTE: Engine source code is NOT in the bundle (it's pre-bundled in the engine binary)
    └─→ Emit IPC event "template-ready" to renderer
```

**Why is `config.json` plaintext?** The Configurator must be able to read and edit the flat GameConfig. The proprietary intellectual property is the **Phaser scene logic** (already compiled into the engine binary) and the **asset artwork**, not the config structure. The config is a data file, not source code.

**What is actually protected?** Template-exclusive scene modules and game logic variants are compiled into the engine itself (or into a template-specific engine chunk). The config merely selects which registered template ID the engine should load — it does not contain the scene source.

### 2.5 Security Properties of This Model

| Threat | Mitigation |
|---|---|
| Token theft from renderer | Tokens only in main process; renderer cannot access `safeStorage` |
| Bundle interception in transit | TLS + short-lived presigned URL (5 min window) |
| Bundle extraction after download | AES-256-GCM encryption; key is org-scoped and per-download |
| License sharing between orgs | JWT is org-bound; download logs create audit trail |
| Offline piracy of cached bundle | Bundle on disk is the decrypted config+assets only; engine logic is a compiled binary separate from the template data |

---

## Pillar 3 — Export DRM (The Kill-Switch)

### 3.1 Concept

When a Configurator user exports a game (zip of static HTML/JS + `config.json` + assets), the exported bundle is a self-contained file deployable anywhere. This is a deliberate product feature. However, for clients on time-limited or domain-restricted campaigns, we embed a **DRM shim** that is evaluated at runtime in the end-user's browser.

The DRM layer has two independent mechanisms: **Domain-Lock** and **Time-Lock**. Both are embedded in the exported bundle and operate without requiring our server for standard playback — but both can be remotely invalidated.

### 3.2 The DRM Shim

The DRM shim is a small, standalone JavaScript module compiled separately from the main Phaser engine. It is injected into `index.html` of the exported bundle as the **first** `<script>` tag, before the engine bootstrap. The engine will not start until the shim resolves.

```
index.html (exported bundle)
├── <script src="./drm.js"></script>   ← Injected at export time, runs first
├── <script src="./engine/index.js"></script>  ← Main Phaser app
└── <link rel="stylesheet" href="./engine/index.css">
```

The shim exposes a single global promise: `window.__mashedDRM.ready`. The engine bootstrap is wrapped to await this promise. If DRM fails, the shim resolves with a `blocked` status and the engine renders a campaign-ended or unauthorized-domain screen instead of the game.

**The shim itself is minified and obfuscated** using a tool like `javascript-obfuscator` as part of the export pipeline. This is not security — it is friction. The real security is server-side (Time-Lock) and browser-native (Domain-Lock).

### 3.3 Domain-Lock

Domain-Lock prevents the game from running on any domain not explicitly authorized by the campaign configuration. This is enforced client-side (as a deterrent) and optionally server-side (as a hard gate via the Time-Lock ping endpoint).

**How it works:**

At export time, the export pipeline embeds a **signed domain allowlist** into the DRM shim config:

```json
{
  "domainLock": {
    "allowedOrigins": ["https://client.example.com", "https://staging.example.com"],
    "allowLocalhost": false,
    "signature": "HMAC-SHA256(allowedOrigins + projectId + exportedAt, serverSecret)"
  }
}
```

At runtime (in the browser), the shim evaluates:

```
1. Read window.location.origin
2. Compare against allowedOrigins list
3. If not in list → render "Unauthorized Domain" overlay, do not boot engine
4. The signature is verified against a public key embedded in the shim
   (the private key signs at export time; only the public key is in the browser)
```

**Security analysis of Domain-Lock:**
- A determined attacker can strip the `<script>` tag or patch the JS. This is unavoidable in a static export model.
- Domain-Lock is a **commercial deterrent**, not a cryptographic guarantee. It protects against accidental redistribution and casual abuse.
- For stronger enforcement, clients requiring hard domain restriction should use the Time-Lock mechanism (which makes a server call) and configure the server to validate the request origin on every ping.

### 3.4 Time-Lock

Time-Lock is the hard kill-switch. It is enforced by our server and cannot be bypassed without network manipulation.

**Campaign Config embedded at export time:**

```json
{
  "timeLock": {
    "campaignId": "camp_abc123",
    "scheduledEnd": "2026-12-31T23:59:59Z",
    "pingUrl": "https://api.mashedgames.io/drm/ping",
    "pingIntervalSeconds": 300,
    "graceOfflineSeconds": 600
  }
}
```

**Runtime behavior in the browser:**

```
[Game loads]
    │
    ├─→ Shim reads scheduledEnd from config
    ├─→ Compare against Date.now() (client clock)
    │
    ├─→ [If client clock says campaign ended]
    │       Render "Campaign Ended" screen immediately
    │       Do NOT ping server (no recovery possible from client perspective)
    │
    ├─→ [If client clock says campaign active]
    │       POST /drm/ping { campaignId, timestamp, domainOrigin }
    │       Response: { status: "active" | "expired" | "suspended" }
    │
    │       [On "active"] Boot engine normally
    │       [On "expired" or "suspended"] Render kill screen
    │       [On network failure] Apply grace period (graceOfflineSeconds)
    │           After grace: render "Cannot verify campaign" screen
    │
    └─→ Schedule recurring ping every pingIntervalSeconds
            On subsequent "expired" or "suspended" response:
            Pause game, render kill screen (no page reload required)
```

**The `/drm/ping` endpoint:**

```
POST /api/drm/ping (no auth required — public endpoint)
Body: { campaignId, timestamp, origin }

Server logic:
    ├─→ Look up campaignId in campaigns table
    ├─→ Check campaign.status: "active" | "expired" | "suspended" | "not_found"
    ├─→ If active: compare server UTC now against campaign.end_date
    │       If past end_date: auto-transition campaign.status to "expired"
    ├─→ If origin provided: optionally validate against campaign.allowed_origins
    ├─→ Log ping event (campaignId, origin, IP, timestamp) — for analytics
    └─→ Return: { status: "active" | "expired" | "suspended", serverTime: "ISO8601" }
```

**The Kill-Switch (manual campaign termination):**

From the Studio dashboard or a future admin panel:

```
PATCH /api/campaigns/{campaignId}
Body: { status: "suspended" }
Authorization: Bearer {studioJWT}
```

On the next recurring ping (within `pingIntervalSeconds` seconds of the browser), every instance of the game worldwide renders the kill screen. No redeploy required. This is the "kill-switch" — it works retroactively on all already-distributed bundles of a given campaign.

**The `campaigns` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | `text` (PK) | `camp_` prefix, embedded in export |
| `project_id` | `text` | Links to the Configurator project |
| `organization_id` | `text` | Owner |
| `status` | `enum` | `active \| expired \| suspended` |
| `start_date` | `timestamptz` | |
| `end_date` | `timestamptz` | Hard deadline; server auto-expires |
| `allowed_origins` | `text[]` | For server-side domain validation on ping |
| `ping_count` | `bigint` | Audit counter |
| `created_at` | `timestamptz` | |

### 3.5 Export Pipeline Changes

The existing export flow in `apps/desktop/export-ipc-utils.js` currently zips the engine + config + assets. The DRM-aware export adds:

```
[IPC: export-project]
    │
    ├─→ Existing: fetch export config, zip engine + config + assets
    │
    ├─→ NEW: If project has DRM settings (campaign end date, allowed domains):
    │       POST /api/campaigns/create { projectId, endDate, allowedOrigins }
    │           → Returns { campaignId }
    │       Build DRM shim config blob (campaignId, pingUrl, allowedOrigins, endDate)
    │       Sign domainLock with server private key → get signature
    │       Inject drm.js (pre-built shim template) with config blob embedded
    │       Inject as first <script> in index.html
    │
    └─→ Package and return zip to user
```

The DRM shim template (`drm.js`) is a static build artifact maintained in `apps/game-engine/src/drm/` and copied to `apps/dashboard/public/engine/drm.js` as part of the engine build pipeline — exactly like the existing `copy-engine-to-dashboard.mjs` script.

### 3.6 Watermarking (Optional Enhancement)

For free-tier exports, the DRM shim can render a subtle "Made with Mashed Games" overlay on the game canvas. This is toggled by the `exportWatermark` feature flag in the license manifest (see Pillar 2). The watermark is rendered as a DOM overlay (consistent with our existing DOM overlay architecture in the engine bridge) and is not part of the Phaser canvas — making it trivially removable, but again, it is a commercial deterrent for free tier, not a hard control.

---

## Pillar 4 — OTA Versioning

### 4.1 Concept

Our flat `GameConfig` (Zod schema v2) is the config interface between Configurator and engine. As templates evolve, both the config schema and the template engine logic version. OTA updates allow:

1. **Config schema migration** — a project created against schema v2 is automatically migrated when a new template version ships a v3 schema.
2. **Template asset updates** — new artwork, bug-fixed game logic variants, without requiring B2B clients to reinstall the Electron app.
3. **Engine updates** — new Phaser build embedded in the Electron update (standard Electron auto-updater, out of scope for this pillar).

### 4.2 Version Pinning

Every project tracks the template version it was created against, using the existing `parentPinnedVersion` field in `GameConfig` and the `parent-lock.json` snapshot system. This is already architecturally present. The OTA layer formalizes this contract.

**Versioning rules:**
- Template versions follow **semver**: `MAJOR.MINOR.PATCH`
- `PATCH` bumps: bug fixes to assets or game logic. Auto-applied silently.
- `MINOR` bumps: new optional config fields added (backward compatible). Prompted in UI.
- `MAJOR` bumps: breaking schema changes (fields removed/renamed). Requires explicit migration approval.

### 4.3 The Template Version Lifecycle

```
Registry Index fetched on app start
    │
    ├─→ For each installed template in {workspace}/Templates/:
    │       Compare local manifest.json version vs registry index version
    │
    ├─→ [PATCH: local < registry, same MAJOR.MINOR]
    │       Auto-download + apply in background
    │       Update {workspace}/Templates/{id}/manifest.json
    │       No project migration needed (schema unchanged)
    │
    ├─→ [MINOR: new optional fields added]
    │       Notify user: "Template '{name}' has been updated (v1.1 → v1.2). New fields available."
    │       User can apply or skip
    │       If applied: new optional fields added to GameConfig schema defaults
    │       Existing projects: fields are absent (undefined), engine falls back to defaults
    │
    └─→ [MAJOR: breaking changes]
            Show migration dialog: "Template '{name}' has a major update (v1 → v2). 
            This may require reviewing your project settings."
            If approved:
                Fetch migration script from registry: GET /api/templates/{id}/migrate?from=1&to=2
                Migration script is a declarative JSON transform (field renames, removals, defaults)
                Apply to all projects pinned to this template (with dry-run preview)
                Update parentPinnedVersion in all affected projects
```

### 4.4 Migration Script Format

Migration scripts are **declarative JSON**, not executable code. They are validated server-side before being served. This is critical — we do not execute arbitrary code from the registry.

```json
{
  "fromVersion": "1.x",
  "toVersion": "2.0",
  "transforms": [
    { "op": "rename", "from": "playerSpeed", "to": "playerMovementSpeed" },
    { "op": "remove", "path": "legacyField" },
    { "op": "setDefault", "path": "newFeatureFlag", "value": false },
    { "op": "coerce", "path": "gameDurationSeconds", "type": "number" }
  ]
}
```

The migration runner in the Electron main process interprets these transforms against the project's `config.json`, validates the result against the new Zod schema version, and writes the migrated file. If Zod validation fails post-migration, the migration is rolled back (the original file is preserved via a `.pre-migration.bak` copy).

### 4.5 Parent Drift & Sync (Existing System Integration)

Our existing **parent drift** system (`/api/projects/{id}/parent-drift`) already detects when a project's config has diverged from its parent template. OTA versioning plugs into this:

- When a PATCH or MINOR update is applied, the drift check is re-run. Projects that were previously drifted-but-in-sync may become cleanly synced after the update.
- The `lastParentSyncAt` timestamp in `GameConfig` is updated when an OTA update is acknowledged via the existing `ack-parent` mechanism.
- The `parent-lock.json` snapshot is refreshed to reflect the new template version, serving as the new baseline for future drift comparisons.

### 4.6 Rollback

Every template version remains available in object storage indefinitely (unless explicitly yanked). A project can be **downgraded** by:

```
1. User opens project settings → "Template Version" selector
2. Fetches version history: GET /api/templates/{id}/versions
3. Selects an earlier version
4. System downloads that version's bundle
5. Runs migration in reverse (inverse transforms, where possible)
   OR presents a warning that manual config review is required
6. Updates parentPinnedVersion + parent-lock.json
```

Downgrade support for MAJOR version changes is best-effort and requires the Studio team to author reverse migration scripts.

---

## Cross-Pillar Integration: The DRM-Aware Project Export Lifecycle

The following sequence illustrates how all four pillars combine in a full end-to-end flow:

```
[Studio — Internal]
    Author template → Push Bundle to Registry (Pillar 1)
    Set template tier = "premium"

[B2B Client — Configurator Desktop App]
    Launch Electron → Auth with Supabase (Pillar 2)
    Fetch license: premium template "tmpl_catch_v2" is entitled
    Registry index fetched: v1.3 available, local has v1.1 → auto-PATCH update applied (Pillar 4)
    Template v1.3 downloaded (encrypted), decrypted in-memory, written to workspace (Pillar 2)
    
    User opens template, customizes config (branding, game params)
    User sets campaign: end date = 2026-12-31, domain = "client.example.com"

    Export game → DRM shim injected (Pillar 3):
        Campaign created on server → campaignId = "camp_xyz"
        Domain allowlist signed
        drm.js embedded as first script in index.html
    
    User receives game.zip

[B2B Client → deploys game.zip to client.example.com]

[End-User Browser — client.example.com]
    Page loads → drm.js runs first
    Domain check: origin is "client.example.com" → PASS
    Time check: client clock says campaign active → proceed to server ping
    POST /drm/ping → server confirms "active" → engine boots → game plays

[Campaign Manager — 2027-01-15, campaign overrun]
    PATCH /api/campaigns/camp_xyz { status: "suspended" }
    
[End-User Browser — next ping cycle, within 5 minutes]
    POST /drm/ping → server returns "suspended"
    Game pauses → "Campaign has ended" overlay renders
    All distributed instances worldwide killed within pingIntervalSeconds
```

---

## Implementation Phasing

Given the current post-reset stub state of the codebase (template import/export returning 501, single hardcoded template), the recommended build sequence is:

### Phase 0 — Foundation (Prerequisite)
- Restore template import/export (`501` → working)
- Implement disk-based template library with multi-template support
- Ensure `manifest.json` schema is finalized in `packages/shared`

### Phase 1 — Registry & Cloud Backend
- Supabase project: `template_registry`, `campaigns`, `organizations`, `licenses` tables
- Backend API: registry index endpoint, template publish endpoint
- Studio publish flow in UI

### Phase 2 — Auth & Licensing in Electron
- `safeStorage`-based token persistence in main process
- Auth login window flow
- License manifest fetch + local cache
- Entitlement-gated template picker UI

### Phase 3 — Encrypted Template Download
- Object storage setup (Supabase Storage)
- AES-256-GCM bundle encryption pipeline on server
- Electron main process decryption flow
- HMAC signature verification

### Phase 4 — Export DRM
- DRM shim source in `apps/game-engine/src/drm/`
- Shim build + copy to dashboard public
- Campaign creation API
- Export pipeline DRM injection
- `/drm/ping` endpoint

### Phase 5 — OTA Versioning
- Registry index version comparison logic in Electron
- PATCH auto-update flow
- MINOR/MAJOR migration UI + declarative transform runner
- Parent drift system integration

---

## Open Questions & Decisions Required

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Auth provider for B2B clients | Supabase Auth, Auth0, custom JWT | **Supabase Auth** — already in stack for DB |
| 2 | Object storage for bundles | Supabase Storage, AWS S3, Cloudflare R2 | **Cloudflare R2** — no egress fees, global CDN |
| 3 | Org public/private key management for bundle encryption | Managed KMS, Electron-generated keypair, shared org key | **Electron-generated keypair per org** — private key never leaves client |
| 4 | DRM ping endpoint hosting | Same Next.js API, separate edge function | **Cloudflare Worker** — sub-10ms globally, no cold starts |
| 5 | Engine-level DRM (compiled template modules) | All templates in one engine binary, template-specific chunks | **Template-specific lazy chunks** — requires Vite code-splitting investigation |
| 6 | Migration script reverse support for MAJOR downgrades | Manual only, automated inverse, prohibit downgrade | **Prohibit MAJOR downgrade** for simplicity; warn and offer backup restore |

---

*This document is a living blueprint. Implementation details will diverge as development proceeds. The Zod schemas in `packages/shared` are the authoritative data contracts and supersede any JSON examples in this document.*
