import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';
import { getScrollEventTarget, scrollContainerMediaQuery } from '@theme/scroll-container';

const DESKTOP_QUERY = '(min-width: 750px)';

/**
 * Lookbook: a pinned stack of look images beside one full-height panel per look.
 *
 * Desktop (750px+): while the section is on screen, each image after the first gets
 * `--yv-look-p` = how far its panel's top edge has travelled from the viewport bottom (0) to the
 * viewport top (1); CSS clips the image with it, so it is revealed from the top edge, 1:1 with scroll.
 * Under reduced motion the value snaps to 0/1 at mid-viewport and CSS crossfades instead.
 * Mobile: the image track is a scroll-snap slider; the slide in view selects the panel and dot.
 *
 * Markup contract (sections/yv-lookbook.liquid, blocks/_yv-look.liquid):
 * <yv-lookbook>
 *   <div ref="track"><div ref="layers[]" style="--yv-look-p: 1">img</div> …</div>
 *   <button ref="dots[]" on:click="yv-lookbook/goTo/0"></button> …
 *   <div ref="panels[]" class="yv-look is-active">…</div> …
 * </yv-lookbook>
 *
 * Emits a bubbling `yv-lookbook:change` event with `detail.index` when the mobile slide changes.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} [track] - The image track (mobile slider).
 * @property {HTMLElement[]} [layers] - The look images, in block order.
 * @property {HTMLElement[]} [panels] - The look panels, in the same order.
 * @property {HTMLButtonElement[]} [dots] - Mobile page dots.
 *
 * @extends {Component<Refs>}
 */
export class YvLookbook extends Component {
  #index = 0;
  #frame = 0;
  #trackFrame = 0;
  #inView = false;

  /** @type {MediaQueryList} */
  #desktop = window.matchMedia(DESKTOP_QUERY);

  /** @type {AbortController | null} */
  #controller = null;

