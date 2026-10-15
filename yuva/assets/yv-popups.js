import { Component } from '@theme/component';
import { DialogComponent, DialogCloseEvent, DialogOpenEvent } from '@theme/dialog';
import { debounce, isTouchDevice } from '@theme/utilities';

/*
 * Yuva edge popups (footer group and static sections):
 * - <yv-sidebar-offer-component>   sections/yv-sidebar-offer.liquid   coupon stamp + offer panel (native popover)
 * - <yv-newsletter-popup-component> sections/yv-newsletter-popup.liquid automatic popup / icon popup (modal dialog)
 * - <yv-side-drawer-component>     sections/yv-side-drawer.liquid     edge tab + large right drawer (modal dialog)
 *
 * Every component opens when its section (or one of its blocks) is selected in the theme editor and
 * closes on deselect.
 */

const isDesignMode = () => Boolean(window.Shopify?.designMode);

/**
 * Returns the focused element worth giving focus back to after a dialog closes.
 * @returns {HTMLElement | null}
 */
function currentFocus() {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Edge widgets are hidden while a modal is open, so the browser cannot always restore focus to
 * the element that opened it. Put it back once the dialog has closed.
 * @param {HTMLElement | null} opener
 * @param {Element} dialog - The closed dialog (focus may still sit on one of its descendants).
 */
function restoreFocus(opener, dialog) {
  requestAnimationFrame(() => {
    if (!opener?.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body && !dialog.contains(active)) return;
    opener.focus({ preventScroll: true });
  });
}

/**
 * Calls `onSelect` / `onDeselect` for theme editor selections inside the given section.
 * @param {HTMLElement} element - Element carrying `data-section-id`.
 * @param {AbortSignal} signal
 * @param {(event: CustomEvent) => void} onSelect
 * @param {(event: CustomEvent) => void} onDeselect
 */
function listenToEditor(element, signal, onSelect, onDeselect) {
  if (!isDesignMode()) return;

  /** @param {Event} event */
  const matches = (event) =>
    event instanceof CustomEvent && event.detail?.sectionId && event.detail.sectionId === element.dataset.sectionId;

  /** @param {Event} event */
  const select = (event) => {
    if (matches(event)) onSelect(/** @type {CustomEvent} */ (event));
  };
  /** @param {Event} event */
  const deselect = (event) => {
    if (matches(event)) onDeselect(/** @type {CustomEvent} */ (event));
  };

  document.addEventListener('shopify:section:select', select, { signal });
  document.addEventListener('shopify:block:select', select, { signal });
  document.addEventListener('shopify:section:deselect', deselect, { signal });
}

/* ------------------------------------------------------------------------------------------ */
/* Sidebar offer                                                                              */
/* ------------------------------------------------------------------------------------------ */

/**
 * @typedef {{ trigger: HTMLButtonElement, panel: HTMLElement, track: HTMLElement,
 *   previous?: HTMLButtonElement, next?: HTMLButtonElement }} SidebarOfferRefs
 * @extends {Component<SidebarOfferRefs>}
 */
class YvSidebarOfferComponent extends Component {
  requiredRefs = ['trigger', 'panel', 'track'];

  /** @type {AbortController | undefined} */
  #controller;

  #restoreFocus = false;

  connectedCallback() {
    super.connectedCallback();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    const { panel, track } = this.refs;

    panel.addEventListener('toggle', this.#handleToggle, { signal });
    document.addEventListener('keydown', this.#handleKeydown, { signal });
    panel.addEventListener('click', this.#handleClick, { signal });
    track.addEventListener('scroll', this.#updateNavigation, { signal, passive: true });
    window.addEventListener('resize', this.#handleResize, { signal });

    listenToEditor(
      this,
      signal,
      (event) => {
        this.open();
        const blockId = event.type === 'shopify:block:select' ? event.detail?.blockId : null;
        if (blockId) this.#showBlock(blockId);
      },
      () => this.close()
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
  }

  get isOpen() {
    return this.refs.panel.matches(':popover-open');
  }

  open() {
    if (!this.isOpen) this.refs.panel.showPopover?.();
  }

  close() {
    if (this.isOpen) this.refs.panel.hidePopover?.();
  }

  previous() {
    this.#step(-1);
  }

  next() {
    this.#step(1);
  }

  /** @param {number} direction */
  #step(direction) {
    const { track } = this.refs;
    const rtl = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
    track.scrollBy({ left: direction * rtl * track.clientWidth });
  }

  /** @param {string} blockId */
  #showBlock(blockId) {
    const { track } = this.refs;
    const slide = [...track.children].find(
      (child) => child instanceof HTMLElement && child.dataset.shopifyEditorBlock?.includes(blockId)
    );
    if (!(slide instanceof HTMLElement)) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: 'instant' });
  }

  /** @param {Event} event */
  #handleToggle = (event) => {
    if (/** @type {ToggleEvent} */ (event).newState === 'open') {
      this.#restoreFocus = false;
      this.#place();
      this.#updateNavigation();
      // The stamp fades out (visibility: hidden) while the panel is open, which would drop keyboard
      // focus to <body>: when the visitor opened it from the stamp, move focus into the panel.
      if (document.activeElement === this.refs.trigger) this.#focusPanel();
      return;
    }

    // The stamp is hidden while the panel is open, so the browser cannot hand focus back to it.
    if (this.#restoreFocus) {
      this.#restoreFocus = false;
      requestAnimationFrame(() => this.refs.trigger.focus({ preventScroll: true }));
    }
  };

  /** @param {KeyboardEvent} event */
  #handleKeydown = (event) => {
    if (event.key === 'Escape' && this.isOpen) this.#restoreFocus = true;
  };

  /** @param {MouseEvent} event */
  #handleClick = (event) => {
    if (event.target instanceof Element && event.target.closest('[popovertargetaction="hide"]')) {
      this.#restoreFocus = true;
    }
  };

  #handleResize = debounce(() => {
    if (this.isOpen) this.#place();
  }, 100);

  /** Focuses the first control of the open panel (its close button), or the panel itself. */
  #focusPanel() {
    const { panel } = this.refs;
    const target = panel.querySelector('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    (target instanceof HTMLElement ? target : panel).focus({ preventScroll: true });
  }

  /** Keeps the panel beside the stamp but inside the viewport (bottom offset in % of the viewport). */
  #place() {
    const { panel } = this.refs;
    const edge = parseFloat(getComputedStyle(this).getPropertyValue('--yv-offer-edge')) || 20;
    const offset = Number(getComputedStyle(this).getPropertyValue('--yv-offer-y')) || 0;
    const viewport = window.innerHeight;
    const height = panel.offsetHeight;
    const bottom = Math.max(edge, Math.min((viewport * offset) / 100, viewport - height - edge));
    panel.style.setProperty('--yv-offer-panel-bottom', `${Math.round(bottom)}px`);
  }

  #updateNavigation = () => {
    const { track, previous, next } = this.refs;
    if (!previous || !next) return;
    const max = track.scrollWidth - track.clientWidth;
    const position = Math.abs(track.scrollLeft);
    previous.disabled = position <= 2;
    next.disabled = position >= max - 2;
  };
}

