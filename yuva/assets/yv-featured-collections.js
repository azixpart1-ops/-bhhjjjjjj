import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Featured collections list (sections/yv-featured-collections-list.liquid).
 *
 * Markup contract (all server-rendered, in block order):
 * <yv-featured-collections>
 *   <div data-yv-fc-layer class="… is-active">media</div> …          background layers
 *   <div data-yv-fc-item class="… is-active">title + text</div> …    centred texts
 *   <a data-yv-fc-link data-index="0" aria-current="true">…</a> …    strip titles (inside the blocks)
 * </yv-featured-collections>
 *
 * Hovering (mouse) or focusing a strip title activates its collection. On touch screens the first
 * tap on an inactive title activates it instead of following the link; the next tap follows it.
 * Selecting a block in the theme editor activates it. Videos play only while their layer is active
 * and the section is on screen (never under reduced motion; the poster shows instead).
 * Emits a bubbling `yv-featured-collections:change` event with `detail.index`.
 *
 * @extends {Component}
 */
class YvFeaturedCollections extends Component {
  /** @type {number} */
  #index = 0;

  /** @type {boolean} */
  #inView = false;

  /** @type {AbortController | null} */
  #controller = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  connectedCallback() {
    super.connectedCallback();
    this.#setup();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#setup();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardown();
  }

  /** @returns {HTMLElement[]} */
  get layers() {
    return /** @type {HTMLElement[]} */ ([...this.querySelectorAll('[data-yv-fc-layer]')]);
  }

  /** @returns {HTMLElement[]} */
  get items() {
    return /** @type {HTMLElement[]} */ ([...this.querySelectorAll('[data-yv-fc-item]')]);
  }

  /** @returns {HTMLElement[]} */
  get links() {
    return /** @type {HTMLElement[]} */ ([...this.querySelectorAll('[data-yv-fc-link]')]);
  }

  /** The active index. */
  get index() {
    return this.#index;
  }

  /**
   * Makes a collection active.
   * @param {number} index
   */
  activate(index) {
    const count = this.layers.length;
    if (!count) return;
    const next = Math.max(0, Math.min(Number(index) || 0, count - 1));
    const changed = next !== this.#index;
    this.#index = next;

    this.layers.forEach((layer, i) => layer.classList.toggle('is-active', i === next));
    this.items.forEach((item, i) => item.classList.toggle('is-active', i === next));
    this.links.forEach((link) => link.setAttribute('aria-current', String(Number(link.dataset.index) === next)));
    this.#syncVideos();

    if (changed) {
      this.dispatchEvent(new CustomEvent('yv-featured-collections:change', { bubbles: true, detail: { index: next } }));
    }
  }

  #setup() {
    this.#teardown();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.addEventListener('pointerover', this.#handlePointerOver, { signal });
    this.addEventListener('focusin', this.#handleFocusIn, { signal });
    this.addEventListener('click', this.#handleClick, { signal });
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal });

    this.#observer = new IntersectionObserver(
      ([entry]) => {
        this.#inView = Boolean(entry?.isIntersecting);
        this.#syncVideos();
      },
      { threshold: 0.1 }
    );
    this.#observer.observe(this);

    const active = this.layers.findIndex((layer) => layer.classList.contains('is-active'));
    this.#index = -1;
    this.activate(active > -1 ? active : 0);
  }

  #teardown() {
    this.#controller?.abort();
    this.#controller = null;
    this.#observer?.disconnect();
    this.#observer = null;
  }

  /**
   * @param {Event} event
   * @returns {number}
   */
  #linkIndex(event) {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('[data-yv-fc-link]');
    if (!(link instanceof HTMLElement) || !this.contains(link)) return -1;
    return Number(link.dataset.index);
  }

  /** @param {PointerEvent} event */
  #handlePointerOver = (event) => {
    if (event.pointerType !== 'mouse') return;
    const index = this.#linkIndex(event);
    if (index > -1) this.activate(index);
  };

  /** @param {FocusEvent} event */
  #handleFocusIn = (event) => {
    const index = this.#linkIndex(event);
    if (index > -1) this.activate(index);
  };

  /** @param {MouseEvent} event */
  #handleClick = (event) => {
    const index = this.#linkIndex(event);
    if (index < 0 || index === this.#index) return;
    // Touch: the first tap shows the collection, the next one opens it.
    event.preventDefault();
    this.activate(index);
  };

  /** @param {Event} event */
  #handleBlockSelect = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !this.contains(target)) return;
    const link = target.querySelector('[data-yv-fc-link]');
    if (link instanceof HTMLElement) this.activate(Number(link.dataset.index));
  };

  #syncVideos() {
    const reduced = prefersReducedMotion();
    this.layers.forEach((layer, i) => {
      const video = layer.querySelector('video');
      if (!video) return;
      if (i === this.#index && this.#inView && !reduced) {
        video.muted = true;
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }
}

if (!customElements.get('yv-featured-collections')) {
  customElements.define('yv-featured-collections', YvFeaturedCollections);
}
