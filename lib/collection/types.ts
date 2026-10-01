// Types for the config-driven collections. A CollectionConfig fully describes a
// library (fields, table, modal, roulette, stats) so the shared components can
// render any collection with no collection-specific code. Shapes mirror the
// legacy *-config.js files 1:1 (see legacy-src/).

/** A stored row. Fields are defined by the collection config. */
export type Item = { id: string } & Record<string, unknown>;

export type CollectionKey = "games" | "books" | "wines" | "movies" | "expenses";

/** `{ field, eq | neq | in | notIn }` — a null/undefined condition always matches. */
export type Cond =
  | { field: string; eq: unknown }
  | { field: string; neq: unknown }
  | { field: string; in: unknown[] }
  | { field: string; notIn: unknown[] };

/**
 * Money-bucket selector:
 * `'all'` → everything · `'owned'` (string) → item[str] truthy ·
 * `{ field, eq | in | notIn }` → field comparison.
 */
export type Selector = "all" | string | { field: string; eq?: unknown; in?: unknown[]; notIn?: unknown[] } | null | undefined;

export type Theme = Record<
  | "bg" | "surface" | "card" | "topchip" | "inset" | "chip" | "chip2"
  | "text" | "text2" | "text3" | "muted2" | "muted" | "dim" | "dim2"
  | "accent" | "accent2",
  string
>;

export interface StatusDef {
  value: string;
  label: string;
  dot: string;
  glow: string;
  text: string;
  reelDot?: string;
  reelGlow?: boolean;
}

/** Toolbar chip. `bool` filters on a boolean flag instead of the status field. */
export interface FilterChip {
  value: string;
  label: string;
  bool?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  kind: "text" | "tags" | "status" | "num" | "score" | "money";
  width: string;
  mobileWidth?: string;
  sortable?: boolean;
  primary?: boolean;
  hideMobile?: boolean;
  right?: boolean;
  mono?: boolean;
  unit?: string;
  color?: string;
}

export interface SearchLink {
  url: string; // {token} template, e.g. "https://x/?q={title}"
  title: string;
  pulseWhenEmpty?: boolean;
}

export interface DetailField {
  key: string;
  label: string;
  kind: "text" | "yesno" | "money2" | "tags";
  empty?: string;
  searchLink?: SearchLink;
  showWhen?: Cond;
}

export interface LookupConfig {
  source: string;
  /** normalized lookup key → draft field */
  fill: Record<string, string>;
}

export interface ModalField {
  key: string;
  label: string;
  kind: "text" | "number" | "date" | "longtext" | "tags" | "status" | "enum" | "combo" | "toggle";
  placeholder?: string;
  dupCheck?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  suggest?: string[];
  onColor?: string;
  lookup?: LookupConfig;
}

export interface ModalGroup {
  cols: 1 | 2 | 3;
  showWhen?: Cond;
  fields: ModalField[];
}

export interface BandOption {
  value: string;
  label: string;
  /** exclusive lower bound */
  min?: number;
  /** inclusive upper bound */
  max?: number;
}

export interface RouletteConfig {
  defaultStatus: string;
  statusFilters: FilterChip[];
  band?: { label: string; field: string; options: BandOption[] };
  /** Under each reel card: the first non-null field, `{v}` replaced by its value. */
  reelSub?: { field: string; tpl: string }[];
  winnerScoreField: string;
  winnerSubField: string;
  winnerSubSuffix?: string;
  startAction: { field: string; value: string; label: string; activeLabel: string };
}

// ---------------------------------------------------------------- stats specs

export type MetricSpec = {
  label: string;
  accent?: boolean;
  color?: string;
} & (
  | { kind: "count" }
  | { kind: "statusCount"; status: string }
  | { kind: "boolCount"; field: string }
  /** `divide` turns units (e.g. minutes → hours, rounded). */
  | { kind: "sum"; field: string; match?: Selector; divide?: number }
  | { kind: "avg"; field: string }
  | { kind: "completion"; status: string }
  | { kind: "moneySum"; field?: string; match?: Selector; bool?: string }
  | { kind: "net" }
  | { kind: "savingsRate" }
  | { kind: "avgPerDay" }
  | { kind: "maxAmount" }
  | { kind: "accountSum"; account?: string; exclude?: string[] }
  /** Mean of field − vs, signed, over items with both set. */
  | { kind: "avgDelta"; field: string; vs: string }
  /** Σfield / Σover − 1 as a signed percent, over items with both set. */
  | { kind: "ratio"; field: string; over: string; match?: Selector }
  /** Σfield / Σper (a field, or days between two dates), over items with both set. */
  | { kind: "perUnit"; field: string; per?: string; perDays?: DaySpan; match?: Selector; money?: boolean }
);

export type MetricKind = MetricSpec["kind"];

/** Days from one date field to another, both ends counted. */
export interface DaySpan {
  from: string;
  to: string;
}

interface WidgetBase {
  title: string;
  barColor?: string;
  barOpacity?: string;
  valColor?: string;
  hideWhenEmpty?: boolean;
  top?: number;
}

export interface BarListSpec extends WidgetBase {
  kind: "barList";
  /** A plain field ranks items by value; `#field` counts values (arrays count each entry). */
  field: string;
  dir?: "asc" | "desc";
  podium?: boolean;
  scale?: number;
  suffix?: string;
  money2?: boolean;
  compact?: boolean;
  where?: { field: string; eq: unknown };
}

export interface HistogramSpec extends WidgetBase {
  kind: "histogram";
  field: string;
  buckets?: number;
}

