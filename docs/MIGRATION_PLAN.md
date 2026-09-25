# Migration plan — Next.js 15 + React 19 + TypeScript

Frontend-only migration. Supabase (auth, tables, RLS, `admin_usage` RPC) is already in production and is not changed.

## How we work

- All development happens on branch `next`, run locally (`npm run dev` / `npm run preview`). `main` keeps serving the legacy bundle until cutover.
- Local dev talks to the **production** Supabase project. Writing to `wines` is fine (it only holds test data). `trips`, `trip_cards` and per-user collection tables may hold real data, so use a test account when writing.
- `localhost` is a different origin from Pages, so production localStorage isn't visible locally. Copy it from prod with `copy(JSON.stringify(localStorage))` and paste it into the dev-only import (phase 2).

## Target stack

- Next.js 15 (App Router, `output: 'export'`, `basePath: '/GamingBacklog'`, `trailingSlash`), React 19, TypeScript strict
- Tailwind CSS v4. Tokens ported 1:1 in `app/globals.css`, selected by `<html data-collection data-theme>`.
- Hanken Grotesk + JetBrains Mono via `next/font`. The font change is deferred until after cutover.
- Supabase JS (browser-only), html-to-image (share images), d3 + GeoJSON (maps)
- Framer Motion, Phosphor icons
- Vitest for logic, Playwright for smoke flows

## Legacy inventory (`legacy-src/`)

| Legacy | Target |
|---|---|
| `collection-lib.js` | `lib/collection/*.ts`: pure, typed, tested against seeds |
| `spending.js` | `lib/spending.ts` |
| `*-config.js` (games, books, movies, wines, expenses) | `config/collections/*.ts` implementing `CollectionConfig` |
| `*-seed.js` | `public/seeds/*.json` |
| `i18n.js` (Books only today) | `lib/i18n.ts` |
| `Backlog.dc.html` (auth, library picker, settings, admin usage) | `app/page.tsx` + auth/settings components |
| `GamesCollection.dc.html` | `app/[collection]/page.tsx` + `CollectionShell` |
| `ItemTable`, `ItemModal`, `StatsView`, `StatWidget`, `Roulette`, `MonthsView`, `ShareCard`, `ShareImage`, `DatePicker` | `components/*` one-to-one |
| `GeoMap.dc.html`, `Trip Planner.dc.html` | `app/trips/*` |

## Data contract to preserve

- Auth: email/password `signUp` / `signInWithPassword` / `signOut` / `getSession`. The session lives in localStorage, so it is shared with legacy on the same origin.
- Collections: one table per collection key, read with `from(table).select('data')`.
  - Per-user tables (games, books, movies, expenses): upsert `{user_id, id, data}` on conflict `user_id,id`. Delete and clear filter by `user_id`.
  - `wines` is a shared cellar: PK is `id` alone, upsert `{id, data, added_by, updated_at}` on conflict `id`, RLS via `wine_members`. Realtime channel `wines-shared` (`postgres_changes` on `public.wines`) keeps both members in sync.
  - "Load starter" copies the collection seed into state and upserts it.
  - Import replaces everything: `clearAll` then `putAll`. The export-first rule applies here.
- Trips: `trips`, `trip_cards`, plus the localStorage keys `trip-planner-v1` and `trip-fx-pref`. Access is gated by RLS (`trip_members`) and the UI allowlist.
- Admin: `rpc('admin_usage')`, only for `ADMIN_UID`.
- localStorage keys: `backlog:theme` (shared as-is), `backlog:libs:<uid>`, `backlog:libsSeen:<uid>`. New keys go under `backlog:v2:*`. Never rewrite a legacy key in a different shape: read it, migrate once, write v2.

## Phases

0. **Setup.** ✅ Scaffold, tokens, fonts, theme, preview server, Vitest, legacy extracted.
1. **Pure logic.** ✅
   - `lib/collection/*`: types, library (filter, sort, ledger cap, paging, cells), draft, roulette, stats, geo, months. Plus `lib/spending.ts`.
   - `config/collections/*.ts` are generated from the legacy configs. `public/seeds/*.json` hold the seeds.
   - `tests/parity.test.ts` runs the legacy JS in a VM and asserts identical output on every seed. Mutation-checked.
   - Deliberate differences: currency is passed explicitly instead of via the `window.__CURRENCY` global, builders return data only (styles and handlers move into components), and detail values are always strings.
   - Deferred to phase 4: the share-image and share-card builders (`buildShare` / `buildShareCard`), ported together with their components.
   - Found: no config defines `currency`, so the Expenses currency toggle is currently inert in legacy.
2. **Data layer.** Supabase client, auth, `DataProvider` with `LocalStore` / `SupabaseStore`, explicit `loading / error / ready` states, localStorage migration, dev import, and a safe JSON export (fixes the `[]` bug).
3. **Shell + home.** Login, library picker, settings, theme and accent per collection.
4. **Games.** Table, modal, stats, roulette, share card and image, date picker. Checkpoint: parity with `/legacy/`.
5. **Books, Movies, Wines, Expenses.** Mostly config. Checkpoint: `wines` sync.
6. **MonthsView, i18n, currency.**
7. **GeoMap + Trip Planner.**
8. **Cutover.**
   1. Add a GitHub Actions deploy workflow. `public/legacy/index.html` ships at `/legacy/`.
   2. Merge `next` into `main`.
   3. Set *Settings → Pages → Source* to **GitHub Actions**.
   4. Verify login, data and localStorage migration in prod.
   5. Rollback: set Source back to *Deploy from a branch* and revert the merge.

## Rules to carry over

- No emoji; icons from Phosphor.
- The accent comes from one CSS variable, and everything derives from it.
- Mobile: the table collapses columns and the roulette stacks.
- Keyboard nav on rows, `aria-pressed` on chips, visible focus.
- Data is never lost: export before any destructive import.

## Known bug to fix

JSON export in prod returns `[]`. Export reads in-memory state with no `loaded` guard, and a failed cloud load silently resets to `[]`. The new data layer must disable export until the data is loaded and must surface load errors.
