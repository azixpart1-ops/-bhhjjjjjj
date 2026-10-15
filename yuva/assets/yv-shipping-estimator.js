import { Component } from '@theme/component';
import { formatMoney } from '@theme/money-formatting';

/**
 * Cart page shipping-rate estimator (snippets/yv-shipping-estimator.liquid).
 *
 * Asks Shopify for the shipping rates of the current cart:
 * POST /cart/prepare_shipping_rates.json, then polls GET /cart/async_shipping_rates.json every
 * 500ms (20 tries at most) until the rates are ready. The element lives inside the cart section,
 * which Horizon morphs after every cart change, so the chosen address, the province options and the
 * last result are kept on the instance and put back whenever a morph resets them.
 *
 * @typedef {object} Refs
 * @property {HTMLSelectElement} country
 * @property {HTMLSelectElement} province
 * @property {HTMLElement} provinceField
 * @property {HTMLInputElement} zip
 * @property {HTMLButtonElement} submit
 * @property {HTMLElement} results
 *
 * @extends {Component<Refs>}
 */
class YvShippingEstimatorComponent extends Component {
  requiredRefs = ['country', 'province', 'provinceField', 'zip', 'submit', 'results'];

  /** @type {{ country: string, province: string, zip: string } | null} */
  #state = null;

  /** @type {string} */
  #resultsHtml = '';

  /** @type {boolean} */
  #resultsError = false;

  /** @type {AbortController | null} */
  #controller = null;

  /** @type {MutationObserver | null} */
  #observer = null;

  #restoring = false;

