import { Component } from '@theme/component';

/**
 * Yuva behaviours on top of Horizon's header (`#header-component`, header.js, header-menu.js,
 * header-drawer.js). Rendered once by sections/header.liquid as `<yv-header-component>` next to the
 * header; it never replaces Horizon's own logic.
 *
 * - Sticky "On scroll up": records the previous sticky state (`data-yv-sticky-from`) so the header
 *   slides away only when it was showing.
 * - "Open by: Click" menus (`header-menu[data-yv-open-by="click"]`): the top-level link toggles its
 *   submenu instead of navigating; a click outside closes it.
 * - Page overlay under open panels starts at the header's bottom edge (`--yv-overlay-top`).
 * - Menu drawer: "Menu / View catalog" switch, opening below the announcement bar
 *   (`--yv-drawer-offset`), and the desktop category button that opens the drawer on its catalog tab.
 * - Category dropdown: one open at a time, closes on outside click and Escape.
 * - Floating cart (`[data-yv-sticky-cart]`) once a non-sticky header leaves the viewport.
 * - Theme editor: selecting a mega menu or badge block opens / highlights its menu item.
 * - Search prompts (Theme settings > Search): rotates the search input placeholder.
 *
 * @extends {Component}
 */
class YvHeaderComponent extends Component {
  /** @type {AbortController | undefined} */
  #abort;

  /** @type {MutationObserver | undefined} */
  #stateObserver;

  /** @type {IntersectionObserver | undefined} */
  #cartObserver;

  /** @type {number | undefined} */

  /** @type {'menu' | 'catalog' | undefined} View requested for the next drawer opening. */
  #requestedTab;

  connectedCallback() {
    super.connectedCallback();
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    const header = this.header;
    if (!header) return;

    this.#watchStickyState(header);

    document.addEventListener('click', this.#onDocumentClick, { signal, capture: true });
    document.addEventListener('keydown', this.#onKeydown, { signal });
    header.addEventListener('toggle', this.#onDetailsToggle, { signal, capture: true });
    header.addEventListener('click', this.#onDrawerTabClick, { signal });

    this.#setupStickyCart(header);

    if (window.Shopify?.designMode) {
      document.addEventListener('shopify:block:select', this.#onBlockSelect, { signal });
      document.addEventListener('shopify:block:deselect', this.#onBlockDeselect, { signal });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#stateObserver?.disconnect();
    this.#cartObserver?.disconnect();
  }

  /** @returns {HTMLElement | null} */
  get header() {
    return document.getElementById('header-component');
  }

  /** @returns {HTMLElement | null} */
  get headerMenu() {
    return /** @type {HTMLElement | null} */ (this.header?.querySelector('header-menu') ?? null);
  }

  /* ------------------------------------------------------------ sticky state */

  /** @param {HTMLElement} header */
  #watchStickyState(header) {
    let previous = header.dataset.stickyState || 'inactive';
    this.#stateObserver = new MutationObserver(() => {
      const current = header.dataset.stickyState || 'inactive';
      if (current === previous) return;
      header.dataset.yvStickyFrom = previous;
      previous = current;
    });
    this.#stateObserver.observe(header, { attributes: true, attributeFilter: ['data-sticky-state'] });

    // Keep the page overlay below the header while a submenu is open.
    const menuObserver = new MutationObserver(() => this.#updateOverlayTop());
    const menu = this.headerMenu;
    if (menu) menuObserver.observe(menu, { attributes: true, attributeFilter: ['aria-expanded'] });
    this.#abort?.signal.addEventListener('abort', () => menuObserver.disconnect());
  }

  #updateOverlayTop() {
    const header = this.header;
    const section = header?.closest('.header-section');
    if (!(header instanceof HTMLElement) || !(section instanceof HTMLElement)) return;
    const bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
    section.style.setProperty('--yv-overlay-top', `${bottom}px`);
  }

  /* ------------------------------------------------------------ click menus */

  /**
   * @param {MouseEvent} event
   */
  #onDocumentClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Desktop category button that opens the menu drawer on its catalog tab.
    const catalogButton = target.closest('[data-yv-open-catalog]');
    if (catalogButton && this.header?.contains(catalogButton)) {
      event.preventDefault();
      this.#openDrawer('catalog');
      return;
    }

    // Close open category dropdowns when clicking elsewhere.
    for (const dropdown of this.header?.querySelectorAll('details[data-yv-dropdown][open]') ?? []) {
      if (!dropdown.contains(target)) dropdown.removeAttribute('open');
    }

    const menu = this.headerMenu;
    if (!menu || menu.dataset.yvOpenBy !== 'click') return;

    const link = target.closest('.menu-list__link');
    const listItem = link?.closest('.menu-list__list-item');
    if (link && listItem && menu.contains(link) && !listItem.matches('[slot="overflow"], [slot="more"]')) {
      const disclosure = listItem.querySelector('.menu-list__disclosure');
      if (disclosure instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        disclosure.click();
        return;
      }
    }

    // A click outside the open item closes it.
    const open = menu.querySelector('.menu-list__list-item:not([slot]) .menu-list__disclosure[aria-expanded="true"]');
    if (open instanceof HTMLElement) {
      const openItem = open.closest('.menu-list__list-item');
      if (openItem && !openItem.contains(target)) open.click();
    }
  };

  /** @param {KeyboardEvent} event */
  #onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    for (const dropdown of this.header?.querySelectorAll('details[data-yv-dropdown][open]') ?? []) {
      dropdown.removeAttribute('open');
      dropdown.querySelector('summary')?.focus();
    }
  };

  /* ------------------------------------------------------------ drawer */

  /** @param {Event} event */
  #onDetailsToggle = (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) return;

    if (details.matches('[data-yv-dropdown]') && details.open) {
      for (const other of this.header?.querySelectorAll('details[data-yv-dropdown][open]') ?? []) {
        if (other !== details) other.removeAttribute('open');
      }
    }

    if (details.id === 'Details-menu-drawer-container' && details.open) {
      // The hamburger opens the menu view; the category button asks for the catalog view.
      this.#selectDrawerTab(this.#requestedTab ?? 'menu');
      this.#requestedTab = undefined;
      this.#updateDrawerOffset();
    }
  };

