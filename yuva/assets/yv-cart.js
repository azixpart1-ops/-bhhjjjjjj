import { Component } from '@theme/component';
import { CartLinesUpdateEvent, CartErrorEvent, StandardEvents } from '@shopify/events';
import { DrawerCloseEvent, DrawerOpenEvent } from '@theme/theme-drawer';
import { trapFocus } from '@theme/focus';
import { fetchConfig, prefersReducedMotion, lockScroll, unlockScroll } from '@theme/utilities';
import { formatMoney } from '@theme/money-formatting';

/**
 * Yuva cart extras: free-shipping bar (multi-currency), gift-wrap toggle and cart upsells.
 * Loaded by snippets/cart-drawer.liquid and sections/main-cart.liquid.
 *
 * Every cart change goes through Shopify's standard `CartLinesUpdateEvent`, exactly like Horizon's
 * product form and cart items, so the drawer, the cart page section and the cart bubble refresh
 * themselves from the `sections` HTML returned with the request.
 */

/* ----------------------------------------------------------------------------------- cart API */

/** Section ids of every cart-items-component on the page (drawer and/or cart page). */
function cartSectionIds() {
  return Array.from(document.querySelectorAll('cart-items-component'))
    .map((element) => /** @type {HTMLElement} */ (element).dataset.sectionId)
    .filter(Boolean);
}

function cartUrl() {
  return window.Theme?.routes?.cart_url || '/cart';
}

/** @returns {Promise<any>} The AJAX cart. */
async function fetchAjaxCart() {
  const response = await fetch(`${cartUrl()}.js`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`Cart request failed: ${response.status}`);
  return response.json();
}

/**
 * Adds variants and drives Horizon's cart UI (drawer, bubble, cart page morph).
 * @param {Array<{ id: number | string, quantity?: number }>} items
 * @param {Element} source - The element the events are dispatched from.
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function addToCart(items, source) {
  const lines = items.map((item) => ({ merchandiseId: String(item.id), quantity: item.quantity ?? 1 }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const deferred = CartLinesUpdateEvent.createPromise();

  source.dispatchEvent(
    new CartLinesUpdateEvent({ action: 'add', context: 'product', lines, promise: deferred.promise })
  );

  try {
    const response = await fetch(window.Theme?.routes?.cart_add_url || '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        items: items.map((item) => ({ id: Number(item.id), quantity: item.quantity ?? 1 })),
        sections: cartSectionIds().join(','),
      }),
    });
    const data = await response.json();
    const ajaxCart = await fetchAjaxCart();
    const cart = CartLinesUpdateEvent.createCartFromAjaxResponse(ajaxCart);

    if (data.status) {
      source.dispatchEvent(
        new CartErrorEvent({
          error: data.message || 'Add to cart failed',
          code: 'INVALID',
          detail: { description: data.description, errors: data.errors },
        })
      );
      deferred.resolve({ cart, detail: { didError: true, items: ajaxCart.items, itemCount, source: 'yv-cart' } });
      return { ok: false, message: data.description || data.message };
    }

    deferred.resolve({
      cart,
      detail: { didError: false, items: ajaxCart.items, sections: data.sections, itemCount, source: 'yv-cart' },
    });
    return { ok: true };
  } catch (error) {
    deferred.reject(error);
    source.dispatchEvent(
      new CartErrorEvent({
        error: /** @type {Error} */ (error)?.message || 'Network error during add to cart',
        code: 'SERVICE_UNAVAILABLE',
      })
    );
    return { ok: false, message: /** @type {Error} */ (error)?.message };
  }
}

