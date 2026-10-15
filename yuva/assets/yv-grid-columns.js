import { Component } from '@theme/component';

/**
 * Yuva catalog toolbar behaviours (collection and search pages).
 *
 * <yv-grid-columns-component> — the "display options" column switcher (2/3/4/5 columns at 990px and
 * up, 2/3 columns at 750–989px). The radios carry `data-skip-node-update`, so their checked state
 * survives the Section Rendering API morph that runs after every filter or sort change; CSS in
 * assets/yv-collection.css reads the checked radio with :has() and sets `--yv-grid-columns` on the
 * product grid. This component only remembers the choice per breakpoint band in
 * localStorage['yvGridColumns'] (JSON keyed by band) and restores it on load.
 *
 * <yv-filter-toggle-component> — the "Filter" button of the push-in filter drawer (filters layout
 * "Drawer"). It flips `aria-expanded` on its button (also `data-skip-node-update`); CSS opens the
 * filter pane and pushes the grid from that state.
 */

const STORAGE_KEY = 'yvGridColumns';

/** @returns {Record<string, string>} */
function readStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, string>} value */
function writeStore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for the page view only.
  }
}

/**
 * @extends {Component}
 */
class YvGridColumnsComponent extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this.#handleChange);
    this.#restore();
    this.#resetHorizonDensity();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('change', this.#handleChange);
  }

  /** @param {Event} event */
  #handleChange = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('yv-grid-columns__input')) return;

    const band = input.dataset.band;
    if (!band) return;

    const store = readStore();
    store[band] = input.value;
    writeStore(store);
  };

  /** Re-applies the stored choice (the inline script in the snippet usually did it before paint). */
  #restore() {
    if (this.dataset.designMode === 'true') return;

    const store = readStore();
    for (const input of this.querySelectorAll('input.yv-grid-columns__input')) {
      if (!(input instanceof HTMLInputElement)) continue;
      const band = input.dataset.band;
      if (band && store[band] === input.value) input.checked = true;
    }
  }

  /**
   * Horizon's own grid density (`product-grid-view`) is not offered with the Yuva switcher; clear a
   * value a shopper may have stored in this tab so cards never render in Horizon's zoomed-out mode.
   */
  #resetHorizonDensity() {
    const grid = this.closest('.shopify-section')?.querySelector('.product-grid[product-grid-view]');
    if (grid && grid.getAttribute('product-grid-view') !== 'default') {
      grid.setAttribute('product-grid-view', 'default');
    }
  }
}

if (!customElements.get('yv-grid-columns-component')) {
  customElements.define('yv-grid-columns-component', YvGridColumnsComponent);
}

/**
 * @typedef {Object} FilterToggleRefs
 * @property {HTMLButtonElement} button - The "Filter" button.
 *
 * @extends {Component<FilterToggleRefs>}
 */
class YvFilterToggleComponent extends Component {
  requiredRefs = ['button'];

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.#handleKeydown);
    // Lets the CSS enable the open/close transitions only after the first paint.
    requestAnimationFrame(() => {
      if (this.refs.button) this.refs.button.dataset.ready = '';
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.#handleKeydown);
  }

  toggle() {
    const { button } = this.refs;
    this.#setOpen(button.getAttribute('aria-expanded') !== 'true');
  }

  /** @param {boolean} open */
  #setOpen(open) {
    const { button } = this.refs;
    button.setAttribute('aria-expanded', String(open));

    if (open) {
      const pane = button.getAttribute('aria-controls');
      const target = pane ? document.getElementById(pane) : null;
      target?.scrollTo({ top: 0 });
    }
  }

  /** @param {KeyboardEvent} event */
  #handleKeydown = (event) => {
    if (event.key !== 'Escape' || this.refs.button?.getAttribute('aria-expanded') !== 'true') return;

    const pane = this.refs.button.getAttribute('aria-controls');
    const target = pane ? document.getElementById(pane) : null;
    if (target && event.target instanceof Node && target.contains(event.target)) {
      this.#setOpen(false);
      this.refs.button.focus();
    }
  };
}

if (!customElements.get('yv-filter-toggle-component')) {
  customElements.define('yv-filter-toggle-component', YvFilterToggleComponent);
}
