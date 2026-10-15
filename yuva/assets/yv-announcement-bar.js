import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Yuva announcement bar (sections/yv-announcement-bar.liquid).
 *
 * Layouts:
 * - `carousel`: one announcement at a time, cross-fading. Optional autoplay that pauses on hover,
 *   keyboard focus, a hidden tab and while an announcement block is selected in the theme editor.
 *   Previous / next arrows (desktop) and swipe (touch). Announcements whose countdown has expired
 *   (`hidden`) are skipped.
 * - `marquee`: every announcement in one line, repeated to fill the bar and scrolled continuously
 *   (`data-marquee-speed` seconds per loop, `data-marquee-direction` left | right). Hover slows it
 *   down; reduced motion shows the first set statically.
 *
 * Close button: collapses the bar and remembers it for the browser session
 * (`sessionStorage['yv-announcement-closed-<section id>']`). An inline script after the bar hides it
 * again before paint on the next page.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} [slides] - The carousel slide container.
 * @property {HTMLElement} [marquee] - The marquee viewport.
 * @property {HTMLElement} [marqueeTrack] - The moving marquee track.
 * @property {HTMLElement} [marqueeGroup] - The original set of announcements in the marquee.
 *
 * @extends {Component<Refs>}
 */
class YvAnnouncementBar extends Component {
  #index = 0;

  /** @type {number | undefined} */
  #timer;

  /** @type {Animation | undefined} */
  #animation;

  /** @type {ResizeObserver | undefined} */
  #resizeObserver;

  #paused = false;
  #editorHold = false;
  #touchStartX = 0;
  #touchStartY = 0;

  /** @type {AbortController | undefined} */
  #abort;

  connectedCallback() {
    super.connectedCallback();
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    if (this.layout === 'marquee') {
      this.#setupMarquee();
    } else {
      this.#showSlide(this.#firstVisibleIndex(), false);
      this.addEventListener('pointerenter', this.#pause, { signal });
      this.addEventListener('pointerleave', this.#resume, { signal });
      this.addEventListener('focusin', this.#pause, { signal });
      this.addEventListener('focusout', this.#onFocusOut, { signal });
      this.addEventListener('touchstart', this.#onTouchStart, { passive: true, signal });
      this.addEventListener('touchend', this.#onTouchEnd, { passive: true, signal });
      this.addEventListener('yv-countdown:expired', () => this.#showSlide(this.#index, false), { signal });
      document.addEventListener('visibilitychange', this.#onVisibilityChange, { signal });
      this.#play();
    }

    if (window.Shopify?.designMode) {
      document.addEventListener('shopify:block:select', this.#onBlockSelect, { signal });
      document.addEventListener('shopify:block:deselect', this.#onBlockDeselect, { signal });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#stop();
    this.#animation?.cancel();
    this.#resizeObserver?.disconnect();
  }

  /** @returns {'carousel' | 'marquee'} */
  get layout() {
    return this.dataset.layout === 'marquee' ? 'marquee' : 'carousel';
  }

  /** Autoplay interval in ms, or 0 when off. */
  get interval() {
    const seconds = Number(this.dataset.autoplay || 0);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
  }

  /** @returns {HTMLElement[]} */
  get slides() {
    const container = this.refs.slides;
    if (!container) return [];
    return /** @type {HTMLElement[]} */ (Array.from(container.children)).filter((el) => el instanceof HTMLElement);
  }

  /** Slides that can be shown (expired countdowns hide their announcement). */
  get visibleSlides() {
    return this.slides.filter((slide) => !slide.hidden);
  }

  next() {
    this.#step(1);
    this.#restart();
  }

  previous() {
    this.#step(-1);
    this.#restart();
  }

  /**
   * Hide the bar for the rest of the browser session.
   */
  close() {
    const section = this.closest('.shopify-section');
    try {
      sessionStorage.setItem(`yv-announcement-closed-${this.dataset.sectionId}`, '1');
    } catch (error) {
      // Storage can be unavailable (private mode); closing still works for this page.
    }

    const target = section instanceof HTMLElement ? section : this;
    const finish = () => {
      target.hidden = true;
      target.style.removeProperty('height');
      target.style.removeProperty('overflow');
      target.style.removeProperty('transition');
      window.dispatchEvent(new Event('resize'));
    };

    if (prefersReducedMotion()) {
      finish();
      return;
    }

    target.style.height = `${target.offsetHeight}px`;
    target.style.overflow = 'hidden';
    target.style.transition = 'height 200ms ease';
    requestAnimationFrame(() => {
      target.style.height = '0px';
    });
    target.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 300);
  }

  /**
   * @param {number} direction
   */
  #step(direction) {
    const slides = this.slides;
    if (slides.length < 2) return;

    let index = this.#index;
    for (let i = 0; i < slides.length; i++) {
      index = (index + direction + slides.length) % slides.length;
      if (!slides[index]?.hidden) break;
    }
    this.#showSlide(index);
  }

  #firstVisibleIndex() {
    const index = this.slides.findIndex((slide) => !slide.hidden);
    return index < 0 ? 0 : index;
  }

  /**
   * @param {number} index
   * @param {boolean} [announce]
   */
  #showSlide(index, announce = true) {
    const slides = this.slides;
    if (!slides.length) return;

    if (slides[index]?.hidden) index = this.#firstVisibleIndex();
    this.#index = index;

    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      slide.toggleAttribute('inert', !active);
    });

    if (announce && this.refs.slides) {
      this.refs.slides.setAttribute('aria-live', this.#timer ? 'off' : 'polite');
    }
  }

  #play() {
    this.#stop();
    if (!this.interval || this.visibleSlides.length < 2 || this.#paused || this.#editorHold) {
      this.refs.slides?.setAttribute('aria-live', 'polite');
      return;
    }
    this.refs.slides?.setAttribute('aria-live', 'off');
    this.#timer = window.setInterval(() => {
      if (document.hidden) return;
      this.#step(1);
    }, this.interval);
  }

  #stop() {
    if (this.#timer) window.clearInterval(this.#timer);
    this.#timer = undefined;
  }

  #restart() {
    if (this.#timer) this.#play();
  }

  #pause = () => {
    this.#paused = true;
    this.#stop();
    if (this.#animation) this.#animation.updatePlaybackRate(0.35);
  };

  #resume = () => {
    if (this.matches(':focus-within')) return;
    this.#paused = false;
    if (this.layout === 'marquee') {
      this.#animation?.updatePlaybackRate(1);
    } else {
      this.#play();
    }
  };

  /** @param {FocusEvent} event */
  #onFocusOut = (event) => {
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
    this.#paused = this.matches(':hover');
    if (!this.#paused) this.#play();
  };

  #onVisibilityChange = () => {
    if (document.hidden) this.#stop();
    else if (!this.#paused) this.#play();
  };

  /** @param {TouchEvent} event */
  #onTouchStart = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    this.#touchStartX = touch.clientX;
    this.#touchStartY = touch.clientY;
  };

  /** @param {TouchEvent} event */
  #onTouchEnd = (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - this.#touchStartX;
    const dy = touch.clientY - this.#touchStartY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const forward = rtl ? dx > 0 : dx < 0;
    this.#step(forward ? 1 : -1);
    this.#restart();
  };

