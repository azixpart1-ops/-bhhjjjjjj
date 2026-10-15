import { Component } from '@theme/component';
import { isClickedOutside, mediaQueryLarge } from '@theme/utilities';

/** @type {YvHotspot | null} */
let openHotspot = null;

const OPEN_DELAY = 140;
const CLOSE_DELAY = 220;

/**
 * Pulsing hotspot dot positioned by x/y % on media, opening a product card (or any content) popover.
 * Used by media grids, Shop the look and lookbooks. Markup: snippets/yv-hotspot.liquid.
 *
 * - Desktop (750px+, fine pointer): hovering the dot (140ms intent) or clicking it opens the popover
 *   beside the dot (data-side="right|left|auto"); it flips to stay inside the media and closes on
 *   pointer leave (220ms grace), outside click or Escape. One popover is open at a time.
 * - Mobile / touch: data-mobile-action="quick-view" opens Horizon's quick view for the product;
 *   "sheet" opens the popover as a modal bottom sheet (native <dialog>, Escape and backdrop close).
 * - Theme editor: selecting the hotspot's block opens it; deselecting closes it.
 *
 * Markup contract:
 * <yv-hotspot class="yv-hotspot" data-side="right" data-mobile-action="quick-view|sheet" style="--yv-hotspot-x:40%;--yv-hotspot-y:30%">
 *   <button type="button" class="yv-hotspot__dot" ref="trigger" aria-expanded="false" aria-controls="ID" on:click="yv-hotspot/toggle">…</button>
 *   <dialog class="yv-hotspot__popover" id="ID" ref="popover">…<button ref="close" on:click="yv-hotspot/close">×</button>…</dialog>
 *   [<yv-quick-view-component ref="quickView" …>…</yv-quick-view-component>]  (inside the popover)
 * </yv-hotspot>
 *
 * Emits bubbling `yv-hotspot:open` / `yv-hotspot:close` events.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement} trigger
 * @property {HTMLDialogElement} popover
 *
 * @extends {Component<Refs>}
 */
export class YvHotspot extends Component {
  requiredRefs = ['trigger', 'popover'];

  /** @type {AbortController | null} */
  #controller = null;
  /** @type {AbortController | null} */
  #openController = null;
  /** @type {number | undefined} */
  #openTimer;
  /** @type {number | undefined} */
  #closeTimer;
  /** Opened (or pinned) by a click or key press rather than by hover. */
  #pinned = false;

