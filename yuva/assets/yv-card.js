import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Yuva product card behaviours that Horizon's product-card.js does not cover.
 *
 * 1. <yv-card-pickup> (Theme settings > Product grid > Show grid pickup availability): when the card
 *    scrolls into view and the store locator saved a location (localStorage "yvSelectedLocation",
 *    JSON { "name": "<location name>" }), fetches sections/yv-card-pickup.liquid for the card's
 *    variant and shows "Pickup available at <name>" or "Unavailable at <name>".
 *
 * 2. Auto slide (Product grid > Enable auto slide, with "Carousel" hover action): while the pointer is
 *    over a `product-card.yv-card--autoslide`, its image slideshow advances every 1.5s; on leave it
 *    returns to the first image. Never runs under reduced motion.
 */

const STORAGE_KEY = 'yvSelectedLocation';

/** @type {Map<string, Promise<Array<{ name: string, available: boolean, time: string }>>>} */
const pickupCache = new Map();

/** @returns {string} */
function storedLocationName() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.name === 'string' ? parsed.name : '';
  } catch {
    return '';
  }
}

/** @param {string} url */
function fetchPickup(url) {
  let request = pickupCache.get(url);
  if (!request) {
    request = fetch(url)
      .then((response) => (response.ok ? response.text() : ''))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const data = doc.querySelector('script[data-yv-pickup]');
        return data ? JSON.parse(data.textContent || '[]') : [];
      })
      .catch(() => []);
    pickupCache.set(url, request);
  }
  return request;
}

/**
 * @typedef {object} PickupRefs
 * @property {HTMLElement} [text]
 * @extends {Component<PickupRefs>}
 */
export class YvCardPickup extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  connectedCallback() {
    super.connectedCallback();
    this.#observer?.disconnect();

    const location = storedLocationName();
    if (!location || !this.dataset.url) return;

    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#observer?.disconnect();
        this.#observer = null;
        this.#load(location);
      },
      { rootMargin: '200px' }
    );
    // The element itself is hidden until loaded; observe its card instead.
    this.#observer.observe(this.closest('product-card') || this.parentElement || this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
  }

  /** @param {string} location */
  async #load(location) {
    const list = await fetchPickup(/** @type {string} */ (this.dataset.url));
    if (!this.isConnected) return;

    const match = list.find((entry) => entry.name.trim().toLowerCase() === location.trim().toLowerCase());
    const available = Boolean(match?.available);
    const template = available ? this.dataset.labelAvailable : this.dataset.labelUnavailable;
    const text = (template || '').replace('[location]', location);

    const target = this.refs.text instanceof HTMLElement ? this.refs.text : this;
    target.textContent = text;
    this.dataset.state = available ? 'available' : 'unavailable';
    this.hidden = false;
  }
}

if (!customElements.get('yv-card-pickup')) {
  customElements.define('yv-card-pickup', YvCardPickup);
}

/* ------------------------------------------------------------------ */
/* Auto slide                                                          */
/* ------------------------------------------------------------------ */

const AUTOSLIDE_INTERVAL = 1500;
/** @type {WeakMap<Element, number>} */
const timers = new WeakMap();

/** @param {Element} card */
function slideshowOf(card) {
  return /** @type {any} */ (card.querySelector('.card-gallery slideshow-component'));
}

/** @param {PointerEvent} event */
function handleOver(event) {
  if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
  const card = event.target instanceof Element ? event.target.closest('product-card.yv-card--autoslide') : null;
  if (!card || timers.has(card)) return;
  if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;

  const slideshow = slideshowOf(card);
  if (!slideshow || typeof slideshow.next !== 'function' || (slideshow.slides?.length || 0) < 2) return;

  const timer = window.setInterval(() => {
    const slides = slideshow.slides || [];
    if (slideshow.current >= slides.length - 1) slideshow.select(0, undefined, { animate: false });
    else slideshow.next(undefined, { animate: true });
  }, AUTOSLIDE_INTERVAL);
  timers.set(card, timer);
}

/** @param {PointerEvent} event */
function handleOut(event) {
  const card = event.target instanceof Element ? event.target.closest('product-card.yv-card--autoslide') : null;
  if (!card || !timers.has(card)) return;
  if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;

  window.clearInterval(timers.get(card));
  timers.delete(card);
  const slideshow = slideshowOf(card);
  if (slideshow && typeof slideshow.select === 'function') slideshow.select(0, undefined, { animate: false });
}

// ES modules run once per page, so these delegated listeners are registered once.
document.addEventListener('pointerover', handleOver, { passive: true });
document.addEventListener('pointerout', handleOut, { passive: true });
