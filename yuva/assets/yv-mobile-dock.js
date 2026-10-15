import { Component } from '@theme/component';
import { StandardEvents } from '@shopify/events';
import { getScrollEventTarget, getScrollTop, scrollContainerMediaQuery } from '@theme/scroll-container';

/** Scroll distance (px) below which direction changes are ignored (finger jitter). */
const SCROLL_THRESHOLD = 8;

/** The dock never shows while the page is still within this distance (px) of its top. */
const TOP_ZONE = 120;

/** Gap between the dock and the bottom edge of the screen (px, as in the stylesheet). */
const DOCK_GAP = 15;

const MOBILE_QUERY = window.matchMedia('(max-width: 749px)');

/**
 * Yuva mobile dock (sections/yv-mobile-dock.liquid).
 *
 * - `data-mode="scroll"`: visible while the shopper scrolls down (the sticky header slides away),
 *   hidden on scroll up, near the top of the page and once the footer is on screen.
 * - `data-mode="always"`: always visible.
 * - Hidden in both modes while Horizon's sticky add-to-cart bar is pinned to the bottom edge.
 * - Writes `--yv-mobile-dock-offset` on <html> (its height plus bottom gap while visible, 0px
 *   otherwise) so the scroll-to-top button can rise above it.
 * - Menu opens Horizon's header drawer; the cart dot follows `shopify:cart:lines-update`.
 * - Theme editor: shown while the section is selected.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement} [menuButton]
 * @property {HTMLElement} [cartDot]
 * @property {HTMLElement} [cartCount]
 *
 * @extends {Component<Refs>}
 */
class YvMobileDockComponent extends Component {
  /** @type {AbortController | undefined} */
  #abort;

  /** @type {EventTarget | undefined} */
  #scrollTarget;

  /** @type {IntersectionObserver | undefined} */
  #footerObserver;

  /** @type {MutationObserver | undefined} */
  #barObserver;

  /** @type {MutationObserver | undefined} */
  #menuObserver;

  #frame = 0;
  #lastTop = 0;
  #scrollingDown = false;
  #footerInView = false;
  #barPinned = false;
  #editorSelected = false;
  #menuOpenedHere = false;
  #offset = '';

  connectedCallback() {
    super.connectedCallback();
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    this.#lastTop = getScrollTop();
    this.#bindScroll();
    scrollContainerMediaQuery.addEventListener('change', this.#rebindScroll, { signal });
    MOBILE_QUERY.addEventListener('change', this.#render, { signal });

    document.addEventListener(StandardEvents.cartLinesUpdate, this.#onCartUpdate, { signal });
    window.addEventListener('pageshow', this.#onPageShow, { signal });
    document.addEventListener('shopify:section:load', this.#onSectionLoad, { signal });

    if (window.Shopify?.designMode) {
      document.addEventListener('shopify:section:select', this.#onEditorSelect, { signal });
      document.addEventListener('shopify:section:deselect', this.#onEditorDeselect, { signal });
    }

    this.#observeFooter();
    this.#observeStickyBar();
    this.#observeMenu();
    this.#render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#scrollTarget?.removeEventListener('scroll', this.#onScroll);
    this.#footerObserver?.disconnect();
    this.#barObserver?.disconnect();
    this.#menuObserver?.disconnect();
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#offset = '';
    document.documentElement.style.removeProperty('--yv-mobile-dock-offset');
  }

  /**
   * Opens Horizon's header menu drawer (the hamburger's `<details>`). Focus moves to the drawer's
   * summary, as when the hamburger itself is used, so Escape and the focus trap work; it comes back
   * to the dock button when the drawer closes.
   */
  openMenu() {
    const summary = this.#menuSummary;
    if (!(summary instanceof HTMLElement)) return;
    summary.click();
    summary.focus({ preventScroll: true });
    this.#menuOpenedHere = true;
  }

  /** @returns {Element | null} The summary that toggles the header menu drawer. */
  get #menuSummary() {
    return document.querySelector('#Details-menu-drawer-container > summary');
  }

  /* --------------------------------------------------------------------------- scroll */

  #bindScroll() {
    this.#scrollTarget = getScrollEventTarget();
    this.#scrollTarget.addEventListener('scroll', this.#onScroll, { passive: true });
  }

  #rebindScroll = () => {
    this.#scrollTarget?.removeEventListener('scroll', this.#onScroll);
    this.#bindScroll();
    this.#lastTop = getScrollTop();
    this.#render();
  };

  #onScroll = () => {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      const top = getScrollTop();
      const delta = top - this.#lastTop;

      if (top <= TOP_ZONE) {
        this.#scrollingDown = false;
      } else if (Math.abs(delta) < SCROLL_THRESHOLD) {
        return;
      } else {
        this.#scrollingDown = delta > 0;
      }

      this.#lastTop = top;
      this.#render();
    });
  };

  /* --------------------------------------------------------------------------- state */

  #render = () => {
    const always = this.dataset.mode === 'always';
    const visible =
      this.#editorSelected || (!this.#barPinned && (always || (this.#scrollingDown && !this.#footerInView)));

    if (this.hasAttribute('data-visible') !== visible) this.toggleAttribute('data-visible', visible);

    // Height plus the bottom gap (the cookie banner's height is added by the widgets themselves).
    const offset = visible && MOBILE_QUERY.matches ? `${Math.round(this.offsetHeight + DOCK_GAP)}px` : '0px';
    if (offset !== this.#offset) {
      this.#offset = offset;
      document.documentElement.style.setProperty('--yv-mobile-dock-offset', offset);
    }
  };

