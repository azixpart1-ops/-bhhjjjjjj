/*
 * Lunova — cart.js (chrome area)
 *
 * Loaded once on every page by layout/theme.liquid. Holds the behaviour for
 * the parts of the store that are always there:
 *
 *   <cart-drawer>       basket drawer (Section Rendering, no money maths in JS)
 *   <cart-count>        header basket bubble
 *   <quick-add-drawer>  size picker drawer for product cards
 *   <site-header>       sticky/condensing header, dropdown navigation
 *   <menu-drawer>       mobile menu
 *   <announcement-bar>  rotating promises
 *   footer accordions, links-to-/cart → drawer, single-variant quick add
 *
 * Exposes Lunova.chromeDialog { open(host, opts), close(host, opts) } which
 * search.js and popup.js reuse, so only one chrome dialog is ever open and
 * scroll lock / focus return are handled in one place.
 *
 * Vanilla ES2019, no dependencies. Every custom element is guarded.
 */
(function () {
  'use strict';

  if (window.__lunovaChrome) return;
  window.__lunovaChrome = true;

  var L = (window.Lunova = window.Lunova || {});
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var CLOSE_MS = 320;

  function noMotion() {
    return reduceMotion.matches || root.classList.contains('no-motion');
  }

  /* ---------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------- */
  function routes() { return L.routes || {}; }
  function settings() { return L.settings || {}; }

  function listen(evt, fn, target) {
    var t = target || doc;
    t.addEventListener(evt, fn);
    return function () { t.removeEventListener(evt, fn); };
  }

  function emit(evt, detail) {
    if (typeof L.emit === 'function') L.emit(evt, detail);
    else doc.dispatchEvent(new CustomEvent(evt, { detail: detail }));
  }

  function define(name, ctor) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }

  function isCartTemplate() {
    return !!(doc.body && doc.body.classList.contains('template-cart'));
  }

  function cartUrl() {
    var r = routes();
    return r.cartUrl || r.cart || '/cart';
  }

  function jsUrl(path, fallback) {
    var p = path || fallback;
    return /\.js$/.test(p) ? p : p + '.js';
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
  }

  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function finderData() {
    try { return (L.finder && typeof L.finder.get === 'function' && L.finder.get()) || null; } catch (e) { return null; }
  }

  function finderName() {
    var f = finderData();
    return f && f.dogName ? String(f.dogName).trim().slice(0, 40) : '';
  }

  /* Shopify's `t` filter HTML-escapes translations ("didn&#39;t"), and these
     strings are only ever set as text, so decode them once after parsing
     (the same as global.js does for Lunova.strings). */
  var STRINGS = null;
  function str(key) {
    if (!STRINGS) {
      var el = doc.getElementById('LunovaChromeStrings');
      try { STRINGS = el ? JSON.parse(el.textContent) : {}; } catch (e) { STRINGS = {}; }
      if (!STRINGS || typeof STRINGS !== 'object') STRINGS = {};
      var box = null;
      Object.keys(STRINGS).forEach(function (k) {
        var v = STRINGS[k];
        if (typeof v !== 'string' || v.indexOf('&') === -1) return;
        box = box || doc.createElement('textarea');
        box.innerHTML = v;
        STRINGS[k] = box.value;
      });
    }
    return STRINGS[key] || (L.strings && L.strings[key]) || '';
  }

  /* Fill `el` from a template such as "[name]'s new bed is in your basket: [product]."
     Values go in as text (never HTML); [product] is set in bold. */
  function fillTemplate(el, template, values) {
    el.textContent = '';
    String(template).split(/(\[[a-z]+\])/).forEach(function (part) {
      var m = part.match(/^\[([a-z]+)\]$/);
      if (m && values[m[1]] != null) {
        var node = doc.createElement(m[1] === 'product' ? 'strong' : 'span');
        node.textContent = values[m[1]];
        el.appendChild(node);
      } else if (part) {
        el.appendChild(doc.createTextNode(part));
      }
    });
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

  function errorText(err) {
    if (err && typeof err === 'object') {
      if (err.description && typeof err.description === 'string') return err.description;
      if (err.message && typeof err.message === 'string' && err.status) return err.message;
    }
    return str('error') || 'Sorry, that didn’t go through. Please try again.';
  }

  /* ---------------------------------------------------------------------
     Cart API — Lunova.cart from global.js, with a bare fallback so the
     basket still works if global.js is late or missing.
     ------------------------------------------------------------------- */
  function postJSON(url, body) {
    if (typeof L.fetchJSON === 'function') {
      return L.fetchJSON(url, { method: 'POST', body: JSON.stringify(body) });
    }
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw { status: res.status, description: data.description || data.message || '' };
        return data;
      });
    });
  }

  function fetchCart() {
    if (L.cart && typeof L.cart.get === 'function') return L.cart.get();
    return fetch(jsUrl(routes().cart, '/cart'), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); });
  }

  function cartAdd(items, sections) {
    if (L.cart && typeof L.cart.add === 'function') {
      return L.cart.add(items, { sections: sections });
    }
    return postJSON(jsUrl(routes().cartAdd, '/cart/add'), {
      items: items,
      sections: sections.join(','),
      sections_url: location.pathname
    }).then(function (res) {
      return fetchCart().then(function (cart) {
        emit('lunova:cart:updated', { cart: cart, source: 'chrome' });
        return { cart: cart, sections: res.sections || {}, items: res.items };
      });
    });
  }

  function cartChange(key, quantity, sections) {
    if (L.cart && typeof L.cart.change === 'function') {
      return L.cart.change(key, quantity, { sections: sections });
    }
    return postJSON(jsUrl(routes().cartChange, '/cart/change'), {
      id: key,
      quantity: quantity,
      sections: sections.join(','),
      sections_url: location.pathname
    }).then(function (cart) {
      emit('lunova:cart:updated', { cart: cart, source: 'chrome' });
      return { cart: cart, sections: cart.sections || {} };
    });
  }

  function sectionsUrl(ids) {
    if (typeof L.sectionsUrl === 'function') return L.sectionsUrl(ids);
    return location.pathname + '?sections=' + encodeURIComponent(ids.join(','));
  }

  function updateCounts(count) {
    doc.querySelectorAll('cart-count').forEach(function (el) {
      if (typeof el.update === 'function') el.update(count);
    });
  }

  /* ---------------------------------------------------------------------
     Shared dialog handling (cart drawer, quick add, menu, search, pop-up).
     Native <dialog>.showModal(): top layer (no z-index fights with other
     areas' modals), inert page behind it, Escape via `cancel`.
     ------------------------------------------------------------------- */
  var openHosts = [];

  function lockScroll() {
    if (typeof L.lockScroll === 'function') L.lockScroll();
    else root.style.overflow = 'hidden';
  }

  function unlockScroll() {
    if (typeof L.unlockScroll === 'function') L.unlockScroll();
    else root.style.overflow = '';
  }

  function openDialog(host, opts) {
    opts = opts || {};
    var dialog = host.querySelector('dialog');
    if (!dialog) return;
    clearTimeout(host._closeTimer);

    if (host.hasAttribute('open') && dialog.open) {
      focusEl(opts.focus || dialog.querySelector('[data-dialog-focus]'));
      return;
    }

    if (openHosts.length === 0) lockScroll();
    if (openHosts.indexOf(host) === -1) openHosts.push(host);

    // Only one chrome dialog at a time; the one being replaced doesn't take focus back.
    openHosts.slice().forEach(function (other) {
      if (other !== host && typeof other.close === 'function') other.close({ returnFocus: false });
    });

    host._opener = opts.opener || doc.activeElement;
    if (!dialog.open) {
      try { dialog.showModal(); } catch (e) { dialog.setAttribute('open', ''); }
    }
    host.setAttribute('open', '');
    var target = opts.focus || dialog.querySelector('[data-dialog-focus]') || dialog;
    if (typeof L.trapFocus === 'function' && !host._release) {
      // global.js focuses `target` on the next frame and wraps Tab inside.
      try { host._release = L.trapFocus(dialog, target); } catch (e) { host._release = null; }
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (host.hasAttribute('open')) dialog.classList.add('is-open');
      });
    });
    focusEl(target);
  }

  function closeDialog(host, opts) {
    opts = opts || {};
    var dialog = host.querySelector('dialog');
    if (!dialog || !host.hasAttribute('open')) return;

    host.removeAttribute('open');
    dialog.classList.remove('is-open');
    var i = openHosts.indexOf(host);
    if (i > -1) openHosts.splice(i, 1);
    if (host._release) {
      // false: don't let the trap move focus; finish() returns it once the dialog is gone.
      try { host._release(false); } catch (e) { /* ignore */ }
      host._release = null;
    }
    if (openHosts.length === 0) unlockScroll();

    var opener = host._opener;
    host._opener = null;
    clearTimeout(host._closeTimer);

    function finish() {
      if (host.hasAttribute('open')) return; // re-opened while closing
      if (dialog.open) dialog.close();
      if (opts.returnFocus !== false && openHosts.length === 0 && opener && doc.contains(opener)) {
        focusEl(opener);
      }
    }

    // Handing over to another dialog (finder, search, basket): close at once.
    // dialog.close() puts focus back on whatever opened this one, so it must
    // happen before the next dialog takes focus, not 300ms after.
    if (opts.returnFocus === false || noMotion()) finish();
    else host._closeTimer = setTimeout(finish, CLOSE_MS);
  }

  /* Hosts call this in connectedCallback: Escape + scrim/close buttons. */
  function wireDialog(host) {
    var dialog = host.querySelector('dialog');
    if (!dialog) return;
    dialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      host.close();
    });
    host.addEventListener('click', function (e) {
      var closer = e.target.closest('[data-close]');
      if (closer && host.contains(closer)) {
        e.preventDefault();
        host.close();
        return;
      }
      // Hand over to the finder / search: close first so they open on a clean page.
      if (e.target.closest('[data-open-finder], a[href$="#bed-finder"], [data-search-open]')) {
        host.close({ returnFocus: false });
      }
    });
  }

  function teardownDialog(host) {
    clearTimeout(host._closeTimer);
    var i = openHosts.indexOf(host);
    if (i > -1) {
      openHosts.splice(i, 1);
      if (openHosts.length === 0) unlockScroll();
    }
    if (host._release) {
      try { host._release(false); } catch (e) { /* ignore */ }
      host._release = null;
    }
  }

  L.chromeDialog = { open: openDialog, close: closeDialog, wire: wireDialog, teardown: teardownDialog };

  /* ---------------------------------------------------------------------
     <cart-count>
     ------------------------------------------------------------------- */
  class CartCount extends HTMLElement {
    connectedCallback() {
      var self = this;
      this._off = listen('lunova:cart:updated', function (e) {
        var cart = e.detail && e.detail.cart;
        if (cart && typeof cart.item_count === 'number') self.update(cart.item_count);
      });
    }

    disconnectedCallback() {
      if (this._off) this._off();
    }

    update(count) {
      var n = Math.max(0, parseInt(count, 10) || 0);
      var prev = parseInt(this.getAttribute('data-count'), 10) || 0;
      this.setAttribute('data-count', n);
      this.hidden = n < 1;
      var num = this.querySelector('[data-cart-count-number]');
      if (num) num.textContent = n > 99 ? '99+' : String(n);
      var label = this.querySelector('[data-cart-count-label]');
      if (label) {
        var word = n === 1 ? (this.dataset.item || str('item') || 'item') : (this.dataset.items || str('items') || 'items');
        label.textContent = ', ' + n + ' ' + word;
      }
      if (n > prev && !reduceMotion.matches) {
        this.classList.remove('is-bumping');
        void this.offsetWidth; // restart the animation
        this.classList.add('is-bumping');
        var self = this;
        clearTimeout(this._bumpTimer);
        this._bumpTimer = setTimeout(function () { self.classList.remove('is-bumping'); }, 600);
      }
    }
  }
  define('cart-count', CartCount);

  /* ---------------------------------------------------------------------
     <cart-drawer>
     ------------------------------------------------------------------- */
  class CartDrawer extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.dialog = this.querySelector('dialog');
      if (!this.dialog) return;
      this.sectionId = this.getAttribute('data-section-id') || 'cart-drawer';
      this._ops = 0;
      this._renderedAt = 0;
      this.pending = null;
      this.added = null;

      wireDialog(this);
      this.addEventListener('click', this.onClick.bind(this));
      this.addEventListener('change', this.onChange.bind(this));
      this.addEventListener('input', this.onInput.bind(this));
      this.addEventListener('submit', this.onSubmit.bind(this));
      this.addEventListener('keydown', this.onKeydown.bind(this));

      this._offs = [
        listen('lunova:cart:open', function (e) { self.handleOpen(e.detail || {}); }),
        listen('lunova:cart:updated', function (e) { self.handleUpdated(e.detail || {}); }),
        listen('lunova:finder:complete', function () { self.applyPersonal(); self.applyUpsellPreference(); })
      ];

      this.applyPersonal();
      this.applyUpsellPreference();
    }

    disconnectedCallback() {
      (this._offs || []).forEach(function (off) { off(); });
      teardownDialog(this);
    }

    get disabled() {
      return this.hasAttribute('data-disabled') || isCartTemplate() || settings().cartType === 'page';
    }

    get content() {
      return this.querySelector('[data-drawer-content]');
    }

    open(opts) {
      if (this.disabled) return;
      opts = opts || {};
      this.applyPersonal();
      this.paintAdded();
      openDialog(this, { opener: opts.opener });
    }

    close(opts) {
      this.flushNote();
      closeDialog(this, opts);
      this.added = null;
      var banner = this.querySelector('[data-cart-added]');
      if (banner) banner.hidden = true;
    }

    /* lunova:cart:open — after an add (product form, quick add, finder) */
    handleOpen(detail) {
      var self = this;
      if (settings().cartType === 'page') {
        if (!isCartTemplate()) window.location.href = cartUrl();
        return;
      }
      if (this.disabled) return;
      if (detail.added) this.setAdded(detail.added);

      // Make sure the drawer shows the basket as it is now. If nothing has
      // re-rendered it in the last moment, fetch it before opening.
      var ready = this.pending;
      if (!ready && Date.now() - this._renderedAt > 1500) ready = this.refresh();
      Promise.resolve(ready).then(function (ok) {
        if (ok === false) {
          // The item is in the basket but the drawer couldn't be refreshed —
          // the basket page tells the truth, the drawer would not.
          window.location.href = cartUrl();
          return;
        }
        self.open({ opener: detail.opener });
      });
    }

    /* lunova:cart:updated — any change from anywhere */
    handleUpdated(detail) {
      if (this._ops > 0) return; // our own change; we render from its response
      var html = detail.sections && detail.sections[this.sectionId];
      if (html) {
        this.render(html);
        return;
      }
      if (detail.cart && typeof detail.cart.item_count === 'number') updateCounts(detail.cart.item_count);
      if (isCartTemplate()) return;
      this.refresh();
    }

    refresh() {
      var self = this;
      if (this.pending) return this.pending;
      this.pending = fetch(sectionsUrl([this.sectionId]), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw res;
          return res.json();
        })
        .then(function (data) {
          return !!(data && data[self.sectionId] && self.render(data[self.sectionId]));
        })
        .catch(function () { return false; })
        .then(function (ok) {
          self.pending = null;
          return ok;
        });
      return this.pending;
    }

    render(html) {
      var current = this.content;
      if (!current || !html) return false;
      var fresh;
      try {
        fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-drawer-content]');
      } catch (e) {
        fresh = null;
      }
      if (!fresh) return false;

      // Remember where focus was, so a keyboard user isn't thrown to the top.
      var active = doc.activeElement;
      var hadFocus = !!(active && current.contains(active));
      var focusKey = this._focusKey || (hadFocus && active.getAttribute('data-focus-key')) || null;
      var focusLine = this._focusLine || null;
      this._focusKey = null;
      this._focusLine = null;

      // Don't lose a half-typed order note.
      var note = current.querySelector('[data-cart-note]');
      var noteValue = note ? note.value : null;
      var noteOpen = !!(note && note.closest('details') && note.closest('details').open);

      current.innerHTML = fresh.innerHTML;
      current.className = fresh.className;
      var count = parseInt(fresh.getAttribute('data-count'), 10) || 0;
      current.setAttribute('data-count', count);
      this._renderedAt = Date.now();

      if (noteValue !== null) {
        var newNote = current.querySelector('[data-cart-note]');
        if (newNote) {
          newNote.value = noteValue;
          if (noteOpen && newNote.closest('details')) newNote.closest('details').open = true;
        }
      }

      var after = this.querySelector('[data-cart-after]');
      if (after) after.hidden = count === 0;

      updateCounts(count);
      this.applyPersonal();
      this.applyUpsellPreference();
      this.paintAdded();

      if (this.hasAttribute('open') && (hadFocus || focusKey)) {
        var target = null;
        if (focusKey) target = current.querySelector('[data-focus-key="' + cssEscape(focusKey) + '"]');
        if ((!target || target.disabled) && focusLine) {
          target = current.querySelector('[data-focus-key="input-' + cssEscape(focusLine) + '"]');
        }
        if (!target || target.disabled) target = current.querySelector('[data-dialog-focus]');
        focusEl(target);
      }
      return true;
    }

    status(message) {
      var el = this.querySelector('[data-cart-status]');
      if (!el) return;
      el.textContent = '';
      // A tick later so screen readers notice the change.
      setTimeout(function () { el.textContent = message || ''; }, 60);
    }

    /* -- personalisation ------------------------------------------------ */
    applyPersonal() {
      // global.js fills [data-finder-name] / [data-finder-name-only]; it only
      // scans on load, so run it again over freshly rendered markup.
      if (typeof L.applyFinder === 'function') {
        try { L.applyFinder(this); } catch (e) { /* fall through */ }
      }
      var name = finderName();
      this.querySelectorAll('[data-finder-personal]').forEach(function (el) { el.hidden = !name; });
      if (name) {
        this.querySelectorAll('[data-finder-personal] [data-finder-name]').forEach(function (el) { el.textContent = name; });
      }
    }

    applyUpsellPreference() {
      var select = this.querySelector('[data-upsell-select]');
      var f = finderData();
      if (!select || !f || !f.size || select.dataset.touched) return;
      var want = String(f.size).toLowerCase().trim();
      // The finder stores the size-hint value ("M", "XL"); options may say
      // "Medium" or "Rydal 2XL". Exact or prefix match first, then the
      // spec §5.6 rule through Lunova.sizeHint (label ≡ value, 2XL/XXL → XL).
      var wantHint = typeof L.sizeHint === 'function' ? L.sizeHint(f.size) : null;
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

    setAdded(added) {
      var item = added;
      if (added && Array.isArray(added.items)) item = added.items[0];
      else if (Array.isArray(added)) item = added[0];
      if (!item) return;
      // Only call it "Bella's new bed" when it is the bed the finder picked
      // (any size of it); anything else added later is just named.
      var f = finderData();
      var isMatch = !!(f && f.dogName && (
        (f.handle && item.handle && String(item.handle) === String(f.handle)) ||
        (f.productId && item.product_id && String(item.product_id) === String(f.productId)) ||
        (f.variantId && String(item.variant_id || item.id || '') === String(f.variantId))
      ));
      this.added = {
        product: item.product_title || item.title || '',
        name: isMatch ? finderName() : ''
      };
    }

    paintAdded() {
      var banner = this.querySelector('[data-cart-added]');
      if (!banner) return;
      if (!this.added || !this.added.product) {
        banner.hidden = true;
        return;
      }
      var text = banner.querySelector('[data-cart-added-text]');
      if (text) {
        var tpl = this.added.name ? str('addedNamed') : str('added');
        fillTemplate(text, tpl || '[product]', { name: this.added.name, product: this.added.product });
      }
      banner.hidden = false;
    }

    /* -- line changes --------------------------------------------------- */
    onClick(e) {
      var step = e.target.closest('[data-qty-step]');
      if (step && this.contains(step)) {
        e.preventDefault();
        var line = step.closest('[data-line-key]');
        var input = line && line.querySelector('[data-qty-input]');
        if (!line || !input) return;
        var next = Math.max(0, (parseInt(input.value, 10) || 0) + (parseInt(step.getAttribute('data-qty-step'), 10) || 0));
        input.value = next;
        this.changeLine(line, next, step);
        return;
      }
      var remove = e.target.closest('[data-line-remove]');
      if (remove && this.contains(remove)) {
        e.preventDefault();
        this.changeLine(remove.closest('[data-line-key]'), 0, remove);
      }
    }

    onChange(e) {
      var input = e.target.closest('[data-qty-input]');
      if (input) {
        var line = input.closest('[data-line-key]');
        var qty = Math.max(0, parseInt(input.value, 10) || 0);
        var max = parseInt(input.getAttribute('max'), 10);
        if (max >= 0 && qty > max) qty = max;
        if (line && String(qty) !== line.getAttribute('data-quantity')) this.changeLine(line, qty, input);
        return;
      }
      if (e.target.matches('[data-upsell-select]')) e.target.dataset.touched = '1';
      if (e.target.matches('[data-cart-note]')) this.saveNote(e.target.value);
    }

    onInput(e) {
      if (e.target.matches('[data-cart-note]')) {
        var self = this;
        var value = e.target.value;
        clearTimeout(this._noteTimer);
        this._noteTimer = setTimeout(function () { self.saveNote(value); }, 600);
      }
    }

    onKeydown(e) {
      // Enter in a quantity box commits it rather than submitting anything.
      if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-qty-input]')) {
        e.preventDefault();
        e.target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    saveNote(value) {
      clearTimeout(this._noteTimer);
      this._noteTimer = null;
      if (this._noteSaved === value) return;
      this._noteSaved = value;
      postJSON(jsUrl(routes().cartUpdate, '/cart/update'), { note: value }).catch(function () { /* saved again at checkout */ });
    }

    flushNote() {
      var note = this.querySelector('[data-cart-note]');
      if (note && this._noteTimer) this.saveNote(note.value);
    }

    changeLine(line, quantity, trigger) {
      if (!line) return;
      var self = this;
      var key = line.getAttribute('data-line-key');
      var error = line.querySelector('[data-line-error]');
      var controls = line.querySelectorAll('button, input, a[data-line-remove]');

      this._focusKey = trigger && trigger.getAttribute('data-focus-key');
      this._focusLine = key;
      if (error) error.textContent = '';
      line.setAttribute('aria-busy', 'true');
      line.classList.add('is-updating');
      controls.forEach(function (el) {
        if (el.tagName === 'A') el.setAttribute('aria-disabled', 'true');
        else el.disabled = true;
      });

      this._ops += 1;
      this.status(str('updating'));
      this.flushNote();

      cartChange(key, quantity, [this.sectionId])
        .then(function (res) {
          var html = res && res.sections && res.sections[self.sectionId];
          if (html && self.render(html)) return true;
          return self.refresh();
        })
        .then(function () {
          self.status(quantity === 0 ? str('removed') : str('updated'));
        })
        .catch(function (err) {
          // Shopify said no (usually stock). Put the line back as it was.
          self._focusKey = null;
          self._focusLine = null;
          if (!doc.contains(line)) return;
          line.removeAttribute('aria-busy');
          line.classList.remove('is-updating');
          controls.forEach(function (el) {
            if (el.tagName === 'A') el.removeAttribute('aria-disabled');
            else el.disabled = false;
          });
          var input = line.querySelector('[data-qty-input]');
          if (input) input.value = line.getAttribute('data-quantity');
          if (error) error.textContent = errorText(err);
          if (trigger && doc.contains(trigger)) focusEl(trigger);
        })
        .then(function () {
          self._ops = Math.max(0, self._ops - 1);
        });
    }

    /* -- upsell --------------------------------------------------------- */
    onSubmit(e) {
      var form = e.target.closest('[data-upsell-form]');
      if (!form) {
        // Checkout: show it's working, and make sure the note goes with it.
        if (e.target.id === 'CartDrawerForm') {
          this.flushNote();
          var checkout = e.target.querySelector('[name="checkout"]');
          if (checkout) checkout.setAttribute('aria-busy', 'true');
        }
        return;
      }
      e.preventDefault();
      var self = this;
      var idField = form.querySelector('[name="id"]');
      var id = idField && parseInt(idField.value, 10);
      if (!id) return;
      var btn = form.querySelector('[type="submit"]');
      var error = this.querySelector('[data-upsell-error]');
      if (error) error.textContent = '';
      this._focusKey = 'upsell-add'; // gone after the re-render → focus falls back to the title
      setBusy(btn, true);
      this._ops += 1;

      cartAdd([{ id: id, quantity: 1 }], [this.sectionId])
        .then(function (res) {
          var item = null;
          var items = (res && res.cart && res.cart.items) || (res && res.items) || [];
          items.some(function (it) {
            if (it.variant_id === id || it.id === id) { item = it; return true; }
            return false;
          });
          if (item) self.setAdded(item);
          var html = res && res.sections && res.sections[self.sectionId];
          if (html && self.render(html)) return true;
          return self.refresh();
        })
        .then(function () {
          self.status(str('addedStatus'));
        })
        .catch(function (err) {
          self._focusKey = null;
          setBusy(btn, false);
          if (doc.contains(btn)) focusEl(btn);
          if (error) error.textContent = errorText(err);
        })
        .then(function () {
          self._ops = Math.max(0, self._ops - 1);
        });
    }
  }
  define('cart-drawer', CartDrawer);

  /* ---------------------------------------------------------------------
     <quick-add-drawer>
     ------------------------------------------------------------------- */
  class QuickAddDrawer extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.dialog = this.querySelector('dialog');
      this.body = this.querySelector('[data-quick-add-content]');
      if (!this.dialog || !this.body) return;
      wireDialog(this);
      this._offs = [
        listen('lunova:quickadd:open', function (e) { self.load(e.detail || {}); }),
        listen('lunova:cart:open', function () {
          if (self.hasAttribute('open')) self.close({ returnFocus: false });
        })
      ];
    }

    disconnectedCallback() {
      (this._offs || []).forEach(function (off) { off(); });
      if (this._abort) this._abort.abort();
      teardownDialog(this);
    }

    open(opts) {
      openDialog(this, opts);
    }

    close(opts) {
      if (this._abort) this._abort.abort();
      closeDialog(this, opts);
    }

    productUrl(detail) {
      if (detail.url) return detail.url;
      if (!detail.handle) return null;
      var base = routes().root || '/';
      if (base.charAt(base.length - 1) !== '/') base += '/';
      return base + 'products/' + encodeURIComponent(detail.handle);
    }

    ensureCss() {
      var href = this.getAttribute('data-product-css');
      var existing = doc.querySelector('link[rel="stylesheet"][href*="product.css"]');
      if (existing || !href) return Promise.resolve();
      return new Promise(function (resolve) {
        var link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = link.onerror = function () { resolve(); };
        doc.head.appendChild(link);
        setTimeout(resolve, 2500);
      });
    }

    ensureJs() {
      if (customElements.get('product-form')) return;
      var src = this.getAttribute('data-product-js');
      if (!src || doc.querySelector('script[src*="product.js"]')) return;
      var s = doc.createElement('script');
      s.src = src;
      s.defer = true;
      doc.head.appendChild(s);
    }

    showSkeleton() {
      var tpl = this.querySelector('template[data-quick-add-skeleton]');
      this.body.innerHTML = '';
      if (tpl) this.body.appendChild(tpl.content.cloneNode(true));
      this.body.setAttribute('aria-busy', 'true');
      this.dialog.setAttribute('aria-labelledby', 'QuickAddTitle');
    }

    showError(url) {
      this.body.removeAttribute('aria-busy');
      this.body.innerHTML = '';
      var wrap = doc.createElement('div');
      wrap.className = 'quick-add__error';
      var p = doc.createElement('p');
      p.setAttribute('role', 'alert');
      p.textContent = str('quickAddError') || 'Sorry, we couldn’t load this one just now.';
      wrap.appendChild(p);
      if (url) {
        var a = doc.createElement('a');
        a.className = 'btn btn--secondary';
        a.href = url;
        a.textContent = str('quickAddErrorLink') || 'Open the product page';
        wrap.appendChild(a);
      }
      this.body.appendChild(wrap);
    }

    load(detail) {
      var self = this;
      var url = this.productUrl(detail);
      if (!url) return;
      var token = {};
      this._token = token;
      if (this._abort) this._abort.abort();
      this._abort = 'AbortController' in window ? new AbortController() : null;

      this.ensureJs();
      this.showSkeleton();
      this.open({ opener: detail.trigger || detail.opener || doc.activeElement });

      var u;
      try {
        u = new URL(url, location.origin);
      } catch (e) {
        this.showError(null);
        return;
      }
      u.searchParams.set('section_id', this.getAttribute('data-section-id') || 'quick-add-product');

      Promise.all([
        fetch(u.toString(), {
          credentials: 'same-origin',
          signal: this._abort ? this._abort.signal : undefined
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        }),
        this.ensureCss()
      ])
        .then(function (results) {
          if (self._token !== token) return;
          var parsed = new DOMParser().parseFromString(results[0], 'text/html');
          var product = parsed.querySelector('[data-quick-add-product]');
          if (!product || !product.firstElementChild) throw new Error('empty');
          self.body.innerHTML = '';
          self.body.appendChild(doc.importNode(product, true));
          self.body.removeAttribute('aria-busy');
          self.ensureJs();
          var injected = self.body.querySelector('[data-quick-add-product]');
          // Let global.js / product.js run their per-section set-up (countdown,
          // finder name, recommended size) on the new markup, the same way
          // they do when the theme editor reloads a section.
          injected.dispatchEvent(new CustomEvent('shopify:section:load', {
            bubbles: true,
            detail: { sectionId: self.getAttribute('data-section-id') || 'quick-add-product' }
          }));
          var title = self.body.querySelector('#QuickAddProductTitle');
          if (title) {
            self.dialog.setAttribute('aria-labelledby', 'QuickAddProductTitle');
            if (self.hasAttribute('open')) focusEl(title);
          }
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          if (self._token !== token) return;
          self.showError(url);
        });
    }
  }
  define('quick-add-drawer', QuickAddDrawer);

  /* product.js / product.css are no longer loaded on every page for quick
     add. Start fetching them the moment a shopper heads for a quick add
     button, in parallel with the section fetch the tap will make. Both
     ensure* methods are idempotent; the listeners go once they have run. */
  (function () {
    var types = ['pointerover', 'touchstart', 'focusin'];
    function warm(e) {
      var q = e.target && e.target.closest && e.target.closest('[data-quick-add]');
      if (!q) return;
      var d = doc.querySelector('quick-add-drawer');
      if (!d || typeof d.ensureJs !== 'function') return;
      d.ensureJs();
      d.ensureCss();
      types.forEach(function (t) { doc.removeEventListener(t, warm, true); });
    }
    types.forEach(function (t) { doc.addEventListener(t, warm, { passive: true, capture: true }); });
  })();

  /* ---------------------------------------------------------------------
     Global delegation: links to /cart open the drawer; single-variant
     quick add from product cards goes straight in.
     ------------------------------------------------------------------- */
  function drawerEl() {
    var d = doc.querySelector('cart-drawer');
    return d && typeof d.open === 'function' ? d : null;
  }

  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var drawer = drawerEl();
    if (!drawer || drawer.disabled || settings().cartType === 'page') return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    var path = url.pathname.replace(/\/$/, '');
    var target = (cartUrl() || '/cart').replace(/\/$/, '');
    if (path !== target) return;
    e.preventDefault();
    drawer.open({ opener: a });
  });

  function quickAddSingle(form, trigger, variantId, quantity) {
    var drawer = drawerEl();
    var sid = drawer ? drawer.sectionId : null;
    var btn = trigger || (form && form.querySelector('[type="submit"]'));
    var scope = (form || trigger).closest('[data-product-card], .product-card') || form || trigger.parentElement;
    var oldError = scope && scope.querySelector('[data-quick-add-error]');
    if (oldError) {
      oldError.textContent = '';
      oldError.hidden = true;
    }
    setBusy(btn, true);
    if (drawer) drawer._ops += 1;
    var result = null;

    cartAdd([{ id: variantId, quantity: quantity }], sid ? [sid] : [])
      .then(function (res) {
        result = res;
        if (!drawer) return true;
        var html = res && res.sections && res.sections[sid];
        if (html && drawer.render(html)) return true;
        return drawer.refresh();
      })
      .then(function () {
        var items = (result && result.cart && result.cart.items) || (result && result.items) || [];
        var added = null;
        items.some(function (it) {
          if (it.variant_id === variantId || it.id === variantId) { added = it; return true; }
          return false;
        });
        if (drawer) drawer._ops = Math.max(0, drawer._ops - 1);
        setBusy(btn, false);
        emit('lunova:cart:open', { added: added || { variant_id: variantId }, reason: 'quick-add', opener: btn });
      })
      .catch(function (err) {
        if (drawer) drawer._ops = Math.max(0, drawer._ops - 1);
        setBusy(btn, false);
        var slot = scope && scope.querySelector('[data-quick-add-error]');
        if (!slot) {
          slot = doc.createElement('p');
          slot.className = 'quick-add-error';
          slot.setAttribute('role', 'alert');
          slot.setAttribute('data-quick-add-error', '');
          (form || trigger).insertAdjacentElement('afterend', slot);
        }
        slot.textContent = errorText(err);
        slot.hidden = false;
      });
  }

  doc.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    var form = e.target.closest && e.target.closest('form[data-quick-add-single]');
    if (!form) return;
    var idField = form.querySelector('[name="id"]');
    var id = idField && parseInt(idField.value, 10);
    if (!id) return; // let the form post normally
    e.preventDefault();
    var qtyField = form.querySelector('[name="quantity"]');
    var qty = qtyField ? Math.max(1, parseInt(qtyField.value, 10) || 1) : 1;
    quickAddSingle(form, e.submitter || null, id, qty);
  });

  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    var btn = e.target.closest && e.target.closest('button[data-quick-add-single][data-variant-id]');
    if (!btn || btn.form) return; // buttons inside a form are handled on submit
    var id = parseInt(btn.getAttribute('data-variant-id'), 10);
    if (!id) return;
    e.preventDefault();
    quickAddSingle(null, btn, id, 1);
  });

  // Back/forward cache: the page can come back with an old basket.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    var drawer = drawerEl();
    if (drawer && !isCartTemplate()) drawer.refresh();
    else fetchCart().then(function (cart) { if (cart) updateCounts(cart.item_count); }).catch(function () {});
  });

  /* ---------------------------------------------------------------------
     <site-header>
     ------------------------------------------------------------------- */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.section = this.closest('.shopify-section') || this.parentElement || this;
      this.bar = this.querySelector('[data-header-bar]') || this;
      this.mode = this.getAttribute('data-sticky') || 'always';
      this.condense = this.getAttribute('data-condense') === 'true';
      this.lastY = window.pageYOffset || 0;
      this._hidden = false;
      this._condensed = false;

      this.section.classList.add('header-section--' + this.mode.replace('_', '-'));

      this._onScroll = function () {
        if (self._ticking) return;
        self._ticking = true;
        requestAnimationFrame(function () {
          self._ticking = false;
          self.onScroll();
        });
      };
      this._measure = this.measure.bind(this);
      if (this.mode !== 'none') window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._measure);
      if ('ResizeObserver' in window) {
        this._ro = new ResizeObserver(this._measure);
        this._ro.observe(this.bar);
      }
      // First measure a frame later: writing --header-h on <html> and then
      // reading layout here would force a full style recalc while cart.js is
      // still evaluating. --header-reserve only reserves the height the bar
      // already has, so the first frame looks the same.
      requestAnimationFrame(function () {
        self.measure();
        self.onScroll();
      });

      // Menu drawer toggle(s)
      this.querySelectorAll('[data-menu-open]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var drawer = doc.getElementById(btn.getAttribute('aria-controls') || 'MenuDrawer');
          if (drawer && typeof drawer.open === 'function') drawer.open(btn);
        });
      });

      this.initDropdowns();
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._measure);
      if (this._ro) this._ro.disconnect();
      if (this._offDoc) this._offDoc();
    }

    measure() {
      var h = Math.round(this.bar.getBoundingClientRect().height);
      if (!h) return;
      if (!this._condensed) {
        // Reserve the full height so condensing never shifts the page.
        this.section.style.setProperty('--header-reserve', h + 'px');
      }
      if (this.mode === 'always') {
        this.setHeaderH(h);
        return;
      }
      // Not sticky, or tucked away on scroll: nothing covers the top of the
      // page, so sticky elements elsewhere should sit at 0. Written a frame
      // later so it lands after global.js's own [data-site-header] measure.
      var self = this;
      var visible = this.mode === 'none' || this._hidden ? 0 : h;
      requestAnimationFrame(function () {
        self.setHeaderH(visible);
      });
    }

    /* --header-h is inherited from <html>, so every write restyles the whole
       page: only write it when the value actually changes. */
    setHeaderH(px) {
      if (this._headerH === px) return;
      this._headerH = px;
      root.style.setProperty('--header-h', px + 'px');
    }

    onScroll() {
      var y = Math.max(0, window.pageYOffset || 0);
      var anyOpen = !!this.querySelector('details[data-nav-dropdown][open]') || this.contains(doc.activeElement);

      if (this.condense && this.mode !== 'none') {
        var condensed = y > 48;
        if (condensed !== this._condensed) {
          this._condensed = condensed;
          this.classList.toggle('is-condensed', condensed);
        }
      }
      this.classList.toggle('is-scrolled', y > 4);

      if (this.mode === 'scroll_up') {
        var reserve = parseFloat(getComputedStyle(this.section).getPropertyValue('--header-reserve')) || 80;
        var delta = y - this.lastY;
        var hide = this._hidden;
        if (y < reserve * 2 || anyOpen) hide = false;
        else if (delta > 6) hide = true;
        else if (delta < -6) hide = false;
        if (hide !== this._hidden) {
          this._hidden = hide;
          this.section.classList.toggle('is-hidden', hide);
          this.measure();
        }
      }
      this.lastY = y;
    }

    initDropdowns() {
      var self = this;
      var items = Array.prototype.slice.call(this.querySelectorAll('details[data-nav-dropdown]'));
      if (!items.length) return;

      function closeAll(except) {
        items.forEach(function (d) { if (d !== except && d.open) d.open = false; });
      }

      items.forEach(function (d) {
        var li = d.parentElement;
        var summary = d.querySelector('summary');
        var openTimer;
        var closeTimer;

        li.addEventListener('mouseenter', function () {
          if (!finePointer.matches) return;
          clearTimeout(closeTimer);
          openTimer = setTimeout(function () {
            d.setAttribute('data-hover-open', String(Date.now()));
            d.open = true;
          }, 80);
        });
        li.addEventListener('mouseleave', function () {
          if (!finePointer.matches) return;
          clearTimeout(openTimer);
          closeTimer = setTimeout(function () {
            if (!d.contains(doc.activeElement) || doc.activeElement === summary) d.open = false;
          }, 220);
        });
        summary.addEventListener('click', function (e) {
          // Opened a moment ago by hover: a click shouldn't snap it shut.
          var t = parseInt(d.getAttribute('data-hover-open'), 10) || 0;
          if (d.open && Date.now() - t < 600) e.preventDefault();
        });
        d.addEventListener('toggle', function () {
          summary.setAttribute('aria-expanded', d.open ? 'true' : 'false');
          if (d.open) closeAll(d);
          else d.removeAttribute('data-hover-open');
        });
        d.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && d.open) {
            e.preventDefault();
            e.stopPropagation();
            d.open = false;
            focusEl(summary);
          }
        });
        d.addEventListener('focusout', function (e) {
          if (e.relatedTarget && !d.contains(e.relatedTarget)) d.open = false;
        });
      });

      this._offDoc = listen('click', function (e) {
        if (!self.contains(e.target)) closeAll(null);
        else {
          var inside = e.target.closest('details[data-nav-dropdown]');
          closeAll(inside);
        }
      });
    }
  }
  define('site-header', SiteHeader);

  /* ---------------------------------------------------------------------
     <menu-drawer>
     ------------------------------------------------------------------- */
  class MenuDrawer extends HTMLElement {
    connectedCallback() {
      var self = this;
      if (!this.querySelector('dialog')) return;
      wireDialog(this);
      this.addEventListener('click', function (e) {
        var a = e.target.closest('a[href]');
        if (!a || !self.contains(a)) return;
        // Same-page anchors don't navigate, so close the drawer for them.
        try {
          var u = new URL(a.href, location.href);
          if (u.pathname === location.pathname && u.hash) self.close({ returnFocus: false });
        } catch (err) { /* ignore */ }
      });
      this._mq = window.matchMedia('(min-width: 990px)');
      this._onMq = function () {
        if (self._mq.matches && self.hasAttribute('open')) self.close({ returnFocus: false });
      };
      if (this._mq.addEventListener) this._mq.addEventListener('change', this._onMq);
    }

    disconnectedCallback() {
      if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener('change', this._onMq);
      teardownDialog(this);
    }

    setExpanded(value) {
      if (!this.id) return;
      doc.querySelectorAll('[aria-controls="' + this.id + '"]').forEach(function (btn) {
        btn.setAttribute('aria-expanded', value ? 'true' : 'false');
      });
    }

    open(opener) {
      openDialog(this, { opener: opener });
      this.setExpanded(true);
    }

    close(opts) {
      closeDialog(this, opts);
      this.setExpanded(false);
    }
  }
  define('menu-drawer', MenuDrawer);

  /* ---------------------------------------------------------------------
     <announcement-bar>
     ------------------------------------------------------------------- */
  var desktopMq = window.matchMedia('(min-width: 990px)');

  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.slides = Array.prototype.slice.call(this.querySelectorAll('[data-slide]'));
      this.region = this.querySelector('[data-slides]');
      this.index = Math.max(0, this.slides.findIndex(function (s) { return s.classList.contains('is-active'); }));
      this.autoplay = this.getAttribute('data-autoplay') === 'true';
      this.speed = Math.max(4, parseInt(this.getAttribute('data-speed'), 10) || 5) * 1000;
      this.rowOnDesktop = this.getAttribute('data-desktop') === 'row';
      this.stopped = false;
      this.paused = false;
      this.editing = false;

      if (this.slides.length < 2) return;

      var prev = this.querySelector('[data-prev]');
      var next = this.querySelector('[data-next]');
      if (prev) prev.addEventListener('click', function () { self.manual(-1); });
      if (next) next.addEventListener('click', function () { self.manual(1); });

      // Hover pauses for mouse users only: a tap fires mouseenter with no leave.
      this.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') self.paused = true; });
      this.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') self.paused = false; });
      this.addEventListener('focusin', function () { self.paused = true; });
      this.addEventListener('focusout', function (e) {
        if (!self.contains(e.relatedTarget)) self.paused = false;
      });

      this._onMq = function () { self.layout(); };
      if (desktopMq.addEventListener) desktopMq.addEventListener('change', this._onMq);
      if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', this._onMq);

      // Theme editor: show the announcement being edited and hold it there
      // while it's selected; rotation resumes when it's deselected.
      this._onBlockSelect = function (e) {
        var slide = e.target && e.target.closest && e.target.closest('[data-slide]');
        var i = slide && self.contains(slide) ? self.slides.indexOf(slide) : -1;
        if (i < 0) return;
        self.editing = true;
        clearInterval(self._timer);
        if (!self.isRow) self.show(i, false);
      };
      this._onBlockDeselect = function (e) {
        if (!self.editing || !(e.target && self.contains(e.target))) return;
        self.editing = false;
        self.layout();
      };
      doc.addEventListener('shopify:block:select', this._onBlockSelect);
      doc.addEventListener('shopify:block:deselect', this._onBlockDeselect);
      this.layout();
    }

    disconnectedCallback() {
      clearInterval(this._timer);
      if (desktopMq.removeEventListener && this._onMq) desktopMq.removeEventListener('change', this._onMq);
      if (reduceMotion.removeEventListener && this._onMq) reduceMotion.removeEventListener('change', this._onMq);
      if (this._onBlockSelect) doc.removeEventListener('shopify:block:select', this._onBlockSelect);
      if (this._onBlockDeselect) doc.removeEventListener('shopify:block:deselect', this._onBlockDeselect);
    }

    get isRow() {
      return this.rowOnDesktop && desktopMq.matches;
    }

    layout() {
      var self = this;
      clearInterval(this._timer);
      this.classList.toggle('is-row', this.isRow);
      if (this.isRow) {
        this.slides.forEach(function (s) {
          s.removeAttribute('aria-hidden');
          s.inert = false;
          s.classList.add('is-active');
        });
        return;
      }
      this.show(this.index, false);
      if (this.autoplay && !this.stopped && !this.editing && !reduceMotion.matches) {
        this._timer = setInterval(function () {
          if (self.paused || doc.hidden) return;
          self.step(1, false);
        }, this.speed);
      }
    }

    usable(slide) {
      // A countdown that global.js has hidden (delivery off, unavailable) is skipped.
      var countdown = slide.querySelector('[data-countdown]');
      return !(countdown && countdown.hidden);
    }

    step(dir, announce) {
      var n = this.slides.length;
      var i = this.index;
      for (var tries = 0; tries < n; tries += 1) {
        i = (i + dir + n) % n;
        if (this.usable(this.slides[i])) break;
      }
      this.show(i, announce);
    }

    manual(dir) {
      // Using the arrows stops the rotation for good: the shopper is in charge.
      this.stopped = true;
      clearInterval(this._timer);
      this.step(dir, true);
    }

    show(i, announce) {
      this.index = i;
      if (this.region) this.region.setAttribute('aria-live', announce ? 'polite' : 'off');
      this.slides.forEach(function (s, idx) {
        var active = idx === i;
        s.classList.toggle('is-active', active);
        if (active) s.removeAttribute('aria-hidden');
        else s.setAttribute('aria-hidden', 'true');
        s.inert = !active;
      });
    }
  }
  define('announcement-bar', AnnouncementBar);

  /* ---------------------------------------------------------------------
     Footer: link columns collapse into disclosures on phones.
     Without JS every column simply stays open.
     ------------------------------------------------------------------- */
  var footerMq = window.matchMedia('(min-width: 750px)');

  function initFooter(scope) {
    (scope || doc).querySelectorAll('[data-footer]').forEach(function (footer) {
      if (footer._lunovaFooter) return;
      footer._lunovaFooter = true;
      var cols = Array.prototype.slice.call(footer.querySelectorAll('[data-footer-toggle]'));
      if (!cols.length) return;

      function apply() {
        var mobile = !footerMq.matches;
        cols.forEach(function (btn) {
          var panel = doc.getElementById(btn.getAttribute('aria-controls'));
          var label = btn.parentElement.querySelector('[data-footer-label]');
          btn.hidden = !mobile;
          if (label) label.hidden = mobile;
          if (!panel) return;
          if (mobile) {
            var expanded = btn.getAttribute('data-open') === 'true';
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            panel.hidden = !expanded;
          } else {
            btn.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
          }
        });
      }

      cols.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') !== 'true';
          btn.setAttribute('data-open', open ? 'true' : 'false');
          apply();
        });
      });
      footer.classList.add('is-enhanced');
      if (footerMq.addEventListener) footerMq.addEventListener('change', apply);
      apply();
    });
  }

  /* ---------------------------------------------------------------------
     Boot + theme editor
     ------------------------------------------------------------------- */
  function boot() { initFooter(doc); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  doc.addEventListener('shopify:section:load', function (e) { initFooter(e.target); });

  // Theme editor: show the drawer while its section is selected.
  doc.addEventListener('shopify:section:select', function (e) {
    var t = e.target;
    if (!t || !t.querySelector) return;
    var drawer = t.querySelector('cart-drawer');
    if (drawer && !drawer.disabled) drawer.open();
  });
  doc.addEventListener('shopify:section:deselect', function (e) {
    var t = e.target;
    if (!t || !t.querySelector) return;
    var drawer = t.querySelector('cart-drawer');
    if (drawer) drawer.close({ returnFocus: false });
  });
})();