  #updateDrawerOffset() {
    const header = this.header;
    if (!header) return;
    // Keep the announcement bar (which sits above the header) visible above the drawer, as in Yuva.
    let offset = 0;
    const group = document.getElementById('header-group');
    const bar = group?.querySelector('.yv-announcement-section:not([hidden])');
    if (bar instanceof HTMLElement) {
      offset = Math.max(0, Math.round(bar.getBoundingClientRect().bottom));
    }
    header.style.setProperty('--yv-drawer-offset', `${offset}px`);
  }

  /**
   * @param {'menu' | 'catalog'} [tab]
   */
  #openDrawer(tab = 'menu') {
    const header = this.header;
    const drawer = /** @type {(HTMLElement & { open?: Function }) | null} */ (header?.querySelector('header-drawer'));
    const details = header?.querySelector('#Details-menu-drawer-container');
    if (!drawer || !(details instanceof HTMLDetailsElement)) return;

    this.#requestedTab = tab;
    this.#selectDrawerTab(tab);
    this.#updateDrawerOffset();
    details.open = true;
    drawer.open?.();
  }

  /** @param {MouseEvent} event */
  #onDrawerTabClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest('[data-yv-drawer-tab]');
    if (!(tab instanceof HTMLElement)) return;
    this.#selectDrawerTab(tab.dataset.yvDrawerTab === 'catalog' ? 'catalog' : 'menu');
  };

  /**
   * Shows the menu or the catalog view of the drawer ("Menu / View catalog" switch).
   * @param {'menu' | 'catalog'} name
   */
  #selectDrawerTab(name) {
    const header = this.header;
    if (!header) return;
    for (const tab of header.querySelectorAll('[data-yv-drawer-tab]')) {
      if (!(tab instanceof HTMLElement)) continue;
      const active = tab.dataset.yvDrawerTab === name;
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
      const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
      if (panel instanceof HTMLElement) panel.hidden = !active;
    }
  }

  /* ------------------------------------------------------------ floating cart */

  /** @param {HTMLElement} header */
  #setupStickyCart(header) {
    const cart = document.querySelector('[data-yv-sticky-cart]');
    if (!(cart instanceof HTMLElement)) return;

    this.#cartObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      cart.hidden = entry.isIntersecting;
    });
    this.#cartObserver.observe(header);

    const { signal } = /** @type {AbortController} */ (this.#abort);
    document.addEventListener(
      'cart:update',
      (event) => {
        const detail = /** @type {CustomEvent} */ (event).detail;
        const count = detail?.data?.itemCount ?? detail?.resource?.item_count;
        if (typeof count !== 'number') return;
        cart.querySelector('.yv-sticky-cart__dot')?.classList.toggle('yv-sticky-cart__dot--empty', count === 0);
      },
      { signal }
    );
  }

  /* Search prompts: rotated by assets/yv-theme.js (Theme settings > Search). */

  /* ------------------------------------------------------------ theme editor */

  /** @param {Event} event */
  #onBlockSelect = (event) => {
    const marker = event.target;
    if (!(marker instanceof HTMLElement) || !marker.matches('.yv-header-block-marker')) return;
    if (!this.header?.contains(marker)) return;

    const item = this.#findMenuItem(marker.dataset.yvMenuLabel || '');
    if (!item) return;

    if (marker.dataset.yvBlockKind === 'badge') {
      item.querySelector('.yv-menu-badge')?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
        { duration: 600, iterations: 2 }
      );
      return;
    }

    const disclosure = item.querySelector('.menu-list__disclosure');
    if (disclosure instanceof HTMLElement && disclosure.getAttribute('aria-expanded') !== 'true') {
      disclosure.click();
    }
  };

  /** @param {Event} event */
  #onBlockDeselect = (event) => {
    const marker = event.target;
    if (!(marker instanceof HTMLElement) || !marker.matches('.yv-header-block-marker')) return;
    const item = this.#findMenuItem(marker.dataset.yvMenuLabel || '');
    const disclosure = item?.querySelector('.menu-list__disclosure[aria-expanded="true"]');
    if (disclosure instanceof HTMLElement) disclosure.click();
  };

  /**
   * @param {string} label - Lower-cased, trimmed first-level menu title.
   * @returns {HTMLElement | null}
   */
  #findMenuItem(label) {
    const menu = this.headerMenu;
    if (!menu || !label) return null;
    for (const item of menu.querySelectorAll('.menu-list__list-item')) {
      const title = item.querySelector('.menu-list__link-title');
      const text = title?.firstChild?.textContent ?? title?.textContent ?? '';
      if (text.trim().toLowerCase() === label && item instanceof HTMLElement) return item;
    }
    return null;
  }
}

if (!customElements.get('yv-header-component')) {
  customElements.define('yv-header-component', YvHeaderComponent);
}
