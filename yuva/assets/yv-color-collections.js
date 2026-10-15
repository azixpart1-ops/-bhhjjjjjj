import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/** Duration of the image sweep (keep in sync with yv-color-collection-sweep in the block CSS). */
const SWEEP_MS = 800;

/**
 * Color based collections: colour bars (role="tab") switch the active collection panel.
 * The incoming panel's image sweeps in over the outgoing one, which stays underneath
 * (`.is-previous`) until the sweep ends; the product list swaps at once.
 *
 * Markup contract (sections/yv-color-based-collections.liquid, blocks/_yv-color-collection.liquid):
 * <yv-color-collections>
 *   <div role="tablist" on:keydown="yv-color-collections/onKeydown">
 *     <button role="tab" aria-selected="true" ref="bars[]" on:click="yv-color-collections/select/0"></button> …
 *   </div>
 *   <div class="yv-color-collection is-active" role="tabpanel" ref="panels[]">…</div> …
 * </yv-color-collections>
 *
 * Emits a bubbling `yv-color-collections:change` event with `detail.index`.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement[]} [bars] - The colour bars, in order.
 * @property {HTMLElement[]} [panels] - The collection panels, in the same order.
 *
 * @extends {Component<Refs>}
 */
export class YvColorCollections extends Component {
  #index = -1;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer;

  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();

    this.#controller?.abort();
    this.#controller = new AbortController();
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, {
      signal: this.#controller.signal,
    });

    const active = this.panels.findIndex((panel) => panel.classList.contains('is-active'));
    this.#index = -1;
    this.select(Math.max(active, 0), undefined, { animate: false, silent: true });
  }

  updatedCallback() {
    super.updatedCallback();
    const index = Math.max(this.#index, 0);
    this.#index = -1;
    this.select(index, undefined, { animate: false, silent: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
    clearTimeout(this.#timer);
  }

  /** @returns {HTMLButtonElement[]} */
  get bars() {
    return this.refs.bars || [];
  }

  /** @returns {HTMLElement[]} */
  get panels() {
    return this.refs.panels || [];
  }

  /** The active index. */
  get index() {
    return this.#index;
  }

  /**
   * Activates a collection. Declarative use: on:click="yv-color-collections/select/1".
   * @param {number} index - Zero-based index (clamped).
   * @param {Event} [_event] - The triggering event, when called from markup.
   * @param {{ animate?: boolean, focus?: boolean, silent?: boolean }} [options]
   */
  select(index, _event, { animate = true, focus = false, silent = false } = {}) {
    const { panels, bars } = this;
    if (!panels.length) return;

    const next = Math.min(Math.max(Number(index) || 0, 0), panels.length - 1);
    if (focus) bars[next]?.focus();
    if (next === this.#index) return;

    const outgoing = this.#index > -1 ? panels[this.#index] : null;
    const incoming = panels[next];

    clearTimeout(this.#timer);
    panels.forEach((panel, i) => {
      panel.classList.toggle('is-active', i === next);
      panel.classList.remove('is-previous', 'is-entering');
      panel.inert = false;
    });

    bars.forEach((bar, i) => {
      const selected = i === next;
      bar.classList.toggle('is-active', selected);
      bar.setAttribute('aria-selected', String(selected));
      bar.tabIndex = selected ? 0 : -1;
    });

    if (animate && outgoing && incoming && outgoing !== incoming && !prefersReducedMotion()) {
      outgoing.classList.add('is-previous');
      outgoing.inert = true;
      incoming.classList.add('is-entering');
      this.#timer = setTimeout(() => {
        outgoing.classList.remove('is-previous');
        outgoing.inert = false;
        incoming.classList.remove('is-entering');
      }, SWEEP_MS);
    }

    this.#index = next;
    this.dataset.activeIndex = String(next);
    if (silent) return;

    this.dispatchEvent(new CustomEvent('yv-color-collections:change', { bubbles: true, detail: { index: next } }));
  }

  /**
   * Arrow keys (both axes, the strip is vertical on desktop and horizontal on mobile), Home and End
   * move between the bars. Declarative use: on:keydown="yv-color-collections/onKeydown" on the tablist.
   * @param {KeyboardEvent} event
   */
  onKeydown(event) {
    const last = this.bars.length - 1;
    if (last < 0) return;

    const rtl = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    /** @type {Record<string, number>} */
    const targets = {
      ArrowDown: this.#index + 1,
      ArrowUp: this.#index - 1,
      ArrowRight: this.#index + rtl,
      ArrowLeft: this.#index - rtl,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) return;

    event.preventDefault();
    const wrapped = ((target % (last + 1)) + last + 1) % (last + 1);
    this.select(wrapped, event, { focus: true });
  }

  /**
   * Theme editor: selecting a collection block activates it.
   * @param {Event} event
   */
  #handleBlockSelect = (event) => {
    const { target } = event;
    if (!(target instanceof Element) || !this.contains(target)) return;
    const index = this.panels.findIndex((panel) => panel === target || panel.contains(target));
    if (index > -1) this.select(index, undefined, { animate: false });
  };
}

if (!customElements.get('yv-color-collections')) {
  customElements.define('yv-color-collections', YvColorCollections);
}
