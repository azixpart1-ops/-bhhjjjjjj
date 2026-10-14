import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Decorative autoplay video for Yuva media tiles and banners (collage tiles, media banner,
 * video banner): muted, looping, inline, no controls.
 *
 * - The sources are attached only when the element comes within 300px of the viewport, so a
 *   video further down the page costs nothing until it is needed.
 * - It plays while it is on screen and pauses when it leaves (spec part 3, Collage and Media
 *   banner: "paused while offscreen").
 * - Under prefers-reduced-motion it never loads or plays; the poster stays visible.
 *
 * Markup contract:
 * <yv-autoplay-video-component>
 *   <video ref="video" muted loop playsinline preload="none" poster="…">
 *     <source data-src="…" type="video/mp4">
 *   </video>
 * </yv-autoplay-video-component>
 *
 * @typedef {object} Refs
 * @property {HTMLVideoElement} video
 *
 * @extends {Component<Refs>}
 */
export class YvAutoplayVideoComponent extends Component {
  requiredRefs = ['video'];

  /** @type {IntersectionObserver | null} */
  #loadObserver = null;

  /** @type {IntersectionObserver | null} */
  #playObserver = null;

  #loaded = false;

  connectedCallback() {
    super.connectedCallback();

    const { video } = this.refs;
    video.muted = true;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      video.pause();
      return;
    }

    this.#loadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#load();
        this.#loadObserver?.disconnect();
        this.#loadObserver = null;
      },
      { rootMargin: '300px 0px' }
    );
    this.#loadObserver.observe(this);

    this.#playObserver = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) {
        this.play();
      } else {
        this.pause();
      }
    });
    this.#playObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#loadObserver?.disconnect();
    this.#playObserver?.disconnect();
    this.#loadObserver = null;
    this.#playObserver = null;
  }

  /** Starts playback (loads the sources first if needed). */
  play() {
    if (prefersReducedMotion()) return;
    this.#load();
    this.refs.video.play()?.catch(() => {});
  }

  /** Pauses playback. */
  pause() {
    this.refs.video.pause();
  }

  #load() {
    if (this.#loaded) return;
    this.#loaded = true;

    const { video } = this.refs;
    for (const source of video.querySelectorAll('source[data-src]')) {
      if (source instanceof HTMLSourceElement && source.dataset.src) source.src = source.dataset.src;
    }
    video.load();
  }
}

if (!customElements.get('yv-autoplay-video-component')) {
  customElements.define('yv-autoplay-video-component', YvAutoplayVideoComponent);
}
