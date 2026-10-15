import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Yuva timeline: a strip of navigation labels synced to a peeking content slider.
 *
 * Markup contract (sections/yv-timeline.liquid, blocks/_yv-timeline-item.liquid):
 *
 * <yv-timeline class="yv-timeline">
 *   <button ref="prev" on:click="yv-timeline/previous">…</button>
 *   <div ref="nav">                                    ← label strip (scrolls when labels overflow)
 *     <button ref="labels[]" on:click="yv-timeline/select/0" aria-controls="…">2018</button> …
 *   </div>
 *   <button ref="next" on:click="yv-timeline/next">…</button>
 *   <div ref="track">                                  ← content scroll-snap track
 *     <div class="yv-timeline-item" ref="slides[]">…</div> …
 *   </div>
 * </yv-timeline>
 *
 * - One item is active (`.is-active` on the slide and its label, `aria-current="step"` on the label).
 *   The first item is active on load. No looping.
 * - Clicking a label or a peeking neighbour, the arrows, swiping (native scroll-snap) or dragging
 *   the content with a mouse change the active item. Focus moving into a slide activates it.
 * - The active label is scrolled into view inside the strip (the page never scrolls).
 * - Theme editor: selecting an item's block activates it.
 *
 * Event: bubbling `yv-timeline:change` with detail { index }.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track
 * @property {HTMLElement} [nav]
 * @property {HTMLElement[]} [labels]
 * @property {HTMLElement[]} [slides]
 * @property {HTMLButtonElement} [prev]
 * @property {HTMLButtonElement} [next]
 *
 * @extends {Component<Refs>}
 */
export class YvTimeline extends Component {
  requiredRefs = ['track'];

  /** @type {AbortController | null} */
  #controller = null;
  #index = 0;
  /** @type {number | undefined} */
  #settleTimer;
  /** Programmatic scroll in progress: scroll events must not re-pick the active item. */
  #programmatic = false;
  /** @type {number | undefined} */
  #programmaticTimer;
  /** @type {{ x: number, scroll: number, id: number, moved: boolean } | null} */
  #drag = null;
  #suppressClick = false;

