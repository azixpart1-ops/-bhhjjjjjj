import { StandardEvents } from '@shopify/events';
import { prefersReducedMotion } from '@theme/utilities';

/**
 * Yuva global behaviours without markup of their own (docs part 4 §0.3), loaded on every page by
 * snippets/scripts.liquid and configured by `#yv-theme-config`:
 *
 * - Add to cart alerts (Theme settings > Product): a short synthesised sound and a haptic pulse
 *   after every successful add to cart (Horizon's `shopify:cart:lines-update` with action "add").
 * - Search prompts (Theme settings > Search): types the prompts, one character at a time, into the
 *   placeholder of every search field (`input[type="search"][name="q"]`) and into the header's
 *   searchbar button (`[data-yv-search-prompt]`, "Full width header with searchbar").
 *
 * The other global behaviours live with their markup: the browser tab cart count in
 * assets/yv-cart.js (it loads with the cart drawer), scroll to top and stickers in
 * assets/yv-overlays.js.
 */

/** @returns {any} The parsed `#yv-theme-config` JSON (empty object when missing). */
function readConfig() {
  try {
    return JSON.parse(document.getElementById('yv-theme-config')?.textContent || '{}');
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------------- add to cart alerts */

/**
 * @typedef {'none' | 'chime' | 'pop' | 'bell' | 'click'} AlertSound
 */

class CartAlerts {
  /** @type {AudioContext | undefined} */
  #audio;

  /** @type {AlertSound} */
  #sound;

  #haptic;

  /**
   * @param {{ atcAudio?: AlertSound, atcHaptic?: boolean }} settings
   */
  constructor(settings) {
    this.#sound = settings.atcAudio || 'none';
    this.#haptic = Boolean(settings.atcHaptic);
  }

  get enabled() {
    return this.#sound !== 'none' || this.#haptic;
  }

  listen() {
    if (!this.enabled) return;
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#onLinesUpdate);
  }

  /** @param {Event} event */
  #onLinesUpdate = (event) => {
    const update = /** @type {any} */ (event);
    if (update.action !== 'add' || !update.promise) return;

    // The event is dispatched inside the shopper's click, which lets the audio context start.
    this.#prepareAudio();

    update.promise
      .then(/** @param {any} result */ (result) => {
        if (!result || result.detail?.didError || result.userErrors?.length) return;
        this.#play();
        this.#vibrate();
      })
      .catch(/** @param {any} error */ (error) => {
        if (error?.name !== 'AbortError') console.warn('[yv-theme] Add to cart alert skipped', error);
      });
  };

  #prepareAudio() {
    if (this.#sound === 'none') return;
    try {
      if (!this.#audio) {
        const AudioContextClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        if (!AudioContextClass) return;
        this.#audio = new AudioContextClass();
      }
      if (this.#audio.state === 'suspended') this.#audio.resume().catch(() => {});
    } catch {
      this.#audio = undefined;
    }
  }

  #vibrate() {
    if (!this.#haptic || !window.matchMedia('(pointer: coarse)').matches) return;
    try {
      navigator.vibrate?.(40);
    } catch {
      // Some browsers throw instead of ignoring the call.
    }
  }

  #play() {
    const context = this.#audio;
    if (!context || context.state === 'closed') return;
    const start = context.currentTime + 0.01;

    switch (this.#sound) {
      case 'chime':
        this.#note(context, { type: 'sine', frequency: 880, start, length: 0.12, gain: 0.15, release: 0.06 });
        this.#note(context, { type: 'sine', frequency: 1320, start: start + 0.12, length: 0.12, gain: 0.15, release: 0.06 });
        break;
      case 'pop': {
        const { oscillator, volume } = this.#voice(context, 'sine', 600, start);
        oscillator.frequency.exponentialRampToValueAtTime(300, start + 0.08);
        volume.gain.setValueAtTime(0.2, start);
        volume.gain.linearRampToValueAtTime(0, start + 0.08);
        oscillator.stop(start + 0.1);
        break;
      }
      case 'bell': {
        const { oscillator, volume } = this.#voice(context, 'triangle', 1046, start);
        volume.gain.setValueAtTime(0.2, start);
        volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
        oscillator.stop(start + 0.62);
        break;
      }
      case 'click':
        this.#note(context, { type: 'square', frequency: 2000, start, length: 0.02, gain: 0.05, release: 0.005 });
        break;
    }
  }

  /**
   * One held note with a short attack and a release.
   * @param {AudioContext} context
   * @param {{ type: OscillatorType, frequency: number, start: number, length: number, gain: number, release: number }} note
   */
  #note(context, { type, frequency, start, length, gain, release }) {
    const { oscillator, volume } = this.#voice(context, type, frequency, start);
    volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(gain, start + 0.005);
    volume.gain.setValueAtTime(gain, start + length);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + length + release);
    oscillator.stop(start + length + release + 0.01);
  }

  /**
   * An oscillator wired through its own gain node, started at `start`.
   * @param {AudioContext} context
   * @param {OscillatorType} type
   * @param {number} frequency
   * @param {number} start
   */
  #voice(context, type, frequency, start) {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(volume).connect(context.destination);
    oscillator.start(start);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      volume.disconnect();
    });
    return { oscillator, volume };
  }
}

