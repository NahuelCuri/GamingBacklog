// Admin storage usage (Settings → Administration), from rpc('admin_usage').

export interface AdminUsageRow {
  user_id?: string;
  email?: string;
  bytes?: number | string;
  rows?: number | null;
}

export interface AdminUsage {
  total_bytes?: number | string;
  limit_bytes?: number | string;
  users?: AdminUsageRow[];
}

/** Supabase free tier database quota. */
export const FREE_TIER_BYTES = 500 * 1024 * 1024;

export function fmtBytes(n: unknown): string {
  let v = Number(n) || 0;
  if (v < 1024) return v + " B";
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < u.length - 1);
  return v.toFixed(v < 10 ? 1 : 0) + " " + u[i];
}

export interface UsageView {
  total: string;
  limit: string;
  /** "12.3%" */
  pct: string;
  /** red over 85%, amber over 60%, accent otherwise */
  pctColor: string;
  users: { key: string; email: string; size: string; barW: string; rows: string; isMe: boolean }[];
}

export function usageView(u: AdminUsage, myUid: string | null): UsageView {
  const limit = Number(u.limit_bytes) || FREE_TIER_BYTES;
  const total = Number(u.total_bytes) || 0;
  const pct = limit ? Math.min(100, (total / limit) * 100) : 0;
  const raw = Array.isArray(u.users) ? u.users : [];
  const maxUser = raw.reduce((m, x) => Math.max(m, Number(x.bytes) || 0), 0) || 1;
  const users = raw
    .slice()
    .sort((a, b) => (Number(b.bytes) || 0) - (Number(a.bytes) || 0))
    .map((x) => {
      const b = Number(x.bytes) || 0;
      return {
        key: x.user_id || x.email || "",
        email: x.email || x.user_id || "unknown",
        size: fmtBytes(b),
        barW: ((b / maxUser) * 100).toFixed(1) + "%",
        rows: x.rows != null ? x.rows + " rows" : "",
        isMe: !!myUid && x.user_id === myUid,
      };
    });
  return {
    total: fmtBytes(total),
    limit: fmtBytes(limit),
    pct: pct.toFixed(1) + "%",
    pctColor: pct > 85 ? "#e6a09c" : pct > 60 ? "#e6d19c" : "var(--accent)",
    users,
  };
}
