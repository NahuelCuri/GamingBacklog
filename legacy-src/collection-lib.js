// ============================================================================
//  CollectionLib — config-driven builders shared by every collection.
//  Turns (component state + collection config) into the plain data bags the
//  shared components (ItemTable / ItemModal / StatsView / ShareImage /
//  Roulette) render. All collection-specific knowledge lives in the config;
//  this file has none. `self` is the collection's DCLogic instance.
// ============================================================================
(function () {
  const ACC = 'var(--accent,#9ce6b0)';
  const SS = () => window.SpendingSystem || {
    money: n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US'),
    spend: (items, key, pf) => { pf = pf || 'price'; return items.filter(x => x[pf] != null && (key === 'all' ? true : !!x[key])).reduce((a, b) => a + Number(b[pf]), 0); },
    donutParts: parts => {
      const total = parts.reduce((a, p) => a + p.value, 0);
      if (!total) return 'var(--we)';
      let acc = 0; const stops = parts.map(p => { const a = acc / total * 100; acc += p.value; const b = acc / total * 100; return `${p.color} ${a}% ${b}%`; });
      return 'conic-gradient(' + stops.join(', ') + ')';
    },
    donutFromParts: parts => {
      const total = parts.reduce((a, p) => a + p.value, 0);
      if (!total) return 'var(--we)';
      let acc = 0; const stops = parts.map(p => { const a = acc / total * 100; acc += p.value; const b = acc / total * 100; return `${p.color} ${a}% ${b}%`; });
      return 'conic-gradient(' + stops.join(', ') + ')';
    },
  };

  const fmt = n => Number(n).toLocaleString('en-US');
  const money = n => SS().money(n);
  const money2 = v => SS().money2 ? SS().money2(v) : ((v == null || v === '') ? '—' : ('$' + Number(v).toFixed(2)));
  const isEmpty = v => v == null || v === '';

  // resolve a token url template like "https://x/?q={title} more" against an item
  const linkUrl = (tpl, item) => tpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(item[k] == null ? '' : String(item[k])));

  // conditional-visibility test for a field/group against an item (or draft).
  // supports { field, eq | neq | in:[...] | notIn:[...] }. null cond => visible.
  const condMatch = (cond, item) => {
    if (!cond) return true;
    const v = item ? item[cond.field] : undefined;
    if ('eq' in cond) return v === cond.eq;
    if ('neq' in cond) return v !== cond.neq;
    if ('in' in cond) return cond.in.includes(v);
    if ('notIn' in cond) return !cond.notIn.includes(v);
    return true;
  };

  // ---------- date helpers (finance / any date-keyed collection) ----------
  const ymd = d => (d == null ? '' : String(d).slice(0, 10));
  const monthKey = d => ymd(d).slice(0, 7);                    // "2026-07"
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = k => { const [y, m] = k.split('-'); return MON[(+m) - 1] + ' ' + y; };
  const monthShort = k => { const [y, m] = k.split('-'); return MON[(+m) - 1] + " '" + String(y).slice(2); };
  const dnum = d => { const p = ymd(d).split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; };
  const priceOf = cfg => (cfg.fields && cfg.fields.price) || 'price';
  // length-responsive font size: pick the first step whose max >= string length.
  // steps = [[maxLen, size], …] ascending; last is the floor for very long values.
  const fitFont = (str, steps) => { const n = String(str == null ? '' : str).length; for (const s of steps) if (n <= s[0]) return s[1]; return steps[steps.length - 1][1]; };
  const SUMMARY_STEPS = [[5, '26px'], [6, '24px'], [8, '20px'], [10, '16px'], [12, '14px'], [99, '12px']];
  // Auto palette for dynamically-derived buckets (e.g. user-created categories).
  // Even hue spread at a fixed lightness/chroma so slices stay distinct + harmonious.
  const DYN_HUES = [40, 150, 255, 300, 90, 200, 20, 125, 270, 340, 65, 175];
  const dynColors = n => Array.from({ length: n }, (_, i) => `oklch(0.72 0.11 ${DYN_HUES[i % DYN_HUES.length]})`);

  function statusMeta(cfg, val) {
    const s = cfg.statuses.find(x => x.value === val);
    if (s) return s;
    return cfg.statuses.find(x => x.value === cfg.defaultStatus) || cfg.statuses[cfg.statuses.length - 1];
  }
  function scoreColor(v) { if (v == null) return 'var(--dim,#59605b)'; if (v >= 9) return ACC; if (v >= 7) return 'var(--accent2,#c2e6cd)'; if (v >= 5) return 'var(--text2,#c8d6cb)'; return 'var(--muted,#8b938d)'; }

  // ---------- tags / counts ----------
  function allTags(cfg, items) { const s = new Set(); items.forEach(g => (g[cfg.tagField] || []).forEach(t => s.add(t))); return [...s]; }
  function tagCounts(cfg, items) { const c = {}; items.forEach(g => (g[cfg.tagField] || []).forEach(t => c[t] = (c[t] || 0) + 1)); return c; }

  // ---------- filtering / sorting ----------
  function matches(cfg, g, st) {
    const sf = st.status;
    if (sf !== 'all') {
      const chip = (cfg.statusFilters || []).find(c => c.value === sf);
      if (chip && chip.bool) { if (!g[chip.bool]) return false; }
      else if (g[cfg.statusField] !== sf) return false;
    }
    if (st.catFilter && st.catFilter !== 'all' && cfg.categoryField) {
      if ((g[cfg.categoryField] == null ? '' : g[cfg.categoryField]) !== st.catFilter) return false;
    }
    for (const t of st.tagFilters) if (!(g[cfg.tagField] || []).includes(t)) return false;
    const q = (st.q || '').trim().toLowerCase();
    if (q) {
      const hay = cfg.searchFields.map(f => f === cfg.tagField ? (g[f] || []).join(' ') : (g[f] == null ? '' : g[f])).join(' ').toLowerCase();
      for (const term of q.split(/\s+/)) if (!hay.includes(term)) return false;
    }
    return true;
  }
  function sorted(cfg, list, st) {
    let k = st.sortKey, dir = st.sortDir === 'asc' ? 1 : -1;
    if (k === 'default') {
      if (cfg.defaultSort) { k = cfg.defaultSort.key; dir = cfg.defaultSort.dir === 'asc' ? 1 : -1; }
      else return list;
    }
    const primary = (cfg.table.columns.find(c => c.primary) || {}).key || 'title';
    const val = g => k === primary ? String(g[k] || '').toLowerCase() : (k === cfg.statusField ? g[cfg.statusField] : g[k]);
    return [...list].sort((a, b) => {
      let va = val(a), vb = val(b);
      const an = va == null || va === '', bn = vb == null || vb === '';
      if (an && bn) return 0; if (an) return 1; if (bn) return -1;
      if (va < vb) return -1 * dir; if (va > vb) return 1 * dir; return 0;
    });
  }
  function pool(cfg, items, st) {
    const r = cfg.roulette;
    if (st.rmode === 'picked') return items.filter(g => st.rPicked.includes(g.id));
    return items.filter(g => {
      if (st.rStatus !== 'all') {
        const chip = (r.statusFilters || []).find(c => c.value === st.rStatus);
        if (chip && chip.bool) { if (!g[chip.bool]) return false; }
        else if (g[cfg.statusField] !== st.rStatus) return false;
      }
      if (r.band && st.rLength !== 'any') {
        const h = g[r.band.field]; if (h == null) return false;
        const opt = r.band.options.find(o => o.value === st.rLength);
        if (opt) { if (opt.min != null && !(h > opt.min)) return false; if (opt.max != null && !(h <= opt.max)) return false; }
      }
      if (st.rTags.length && !st.rTags.some(t => (g[cfg.tagField] || []).includes(t))) return false;
      return true;
    });
  }

  // ---------- draft <-> item ----------
  function blankDraft(cfg) {
    const d = { tagInput: '' };
    cfg.modal.groups.forEach(gr => gr.fields.forEach(f => {
      if (f.kind === 'tags') d[f.key] = [];
      else if (f.kind === 'toggle') d[f.key] = false;
      else if (f.kind === 'status') d[f.key] = cfg.defaultStatus;
      else d[f.key] = '';
    }));
    return d;
  }
  function draftFromItem(cfg, g) {
    const d = { ...g, tagInput: '' };
    cfg.modal.groups.forEach(gr => gr.fields.forEach(f => {
      if (f.kind === 'tags') d[f.key] = [...(g[f.key] || [])];
      else if (f.kind === 'toggle') d[f.key] = !!g[f.key];
      else if (f.kind === 'status') d[f.key] = g[f.key] || cfg.defaultStatus;
      else d[f.key] = g[f.key] ?? '';
    }));
    return d;
  }
  function itemFromDraft(cfg, d) {
    const m = cfg.modal;
    const numOrNull = v => (v === '' || v == null) ? null : Number(v);
    const out = { id: d.id || ('x' + Date.now()) };
    const titleKey = m.titleField;
    m.groups.forEach(gr => gr.fields.forEach(f => {
      const k = f.key;
      if (f.kind === 'tags') out[k] = [...(d[k] || [])];
      else if (f.kind === 'toggle') out[k] = !!d[k];
      else if (m.numberFields && m.numberFields.includes(k)) out[k] = numOrNull(d[k]);
      else if (m.yearFields && m.yearFields.includes(k)) out[k] = (d[k] === '' || d[k] == null) ? null : String(d[k]);
      else if (k === titleKey) out[k] = (d[k] || '').trim();
      else out[k] = typeof d[k] === 'string' ? d[k].trim() : d[k];
    }));
    if (cfg.accountField && out[cfg.statusField] !== 'transfer') out[cfg.accountField] = '';
    return out;
  }

  // ============================ TABLE ============================
  function buildTable(self) {
    const cfg = self.CONFIG, st = self.state, isMobile = !!st.isMobile;
    const cols = cfg.table.columns;
    const visible = cols.filter(c => !(isMobile && c.hideMobile));
    const gridCols = [...visible.map(c => (isMobile && c.mobileWidth) ? c.mobileWidth : c.width), (isMobile && cfg.table.chevron.mobileWidth) ? cfg.table.chevron.mobileWidth : cfg.table.chevron.width].join(' ');
    const detailGridCols = isMobile ? '1fr' : '1.7fr 1fr';

    const arrow = k => st.sortKey === k ? (st.sortDir === 'asc' ? '↑' : '↓') : '';
    const hdrColor = k => st.sortKey === k ? ACC : 'var(--dim,#59605b)';
    const sortBy = k => () => self.setState(cur => cur.sortKey === k ? { sortDir: cur.sortDir === 'asc' ? 'desc' : 'asc' } : { sortKey: k, sortDir: 'asc' });

    const sortLabel = c => {
      if (!c.sortable) return c.label;
      if (st.sortKey !== c.key) return 'Sort by ' + c.label;
      return 'Sorted by ' + c.label + ', ' + (st.sortDir === 'asc' ? 'ascending' : 'descending') + ' — reverse';
    };
    const headerCells = cols.map(c => ({
      label: c.label, arrow: c.sortable ? arrow(c.key) : '', color: c.sortable ? hdrColor(c.key) : 'var(--dim,#59605b)',
      sortable: !!c.sortable, plain: !c.sortable, sortLabel: sortLabel(c),
      onClick: c.sortable ? sortBy(c.key) : null, cursor: c.sortable ? 'pointer' : 'default',
      align: c.right ? 'right' : 'left', display: (isMobile && c.hideMobile) ? 'none' : 'block',
      padRight: c.right ? '20px' : '0',
    }));

    const filtered = sorted(cfg, st.games.filter(g => matches(cfg, g, st)), st);

    // Ledger-month limit: by default a finance collection shows only its most
    // recent month; any search / category / status / tag filter lifts the cap,
    // as does the "Load all" footer button (showAllLedger).
    let tableRows = filtered, ledger = { limited: false };
    if (cfg.ledgerMonth && !st.showAllLedger) {
      const active = (st.q || '').trim() || (st.catFilter && st.catFilter !== 'all') || st.status !== 'all' || (st.tagFilters && st.tagFilters.length);
      const dated = filtered.filter(g => monthKey(g.date));
      if (!active && dated.length) {
        const latest = dated.map(g => monthKey(g.date)).sort().reverse()[0];
        const monthRows = filtered.filter(g => monthKey(g.date) === latest);
        if (monthRows.length < filtered.length) {
          ledger = { limited: true, hidden: filtered.length - monthRows.length, total: filtered.length, label: monthLabel(latest), onLoadAll: () => self.setState({ showAllLedger: true }) };
          tableRows = monthRows;
        }
      }
    }

    // Long libraries render in pages so the first paint stays cheap; the rest
    // is one click (or an active filter) away.
    const LIMIT = st.rowLimit || 150;
    let more = { show: false };
    if (tableRows.length > LIMIT) {
      const total = tableRows.length;
      more = { show: true, shown: LIMIT, total, remaining: total - LIMIT,
        onMore: () => self.setState(s2 => ({ rowLimit: (s2.rowLimit || 150) + 150 })) };
      tableRows = tableRows.slice(0, LIMIT);
    }

    const rows = tableRows.map(g => {
      const isExp = st.expandedId === g.id;
      const confirming = st.pendingDelete === g.id;
      const cells = cols.map(c => {
        const hidden = isMobile && c.hideMobile;
        const align = c.right ? 'right' : 'left';
        if (c.primary) return { isTitle: true, display: hidden ? 'none' : 'block', text: g[c.key] };
        if (c.kind === 'tags') return { isTags: true, display: hidden ? 'none' : 'flex', chips: (g[c.key] || []).map(t => ({ tag: t, filterLabel: 'Filter by tag ' + t, onClick: (e) => { if (e) e.stopPropagation(); self.setState(cur => cur.tagFilters.includes(t) ? {} : { tagFilters: [...cur.tagFilters, t], showTags: false }); } })) };
        if (c.kind === 'status') { const sm = statusMeta(cfg, g[c.key]); return { isStatus: true, display: 'flex', dot: sm.dot, glow: sm.glow, text: sm.text, label: sm.label }; }
        if (c.kind === 'money') {
          const t = g[cfg.statusField];
          const sign = t === 'income' ? '+' : (t === 'expense' ? '−' : '');
          const col = t === 'income' ? ACC : (t === 'expense' ? '#d98f8f' : 'var(--muted,#8b938d)');
          const clickable = !!cfg.currency;
          return {
            isVal: true, display: hidden ? 'none' : 'block', align, text: sign + money(g[c.key]), color: col, size: '13px', weight: '600',
            onClick: clickable ? (e => { if (e) e.stopPropagation(); self.toggleCurrency && self.toggleCurrency(); }) : null,
            cursor: clickable ? 'pointer' : 'default', padRight: '0',
          };
        }
        if (c.kind === 'score') return { isVal: true, display: hidden ? 'none' : 'block', align, text: g[c.key] == null ? '—' : String(g[c.key]), color: scoreColor(g[c.key]), size: '13px', weight: '600', onClick: null, cursor: 'default', padRight: c.right ? '14px' : '0' };
        return { isVal: true, display: hidden ? 'none' : 'block', align, text: g[c.key] == null ? '—' : (g[c.key] + (c.unit || '')), color: c.color || 'var(--text2,#c8d6cb)', size: '12.5px', weight: '400', onClick: null, cursor: 'default', padRight: c.right ? '20px' : '0' };
      });

      const df = cfg.detail.fields.filter(f => condMatch(f.showWhen, g)).map(f => {
        let value = f.empty || '—';
        if (f.kind === 'yesno') value = g[f.key] ? 'Yes' : 'No';
        else if (f.kind === 'money2') value = money2(g[f.key]);
        else if (f.kind === 'tags') { const arr = g[f.key] || []; value = arr.length ? arr.join(', ') : (f.empty || '—'); }
        else value = isEmpty(g[f.key]) ? (f.empty || '—') : g[f.key];
        const out = { label: f.label, value };
        if (f.searchLink) {
          const empty = isEmpty(g[f.key]);
          out.hasLink = true; out.linkUrl = linkUrl(f.searchLink.url, g); out.linkTitle = f.searchLink.title;
          out.iconColor = (f.searchLink.pulseWhenEmpty && empty) ? ACC : 'var(--dim,#59605b)';
          out.iconAnim = (f.searchLink.pulseWhenEmpty && empty) ? 'gpulse 1.6s ease-in-out infinite' : 'none';
        } else out.hasLink = false;
        return out;
      });

      const cl = cfg.detail.cornerLink; let corner = { show: false };
      if (cl) { const empty = isEmpty(g[cl.field]); corner = { show: true, url: linkUrl(cl.url, g), label: cl.label,
        color: empty ? ACC : 'var(--muted,#8b938d)', border: empty ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--wh)',
        anim: empty ? 'gpulsebtn 1.6s ease-in-out infinite' : 'none' }; }

      const rv = g[cfg.detail.reviewField];
      return {
        id: g.id, rowBg: isExp ? 'var(--wa)' : 'transparent', gridRows: isExp ? '1fr' : '0fr',
        chevronRot: isExp ? 'rotate(90deg)' : 'none', onToggle: () => self.toggleExpand(g.id),
        expanded: isExp ? 'true' : 'false',
        rowLabel: (g[cfg.modal.titleField] || g.title || 'Row') + ' — ' + (isExp ? 'collapse' : 'expand') + ' details',
        onKey: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.toggleExpand(g.id); } },
        cells,
        reviewLabel: cfg.reviewLabel, reviewText: rv ? rv : cfg.reviewEmpty,
        reviewColor: rv ? 'var(--text3,#b7bfb9)' : 'var(--dim,#59605b)', reviewStyle: rv ? 'italic' : 'normal',
        detailFields: df, cornerLink: corner,
        onEdit: (e) => { if (e) e.stopPropagation(); self.openEdit(g); },
        onShare: (e) => { if (e) e.stopPropagation(); self.openShareCard(g); },
        onDelete: (e) => { if (e) e.stopPropagation(); if (confirming) self.removeGame(g.id); else self.setState({ pendingDelete: g.id }); },
        delLabel: confirming ? 'Confirm?' : 'Delete',
        delColor: confirming ? 'var(--onAccent,#0d0f0e)' : '#d98f8f', delBg: confirming ? '#d98f8f' : 'transparent', delBorder: confirming ? '#d98f8f' : 'rgba(217,143,143,.4)',
      };
    });

    return { gridCols, detailGridCols, headerCells, rows, ledger, more, stop: e => e.stopPropagation() };
  }

  // ============================ MODAL ============================
  function buildModal(self) {
    const cfg = self.CONFIG, st = self.state, modal = st.modal;
    if (!modal) return { modalOpen: false };
    const draft = modal.draft, acc = ACC;
    const counts = tagCounts(cfg, st.games);
    const titleKey = cfg.modal.titleField;

    const groups = cfg.modal.groups.map(gr => {
      const visible = !gr.showWhen || condMatch(gr.showWhen, draft);
      return {
      cols: gr.cols,
      colsStyle: st.isMobile ? '1fr' : (gr.cols === 3 ? '1fr 1fr 1fr' : (gr.cols === 2 ? '1fr 1fr' : '1fr')),
      collapsible: !!gr.showWhen,
      overflow: gr.showWhen ? 'hidden' : 'visible',
      gridRows: visible ? '1fr' : '0fr',
      opacity: visible ? '1' : '0',
      slideMargin: (gr.showWhen && !visible) ? '-17px' : '0px',
      fields: gr.fields.map(f => {
        const base = { key: f.key, label: f.label, kind: f.kind,
          isInput: ['text', 'number', 'date'].includes(f.kind), isLongtext: f.kind === 'longtext',
          isTags: f.kind === 'tags', isChips: (f.kind === 'status' || f.kind === 'enum'), isCombo: f.kind === 'combo', isToggle: f.kind === 'toggle' };
        if (f.kind === 'text' || f.kind === 'number' || f.kind === 'date' || f.kind === 'longtext') {
          base.value = draft[f.key]; base.placeholder = f.placeholder || '';
          base.inputType = f.kind === 'number' ? 'number' : (f.kind === 'date' ? 'date' : 'text');
          base.min = f.min ?? ''; base.max = f.max ?? ''; base.step = f.step ?? '';
          base.mono = (f.kind === 'number' || f.kind === 'date');
          base.fontFamily = base.mono ? "'JetBrains Mono',monospace" : 'inherit';
          base.onInput = e => self.setDraft(f.key, e.target.value);
          base.isDate = f.kind === 'date';
          base.isTextInput = !base.isDate;
          base.onDate = v => self.setDraft(f.key, v);
          if (f.dupCheck) {
            const dt = (draft[titleKey] || '').trim().toLowerCase();
            const hit = dt ? st.games.find(g => g.id !== draft.id && (g[titleKey] || '').trim().toLowerCase() === dt) : null;
            base.dup = !!hit; base.dupName = hit ? hit[titleKey] : '';
          }
          base.noLookup = !f.lookup;
          if (f.lookup) {
            const ls = modal.lookup || '';
            base.hasLookup = true;
            base.lookupBusy = ls === 'loading';
            base.lookupOpacity = ls === 'loading' ? '.55' : '1';
            base.lookupBtnLabel = ls === 'loading' ? 'Looking up…' : 'Auto-fill from ISBN';
            base.lookupMsg = modal.lookupMsg || '';
            base.lookupMsgColor = ls === 'error' ? '#d98f8f' : (ls === 'done' ? ACC : 'var(--muted,#8b938d)');
            base.lookupErr = ls === 'error';
            base.lookupSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(((draft[titleKey] || '') + ' ' + (draft[f.key] || '')).trim() + ' book');
            base.onLookup = () => { if (self.state.modal && (self.state.modal.lookup !== 'loading')) self.lookupItem(f.key, f.lookup); };
          }
        } else if (f.kind === 'tags') {
          const tiKey = '_ti_' + f.key;
          base.chips = (draft[f.key] || []).map(t => ({ tag: t, removeLabel: 'Remove tag ' + t, onRemove: () => self.removeTag(f.key, t) }));
          base.tagInput = draft[tiKey] || '';
          base.onTagInput = e => self.setDraft(tiKey, e.target.value);
          base.onTagKey = e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); self.addTag(f.key, self.state.modal.draft[tiKey]); } };
          const ti = (draft[tiKey] || '').toLowerCase();
          const vals = {}; st.games.forEach(g => (g[f.key] || []).forEach(v => vals[v] = (vals[v] || 0) + 1));
          base.suggest = Object.keys(vals).filter(t => !(draft[f.key] || []).includes(t) && (!ti || t.toLowerCase().includes(ti))).sort((a, b) => vals[b] - vals[a]).slice(0, 8).map(t => ({ tag: t, addLabel: 'Add tag ' + t, onAdd: () => self.addTag(f.key, t) }));
          base.hasSuggest = base.suggest.length > 0;
        } else if (f.kind === 'status') {
          base.chips = cfg.statuses.map(s => ({ label: s.label, onClick: () => {
              self.setDraft(f.key, s.value);
              (cfg.modal.groups || []).forEach(gr2 => {
                if (gr2.showWhen && gr2.showWhen.field === f.key && s.value !== gr2.showWhen.eq) {
                  gr2.fields.forEach(ff => self.setDraft(ff.key, ''));
                }
              });
            },
            color: draft[f.key] === s.value ? 'var(--onAccent,#0d0f0e)' : 'var(--muted,#8b938d)', pressed: draft[f.key] === s.value ? 'true' : 'false', bg: draft[f.key] === s.value ? acc : 'var(--chip,#20241f)', border: draft[f.key] === s.value ? acc : 'var(--wd)' }));
        } else if (f.kind === 'enum') {
          base.chips = f.options.map(v => ({ label: v, onClick: () => {
              const nv = draft[f.key] === v ? '' : v;
              self.setDraft(f.key, nv);
              (cfg.modal.groups || []).forEach(gr2 => {
                if (gr2.showWhen && gr2.showWhen.field === f.key && !condMatch(gr2.showWhen, { ...draft, [f.key]: nv })) {
                  gr2.fields.forEach(ff => self.setDraft(ff.key, ''));
                }
              });
            },
            color: draft[f.key] === v ? 'var(--onAccent,#0d0f0e)' : 'var(--muted,#8b938d)', pressed: draft[f.key] === v ? 'true' : 'false', bg: draft[f.key] === v ? acc : 'var(--chip,#20241f)', border: draft[f.key] === v ? acc : 'var(--wd)' }));
        } else if (f.kind === 'combo') {
          // Free-text value with live suggestions drawn from what the user has
          // actually entered before (plus any config seeds) — categories are not
          // fixed, they grow from the data.
          const cur = draft[f.key] == null ? '' : String(draft[f.key]);
          base.value = cur; base.placeholder = f.placeholder || '';
          base.onInput = e => self.setDraft(f.key, e.target.value);
          const counts = {};
          st.games.forEach(g => { const v = (g[f.key] == null ? '' : String(g[f.key])).trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
          (f.suggest || []).forEach(s => { if (!(s in counts)) counts[s] = 0; });
          const typed = cur.trim().toLowerCase();
          base.suggest = Object.keys(counts)
            .filter(v => v.toLowerCase() !== typed && (!typed || v.toLowerCase().includes(typed)))
            .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
            .slice(0, 12)
            .map(v => ({ label: v, onClick: () => self.setDraft(f.key, v) }));
          base.hasSuggest = base.suggest.length > 0;
        } else if (f.kind === 'toggle') {
          base.on = !!draft[f.key]; base.checked = draft[f.key] ? 'true' : 'false'; base.trackBg = draft[f.key] ? (f.onColor || acc) : 'var(--chip,#20241f)'; base.knobLeft = draft[f.key] ? '18px' : '2px';
          base.onToggle = () => self.setDraft(f.key, !self.state.modal.draft[f.key]);
        }
        return base;
      }),
      };
    });

    const valid = !!(draft[titleKey] && draft[titleKey].trim());
    return {
      modalOpen: true, isEdit: modal.mode === 'edit', isAdd: modal.mode === 'add',
      onShareFromModal: () => self.openShareCard(itemFromDraft(cfg, draft)),
      modalTitleText: modal.mode === 'add' ? ('Add ' + cfg.noun) : ('Edit ' + cfg.noun),
      groups, saveOpacity: valid ? '1' : '.5', saveLabel: modal.mode === 'add' ? cfg.addLabel.replace('+ ', '') : 'Save',
      onSave: self.save, closeModal: self.closeModal, stop: e => e.stopPropagation(),
      onDeleteModal: () => { if (st.confirmDel) self.removeGame(draft.id); else self.setState({ confirmDel: true }); },
      mDelLabel: st.confirmDel ? 'Confirm delete' : 'Delete',
      mDelColor: st.confirmDel ? 'var(--onAccent,#0d0f0e)' : '#d98f8f', mDelBg: st.confirmDel ? '#d98f8f' : 'transparent', mDelBorder: st.confirmDel ? '#d98f8f' : 'rgba(217,143,143,.4)',
    };
  }

  // ============================ ROULETTE ============================
  function buildRoulette(self) {
    const cfg = self.CONFIG, st = self.state, acc = ACC, r = cfg.roulette;
    const primary = (cfg.table.columns.find(c => c.primary) || {}).key || 'title';
    const isMobile = !!st.isMobile;
    const rpool = pool(cfg, self.state.games, st);

    const chipSel = (on) => on
      ? { pressed: 'true', color: 'var(--onAccent,#0d0f0e)', bg: acc, border: acc }
      : { pressed: 'false', color: 'var(--text2,#c8d6cb)', bg: 'var(--inset,#0f110f)', border: 'var(--wf)' };

    const rStatusChips = (r.statusFilters || []).map(c => ({
      label: c.label, onClick: () => self.setState({ rStatus: c.value }), ...chipSel(st.rStatus === c.value),
    }));

    const hasBand = !!r.band;
    const bandLabel = r.band ? r.band.label : '';
    const rLengthChips = r.band ? r.band.options.map(o => ({
      label: o.label, onClick: () => self.setState({ rLength: o.value }), ...chipSel(st.rLength === o.value),
    })) : [];

    const counts = tagCounts(cfg, self.state.games);
    const rTagCloud = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b)).map(tag => {
      const on = st.rTags.includes(tag);
      return { tag, count: counts[tag], pressed: on ? 'true' : 'false', onClick: () => self.setState(s => ({ rTags: on ? s.rTags.filter(x => x !== tag) : [...s.rTags, tag] })),
        color: on ? 'var(--onAccent,#0d0f0e)' : 'var(--muted2,#9aa39c)', bg: on ? acc : 'var(--chip2,#181b19)', border: on ? acc : 'var(--we)' };
    });

    const rq = (st.rSearch || '').trim().toLowerCase();
    const rSuggest = rq
      ? self.state.games.filter(g => !st.rPicked.includes(g.id) && String(g[primary] || '').toLowerCase().includes(rq)).slice(0, 8)
        .map(g => ({ title: g[primary], addLabel: 'Add ' + g[primary] + ' to the draw', onAdd: () => self.setState(s => ({ rPicked: [...s.rPicked, g.id], rSearch: '' })) }))
      : [];
    const rPickedList = st.rPicked.map(id => self.state.games.find(g => g.id === id)).filter(Boolean)
      .map(g => ({ title: g[primary], removeLabel: 'Remove ' + g[primary] + ' from the draw', onRemove: () => self.setState(s => ({ rPicked: s.rPicked.filter(x => x !== g.id) })) }));

    const reelItems = st.reel.map(g => {
      const sm = statusMeta(cfg, g[cfg.statusField]);
      let sub = '—';
      for (const rs of (r.reelSub || [])) { const v = g[rs.field]; if (v != null) { sub = rs.tpl.replace('{v}', v); break; } }
      return { title: g[primary], dot: sm.reelDot || sm.dot, glow: sm.reelGlow ? '0 0 7px ' + acc : 'none', sub };
    });

    const spinBlocked = st.spinning || rpool.length === 0;
    const w = st.winner, sa = r.startAction;
    const winnerActive = !!(w && sa && w[sa.field] === sa.value);

    return {
      rouletteGridCols: isMobile ? '1fr' : '360px 1fr',
      winnerRowDir: isMobile ? 'column' : 'row',
      winnerScoreAlign: isMobile ? 'left' : 'right',
      setRmodeFilters: () => self.setState({ rmode: 'filters' }), setRmodePicked: () => self.setState({ rmode: 'picked' }),
      rmodeFilters: st.rmode === 'filters', rmodePicked: st.rmode === 'picked',
      rmodeFiltersSel: st.rmode === 'filters' ? 'true' : 'false', rmodePickedSel: st.rmode === 'picked' ? 'true' : 'false',
      rmFiltersColor: st.rmode === 'filters' ? 'var(--onAccent,#0d0f0e)' : 'var(--muted,#8b938d)', rmFiltersBg: st.rmode === 'filters' ? acc : 'transparent',
      rmPickedColor: st.rmode === 'picked' ? 'var(--onAccent,#0d0f0e)' : 'var(--muted,#8b938d)', rmPickedBg: st.rmode === 'picked' ? acc : 'transparent',
      rStatusChips, hasBand, bandLabel, rLengthChips, rTagCloud,
      hasRTags: st.rTags.length > 0, clearRTags: () => self.setState({ rTags: [] }),
      rSearch: st.rSearch, onRSearch: e => self.setState({ rSearch: e.target.value }),
      rSuggest, hasRSuggest: rSuggest.length > 0,
      rPickedList, pickedCount: st.rPicked.length, hasRPicked: st.rPicked.length > 0, noRPicked: st.rPicked.length === 0,
      poolCount: rpool.length, poolCountColor: rpool.length ? acc : '#d98f8f',
      hasReel: st.reel.length > 0, reelEmpty: st.reel.length === 0, reelItems,
      reelPlaceholder: rpool.length ? 'Hit spin to roll the reel.' : 'Pool is empty — widen your filters.',
      onSpin: self.spin, spinCursor: spinBlocked ? 'not-allowed' : 'pointer', spinOpacity: spinBlocked ? '.5' : '1',
      spinLabel: st.spinning ? 'Spinning…' : 'Spin',
      hasWinner: !!w && !st.spinning,
      w: w ? {
        title: w[primary], tags: w[cfg.tagField] || [],
        scoreDisp: w[r.winnerScoreField] != null ? String(w[r.winnerScoreField]) : '—',
        hltbDisp: w[r.winnerSubField] != null ? w[r.winnerSubField] + 'h' : '—',
        hasReview: !!(w[cfg.detail.reviewField] && String(w[cfg.detail.reviewField]).trim()), review: w[cfg.detail.reviewField],
      } : {},
      onStartPlaying: self.startPlaying, startLabel: winnerActive ? sa.activeLabel : sa.label,
      onSpinAgain: self.spin, onWinnerEdit: () => { if (self.state.winner) self.openEdit(self.state.winner); },
      hasRecent: st.recent.length > 0, recentPicks: st.recent.map(g => ({ title: g[primary] })),
    };
  }

  // ============================ STATS ============================
  //  Turn cfg.stats.summary / strip / left / right into plain widget bags the
  //  shared StatsView renders by kind. No collection-specific code.
  function metric(cfg, items, spec) {
    const S = SS();
    const total = items.length;
    if (spec.kind === 'count') return { value: fmt(total), num: total };
    if (spec.kind === 'statusCount') { const n = items.filter(x => x[cfg.statusField] === spec.status).length; return { value: fmt(n), num: n }; }
    if (spec.kind === 'boolCount') { const n = items.filter(x => x[spec.field]).length; return { value: fmt(n), num: n }; }
    if (spec.kind === 'sum') { const s = items.map(x => x[spec.field]).filter(v => v != null).reduce((a, b) => a + b, 0); return { value: fmt(s), num: s }; }
    if (spec.kind === 'avg') { const a = items.map(x => x[spec.field]).filter(v => v != null); const v = a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; return { value: v.toFixed(1), num: v }; }
    if (spec.kind === 'completion') { const n = items.filter(x => x[cfg.statusField] === spec.status).length; const v = total ? Math.round(n / total * 100) : 0; return { value: v + '%', num: v }; }
    if (spec.kind === 'moneySum') { const s = S.spend(items, spec.match || spec.bool || 'all', (cfg.fields && cfg.fields.price) || 'price'); return { value: S.money(s), num: s }; }
    // ---- finance-specific (only used by the expenses config) ----
    if (['net', 'savingsRate', 'avgPerDay', 'maxAmount'].includes(spec.kind)) {
      const pf = priceOf(cfg), sf = cfg.statusField;
      const sumType = t => items.filter(x => x[sf] === t).reduce((a, b) => a + (Number(b[pf]) || 0), 0);
      if (spec.kind === 'net') { const v = sumType('income') - sumType('expense'); return { value: S.money(v), num: v }; }
      if (spec.kind === 'savingsRate') { const inc = sumType('income'), v = inc > 0 ? Math.round((inc - sumType('expense')) / inc * 100) : 0; return { value: v + '%', num: v }; }
      if (spec.kind === 'avgPerDay') { const exp = items.filter(x => x[sf] === 'expense' && x.date); const days = new Set(exp.map(x => ymd(x.date))); const v = days.size ? sumType('expense') / days.size : 0; return { value: S.money(v), num: v }; }
      if (spec.kind === 'maxAmount') { const v = Math.max(0, ...items.filter(x => x[sf] === 'expense').map(x => Number(x[pf]) || 0)); return { value: S.money(v), num: v }; }
    }
    if (spec.kind === 'accountSum') {
      const sf = cfg.statusField, pf = priceOf(cfg), af = cfg.accountField || 'account';
      const ex = spec.exclude || [];
      const v = items.filter(x => x[sf] === 'transfer' && (spec.account ? x[af] === spec.account : (x[af] && x[af] !== 'None' && !ex.includes(x[af])))).reduce((a, b) => a + (Number(b[pf]) || 0), 0);
      return { value: S.money(v), num: v };
    }
    return { value: '—', num: 0 };
  }

  function barListWidget(cfg, items, spec) {
    const primary = (cfg.table.columns.find(c => c.primary) || {}).key || 'title';
    if (spec.where) items = items.filter(x => x[spec.where.field] === spec.where.eq);
    let rows, showRank = false, hasPodium = false, podiumRow = [];
    if (spec.field[0] === '#') {
      const f = spec.field.slice(1);
      const counts = {};
      items.forEach(x => {
        const v = x[f];
        if (Array.isArray(v)) v.forEach(t => counts[t] = (counts[t] || 0) + 1);
        else { const s = (v == null ? '' : String(v)).trim(); if (s) counts[s] = (counts[s] || 0) + 1; }
      });
      const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, spec.top);
      const maxV = Math.max(1, ...keys.map(k => counts[k]));
      rows = keys.map(k => ({ label: k, val: String(counts[k]), pct: Math.round(counts[k] / maxV * 100) + '%' }));
    } else {
      let list = items.filter(x => x[spec.field] != null);
      if (spec.money2) list = list.filter(x => Number(x[spec.field]) > 0);
      list = list.sort((a, b) => spec.dir === 'asc' ? a[spec.field] - b[spec.field] : b[spec.field] - a[spec.field]).slice(0, spec.top);
      const maxV = Math.max(1, spec.scale ? spec.scale : (list.length ? list[0][spec.field] : 1));
      showRank = !!spec.podium;
      rows = list.map((x, i) => {
        const v = x[spec.field];
        const val = spec.money2 ? ('$' + Number(v).toFixed(2)) : (String(v) + (spec.suffix || ''));
        return { rank: String(i + 1), label: x[primary], val, pct: Math.round(v / maxV * 100) + '%' };
      });
      if (spec.podium) {
        const p = list.slice(0, 3).map((g, i) => ({
          rank: i + 1, title: g[primary], score: g[spec.field],
          bg: i === 0 ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--chip2,#181b19)', border: i === 0 ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--wd)',
          rankColor: i === 0 ? ACC : 'var(--muted,#8b938d)', lift: i === 0 ? '-10px' : '0px',
          pad: i === 0 ? '20px 14px' : '13px 12px', scoreSize: i === 0 ? '30px' : '21px', titleSize: i === 0 ? '13px' : '11.5px',
        }));
        podiumRow = p.length === 3 ? [p[1], p[0], p[2]] : p;
        hasPodium = p.length > 0;
      }
    }
    if (spec.hideWhenEmpty && rows.length === 0) return null;
    const compact = !!spec.compact;
    return {
      kind: 'barList', isBarList: true, title: spec.title,
      hasPodium, podiumRow, showRank, rows,
      rowGap: compact ? '10px' : '9px', cellGap: compact ? '11px' : '12px',
      labelWidth: compact ? '96px' : (spec.podium ? '150px' : '170px'),
      labelSize: compact ? '12px' : '12.5px',
      barColor: spec.barColor || ACC, barOpacity: spec.barOpacity || '1',
      valWidth: spec.podium ? '26px' : (compact ? '22px' : (spec.money2 ? '96px' : '44px')),
      valColor: spec.valColor || 'var(--text2,#c8d6cb)', valSize: compact ? '11.5px' : '12px', valWeight: compact ? '400' : '600',
    };
  }

  function histogramWidget(cfg, items, spec) {
    const n = spec.buckets || 10;
    const dist = {}; for (let i = 1; i <= n; i++) dist[i] = 0;
    items.filter(x => x[spec.field] != null).forEach(x => { const b = Math.max(1, Math.min(n, Math.round(x[spec.field]))); dist[b]++; });
    const maxD = Math.max(1, ...Object.values(dist));
    const bars = [];
    for (let i = 1; i <= n; i++) bars.push({ label: i, count: dist[i], pct: Math.round(dist[i] / maxD * 100) + '%', color: i >= 9 ? ACC : i >= 7 ? 'color-mix(in srgb, var(--accent) 60%, transparent)' : 'color-mix(in srgb, var(--accent) 28%, transparent)' });
    return { kind: 'histogram', isHistogram: true, title: spec.title, bars };
  }

  function byYearWidget(cfg, items, spec) {
    const yc = {}; items.forEach(g => { let y = g[spec.field]; if (spec.fromDate && y) y = String(y).slice(0, 4); if (y) yc[y] = (yc[y] || 0) + 1; });
    const years = Object.keys(yc).sort();
    const maxY = Math.max(1, ...Object.values(yc));
    return { kind: 'byYear', isByYear: true, title: spec.title, bars: years.map(y => ({ label: y, count: yc[y], pct: Math.round(yc[y] / maxY * 100) + '%' })) };
  }

  // Rank tags (e.g. genres) by AVERAGE rating among rated items carrying the tag,
  // requiring a minimum count so one-offs don't dominate — captures "favourite
  // by amount AND rating". Label shows tag · count; value shows the avg rating.
  function tagRatingWidget(cfg, items, spec) {
    const tf = spec.tag || cfg.tagField;
    const rf = spec.field || (cfg.fields && cfg.fields.score) || 'score';
    const scale = spec.scale || 10, minCount = spec.minCount || 1;
    const agg = {};
    items.forEach(x => { const r = x[rf]; (x[tf] || []).forEach(t => { const a = agg[t] || (agg[t] = { sum: 0, n: 0, cnt: 0 }); a.cnt++; if (r != null) { a.sum += r; a.n++; } }); });
    const rows = Object.keys(agg).filter(t => agg[t].cnt >= minCount && agg[t].n > 0)
      .map(t => ({ t, avg: agg[t].sum / agg[t].n, cnt: agg[t].cnt }))
      .sort((a, b) => b.avg - a.avg || b.cnt - a.cnt).slice(0, spec.top || 8)
      .map(k => ({ label: k.t + ' · ' + k.cnt, val: '\u2605' + k.avg.toFixed(1), pct: Math.round(k.avg / scale * 100) + '%' }));
    if (spec.hideWhenEmpty && !rows.length) return null;
    return barBag(spec.title, rows, { barColor: spec.barColor || ACC, barOpacity: spec.barOpacity || '.9', valColor: spec.valColor || 'var(--text2,#c8d6cb)', valWidth: '46px', labelWidth: spec.labelWidth || '140px', rowGap: '9px' });
  }

  function statusDonutWidget(cfg, items, spec, ctx) {
    const total = items.length;
    const segs = spec.segments.map(sg => ({
      count: items.filter(x => x[cfg.statusField] === sg.status).length,
      color: sg.color.replace('{accent}', ctx.accent),
      legendColor: (sg.legendColor || sg.color).replace('{accent}', ctx.accent),
      label: statusMeta(cfg, sg.status).label,
    }));
    const centerCount = items.filter(x => x[cfg.statusField] === spec.center.status).length;
    return {
      kind: 'statusDonut', isStatusDonut: true, title: spec.title,
      donutStyle: SS().donutFromParts(segs.map(s => ({ value: s.count, color: s.color }))),
      centerValue: (total ? Math.round(centerCount / total * 100) : 0) + '%', centerLabel: spec.center.label,
      legend: segs.map(s => ({ color: s.legendColor, label: s.label, count: s.count })),
    };
  }

  function moneyDonutWidget(cfg, items, spec, ctx) {
    const S = SS(), yf = spec.yearFilter, yearVal = ctx.spendYear || 'all';
    const yearsAvail = [...new Set(items.map(g => g[yf]).filter(Boolean).map(String))].sort().reverse();
    const yearOptions = [{ value: 'all', label: 'All' }, ...yearsAvail.map(y => ({ value: y, label: y }))];
    const scoped = yearVal === 'all' ? items : items.filter(g => String(g[yf]) === yearVal);
    const pf = (cfg.fields && cfg.fields.price) || 'price';
    let groups = spec.groups;
    // dynamicGroup: derive the donut slices from whatever distinct values of a
    // field actually appear in the data — no fixed category list. Colors are
    // auto-assigned; anything past `top` folds into an “Other” slice.
    if (spec.dynamicGroup) {
      const field = spec.dynamicGroup, sf = cfg.statusField;
      let base = scoped;
      if (spec.type) base = base.filter(x => x[sf] === spec.type);
      const sums = {};
      base.forEach(x => { const k = (x[field] == null ? '' : String(x[field]).trim()) || 'Other'; sums[k] = (sums[k] || 0) + (Number(x[pf]) || 0); });
      const keys = Object.keys(sums).filter(k => sums[k] > 0).sort((a, b) => sums[b] - sums[a]);
      const top = spec.top || 8;
      const shown = keys.slice(0, top);
      const palette = dynColors(shown.length);
      groups = shown.map((k, i) => ({ label: k, match: { field, eq: k }, color: palette[i] }));
      if (keys.length > top) groups.push({ label: 'Other', match: { field, in: keys.slice(top) }, color: 'oklch(0.62 0.03 200)' });
    }
    const parts = groups.map(gr => ({ value: S.spend(scoped, gr.match || gr.bool || 'all', pf), color: gr.color, label: gr.label }));
    const total = parts.reduce((a, p) => a + p.value, 0);
    return {
      kind: 'moneyDonut', isMoneyDonut: true, title: spec.title,
      donutStyle: S.donutFromParts(parts.map(p => ({ value: p.value, color: p.color }))),
      centerValue: S.money(total), centerLabel: spec.centerLabel || 'spent', centerSize: fitFont(S.money(total), [[6, '19px'], [9, '16px'], [12, '13px'], [99, '12px']]),
      yearValue: yearVal, yearOptions, setYear: e => ctx.self.setState({ spendYear: e.target.value }),
      legend: parts.map(p => ({ color: p.color, label: p.label, amount: S.money(p.value) })),
    };
  }

  // A plain bar-list bag (reuses the StatWidget barList template) from label/value/pct rows.
  function barBag(title, rows, o) {
    o = o || {};
    return {
      kind: 'barList', isBarList: true, title, hasPodium: false, podiumRow: [], showRank: false, rows,
      rowGap: o.rowGap || '9px', cellGap: '12px', labelWidth: o.labelWidth || '120px', labelSize: '12.5px',
      barColor: o.barColor || ACC, barOpacity: o.barOpacity || '1',
      valWidth: o.valWidth || '96px', valColor: o.valColor || 'var(--text2,#c8d6cb)', valSize: '12px', valWeight: '600',
    };
  }

  // Sum a numeric field grouped by another field (e.g. spend by category).
  function sumBarsWidget(cfg, items, spec) {
    const S = SS(), pf = priceOf(cfg), sf = cfg.statusField;
    let list = items; if (spec.type) list = list.filter(x => x[sf] === spec.type);
    const sums = {};
    list.forEach(x => { const k = (x[spec.group] == null ? '' : String(x[spec.group]).trim()) || '—'; sums[k] = (sums[k] || 0) + (Number(x[pf]) || 0); });
    const keys = Object.keys(sums).filter(k => sums[k] > 0).sort((a, b) => sums[b] - sums[a]).slice(0, spec.top || 8);
    if (spec.hideWhenEmpty && !keys.length) return null;
    const maxV = Math.max(1, ...keys.map(k => sums[k]));
    const rows = keys.map(k => ({ label: k, val: S.money(sums[k]), pct: Math.round(sums[k] / maxV * 100) + '%' }));
    return barBag(spec.title, rows, { barColor: spec.barColor, valColor: spec.valColor, labelWidth: spec.labelWidth });
  }

  // Spend per weekday (Mon→Sun), expenses only.
  function weekdayWidget(cfg, items, spec) {
    const S = SS(), pf = priceOf(cfg), sf = cfg.statusField, names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sums = [0, 0, 0, 0, 0, 0, 0];
    items.filter(x => x[sf] === 'expense' && x.date).forEach(x => { const d = dnum(x.date); if (d) sums[d.getDay()] += (Number(x[pf]) || 0); });
    const order = [1, 2, 3, 4, 5, 6, 0], maxV = Math.max(1, ...sums);
    const rows = order.map(i => ({ label: names[i], val: S.money(sums[i]), pct: Math.round(sums[i] / maxV * 100) + '%' }));
    return barBag(spec.title, rows, { barColor: spec.barColor || ACC, labelWidth: '52px', valWidth: '96px' });
  }

  // Monthly spend trend (bars with month labels).
  function trendBarsWidget(cfg, items, spec) {
    const S = SS(), pf = priceOf(cfg), sf = cfg.statusField, type = spec.type || 'expense';
    const sums = {};
    items.filter(x => x[sf] === type && x.date).forEach(x => { const k = monthKey(x.date); sums[k] = (sums[k] || 0) + (Number(x[pf]) || 0); });
    const keys = Object.keys(sums).sort().slice(-(spec.months || 12));
    const maxV = Math.max(1, ...keys.map(k => sums[k]));
    const bars = keys.map(k => ({ label: monthShort(k), amount: S.money(sums[k]), pct: Math.round(sums[k] / maxV * 100) + '%' }));
    return { kind: 'trend', isTrend: true, title: spec.title, bars, barColor: spec.barColor || ACC, empty: !keys.length };
  }

  // GitHub-style calendar heatmap of daily spend across the trailing window.
  function heatmapWidget(cfg, items, spec) {
    const S = SS(), pf = priceOf(cfg), sf = cfg.statusField;
    const byDay = {};
    items.filter(x => x[sf] === 'expense' && x.date).forEach(x => { const k = ymd(x.date); byDay[k] = (byDay[k] || 0) + (Number(x[pf]) || 0); });
    const dates = Object.keys(byDay).sort();
    const weeksN = spec.weeks || 26;
    const end = dates.length ? dnum(dates[dates.length - 1]) : new Date();
    // walk back to the Sunday starting the window
    const endSun = new Date(end); endSun.setDate(endSun.getDate() + (6 - endSun.getDay()));
    const start = new Date(endSun); start.setDate(start.getDate() - (weeksN * 7 - 1));
    const maxV = Math.max(1, ...Object.values(byDay));
    const lvlColor = v => v <= 0 ? 'var(--wc)' : `color-mix(in srgb, var(--accent) ${18 + Math.round(v / maxV * 72)}%, transparent)`;
    const weeks = []; let cur = new Date(start); let lastMon = -1;
    const monthCols = [];
    for (let w = 0; w < weeksN; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const iso = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
        const v = byDay[iso] || 0;
        col.push({ color: lvlColor(v), title: iso + (v ? ' · ' + S.money(v) : ''), future: cur > end });
        if (d === 0) { const m = cur.getMonth(); monthCols.push(m !== lastMon ? MON[m] : ''); lastMon = m; }
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push({ col });
    }
    return { kind: 'heatmap', isHeatmap: true, title: spec.title, weeks, monthCols };
  }

  function buildWidget(cfg, items, spec, ctx) {
    if (spec.kind === 'barList') return barListWidget(cfg, items, spec);
    if (spec.kind === 'sumBars') return sumBarsWidget(cfg, items, spec);
    if (spec.kind === 'weekday') return weekdayWidget(cfg, items, spec);
    if (spec.kind === 'trend') return trendBarsWidget(cfg, items, spec);
    if (spec.kind === 'heatmap') return heatmapWidget(cfg, items, spec);
    if (spec.kind === 'histogram') return histogramWidget(cfg, items, spec);
    if (spec.kind === 'byYear') return byYearWidget(cfg, items, spec);
    if (spec.kind === 'tagRating') return tagRatingWidget(cfg, items, spec);
    if (spec.kind === 'statusDonut') return statusDonutWidget(cfg, items, spec, ctx);
    if (spec.kind === 'moneyDonut') return moneyDonutWidget(cfg, items, spec, ctx);
    return null;
  }

  function buildStats(self) {
    const cfg = self.CONFIG, items = self.state.games, st = self.state;
    const accent = (self.props && self.props.accent) || '#9ce6b0';
    const ctx = { self, accent, spendYear: st.spendYear };
    const summary = (cfg.stats.summary || []).map(spec => {
      const m = metric(cfg, items, spec);
      return { value: m.value, label: spec.label, color: spec.accent ? ACC : 'var(--text,#e8ebe8)', size: fitFont(m.value, SUMMARY_STEPS) };
    });
    const build = list => (list || []).map(spec => buildWidget(cfg, items, spec, ctx)).filter(Boolean);
    return {
      openExport: self.openExport,
      statsGridCols: st.isMobile ? '1fr' : '1.15fr .85fr',
      summary, left: build(cfg.stats.left), right: build(cfg.stats.right),
    };
  }

  function buildStrip(self) {
    const cfg = self.CONFIG, items = self.state.games;
    return (cfg.stats.strip || []).map(spec => {
      const m = metric(cfg, items, spec);
      return { value: m.value, label: spec.label, color: spec.accent ? ACC : (spec.color || 'inherit') };
    });
  }

  // ============================ GEO ============================
  //  Generic geographic aggregation for the Map tab. Groups items by the
  //  coarse origin parsed from cfg.geo.field (default: last comma-segment of the
  //  region string — "Mendoza, Argentina" -> "Argentina"). Returns only generic
  //  { region, count, items } stats; GeoMap knows nothing about the collection.
  function buildGeo(self) {
    const cfg = self.CONFIG, items = self.state.games;
    const g = cfg.geo || {};
    const field = g.field || 'region';
    const primary = (cfg.table.columns.find(c => c.primary) || {}).key || 'title';
    const accent = (self.props && self.props.accent) || (cfg.theme && cfg.theme.accent) || '#c6a9d6';
    // parser: default = last comma-separated token; configurable per collection.
    const parse = typeof g.parse === 'function' ? g.parse : (raw => {
      if (!raw) return null;
      const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null;
    });
    // Emit a stat for EVERY comma-token (province AND country) so the map can
    // match at any layer — "Mendoza, Argentina" credits both "Mendoza" and
    // "Argentina". `countries` = the coarse (last-segment) origins, used by the
    // map to know which countries' provinces to lazy-load.
    const map = {}, countries = new Set();
    let placed = 0;
    (items || []).forEach(it => {
      const raw = it[field];
      if (!raw) return;
      const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
      if (!parts.length) { void parse; return; }
      placed++;
      countries.add(parts[parts.length - 1]);
      parts.forEach(tok => {
        const bucket = map[tok] || (map[tok] = { region: tok, count: 0, items: [] });
        bucket.count++;
        bucket.items.push(it[primary]);
      });
    });
    const stats = Object.values(map).sort((a, b) => b.count - a.count);
    return {
      stats, accent,
      countries: [...countries],
      noun: (cfg.nounPlural || 'items'),
      title: g.label || 'Origins',
      subtitle: g.subtitle || '',
      unmapped: (items || []).length - placed,
      totalItems: placed,
      regionCount: countries.size,
    };
  }

  // ============================ SHARE ============================
  //  Builds the shareable-image modal data: toggle chips, year-scope controls,
  //  and the ordered list of selected module widgets (compact skin) rendered by
  //  the shared ShareImage. Module set / order / labels come from
  //  cfg.stats.shareModules; year scope from cfg.stats.shareYearField.
  function buildShare(self) {
    const cfg = self.CONFIG, st = self.state, acc = ACC, S = SS();
    const primary = (cfg.table.columns.find(c => c.primary) || {}).key || 'title';
    const accent = (self.props && self.props.accent) || '#9ce6b0';
    const yf = cfg.stats.shareYearField, esel = st.exportSel;

    // scope games by completion year
    const yearsAvail = [...new Set(self.state.games.map(g => g[yf]).filter(Boolean).map(String))].sort();
    let g = self.state.games, scopeLabel = 'All time';
    if (st.exportYearMode === 'year' && st.exportYear) {
      g = self.state.games.filter(x => String(x[yf]) === String(st.exportYear));
      scopeLabel = String(st.exportYear);
    } else if (st.exportYearMode === 'range' && st.exportFrom && st.exportTo) {
      const a = Math.min(+st.exportFrom, +st.exportTo), b = Math.max(+st.exportFrom, +st.exportTo);
      g = self.state.games.filter(x => x[yf] && +x[yf] >= a && +x[yf] <= b);
      scopeLabel = a === b ? String(a) : (a + '–' + b);
    }

    const F = cfg.fields || { score: 'score', hours: 'hours', price: 'price', platform: 'platform' };
    const allW = [...(cfg.stats.left || []), ...(cfg.stats.right || [])];
    const sdSpec = allW.find(w => w.kind === 'statusDonut');
    const mdSpec = allW.find(w => w.kind === 'moneyDonut');

    const total = g.length;
    const played = g.filter(x => x[cfg.statusField] === 'played').length;
    const playing = g.filter(x => x[cfg.statusField] === 'playing').length;
    const backlog = g.filter(x => x[cfg.statusField] === 'backlog').length;
    const scoredArr = g.map(x => x[F.score]).filter(v => v != null);
    const avg = scoredArr.length ? scoredArr.reduce((a, b) => a + b, 0) / scoredArr.length : 0;
    const hours = g.map(x => x[F.hours]).filter(h => h != null).reduce((a, b) => a + b, 0);
    const completion = total ? Math.round(played / total * 100) : 0;

    const summaryCards = (cfg.stats.summary || []).map(spec => {
      const m = metric(cfg, g, spec);
      return { value: m.value, label: spec.label, color: spec.accent ? acc : 'var(--text,#e8ebe8)' };
    });
    const byScore = g.filter(x => x[F.score] != null).sort((a, b) => b[F.score] - a[F.score]);
    const topRatedRows = byScore.slice(0, 5).map((x, i) => ({ rank: String(i + 1), label: x[primary], val: String(x[F.score]), pct: (x[F.score] * 10) + '%' }));
    const hoursGames = g.filter(x => x[F.hours] != null).sort((a, b) => b[F.hours] - a[F.hours]);
    const maxHours = hoursGames.length ? hoursGames[0][F.hours] : 1;
    const mostPlayedRows = hoursGames.slice(0, 5).map(x => ({ label: x[primary], val: x[F.hours] + 'h', pct: Math.round(x[F.hours] / maxHours * 100) + '%' }));
    const distCount = {}; for (let i = 1; i <= 10; i++) distCount[i] = 0;
    byScore.forEach(x => { const b = Math.max(1, Math.min(10, Math.round(x[F.score]))); distCount[b]++; });
    const maxDist = Math.max(1, ...Object.values(distCount));
    const scoreDistBars = []; for (let i = 1; i <= 10; i++) scoreDistBars.push({ label: i, count: distCount[i], pct: Math.round(distCount[i] / maxDist * 100) + '%', color: i >= 9 ? acc : i >= 7 ? 'color-mix(in srgb, var(--accent) 60%, transparent)' : 'color-mix(in srgb, var(--accent) 28%, transparent)' });
    // status rows derive from the stats statusDonut segments (or cfg.statuses)
    const statusSegs = (sdSpec && sdSpec.segments) ? sdSpec.segments : cfg.statuses.map(s => ({ status: s.value, legendColor: s.dot }));
    const statusRows = statusSegs.map(seg => {
      const count = g.filter(x => x[cfg.statusField] === seg.status).length;
      return { label: statusMeta(cfg, seg.status).label, val: String(count), barColor: (seg.legendColor || seg.color).replace('{accent}', accent), pct: (total ? Math.round(count / total * 100) : 0) + '%' };
    });
    const tc = {}; g.forEach(x => (x[cfg.tagField] || []).forEach(t => tc[t] = (tc[t] || 0) + 1));
    const maxT = Math.max(1, ...Object.values(tc));
    const topTagsRows = Object.keys(tc).sort((a, b) => tc[b] - tc[a]).slice(0, 6).map(t => ({ label: t, val: String(tc[t]), pct: Math.round(tc[t] / maxT * 100) + '%' }));
    // top tags by rating — for each tag, the avg score of games carrying it
    const tagAgg = {}; g.forEach(x => { const r = x[F.score]; (x[cfg.tagField] || []).forEach(t => { const a = tagAgg[t] || (tagAgg[t] = { sum: 0, n: 0, cnt: 0 }); a.cnt++; if (r != null) { a.sum += r; a.n++; } }); });
    const topTagsRatedRows = Object.keys(tagAgg).filter(t => tagAgg[t].n > 0)
      .map(t => ({ t, avg: tagAgg[t].sum / tagAgg[t].n, cnt: tagAgg[t].cnt }))
      .sort((a, b) => b.avg - a.avg || b.cnt - a.cnt).slice(0, 10)
      .map(k => ({ label: k.t + ' · ' + k.cnt, val: '★' + k.avg.toFixed(1), pct: Math.round(k.avg / 10 * 100) + '%' }));
    const pcc = {}; g.forEach(x => { const p = (x[F.platform] || '').trim(); if (p) pcc[p] = (pcc[p] || 0) + 1; });
    const maxPc = Math.max(1, ...Object.values(pcc));
    const platformRows = Object.keys(pcc).sort((a, b) => pcc[b] - pcc[a]).slice(0, 6).map(p => ({ label: p, val: String(pcc[p]), pct: Math.round(pcc[p] / maxPc * 100) + '%' }));
    const ycc = {}; g.forEach(x => { if (x[yf]) ycc[x[yf]] = (ycc[x[yf]] || 0) + 1; });
    const yrs = Object.keys(ycc).sort(); const maxYc = Math.max(1, ...Object.values(ycc));
    const byYearBars = yrs.map(y => ({ label: y, count: ycc[y], pct: Math.round(ycc[y] / maxYc * 100) + '%' }));
    // spending derives from the stats moneyDonut groups, scoped to played items
    const spendGroups = (mdSpec && mdSpec.groups) ? mdSpec.groups : [];
    const spendBase = g.filter(x => x[cfg.statusField] === 'played');
    const spendParts = spendGroups.map(gr => ({ value: S.spend(spendBase, gr.match || gr.bool || 'all', F.price), color: gr.color, label: gr.label }));
    const spentTotal = spendParts.reduce((a, p) => a + p.value, 0);
    const spending = { has: spentTotal > 0, hasNot: !(spentTotal > 0), total: S.money(spentTotal),
      donut: S.donutFromParts(spendParts.map(p => ({ value: p.value, color: p.color }))),
      emptyMsg: 'No prices recorded for played ' + (cfg.nounPlural || 'items') + ' in this range yet — add prices to see this.',
      legend: spendParts.map(p => ({ label: p.label, amount: S.money(p.value), color: p.color })) };

    const bar = (title, rows, o) => {
      rows.forEach(r => { if (r.barColor == null) r.barColor = o.barColor || acc; });
      return { kind: 'sBar', isBar: true, title, rows, showRank: !!o.showRank,
        labelWidth: o.labelWidth, labelColor: o.labelColor || 'inherit', labelSize: o.labelSize || '12.5px',
        barOpacity: o.barOpacity || '1', rowGap: o.rowGap || '8px',
        valColor: o.valColor || 'var(--text2,#c8d6cb)', valWidth: o.valWidth, valSize: o.valSize || '12px', valWeight: o.valWeight || '600' };
    };
    const makers = {
      summary: () => ({ kind: 'sCards', isCards: true, title: 'Overview', cards: summaryCards }),
      topRated: () => topRatedRows.length ? bar('Highest rated', topRatedRows, { showRank: true, labelWidth: '150px', barColor: acc, valColor: acc, valWidth: '24px' }) : null,
      mostPlayed: () => mostPlayedRows.length ? bar('Most played · hours', mostPlayedRows, { labelWidth: '170px', barColor: '#5b9e73', valColor: 'var(--text2,#c8d6cb)', valWidth: '42px' }) : null,
      scoreDist: () => ({ kind: 'sHistogram', isHistogram: true, title: 'Score distribution', bars: scoreDistBars }),
      status: () => bar('Library status', statusRows, { labelWidth: '74px', labelColor: 'var(--text2,#c8d6cb)', rowGap: '9px', valColor: 'var(--text2,#c8d6cb)', valWidth: '26px' }),
      spending: () => ({ kind: 'sSpending', isSpending: true, title: 'Spending', ...spending }),
      topTags: () => topTagsRows.length ? bar('Top tags', topTagsRows, { labelWidth: '96px', labelSize: '12px', barColor: acc, barOpacity: '.85', valColor: 'var(--muted,#8b938d)', valWidth: '22px', valSize: '11.5px', valWeight: '400' }) : null,
      topTagsRated: () => topTagsRatedRows.length ? bar('Top tags by rating', topTagsRatedRows, { labelWidth: '150px', labelSize: '12px', barColor: acc, barOpacity: '.9', valColor: acc, valWidth: '42px', valSize: '12px' }) : null,
      platforms: () => platformRows.length ? bar('Platforms', platformRows, { labelWidth: '96px', labelSize: '12px', barColor: '#7fb894', valColor: 'var(--muted,#8b938d)', valWidth: '22px', valSize: '11.5px', valWeight: '400' }) : null,
      byYear: () => byYearBars.length ? ({ kind: 'sByYear', isByYear: true, title: 'Completed by year', bars: byYearBars }) : null,
    };

    const mods = cfg.stats.shareModules || [];
    const yChip = (m, label) => ({ label, onClick: () => self.setExportYearMode(m), pressed: st.exportYearMode === m ? 'true' : 'false',
      color: st.exportYearMode === m ? 'var(--onAccent,#0d0f0e)' : 'var(--text2,#c8d6cb)', bg: st.exportYearMode === m ? acc : 'var(--chip,#20241f)', border: st.exportYearMode === m ? acc : 'var(--wf)' });
    const expModules = mods.map(m => { const on = !!esel[m.key];
      return { key: m.key, label: m.label, on, onToggle: () => self.toggleExportSel(m.key),
        color: on ? 'var(--onAccent,#0d0f0e)' : 'var(--text2,#c8d6cb)', bg: on ? acc : 'var(--chip,#20241f)', border: on ? acc : 'var(--wf)', mark: on ? '✓' : '+', pressed: on ? 'true' : 'false' }; });
    const anySel = mods.some(m => esel[m.key]);
    const modules = mods.filter(m => esel[m.key]).map(m => makers[m.key] ? makers[m.key]() : null).filter(Boolean);

    return {
      closeExport: self.closeExport, stop: e => e.stopPropagation(),
      exportTitle: st.exportTitle, onExportTitle: self.onExportTitle,
      hasExportTitle: !!(st.exportTitle || '').trim(), exportTitleShown: (st.exportTitle || '').trim(),
      expScopeLabel: scopeLabel, expDate: new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      expBrand: cfg.brand || 'Backlog', expKind: cfg.kicker || ('// ' + (cfg.nounPlural || 'items')),
      expYearChips: [yChip('all', 'All time'), yChip('year', 'By year'), yChip('range', 'Interval')],
      expYearModeYear: st.exportYearMode === 'year', expYearModeRange: st.exportYearMode === 'range',
      exportYear: st.exportYear, exportFrom: st.exportFrom, exportTo: st.exportTo,
      onExportYear: self.onExportYear, onExportFrom: self.onExportFrom, onExportTo: self.onExportTo,
      expYearOptions: yearsAvail.map(y => ({ value: y, label: y })),
      expModules,
      copyExportImage: self.copyExportImage, downloadExportImage: self.downloadExportImage,
      copyLabel: st.exportBusy ? 'Rendering…' : 'Copy image', copyOpacity: (st.exportBusy || !anySel) ? '.5' : '1',
      copyBusy: st.exportBusy ? 'true' : 'false', copyDisabled: !!(st.exportBusy || !anySel),
      hasExportMsg: !!st.exportMsg, exportMsg: st.exportMsg,
      expNoneSel: !anySel, modules,
    };
  }

  // ========================= SHARE CARD =========================
  //  Per-item shareable card. Config-driven: the toggle list is derived from the
  //  collection's modal fields (respecting group showWhen for the item), so games,
  //  books, movies etc. all work with zero collection-specific code. The user
  //  picks which details appear; `st.shareItem` is the item, `st.shareCardSel` the
  //  chosen field keys, `st.shareCaption` an optional caption.
  function buildShareCard(self) {
    const cfg = self.CONFIG, st = self.state, acc = ACC;
    const item = st.shareItem;
    if (!item) return { shareCardOpen: false };

    const m = cfg.modal, titleKey = m.titleField;
    const sf = cfg.statusField, tf = cfg.tagField;
    const scoreKey = (cfg.fields && cfg.fields.score) || 'score';
    const priceKey = (cfg.fields && cfg.fields.price) || 'price';
    const reviewKey = cfg.detail && cfg.detail.reviewField;
    const numFields = m.numberFields || [];
    const unitMap = {}; (cfg.table.columns || []).forEach(c => { if (c.unit) unitMap[c.key] = c.unit; });
    const maxMap = {}; m.groups.forEach(gr => gr.fields.forEach(f => { if (f.max != null) maxMap[f.key] = f.max; }));

    // candidate fields = every modal field (bar the title) whose group is visible
    // for this item and that actually has a value.
    const hasVal = f => {
      const v = item[f.key];
      if (f.kind === 'tags') return Array.isArray(v) && v.length > 0;
      if (f.kind === 'toggle') return !!v;
      return !isEmpty(v);
    };
    const cand = [];
    m.groups.forEach(gr => {
      if (gr.showWhen && !condMatch(gr.showWhen, item)) return;
      gr.fields.forEach(f => { if (f.key !== titleKey && hasVal(f)) cand.push(f); });
    });

    const sel = k => !!(st.shareCardSel || {})[k];
    const chips = cand.map(f => { const on = sel(f.key);
      return { key: f.key, label: f.label.replace(/\s*\(optional\)/i, ''), on, onToggle: () => self.toggleShareField(f.key),
        color: on ? 'var(--onAccent,#0d0f0e)' : 'var(--text2,#c8d6cb)', bg: on ? acc : 'var(--chip,#20241f)', border: on ? acc : 'var(--wf)', mark: on ? '✓' : '+', pressed: on ? 'true' : 'false' }; });
    const anySel = cand.some(f => sel(f.key));

    // categorise the selected fields into the card's regions.
    const chosen = cand.filter(f => sel(f.key));
    const yearFields = m.yearFields || [];
    const fmtVal = f => {
      const v = item[f.key];
      if (f.key === priceKey) return money2(v);
      if (f.kind === 'toggle') return 'Yes';
      if (f.kind === 'tags') return (v || []).join(', ');
      if (yearFields.includes(f.key)) return String(v);
      if (f.kind === 'number') return fmt(v) + (unitMap[f.key] || '');
      return String(v);
    };

    const scoreField = chosen.find(f => f.key === scoreKey);
    const statusField = chosen.find(f => f.kind === 'status');
    const tagFields = chosen.filter(f => f.kind === 'tags');
    const reviewFields = chosen.filter(f => f.kind === 'longtext');
    const statFields = chosen.filter(f => f !== scoreField && f.kind !== 'status' && f.kind !== 'tags' && f.kind !== 'longtext');

    const sm = statusField ? statusMeta(cfg, item[sf]) : null;
    const statCells = statFields.map(f => ({ label: f.label.replace(/\s*\(optional\)/i, ''), value: fmtVal(f), color: f.key === priceKey ? 'oklch(0.8 0.09 85)' : 'var(--text2,#c8d6cb)' }));
    const tagGroups = tagFields.map(f => ({ label: f.label, chips: (item[f.key] || []).map(t => ({ tag: t })) }));

    return {
      shareCardOpen: true, closeShareCard: self.closeShareCard, stop: e => e.stopPropagation(),
      headline: 'Share this ' + (cfg.noun || 'item'),
      captionPlaceholder: 'Add a note…',
      captionText: st.shareCaption || '', onCaption: self.onShareCaption, hasCaption: !!(st.shareCaption || '').trim(),
      chips, isEmpty: !anySel,
      copyShareCard: self.copyShareCard, downloadShareCard: self.downloadShareCard,
      copyLabel: st.shareBusy ? 'Rendering…' : 'Copy image', copyOpacity: (st.shareBusy || !anySel) ? '.5' : '1',
      copyBusy: st.shareBusy ? 'true' : 'false', copyDisabled: !!(st.shareBusy || !anySel),
      hasMsg: !!st.shareMsg, msg: st.shareMsg,
      // card
      brand: cfg.brand || 'Backlog', kicker: cfg.kicker || ('// ' + (cfg.nounPlural || 'items')),
      dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      itemTitle: item[titleKey] || 'Untitled',
      hasHero: !!(scoreField || statusField),
      hasScore: !!scoreField, scoreValue: scoreField ? String(item[scoreKey]) : '', scoreMax: scoreField && maxMap[scoreKey] != null ? ('/ ' + maxMap[scoreKey]) : '', scoreCol: scoreField ? scoreColor(item[scoreKey]) : ACC, scoreLabel: scoreField ? scoreField.label : '',
      hasStatus: !!statusField, statusLabel: sm ? sm.label : '', statusDot: sm ? sm.dot : 'transparent', statusGlow: sm ? sm.glow : 'none', statusTextCol: sm ? sm.text : 'var(--text2,#c8d6cb)',
      hasStats: statCells.length > 0, statCells,
      hasTags: tagGroups.length > 0, tagGroups,
      hasReview: reviewFields.length > 0, reviewLabel: reviewFields.length ? reviewFields[0].label.replace(/\s*\(optional\)/i, '') : '', reviewText: reviewFields.length ? item[reviewFields[0].key] : '',
    };
  }

  // ============================ MONTHS ============================
  //  Groups transactions into per-month summaries + a drill-down bag (calendar
  //  heatmap, category breakdown, transaction list). Finance-only; keyed off the
  //  `date`, `amount`, `category` and statusField(`type`) fields.
  function buildMonths(self) {
    const cfg = self.CONFIG, items = self.state.games, st = self.state, S = SS();
    const pf = priceOf(cfg), sf = cfg.statusField, titleKey = cfg.modal.titleField;
    const acc = 'var(--accent,#8ecfd6)';
    const groups = {};
    items.forEach(x => { const k = monthKey(x.date); if (!k) return; (groups[k] = groups[k] || []).push(x); });
    const keys = Object.keys(groups).sort().reverse();

    const sumType = (list, t) => list.filter(x => x[sf] === t).reduce((a, b) => a + (Number(b[pf]) || 0), 0);
    const topCat = list => {
      const c = {}; list.filter(x => x[sf] === 'expense').forEach(x => { const k = x.category || 'Other'; c[k] = (c[k] || 0) + (Number(x[pf]) || 0); });
      const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : '—';
    };
    const CARD = [[8, '17px'], [10, '15px'], [12, '13px'], [99, '12px']];
    const CARD_SM = [[8, '14px'], [11, '12px'], [99, '11px']];
    const DRILL = [[6, '24px'], [8, '21px'], [10, '18px'], [12, '16px'], [99, '14px']];
    const months = keys.map(k => {
      const list = groups[k], spent = sumType(list, 'expense'), income = sumType(list, 'income');
      const big = list.filter(x => x[sf] === 'expense').sort((a, b) => (b[pf] || 0) - (a[pf] || 0))[0];
      return {
        key: k, label: monthLabel(k), spent: S.money(spent), income: S.money(income), saved: S.money(income - spent),
        spentSize: fitFont(S.money(spent), CARD), incomeSize: fitFont(S.money(income), CARD), savedSize: fitFont(S.money(income - spent), CARD_SM),
        savedColor: income - spent >= 0 ? acc : '#d98f8f', txns: String(list.length), topCategory: topCat(list),
        biggest: big ? big[titleKey] : '—', biggestAmt: big ? S.money(big[pf]) : '',
        onOpen: () => self.setState({ openMonth: k }),
        openLabel: 'Open ' + monthLabel(k),
        onKey: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.setState({ openMonth: k }); } },
      };
    });

    let open = null;
    if (st.openMonth && groups[st.openMonth]) {
      const k = st.openMonth, list = groups[k].slice().sort((a, b) => ymd(b.date).localeCompare(ymd(a.date)));
      const spent = sumType(list, 'expense'), income = sumType(list, 'income');
      // calendar for that month
      const [yy, mm] = k.split('-').map(Number);
      const first = new Date(yy, mm - 1, 1), daysIn = new Date(yy, mm, 0).getDate();
      const byDay = {}; list.filter(x => x[sf] === 'expense').forEach(x => { const d = +ymd(x.date).slice(8, 10); byDay[d] = (byDay[d] || 0) + (Number(x[pf]) || 0); });
      const maxV = Math.max(1, ...Object.values(byDay));
      const cells = [];
      for (let i = 0; i < first.getDay(); i++) cells.push({ blank: true });
      for (let d = 1; d <= daysIn; d++) {
        const v = byDay[d] || 0;
        cells.push({ day: String(d), spend: v, has: v > 0, tip: v ? S.money(v) : '', color: v > 0 ? `color-mix(in srgb, var(--accent) ${18 + Math.round(v / maxV * 72)}%, transparent)` : 'var(--wb)' });
      }
      // category breakdown
      const catSums = {}; list.filter(x => x[sf] === 'expense').forEach(x => { const c = x.category || 'Other'; catSums[c] = (catSums[c] || 0) + (Number(x[pf]) || 0); });
      const catKeys = Object.keys(catSums).sort((a, b) => catSums[b] - catSums[a]);
      const catMax = Math.max(1, ...catKeys.map(c => catSums[c]));
      const categories = catKeys.map(c => ({ label: c, val: S.money(catSums[c]), pct: Math.round(catSums[c] / catMax * 100) + '%' }));
      const txns = list.map(x => {
        const t = x[sf];
        return {
          date: MON[(+ymd(x.date).slice(5, 7)) - 1] + ' ' + (+ymd(x.date).slice(8, 10)),
          title: x[titleKey], category: x.category || '—', notes: x.notes || '',
          amount: (t === 'income' ? '+' : t === 'expense' ? '−' : '') + S.money(x[pf]),
          color: t === 'income' ? acc : (t === 'expense' ? '#d98f8f' : 'var(--muted,#8b938d)'),
          onClick: () => self.openEdit(x),
          openLabel: 'Edit ' + (x[titleKey] || 'transaction'),
          onKey: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.openEdit(x); } },
        };
      });
      open = {
        key: k, label: monthLabel(k), spent: S.money(spent), income: S.money(income), saved: S.money(income - spent),
        spentSize: fitFont(S.money(spent), DRILL), incomeSize: fitFont(S.money(income), DRILL), savedSize: fitFont(S.money(income - spent), DRILL),
        savedColor: income - spent >= 0 ? acc : '#d98f8f', txnCount: String(list.length), topCategory: topCat(list),
        weekLabels: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], cells, categories, txns,
        onBack: () => self.setState({ openMonth: null }),
      };
    }
    return { hasMonths: months.length > 0, months, open, isOpen: !!open, onCurrency: self.toggleCurrency, currencyLabel: (window.__CURRENCY || {}).code || 'USD' };
  }

  window.CollectionLib = {
    ACC, fmt, money, money2, isEmpty, statusMeta, scoreColor, allTags, tagCounts,
    matches, sorted, pool, blankDraft, draftFromItem, itemFromDraft,
    buildTable, buildModal, buildRoulette, buildStats, buildStrip, buildGeo, buildShare, buildShareCard, buildMonths, metric, linkUrl,
  };
})();
