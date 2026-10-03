/*
 * Lunova — collection.js (area D)
 *
 *   <facet-filters>  storefront filtering + sorting + pagination through the
 *                    Section Rendering API (collection and search pages)
 *   <cart-items>     the basket page: quantity, remove, upsell, note,
 *                    personalisation and the phone sticky checkout bar
 *   description fold "Read more" for long collection descriptions
 *
 * Progressive enhancement throughout: every control is a real link or a
 * GET/POST form first, so with no JavaScript (or if a request fails) the
 * page simply navigates. Vanilla ES2019, no dependencies. Included by
 * main-collection, main-search and main-cart with `defer`; guarded so it
 * runs once however many sections include it.
 */
(function () {
  'use strict';

  if (window.__lunovaCollection) return;
  window.__lunovaCollection = true;

  var L = (window.Lunova = window.Lunova || {});
  var doc = document;
  var root = doc.documentElement;
  var DESKTOP = window.matchMedia('(min-width: 990px)');

  /* ---------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------- */
  function define(name, ctor) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  function focusEl(el) {
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      el.focus();
    }
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\\]]/g, '\\$&');
  }

  function reduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('no-motion');
  }

  function debounce(fn, ms) {
    var timer;
    var wrapped = function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
    wrapped.cancel = function () {
      clearTimeout(timer);
    };
    return wrapped;
  }

  function fill(template, vars) {
    return String(template || '').replace(/\[(\w+)\]/g, function (m, k) {
      return vars && vars[k] != null ? String(vars[k]) : m;
    });
  }

  /* Polite live region: clear, then set a tick later so it is re-announced. */
  function announce(el, text) {
    if (!el) return;
    el.textContent = '';
    setTimeout(function () {
      el.textContent = text || '';
    }, 80);
  }

  function onMedia(mql, fn) {
    if (mql.addEventListener) mql.addEventListener('change', fn);
    else if (mql.addListener) mql.addListener(fn);
    return function () {
      if (mql.removeEventListener) mql.removeEventListener('change', fn);
      else if (mql.removeListener) mql.removeListener(fn);
    };
  }

  function listen(name, fn) {
    if (typeof L.on === 'function') return L.on(name, fn);
    doc.addEventListener(name, fn);
    return function () {
      doc.removeEventListener(name, fn);
    };
  }

  function headerOffset() {
    var v = parseFloat(getComputedStyle(root).getPropertyValue('--header-h'));
    return isNaN(v) ? 0 : v;
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
    } else {
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
    }
  }

  function errorText(err, fallback) {
    if (err && typeof err.description === 'string' && err.description) return err.description;
    if (err && typeof err.message === 'string' && err.status) return err.message;
    return fallback || (L.strings && L.strings.error) || 'Something went wrong. Please try again.';
  }

  /* Swap every [attr="key"] inside `scope` for its counterpart in `fresh`. */
  function swapRegions(scope, fresh, attr) {
    qsa('[' + attr + ']', scope).forEach(function (el) {
      var key = el.getAttribute(attr);
      var next = fresh.querySelector('[' + attr + '="' + cssEscape(key) + '"]');
      if (next) el.replaceWith(doc.importNode(next, true));
    });
  }

  /* ---------------------------------------------------------------------
     <facet-filters>
     Section markup (main-collection / main-search + snippets/facets):
       [data-facets-open]        "Filter & sort" button(s)
       [data-facets-panel]       drawer on phones, sidebar/top bar on desktop
       [data-facets-form]        filter form (GET); sort select is inside
       [data-facets-sort-form]   desktop sort (or the only sort when no filters)
       [data-sort-select]        both sort selects, kept in step
       [data-facets-close]       close button, overlay, "Show n beds"
       [data-facets-link]        pills, "Clear all" → fetched, not followed
       [data-pagination-link]    pagination → fetched, scrolls to the top
       [data-swap="key"]         regions replaced from the fresh render
       [data-facets-live]        polite status: "12 beds"
     ------------------------------------------------------------------- */
  class FacetFilters extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.sectionId = this.getAttribute('data-section-id');
      this.cache = new Map();
      this.expanded = new Set();
      this.controller = null;
      this.drawerOpen = false;
      this.lastUrl = this.normaliseUrl(window.location.href);

      this._onChange = this.onChange.bind(this);
      this._onInput = this.onInput.bind(this);
      this._onSubmit = this.onSubmit.bind(this);
      this._onClick = this.onClick.bind(this);
      this._onKeydown = this.onKeydown.bind(this);
      this._onToggle = this.onToggle.bind(this);
      this._onPop = this.onPopState.bind(this);
      this._onDocClick = this.onDocClick.bind(this);

      this.addEventListener('change', this._onChange);
      this.addEventListener('input', this._onInput);
      this.addEventListener('submit', this._onSubmit);
      this.addEventListener('click', this._onClick);
      this.addEventListener('keydown', this._onKeydown);
      this.addEventListener('toggle', this._onToggle, true);
      window.addEventListener('popstate', this._onPop);
      doc.addEventListener('click', this._onDocClick);
      this._offMedia = onMedia(DESKTOP, this.onBreakpoint.bind(this));

      this.applySoon = debounce(this.applyFromForm.bind(this), 250);
      this.applyPrice = debounce(this.applyFromForm.bind(this), 900);

      try {
        var state = Object.assign({}, history.state || {}, { lunovaFacets: this.sectionId });
        history.replaceState(state, '', window.location.href);
      } catch (e) {
        /* history unavailable (sandboxed preview) */
      }
    }

    disconnectedCallback() {
      this.removeEventListener('change', this._onChange);
      this.removeEventListener('input', this._onInput);
      this.removeEventListener('submit', this._onSubmit);
      this.removeEventListener('click', this._onClick);
      this.removeEventListener('keydown', this._onKeydown);
      this.removeEventListener('toggle', this._onToggle, true);
      window.removeEventListener('popstate', this._onPop);
      doc.removeEventListener('click', this._onDocClick);
      if (this._offMedia) this._offMedia();
      if (this.controller) this.controller.abort();
      if (this.drawerOpen) this.closeDrawer({ returnFocus: false });
      this._ready = false;
    }

    get form() {
      return this.querySelector('[data-facets-form]');
    }

    get sortForm() {
      return this.querySelector('[data-facets-sort-form]');
    }

    get panel() {
      return this.querySelector('[data-facets-panel]');
    }

    get results() {
      return this.querySelector('[data-results]');
    }

    /* -- URLs ------------------------------------------------------------ */
    normaliseUrl(href) {
      var u = new URL(href, window.location.href);
      u.searchParams.delete('section_id');
      u.searchParams.delete('sections');
      u.hash = '';
      return u.pathname + u.search;
    }

    sectionUrl(url) {
      return url + (url.indexOf('?') > -1 ? '&' : '?') + 'section_id=' + encodeURIComponent(this.sectionId);
    }

    buildUrl() {
      var form = this.form || this.sortForm;
      if (!form) return this.lastUrl;
      var params = new URLSearchParams();
      var sortSelect = form.querySelector('[data-sort-select]');
      var sortDefault = sortSelect ? sortSelect.getAttribute('data-default') : null;
      new FormData(form).forEach(function (value, key) {
        if (typeof value !== 'string') return;
        var v = value.trim();
        if (v === '') return;
        // The default order needs no parameter: cleaner, shareable URLs.
        if (key === 'sort_by' && sortDefault && v === sortDefault) return;
        params.append(key, v);
      });
      var action = form.getAttribute('action') || window.location.pathname;
      var qs = params.toString();
      return this.normaliseUrl(action + (qs ? '?' + qs : ''));
    }

    /* Keep the price range sane: no negatives, min ≤ max, within range. */
    normalisePrice() {
      qsa('[data-price-range]', this).forEach(function (fs) {
        var minEl = fs.querySelector('[data-price-min]');
        var maxEl = fs.querySelector('[data-price-max]');
        var cap = parseFloat(fs.getAttribute('data-max'));
        function read(el) {
          if (!el) return null;
          var v = parseFloat(String(el.value).replace(',', '.'));
          return isNaN(v) ? null : Math.max(0, v);
        }
        var a = read(minEl);
        var b = read(maxEl);
        if (cap > 0) {
          if (a !== null && a > cap) a = cap;
          if (b !== null && b > cap) b = cap;
        }
        if (a !== null && b !== null && a > b) {
          var t = a;
          a = b;
          b = t;
        }
        if (minEl && minEl.value !== (a === null ? '' : String(a))) minEl.value = a === null ? '' : String(a);
        if (maxEl && maxEl.value !== (b === null ? '' : String(b))) maxEl.value = b === null ? '' : String(b);
      });
    }

    /* -- events ---------------------------------------------------------- */
    onChange(e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      if (t.matches('[data-sort-select]')) {
        this.syncSort(t);
        this.applySoon.cancel();
        this.applyFromForm();
        return;
      }
      if (t.matches('[data-price-min], [data-price-max]')) {
        this.applyPrice.cancel();
        this.applyFromForm();
        return;
      }
      if (t.type === 'checkbox' && this.form && this.form.contains(t)) {
        this.applySoon();
      }
    }

    onInput(e) {
      var t = e.target;
      if (t instanceof Element && t.matches('[data-price-min], [data-price-max]')) this.applyPrice();
    }

    onSubmit(e) {
      var form = e.target;
      if (form !== this.form && form !== this.sortForm) return;
      e.preventDefault();
      this.applySoon.cancel();
      this.applyPrice.cancel();
      this.applyFromForm();
    }

    onClick(e) {
      var t = e.target instanceof Element ? e.target : null;
      if (!t) return;

      if (t.closest('[data-facets-open]')) {
        e.preventDefault();
        this.openDrawer(t.closest('[data-facets-open]'));
        return;
      }
      if (t.closest('[data-facets-close]')) {
        e.preventDefault();
        this.closeDrawer();
        return;
      }
      var more = t.closest('[data-facets-more]');
      if (more) {
        e.preventDefault();
        this.toggleMore(more);
        return;
      }

      var link = t.closest('a[data-facets-link], a[data-pagination-link]');
      if (!link || !this.contains(link)) return;
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var isPage = link.hasAttribute('data-pagination-link');
      var pill = link.closest('.facets-active__list li');
      var pillIndex = pill ? qsa('.facets-active__list li', this).indexOf(pill) : -1;
      this.apply(link.href, { focus: isPage ? 'heading' : pillIndex > -1 ? 'pill' : 'keep', pillIndex: pillIndex, scroll: isPage });
    }

    onKeydown(e) {
      if (e.key !== 'Escape') return;
      if (this.drawerOpen) {
        e.preventDefault();
        this.closeDrawer();
        return;
      }
      var open = e.target instanceof Element && e.target.closest('.facets-panel--topbar details[open]');
      if (open && DESKTOP.matches) {
        e.preventDefault();
        open.open = false;
        focusEl(open.querySelector('summary'));
      }
    }

    /* Top bar on desktop: one dropdown at a time. */
    onToggle(e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS' || !d.open || !DESKTOP.matches) return;
      if (!d.closest('.facets-panel--topbar')) return;
      qsa('.facets-panel--topbar details[open]', this).forEach(function (other) {
        if (other !== d) other.open = false;
      });
    }

    onDocClick(e) {
      if (!DESKTOP.matches) return;
      qsa('.facets-panel--topbar details[open]', this).forEach(function (d) {
        if (!d.contains(e.target)) d.open = false;
      });
    }

    onPopState() {
      var url = this.normaliseUrl(window.location.href);
      var form = this.form || this.sortForm;
      var action = form ? new URL(form.getAttribute('action') || '/', window.location.href).pathname : null;
      if (!action || window.location.pathname !== action) return;
      if (url === this.lastUrl) return;
      this.apply(url, { push: false, focus: 'none' });
    }

    onBreakpoint() {
      if (DESKTOP.matches && this.drawerOpen) this.closeDrawer({ returnFocus: false });
    }

    syncSort(source) {
      qsa('[data-sort-select]', this).forEach(function (s) {
        if (s !== source) s.value = source.value;
      });
    }

    toggleMore(btn) {
      var list = btn.closest('.facets-list');
      if (!list) return;
      var expanded = !list.classList.contains('is-expanded');
      list.classList.toggle('is-expanded', expanded);
      btn.setAttribute('aria-expanded', String(expanded));
      btn.textContent = expanded ? btn.getAttribute('data-label-less') : btn.getAttribute('data-label-more');
      var group = btn.closest('[data-group]');
      var key = group && group.getAttribute('data-group');
      if (key) {
        if (expanded) this.expanded.add(key);
        else this.expanded.delete(key);
      }
    }

    /* -- drawer (phones / tablets) --------------------------------------- */
    openDrawer(opener) {
      var panel = this.panel;
      if (!panel || DESKTOP.matches || this.drawerOpen) return;
      this.drawerOpen = true;
      this.opener = opener || doc.activeElement;

      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.classList.add('is-open');
      qsa('[data-facets-open]', this).forEach(function (b) {
        b.setAttribute('aria-expanded', 'true');
      });

      var overlay = this.querySelector('[data-facets-overlay]');
      if (overlay) {
        overlay.hidden = false;
        requestAnimationFrame(function () {
          overlay.classList.add('is-visible');
        });
      }

      if (typeof L.lockScroll === 'function') L.lockScroll();
      if (typeof L.trapFocus === 'function') {
        this.release = L.trapFocus(panel, panel);
      } else {
        focusEl(panel);
      }
    }

    closeDrawer(opts) {
      if (!this.drawerOpen) return;
      opts = opts || {};
      this.drawerOpen = false;
      var panel = this.panel;
      if (panel) {
        panel.classList.remove('is-open');
        panel.removeAttribute('role');
        panel.removeAttribute('aria-modal');
      }
      qsa('[data-facets-open]', this).forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });

      var overlay = this.querySelector('[data-facets-overlay]');
      var self = this;
      if (overlay) {
        overlay.classList.remove('is-visible');
        setTimeout(function () {
          if (!self.drawerOpen) overlay.hidden = true;
        }, 220);
      }

      if (this.release) {
        try {
          this.release(false);
        } catch (e) {
          /* already released */
        }
        this.release = null;
      }
      if (typeof L.unlockScroll === 'function') L.unlockScroll();
      if (opts.returnFocus !== false) focusEl(this.opener && doc.contains(this.opener) ? this.opener : this.querySelector('[data-facets-open]'));
      this.opener = null;
    }

    /* -- fetch + render -------------------------------------------------- */
    applyFromForm() {
      this.normalisePrice();
      this.apply(this.buildUrl(), { focus: 'keep' });
    }

    apply(href, opts) {
      opts = opts || {};
      var self = this;
      var url = this.normaliseUrl(href);
      if (url === this.lastUrl && !opts.force) return;
      this.lastUrl = url;

      if (this.controller) this.controller.abort();
      var controller = 'AbortController' in window ? new AbortController() : null;
      this.controller = controller;
      this.setBusy(true);

      var cached = this.cache.get(url);
      var request = cached
        ? Promise.resolve(cached)
        : fetch(this.sectionUrl(url), {
            credentials: 'same-origin',
            signal: controller ? controller.signal : undefined
          }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          });

      request
        .then(function (html) {
          if (controller && controller.signal.aborted) return;
          self.cache.set(url, html);
          if (!self.render(html, opts)) throw new Error('render');
          if (opts.push !== false) {
            try {
              history.pushState({ lunovaFacets: self.sectionId }, '', url);
            } catch (e) {
              /* ignore */
            }
          }
          self.afterRender(opts);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          // The URL is the source of truth: load it properly instead.
          window.location.href = url;
        })
        .then(function () {
          if (self.controller === controller) {
            self.controller = null;
            self.setBusy(false);
          }
        });
    }

    setBusy(busy) {
      var results = this.results;
      if (results) {
        if (busy) results.setAttribute('aria-busy', 'true');
        else results.removeAttribute('aria-busy');
      }
      this.classList.toggle('is-loading', !!busy);
    }

    render(html, opts) {
      var parsed;
      try {
        parsed = new DOMParser().parseFromString(html, 'text/html');
      } catch (e) {
        return false;
      }
      var fresh = parsed.querySelector('facet-filters[data-section-id="' + cssEscape(this.sectionId) + '"]');
      if (!fresh) return false;

      // What to keep across the swap.
      var active = doc.activeElement;
      var focusId = active && active !== doc.body && this.contains(active) && active.id ? active.id : null;
      var typed = focusId && active.matches('input[type="number"], input[type="text"]') ? active.value : null;
      var openGroups = {};
      qsa('details[data-group]', this).forEach(function (d) {
        openGroups[d.getAttribute('data-group')] = d.open;
      });
      var form = this.form;
      var panel = this.panel;
      var formScroll = form ? form.scrollTop : 0;
      var panelScroll = panel ? panel.scrollTop : 0;

      swapRegions(this, fresh, 'data-swap');

      qsa('details[data-group]', this).forEach(function (d) {
        var key = d.getAttribute('data-group');
        if (Object.prototype.hasOwnProperty.call(openGroups, key)) d.open = openGroups[key];
      });
      var self = this;
      this.expanded.forEach(function (key) {
        var group = self.querySelector('details[data-group="' + cssEscape(key) + '"]');
        var btn = group && group.querySelector('[data-facets-more]');
        if (btn) {
          var list = btn.closest('.facets-list');
          if (list) list.classList.add('is-expanded');
          btn.setAttribute('aria-expanded', 'true');
          btn.textContent = btn.getAttribute('data-label-less');
        }
      });
      if (form) form.scrollTop = formScroll;
      if (panel) panel.scrollTop = panelScroll;

      // Sort selects follow the URL (matters on back/forward).
      var freshSort = fresh.querySelector('[data-sort-select]');
      if (freshSort) {
        qsa('[data-sort-select]', this).forEach(function (s) {
          s.value = freshSort.value;
        });
      }

      // Focus: stay where the shopper was; after a pill, move to its neighbour.
      if (opts.focus === 'heading') {
        focusEl(this.querySelector('[data-results-heading]'));
      } else if (opts.focus === 'pill') {
        var pills = qsa('.facets-active__list a', this);
        var target = pills[Math.min(Math.max(opts.pillIndex, 0), pills.length - 1)];
        focusEl(target || this.querySelector('[data-results-heading]'));
      } else if (opts.focus !== 'none' && focusId) {
        var el = doc.getElementById(focusId);
        if (el && this.contains(el)) {
          if (typed !== null && el.value !== typed) el.value = typed;
          focusEl(el);
        } else if (this.drawerOpen && panel) {
          focusEl(panel);
        }
      }
      return true;
    }

    afterRender(opts) {
      var count = this.querySelector('[data-results-count]') || this.querySelector('[data-swap="bar-count"]');
      announce(this.querySelector('[data-facets-live]'), count ? count.textContent.trim() : '');
      if (opts.scroll) {
        var top = this.getBoundingClientRect().top + window.pageYOffset - headerOffset() - 16;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    }
  }
  define('facet-filters', FacetFilters);

  /* ---------------------------------------------------------------------
     <cart-items> — basket page
     Strings come from data-str-* attributes on the element (so entities in
     translations are already decoded by the HTML parser).
     ------------------------------------------------------------------- */
  class CartItems extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      this.sectionId = this.getAttribute('data-section-id');
      this._ops = 0;

      this._onClick = this.onClick.bind(this);
      this._onChange = this.onChange.bind(this);
      this._onInput = this.onInput.bind(this);
      this._onKeydown = this.onKeydown.bind(this);
      this._onSubmit = this.onSubmit.bind(this);
      this.addEventListener('click', this._onClick);
      this.addEventListener('change', this._onChange);
      this.addEventListener('input', this._onInput);
      this.addEventListener('keydown', this._onKeydown);
      this.addEventListener('submit', this._onSubmit);

      var self = this;
      this._offs = [
        listen('lunova:cart:updated', function (e) {
          self.onExternal(e.detail || {});
        }),
        listen('lunova:finder:complete', function () {
          self.applyPersonal();
          self.applyUpsellPreference();
        })
      ];
      this._offMedia = onMedia(DESKTOP, function () {
        self.updateSticky();
      });

      this.applyPersonal();
      this.applyUpsellPreference();
      this.initSticky();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this._onClick);
      this.removeEventListener('change', this._onChange);
      this.removeEventListener('input', this._onInput);
      this.removeEventListener('keydown', this._onKeydown);
      this.removeEventListener('submit', this._onSubmit);
      (this._offs || []).forEach(function (off) {
        off();
      });
      if (this._offMedia) this._offMedia();
      this.teardownSticky();
      clearTimeout(this._noteTimer);
      clearTimeout(this._extTimer);
      this._ready = false;
    }

    get rootEl() {
      return this.querySelector('[data-cart-root]');
    }

    str(key) {
      return this.getAttribute('data-str-' + key) || '';
    }

    canAjax() {
      return !!(window.fetch && L.cart && typeof L.cart.change === 'function' && typeof L.cart.add === 'function');
    }

    status(message) {
      announce(this.querySelector('[data-cart-status]'), message);
    }

    /* -- events ---------------------------------------------------------- */
    onClick(e) {
      var t = e.target instanceof Element ? e.target : null;
      if (!t || !this.canAjax()) return;

      var step = t.closest('[data-qty-step]');
      if (step && this.contains(step)) {
        e.preventDefault();
        var line = step.closest('[data-line-key]');
        var input = line && line.querySelector('[data-qty-input]');
        if (!line || !input) return;
        var next = Math.max(0, (parseInt(input.value, 10) || 0) + (parseInt(step.getAttribute('data-qty-step'), 10) || 0));
        var max = parseInt(input.getAttribute('max'), 10);
        if (!isNaN(max) && next > max) next = max;
        input.value = next;
        this.changeLine(line, next, step);
        return;
      }

      var remove = t.closest('[data-line-remove]');
      if (remove && this.contains(remove)) {
        if (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        this.changeLine(remove.closest('[data-line-key]'), 0, remove);
      }
    }

    onChange(e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      if (t.matches('[data-qty-input]')) {
        if (!this.canAjax()) return;
        var line = t.closest('[data-line-key]');
        var qty = Math.max(0, parseInt(t.value, 10) || 0);
        var max = parseInt(t.getAttribute('max'), 10);
        if (!isNaN(max) && qty > max) qty = max;
        if (line && String(qty) !== line.getAttribute('data-quantity')) this.changeLine(line, qty, t);
        return;
      }
      if (t.matches('[data-upsell-select]')) {
        t.setAttribute('data-touched', '1');
        return;
      }
      if (t.matches('[data-cart-note]')) this.saveNote(t.value);
    }

    onInput(e) {
      var t = e.target;
      if (!(t instanceof Element) || !t.matches('[data-cart-note]')) return;
      var self = this;
      var value = t.value;
      clearTimeout(this._noteTimer);
      this._noteTimer = setTimeout(function () {
        self.saveNote(value);
      }, 700);
    }

    onKeydown(e) {
      // Enter in a quantity box commits it here instead of posting the form.
      if (e.key === 'Enter' && e.target instanceof Element && e.target.matches('[data-qty-input]') && this.canAjax()) {
        e.preventDefault();
        e.target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    onSubmit(e) {
      var form = e.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (form.matches('[data-upsell-form]')) {
        if (!this.canAjax()) return;
        e.preventDefault();
        this.addUpsell(form, e.submitter || null);
        return;
      }

      if (form.matches('[data-cart-form]')) {
        var submitter = e.submitter;
        if (submitter && submitter.name === 'checkout') {
          // Feedback only: a disabled submitter would drop name=checkout.
          clearTimeout(this._noteTimer);
          submitter.setAttribute('aria-busy', 'true');
        }
      }
    }

    /* -- note ------------------------------------------------------------ */
    saveNote(value) {
      clearTimeout(this._noteTimer);
      this._noteTimer = null;
      if (this._noteSaved === value) return;
      this._noteSaved = value;
      if (L.cart && typeof L.cart.update === 'function') {
        L.cart.update({ note: value }, { source: 'cart-page' }).catch(function () {
          /* the note also travels with the checkout form */
        });
      }
    }

    /* -- lines ----------------------------------------------------------- */
    changeLine(line, quantity, trigger) {
      if (!line) return;
      var self = this;
      var key = line.getAttribute('data-line-key');
      var error = line.querySelector('[data-line-error]');
      var controls = qsa('button, input, a[data-line-remove]', line);
      var lines = qsa('[data-line-key]', this);

      this._focusKey = trigger ? trigger.getAttribute('data-focus-key') : null;
      this._focusIndex = lines.indexOf(line);
      if (error) error.textContent = '';
      line.setAttribute('aria-busy', 'true');
      line.classList.add('is-updating');
      controls.forEach(function (el) {
        if (el.tagName === 'A') el.setAttribute('aria-disabled', 'true');
        else el.disabled = true;
      });

      this._ops += 1;
      this.status(this.str('updating'));

      L.cart
        .change(key, quantity, { sections: [this.sectionId], source: 'cart-page' })
        .then(function (res) {
          var html = res && res.sections && res.sections[self.sectionId];
          return html && self.render(html) ? true : self.refresh();
        })
        .then(function () {
          self.status(quantity === 0 ? self.str('removed') : self.str('updated'));
        })
        .catch(function (err) {
          // Shopify said no (usually stock). Put the line back as it was.
          self._focusKey = null;
          if (!doc.contains(line)) return;
          line.removeAttribute('aria-busy');
          line.classList.remove('is-updating');
          controls.forEach(function (el) {
            if (el.tagName === 'A') el.removeAttribute('aria-disabled');
            else el.disabled = false;
          });
          var input = line.querySelector('[data-qty-input]');
          if (input) input.value = line.getAttribute('data-quantity');
          if (error) error.textContent = errorText(err, self.str('error'));
          if (trigger && doc.contains(trigger)) focusEl(trigger);
        })
        .then(function () {
          self._ops = Math.max(0, self._ops - 1);
        });
    }

    addUpsell(form, submitter) {
      var self = this;
      var data = new FormData(form);
      var id = parseInt(data.get('id'), 10);
      if (!id) return;
      var btn = submitter || this.querySelector('button[type="submit"][form="' + cssEscape(form.id) + '"]');
      var error = this.querySelector('[data-upsell-error]');
      if (error) error.textContent = '';
      setBusy(btn, true);
      this._ops += 1;
      this._focusKey = 'upsell-add';
      this._focusIndex = -1;

      L.cart
        .add([{ id: id, quantity: 1 }], { sections: [this.sectionId], source: 'cart-page' })
        .then(function (res) {
          var html = res && res.sections && res.sections[self.sectionId];
          return html && self.render(html) ? true : self.refresh();
        })
        .then(function () {
          self.status(self.str('added'));
        })
        .catch(function (err) {
          self._focusKey = null;
          setBusy(btn, false);
          if (error) error.textContent = errorText(err, self.str('error'));
        })
        .then(function () {
          self._ops = Math.max(0, self._ops - 1);
        });
    }

    /* Something else changed the basket (quick add from a product row on
       this page, another tab's drawer…): re-render from Shopify. */
    onExternal(detail) {
      if (detail.source === 'cart-page' || this._ops > 0) return;
      var html = detail.sections && detail.sections[this.sectionId];
      if (html) {
        this.render(html);
        return;
      }
      var self = this;
      clearTimeout(this._extTimer);
      this._extTimer = setTimeout(function () {
        self.refresh();
      }, 60);
    }

    refresh() {
      var self = this;
      var url = typeof L.sectionsUrl === 'function'
        ? L.sectionsUrl([this.sectionId])
        : window.location.pathname + '?sections=' + encodeURIComponent(this.sectionId);
      return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var html = data && data[self.sectionId];
          if (!html || !self.render(html)) throw new Error('render');
          return true;
        })
        .catch(function () {
          window.location.reload();
          return false;
        });
    }

    render(html) {
      var parsed;
      try {
        parsed = new DOMParser().parseFromString(html, 'text/html');
      } catch (e) {
        return false;
      }
      var fresh = parsed.querySelector('[data-cart-root]');
      var current = this.rootEl;
      if (!fresh || !current) return false;

      var before = current.getAttribute('data-state');
      var after = fresh.getAttribute('data-state');

      if (before !== after) {
        if (after === 'filled') {
          // Express checkout buttons need Shopify's own script on a fresh page.
          window.location.reload();
          return true;
        }
        this.teardownSticky();
        current.replaceWith(doc.importNode(fresh, true));
        focusEl(this.querySelector('[data-cart-root] h1'));
        return true;
      }

      var active = doc.activeElement;
      var focusKey = this._focusKey || (active && this.contains(active) && active.getAttribute('data-focus-key')) || null;
      var focusIndex = typeof this._focusIndex === 'number' ? this._focusIndex : -1;
      this._focusKey = null;
      this._focusIndex = null;

      swapRegions(current, fresh, 'data-cart-swap');
      current.setAttribute('data-count', fresh.getAttribute('data-count') || '0');

      if (focusKey) {
        var target = current.querySelector('[data-focus-key="' + cssEscape(focusKey) + '"]');
        if ((!target || target.disabled) && focusIndex >= 0) {
          var lines = qsa('[data-line-key]', current);
          var line = lines[Math.min(focusIndex, lines.length - 1)];
          target = line ? line.querySelector('[data-qty-input]') : null;
        }
        focusEl(target || current.querySelector('h1'));
      }

      this.applyPersonal();
      this.applyUpsellPreference();
      this.updateSticky();
      return true;
    }

    /* -- personalisation ------------------------------------------------- */
    applyPersonal() {
      var data = null;
      try {
        data = L.finder && typeof L.finder.get === 'function' ? L.finder.get() : null;
      } catch (e) {
        data = null;
      }
      var name = data && typeof data.dogName === 'string' ? data.dogName.trim().slice(0, 40) : '';
      var handle = data && data.handle ? String(data.handle) : '';
      var self = this;
      var matchLine = null;

      qsa('[data-line-key]', this).forEach(function (line) {
        var isMatch = !!handle && line.getAttribute('data-product-handle') === handle;
        var badge = line.querySelector('.cart__match');
        if (isMatch && !matchLine) {
          matchLine = line;
          if (!badge) {
            var tpl = self.querySelector('template[data-cart-match-template]');
            var proto = tpl && tpl.content && tpl.content.firstElementChild;
            if (proto) {
              badge = proto.cloneNode(true);
              var title = line.querySelector('.cart-line__title');
              if (title) title.insertAdjacentElement('afterend', badge);
              else if (line.querySelector('.cart-line__info')) line.querySelector('.cart-line__info').prepend(badge);
            }
          }
          var text = badge && badge.querySelector('[data-cart-match-text]');
          if (text) text.textContent = name ? fill(self.str('match-named'), { name: name }) : self.str('match');
        } else if (badge) {
          badge.remove();
        }
      });

      var personal = this.querySelector('[data-cart-personal]');
      var personalText = personal && personal.querySelector('[data-cart-personal-text]');
      if (!personal || !personalText) return;
      if (matchLine) {
        personalText.textContent = name ? fill(this.str('personal-named'), { name: name }) : this.str('personal-match');
        personal.hidden = false;
      } else {
        personal.hidden = true;
      }
    }

    /* Default the extra product to the finder's size when it has one. */
    applyUpsellPreference() {
      var select = this.querySelector('[data-upsell-select]');
      var data = null;
      try {
        data = L.finder && typeof L.finder.get === 'function' ? L.finder.get() : null;
      } catch (e) {
        data = null;
      }
      if (!select || !data || !data.size || select.hasAttribute('data-touched')) return;
      var want = String(data.size).toLowerCase().trim();
      // The finder stores the size-hint value ("M", "XL"); options may say
      // "Medium" or "Rydal 2XL". Exact or prefix match first, then the
      // spec §5.6 rule through Lunova.sizeHint (label ≡ value, 2XL/XXL → XL).
      var wantHint = typeof L.sizeHint === 'function' ? L.sizeHint(data.size) : null;
      var opts = Array.prototype.slice.call(select.options);
      function valuesOf(opt) {
        return (opt.getAttribute('data-options') || '').toLowerCase().split('|').map(function (v) {
          return v.trim();
        });
      }
      var pick = null;
      opts.some(function (opt) {
        var hit = valuesOf(opt).some(function (v) {
          return v === want || v.indexOf(want + ' ') === 0 || v.indexOf(want + '(') === 0;
        });
        if (hit) pick = opt;
        return hit;
      });
      if (!pick && wantHint) {
        var wantValue = String(wantHint.value || '').toLowerCase();
        opts.some(function (opt) {
          var hit = valuesOf(opt).some(function (v) {
            var h = L.sizeHint(v);
            return !!h && (h === wantHint || String(h.value || '').toLowerCase() === wantValue);
          });
          if (hit) pick = opt;
          return hit;
        });
      }
      if (pick) select.value = pick.value;
    }

    /* -- sticky checkout (phones) ---------------------------------------- */
    initSticky() {
      this.teardownSticky();
      var bar = this.querySelector('[data-cart-sticky]');
      var target = this.querySelector('[data-cart-checkout]');
      if (!bar || !target || !('IntersectionObserver' in window)) return;
      bar.hidden = false;
      var self = this;
      this._stickyBelow = false;
      this._io = new IntersectionObserver(function (entries) {
        var entry = entries[entries.length - 1];
        var vh = window.innerHeight || root.clientHeight;
        self._stickyBelow = !entry.isIntersecting && entry.boundingClientRect.top > vh;
        self.updateSticky();
      });
      this._io.observe(target);
    }

    updateSticky() {
      var bar = this.querySelector('[data-cart-sticky]');
      if (!bar) return;
      bar.classList.toggle('is-visible', !!this._stickyBelow && !DESKTOP.matches);
    }

    teardownSticky() {
      if (this._io) {
        this._io.disconnect();
        this._io = null;
      }
      this._stickyBelow = false;
    }
  }
  define('cart-items', CartItems);

  /* ---------------------------------------------------------------------
     Collection description: fold long text under "Read more".
     Focus moving into the folded text unfolds it, so keyboard users never
     land on a link they can't see.
     ------------------------------------------------------------------- */
  var FOLD_MIN = 380;

  function initAbout(scope) {
    qsa('[data-collection-about]', scope).forEach(function (wrap) {
      if (wrap.__lunovaAbout) return;
      var body = wrap.querySelector('[data-about-body]');
      var btn = wrap.querySelector('[data-about-toggle]');
      if (!body || !btn || body.scrollHeight <= FOLD_MIN) return;
      wrap.__lunovaAbout = true;

      function set(expanded) {
        body.classList.toggle('is-collapsed', !expanded);
        btn.setAttribute('aria-expanded', String(expanded));
        btn.textContent = expanded ? btn.getAttribute('data-label-less') : btn.getAttribute('data-label-more');
      }

      set(false);
      btn.hidden = false;
      btn.addEventListener('click', function () {
        var expand = btn.getAttribute('aria-expanded') !== 'true';
        set(expand);
        if (!expand) {
          var top = wrap.getBoundingClientRect().top;
          if (top < 0) window.scrollBy({ top: top - headerOffset() - 16, behavior: reduceMotion() ? 'auto' : 'smooth' });
        }
      });
      body.addEventListener('focusin', function () {
        if (body.classList.contains('is-collapsed')) set(true);
      });
    });
  }

  /* Back from checkout via the browser's cache: un-stick the busy button. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    qsa('cart-items [name="checkout"][aria-busy="true"]').forEach(function (btn) {
      btn.removeAttribute('aria-busy');
    });
  });

  function ready() {
    initAbout(doc);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready);
  else ready();

  doc.addEventListener('shopify:section:load', function (e) {
    initAbout(e.target);
  });
})();
