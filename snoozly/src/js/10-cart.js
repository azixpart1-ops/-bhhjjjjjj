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

  /* Any product form (PDP, quick add, upsell) goes through here */
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-product-form]');
    if (!form || SZ.cartType !== 'drawer' || !$('[data-cart-drawer]')) return;
    e.preventDefault();
    const btn = e.submitter || $('[type="submit"]', form);
    if (btn) { btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); }
    const errorBox = $('[data-form-error]', form.closest('[data-product]') || form);
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
