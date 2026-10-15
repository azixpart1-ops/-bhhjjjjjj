import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';
import {
  getScrollEventTarget,
  getScrollTop,
  scrollTo,
  scrollContainerMediaQuery,
} from '@theme/scroll-container';

/**
 * Yuva site-wide overlays rendered by snippets/yv-global-overlays.liquid (docs part 4: Age
 * verification popup, Cookie privacy banner, Stickers, Scroll to top). Loaded on every page by
 * snippets/scripts.liquid; each element only acts when its markup is on the page.
 *
 * Offsets shared with other fixed widgets (set on <html>):
 * - `--yv-privacy-banner-height`: height of the open cookie banner (the mobile dock and the
 *   scroll-to-top button sit above it).
 * - `--yv-mobile-dock-offset`: written by assets/yv-mobile-dock.js while the dock shows.
 */

/** Milliseconds in one day. */
const DAY_MS = 86400000;

/**
 * Sets a first-party cookie (path `/`, SameSite Lax) that expires after `days` days.
 * @param {string} name
 * @param {string} value
 * @param {number} days
 */
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + Math.max(1, days) * DAY_MS).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/** @returns {any} The parsed `#yv-theme-config` JSON (empty object when missing). */
function readConfig() {
  try {
    return JSON.parse(document.getElementById('yv-theme-config')?.textContent || '{}');
  } catch {
    return {};
  }
}

/**
 * Resolves after the element's opacity transition, or after `fallback` ms.
 * @param {Element} element
 * @param {number} fallback
 * @returns {Promise<void>}
 */
