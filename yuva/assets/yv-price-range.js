import { convertMoneyToMinorUnits, formatMoney } from '@theme/money-formatting';

/**
 * Yuva's dual-thumb price slider (snippets/price-filter.liquid).
 *
 * The two range inputs carry Liquid money values (filter.min_value / max_value / range_max).
 * Dragging writes the matching amount into Horizon's "From" / "To" text inputs, and releasing
 * fires `change`, which Horizon's <price-facet-component> already handles (on:change) to
 * update the results. Typing in the text inputs moves the thumbs. The range inputs have no
 * `name`, so they never reach the filter URL.
 */
class YvPriceRange extends HTMLElement {
  /** @type {MutationObserver | undefined} */
  #observer;

  connectedCallback() {
    this.addEventListener('input', this.#onInput);
    this.facet?.addEventListener('input', this.#onTextInput);
    this.#observer = new MutationObserver((records) => {
      if (records.some((record) => record.target !== this)) this.#syncFromAttributes();
      else this.#paint();
    });
    for (const range of this.ranges) {
      this.#observer.observe(range, { attributes: true, attributeFilter: ['value', 'max'] });
    }
    // A section morph drops the fill's inline custom properties; #paint only writes changed values.
    this.#observer.observe(this, { attributes: true, attributeFilter: ['style'] });
    this.#syncFromAttributes();
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#onInput);
    this.facet?.removeEventListener('input', this.#onTextInput);
    this.#observer?.disconnect();
  }

  get facet() {
    return this.closest('price-facet-component');
  }

  /** @returns {HTMLInputElement[]} */
  get ranges() {
    return Array.from(this.querySelectorAll('input[type="range"]'));
  }

  /** @param {'min' | 'max'} which */
  #textInput(which) {
    const input = this.facet?.querySelector(`[ref="${which}Input"]`);
    return input instanceof HTMLInputElement ? input : null;
  }

  get #currency() {
    return this.facet?.getAttribute('data-currency') ?? 'USD';
  }

  get #moneyFormat() {
    const format = this.facet?.getAttribute('data-money-format') ?? '{{amount}}';
    return format.match(/{{\s*\w+\s*}}/)?.[0] ?? '{{amount}}';
  }

  /**
   * Liquid money values are in cents; the text inputs use the currency's minor units
   * (they differ for zero-decimal currencies). The highest price links the two.
   */
  get #scale() {
    const liquidMax = Number(this.dataset.rangeMax);
    const textMax = convertMoneyToMinorUnits(this.#textInput('max')?.placeholder ?? '', this.#currency);
    return liquidMax > 0 && textMax ? textMax / liquidMax : 1;
  }

  /** Re-reads the server-rendered values (first render and every section morph). */
  #syncFromAttributes() {
    for (const range of this.ranges) {
      const value = range.getAttribute('value');
      if (value !== null && range.value !== value) range.value = value;
    }
    this.#paint();
  }

  /** @param {Event} event */
  #onInput = (event) => {
    const range = event.target;
    if (!(range instanceof HTMLInputElement) || range.type !== 'range') return;
    event.stopPropagation();

    const [min, max] = this.ranges;
    if (!min || !max) return;
    const gap = Number(min.step) || 1;
    if (range === min && Number(min.value) > Number(max.value) - gap) min.value = String(Number(max.value) - gap);
    if (range === max && Number(max.value) < Number(min.value) + gap) max.value = String(Number(min.value) + gap);

    const which = range === min ? 'min' : 'max';
    const text = this.#textInput(which);
    if (text) {
      const atEdge = which === 'min' ? Number(min.value) <= 0 : Number(max.value) >= Number(max.max);
      text.value = atEdge
        ? ''
        : formatMoney(Math.round(Number(range.value) * this.#scale), this.#moneyFormat, this.#currency);
    }
    this.#paint();
  };

  /** Typing in the From / To inputs moves the thumbs. */
  #onTextInput = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type === 'range') return;
    const [min, max] = this.ranges;
    if (!min || !max) return;
    const minor = convertMoneyToMinorUnits(input.value, this.#currency);
    if (input === this.#textInput('min')) min.value = String(minor === null ? 0 : minor / this.#scale);
    if (input === this.#textInput('max')) max.value = String(minor === null ? max.max : minor / this.#scale);
    this.#paint();
  };

  #paint() {
    const [min, max] = this.ranges;
    const total = Number(max?.max) || 1;
    const from = `${(Number(min?.value) / total) * 100}%`;
    const to = `${(Number(max?.value) / total) * 100}%`;
    if (this.style.getPropertyValue('--yv-range-from') !== from) this.style.setProperty('--yv-range-from', from);
    if (this.style.getPropertyValue('--yv-range-to') !== to) this.style.setProperty('--yv-range-to', to);
  }
}

if (!customElements.get('yv-price-range')) customElements.define('yv-price-range', YvPriceRange);
