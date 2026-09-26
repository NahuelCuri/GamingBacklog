// ============================================================================
//  GAMES collection config.
//  A "collection config" fully describes a library (Games now; Books, Wines
//  later) so the shared components (ItemTable, ItemModal, StatsView,
//  ShareImage, Roulette) can render it without any collection-specific code.
//  Everything here is plain data + {token} url templates — no functions — so a
//  new collection is just a copy of this file with different fields/widgets.
// ============================================================================
window.GAMES_CONFIG = {
  key: 'games',
  brand: 'Backlog',
  kicker: '// games',
  noun: 'game',
  nounPlural: 'games',

  // ---- palette: applied as CSS custom properties on the document root, so a
  //  new collection just supplies a different set here. Any omitted token falls
  //  back to the games value baked into each component (var(--token,#games)).
  theme: {
    bg: '#0d0f0e', surface: '#121412', card: '#141614', topchip: '#151816',
    inset: '#0f110f', chip: '#20241f', chip2: '#181b19',
    text: '#e8ebe8', text2: '#c8d6cb', text3: '#b7bfb9', muted2: '#9aa39c',
    muted: '#8b938d', dim: '#59605b', dim2: '#3a413c', accent2: '#c2e6cd',
    accent: '#9ce6b0',
  },

  // ---- field aliases used by the shared stats/share builders so a collection
  //  with differently-named numeric fields still works by copy-config only.
  fields: { score: 'score', hours: 'hours', price: 'price', platform: 'platform' },
  addLabel: '+ Add game',
  reviewLabel: 'Mi opinión',
  reviewPlaceholder: 'Tus pensamientos sobre el juego…',
  reviewEmpty: 'Sin notas todavía.',
  emptyTitle: 'Your backlog is empty',
  emptySub: 'Add your first game to get started.',

  // which item fields the library search box scans
  searchFields: ['title', 'tags', 'platform', 'status', 'review'],
  tagField: 'tags',
  statusField: 'status',

  // ---- status vocabulary (dot / glow / text styling reused everywhere) ----
  statuses: [
    { value: 'playing', label: 'Playing', dot: 'var(--accent,#9ce6b0)', glow: '0 0 8px color-mix(in srgb, var(--accent) 70%, transparent)', text: 'var(--accent,#9ce6b0)', reelDot: 'var(--accent,#9ce6b0)', reelGlow: true },
    { value: 'played',  label: 'Played',  dot: '#5b9e73',               glow: 'none',                          text: '#8b938d', reelDot: '#6f9a7d' },
    { value: 'backlog', label: 'Backlog', dot: 'transparent',           glow: 'inset 0 0 0 1.5px #4a514c',     text: '#8b938d', reelDot: '#8b938d' },
  ],
  defaultStatus: 'backlog',

  // ---- library toolbar status filter chips (in order) ----
  //  {value} matches statusField; {bool:'owned'} filters on a boolean flag instead
  statusFilters: [
    { value: 'all', label: 'All' },
    { value: 'playing', label: 'Playing' },
    { value: 'played', label: 'Played' },
    { value: 'backlog', label: 'Backlog' },
    { value: 'owned', label: 'Owned', bool: 'owned' },
  ],

  // ========================================================================
  //  TABLE — collapsed columns + expanded detail panel
  // ========================================================================
  table: {
    // collapsed-row columns, left→right (chevron is appended automatically)
    columns: [
      { key: 'title',  label: 'Title',  kind: 'text',   width: '1.7fr',  mobileWidth: '1fr', sortable: true, primary: true },
      { key: 'tags',   label: 'Tags',   kind: 'tags',   width: '1.35fr', hideMobile: true },
      { key: 'status', label: 'Status', kind: 'status', width: '108px',  mobileWidth: '78px', sortable: true },
      { key: 'hours',  label: 'Hrs',    kind: 'num',    width: '64px',   hideMobile: true, right: true, mono: true, unit: 'h', color: 'var(--text2,#c8d6cb)', sortable: true },
      { key: 'hltb',   label: 'HLTB',   kind: 'num',    width: '64px',   hideMobile: true, right: true, mono: true, unit: 'h', color: 'var(--muted,#8b938d)', sortable: true },
      { key: 'score',  label: 'Score',  kind: 'score',  width: '58px',   mobileWidth: '50px', right: true, mono: true, sortable: true },
    ],
    chevron: { width: '26px', mobileWidth: '22px' },
  },

  detail: {
    reviewField: 'review',
    // right-hand metadata grid (2 cols)
    fields: [
      { key: 'releaseDate',   label: 'Release',   kind: 'text',  empty: '—',
        searchLink: { url: 'https://www.google.com/search?q={title} release date', title: 'Search release date', pulseWhenEmpty: true } },
      { key: 'yearCompleted', label: 'Completed', kind: 'text',  empty: '—' },
      { key: 'owned',         label: 'Owned',     kind: 'yesno' },
      { key: 'platform',      label: 'Platform',  kind: 'text',  empty: '—' },
      { key: 'price',         label: 'Price',     kind: 'money2', empty: '—',
        searchLink: { url: 'https://store.steampowered.com/search?term={title}', title: 'Search Steam price', pulseWhenEmpty: true } },
    ],
    // bottom-right corner button
    cornerLink: { field: 'hltb', url: 'https://howlongtobeat.com/?q={title}', label: 'HLTB ↗', pulseWhenEmpty: true },
  },

  // ========================================================================
  //  MODAL — add/edit form, grouped into rows
  // ========================================================================
  modal: {
    titleField: 'title',
    // each group is one visual block; `cols` lays fields side by side
    groups: [
      { cols: 1, fields: [{ key: 'title', label: 'Title', kind: 'text', placeholder: 'Game title', dupCheck: true }] },
      { cols: 1, fields: [{ key: 'tags', label: 'Tags', kind: 'tags' }] },
      { cols: 1, fields: [{ key: 'status', label: 'Status', kind: 'status' }] },
      { cols: 3, fields: [
        { key: 'score', label: 'Score /10', kind: 'number', min: 0, max: 10, step: 0.5 },
        { key: 'hours', label: 'Hours', kind: 'number', min: 0, step: 0.5 },
        { key: 'hltb', label: 'HLTB', kind: 'number', min: 0, step: 0.5 },
      ] },
      { cols: 3, fields: [
        { key: 'releaseDate', label: 'Release date', kind: 'date' },
        { key: 'yearCompleted', label: 'Year completed', kind: 'number', min: 1980, max: 2030 },
        { key: 'price', label: 'Price', kind: 'number', min: 0, step: 0.01 },
      ] },
      { cols: 1, fields: [{ key: 'platform', label: 'Platform', kind: 'enum', options: ['Steam', 'GamePass', 'EA', 'Epic', 'Pirated'] }] },
      { cols: 1, fields: [
        { key: 'owned', label: 'Owned', kind: 'toggle', onColor: 'var(--accent,#9ce6b0)' },
      ] },
      { cols: 1, fields: [{ key: 'review', label: 'Mi opinión', kind: 'longtext', placeholder: 'Tus pensamientos sobre el juego…' }] },
    ],
    // blank-draft defaults + which fields are numeric (stored as number|null)
    numberFields: ['score', 'hours', 'hltb', 'price'],
    yearFields: ['yearCompleted'],
    boolFields: ['owned'],
    textFields: ['platform', 'releaseDate', 'review'],
  },

  // ========================================================================
  //  ROULETTE — pool builder filters
  // ========================================================================
  roulette: {
    defaultStatus: 'backlog',
    statusFilters: [ { value: 'backlog', label: 'Backlog' }, { value: 'owned', label: 'Owned', bool: 'owned' }, { value: 'all', label: 'All' } ],
    // an optional numeric "length" band filter; omit for collections without one
    band: {
      label: 'Length · HLTB', field: 'hltb',
      options: [
        { value: 'any', label: 'Any' },
        { value: 'short', label: '< 12h', max: 12 },
        { value: 'medium', label: '12–35h', min: 12, max: 35 },
        { value: 'long', label: '35h+', min: 35 },
      ],
    },
    reelSub: [{ field: 'hltb', tpl: '{v}h' }, { field: 'score', tpl: '★ {v}' }],   // under each reel card: first non-null
    winnerScoreField: 'score',
    winnerSubField: 'hltb', winnerSubSuffix: 'h to beat',
    startAction: { field: 'status', value: 'playing', label: 'Start playing', activeLabel: 'Already playing' },
  },

  // ========================================================================
  //  STATS — summary metrics + widget layout (2 columns) + share modules
  //  widget kinds: statCards | barList | histogram | statusDonut | moneyDonut | byYear
  // ========================================================================
  stats: {
    summary: [
      { kind: 'count', label: 'Total games' },
      { kind: 'statusCount', status: 'played', label: 'Played', accent: true },
      { kind: 'statusCount', status: 'playing', label: 'Playing', accent: true },
      { kind: 'statusCount', status: 'backlog', label: 'Backlog' },
      { kind: 'sum', field: 'hours', label: 'Hours tracked' },
      { kind: 'avg', field: 'score', label: 'Avg score' },
      { kind: 'boolCount', field: 'owned', label: 'Owned' },
      { kind: 'completion', status: 'played', label: 'Completion', accent: true },
    ],
    // library strip (compact one-liners under the toolbar)
    strip: [
      { kind: 'count', label: 'games' },
      { kind: 'statusCount', status: 'playing', label: 'playing', accent: true },
      { kind: 'statusCount', status: 'played', label: 'played' },
      { kind: 'statusCount', status: 'backlog', label: 'backlog' },
      { kind: 'sum', field: 'hours', label: 'hrs' },
      { kind: 'avg', field: 'score', label: 'avg score' },
      { kind: 'completion', status: 'played', label: 'done' },
      { kind: 'moneySum', field: 'price', match: { field: 'platform', notIn: ['GamePass', 'Pirated'] }, label: 'owned cost', color: 'oklch(0.74 0.1 85)' },
      { kind: 'moneySum', field: 'price', match: { field: 'platform', eq: 'Pirated' }, label: 'pirated cost', color: 'oklch(0.66 0.13 25)' },
      { kind: 'moneySum', field: 'price', match: { field: 'platform', eq: 'GamePass' }, label: 'game pass value', color: 'oklch(0.68 0.14 155)' },
      { kind: 'moneySum', field: 'price', match: { field: 'platform', notIn: ['GamePass'] }, label: 'total spent', color: 'var(--accent,#9ce6b0)', accent: true },
    ],
    left: [
      { kind: 'barList', title: 'Highest rated', field: 'score', dir: 'desc', top: 10, podium: true, barColor: 'var(--accent,#9ce6b0)', valColor: 'var(--accent,#9ce6b0)', scale: 10 },
      { kind: 'barList', title: 'Most played · hours', field: 'hours', dir: 'desc', top: 8, barColor: '#5b9e73', valColor: 'var(--text2,#c8d6cb)', suffix: 'h' },
      { kind: 'barList', title: 'Priciest · cost', field: 'price', dir: 'desc', top: 8, barColor: 'oklch(0.74 0.1 85)', valColor: 'oklch(0.8 0.09 85)', money2: true, hideWhenEmpty: true },
      { kind: 'histogram', title: 'Score distribution', field: 'score', buckets: 10 },
    ],
    right: [
      { kind: 'statusDonut', title: 'Library status', center: { status: 'played', label: 'done' },
        segments: [
          { status: 'played',  color: '#5b9e73',              legendColor: '#5b9e73' },
          { status: 'playing', color: '{accent}',             legendColor: '{accent}' },
          { status: 'backlog', color: 'var(--we)', legendColor: 'var(--wk)' },
        ] },
      { kind: 'moneyDonut', title: 'Spending', field: 'price', groups: [
          { label: 'Bought', match: { field: 'platform', notIn: ['GamePass', 'Pirated'] }, color: 'oklch(0.74 0.1 85)' },
          { label: 'Pirated', match: { field: 'platform', eq: 'Pirated' }, color: 'oklch(0.66 0.13 25)' },
          { label: 'Game Pass', match: { field: 'platform', eq: 'GamePass' }, color: 'oklch(0.68 0.14 155)' },
        ], yearFilter: 'yearCompleted' },
      { kind: 'barList', title: 'Top tags', field: '#tags', top: 8, barColor: 'var(--accent,#9ce6b0)', barOpacity: '.85', valColor: 'var(--muted,#8b938d)', compact: true },
      { kind: 'barList', title: 'Platforms', field: '#platform', top: 6, barColor: '#7fb894', valColor: 'var(--muted,#8b938d)', compact: true },
      { kind: 'byYear', title: 'Completed by year', field: 'yearCompleted' },
    ],
    // share-image module toggles (key must match a builder module below)
    shareModules: [
      { key: 'summary', label: 'Overview', default: true },
      { key: 'topRated', label: 'Highest rated', default: true },
      { key: 'mostPlayed', label: 'Most played', default: false },
      { key: 'scoreDist', label: 'Score distribution', default: false },
      { key: 'status', label: 'Library status', default: true },
      { key: 'spending', label: 'Spending', default: false },
      { key: 'topTags', label: 'Top tags', default: false },
      { key: 'topTagsRated', label: 'Top tags by rating', default: false },
      { key: 'platforms', label: 'Platforms', default: false },
      { key: 'byYear', label: 'Completed by year', default: false },
    ],
    shareYearField: 'yearCompleted',
  },
};

// Register into a collection registry so the shell can mount any collection by
// key (window.COLLECTION_CONFIGS[activeCollection]); GAMES_CONFIG kept for compat.
window.COLLECTION_CONFIGS = window.COLLECTION_CONFIGS || {};
window.COLLECTION_CONFIGS[window.GAMES_CONFIG.key] = window.GAMES_CONFIG;
