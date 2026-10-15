import { Component } from '@theme/component';

/**
 * Yuva infinite marquee, used by the News ticker and Scrolling text sections
 * (snippets/yv-marquee.liquid renders the markup and the CSS).
 *
 * <yv-marquee-component class="yv-marquee" data-direction="left|right" data-speed="35" [data-pause-on-hover]>
 *   <div class="yv-marquee__track" ref="track">
 *     <div class="yv-marquee__group" ref="group">…items…</div>
 *   </div>
 * </yv-marquee-component>
 *
 * The server renders one group. This element clones it (aria-hidden, inert) until the track
 * covers the visible width plus one extra group, then sets:
 * - `--yv-marquee-copies`: the number of groups; the CSS keyframe moves the track by
 *   `-100% / copies`, which is exactly one group, so the loop is seamless at any width;
 * - `--yv-marquee-duration`: group width / speed, so the text travels at `data-speed` pixels per
 *   second whatever its length (75% of that below 750px, where the text is smaller);
 * - `data-ready`, which starts the CSS animation (nothing moves before, or under reduced motion).
 * It re-measures when the element or the group resizes (web fonts, breakpoints), pauses while
 * the marquee is off screen (`data-paused`), and pauses while one of its blocks is selected in
 * the theme editor (`data-editor-paused`). Hover pause is CSS (`data-pause-on-hover`).
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track - The moving row.
 * @property {HTMLElement} group - The original set of items.
 *
 * @extends Component<Refs>
 */
export class YvMarqueeComponent extends Component {
  requiredRefs = ['track', 'group'];

  /** @type {ResizeObserver | null} */
  #resizeObserver = null;
  /** @type {IntersectionObserver | null} */
  #intersectionObserver = null;
  /** @type {AbortController | null} */
  #controller = null;
  #frame = 0;

  connectedCallback() {
    super.connectedCallback();
    this.#teardown();

    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.#resizeObserver = new ResizeObserver(() => this.#schedule());
    this.#resizeObserver.observe(this);
    this.#resizeObserver.observe(this.refs.group);

    this.#intersectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      this.toggleAttribute('data-paused', !visible);
    });
    this.#intersectionObserver.observe(this);

    document.addEventListener('shopify:block:select', this.#onBlockSelect, { signal });
    document.addEventListener('shopify:block:deselect', this.#onBlockDeselect, { signal });
    document.fonts?.ready.then(() => this.#schedule());

    this.#schedule();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#removeClones();
    this.#schedule();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardown();
  }

  #teardown() {
    cancelAnimationFrame(this.#frame);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#intersectionObserver?.disconnect();
    this.#intersectionObserver = null;
    this.#controller?.abort();
    this.#controller = null;
  }

  /** Pixels per second from `data-speed` (10 to 400, default 35). */
  get speed() {
    const value = Number(this.dataset.speed);
    if (!Number.isFinite(value) || value <= 0) return 35;
    return Math.min(Math.max(value, 10), 400);
  }

  #schedule() {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#layout());
  }

  #layout() {
    const { track, group } = this.refs;
    if (!track || !group) return;

    const groupWidth = group.offsetWidth;
    const viewWidth = this.clientWidth;
    if (!groupWidth || !viewWidth) return;

    const copies = Math.min(Math.max(Math.ceil(viewWidth / groupWidth) + 1, 2), 40);
    const clones = this.#clones();
    let count = clones.length + 1;

    while (count < copies) {
      track.append(this.#cloneGroup(group));
      count += 1;
    }

    for (let index = clones.length - 1; index >= 0 && count > copies; index -= 1) {
      clones[index]?.remove();
      count -= 1;
    }

    const isSmall = window.matchMedia('(max-width: 749px)').matches;
    const pixelsPerSecond = this.speed * (isSmall ? 0.75 : 1);

    this.style.setProperty('--yv-marquee-copies', String(copies));
    this.style.setProperty('--yv-marquee-duration', `${(groupWidth / pixelsPerSecond).toFixed(2)}s`);
    this.setAttribute('data-ready', '');
  }

  /** @returns {HTMLElement[]} */
  #clones() {
    return /** @type {HTMLElement[]} */ ([...this.refs.track.children].filter((child) =>
      child.hasAttribute('data-yv-marquee-clone')
    ));
  }

  #removeClones() {
    for (const clone of this.#clones()) clone.remove();
  }

  /**
   * @param {HTMLElement} group
   * @returns {HTMLElement}
   */
  #cloneGroup(group) {
    const clone = /** @type {HTMLElement} */ (group.cloneNode(true));
    clone.removeAttribute('ref');
    for (const node of clone.querySelectorAll('[ref]')) node.removeAttribute('ref');
    for (const node of clone.querySelectorAll('[id]')) node.removeAttribute('id');
    for (const node of clone.querySelectorAll('[data-shopify-editor-block]')) {
      node.removeAttribute('data-shopify-editor-block');
    }
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.setAttribute('data-yv-marquee-clone', '');
    return clone;
  }

  /** @param {Event} event */
  #onBlockSelect = (event) => {
    if (event.target instanceof Node && this.contains(event.target)) {
      this.setAttribute('data-editor-paused', '');
    }
  };

  /** @param {Event} event */
  #onBlockDeselect = (event) => {
    if (event.target instanceof Node && this.contains(event.target)) {
      this.removeAttribute('data-editor-paused');
    }
  };
}

if (!customElements.get('yv-marquee-component')) {
  customElements.define('yv-marquee-component', YvMarqueeComponent);
}
