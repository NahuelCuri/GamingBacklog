# Backlog

Games, books, movies, wines, expenses and trips. Next.js 15 static export for GitHub Pages
(`https://nahuelcuri.github.io/GamingBacklog/`), Supabase for auth + sync.

> Migration in progress on branch `next`. Production is still the legacy bundle on `main`.
> See [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + publishable key
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server → http://localhost:3000/GamingBacklog/ |
| `npm run preview` | Static build + serve `out/` like Pages → http://localhost:4173/GamingBacklog/ |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

Phone testing on the same wifi: `npx next dev -H 0.0.0.0`, then open `http://<pc-ip>:3000/GamingBacklog/`.

## Layout

- `app/` — routes
- `components/` — UI
- `lib/` — logic, pure and tested where possible
- `public/legacy/index.html` — the current production bundle, served at `/legacy/` for side-by-side comparison
- `tests/seeds.ts` — loads the starter seeds in `public/seeds/` for tests
