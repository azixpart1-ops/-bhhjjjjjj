import { Component } from '@theme/component';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Live countdown to an end date (snippets/yv-countdown-timer.liquid renders the markup).
 *
 * data-end is a local date-time without zone ("YYYY-MM-DDTHH:MM:SS"), so it is read in the
 * visitor's time zone: "2026-12-31T00:00:00" counts down to midnight at the start of 31 Dec.
 *
 * Markup contract:
 * <yv-countdown data-end="2026-12-31T00:00:00" data-expired="keep|hide|hide-section|hide-block|message"
 *               [data-hide-empty-days] [data-pad-days="2"]>
 *   <span class="yv-countdown__units" ref="units">
 *     <span class="yv-countdown__unit" data-unit="days"><span class="yv-countdown__value" ref="days">00</span><span class="yv-countdown__label">Days</span></span>
 *     … hours / minutes / seconds (ref="hours" | "minutes" | "seconds")
 *   </span>
 *   <span class="yv-countdown__expired" ref="expiredMessage" hidden>Offer ended</span>   (optional)
 * All parts are spans, so the timer can sit inside a <p> (announcement bars).
 * </yv-countdown>
 *
 * Emits a bubbling `yv-countdown:expired` event once when the end is reached.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} [days]
 * @property {HTMLElement} [hours]
 * @property {HTMLElement} [minutes]
 * @property {HTMLElement} [seconds]
 * @property {HTMLElement} [units]
 * @property {HTMLElement} [expiredMessage]
 *
 * @extends {Component<Refs>}
 */
export class YvCountdown extends Component {
  /** @type {number | undefined} */
  #timer;
  #expiredFired = false;

  connectedCallback() {
    super.connectedCallback();
    this.#stop();
    this.#expiredFired = this.hasAttribute('expired') && this.dataset.expiredFired === 'true';
    this.#tick();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#stop();
    this.#tick();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stop();
  }

  /** End time in ms since epoch, or NaN when data-end is missing or invalid. */
  get endTime() {
    const value = this.dataset.end || '';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return Number.NaN;
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).getTime();
  }

  /** Milliseconds left (never negative). */
  get remaining() {
    const end = this.endTime;
    return Number.isNaN(end) ? 0 : Math.max(0, end - Date.now());
  }

  #stop() {
    window.clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #tick = () => {
    const end = this.endTime;
    if (Number.isNaN(end)) return;

    const remaining = Math.max(0, end - Date.now());
    this.#render(remaining);

    if (remaining <= 0) {
      this.#expire();
      return;
    }

    // Re-align with the next whole second so the digits change together with the clock.
    const delay = remaining % SECOND || SECOND;
    this.#timer = window.setTimeout(this.#tick, Math.min(delay + 15, SECOND));
  };

  /** @param {number} remaining */
  #render(remaining) {
    const days = Math.floor(remaining / DAY);
    const hours = Math.floor((remaining % DAY) / HOUR);
    const minutes = Math.floor((remaining % HOUR) / MINUTE);
    const seconds = Math.floor((remaining % MINUTE) / SECOND);
    const padDays = Number(this.dataset.padDays || 2);

    this.#set('days', String(days).padStart(padDays, '0'));
    this.#set('hours', String(hours).padStart(2, '0'));
    this.#set('minutes', String(minutes).padStart(2, '0'));
    this.#set('seconds', String(seconds).padStart(2, '0'));

    if (this.hasAttribute('data-hide-empty-days')) {
      const daysUnit = this.refs.days?.closest('[data-unit]');
      if (daysUnit instanceof HTMLElement) daysUnit.hidden = days === 0;
    }

    this.style.setProperty('--yv-countdown-days-digits', String(Math.max(padDays, String(days).length)));
  }

  /**
   * @param {'days' | 'hours' | 'minutes' | 'seconds'} unit
   * @param {string} value
   */
  #set(unit, value) {
    const element = this.refs[unit];
    if (element instanceof HTMLElement && element.textContent !== value) element.textContent = value;
  }

  #expire() {
    this.setAttribute('expired', '');
    const mode = this.dataset.expired || 'keep';
    const designMode = Boolean(window.Shopify?.designMode);

    if (mode === 'message') {
      const { units, expiredMessage } = this.refs;
      if (expiredMessage instanceof HTMLElement) {
        expiredMessage.hidden = false;
        if (units instanceof HTMLElement) units.hidden = true;
      }
    } else if (!designMode) {
      if (mode === 'hide') {
        this.hidden = true;
      } else if (mode === 'hide-block') {
        const block = this.closest('[data-yv-countdown-block]');
        if (block instanceof HTMLElement) block.hidden = true;
        else this.hidden = true;
      } else if (mode === 'hide-section') {
        const section = this.closest('.shopify-section');
        if (section instanceof HTMLElement) section.style.display = 'none';
        else this.hidden = true;
      }
    }

    if (this.#expiredFired) return;
    this.#expiredFired = true;
    this.dataset.expiredFired = 'true';
    this.dispatchEvent(new CustomEvent('yv-countdown:expired', { bubbles: true, detail: { mode } }));
  }
}

if (!customElements.get('yv-countdown')) {
  customElements.define('yv-countdown', YvCountdown);
}
