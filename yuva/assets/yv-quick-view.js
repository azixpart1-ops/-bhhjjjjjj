import { QuickAddComponent } from '@theme/quick-add';

/**
 * Opens Horizon's quick view (the quick-add modal, #quick-add-dialog) for any product, outside a
 * product card. Horizon's QuickAddComponent resolves the product URL only from a surrounding
 * <product-card> or product hotspot; this subclass reads it from data-product-url instead.
 *
 * Markup contract (snippets/yv-quick-view-button.liquid):
 * <yv-quick-view-component data-product-url="/products/x" data-product-title="X" data-product-id="1"
 *   data-quick-add-button="choose" data-product-options-count="2" data-uses-selling-plans="false">
 *   <button type="button" aria-haspopup="dialog" on:click="/handleClick">Quick view</button>
 * </yv-quick-view-component>
 *
 * Programmatic open: element.handleClick(new MouseEvent('click', { cancelable: true })).
 * Adding to cart inside the modal keeps Horizon's contract (product-form-component, cart events,
 * drawer auto-open, modal close).
 */
export class YvQuickViewComponent extends QuickAddComponent {
  get productPageUrl() {
    const { productUrl } = this.dataset;
    if (!productUrl) return '';
    try {
      return new URL(productUrl, window.location.origin).href;
    } catch {
      return '';
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('pointerenter', this.#prefetch, { once: true });
    this.addEventListener('focusin', this.#prefetch, { once: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('pointerenter', this.#prefetch);
    this.removeEventListener('focusin', this.#prefetch);
  }

  /** Warms the product page on desktop hover/focus, like Horizon's product cards do. */
  #prefetch = () => {
    if (!window.matchMedia('(min-width: 750px)').matches) return;
    this.fetchProductPage(this.productPageUrl).catch(() => {});
  };
}

if (!customElements.get('yv-quick-view-component')) {
  customElements.define('yv-quick-view-component', YvQuickViewComponent);
}

/* ------------------------------------------------------------------ */
/* Quick view modal enhancements                                       */
/* ------------------------------------------------------------------ */

/**
 * When Horizon's quick-add modal opens, turn its media into the Yuva gallery (a horizontal slider with
 * arrows and, from 750px, a thumbnail row) and add share links under the buy buttons. Everything is
 * added inside Horizon's own <slideshow-component> with its standard refs (previous, next,
 * thumbnails[]), so slide selection, disabled states and aria-selected come from slideshow.js.
 * The parts are cloned from <template id="YvQuickViewParts"> (snippets/quick-add-modal.liquid).
 */
const dialogComponent = document.getElementById('quick-add-dialog');

/** @param {string} part */
function cloneQuickViewPart(part) {
  const template = /** @type {HTMLTemplateElement | null} */ (document.getElementById('YvQuickViewParts'));
  const node = template?.content.querySelector(`[data-yv-part="${part}"]`);
  return node ? /** @type {HTMLElement} */ (node.cloneNode(true)) : null;
}

/**
 * @param {HTMLElement} dialog
 * @param {HTMLElement} slideshow
 */
function enhanceGallery(dialog, slideshow) {
  const slides = /** @type {HTMLElement[]} */ (
    [...slideshow.querySelectorAll(':scope > slideshow-container > slideshow-slides > slideshow-slide')].filter(
      (slide) => !slide.hasAttribute('hidden')
    )
  );
  slideshow.toggleAttribute('data-yv-single', slides.length < 2);
  if (slides.length < 2) return;

  const container = slideshow.querySelector(':scope > slideshow-container');
  if (container && !container.querySelector(':scope > .yv-qv-arrows')) {
    const arrows = document.createElement('div');
    arrows.className = 'yv-qv-arrows';
    for (const action of ['previous', 'next']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `yv-carousel__arrow yv-carousel__arrow--${action === 'previous' ? 'prev' : 'next'}`;
      button.setAttribute('ref', action);
      button.setAttribute('on:click', `/${action}`);
      button.setAttribute(
        'aria-label',
        (action === 'previous' ? dialog.dataset.yvPrevLabel : dialog.dataset.yvNextLabel) || action
      );
      const icon = cloneQuickViewPart('arrow');
      if (icon) button.append(icon);
      arrows.append(button);
    }
    container.append(arrows);
  }

  if (!slideshow.querySelector(':scope > .yv-qv-thumbs')) {
    const thumbs = document.createElement('div');
    thumbs.className = 'yv-qv-thumbs';
    thumbs.setAttribute('ref', 'thumbnailsContainer');
    const labelTemplate = dialog.dataset.yvThumbLabel || '[index]';
    const current = Number(/** @type {any} */ (slideshow).current) || 0;

    slides.forEach((slide, index) => {
      const image = slide.querySelector('img');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'yv-qv-thumbs__item';
      button.setAttribute('ref', 'thumbnails[]');
      button.setAttribute('on:click', `/select/${index}`);
      button.setAttribute('aria-label', labelTemplate.replace('[index]', String(index + 1)));
      button.setAttribute('aria-selected', String(index === current));
      if (image) {
        const thumb = document.createElement('img');
        thumb.src = image.currentSrc || image.src;
        thumb.alt = '';
        thumb.loading = 'lazy';
        thumb.width = 58;
        thumb.height = 80;
        button.append(thumb);
      }
      thumbs.append(button);
    });

    slideshow.append(thumbs);
  }

  // Register the new refs now (rather than on the component's idle mutation observer) and let the
  // slideshow's own `current` setter paint the selected thumbnail and the arrow states.
  const component = /** @type {any} */ (slideshow);
  if (typeof component.updatedCallback === 'function') {
    component.updatedCallback();
    component.current = Number(component.current) || 0;
  }
}

/** @param {HTMLElement} content */
function addShareLinks(content) {
  const target = content.querySelector('.buy-buttons-block') || content.querySelector('product-form-component');
  if (!target || target.querySelector('.yv-qv-share')) return;

  const link = /** @type {HTMLAnchorElement | null} */ (
    content.querySelector('.view-product-title a, .product-header a')
  );
  if (!link?.href) return;

  const share = cloneQuickViewPart('share');
  if (!share) return;

  const url = encodeURIComponent(link.href.split('?')[0] || link.href);
  const title = encodeURIComponent((link.textContent || '').trim());
  share.querySelectorAll('a').forEach((anchor) => {
    anchor.href = anchor.href.replace('%5Burl%5D', url).replace('[url]', url).replace('%5Btitle%5D', title).replace('[title]', title);
  });
  target.append(share);
}

function enhanceQuickView() {
  const dialog = /** @type {HTMLElement | null} */ (dialogComponent?.querySelector('dialog'));
  const content = /** @type {HTMLElement | null} */ (document.getElementById('quick-add-modal-content'));
  if (!dialog || !content) return;

  const slideshow = /** @type {HTMLElement | null} */ (
    content.querySelector('.product-information__media slideshow-component')
  );
  if (slideshow) enhanceGallery(dialog, slideshow);
  addShareLinks(content);
}

dialogComponent?.addEventListener('dialog:open', enhanceQuickView);

// Variant changes replace the media gallery (media-gallery.js) and can re-render the buy buttons;
// re-apply the enhancements while the modal is open.
const quickViewContent = document.getElementById('quick-add-modal-content');
if (quickViewContent) {
  let frame = 0;
  new MutationObserver(() => {
    const dialog = dialogComponent?.querySelector('dialog');
    if (!dialog?.open || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      enhanceQuickView();
    });
  }).observe(quickViewContent, { childList: true, subtree: true });
}
