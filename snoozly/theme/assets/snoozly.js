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

/* ---------------------------------------------------------------------
   Basket engine. All maths and money formatting stay with Shopify: after
   every change we ask the Section Rendering API for fresh HTML.
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $, $$ } = SZ;

  const sectionsToRender = () => {
    const ids = [];
    const drawer = $('[data-cart-drawer]');
    if (drawer) ids.push(drawer.dataset.section);
    const page = $('[data-cart-page]');
    if (page) ids.push(page.dataset.section);
    return ids;
  };

  const setCount = (count) => {
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.hidden = count === 0;
      el.classList.remove('is-bump');
      void el.offsetWidth;
      if (count > 0) el.classList.add('is-bump');
    });
  };

  const applySections = (sections) => {
    if (!sections) return;
    const drawer = $('[data-cart-drawer]');
    if (drawer && sections[drawer.dataset.section]) {
      const doc = SZ.parseHTML(sections[drawer.dataset.section]);
      const fresh = $('[data-cart-drawer]', doc);
      if (fresh) {
        const panel = $('.drawer__panel', drawer);
        const scrollTop = ($('.drawer__body', panel) || {}).scrollTop || 0;
        panel.innerHTML = $('.drawer__panel', fresh).innerHTML;
        drawer.dataset.count = fresh.dataset.count;
        const body = $('.drawer__body', panel);
        if (body) body.scrollTop = scrollTop;
        if (drawer.classList.contains('is-open') && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
        setCount(Number(fresh.dataset.count));
      }
    }
    const page = $('[data-cart-page]');
    if (page && sections[page.dataset.section]) {
      const doc = SZ.parseHTML(sections[page.dataset.section]);
      const fresh = $('[data-cart-page]', doc);
      if (fresh) {
        page.innerHTML = fresh.innerHTML;
        setCount(Number(fresh.dataset.count));
      }
    }
    SZ.loadUpsell();
  };

  SZ.cart = {
    async add(formData) {
      const ids = sectionsToRender();
      if (ids.length) {
        formData.append('sections', ids.join(','));
        formData.append('sections_url', window.location.pathname);
      }
      const res = await fetch(`${SZ.routes.cartAdd}.js`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || data.status) {
        const err = new Error(data.description || data.message || SZ.strings.cartError);
        throw err;
      }
      applySections(data.sections);
      document.dispatchEvent(new CustomEvent('cart:added', { detail: data }));
      return data;
    },
    async change(line, quantity) {
      const lists = $$('.lines');
      lists.forEach((l) => l.classList.add('is-busy'));
      try {
        const data = await SZ.fetchJSON(`${SZ.routes.cartChange}.js`, {
          method: 'POST',
          body: JSON.stringify({ line, quantity, sections: sectionsToRender(), sections_url: window.location.pathname })
        });
        applySections(data.sections);
        if (data.item_count !== undefined) setCount(data.item_count);
        return data;
      } catch (err) {
        lists.forEach((l) => l.classList.remove('is-busy'));
        SZ.toast(err.message);
        this.refresh();
        throw err;
      }
    },
    async note(value) {
      return SZ.fetchJSON(`${SZ.routes.cartUpdate}.js`, { method: 'POST', body: JSON.stringify({ note: value }) });
    },
    async refresh() {
      const ids = sectionsToRender();
      if (!ids.length) return;
      const res = await fetch(`${window.location.pathname}?sections=${ids.join(',')}`);
      applySections(await res.json());
    },
    open(showAdded = false) {
      const drawer = $('[data-cart-drawer]');
      if (!drawer) { window.location.href = SZ.routes.cart; return; }
      const added = $('[data-cart-added]', drawer);
      if (added) added.hidden = !showAdded;
      drawer.open();
    }
  };

  /* Recommendations inside the basket: fetched once per distinct first item */
  SZ.loadUpsell = async () => {
    const box = $('[data-cart-drawer] [data-upsell]');
    if (!box || !box.dataset.url) return;
    if (box.dataset.loaded === box.dataset.url) return;
    box.dataset.loaded = box.dataset.url;
    try {
      const res = await fetch(box.dataset.url);
      const html = await res.text();
      const doc = SZ.parseHTML(html);
      const inner = $('.upsell__inner', doc);
      if (!inner) return;
      const exclude = (box.dataset.exclude || '').split(',');
      $$('[data-product-id]', inner).forEach((li) => { if (exclude.includes(li.dataset.productId)) li.remove(); });
      const items = $$('[data-product-id]', inner).slice(0, 3);
      if (!items.length) return;
      $$('[data-product-id]', inner).forEach((li) => { if (!items.includes(li)) li.remove(); });
      box.innerHTML = '';
      box.appendChild(inner);
    } catch (e) { /* suggestions are optional */ }
  };

  /* Typing into a flagged required field clears the flag and its message */
  document.addEventListener('input', (e) => {
    const f = e.target.closest('[data-required-field][aria-invalid]');
    if (!f || !f.value.trim()) return;
    f.removeAttribute('aria-invalid');
    const form = f.closest('form');
    const errorBox = form && $('[data-form-error]', form.closest('[data-product]') || form);
    if (errorBox && errorBox.textContent === f.dataset.requiredMessage) errorBox.hidden = true;
  });

  /* Any product form (PDP, quick add, upsell) goes through here */
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-product-form]');
    if (!form) return;
    const errorBox = $('[data-form-error]', form.closest('[data-product]') || form);
    /* Fields the form needs before it can be added (e.g. a name to embroider).
       The form is novalidate so the check and the message are ours, in both
       drawer and page mode. */
    const missing = $$('[data-required-field]', form).find((f) => !f.value.trim());
    $$('[data-required-field]', form).forEach((f) => f.removeAttribute('aria-invalid'));
    if (missing) {
      e.preventDefault();
      missing.setAttribute('aria-invalid', 'true');
      if (errorBox) { errorBox.textContent = missing.dataset.requiredMessage; errorBox.hidden = false; }
      missing.focus();
      missing.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (SZ.cartType !== 'drawer' || !$('[data-cart-drawer]')) return;
    e.preventDefault();
    const btn = e.submitter || $('[type="submit"]', form);
    if (btn) { btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); }
    if (errorBox) errorBox.hidden = true;
    try {
      await SZ.cart.add(new FormData(form));
      SZ.cart.open(true);
    } catch (err) {
      if (errorBox) { errorBox.textContent = err.message; errorBox.hidden = false; }
      else SZ.toast(err.message);
    } finally {
      if (btn) { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); }
    }
  });

  /* Links to /cart open the drawer instead */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-cart-open]');
    if (!link || !$('[data-cart-drawer]')) return;
    e.preventDefault();
    SZ.cart.open(false);
    SZ.loadUpsell();
  });

  /* Quantity + remove inside drawer and cart page */
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-line-remove]');
    if (rm) { e.preventDefault(); SZ.cart.change(Number(rm.dataset.lineRemove), 0); }
  });
  const onQtyChange = SZ.debounce((input) => {
    const line = Number(input.dataset.lineQty);
    if (!line) return;
    SZ.cart.change(line, Math.max(0, parseInt(input.value, 10) || 0));
  }, 350);
  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-line-qty]');
    if (input) onQtyChange(input);
    const note = e.target.closest('[data-cart-note]');
    if (note) SZ.cart.note(note.value);
  });

  /* <quantity-input> — steppers for any number input */
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.addEventListener('click', (e) => {
        const b = e.target.closest('[data-qty-step]');
        if (!b) return;
        e.preventDefault();
        const step = Number(b.dataset.qtyStep);
        const min = this.input.min === '' ? 1 : Number(this.input.min);
        const max = this.input.max === '' ? Infinity : Number(this.input.max);
        const next = Math.min(max, Math.max(min, (parseInt(this.input.value, 10) || 0) + step));
        if (String(next) === this.input.value) return;
        this.input.value = next;
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }
  customElements.define('quantity-input', QuantityInput);

  document.addEventListener('drawer:open', (e) => { if (e.target.matches('[data-cart-drawer]')) SZ.loadUpsell(); });
})();

