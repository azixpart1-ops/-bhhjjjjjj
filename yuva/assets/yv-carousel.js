import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Yuva scroll-snap carousel.
 *
 * Markup contract (see snippets/yv-carousel.liquid and snippets/yv-carousel-controls.liquid):
 *
 * <yv-carousel id="…" class="yv-carousel" data-arrows="sides|top-right|bottom|none" …>
 *   <div class="yv-carousel__track" id="…-track" ref="track">  ← every visible child is a slide
 *     <div>slide 1</div> <div>slide 2</div> …
 *   </div>
 *   <div class="yv-carousel__controls">…arrows [data-yv-carousel-action], dots [ref=dots]…</div>
 * </yv-carousel>
 *
 * Options (attributes on <yv-carousel>):
 * - data-autoplay="5"      seconds between moves; absent or 0 = no autoplay. Never runs under reduced motion.
 * - data-loop              wrap from the last page to the first (and back).
 * - data-step="page|slide" arrows move one page (default) or one slide.
 * - data-align="start|center" snap alignment (center = centre-emphasised carousel).
 * - data-drag="false"      disables mouse drag-to-scroll (on by default for fine pointers).
 * - data-slide-label="[index] of [count]"  translated slide label template.
 * - data-slide-roledescription="slide"      translated roledescription for slides.
 * - data-dot-label="Go to slide [index]"    translated dot label template.
 *
 * Events: bubbling `yv-carousel:change` with detail { index, page, pageCount }.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track - The scroll-snap track. Its visible children are the slides.
 * @property {HTMLElement} [dots] - Empty container the dots are generated into.
 * @property {HTMLButtonElement} [playToggle] - Optional autoplay pause/play toggle.
 *
 * @extends {Component<Refs>}
 */
export class YvCarousel extends Component {
  /** @type {AbortController | null} */
  #controller = null;
  /** @type {ResizeObserver | null} */
  #resizeObserver = null;
  /** @type {IntersectionObserver | null} */
  #viewObserver = null;
  /** @type {number | undefined} */
  #timer;
  /** @type {number} */
  #frame = 0;
  #index = 0;
  #page = 0;
  #pageCount = 1;
  #perPage = 1;
  #inView = false;
  #hovered = false;
  #focused = false;
  #userPaused = false;
  #editorPaused = false;
  #dragging = false;
  #initialised = false;
  #autoplayStep = false;