  connectedCallback() {
    super.connectedCallback();
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    const { trigger, popover } = this.refs;

    trigger.addEventListener('pointerenter', this.#handlePointerEnter, { signal });
    trigger.addEventListener('pointerleave', this.#handlePointerLeave, { signal });
    popover.addEventListener('pointerenter', this.#cancelClose, { signal });
    popover.addEventListener('pointerleave', this.#handlePointerLeave, { signal });
    popover.addEventListener('close', this.#handleNativeClose, { signal });
    popover.addEventListener('click', this.#handlePopoverClick, { signal });
    document.addEventListener('shopify:block:select', this.#handleBlockSelect, { signal });
    document.addEventListener('shopify:block:deselect', this.#handleBlockDeselect, { signal });
    mediaQueryLarge.addEventListener('change', this.#handleBreakpoint, { signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
    this.#clearTimers();
    if (openHotspot === this) openHotspot = null;
    this.#openController?.abort();
  }

  get isOpen() {
    return this.hasAttribute('open');
  }

  /** True when hover/popover behaviour applies (desktop with a fine pointer). */
  get #desktop() {
    return mediaQueryLarge.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  /**
   * Toggles the popover. Declarative use: on:click="yv-hotspot/toggle".
   * @param {Event} [event]
   */
  toggle(event) {
    event?.preventDefault?.();

    if (!this.#desktop && this.dataset.mobileAction === 'quick-view' && this.#openQuickView()) return;

    if (this.isOpen) {
      // A mouse click on a card that hover just opened pins it instead of closing it.
      if (this.#desktop && !this.#pinned && event instanceof Event && /** @type {MouseEvent} */ (event).detail > 0) {
        this.#pinned = true;
        this.#cancelClose();
        return;
      }
      this.close();
    } else {
      this.open();
      this.#pinned = true;
    }
  }

  /**
   * Opens the popover (or the bottom sheet on mobile).
   * @param {{ hover?: boolean }} [options] - hover: opened by the pointer, so focus stays where it was.
   */
  open(options) {
    this.#clearTimers();
    if (this.isOpen) return;
    this.#pinned = false;

    if (openHotspot && openHotspot !== this) openHotspot.close();
    openHotspot = this;

    const { popover, trigger } = this.refs;
    const modal = !this.#desktop;
    this.toggleAttribute('data-sheet', modal);

    if (modal) {
      popover.showModal();
    } else {
      const previousFocus = document.activeElement;
      popover.show();
      // dialog.show() moves focus into the card; a hover open must not steal focus.
      if (options?.hover && popover.contains(document.activeElement)) {
        if (previousFocus instanceof HTMLElement && previousFocus !== document.body) {
          previousFocus.focus({ preventScroll: true });
        } else if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      this.#place();
    }

    this.setAttribute('open', '');
    trigger.setAttribute('aria-expanded', 'true');

    this.#openController?.abort();
    this.#openController = new AbortController();
    const { signal } = this.#openController;
    document.addEventListener('keydown', this.#handleKeydown, { signal });
    document.addEventListener('click', this.#handleDocumentClick, { signal, capture: true });

    this.dispatchEvent(new CustomEvent('yv-hotspot:open', { bubbles: true }));
  }

  /**
   * Closes the popover. Declarative use: on:click="yv-hotspot/close".
   * @param {Event | { focusTrigger?: boolean }} [eventOrOptions]
   */
  close(eventOrOptions) {
    this.#clearTimers();
    if (!this.isOpen) return;

    const { popover, trigger } = this.refs;
    const focusTrigger =
      eventOrOptions instanceof Event ? true : Boolean(eventOrOptions && eventOrOptions.focusTrigger);
    const hadFocus = popover.contains(document.activeElement);

    this.removeAttribute('open');
    trigger.setAttribute('aria-expanded', 'false');
    this.#openController?.abort();
    this.#openController = null;
    if (openHotspot === this) openHotspot = null;

    if (popover.open) popover.close();
    this.removeAttribute('data-sheet');
    if (focusTrigger || hadFocus) trigger.focus({ preventScroll: true });

    this.dispatchEvent(new CustomEvent('yv-hotspot:close', { bubbles: true }));
  }

  #openQuickView() {
    const quickView = this.querySelector('yv-quick-view-component');
    if (!quickView || typeof (/** @type {any} */ (quickView).handleClick) !== 'function') return false;
    /** @type {any} */ (quickView).handleClick(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }

  /** Positions the desktop popover beside the dot, inside the media container. */
  #place() {
    const { popover, trigger } = this.refs;
    const container = /** @type {HTMLElement} */ (
      this.closest('[data-yv-hotspot-container]') || this.offsetParent || this.parentElement || document.body
    );
    const preferred = this.dataset.side === 'left' ? 'left' : 'right';

    popover.style.removeProperty('--yv-hotspot-shift-y');
    popover.dataset.side = preferred;

    const box = container.getBoundingClientRect();
    const dot = trigger.getBoundingClientRect();
    const card = popover.getBoundingClientRect();
    const gap = 28;

    const roomRight = box.right - dot.right - gap;
    const roomLeft = dot.left - box.left - gap;
    let side = preferred;
    if (preferred === 'right' && roomRight < card.width && roomLeft > roomRight) side = 'left';
    if (preferred === 'left' && roomLeft < card.width && roomRight > roomLeft) side = 'right';
    // Hotspot coordinates are physical (they follow the image, which does not mirror in RTL).
    popover.dataset.side = side;

    // Keep the card inside the container vertically.
    const centre = dot.top + dot.height / 2;
    const top = centre - card.height / 2;
    const bottom = centre + card.height / 2;
    let shift = 0;
    if (top < box.top + 8) shift = box.top + 8 - top;
    else if (bottom > box.bottom - 8) shift = box.bottom - 8 - bottom;
    if (shift) popover.style.setProperty('--yv-hotspot-shift-y', `${Math.round(shift)}px`);
  }

  #clearTimers() {
    window.clearTimeout(this.#openTimer);
    window.clearTimeout(this.#closeTimer);
    this.#openTimer = undefined;
    this.#closeTimer = undefined;
  }

  #cancelClose = () => {
    window.clearTimeout(this.#closeTimer);
    this.#closeTimer = undefined;
  };

  /** @param {PointerEvent} event */
  #handlePointerEnter = (event) => {
    if (event.pointerType !== 'mouse' || !this.#desktop) return;
    this.#cancelClose();
    if (this.isOpen) return;
    window.clearTimeout(this.#openTimer);
    this.#openTimer = window.setTimeout(() => this.open({ hover: true }), OPEN_DELAY);
  };

  /** @param {PointerEvent} event */
  #handlePointerLeave = (event) => {
    if (event.pointerType !== 'mouse' || !this.#desktop) return;
    window.clearTimeout(this.#openTimer);
    this.#openTimer = undefined;
    const next = event.relatedTarget;
    if (next instanceof Node && (this.refs.popover.contains(next) || this.refs.trigger.contains(next))) return;
    if (!this.isOpen || this.#pinned || this.hasAttribute('data-editor-open')) return;
    window.clearTimeout(this.#closeTimer);
    this.#closeTimer = window.setTimeout(() => this.close(), CLOSE_DELAY);
  };

  /** @param {KeyboardEvent} event */
  #handleKeydown = (event) => {
    if (event.key !== 'Escape' || !this.isOpen) return;
    event.preventDefault();
    this.close({ focusTrigger: true });
  };

  /** @param {MouseEvent} event */
  #handleDocumentClick = (event) => {
    if (!this.isOpen || this.hasAttribute('data-sheet')) {
      // The bottom sheet closes through its own backdrop click below.
      if (this.hasAttribute('data-sheet') && event.target === this.refs.popover && isClickedOutside(event, this.refs.popover)) {
        this.close();
      }
      return;
    }
    const target = event.target;
    if (target instanceof Node && this.contains(target)) return;
    this.close();
  };

  /** Quick view opens its own modal: close this card first so the two never stack. @param {MouseEvent} event */
  #handlePopoverClick = (event) => {
    if (event.target instanceof Element && event.target.closest('yv-quick-view-component')) {
      queueMicrotask(() => this.close());
    }
  };

  #handleNativeClose = () => {
    // Escape on the modal sheet closes the <dialog> natively; keep our state in sync.
    if (this.isOpen) this.close();
  };

  #handleBreakpoint = () => {
    if (this.isOpen) this.close();
  };

  /** @param {Event} event */
  #handleBlockSelect = (event) => {
    if (!(event.target instanceof Element) || !this.contains(event.target)) return;
    this.setAttribute('data-editor-open', '');
    if (this.#desktop) this.open();
  };

  /** @param {Event} event */
  #handleBlockDeselect = (event) => {
    if (!(event.target instanceof Element) || !this.contains(event.target)) return;
    this.removeAttribute('data-editor-open');
    this.close();
  };
}

if (!customElements.get('yv-hotspot')) {
  customElements.define('yv-hotspot', YvHotspot);
}
