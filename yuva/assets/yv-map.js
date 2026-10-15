import { Component } from '@theme/component';

/**
 * Google Maps helpers shared by the Map section (`<yv-map>`, this file) and the store locator
 * (assets/yv-store-locator.js imports this module by its asset URL, so both share one instance).
 *
 * - The Maps JavaScript API is loaded once per page (a promise kept on `window`), with
 *   `loading=async` and a callback. The key comes from Theme settings > Google Maps.
 * - `gm_authFailure` (invalid or restricted key) is turned into a `yv:maps-auth-failure` event on
 *   `document`; maps listen to it and fall back.
 * - Geocoded addresses are cached in sessionStorage (`yv-geocode:<address>`).
 */

const LOADER_KEY = '__yvGoogleMapsLoader';
const READY_CALLBACK = '__yvGoogleMapsReady';
const AUTH_FAILED_KEY = '__yvGoogleMapsAuthFailed';
export const AUTH_FAILURE_EVENT = 'yv:maps-auth-failure';

/** @returns {any} */
function globals() {
  return /** @type {any} */ (window);
}

/** @returns {boolean} */
export function mapsAuthFailed() {
  return Boolean(globals()[AUTH_FAILED_KEY]);
}

function installAuthFailureHook() {
  const w = globals();
  if (w.__yvGoogleMapsAuthHook) return;
  w.__yvGoogleMapsAuthHook = true;
  const previous = typeof w.gm_authFailure === 'function' ? w.gm_authFailure : null;
  w.gm_authFailure = () => {
    w[AUTH_FAILED_KEY] = true;
    document.dispatchEvent(new CustomEvent(AUTH_FAILURE_EVENT));
    if (previous) previous();
  };
}

/**
 * Loads the Maps JavaScript API once and resolves with `google.maps`.
 * @param {string} apiKey
 * @returns {Promise<any>}
 */
export function loadGoogleMaps(apiKey) {
  const w = globals();
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  if (w[LOADER_KEY]) return w[LOADER_KEY];
  if (!apiKey) return Promise.reject(new Error('yv-map: missing Google Maps API key'));

  installAuthFailureHook();
  w[LOADER_KEY] = new Promise((resolve, reject) => {
    w[READY_CALLBACK] = () => resolve(w.google.maps);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${READY_CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      delete w[LOADER_KEY];
      script.remove();
      reject(new Error('yv-map: the Google Maps script failed to load'));
    };
    document.head.append(script);
  });
  return w[LOADER_KEY];
}

/**
 * Geocodes an address (Geocoding API) and resolves with `{ lat, lng }`. Results are cached for the
 * browser session. Rejects when the address cannot be found.
 * @param {any} maps - `google.maps`
 * @param {string} address
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function geocodeAddress(maps, address) {
  const cacheKey = `yv-geocode:${address.trim().toLowerCase()}`;
  try {
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') return parsed;
    }
  } catch {
    // Storage unavailable: geocode every time.
  }

  const { Geocoder } = await maps.importLibrary('geocoding');
  const { results } = await new Geocoder().geocode({ address });
  const location = results?.[0]?.geometry?.location;
  if (!location) throw new Error(`yv-map: no result for "${address}"`);

  const position = { lat: location.lat(), lng: location.lng() };
  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(position));
  } catch {
    // Ignore quota and privacy-mode errors.
  }
  return position;
}

/**
 * Map section canvas. Markup: sections/yv-map.liquid.
 *
 * Attributes: `data-api-key`, `data-address`, `data-zoom` (default 14), `data-map-type`
 * (roadmap | satellite | hybrid | terrain), `data-embed-url` (keyless embed used as the last
 * fallback), `data-has-fallback` (a fallback image is rendered).
 * State: `data-state="loading|ready|error"`. On any failure the canvas stays hidden and the fallback
 * image shows; without a fallback image the keyless embed iframe is inserted instead.
 *
 * @typedef {object} MapRefs
 * @property {HTMLElement} [canvas]
 * @extends {Component<MapRefs>}
 */
export class YvMap extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  #onAuthFailure = () => this.#fail();

  connectedCallback() {
    super.connectedCallback();
    this.#observer?.disconnect();

    const { apiKey, address } = this.dataset;
    if (!apiKey || !address) return;
    if (this.dataset.state === 'ready') return;

    document.addEventListener(AUTH_FAILURE_EVENT, this.#onAuthFailure);
    if (mapsAuthFailed()) {
      this.#fail();
      return;
    }

    if (!('IntersectionObserver' in window)) {
      this.#init();
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#observer?.disconnect();
        this.#observer = null;
        this.#init();
      },
      { rootMargin: '200px 0px' }
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    document.removeEventListener(AUTH_FAILURE_EVENT, this.#onAuthFailure);
  }

  async #init() {
    const { apiKey = '', address = '' } = this.dataset;
    const canvas = this.refs.canvas;
    if (!(canvas instanceof HTMLElement)) return;

    this.dataset.state = 'loading';
    try {
      const maps = await loadGoogleMaps(apiKey);
      const [{ Map }, { Marker }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
      const position = await geocodeAddress(maps, address);
      if (!this.isConnected || mapsAuthFailed()) return;

      const zoom = Number(this.dataset.zoom) || 14;
      const map = new Map(canvas, {
        center: position,
        zoom,
        mapTypeId: this.dataset.mapType || 'roadmap',
      });
      new Marker({ map, position, title: address });
      this.dataset.state = 'ready';
    } catch {
      this.#fail();
    }
  }

  #fail() {
    if (this.dataset.state === 'error') return;
    this.dataset.state = 'error';

    const embedUrl = this.dataset.embedUrl;
    if (this.dataset.hasFallback === 'true' || !embedUrl || this.querySelector('iframe')) return;

    const iframe = document.createElement('iframe');
    iframe.className = 'yv-map__embed';
    iframe.src = embedUrl;
    iframe.loading = 'lazy';
    iframe.title = this.dataset.embedTitle || '';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    this.append(iframe);
  }
}

if (!customElements.get('yv-map')) {
  customElements.define('yv-map', YvMap);
}
