import { Component } from '@theme/component';
import { prefersReducedMotion, isRTL } from '@theme/utilities';

/**
 * Yuva hero slideshow engine (sections/yv-slideshow.liquid and sections/yv-split-slideshow.liquid).
 *
 * One slide is visible at a time. Transition `fade` (default: slides share one grid cell and
 * cross-fade) or `slide` (the track translates). It loops, swipes and drags, answers the arrow
 * keys, and autoplays every `data-autoplay` seconds. Autoplay pauses on hover, on focus within, while
 * the tab is hidden, while the slideshow is off screen and in the theme editor; it never runs under
 * prefers-reduced-motion. The active dot's progress fill (CSS) follows the remaining time, because
 * the root carries `data-autoplay-running` / `data-paused` and the timer keeps its remaining time.
 *
 * Markup contract (refs avoid Horizon's slideshow ref names):
 * <yv-slideshow-component data-transition="fade|slide" data-autoplay="5"
 *   data-label-play="Play slideshow" data-label-pause="Pause slideshow">
 *   <div ref="track">
 *     <div ref="slideItems[]" data-active>…</div>   (one per slide, the active one has data-active)
 *   </div>
 *   <button ref="prevButton" on:click="/previous">   <button ref="nextButton" on:click="/next">
 *   <button ref="dotButtons[]" on:click="/select/0"> <button ref="thumbButtons[]" on:click="/select/0">
 *   <button ref="playButton" on:click="/togglePlay">
 * </yv-slideshow-component>
 *
 * Event: bubbling `yv-slideshow:change` with `detail: { index, previousIndex }`.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track
 * @property {HTMLElement[]} [slideItems]
 * @property {HTMLButtonElement[]} [dotButtons]
 * @property {HTMLButtonElement[]} [thumbButtons]
 * @property {HTMLButtonElement} [prevButton]
 * @property {HTMLButtonElement} [nextButton]
 * @property {HTMLButtonElement} [playButton]
 *
 * @extends {Component<Refs>}
 */
export class YvSlideshowComponent extends Component {
  requiredRefs = ['track'];

  /** @type {number} */
  #index = 0;

  /** Autoplay is on (setting on, motion allowed, not stopped with the pause button). */
  #playing = false;

  /** @type {Set<string>} reasons that currently hold the autoplay timer */
  #holds = new Set();

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer;

  #startedAt = 0;

  #remaining = 0;

  /** @type {AbortController | null} */
  #abortController = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {{ id: number, x: number, y: number, dragging: boolean } | null} */
  #pointer = null;

