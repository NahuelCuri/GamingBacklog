import { ThemeToggle } from "@/components/ThemeToggle";
import { withBase } from "@/lib/paths";

// Phase 0 placeholder: proves tokens, fonts and theme switching. Replaced by
// the real library picker in phase 3.
const LIBS = [
  { key: "games", label: "Games", color: "#9ce6b0" },
  { key: "books", label: "Books", color: "#d8b98f" },
  { key: "wines", label: "Wines", color: "#c6a9d6" },
  { key: "movies", label: "Movies", color: "#a9aee0" },
  { key: "expenses", label: "Expenses", color: "#8ecfd6" },
  { key: "trips", label: "Trips", color: "#5fb8b0" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Backlog</h1>
          <p className="font-mono text-xs text-muted">next · fase 0</p>
        </div>
        <ThemeToggle />
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LIBS.map((lib) => (
          <li
            key={lib.key}
            className="rounded-2xl border border-wf bg-surface p-5"
            style={{ borderTopColor: lib.color, borderTopWidth: 3 }}
          >
            <div className="font-bold">{lib.label}</div>
            <div className="font-mono text-xs text-dim">{lib.color}</div>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted">
        La app actual sigue disponible en{" "}
        <a href={withBase("/legacy/index.html")}>/legacy</a> para comparar.
      </p>
    </main>
  );
}
