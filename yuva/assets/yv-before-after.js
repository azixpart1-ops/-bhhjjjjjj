import { ComparisonSliderComponent } from '@theme/comparison-slider';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Yuva before/after comparison (sections/yv-before-after.liquid).
 *
 * Extends Horizon's ComparisonSliderComponent and keeps its markup contract: refs `mediaWrapper`
 * (carries `--compare` and `data-orientation="horizontal"`), `slider` (a transparent range input
 * covering the frame, so a drag anywhere moves the divider and the arrow keys work) and
 * `afterImage`.
 *
 * Difference from Horizon: the first-view hint animates the divider from 0 to the merchant's
 * start position (`data-start`, the "Drag position" setting) instead of wiggling around 50, and
 * it is skipped under reduced motion.
 */
export class YvBeforeAfter extends ComparisonSliderComponent {
  /** @type {number | undefined} */
  #introTimer;

  get startPosition() {
    const value = Number(this.dataset.start);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
  }

  connectedCallback() {
    super.connectedCallback();
    this.toggleAttribute('data-ready', true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.#introTimer);
  }

  animateSlider() {
    if (this.hasAnimated) return;
    this.hasAnimated = true;
    if (prefersReducedMotion()) return;

    const { mediaWrapper, slider } = this.refs;
    const start = this.startPosition;

    this.isAnimating = true;
    mediaWrapper.style.setProperty('--transition-duration', '0s');
    mediaWrapper.style.setProperty('--compare', '0');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mediaWrapper.style.setProperty('--transition-duration', '0.5s');
        mediaWrapper.style.setProperty('--compare', String(start));
      });
    });

    this.#introTimer = setTimeout(() => {
      mediaWrapper.style.setProperty('--transition-duration', '0s');
      slider.value = String(start);
      this.isAnimating = false;
      this.sync();
    }, 650);
  }
}

if (!customElements.get('yv-before-after')) {
  customElements.define('yv-before-after', YvBeforeAfter);
}
