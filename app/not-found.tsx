import Link from "next/link";

// Static 404 (exported as 404.html). Uses the neutral home palette.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-[420px] max-w-full">
        <div className="mb-1.5 font-mono text-[13px] text-dim">{"// 404"}</div>
        <h1 className="m-0 mb-2.5 text-[26px] font-bold tracking-[-.02em] text-balance">This page doesn&apos;t exist.</h1>
        <p className="m-0 mb-6 text-[13.5px] leading-[1.6] text-pretty text-muted">
          The link may be old, or the library was renamed. Your data is safe.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-[9px] bg-accent px-4 py-[9px] text-[13px] font-semibold text-on-accent transition-[filter,transform] duration-200 hover:text-on-accent hover:brightness-110 active:scale-[.98]"
        >
          Back to your libraries
        </Link>
      </div>
    </main>
  );
}
