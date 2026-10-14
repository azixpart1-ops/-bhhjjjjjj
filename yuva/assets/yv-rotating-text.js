import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Rotating heading words (spec part 2 §0.4). The heading snippet (yv-heading) outputs:
 *
 * <yv-rotating-text aria-hidden="true" [data-interval="2500"]>
 *   <span>Modern Living</span><span>Everyday Living</span><span>Connected Living</span>
 * </yv-rotating-text>
 *
 * All words share one grid cell (assets/yv-base.css), so the slot is as wide as the longest
 * word and nothing shifts. Every interval the current word slides up and fades out while the next
 * one slides up from below (500ms). The loop pauses while the tab is hidden or the element is off
 * screen. Under reduced motion only the first word shows (the CSS default), and nothing animates.
 *
 * Emits a bubbling `yv-rotating-text:change` event with `detail.index`.
 */
export class YvRotatingText extends Component {
  /** @type {number | undefined} */
  #timer;
  #index = 0;
  #visible = true;
  /** @type {IntersectionObserver | null} */
  #observer = null;
  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();
    this.#cleanup();

    const words = this.words;
    if (words.length < 2 || prefersReducedMotion()) return;

    this.#index = 0;
    words.forEach((word, i) => {
      word.removeAttribute('data-state');
      word.toggleAttribute('data-active', i === 0);
    });
    this.setAttribute('data-ready', '');

    this.#controller = new AbortController();
    document.addEventListener('visibilitychange', this.#sync, { signal: this.#controller.signal });

    this.#observer = new IntersectionObserver((entries) => {
      this.#visible = entries.some((entry) => entry.isIntersecting);
      this.#sync();
    });
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#cleanup();
  }

  #cleanup() {
    window.clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#controller?.abort();
    this.#controller = null;
  }

  /** The word elements (direct <span> children). */
  get words() {
    return /** @type {HTMLElement[]} */ ([...this.children].filter((child) => child.tagName === 'SPAN'));
  }

  get interval() {
    const value = parseFloat(this.dataset.interval || '2500');
    // Accept seconds ("2.5") as well as milliseconds ("2500").
    const ms = value < 100 ? value * 1000 : value;
    return Number.isFinite(ms) && ms >= 1000 ? ms : 2500;
  }

  #sync = () => {
    const running = this.#visible && !document.hidden;
    if (!running) {
      window.clearTimeout(this.#timer);
      this.#timer = undefined;
      return;
    }
    if (this.#timer === undefined) this.#queue();
  };

  #queue() {
    this.#timer = window.setTimeout(() => {
      this.#timer = undefined;
      this.#advance();
      this.#sync();
    }, this.interval);
  }

  #advance() {
    const words = this.words;
    if (words.length < 2) return;

    const current = words[this.#index];
    const nextIndex = (this.#index + 1) % words.length;
    const next = words[nextIndex];

    words.forEach((word) => {
      if (word !== current && word !== next) {
        word.removeAttribute('data-state');
        word.removeAttribute('data-active');
      }
    });

    if (current) {
      current.removeAttribute('data-active');
      current.dataset.state = 'out';
    }
    if (next) {
      next.dataset.state = 'in';
      next.setAttribute('data-active', '');
    }

    this.#index = nextIndex;
    this.dispatchEvent(new CustomEvent('yv-rotating-text:change', { bubbles: true, detail: { index: nextIndex } }));
  }
}

if (!customElements.get('yv-rotating-text')) {
  customElements.define('yv-rotating-text', YvRotatingText);
}