function afterFade(element, fallback) {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, fallback);
    element.addEventListener(
      'transitionend',
      (event) => {
        if (event.target !== element) return;
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

/* ------------------------------------------------------------------------------ age gate */

/**
 * Full-screen age verification (Theme settings > Age verification popup).
 *
 * The markup arrives as an open, non-modal `<dialog>` so nothing flashes before this module runs;
 * here it becomes a modal dialog (the rest of the page turns inert). Escape and backdrop clicks do
 * nothing, a browser-forced close reopens it, and a modal opened later by another component (a
 * newsletter popup timer, for example) never covers it.
 *
 * Approve stores `yv_age_verified=1` for `data-days` days, fades out and removes the element.
 * Decline swaps the card to the under-age view (no cookie); its button returns to the question.
 * Theme editor (`data-design-mode`): always shown; approve hides it without a cookie.
 *
 * @typedef {object} AgeGateRefs
 * @property {HTMLDialogElement} dialog
 * @property {HTMLElement} askView
 * @property {HTMLElement} deniedView
 * @property {HTMLElement} [deniedHeading]
 * @property {HTMLButtonElement} [approveButton]
 *
 * @extends {Component<AgeGateRefs>}
 */
class YvAgeGate extends Component {
  requiredRefs = ['dialog', 'askView', 'deniedView'];

  /** @type {AbortController | undefined} */
  #abort;

  /** @type {MutationObserver | undefined} */
  #dialogObserver;

  #confirmed = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.#confirmed) return;

    this.#abort = new AbortController();
    const { signal } = this.#abort;
    const { dialog } = this.refs;

    dialog.addEventListener('cancel', (event) => event.preventDefault(), { signal });
    dialog.addEventListener('close', this.#onClose, { signal });

    this.#makeModal();

    this.#dialogObserver = new MutationObserver(this.#onDialogsChange);
    this.#dialogObserver.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#dialogObserver?.disconnect();
  }

  /** Visitor confirms the age. */
  approve() {
    if (this.#confirmed) return;
    this.#confirmed = true;
    this.#dialogObserver?.disconnect();

    if (!this.hasAttribute('data-design-mode')) {
      setCookie('yv_age_verified', '1', Number(this.dataset.days) || 7);
    }

    const { dialog } = this.refs;
    this.classList.add('is-leaving');
    afterFade(dialog, 350).then(() => {
      this.#abort?.abort();
      if (dialog.open) dialog.close();
      this.remove();
    });
  }

  /** Visitor declines: show the under-age view. */
  decline() {
    this.#swap(true);
  }

  /** Back from the under-age view to the question. */
  back() {
    this.#swap(false);
  }

  /** @param {boolean} denied */
  #swap(denied) {
    const { askView, deniedView, deniedHeading, approveButton } = this.refs;
    askView.hidden = denied;
    deniedView.hidden = !denied;
    (denied ? deniedHeading : approveButton)?.focus({ preventScroll: true });
  }

  /** Re-shows the gate as a modal dialog (also moves it to the top of the top layer). */
  #makeModal() {
    const { dialog } = this.refs;
    if (dialog.open) dialog.close();
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  }

  #onClose = () => {
    if (this.#confirmed || !this.isConnected || this.refs.dialog.open) return;
    this.#makeModal();
  };

  /** @param {MutationRecord[]} records */
  #onDialogsChange = (records) => {
    if (this.#confirmed) return;
    const { dialog } = this.refs;
    const otherModalOpened = records.some(
      (record) =>
        record.target !== dialog && record.target instanceof HTMLDialogElement && record.target.matches(':modal')
    );
    if (otherModalOpened) this.#makeModal();
  };
}

/* ------------------------------------------------------------------------------ privacy banner */

/**
 * Cookie consent bar (Theme settings > Cookie privacy banner) on Shopify's Customer Privacy API.
 * It shows only when `customerPrivacy.shouldShowBanner()` (or the older `shouldShowGDPRBanner()`)
 * returns true; when the API cannot load nothing shows. Accept / Decline record the choice with
 * `setTrackingConsent()` and hide the bar, which also hides on `visitorConsentCollected`.
 * Theme editor (`data-design-mode`): always shown, the buttons only hide it.
 *
 * @extends {Component}
 */
class YvPrivacyBanner extends Component {
  /** @type {AbortController | undefined} */
  #abort;

  /** @type {ResizeObserver | undefined} */
  #resizeObserver;

  #busy = false;

  connectedCallback() {
    super.connectedCallback();
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    document.addEventListener('visitorConsentCollected', () => this.hide(), { signal });

    if (this.hasAttribute('data-design-mode')) {
      this.show();
      return;
    }

    this.#loadPrivacyApi(true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#resizeObserver?.disconnect();
    document.documentElement.style.removeProperty('--yv-privacy-banner-height');
  }

  accept() {
    this.#record(true);
  }

  decline() {
    this.#record(false);
  }

  show() {
    if (!this.hidden && this.classList.contains('is-open')) return;
    this.hidden = false;
    requestAnimationFrame(() => {
      this.classList.add('is-open');
      this.#publishHeight();
    });
    this.#resizeObserver ??= new ResizeObserver(() => this.#publishHeight());
    this.#resizeObserver.observe(this);
  }

  hide() {
    if (this.hidden) return;
    this.classList.remove('is-open');
    this.#resizeObserver?.disconnect();
    document.documentElement.style.setProperty('--yv-privacy-banner-height', '0px');
    afterFade(this, 350).then(() => {
      if (!this.classList.contains('is-open')) this.hidden = true;
    });
  }

  #publishHeight() {
    if (!this.classList.contains('is-open')) return;
    document.documentElement.style.setProperty('--yv-privacy-banner-height', `${this.offsetHeight}px`);
  }

  /**
   * Loads Shopify's consent API, then shows the bar when the visitor still has to choose.
   * `Shopify.loadFeatures` comes from the storefront scripts in `content_for_header`; when it is not
   * there yet, try once more after the window load event.
   * @param {boolean} retry
   */
  #loadPrivacyApi(retry) {
    const shopify = /** @type {any} */ (window).Shopify;
    if (typeof shopify?.loadFeatures !== 'function') {
      if (retry && document.readyState !== 'complete') {
        window.addEventListener('load', () => this.#loadPrivacyApi(false), {
          once: true,
          signal: this.#abort?.signal,
        });
      }
      return;
    }

    try {
      shopify.loadFeatures(
        [{ name: 'consent-tracking-api', version: '0.1' }],
        /** @param {unknown} error */
        (error) => {
          if (error || !this.isConnected) return;
          const privacy = /** @type {any} */ (window).Shopify?.customerPrivacy;
          if (!privacy) return;
          const shouldShow =
            typeof privacy.shouldShowBanner === 'function'
              ? privacy.shouldShowBanner()
              : privacy.shouldShowGDPRBanner?.();
          if (shouldShow) this.show();
        }
      );
    } catch (error) {
      console.warn('[yv-privacy-banner] Customer privacy API unavailable', error);
    }
  }

  /** @param {boolean} granted */
  #record(granted) {
    if (this.#busy) return;
    const privacy = /** @type {any} */ (window).Shopify?.customerPrivacy;
    if (this.hasAttribute('data-design-mode') || typeof privacy?.setTrackingConsent !== 'function') {
      this.hide();
      return;
    }

    this.#setBusy(true);
    const done = () => {
      this.#setBusy(false);
      this.hide();
    };

    try {
      privacy.setTrackingConsent(
        { analytics: granted, marketing: granted, preferences: granted, sale_of_data: granted },
        done
      );
    } catch (error) {
      console.warn('[yv-privacy-banner] Could not record consent', error);
      done();
    }
  }

  /** @param {boolean} busy */
  #setBusy(busy) {
    this.#busy = busy;
    this.querySelectorAll('button').forEach((button) => {
      if (busy) button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
      button.disabled = busy;
    });
  }
}

