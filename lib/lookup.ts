// ISBN auto-fill for the book form (legacy GamesCollection.lookupItem).
// Tries Open Library, then Google Books, then Open Library search.
import type { Draft } from "@/lib/collection/draft";

export interface BookInfo {
  title?: string;
  author?: string;
  pages?: number;
  pubYear?: string;
  genres?: string[];
}

const clip = (arr: unknown[] | undefined, n: number) =>
  (arr || []).map((s) => String(s).trim()).filter(Boolean).slice(0, n);
const year = (s: unknown) => (s ? (String(s).match(/\d{4}/) || [])[0] : undefined);

/** Strip everything but digits and X. */
export const cleanIsbn = (raw: unknown) => String(raw || "").replace(/[^0-9Xx]/g, "");

/* eslint-disable @typescript-eslint/no-explicit-any */
export const fromOpenLibrary = (rec: any): BookInfo => ({
  title: rec.title,
  author: (rec.authors || []).map((a: any) => a.name).filter(Boolean).join(", "),
  pages: rec.number_of_pages,
  pubYear: year(rec.publish_date),
  genres: clip((rec.subjects || []).map((s: any) => s.name), 4),
});

export const fromGoogleBooks = (v: any): BookInfo => ({
  title: v.title + (v.subtitle ? ": " + v.subtitle : ""),
  author: (v.authors || []).join(", "),
  pages: v.pageCount,
  pubYear: year(v.publishedDate),
  genres: clip(v.categories, 4),
});

export const fromOpenLibrarySearch = (d: any): BookInfo => ({
  title: d.title,
  author: (d.author_name || []).join(", "),
  pages: d.number_of_pages_median,
  pubYear: d.first_publish_year ? String(d.first_publish_year) : undefined,
  genres: clip(d.subject, 4),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

type Fetch = (url: string) => Promise<{ json(): Promise<unknown> }>;

/** First catalog that knows the ISBN and returns a title, or null. */
export async function lookupIsbn(isbn: string, fetchFn: Fetch = fetch): Promise<BookInfo | null> {
  const get = async (url: string) => (await fetchFn(url)).json() as Promise<Record<string, unknown>>;
  const sources: (() => Promise<BookInfo | null>)[] = [
    async () => {
      const data = await get(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const rec = data["ISBN:" + isbn];
      return rec ? fromOpenLibrary(rec) : null;
    },
    async () => {
      const data = await get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const v = (data.items as { volumeInfo?: unknown }[] | undefined)?.[0]?.volumeInfo;
      return v ? fromGoogleBooks(v) : null;
    },
    async () => {
      const data = await get(`https://openlibrary.org/search.json?isbn=${isbn}&limit=1`);
      const d = (data.docs as unknown[] | undefined)?.[0];
      return d ? fromOpenLibrarySearch(d) : null;
    },
  ];
  for (const source of sources) {
    try {
      const info = await source();
      if (info?.title) return info;
    } catch {}
  }
  return null;
}

/**
 * Copy found values into the draft through the config's `fill` map
 * (lookup key → draft field). Lists merge case-insensitively; empty values skip.
 */
export function applyLookup(d: Draft, fill: Record<string, string>, info: BookInfo): { draft: Draft; filled: string[] } {
  const draft = { ...d };
  const filled: string[] = [];
  for (const [src, dst] of Object.entries(fill)) {
    const v = info[src as keyof BookInfo];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) {
      const cur = Array.isArray(draft[dst]) ? [...(draft[dst] as string[])] : [];
      for (const x of v) if (!cur.some((c) => String(c).toLowerCase() === String(x).toLowerCase())) cur.push(x);
      draft[dst] = cur;
    } else draft[dst] = v;
    filled.push(dst);
  }
  return { draft, filled };
}
