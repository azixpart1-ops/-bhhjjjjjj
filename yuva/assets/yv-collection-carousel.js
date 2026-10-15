import { Component } from '@theme/component';

/**
 * Collection carousel (sections/yv-collection-carousel.liquid).
 *
 * With "Emphasize center image" on (`data-emphasize`), the inner <yv-carousel> centres its slides
 * from 750px up (this component switches its `data-align` between `center` and `start`) and
 * this component marks the slide nearest the centre with `.is-center` (CSS keeps it full size and
 * scales its neighbours) and, on load, starts on the second slide so both neighbours are filled.
 * Without emphasis it does nothing.
 *
 * @extends {Component}
 */
class YvCollectionCarouselComponent extends Component {
  /** @type {AbortController | null} */
  #controller = null;

  /** @type {number} */
  #frame = 0;

  /** @type {ResizeObserver | null} */
  #resizeObserver = null;

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
    this.#controller?.abort();
    this.#controller = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    cancelAnimationFrame(this.#frame);
  }

  /** The inner yv-carousel element. */
  get carousel() {
    return /** @type {(HTMLElement & { goTo?: Function, slides?: HTMLElement[] }) | null} */ (
      this.querySelector('yv-carousel')
    );
  }

  #setup() {
    this.#controller?.abort();
    this.#controller = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    if (!this.hasAttribute('data-emphasize')) return;

    const carousel = this.carousel;
    const track = carousel?.querySelector('.yv-carousel__track');
    if (!carousel || !track) return;

    this.#controller = new AbortController();
    const { signal } = this.#controller;

    track.addEventListener('scroll', this.#schedule, { passive: true, signal });
    this.addEventListener('yv-carousel:change', this.#schedule, { signal });
    this.#resizeObserver = new ResizeObserver(this.#schedule);
    this.#resizeObserver.observe(track);

    // Centre mode on desktop only; phones keep start-aligned slides with a peek.
    const desktop = window.matchMedia('(min-width: 750px)');
    const syncAlign = () => {
      carousel.dataset.align = desktop.matches ? 'center' : 'start';
      this.#schedule();
    };
    desktop.addEventListener('change', syncAlign, { signal });
    syncAlign();

    customElements.whenDefined('yv-carousel').then(() => {
      if (signal.aborted) return;
      const slides = this.#slides();
      if (desktop.matches && slides.length > 2 && track.scrollLeft === 0) {
        carousel.goTo?.(1, { instant: true });
      }
      this.#markCenter();
    });

    this.#markCenter();
  }

  /** @returns {HTMLElement[]} */
  #slides() {
    const track = this.carousel?.querySelector('.yv-carousel__track');
    if (!track) return [];
    return /** @type {HTMLElement[]} */ ([...track.children]).filter((element) => element instanceof HTMLElement);
  }

  #schedule = () => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#markCenter());
  };

  #markCenter() {
    const track = this.carousel?.querySelector('.yv-carousel__track');
    if (!track) return;

    const trackRect = track.getBoundingClientRect();
    const middle = trackRect.left + trackRect.width / 2;
    const slides = this.#slides();

    let best = -1;
    let bestDistance = Infinity;
    slides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - middle);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });

    slides.forEach((slide, index) => slide.classList.toggle('is-center', index === best));
  }
}

if (!customElements.get('yv-collection-carousel-component')) {
  customElements.define('yv-collection-carousel-component', YvCollectionCarouselComponent);
}
