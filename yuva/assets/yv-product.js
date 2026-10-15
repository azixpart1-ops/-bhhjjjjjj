import { Component } from '@theme/component';
import { morph } from '@theme/morph';
import { ThemeEvents } from '@theme/events';

/**
 * Yuva product system (b-product): behaviour shared by the product page blocks, the featured product
 * section and the recently viewed section. Every element extends Horizon's Component, so it survives
 * Section Rendering API morphs and theme editor re-renders.
 *
 * Elements:
 * - <yv-variant-sync data-sync-id data-product-id>: re-renders its children from the variant HTML
 *   (inventory status, saved pill, specifications, subscription plans).
 * - <yv-quantity-component data-product-id>: Yuva quantity block; mirrors its value into the buy
 *   buttons' own quantity selector, which stays the one that is submitted.
 * - <yv-terms-component>: terms checkbox; blocks add to cart / dynamic checkout until checked.
 * - <yv-short-videos-component>: story circles; marks the clicked circle active.
 * - <yv-recently-viewed-component>: renders the visitor's recently viewed products.
 *
 * Recently viewed tracking: the product page outputs
 * <script type="application/json" data-yv-recently-viewed>{"id":1,"handle":"x"}</script>.
 */

const PRODUCT_SELECT = 'shopify:product:select';
const STORAGE_KEY = 'yvRecentlyViewed';
const MAX_STORED = 12;

/** @param {unknown} error */
const warn = (error) => {
  if (error instanceof Error && error.name === 'AbortError') return;
  console.warn('[yv-product]', error);
};

/**
 * The scope a variant-dependent element listens on: its section, or the quick view dialog.
 * @param {Element} element
 */
const productScope = (element) => element.closest('.shopify-section, dialog') || document;

/**
 * Subscribes to product:select events of the element's own product.
 * @param {HTMLElement} element
 * @param {AbortSignal} signal
 * @param {(detail: any) => void} callback - receives the resolved `detail` (with `html`).
 */
function onVariantChange(element, signal, callback) {
  productScope(element).addEventListener(
    PRODUCT_SELECT,
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Card swatches and other products' pickers are not ours.
      const card = target.closest('product-card');
      if (card && !card.contains(element)) return;
      const promise = /** @type {any} */ (event).promise;
      if (!(promise instanceof Promise)) return;

      promise
        .then((/** @type {any} */ result) => {
          const detail = result?.detail;
          if (!detail?.html) return;
          if (detail.newProduct) {
            element.dataset.productId = String(detail.newProduct.id);
          } else if (detail.productId && element.dataset.productId && String(detail.productId) !== element.dataset.productId) {
            return;
          }
          callback(detail);
        })
        .catch(warn);
    },
    { signal }
  );
}

/* ------------------------------------------------------------------ variant sync */

/**
 * Re-renders its children from the fresh copy (same data-sync-id) in the variant HTML.
 */
class YvVariantSync extends Component {
  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();
    this.#controller?.abort();
    this.#controller = new AbortController();
    onVariantChange(this, this.#controller.signal, (detail) => {
      const id = this.dataset.syncId;
      if (!id) return;
      const fresh = detail.html.querySelector(`yv-variant-sync[data-sync-id="${CSS.escape(id)}"]`);
      if (fresh) morph(this, fresh, { childrenOnly: true });
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
  }
}

if (!customElements.get('yv-variant-sync')) customElements.define('yv-variant-sync', YvVariantSync);

/* ------------------------------------------------------------------ quantity */

/**
 * The Yuva quantity block holds Horizon's <quantity-selector-component> (outside the product form,
 * so its input is never submitted). Every change is mirrored into the product form's own quantity
 * selector, which Horizon reads when adding to cart (rules, max, sticky bar all keep working).
 */
class YvQuantityComponent extends Component {
  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#sync, { signal });
    onVariantChange(this, signal, (detail) => {
      const blockId = this.dataset.blockId;
      const fresh = detail.html.querySelector(`yv-quantity-component[data-block-id="${CSS.escape(blockId || '')}"] input`);
      const selector = /** @type {any} */ (this.querySelector('quantity-selector-component'));
      const input = this.querySelector('input');
      if (fresh instanceof HTMLInputElement && selector?.updateConstraints && input) {
        input.disabled = fresh.disabled;
        selector.updateConstraints(fresh.min, fresh.max || null, fresh.step);
      }
      this.#sync();
    });