  connectedCallback() {
    super.connectedCallback();
    this.#restore();
    // A cart morph rewrites this subtree to the server markup; put the shopper's state back.
    this.#observer = new MutationObserver(() => {
      if (!this.#restoring) queueMicrotask(() => this.#restore());
    });
    this.#observer.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    // Remember every edit, so a restore never brings back an older choice.
    this.addEventListener('input', this.#remember);
    this.addEventListener('change', this.#remember);
  }

  #remember = () => {
    if (this.#restoring) return;
    const { country, province, zip } = this.refs;
    if (!country) return;
    this.#state = { country: country.value, province: province?.value || '', zip: zip?.value.trim() || '' };
  };

  /** Country select change: refill the provinces without triggering a restore. */
  onCountryChange = () => {
    this.#restoring = true;
    try {
      this.updateProvinces();
    } finally {
      this.#observer?.takeRecords();
      this.#restoring = false;
    }
    this.#remember();
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#observer?.disconnect();
  }

  /** Re-applies the shopper's choices after a render (first load or cart morph). */
  #restore() {
    if (this.#restoring) return;
    this.#restoring = true;
    try {
      this.#applyState();
    } finally {
      this.#observer?.takeRecords();
      this.#restoring = false;
    }
  }

  #applyState() {
    const { country, zip } = this.refs;
    if (!country) return;

    const preferred = this.#state?.country || this.dataset.defaultCountry || '';
    if (preferred) {
      const option = Array.from(country.options).find(
        (item) => item.value === preferred || item.textContent?.trim() === preferred
      );
      if (option) country.value = option.value;
    }
    this.updateProvinces();
    if (this.#state) {
      if (this.#state.province) this.refs.province.value = this.#state.province;
      zip.value = this.#state.zip;
    }
    if (this.#resultsHtml) this.#showResults(this.#resultsHtml, this.#resultsError);
  }

  /** Fills the province select from the chosen country's `data-provinces` JSON. */
  updateProvinces = () => {
    const { country, province, provinceField } = this.refs;
    const option = country.options[country.selectedIndex];
    /** @type {Array<[string, string]>} */
    let provinces = [];
    try {
      provinces = JSON.parse(option?.dataset.provinces || '[]');
    } catch {
      provinces = [];
    }

    const current = province.value;
    province.replaceChildren(
      ...provinces.map(([value, label]) => {
        const item = document.createElement('option');
        item.value = value;
        item.textContent = label;
        return item;
      })
    );
    if (current && provinces.some(([value]) => value === current)) province.value = current;
    provinceField.hidden = provinces.length === 0;
  };

  /** @param {SubmitEvent} event */
  estimate = async (event) => {
    event.preventDefault();
    const { country, province, zip, submit } = this.refs;

    this.#state = { country: country.value, province: province.value, zip: zip.value.trim() };
    this.#restoring = true;
    const params = new URLSearchParams();
    params.set('shipping_address[country]', this.#state.country);
    params.set('shipping_address[province]', this.#state.province);
    params.set('shipping_address[zip]', this.#state.zip);

    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    this.#showResults(`<p>${escapeHtml(this.dataset.textLoading || '')}</p>`, false, false);
    this.#observer?.takeRecords();
    this.#restoring = false;

    const base = this.dataset.cartUrl || '/cart';
    try {
      const prepare = await fetch(`${base}/prepare_shipping_rates.json?${params}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        signal,
      });
      if (!prepare.ok) {
        this.#renderErrors(await prepare.json().catch(() => null));
        return;
      }

      for (let attempt = 0; attempt < 20; attempt++) {
        const response = await fetch(`${base}/async_shipping_rates.json?${params}`, {
          headers: { Accept: 'application/json' },
          signal,
        });
        if (!response.ok) {
          this.#renderErrors(await response.json().catch(() => null));
          return;
        }
        const text = await response.text();
        const data = text && text !== 'null' ? JSON.parse(text) : null;
        if (data && Array.isArray(data.shipping_rates)) {
          this.#renderRates(data.shipping_rates);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      this.#renderErrors(null);
    } catch (error) {
      if (/** @type {Error} */ (error)?.name === 'AbortError') return;
      this.#renderErrors(null);
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  };

  /** @param {Array<{ name: string, price: string, currency?: string }>} rates */
  #renderRates(rates) {
    if (!rates.length) {
      this.#showResults(`<p>${escapeHtml(this.dataset.textNone || '')}</p>`, true);
      return;
    }

    const sorted = [...rates].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    const cheapest = sorted[0];
    const summary =
      sorted.length === 1
        ? escapeHtml(this.dataset.textOne || '')
            .replace('[name]', escapeHtml(cheapest?.name || ''))
            .replace('[price]', this.#price(cheapest))
        : escapeHtml(this.dataset.textMany || '')
            .replace('[count]', String(sorted.length))
            .replace('[price]', this.#price(cheapest));

    const list = sorted
      .map(
        (rate) =>
          `<li class="yv-estimator__rate"><span>${escapeHtml(rate.name)}</span><span>${this.#price(rate)}</span></li>`
      )
      .join('');

    this.#showResults(`<p>${summary}</p><ul class="yv-estimator__rates" role="list">${list}</ul>`, false);
  }

  /** @param {{ name: string, price: string, currency?: string } | undefined} rate */
  #price(rate) {
    if (!rate) return '';
    const cents = Math.round(parseFloat(rate.price) * 100);
    if (!cents) return escapeHtml(this.dataset.textFree || '');
    const currency = rate.currency || this.dataset.currency || 'USD';
    return escapeHtml(formatMoney(cents, this.dataset.moneyFormat || '{{amount}}', currency));
  }

  /** @param {Record<string, string[] | string> | null} errors */
  #renderErrors(errors) {
    const lines = [];
    if (errors && typeof errors === 'object') {
      for (const [field, messages] of Object.entries(errors)) {
        const text = Array.isArray(messages) ? messages.join(', ') : String(messages);
        lines.push(`${field === 'base' ? '' : `${field.replace(/_/g, ' ')} `}${text}`.trim());
      }
    }
    if (!lines.length) lines.push(this.dataset.textError || '');
    this.#showResults(lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(''), true);
  }

  /**
   * @param {string} html
   * @param {boolean} isError
   * @param {boolean} [remember]
   */
  #showResults(html, isError, remember = true) {
    const { results } = this.refs;
    if (remember) {
      this.#resultsHtml = html;
      this.#resultsError = isError;
    }
    const wasRestoring = this.#restoring;
    this.#restoring = true;
    results.innerHTML = html;
    results.hidden = false;
    results.classList.toggle('yv-estimator__results--error', isError);
    this.#observer?.takeRecords();
    this.#restoring = wasRestoring;
  }
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (!customElements.get('yv-shipping-estimator-component')) {
  customElements.define('yv-shipping-estimator-component', YvShippingEstimatorComponent);
}
