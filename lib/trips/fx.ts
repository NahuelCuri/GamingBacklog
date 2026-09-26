// Currency quick-convert for the Trip Planner (Cards tab), from legacy.
// Rates from open.er-api.com; the chosen pair is remembered per device.

export const FX_CCY = [
  { c: "USD", n: "US Dollar", s: "$" }, { c: "EUR", n: "Euro", s: "€" }, { c: "GBP", n: "British Pound", s: "£" }, { c: "JPY", n: "Japanese Yen", s: "¥" },
  { c: "AUD", n: "Australian Dollar", s: "A$" }, { c: "CAD", n: "Canadian Dollar", s: "C$" }, { c: "CHF", n: "Swiss Franc", s: "Fr" }, { c: "CNY", n: "Chinese Yuan", s: "¥" },
  { c: "HKD", n: "Hong Kong Dollar", s: "HK$" }, { c: "NZD", n: "New Zealand Dollar", s: "NZ$" }, { c: "SGD", n: "Singapore Dollar", s: "S$" }, { c: "KRW", n: "South Korean Won", s: "₩" },
  { c: "INR", n: "Indian Rupee", s: "₹" }, { c: "MXN", n: "Mexican Peso", s: "$" }, { c: "BRL", n: "Brazilian Real", s: "R$" }, { c: "ZAR", n: "South African Rand", s: "R" },
  { c: "THB", n: "Thai Baht", s: "฿" }, { c: "IDR", n: "Indonesian Rupiah", s: "Rp" }, { c: "MYR", n: "Malaysian Ringgit", s: "RM" }, { c: "PHP", n: "Philippine Peso", s: "₱" },
  { c: "TRY", n: "Turkish Lira", s: "₺" }, { c: "ILS", n: "Israeli Shekel", s: "₪" }, { c: "SEK", n: "Swedish Krona", s: "kr" }, { c: "NOK", n: "Norwegian Krone", s: "kr" },
  { c: "DKK", n: "Danish Krone", s: "kr" }, { c: "PLN", n: "Polish Zloty", s: "zł" }, { c: "CZK", n: "Czech Koruna", s: "Kč" }, { c: "HUF", n: "Hungarian Forint", s: "Ft" },
  { c: "RON", n: "Romanian Leu", s: "lei" }, { c: "BGN", n: "Bulgarian Lev", s: "лв" }, { c: "ISK", n: "Icelandic Krona", s: "kr" },
] as const;

export const ccy = (code: string) => FX_CCY.find((o) => o.c === code);

export function searchCcy(q: string) {
  const s = q.trim().toLowerCase();
  return FX_CCY.filter((o) => !s || o.c.toLowerCase().includes(s) || o.n.toLowerCase().includes(s) || o.s.toLowerCase().includes(s));
}

/** Legacy key and shape: { f, t }. */
export const FX_PREF_KEY = "trip-fx-pref";

export function readFxPref(): { from: string; to: string } {
  try {
    const p = JSON.parse(localStorage.getItem(FX_PREF_KEY) || "null");
    if (p && p.f && p.t) return { from: p.f, to: p.t };
  } catch {
    /* ignore */
  }
  return { from: "EUR", to: "USD" };
}

export function saveFxPref(from: string, to: string) {
  try {
    localStorage.setItem(FX_PREF_KEY, JSON.stringify({ f: from, t: to }));
  } catch {
    /* ignore */
  }
}

/** Rate from → to and the provider's update date ("26 Sep 2026"). */
export async function fetchFx(from: string, to: string, get: typeof fetch = fetch): Promise<{ rate: number; updated: string }> {
  if (from === to) return { rate: 1, updated: "same currency" };
  const r = await get(`https://open.er-api.com/v6/latest/${from}`);
  if (!r.ok) throw new Error("http");
  const d = await r.json();
  const rate = d?.rates?.[to];
  if (rate == null) throw new Error("norate");
  const utc: string = d.time_last_update_utc || "";
  const parts = utc.split(" ");
  return { rate, updated: parts.length >= 4 ? parts.slice(1, 4).join(" ") : utc };
}

export const nfx = (v: number | null | undefined, dec: number) =>
  v == null || isNaN(v) ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const rateLine = (from: string, to: string, rate: number) => "1 " + from + " = " + nfx(rate, rate < 1 ? 6 : 4) + " " + to;