    // The form may render after this block; mirror once everything is upgraded.
    requestAnimationFrame(() => this.#sync());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
  }

  /** The product form's own quantity selector (same section or dialog, same product). */
  get formSelector() {
    const id = this.dataset.productId;
    const scope = productScope(this);
    const form = scope.querySelector(`product-form-component[data-product-id="${CSS.escape(id || '')}"]`);
    return /** @type {any} */ (form?.querySelector('quantity-selector-component') || null);
  }

  #sync = () => {
    const value = this.querySelector('input')?.value;
    const target = this.formSelector;
    if (!value || !target?.setValue) return;
    target.setValue(value);
    target.updateButtonStates?.();
  };
}

if (!customElements.get('yv-quantity-component')) customElements.define('yv-quantity-component', YvQuantityComponent);

/* ------------------------------------------------------------------ terms */

/**
 * Terms and conditions checkbox. While unchecked, the closest product form carries
 * data-yv-terms-pending: add to cart and dynamic checkout clicks are stopped (window capture
 * runs before Horizon's document-level handlers) and the message is shown.
 *
 * @typedef {{ checkbox: HTMLInputElement, error: HTMLElement }} TermsRefs
 * @extends {Component<TermsRefs>}
 */
class YvTermsComponent extends Component {
  requiredRefs = ['checkbox', 'error'];

  connectedCallback() {
    super.connectedCallback();
    this.update();
  }

  get form() {
    return this.closest('product-form-component');
  }

  update() {
    const pending = !this.refs.checkbox.checked;
    this.form?.toggleAttribute('data-yv-terms-pending', pending);
    if (!pending) this.refs.error.hidden = true;
  }

  warn() {
    this.refs.error.hidden = false;
    this.refs.checkbox.focus();
  }
}

if (!customElements.get('yv-terms-component')) {
  customElements.define('yv-terms-component', YvTermsComponent);

  /** @param {Event} event */
  const guard = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const form = target.closest('product-form-component[data-yv-terms-pending]');
    if (!form) return;
    const isSubmit = event.type === 'submit';
    const isBuyClick =
      event.type === 'click' &&
      target.closest('.add-to-cart-button, [name="add"], .accelerated-checkout-block, .shopify-payment-button');
    if (!isSubmit && !isBuyClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    /** @type {any} */ (form.querySelector('yv-terms-component'))?.warn();
  };
  window.addEventListener('click', guard, true);
  window.addEventListener('submit', guard, true);
}

/* ------------------------------------------------------------------ short videos */

/** Story circles: the clicked circle gets the gradient ring until another one is clicked. */
class YvShortVideosComponent extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.#onClick);
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest('.yv-short-videos__item');
    if (!item || !target?.closest('.yv-video-modal__trigger')) return;
    for (const other of this.querySelectorAll('.yv-short-videos__item')) {
      other.classList.toggle('is-active', other === item);
    }
  };
}

if (!customElements.get('yv-short-videos-component')) {
  customElements.define('yv-short-videos-component', YvShortVideosComponent);
}

/* ------------------------------------------------------------------ featured product media */

/**
 * Fade slider of the featured product section: slides share one grid cell and cross-fade;
 * thumbnails, dots (phones) and arrows select; ←/→ move while focus is inside. The section is
 * re-rendered on variant change, which starts it on the variant's media (data-index).
 * Image slides open Horizon's <zoom-dialog> through their declarative on:click.
 *
 * @typedef {{ slides: HTMLElement[], thumbs?: HTMLElement[], dots?: HTMLElement[] }} FeaturedMediaRefs
 * @extends {Component<FeaturedMediaRefs>}
 */
class YvFeaturedMediaComponent extends Component {
  #index = 0;

