/* ==========================================================================
   Lunova — finder.js
   The Bed Finder: four taps → one bed in the right size, addable from the
   result. Also the homepage teaser that asks question 1 inline.

   <bed-finder mode="modal|inline">  renders its whole UI from the JSON island
                                      #finder-config (sections/bed-finder.liquid)
   <finder-teaser>                    homepage Q1 cards → opens the finder on Q2

   Levers, honestly applied
     - Choice architecture: 3 + 3 + size + name, one recommendation, one
       alternative with a single clear difference (never a wall of beds).
     - Commitment / goal gradient: "Step 2 of 4" progress, the teaser's answer
       carries over, half-finished runs resume (sessionStorage).
     - Personalisation: the dog's name (optional, stays on the device) names
       the result, the button and the reasons.
     - Default effect: the size is pre-chosen from the answers; if it's sold
       out the next size up is offered and the result says so.
     - Price framing: compare-at + saving, per-night over the guarantee
       (with its working), price inside the button.
     - Risk reversal: trial + guarantee directly under the button.
     - Honest urgency/scarcity: delivery estimate from the real cut-off,
       "Only N left" only from tracked, deny-policy inventory.

   Vanilla ES2019, no dependencies. Needs global.js (Lunova.*) for cart,
   money, delivery and storage; degrades without it.
   ========================================================================== */
