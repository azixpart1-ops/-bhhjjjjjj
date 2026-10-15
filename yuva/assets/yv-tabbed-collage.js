import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/** Rows open on hover only on wide screens with a real pointer. */
const HOVER_QUERY = '(hover: hover) and (min-width: 750px)';
/** Hover intent before a row opens. */
const HOVER_DELAY = 100;

/**
 * Tabbed collage: an accordion of rows that swaps the media column.
 *
 * Modes (data-mode): `click` and `hover` keep exactly one row open (hover rows also open on pointer
 * hover on desktop); `cards` rows can be closed again and start closed. Opening a row shows its media
 * (`.is-active` on the matching slide; CSS crossfades) and plays its video while the section is on
 * screen; other videos pause.
 *
 * Markup contract (sections/yv-tabbed-collage.liquid, snippets/yv-tabbed-collage-row.liquid):
 * <yv-tabbed-collage data-mode="click|hover|cards">
 *   <div ref="slides[]" class="yv-tabbed-collage__slide is-active">…</div> …
 *   <div ref="items[]" class="yv-tabbed-collage__item is-open">
 *     <button class="yv-tabbed-collage__trigger" aria-expanded="true" on:click="yv-tabbed-collage/toggle"
 *       on:pointerenter="yv-tabbed-collage/onPointerEnter" on:pointerleave="yv-tabbed-collage/onPointerLeave">…</button>
 *     <div class="yv-tabbed-collage__panel">…</div>
 *   </div> …
 * </yv-tabbed-collage>
 *
 * Emits a bubbling `yv-tabbed-collage:change` event with `detail.index` when a row opens.
 *
 * @typedef {object} Refs
 * @property {HTMLElement[]} [items] - The accordion rows, in block order.
 * @property {HTMLElement[]} [slides] - The media slides, in the same order.
 *
 * @extends {Component<Refs>}
 */
export class YvTabbedCollage extends Component {
  #media = -1;
  #inView = false;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #hoverTimer;

  /** @type {AbortController | null} */
  #controller = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  connectedCallback() {
    super.connectedCallback();

    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal });

    this.#observer?.disconnect();
    this.#observer = new IntersectionObserver((entries) => {
      this.#inView = entries.some((entry) => entry.isIntersecting);
      this.#syncVideos();
    });
    this.#observer.observe(this);

    this.#restore();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#restore();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
    this.#observer?.disconnect();
    this.#observer = null;
    clearTimeout(this.#hoverTimer);
  }

  /** @returns {HTMLElement[]} */
  get items() {
    return this.refs.items || [];
  }

  /** @returns {HTMLElement[]} */
  get slides() {
    return this.refs.slides || [];
  }

  /** @returns {string} */
  get mode() {
    return this.dataset.mode || 'click';
  }

  /** Index of the open row (-1 when none is open). */
  get index() {
    return this.items.findIndex((item) => item.classList.contains('is-open'));
  }

  /**
   * Opens the row whose header was clicked; in card mode a second click closes it.
   * Declarative use: on:click="yv-tabbed-collage/toggle".
   * @param {Event} event
   */
  toggle(event) {
    clearTimeout(this.#hoverTimer);
    const index = this.#indexOf(event?.target);
    if (index < 0) return;
    const item = this.items[index];
    if (item?.classList.contains('is-open')) {
      if (this.mode === 'cards') this.close(index);
      return;
    }
    this.open(index);
  }

  /**
   * Hover mode: opens the hovered row after a short intent delay (desktop pointers only).
   * Declarative use: on:pointerenter="yv-tabbed-collage/onPointerEnter".
   * @param {PointerEvent} event
   */
  onPointerEnter(event) {
    if (this.mode !== 'hover' || event?.pointerType === 'touch' || !window.matchMedia(HOVER_QUERY).matches) return;
    const index = this.#indexOf(event.target);
    if (index < 0) return;
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = setTimeout(() => this.open(index), HOVER_DELAY);
  }

  /** Cancels a pending hover open. Declarative use: on:pointerleave="yv-tabbed-collage/onPointerLeave". */
  onPointerLeave() {
    clearTimeout(this.#hoverTimer);
  }

  /**
   * Opens one row (closing the others) and shows its media.
   * @param {number} index
   * @param {{ silent?: boolean }} [options]
   */
  open(index, { silent = false } = {}) {
    const { items } = this;
    if (!items[index]) return;
    const changed = !items[index].classList.contains('is-open');
    items.forEach((item, i) => this.#setOpen(item, i === index));
    this.#showMedia(index);
    if (silent || !changed) return;
    this.dispatchEvent(new CustomEvent('yv-tabbed-collage:change', { bubbles: true, detail: { index } }));
  }

  /**
   * Closes one row (card mode). The media of the closed row stays visible.
   * @param {number} index
   */
  close(index) {
    const item = this.items[index];
    if (item) this.#setOpen(item, false);
  }

  /** Re-applies the state after a connect or a Section Rendering API update. */
  #restore() {
    const open = this.index;
    if (open > -1) {
      this.open(open, { silent: true });
    } else if (this.mode !== 'cards' && this.items.length) {
      this.open(0, { silent: true });
    } else {
      const active = this.slides.findIndex((slide) => slide.classList.contains('is-active'));
      this.#media = -1;
      this.#showMedia(Math.max(active, 0));
    }
  }

  /**
   * @param {HTMLElement} item
   * @param {boolean} open
   */
  #setOpen(item, open) {
    item.classList.toggle('is-open', open);
    const trigger = item.querySelector('.yv-tabbed-collage__trigger');
    if (!trigger) return;
    if (trigger.hasAttribute('aria-expanded')) {
      trigger.setAttribute('aria-expanded', String(open));
    } else if (open) {
      trigger.setAttribute('aria-current', 'true');
    } else {
      trigger.removeAttribute('aria-current');
    }
  }

  /** @param {number} index */
  #showMedia(index) {
    const { slides } = this;
    if (!slides[index]) return;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    this.#media = index;
    this.#syncVideos();
  }

  /** Plays the visible slide's video while the section is on screen; pauses every other video. */
  #syncVideos() {
    const reduce = prefersReducedMotion();
    this.slides.forEach((slide, i) => {
      const video = slide.querySelector('video');
      if (!video) return;
      if (i === this.#media && this.#inView && !reduce) {
        video.muted = true;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  /**
   * @param {EventTarget | null | undefined} target
   * @returns {number}
   */
  #indexOf(target) {
    if (!(target instanceof Element)) return -1;
    const item = target.closest('.yv-tabbed-collage__item');
    return item ? this.items.indexOf(/** @type {HTMLElement} */ (item)) : -1;
  }

  /**
   * Theme editor: selecting a row's block opens it.
   * @param {Event} event
   */
  #handleBlockSelect = (event) => {
    const { target } = event;
    if (!(target instanceof Element) || !this.contains(target)) return;
    const index = this.items.findIndex((item) => item === target || item.contains(target));
    if (index > -1) this.open(index);
  };
}

if (!customElements.get('yv-tabbed-collage')) {
  customElements.define('yv-tabbed-collage', YvTabbedCollage);
}