/* ---------------------------------------------------------------------
   <predictive-search> — results as you type, from Shopify's own endpoint
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $ } = SZ;

  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      if (this.dataset.enabled !== 'true') return;
      this.input = $('[data-psearch-input]', this);
      this.results = $('[data-psearch-results]', this);
      this.idle = $('[data-psearch-idle]', this);
      this.cache = new Map();
      this.input.addEventListener('input', SZ.debounce(() => this.search(), 220));
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          const first = this.results.querySelector('a');
          if (first) { e.preventDefault(); first.focus(); }
        }
      });
    }
    async search() {
      const q = this.input.value.trim();
      if (!q) { this.results.innerHTML = ''; this.idle.hidden = false; return; }
      this.idle.hidden = true;
      if (this.cache.has(q)) { this.results.innerHTML = this.cache.get(q); return; }
      this.abort && this.abort.abort();
      this.abort = new AbortController();
      const params = new URLSearchParams({
        q,
        'resources[type]': 'product,collection,page,article,query',
        'resources[limit]': '8',
        'resources[options][unavailable_products]': 'last',
        section_id: 'predictive-search'
      });
      try {
        const res = await fetch(`${SZ.routes.predictiveSearch}?${params}`, { signal: this.abort.signal });
        if (!res.ok) throw new Error(res.status);
        const doc = SZ.parseHTML(await res.text());
        const node = $('.psr', doc);
        const html = node ? node.outerHTML : '';
        this.cache.set(q, html);
        if (this.input.value.trim() === q) this.results.innerHTML = html;
      } catch (e) {
        if (e.name !== 'AbortError') this.results.innerHTML = '';
      }
    }
  }
  customElements.define('predictive-search', PredictiveSearch);
})();

/* ---------------------------------------------------------------------
   <sleep-quiz> — the Sleep Match
   Scores the answers against the five sleep needs, then shows the best
   need that actually has beds in it, with the right size pre-selected.
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $, $$ } = SZ;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* How each answer moves the needle. Concern outweighs sleep style: an
     arthritic curler needs support before they need a nest. */
  const WEIGHTS = {
    pet: { cat: { cosy: 2 }, dog: {} },
    style: {
      curl: { cosy: 3, calm: 2 },
      sprawl: { stretch: 3, support: 1, cool: 1 },
      lean: { calm: 3, support: 1 },
      burrow: { cosy: 3, calm: 1 }
    },
    concern: {
      joints: { support: 5 },
      anxious: { calm: 5 },
      hot: { cool: 5, stretch: 1 },
      none: {}
    },
    size: { small: { cosy: 1 }, medium: {}, large: { support: 1, stretch: 1 }, giant: { support: 2, stretch: 1 } }
  };

  /* Size words as they appear in variant titles and supplier titles */
  const SIZE_MATCH = {
    small: /(^|[^a-z])(xs|s|small|extra small|mini)([^a-z]|$)|\b(50|60)\s*[x×]/,
    medium: /(^|[^a-z])(m|medium|med)([^a-z]|$)|\b(70|75|80)\s*[x×]/,
    large: /(^|[^a-z])(l|large)([^a-z]|$)|\b(90|100)\s*[x×]/,
    giant: /(^|[^a-z])(xl|xxl|2xl|3xl|extra large|extra-large|giant|jumbo)([^a-z]|$)|\b(110|120|130)\s*[x×]/
  };

  class SleepQuiz extends HTMLElement {
    connectedCallback() {
      try { this.data = JSON.parse($('[data-quiz-data]', this).textContent); } catch (e) { return; }
      this.steps = $$('.quiz__step', this);
      this.answers = {};
      this.history = [];
      this.label = $('[data-quiz-label]', this);
      this.progress = $('[data-quiz-progress]', this);
      this.back = $('[data-quiz-back]', this);
      this.result = $('[data-quiz-result]', this);
      this.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-answer]');
        if (opt) return this.answer(opt);
        if (e.target.closest('[data-quiz-back]')) return this.goBack();
        if (e.target.closest('[data-quiz-restart]')) return this.restart();
      });
    }
    get flow() { return this.answers.pet === 'cat' ? ['pet', 'style', 'concern'] : ['pet', 'style', 'concern', 'size']; }
    show(name) {
      this.steps.forEach((st) => {
        const on = st.dataset.step === name;
        st.hidden = !on;
        st.classList.toggle('is-active', on);
      });
      const flow = this.flow;
      const i = flow.indexOf(name);
      this.label.textContent = this.data.labels.step.replace('[step]', i + 1).replace('[total]', flow.length);
      this.progress.style.setProperty('--p', `${((i + 1) / (flow.length + 1)) * 100}%`);
      this.back.hidden = i === 0;
      const current = this.steps.find((st) => st.dataset.step === name);
      $$('[data-answer]', current).forEach((b) => b.setAttribute('aria-pressed', String(this.answers[name] === b.dataset.answer)));
      const first = $('[data-answer]', current);
      if (this.started && first) first.focus({ preventScroll: true });
    }
    answer(opt) {
      this.started = true;
      const step = opt.closest('.quiz__step').dataset.step;
      this.answers[step] = opt.dataset.answer;
      opt.classList.add('is-picked');
      setTimeout(() => opt.classList.remove('is-picked'), 400);
      const flow = this.flow;
      const i = flow.indexOf(step);
      this.history.push(step);
      if (i < flow.length - 1) {
        setTimeout(() => this.show(flow[i + 1]), 180);
      } else {
        setTimeout(() => this.finish(), 220);
      }
    }
    goBack() {
      const prev = this.history.pop();
      if (!this.result.hidden) { this.result.hidden = true; $('[data-quiz-steps]', this).hidden = false; }
      if (prev) this.show(prev);
    }
    restart() {
      this.answers = {};
      this.history = [];
      this.result.hidden = true;
      $('[data-quiz-steps]', this).hidden = false;
      this.show('pet');
      $('[data-answer]', this.steps[0]).focus({ preventScroll: true });
    }
    score() {
      const totals = { calm: 0, support: 0, cool: 0, cosy: 0, stretch: 0 };
      Object.entries(this.answers).forEach(([q, a]) => {
        const w = (WEIGHTS[q] || {})[a] || {};
        Object.entries(w).forEach(([need, pts]) => { totals[need] += pts; });
      });
      // Only needs that have beds in stock (or at least listed) can win
      const ranked = Object.keys(totals)
        .filter((k) => this.data.needs[k] && this.data.needs[k].products.length)
        .sort((a, b) => totals[b] - totals[a] || this.availableCount(b) - this.availableCount(a));
      return ranked;
    }
    availableCount(k) { return this.data.needs[k].products.filter((p) => p.available).length; }
    sizeKey() { return this.answers.pet === 'cat' ? 'cat' : (this.answers.size || 'medium'); }
    pickVariant(p) {
      const key = this.sizeKey();
      const re = SIZE_MATCH[key === 'cat' ? 'small' : key];
      if (!re) return null;
      const titleHit = re.test(` ${p.title.toLowerCase()} `);
      const v = p.variants.find((x) => x.a && re.test(` ${x.t} `)) || null;
      return v ? { id: v.id } : (titleHit ? { id: null } : null);
    }
    finish() {
      const ranked = this.score();
      this.progress.style.setProperty('--p', '100%');
      const L = this.data.labels;
      $('[data-quiz-steps]', this).hidden = true;
      this.back.hidden = false;
      this.label.textContent = L.match;
      if (!ranked.length) {
        this.result.innerHTML = `<p class="quiz__none">${esc(L.none)}</p><a class="btn" href="${esc(this.data.allUrl)}">${esc(L.shopAll.replace('{need}', ''))}</a>`;
        this.result.hidden = false;
        return;
      }
      const key = ranked[0];
      const need = this.data.needs[key];
      const alt = ranked[1] ? this.data.needs[ranked[1]] : null;
      try { localStorage.setItem('sz-match', JSON.stringify({ need: key, size: this.sizeKey(), pet: this.answers.pet, t: Date.now() })); } catch (e) { /* private mode */ }

      const products = need.products
        .map((p) => ({ ...p, fit: this.pickVariant(p) }))
        .sort((a, b) => (b.available - a.available) || ((b.fit ? 1 : 0) - (a.fit ? 1 : 0)))
        .slice(0, 3);

      const cards = products.map((p, i) => {
        const url = p.fit && p.fit.id ? `${p.url}?variant=${p.fit.id}` : p.url;
        return `<li class="qres__product${p.available ? '' : ' is-out'}">
          <a href="${esc(url)}" class="qres__link">
            <span class="qres__img">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" width="240" height="240">` : ''}</span>
            <span class="qres__meta">
              ${i === 0 && p.available ? `<span class="badge badge--moon">${esc(L.top)}</span>` : ''}
              <span class="qres__name">${esc(p.title)}</span>
              <span class="qres__price">${esc(p.price)}</span>
              ${!p.available ? `<span class="qres__flag">${esc(L.backSoon)}</span>` : (p.fit ? `<span class="qres__flag qres__flag--fit">✓ ${esc(L.inSize)}</span>` : '')}
            </span>
          </a>
        </li>`;
      }).join('');

      const sizeText = this.data.sizes[this.sizeKey()] || '';
      this.result.innerHTML = `
        <div class="qres need--${key}">
          <div class="qres__head">
            <span class="qres__icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/></svg></span>
            <div>
              <p class="qres__kicker">${esc(L.match)}</p>
              <h3 class="qres__need">${esc(need.label)} <em>${esc(need.for)}</em></h3>
            </div>
          </div>
          <p class="qres__why"><strong>${esc(L.why)}</strong> ${esc(need.why)}</p>
          ${sizeText ? `<p class="qres__size"><strong>${esc(L.size)}</strong> ${esc(sizeText)}</p>` : ''}
          <ul class="qres__products" role="list">${cards}</ul>
          <div class="qres__actions">
            ${need.url ? `<a class="btn qres__cta" href="${esc(need.url)}">${esc(L.shopAll.replace('{need}', need.label))}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}
            <button type="button" class="btn btn--ghost" data-quiz-restart>${esc(L.restart)}</button>
          </div>
          ${alt && alt.url ? `<p class="qres__alt">${esc(L.alsoTry)} <a href="${esc(alt.url)}" class="need--${esc(ranked[1])}">${esc(alt.label)} — ${esc(alt.for.toLowerCase())}</a></p>` : ''}
        </div>`;
      this.result.hidden = false;
      this.result.focus({ preventScroll: true });
      const top = this.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) this.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.dispatchEvent(new CustomEvent('sleep-match:result', { detail: { need: key, answers: this.answers } }));
    }
  }
  customElements.define('sleep-quiz', SleepQuiz);
})();