/**
 * Sets a cart line's quantity (0 removes it) and drives Horizon's cart UI.
 * @param {string} lineKey
 * @param {number} quantity
 * @param {Element} source
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function changeLine(lineKey, quantity, source) {
  const deferred = CartLinesUpdateEvent.createPromise();
  source.dispatchEvent(
    new CartLinesUpdateEvent({
      action: quantity === 0 ? 'remove' : 'update',
      context: 'cart',
      lines: [{ id: lineKey, quantity }],
      promise: deferred.promise,
    })
  );

  try {
    const response = await fetch(
      `${window.Theme?.routes?.cart_change_url || '/cart/change'}.js`,
      fetchConfig('json', { body: JSON.stringify({ id: lineKey, quantity, sections: cartSectionIds().join(',') }) })
    );
    const data = await response.json();

    if (data.status || data.errors) {
      const ajaxCart = await fetchAjaxCart();
      source.dispatchEvent(
        new CartErrorEvent({ error: data.errors || data.message || 'Cart update failed', code: 'INVALID' })
      );
      deferred.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(ajaxCart),
        detail: { didError: true, items: ajaxCart.items, source: 'yv-cart' },
      });
      return { ok: false, message: data.errors || data.message };
    }

    deferred.resolve({
      cart: CartLinesUpdateEvent.createCartFromAjaxResponse(data),
      detail: {
        didError: false,
        items: data.items,
        itemCount: data.item_count,
        sections: data.sections,
        source: 'yv-cart',
      },
    });
    return { ok: true };
  } catch (error) {
    deferred.reject(error);
    source.dispatchEvent(
      new CartErrorEvent({
        error: /** @type {Error} */ (error)?.message || 'Network error during cart update',
        code: 'SERVICE_UNAVAILABLE',
      })
    );
    return { ok: false, message: /** @type {Error} */ (error)?.message };
  }
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ----------------------------------------------------------------------------- shipping bar */

/**
 * The bar is rendered by Liquid (snippets/yv-shipping-bar.liquid). The threshold is set in the shop
 * currency, so when the buyer shops in another currency this converts it with Shopify's rate and
 * rewrites the message and the fill.
 *
 * @typedef {object} ShippingBarRefs
 * @property {HTMLElement} text
 * @property {HTMLElement} track
 * @property {HTMLElement} fill
 * @property {HTMLTemplateElement} messageTemplate
 * @property {HTMLTemplateElement} successTemplate
 *
 * @extends {Component<ShippingBarRefs>}
 */
class YvShippingBarComponent extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.#convert();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#convert();
  }

  #convert() {
    const { currency, shopCurrency, threshold, total, moneyFormat } = this.dataset;
    const rate = Number(window.Shopify?.currency?.rate || 1);
    if (!currency || currency === shopCurrency || !rate || rate === 1) return;

    const thresholdCents = Math.round(Number(threshold) * 100 * rate);
    const totalCents = Number(total) || 0;
    if (!thresholdCents) return;

    const remaining = Math.max(0, thresholdCents - totalCents);
    const progress = Math.min(100, (totalCents / thresholdCents) * 100);
    const { text, track, fill, messageTemplate, successTemplate } = this.refs;
    if (!text || !fill) return;

    if (remaining > 0) {
      const amount = escapeHtml(formatMoney(remaining, moneyFormat || '{{amount}}', currency));
      text.innerHTML = (messageTemplate?.innerHTML || '').replace(
        '||amount||',
        `<span class="yv-shipping-bar__amount">${amount}</span>`
      );
    } else {
      text.innerHTML = successTemplate?.innerHTML || '';
    }
    this.classList.toggle('yv-shipping-bar--done', remaining === 0);
    fill.style.setProperty('--yv-shipping-progress', `${progress.toFixed(2)}%`);
    track?.setAttribute('aria-valuenow', String(Math.round(progress)));
  }
}

/* -------------------------------------------------------------------------------- gift wrap */

/**
 * @typedef {object} GiftWrapRefs
 * @property {HTMLInputElement} input
 * @property {HTMLElement} error
 *
 * @extends {Component<GiftWrapRefs>}
 */
class YvGiftWrapComponent extends Component {
  requiredRefs = ['input'];

  toggle = async () => {
    const { input, error } = this.refs;
    const { variantId, lineKey } = this.dataset;
    const wantsWrap = input.checked;

    input.disabled = true;
    this.setAttribute('aria-busy', 'true');
    if (error) error.hidden = true;

    let result = { ok: true };
    if (wantsWrap && variantId) {
      result = await addToCart([{ id: variantId, quantity: 1 }], this);
    } else if (!wantsWrap && lineKey) {
      result = await changeLine(lineKey, 0, this);
    }

    // On success the cart section re-renders this element; on failure put the box back.
    if (this.isConnected) {
      input.disabled = false;
      this.removeAttribute('aria-busy');
      if (!result.ok) {
        input.checked = !wantsWrap;
        if (error && result.message) {
          error.textContent = result.message;
          error.hidden = false;
        }
      }
    }
  };
}

