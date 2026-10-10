/* ==========================================================================
   Lunova — global.js
   Shared runtime on window.Lunova: money, fetch, cart API + events, storage,
   Bed Finder memory and personalisation, focus trap, scroll lock, delivery
   estimate + countdown, per-night reframe, <slider-row>, scroll reveal.
   Vanilla ES2019, no dependencies. Loaded with `defer` from theme.liquid.
   ========================================================================== */
(function () {
  'use strict';

  var L = (window.Lunova = window.Lunova || {});
  if (L._globalReady) return;
  L._globalReady = true;

  L.routes = L.routes || {};
  L.settings = L.settings || {};
  L.strings = L.strings || {};

  var doc = document;
  var root = doc.documentElement;

  /* Shopify's `t` filter HTML-escapes translations ("You&#39;re"). These
     strings are only ever set as text, so decode them once, here. */
  (function decodeStrings() {
    var box = null;
    Object.keys(L.strings).forEach(function (key) {
      var v = L.strings[key];
      if (typeof v !== 'string' || v.indexOf('&') === -1) return;
      box = box || doc.createElement('textarea');
      box.innerHTML = v;
      L.strings[key] = box.value;
    });
  })();

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  /** Like qsa, but includes the scope element itself when it matches. */
  function qsaSelf(selector, scope) {
    var list = qsa(selector, scope);
    if (scope && scope !== doc && scope.matches && scope.matches(selector)) list.unshift(scope);
    return list;
  }

  function str(key, fallback) {
    var v = L.strings && L.strings[key];
    return typeof v === 'string' && v ? v : fallback;
  }

  /** Replace [token] placeholders: fill('Only [n] left', {n: 3}) */
  function fill(template, vars) {
    return String(template || '').replace(/\[(\w+)\]/g, function (m, k) {
      return vars && vars[k] != null ? String(vars[k]) : m;
    });
  }
  L.fill = fill;

  /** Fill a [token] template into an element, wrapping each value in <strong>. Never uses innerHTML. */
  function fillInto(el, template, vars) {
    var parts = String(template || '').split(/(\[\w+\])/);
    var frag = doc.createDocumentFragment();
    parts.forEach(function (part) {
      var m = /^\[(\w+)\]$/.exec(part);
      if (m && vars && vars[m[1]] != null) {
        var strong = doc.createElement('strong');
        strong.textContent = String(vars[m[1]]);
        frag.appendChild(strong);
      } else if (part) {
        frag.appendChild(doc.createTextNode(part));
      }
    });
    el.textContent = '';
    el.appendChild(frag);
  }
  L.fillInto = fillInto;

  /* ------------------------------------------------------------------------
     Events
     ---------------------------------------------------------------------- */
  L.on = function (name, handler) {
    doc.addEventListener(name, handler);
    return function () {
      doc.removeEventListener(name, handler);
    };
  };

  L.emit = function (name, detail) {
    doc.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  };

  /* ------------------------------------------------------------------------
     Money — mirrors Shopify's money formats
     ---------------------------------------------------------------------- */
  function decodeFormat(format) {
    var f = String(format || '').replace(/<[^>]*>/g, '');
    if (f.indexOf('&') > -1) {
      var t = doc.createElement('textarea');
      t.innerHTML = f;
      f = t.value;
    }
    return f;
  }

  var moneyFormatCache = null;

  /**
   * Lunova.money(cents, format?) → the store's money format the way Liquid's
   * `money_without_trailing_zeros` prints it: whole pounds lose ".00"
   * (14900 → "£149", 104900 → "£1,049"), any other amount keeps its pence
   * (499 → "£4.99", 450 → "£4.50"). Pass opts {pence: true} as a third
   * argument for the full `money` form ("£149.00"); Lunova.moneyFull does the same.
   */
  L.money = function (cents, format, opts) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    var value = parseInt(cents, 10);
    if (isNaN(value)) value = 0;
    var keepPence = !!(opts && opts.pence);
    var fmt = format ? decodeFormat(format) : (moneyFormatCache = moneyFormatCache || decodeFormat(L.moneyFormat || '£{{amount}}'));
    var match = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    if (!match) return fmt;

    function withDelimiters(number, precision, thousands, decimal) {
      thousands = thousands == null ? ',' : thousands;
      decimal = decimal == null ? '.' : decimal;
      if (precision > 0 && !keepPence && number % 100 === 0) precision = 0;
      var negative = number < 0;
      var fixed = (Math.abs(number) / 100).toFixed(precision);
      var parts = fixed.split('.');
      var whole = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + thousands);
      var out = whole + (parts[1] ? decimal + parts[1] : '');
      return (negative ? '-' : '') + out;
    }

    var amount;
    switch (match[1]) {
      case 'amount_no_decimals':
        amount = withDelimiters(value, 0);
        break;
      case 'amount_with_comma_separator':
        amount = withDelimiters(value, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        amount = withDelimiters(value, 0, '.', ',');
        break;
      case 'amount_with_apostrophe_separator':
        amount = withDelimiters(value, 2, "'", '.');
        break;
      case 'amount_no_decimals_with_space_separator':
        amount = withDelimiters(value, 0, ' ', '');
        break;
      case 'amount_with_space_separator':
        amount = withDelimiters(value, 2, ' ', ',');
        break;
      case 'amount_with_period_and_space_separator':
        amount = withDelimiters(value, 2, ' ', '.');
        break;
      default:
        amount = withDelimiters(value, 2);
    }
    return fmt.replace(match[0], amount);
  };

  /** The full `money` form, pence always shown ("£149.00"): only where a sum must show its working. */
  L.moneyFull = function (cents, format) {
    return L.money(cents, format, { pence: true });
  };

  /* ------------------------------------------------------------------------
     fetchJSON — throws {status, description} on !ok

     opts.timeout (ms): abort a request that hasn't finished in time and throw
     {status: 408, timeout: true, description}. The status is non-zero on
     purpose: a timed-out POST may still have reached Shopify, so callers must
     show the error rather than silently re-posting the form.
     A failure before any response arrived (offline, DNS, CORS) is tagged
     err.stage = 'request'.
     ---------------------------------------------------------------------- */
  L.fetchJSON = function (url, opts) {
    opts = Object.assign({}, opts || {});
    var timeoutMs = Number(opts.timeout) || 0;
    delete opts.timeout;
    var headers = Object.assign(
      { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      opts.headers || {}
    );
    var body = opts.body;
    var isPlainObject =
      body &&
      typeof body === 'object' &&
      !(typeof FormData !== 'undefined' && body instanceof FormData) &&
      !(typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) &&
      !(typeof Blob !== 'undefined' && body instanceof Blob);
    var hasType = Object.keys(headers).some(function (k) { return k.toLowerCase() === 'content-type'; });
    if (isPlainObject) {
      body = JSON.stringify(body);
      if (!hasType) headers['Content-Type'] = 'application/json';
    } else if (typeof body === 'string' && !hasType && /^\s*[\[{]/.test(body)) {
      headers['Content-Type'] = 'application/json';
    }
    var init = Object.assign({ credentials: 'same-origin' }, opts, { headers: headers });
    if (body !== undefined) init.body = body;

    var timer = null;
    var timedOut = false;
    if (timeoutMs > 0 && typeof AbortController !== 'undefined') {
      var controller = new AbortController();
      var outer = opts.signal;
      if (outer) {
        if (outer.aborted) controller.abort();
        else outer.addEventListener('abort', function () { controller.abort(); }, { once: true });
      }
      init.signal = controller.signal;
      timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }
    function settle() {
      if (timer) clearTimeout(timer);
      timer = null;
    }
    function timeoutError() {
      var description = str('timeout', str('error', 'Something went wrong. Please try again.'));
      var err = new Error(description);
      err.status = 408;
      err.timeout = true;
      err.description = description;
      return err;
    }

    return fetch(url, init)
      .catch(function (err) {
        if (timedOut) throw timeoutError();
        if (err && typeof err === 'object' && err.name !== 'AbortError') {
          try {
            err.stage = 'request';
          } catch (e) {
            /* frozen error object */
          }
        }
        throw err;
      })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              data = text;
            }
          }
          if (!res.ok) {
            var description =
              (data && typeof data === 'object' && (data.description || data.message || data.errors)) ||
              res.statusText ||
              str('error', 'Something went wrong. Please try again.');
            if (typeof description === 'object') description = JSON.stringify(description);
            var err = new Error(description);
            err.status = res.status;
            err.description = description;
            err.data = data;
            throw err;
          }
          return data;
        }, function (err) {
          if (timedOut) throw timeoutError();
          throw err;
        });
      })
      .then(
        function (data) {
          settle();
          return data;
        },
        function (err) {
          settle();
          throw err;
        }
      );
  };

  /* ------------------------------------------------------------------------
     Section Rendering helper
     ---------------------------------------------------------------------- */
  L.sectionsUrl = function (sectionIds, baseUrl) {
    var ids = [].concat(sectionIds || []).filter(Boolean).join(',');
    var u = new URL(baseUrl || window.location.href, window.location.origin);
    u.searchParams.set('sections', ids);
    u.hash = '';
    return u.pathname + u.search;
  };

  /* ------------------------------------------------------------------------
     Cart API — serialised so rapid taps can't race each other
     ---------------------------------------------------------------------- */
  function route(name, fallback) {
    var r = L.routes && L.routes[name];
    return (r || fallback).replace(/\/$/, '');
  }

  function normSections(sections) {
    if (!sections) return null;
    var list = Array.isArray(sections) ? sections : String(sections).split(',');
    list = list.map(function (s) { return String(s).trim(); }).filter(Boolean);
    return list.length ? list.join(',') : null;
  }

  /* A stalled request must not freeze every later cart action behind it in
     the queue, so cart calls give up after this long and show an error. */
  var CART_TIMEOUT = 15000;

  var queue = Promise.resolve();
  function enqueue(task) {
    var run = queue.then(task, task);
    queue = run.catch(function () {});
    return run;
  }

  L.cart = {
    get: function () {
      return L.fetchJSON(route('cart', '/cart') + '.js', { cache: 'no-store', timeout: CART_TIMEOUT });
    },

    add: function (items, opts) {
      opts = opts || {};
      return enqueue(function () {
        var body = { items: [].concat(items || []) };
        var sections = normSections(opts.sections);
        if (sections) {
          body.sections = sections;
          body.sections_url = opts.sectionsUrl || window.location.pathname;
        }
        return L.fetchJSON(route('cartAdd', '/cart/add') + '.js', { method: 'POST', body: body, timeout: CART_TIMEOUT }).then(function (res) {
          var added = (res && res.items) || (res && res.id ? [res] : []);
          var renderedSections = (res && res.sections) || null;
          /* The item is in the basket now. If the follow-up refresh fails,
             resolve with cart: null rather than reject: a rejection here
             reads as "add failed" and invites a second add (product-form
             even re-posts natively on a status-less error). */
          return L.cart.get().catch(function () { return null; }).then(function (cart) {
            var out = { cart: cart, sections: renderedSections, items: added };
            L.emit('lunova:cart:updated', { cart: cart, source: opts.source || 'add', sections: renderedSections, items: added });
            return out;
          });
        });
      });
    },

    change: function (lineKeyOrIndex, quantity, opts) {
      opts = opts || {};
      return enqueue(function () {
        var body = { quantity: Math.max(0, parseInt(quantity, 10) || 0) };
        if (typeof lineKeyOrIndex === 'number') body.line = lineKeyOrIndex;
        else body.id = String(lineKeyOrIndex);
        var sections = normSections(opts.sections);
        if (sections) {
          body.sections = sections;
          body.sections_url = opts.sectionsUrl || window.location.pathname;
        }
        return L.fetchJSON(route('cartChange', '/cart/change') + '.js', { method: 'POST', body: body, timeout: CART_TIMEOUT }).then(function (cart) {
          var renderedSections = (cart && cart.sections) || null;
          if (cart && cart.sections) delete cart.sections;
          L.emit('lunova:cart:updated', { cart: cart, source: opts.source || 'change', sections: renderedSections });
          return { cart: cart, sections: renderedSections };
        });
      });
    },

    /** Note / attributes / bulk quantities: update({note}, {sections}) */
    update: function (payload, opts) {
      opts = opts || {};
      return enqueue(function () {
        var body = Object.assign({}, payload || {});
        var sections = normSections(opts.sections);
        if (sections) {
          body.sections = sections;
          body.sections_url = opts.sectionsUrl || window.location.pathname;
        }
        return L.fetchJSON(route('cartUpdate', '/cart/update') + '.js', { method: 'POST', body: body, timeout: CART_TIMEOUT }).then(function (cart) {
          var renderedSections = (cart && cart.sections) || null;
          if (cart && cart.sections) delete cart.sections;
          L.emit('lunova:cart:updated', { cart: cart, source: opts.source || 'update', sections: renderedSections });
          return { cart: cart, sections: renderedSections };
        });
      });
    }
  };

  /* ------------------------------------------------------------------------
     Storage
     ---------------------------------------------------------------------- */
  L.store = {
    get: function (key) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove: function (key) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        /* storage unavailable */
      }
    }
  };

  /* ------------------------------------------------------------------------
     Bed Finder memory + personalisation
     {dogName, style, stage, size, handle, variantId, ts}
     ---------------------------------------------------------------------- */
  var FINDER_KEY = 'lunova:finder';

  L.finder = {
    get: function () {
      var data = L.store.get(FINDER_KEY);
      return data && typeof data === 'object' ? data : null;
    },
    /** Shallow-merges into what's stored (call clear() first to start over). */
    set: function (obj) {
      var next = Object.assign({}, L.finder.get() || {}, obj || {}, { ts: Date.now() });
      if (typeof next.dogName === 'string') next.dogName = next.dogName.trim().slice(0, 40);
      L.store.set(FINDER_KEY, next);
      applyFinder(doc);
      return next;
    },
    clear: function () {
      L.store.remove(FINDER_KEY);
      applyFinder(doc);
    },
    /** The stored dog's name, trimmed, or '' */
    name: function () {
      var d = L.finder.get();
      return d && typeof d.dogName === 'string' ? d.dogName.trim().slice(0, 40) : '';
    }
  };

  /**
   * [data-finder-name]            → textContent = name. If the attribute value
   *                                 contains [name] it is used as a template:
   *                                 data-finder-name="[name]'s bed".
   *                                 With no name stored, the original text stays.
   * [data-finder-name-only]       → hidden unless a name is stored.
   * [data-finder-match-handle]    → .is-finder-match when it matches the stored
   *                                 result's handle; its .badge--match is revealed.
   */
  function applyFinder(scope, override) {
    scope = scope || doc;
    var data = override || L.finder.get();
    var name = data && typeof data.dogName === 'string' ? data.dogName.trim().slice(0, 40) : '';

    qsaSelf('[data-finder-name]', scope).forEach(function (el) {
      if (!el.hasAttribute('data-finder-name-default')) {
        el.setAttribute('data-finder-name-default', el.textContent);
      }
      var tpl = el.getAttribute('data-finder-name');
      if (name) {
        el.textContent = tpl && tpl.indexOf('[name]') > -1 ? fill(tpl, { name: name }) : name;
        el.classList.add('has-finder-name');
      } else {
        el.textContent = el.getAttribute('data-finder-name-default');
        el.classList.remove('has-finder-name');
      }
      if (el.hasAttribute('data-finder-name-only')) el.hidden = !name;
    });

    qsaSelf('[data-finder-name-only]:not([data-finder-name])', scope).forEach(function (el) {
      el.hidden = !name;
    });

    var handle = data && data.handle ? String(data.handle) : '';
    qsaSelf('[data-finder-match-handle]', scope).forEach(function (card) {
      var match = !!handle && card.getAttribute('data-finder-match-handle') === handle;
      card.classList.toggle('is-finder-match', match);
      qsa('.badge--match, [data-finder-match-badge]', card).forEach(function (badge) {
        badge.hidden = !match;
      });
    });

    root.classList.toggle('has-finder-result', !!handle);
    root.classList.toggle('has-finder-name', !!name);
    /* Same attributes the inline <head> script sets at first paint (CSS
       reserves space for the match badge / resume line with them); kept in
       step when the finder is retaken or cleared on the page. */
    var size = data && data.size ? String(data.size) : '';
    if (handle) root.setAttribute('data-finder-handle', handle);
    else root.removeAttribute('data-finder-handle');
    if (handle && size) root.setAttribute('data-finder-size', size);
    else root.removeAttribute('data-finder-size');
  }
  L.applyFinder = applyFinder;

  /* ------------------------------------------------------------------------
     Focus trap + scroll lock
     ---------------------------------------------------------------------- */
  var FOCUSABLE = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    'iframe',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(',');

  function isVisible(el) {
    if (el.closest('[inert], [hidden]')) return false;
    var d = el.closest('details:not([open])');
    if (d && el.tagName !== 'SUMMARY') return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  L.focusables = function (container) {
    return qsa(FOCUSABLE, container).filter(isVisible);
  };

  L.trapFocus = function (container, initial) {
    if (!container) return function () {};
    var previous = doc.activeElement;

    function onKeydown(e) {
      if (e.key !== 'Tab') return;
      var list = L.focusables(container);
      if (!list.length) {
        e.preventDefault();
        container.focus();
        return;
      }
      var first = list[0];
      var last = list[list.length - 1];
      var active = doc.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    doc.addEventListener('keydown', onKeydown, true);

    var target = initial || container.querySelector('[autofocus]') || L.focusables(container)[0] || container;
    if (target === container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    window.requestAnimationFrame(function () {
      try {
        target.focus({ preventScroll: true });
      } catch (e) {
        target.focus();
      }
    });

    return function release(restoreFocus) {
      doc.removeEventListener('keydown', onKeydown, true);
      if (restoreFocus !== false && previous && typeof previous.focus === 'function' && doc.contains(previous)) {
        try {
          previous.focus({ preventScroll: true });
        } catch (e) {
          previous.focus();
        }
      }
    };
  };

  var scrollLocks = 0;
  L.lockScroll = function () {
    scrollLocks += 1;
    if (scrollLocks > 1) return;
    var scrollbar = window.innerWidth - root.clientWidth;
    root.style.setProperty('--scrollbar-w', Math.max(0, scrollbar) + 'px');
    root.classList.add('is-scroll-locked');
  };
  L.unlockScroll = function () {
    if (scrollLocks === 0) return;
    scrollLocks -= 1;
    if (scrollLocks > 0) return;
    root.classList.remove('is-scroll-locked');
    root.style.removeProperty('--scrollbar-w');
  };

  L.debounce = function (fn, ms) {
    var t;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms == null ? 200 : ms);
    };
  };

  /* ------------------------------------------------------------------------
     Delivery estimate — honest, from the merchant's real settings
     All dates are "civil" dates in the store's time zone, represented as
     Date objects at 12:00 UTC so day arithmetic never trips over DST.
     ---------------------------------------------------------------------- */
  var DAY_MS = 86400000;

  function storeNowParts(now, timeZone) {
    var fallback = {
      y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate(),
      h: now.getHours(), min: now.getMinutes(), s: now.getSeconds()
    };
    try {
      var fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: timeZone || 'Europe/London',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hourCycle: 'h23'
      });
      var out = {};
      fmt.formatToParts(now).forEach(function (p) {
        if (p.type !== 'literal') out[p.type] = parseInt(p.value, 10);
      });
      if (isNaN(out.year)) return fallback;
      return {
        y: out.year, m: out.month, d: out.day,
        h: out.hour === 24 ? 0 : out.hour, min: out.minute, s: out.second
      };
    } catch (e) {
      return fallback;
    }
  }

  function civil(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d, 12));
  }

  function addDays(date, n) {
    return new Date(date.getTime() + n * DAY_MS);
  }

  function ymd(date) {
    return date.toISOString().slice(0, 10);
  }

  function settingsForDelivery() {
    var s = L.settings || {};
    var days = Array.isArray(s.dispatchDays) ? s.dispatchDays : [1, 2, 3, 4, 5];
    days = days.map(Number).filter(function (n) { return n >= 0 && n <= 6; });
    var holidays = {};
    (Array.isArray(s.holidays) ? s.holidays : []).forEach(function (h) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(h).trim())) holidays[String(h).trim()] = true;
    });
    var min = Math.max(0, parseInt(s.deliveryMin, 10) || 0);
    var max = Math.max(min, parseInt(s.deliveryMax, 10) || 0);
    var cutoff = parseInt(s.cutoffHour, 10);
    if (isNaN(cutoff)) cutoff = 15;
    cutoff = Math.min(23, Math.max(0, cutoff));
    return { days: days, holidays: holidays, min: min, max: max, cutoff: cutoff, timeZone: s.timezone || 'Europe/London' };
  }

  function isDispatchDay(date, cfg) {
    return cfg.days.indexOf(date.getUTCDay()) > -1 && !cfg.holidays[ymd(date)];
  }

  function isDeliveryDay(date, cfg) {
    var wd = date.getUTCDay();
    return wd >= 1 && wd <= 5 && !cfg.holidays[ymd(date)];
  }

  function addDeliveryDays(from, n, cfg) {
    var date = from;
    var added = 0;
    var guard = 0;
    while (added < n && guard < 120) {
      date = addDays(date, 1);
      guard += 1;
      if (isDeliveryDay(date, cfg)) added += 1;
    }
    return date;
  }

  L.delivery = {
    /**
     * estimate(now) → {cutoffMs, dispatchDate, arriveFrom, arriveTo, dispatchToday, dispatchTomorrow}
     * or null when the promise is switched off or can't be computed.
     * cutoffMs: ms left to make today's dispatch (0 when today's has gone).
     */
    estimate: function (now) {
      var s = L.settings || {};
      if (!s.deliveryEnabled) return null;
      var cfg = settingsForDelivery();
      if (!cfg.days.length) return null;

      now = now || new Date();
      var p = storeNowParts(now, cfg.timeZone);
      var today = civil(p.y, p.m, p.d);
      var secondsNow = p.h * 3600 + p.min * 60 + p.s;
      var secondsCutoff = cfg.cutoff * 3600;

      var dispatchDate = null;
      var cutoffMs = 0;
      if (isDispatchDay(today, cfg) && secondsNow < secondsCutoff) {
        dispatchDate = today;
        cutoffMs = (secondsCutoff - secondsNow) * 1000;
      } else {
        var probe = today;
        for (var i = 0; i < 60; i += 1) {
          probe = addDays(probe, 1);
          if (isDispatchDay(probe, cfg)) {
            dispatchDate = probe;
            break;
          }
        }
      }
      if (!dispatchDate) return null;

      var arriveFrom = cfg.min === 0 ? dispatchDate : addDeliveryDays(dispatchDate, cfg.min, cfg);
      var arriveTo = addDeliveryDays(dispatchDate, cfg.max, cfg);
      var dayDiff = Math.round((dispatchDate.getTime() - today.getTime()) / DAY_MS);

      return {
        cutoffMs: cutoffMs,
        dispatchDate: dispatchDate,
        arriveFrom: arriveFrom,
        arriveTo: arriveTo,
        dispatchToday: dayDiff === 0,
        dispatchTomorrow: dayDiff === 1
      };
    },

    /** "Thu 8 Oct" for a civil date from estimate() / window(). English pages
        build it by hand, the way Liquid's date filter prints it ("%a %-d %b"),
        so browsers don't add a comma ("Thu, 8 Oct") or write "Sept". */
    format: function (date, opts) {
      var lang = root.getAttribute('lang') || 'en-GB';
      if (/^en$/i.test(lang)) lang = 'en-GB';
      if (!opts && /^en/i.test(lang)) {
        var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
        var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
        return wd + ' ' + date.getUTCDate() + ' ' + mo;
      }
      try {
        return new Intl.DateTimeFormat(lang, Object.assign({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }, opts || {})).format(date);
      } catch (e) {
        return date.toUTCString().slice(0, 11);
      }
    },

    /** Template + values for the countdown line, or null */
    message: function (est) {
      est = est === undefined ? L.delivery.estimate() : est;
      if (!est) return null;
      var from = L.delivery.format(est.arriveFrom);
      var to = L.delivery.format(est.arriveTo);
      var arrival = from === to ? from : fill(str('arrivalRange', '[from]–[to]'), { from: from, to: to });

      if (est.dispatchToday && est.cutoffMs > 0) {
        var totalMin = Math.max(1, Math.floor(est.cutoffMs / 60000));
        var h = Math.floor(totalMin / 60);
        var m = totalMin % 60;
        var time = h > 0
          ? fill(str('hoursMinutes', '[hours]h [minutes]m'), { hours: h, minutes: m })
          : fill(str('minutes', '[minutes]m'), { minutes: m });
        return { template: str('orderWithin', 'Order within [time] for dispatch today — arrives [arrival]'), vars: { time: time, arrival: arrival } };
      }

      var day = L.delivery.format(est.dispatchDate, est.dispatchTomorrow ? { weekday: 'short', day: undefined, month: undefined } : undefined);
      var dispatch = est.dispatchTomorrow
        ? fill(str('dispatchTomorrow', 'tomorrow ([day])'), { day: day })
        : fill(str('dispatchOn', 'on [day]'), { day: day });
      return { template: str('orderNow', 'Order now for dispatch [dispatch] — arrives [arrival]'), vars: { dispatch: dispatch, arrival: arrival } };
    },

    /** Fill one [data-countdown] element (or its [data-countdown-text] child) */
    render: function (el, est) {
      if (!el) return;
      var msg = L.delivery.message(est);
      if (!msg || el.hasAttribute('data-unavailable')) {
        el.hidden = true;
        return;
      }
      var target = el.querySelector('[data-countdown-text]') || el;
      fillInto(target, msg.template, msg.vars);
      el.hidden = false;
    },

    /** Is this civil date (from window()/civil()) a working day? Mon to Fri, not a bank holiday. */
    isWorkingDay: function (date) {
      return isWorkingDay(date);
    },

    /**
     * Lunova.delivery.window({dispatchMin, dispatchMax, transitMin, transitMax, from, sameDay, cutoffHour})
     *   → {earliest, latest, dispatchEarliest, dispatchLatest, earliestText, latestText, text}
     * Arrival dates for an order placed at `from` (a Date, or "YYYY-MM-DD";
     * default now), in the store's time zone, counting WORKING days only:
     * no Saturdays, Sundays or England & Wales bank holidays (BANK_HOLIDAYS
     * below, plus any Theme settings → holiday_dates). Dispatch is
     * dispatchMin..dispatchMax working days after the order day, delivery
     * transitMin..transitMax working days after dispatch. A dispatchMin of 0
     * (same-day) counts only with sameDay true, on a working day before the
     * cut-off hour (default Lunova.settings.cutoffHour, 15); otherwise 1.
     * Dates are civil dates (Date at 12:00 UTC); *Text is "Thu 15 Oct";
     * text is "Thu 15 Oct to Mon 19 Oct" (or one date when they match;
     * opts.rangeTemplate "[from] to [to]" words the range).
     * Returns null when the numbers are missing or not numbers.
     */
    window: function (opts) {
      opts = opts || {};
      var num = function (v) {
        var n = parseInt(v, 10);
        return isNaN(n) || n < 0 ? null : n;
      };
      var dMin = num(opts.dispatchMin);
      var dMax = num(opts.dispatchMax);
      var tMin = num(opts.transitMin);
      var tMax = num(opts.transitMax);
      if (dMin == null && dMax == null) return null;
      if (tMin == null && tMax == null) return null;
      if (dMin == null) dMin = dMax;
      if (dMax == null || dMax < dMin) dMax = dMin;
      if (tMin == null) tMin = tMax;
      if (tMax == null || tMax < tMin) tMax = tMin;

      var start;
      var afterCutoff = true;
      var cutoff = opts.cutoffHour != null ? Number(opts.cutoffHour) : Number((L.settings || {}).cutoffHour);
      if (isNaN(cutoff)) cutoff = 15;
      if (typeof opts.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(opts.from)) {
        var bits = opts.from.split('-').map(Number);
        start = civil(bits[0], bits[1], bits[2]);
      } else {
        var when = opts.from instanceof Date ? opts.from : new Date();
        var p = storeNowParts(when, (L.settings || {}).timezone || 'Europe/London');
        start = civil(p.y, p.m, p.d);
        afterCutoff = p.h >= cutoff;
      }
      /* Same-day dispatch is never assumed: only with sameDay, on a working
         day, before the cut-off. */
      var sameDayOk = !!opts.sameDay && isWorkingDay(start) && !afterCutoff;
      if (dMin === 0 && !sameDayOk) dMin = 1;
      if (dMax < dMin) dMax = dMin;

      var dispatchEarliest = addWorkingDays(start, dMin);
      var dispatchLatest = addWorkingDays(start, dMax);
      var earliest = addWorkingDays(dispatchEarliest, tMin);
      var latest = addWorkingDays(dispatchLatest, tMax);
      var a = L.delivery.format(earliest);
      var b = L.delivery.format(latest);
      return {
        earliest: earliest,
        latest: latest,
        dispatchEarliest: dispatchEarliest,
        dispatchLatest: dispatchLatest,
        earliestText: a,
        latestText: b,
        text: a === b ? a : fill(opts.rangeTemplate || str('deliveryRange', '[from] to [to]'), { from: a, to: b })
      };
    },

    /**
     * Fill every [data-delivery-estimate] in root (snippets/delivery-estimate)
     * for `variant` ({price, available}; optional: the element's own
     * data-estimate-price is used otherwise). Free or paid standard delivery follows
     * the price against data-free-from; dates come from window().
     */
    updateEstimates: function (root, variant) {
      qsaSelf('[data-delivery-estimate]', root || doc).forEach(function (el) {
        if (variant && variant.price != null) el.setAttribute('data-estimate-price', String(variant.price));
        var price = Number(el.getAttribute('data-estimate-price')) || 0;
        var freeOn = el.getAttribute('data-free-enabled') !== 'false';
        var freeFrom = Number(el.getAttribute('data-free-from')) || 0;
        var free = freeOn && price >= freeFrom;
        var dated = el.getAttribute('data-dates') !== 'false';
        qsa('[data-delivery-line]', el).forEach(function (line) {
          var text = line.querySelector('[data-delivery-text]');
          if (!text) return;
          if (!dated) {
            /* No dates for this bed: the partner wording, free or not. */
            var tplNo = decodeEntities(el.getAttribute(free ? 'data-tpl-nodates-free' : 'data-tpl-nodates-paid') || '');
            if (tplNo) text.textContent = tplNo;
            return;
          }
          var w = L.delivery.window({
            dispatchMin: el.getAttribute('data-dispatch-min'),
            dispatchMax: el.getAttribute('data-dispatch-max'),
            transitMin: line.getAttribute('data-transit-min'),
            transitMax: line.getAttribute('data-transit-max'),
            sameDay: el.getAttribute('data-same-day') === 'true',
            rangeTemplate: decodeEntities(el.getAttribute('data-tpl-range') || '') || null
          });
          if (!w) return;
          var tpl = decodeEntities(line.getAttribute(free ? 'data-tpl-free' : 'data-tpl-paid') || '');
          if (!tpl) return;
          text.textContent = fill(tpl, { dates: w.text, price: decodeEntities(line.getAttribute('data-cost') || '') });
        });
        el.setAttribute('data-filled', 'true');
      });
    }
  };

  /* England & Wales bank holidays, 2026 and 2027 (gov.uk). Saturdays and
     Sundays are skipped anyway. EXTEND THIS LIST AFTER 2027: once the last
     date here has passed, the dates shown stop skipping bank holidays
     (Theme settings → holiday_dates can carry the next ones meanwhile). */
  var BANK_HOLIDAYS = ['2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28'];

  function closedDays() {
    var map = {};
    BANK_HOLIDAYS.forEach(function (d) { map[d] = true; });
    var extra = (L.settings && Array.isArray(L.settings.holidays)) ? L.settings.holidays : [];
    extra.forEach(function (h) {
      var d = String(h).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) map[d] = true;
    });
    return map;
  }

  function isWorkingDay(date) {
    var wd = date.getUTCDay();
    return wd >= 1 && wd <= 5 && !closedDays()[ymd(date)];
  }

  /** n working days after `from` (n = 0: `from` itself, or the next working day). */
  function addWorkingDays(from, n) {
    var date = from;
    var guard = 0;
    if (n <= 0) {
      while (!isWorkingDay(date) && guard < 60) {
        date = addDays(date, 1);
        guard += 1;
      }
      return date;
    }
    var added = 0;
    while (added < n && guard < 240) {
      date = addDays(date, 1);
      guard += 1;
      if (isWorkingDay(date)) added += 1;
    }
    return date;
  }

  var entityBox = null;
  function decodeEntities(s) {
    s = String(s || '');
    if (s.indexOf('&') === -1) return s;
    entityBox = entityBox || doc.createElement('textarea');
    entityBox.innerHTML = s;
    return entityBox.value;
  }

  var countdownTimer = null;
  function tickCountdowns() {
    var els = qsa('[data-countdown]');
    if (!els.length) {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      return;
    }
    var est = L.delivery.estimate();
    els.forEach(function (el) {
      L.delivery.render(el, est);
    });
  }

  function initCountdowns() {
    if (!qsa('[data-countdown]').length) return;
    tickCountdowns();
    if (!countdownTimer) countdownTimer = setInterval(tickCountdowns, 30000);
  }

  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'visible') tickCountdowns();
  });

  /* ------------------------------------------------------------------------
     Offer — Theme settings → Offer (snippets/offer.liquid renders it; this
     keeps it honest while the page is open). Lunova.settings.offer carries
     Liquid's verdict, amount and minimum (pence), the end (endsAt, worked out
     in <head>) and the basket: {applied, subtotal}, kept in step with every
     lunova:cart:updated. "applied" means Shopify itself has taken the
     discount off the basket (a cart-level discount application whose title
     contains the offer's name), so nothing here ever promises a discount
     the basket isn't getting.
     ---------------------------------------------------------------------- */
  function offerCfg() {
    return (L.settings && L.settings.offer) || null;
  }

  function offerAppliedIn(cart) {
    var o = offerCfg();
    var name = o && o.label ? String(o.label).toLowerCase() : '';
    return ((cart && cart.cart_level_discount_applications) || []).some(function (d) {
      var title = String((d && d.title) || '').toLowerCase();
      return Number(d && d.total_allocated_amount) > 0 && (!name || title.indexOf(name) > -1);
    });
  }

  /** Another discount on this basket: the live offer combines with none
      (snippets/offer), so with one in play nothing promises it. Any other
      discount (basket or line level), an applicable code, or Google's
      automated-discount price kept in the _gad cart attribute. */
  function offerOtherIn(cart) {
    var o = offerCfg();
    var name = o && o.label ? String(o.label).toLowerCase() : '';
    if (!cart || offerAppliedIn(cart)) return false;
    var other = function (app, amount) {
      var title = String((app && app.title) || '').toLowerCase();
      return Number(amount) > 0 && !!name && title.indexOf(name) === -1;
    };
    var apps = (cart.cart_level_discount_applications || []).some(function (d) { return other(d, d && d.total_allocated_amount); });
    var lines = (cart.items || []).some(function (it) {
      return (it.line_level_discount_allocations || []).some(function (a) { return other(a && a.discount_application, a && a.amount); });
    });
    var codes = (cart.discount_codes || []).some(function (c) { return c && c.applicable; });
    var gad = !!(cart.attributes && cart.attributes._gad);
    return apps || lines || codes || gad;
  }

  function offerClasses(basket) {
    root.classList.toggle('offer-applied', !!basket.applied);
    root.classList.toggle('offer-other', !basket.applied && !!basket.other);
  }

  L.offer = {
    active: function (now) {
      var o = offerCfg();
      if (!o || !o.active || !(Number(o.amount) > 0)) return false;
      if (o.ends && !o.endsAt) return false;
      if (o.endsAt && (now || Date.now()) >= o.endsAt) return false;
      return true;
    },
    basket: function () {
      var o = offerCfg();
      return (o && o.basket) || { applied: false, subtotal: 0 };
    },
    appliedIn: offerAppliedIn,
    otherIn: offerOtherIn,
    /**
     * What to say for an item at `price` (pence, × quantity):
     *   off      no offer running
     *   applied  the basket already has it (one per order)
     *   none     another discount is in play (they don't combine), or the
     *            basket is over the minimum without it: settings don't match
     *            the real discount, so say nothing
     *   line     this item reaches the minimum on its own
     *   basket   this plus the basket reaches it
     *   below    neither (a bigger size might: the caller decides)
     */
    state: function (price, productId) {
      var o = offerCfg();
      if (!L.offer.active()) return 'off';
      var b = L.offer.basket();
      var min = Number(o.min) || 0;
      var sub = Number(b.subtotal) || 0;
      if (b.applied) return 'applied';
      if (b.other) return 'none';
      if (sub > 0 && sub >= min) return 'none';
      if (price >= min) return 'line';
      // Not for a bed already in the basket: that would read as "buy two".
      var inBasket = productId != null && (b.products || []).map(Number).indexOf(Number(productId)) > -1;
      if (sub > 0 && sub + price >= min && !inBasket) return 'basket';
      return 'below';
    },
    net: function (price) {
      var o = offerCfg();
      return Math.max(0, Number(price) - (o ? Number(o.amount) || 0 : 0));
    },
    /**
     * Lunova.offer.update(root, priceCents, opts?) → 'line' | 'none'
     * Shows or hides every [data-offer-size] line in root (snippets/offer,
     * mode pdp: "£15 off this size at checkout, until Sat 31 Oct") for the
     * size now picked. It shows only when that price reaches the minimum on
     * its own and the basket can still get the offer (state() === 'line');
     * any other size hides it. opts.available === false (a sold-out size)
     * hides it too. Call it on every size change; global.js also does so on
     * lunova:variant:change and again whenever the basket or the offer
     * changes (lunova:offer:change), from each line's data-offer-price.
     */
    update: function (root, price, opts) {
      opts = opts || {};
      var result = 'none';
      qsaSelf('[data-offer-size]', root || doc).forEach(function (el) {
        var cents = price == null ? Number(el.getAttribute('data-offer-price')) || 0 : Number(price) || 0;
        var available = opts.available == null ? el.getAttribute('data-available') !== 'false' : opts.available !== false;
        el.setAttribute('data-offer-price', String(cents));
        el.setAttribute('data-available', available ? 'true' : 'false');
        var show = available && L.offer.state(cents, el.getAttribute('data-product-id')) === 'line';
        el.hidden = !show;
        el.setAttribute('data-state', show ? 'line' : 'none');
        if (show) result = 'line';
      });
      return result;
    },
    /** "ends in 1d 4h" for the final 72 hours, else null */
    countdownText: function (now) {
      var o = offerCfg();
      if (!o || !o.countdown || !o.endsAt) return null;
      var left = o.endsAt - (now || Date.now());
      if (left <= 0 || left > 72 * 3600000) return null;
      var mins = Math.max(1, Math.floor(left / 60000));
      var d = Math.floor(mins / 1440);
      var h = Math.floor((mins % 1440) / 60);
      var m = mins % 60;
      var time = d > 0
        ? fill(str('offerTimeDh', '[days]d [hours]h'), { days: d, hours: h })
        : h > 0
          ? fill(str('offerTimeHm', '[hours]h [minutes]m'), { hours: h, minutes: m })
          : fill(str('offerTimeM', '[minutes]m'), { minutes: m });
      return fill(str('offerEndsIn', 'ends in [time]'), { time: time });
    }
  };

  var offerTimer = null;
  function tickOffer() {
    var o = offerCfg();
    if (!o) return;
    if (!L.offer.active()) {
      if (!root.classList.contains('offer-ended')) {
        root.classList.add('offer-ended');
        L.emit('lunova:offer:change', { ended: true });
      }
      if (offerTimer) {
        clearInterval(offerTimer);
        offerTimer = null;
      }
      return;
    }
    var text = L.offer.countdownText();
    qsa('[data-offer-ends]').forEach(function (el) {
      if (!el.hasAttribute('data-date-text')) el.setAttribute('data-date-text', el.textContent);
      var dateText = el.getAttribute('data-date-text');
      if (!text) {
        el.textContent = dateText;
        return;
      }
      // Keep the separator a slide may start with ("· ends Sat 31 Oct").
      var lead = /^\s*·\s*/.exec(dateText);
      el.textContent = (lead ? lead[0] : '') + text;
    });
  }

  function initOffer() {
    var o = offerCfg();
    if (!o || !o.active) return;
    tickOffer();
    // Every minute while the page is open: the end (and the last-72-hours
    // countdown when it's on) can't slip past an open tab.
    if (!offerTimer && L.offer.active()) offerTimer = setInterval(tickOffer, 60000);
  }

  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'visible') tickOffer();
  });

  function offerBasketFrom(cart) {
    var o = offerCfg();
    if (!o || !cart || typeof cart !== 'object' || !('items_subtotal_price' in cart)) return;
    o.basket = {
      applied: offerAppliedIn(cart),
      // A Google price seen on landing (?pv2=, theme.liquid) stays in play.
      other: offerOtherIn(cart) || (!!o.basket && !!o.basket.other && /[?&]pv2=/.test(location.search)),
      subtotal: Number(cart.items_subtotal_price) || 0,
      products: (cart.items || []).map(function (it) { return Number(it.product_id); })
    };
    offerClasses(o.basket);
    L.emit('lunova:offer:change', { basket: o.basket });
  }

  L.on('lunova:cart:updated', function (e) {
    offerBasketFrom(e && e.detail && e.detail.cart);
  });

  // Back/forward cache: the page can come back with an older basket than
  // the one the offer was worked out for (one per order, other discounts).
  window.addEventListener('pageshow', function (e) {
    var o = offerCfg();
    if (!e.persisted || !o || !o.active || typeof L.cart !== 'object' || typeof L.cart.get !== 'function') return;
    L.cart.get().then(offerBasketFrom).catch(function () {});
  });

  /* ------------------------------------------------------------------------
     Per-night reframe: price ÷ nights over the foam guarantee, honest
     rounding. Nights = years × 365¼ (5 years = 1,826), the same sum as
     snippets/per-night. Callers only show it for a product Lunova.foamBed()
     covers.
     ---------------------------------------------------------------------- */
  function guaranteeNights() {
    var years = Number((L.settings || {}).guaranteeYears) || 0;
    return years > 0 ? Math.floor((years * 1461) / 4) : 0;
  }
  L.guaranteeNights = guaranteeNights;

  /** "8p" (whole pence) / "£1.12"; null when switched off or not computable. */
  L.perNight = function (cents) {
    var s = L.settings || {};
    var nights = guaranteeNights();
    var value = Number(cents);
    if (!s.perNight || nights <= 0 || !(value > 0)) return null;
    var pence = Math.floor((value * 2 + nights) / (2 * nights));
    if (pence < 1) pence = 1;
    return pence < 100 ? fill(str('pence', '[amount]p'), { amount: pence }) : L.money(pence);
  };

  /**
   * Does the foam guarantee cover this product? The same test as
   * snippets/foam-bed.liquid (keep the two in step):
   *   1. a precomputed verdict: `foam` true/false (the finder's product JSON
   *      carries the Liquid snippet's answer, so the two can't disagree);
   *   2. the product's custom.foam_guarantee metafield, when the object
   *      carries it (`foam_guarantee` / `foamGuarantee` true/false) decides;
   *   3. a core type that isn't memory foam (`core_type` / `coreType`,
   *      e.g. "Egg-crate foam") → never;
   *   4. tag guarantee:no → never (wins); tag guarantee:yes → always;
   *   5. not a bed → never: the type's first part (before " > ") doesn't
   *      mention "bed" ("Dog Houses > …"), or it's a car seat;
   *   6. its description (`description` or `body_html`) contains
   *      "no-flatten guarantee".
   * Anything else → not covered. /products/x.js data has no metafields, so
   * prefer the finder JSON verdict where there is one. Gate per-night
   * figures and guarantee lines on this.
   */
  L.foamBed = function (product) {
    if (!product) return false;
    if (typeof product.foam === 'boolean') return product.foam;
    var fg = product.foam_guarantee != null ? product.foam_guarantee : product.foamGuarantee;
    if (fg && typeof fg === 'object' && 'value' in fg) fg = fg.value;
    if (fg === true || fg === 'true') return true;
    if (fg === false || fg === 'false') return false;
    var core = product.core_type != null ? product.core_type : product.coreType;
    if (core && typeof core === 'object' && 'value' in core) core = core.value;
    core = String(core || '').trim().toLowerCase();
    if (core && core.indexOf('memory foam') === -1) return false;
    var tags = product.tags || [];
    if (typeof tags === 'string') tags = tags.split(',');
    tags = tags.map(function (t) { return String(t).trim().toLowerCase(); });
    if (tags.indexOf('guarantee:no') !== -1) return false;
    if (tags.indexOf('guarantee:yes') !== -1) return true;
    var type = String(product.type || product.product_type || '').toLowerCase().trim();
    var first = type.split('>')[0].trim();
    if (first && first.indexOf('bed') === -1) return false;
    var title = String(product.title || '').toLowerCase();
    if (tags.indexOf('dog car seat') !== -1 || tags.indexOf('car seat') !== -1 || title.indexOf('car seat') !== -1) return false;
    var desc = String(product.description || product.body_html || '').toLowerCase();
    return desc.indexOf('no-flatten guarantee') !== -1 || desc.indexOf('no flatten guarantee') !== -1;
  };
  L.guaranteeEligible = L.foamBed;

  /**
   * Does the sleep trial cover this product? Same test as
   * snippets/trial-eligible.liquid: the trial is on, and the product isn't
   * tagged trial:no, its type doesn't contain a line of
   * Lunova.settings.trialExcluded and none of its tags equals one; trial:yes
   * includes it whatever the list says (trial:no still wins).
   * Takes /products/x.js data ({type, tags}), the finder's product JSON
   * (whose `trial` true/false is snippets/trial-eligible's verdict), or a
   * cart line ({product_type}; cart lines carry no tags, so only the type
   * is checked there).
   */
  L.trialEligible = function (product) {
    var s = L.settings || {};
    if (s.trialEnabled === false || !(Number(s.trialNights) > 0)) return false;
    if (!product) return true;
    /* The finder's product JSON carries the Liquid snippet's own answer. */
    if (typeof product.trial === 'boolean') return product.trial;
    var tags = product.tags || [];
    if (typeof tags === 'string') tags = tags.split(',');
    tags = tags.map(function (t) { return String(t).trim().toLowerCase(); });
    if (tags.indexOf('trial:no') !== -1) return false;
    if (tags.indexOf('trial:yes') !== -1) return true;
    var type = String(product.type || product.product_type || '').toLowerCase();
    var lines = Array.isArray(s.trialExcluded) ? s.trialExcluded : [];
    for (var i = 0; i < lines.length; i += 1) {
      var l = String(lines[i] || '').trim().toLowerCase();
      if (!l) continue;
      if (type.indexOf(l) !== -1 || tags.indexOf(l) !== -1) return false;
    }
    return true;
  };

  /** Exact figure for the basis line: "8.16p" / "£1.12" */
  L.perNightExact = function (cents) {
    var nights = guaranteeNights();
    var value = Number(cents);
    if (nights <= 0 || !(value > 0)) return null;
    var hundredths = Math.floor((value * 200 + nights) / (2 * nights));
    return hundredths < 10000
      ? fill(str('pence', '[amount]p'), { amount: (hundredths / 100).toFixed(2) })
      : L.money(Math.floor((value * 2 + nights) / (2 * nights)));
  };

  function updatePerNight(scope, cents) {
    qsa('[data-per-night]', scope).forEach(function (el) {
      var amount = L.perNight(cents);
      if (!amount) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.setAttribute('data-price', String(cents));
      var amountEl = el.querySelector('[data-per-night-amount]');
      if (amountEl) amountEl.textContent = amount;
      var basisEl = el.querySelector('[data-per-night-basis]');
      var tpl = el.getAttribute('data-basis-template');
      if (basisEl && tpl) {
        basisEl.textContent = fill(tpl, { price: L.money(cents), exact: L.perNightExact(cents) });
      }
    });
  }
  L.updatePerNight = updatePerNight;

  /* Product area emits lunova:variant:change {sectionId, variant}; keep the
     per-night line and dispatch countdown in that section in step. */
  function variantScope(sectionId) {
    if (!sectionId) return null;
    var scope = doc.getElementById('shopify-section-' + sectionId);
    if (scope) return scope;
    var el = doc.querySelector('[data-section-id="' + String(sectionId).replace(/"/g, '') + '"]');
    return el ? el.closest('[data-product-scope], [data-quick-add-product], .shopify-section') || el : null;
  }

  L.on('lunova:variant:change', function (e) {
    var d = e.detail || {};
    var scope = variantScope(d.sectionId);
    if (!scope) return;
    var v = d.variant;
    if (v && v.price != null) updatePerNight(scope, v.price);
    if (v && v.price != null) L.offer.update(scope, v.price, { available: v.available !== false });
    if (v) L.delivery.updateEstimates(scope, v);
    qsa('[data-countdown]', scope).forEach(function (el) {
      if (v && v.available === false) el.setAttribute('data-unavailable', '');
      else el.removeAttribute('data-unavailable');
      L.delivery.render(el);
    });
  });

  /* The basket or the offer changed (one per order, another discount, the
     end passing): re-check every "£15 off this size" line at its own price. */
  L.on('lunova:offer:change', function () {
    L.offer.update(doc);
  });

  /* ------------------------------------------------------------------------
     Sizes — one parser for every size option value, the same rules and
     tables as snippets/size-hints.liquid (keep the two in step):

     Lunova.sizeParse(value) → {value, label, detail, rank, kind, length}
       "Large · 91 × 69 × 24cm" → label "Large", detail "91 × 69 × 24cm",
       rank 5, kind 'size', length 91. Splits at the first ' · ', ':', ' (',
       ' / ', ' – ', ' — ' or ' - '. Rank XXS 1 … M 4, L 5, XL 6, XXL 7, 3XL 8;
       "Extra Large" ranks as XL; One size / Default Title → rank 0, kind
       'one'; anything else rank -1, kind 'other'. Breed lists in the detail
       come back comma separated.
     Lunova.sizeHintIndex(value, hints?) → index of the size-hint line the
       value suits, or -1: whole value = VALUE/Label → breed vote → bed
       length against each line's minimum length → label (same VALUE/Label,
       same rank, XXL/3XL into the largest) → first word.
     Lunova.sizeHint(value) → that line ({value,label,weight,breeds}) or null.
     Lunova.sizeLabel(value) → the size's display name: "Medium" for "M",
       "Large" for "Large: Cocker Spaniel | …" (never another size's name).
     Lunova.sizeMatch(values, want) → {value, index, kind: 'exact'|'larger'}
       for a dog of size `want` (a hint VALUE such as the finder's "XL"):
       the first value that suits it, else the smallest larger one; or null.
     Lunova.sizeMin(want) → the shortest bed (cm) for that dog, or null.
     ---------------------------------------------------------------------- */
  var SIZE_SEPS = [' · ', ':', ' (', ' / ', ' – ', ' — ', ' - '];
  var SIZE_RANKS = {
    xxs: 1, 'xx small': 1, '2xs': 1, 'extra extra small': 1,
    xs: 2, 'x small': 2, xsmall: 2, 'extra small': 2,
    s: 3, sm: 3, small: 3,
    m: 4, med: 4, medium: 4,
    l: 5, lg: 5, large: 5,
    xl: 6, 'x large': 6, xlarge: 6, 'extra large': 6,
    xxl: 7, '2xl': 7, 'xx large': 7, xxlarge: 7, 'extra extra large': 7,
    '3xl': 8, xxxl: 8, 'xxx large': 8,
    '4xl': 9, xxxxl: 9,
    '5xl': 10,
    'one size': 0, onesize: 0, 'one size fits all': 0, 'default title': 0, os: 0
  };
  /* Shortest bed (cm) for each rank, unless a hint line gives its own 5th field. */
  var SIZE_MIN_LENGTH = { 1: 0, 2: 0, 3: 55, 4: 70, 5: 85, 6: 105, 7: 125, 8: 140, 9: 155, 10: 170 };

  function sizeKey(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/-/g, ' ').replace(/  /g, ' ').trim();
  }

  function sizeRankOf(label) {
    var k = sizeKey(label).replace(/\./g, '');
    return Object.prototype.hasOwnProperty.call(SIZE_RANKS, k) ? SIZE_RANKS[k] : -1;
  }

  /** "91 × 69 × 24cm" → 91 (cm): the longer of the first two measurements. */
  function sizeLength(src) {
    var d = String(src || '').toLowerCase().replace(/×/g, 'x').replace(/ /g, '');
    d = d.split('/')[0].split(',')[0];
    if (d.indexOf('x') < 0) return -1;
    var parts = d.split('x');
    function num(p) {
      p = String(p || '').replace(/cm|mm|in|"|\(|\)/g, '');
      return /^[0-9.]+$/.test(p) && !isNaN(parseFloat(p)) ? parseFloat(p) : NaN;
    }
    var a = num(parts[0]);
    var b = num(parts[1]);
    if (isNaN(a) || isNaN(b)) return -1;
    var len = Math.max(a, b);
    if (d.indexOf('mm') > -1) len = len / 10;
    else if (d.indexOf('in') > -1 || d.indexOf('"') > -1) len = len * 2.54;
    return len;
  }

  L.sizeParse = function (value) {
    var raw = String(value == null ? '' : value).trim();
    var at = -1;
    var sep = '';
    SIZE_SEPS.forEach(function (s) {
      var i = raw.indexOf(s);
      if (i > 0 && (at < 0 || i < at)) {
        at = i;
        sep = s;
      }
    });
    var label = raw;
    var detail = '';
    if (at > 0) {
      label = raw.slice(0, at).trim();
      detail = raw.slice(at + sep.length).trim();
      if (sep === ' (' && detail.slice(-1) === ')') detail = detail.slice(0, -1).trim();
      detail = detail.split(' | ').join(', ').split('|').join(', ');
    }
    var rank = sizeRankOf(label);
    var len = sizeLength(detail);
    if (len < 0) len = sizeLength(label);
    return {
      value: raw,
      label: label,
      detail: detail,
      rank: rank,
      kind: rank > 0 ? 'size' : rank === 0 ? 'one' : 'other',
      length: len >= 0 ? len : null
    };
  };

  function sizeHintList(list) {
    if (Array.isArray(list)) return list;
    return L.settings && Array.isArray(L.settings.sizeHints) ? L.settings.sizeHints : [];
  }

  L.sizeHintIndex = function (value, list) {
    var hints = sizeHintList(list);
    var p = L.sizeParse(value);
    if (!p.value || !hints.length) return -1;
    var whole = sizeKey(p.value);
    var labelQ = sizeKey(p.label).replace(/\./g, '');
    var vBreeds = p.detail ? sizeKey(p.detail).split(',') : [];

    var hit = -1;
    var breed = { i: -1, n: 0, lm: false };
    var dims = { i: -1, min: -1, lines: 0 };
    var lHit = -1;
    var rHit = -1;
    var rMax = { i: -1, rank: -1 };
    var rMin = { i: -1, rank: 99 };

    hints.forEach(function (h, i) {
      h = h || {};
      var v = sizeKey(h.value);
      var lbl = sizeKey(h.label);
      if (!v) return;
      if (hit < 0 && whole && (whole === v || whole === lbl)) hit = i;

      var hRank = sizeRankOf(v);
      if (hRank < 0 && lbl) hRank = sizeRankOf(lbl);
      var labelMatch = !!labelQ && (labelQ === v || labelQ === lbl || (p.rank > 0 && hRank === p.rank));

      /* Breed vote */
      var hb = sizeKey(h.breeds);
      if (p.detail && hb) {
        var hList = hb.split(',');
        var votes = 0;
        vBreeds.forEach(function (b) {
          b = b.replace(/  /g, ' ').trim();
          if (!b) return;
          var bw = ' ' + b + ' ';
          for (var k = 0; k < hList.length; k += 1) {
            var x = hList[k].replace(/  /g, ' ').trim();
            if (!x) continue;
            var xw = ' ' + x + ' ';
            if (bw.indexOf(xw) > -1 || xw.indexOf(bw) > -1) {
              votes += 1;
              break;
            }
          }
        });
        if (votes > 0) {
          if (votes > breed.n) breed = { i: i, n: votes, lm: labelMatch };
          else if (votes === breed.n && !breed.lm) breed = { i: i, n: votes, lm: labelMatch };
        }
      }

      /* Minimum length: the line's own (5th field), else by rank */
      var min = h.min != null && h.min !== '' && !isNaN(Number(h.min)) ? Number(h.min) : hRank > 0 ? SIZE_MIN_LENGTH[hRank] : null;
      if (min != null) {
        dims.lines += 1;
        if (p.length != null && min <= p.length && min > dims.min) {
          dims.i = i;
          dims.min = min;
        }
      }

      if (lHit < 0 && labelQ && (labelQ === v || labelQ === lbl)) lHit = i;
      if (hRank > 0) {
        if (rHit < 0 && p.rank > 0 && hRank === p.rank) rHit = i;
        if (hRank > rMax.rank) rMax = { i: i, rank: hRank };
        if (hRank < rMin.rank) rMin = { i: i, rank: hRank };
      }
    });

    if (hit < 0 && breed.i > -1) hit = breed.i;
    if (hit < 0 && dims.i > -1 && dims.lines > 1) hit = dims.i;
    if (hit < 0 && lHit > -1) hit = lHit;
    if (hit < 0 && rHit > -1) hit = rHit;
    if (hit < 0 && p.rank > 0 && rMax.i > -1 && p.rank > rMax.rank) hit = rMax.i;
    if (hit < 0 && p.rank > 0 && rMin.i > -1 && p.rank < rMin.rank) hit = rMin.i;

    /* First word ("Medium dog bed") */
    if (hit < 0) {
      var fw = p.value.toLowerCase().split(' ')[0].split('/')[0].split('(')[0].split(':')[0].trim();
      if (fw) {
        var fwRank = Object.prototype.hasOwnProperty.call(SIZE_RANKS, fw) ? SIZE_RANKS[fw] : -1;
        for (var j = 0; j < hints.length && hit < 0; j += 1) {
          var hv = sizeKey((hints[j] || {}).value);
          if (!hv) continue;
          var hl = sizeKey((hints[j] || {}).label);
          var hr = Object.prototype.hasOwnProperty.call(SIZE_RANKS, hv.replace(/\./g, '')) ? SIZE_RANKS[hv.replace(/\./g, '')] : -1;
          if (fw === hv || fw === hl || (fwRank > 0 && fwRank === hr)) hit = j;
        }
      }
    }
    return hit;
  };

  L.sizeHint = function (value) {
    var hints = sizeHintList();
    var i = L.sizeHintIndex(value, hints);
    return i > -1 ? hints[i] : null;
  };

  L.sizeLabel = function (value) {
    var p = L.sizeParse(value);
    var q = sizeKey(p.label).replace(/\./g, '');
    var hints = sizeHintList();
    for (var i = 0; i < hints.length; i += 1) {
      var h = hints[i] || {};
      if (q && sizeKey(h.value) === q && h.label) return String(h.label).trim();
    }
    return p.label;
  };

  L.sizeMatch = function (values, want) {
    var hints = sizeHintList();
    var w = typeof want === 'number' ? want : L.sizeHintIndex(want, hints);
    if (w < 0 || !Array.isArray(values)) return null;
    var best = null;
    for (var i = 0; i < values.length; i += 1) {
      var idx = L.sizeHintIndex(values[i], hints);
      if (idx === w) return { value: values[i], index: idx, kind: 'exact' };
      if (idx > w && (!best || idx < best.index)) best = { value: values[i], index: idx, kind: 'larger' };
    }
    return best;
  };

  /**
   * The shortest bed (cm) for the dog of size-hint line `want` (its index, or
   * a value such as "L"): the line's own 5th field, else SIZE_MIN_LENGTH for
   * its rank; null when unknown. The same minimum sizeHintIndex reads.
   */
  L.sizeMin = function (want) {
    var hints = sizeHintList();
    var i = typeof want === 'number' ? want : L.sizeHintIndex(want, hints);
    var h = i > -1 && i < hints.length ? hints[i] || {} : null;
    if (!h) return null;
    if (h.min != null && h.min !== '' && !isNaN(Number(h.min))) return Number(h.min);
    var r = sizeRankOf(h.value);
    if (r < 0 && h.label) r = sizeRankOf(h.label);
    return r > 0 && SIZE_MIN_LENGTH[r] != null ? SIZE_MIN_LENGTH[r] : null;
  };

  /* ------------------------------------------------------------------------
     <slider-row> — optional prev/next, keyboard, overflow detection
     ---------------------------------------------------------------------- */
  if (!customElements.get('slider-row')) {
    customElements.define(
      'slider-row',
      class SliderRow extends HTMLElement {
        connectedCallback() {
          this.track = this.querySelector('[data-slider-track]') || this.querySelector('.slider-row') || this;
          this.prevButtons = qsa('[data-slider-prev]', this);
          this.nextButtons = qsa('[data-slider-next]', this);
          if (this.id) {
            this.prevButtons = this.prevButtons.concat(qsa('[data-slider-for="' + this.id + '"] [data-slider-prev], [data-slider-prev][data-slider-for="' + this.id + '"]'));
            this.nextButtons = this.nextButtons.concat(qsa('[data-slider-for="' + this.id + '"] [data-slider-next], [data-slider-next][data-slider-for="' + this.id + '"]'));
          }

          /* The track is a tab stop only while it actually scrolls (see
             update()); a desktop grid that fits needs no extra stop. Leave
             any tabindex the markup set alone. */
          if (this._autoTabindex === undefined) {
            this._autoTabindex = this.track !== this && !this.track.hasAttribute('tabindex');
          }

          this._onScroll = L.debounce(this.update.bind(this), 60);
          this._onPrev = this.go.bind(this, -1);
          this._onNext = this.go.bind(this, 1);
          this._onKey = this.onKey.bind(this);

          this.track.addEventListener('scroll', this._onScroll, { passive: true });
          this.track.addEventListener('keydown', this._onKey);
          this.prevButtons.forEach(function (b) { b.addEventListener('click', this._onPrev); }, this);
          this.nextButtons.forEach(function (b) { b.addEventListener('click', this._onNext); }, this);

          if ('ResizeObserver' in window) {
            this._ro = new ResizeObserver(this._onScroll);
            this._ro.observe(this.track);
          }
          this.update();
        }

        disconnectedCallback() {
          if (!this.track) return;
          this.track.removeEventListener('scroll', this._onScroll);
          this.track.removeEventListener('keydown', this._onKey);
          this.prevButtons.forEach(function (b) { b.removeEventListener('click', this._onPrev); }, this);
          this.nextButtons.forEach(function (b) { b.removeEventListener('click', this._onNext); }, this);
          if (this._ro) this._ro.disconnect();
        }

        items() {
          return Array.prototype.slice.call(this.track.children).filter(function (c) {
            return c.offsetParent !== null || c.getClientRects().length;
          });
        }

        step() {
          var items = this.items();
          if (items.length > 1) return Math.abs(items[1].offsetLeft - items[0].offsetLeft) || this.track.clientWidth;
          return this.track.clientWidth;
        }

        go(direction) {
          var perView = Math.max(1, Math.floor((this.track.clientWidth + 1) / this.step()));
          var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('no-motion');
          this.track.scrollBy({ left: direction * this.step() * perView * (root.dir === 'rtl' ? -1 : 1), behavior: reduce ? 'auto' : 'smooth' });
        }

        scrollToItem(el) {
          if (!el || !this.track.contains(el)) return;
          this.track.scrollTo({ left: el.offsetLeft - this.track.offsetLeft - parseFloat(getComputedStyle(this.track).scrollPaddingLeft || 0), behavior: 'auto' });
        }

        onKey(e) {
          if (e.target !== this.track) return;
          var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            var dir = e.key === 'ArrowRight' ? 1 : -1;
            if (root.dir === 'rtl') dir *= -1;
            this.track.scrollBy({ left: dir * this.step(), behavior: reduce ? 'auto' : 'smooth' });
          } else if (e.key === 'Home') {
            e.preventDefault();
            this.track.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
          } else if (e.key === 'End') {
            e.preventDefault();
            this.track.scrollTo({ left: this.track.scrollWidth, behavior: reduce ? 'auto' : 'smooth' });
          }
        }

        update() {
          var t = this.track;
          var max = t.scrollWidth - t.clientWidth;
          var overflowing = max > 2;
          this.toggleAttribute('data-overflowing', overflowing);
          if (this._autoTabindex && t.hasAttribute('tabindex') !== overflowing) {
            if (overflowing) t.setAttribute('tabindex', '0');
            else t.removeAttribute('tabindex');
          }
          var x = Math.abs(t.scrollLeft);
          this.prevButtons.forEach(function (b) { b.disabled = !overflowing || x <= 2; });
          this.nextButtons.forEach(function (b) { b.disabled = !overflowing || x >= max - 2; });
          this.toggleAttribute('data-at-start', x <= 2);
          this.toggleAttribute('data-at-end', x >= max - 2);
        }
      }
    );
  }

  /* ------------------------------------------------------------------------
     Scroll reveal
     ---------------------------------------------------------------------- */
  var revealObserver = null;
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('no-motion');
  }

  function markDone(el) {
    el.classList.add('reveal-done');
  }

  function initReveal(scope) {
    var els = qsa('[data-reveal]:not(.is-revealed)', scope);
    if (scope && scope.matches && scope.matches('[data-reveal]:not(.is-revealed)')) els.push(scope);
    if (!els.length) return;
    var designMode = !!(window.Shopify && window.Shopify.designMode) || L.designMode;
    if (designMode || prefersReducedMotion() || !('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.classList.add('is-revealed', 'reveal-done');
      });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            revealObserver.unobserve(el);
            el.classList.add('is-revealed');
            var done = function (ev) {
              if (ev && ev.target !== el) return;
              el.removeEventListener('transitionend', done);
              markDone(el);
            };
            el.addEventListener('transitionend', done);
            setTimeout(function () { markDone(el); }, 1600);
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
      );
    }
    /* Anything already on screen is shown as-is (no flash); only content
       below the fold is hidden, and only once it is being observed. Content
       nobody observes is never hidden. */
    var viewH = window.innerHeight || root.clientHeight;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < viewH && r.bottom > 0) {
        el.classList.add('is-revealed', 'reveal-done');
        return;
      }
      el.classList.add('reveal-pending');
      revealObserver.observe(el);
    });
  }

  /* ------------------------------------------------------------------------
     Header height → --header-h (sticky offsets, drawers under the header)
     Chrome should mark its sticky header with [data-site-header].
     ---------------------------------------------------------------------- */
  var headerObserver = null;
  function headerEl() {
    /* Chrome's <site-header> writes --header-h itself (it knows when the
       header hides on scroll), so only measure when it isn't there. */
    if (doc.querySelector('site-header')) return null;
    return doc.querySelector('[data-site-header]') || doc.querySelector('.shopify-section-group-header-group header') || null;
  }
  function setHeaderHeight() {
    var el = headerEl();
    if (!el) return;
    var h = Math.round(el.getBoundingClientRect().height);
    if (h > 0) root.style.setProperty('--header-h', h + 'px');
  }
  function initHeaderHeight() {
    setHeaderHeight();
    var el = headerEl();
    if (el && 'ResizeObserver' in window) {
      if (headerObserver) headerObserver.disconnect();
      headerObserver = new ResizeObserver(setHeaderHeight);
      headerObserver.observe(el);
    }
  }

  /* ------------------------------------------------------------------------
     Delegated clicks: open the finder, quick add
     ---------------------------------------------------------------------- */
  function finderAvailable() {
    return !!L.settings.finderEnabled && !!doc.querySelector('bed-finder');
  }

  /* finder.js and cart.js are deferred and load after this file, so an
     element can be in the DOM before it is defined (and listening). Run cb
     once it is defined; customElements.whenDefined resolves after the
     upgrade, so connectedCallback has already subscribed by then. */
  function whenDefined(tag, cb) {
    if (!window.customElements) return;
    if (customElements.get(tag)) cb();
    else customElements.whenDefined(tag).then(cb);
  }

  /** True when following this link would load another page (not just a #hash here). */
  function leavesPage(el) {
    if (!el.matches('a[href], area[href]')) return false;
    var href = el.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^\s*javascript:/i.test(href)) return false;
    try {
      var u = new URL(el.href, window.location.href);
      var here = window.location;
      return !(u.origin === here.origin && u.pathname === here.pathname && u.search === here.search);
    } catch (err) {
      return false;
    }
  }

  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    var opener = target.closest('[data-open-finder], a[href$="#bed-finder"]');
    if (opener && finderAvailable()) {
      /* finder.js not ready yet (or failed to load): a real link still works,
         so let it go to the finder page rather than swallowing the tap. */
      if (!customElements.get('bed-finder') && leavesPage(opener)) return;
      e.preventDefault();
      var detail = { trigger: opener };
      var step = opener.getAttribute('data-finder-step');
      if (step) detail.step = isNaN(Number(step)) ? step : Number(step);
      var answers = opener.getAttribute('data-finder-answers');
      if (answers) {
        try {
          detail.answers = JSON.parse(answers);
        } catch (err) {
          /* ignore malformed */
        }
      }
      /* A button tapped before finder.js arrives opens it once it can. */
      whenDefined('bed-finder', function () { L.emit('lunova:finder:open', detail); });
      return;
    }

    /* Only the card's own control, never a wrapper that merely carries a
       data-quick-add setting (e.g. <recently-viewed data-quick-add="true">).
       Until cart.js defines the drawer, the link simply goes to the product. */
    var quick = target.closest('a[data-quick-add], button[data-quick-add]');
    if (quick && doc.querySelector('quick-add-drawer') && customElements.get('quick-add-drawer')) {
      e.preventDefault();
      L.emit('lunova:quickadd:open', {
        handle: quick.getAttribute('data-handle'),
        url: quick.getAttribute('data-url') || quick.getAttribute('href'),
        trigger: quick
      });
    }
  });

  /* Single-variant quick add (product-card <form data-quick-add-single>).
     cart.js owns this; this window-level listener is only a safety net and
     runs solely when nothing earlier in the event path called preventDefault. */
  window.addEventListener('submit', function (e) {
    var form = e.target;
    if (e.defaultPrevented || !form || !form.matches || !form.matches('form[data-quick-add-single]')) return;
    if (!window.fetch) return;
    e.preventDefault();

    var button = form.querySelector('[type="submit"]');
    var errorEl = form.querySelector('[data-quick-add-error]');
    var data = new FormData(form);
    var id = parseInt(data.get('id'), 10);
    var quantity = parseInt(data.get('quantity'), 10) || 1;
    var hasDrawer = L.settings.cartType !== 'page' && !!doc.querySelector('cart-drawer') && L.template !== 'cart';

    if (button) {
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
    }
    if (errorEl) errorEl.hidden = true;

    L.cart
      .add([{ id: id, quantity: quantity }], { sections: hasDrawer ? 'cart-drawer' : null, source: 'quick-add' })
      .then(function (res) {
        if (!hasDrawer) {
          window.location.href = L.routes.cartUrl || '/cart';
          return;
        }
        L.emit('lunova:cart:open', { added: res.items && res.items[0], reason: 'add', sections: res.sections, cart: res.cart });
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.textContent = (err && err.description) || str('error', 'Something went wrong. Please try again.');
          errorEl.hidden = false;
        }
      })
      .then(function () {
        if (button) {
          button.removeAttribute('aria-busy');
          button.disabled = false;
        }
      });
  });

  /* ------------------------------------------------------------------------
     Injected content (recommendations, recently viewed, quick add, Section
     Rendering responses): personalise cards and start countdowns without
     the injecting code having to call anything. Batched per frame.
     ---------------------------------------------------------------------- */
  var PERSONAL = '[data-finder-match-handle], [data-finder-name], [data-finder-name-only]';
  var addedNodes = [];
  var flushScheduled = false;

  function flushAdded() {
    flushScheduled = false;
    var nodes = addedNodes;
    addedNodes = [];
    var est;
    nodes.forEach(function (node) {
      if (!node.isConnected || !node.querySelector) return;
      if (node.matches(PERSONAL) || node.querySelector(PERSONAL)) applyFinder(node);
      if (qsaSelf('[data-offer-ends]', node).length) tickOffer();
      if (qsaSelf('[data-delivery-estimate]', node).length) L.delivery.updateEstimates(node);
      if (qsaSelf('[data-offer-size]', node).length) L.offer.update(node);
      var countdowns = qsaSelf('[data-countdown]', node);
      if (countdowns.length) {
        if (est === undefined) est = L.delivery.estimate();
        countdowns.forEach(function (el) { L.delivery.render(el, est); });
        if (!countdownTimer) countdownTimer = setInterval(tickCountdowns, 30000);
      }
    });
  }

  if ('MutationObserver' in window) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i += 1) {
        var list = records[i].addedNodes;
        for (var j = 0; j < list.length; j += 1) {
          if (list[j].nodeType === 1) addedNodes.push(list[j]);
        }
      }
      if (addedNodes.length && !flushScheduled) {
        flushScheduled = true;
        window.requestAnimationFrame(flushAdded);
      }
    }).observe(doc.documentElement, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------------------------
     Init + theme editor re-init
     ---------------------------------------------------------------------- */
  function init(scope) {
    applyFinder(scope || doc);
    initReveal(scope || doc);
    initCountdowns();
    initOffer();
    L.delivery.updateEstimates(scope || doc);
  }

  /* On first load this runs before finder.js has defined <bed-finder>, so
     wait for it: email and ad links to …#bed-finder must open the finder. */
  function openFinderFromHash() {
    if (window.location.hash === '#bed-finder' && finderAvailable()) {
      whenDefined('bed-finder', function () {
        L.emit('lunova:finder:open', { reason: 'hash' });
      });
    }
  }

  function onReady() {
    init(doc);
    initHeaderHeight();
    openFinderFromHash();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', onReady);
  else onReady();

  window.addEventListener('hashchange', openFinderFromHash);

  L.on('lunova:finder:complete', function (e) {
    var result = e.detail && e.detail.result;
    var stored = L.finder.get();
    applyFinder(doc, stored || (result && typeof result === 'object' ? result : null));
  });

  window.addEventListener('storage', function (e) {
    if (e.key === FINDER_KEY) applyFinder(doc);
  });

  doc.addEventListener('shopify:section:load', function (e) {
    init(e.target);
    initHeaderHeight();
  });

  doc.addEventListener('shopify:block:select', function (e) {
    var block = e.target;
    var slider = block && block.closest && block.closest('slider-row');
    if (slider && typeof slider.scrollToItem === 'function') {
      var item = block;
      while (item && item.parentElement !== slider.track) item = item.parentElement;
      slider.scrollToItem(item || block);
    }
    if (block) qsa('[data-reveal]', block).concat(block.matches('[data-reveal]') ? [block] : []).forEach(function (el) {
      el.classList.add('is-revealed', 'reveal-done');
    });
  });

  L.init = init;
})();
