import { DialogComponent } from '@theme/dialog';

/**
 * Yuva store locator. Markup: sections/yv-store-locator.liquid and
 * blocks/_yv-store.liquid.
 *
 * - A floating edge tab opens a modal dialog (Horizon DialogComponent: scroll lock, Esc, click
 *   outside, focus returns to the tab) listing the stores as native radio cards.
 * - With a Google Maps API key (`data-api-key`) the first open loads the Maps JavaScript API through
 *   assets/yv-map.js (imported by its asset URL, `data-maps-module`, so the Map section and the
 *   locator share one loader), geocodes each store's location (cached per session), places a marker
 *   per store (custom pin from `data-pin-url`, drawn at 40 × 40) and fits the bounds. Selecting a card
 *   pans to its marker; clicking a marker selects its card. Any map failure hides the map column.
 * - Confirm saves `localStorage.yvSelectedLocation = {"name": "<store name>"}` (the contract read by
 *   the product card pickup line, <yv-card-pickup> in assets/yv-card.js), dispatches
 *   `yv:store-change` on `document` (`detail.name`), refreshes the pickup lines already on the page
 *   and closes the dialog. The saved store is preselected on the next open, and a dot on the tab
 *   shows that a store is saved.
 *
 * @typedef {object} StoreLocatorRefs
 * @property {HTMLDialogElement} dialog
 * @property {HTMLButtonElement} [confirmButton]
 * @property {HTMLElement} [map]
 * @property {HTMLElement} [dot]
 * @property {HTMLElement} [list]
 */

const STORAGE_KEY = 'yvSelectedLocation';
export const STORE_CHANGE_EVENT = 'yv:store-change';

/** @returns {string} */
function readSavedStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.name === 'string' ? parsed.name : '';
  } catch {
    return '';
  }
}

/** @param {string} name */
function saveStore(name) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name }));
  } catch {
    // Private mode or storage disabled: the choice lasts for this page only.
  }
}

/** @param {string} value */
const normalise = (value) => value.trim().toLowerCase();

/**
 * @extends {DialogComponent}
 */
export class YvStoreLocator extends DialogComponent {
  /** @type {Map<HTMLInputElement, any>} */
  #markers = new Map();

  /** @type {any} */
  #map = null;

  /** @type {Promise<void> | null} */
  #mapPromise = null;