/* ------------------------------------------------------------------------------ scroll to top */

/**
 * Floating back-to-top button (Theme settings > Scroll to top). Visible past 400px of scroll, on
 * whichever element scrolls the page (`.page-wrapper` from 990px, the document below). It rises
 * above Horizon's sticky add-to-cart bar while that bar is pinned to the bottom of the screen, and
 * sets `data-over-footer` while it overlaps the footer.
 *
 * @extends {Component}
 */
class YvScrollTopComponent extends Component {
  /** @type {AbortController | undefined} */
  #abort;

  /** @type {EventTarget | undefined} */
  #scrollTarget;

  /** @type {MutationObserver | undefined} */
  #barObserver;

  #frame = 0;

  connectedCallback() {
    super.connectedCallback();
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    this.#bindScroll();
    scrollContainerMediaQuery.addEventListener('change', this.#rebindScroll, { signal });
    window.addEventListener('resize', this.#syncBottomBar, { signal, passive: true });
    document.addEventListener('shopify:section:load', this.#watchBottomBar, { signal });

    this.#watchBottomBar();
    this.#update();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#scrollTarget?.removeEventListener('scroll', this.#onScroll);
    this.#barObserver?.disconnect();
    if (this.#frame) cancelAnimationFrame(this.#frame);
  }

  /** Scrolls the page back to the top and moves focus to the main content. */
  scrollToTop() {
    scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });

    const main = document.getElementById('MainContent');
    if (!main) return;
    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1');
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    }
    main.focus({ preventScroll: true });
  }

  #bindScroll() {
    this.#scrollTarget = getScrollEventTarget();
    this.#scrollTarget.addEventListener('scroll', this.#onScroll, { passive: true });
  }

