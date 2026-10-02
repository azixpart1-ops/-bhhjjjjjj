/*
 * Lunova — popup.js (chrome area)
 *
 * <email-popup>: a polite, honest email capture.
 *   - desktop: shows when the pointer leaves through the top of the window
 *     (exit intent), or after the delay if exit intent is off
 *   - mobile: after the delay (default 25s), only while the page is visible
 *   - at most once every N days (Lunova.store), never again after a signup
 *   - waits if any other dialog is open; skipped with something in the basket
 *     when the merchant chooses that
 *   - after a successful signup the page reloads (Shopify customer form);
 *     the pop-up re-opens on the "thank you" state with the code, if any
 *
 * Loaded by sections/email-popup.liquid only when the section is added.
 */
(function () {
  'use strict';

  if (window.__lunovaPopup) return;
  window.__lunovaPopup = true;

  var L = (window.Lunova = window.Lunova || {});
  var doc = document;
  var KEY = 'lunova:email-popup';
  var SUBMIT_KEY = 'lunova:email-popup:submitted';
  var DAY = 86400000;

  function storeGet(key) {
    if (L.store && typeof L.store.get === 'function') return L.store.get(key);
    try { return JSON.parse(window.localStorage.getItem(key)); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    if (L.store && typeof L.store.set === 'function') return L.store.set(key, value);
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  function sessionGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function sessionSet(key, value) {
    try {
      if (value === null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch (e) { /* ignore */ }
  }

  function isVisible(el) {
    return !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }

  function anotherDialogOpen(self) {
    var open = doc.querySelectorAll('dialog[open], [aria-modal="true"]');
    for (var i = 0; i < open.length; i += 1) {
      if (!self.contains(open[i]) && isVisible(open[i])) return true;
    }
    return false;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      try {
        doc.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      }
      ta.remove();
    });
  }

  class EmailPopup extends HTMLElement {
    connectedCallback() {
      var self = this;
      this.dialog = this.querySelector('dialog');
      if (!this.dialog) return;

      this.sectionId = this.getAttribute('data-section-id');
      this.days = Math.max(1, parseInt(this.getAttribute('data-days'), 10) || 14);
      this.delay = Math.max(5, parseInt(this.getAttribute('data-delay'), 10) || 25) * 1000;
      this.exitIntent = this.getAttribute('data-exit-intent') === 'true';
      this.hideIfCart = this.getAttribute('data-hide-if-cart') === 'true';
      this.cartCount = parseInt(this.getAttribute('data-cart-count'), 10) || 0;
      this.designMode = this.hasAttribute('data-design-mode') || !!(window.Shopify && window.Shopify.designMode);

      this.wire();

      this._onCart = function (e) {
        var cart = e.detail && e.detail.cart;
        if (cart && typeof cart.item_count === 'number') self.cartCount = cart.item_count;
      };
      doc.addEventListener('lunova:cart:updated', this._onCart);

      var stateEl = this.querySelector('[data-popup-state]');
      var state = stateEl ? stateEl.getAttribute('data-popup-state') : 'idle';
      var submitted = sessionGet(SUBMIT_KEY);

      if (state === 'success') {
        // Any newsletter signup on this page (footer too) counts: don't ask again.
        this.remember({ subscribed: true });
        if (submitted) {
          sessionSet(SUBMIT_KEY, null);
          this.open();
        }
        return;
      }
      if (state === 'error' && submitted) {
        sessionSet(SUBMIT_KEY, null);
        this.open();
        return;
      }

      if (this.designMode) {
        this._onSelect = function (e) {
          if (e.detail && e.detail.sectionId === self.sectionId) self.open();
        };
        this._onDeselect = function (e) {
          if (e.detail && e.detail.sectionId === self.sectionId) self.close({ returnFocus: false, silent: true });
        };
        doc.addEventListener('shopify:section:select', this._onSelect);
        doc.addEventListener('shopify:section:deselect', this._onDeselect);
        return;
      }

      if (this.eligible()) this.arm();
    }

    disconnectedCallback() {
      this.disarm();
      doc.removeEventListener('lunova:cart:updated', this._onCart);
      if (this._onSelect) doc.removeEventListener('shopify:section:select', this._onSelect);
      if (this._onDeselect) doc.removeEventListener('shopify:section:deselect', this._onDeselect);
      if (L.chromeDialog) L.chromeDialog.teardown(this);
    }

    wire() {
      var self = this;
      if (L.chromeDialog) {
        L.chromeDialog.wire(this);
      } else {
        this.dialog.addEventListener('cancel', function (e) {
          e.preventDefault();
          self.close();
        });
        this.addEventListener('click', function (e) {
          if (e.target.closest('[data-close]')) self.close();
        });
      }

      var form = this.querySelector('form');
      if (form) {
        form.addEventListener('submit', function () {
          sessionSet(SUBMIT_KEY, String(Date.now()));
          var btn = form.querySelector('[type="submit"]');
          if (btn) btn.setAttribute('aria-busy', 'true');
        });
      }

      this.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-copy-code]');
        if (!btn) return;
        var codeEl = self.querySelector('[data-code]');
        if (!codeEl) return;
        var label = btn.textContent;
        copyText(codeEl.textContent.trim()).then(function () {
          btn.textContent = btn.getAttribute('data-copied-text') || label;
          setTimeout(function () { btn.textContent = label; }, 2000);
        }).catch(function () {
          // Select the code so it can be copied by hand.
          var range = doc.createRange();
          range.selectNodeContents(codeEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        });
      });
    }

    remember(patch) {
      var saved = storeGet(KEY) || {};
      Object.keys(patch).forEach(function (k) { saved[k] = patch[k]; });
      storeSet(KEY, saved);
    }

    eligible() {
      var saved = storeGet(KEY) || {};
      if (saved.subscribed) return false;
      if (saved.seenAt && Date.now() - saved.seenAt < this.days * DAY) return false;
      return true;
    }

    arm() {
      var self = this;
      var desktop = window.matchMedia('(min-width: 990px) and (hover: hover) and (pointer: fine)').matches;
      if (desktop && this.exitIntent) {
        var armedAt = Date.now();
        this._onLeave = function (e) {
          // Pointer left the page through the top edge (towards tabs / address bar).
          if (e.relatedTarget || e.clientY > 0) return;
          if (Date.now() - armedAt < 5000) return;
          self.trigger();
        };
        doc.documentElement.addEventListener('mouseleave', this._onLeave);
      } else {
        this._timer = setTimeout(function () { self.trigger(); }, this.delay);
      }
    }

    disarm() {
      clearTimeout(this._timer);
      clearTimeout(this._retry);
      if (this._onLeave) doc.documentElement.removeEventListener('mouseleave', this._onLeave);
      if (this._onVisible) doc.removeEventListener('visibilitychange', this._onVisible);
      this._onLeave = null;
      this._onVisible = null;
    }

    trigger() {
      var self = this;
      if (this._shown || !this.eligible()) return;
      if (this.hideIfCart && this.cartCount > 0) return;
      if (doc.hidden) {
        // Wait until they're actually looking.
        if (!this._onVisible) {
          this._onVisible = function () {
            if (doc.hidden) return;
            doc.removeEventListener('visibilitychange', self._onVisible);
            self._onVisible = null;
            self._retry = setTimeout(function () { self.trigger(); }, 1500);
          };
          doc.addEventListener('visibilitychange', this._onVisible);
        }
        return;
      }
      if (anotherDialogOpen(this)) {
        // Never on top of the basket, the finder or the menu. Try again later.
        clearTimeout(this._retry);
        this._retry = setTimeout(function () { self.trigger(); }, 8000);
        return;
      }
      this._shown = true;
      this.disarm();
      this.remember({ seenAt: Date.now() });
      this.open();
    }

    open() {
      if (L.chromeDialog) {
        L.chromeDialog.open(this, { opener: doc.activeElement });
      } else {
        try { this.dialog.showModal(); } catch (e) { this.dialog.setAttribute('open', ''); }
        this.setAttribute('open', '');
        this.dialog.classList.add('is-open');
        var focus = this.querySelector('[data-dialog-focus]');
        if (focus) focus.focus();
      }
    }

    close(opts) {
      opts = opts || {};
      if (!opts.silent && !this.designMode) this.remember({ seenAt: Date.now() });
      if (L.chromeDialog) {
        L.chromeDialog.close(this, opts);
      } else {
        this.removeAttribute('open');
        this.dialog.classList.remove('is-open');
        if (this.dialog.open) this.dialog.close();
      }
    }
  }

  if (!customElements.get('email-popup')) customElements.define('email-popup', EmailPopup);
})();
