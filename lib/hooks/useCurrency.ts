"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurrencyConfig } from "@/lib/collection/types";
import { moneyFormat, usd, type MoneyFormat } from "@/lib/spending";

export type CurrencyChoice = "base" | "alt";

export interface CurrencyToggle {
  cfg: CurrencyConfig;
  choice: CurrencyChoice;
  setChoice(c: CurrencyChoice): void;
}

/** Reads `{ rates: { [alt]: number } }`; anything else keeps the fallback rate. */
export async function fetchRate(cur: CurrencyConfig, get: typeof fetch = fetch): Promise<number | null> {
  if (!cur.api) return null;
  try {
    const j = await (await get(cur.api)).json();
    const r = Number(j?.rates?.[cur.alt]);
    return r > 0 ? r : null;
  } catch {
    return null;
  }
}

export function currencyMoney(cur: CurrencyConfig | undefined, choice: CurrencyChoice, rate: number | null): MoneyFormat {
  if (!cur) return usd;
  return choice === "alt"
    ? moneyFormat({ code: cur.alt, symbol: cur.altSymbol, rate: rate || cur.fallbackRate })
    : moneyFormat({ code: cur.base, symbol: cur.baseSymbol, rate: 1 });
}

/**
 * Display currency for finance collections (`cfg.currency`). Amounts are stored
 * in the base currency; the alternative is shown via a live rate, falling back
 * to `fallbackRate`. Like legacy, the choice resets when the page loads.
 */
export function useCurrency(cur: CurrencyConfig | undefined) {
  const [choice, setChoice] = useState<CurrencyChoice>("base");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    if (!cur?.api) return;
    let live = true;
    fetchRate(cur).then((r) => live && r && setRate(r));
    return () => {
      live = false;
    };
  }, [cur]);

  const money = useMemo(() => currencyMoney(cur, choice, rate), [cur, choice, rate]);
  const toggle = useMemo<CurrencyToggle | null>(() => (cur ? { cfg: cur, choice, setChoice } : null), [cur, choice]);
  return { money, toggle };
}