  connectedCallback() {
    super.connectedCallback();
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    const { track } = this.refs;

    track.addEventListener('scroll', this.#handleScroll, { passive: true, signal });
    track.addEventListener('click', this.#handleTrackClick, { capture: true, signal });
    track.addEventListener('pointerdown', this.#handlePointerDown, { signal });
    track.addEventListener('dragstart', (event) => event.preventDefault(), { signal });
    this.addEventListener('focusin', this.#handleFocusIn, { signal });
    this.addEventListener('keydown', this.#handleKeydown, { signal });
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal });
    window.addEventListener('resize', this.#handleResize, { passive: true, signal });

    const initial = Math.min(Number(this.dataset.activeIndex) || 0, Math.max(this.slides.length - 1, 0));
    this.#index = initial;
    this.#render();
    requestAnimationFrame(() => this.#scrollTo(initial, true));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
    clearTimeout(this.#settleTimer);
    clearTimeout(this.#programmaticTimer);
  }

  updatedCallback() {
    super.updatedCallback();
    this.#index = Math.min(this.#index, Math.max(this.slides.length - 1, 0));
    this.#render();
    this.#scrollTo(this.#index, true);
  }

  /** @returns {HTMLElement[]} */
  get slides() {
    return /** @type {HTMLElement[]} */ (this.refs.slides ?? []);
  }

  /** @returns {HTMLElement[]} */
  get labels() {
    return /** @type {HTMLElement[]} */ (this.refs.labels ?? []);
  }

  get index() {
    return this.#index;
  }

  /**
   * Activates an item and scrolls both strips to it.
   * @param {number | Event} index
   * @param {Event} [event]
   */
  select(index, event) {
    if (typeof index !== 'number') return;
    event?.preventDefault?.();
    this.#activate(index);
  }

  next() {
    this.#activate(this.#index + 1);
  }

  previous() {
    this.#activate(this.#index - 1);
  }

  /**
   * @param {number} index
   * @param {{ instant?: boolean, scroll?: boolean }} [options]
   */
  #activate(index, { instant = false, scroll = true } = {}) {
    const count = this.slides.length;
    if (!count) return;
    const next = Math.max(0, Math.min(count - 1, index));
    const changed = next !== this.#index;
    this.#index = next;
    this.#render();
    if (scroll) this.#scrollTo(next, instant);
    if (changed) {
      this.dispatchEvent(new CustomEvent('yv-timeline:change', { bubbles: true, detail: { index: next } }));
    }
  }

  #render() {
    const index = this.#index;
    const count = this.slides.length;

    this.slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });

    this.labels.forEach((label, i) => {
      const active = i === index;
      label.classList.toggle('is-active', active);
      if (active) {
        label.setAttribute('aria-current', 'step');
      } else {
        label.removeAttribute('aria-current');
      }
    });

    const { prev, next } = this.refs;
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= count - 1;

    this.dataset.activeIndex = String(index);
  }

  /**
   * Centres the active slide in the track and the active label in the strip, without moving the page.
   * @param {number} index
   * @param {boolean} instant
   */
  #scrollTo(index, instant) {
    const behavior = instant || prefersReducedMotion() ? 'instant' : 'smooth';
    const { track, nav } = this.refs;
    const slide = this.slides[index];

    if (slide) {
      const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
      this.#programmatic = true;
      clearTimeout(this.#programmaticTimer);
      this.#programmaticTimer = setTimeout(() => (this.#programmatic = false), behavior === 'smooth' ? 700 : 50);
      track.scrollTo({ left, behavior: /** @type {ScrollBehavior} */ (behavior) });
    }

    const label = this.labels[index];
    if (nav && label) {
      const left = label.offsetLeft - (nav.clientWidth - label.offsetWidth) / 2;
      nav.scrollTo({ left, behavior: /** @type {ScrollBehavior} */ (behavior) });
    }
  }

  /** The slide whose centre is closest to the track's centre. */
  #closestIndex() {
    const { track } = this.refs;
    const centre = track.scrollLeft + track.clientWidth / 2;
    let best = this.#index;
    let bestDistance = Infinity;
    this.slides.forEach((slide, i) => {
      const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  #handleScroll = () => {
    if (this.#programmatic || this.#drag) return;
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(() => {
      const index = this.#closestIndex();
      if (index !== this.#index) this.#activate(index, { scroll: false });
    }, 120);
  };

  #handleResize = () => {
    this.#scrollTo(this.#index, true);
  };

  /** A click on a peeking neighbour activates it instead of following its links. */
  #handleTrackClick = (/** @type {MouseEvent} */ event) => {
    if (this.#suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      this.#suppressClick = false;
      return;
    }
    const target = /** @type {Element} */ (event.target);
    const slide = /** @type {HTMLElement | null} */ (target.closest('.yv-timeline-item'));
    if (!slide) return;
    const index = this.slides.indexOf(slide);
    if (index === -1 || index === this.#index) return;
    event.preventDefault();
    event.stopPropagation();
    this.#activate(index);
  };

  #handleFocusIn = (/** @type {FocusEvent} */ event) => {
    const target = /** @type {Element} */ (event.target);
    const slide = /** @type {HTMLElement | null} */ (target.closest('.yv-timeline-item'));
    if (!slide) return;
    const index = this.slides.indexOf(slide);
    if (index !== -1 && index !== this.#index) this.#activate(index);
  };

  /** Arrow keys on a label move between labels (roving through the strip). */
  #handleKeydown = (/** @type {KeyboardEvent} */ event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const position = this.labels.indexOf(target);
    if (position === -1) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    let next = null;
    if (event.key === 'ArrowRight') next = position + (rtl ? -1 : 1);
    if (event.key === 'ArrowLeft') next = position + (rtl ? 1 : -1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = this.labels.length - 1;
    if (next === null) return;
    event.preventDefault();
    next = Math.max(0, Math.min(this.labels.length - 1, next));
    this.#activate(next);
    this.labels[next]?.focus();
  };

  /** Mouse drag on the content (touch uses native swipe with scroll-snap). */
  #handlePointerDown = (/** @type {PointerEvent} */ event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const { track } = this.refs;
    this.#drag = { x: event.clientX, scroll: track.scrollLeft, id: event.pointerId, moved: false };
    const signal = this.#controller?.signal;

    const move = (/** @type {PointerEvent} */ e) => {
      if (!this.#drag) return;
      const dx = e.clientX - this.#drag.x;
      if (!this.#drag.moved && Math.abs(dx) < 6) return;
      if (!this.#drag.moved) {
        this.#drag.moved = true;
        this.toggleAttribute('data-dragging', true);
        track.setPointerCapture?.(this.#drag.id);
      }
      track.scrollLeft = this.#drag.scroll - dx;
    };

    const up = (/** @type {PointerEvent} */ e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const drag = this.#drag;
      this.#drag = null;
      this.removeAttribute('data-dragging');
      if (!drag?.moved) return;
      this.#suppressClick = true;
      setTimeout(() => (this.#suppressClick = false), 0);
      const dx = e.clientX - drag.x;
      let index = this.#closestIndex();
      if (index === this.#index && Math.abs(dx) > 40) index = this.#index + (dx < 0 ? 1 : -1);
      this.#activate(index);
    };

    window.addEventListener('pointermove', move, { signal });
    window.addEventListener('pointerup', up, { signal });
    window.addEventListener('pointercancel', up, { signal });
  };

  #handleBlockSelect = (/** @type {Event} */ event) => {
    const target = /** @type {Element} */ (event.target);
    if (!(target instanceof Element) || !this.contains(target)) return;
    const slide = /** @type {HTMLElement | null} */ (target.closest('.yv-timeline-item'));
    const index = slide ? this.slides.indexOf(slide) : -1;
    if (index !== -1) this.#activate(index, { instant: true });
  };
}

if (!customElements.get('yv-timeline')) {
  customElements.define('yv-timeline', YvTimeline);
}
