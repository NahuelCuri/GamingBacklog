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
5. **Books, Movies, Wines, Expenses.** ✅ Everything is config-driven, so all four already run on the phase 4 UI. Legacy had no per-collection branches besides the shared `wines` table.
   - `tests/collections-smoke.test.tsx` renders every view, every seed item's form and share card, and a set of messy data (repeated tags, blank/null fields, numbers stored as text, unknown status). It fails on any React warning.
   - **Fixed from what it found:**
     - Repeated tags caused duplicate React keys.
     - Numeric strings concatenated in sum and avg metrics (legacy had the same bug).
     - The Expenses category split showed "Other" twice and dropped blank categories (a user report; the fix is in its own commit).
   - **Wines realtime:** the payload mapping and the hook applying remote changes are covered by tests. A live two-account check is for the user.
   - **Still placeholders:** the Months tab (Expenses) arrives in phase 6, and the Map tab (Wines) in phase 7.
6. **MonthsView, i18n, currency.** ✅
   - **Months (Expenses):** month cards, then a drill-down with the daily spending calendar, the category breakdown and the transactions (click one to edit it). Like legacy, the open month is not in the URL.
   - **Missing tabs:** `?view=months` (or `map` / `roulette`) on a collection without that tab falls back to the library. Legacy rendered an empty view.
   - **i18n (EN/ES):**
     - The same fixed toggle on every page and the same `bl_lang` localStorage key, so the choice carries over from legacy.
     - `lib/i18n/es.ts` is the legacy dictionary. A test checks it still matches.
     - The approach is still legacy's: rendered text that exactly matches a key is swapped in the DOM, and a MutationObserver re-applies it after React renders.
     - Improvements: it translates before paint (legacy flashed English after each render), restores the original text when switching back instead of reverse-mapping, starts after hydration, and sets `<html lang>`.
     - `tests/i18n-parity.test.tsx` runs legacy `i18n.js` and ours on the same rendered views of every collection and requires identical Spanish output.
     - Two sentences are now rendered as a single text node, as in legacy, so they stay whole instead of translating one word ("10 libros shown").
     - A typed `t()` can replace the DOM approach after cutover if needed.
   - **Currency:** the US$/AR$ toggle and the live rate (`cfg.currency`, with `fallbackRate` if the API fails) are ported. As in legacy, no config defines `currency`, so the toggle stays hidden. Adding the block to `config/collections/expenses.ts` turns it on.
7. **GeoMap + Trip Planner.** ✅
   - **7a. Map (Wines).** ✅
     - The Argentina province map, drawn with d3 modules (`d3-geo`, `d3-zoom`, `d3-selection`, `d3-scale`, `d3-transition`) from npm instead of the CDN.
     - Same behaviour as legacy: provinces glow by count, hover tooltip, click to zoom in and list the wines, drag and scroll to pan and zoom, "reset view", and the Malvinas overlay tagged to Tierra del Fuego.
     - **Data:** legacy downloaded a 13 MB GeoJSON from jsDelivr on every visit and simplified it in the browser. `scripts/build-provinces.mjs` now applies the same simplification once and writes `public/geo/ar-provinces.json` (360 KB), which ships with the app.
     - A selected province's list now follows live data changes (legacy kept a stale copy).
   - **7b. Trip Planner.** ✅ At `/trips/`, members only (UI allowlist plus RLS).
     - **Ported:**
       - the trips home;
       - the board header with the budget bar, and the tabs, which sync to `?trip=&tab=&card=`;
       - Cards tab: search, type filters, and compare mode (the drawer, draggable and resizable cards, zoom);
       - Itinerary tab: pool and day lanes, drag and drop with hold-to-drag on phones, keyboard moves, quick add, "+ Add day", and pan/zoom on the canvas;
       - Map tab: OSM streets from Overpass, cached under the same `trip-map-osm:*` keys, with numbered pins, route and day filter;
       - the card view and editor (including the Nominatim location lookup);
       - the trip editor, and trip deletion that asks you to type the name;
       - undo after deleting a card;
       - the currency converter (`trip-fx-pref`).
     - **Data:** the same `trips` / `trip_cards` rows and realtime channel `trips-shared`. Every change is still mirrored to `trip-planner-v1`.
       - Logic is in `lib/trips/model.ts`, and tests compare it against the legacy component class run in a VM.
       - `/dev/preview/?c=trips` runs the planner on the example trip, in memory.
     - **Fixed from legacy:**
       - Editing a card erased its coordinates unless the Location field was touched.
       - Reordering cards within a day was never saved to the cloud (row order is not stored). Cards now carry an `order` field. The first save after cutover writes it to every card once. Legacy ignores the field.
       - A failed load fell back to the example trip, which the next edit could write over real data. It now shows an error with Retry.
       - A failed write only went to the console. It is now reported, and the saved state is reloaded.
     - **Kept from legacy:** the planner keeps its own always-dark palette, and the Compare button (bottom-left) sits under the EN/ES toggle.
     - **Shared fix:** with stacked dialogs (a delete confirm over the trip editor), Escape now closes only the top one.
8. **Cutover.** ✅ Done: merge `04e38fd` on `main`, deployed by Actions. All routes answer 200, `/dev/` is 404, and the sign-in page talks to Supabase. What remains is the checks with real accounts (step 4).
   - **Prepared on `next`:**
     - `.github/workflows/deploy.yml` tests, lints and builds on every push to `main` and `next`, and deploys only from `main`.
     - `/dev` and `/dev/preview` are `page.dev.tsx` files, which exist only under `next dev`, so they are not in the export.
     - The legacy page still ships at `/legacy/` as a fallback. It is identical to `main`'s `index.html`.
   - **Order matters:** after the merge, `main` no longer has an `index.html` at its root. A branch deploy would then publish a broken site, so the Pages source must switch first. Pages keeps serving the last deployment until a new one arrives, so legacy stays up in between.
   1. Add the repository variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under *Settings → Secrets and variables → Actions → Variables*. Use the same values as `.env.local`; both are public.
   2. Set *Settings → Pages → Source* to **GitHub Actions**. Legacy stays live.
   3. Merge `next` into `main` and push. The workflow tests, builds and deploys.
   4. Verify in prod: sign in, each library loads your data, theme and library visibility carry over, and Trips (members only). Legacy stays reachable at `/GamingBacklog/legacy/`.
   5. **Rollback:** revert the merge on `main`, then set Source back to *Deploy from a branch* (`main`, `/`).

## Rules to carry over

- No emoji; icons from Phosphor.
- The accent comes from one CSS variable, and everything derives from it.
- Mobile: the table collapses columns and the roulette stacks.
- Keyboard nav on rows, `aria-pressed` on chips, visible focus.
- Data is never lost: export before any destructive import.

## Known bug to fix

JSON export in prod returns `[]`. Export reads in-memory state with no `loaded` guard, and a failed cloud load silently resets to `[]`. The new data layer must disable export until the data is loaded and must surface load errors.