/* ---------------------------------------------------------------------
   Small section behaviours
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $, $$ } = SZ;

  /* <need-filter> — instant colour-coded filtering of cards on the page */
  class NeedFilter extends HTMLElement {
    connectedCallback() {
      this.target = $(this.dataset.target);
      if (!this.target) return;
      this.addEventListener('click', (e) => {
        const b = e.target.closest('[data-need-filter]');
        if (!b) return;
        const need = b.dataset.needFilter;
        $$('[data-need-filter]', this).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        $$(':scope > [data-need]', this.target).forEach((li) => {
          li.hidden = Boolean(need) && li.dataset.need !== need;
        });
        this.target.scrollLeft = 0;
      });
    }
  }
  customElements.define('need-filter', NeedFilter);

  /* FAQ: one open at a time within a list, for a calmer read */
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open || !d.classList.contains('faq__item')) return;
    const list = d.closest('.faq__list');
    if (!list || list.dataset.multi === 'true') return;
    $$('.faq__item[open]', list).forEach((o) => { if (o !== d) o.open = false; });
  }, true);
})();

/* ---------------------------------------------------------------------
   Product page: variant picker, gallery, zoom, sticky bar, delivery date
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $, $$ } = SZ;

  // Multi-variant forms ship with a disabled hidden id + a <noscript> select
  const enableVariantInputs = () => $$('[data-variant-id][disabled]').forEach((i) => { i.disabled = false; });
  document.addEventListener('DOMContentLoaded', enableVariantInputs);
  document.addEventListener('shopify:section:load', enableVariantInputs);

  /* <variant-picker> */
  class VariantPicker extends HTMLElement {
    connectedCallback() {
      this.section = this.closest('[data-product]');
      try { this.variants = JSON.parse($('[data-variants]', this).textContent); } catch (e) { return; }
      this.fieldsets = $$('fieldset[data-option-index]', this);
      this.addEventListener('change', () => this.onChange());
      this.updateAvailability();
    }
    selected() { return this.fieldsets.map((fs) => { const c = $('input:checked', fs); return c ? c.value : null; }); }
    onChange() {
      const opts = this.selected();
      this.fieldsets.forEach((fs, i) => { const out = $('[data-option-selected]', fs); if (out) out.textContent = opts[i]; });
      let v = this.variants.find((x) => x.options.every((o, i) => o === opts[i]));
      this.updateAvailability();
      this.apply(v);
    }
    /* Grey out values that can't combine with the other current choices */
    updateAvailability() {
      const opts = this.selected();
      this.fieldsets.forEach((fs, idx) => {
        $$('input', fs).forEach((input) => {
          const test = opts.slice();
          test[idx] = input.value;
          const match = this.variants.find((x) => x.options.every((o, i) => o === test[i]));
          const label = $(`label[for="${input.id}"]`, fs);
          if (label) {
            label.classList.toggle('is-unavailable', !match || !match.available);
            label.classList.toggle('is-missing', !match);
          }
        });
      });
    }
    apply(v) {
      const s = this.section;
      const form = $('form[data-product-form]', s);
      const idInput = form && $('[data-variant-id]', form);
      const atc = $('[data-atc]', s);
      const atcText = $('[data-atc-text]', s);
      const atcPrice = $('[data-atc-price]', s);
      const stock = $('[data-stock]', s);
      const restock = $('[data-restock]', s);
      const dynamic = $('[data-dynamic]', s);
      if (!v) {
        if (atc) atc.disabled = true;
        if (atcText) atcText.textContent = SZ.strings.unavailable;
        if (atcPrice) atcPrice.textContent = '';
        document.dispatchEvent(new CustomEvent('variant:change', { detail: { variant: null, section: s } }));
        return;
      }
      if (idInput) idInput.value = v.id;
      $$('form[id^="installments-"] input[name="id"]', s).forEach((i) => { i.value = v.id; i.dispatchEvent(new Event('change', { bubbles: true })); });
      const url = new URL(window.location.href);
      url.searchParams.set('variant', v.id);
      window.history.replaceState({}, '', url.toString());

      const slot = $('[data-price-slot]', s);
      if (slot && v.priceHtml) slot.innerHTML = v.priceHtml;
      if (atc) atc.disabled = !v.available;
      if (atcText) atcText.textContent = v.available ? SZ.strings.addToCart : SZ.strings.soldOut;
      if (atcPrice) atcPrice.textContent = v.available ? `· ${v.price}` : '';
      if (dynamic) dynamic.classList.toggle('is-hidden', !v.available);
      if (restock) {
        restock.hidden = v.available;
        const body = $('[data-restock-body]', restock);
        if (body) body.value = body.value.split(' — ')[0] + ' — ' + v.options.join(' / ');
      }
      if (stock) {
        const low = Number(stock.dataset.low) || 0;
        let state = 'in';
        let text = SZ.strings.inStock;
        if (!v.available) { state = 'out'; text = stock.dataset.outText || SZ.strings.soldOut; }
        else if (v.qty !== null && low > 0 && v.qty <= low) { state = 'low'; text = SZ.strings.lowStock.replace('[count]', v.qty); }
        stock.className = `stock stock--${state}`;
        $('[data-stock-text]', stock).textContent = text;
      }
      if (v.media) { const g = $('media-gallery', s); if (g) g.goToMedia(v.media); }
      document.dispatchEvent(new CustomEvent('variant:change', { detail: { variant: v, section: s } }));
    }
  }
  customElements.define('variant-picker', VariantPicker);

  /* <media-gallery> — swipe on touch, arrows + thumbs on desktop, zoom */
  class MediaGallery extends HTMLElement {
    connectedCallback() {
      this.viewer = $('[data-viewer]', this);
      this.slides = $$('.pdp__slide', this);
      this.thumbs = $$('[data-thumb]', this);
      this.indexOut = $('[data-gallery-index]', this);
      if (!this.viewer || this.slides.length < 2) { this.bindZoom(); return; }
      this.addEventListener('click', (e) => {
        const t = e.target.closest('[data-thumb]');
        if (t) return this.goToMedia(t.dataset.thumb);
        if (e.target.closest('[data-gallery-prev]')) return this.step(-1);
        if (e.target.closest('[data-gallery-next]')) return this.step(1);
      });
      this.viewer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
      });
      this.viewer.addEventListener('scroll', SZ.debounce(() => this.syncFromScroll(), 60), { passive: true });
      this.bindZoom();
    }
    index() { return Math.max(0, this.slides.findIndex((sl) => sl.classList.contains('is-current'))); }
    step(d) { const i = (this.index() + d + this.slides.length) % this.slides.length; this.go(i); }
    goToMedia(id) { const i = this.slides.findIndex((sl) => sl.dataset.mediaId === String(id)); if (i > -1) this.go(i); }
    go(i, scroll = true) {
      this.slides.forEach((sl, k) => sl.classList.toggle('is-current', k === i));
      this.thumbs.forEach((t, k) => t.classList.toggle('is-active', k === i));
      if (this.indexOut) this.indexOut.textContent = i + 1;
      if (scroll) this.viewer.scrollTo({ left: this.slides[i].offsetLeft - this.viewer.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      const thumb = this.thumbs[i];
      if (thumb && thumb.parentElement) thumb.parentElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.slides.forEach((sl, k) => { if (k !== i) $$('video', sl).forEach((v) => v.pause()); });
    }
    syncFromScroll() {
      const x = this.viewer.scrollLeft;
      const w = this.viewer.clientWidth;
      const i = Math.round(x / w);
      if (i !== this.index() && this.slides[i]) this.go(i, false);
    }
    bindZoom() {
      const section = this.closest('[data-product]');
      const dlg = section && $('[data-zoom-dialog]', section);
      if (!dlg || typeof dlg.showModal !== 'function') return;
      const img = $('[data-zoom-img]', dlg);
      this.addEventListener('click', (e) => {
        const z = e.target.closest('[data-zoom]');
        if (!z) return;
        this.zoomOpener = z;
        img.src = z.dataset.zoom;
        img.alt = ($('img', z) || {}).alt || '';
        dlg.showModal();
        SZ.lockScroll(true);
      });
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-zoom-close]')) dlg.close(); });
      dlg.addEventListener('close', () => { SZ.lockScroll(false); if (this.zoomOpener) this.zoomOpener.focus({ preventScroll: true }); });
    }
  }
  customElements.define('media-gallery', MediaGallery);

  /* <sticky-atc> — appears once the real button scrolls away */
  class StickyAtc extends HTMLElement {
    connectedCallback() {
      this.form = document.getElementById(this.dataset.form);
      if (!this.form) return;
      const atc = $('[data-atc]', this.form);
      this.btn = $('[data-satc-btn]', this);
      this.price = $('[data-satc-price]', this);
      this.variantOut = $('[data-satc-variant]', this);
      if (!atc || !('IntersectionObserver' in window)) return;
      let pastForm = false;
      const io = new IntersectionObserver(([en]) => {
        pastForm = !en.isIntersecting && en.boundingClientRect.top < 0;
        this.toggle(pastForm);
      });
      io.observe(atc);
      const footer = $('footer.footer');
      if (footer) {
        new IntersectionObserver(([en]) => { this.toggle(pastForm && !en.isIntersecting); }).observe(footer);
      }
      this.btn.addEventListener('click', () => {
        if (this.form.requestSubmit) this.form.requestSubmit(atc); else atc.click();
      });
      document.addEventListener('variant:change', (e) => {
        const v = e.detail.variant;
        if (!v) { this.btn.disabled = true; return; }
        this.btn.disabled = !v.available;
        this.btn.textContent = v.available ? SZ.strings.addToCart : SZ.strings.soldOut;
        this.price.textContent = v.price;
        if (this.variantOut) this.variantOut.textContent = v.options.join(' / ');
      });
    }
    toggle(on) {
      if (on) { this.hidden = false; requestAnimationFrame(() => this.classList.add('is-visible')); }
      else { this.classList.remove('is-visible'); }
    }
  }
  customElements.define('sticky-atc', StickyAtc);

  /* <delivery-estimate> — working days from today, weekends skipped */
  class DeliveryEstimate extends HTMLElement {
    connectedCallback() {
      const min = Number(this.dataset.min);
      const max = Number(this.dataset.max);
      const out = $('[data-delivery-text]', this);
      if (!out || !min || !max) return;
      const add = (days) => {
        const d = new Date();
        let n = 0;
        while (n < days) {
          d.setDate(d.getDate() + 1);
          const w = d.getDay();
          if (w !== 0 && w !== 6) n += 1;
        }
        return d;
      };
      const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const a = fmt.format(add(min));
      const b = fmt.format(add(max));
      out.textContent = min === max ? `Arrives by ${b}` : `Arrives ${a} – ${b}`;
    }
  }
  customElements.define('delivery-estimate', DeliveryEstimate);

  /* "Matches your Sleep Match" — personal nudge if the quiz chose this need */
  const showMatch = () => {
    let m = null;
    try { m = JSON.parse(localStorage.getItem('sz-match') || 'null'); } catch (e) { return; }
    if (!m || !m.need) return;
    $$('[data-product][data-need]').forEach((s) => {
      if (s.dataset.need === m.need) { const b = $('[data-sleep-match]', s); if (b) b.hidden = false; }
    });
  };
  document.addEventListener('DOMContentLoaded', showMatch);

  /* <product-recs> — loads its own section from the recommendations API */
  class ProductRecs extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.url) return;
      const load = async () => {
        try {
          const res = await fetch(this.dataset.url);
          const doc = SZ.parseHTML(await res.text());
          const fresh = $('product-recs', doc);
          if (fresh && fresh.innerHTML.trim()) {
            this.innerHTML = fresh.innerHTML;
            this.classList.add('is-loaded');
            SZ.initReveal(this);
          } else {
            this.closest('.sz-section') && (this.closest('.sz-section').hidden = true);
          }
        } catch (e) { /* optional */ }
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '600px 0px' });
        io.observe(this);
      } else load();
    }
  }
  customElements.define('product-recs', ProductRecs);
})();