(function () {
  'use strict';

  var L = (window.Lunova = window.Lunova || {});
  if (L._finderReady) return;
  L._finderReady = true;

  var doc = document;
  var root = doc.documentElement;

  var STYLES = ['curl', 'lean', 'sprawl'];
  var STAGES = ['fine', 'slowing', 'diagnosed'];
  var TOTAL = 4;
  var PROGRESS_KEY = 'lunova:finder:progress';
  var ADVANCE_MS = 280;
  var CLOSE_MS = 200;
  var STYLE_WORDS = {
    curl: /\b(nest|donut|doughnut|cuddler|calming|burrow|cave|igloo|snuggle)\b/i,
    lean: /\b(bolster|sofa|couch|raised[\s-]?edge|chaise)\b/i,
    sprawl: /\b(flat|mattress|mat|pad|crate|cushion|futon|daybed)\b/i
  };
  var XL_ALIASES = ['2xl', 'xxl', '3xl', 'xxxl', 'x large', 'xx large', 'extra extra large'];
  var XS_ALIASES = ['x small', 'xx small', 'xxs', 'extra extra small'];
  var DEFAULT_HINTS = [
    { value: 'XS', label: 'Extra small', weight: 'Up to 5kg', breeds: 'Chihuahua, Yorkie, Pomeranian' },
    { value: 'S', label: 'Small', weight: '5–10kg', breeds: 'Jack Russell, Dachshund, Pug, Shih Tzu' },
    { value: 'M', label: 'Medium', weight: '10–25kg', breeds: 'Cocker, Springer, Border Collie, Staffie' },
    { value: 'L', label: 'Large', weight: '25–40kg', breeds: 'Labrador, Retriever, Boxer, Pointer' },
    { value: 'XL', label: 'Extra large', weight: '40kg+', breeds: 'German Shepherd, Bernese, Great Dane' }
  ];

  /* Line illustrations for question 1 (decorative; the text carries the meaning). */
  var ART = {
    curl:
      '<svg class="finder-art" viewBox="0 0 160 100" aria-hidden="true" focusable="false">' +
      '<ellipse class="finder-art__bed" cx="80" cy="76" rx="68" ry="17"/>' +
      '<path class="finder-art__soft" d="M22 74c10-7 32-11 58-11s48 4 58 11"/>' +
      '<path class="finder-art__dog" d="M44 73c-8-18 8-39 36-39 24 0 40 13 38 30-1 6-6 9-12 9z"/>' +
      '<path class="finder-art__line" d="M84 41c10 1 19 6 23 13"/>' +
      '<path class="finder-art__dog" d="M38 72c-4-11 4-20 15-20 10 0 16 8 14 17l-1 3z"/>' +
      '<path class="finder-art__line" d="M44 56c-3-3-4-7-3-11 4 1 7 4 8 8"/>' +
      '<path class="finder-art__line" d="M49 64c2 1.6 4.6 1.6 6.6 0"/>' +
      '<path class="finder-art__line" d="M112 66c-10 9-33 11-47 6"/>' +
      '<path class="finder-art__z" d="M94 14h9l-9 10h9M108 5h6l-6 7h6"/>' +
      '</svg>',
    lean:
      '<svg class="finder-art" viewBox="0 0 160 100" aria-hidden="true" focusable="false">' +
      '<rect class="finder-art__bed" x="10" y="66" width="140" height="18" rx="9"/>' +
      '<rect class="finder-art__bed" x="114" y="38" width="36" height="46" rx="15"/>' +
      '<path class="finder-art__line" d="M24 62c-8-1-13-6-15-13"/>' +
      '<path class="finder-art__dog" d="M24 70c-3-13 6-22 22-22h38c10 0 17 3 22 9l4 13z"/>' +
      '<path class="finder-art__dog" d="M94 54c5-11 14-18 26-18 10 0 16 5 15 12-1 4-5 6-10 6h-17z"/>' +
      '<path class="finder-art__line" d="M113 40c-6 1-10 6-10 12"/>' +
      '<path class="finder-art__line" d="M117 46c2 1.5 4.5 1.5 6.5 0"/>' +
      '<path class="finder-art__line" d="M98 69h14"/>' +
      '<path class="finder-art__z" d="M96 14h8l-8 9h8M108 6h5l-5 6h5"/>' +
      '</svg>',
    sprawl:
      '<svg class="finder-art" viewBox="0 0 160 100" aria-hidden="true" focusable="false">' +
      '<rect class="finder-art__bed" x="6" y="70" width="148" height="14" rx="7"/>' +
      '<path class="finder-art__line" d="M96 62l16 9M86 65l10 9M58 64l-16 8M66 66l-9 8"/>' +
      '<path class="finder-art__line" d="M44 55c-9-1-18 1-30-2"/>' +
      '<ellipse class="finder-art__dog" cx="76" cy="56" rx="35" ry="12"/>' +
      '<path class="finder-art__dog" d="M105 53c6-5 15-6 24-4 8 2 12 7 9 12-2 4-8 5-17 5-7 0-13-2-17-6z"/>' +
      '<path class="finder-art__line" d="M115 52c-1-5 2-9 7-10"/>' +
      '<path class="finder-art__line" d="M124 58c2 1.3 4.3 1.3 6.3 0"/>' +
      '<path class="finder-art__z" d="M106 28h8l-8 9h8M118 18h5l-5 6h5"/>' +
      '</svg>'
  };

  /* ------------------------------------------------------------------------
     Small helpers
     ---------------------------------------------------------------------- */
  function qs(sel, scope) {
    return (scope || doc).querySelector(sel);
  }

  function qsa(sel, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(sel));
  }

  function fill(tpl, vars) {
    return String(tpl == null ? '' : tpl).replace(/\[(\w+)\]/g, function (m, k) {
      return vars && vars[k] != null ? String(vars[k]) : m;
    });
  }

  /** Fill a template into an element; tokens listed in `strong` are wrapped in <strong>. Never innerHTML. */
  function fillNodes(el, tpl, vars, strong) {
    String(tpl == null ? '' : tpl).split(/(\[\w+\])/).forEach(function (part) {
      var m = /^\[(\w+)\]$/.exec(part);
      if (m && vars && vars[m[1]] != null) {
        var text = String(vars[m[1]]);
        if (strong && strong.indexOf(m[1]) > -1) {
          var b = doc.createElement('strong');
          b.textContent = text;
          el.appendChild(b);
        } else {
          el.appendChild(doc.createTextNode(text));
        }
      } else if (part) {
        el.appendChild(doc.createTextNode(part));
      }
    });
    return el;
  }

  /** Element builder. Text only ever goes in as text nodes. */
  function h(tag, attrs, kids) {
    var el = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'hidden') el.hidden = !!v;
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    [].concat(kids == null ? [] : kids).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? doc.createTextNode(String(c)) : c);
    });
    return el;
  }

  /** Static, trusted SVG markup (ART) → node. */
  function svgNode(markup) {
    var t = doc.createElement('template');
    t.innerHTML = markup;
    return t.content.firstChild;
  }

  /** Theme icon cloned from <template id="finder-icons"> (rendered by the icon snippet). */
  function icon(name, cls) {
    var tpl = doc.getElementById('finder-icons');
    var src = tpl && tpl.content ? tpl.content.querySelector('[data-icon="' + name + '"] svg') : null;
    if (!src) return h('span', { class: 'icon finder-icon-missing', 'aria-hidden': 'true' });
    var svg = src.cloneNode(true);
    if (cls) svg.setAttribute('class', (svg.getAttribute('class') || '') + ' ' + cls);
    return svg;
  }

  var decoder = null;
  function decode(s) {
    if (typeof s !== 'string' || s.indexOf('&') === -1) return s;
    decoder = decoder || doc.createElement('textarea');
    decoder.innerHTML = s;
    return decoder.value;
  }

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function has(list, v) {
    return Array.isArray(list) && list.indexOf(v) > -1;
  }

  function reduceMotion() {
    return root.classList.contains('no-motion') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function money(cents) {
    if (typeof L.money === 'function') return L.money(cents);
    return '£' + (Number(cents || 0) / 100).toFixed(2);
  }

  function settings() {
    return L.settings || {};
  }

  function on(name, fn) {
    if (typeof L.on === 'function') return L.on(name, fn);
    doc.addEventListener(name, fn);
    return function () {
      doc.removeEventListener(name, fn);
    };
  }

  function emit(name, detail) {
    if (typeof L.emit === 'function') return L.emit(name, detail);
    doc.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function track(name, data) {
    try {
      var a = window.Shopify && window.Shopify.analytics;
      if (a && typeof a.publish === 'function') a.publish(name, data || {});
    } catch (e) {
      /* analytics is optional */
    }
  }

  function focusEl(el) {
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      el.focus();
    }
  }

  function withWidth(url, w) {
    if (!url) return url;
    if (/([?&])width=\d+/.test(url)) return url.replace(/([?&])width=\d+/, '$1width=' + w);
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }

  function variantUrl(url, id) {
    if (!url) return '#';
    return id ? url + (url.indexOf('?') > -1 ? '&' : '?') + 'variant=' + id : url;
  }

  var session = {
    get: function () {
      try {
        var raw = window.sessionStorage.getItem(PROGRESS_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    set: function (v) {
      try {
        window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(v));
      } catch (e) {
        /* private mode */
      }
    },
    clear: function () {
      try {
        window.sessionStorage.removeItem(PROGRESS_KEY);
      } catch (e) {
        /* private mode */
      }
    }
  };

  function stored() {
    try {
      if (L.finder && typeof L.finder.get === 'function') return L.finder.get();
      if (L.store) return L.store.get('lunova:finder');
    } catch (e) {
      /* storage unavailable */
    }
    return null;
  }

  function remember(obj) {
    try {
      if (L.finder && typeof L.finder.set === 'function') return L.finder.set(obj);
      var next = Object.assign({}, stored() || {}, obj, { ts: Date.now() });
      if (L.store) L.store.set('lunova:finder', next);
      return next;
    } catch (e) {
      return obj;
    }
  }

  function finderAvailable() {
    return !!settings().finderEnabled && !!doc.querySelector('bed-finder');
  }

  /* ------------------------------------------------------------------------
     Config — parsed once per #finder-config node (the editor can swap it)
     ---------------------------------------------------------------------- */
  var cfgCache = { node: null, data: null };

  function config() {
    var node = doc.getElementById('finder-config');
    if (!node) return null;
    if (node === cfgCache.node && cfgCache.data) return cfgCache.data;
    var data = null;
    try {
      data = JSON.parse(node.textContent);
    } catch (e) {
      data = null;
    }
    if (!data || typeof data !== 'object') return null;
    prepare(data);
    cfgCache = { node: node, data: data };
    return data;
  }

  function prepare(cfg) {
    var strings = cfg.strings || {};
    Object.keys(strings).forEach(function (k) {
      strings[k] = decode(strings[k]);
    });
    cfg.strings = strings;
    cfg.copy = cfg.copy || {};
    Object.keys(cfg.copy).forEach(function (k) {
      cfg.copy[k] = decode(cfg.copy[k]);
    });
    cfg.options = cfg.options || {};
    cfg.urls = cfg.urls || {};
    cfg.products = cfg.products && typeof cfg.products === 'object' ? cfg.products : {};
    Object.keys(cfg.products).forEach(function (handle) {
      prepareProduct(cfg.products[handle]);
    });
    cfg.matches = (Array.isArray(cfg.matches) ? cfg.matches : [])
      .filter(function (m) {
        return m && cfg.products[m.handle];
      })
      .map(function (m, i) {
        m.order = i;
        m.styles = (m.styles || []).filter(function (s) { return has(STYLES, s); });
        m.stages = (m.stages || []).filter(function (s) { return has(STAGES, s); });
        m.sizes = String(m.sizes || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        m.priority = Number(m.priority) || 0;
        m.reason = decode(m.reason || '');
        m.difference = decode(m.difference || '');
        return m;
      });
    cfg.fallback = (Array.isArray(cfg.fallback) ? cfg.fallback : []).filter(function (handle) {
      return !!cfg.products[handle];
    });
    cfg.hasProducts = Object.keys(cfg.products).length > 0;
  }

  function prepareProduct(p) {
    p.tags = Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',');
    p.tagsLc = p.tags.map(norm);
    p.variants = Array.isArray(p.variants) ? p.variants : [];
    p.options = Array.isArray(p.options) ? p.options : [];
    var haystack = [p.title, p.type, p.tags.join(' ')].join(' ');
    p.foam = /memory[\s-]?foam/i.test(haystack);
    p.orthoWord = /orthop(?:a)?edic/i.test(haystack);
    p.ortho = p.foam || p.orthoWord;
    p.styleTags = STYLES.filter(function (s) { return has(p.tagsLc, 'finder:' + s); });
    p.stageTags = STAGES.filter(function (s) { return has(p.tagsLc, 'finder:' + s); });
    p.styleWords = STYLES.filter(function (s) { return STYLE_WORDS[s].test(haystack); });
    p.sizeTags = p.tagsLc.filter(function (t) { return t.indexOf('finder:size-') === 0; }).map(function (t) { return t.slice(12); });
    p.available = p.variants.some(function (v) { return v.available; });
    p.sizeIndex = -2; // resolved lazily (needs size hints)
  }

  function S(key) {
    var cfg = config();
    var v = cfg && cfg.strings ? cfg.strings[key] : null;
    return typeof v === 'string' ? v : '';
  }

  /* ------------------------------------------------------------------------
     Sizes — same matching rules as snippets/size-hints.liquid
     ---------------------------------------------------------------------- */
  function hints() {
    var s = settings();
    if (Array.isArray(s.sizeHints) && s.sizeHints.length) return s.sizeHints;
    var cfg = config();
    if (cfg && Array.isArray(cfg.sizeHints) && cfg.sizeHints.length) return cfg.sizeHints;
    return DEFAULT_HINTS;
  }

  function hintIndex(value) {
    var list = hints();
    var q = norm(value).replace(/-/g, ' ');
    if (!q) return -1;
    if (XL_ALIASES.indexOf(q) > -1) q = 'xl';
    if (XS_ALIASES.indexOf(q) > -1) q = 'xs';
    var first = q.split(' ')[0].split('/')[0].split('(')[0].split('·')[0].trim();
    if (['2xl', 'xxl', '3xl', 'xxxl'].indexOf(first) > -1) first = 'xl';
    if (first === 'xxs') first = 'xs';
    function find(term) {
      if (!term) return -1;
      for (var i = 0; i < list.length; i += 1) {
        var hint = list[i] || {};
        if (norm(hint.value) === term || norm(hint.label) === term) return i;
      }
      return -1;
    }
    var i = find(q);
    return i > -1 ? i : find(first);
  }

  function hintAt(i) {
    var list = hints();
    return i > -1 && i < list.length ? list[i] : null;
  }

  /** Which option holds the size: a "Size"-named option, else one whose values map to size hints. */
  function sizeOptionIndex(p) {
    if (p.sizeIndex !== -2) return p.sizeIndex;
    var idx = -1;
    for (var i = 0; i < p.options.length && idx < 0; i += 1) {
      if (/\b(size|sizes|bed size|dimensions?)\b/i.test(String(p.options[i] || ''))) idx = i;
    }
    if (idx < 0) {
      for (var j = 0; j < p.options.length && idx < 0; j += 1) {
        var vals = optionValues(p, j);
        var hits = vals.filter(function (v) { return hintIndex(v) > -1; }).length;
        if (vals.length > 1 && hits >= Math.ceil(vals.length / 2)) idx = j;
      }
    }
    /* A lone "One size" value is no size at all; a lone "L" still says Large. */
    if (idx > -1) {
      var only = optionValues(p, idx);
      if (only.length < 2 && hintIndex(only[0]) < 0) idx = -1;
    }
    p.sizeIndex = idx;
    return idx;
  }

  function optionValues(p, i) {
    var out = [];
    p.variants.forEach(function (v) {
      var val = v.options ? v.options[i] : null;
      if (val != null && out.indexOf(val) === -1) out.push(val);
    });
    return out;
  }

  function preferred(list) {
    for (var i = 0; i < list.length; i += 1) if (list[i].mc) return list[i];
    return list[0];
  }

  /**
   * The variant to recommend for a dog of hint index `want`.
   * kind: 'exact' | 'one' (no size option) | 'larger' (next size up) |
   *       'approx' / 'larger-approx' (size names that don't map to hints)
   */
  function resolveSize(p, want) {
    var avail = p.variants.filter(function (v) { return v.available; });
    if (!avail.length) return null;
    var oi = sizeOptionIndex(p);

    if (oi < 0) {
      if (p.sizeTags.length && want > -1) {
        var suits = p.sizeTags.some(function (t) { return hintIndex(t) === want; });
        if (!suits) return null;
      }
      return { variant: preferred(avail), kind: 'one', value: null };
    }

    var values = optionValues(p, oi);
    var mapped = values.map(hintIndex);
    function pick(val) {
      var list = avail.filter(function (v) { return v.options[oi] === val; });
      return list.length ? preferred(list) : null;
    }

    if (want < 0) {
      var any = preferred(avail);
      return { variant: any, kind: 'exact', value: any.options[oi] };
    }

    if (mapped.some(function (i) { return i > -1; })) {
      for (var k = 0; k < values.length; k += 1) {
        if (mapped[k] === want) {
          var exact = pick(values[k]);
          if (exact) return { variant: exact, kind: 'exact', value: values[k] };
        }
      }
      var best = null;
      var bestIdx = Infinity;
      values.forEach(function (val, n) {
        if (mapped[n] > want && mapped[n] < bestIdx) {
          var v = pick(val);
          if (v) {
            best = { variant: v, value: val };
            bestIdx = mapped[n];
          }
        }
      });
      if (best) {
        var offered = mapped.indexOf(want) > -1;
        return { variant: best.variant, kind: 'larger', value: best.value, offered: offered, jump: bestIdx - want };
      }
      return null;
    }

    /* Size names we can't map ("Snug", "Roomy"): place by position in the range. */
    var n = hints().length;
    var pos = n > 1 ? Math.round((want * (values.length - 1)) / (n - 1)) : 0;
    for (var m = pos; m < values.length; m += 1) {
      var cand = pick(values[m]);
      if (cand) return { variant: cand, kind: m === pos ? 'approx' : 'larger-approx', value: values[m], offered: true };
    }
    return null;
  }

  /** "Medium" for "M"; the option value as the shopper will see it otherwise. */
  function displaySize(value) {
    if (value == null || value === '') return S('result.size_one');
    var hint = hintAt(hintIndex(value));
    if (hint && norm(value) === norm(hint.value) && hint.label) return hint.label;
    return String(value);
  }

  /* ------------------------------------------------------------------------
     Matching
     ---------------------------------------------------------------------- */
  function scoreProduct(p, a) {
    var score = 0;
    var styleFit = false;
    var styleMiss = false;
    var stageFit = false;
    if (p.styleTags.length) {
      if (has(p.styleTags, a.style)) {
        score += 10;
        styleFit = true;
      } else {
        score -= 6;
        styleMiss = true;
      }
    } else if (has(p.styleWords, a.style)) {
      score += 4;
      styleFit = true;
    }
    var want = STAGES.indexOf(a.stage);
    if (p.stageTags.length) {
      if (has(p.stageTags, a.stage)) {
        score += 8;
        stageFit = true;
      } else {
        var top = Math.max.apply(null, p.stageTags.map(function (t) { return STAGES.indexOf(t); }));
        score += top > want ? -1 : -6;
      }
    }
    if (p.ortho) score += want === 2 ? 4 : want === 1 ? 2 : 0;
    return { score: score, styleFit: styleFit, styleMiss: styleMiss, stageFit: stageFit };
  }

  function sizeAllowed(m, want) {
    if (!m.sizes.length || want < 0) return true;
    return m.sizes.some(function (s) { return hintIndex(s) === want; });
  }

  /** Exact fits first, then the smallest step up. */
  function exactRank(c) {
    var base = { exact: 0, one: 0, approx: 1, larger: 2, 'larger-approx': 3 }[c.fit.kind] || 0;
    return base + (c.fit.jump > 1 ? (c.fit.jump - 1) * 0.5 : 0);
  }

  /** Ranked candidates for a full set of answers. */
  function rank(cfg, a) {
    var want = hintIndex(a.size);
    var cands = [];
    var seen = {};

    function push(handle, tier, extra) {
      if (seen[handle]) return;
      var p = cfg.products[handle];
      if (!p || !p.available) return;
      var fit = resolveSize(p, want);
      if (!fit) return;
      seen[handle] = true;
      cands.push(Object.assign({ product: p, fit: fit, tier: tier, seq: cands.length }, extra));
    }

    /* 1. Match blocks that fit every answer */
    cfg.matches.forEach(function (m) {
      if (has(m.styles, a.style) && has(m.stages, a.stage) && sizeAllowed(m, want)) {
        push(m.handle, 1, { block: m, styleFit: true, stageFit: true, styleMiss: false });
      }
    });

    /* 2. Fallback candidates with a positive tag score */
    var scored = cfg.fallback.map(function (handle, idx) {
      var p = cfg.products[handle];
      return Object.assign({ handle: handle, idx: idx }, scoreProduct(p, a));
    });
    scored.forEach(function (s) {
      if (s.score > 0) push(s.handle, 2, { score: s.score, idx: s.idx, styleFit: s.styleFit, stageFit: s.stageFit, styleMiss: s.styleMiss });
    });

    /* 3. Match blocks that fit the style (closest stage, erring towards more support) or the stage */
    var si = STAGES.indexOf(a.stage);
    cfg.matches
      .filter(function (m) {
        return sizeAllowed(m, want) && (has(m.styles, a.style) || has(m.stages, a.stage));
      })
      .map(function (m) {
        var styleOk = has(m.styles, a.style);
        var dist = has(m.stages, a.stage)
          ? 0
          : Math.min.apply(null, m.stages.map(function (s) {
              var d = STAGES.indexOf(s) - si;
              return d >= 0 ? d : -d * 2 + 1;
            }).concat([9]));
        return { m: m, key: (styleOk ? 0 : 100) + dist * 10 - m.priority / 2 };
      })
      .sort(function (x, y) { return x.key - y.key || x.m.order - y.m.order; })
      .forEach(function (r) {
        var styleOk = has(r.m.styles, a.style);
        push(r.m.handle, 3, { block: r.m, styleFit: styleOk, stageFit: has(r.m.stages, a.stage), styleMiss: !styleOk && r.m.styles.length > 0 });
      });

    /* 4. Anything else that fits the size */
    scored.forEach(function (s) {
      if (s.score <= 0) push(s.handle, 4, { score: s.score, idx: s.idx, styleFit: s.styleFit, stageFit: s.stageFit, styleMiss: s.styleMiss });
    });

    var diagnosed = a.stage === 'diagnosed';
    cands.sort(function (x, y) {
      if (x.tier !== y.tier) return x.tier - y.tier;
      if (x.tier === 1) {
        return y.block.priority - x.block.priority || exactRank(x) - exactRank(y) || x.block.order - y.block.order;
      }
      if (x.tier === 2 || x.tier === 4) {
        var tie = diagnosed
          ? (y.product.ortho ? 1 : 0) - (x.product.ortho ? 1 : 0) || y.fit.variant.price - x.fit.variant.price
          : x.fit.variant.price - y.fit.variant.price;
        return y.score - x.score || exactRank(x) - exactRank(y) || tie || x.idx - y.idx;
      }
      return x.seq - y.seq;
    });
    return cands;
  }

  function stylesOf(c) {
    if (c.product.styleTags.length) return c.product.styleTags;
    if (c.block && c.block.styles.length && c.block.styles.length < 3) return c.block.styles;
    return c.product.styleWords;
  }

  /** "if you'd prefer …" — one honest, concrete difference between the two picks. */
  function difference(main, alt) {
    if (alt.block && alt.block.difference) return alt.block.difference;
    var mp = main.fit.variant.price;
    var ap = alt.fit.variant.price;
    if (ap < mp && mp - ap >= Math.max(500, mp * 0.08)) return fill(S('result.diff_cheaper'), { amount: money(mp - ap) });
    if (alt.product.ortho && !main.product.ortho) return S('result.diff_support');
    var mine = stylesOf(main);
    var other = stylesOf(alt).filter(function (s) { return !has(mine, s); })[0];
    if (other) return S('result.diff_' + other);
    return '';
  }

  function recommend(cfg, a, showAlt) {
    var cands = rank(cfg, a);
    if (!cands.length) return { main: null, alt: null };
    var main = cands[0];
    var alt = null;
    if (showAlt) {
      var pool = cands.slice(1, 6).filter(function (c) {
        return c.tier < 4 || main.tier === 4;
      });
      for (var i = 0; i < pool.length && !alt; i += 1) {
        var d = difference(main, pool[i]);
        if (d) alt = Object.assign({}, pool[i], { diff: d });
      }
      if (!alt && pool.length) alt = Object.assign({}, pool[0], { diff: S('result.diff_other') });
    }
    return { main: main, alt: alt };
  }

  /* ------------------------------------------------------------------------
     <bed-finder>
     ---------------------------------------------------------------------- */
  var uidCounter = 0;

  function cleanAnswers(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    if (has(STYLES, raw.style)) out.style = raw.style;
    if (has(STAGES, raw.stage)) out.stage = raw.stage;
    if (raw.size != null && raw.size !== '') {
      var hint = hintAt(hintIndex(raw.size));
      if (hint) out.size = hint.value;
    }
    if (typeof raw.dogName === 'string') out.dogName = raw.dogName.trim().slice(0, 40);
    return out;
  }

  class BedFinder extends HTMLElement {
    connectedCallback() {
      if (this._connected) return;
      this._connected = true;
      uidCounter += 1;
      this.uid = 'finder-' + uidCounter;
      this.mode = this.getAttribute('mode') === 'modal' ? 'modal' : 'inline';
      this.classList.add('finder--' + this.mode);
      this.state = { step: 1, answers: { style: null, stage: null, size: null }, name: '' };
      this.result = null;
      this.rendered = false;
      this.editing = false;
      this.timers = [];
      this.offs = [];

      var memory = stored();
      if (memory && typeof memory.dogName === 'string') this.state.name = memory.dogName.trim().slice(0, 40);

      var self = this;
      this.offs.push(on('lunova:finder:open', function (e) {
        self.onOpenEvent((e && e.detail) || {});
      }));

      if (this.mode === 'modal') {
        this.dialog = this.closest('dialog');
        this.wireDialog();
        this.wireEditor();
      } else {
        this.bootInline();
      }
    }

    disconnectedCallback() {
      this._connected = false;
      this.clearTimers();
      this.unwatchCta();
      this.offs.forEach(function (off) { off(); });
      this.offs = [];
      if (this.locked && typeof L.unlockScroll === 'function') L.unlockScroll();
      this.locked = false;
      if (this.releaseTrap) this.releaseTrap(false);
      this.releaseTrap = null;
    }

    clearTimers() {
      this.timers.forEach(function (t) { clearTimeout(t); });
      this.timers = [];
    }

    later(fn, ms) {
      var t = setTimeout(fn, ms);
      this.timers.push(t);
      return t;
    }

    /* ---------------- setup ---------------- */

    get cfg() {
      return config();
    }

    ensureShell() {
      if (this.rendered) return true;
      if (!this.cfg) return false;
      this.rendered = true;
      this.textContent = '';
      var self = this;

      this.backBtn = h('button', { type: 'button', class: 'btn btn--icon finder__back', 'aria-label': S('back') }, [icon('arrow-left')]);
      this.backBtn.addEventListener('click', function () { self.back(); });

      this.progressLabel = h('p', { class: 'finder__progress-label', id: this.uid + '-progress', 'aria-live': 'polite', 'aria-atomic': 'true' });
      this.progressBar = h('span', { class: 'progress__bar' });
      var progress = h('div', { class: 'finder__progress' }, [
        this.progressLabel,
        h('div', { class: 'progress finder__bar', 'aria-hidden': 'true' }, [this.progressBar])
      ]);

      var topKids = [this.backBtn, progress];
      if (this.mode === 'modal') {
        var close = h('button', { type: 'button', class: 'btn btn--icon finder__close', 'aria-label': S('close') }, [icon('close')]);
        close.addEventListener('click', function () { self.closeModal(); });
        topKids.push(close);
      }
      this.top = h('div', { class: 'finder__top' }, topKids);
      this.stage = h('div', { class: 'finder__stage' });
      this.appendChild(this.top);
      this.appendChild(this.stage);
      return true;
    }

    bootInline() {
      if (!this.ensureShell()) return;
      var params = null;
      try {
        params = new URLSearchParams(window.location.search);
      } catch (e) {
        params = null;
      }
      var fromUrl = params ? cleanAnswers({ style: params.get('style'), stage: params.get('stage'), size: params.get('size') }) : {};
      if (fromUrl.style || fromUrl.stage || fromUrl.size) {
        Object.assign(this.state.answers, fromUrl);
        this.go(this.firstUnanswered(), { focus: false });
        return;
      }
      this.resume({ focus: false });
    }

    /** Pick up where the shopper left off: a half-finished run, else their last result. */
    resume(opts) {
      var prog = session.get();
      if (prog && prog.answers && typeof prog.answers === 'object') {
        var ans = cleanAnswers(prog.answers);
        this.state.answers = { style: ans.style || null, stage: ans.stage || null, size: ans.size || null };
        if (typeof prog.name === 'string') this.state.name = prog.name.slice(0, 40);
        var st = Number(prog.step);
        if (st >= 1 && st <= TOTAL) {
          this.go(Math.min(st, this.firstUnanswered()), opts);
          return;
        }
      }
      var memory = cleanAnswers(stored() || {});
      if (memory.style && memory.stage && memory.size) {
        this.state.answers = { style: memory.style, stage: memory.stage, size: memory.size };
        if (memory.dogName != null) this.state.name = memory.dogName;
        this.showResult(Object.assign({ instant: true }, opts));
        return;
      }
      this.go(1, opts);
    }

    reset() {
      this.clearTimers();
      this.busy = false;
      this.editing = false;
      this.result = null;
      this.state.answers = { style: null, stage: null, size: null };
      session.clear();
    }

    firstUnanswered() {
      var a = this.state.answers;
      if (!a.style) return 1;
      if (!a.stage) return 2;
      if (!a.size) return 3;
      return 4;
    }

    allAnswered() {
      var a = this.state.answers;
      return !!(a.style && a.stage && a.size);
    }

    dogName() {
      return String(this.state.name || '').trim().slice(0, 40);
    }

    dogWord() {
      return this.dogName() || S('your_dog');
    }

    saveProgress() {
      var st = this.state.step;
      if (typeof st === 'number' && st >= 1 && st <= TOTAL) {
        session.set({ step: st, answers: this.state.answers, name: this.state.name });
      }
    }

    /* ---------------- events ---------------- */

    onOpenEvent(detail) {
      var inline = doc.querySelector('bed-finder[mode="inline"]');
      if (this.mode === 'modal') {
        if (inline && inline !== this && inline.isConnected) return; // the page's own finder answers
        this.openModal(detail);
        return;
      }
      if (inline !== this) return;
      if (!this.ensureShell()) return;
      this.apply(detail, true);
      var r = this.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.6) {
        this.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      }
      this.focusHeading();
    }

    /** Apply {step, answers, restart} from an open event. */
    apply(detail, rendered) {
      detail = detail || {};
      var step = detail.step === 'result' ? 5 : Number(detail.step);
      var ans = cleanAnswers(detail.answers);
      var restart = detail.restart === true || step === 1;
      if (ans.dogName != null && ans.dogName !== '') this.state.name = ans.dogName;

      if (restart) {
        this.reset();
        if (ans.style) this.state.answers.style = ans.style;
        this.go(ans.style ? 2 : 1);
        return;
      }
      if (step >= 2 || ans.style || ans.stage || ans.size) {
        ['style', 'stage', 'size'].forEach(function (k) {
          if (ans[k]) this.state.answers[k] = ans[k];
        }, this);
        if (step >= 5 && this.allAnswered()) {
          this.showResult({ instant: true });
          return;
        }
        var target = step >= 2 ? Math.min(step, this.firstUnanswered()) : this.firstUnanswered();
        this.go(Math.min(target, TOTAL));
        return;
      }
      /* No step: resume. */
      if (!rendered || !this.stage.firstChild) {
        this.resume();
        return;
      }
      if (this.state.step === 'matching' || this.state.step === 'result-pending') this.showResult({ instant: true });
    }

    /* ---------------- modal ---------------- */

    wireDialog() {
      var dialog = this.dialog;
      if (!dialog || dialog._finderWired) return;
      dialog._finderWired = true;
      var self = this;
      var downOnBackdrop = false;

      function outside(e) {
        if (e.target !== dialog) return false;
        var r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      }

      dialog.addEventListener('cancel', function (e) {
        e.preventDefault();
        self.closeModal();
      });
      dialog.addEventListener('pointerdown', function (e) {
        downOnBackdrop = outside(e);
      });
      dialog.addEventListener('click', function (e) {
        if (downOnBackdrop && outside(e)) self.closeModal();
        downOnBackdrop = false;
      });
      dialog.addEventListener('close', function () {
        /* Closed by something else (e.g. the browser): tidy up. */
        dialog.classList.remove('is-closing');
        if (self.locked && typeof L.unlockScroll === 'function') L.unlockScroll();
        self.locked = false;
        if (self.releaseTrap) {
          var release = self.releaseTrap;
          self.releaseTrap = null;
          release(false);
        }
        /* Back to whatever opened the finder (trapFocus would return focus inside the dialog). */
        if (self._restoreOnClose !== false && self.opener && self.opener !== doc.body && doc.contains(self.opener)) {
          focusEl(self.opener);
        }
        self._restoreOnClose = true;
      });
    }

    wireEditor() {
      var designMode = !!(window.Shopify && window.Shopify.designMode) || !!L.designMode;
      if (!designMode) return;
      var self = this;
      var sid = this.getAttribute('data-section-id') || 'bed-finder';
      function mine(e) {
        return e && e.detail && e.detail.sectionId === sid;
      }
      function openIt(e) {
        if (mine(e)) self.openModal({});
      }
      function closeIt(e) {
        if (mine(e)) self.closeModal({ instant: true });
      }
      ['shopify:section:select', 'shopify:block:select', 'shopify:section:load'].forEach(function (name) {
        doc.addEventListener(name, openIt);
        self.offs.push(function () { doc.removeEventListener(name, openIt); });
      });
      doc.addEventListener('shopify:section:deselect', closeIt);
      this.offs.push(function () { doc.removeEventListener('shopify:section:deselect', closeIt); });
    }

    openModal(detail) {
      var dialog = this.dialog;
      if (!dialog) return;
      if (!this.ensureShell()) {
        /* No usable config: the finder page still offers a way forward. */
        var cfgUrl = (L.routes && L.routes.root ? L.routes.root.replace(/\/$/, '') : '') + '/pages/bed-finder';
        window.location.href = cfgUrl;
        return;
      }
      detail = detail || {};
      var wasRendered = !!this.stage.firstChild;
      var trigger = detail.trigger || detail.opener || null;
      this.opener = trigger && trigger.nodeType === 1 ? trigger : doc.activeElement;

      if (!dialog.open) {
        dialog.classList.remove('is-closing');
        try {
          dialog.showModal();
        } catch (e) {
          dialog.setAttribute('open', '');
        }
        if (typeof L.lockScroll === 'function') {
          L.lockScroll();
          this.locked = true;
        }
        this.apply(detail, wasRendered);
        dialog.scrollTop = 0;
        var heading = qs('[data-step-heading]', this.stage);
        if (typeof L.trapFocus === 'function') this.releaseTrap = L.trapFocus(dialog, heading || dialog);
        else this.focusHeading();
      } else {
        this.apply(detail, wasRendered);
        dialog.scrollTop = 0;
        this.focusHeading();
      }
      track('lunova_finder_open', { step: this.state.step });
    }

    closeModal(opts) {
      opts = opts || {};
      var dialog = this.dialog;
      if (!dialog || !dialog.open) return;
      this.clearTimers();
      this.busy = false;
      if (this.state.step === 'matching') this.state.step = 'result-pending';
      this._restoreOnClose = opts.restoreFocus !== false;
      if (this.locked && typeof L.unlockScroll === 'function') L.unlockScroll();
      this.locked = false;
      var finish = function () {
        dialog.classList.remove('is-closing');
        if (dialog.open) dialog.close();
      };
      if (opts.instant || reduceMotion()) finish();
      else {
        dialog.classList.add('is-closing');
        setTimeout(finish, CLOSE_MS);
      }
    }

    /* ---------------- navigation ---------------- */

    go(step, opts) {
      opts = opts || {};
      this.clearTimers();
      this.busy = false;
      var prev = this.state.step;
      this.state.step = step;
      var dir = opts.dir || (typeof prev === 'number' && typeof step === 'number' && step < prev ? 'back' : 'forward');
      var nodes;
      switch (step) {
        case 1:
          nodes = this.viewChoice('style');
          break;
        case 2:
          nodes = this.viewChoice('stage');
          break;
        case 3:
          nodes = this.viewSize();
          break;
        case 4:
          nodes = this.viewName();
          break;
        default:
          nodes = [];
      }
      this.mount(nodes, 'q' + step, dir, opts.focus !== false);
      this.updateTop();
      this.saveProgress();
      track('lunova_finder_step', { step: step });
    }

    back() {
      var st = this.state.step;
      if (typeof st === 'number' && st > 1) this.go(st - 1, { dir: 'back' });
      else if (st === 'result' || st === 'matching' || st === 'result-pending') this.go(TOTAL, { dir: 'back' });
    }

    next() {
      if (this.editing && this.allAnswered()) {
        this.editing = false;
        this.showResult({ instant: true });
        return;
      }
      var st = this.state.step;
      if (typeof st === 'number' && st < TOTAL) this.go(st + 1);
      else this.showResult();
    }

    mount(nodes, name, dir, focus) {
      var panel = h('div', { class: 'finder__panel finder__panel--' + name, 'data-dir': dir || 'forward' }, nodes);
      if (!reduceMotion()) panel.classList.add('is-entering');
      this.unwatchCta();
      this.stage.textContent = '';
      this.stage.appendChild(panel);
      if (panel.classList.contains('is-entering')) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            panel.classList.remove('is-entering');
          });
        });
      }
      if (this.mode === 'modal' && this.dialog) this.dialog.scrollTop = 0;
      else if (focus) {
        var r = this.getBoundingClientRect();
        var headerH = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 0;
        if (r.top < headerH) this.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      if (focus) this.focusHeading();
    }

    focusHeading() {
      var heading = this.stage && qs('[data-step-heading]', this.stage);
      if (heading) focusEl(heading);
    }

    updateTop() {
      var st = this.state.step;
      var done = st === 'result' || st === 'matching' || st === 'result-pending';
      this.backBtn.hidden = st === 1 || done;
      this.progressLabel.textContent = done ? S('your_match') : fill(S('step_of'), { step: st, total: TOTAL });
      var pct = done ? 100 : (Number(st) / TOTAL) * 100;
      this.progressBar.style.setProperty('--progress', String(pct));
      this.top.classList.toggle('is-done', done);
    }

    /* ---------------- step views ---------------- */

    head(id, title, text) {
      return h('div', { class: 'finder__head' }, [
        h('h2', { class: 'finder__heading h3', id: id, tabindex: '-1', 'data-step-heading': '' }, title),
        text ? h('p', { class: 'finder__sub', text: text }) : null
      ]);
    }

    viewChoice(key) {
      var copy = this.cfg.copy;
      var isStyle = key === 'style';
      var hid = this.uid + '-h-' + key;
      var items = (isStyle ? STYLES : STAGES).map(function (v) {
        return {
          value: v,
          title: S('options.' + v + '_title'),
          text: S('options.' + v + '_text'),
          art: isStyle ? ART[v] : null
        };
      });
      return [
        this.head(hid, isStyle ? copy.styleHeading : copy.stageHeading, isStyle ? copy.styleText : copy.stageText),
        this.radioGroup(key, items, hid, isStyle ? 'art' : 'text'),
        this.actions(key)
      ];
    }

    viewSize() {
      var copy = this.cfg.copy;
      var hid = this.uid + '-h-size';
      var list = hints();
      var items = list.map(function (hint, i) {
        var breeds = String(hint.breeds || '').trim();
        var label = String(hint.label || hint.value || '').trim();
        var weight = String(hint.weight || '').trim();
        return {
          value: hint.value,
          title: breeds || label,
          text: breeds ? (weight ? fill(S('size.meta'), { label: label, weight: weight }) : label) : weight,
          lead: h('span', { class: 'finder-opt__scale', 'aria-hidden': 'true', style: '--i:' + (list.length > 1 ? i / (list.length - 1) : 0) }, [icon('paw')])
        };
      });
      var nodes = [this.head(hid, copy.sizeHeading, copy.sizeText), this.radioGroup('size', items, hid, 'size')];
      if (copy.measureText) {
        nodes.push(
          h('details', { class: 'accordion finder__measure' }, [
            h('summary', { class: 'finder__measure-summary' }, [icon('ruler', 'finder__measure-icon'), h('span', { text: copy.measureTitle || S('size.measure_icon_label') })]),
            h('div', { class: 'accordion__content finder__measure-text' }, [h('p', { text: copy.measureText })])
          ])
        );
      }
      nodes.push(this.actions('size'));
      return nodes;
    }

    viewName() {
      var self = this;
      var copy = this.cfg.copy;
      var hid = this.uid + '-h-name';
      var inputId = this.uid + '-name';
      var hintId = this.uid + '-name-hint';
      var input = h('input', {
        class: 'input finder-name__input',
        id: inputId,
        name: 'dog_name',
        type: 'text',
        maxlength: '40',
        autocomplete: 'off',
        autocapitalize: 'words',
        spellcheck: 'false',
        enterkeyhint: 'go',
        placeholder: S('name.placeholder'),
        'aria-describedby': hintId
      });
      input.value = this.state.name || '';
      var submit = h('button', { type: 'submit', class: 'btn btn--lg finder-btn-ink finder-name__submit' }, [h('span', { 'data-label': '' }), icon('arrow-right', 'icon--arrow-right')]);
      var skip = h('button', { type: 'button', class: 'btn btn--ghost finder-name__skip', text: S('name.skip') });
      function label() {
        var name = input.value.trim().slice(0, 40);
        qs('[data-label]', submit).textContent = name ? fill(S('name.submit_named'), { name: name }) : S('name.submit');
      }
      label();
      input.addEventListener('input', label);
      var form = h('form', { class: 'finder-name', novalidate: true }, [
        h('div', { class: 'field' }, [
          h('label', { class: 'field__label', for: inputId, text: S('name.label') }),
          input,
          h('p', { class: 'field__hint', id: hintId, text: S('name.privacy') })
        ]),
        h('div', { class: 'finder__actions finder__actions--name' }, [submit, skip])
      ]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        self.state.name = input.value.trim().slice(0, 40);
        self.showResult();
      });
      skip.addEventListener('click', function () {
        self.state.name = '';
        self.showResult();
      });
      return [this.head(hid, copy.nameHeading, copy.nameText), form];
    }

    radioGroup(key, items, labelledBy, variant) {
      var self = this;
      var current = this.state.answers[key];
      var group = h('div', { class: 'finder-opts finder-opts--' + variant, role: 'radiogroup', 'aria-labelledby': labelledBy });
      var hasCurrent = items.some(function (it) { return it.value === current; });
      items.forEach(function (it, i) {
        var tid = self.uid + '-' + key + '-' + i;
        var checked = it.value === current;
        group.appendChild(
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              class: 'finder-opt finder-opt--' + variant,
              'aria-checked': checked ? 'true' : 'false',
              tabindex: checked || (!hasCurrent && i === 0) ? '0' : '-1',
              'data-value': it.value,
              'aria-labelledby': tid + '-t',
              'aria-describedby': it.text ? tid + '-d' : null
            },
            [
              it.art ? h('span', { class: 'finder-opt__art', 'aria-hidden': 'true' }, [svgNode(it.art)]) : null,
              it.lead || null,
              h('span', { class: 'finder-opt__body' }, [
                h('span', { class: 'finder-opt__title', id: tid + '-t', text: it.title }),
                it.text ? h('span', { class: 'finder-opt__text', id: tid + '-d', text: it.text }) : null
              ]),
              h('span', { class: 'finder-opt__tick', 'aria-hidden': 'true' }, [icon('check')])
            ]
          )
        );
      });
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('[role="radio"]');
        if (btn && group.contains(btn)) self.choose(key, btn.getAttribute('data-value'), group, true);
      });
      group.addEventListener('keydown', function (e) {
        var keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
        if (keys.indexOf(e.key) < 0) return;
        var radios = qsa('[role="radio"]', group);
        var i = radios.indexOf(doc.activeElement);
        if (i < 0) return;
        e.preventDefault();
        var n = radios.length;
        var j;
        if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % n;
        else j = (i - 1 + n) % n;
        focusEl(radios[j]);
        self.choose(key, radios[j].getAttribute('data-value'), group, false);
      });
      return group;
    }

    actions(key) {
      var self = this;
      var nextBtn = h('button', { type: 'button', class: 'btn finder-btn-ink finder__next', 'data-next': key, hidden: !this.state.answers[key] }, [
        h('span', { text: S('next') }),
        icon('arrow-right', 'icon--arrow-right')
      ]);
      nextBtn.addEventListener('click', function () {
        if (self.state.answers[key]) self.next();
      });
      return h('div', { class: 'finder__actions' }, [nextBtn]);
    }

    /** Record an answer. Tap/click/Enter/Space advances; arrow keys only select. */
    choose(key, value, group, advance) {
      if (this.busy) return;
      this.state.answers[key] = value;
      qsa('[role="radio"]', group).forEach(function (r) {
        var on = r.getAttribute('data-value') === value;
        r.setAttribute('aria-checked', on ? 'true' : 'false');
        r.setAttribute('tabindex', on ? '0' : '-1');
      });
      this.saveProgress();
      var nextBtn = qs('[data-next="' + key + '"]', this.stage);
      if (!advance) {
        if (nextBtn) nextBtn.hidden = false;
        return;
      }
      this.busy = true;
      var self = this;
      this.later(function () {
        self.busy = false;
        self.next();
      }, reduceMotion() ? 140 : ADVANCE_MS);
    }

    /* ---------------- result ---------------- */

    showResult(opts) {
      opts = opts || {};
      if (!this.allAnswered()) {
        this.go(this.firstUnanswered(), opts);
        return;
      }
      var cfg = this.cfg;
      this.result = recommend(cfg, this.state.answers, cfg.options.showAlternative !== false);
      var instant = opts.instant || reduceMotion() || cfg.options.matchingMoment === false || !this.result.main;
      if (instant) {
        this.renderResult(opts);
        return;
      }
      this.viewMatching();
    }

    viewMatching() {
      var self = this;
      var a = this.state.answers;
      var name = this.dogName();
      this.state.step = 'matching';
      var hid = this.uid + '-h-matching';
      var rows = [
        [S('matching.style'), S('options.' + a.style + '_short')],
        [S('matching.stage'), S('options.' + a.stage + '_short')],
        [S('matching.size'), displaySize(a.size)]
      ].map(function (r) {
        return h('li', { class: 'finder-matching__item' }, [
          h('span', { class: 'finder-matching__tick', 'aria-hidden': 'true' }, [icon('check')]),
          h('span', { class: 'finder-matching__label', text: r[0] }),
          h('span', { class: 'finder-matching__value', text: r[1] })
        ]);
      });
      var panel = [
        h('div', { class: 'finder-matching', role: 'status' }, [
          h('span', { class: 'finder-matching__halo', 'aria-hidden': 'true' }, [icon('paw')]),
          h('h2', { class: 'finder__heading h3', id: hid, tabindex: '-1', 'data-step-heading': '' }, name ? fill(S('matching.heading_named'), { name: name }) : S('matching.heading')),
          h('ul', { class: 'finder-matching__list', role: 'list' }, rows)
        ])
      ];
      this.mount(panel, 'matching', 'forward', true);
      this.updateTop();
      var items = qsa('.finder-matching__item', this.stage);
      items.forEach(function (li, i) {
        self.later(function () { li.classList.add('is-done'); }, 160 + i * 170);
      });
      this.later(function () { self.renderResult(); }, 900);
    }

    renderResult(opts) {
      opts = opts || {};
      this.clearTimers();
      this.busy = false;
      this.state.step = 'result';
      session.clear();
      var res = this.result || { main: null };
      var nodes = res.main ? this.viewResult(res) : this.viewEmpty();
      this.mount(nodes, 'result', 'forward', opts.focus !== false);
      this.updateTop();
      this.watchCta();
      if (res.main) this.persist(res.main);
    }

    /* Phones, in the pop-up: a slim price + Add bar appears whenever the main button is out of view. */
    watchCta() {
      this.unwatchCta();
      var mini = qs('.finder-mini', this.stage);
      var main = qs('.finder-result__add', this.stage);
      if (!mini || !main || !('IntersectionObserver' in window)) return;
      var topBar = this.top ? Math.round(this.top.getBoundingClientRect().height) : 0;
      this._io = new IntersectionObserver(function (entries) {
        var show = !entries[entries.length - 1].isIntersecting;
        mini.classList.toggle('is-visible', show);
        mini.inert = !show;
      }, { root: this.mode === 'modal' ? this.dialog : null, rootMargin: '-' + topBar + 'px 0px 0px 0px', threshold: 0 });
      this._io.observe(main);
    }

    unwatchCta() {
      if (this._io) this._io.disconnect();
      this._io = null;
    }

    persist(pick) {
      var a = this.state.answers;
      var p = pick.product;
      var v = pick.fit.variant;
      var data = remember({
        dogName: this.dogName(),
        style: a.style,
        stage: a.stage,
        size: a.size,
        handle: p.handle,
        variantId: v.id,
        title: p.title,
        url: p.url,
        image: v.image || p.image || null,
        sizeLabel: pick.fit.kind === 'one' ? '' : displaySize(pick.fit.value)
      });
      emit('lunova:finder:complete', { result: data });
      track('lunova_finder_complete', { handle: p.handle, variantId: v.id, style: a.style, stage: a.stage, size: a.size });
    }

    whyList(pick) {
      var a = this.state.answers;
      var p = pick.product;
      var dog = this.dogWord();
      var out = [];
      var phrase = S('options.' + a.style + '_phrase');

      if (pick.styleFit) out.push(fill(S('result.why_style'), { dog: dog, phrase: phrase }));
      else if (pick.styleMiss) out.push(fill(S('result.why_style_miss'), { phrase: phrase }));

      if (p.ortho) {
        var material = S(p.foam && p.orthoWord ? 'result.material_both' : p.foam ? 'result.material_foam' : 'result.material_ortho');
        out.push(fill(S('result.why_ortho_' + a.stage), { dog: dog, material: material }));
      }
      else if (pick.stageFit || a.stage === 'fine') out.push(S('result.why_' + a.stage));

      out.push(this.sizeReason(pick));

      var nights = Number(settings().trialNights) || 0;
      if (nights > 0) out.push(fill(S('result.why_trial'), { nights: nights, dog: dog }));
      return out.filter(Boolean).slice(0, 3);
    }

    sizeReason(pick) {
      var fit = pick.fit;
      var a = this.state.answers;
      var hint = hintAt(hintIndex(a.size));
      var wanted = hint ? hint.label || hint.value : a.size;
      var label = displaySize(fit.value);
      if (fit.kind === 'one') {
        return fill(S('result.why_size_one'), { dims: pick.product.dims ? ' — ' + pick.product.dims : '', dog: this.dogWord() });
      }
      if (fit.kind === 'larger' || fit.kind === 'larger-approx') {
        return fill(S(fit.offered ? 'result.why_size_larger_sold' : 'result.why_size_larger_missing'), { size: label, wanted: wanted });
      }
      if (fit.kind === 'approx') return fill(S('result.why_size_approx'), { size: label, wanted: wanted });
      if (hint && hint.breeds && hint.weight) {
        var breeds = String(hint.breeds).split(',').map(function (b) { return b.trim(); }).filter(Boolean).slice(0, 2).join(', ');
        return fill(S('result.why_size'), { size: label, breeds: breeds, weight: hint.weight });
      }
      if (hint && hint.weight) {
        var w = String(hint.weight);
        if (/^[A-Z][a-z]/.test(w)) w = w.charAt(0).toLowerCase() + w.slice(1);
        return fill(S('result.why_size_plain'), { size: label, weight: w });
      }
      return fill(S('result.why_size_label'), { size: label });
    }

    image(src, alt, ratio, sizes, cls) {
      if (!src) return h('span', { class: cls + ' finder-media-ph', 'aria-hidden': 'true' }, [icon('bed')]);
      var r = Number(ratio) > 0 ? Number(ratio) : 1;
      return h('img', {
        class: cls,
        src: withWidth(src, 450),
        srcset: [300, 450, 600].map(function (w) { return withWidth(src, w) + ' ' + w + 'w'; }).join(', '),
        sizes: sizes,
        width: '600',
        height: String(Math.round(600 / r)),
        alt: alt || '',
        loading: 'lazy',
        decoding: 'async'
      });
    }

    priceBlock(v) {
      var s = settings();
      var wrap = h('div', { class: 'price price--lg finder-result__price' });
      var cmp = Number(v.compare_at_price) || 0;
      if (cmp > v.price && s.showCompareSavings !== false) {
        wrap.appendChild(h('s', { class: 'price__compare' }, [h('span', { class: 'visually-hidden', text: S('result.was') + ' ' }), money(cmp)]));
        wrap.appendChild(h('span', { class: 'price__current' }, [h('span', { class: 'visually-hidden', text: S('result.now') + ' ' }), money(v.price)]));
        var amount = s.savingsFormat === 'percent' ? Math.round(((cmp - v.price) * 100) / cmp) + '%' : money(cmp - v.price);
        wrap.appendChild(h('span', { class: 'price__save', text: fill(S('result.save'), { amount: amount }) }));
      } else {
        wrap.appendChild(h('span', { class: 'price__current', text: money(v.price) }));
      }
      return wrap;
    }

    perNight(price) {
      if (this.cfg.options.showPerNight === false || typeof L.perNight !== 'function') return null;
      var amount = L.perNight(price);
      if (!amount) return null;
      var years = Number(settings().guaranteeYears) || 0;
      var exact = typeof L.perNightExact === 'function' ? L.perNightExact(price) : amount;
      var text = fillNodes(h('span', { class: 'per-night__text' }), fill(S('result.per_night'), { years: years }), { amount: amount }, ['amount']);
      return h('div', { class: 'per-night per-night--compact finder-result__per-night' }, [
        h('details', { class: 'per-night__details' }, [
          h('summary', { class: 'per-night__summary' }, [
            icon('moon', 'per-night__icon'),
            text,
            icon('info', 'per-night__more'),
            h('span', { class: 'visually-hidden', text: ' — ' + S('result.per_night_hint') })
          ]),
          h('p', { class: 'per-night__basis', text: fill(S('result.per_night_basis'), { price: money(price), years: years, exact: exact }) })
        ])
      ]);
    }

    stockLine(v, sizeLabel, oneSize) {
      var s = settings();
      var threshold = Number(s.lowStockThreshold) || 0;
      var qty = typeof v.inventory_quantity === 'number' ? v.inventory_quantity : null;
      if (qty != null && s.lowStockEnabled !== false && threshold > 0 && qty > 0 && qty <= threshold) {
        return { kind: 'low', text: fill(S(oneSize ? 'result.stock_low_one' : 'result.stock_low'), { count: qty, size: sizeLabel }) };
      }
      if (v.backorder) return { kind: 'backorder', text: S('result.stock_backorder') };
      return { kind: 'in', text: S('result.stock_in') };
    }

    riskLine() {
      var s = settings();
      var copy = this.cfg.copy;
      var nights = Number(s.trialNights) || 0;
      var years = Number(s.guaranteeYears) || 0;
      var parts = [];
      if (nights > 0 && copy.riskText) parts.push(fill(copy.riskText, { nights: nights }));
      if (years > 0 && copy.guaranteeText) parts.push(fill(copy.guaranteeText, { years: years }));
      if (!parts.length) return null;
      return h('p', { class: 'finder-result__risk' }, [icon('shield', 'finder-result__risk-icon'), h('span', { text: parts.join(' ') })]);
    }

    answerChips() {
      var self = this;
      var a = this.state.answers;
      var list = [
        [1, S('options.' + a.style + '_short')],
        [2, S('options.' + a.stage + '_short')],
        [3, displaySize(a.size)]
      ];
      var ul = h(
        'ul',
        { class: 'finder-result__answers', role: 'list', 'aria-label': S('result.answers') },
        list.map(function (it) {
          var btn = h('button', { type: 'button', class: 'chip finder-chip', 'aria-label': fill(S('result.change'), { answer: it[1] }) }, [h('span', { text: it[1] })]);
          btn.addEventListener('click', function () {
            self.editing = true;
            self.go(it[0], { dir: 'back' });
          });
          return h('li', null, [btn]);
        })
      );
      return ul;
    }

    viewResult(res) {
      var self = this;
      var cfg = this.cfg;
      var pick = res.main;
      var p = pick.product;
      var v = pick.fit.variant;
      var name = this.dogName();
      var oneSize = pick.fit.kind === 'one';
      var sizeLabel = oneSize ? S('result.size_one') : displaySize(pick.fit.value);
      var hid = this.uid + '-h-result';
      var url = variantUrl(p.url, v.id);

      /* Head */
      var head = h('header', { class: 'finder-result__head' }, [
        cfg.copy.resultEyebrow ? h('p', { class: 'eyebrow', text: cfg.copy.resultEyebrow }) : null,
        h('h2', { class: 'finder__heading finder-result__heading h2', id: hid, tabindex: '-1', 'data-step-heading': '' }, name ? fill(S('result.heading_named'), { name: name }) : S('result.heading')),
        this.answerChips()
      ]);

      /* Product */
      var media = h('div', { class: 'finder-result__media' }, [
        this.image(v.image || p.image, p.imageAlt, p.imageRatio, '(min-width: 750px) 300px, 112px', 'finder-result__img')
      ]);

      var rating = null;
      if (cfg.options.showRating !== false && Number(p.rating) > 0) {
        var r = Math.max(0, Math.min(5, Number(p.rating)));
        rating = h('p', { class: 'rating rating--sm finder-result__rating' }, [
          h('span', { class: 'stars', style: '--rating-pct:' + (r / 5) * 100 + '%', 'aria-hidden': 'true' }),
          h('span', { class: 'visually-hidden', text: fill(S('result.rating'), { rating: r.toFixed(1) }) }),
          Number(p.ratingCount) > 0 ? h('span', { class: 'rating__count', 'aria-hidden': 'true', text: fill(S('result.rating_count'), { count: p.ratingCount }) }) : null
        ]);
      }

      var titleBlock = h('div', { class: 'finder-result__id' }, [
        h('h3', { class: 'finder-result__title h4' }, [h('a', { href: url, class: 'finder-result__link', text: p.title })]),
        rating,
        h('p', { class: 'finder-result__size' }, [
          icon('ruler', 'finder-result__size-icon'),
          oneSize ? null : h('span', { class: 'finder-result__size-label', text: S('result.size_line') + ' ' }),
          h('strong', { text: sizeLabel }),
          oneSize && p.dims ? h('span', { class: 'finder-result__size-label', text: ' · ' + p.dims }) : null
        ])
      ]);

      var reason = (pick.block && pick.block.reason) || p.blurb || '';
      var why = this.whyList(pick);
      var whyBlock = h('div', { class: 'finder-result__why' }, [
        h('p', { class: 'finder-result__why-heading', text: name ? fill(S('result.why_heading_named'), { name: name }) : S('result.why_heading') }),
        reason ? h('p', { class: 'finder-result__reason', text: reason }) : null,
        h('ul', { class: 'finder-result__bullets', role: 'list' }, why.map(function (t) {
          return h('li', null, [icon('check', 'finder-result__bullet-icon'), h('span', { text: t })]);
        }))
      ]);

      /* Price, stock, delivery */
      var stock = this.stockLine(v, sizeLabel, oneSize);
      var stockEl = h('p', { class: 'finder-result__stock finder-result__stock--' + stock.kind }, [
        icon(stock.kind === 'low' ? 'clock' : 'check-circle', 'finder-result__stock-icon'),
        h('span', { text: stock.text })
      ]);
      var delivery = null;
      if (cfg.options.showDelivery !== false && stock.kind !== 'backorder' && L.delivery && typeof L.delivery.render === 'function') {
        delivery = h('p', { class: 'delivery-promise delivery-promise--compact finder-result__delivery', 'data-countdown': '' }, [
          icon('truck', 'delivery-promise__icon'),
          h('span', { class: 'delivery-promise__text', 'data-countdown-text': '' })
        ]);
        L.delivery.render(delivery);
      }

      /* Buy */
      var label = name ? fill(S('result.add_named'), { name: name }) : S('result.add');
      var addBtn = h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block finder-result__add' }, [
        icon('basket'),
        h('span', { text: fill(S('result.add_price'), { label: label, price: money(v.price) }) })
      ]);
      var errorEl = h('p', { class: 'field__error finder-result__error', role: 'alert', hidden: true });
      addBtn.addEventListener('click', function () {
        self.addToBasket(addBtn, errorEl, pick);
      });
      var buy = h('div', { class: 'finder-result__buy' }, [addBtn, errorEl, this.riskLine()]);

      var details = h('a', { class: 'btn btn--ghost finder-result__details', href: url }, [h('span', { text: S('result.details') }), icon('arrow-right', 'icon--arrow-right')]);

      var info = h('div', { class: 'finder-result__info' }, [
        whyBlock,
        h('div', { class: 'finder-result__offer' }, [this.priceBlock(v), this.perNight(v.price), stockEl, delivery]),
        buy,
        details
      ]);

      var card = h('div', { class: 'finder-result__card' }, [media, titleBlock, info]);

      var nodes = [head, card];
      if (res.alt) nodes.push(this.viewAlt(res.alt));
      nodes.push(this.foot());
      if (this.mode === 'modal') {
        var nights = Number(settings().trialNights) || 0;
        var miniBtn = h('button', { type: 'button', class: 'btn btn--primary finder-mini__add' }, [
          h('span', { text: name ? fill(S('result.add_short_named'), { name: name }) : S('result.add') })
        ]);
        miniBtn.addEventListener('click', function () {
          self.addToBasket(miniBtn, errorEl, pick);
        });
        nodes.push(
          h('div', { class: 'finder-mini', inert: true }, [
            h('p', { class: 'finder-mini__info' }, [
              h('strong', { class: 'finder-mini__price', text: money(v.price) }),
              h('span', { class: 'finder-mini__meta', text: nights > 0 ? fill(S('result.mini_trial'), { nights: nights }) : sizeLabel })
            ]),
            miniBtn
          ])
        );
      }
      return [h('div', { class: 'finder-result' }, nodes)];
    }

    viewAlt(alt) {
      var self = this;
      var p = alt.product;
      var v = alt.fit.variant;
      var size = alt.fit.kind === 'one' ? S('result.size_one') : displaySize(alt.fit.value);
      var hid = this.uid + '-alt';
      var line = fillNodes(h('p', { class: 'finder-alt__line' }), S('result.alt_line'), { title: p.title, difference: alt.diff }, ['title']);
      var swap = h('button', { type: 'button', class: 'btn btn--secondary btn--sm finder-alt__swap', text: S('result.alt_switch') });
      swap.addEventListener('click', function () {
        var main = self.result.main;
        var fresh = Object.assign({}, main, { diff: difference(alt, main) || S('result.diff_other') });
        self.result = { main: alt, alt: fresh };
        self.renderResult();
      });
      var view = h('a', { class: 'btn btn--ghost btn--sm finder-alt__view', href: variantUrl(p.url, v.id), 'aria-label': fill(S('result.alt_view_label'), { title: p.title }) }, S('result.alt_view'));
      return h('aside', { class: 'finder-alt', 'aria-labelledby': hid }, [
        h('div', { class: 'finder-alt__media' }, [this.image(v.image || p.image, '', p.imageRatio, '96px', 'finder-alt__img')]),
        h('div', { class: 'finder-alt__body' }, [
          h('p', { class: 'finder-alt__eyebrow', id: hid, text: S('result.alt_heading') }),
          line,
          h('p', { class: 'finder-alt__meta' }, [size + ' · ', h('strong', { text: money(v.price) })]),
          h('div', { class: 'finder-alt__actions' }, [swap, view])
        ])
      ]);
    }

    foot() {
      var self = this;
      var restart = h('button', { type: 'button', class: 'btn btn--ghost finder-result__restart' }, [icon('return'), h('span', { text: S('result.restart') })]);
      restart.addEventListener('click', function () {
        self.reset();
        self.go(1, { dir: 'back' });
      });
      return h('div', { class: 'finder-result__foot' }, [restart]);
    }

    viewEmpty() {
      var self = this;
      var cfg = this.cfg;
      var a = this.state.answers;
      var hid = this.uid + '-h-empty';
      var dog = this.dogWord();
      var noFit = cfg.hasProducts;
      var heading = noFit ? fill(S('result.nofit_heading'), { size: displaySize(a.size) }) : fill(S('result.empty_heading'), { dog: dog });
      var text = noFit ? fill(S('result.nofit_text'), { dog: dog }) : fill(S('result.empty_text'), { dog: dog });
      var actions = [h('a', { class: 'btn btn--secondary', href: cfg.urls.allProducts || '/collections/all', text: S('browse_all') })];
      if (noFit) {
        var other = h('button', { type: 'button', class: 'btn btn--ghost', text: S('result.try_size') });
        other.addEventListener('click', function () {
          self.editing = true;
          self.go(3, { dir: 'back' });
        });
        actions.push(other);
      }
      return [
        h('div', { class: 'finder-result finder-result--empty' }, [
          h('span', { class: 'finder-matching__halo', 'aria-hidden': 'true' }, [icon('paw')]),
          h('h2', { class: 'finder__heading h3', id: hid, tabindex: '-1', 'data-step-heading': '' }, heading),
          h('p', { class: 'finder__sub', text: text }),
          cfg.designMode ? h('p', { class: 'finder-result__setup', text: S('result.setup_note') }) : null,
          h('div', { class: 'finder-result__empty-actions' }, actions),
          this.foot()
        ])
      ];
    }

    addToBasket(btn, errorEl, pick) {
      if (btn.getAttribute('aria-busy') === 'true') return;
      var self = this;
      var v = pick.fit.variant;
      var s = settings();
      var cartUrl = (L.routes && (L.routes.cartUrl || L.routes.cart)) || '/cart';
      var hasDrawer = s.cartType !== 'page' && !!doc.querySelector('cart-drawer') && L.template !== 'cart';

      if (!L.cart || typeof L.cart.add !== 'function') {
        window.location.href = variantUrl(pick.product.url, v.id);
        return;
      }
      errorEl.hidden = true;
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      L.cart
        .add([{ id: v.id, quantity: 1 }], { sections: hasDrawer ? 'cart-drawer' : null, source: 'finder' })
        .then(function (res) {
          track('lunova_finder_add', { handle: pick.product.handle, variantId: v.id });
          if (!hasDrawer) {
            window.location.href = cartUrl;
            return;
          }
          var opener = self.opener && doc.contains(self.opener) ? self.opener : null;
          if (self.mode === 'modal') self.closeModal({ instant: true, restoreFocus: false });
          emit('lunova:cart:open', {
            added: res && res.items && res.items[0],
            reason: 'finder',
            sections: res && res.sections,
            cart: res && res.cart,
            opener: opener || btn
          });
        })
        .catch(function (err) {
          errorEl.textContent = (err && err.description) || S('result.add_error');
          errorEl.hidden = false;
          if (typeof errorEl.scrollIntoView === 'function') errorEl.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
        })
        .then(function () {
          btn.removeAttribute('aria-busy');
          btn.disabled = false;
        });
    }
  }

  if (!customElements.get('bed-finder')) customElements.define('bed-finder', BedFinder);

  /* ------------------------------------------------------------------------
     <finder-teaser> — question 1 inline; a tap opens the finder on question 2
     ---------------------------------------------------------------------- */
  class FinderTeaser extends HTMLElement {
    connectedCallback() {
      if (this._connected) return;
      this._connected = true;
      var self = this;
      this._onClick = this.onClick.bind(this);
      this.addEventListener('click', this._onClick);
      this._offs = [
        on('lunova:finder:complete', function () { self.update(); })
      ];
      this._onStorage = function (e) {
        if (e.key === 'lunova:finder') self.update();
      };
      window.addEventListener('storage', this._onStorage);
      this.update();
    }

    disconnectedCallback() {
      this._connected = false;
      this.removeEventListener('click', this._onClick);
      (this._offs || []).forEach(function (off) { off(); });
      window.removeEventListener('storage', this._onStorage);
    }

    update() {
      var welcome = qs('[data-teaser-welcome]', this);
      var question = qs('[data-teaser-question]', this);
      if (!welcome || !question) return;
      var data = stored();
      var title = data && data.title;
      var url = data && data.url;
      var image = data && data.image;
      if (data && data.handle && !title) {
        var cfg = config();
        var p = cfg && cfg.products[data.handle];
        if (p) {
          title = p.title;
          url = url || p.url;
          image = image || p.image;
        }
      }
      if (!data || !data.handle || !title || !settings().finderEnabled) {
        welcome.hidden = true;
        question.hidden = false;
        return;
      }
      var name = typeof data.dogName === 'string' ? data.dogName.trim().slice(0, 40) : '';
      var tpl = welcome.getAttribute(name ? 'data-match-named' : 'data-match') || '';
      var matchEl = qs('[data-teaser-match]', welcome);
      if (matchEl) {
        matchEl.textContent = '';
        fillNodes(matchEl, decode(tpl), { name: name, title: title }, ['title']);
      }
      var sizeEl = qs('[data-teaser-size]', welcome);
      if (sizeEl) {
        sizeEl.textContent = data.sizeLabel ? fill(decode(welcome.getAttribute('data-size') || ''), { size: data.sizeLabel }) : '';
        sizeEl.hidden = !data.sizeLabel;
      }
      var view = qs('[data-teaser-view]', welcome);
      if (view) {
        view.href = variantUrl(url, data.variantId);
        view.setAttribute('aria-label', fill(decode(welcome.getAttribute('data-view-label') || ''), { title: title }));
      }
      var media = qs('[data-teaser-media]', welcome);
      if (media) {
        media.textContent = '';
        if (image) {
          media.appendChild(h('img', { src: withWidth(image, 300), srcset: withWidth(image, 150) + ' 150w, ' + withWidth(image, 300) + ' 300w', sizes: '120px', width: '300', height: '300', alt: '', loading: 'lazy', decoding: 'async' }));
          media.hidden = false;
        } else {
          media.hidden = true;
        }
      }
      welcome.hidden = false;
      question.hidden = true;
    }

    onClick(e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var card = e.target.closest('[data-teaser-style]');
      if (card && this.contains(card)) {
        if (!finderAvailable()) return; /* the link opens the finder page instead */
        e.preventDefault();
        var style = card.getAttribute('data-teaser-style');
        qsa('[data-teaser-style]', this).forEach(function (c) { c.classList.toggle('is-chosen', c === card); });
        setTimeout(function () {
          emit('lunova:finder:open', { step: 2, answers: { style: style }, trigger: card });
        }, reduceMotion() ? 0 : 180);
        setTimeout(function () { card.classList.remove('is-chosen'); }, 1200);
        return;
      }
      var retake = e.target.closest('[data-teaser-retake]');
      if (retake && this.contains(retake)) {
        e.preventDefault();
        if (finderAvailable()) emit('lunova:finder:open', { step: 1, restart: true, trigger: retake });
        else if (retake.getAttribute('data-href')) window.location.href = retake.getAttribute('data-href');
      }
    }
  }

  if (!customElements.get('finder-teaser')) customElements.define('finder-teaser', FinderTeaser);

  /* For other areas/tests: the pure matching engine. */
  L.finderEngine = { config: config, recommend: recommend, rank: rank, resolveSize: resolveSize, hintIndex: hintIndex };
})();