/* ------------------------------------------------------------------------- search prompts */

const TYPE_MS = 60;
const DELETE_MS = 30;
const HOLD_MS = 2000;
const HOLD_TICK_MS = 250;
const PAUSE_MS = 400;
const SEARCH_INPUTS = 'input[type="search"][name="q"]';
/** Text stand-ins for a placeholder, e.g. the header searchbar that opens the search modal. */
const SEARCH_PROMPT_TARGETS = '[data-yv-search-prompt]';

/**
 * Types each prompt into the search placeholders (60ms per character), holds it for 2s, deletes it
 * (30ms per character), pauses 400ms and moves to the next prompt. One timeline drives every search
 * field on the page; a field with a value is left alone, and the value is never touched. Reduced
 * motion shows the first prompt as a static placeholder.
 */
class SearchPrompts {
  /** @type {string[]} */
  #prompts;

  /** @type {Set<HTMLInputElement>} */
  #inputs = new Set();

  /** @type {Set<HTMLElement>} */
  #targets = new Set();

  #index = 0;
  #length = 0;
  #held = 0;
  #phase = /** @type {'type' | 'hold' | 'delete' | 'pause'} */ ('type');
  #timer = 0;

  /** @param {string[]} prompts */
  constructor(prompts) {
    this.#prompts = prompts.map((prompt) => String(prompt).trim()).filter(Boolean);
  }

  start() {
    if (!this.#prompts.length) return;

    this.#collect();
    document.addEventListener('shopify:section:load', () => this.#collect());

    if (prefersReducedMotion()) {
      this.#paint(this.#prompts[0] ?? '');
      return;
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.clearTimeout(this.#timer);
      else this.#step();
    });
    this.#step();
  }

  /** Finds every search field (the header's modal, the search page, search blocks). */
  #collect() {
    document.querySelectorAll(SEARCH_INPUTS).forEach((input) => {
      if (input instanceof HTMLInputElement) this.#inputs.add(input);
    });
    document.querySelectorAll(SEARCH_PROMPT_TARGETS).forEach((target) => {
      if (target instanceof HTMLElement) this.#targets.add(target);
    });
    if (prefersReducedMotion()) this.#paint(this.#prompts[0] ?? '');
  }

  #step = () => {
    window.clearTimeout(this.#timer);
    if (document.hidden) return;

    const prompt = this.#prompts[this.#index] ?? '';
    let delay = TYPE_MS;

    switch (this.#phase) {
      case 'type':
        this.#length += 1;
        if (this.#length >= prompt.length) {
          this.#length = prompt.length;
          this.#phase = 'hold';
          this.#held = 0;
          delay = HOLD_TICK_MS;
        }
        break;
      case 'hold':
        // Held in short ticks so the full prompt is repainted if anything else rewrites it.
        this.#held += HOLD_TICK_MS;
        delay = HOLD_TICK_MS;
        if (this.#held >= HOLD_MS) {
          this.#phase = 'delete';
          delay = DELETE_MS;
        }
        break;
      case 'delete':
        this.#length -= 1;
        delay = DELETE_MS;
        if (this.#length <= 0) {
          this.#length = 0;
          this.#phase = 'pause';
          delay = PAUSE_MS;
        }
        break;
      case 'pause':
        this.#index = (this.#index + 1) % this.#prompts.length;
        this.#phase = 'type';
        this.#collect();
        break;
    }

    this.#paint((this.#prompts[this.#index] ?? '').slice(0, this.#length));
    this.#timer = window.setTimeout(this.#step, delay);
  };

  /** @param {string} text */
  #paint(text) {
    for (const input of this.#inputs) {
      if (!input.isConnected) {
        this.#inputs.delete(input);
        continue;
      }
      if (input.value) continue;
      if (input.placeholder !== text) input.placeholder = text;
    }
    for (const target of this.#targets) {
      if (!target.isConnected) {
        this.#targets.delete(target);
        continue;
      }
      if (target.textContent !== text) target.textContent = text;
    }
  }
}

/* ------------------------------------------------------------------------- start */

function init() {
  if (/** @type {any} */ (window).yvThemeStarted) return;
  /** @type {any} */ (window).yvThemeStarted = true;

  const config = readConfig();
  new CartAlerts(config.product || {}).listen();
  new SearchPrompts(Array.isArray(config.search?.prompts) ? config.search.prompts : []).start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
