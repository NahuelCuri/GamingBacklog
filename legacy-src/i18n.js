// ============================================================================
//  Lightweight per-user Spanish translation for the Books experience.
//  English is the default; a small EN/ES toggle (bottom-left) stores the choice
//  in localStorage, so one user can read the whole app in Spanish on their own
//  device while everyone else stays in English — no backend, no config changes.
//
//  How it works: rather than threading a `lang` prop through every component,
//  this script translates the rendered DOM. When ES is active it walks visible
//  text nodes (+ placeholder/title attributes) and swaps any that exactly match
//  a dictionary entry, remembering the original so EN can be restored live. A
//  MutationObserver re-applies after React re-renders. Nodes inside a
//  [data-no-i18n] element (e.g. the "Backlog" brand) are never touched, and
//  user data (book titles, author names) never matches a key so it's left alone.
// ============================================================================
(function () {
  // English source  →  Spanish.  Keys are matched against trimmed text.
  var ES = {
    // ---- auth ----
    'loading…': 'cargando…',
    'Sign in to your backlog.': 'Inicia sesión en tu backlog.',
    'Create an account to start syncing.': 'Crea una cuenta para empezar a sincronizar.',
    'Email': 'Correo',
    'Password': 'Contraseña',
    'Sign in': 'Iniciar sesión',
    'Create account': 'Crear cuenta',
    'Please wait…': 'Espera…',
    'New here?': '¿Nuevo por aquí?',
    'Already have an account?': '¿Ya tienes cuenta?',
    'Create one': 'Crear una',
    'you@example.com': 'tu@ejemplo.com',

    // ---- library picker ----
    'Choose a library': 'Elige una biblioteca',
    '// what are we tracking today': '// qué estás registrando hoy',
    '// choose a library': '// elige una biblioteca',
    'Games': 'Juegos',
    'Books': 'Libros',
    'Wines': 'Vinos',
    'Your backlog, stats & roulette': 'Tu backlog, estadísticas y ruleta',
    'Reading list, stats & roulette': 'Lista de lectura, estadísticas y ruleta',
    'Cellar & tasting notes': 'Bodega y notas de cata',
    'Open →': 'Abrir →',
    'soon': 'pronto',
    'Sign out': 'Cerrar sesión',
    'All libraries': 'Todas las bibliotecas',

    // ---- collection chrome ----
    'Library': 'Biblioteca',
    'Stats': 'Estadísticas',
    'Roulette': 'Ruleta',
    'Export': 'Exportar',
    'Import': 'Importar',
    '+ Add book': '+ Añadir libro',
    'Search title, tag, platform, review…': 'Buscar título, autor, tema…',
    'Export backup (JSON)': 'Exportar copia (JSON)',
    'Import JSON': 'Importar JSON',
    'Reset sort order': 'Restablecer orden',
    'Table view': 'Vista de tabla',
    'Cards view': 'Vista de tarjetas',
    'Switch library': 'Cambiar biblioteca',

    // ---- status vocabulary ----
    'All': 'Todos',
    'Reading': 'Leyendo',
    'Finished': 'Terminados',
    'Backlog': 'Pendientes',
    'Paused': 'En pausa',
    'Dropped': 'Abandonados',

    // ---- table headers ----
    'Title': 'Título',
    'Author': 'Autor',
    'Themes': 'Temas',
    'Status': 'Estado',
    'Pages': 'Páginas',
    'Rating': 'Valoración',

    // ---- strip (compact one-liners) ----
    'books': 'libros',
    'reading': 'leyendo',
    'finished': 'terminados',
    'backlog': 'pendientes',
    'avg rating': 'valoración media',
    'done': 'completado',
    'pages': 'páginas',

    // ---- empty states ----
    'Your reading list is empty': 'Tu lista de lectura está vacía',
    'Add your first book to get started.': 'Añade tu primer libro para empezar.',
    'Ningún libro coincide.': 'Ningún libro coincide.',
    'No books match.': 'Ningún libro coincide.',
    'add a new book': 'añadir un libro nuevo',
    'Load sample data': 'Cargar datos de ejemplo',

    // ---- add / edit modal ----
    'Add book': 'Añadir libro',
    'Edit book': 'Editar libro',
    'Save': 'Guardar',
    'Delete': 'Eliminar',
    'Cancel': 'Cancelar',
    'Series': 'Serie',
    'Volume': 'Volumen',
    'Volume #': 'Volumen #',
    'Published': 'Publicado',
    'Rating /10': 'Valoración /10',
    'Re-read count': 'Nº de relecturas',
    'Re-reads': 'Relecturas',
    'Language': 'Idioma',
    'Started reading': 'Empezado',
    'Finished reading': 'Terminado',
    'Started': 'Empezado',
    'ISBN (optional)': 'ISBN (opcional)',
    'Genres': 'Géneros',
    'Themes / tags': 'Temas / etiquetas',
    'Date added': 'Fecha añadida',
    'Synopsis (optional)': 'Sinopsis (opcional)',
    'Notes': 'Notas',
    'Book title': 'Título del libro',
    'Series (optional)': 'Serie (opcional)',
    'e.g. English': 'p. ej. Español',
    'What is it about…': '¿De qué trata…',
    'Search publication year': 'Buscar año de publicación',
    'Find pages ↗': 'Buscar páginas ↗',

    // ---- stats ----
    'Overview': 'Resumen',
    'Highest rated': 'Mejor valorados',
    'Longest · pages': 'Más largos · páginas',
    'Most re-read': 'Más releídos',
    'Rating distribution': 'Distribución de valoración',
    'Library status': 'Estado de la biblioteca',
    'Top genres': 'Géneros principales',
    'Top themes': 'Temas principales',
    'Languages': 'Idiomas',
    'Published by year': 'Publicados por año',
    'Spending': 'Gastos',
    'Total books': 'Total de libros',
    'Pages tracked': 'Páginas registradas',
    'Avg rating': 'Valoración media',
    'Completion': 'Progreso',
    'spent': 'gastado',

    // ---- roulette ----
    'Build your pool': 'Arma tu selección',
    'Narrow it down, then let fate pick.': 'Filtra y deja que el azar elija.',
    'By filters': 'Por filtros',
    'Hand-pick': 'A mano',
    'Length · pages': 'Extensión · páginas',
    'Any': 'Cualquiera',
    'Tags · any of': 'Etiquetas · cualquiera',
    'clear': 'limpiar',
    'Search a game to add…': 'Buscar un libro para añadir…',
    'Nothing added yet — search above.': 'Nada añadido aún — busca arriba.',
    'Spin again': 'Girar de nuevo',
    'Details': 'Detalles',
    'Recent spins': 'Giros recientes',
    'to beat': 'para terminar',
    'Start reading': 'Empezar a leer',
    'Already reading': 'Ya leyendo',

    // ---- share image dialog ----
    'Create shareable image': 'Crear imagen para compartir',
    'Pick the stats to include, then copy or download.': 'Elige las estadísticas a incluir, luego copia o descarga.',
    'Caption · optional': 'Título · opcional',
    'My 2026 backlog': 'Mi backlog 2026',
    'Time range · by completion year': 'Rango de tiempo · por año',
    'All time': 'Todo el tiempo',
    'By year': 'Por año',
    'Interval': 'Intervalo',
    'to': 'a',
    'Include': 'Incluir',
    'Copy image': 'Copiar imagen',
    'Download': 'Descargar',
    'Rendering…': 'Generando…',
    'Downloaded ✓': 'Descargado ✓',
    'Copied ✓': 'Copiado ✓',
    'Select at least one stat to build your image.': 'Selecciona al menos una estadística para crear tu imagen.',

    // ---- expenses: picker + chrome ----
    'Expenses': 'Gastos',
    'Transactions, months & stats': 'Transacciones, meses y estadísticas',
    '// expenses': '// gastos',
    'Ledger': 'Libro mayor',
    'Months': 'Meses',
    '+ Add transaction': '+ Añadir transacción',

    // ---- expenses: transaction types + filters ----
    'Expense': 'Gasto',
    'Income': 'Ingresos',
    'Transfer': 'Transferencia',
    'Transfers': 'Transferencias',

    // ---- expenses: categories ----
    'Food': 'Comida',
    'Housing': 'Vivienda',
    'Transport': 'Transporte',
    'Subs': 'Suscripciones',
    'Other': 'Otros',

    // ---- expenses: table + detail ----
    'Description': 'Descripción',
    'Category': 'Categoría',
    'Date': 'Fecha',
    'Type': 'Tipo',
    'Amount': 'Monto',
    'Account': 'Cuenta',
    'Note': 'Nota',
    'No note.': 'Sin nota.',

    // ---- expenses: add / edit modal ----
    'Add transaction': 'Añadir transacción',
    'Edit transaction': 'Editar transacción',
    'Transfer to account': 'Transferir a cuenta',
    'Savings': 'Ahorros',
    'Investing': 'Inversión',
    'What was this for…': '¿Para qué fue…',
    'e.g. Steam · McDonald\u2019s · Salary': 'p. ej. Steam · McDonald\u2019s · Sueldo',

    // ---- expenses: empty states ----
    'No transactions yet': 'Aún no hay transacciones',
    'No transactions yet.': 'Aún no hay transacciones.',
    'Add your first transaction — or load a sample month to explore.': 'Añade tu primera transacción — o carga un mes de ejemplo para explorar.',
    'No transactions match.': 'Ninguna transacción coincide.',
    '+ Add a transaction': '+ Añadir una transacción',
    'add a new transaction': 'añadir una transacción nueva',

    // ---- expenses: stats summary + strip ----
    'Spent': 'Gastado',
    'Net': 'Neto',
    'Transactions': 'Transacciones',
    'Avg / day': 'Prom. / día',
    'Largest': 'Mayor',
    'Saved': 'Ahorrado',
    'Invested': 'Invertido',
    'USD saved': 'USD ahorrado',
    'Savings rate': 'Tasa de ahorro',
    'net': 'neto',
    'income': 'ingresos',
    'transactions': 'transacciones',
    'avg/day': 'prom/día',
    'saved': 'ahorrado',

    // ---- expenses: stat widget titles ----
    'Spending by category': 'Gastos por categoría',
    'Monthly spending': 'Gastos mensuales',
    'Biggest expenses': 'Mayores gastos',
    'Daily spending': 'Gasto diario',
    'Contributions by account': 'Aportes por cuenta',
    'Monthly contributions': 'Aportes mensuales',
    'Category split': 'Reparto por categoría',
    'Transaction mix': 'Mezcla de transacciones',
    'Spending by weekday': 'Gasto por día',
    'Savings & investing split': 'Reparto de ahorro e inversión',
    'contributed': 'aportado',
    'expenses': 'gastos',

    // ---- expenses: months view ----
    'A card per month — click to drill into the calendar, categories & transactions.': 'Una tarjeta por mes — haz clic para ver el calendario, las categorías y las transacciones.',
    'Top category': 'Categoría principal',
    'Biggest ·': 'Mayor ·',
    'By category': 'Por categoría'
  };

  var KEY = 'bl_lang';
  function lang() { try { return localStorage.getItem(KEY) || 'en'; } catch (e) { return 'en'; } }

  // Reverse map (Spanish → English) for restoring EN. Skip very short values
  // (e.g. 'a') to avoid ambiguous back-translation; first mapping wins.
  var REV = {};
  Object.keys(ES).forEach(function (k) {
    var v = ES[k];
    if (v && v.length >= 3 && v !== k && REV[v] === undefined) REV[v] = k;
  });

  function skip(el) { return !el || (el.closest && el.closest('[data-no-i18n]')); }

  function doText(tn) {
    var el = tn.parentElement;
    if (skip(el)) return;
    if (el && (el.tagName === 'SCRIPT' || el.tagName === 'STYLE')) return;
    var raw = tn.nodeValue; if (!raw) return;
    var k = raw.trim(); if (!k) return;
    var repl = lang() === 'es' ? ES[k] : REV[k];
    if (repl !== undefined && repl !== k) tn.nodeValue = raw.split(k).join(repl);
  }

  function doAttr(el, attr) {
    if (skip(el)) return;
    var cur = el.getAttribute(attr); if (cur == null) return;
    var k = cur.trim(); if (!k) return;
    var repl = lang() === 'es' ? ES[k] : REV[k];
    if (repl !== undefined && repl !== k) el.setAttribute(attr, cur.split(k).join(repl));
  }

  function sweep() {
    if (!document.body) return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) doText(nodes[i]);
    var ph = document.querySelectorAll('[placeholder]');
    for (var j = 0; j < ph.length; j++) doAttr(ph[j], 'placeholder');
    var ti = document.querySelectorAll('[title]');
    for (var m = 0; m < ti.length; m++) doAttr(ti[m], 'title');
  }

  var obs = null, raf = 0;
  function apply() {
    if (obs) obs.disconnect();
    try { sweep(); } finally {
      if (obs) obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    updateToggle();
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; setTimeout(apply, 0); });
  }
  function setLang(l) { try { localStorage.setItem(KEY, l); } catch (e) {} apply(); }

  // ---- EN / ES toggle ----
  var pill = null;
  function updateToggle() {
    if (!pill) return;
    var l = lang();
    ['en', 'es'].forEach(function (code) {
      var b = pill.querySelector('[data-l="' + code + '"]');
      var on = l === code;
      b.style.color = on ? 'var(--bg,#0d0f0e)' : 'var(--muted,#8b938d)';
      b.style.background = on ? 'var(--accent,#9ce6b0)' : 'transparent';
      b.style.fontWeight = on ? '700' : '500';
    });
  }
  function buildToggle() {
    if (pill || !document.body) return;
    pill = document.createElement('div');
    pill.id = 'bl-lang';
    pill.setAttribute('data-no-i18n', '');
    pill.title = 'Language / Idioma';
    pill.style.cssText = 'position:fixed;left:max(env(safe-area-inset-left,0px),16px);bottom:calc(env(safe-area-inset-bottom,0px) + 16px);z-index:9998;display:flex;gap:2px;' +
      'background:var(--topchip,#151816);border:1px solid rgba(255,255,255,.1);border-radius:9px;' +
      "padding:3px;font-family:'JetBrains Mono',monospace;font-size:11px;user-select:none;" +
      'box-shadow:0 4px 14px rgba(0,0,0,.4)';
    ['en', 'es'].forEach(function (code) {
      var b = document.createElement('div');
      b.setAttribute('data-l', code);
      b.textContent = code.toUpperCase();
      b.style.cssText = 'padding:5px 10px;border-radius:6px;cursor:pointer;transition:color .2s,background .2s';
      b.addEventListener('click', function () { setLang(code); });
      pill.appendChild(b);
    });
    document.body.appendChild(pill);
  }

  function init() {
    buildToggle();
    obs = new MutationObserver(function () { if (lang() === 'es') schedule(); });
    apply();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.BLI18N = { setLang: setLang, lang: lang, apply: apply, dict: ES };
})();
