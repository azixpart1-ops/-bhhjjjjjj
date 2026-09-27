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
