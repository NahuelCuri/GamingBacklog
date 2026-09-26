// Ported from legacy-src/wines-config.js (generated, then maintained by hand).
import type { CollectionConfig } from "@/lib/collection/types";

export const wines: CollectionConfig = {
  key: "wines",
  brand: "Backlog",
  kicker: "// wines",
  noun: "wine",
  nounPlural: "wines",
  theme: {
    bg: "#0d0b0f",
    surface: "#141018",
    card: "#151019",
    topchip: "#161119",
    inset: "#100d13",
    chip: "#221a2b",
    chip2: "#191420",
    text: "#ece7ef",
    text2: "#d6cbdd",
    text3: "#c2b4cc",
    muted2: "#a294ad",
    muted: "#8d8095",
    dim: "#5f5468",
    dim2: "#3f3747",
    accent2: "#e2cdec",
    accent: "#c6a9d6",
  },
  fields: { score: "score", hours: "vintage", price: "price", platform: "region" },
  addLabel: "+ Add wine",
  reviewLabel: "Tasting notes",
  reviewPlaceholder: "Nariz, boca, final…",
  reviewEmpty: "No tasting notes yet.",
  emptyTitle: "Your cellar is empty",
  emptySub: "Add your first bottle to get started.",
  searchFields: ["title", "winery", "region", "grape", "pairings", "aging", "storage", "status", "notes", "awards"],
  tagField: "grape",
  statusField: "status",
  statuses: [
    {
      value: "cellar",
      label: "Cellar",
      dot: "var(--accent,#c6a9d6)",
      glow: "0 0 8px color-mix(in srgb, var(--accent) 70%, transparent)",
      text: "var(--accent,#c6a9d6)",
      reelDot: "var(--accent,#c6a9d6)",
      reelGlow: true,
    },
    { value: "opened", label: "Opened", dot: "#8f6ba8", glow: "none", text: "#8d8095", reelDot: "#8f6ba8" },
  ],
  defaultStatus: "cellar",
  statusFilters: [
    { value: "all", label: "All" },
    { value: "cellar", label: "Cellar" },
    { value: "opened", label: "Opened" },
  ],
  table: {
    columns: [
      {
        key: "title",
        label: "Name",
        kind: "text",
        width: "1.6fr",
        mobileWidth: "1fr",
        sortable: true,
        primary: true,
      },
      {
        key: "winery",
        label: "Winery",
        kind: "text",
        width: "1.15fr",
        hideMobile: true,
        sortable: true,
        color: "var(--text2,#d6cbdd)",
      },
      {
        key: "region",
        label: "Region",
        kind: "text",
        width: "1fr",
        hideMobile: true,
        sortable: true,
        color: "var(--text3,#c2b4cc)",
      },
      { key: "grape", label: "Grape", kind: "tags", width: "1.1fr", hideMobile: true },
      {
        key: "vintage",
        label: "Vintage",
        kind: "num",
        width: "72px",
        hideMobile: true,
        right: true,
        mono: true,
        color: "#c2b4cc",
        sortable: true,
      },
      { key: "status", label: "Status", kind: "status", width: "104px", mobileWidth: "86px", sortable: true },
    ],
    chevron: { width: "26px", mobileWidth: "22px" },
  },
  detail: {
    reviewField: "notes",
    fields: [
      { key: "winery", label: "Winery", kind: "text", empty: "—" },
      { key: "region", label: "Region", kind: "text", empty: "—" },
      { key: "vintage", label: "Vintage", kind: "text", empty: "—" },
      { key: "aging", label: "Aging", kind: "text", empty: "—" },
      { key: "storage", label: "Stored in", kind: "text", empty: "—" },
      { key: "grape", label: "Grape / blend", kind: "tags", empty: "—" },
      { key: "pairings", label: "Pairings", kind: "tags", empty: "—" },
      { key: "awards", label: "Awards", kind: "text", empty: "None" },
    ],
  },
  modal: {
    titleField: "title",
    groups: [
      {
        cols: 1,
        fields: [
          { key: "title", label: "Name", kind: "text", placeholder: "Wine name", dupCheck: true },
        ],
      },
      {
        cols: 2,
        fields: [
          { key: "winery", label: "Winery", kind: "text", placeholder: "Bodega" },
          { key: "vintage", label: "Vintage", kind: "number", min: 1900, max: 2035, step: 1 },
        ],
      },
      {
        cols: 1,
        fields: [
          { key: "region", label: "Region", kind: "text", placeholder: "e.g. Mendoza · Rioja · Barossa" },
        ],
      },
      {
        cols: 1,
        fields: [
          {
            key: "aging",
            label: "Aging (crianza)",
            kind: "enum",
            options: ["Joven", "Crianza", "Reserva", "Gran Reserva"],
          },
        ],
      },
      {
        cols: 1,
        fields: [
          { key: "storage", label: "Stored in", kind: "enum", options: ["Kitchen", "Bedroom chest"] },
        ],
      },
      {
        cols: 1,
        fields: [
          { key: "status", label: "Status", kind: "status" },
        ],
      },
      {
        cols: 1,
        fields: [
          { key: "grape", label: "Grape / varietals — add each for a blend", kind: "tags" },
        ],
      },
      {
        cols: 1,
        fields: [
          { key: "pairings", label: "Suggested pairings", kind: "tags" },
        ],
      },
      {
        cols: 1,
        fields: [
          {
            key: "awards",
            label: "Awards (optional)",
            kind: "longtext",
            placeholder: "Medals, scores, competitions…",
          },
        ],
      },
      {
        cols: 1,
        fields: [
          { key: "notes", label: "Tasting notes", kind: "longtext", placeholder: "Nariz, boca, final…" },
        ],
      },
    ],
    numberFields: [],
    yearFields: ["vintage"],
    textFields: ["winery", "region", "aging", "storage", "awards", "notes"],
  },
  geo: {
    field: "region",
    label: "Argentine origins",
    subtitle: "Provinces with bottles glow — hover for counts, click to zoom in. Includes las Islas Malvinas.",
  },
  stats: {
    summary: [
      { kind: "count", label: "Total wines" },
      { kind: "statusCount", status: "cellar", label: "In cellar", accent: true },
      { kind: "statusCount", status: "opened", label: "Opened", accent: true },
      { kind: "completion", status: "opened", label: "Enjoyed" },
    ],
    strip: [
      { kind: "count", label: "wines" },
      { kind: "statusCount", status: "cellar", label: "in cellar", accent: true },
      { kind: "statusCount", status: "opened", label: "opened" },
      { kind: "completion", status: "opened", label: "enjoyed" },
    ],
    left: [
      {
        kind: "barList",
        title: "Top regions",
        field: "#region",
        top: 8,
        barColor: "var(--accent,#c6a9d6)",
        barOpacity: ".9",
        valColor: "#8d8095",
        compact: true,
      },
      {
        kind: "barList",
        title: "Grapes & varietals",
        field: "#grape",
        top: 10,
        barColor: "#8f6ba8",
        valColor: "#8d8095",
        compact: true,
      },
      { kind: "byYear", title: "By vintage", field: "vintage" },
    ],
    right: [
      {
        kind: "statusDonut",
        title: "Cellar status",
        center: { status: "cellar", label: "cellared" },
        segments: [
          { status: "cellar", color: "{accent}", legendColor: "{accent}" },
          { status: "opened", color: "#8f6ba8", legendColor: "#8f6ba8" },
        ],
      },
      {
        kind: "barList",
        title: "Aging styles",
        field: "#aging",
        top: 6,
        barColor: "var(--accent,#c6a9d6)",
        barOpacity: ".85",
        valColor: "#8d8095",
        compact: true,
      },
      {
        kind: "barList",
        title: "Storage",
        field: "#storage",
        top: 4,
        barColor: "#a294ad",
        valColor: "#8d8095",
        compact: true,
      },
      {
        kind: "barList",
        title: "Top pairings",
        field: "#pairings",
        top: 8,
        barColor: "#8f6ba8",
        valColor: "#8d8095",
        compact: true,
      },
    ],
    shareModules: [
      { key: "summary", label: "Overview", default: true },
      { key: "status", label: "Cellar status", default: true },
    ],
    shareYearField: "vintage",
  },
};
