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
