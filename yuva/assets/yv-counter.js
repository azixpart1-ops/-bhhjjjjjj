import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Count-up number. The final value is rendered by Liquid (SEO, no-JS, reduced motion); when 30% of
 * the element is visible the first time, it counts from data-from to data-to.
 *
 * Markup contract:
 * <yv-counter class="yv-counter" data-to="500" [data-from="0"] [data-duration="2000"] [data-decimals="0"]
 *             [data-prefix=""] [data-suffix=""] [data-grouping="false"]>
 *   <span class="yv-counter__value" ref="value" aria-hidden="true">500</span>
 *   <span class="visually-hidden">500</span>
 * </yv-counter>
 *
 * Emits a bubbling `yv-counter:done` event when the animation finishes.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} [value] - The element whose text is animated (falls back to the element itself).
 *
 * @extends {Component<Refs>}
 */
export class YvCounter extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;
  #frame = 0;

  connectedCallback() {
    super.connectedCallback();
    this.#cleanup();

    if (this.dataset.counted === 'true') return;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      this.#write(this.target);
      return;
    }

    // Start from the initial value so the count-up is visible when the counter scrolls into view.
    this.#write(this.from);

    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#observer?.disconnect();
        this.#observer = null;
        this.start();
      },
      { threshold: 0.3 }
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#cleanup();
  }

  #cleanup() {
    this.#observer?.disconnect();
    this.#observer = null;
    cancelAnimationFrame(this.#frame);
  }

  get target() {
    const value = parseFloat(this.dataset.to || '0');
    return Number.isFinite(value) ? value : 0;
  }

  get from() {
    const value = parseFloat(this.dataset.from || '0');
    return Number.isFinite(value) ? value : 0;
  }

  get duration() {
    const value = parseFloat(this.dataset.duration || '2000');
    return Number.isFinite(value) && value > 0 ? value : 2000;
  }

  get decimals() {
    const value = parseInt(this.dataset.decimals || '0', 10);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 4) : 0;
  }

  /** Runs the count-up now (normally called when the element scrolls into view). */
  start() {
    cancelAnimationFrame(this.#frame);
    const { from, target, duration } = this;
    const startTime = performance.now();
    this.dataset.counted = 'true';

    const step = (/** @type {number} */ now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      // Ease in-out sine ("swing"), as measured on the Yuva demo counters.
      const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
      this.#write(progress >= 1 ? target : from + (target - from) * eased, progress < 1);
      if (progress < 1) {
        this.#frame = requestAnimationFrame(step);
      } else {
        this.dispatchEvent(new CustomEvent('yv-counter:done', { bubbles: true, detail: { value: target } }));
      }
    };

    this.#frame = requestAnimationFrame(step);
  }

  /**
   * @param {number} value
   * @param {boolean} [roundUp] - Show the rounded-up value while animating (whole numbers only).
   */
  #write(value, roundUp = false) {
    const { decimals } = this;
    const shown = decimals === 0 && roundUp ? Math.ceil(value) : value;
    const formatter = new Intl.NumberFormat(document.documentElement.lang || undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: this.dataset.grouping === 'true',
    });
    const text = `${this.dataset.prefix || ''}${formatter.format(shown)}${this.dataset.suffix || ''}`;
    const element = this.refs.value instanceof HTMLElement ? this.refs.value : this;
    if (element.textContent !== text) element.textContent = text;
  }
}

if (!customElements.get('yv-counter')) {
  customElements.define('yv-counter', YvCounter);
}
