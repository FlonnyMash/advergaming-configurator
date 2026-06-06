# Cursor instructions — tz

Template ID: `tz`  
Scene key: `Tz` (class `GameScene` in `GameScene.ts`)

Read this file first. You are extending a **Phaser 3 game template** inside the Mashed Games Studio pnpm monorepo. Follow the rules below exactly; do not invent parallel config or bridge protocols.

---

## 1. Install location (required)

Copy this entire folder into the monorepo at:

```
apps/game-engine/src/templates/tz/
```

Expected files:

| File | Role |
|------|------|
| `manifest.json` | Template metadata + UI schema (see §3) |
| `index.ts` | Registry entry: `export { manifest, Scene }` |
| `GameScene.ts` | Phaser scene — gameplay only |
| `CURSOR.md` | This file (keep updated as you ship features) |

After copying, from the **repository root** run:

```bash
pnpm --filter @mashedgames/game-engine sync-manifest-registry
```

Restart the game engine dev server and open **Studio** (`/studio`) — the template should appear in the catalog as **(dev)**.

---

## 2. Monorepo boundaries (do not violate)

| Package / app | Responsibility |
|---------------|----------------|
| `apps/dashboard` | Next.js UI, state config, iframe preview, postMessage sender |
| `apps/game-engine` | Vite + Phaser canvas, template scenes, DOM overlays, postMessage receiver |
| `packages/shared` | `GameConfig`, `BridgeMessage`, manifest types, config helpers |
| `packages/studio-engine` | Studio sidebar + schema-driven controls |

**Never** put dashboard React code in the game engine, or Phaser logic in the dashboard.

---

## 3. Manifest — migrate before shipping

This scaffold uses an **Option A** manifest (`meta`, typed `branding` / `system` controls) for clarity.

The **published catalog** expects a `TemplateManifest` JSON Schema manifest (see `apps/game-engine/src/templates/catch-game-demo/manifest.json`):

- Top-level: `id`, `version`, `author`, `previewUrl`, `status`, `label`, `description`
- `schema` with `properties.branding` / `properties.system` and `x-control` on each leaf
- `id` must match the folder name `tz`

**Your task:** Replace `manifest.json` with a valid production manifest before publishing. Use `gameSchemaFromManifest` from `@mashedgames/shared` — controls map to `config.branding.*` and `config.system.*` paths via `x-control.targetPath`.

Until migrated, Studio schema controls may not bind correctly.

---

## 4. Config updates — how the engine applies changes

Flow:

```
Dashboard (state) → postMessage CONFIG_UPDATED → game-engine bridge → applyConfig → scene
```

Implement **`TemplateScene`** in `GameScene.ts`:

```ts
import type { GameConfig } from "@mashedgames/shared";
import type { TemplateScene } from "../../types.ts"; // adjust relative path after install

export class GameScene extends Phaser.Scene implements TemplateScene {
  updateConfig(config: GameConfig): void {
    // Apply branding.theme.*, system.mechanics.*, textures, etc.
  }
}
```

Reference: `apps/game-engine/src/templates/types.ts`, `apps/game-engine/src/game/applyMechanics.ts`, `apps/game-engine/src/main.ts` (`applyConfig`).

The scaffold also listens for `this.game.events.on("CONFIG_UPDATE", ...)` for local testing. **Prefer `updateConfig`** — that is what the live bridge calls via `updatePhaserMechanics`.

For Base64 player textures, use `reloadBase64Texture` from `apps/game-engine/src/game/reloadBase64Texture.ts` (always `textures.remove` before reload).

---

## 5. DOM vs canvas (strict)

- **Phaser:** physics, sprites, particles, in-game motion only.
- **HTML + Tailwind:** start screen, CTA, lead form, highscores — edited via `config.branding.domOverlay` and rendered in `apps/game-engine/src/overlays/ui-manager.ts`.

Do not build buttons or forms as Phaser `GameObjects`.

Listen for `window` event `GAME_START` (or `TemplateScene.start()`) to begin gameplay after the DOM start screen.

---

## 6. `index.ts` registry contract

The engine glob-imports `./*/index.ts` and expects **named** exports:

```ts
import manifest from "./manifest.json";
import { GameScene as Scene } from "./GameScene";

export { manifest };
export { Scene };
```

Do not use `export default` — `catalog.ts` reads `mod.manifest` and `mod.Scene` directly.

---

## 7. Development checklist

1. [ ] Copied to `apps/game-engine/src/templates/tz/`
2. [ ] Ran `sync-manifest-registry`
3. [ ] Migrated `manifest.json` to published JSON Schema + `x-control`
4. [ ] `GameScene` implements `TemplateScene` with `updateConfig`
5. [ ] Branding changes apply without iframe reload (test in Studio preview)
6. [ ] DOM overlays configured in manifest / `domOverlay` paths if needed
7. [ ] No texture memory leaks on repeated asset upload (use shared reload helper)
8. [ ] Added `previewUrl` asset under game-engine `public/previews/` if needed

Publish to catalog when ready:

```bash
cd apps/dashboard && pnpm publish-template tz
```

---

## 8. Commands (repo root)

```bash
pnpm dev                                    # dashboard + engine (per your workspace scripts)
pnpm --filter @mashedgames/game-engine dev  # engine only
pnpm --filter dashboard dev                 # dashboard only
```

---

## 9. When editing with Cursor

- Provide **full file paths** and complete TypeScript — no `// ... rest` placeholders.
- Match existing templates: `catch-game-demo` under `apps/game-engine/src/templates/`.
- If adding manifest controls, update both `manifest.json` **and** handle the mapped paths in `updateConfig`.
- Point out performance issues (uncleared textures, listeners not removed in `shutdown()`).

---

*Generated by Mashed Games Studio template scaffold. Update this file as the template evolves.*
