// ============================================================================
//  EXPENSES collection config — a finance tracker built on the same shared
//  components as Games / Books / Wines. The model is EVENT-centric: one row =
//  one transaction (date · description · amount · type · category · notes).
//  Base amounts are stored in USD; the header currency toggle (cfg.currency)
//  re-renders every money value in ARS via a live rate.
//  New pieces this config exercises: statusField='type', a `money` table column,
//  finance metric kinds (net / savingsRate / avgPerDay / maxAmount) and the
//  sumBars / trend / heatmap / weekday stat widgets, plus a `months` block that
//  turns on the Months drill-down tab.
// ============================================================================
window.EXPENSES_CONFIG = {
  key: 'expenses',
  brand: 'Backlog',
  kicker: '// expenses',
  noun: 'transaction',
  nounPlural: 'transactions',
  libraryLabel: 'Ledger',        // renames the first tab for this collection
  ledgerMonth: true,             // library defaults to the current month only
  defaultSort: { key: 'date', dir: 'desc' },  // newest first by default
  categoryField: 'category',
  dynamicCategories: true,        // category list is derived from what the user records, not fixed
  accountField: 'account',       // transfers name a destination account (Savings / Investing / …)

  // cool teal on a near-black — distinct from games green / books tan / wines plum
  theme: {
    bg: '#0b0e0f', surface: '#111517', card: '#121618', topchip: '#131719',
    inset: '#0e1213', chip: '#1b2225', chip2: '#151b1d',
    text: '#e6ecec', text2: '#c6d4d5', text3: '#b4c2c3', muted2: '#93a3a4',
    muted: '#83908f', dim: '#556062', dim2: '#374042', accent2: '#c2e4e6',
    accent: '#8ecfd6',
  },

  // price = the amount field (all money math sums this); the rest point at real
  // fields so the shared share/stats builders never touch a missing key.
  fields: { score: 'amount', hours: 'amount', price: 'amount', platform: 'category' },
  addLabel: '+ Add transaction',
  reviewLabel: 'Note',
  reviewPlaceholder: 'What was this for…',
  reviewEmpty: 'No note.',
  emptyTitle: 'No transactions yet',
  emptySub: 'Add your first transaction — or load a sample month to explore.',

  searchFields: ['title', 'category', 'type', 'notes', 'date', 'account'],
  tagField: 'tags',        // unused by finance; kept so the shared tag code is inert
  statusField: 'type',

  // ---- transaction TYPE takes the place of "status" ----
  statuses: [
    { value: 'expense',  label: 'Expense',  dot: '#d98f8f',               glow: 'none', text: 'var(--text2,#c6d4d5)' },
    { value: 'income',   label: 'Income',   dot: 'var(--accent,#8ecfd6)', glow: '0 0 8px color-mix(in srgb, var(--accent) 70%, transparent)', text: 'var(--accent,#8ecfd6)' },
    { value: 'transfer', label: 'Transfer', dot: 'transparent',           glow: 'inset 0 0 0 1.5px #46514f', text: 'var(--muted,#83908f)' },
  ],
  defaultStatus: 'expense',

  statusFilters: [
    { value: 'all', label: 'All' },
    { value: 'expense', label: 'Expenses' },
    { value: 'income', label: 'Income' },
    { value: 'transfer', label: 'Transfers' },
  ],

  // second filter row: by category — derived dynamically from recorded data
  // (dynamicCategories above). This static list is a fallback only.
  categoryFilters: [
    { value: 'all', label: 'All' },
  ],

  // ========================================================================
  //  TABLE — one row per transaction
  // ========================================================================
  table: {
    columns: [
      { key: 'title',    label: 'Description', kind: 'text',   width: '1.7fr', mobileWidth: '1fr', sortable: true, primary: true },
      { key: 'category', label: 'Category',    kind: 'text',   width: '1fr',   hideMobile: true, sortable: true, color: 'var(--text3,#b4c2c3)' },
      { key: 'date',     label: 'Date',        kind: 'num',    width: '96px',  hideMobile: true, right: true, mono: true, color: 'var(--muted,#83908f)', sortable: true },
      { key: 'type',     label: 'Type',        kind: 'status', width: '108px', mobileWidth: '92px', sortable: true },
      { key: 'amount',   label: 'Amount',      kind: 'money',  width: '104px', mobileWidth: '86px', right: true, sortable: true },
    ],
    chevron: { width: '26px', mobileWidth: '22px' },
  },

  detail: {
    reviewField: 'notes',
    fields: [
      { key: 'date',     label: 'Date',     kind: 'text',   empty: '—' },
      { key: 'type',     label: 'Type',     kind: 'text',   empty: '—' },
      { key: 'category', label: 'Category', kind: 'text',   empty: '—' },
      { key: 'account',  label: 'Account',  kind: 'text',   empty: '—' },
      { key: 'amount',   label: 'Amount',   kind: 'money2', empty: '—' },
    ],
  },

  // ========================================================================
  //  MODAL — add / edit a transaction
  // ========================================================================
  modal: {
    titleField: 'title',
    autoDateField: 'date',   // new transactions default to today
    groups: [
      { cols: 1, fields: [{ key: 'title', label: 'Description', kind: 'text', placeholder: 'e.g. Steam · McDonald\u2019s · Salary' }] },
      { cols: 1, fields: [{ key: 'type', label: 'Type', kind: 'status' }] },
      { cols: 1, fields: [{ key: 'category', label: 'Category', kind: 'combo', placeholder: 'Type a category… e.g. Food, Rent, Meds', suggest: ['Food', 'Housing', 'Transport', 'Games', 'Subs', 'Health', 'Income', 'Other'] }] },
      { cols: 1, showWhen: { field: 'type', eq: 'transfer' }, fields: [{ key: 'account', label: 'Transfer to account', kind: 'enum', options: ['Savings', 'Investing', 'USD'] }] },
      { cols: 2, fields: [
        { key: 'amount', label: 'Amount', kind: 'number', min: 0, step: 0.01, placeholder: '0.00' },
        { key: 'date', label: 'Date', kind: 'date' },
      ] },
      { cols: 1, fields: [{ key: 'notes', label: 'Note', kind: 'longtext', placeholder: 'What was this for…' }] },
    ],
    numberFields: ['amount'],
    textFields: ['category', 'date', 'notes', 'account'],
  },

  // No roulette / geo blocks.
  // ========================================================================
  //  MONTHS — turns on the Months drill-down tab (per-month cards + calendar)
  // ========================================================================
  months: { label: 'Months' },

  // ========================================================================
  //  STATS
  // ========================================================================
  stats: {
    summary: [
      { kind: 'moneySum', match: { field: 'type', eq: 'expense' }, label: 'Spent', accent: true },
      { kind: 'moneySum', match: { field: 'type', eq: 'income' }, label: 'Income' },
      { kind: 'net', label: 'Net' },
      { kind: 'count', label: 'Transactions' },
      { kind: 'avgPerDay', label: 'Avg / day' },
      { kind: 'maxAmount', label: 'Largest' },
      { kind: 'accountSum', label: 'Saved', accent: true, exclude: ['USD'] },
      { kind: 'accountSum', account: 'Investing', label: 'Invested' },
      { kind: 'accountSum', account: 'USD', label: 'USD saved' },
      { kind: 'savingsRate', label: 'Savings rate', accent: true },
    ],
    strip: [
      { kind: 'moneySum', match: { field: 'type', eq: 'expense' }, label: 'spent', accent: true },
      { kind: 'moneySum', match: { field: 'type', eq: 'income' }, label: 'income' },
      { kind: 'net', label: 'net' },
      { kind: 'count', label: 'transactions' },
      { kind: 'avgPerDay', label: 'avg/day' },
      { kind: 'accountSum', label: 'saved', accent: true },
    ],
    left: [
      { kind: 'sumBars', title: 'Spending by category', group: 'category', type: 'expense', top: 8, barColor: 'var(--accent,#8ecfd6)', valColor: 'var(--accent2,#c2e4e6)' },
      { kind: 'trend', title: 'Monthly spending', type: 'expense', months: 12, barColor: 'var(--accent,#8ecfd6)' },
      { kind: 'sumBars', title: 'Contributions by account', group: 'account', type: 'transfer', top: 6, barColor: 'oklch(0.72 0.11 160)', valColor: 'var(--accent2,#c2e4e6)' },
      { kind: 'trend', title: 'Monthly contributions', type: 'transfer', months: 12, barColor: 'oklch(0.72 0.11 160)' },
      { kind: 'barList', title: 'Biggest expenses', field: 'amount', where: { field: 'type', eq: 'expense' }, dir: 'desc', top: 8, money2: true, barColor: '#d98f8f', valColor: '#e2b0b0' },
      { kind: 'heatmap', title: 'Daily spending', weeks: 26 },
    ],
    right: [
      { kind: 'moneyDonut', title: 'Category split', field: 'amount', yearFilter: '_noyear', dynamicGroup: 'category', type: 'expense', top: 8 },
      { kind: 'statusDonut', title: 'Transaction mix', center: { status: 'expense', label: 'expenses' },
        segments: [
          { status: 'expense',  color: '#d98f8f',              legendColor: '#d98f8f' },
          { status: 'income',   color: '{accent}',             legendColor: '{accent}' },
          { status: 'transfer', color: 'var(--wi)', legendColor: 'var(--wl)' },
        ] },
      { kind: 'weekday', title: 'Spending by weekday', barColor: 'var(--accent,#8ecfd6)' },
      { kind: 'moneyDonut', title: 'Savings & investing split', field: 'amount', yearFilter: '_noyear', centerLabel: 'contributed', groups: [
        { label: 'Savings', match: { field: 'account', eq: 'Savings' }, color: 'oklch(0.72 0.11 160)' },
        { label: 'Investing', match: { field: 'account', eq: 'Investing' }, color: 'oklch(0.72 0.11 260)' },
        { label: 'USD', match: { field: 'account', eq: 'USD' }, color: 'oklch(0.72 0.11 130)' },
      ] },
    ],
    shareModules: [
      { key: 'summary', label: 'Overview', default: true },
      { key: 'status', label: 'Transaction mix', default: true },
    ],
    shareYearField: '_noyear',
  },
};

window.COLLECTION_CONFIGS = window.COLLECTION_CONFIGS || {};
window.COLLECTION_CONFIGS[window.EXPENSES_CONFIG.key] = window.EXPENSES_CONFIG;