  /** @type {AbortController | null} */
  #scrollController = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  connectedCallback() {
    super.connectedCallback();

    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    document.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal });
    window.addEventListener('resize', this.#requestUpdate, { passive: true, signal });
    this.#desktop.addEventListener('change', this.#handleLayoutChange, { signal });
    scrollContainerMediaQuery.addEventListener('change', this.#bindScroll, { signal });
    this.refs.track?.addEventListener('scroll', this.#handleTrackScroll, { passive: true, signal });

    this.#observer?.disconnect();
    this.#observer = new IntersectionObserver((entries) => {
      this.#inView = entries.some((entry) => entry.isIntersecting);
      if (this.#inView) this.#requestUpdate();
    });
    this.#observer.observe(this);

    this.#bindScroll();
    const active = this.panels.findIndex((panel) => panel.classList.contains('is-active'));
    this.#setActive(Math.max(active, 0), { silent: true });
    this.#update();
  }

  updatedCallback() {
    super.updatedCallback();
    this.refs.track?.removeEventListener('scroll', this.#handleTrackScroll);
    if (this.#controller) {
      this.refs.track?.addEventListener('scroll', this.#handleTrackScroll, {
        passive: true,
        signal: this.#controller.signal,
      });
    }
    this.#setActive(this.#index, { silent: true });
    this.#update();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
    this.#scrollController?.abort();
    this.#scrollController = null;
    this.#observer?.disconnect();
    this.#observer = null;
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#trackFrame);
    this.#frame = 0;
    this.#trackFrame = 0;
  }

  /** @returns {HTMLElement[]} */
  get layers() {
    return this.refs.layers || [];
  }

  /** @returns {HTMLElement[]} */
  get panels() {
    return this.refs.panels || [];
  }

  /** @returns {HTMLButtonElement[]} */
  get dots() {
    return this.refs.dots || [];
  }

  /** Index of the current look (mobile slider). */
  get index() {
    return this.#index;
  }

  /**
   * Shows a look. On mobile it scrolls the image slider to it; on desktop it scrolls its panel into view.
   * Declarative use: on:click="yv-lookbook/goTo/1".
   * @param {number} index
   * @param {Event} [_event]
   * @param {{ instant?: boolean }} [options]
   */
  goTo(index, _event, { instant = false } = {}) {
    const count = Math.max(this.panels.length, this.layers.length);
    if (!count) return;
    const next = Math.min(Math.max(Number(index) || 0, 0), count - 1);
    const behavior = instant || prefersReducedMotion() ? 'instant' : 'smooth';

    if (this.#desktop.matches) {
      this.panels[next]?.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    const { track } = this.refs;
    if (track) {
      // Every slide is 100% of the track wide; RTL tracks scroll towards negative values.
      const direction = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
      track.scrollTo({ left: direction * next * track.clientWidth, behavior });
    }
    this.#setActive(next);
  }

  /**
   * @param {number} index
   * @param {{ silent?: boolean }} [options]
   */
  #setActive(index, { silent = false } = {}) {
    const changed = index !== this.#index;
    this.#index = index;
    this.panels.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
    this.dots.forEach((dot, i) => {
      const current = i === index;
      dot.classList.toggle('is-active', current);
      if (current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (silent || !changed) return;
    this.dispatchEvent(new CustomEvent('yv-lookbook:change', { bubbles: true, detail: { index } }));
  }

  /** Listens to the page scroller (the document on small screens, `.page-wrapper` from 990px). */
  #bindScroll = () => {
    this.#scrollController?.abort();
    this.#scrollController = new AbortController();
    getScrollEventTarget().addEventListener('scroll', this.#requestUpdate, {
      passive: true,
      signal: this.#scrollController.signal,
    });
    this.#requestUpdate();
  };

  #handleLayoutChange = () => {
    if (!this.#desktop.matches) {
      this.goTo(this.#index, undefined, { instant: true });
    }
    this.#update();
  };

  #requestUpdate = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  };

  /** Desktop wipe: writes each later image's reveal progress from its panel position. */
  #update() {
    const { layers, panels } = this;
    if (!this.#desktop.matches) {
      layers.forEach((layer, i) => layer.style.setProperty('--yv-look-p', i === 0 ? '1' : '0'));
      return;
    }
    if (!this.#inView && this.isConnected && this.getBoundingClientRect().bottom < 0) return;

    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const reduce = prefersReducedMotion();
    layers.forEach((layer, i) => {
      if (i === 0) {
        layer.style.setProperty('--yv-look-p', '1');
        return;
      }
      const panel = panels[i];
      if (!panel) return;
      const top = panel.getBoundingClientRect().top;
      const progress = reduce
        ? Number(top < viewport / 2)
        : Math.min(Math.max((viewport - top) / viewport, 0), 1);
      layer.style.setProperty('--yv-look-p', progress.toFixed(4));
    });
  }

  /** Mobile slider: the slide nearest the track's start is the current look. */
  #handleTrackScroll = () => {
    if (this.#desktop.matches || this.#trackFrame) return;
    this.#trackFrame = requestAnimationFrame(() => {
      this.#trackFrame = 0;
      const { track } = this.refs;
      if (!track || !track.clientWidth) return;
      const index = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
      const last = Math.max(this.layers.length - 1, 0);
      const next = Math.min(Math.max(index, 0), last);
      if (next !== this.#index) this.#setActive(next);
    });
  };

  /**
   * Theme editor: selecting a look shows it.
   * @param {Event} event
   */
  #handleBlockSelect = (event) => {
    const { target } = event;
    if (!(target instanceof Element) || !this.contains(target)) return;
    const index = this.panels.findIndex((panel) => panel === target || panel.contains(target));
    if (index > -1 && !this.#desktop.matches) this.goTo(index, undefined, { instant: true });
  };
}

if (!customElements.get('yv-lookbook')) {
  customElements.define('yv-lookbook', YvLookbook);
}