  #onChange = (/** @type {Event} */ event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
    this.#updateConfirm();
    this.#focusMarker(input);
  };

  /** Theme editor: selecting the section or one of its stores opens the popup. */
  #onEditorSelect = (/** @type {Event} */ event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.contains(target) || target.contains(this)) this.open();
  };

  #onEditorDeselect = (/** @type {Event} */ event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (target.contains(this)) this.closeDialog();
  };

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this.#onChange);
    this.#updateDot();

    if (window.Shopify?.designMode) {
      document.addEventListener('shopify:section:select', this.#onEditorSelect);
      document.addEventListener('shopify:block:select', this.#onEditorSelect);
      document.addEventListener('shopify:section:deselect', this.#onEditorDeselect);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('change', this.#onChange);
    document.removeEventListener('shopify:section:select', this.#onEditorSelect);
    document.removeEventListener('shopify:block:select', this.#onEditorSelect);
    document.removeEventListener('shopify:section:deselect', this.#onEditorDeselect);
  }

  /** @returns {HTMLInputElement[]} */
  get radios() {
    return Array.from(this.querySelectorAll('input[type="radio"][data-store-name]'));
  }

  /** Opens the popup, preselects the saved store and starts the map on the first open. */
  open() {
    this.#preselect();
    this.showDialog();
    this.#initMap();
  }

  /** Saves the selected store, notifies the page and closes the popup. */
  confirm() {
    const selected = this.radios.find((radio) => radio.checked);
    if (!selected) return;

    const name = selected.dataset.storeName || selected.value;
    saveStore(name);
    this.#updateDot();
    document.dispatchEvent(new CustomEvent(STORE_CHANGE_EVENT, { detail: { name } }));
    this.#refreshPickupLines();
    this.closeDialog();
  }

  #preselect() {
    const saved = readSavedStore();
    if (saved) {
      const match = this.radios.find((radio) => normalise(radio.dataset.storeName || '') === normalise(saved));
      if (match) match.checked = true;
    }
    this.#updateConfirm();
  }

  #updateConfirm() {
    const { confirmButton } = this.refs;
    if (confirmButton instanceof HTMLButtonElement) {
      confirmButton.disabled = !this.radios.some((radio) => radio.checked);
    }
  }

  #updateDot() {
    const { dot } = this.refs;
    if (!(dot instanceof HTMLElement)) return;
    const saved = normalise(readSavedStore());
    dot.hidden = !saved || !this.radios.some((radio) => normalise(radio.dataset.storeName || '') === saved);
  }

  /**
   * Product card pickup lines read the saved store when they connect; re-create the ones on the page
   * so they pick up the new choice without a reload.
   */
  #refreshPickupLines() {
    for (const line of document.querySelectorAll('yv-card-pickup')) {
      const fresh = /** @type {HTMLElement} */ (line.cloneNode(true));
      fresh.hidden = true;
      delete fresh.dataset.state;
      line.replaceWith(fresh);
    }
  }

  #initMap() {
    if (this.#mapPromise) return;
    const { apiKey, mapsModule } = this.dataset;
    const container = this.refs.map;
    if (!apiKey || !mapsModule || !(container instanceof HTMLElement)) return;

    this.#mapPromise = this.#buildMap(apiKey, mapsModule, container).catch(() => {
      this.dataset.mapState = 'error';
    });
  }

  /**
   * @param {string} apiKey
   * @param {string} mapsModule
   * @param {HTMLElement} container
   */
  async #buildMap(apiKey, mapsModule, container) {
    this.dataset.mapState = 'loading';
    const { loadGoogleMaps, geocodeAddress, mapsAuthFailed, AUTH_FAILURE_EVENT } = await import(mapsModule);
    if (mapsAuthFailed()) throw new Error('yv-store-locator: Google Maps key rejected');
    document.addEventListener(AUTH_FAILURE_EVENT, () => (this.dataset.mapState = 'error'), { once: true });

    const maps = await loadGoogleMaps(apiKey);
    const [{ Map }, { Marker }, { LatLngBounds }] = await Promise.all([
      maps.importLibrary('maps'),
      maps.importLibrary('marker'),
      maps.importLibrary('core'),
    ]);

    this.#map = new Map(container, {
      center: { lat: 20, lng: 0 },
      zoom: 2,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const pinUrl = this.dataset.pinUrl;
    const icon = pinUrl ? { url: pinUrl, scaledSize: new maps.Size(40, 40) } : undefined;
    const bounds = new LatLngBounds();

    const results = await Promise.all(
      this.radios.map(async (radio) => {
        const location = radio.dataset.location;
        if (!location) return null;
        try {
          return { radio, position: await geocodeAddress(maps, location) };
        } catch {
          return null;
        }
      })
    );

    for (const result of results) {
      if (!result) continue;
      const { radio, position } = result;
      const marker = new Marker({ map: this.#map, position, title: radio.dataset.storeName || '', icon });
      marker.addListener('click', () => this.#selectFromMarker(radio));
      this.#markers.set(radio, marker);
      bounds.extend(position);
    }

    if (this.#markers.size === 0) throw new Error('yv-store-locator: no store could be geocoded');

    if (this.#markers.size === 1) {
      this.#map.setCenter(bounds.getCenter());
      this.#map.setZoom(14);
    } else {
      this.#map.fitBounds(bounds, 48);
    }

    this.dataset.mapState = 'ready';
    const checked = this.radios.find((radio) => radio.checked);
    if (checked) this.#focusMarker(checked);
  }

  /** @param {HTMLInputElement} radio */
  #focusMarker(radio) {
    const marker = this.#markers.get(radio);
    if (!marker || !this.#map) return;
    this.#map.panTo(marker.getPosition());
    this.#map.setZoom(14);
  }

  /** @param {HTMLInputElement} radio */
  #selectFromMarker(radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    radio.closest('.yv-store-card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

if (!customElements.get('yv-store-locator')) {
  customElements.define('yv-store-locator', YvStoreLocator);
}