  #rebindScroll = () => {
    this.#scrollTarget?.removeEventListener('scroll', this.#onScroll);
    this.#bindScroll();
    this.#update();
  };

  #onScroll = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#update();
    });
  };

  #update() {
    const visible = getScrollTop() > 400;
    this.toggleAttribute('data-visible', visible);
    this.toggleAttribute('data-over-footer', visible && this.#overFooter());
  }

  /**
   * Whether the button sits over the footer, where a transparent ring and arrow can disappear on a
   * dark background (the stylesheet then adds a frosted disc in the page colour).
   * @returns {boolean}
   */
  #overFooter() {
    const footer = document.querySelector('.page-wrapper > footer') ?? document.querySelector('footer');
    if (!footer) return false;
    return footer.getBoundingClientRect().top < this.getBoundingClientRect().bottom;
  }

  /** Observes Horizon's sticky add-to-cart bar (product pages). */
  #watchBottomBar = () => {
    this.#barObserver?.disconnect();
    const bar = document.querySelector('.sticky-add-to-cart__bar');
    if (!bar) {
      this.style.removeProperty('--yv-bottom-bar-offset');
      return;
    }
    this.#barObserver = new MutationObserver(this.#syncBottomBar);
    this.#barObserver.observe(bar, { attributes: true, attributeFilter: ['data-stuck'] });
    this.#syncBottomBar();
  };

  /** Lifts the button above the sticky bar while it is pinned to the bottom edge. */
  #syncBottomBar = () => {
    const bar = /** @type {HTMLElement | null} */ (document.querySelector('.sticky-add-to-cart__bar'));
    const pinned = bar?.dataset.stuck === 'true' && bar.getBoundingClientRect().top > window.innerHeight / 2;
    if (bar && pinned) {
      this.style.setProperty('--yv-bottom-bar-offset', `${bar.offsetHeight + 20}px`);
    } else {
      this.style.removeProperty('--yv-bottom-bar-offset');
    }
  };
}

/* ------------------------------------------------------------------------------ stickers */

/**
 * Original sticker artwork. `outline` matches the silhouettes in assets/yv-sticker-1…6.svg (used as
 * the CSS mask, so solid colours and gradients both work); `detail` is the line drawing in a second
 * colour; `line` its stroke width (viewBox units).
 */
const STICKER_SHAPES = [
  {
    outline:
      'M50 5L59.32 15.23L72.5 11.03L75.46 24.54L88.97 27.5L84.77 40.68L95 50L84.77 59.32L88.97 72.5L75.46 75.46L72.5 88.97L59.32 84.77L50 95L40.68 84.77L27.5 88.97L24.54 75.46L11.03 72.5L15.23 59.32L5 50L15.23 40.68L11.03 27.5L24.54 24.54L27.5 11.03L40.68 15.23Z',
    detail: 'M50 33Q52 48 67 50Q52 52 50 67Q48 52 33 50Q48 48 50 33Z',
    line: 4.5,
  },
  {
    outline: 'M50 87C19 66 6 46 13 29C20 13 41 12 50 28C59 12 80 13 87 29C94 46 81 66 50 87Z',
    detail: 'M24 36Q25 25 36 22',
    line: 6,
  },
  {
    outline: 'M5 50a45 45 0 1 0 90 0a45 45 0 1 0 -90 0Z',
    detail: 'M37 37v9M63 37v9M31 58Q50 77 69 58',
    line: 6,
  },
  {
    outline: 'M57 4L19 57H46L37 96L81 41H54L66 4Z',
    detail: 'M53 15L36 42',
    line: 5,
  },
  {
    outline:
      'M31 25.5a19 19 0 1 0 38 0a19 19 0 1 0 -38 0ZM56.68 44.16a19 19 0 1 0 38 0a19 19 0 1 0 -38 0ZM46.87 74.34a19 19 0 1 0 38 0a19 19 0 1 0 -38 0ZM15.13 74.34a19 19 0 1 0 38 0a19 19 0 1 0 -38 0ZM5.32 44.16a19 19 0 1 0 38 0a19 19 0 1 0 -38 0ZM33 52.5a17 17 0 1 0 34 0a17 17 0 1 0 -34 0Z',
    detail: 'M41 52.5a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z',
    line: 5,
  },
  {
    outline:
      'M26 10H74A20 20 0 0 1 94 30V52A20 20 0 0 1 74 72H49L25 92L30 72H26A20 20 0 0 1 6 52V30A20 20 0 0 1 26 10Z',
    detail: 'M32 41h0M50 41h0M68 41h0',
    line: 10,
  },
];