  #observeFooter() {
    this.#footerObserver?.disconnect();
    const footer = document.querySelector('.page-wrapper > footer') ?? document.querySelector('footer');
    if (!footer) return;

    this.#footerObserver = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      this.#footerInView = entry.isIntersecting;
      this.#render();
    });
    this.#footerObserver.observe(footer);
  }

  /** Steps aside while Horizon's sticky add-to-cart bar is pinned to the bottom of the screen. */
  #observeStickyBar() {
    this.#barObserver?.disconnect();
    const bar = document.querySelector('.sticky-add-to-cart__bar');
    this.#barPinned = false;
    if (!(bar instanceof HTMLElement)) return;

    const sync = () => {
      this.#barPinned = bar.dataset.stuck === 'true' && bar.getBoundingClientRect().top > window.innerHeight / 2;
      this.#render();
    };
    this.#barObserver = new MutationObserver(sync);
    this.#barObserver.observe(bar, { attributes: true, attributeFilter: ['data-stuck'] });
    sync();
  }

  /** Keeps the menu button's `aria-expanded` in step with the drawer, and hides it without a drawer. */
  #observeMenu() {
    this.#menuObserver?.disconnect();
    const { menuButton } = this.refs;
    if (!menuButton) return;

    const details = document.getElementById('Details-menu-drawer-container');
    menuButton.hidden = !details;
    if (!details) return;

    const sync = () => {
      const open = details.hasAttribute('open');
      menuButton.setAttribute('aria-expanded', String(open));
      if (open || !this.#menuOpenedHere) return;
      this.#menuOpenedHere = false;
      const active = document.activeElement;
      const focusLost = !active || active === document.body || details.contains(active);
      if (focusLost && this.hasAttribute('data-visible')) menuButton.focus({ preventScroll: true });
    };
    this.#menuObserver = new MutationObserver(sync);
    this.#menuObserver.observe(details, { attributes: true, attributeFilter: ['open'] });
    sync();
  }

  /* --------------------------------------------------------------------------- cart */

  /** @param {Event} event */
  #onCartUpdate = (event) => {
    const update = /** @type {any} */ (event);
    update.promise
      ?.then(/** @param {any} result */ (result) => {
        const count = result?.cart?.totalQuantity ?? result?.detail?.itemCount;
        if (typeof count === 'number') this.#setCount(count);
      })
      .catch(/** @param {any} error */ (error) => {
        if (error?.name !== 'AbortError') console.warn('[yv-mobile-dock] Cart count not updated', error);
      });
  };

  /** Refreshes the count after back/forward navigation restores the page from the cache. */
  #onPageShow = (/** @type {PageTransitionEvent} */ event) => {
    if (!event.persisted || !this.refs.cartDot) return;
    const cartUrl = window.Theme?.routes?.cart_url || '/cart';
    fetch(`${cartUrl}.js`, { headers: { Accept: 'application/json' } })
      .then((response) => response.json())
      .then((cart) => {
        if (typeof cart?.item_count === 'number') this.#setCount(cart.item_count);
      })
      .catch(() => {});
  };

  /** @param {number} count */
  #setCount(count) {
    const { cartDot, cartCount } = this.refs;
    if (cartDot) cartDot.hidden = count <= 0;
    if (cartCount) cartCount.textContent = String(count);
  }

  /* --------------------------------------------------------------------------- editor */

  /** @param {Event} event */
  #onSectionLoad = (event) => {
    if (event.target instanceof Element && event.target.contains(this)) return;
    // The header or the product section may have been re-rendered.
    this.#observeStickyBar();
    this.#observeMenu();
  };

  /** @param {Event} event */
  #onEditorSelect = (event) => {
    if (!(event.target instanceof Element) || !event.target.contains(this)) return;
    this.#editorSelected = true;
    this.#render();
  };

  /** @param {Event} event */
  #onEditorDeselect = (event) => {
    if (!(event.target instanceof Element) || !event.target.contains(this)) return;
    this.#editorSelected = false;
    this.#render();
  };
}

if (!customElements.get('yv-mobile-dock-component')) {
  customElements.define('yv-mobile-dock-component', YvMobileDockComponent);
}