/* ---------------------------------------------------------------------------------- upsells */

const DESKTOP_DRAWER = '(min-width: 990px)';

/**
 * Cart upsells. The shell (snippets/yv-cart-upsells.liquid) sits outside the markup Horizon
 * re-renders, so this element fetches its rows from the rendering section `yv-cart-upsells` and
 * refreshes them after every cart change. In the drawer it also owns the slide-out panel and only
 * fetches while the drawer is open on a wide screen (a closed drawer just marks the rows stale).
 *
 * @typedef {object} UpsellRefs
 * @property {HTMLUListElement} list
 * @property {HTMLButtonElement} [tab]
 * @property {HTMLElement} [panel]
 *
 * @extends {Component<UpsellRefs>}
 */
class YvCartUpsellsComponent extends Component {
  requiredRefs = ['list'];

  /** @type {AbortController | null} */
  #abort = null;

  /** @type {AbortController | null} */
  #listeners = null;

  /** @type {MediaQueryList | null} */
  #mql = null;

  /** Rows need a fetch before they are shown again. */
  #stale = true;

  /** Last rendered rows, put back when a section morph empties the shell. */
  #html = '';

  #rendering = false;

  /** @type {MutationObserver | null} */
  #observer = null;

  get #isDrawer() {
    return this.dataset.context === 'drawer';
  }

  /** @returns {boolean} Whether a fetch is useful right now. */
  get #canShow() {
    if (!this.#isDrawer) return true;
    const drawer = this.closest('theme-drawer');
    return Boolean(drawer?.hasAttribute('open')) && window.matchMedia(DESKTOP_DRAWER).matches;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;

    document.addEventListener(StandardEvents.cartLinesUpdate, this.#onCartUpdate, { signal });

    if (this.#isDrawer) {
      const drawer = this.closest('theme-drawer');
      drawer?.addEventListener(DrawerCloseEvent.eventName, () => this.close(), { signal });
      drawer?.addEventListener(DrawerOpenEvent.eventName, () => this.#stale && this.refresh(), { signal });
      this.#mql = window.matchMedia(DESKTOP_DRAWER);
      this.#mql.addEventListener('change', () => this.#stale && this.refresh(), { signal });
      this.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape' && this.classList.contains('is-open')) {
            event.stopPropagation();
            event.preventDefault();
            this.close();
            this.refs.tab?.focus();
          }
        },
        { signal }
      );
    }

    // The cart page morphs its whole section after a cart change, which empties this shell until
    // the refetch lands; put the last rows straight back to avoid a flash.
    this.#observer = new MutationObserver(() => {
      if (this.#rendering || !this.#html) return;
      const { list } = this.refs;
      if (list && (!list.children.length || this.hidden)) queueMicrotask(() => this.#render(this.#html));
    });
    this.#observer.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });

    if (this.#canShow) this.refresh(this.dataset.productId);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#listeners?.abort();
    this.#abort?.abort();
    this.#observer?.disconnect();
  }

  /** @param {CartLinesUpdateEvent} event */
  #onCartUpdate = (event) => {
    event.promise
      ?.then(({ detail }) => {
        if (detail?.didError) return;
        this.#stale = true;
        if (this.#canShow) this.refresh();
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[yv-cart-upsells]', error);
      });
  };

  /**
   * Fetches the rows for the first cart product.
   * @param {string} [knownProductId] - Skips the cart request when the first product is known.
   */
  async refresh(knownProductId) {
    if (!this.#canShow) return;
    this.#stale = false;

    this.#abort?.abort();
    this.#abort = new AbortController();
    const { signal } = this.#abort;
    const count = Number(this.dataset.count) || 4;

    try {
      let productId = knownProductId;
      let lineCount = 0;
      if (!productId) {
        const cart = await fetchAjaxCart();
        const giftId = String(this.dataset.giftProductId || '');
        const first = (cart.items || []).find((/** @type {any} */ item) => String(item.product_id) !== giftId);
        productId = first ? String(first.product_id) : '';
        lineCount = (cart.items || []).length;
      } else {
        lineCount = Number(this.dataset.limit) - count;
      }

      if (!productId) {
        this.#render('');
        return;
      }

      const intent = this.dataset.intent === 'complementary' ? 'complementary' : 'related';
      const limit = Math.min(10, Math.max(count, lineCount + count));
      const url = `${this.dataset.url}?product_id=${encodeURIComponent(productId)}&limit=${limit}&intent=${intent}&section_id=yv-cart-upsells`;

      const response = await fetch(url, { signal });
      if (!response.ok) {
        this.#render('');
        return;
      }
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const items = doc.querySelector('[data-yv-upsell-items]');
      this.#render(items ? items.innerHTML.trim() : '');
    } catch (error) {
      if (/** @type {Error} */ (error)?.name !== 'AbortError') {
        console.warn('[yv-cart-upsells]', error);
        this.#render('');
      }
    }
  }

  /** @param {string} html */
  #render(html) {
    const { list } = this.refs;
    if (!list) return;
    this.#rendering = true;
    this.#html = html;
    if (list.innerHTML.trim() !== html) list.innerHTML = html;
    const hasItems = list.children.length > 0;
    this.hidden = !hasItems;
    if (!hasItems) this.close();
    else if (this.classList.contains('is-open')) this.#refreshFocusTrap();
    this.#observer?.takeRecords();
    this.#rendering = false;
  }

  /**
   * The drawer (non-modal at 990px and up) builds its focus trap when it opens, before the rows are
   * fetched, so the panel's buttons were not part of the Tab cycle. Rebuild the trap on the open
   * drawer dialog so they are. A modal drawer (native trap) needs nothing.
   * @returns {boolean} Whether the trap was rebuilt.
   */
  #refreshFocusTrap() {
    const dialog = this.closest('dialog');
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open || dialog.matches(':modal')) return false;
    const active = document.activeElement;
    trapFocus(dialog);
    // trapFocus() focuses the dialog itself; keep focus where it was.
    if (active instanceof HTMLElement && active !== document.body && dialog.contains(active)) {
      active.focus({ preventScroll: true });
    }
    return true;
  }

  toggle = () => {
    if (this.classList.contains('is-open')) this.close();
    else this.open();
  };

  open() {
    if (!this.#isDrawer) return;
    this.classList.add('is-open');
    this.refs.tab?.setAttribute('aria-expanded', 'true');
    this.refs.panel?.removeAttribute('inert');
    this.#refreshFocusTrap();
    // Move into the panel so keyboard users land on its products.
    const first = /** @type {HTMLElement | null} */ (
      this.refs.panel?.querySelector('a[href], button:enabled, input:enabled, [tabindex]:not([tabindex^="-"])') ?? null
    );
    first?.focus({ preventScroll: true });
  }

  close() {
    if (!this.#isDrawer) return;
    const hadFocus = Boolean(this.refs.panel?.contains(document.activeElement));
    this.classList.remove('is-open');
    this.refs.tab?.setAttribute('aria-expanded', 'false');
    this.refs.panel?.setAttribute('inert', '');
    // Focus inside the now-inert panel would be lost: hand it back to the tab.
    if (hadFocus) this.refs.tab?.focus({ preventScroll: true });
  }

  /** @param {MouseEvent} event */
  add = async (event) => {
    const button = /** @type {HTMLButtonElement | null} */ (
      event.target instanceof Element ? event.target.closest('button[data-variant-id]') : null
    );
    if (!button || button.disabled) return;

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const result = await addToCart([{ id: button.dataset.variantId || '', quantity: 1 }], this);
    if (!button.isConnected) return;

    button.removeAttribute('aria-busy');
    if (result.ok) {
      button.dataset.added = 'true';
      window.setTimeout(() => {
        button.disabled = false;
        delete button.dataset.added;
      }, prefersReducedMotion() ? 0 : 1200);
    } else {
      button.disabled = false;
    }
  };
}

/* ----------------------------------------------------------------- drawer overlay (desktop) */

/**
 * Yuva's cart drawer sits over a 50% black overlay with the page scroll locked. Horizon opens its
 * drawers non-modally from 990px and squeezes the page beside them instead, so for the cart drawer
 * only this adds the overlay (click closes the drawer) and `assets/yv-cart.css` cancels the squeeze
 * while `html.yv-cart-drawer-open` is set. Below 990px Horizon's modal ::backdrop already does it.
 */
function initCartDrawerOverlay() {
  const drawer = /** @type {(HTMLElement & { close?: () => void }) | null} */ (document.getElementById('cart-drawer'));
  if (!drawer || drawer.hasAttribute('data-yv-overlay')) return;
  drawer.setAttribute('data-yv-overlay', '');

  const wide = window.matchMedia(DESKTOP_DRAWER);
  const overlay = document.createElement('div');
  overlay.className = 'yv-cart-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.addEventListener('click', () => drawer.close?.());
  document.body.append(overlay);

  let active = false;
  const sync = () => {
    const shouldBeActive = drawer.hasAttribute('open') && wide.matches;
    if (shouldBeActive === active) return;
    active = shouldBeActive;
    document.documentElement.classList.toggle('yv-cart-drawer-open', active);
    overlay.classList.toggle('is-visible', active);
    if (active) lockScroll(overlay);
    else unlockScroll(overlay);
  };

  new MutationObserver(sync).observe(drawer, { attributes: true, attributeFilter: ['open'] });
  wide.addEventListener('change', sync);
  sync();
}

/* ----------------------------------------------------------------- browser tab notification */

/**
 * Theme settings > Cart drawer > Enable browser notification: draws the cart count on the favicon
 * (a 16px circle at the top-right, "9+" above nine) and restores the favicon at zero. Settings come
 * from `#yv-theme-config` (cart.browserNotification is only true with the drawer cart). Chrome and
 * Firefox only, as in Yuva: Safari ignores favicon swaps, so nothing is done there.
 */
function initTabNotification() {
  /** @type {any} */
  let config = {};
  try {
    config = JSON.parse(document.getElementById('yv-theme-config')?.textContent || '{}');
  } catch {
    config = {};
  }
  const settings = config.cart || {};
  const root = document.documentElement;
  if (!settings.browserNotification || root.hasAttribute('data-yv-tab-badge')) return;
  const ua = navigator.userAgent;
  if (/safari/i.test(ua) && !/chrome|chromium|crios|android|firefox|fxios|edg/i.test(ua)) return;
  root.setAttribute('data-yv-tab-badge', '');

  let link = /** @type {HTMLLinkElement | null} */ (document.querySelector('link[rel~="icon"]'));
  const originalHref = link?.href || '';
  const background = settings.notificationBg || '#ffffff';
  const foreground = settings.notificationText || '#000000';
  let request = 0;

  /** @param {string} href */
  const setIcon = (href) => {
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.append(link);
    }
    link.type = 'image/png';
    link.href = href;
  };

  /** @param {number} count */
  const draw = (count) => {
    const current = ++request;
    if (!count) {
      if (originalHref) setIcon(originalHref);
      else link?.remove();
      if (!originalHref) link = null;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) return;

    /** @param {boolean} withIcon */
    const finish = (withIcon) => {
      if (current !== request) return;
      if (!withIcon) context.clearRect(0, 0, 32, 32);
      context.beginPath();
      context.arc(24, 8, 8, 0, Math.PI * 2);
      context.fillStyle = background;
      context.fill();
      context.fillStyle = foreground;
      context.font = 'bold 11px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(count > 9 ? '9+' : String(count), 24, 8.5);
      try {
        setIcon(canvas.toDataURL('image/png'));
      } catch {
        // A favicon served without CORS taints the canvas: draw the badge alone.
        if (withIcon) {
          context.clearRect(0, 0, 32, 32);
          finish(false);
        }
      }
    };

    if (!originalHref) {
      finish(false);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      context.drawImage(image, 0, 0, 32, 32);
      finish(true);
    };
    image.onerror = () => finish(false);
    image.src = originalHref;
  };

  draw(Number(settings.itemCount) || 0);
  document.addEventListener(StandardEvents.cartLinesUpdate, (event) => {
    event.promise
      ?.then(({ cart }) => {
        if (typeof cart?.totalQuantity === 'number') draw(cart.totalQuantity);
      })
      .catch(() => {});
  });
}

function init() {
  initCartDrawerOverlay();
  initTabNotification();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

if (!customElements.get('yv-shipping-bar-component')) {
  customElements.define('yv-shipping-bar-component', YvShippingBarComponent);
}
if (!customElements.get('yv-gift-wrap-component')) {
  customElements.define('yv-gift-wrap-component', YvGiftWrapComponent);
}
if (!customElements.get('yv-cart-upsells-component')) {
  customElements.define('yv-cart-upsells-component', YvCartUpsellsComponent);
}