const STICKER_COUNT = 8;
const STICKER_ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Idle "screensaver" (Theme settings > Stickers). After the configured idle time (5s in test mode)
 * eight stickers pop up at random places; any activity fades them out and restarts the timer.
 * Never under reduced motion, while a dialog, drawer or the menu drawer is open, or in a hidden tab.
 *
 * @extends {Component}
 */
class YvStickersComponent extends Component {
  /** @type {AbortController | undefined} */
  #abort;

  #timer = 0;
  #lastActivity = 0;
  #delay = 120000;
  #showing = false;

  /** @type {string[]} */
  #colors = [];

  /** @type {string[]} */
  #backgrounds = [];

  /** @type {string[]} */
  #masks = [];

  connectedCallback() {
    super.connectedCallback();
    if (prefersReducedMotion()) return;

    const config = readConfig().stickers || {};
    if (!config.enabled) return;

    this.#delay = Math.max(1000, Number(config.delayMs) || 120000);
    this.#colors = (Array.isArray(config.colors) ? config.colors : []).filter(Boolean);
    const gradients = (Array.isArray(config.gradients) ? config.gradients : []).filter(Boolean);
    this.#backgrounds = config.useGradient && gradients.length ? gradients : this.#colors;
    this.#masks = (this.dataset.shapes || '').split(/\s+/).filter(Boolean);
    if (!this.#backgrounds.length || !this.#masks.length) return;

    this.#abort = new AbortController();
    const { signal } = this.#abort;
    const options = { signal, passive: true, capture: true };
    for (const type of STICKER_ACTIVITY_EVENTS) window.addEventListener(type, this.#onActivity, options);
    // Scroll events do not bubble; capturing on the document sees `.page-wrapper` scrolls too.
    document.addEventListener('scroll', this.#onActivity, options);

    this.#lastActivity = performance.now();
    this.#schedule(this.#delay);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    window.clearTimeout(this.#timer);
    this.replaceChildren();
    this.#showing = false;
  }

  #onActivity = () => {
    this.#lastActivity = performance.now();
    if (this.#showing) this.#hide();
  };

  /** @param {number} delay */
  #schedule(delay) {
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(this.#tick, delay);
  }

  #tick = () => {
    const idle = performance.now() - this.#lastActivity;
    if (idle < this.#delay) {
      this.#schedule(this.#delay - idle);
      return;
    }
    if (document.hidden || this.#isBlocked()) {
      this.#lastActivity = performance.now();
      this.#schedule(this.#delay);
      return;
    }
    this.#show();
  };

  /** @returns {boolean} Whether a dialog, drawer or menu is open. */
  #isBlocked() {
    return Boolean(
      document.querySelector('dialog[open], details.menu-drawer-container[open], .page-wrapper--drawer-open') ||
        document.documentElement.hasAttribute('scroll-lock')
    );
  }

  #show() {
    const width = this.clientWidth || window.innerWidth;
    const height = this.clientHeight || window.innerHeight;
    const marginX = width * 0.05;
    const marginY = height * 0.05;
    /** @type {{ x: number, y: number, size: number }[]} */
    const placed = [];
    const fragment = document.createDocumentFragment();
    // Deal the shapes like cards so every shape shows before any repeats.
    const shapeCount = Math.min(STICKER_SHAPES.length, this.#masks.length);
    /** @type {number[]} */
    let deck = [];

    for (let index = 0; index < STICKER_COUNT; index++) {
      const size = Math.round(random(70, 150));
      const spot = this.#place(placed, size, width, height, marginX, marginY);
      placed.push({ ...spot, size });

      if (!deck.length) deck = shuffle(Array.from({ length: shapeCount }, (_, shapeIndex) => shapeIndex));
      const shapeIndex = deck.pop() ?? 0;
      const shape = STICKER_SHAPES[shapeIndex];
      const background = pick(this.#backgrounds);
      const line = pick(this.#colors.filter((color) => color !== background)) || '#ffffff';

      const sticker = document.createElement('span');
      sticker.className = 'yv-sticker';
      sticker.style.setProperty('--yv-sticker-x', `${Math.round(spot.x)}px`);
      sticker.style.setProperty('--yv-sticker-y', `${Math.round(spot.y)}px`);
      sticker.style.setProperty('--yv-sticker-size', `${size}px`);
      sticker.style.setProperty('--yv-sticker-rotate', `${Math.round(random(-20, 20))}deg`);
      sticker.style.setProperty('--yv-sticker-delay', `${index * 150}ms`);

      const body = document.createElement('span');
      body.className = 'yv-sticker__shape';
      body.style.setProperty('--yv-sticker-mask', `url("${this.#masks[shapeIndex]}")`);
      body.style.setProperty('--yv-sticker-bg', background ?? '');
      body.style.setProperty('--yv-sticker-line', String(shape?.line ?? 5));
      body.style.color = line;
      body.append(drawSticker(shape));

      sticker.append(body);
      fragment.append(sticker);
    }

    this.replaceChildren(fragment);
    this.#showing = true;
  }

  /**
   * Picks the candidate position farthest from the stickers already placed.
   * @param {{ x: number, y: number, size: number }[]} placed
   * @param {number} size
   * @param {number} width
   * @param {number} height
   * @param {number} marginX
   * @param {number} marginY
   */
  #place(placed, size, width, height, marginX, marginY) {
    let best = { x: marginX, y: marginY };
    let bestDistance = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = random(marginX, Math.max(marginX, width - marginX - size));
      const y = random(marginY, Math.max(marginY, height - marginY - size));
      const distance = placed.length
        ? Math.min(
            ...placed.map((other) => Math.hypot(other.x + other.size / 2 - x - size / 2, other.y + other.size / 2 - y - size / 2))
          )
        : Infinity;
      if (distance > bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
      if (distance === Infinity) break;
    }
    return best;
  }

  #hide() {
    this.#showing = false;
    const stickers = Array.from(this.children);
    stickers.forEach((sticker) => sticker.classList.add('is-leaving'));
    window.setTimeout(() => {
      stickers.forEach((sticker) => sticker.remove());
    }, 320);
    this.#schedule(this.#delay);
  }
}

/**
 * @param {number} min
 * @param {number} max
 */
function random(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Fisher–Yates shuffle (in place).
 * @template T
 * @param {T[]} list
 * @returns {T[]}
 */
function shuffle(list) {
  for (let index = list.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [list[index], list[other]] = [/** @type {T} */ (list[other]), /** @type {T} */ (list[index])];
  }
  return list;
}

/**
 * @template T
 * @param {T[]} list
 * @returns {T | undefined}
 */
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Inline drawing on top of the masked silhouette: a white die-cut edge and the line detail.
 * @param {{ outline: string, detail: string } | undefined} shape
 */
function drawSticker(shape) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (!shape) return svg;

  const edge = document.createElementNS(SVG_NS, 'path');
  edge.setAttribute('class', 'yv-sticker__edge');
  edge.setAttribute('d', shape.outline);

  const detail = document.createElementNS(SVG_NS, 'path');
  detail.setAttribute('class', 'yv-sticker__detail');
  detail.setAttribute('d', shape.detail);

  svg.append(edge, detail);
  return svg;
}

if (!customElements.get('yv-age-gate')) customElements.define('yv-age-gate', YvAgeGate);
if (!customElements.get('yv-privacy-banner')) customElements.define('yv-privacy-banner', YvPrivacyBanner);
if (!customElements.get('yv-scroll-top-component')) {
  customElements.define('yv-scroll-top-component', YvScrollTopComponent);
}
if (!customElements.get('yv-stickers-component')) customElements.define('yv-stickers-component', YvStickersComponent);
