/* ==========================================================================
   SNOOZLY — storefront behaviour
   Source: snoozly/src/js/*.js, concatenated into theme/assets/snoozly.js by
   snoozly/scripts/build.py. Vanilla JS, custom elements, no dependencies.
   Every feature works without JavaScript first (real forms and links) and is
   enhanced here.
   ========================================================================== */
(() => {
  'use strict';

  const SZ = (window.Snoozly = window.Snoozly || {});
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  SZ.$ = $;
  SZ.$$ = $$;

  SZ.debounce = (fn, wait = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  SZ.fetchJSON = async (url, opts = {}) => {
    const res = await fetch(url, {
      ...opts,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.description || data.message || SZ.strings.cartError);
      err.status = res.status;
      throw err;
    }
    return data;
  };

  SZ.parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  SZ.toast = (msg, ms = 3200) => {
    const el = $('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(SZ._toastT);
    SZ._toastT = setTimeout(() => { el.hidden = true; }, ms);
  };

  /* Focus trap + scroll lock shared by every overlay */
  const FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';
  SZ.trapFocus = (container) => {
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', handler);
    return () => container.removeEventListener('keydown', handler);
  };
  let lockCount = 0;
  SZ.lockScroll = (on) => {
    lockCount = Math.max(0, lockCount + (on ? 1 : -1));
    document.body.classList.toggle('is-locked', lockCount > 0);
  };

  /* ---------------------------------------------------------------------
     <sz-drawer> — menu, search, basket, filters, size guide
     --------------------------------------------------------------------- */
  class SzDrawer extends HTMLElement {
    connectedCallback() {
      this.panel = $('.drawer__panel', this);
      this.addEventListener('click', (e) => {
        if (e.target.closest('[data-drawer-close]')) { e.preventDefault(); this.close(); }
      });
      this.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    }
    open(opener) {
      if (this.classList.contains('is-open')) return;
      $$('sz-drawer.is-open').forEach((d) => d !== this && d.close(false));
      this.opener = opener || document.activeElement;
      this.removeAttribute('aria-hidden');
      this.classList.add('is-open');
      SZ.lockScroll(true);
      this.releaseTrap = SZ.trapFocus(this.panel);
      $$(`[aria-controls="${this.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'true'));
      requestAnimationFrame(() => {
        const auto = $('[data-psearch-input], [autofocus]', this.panel);
        (auto || this.panel).focus({ preventScroll: true });
      });
      this.dispatchEvent(new CustomEvent('drawer:open', { bubbles: true }));
    }
    close(restore = true) {
      if (!this.classList.contains('is-open')) return;
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      SZ.lockScroll(false);
      if (this.releaseTrap) this.releaseTrap();
      $$(`[aria-controls="${this.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (restore && this.opener && document.contains(this.opener)) this.opener.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent('drawer:close', { bubbles: true }));
    }
  }
  customElements.define('sz-drawer', SzDrawer);

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-drawer-open]');
    if (!opener) return;
    const drawer = document.getElementById(opener.dataset.drawerOpen);
    if (!drawer) return;
    e.preventDefault();
    drawer.open(opener);
  });

  /* ---------------------------------------------------------------------
     Sticky header: shadow once scrolled, and keep --header-h honest
     --------------------------------------------------------------------- */
  class StickyHeader extends HTMLElement {
    connectedCallback() {
      const onScroll = () => this.classList.toggle('is-scrolled', window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      const header = $('[data-header]', this);
      if (header && 'ResizeObserver' in window) {
        new ResizeObserver(() => {
          document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
        }).observe(header);
      }
      this.initNav();
    }
    initNav() {
      const items = $$('[data-nav-item]', this);
      const closeAll = (except) => items.forEach((it) => {
        if (it === except) return;
        it.classList.remove('is-open');
        const t = $('[data-nav-toggle]', it);
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      items.forEach((item) => {
        const toggle = $('[data-nav-toggle]', item);
        let timer;
        const open = () => {
          clearTimeout(timer);
          closeAll(item);
          item.classList.add('is-open');
          toggle.setAttribute('aria-expanded', 'true');
        };
        const close = () => {
          timer = setTimeout(() => {
            item.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
          }, 140);
        };
        toggle.addEventListener('click', () => (item.classList.contains('is-open') ? (clearTimeout(timer), item.classList.remove('is-open'), toggle.setAttribute('aria-expanded', 'false')) : open()));
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          item.addEventListener('mouseenter', open);
          item.addEventListener('mouseleave', close);
        }
        item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) close(); });
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && item.classList.contains('is-open')) {
            item.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.focus();
          }
        });
      });
      document.addEventListener('click', (e) => { if (!this.contains(e.target)) closeAll(); });
    }
  }
  customElements.define('sticky-header', StickyHeader);

  /* ---------------------------------------------------------------------
     Announcement rotator — pauses on hover and when the tab is hidden
     --------------------------------------------------------------------- */
  class AnnouncementRotator extends HTMLElement {
    connectedCallback() {
      this.msgs = $$('.announce__msg', this);
      if (this.msgs.length < 2) return;
      this.i = 0;
      this.ms = Number(this.dataset.interval) || 5000;
      this.addEventListener('mouseenter', () => this.stop());
      this.addEventListener('mouseleave', () => this.start());
      this.addEventListener('focusin', () => this.stop());
      this.addEventListener('focusout', () => this.start());
      document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.start();
    }
    start() { this.stop(); this.t = setInterval(() => this.next(), this.ms); }
    stop() { clearInterval(this.t); }
    next() {
      const out = this.msgs[this.i];
      out.classList.remove('is-active');
      out.setAttribute('aria-hidden', 'true');
      out.inert = true;
      this.i = (this.i + 1) % this.msgs.length;
      const next = this.msgs[this.i];
      next.classList.add('is-active');
      next.removeAttribute('aria-hidden');
      next.inert = false;
    }
  }
  customElements.define('announcement-rotator', AnnouncementRotator);

  /* ---------------------------------------------------------------------
     Reveal on scroll
     --------------------------------------------------------------------- */
  SZ.initReveal = (root = document) => {
    const els = $$('[data-reveal]:not(.is-in)', root);
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || !document.documentElement.classList.contains('has-reveal')) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  };

  document.addEventListener('DOMContentLoaded', () => SZ.initReveal());
  document.addEventListener('shopify:section:load', (e) => {
    SZ.initReveal(e.target);
    $$('[data-reveal]', e.target).forEach((el) => el.classList.add('is-in'));
  });
})();
