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
