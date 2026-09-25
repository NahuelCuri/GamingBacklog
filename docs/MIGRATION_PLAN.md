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
2. **Data layer.** ✅
   - `lib/supabase.ts` (client), `lib/auth.tsx` (`AuthProvider` / `useAuth`, legacy validation messages).
   - `lib/data/store.ts`: `supabaseStore` covers per-user tables and the shared `wines` table with realtime. `memoryStore` is for tests.
   - `lib/data/collection-state.ts`: explicit `loading / ready / error` states. `collection-actions.ts` handles optimistic writes and surfaces failures.
   - `useCollection` and `useStore` hooks.
   - **`[]` export bug fixed:** a failed load is an error state, not an empty list. Export and import are refused until the data is loaded, and a failed refresh keeps the rows.
   - **Import:** validated, always downloads a backup first, and writes new rows before deleting stale ones, so the table is never left empty.
   - **localStorage:** `backlog:theme`, `backlog:libs:<uid>` and `backlog:libsSeen:<uid>` have the same shape in both apps, so they are reused as-is (`lib/prefs.ts`) and need no migration. Trip keys come in phase 7.
   - **No `LocalStore`:** legacy has no signed-out mode (it shows the login), so there is nothing to port.
   - `/dev/`: a development-only page for sign-in, load state, export/import and pasting a prod localStorage dump. Remove it or gate it harder before cutover (it ships a stub in prod).
   - Verified against prod Supabase anonymously: all 5 tables respond 200 with 0 rows (RLS). Sign-in with real accounts is for the user to check on `/dev/`.
3. **Shell + home.** ✅
   - `AuthGate` (loading / not configured / sign-in card), `LibraryPicker` with the hover wash, and `SettingsModal` (theme, library visibility, admin storage usage).
   - `ShellProvider` holds visible libraries, theme, settings and the page-switch wipe.
   - Real routes replace legacy's in-memory `activeCollection`: `/`, `/games/`, `/books/`, `/wines/`, `/movies/`, `/expenses/` (static via `generateStaticParams`) and `/trips/` (members only; a placeholder until phase 7).
   - Each route applies its palette via `data-collection`.
   - Visual parity checked against `/legacy/` by computed styles: the auth card matches within 1px. Tailwind line heights are reset to `normal` to match legacy.
   - Additions: Escape closes dialogs, focus moves into dialogs, library toggles are `role="switch"`.
   - Component tests (Testing Library + jsdom) cover the picker, navigation, auto-open, settings persistence and admin gating.
4. **Games.** ✅ Library (table and cards), add/edit form with DatePicker and ISBN lookup, stats, roulette, share card and stats image. The view and filters sync to the query string.
   - Share builders are ported to `lib/collection/share.ts` with parity tests.
   - `/dev/preview/?c=<key>` renders any collection on its seed in memory, for visual checks without signing in.
   - **Behaviour kept from legacy:** there is no settings access in the collection header on mobile.
   - **Fixed along the way:**
     - The roulette winner subtitle uses the config suffix. Legacy showed "h to beat" for every collection.
     - Cards use the configured fields. Legacy hard-coded the games fields.
   - **Dropped:** the "filter by tags" panel, which legacy code had but nothing could open.
   - **Tooling:** `NEXT_DIST_DIR=.next-build npx next build` builds without touching a running `next dev`. Sharing `.next` corrupted the webpack cache once.
   - **Checkpoint for the user:** compare `/games/` against `/legacy/` with real data, and test copying and downloading the images.
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