  /** @param {Event} event */
  #onBlockSelect = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !this.contains(target)) return;
    this.#editorHold = true;
    this.#stop();
    this.#animation?.pause();
    if (this.layout === 'carousel') {
      const index = this.slides.indexOf(target);
      if (index >= 0) this.#showSlide(index, false);
    }
  };

  /** @param {Event} event */
  #onBlockDeselect = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !this.contains(target)) return;
    this.#editorHold = false;
    if (this.layout === 'marquee') this.#animation?.play();
    else this.#play();
  };

  /* ---------------------------------------------------------------- marquee */

  #setupMarquee() {
    const { marquee, marqueeTrack, marqueeGroup } = this.refs;
    if (!marquee || !marqueeTrack || !marqueeGroup) return;

    if (prefersReducedMotion()) {
      this.dataset.marqueeStatic = '';
      return;
    }

    const build = () => {
      // Remove previous clones, then repeat the group until the track is at least twice the viewport.
      marqueeTrack.querySelectorAll('[data-marquee-clone]').forEach((clone) => clone.remove());
      const groupWidth = marqueeGroup.getBoundingClientRect().width;
      const viewportWidth = marquee.getBoundingClientRect().width;
      if (!groupWidth || !viewportWidth) return;

      const copies = Math.max(1, Math.ceil((viewportWidth * 2) / groupWidth));
      for (let i = 0; i < copies; i++) {
        const clone = /** @type {HTMLElement} */ (marqueeGroup.cloneNode(true));
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('data-marquee-clone', '');
        clone.removeAttribute('ref');
        clone.inert = true;
        clone.querySelectorAll('[data-shopify-editor-block], [id]').forEach((el) => {
          el.removeAttribute('data-shopify-editor-block');
          el.removeAttribute('id');
        });
        marqueeTrack.append(clone);
      }

      const seconds = Number(this.dataset.marqueeSpeed || 25);
      const reverse = this.dataset.marqueeDirection === 'right';
      const rtl = getComputedStyle(this).direction === 'rtl';
      const distance = (rtl ? 1 : -1) * groupWidth;
      const frames = reverse
        ? [{ transform: `translateX(${distance}px)` }, { transform: 'translateX(0)' }]
        : [{ transform: 'translateX(0)' }, { transform: `translateX(${distance}px)` }];

      this.#animation?.cancel();
      this.#animation = marqueeTrack.animate(frames, {
        duration: Math.max(1, seconds) * 1000,
        iterations: Infinity,
        easing: 'linear',
      });
      if (this.#paused) this.#animation.updatePlaybackRate(0.35);
      if (this.#editorHold) this.#animation.pause();
    };

    build();
    let lastWidth = marquee.getBoundingClientRect().width;
    this.#resizeObserver = new ResizeObserver(() => {
      const width = marquee.getBoundingClientRect().width;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      build();
    });
    this.#resizeObserver.observe(marquee);

    const { signal } = /** @type {AbortController} */ (this.#abort);
    this.addEventListener('pointerenter', this.#pause, { signal });
    this.addEventListener('pointerleave', this.#resume, { signal });
  }
}

if (!customElements.get('yv-announcement-bar-component')) {
  customElements.define('yv-announcement-bar-component', YvAnnouncementBar);
}
