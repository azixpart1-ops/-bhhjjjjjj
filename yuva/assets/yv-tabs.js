import { Component } from '@theme/component';
import { getDirectionMultiplier } from '@theme/utilities';

/**
 * Accessible tabs: one role="tab" button and one role="tabpanel" per item.
 * Based on Horizon's tabs pattern, extended with
 * vertical orientation, nested-tabs safety and editor block selection on tabs or panels.
 *
 * Markup contract:
 * <yv-tabs data-initial-index="0">
 *   <div role="tablist" aria-label="…" [aria-orientation="vertical"] on:keydown="yv-tabs/onKeydown">
 *     <button type="button" role="tab" id="YvTab-ID" aria-controls="YvPanel-ID" aria-selected="true" tabindex="0"
 *             ref="tabs[]" on:click="yv-tabs/select/0">…</button> …
 *   </div>
 *   <div role="tabpanel" id="YvPanel-ID" aria-labelledby="YvTab-ID" ref="panels[]">…</div>
 *   <div role="tabpanel" … ref="panels[]" hidden>…</div>
 * </yv-tabs>
 *
 * Emits a bubbling `yv-tabs:change` event with `detail.index` (and `detail.tab`, `detail.panel`).
 *
 * @typedef {object} Refs
 * @property {HTMLElement[]} [tabs] - The tab buttons, in order.
 * @property {HTMLElement[]} [panels] - The panels, in the same order.
 *
 * @extends {Component<Refs>}
 */
export class YvTabs extends Component {
  #index = -1;

  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();

    this.#controller?.abort();
    this.#controller = new AbortController();
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, {
      signal: this.#controller.signal,
    });

    const selected = this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    const initial = Number(this.dataset.initialIndex);
    this.#index = -1;
    this.select(Number.isFinite(initial) && this.dataset.initialIndex !== undefined ? initial : Math.max(selected, 0), undefined, {
      silent: true,
    });
  }

  updatedCallback() {
    super.updatedCallback();
    const index = Math.max(this.#index, 0);
    this.#index = -1;
    this.select(index, undefined, { silent: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
  }

  /** Tab buttons owned by this element (not by nested yv-tabs). */
  get tabs() {
    return (this.refs.tabs || []).filter((tab) => tab.closest('yv-tabs') === this);
  }

  /** Panels owned by this element (not by nested yv-tabs). */
  get panels() {
    return (this.refs.panels || []).filter((panel) => panel.parentElement?.closest('yv-tabs') === this);
  }

  /** The selected index. */
  get index() {
    return this.#index;
  }

  /**
   * Selects a tab. Declarative use: on:click="yv-tabs/select/2".
   * @param {number} index - Zero-based index; wraps around at both ends.
   * @param {Event} [event] - The triggering event, when called from markup.
   * @param {{ focus?: boolean, silent?: boolean }} [options]
   */
  select(index, event, { focus = false, silent = false } = {}) {
    const { tabs, panels } = this;
    if (!tabs.length) return;

    const next = ((Number(index) % tabs.length) + tabs.length) % tabs.length;

    tabs.forEach((tab, i) => {
      const selected = i === next;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle('is-active', selected);
      const panel = panels[i];
      if (panel) {
        panel.hidden = !selected;
        panel.classList.toggle('is-active', selected);
      }
    });

    if (focus) tabs[next]?.focus();
    if (next === this.#index) return;

    this.#index = next;
    this.dataset.activeIndex = String(next);
    if (silent) return;

    this.dispatchEvent(
      new CustomEvent('yv-tabs:change', {
        bubbles: true,
        detail: { index: next, tab: tabs[next], panel: panels[next] || null },
      })
    );
  }

  /**
   * Arrow keys move between tabs (mirrored in RTL; Up/Down when aria-orientation="vertical");
   * Home and End jump to the ends. Declarative use: on:keydown="yv-tabs/onKeydown" on the tablist.
   * @param {KeyboardEvent} event
   */
  onKeydown(event) {
    const { tabs } = this;
    if (!tabs.length) return;

    const list = /** @type {Element | null} */ (tabs[0]?.closest('[role="tablist"]'));
    const vertical = list?.getAttribute('aria-orientation') === 'vertical';
    const direction = getDirectionMultiplier(this);
    const last = tabs.length - 1;

    /** @type {Record<string, number>} */
    const targets = vertical
      ? { ArrowDown: this.#index + 1, ArrowUp: this.#index - 1, Home: 0, End: last }
      : { ArrowRight: this.#index + direction, ArrowLeft: this.#index - direction, Home: 0, End: last };

    const target = targets[event.key];
    if (target === undefined) return;

    event.preventDefault();
    this.select(target, event, { focus: true });
  }

  /**
   * In the theme editor, selecting a tab's block (on the tab button or inside its panel) shows that panel.
   * @param {Event} event
   */
  #handleBlockSelect = (event) => {
    const { target } = event;
    if (!(target instanceof Element) || !this.contains(target)) return;

    const panelIndex = this.panels.findIndex((panel) => panel === target || panel.contains(target));
    const tabIndex = this.tabs.findIndex((tab) => tab === target || tab.contains(target));
    const index = panelIndex > -1 ? panelIndex : tabIndex;
    if (index > -1) this.select(index);
  };
}

if (!customElements.get('yv-tabs')) {
  customElements.define('yv-tabs', YvTabs);
}