  connectedCallback() {
    super.connectedCallback();
    this.#index = Number(this.dataset.index) || 0;
    this.addEventListener('keydown', this.#onKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.#onKeydown);
  }

  get slides() {
    return this.refs.slides || [];
  }

  /** @param {number | string} index */
  select(index) {
    const count = this.slides.length;
    if (!count) return;
    const next = ((Number(index) % count) + count) % count;
    this.#index = next;
    this.dataset.index = String(next);
    this.slides.forEach((slide, i) => {
      const active = i === next;
      slide.classList.toggle('is-active', active);
      slide.toggleAttribute('inert', !active);
      if (active) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', 'true');
      if (!active) slide.querySelectorAll('video').forEach((video) => video.pause());
    });
    [...(this.refs.thumbs || []), ...(this.refs.dots || [])].forEach((control) => {
      const i = [...control.parentElement.children].indexOf(control);
      control.classList.toggle('is-active', i === next);
      if (i === next) control.setAttribute('aria-current', 'true');
      else control.removeAttribute('aria-current');
    });
  }

  next() {
    this.select(this.#index + 1);
  }

  previous() {
    this.select(this.#index - 1);
  }

  /** @param {KeyboardEvent} event */
  #onKeydown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const rtl = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    if (event.key === 'ArrowRight') this.select(this.#index + rtl);
    else if (event.key === 'ArrowLeft') this.select(this.#index - rtl);
    else return;
    event.preventDefault();
  };
}

if (!customElements.get('yv-featured-media-component')) {
  customElements.define('yv-featured-media-component', YvFeaturedMediaComponent);
}

/* ------------------------------------------------------------------ recently viewed */

/** @returns {Array<{ id: string, handle: string }>} */
function readViewed() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list.filter((item) => item && item.id && item.handle) : [];
  } catch {
    return [];
  }
}

/**
 * Remembers a viewed product (newest first, de-duplicated, at most 12).
 * @param {{ id: string | number, handle: string }} product
 */
export function addRecentlyViewed(product) {
  if (!product?.id || !product.handle) return;
  const id = String(product.id);
  const list = [{ id, handle: product.handle }, ...readViewed().filter((item) => item.id !== id)].slice(0, MAX_STORED);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage disabled: nothing is remembered */
  }
}

for (const script of document.querySelectorAll('script[data-yv-recently-viewed]')) {
  try {
    addRecentlyViewed(JSON.parse(script.textContent || '{}'));
  } catch (error) {
    warn(error);
  }
}

/**
 * Renders the visitor's recently viewed products. Each product's card is rendered by the helper
 * section `yv-recently-viewed-item` on that product's URL (Section Rendering API, by file name),
 * so it works on every template. The element (the section's container) stays hidden while nothing
 * else was viewed; in the theme editor the placeholder cards stay until real cards arrive.
 */
class YvRecentlyViewedComponent extends Component {
  #loaded = false;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#loaded) this.#load().catch(warn);
  }

  async #load() {
    this.#loaded = true;
    const current = this.dataset.currentProduct || '';
    const limit = Number(this.dataset.limit) || 10;
    const items = readViewed()
      .filter((item) => item.id !== current)
      .slice(0, limit);
    if (!items.length) return;

    const root = (window.Shopify?.routes?.root || '/').replace(/\/?$/, '/');
    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const url = `${root}products/${encodeURIComponent(item.handle)}?section_id=${this.dataset.itemSection}`;
          const response = await fetch(url);
          if (!response.ok) return null;
          const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
          return doc.querySelector('[data-yv-rv-item]');
        } catch (error) {
          warn(error);
          return null;
        }
      })
    );

    const cards = results.filter((card) => card instanceof Element);
    const track = this.querySelector('.yv-carousel__track');
    if (!cards.length || !track) return;

    const slides = cards.map((card) => {
      const slide = document.createElement('div');
      slide.className = 'yv-recently-viewed__item';
      slide.append(...card.childNodes);
      return slide;
    });
    track.replaceChildren(...slides);
    this.hidden = false;
    this.dataset.loaded = 'true';
    /** @type {any} */ (this.querySelector('yv-carousel'))?.refresh?.();
  }
}

if (!customElements.get('yv-recently-viewed-component')) {
  customElements.define('yv-recently-viewed-component', YvRecentlyViewedComponent);
}
