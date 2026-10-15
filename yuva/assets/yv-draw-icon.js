import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * "Icon over section". Adds `.is-drawn` once when the host section is 30% in view;
 * the CSS in assets/yv-components.css then animates each path's stroke-dashoffset from 1000 to 0
 * (1.2s ease-out, paths staggered by 0.2s). Under reduced motion and in the theme editor it is drawn
 * immediately. Markup: snippets/yv-draw-icon.liquid.
 *
 * Emits a bubbling `yv-draw-icon:drawn` event.
 */
export class YvDrawIcon extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  connectedCallback() {
    super.connectedCallback();
    this.#observer?.disconnect();

    if (this.classList.contains('is-drawn')) return;

    if (prefersReducedMotion() || window.Shopify?.designMode || !('IntersectionObserver' in window)) {
      this.draw();
      return;
    }

    const host = this.closest('.shopify-section') || this.parentElement || this;
    this.#observer = new IntersectionObserver(
      (entries) => {
        // 30% of the section, or 30% of the viewport for sections taller than the screen.
        const visible = entries.some(
          (entry) =>
            entry.isIntersecting &&
            (entry.intersectionRatio >= 0.3 || entry.intersectionRect.height >= window.innerHeight * 0.3)
        );
        if (!visible) return;
        this.#observer?.disconnect();
        this.#observer = null;
        this.draw();
      },
      { threshold: Array.from({ length: 16 }, (_, i) => i * 0.02) }
    );
    this.#observer.observe(host);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
  }

  /** Draws the icon now. */
  draw() {
    if (this.classList.contains('is-drawn')) return;
    this.classList.add('is-drawn');
    this.dispatchEvent(new CustomEvent('yv-draw-icon:drawn', { bubbles: true }));
  }
}

if (!customElements.get('yv-draw-icon')) {
  customElements.define('yv-draw-icon', YvDrawIcon);
}