export interface ByYearSpec extends WidgetBase {
  kind: "byYear";
  field: string;
  fromDate?: boolean;
}

export interface TagRatingSpec extends WidgetBase {
  kind: "tagRating";
  tag?: string;
  field?: string;
  scale?: number;
  minCount?: number;
  labelWidth?: string;
}

export interface StatusDonutSpec extends WidgetBase {
  kind: "statusDonut";
  center: { status: string; label: string };
  /** `{accent}` in a color is replaced with the active accent. */
  segments: { status: string; color: string; legendColor?: string }[];
}

export interface MoneyDonutGroup {
  label: string;
  match?: Selector;
  bool?: string;
  color: string;
}

export interface MoneyDonutSpec extends WidgetBase {
  kind: "moneyDonut";
  field?: string;
  groups?: MoneyDonutGroup[];
  yearFilter: string;
  /** Field to take the year from when `yearFilter` is empty. */
  yearFallback?: string;
  /** Derive slices from the distinct values of this field instead of `groups`. */
  dynamicGroup?: string;
  type?: string;
  centerLabel?: string;
  /** Center total from these items instead of the sum of all slices. */
  centerMatch?: Selector;
}

export interface SumBarsSpec extends WidgetBase {
  kind: "sumBars";
  group: string;
  type?: string;
  labelWidth?: string;
}

export interface WeekdaySpec extends WidgetBase {
  kind: "weekday";
}

export interface TrendSpec extends WidgetBase {
  kind: "trend";
  type?: string;
  /** How many periods to show. */
  months?: number;
  /** Date field to bucket by (default `date`), and one to fall back to when it is empty. */
  dateField?: string;
  fallbackField?: string;
  /** Filter items with a selector instead of by `type`. */
  match?: Selector;
  period?: "month" | "year";
  /** Sum this field as a plain number instead of the price as money. */
  valueField?: string;
}

/** Items ranked by field / per (e.g. price per hour, pages per day). */
export interface RatioListSpec extends WidgetBase {
  kind: "ratioList";
  field: string;
  per?: string;
  perDays?: DaySpan;
  money?: boolean;
  match?: Selector;
  dir?: "asc" | "desc";
  suffix?: string;
}

/** Items ranked by how far field is from vs (e.g. hours played vs HLTB). */
export interface DeltaListSpec extends WidgetBase {
  kind: "deltaList";
  field: string;
  vs: string;
  suffix?: string;
  /** Color for items below `vs` (barColor is above). */
  negColor?: string;
  /** Axis captions for each side. */
  negLabel?: string;
  posLabel?: string;
}

/** Oldest items by a date field, with their age. */
export interface AgeListSpec extends WidgetBase {
  kind: "ageList";
  field: string;
  match?: Selector;
}

/** How many years passed between two year/date fields, bucketed. */
export interface YearGapSpec extends WidgetBase {
  kind: "yearGap";
  from: string;
  to: string;
}

export interface HeatmapSpec extends WidgetBase {
  kind: "heatmap";
  weeks?: number;
}

export type WidgetSpec =
  | BarListSpec
  | HistogramSpec
  | ByYearSpec
  | TagRatingSpec
  | StatusDonutSpec
  | MoneyDonutSpec
  | SumBarsSpec
  | WeekdaySpec
  | TrendSpec
  | HeatmapSpec
  | RatioListSpec
  | DeltaListSpec
  | AgeListSpec
  | YearGapSpec;

export interface ShareModule {
  key: string;
  label: string;
  default: boolean;
}

export interface StatsConfig {
  summary: MetricSpec[];
  strip: MetricSpec[];
  left: WidgetSpec[];
  right: WidgetSpec[];
  shareModules: ShareModule[];
  shareYearField: string;
}

export interface CurrencyConfig {
  base: string;
  baseSymbol: string;
  alt: string;
  altSymbol: string;
  fallbackRate: number;
  api?: string;
}

// ---------------------------------------------------------------- config

export interface CollectionConfig {
  key: CollectionKey;
  brand: string;
  kicker: string;
  noun: string;
  nounPlural: string;
  theme: Theme;
  /** Aliases so shared stats/share builders work with differently-named fields. */
  fields: { score: string; hours: string; price: string; platform: string };
  addLabel: string;
  reviewLabel: string;
  reviewPlaceholder: string;
  reviewEmpty: string;
  emptyTitle: string;
  emptySub: string;

  searchFields: string[];
  tagField: string;
  statusField: string;
  statuses: StatusDef[];
  defaultStatus: string;
  statusFilters: FilterChip[];

  table: {
    columns: TableColumn[];
    chevron: { width: string; mobileWidth?: string };
  };
  detail: {
    reviewField: string;
    fields: DetailField[];
    cornerLink?: { field: string; url: string; label: string; pulseWhenEmpty?: boolean };
  };
  modal: {
    titleField: string;
    autoDateField?: string;
    groups: ModalGroup[];
    numberFields?: string[];
    yearFields?: string[];
    boolFields?: string[];
    textFields?: string[];
  };
  roulette?: RouletteConfig;
  stats: StatsConfig;

  // optional features
  libraryLabel?: string;
  /** Library shows only the latest month until a filter or "Load all" lifts it. */
  ledgerMonth?: boolean;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  categoryField?: string;
  dynamicCategories?: boolean;
  categoryFilters?: FilterChip[];
  /** Transfers name a destination account; cleared for other types on save. */
  accountField?: string;
  months?: { label: string };
  geo?: { field?: string; label?: string; subtitle?: string };
  currency?: CurrencyConfig;
}
