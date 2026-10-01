// Cached Intl formatters. Number.toLocaleString and Date.toLocaleDateString
// build a formatter on every call, which shows up wherever we format per row,
// per card or per animation frame: measured at ~24x (numbers) and ~55x (dates)
// slower than reusing one. Formatters are immutable, so one per option set is
// enough; the key covers the locale and the options that vary.

const numbers = new Map<string, Intl.NumberFormat>();
const dates = new Map<string, Intl.DateTimeFormat>();

/** `Intl.NumberFormat` for these options, built once. `locale` undefined = the browser's. */
export function numberFormat(locale: string | undefined, opts?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = (locale ?? "") + "|" + (opts ? JSON.stringify(opts) : "");
  let f = numbers.get(key);
  if (!f) numbers.set(key, (f = new Intl.NumberFormat(locale, opts)));
  return f;
}

/** `Intl.DateTimeFormat` for these options, built once. `locale` undefined = the browser's. */
export function dateFormat(locale: string | undefined, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = (locale ?? "") + "|" + (opts ? JSON.stringify(opts) : "");
  let f = dates.get(key);
  if (!f) dates.set(key, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
}
