/*
 * Lunova — search.js (chrome area)
 *
 *   <search-modal>       the header's search panel (native <dialog>)
 *   <predictive-search>  ARIA 1.2 combobox: debounced Section Rendering
 *                        fetches of the `predictive-search` section, stale
 *                        requests aborted, results cached per query, arrow
 *                        keys move through results, Escape steps back out.
 *
 * Any [data-search-open] link opens the panel; without JS (or without the
 * panel) it is a plain link to /search. Loaded by sections/header.liquid;
 * safe to include more than once.
 */
(function () {
  'use strict';

  if (window.__lunovaSearch) return;
  window.__lunovaSearch = true;

  var L = (window.Lunova = window.Lunova || {});
  var doc = document;

  function define(name, ctor) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }

  function debounce(fn, ms) {
    if (typeof L.debounce === 'function') return L.debounce(fn, ms);
    var t;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function dialogApi() {
    return L.chromeDialog || null;
  }

  /* ---------------------------------------------------------------------
     <search-modal>
     ------------------------------------------------------------------- */
  class SearchModal extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.dialog = this.querySelector('dialog');
      if (!this.dialog) return;
      this.input = this.querySelector('input[type="search"]');
      var api = dialogApi();
      if (api) {
        api.wire(this);
      } else {
        this.dialog.addEventListener('cancel', function (e) {
          e.preventDefault();
          self.close();
        });
        this.addEventListener('click', function (e) {
          if (e.target.closest('[data-close]')) self.close();
        });
      }
    }

    disconnectedCallback() {
      var api = dialogApi();
      if (api) api.teardown(this);
    }

    open(opener) {
      var api = dialogApi();
      if (api) {
        api.open(this, { opener: opener, focus: this.input });
      } else {
        try { this.dialog.showModal(); } catch (e) { this.dialog.setAttribute('open', ''); }
        this.setAttribute('open', '');
        this.dialog.classList.add('is-open');
        if (this.input) this.input.focus();
      }
      // Re-opening with an old query: select it so typing replaces it.
      if (this.input && this.input.value) this.input.select();
    }

    close(opts) {
      var search = this.querySelector('predictive-search');
      if (search && typeof search.collapse === 'function') search.collapse();
      var api = dialogApi();
      if (api) {
        api.close(this, opts);
      } else {
        this.removeAttribute('open');
        this.dialog.classList.remove('is-open');
        if (this.dialog.open) this.dialog.close();
      }
    }
  }
  define('search-modal', SearchModal);

  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var trigger = e.target.closest && e.target.closest('[data-search-open]');
    if (!trigger) return;
    var modal = doc.querySelector('search-modal');
    if (!modal || !modal.querySelector('dialog') || typeof modal.open !== 'function') return;
    e.preventDefault();
    modal.open(trigger);
  });

  /* ---------------------------------------------------------------------
     <predictive-search>
     ------------------------------------------------------------------- */
  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-predictive-results]');
      this.statusEl = this.querySelector('[data-predictive-status]');
      this.defaultPanel = this.querySelector('[data-search-default]');
      this.form = this.querySelector('form');
      this.enabled = this.getAttribute('data-enabled') !== 'false' && !!this.input && !!this.results;
      if (!this.enabled) return;

      this.sectionId = this.getAttribute('data-section-id') || 'predictive-search';
      this.minChars = 2;
      this.cache = {};
      this.activeIndex = -1;

      this._onInput = debounce(function () { self.onInput(); }, 220);
      this.input.addEventListener('input', this._onInput);
      this.input.addEventListener('keydown', this.onKeydown.bind(this));
      this.input.addEventListener('focus', function () {
        if (self.results.childElementCount && self.query().length >= self.minChars) self.expand();
      });

      if (this.form) {
        this.form.addEventListener('submit', function (e) {
          var opt = self.options()[self.activeIndex];
          var link = opt && opt.querySelector('a[href]');
          if (link) {
            e.preventDefault();
            link.click();
          }
        });
      }

      // A pointer moving over the results takes over from the keyboard highlight.
      this.results.addEventListener('pointermove', function (e) {
        var opt = e.target.closest('[role="option"]');
        if (!opt) return;
        var i = self.options().indexOf(opt);
        if (i > -1 && i !== self.activeIndex) self.setActive(i, false);
      });
    }

    disconnectedCallback() {
      this.abort();
    }

    query() {
      return this.input ? this.input.value.trim() : '';
    }

    options() {
      return Array.prototype.slice.call(this.results.querySelectorAll('[role="option"]'));
    }

    abort() {
      if (this.controller) {
        this.controller.abort();
        this.controller = null;
      }
    }

    url(q) {
      var base = (L.routes && L.routes.predictiveSearch) || '/search/suggest';
      var params = new URLSearchParams();
      params.set('q', q);
      params.set('section_id', this.sectionId);
      params.set('resources[type]', 'product,collection,article,page');
      params.set('resources[limit]', '4');
      params.set('resources[limit_scope]', 'each');
      params.set('resources[options][unavailable_products]', 'last');
      params.set('resources[options][fields]', 'title,product_type,variants.title,vendor,tag');
      return base + (base.indexOf('?') > -1 ? '&' : '?') + params.toString();
    }

    onInput() {
      var q = this.query();
      if (q.length < this.minChars) {
        this.abort();
        this.clear();
        return;
      }
      if (this.cache[q]) {
        this.render(this.cache[q]);
        return;
      }
      this.load(q);
    }

    load(q) {
      var self = this;
      this.abort();
      this.controller = 'AbortController' in window ? new AbortController() : null;
      this.setAttribute('aria-busy', 'true');

      fetch(this.url(q), {
        credentials: 'same-origin',
        signal: this.controller ? this.controller.signal : undefined
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (text) {
          var parsed = new DOMParser().parseFromString(text, 'text/html');
          var rootEl = parsed.querySelector('[data-predictive-root]');
          if (!rootEl) throw new Error('No results markup');
          var data = {
            html: rootEl.innerHTML,
            count: parseInt(rootEl.getAttribute('data-results-count'), 10) || 0,
            status: rootEl.getAttribute('data-status') || ''
          };
          self.cache[q] = data;
          // Only show it if it still matches what's in the box.
          if (self.query() === q) self.render(data);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          // Predictive search is a nicety: on failure, Enter still searches.
          self.clear();
        })
        .then(function () {
          self.removeAttribute('aria-busy');
        });
    }

    render(data) {
      this.results.innerHTML = data.html;
      this.results.hidden = false;
      if (this.defaultPanel) this.defaultPanel.hidden = true;
      this.activeIndex = -1;
      this.input.removeAttribute('aria-activedescendant');
      this.expand();
      this.announce(data.status);
    }

    clear() {
      this.results.innerHTML = '';
      this.results.hidden = true;
      if (this.defaultPanel) this.defaultPanel.hidden = false;
      this.activeIndex = -1;
      this.input.removeAttribute('aria-activedescendant');
      this.collapse();
      this.announce('');
    }

    expand() {
      var has = !!this.results.querySelector('[role="listbox"]');
      this.input.setAttribute('aria-expanded', has ? 'true' : 'false');
    }

    collapse() {
      if (this.input) this.input.setAttribute('aria-expanded', 'false');
    }

    announce(text) {
      var el = this.statusEl;
      if (!el) return;
      clearTimeout(this._announceTimer);
      el.textContent = '';
      if (!text) return;
      this._announceTimer = setTimeout(function () { el.textContent = text; }, 400);
    }

    setActive(i, scroll) {
      var opts = this.options();
      this.activeIndex = i;
      opts.forEach(function (o, idx) {
        var on = idx === i;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.classList.toggle('is-active', on);
      });
      var opt = opts[i];
      if (opt) {
        this.input.setAttribute('aria-activedescendant', opt.id);
        if (scroll !== false) opt.scrollIntoView({ block: 'nearest' });
      } else {
        this.input.removeAttribute('aria-activedescendant');
      }
    }

    onKeydown(e) {
      var opts = this.options();
      var expanded = this.input.getAttribute('aria-expanded') === 'true';
      switch (e.key) {
        case 'ArrowDown':
          if (!opts.length) return;
          e.preventDefault();
          if (!expanded) this.expand();
          this.setActive(this.activeIndex + 1 >= opts.length ? 0 : this.activeIndex + 1);
          break;
        case 'ArrowUp':
          if (!opts.length) return;
          e.preventDefault();
          if (!expanded) this.expand();
          this.setActive(this.activeIndex - 1 < 0 ? opts.length - 1 : this.activeIndex - 1);
          break;
        case 'Escape':
          // First Escape closes the suggestions, the second clears the box,
          // the third (not stopped here) closes the search panel.
          if (expanded) {
            e.preventDefault();
            e.stopPropagation();
            this.setActive(-1);
            this.collapse();
          } else if (this.input.value) {
            e.preventDefault();
            e.stopPropagation();
            this.input.value = '';
            this.abort();
            this.clear();
          }
          break;
        default:
          break;
      }
    }
  }
  define('predictive-search', PredictiveSearch);
})();
