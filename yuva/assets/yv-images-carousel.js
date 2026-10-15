import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

const DESKTOP = '(min-width: 750px)';
const SWIPE_THRESHOLD = 40;

/**
 * Yuva "Images carousel": a centred, endlessly wrapping row of wide image cards on desktop. The
 * selected card sits in the middle and its neighbours peek in from both screen edges; the arrows move
 * exactly one card. Below 750px it is a plain native scroll row (CSS only, no JS behaviour).
 *
 * The wrap-around works with one inert, aria-hidden copy of the slide set on each side of the real
 * slides. After a move lands on a copy, the track jumps (without a transition) to the matching real
 * slide, so the motion never runs out. Copies are created only on desktop and removed on mobile.
 *
 * Markup contract (sections/yv-images-carousel.liquid):
 * <yv-images-carousel-component data-autoplay="0" data-slide-label="[index] of [count]" …>
 *   <div class="yv-images-carousel__viewport" ref="viewport">
 *     <div class="yv-images-carousel__track" ref="track"> slides (block roots) </div>
 *   </div>
 *   <button ref="previous" on:click="/previous">…</button>
 *   <button ref="next" on:click="/next">…</button>
 * </yv-images-carousel-component>
 *
 * Events: bubbling `yv-images-carousel:change` with detail { index }.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} viewport
 * @property {HTMLElement} track
 * @property {HTMLButtonElement} [previous]
 * @property {HTMLButtonElement} [next]
 *
 * @extends {Component<Refs>}
 */
export class YvImagesCarouselComponent extends Component {
  requiredRefs = ['viewport', 'track'];

  /** @type {AbortController | null} */
  #controller = null;
  /** @type {ResizeObserver | null} */
  #resizeObserver = null;
  /** @type {IntersectionObserver | null} */
  #viewObserver = null;
  /** @type {MediaQueryList | null} */
  #desktop = null;
  /** @type {number | undefined} */
  #timer;
  /** @type {number | undefined} */
  #settleTimer;
  #position = 0;
  #active = false;
  #hovered = false;
  #focused = false;
  #inView = false;
  #editorPaused = false;

