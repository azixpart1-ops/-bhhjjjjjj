import { Component } from '@theme/component';

/**
 * Yuva FAQ list (sections/yv-collapsible-content.liquid). The rows are native <details> elements
 * inside Horizon's accordion-custom and share a `name`, so the browser keeps one row open at a
 * time and everything works without this script. This element adds:
 * - one-open-at-a-time for browsers without exclusive <details name> support;
 * - theme editor: selecting a row block opens that row.
 *
 * <yv-collapsible-content-component class="yv-faq__list">
 *   <div class="yv-faq-row" data-shopify-editor-block="…"><accordion-custom><details name="…">…
 * </yv-collapsible-content-component>
 */
export class YvCollapsibleContentComponent extends Component {
  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    if (!('name' in HTMLDetailsElement.prototype)) {
      // `toggle` does not bubble; listen in the capture phase.
      this.addEventListener('toggle', this.#onToggle, { capture: true, signal });
    }

    document.addEventListener('shopify:block:select', this.#onBlockSelect, { signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
  }

  /** @returns {HTMLDetailsElement[]} */
  get rows() {
    return /** @type {HTMLDetailsElement[]} */ ([...this.querySelectorAll('details')]);
  }

  /**
   * Opens one row and closes the others.
   * @param {HTMLDetailsElement} row
   */
  open(row) {
    for (const other of this.rows) {
      if (other !== row && other.open) other.open = false;
    }
    row.open = true;
  }

  /** @param {Event} event */
  #onToggle = (event) => {
    const row = event.target;
    if (!(row instanceof HTMLDetailsElement) || !row.open) return;
    for (const other of this.rows) {
      if (other !== row && other.open) other.open = false;
    }
  };

  /** @param {Event} event */
  #onBlockSelect = (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !this.contains(target)) return;
    const row = target.querySelector('details');
    if (row instanceof HTMLDetailsElement) this.open(row);
  };
}

if (!customElements.get('yv-collapsible-content-component')) {
  customElements.define('yv-collapsible-content-component', YvCollapsibleContentComponent);
}