/* ---------------------------------------------------------------------
   Collection and search filters: the real GET form, upgraded to refresh
   the grid in place through the Section Rendering API. The URL always
   carries the state, so a filtered view can be shared or used in an ad.
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $, $$ } = SZ;

  const root = () => $('[data-facets-section]');
  let controller;

  const render = async (url, push = true) => {
    const r = root();
    if (!r) { window.location.href = url; return; }
    const sectionId = r.dataset.facetsSection;
    const u = new URL(url, window.location.origin);
    const fetchUrl = new URL(u.toString());
    fetchUrl.searchParams.set('section_id', sectionId);
    controller && controller.abort();
    controller = new AbortController();
    const results = $('[data-facets-results]', r);
    results && results.classList.add('is-busy');
    try {
      const res = await fetch(fetchUrl.toString(), { signal: controller.signal });
      const doc = SZ.parseHTML(await res.text());
      ['[data-facets-results]', '[data-facets-active]', '[data-facets-toolbar] [role="status"]'].forEach((sel) => {
        const fresh = $(sel, doc);
        const cur = $(sel, r);
        if (fresh && cur) cur.innerHTML = fresh.innerHTML;
      });
      // Filters: keep the open/closed state of each group, replace values
      const freshFilters = $('[data-facets-filters]', doc);
      const curFilters = $('[data-facets-filters]', r);
      if (freshFilters && curFilters) {
        const open = $$('details.facet', curFilters).map((d) => d.open);
        curFilters.innerHTML = freshFilters.innerHTML;
        $$('details.facet', curFilters).forEach((d, i) => { if (open[i] !== undefined) d.open = open[i]; });
      }
      const drawerBtn = $('.plp-drawer-foot .btn', r);
      const freshBtn = $('.plp-drawer-foot .btn', doc);
      if (drawerBtn && freshBtn) drawerBtn.textContent = freshBtn.textContent;
      if (push) window.history.pushState({ facets: true }, '', u.pathname + u.search);
      SZ.initReveal(r);
    } catch (e) {
      if (e.name !== 'AbortError') window.location.href = url;
    } finally {
      const fresh = $('[data-facets-results]', r);
      fresh && fresh.classList.remove('is-busy');
    }
  };

  const formUrl = (form) => {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) { if (v !== '') params.append(k, v); }
    return `${form.getAttribute('action') || window.location.pathname}?${params.toString()}`;
  };

  document.addEventListener('change', SZ.debounce((e) => {
    const form = e.target.closest && e.target.closest('[data-facets-form]');
    if (form) render(formUrl(form));
  }, 300));

  document.addEventListener('input', SZ.debounce((e) => {
    if (!e.target.matches || !e.target.matches('.facet__price input')) return;
    const form = e.target.closest('[data-facets-form]');
    if (form) render(formUrl(form));
  }, 700));

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-facets-form]');
    if (!form) return;
    e.preventDefault();
    render(formUrl(form));
  });

  document.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-sort]');
    if (!sel) return;
    const form = $('[data-facets-form]');
    if (form) {
      const mirror = $('[data-sort-mirror]', form);
      if (mirror) mirror.value = sel.value;
      render(formUrl(form));
    } else {
      const u = new URL(window.location.href);
      u.searchParams.set('sort_by', sel.value);
      window.location.href = u.toString();
    }
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-facet-link]');
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    render(a.href);
    const r = root();
    if (r && a.closest('.pagination')) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('popstate', () => { if (root()) render(window.location.href, false); });
})();
