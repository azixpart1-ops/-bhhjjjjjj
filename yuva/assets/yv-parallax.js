import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';
import { getScrollEventTarget } from '@theme/scroll-container';

/**
 * Parallax media layer (sections/yv-media-banner.liquid, reusable by any section).
 *
 * The element is the clipping box. Its `layer` ref is 120% of the box height, offset −10%
 * (CSS on `[data-parallax-active]`), and moves from −10% to +10% of the box height while the box
 * travels through the viewport. A passive scroll listener (on the page scroller: from 990px the
 * page scrolls inside `.page-wrapper`) runs only while the box is on screen and writes one
 * transform per animation frame. Off under prefers-reduced-motion and when `data-parallax` is
 * not "true" (e.g. an "adapt to image" height, which leaves no room to move).
 *
 * Markup contract:
 * <yv-parallax data-parallax="true"><div ref="layer">media…</div></yv-parallax>
 *
 * @typedef {object} Refs
 * @property {HTMLElement} layer
 *
 * @extends {Component<Refs>}
 */
export class YvParallax extends Component {
  requiredRefs = ['layer'];

  /** @type {AbortController | null} */
  #scrollController = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  #frame = 0;

  connectedCallback() {
    super.connectedCallback();
    if (this.dataset.parallax !== 'true' || prefersReducedMotion()) return;

    this.setAttribute('data-parallax-active', '');
    this.#update();

    this.#observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) {
        this.#listen();
      } else {
        this.#unlisten();
      }
    });
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#unlisten();
    this.removeAttribute('data-parallax-active');
  }

  #listen() {
    if (this.#scrollController) return;
    this.#scrollController = new AbortController();
    const { signal } = this.#scrollController;
    const target = getScrollEventTarget?.() ?? window;
    target.addEventListener('scroll', this.#onScroll, { passive: true, signal });
    window.addEventListener('scroll', this.#onScroll, { passive: true, signal });
    window.addEventListener('resize', this.#onScroll, { passive: true, signal });
    this.#update();
  }

  #unlisten() {
    this.#scrollController?.abort();
    this.#scrollController = null;
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  #onScroll = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  };

  #update() {
    const rect = this.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    if (!rect.height || !viewport) return;

    // 0 when the box's top enters at the bottom of the viewport, 1 when its bottom leaves at the top.
    const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport + rect.height)));
    const offset = (progress * 2 - 1) * 0.1 * rect.height;
    this.refs.layer.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  }
}

if (!customElements.get('yv-parallax')) {
  customElements.define('yv-parallax', YvParallax);
}