  connectedCallback() {
    super.connectedCallback();
    this.#teardown();

    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.#desktop = window.matchMedia(DESKTOP);
    this.#desktop.addEventListener('change', this.#sync, { signal });

    const { track, viewport } = this.refs;
    track.addEventListener('transitionend', this.#handleTransitionEnd, { signal });
    viewport.addEventListener('pointerdown', this.#handlePointerDown, { signal });
    this.addEventListener('keydown', this.#handleKeydown, { signal });
    this.addEventListener('focusin', this.#handleFocusIn, { signal });
    this.addEventListener('focusout', this.#handleFocusOut, { signal });
    this.addEventListener('pointerenter', this.#handlePointerEnter, { signal });
    this.addEventListener('pointerleave', this.#handlePointerLeave, { signal });
    document.addEventListener('visibilitychange', this.#syncAutoplay, { signal });
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal });
    document.addEventListener('shopify:block:deselect', this.#handleBlockDeselect, { signal });

    this.#resizeObserver = new ResizeObserver(() => this.#place(false));
    this.#resizeObserver.observe(viewport);

    this.#viewObserver = new IntersectionObserver(
      ([entry]) => {
        this.#inView = Boolean(entry?.isIntersecting);
        this.#syncAutoplay();
      },
      { threshold: 0.2 }
    );
    this.#viewObserver.observe(this);

    this.#labelSlides();
    this.#sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardown();
    this.#removeCopies();
  }

  #teardown() {
    this.#controller?.abort();
    this.#controller = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#viewObserver?.disconnect();
    this.#viewObserver = null;
    window.clearInterval(this.#timer);
    window.clearTimeout(this.#settleTimer);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  /** The real (non-copy) slides, in order. */
  get slides() {
    return /** @type {HTMLElement[]} */ (
      [...this.refs.track.children].filter((el) => el instanceof HTMLElement && !el.hasAttribute('data-yv-copy'))
    );
  }

  /** Zero-based index of the centred real slide. */
  get index() {
    const count = this.slides.length;
    if (!count) return 0;
    return (((this.#position - count) % count) + count) % count;
  }

  /** Moves one slide forward. Declarative use: on:click="/next". */
  next() {
    this.#move(1);
  }

  /** Moves one slide back. Declarative use: on:click="/previous". */
  previous() {
    this.#move(-1);
  }

  /**
   * Centres a real slide.
   * @param {number} index - Zero-based real slide index.
   * @param {{ instant?: boolean }} [options]
   */
  goTo(index, options = {}) {
    const count = this.slides.length;
    if (!this.#active || !count) return;
    const target = count + (((Number(index) || 0) % count) + count) % count;
    this.#position = target;
    this.#place(!options.instant);
    this.#announce();
  }

  /* ------------------------------------------------------------------ */
  /* Mode switching                                                      */
  /* ------------------------------------------------------------------ */

  #sync = () => {
    const shouldRun = Boolean(this.#desktop?.matches) && this.slides.length > 1;

    if (shouldRun && !this.#active) {
      this.#addCopies();
      this.#active = true;
      this.setAttribute('data-active', '');
      this.#position = this.slides.length;
      this.#place(false);
      this.#announce();
    } else if (!shouldRun && this.#active) {
      this.#active = false;
      this.removeAttribute('data-active');
      this.#removeCopies();
      this.refs.track.style.transform = '';
      this.refs.track.style.transition = '';
      this.#syncSlideStates();
    }

    this.#syncAutoplay();
  };

  #addCopies() {
    const { track } = this.refs;
    const slides = this.slides;
    if (slides.length < 2) return;

    const makeCopy = (/** @type {HTMLElement} */ slide) => {
      const copy = /** @type {HTMLElement} */ (slide.cloneNode(true));
      copy.setAttribute('data-yv-copy', '');
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('inert', '');
      copy.removeAttribute('data-shopify-editor-block');
      copy.removeAttribute('id');
      copy.removeAttribute('role');
      copy.removeAttribute('aria-roledescription');
      copy.removeAttribute('aria-label');
      for (const el of copy.querySelectorAll('[id]')) el.removeAttribute('id');
      for (const img of copy.querySelectorAll('img[loading="lazy"]')) img.setAttribute('loading', 'eager');
      return copy;
    };

    const before = document.createDocumentFragment();
    const after = document.createDocumentFragment();
    for (const slide of slides) {
      before.append(makeCopy(slide));
      after.append(makeCopy(slide));
    }
    track.prepend(before);
    track.append(after);
  }

  #removeCopies() {
    for (const copy of this.refs.track?.querySelectorAll(':scope > [data-yv-copy]') ?? []) copy.remove();
  }

  /* ------------------------------------------------------------------ */
  /* Movement                                                            */
  /* ------------------------------------------------------------------ */

  /** @param {number} step */
  #move(step) {
    if (!this.#active) return;
    const count = this.slides.length;
    if (!count) return;

    // Rapid clicks keep retargeting the running transition; settle first only when the next
    // position would run past the copies.
    const next = this.#position + step;
    if (next < 0 || next >= count * 3) this.#normalise();

    this.#position += step;
    this.#place(true);
    this.#announce();
    this.#restartAutoplay();
  }

  /**
   * Translates the track so the slide at #position is centred in the viewport.
   * @param {boolean} animate
   */
  #place(animate) {
    if (!this.#active) return;
    const smooth = animate && !prefersReducedMotion();
    if (!smooth) this.#wrapPosition();
    const { track, viewport } = this.refs;
    const items = /** @type {HTMLElement[]} */ ([...track.children]);
    const target = items[this.#position];
    if (!target) return;

    const offset = viewport.clientWidth / 2 - (target.offsetLeft + target.offsetWidth / 2);

    track.style.transition = smooth ? '' : 'none';
    track.style.transform = `translate3d(${offset}px, 0, 0)`;

    window.clearTimeout(this.#settleTimer);
    if (smooth) {
      // transitionend can be skipped (hidden tab, interrupted move); settle anyway.
      this.#settleTimer = window.setTimeout(() => this.#normalise(), 1200);
    } else {
      // Force the instant jump to apply before any later transition.
      void track.offsetWidth;
      track.style.transition = '';
    }

    this.#syncSlideStates();
  }

  #handleTransitionEnd = (/** @type {TransitionEvent} */ event) => {
    if (event.target !== this.refs.track || event.propertyName !== 'transform') return;
    this.#normalise();
  };

  /** Jumps from a copy back to the matching real slide without animation. */
  #normalise() {
    window.clearTimeout(this.#settleTimer);
    if (!this.#active) return;
    const before = this.#position;
    this.#wrapPosition();
    if (this.#position !== before) this.#place(false);
  }

  /** Brings #position back into the real slides (the middle third of the track). */
  #wrapPosition() {
    const count = this.slides.length;
    if (!count) return;
    this.#position = count + ((((this.#position - count) % count) + count) % count);
  }

  #syncSlideStates() {
    const { track } = this.refs;
    const items = /** @type {HTMLElement[]} */ ([...track.children]);
    items.forEach((item, i) => {
      if (this.#active && i === this.#position) item.setAttribute('data-current', '');
      else item.removeAttribute('data-current');
    });
  }

  #announce() {
    this.dispatchEvent(new CustomEvent('yv-images-carousel:change', { bubbles: true, detail: { index: this.index } }));
  }

  #labelSlides() {
    const template = this.dataset.slideLabel;
    const roledescription = this.dataset.slideRoledescription;
    const slides = this.slides;
    slides.forEach((slide, i) => {
      slide.setAttribute('role', 'group');
      if (roledescription) slide.setAttribute('aria-roledescription', roledescription);
      if (template) {
        slide.setAttribute('aria-label', template.replace('[index]', String(i + 1)).replace('[count]', String(slides.length)));
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */

  #handleKeydown = (/** @type {KeyboardEvent} */ event) => {
    if (!this.#active) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      rtl ? this.previous() : this.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      rtl ? this.next() : this.previous();
    }
  };

  /** Swipe on touch screens wide enough for the desktop layout. */
  #handlePointerDown = (/** @type {PointerEvent} */ event) => {
    if (!this.#active || event.pointerType === 'mouse') return;
    const startX = event.clientX;
    const startY = event.clientY;
    const gesture = new AbortController();

    const onUp = (/** @type {PointerEvent} */ up) => {
      gesture.abort();
      const dx = up.clientX - startX;
      const dy = up.clientY - startY;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      const rtl = getComputedStyle(this).direction === 'rtl';
      const forward = rtl ? dx > 0 : dx < 0;
      forward ? this.next() : this.previous();
    };

    window.addEventListener('pointerup', onUp, { signal: gesture.signal });
    window.addEventListener('pointercancel', () => gesture.abort(), { signal: gesture.signal });
  };

  #handleFocusIn = (/** @type {FocusEvent} */ event) => {
    this.#focused = true;
    this.#syncAutoplay();
    if (!this.#active || !(event.target instanceof Element)) return;
    const slide = this.slides.find((item) => item.contains(/** @type {Node} */ (event.target)));
    if (!slide) return;
    const index = this.slides.indexOf(slide);
    if (index !== this.index) {
      this.refs.viewport.scrollLeft = 0;
      this.goTo(index);
    }
  };

  #handleFocusOut = (/** @type {FocusEvent} */ event) => {
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
    this.#focused = false;
    this.#syncAutoplay();
  };

  #handlePointerEnter = () => {
    this.#hovered = true;
    this.#syncAutoplay();
  };

  #handlePointerLeave = () => {
    this.#hovered = false;
    this.#syncAutoplay();
  };

  #handleBlockSelect = (/** @type {Event} */ event) => {
    if (!(event.target instanceof Node) || !this.contains(event.target)) return;
    const slide = this.slides.find((item) => item.contains(/** @type {Node} */ (event.target)));
    this.#editorPaused = true;
    this.#syncAutoplay();
    if (slide) this.goTo(this.slides.indexOf(slide), { instant: true });
  };

  #handleBlockDeselect = (/** @type {Event} */ event) => {
    if (!(event.target instanceof Node) || !this.contains(event.target)) return;
    this.#editorPaused = false;
    this.#syncAutoplay();
  };

  /* ------------------------------------------------------------------ */
  /* Autoplay                                                            */
  /* ------------------------------------------------------------------ */

  get #autoplayInterval() {
    const seconds = parseFloat(this.dataset.autoplay || '0');
    return Number.isFinite(seconds) && seconds > 0 ? Math.max(seconds, 2) * 1000 : 0;
  }

  #syncAutoplay = () => {
    const interval = this.#autoplayInterval;
    const shouldPlay =
      interval > 0 &&
      this.#active &&
      this.#inView &&
      !this.#hovered &&
      !this.#focused &&
      !this.#editorPaused &&
      !document.hidden &&
      !prefersReducedMotion();

    if (shouldPlay && this.#timer === undefined) {
      this.#timer = window.setInterval(() => this.#move(1), interval);
    } else if (!shouldPlay && this.#timer !== undefined) {
      window.clearInterval(this.#timer);
      this.#timer = undefined;
    }
  };

  #restartAutoplay() {
    if (this.#timer === undefined) return;
    window.clearInterval(this.#timer);
    this.#timer = undefined;
    this.#syncAutoplay();
  }
}

if (!customElements.get('yv-images-carousel-component')) {
  customElements.define('yv-images-carousel-component', YvImagesCarouselComponent);
}