  connectedCallback() {
    super.connectedCallback();
    this.#teardown();

    const track = this.track;
    if (!track) return;

    this.#controller = new AbortController();
    const { signal } = this.#controller;

    track.addEventListener('scroll', this.#scheduleUpdate, { passive: true, signal });
    track.addEventListener('pointerdown', this.#handlePointerDown, { signal });
    track.addEventListener('dragstart', this.#handleDragStart, { signal });
    this.addEventListener('pointerenter', this.#handlePointerEnter, { signal });
    this.addEventListener('pointerleave', this.#handlePointerLeave, { signal });
    this.addEventListener('focusin', this.#handleFocusIn, { signal });
    this.addEventListener('focusout', this.#handleFocusOut, { signal });
    document.addEventListener('visibilitychange', this.#syncAutoplay, { signal });
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal });
    document.addEventListener('shopify:block:deselect', this.#handleBlockDeselect, { signal });

    this.#resizeObserver = new ResizeObserver(this.#scheduleUpdate);
    this.#resizeObserver.observe(track);

    this.#viewObserver = new IntersectionObserver(
      ([entry]) => {
        this.#inView = Boolean(entry?.isIntersecting);
        this.#syncAutoplay();
      },
      { threshold: 0.2 }
    );
    this.#viewObserver.observe(this);

    this.#labelSlides();
    this.#update();
    this.#initialised = true;
  }

  updatedCallback() {
    super.updatedCallback();
    this.#labelSlides();
    this.#update();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardown();
  }

  #teardown() {
    this.#controller?.abort();
    this.#controller = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#viewObserver?.disconnect();
    this.#viewObserver = null;
    window.clearTimeout(this.#timer);
    cancelAnimationFrame(this.#frame);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  /** The scroll track (the first [ref="track"] owned by this carousel). */
  get track() {
    const ref = this.refs.track;
    if (ref instanceof HTMLElement) return ref;
    return /** @type {HTMLElement | null} */ (this.querySelector(':scope .yv-carousel__track'));
  }

  /** Visible slides, in DOM order. */
  get slides() {
    const track = this.track;
    if (!track) return [];
    return /** @type {HTMLElement[]} */ ([...track.children]).filter(
      (element) => element instanceof HTMLElement && !element.hidden && element.tagName !== 'TEMPLATE'
    );
  }

  /** Index of the slide aligned with the start (or centre) of the track. */
  get index() {
    return this.#index;
  }

  /** Current page (zero based). */
  get page() {
    return this.#page;
  }

  /** Number of pages for the current viewport. */
  get pageCount() {
    return this.#pageCount;
  }

  get loop() {
    return this.hasAttribute('data-loop') && this.dataset.loop !== 'false';
  }

  get autoplayInterval() {
    const seconds = parseFloat(this.dataset.autoplay || '0');
    return Number.isFinite(seconds) && seconds > 0 ? Math.max(seconds, 1) * 1000 : 0;
  }

  /**
   * Moves forward by one page (or one slide with data-step="slide").
   * Declarative use: on:click="yv-carousel/next".
   * @param {Event} [event]
   */
  next(event) {
    event?.preventDefault?.();
    const { slides } = this;
    if (!slides.length) return;

    if (this.#atEnd()) {
      if (this.loop || this.#autoplayStep) this.goTo(0);
      return;
    }

    this.goTo(Math.min(this.#index + this.#stepSize(), slides.length - 1));
  }

  /**
   * Moves back by one page (or one slide).
   * Declarative use: on:click="yv-carousel/previous".
   * @param {Event} [event]
   */
  previous(event) {
    event?.preventDefault?.();
    const { slides } = this;
    if (!slides.length) return;

    if (this.#atStart()) {
      if (this.loop) this.goTo(slides.length - 1);
      return;
    }

    this.goTo(Math.max(this.#index - this.#stepSize(), 0));
  }

  /**
   * Scrolls a slide into its snap position.
   * Declarative use: on:click="yv-carousel/goTo/2".
   * @param {number} index - Zero-based slide index (clamped).
   * @param {Event | { instant?: boolean }} [eventOrOptions]
   * @param {{ instant?: boolean }} [options]
   */
  goTo(index, eventOrOptions, options = {}) {
    const opts = eventOrOptions && !(eventOrOptions instanceof Event) ? eventOrOptions : options;
    const track = this.track;
    const { slides } = this;
    if (!track || !slides.length) return;

    const target = slides[Math.max(0, Math.min(Number(index) || 0, slides.length - 1))];
    if (!target) return;

    const delta = this.#offsetOf(target);
    track.scrollBy({ left: delta, behavior: opts.instant || prefersReducedMotion() ? 'instant' : 'smooth' });
    this.#restartAutoplay();
  }

  /**
   * Goes to a page. Declarative use: on:click="yv-carousel/goToPage/1".
   * @param {number} page - Zero-based page.
   * @param {Event} [event]
   */
  goToPage(page, event) {
    event?.preventDefault?.();
    const target = Math.max(0, Math.min(Number(page) || 0, this.#pageCount - 1));
    this.goTo(target * this.#perPage);
  }

  /** Starts (or resumes) autoplay. Declarative use: on:click="yv-carousel/play". */
  play() {
    this.#userPaused = false;
    this.#syncToggle();
    this.#syncAutoplay();
  }

  /** Pauses autoplay until play() is called. Declarative use: on:click="yv-carousel/pause". */
  pause() {
    this.#userPaused = true;
    this.#syncToggle();
    this.#syncAutoplay();
  }

  /** Toggles autoplay. Declarative use: on:click="yv-carousel/togglePlay". */
  togglePlay() {
    if (this.#userPaused) this.play();
    else this.pause();
  }

  /** Re-measures slides, pages and controls (call after changing slides by script). */
  refresh() {
    this.#labelSlides();
    this.#update();
  }

  /* ------------------------------------------------------------------ */
  /* Measuring                                                           */
  /* ------------------------------------------------------------------ */

  #isRTL() {
    return getComputedStyle(this.track || this).direction === 'rtl';
  }

  #centered() {
    return this.dataset.align === 'center';
  }

  /**
   * Horizontal distance the track must scroll so `slide` sits at its snap position.
   * @param {HTMLElement} slide
   */
  #offsetOf(slide) {
    const track = /** @type {HTMLElement} */ (this.track);
    const trackRect = track.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const style = getComputedStyle(track);

    if (this.#centered()) {
      return slideRect.left + slideRect.width / 2 - (trackRect.left + trackRect.width / 2);
    }

    if (this.#isRTL()) {
      const contentEnd = trackRect.right - parseFloat(style.paddingRight || '0') - parseFloat(style.scrollPaddingRight || '0');
      return slideRect.right - contentEnd;
    }

    const contentStart = trackRect.left + parseFloat(style.paddingLeft || '0') + parseFloat(style.scrollPaddingLeft || '0');
    return slideRect.left - contentStart;
  }

  #maxScroll() {
    const track = this.track;
    return track ? Math.max(0, track.scrollWidth - track.clientWidth) : 0;
  }

  #scrollPosition() {
    return Math.abs(this.track?.scrollLeft || 0);
  }

  #atStart() {
    return this.#scrollPosition() <= 2;
  }

  #atEnd() {
    return this.#scrollPosition() >= this.#maxScroll() - 2;
  }

  #stepSize() {
    return this.dataset.step === 'slide' ? 1 : Math.max(1, this.#perPage);
  }

  /** Counts the slides that are fully inside the track's visible box. */
  #countVisible() {
    const track = this.track;
    if (!track) return 1;
    const trackRect = track.getBoundingClientRect();
    let count = 0;
    for (const slide of this.slides) {
      const rect = slide.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.left >= trackRect.left - 2 && rect.right <= trackRect.right + 2) count += 1;
    }
    return Math.max(1, count);
  }

  #nearestIndex() {
    const { slides } = this;
    let best = 0;
    let bestDistance = Infinity;
    slides.forEach((slide, i) => {
      const distance = Math.abs(this.#offsetOf(slide));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  #scheduleUpdate = () => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#update());
  };

  #update() {
    const track = this.track;
    if (!track) return;

    const { slides } = this;
    const overflow = this.#maxScroll() > 2;
    this.dataset.overflow = String(overflow);

    this.#perPage = this.#countVisible();
    const count = slides.length;
    const pageCount = overflow ? Math.max(1, Math.ceil(count / Math.max(1, this.#perPage))) : 1;

    const index = overflow ? this.#nearestIndex() : 0;
    const atStart = this.#atStart();
    const atEnd = this.#atEnd();
    let page = Math.min(pageCount - 1, Math.floor(index / Math.max(1, this.#perPage)));
    if (atEnd) page = pageCount - 1;
    if (atStart) page = 0;

    this.toggleAttribute('data-at-start', atStart);
    this.toggleAttribute('data-at-end', atEnd);

    for (const button of this.#arrows('prev')) {
      button.disabled = !overflow || (!this.loop && atStart);
    }
    for (const button of this.#arrows('next')) {
      button.disabled = !overflow || (!this.loop && atEnd);
    }

    if (pageCount !== this.#pageCount || !this.#dotsBuilt()) this.#buildDots(pageCount);
    this.#pageCount = pageCount;
    this.#syncDots(page);

    const changed = index !== this.#index || page !== this.#page;
    this.#index = index;
    this.#page = page;

    if (changed && this.#initialised) {
      this.dispatchEvent(
        new CustomEvent('yv-carousel:change', { bubbles: true, detail: { index, page, pageCount } })
      );
    }

    this.#syncAutoplay();
  }

  /* ------------------------------------------------------------------ */
  /* Controls                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Arrow buttons inside the carousel, plus external ones pointing at the track with aria-controls.
   * @param {'prev' | 'next'} action
   * @returns {HTMLButtonElement[]}
   */
  #arrows(action) {
    const selector = `[data-yv-carousel-action="${action}"]`;
    const own = [...this.querySelectorAll(selector)].filter((el) => el.closest('yv-carousel') === this);
    const trackId = this.track?.id;
    const external = trackId
      ? [...document.querySelectorAll(`${selector}[aria-controls="${CSS.escape(trackId)}"]`)].filter(
          (el) => !this.contains(el)
        )
      : [];
    return /** @type {HTMLButtonElement[]} */ ([...own, ...external]);
  }

  get #dotsContainer() {
    const dots = this.refs.dots;
    return dots instanceof HTMLElement && dots.closest('yv-carousel') === this ? dots : null;
  }

  #dotsBuilt() {
    const container = this.#dotsContainer;
    return !container || container.children.length === this.#pageCount;
  }

  /** @param {number} pageCount */
  #buildDots(pageCount) {
    const container = this.#dotsContainer;
    if (!container) return;

    const template = this.dataset.dotLabel || 'Go to slide [index]';
    const fragment = document.createDocumentFragment();

    if (pageCount > 1) {
      for (let i = 0; i < pageCount; i += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'yv-carousel__dot';
        dot.setAttribute('aria-label', template.replace('[index]', String(i + 1)).replace('[count]', String(pageCount)));
        dot.addEventListener('click', () => this.goToPage(i));
        fragment.append(dot);
      }
    }

    container.replaceChildren(fragment);
    container.hidden = pageCount <= 1;
  }

  /** @param {number} page */
  #syncDots(page) {
    const container = this.#dotsContainer;
    if (!container) return;
    [...container.children].forEach((dot, i) => {
      if (i === page) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  #labelSlides() {
    const { slides } = this;
    const template = this.dataset.slideLabel;
    const roledescription = this.dataset.slideRoledescription;
    const count = slides.length;

    slides.forEach((slide, i) => {
      if (!template || slide.tagName === 'LI') return;
      if (!slide.hasAttribute('role') || slide.dataset.yvCarouselLabelled === 'true') {
        slide.setAttribute('role', 'group');
        if (roledescription) slide.setAttribute('aria-roledescription', roledescription);
        slide.setAttribute('aria-label', template.replace('[index]', String(i + 1)).replace('[count]', String(count)));
        slide.dataset.yvCarouselLabelled = 'true';
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Autoplay                                                            */
  /* ------------------------------------------------------------------ */

  #canAutoplay() {
    return (
      this.autoplayInterval > 0 &&
      !prefersReducedMotion() &&
      this.#inView &&
      !this.#hovered &&
      !this.#focused &&
      !this.#userPaused &&
      !this.#editorPaused &&
      !this.#dragging &&
      !document.hidden &&
      this.dataset.overflow === 'true'
    );
  }

  #syncAutoplay = () => {
    const playing = this.#canAutoplay();
    this.toggleAttribute('data-playing', playing);
    if (!playing) {
      window.clearTimeout(this.#timer);
      this.#timer = undefined;
      return;
    }
    if (this.#timer === undefined) this.#queueAutoplay();
  };

  #queueAutoplay() {
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      this.#timer = undefined;
      if (!this.#canAutoplay()) return;
      this.#autoplayStep = true;
      this.next();
      this.#autoplayStep = false;
    }, this.autoplayInterval);
  }

  #restartAutoplay() {
    if (this.#timer === undefined) return;
    this.#queueAutoplay();
  }

  #syncToggle() {
    const toggle = this.refs.playToggle;
    if (!(toggle instanceof HTMLElement)) return;
    const paused = this.#userPaused;
    toggle.setAttribute('aria-pressed', String(paused));
    const label = paused ? toggle.dataset.labelPlay : toggle.dataset.labelPause;
    if (label) toggle.setAttribute('aria-label', label);
  }

  #handlePointerEnter = (/** @type {PointerEvent} */ event) => {
    if (event.pointerType !== 'mouse') return;
    this.#hovered = true;
    this.#syncAutoplay();
  };

  #handlePointerLeave = () => {
    this.#hovered = false;
    this.#syncAutoplay();
  };

  #handleFocusIn = () => {
    this.#focused = true;
    this.#syncAutoplay();
  };

  #handleFocusOut = (/** @type {FocusEvent} */ event) => {
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
    this.#focused = false;
    this.#syncAutoplay();
  };

  /* ------------------------------------------------------------------ */
  /* Mouse drag-to-scroll                                                */
  /* ------------------------------------------------------------------ */

  /** @param {DragEvent} event */
  #handleDragStart = (event) => {
    if (this.dataset.drag !== 'false') event.preventDefault();
  };

  /** @param {PointerEvent} event */
  #handlePointerDown = (event) => {
    const track = this.track;
    if (!track || event.pointerType !== 'mouse' || event.button !== 0) return;
    if (this.dataset.drag === 'false' || this.dataset.overflow !== 'true') return;
    if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;

    const startX = event.clientX;
    const startScroll = track.scrollLeft;
    const startIndex = this.#index;
    let moved = false;
    const drag = new AbortController();

    const onMove = (/** @type {PointerEvent} */ moveEvent) => {
      const dx = moveEvent.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) < 6) return;
        moved = true;
        this.#dragging = true;
        this.setAttribute('data-dragging', '');
        track.style.scrollSnapType = 'none';
        track.style.scrollBehavior = 'auto';
        this.#syncAutoplay();
      }
      moveEvent.preventDefault();
      track.scrollLeft = startScroll - dx;
    };

    const onUp = (/** @type {PointerEvent} */ upEvent) => {
      drag.abort();
      if (!moved) return;

      // A drag must not activate the link or button it started on.
      const swallowClick = (/** @type {Event} */ clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
      };
      this.addEventListener('click', swallowClick, { capture: true, once: true });
      window.setTimeout(() => this.removeEventListener('click', swallowClick, { capture: true }), 80);

      const dx = upEvent.clientX - startX;
      let target = this.#nearestIndex();
      const slideWidth = this.slides[startIndex]?.getBoundingClientRect().width || 1;
      if (target === startIndex && Math.abs(dx) > slideWidth * 0.15) {
        const forward = (dx < 0) !== this.#isRTL();
        target = startIndex + (forward ? 1 : -1);
      }

      track.style.scrollBehavior = '';
      this.removeAttribute('data-dragging');
      this.#dragging = false;
      this.goTo(Math.max(0, Math.min(target, this.slides.length - 1)));

      const restoreSnap = () => {
        track.style.scrollSnapType = '';
      };
      if ('onscrollend' in window) {
        track.addEventListener('scrollend', restoreSnap, { once: true });
        window.setTimeout(restoreSnap, 900);
      } else {
        window.setTimeout(restoreSnap, 600);
      }
    };

    window.addEventListener('pointermove', onMove, { signal: drag.signal });
    window.addEventListener('pointerup', onUp, { signal: drag.signal });
    window.addEventListener('pointercancel', onUp, { signal: drag.signal });
  };

  /* ------------------------------------------------------------------ */
  /* Theme editor                                                        */
  /* ------------------------------------------------------------------ */

  /** @param {Event} event */
  #handleBlockSelect = (event) => {
    const { target } = event;
    if (!(target instanceof Element) || !this.contains(target)) return;

    const slide = this.slides.find((element) => element === target || element.contains(target));
    if (!slide) return;

    this.#editorPaused = true;
    this.#syncAutoplay();
    this.goTo(this.slides.indexOf(slide), { instant: true });
  };

  /** @param {Event} event */
  #handleBlockDeselect = (event) => {
    if (!(event.target instanceof Element) || !this.contains(event.target)) return;
    this.#editorPaused = false;
    this.#syncAutoplay();
  };
}

if (!customElements.get('yv-carousel')) {
  customElements.define('yv-carousel', YvCarousel);
}