  connectedCallback() {
    super.connectedCallback();

    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    const initial = this.slides.findIndex((slide) => slide.hasAttribute('data-active'));
    this.#index = Math.max(0, initial);
    this.#render({ instant: true });

    this.addEventListener('pointerenter', this.#onPointerEnter, { signal });
    this.addEventListener('pointerleave', this.#onPointerLeave, { signal });
    this.addEventListener('focusin', () => this.#hold('focus'), { signal });
    this.addEventListener('focusout', this.#onFocusOut, { signal });
    this.addEventListener('keydown', this.#onKeydown, { signal });
    document.addEventListener('visibilitychange', this.#onVisibilityChange, { signal });

    const { track } = this.refs;
    track.addEventListener('pointerdown', this.#onPointerDown, { signal });
    track.addEventListener('pointermove', this.#onPointerMove, { signal });
    track.addEventListener('pointerup', this.#onPointerUp, { signal });
    track.addEventListener('pointercancel', this.#onPointerCancel, { signal });
    track.addEventListener('click', this.#onClickCapture, { signal, capture: true });
    track.addEventListener('dragstart', (event) => event.preventDefault(), { signal });

    if (window.Shopify?.designMode) {
      document.addEventListener('shopify:block:select', this.#onBlockSelect, { signal });
      document.addEventListener('shopify:block:deselect', this.#onBlockDeselect, { signal });
      document.addEventListener('shopify:section:select', this.#onSectionSelect, { signal });
      document.addEventListener('shopify:section:deselect', this.#onSectionDeselect, { signal });
    }

    if ('IntersectionObserver' in window) {
      this.#observer = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) {
          this.#release('offscreen');
        } else {
          this.#hold('offscreen');
        }
      });
      this.#observer.observe(this);
    }

    if (document.visibilityState === 'hidden') this.#hold('hidden');

    if (this.autoplayInterval > 0 && this.slides.length > 1 && !prefersReducedMotion()) {
      this.play();
    } else {
      this.#syncPlayState();
    }
  }

  updatedCallback() {
    super.updatedCallback();
    this.#index = Math.min(this.#index, Math.max(0, this.slides.length - 1));
    this.#render({ instant: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController?.abort();
    this.#abortController = null;
    this.#observer?.disconnect();
    this.#observer = null;
    clearTimeout(this.#timer);
  }

  /** @returns {HTMLElement[]} */
  get slides() {
    return this.refs.slideItems ?? [];
  }

  /** @returns {number} */
  get index() {
    return this.#index;
  }

  /** Autoplay interval in ms (0 = off). */
  get autoplayInterval() {
    const seconds = Number(this.dataset.autoplay || 0);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
  }

  /**
   * Shows a slide. Wraps around at both ends.
   * @param {number | string} index
   * @param {Event} [event]
   * @param {{ instant?: boolean }} [options]
   */
  select(index, event, options = {}) {
    const count = this.slides.length;
    if (!count) return;

    let target = Number(index);
    if (!Number.isFinite(target)) return;
    target = ((Math.round(target) % count) + count) % count;

    const previousIndex = this.#index;
    if (target === previousIndex) return;

    this.#index = target;
    this.#render({ instant: options.instant || prefersReducedMotion() });

    this.dispatchEvent(
      new CustomEvent('yv-slideshow:change', { bubbles: true, detail: { index: target, previousIndex } })
    );

    // Every change restarts the full interval.
    if (this.#playing) {
      clearTimeout(this.#timer);
      this.#remaining = this.autoplayInterval;
      if (!this.#holds.size) this.#schedule(this.#remaining);
    }
  }

  /** @param {Event} [event] */
  next(event) {
    this.select(this.#index + 1, event);
  }

  /** @param {Event} [event] */
  previous(event) {
    this.select(this.#index - 1, event);
  }

  /** Starts autoplay (no-op without an interval or under reduced motion). */
  play() {
    if (!this.autoplayInterval || this.slides.length < 2 || prefersReducedMotion()) return;
    this.#playing = true;
    this.#remaining = this.autoplayInterval;
    if (!this.#holds.size) this.#schedule(this.#remaining);
    this.#syncPlayState();
  }

  /** Stops autoplay until play() is called again. */
  stop() {
    this.#playing = false;
    clearTimeout(this.#timer);
    this.#syncPlayState();
  }

  /** Pause/play button. */
  togglePlay() {
    if (this.#playing) {
      this.stop();
    } else {
      this.play();
    }
  }

  /** @param {number} ms */
  #schedule(ms) {
    clearTimeout(this.#timer);
    this.#startedAt = performance.now();
    this.#remaining = ms;
    this.#timer = setTimeout(() => {
      if (this.#playing && !this.#holds.size) this.next();
    }, Math.max(ms, 50));
  }

  /** @param {string} reason */
  #hold(reason) {
    if (this.#playing && !this.#holds.size) {
      clearTimeout(this.#timer);
      this.#remaining = Math.max(0, this.#remaining - (performance.now() - this.#startedAt));
    }
    this.#holds.add(reason);
    this.#syncPlayState();
  }

  /** @param {string} reason */
  #release(reason) {
    if (!this.#holds.delete(reason)) return;
    if (this.#playing && !this.#holds.size) this.#schedule(this.#remaining || this.autoplayInterval);
    this.#syncPlayState();
  }

  #syncPlayState() {
    const running = this.#playing;
    this.toggleAttribute('data-autoplay-running', running);
    this.toggleAttribute('data-paused', running && this.#holds.size > 0);
    this.style.setProperty('--yv-slideshow-interval', `${this.autoplayInterval || 5000}ms`);
    this.refs.track.setAttribute('aria-live', running ? 'off' : 'polite');

    const { playButton } = this.refs;
    if (playButton) {
      playButton.hidden = !this.autoplayInterval || this.slides.length < 2 || prefersReducedMotion();
      const label = running ? this.dataset.labelPause : this.dataset.labelPlay;
      if (label) playButton.setAttribute('aria-label', label);
      // The label names the action (Pause/Play slideshow); no aria-pressed, so the two never contradict.
      playButton.dataset.state = running ? 'playing' : 'paused';
    }
  }

  /** @param {{ instant?: boolean }} [options] */
  #render(options = {}) {
    const index = this.#index;

    if (options.instant) {
      this.setAttribute('data-instant', '');
      requestAnimationFrame(() => requestAnimationFrame(() => this.removeAttribute('data-instant')));
    }

    this.style.setProperty('--yv-slideshow-index', String(index));
    this.setAttribute('data-index', String(index));

    this.slides.forEach((slide, i) => {
      const active = i === index;
      slide.toggleAttribute('data-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });

    for (const buttons of [this.refs.dotButtons, this.refs.thumbButtons]) {
      buttons?.forEach((button, i) => {
        if (i === index) {
          button.setAttribute('aria-current', 'true');
        } else {
          button.removeAttribute('aria-current');
        }
      });
    }
  }

  /** @param {PointerEvent} event */
  #onPointerEnter = (event) => {
    if (event.pointerType === 'mouse') this.#hold('hover');
  };

  /** @param {PointerEvent} event */
  #onPointerLeave = (event) => {
    if (event.pointerType === 'mouse') this.#release('hover');
  };

  /** @param {FocusEvent} event */
  #onFocusOut = (event) => {
    if (!(event.relatedTarget instanceof Node) || !this.contains(event.relatedTarget)) this.#release('focus');
  };

  #onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.#hold('hidden');
    } else {
      this.#release('hidden');
    }
  };

  /** @param {KeyboardEvent} event */
  #onKeydown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const forward = (event.key === 'ArrowRight') !== isRTL(this);
    event.preventDefault();
    if (forward) {
      this.next(event);
    } else {
      this.previous(event);
    }
  };

  /** @param {PointerEvent} event */
  #onPointerDown = (event) => {
    if (this.slides.length < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.#pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  };

  /** @param {PointerEvent} event */
  #onPointerMove = (event) => {
    const pointer = this.#pointer;
    if (!pointer || pointer.id !== event.pointerId || pointer.dragging) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      pointer.dragging = true;
      this.setAttribute('data-dragging', '');
      try {
        this.refs.track.setPointerCapture(event.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
    }
  };

  /** @param {PointerEvent} event */
  #onPointerUp = (event) => {
    const pointer = this.#pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    this.#pointer = null;
    if (!pointer.dragging) return;

    // The click that follows a drag must not follow a link.
    this.#suppressClick = true;
    setTimeout(() => {
      this.#suppressClick = false;
      this.removeAttribute('data-dragging');
    }, 0);

    const dx = event.clientX - pointer.x;
    if (Math.abs(dx) < 40) return;
    const forward = dx < 0 !== isRTL(this);
    if (forward) {
      this.next(event);
    } else {
      this.previous(event);
    }
  };

  #onPointerCancel = () => {
    this.#pointer = null;
    this.removeAttribute('data-dragging');
  };

  #suppressClick = false;

  /** @param {MouseEvent} event */
  #onClickCapture = (event) => {
    if (!this.#suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    this.#suppressClick = false;
  };

  /** @param {Event} event */
  #onBlockSelect = (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !this.contains(target)) return;
    const index = this.slides.findIndex((slide) => slide === target || slide.contains(target));
    if (index >= 0) this.select(index, event, { instant: true });
    this.#hold('editor-block');
  };

  /** @param {Event} event */
  #onBlockDeselect = (event) => {
    const target = event.target;
    if (target instanceof Element && this.contains(target)) this.#release('editor-block');
  };

  /** @param {Event} event */
  #onSectionSelect = (event) => {
    const target = event.target;
    if (target instanceof Element && target.contains(this)) this.#hold('editor');
  };

  /** @param {Event} event */
  #onSectionDeselect = (event) => {
    const target = event.target;
    if (target instanceof Element && target.contains(this)) this.#release('editor');
  };
}

if (!customElements.get('yv-slideshow-component')) {
  customElements.define('yv-slideshow-component', YvSlideshowComponent);
}
