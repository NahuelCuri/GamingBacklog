// Shared price / spending system for the Backlog app.
// Used by every collection (Games now; Books, Wines later) to keep money math
// and the bought/pirated/gamepass donut identical everywhere.
(function () {
  var COLORS = {
    bought: 'oklch(0.74 0.1 85)',
    pirated: 'oklch(0.66 0.13 25)',
    gamepass: 'oklch(0.68 0.14 155)',
  };

  // Global display-currency state. Base amounts are always stored in USD; a
  // collection (e.g. Expenses) flips this to re-render every money value in ARS
  // using a live rate. Games/Books/Wines never touch it, so they stay USD.
  window.__CURRENCY = window.__CURRENCY || { code: 'USD', symbol: '$', rate: 1 };

  // Rounded, thousands-separated, in the active display currency.
  //  money(1234.5) -> "US$1,235"  (or "AR$…" once the currency is switched)
  function money(n) {
    var c = window.__CURRENCY || { symbol: '$', rate: 1 };
    var v = (Number(n) || 0) * (c.rate || 1);
    return c.symbol + Math.round(v).toLocaleString('en-US');
  }
  // Two-decimal variant used by detail rows / priciest lists.
  function money2(n) {
    if (n == null || n === '') return '—';
    var c = window.__CURRENCY || { symbol: '$', rate: 1 };
    var v = (Number(n) || 0) * (c.rate || 1);
    return c.symbol + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Does an item match a selector?
  //   'all' | null            -> everything
  //   'owned' (string)        -> item[str] is truthy  (legacy bool flag)
  //   { field, eq }           -> item[field] === eq
  //   { field, in:[...] }     -> item[field] is one of the list
  //   { field, notIn:[...] }  -> item[field] is NOT one of the list
  // Field-based selectors let a collection derive money buckets from an existing
  // field (e.g. platform: Steam/GamePass/Pirated) instead of duplicate toggles.
  function matchSel(item, sel) {
    if (sel == null || sel === 'all') return true;
    if (typeof sel === 'string') return !!item[sel];
    var v = item[sel.field];
    if ('eq' in sel) return v === sel.eq;
    if (sel.in) return sel.in.indexOf(v) !== -1;
    if (sel.notIn) return sel.notIn.indexOf(v) === -1;
    return true;
  }

  // Sum item.price across a list. `sel` selects the bucket (see matchSel).
  //  `priceField` lets a collection store its price under another key (default 'price').
  function spend(items, sel, priceField) {
    var pf = priceField || 'price';
    return items
      .filter(function (x) { return x[pf] != null && matchSel(x, sel); })
      .reduce(function (a, b) { return a + Number(b[pf]); }, 0);
  }

  // conic-gradient string for the bought/pirated/gamepass split.
  function donut(bought, pirated, gamepass) {
    var total = bought + pirated + gamepass;
    if (!total) return 'rgba(255,255,255,.07)';
    var bp = bought / total * 100;
    var pp = pirated / total * 100;
    return 'conic-gradient(' + COLORS.bought + ' 0 ' + bp + '%, ' +
      COLORS.pirated + ' ' + bp + '% ' + (bp + pp) + '%, ' +
      COLORS.gamepass + ' ' + (bp + pp) + '% 100%)';
  }

  // conic-gradient string for an arbitrary ordered list of parts.
  //   parts: [{ value:Number, color:String }, ...]
  function donutFromParts(parts) {
    var total = parts.reduce(function (a, p) { return a + p.value; }, 0);
    if (!total) return 'rgba(255,255,255,.07)';
    var acc = 0;
    var stops = parts.map(function (p) {
      var a = acc / total * 100; acc += p.value; var b = acc / total * 100;
      return p.color + ' ' + a + '% ' + b + '%';
    });
    return 'conic-gradient(' + stops.join(', ') + ')';
  }

  // Switch the global display currency. rate = display units per 1 USD.
  function setCurrency(code, symbol, rate) {
    window.__CURRENCY = { code: code, symbol: symbol, rate: Number(rate) || 1 };
  }

  window.SpendingSystem = { money: money, money2: money2, spend: spend, matchSel: matchSel, donut: donut, donutFromParts: donutFromParts, setCurrency: setCurrency, COLORS: COLORS };
})();