if (!customElements.get('yv-sidebar-offer-component')) {
  customElements.define('yv-sidebar-offer-component', YvSidebarOfferComponent);
}

/* ------------------------------------------------------------------------------------------ */
/* Newsletter popup                                                                           */
/* ------------------------------------------------------------------------------------------ */

const NEWSLETTER_COOKIE = 'yv_newsletter_closed';

/**
 * True while something the automatic popup must never cover is on screen: the age gate until the
 * visitor approves it (the element is removed then, or never rendered once `yv_age_verified` is
 * set), another modal dialog (quick view, search, cart drawer…) or Horizon's menu drawer.
 * @param {Element} self - The popup component (its own dialog never blocks it).
 */
function isScreenBusy(self) {
  if (document.querySelector('yv-age-gate, details.menu-drawer-container[open], .page-wrapper--drawer-open')) return true;
  return [...document.querySelectorAll('dialog[open]')].some((dialog) => dialog.matches(':modal') && !self.contains(dialog));
}

/** @param {string} name */
function readCookie(name) {
  try {
    return document.cookie.split('; ').some((entry) => entry.startsWith(`${name}=`));
  } catch {
    return false;
  }
}

/**
 * @param {string} name
 * @param {number} days
 */
function writeCookie(name, days) {
  try {
    const maxAge = Math.max(1, Math.round(days * 86400));
    document.cookie = `${name}=1; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {
    /* cookies blocked: the popup simply shows again next time */
  }
}

/**
 * Newsletter popup. `data-mode="auto"`: Theme settings > Newsletter popup, opens after
 * `data-delay` seconds unless the visitor closed it or subscribed in the last `data-days` days
 * (cookie `yv_newsletter_closed`). `data-mode="manual"`: opened by the floating newsletter icon
 * (on:click="#id/open"), no cookie. Both reopen after Shopify reloads the page following a
 * sign-up to show the success or error message (`location.hash` is the form id).
 *
 * @typedef {{ dialog: HTMLDialogElement }} NewsletterRefs
 * @extends {DialogComponent}
 */
class YvNewsletterPopupComponent extends DialogComponent {
  /** @type {number | undefined} */
  #timer;

  /** @type {AbortController | undefined} */
  #controller;

  #userInitiated = false;

  /** @type {HTMLElement | null} */
  #opener = null;

  connectedCallback() {
    super.connectedCallback();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.addEventListener(DialogOpenEvent.eventName, this.#handleOpen, { signal });
    this.addEventListener(DialogCloseEvent.eventName, this.#handleClose, { signal });

    listenToEditor(
      this,
      signal,
      () => {
        // With the newsletter icon on, selecting the section previews the icon popup only.
        if (this.isAuto && this.#hasIconPopup) return;
        this.open();
      },
      () => this.closeDialog()
    );

    const formId = this.dataset.formId;
    const posted = Boolean(formId) && window.location.hash === `#${formId}`;

    if (posted) {
      if (this.isAuto && /[?&]customer_posted=true/.test(window.location.search)) {
        writeCookie(NEWSLETTER_COOKIE, this.days);
      }
      this.showDialog();
      return;
    }

    if (!this.isAuto) return;

    if (isDesignMode()) {
      // Theme editor: show the automatic popup once per editor session so it can be styled.
      const key = `yv-newsletter-popup-${this.dataset.sectionId}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch {
        /* storage blocked */
      }
      this.showDialog();
      return;
    }

    if (readCookie(NEWSLETTER_COOKIE)) return;

    this.#scheduleAuto(this.delay * 1000);
  }

  /**
   * Opens the automatic popup after `ms`. It never stacks on the age gate or another modal: while
   * one is open it checks again every second, and once it has closed it waits two more seconds.
   * A declined age gate stays on the page, so the popup then never opens.
   * @param {number} ms
   * @param {boolean} [waited] - The previous check found the screen busy.
   */
  #scheduleAuto(ms, waited = false) {
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      if (isScreenBusy(this)) {
        this.#scheduleAuto(1000, true);
      } else if (waited) {
        this.#scheduleAuto(2000);
      } else {
        this.showDialog();
      }
    }, ms);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.#timer);
    this.#controller?.abort();
  }

  get isAuto() {
    return this.dataset.mode === 'auto';
  }

  get #hasIconPopup() {
    const selector = `yv-newsletter-popup-component[data-mode="manual"][data-section-id="${CSS.escape(this.dataset.sectionId ?? '')}"]`;
    return Boolean(document.querySelector(selector));
  }

  get delay() {
    return Math.max(0, Number(this.dataset.delay) || 0);
  }

  get days() {
    return Math.max(1, Number(this.dataset.days) || 1);
  }

  showDialog() {
    this.#opener = currentFocus();
    super.showDialog();
  }

  /** Opened by the visitor (newsletter icon). */
  open() {
    this.#userInitiated = true;
    window.clearTimeout(this.#timer);
    this.showDialog();
  }

  #handleOpen = () => {
    const { dialog } = /** @type {NewsletterRefs} */ (/** @type {unknown} */ (this.refs));
    const input = dialog.querySelector('input[type="email"]');
    const focusInput = this.#userInitiated || !isTouchDevice();
    // On touch devices an automatic popup must not pop the keyboard up: focus the dialog itself.
    const target = focusInput && input instanceof HTMLInputElement ? input : dialog;
    target.focus({ preventScroll: true });
    this.toggleAttribute('data-open', true);
  };

  #handleClose = () => {
    this.#userInitiated = false;
    this.toggleAttribute('data-open', false);
    if (this.isAuto && !isDesignMode()) writeCookie(NEWSLETTER_COOKIE, this.days);
    restoreFocus(this.#opener, this.refs.dialog);
  };
}

if (!customElements.get('yv-newsletter-popup-component')) {
  customElements.define('yv-newsletter-popup-component', YvNewsletterPopupComponent);
}

/* ------------------------------------------------------------------------------------------ */
/* Side drawer                                                                                */
/* ------------------------------------------------------------------------------------------ */

/**
 * Edge tab + large right drawer. The fixed tab hides while the drawer is open and a copy of it,
 * attached to the panel's edge, closes it. Videos in the drawer play only while it is open.
 *
 * @typedef {{ dialog: HTMLDialogElement, tab: HTMLButtonElement, body?: HTMLElement }} SideDrawerRefs
 * @extends {DialogComponent}
 */
class YvSideDrawerComponent extends DialogComponent {
  /** @type {AbortController | undefined} */
  #controller;

  /** @type {HTMLElement | null} */
  #opener = null;

  showDialog() {
    this.#opener = currentFocus();
    super.showDialog();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.addEventListener(DialogOpenEvent.eventName, this.#handleOpen, { signal });
    this.addEventListener(DialogCloseEvent.eventName, this.#handleClose, { signal });

    listenToEditor(
      this,
      signal,
      (event) => {
        this.showDialog();
        const blockId = event.type === 'shopify:block:select' ? event.detail?.blockId : null;
        if (blockId) {
          window.setTimeout(() => {
            const block = this.querySelector(`[data-shopify-editor-block*="${CSS.escape(blockId)}"]`);
            block?.scrollIntoView({ block: 'nearest' });
          }, 350);
        }
      },
      () => this.closeDialog()
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
  }

  #handleOpen = () => {
    const { tab } = /** @type {SideDrawerRefs} */ (/** @type {unknown} */ (this.refs));
    tab?.setAttribute('aria-expanded', 'true');
    this.toggleAttribute('data-open', true);
    for (const video of this.querySelectorAll('video[data-autoplay]')) {
      if (!(video instanceof HTMLVideoElement)) continue;
      video.muted = true;
      video.play().catch(() => {});
    }
  };

  #handleClose = () => {
    const { tab } = /** @type {SideDrawerRefs} */ (/** @type {unknown} */ (this.refs));
    tab?.setAttribute('aria-expanded', 'false');
    this.toggleAttribute('data-open', false);
    for (const video of this.querySelectorAll('video')) {
      if (video instanceof HTMLVideoElement) video.pause();
    }
    restoreFocus(this.#opener ?? tab ?? null, this.refs.dialog);
  };
}

if (!customElements.get('yv-side-drawer-component')) {
  customElements.define('yv-side-drawer-component', YvSideDrawerComponent);
}
