import { Component } from '@theme/component';

/**
 * Yuva footer language / currency pill (sections/yv-footer.liquid).
 *
 * The pill button toggles a list that opens upwards. Each option is a submit button of the
 * surrounding Shopify localization form (`name="country_code"` / `name="language_code"`), so the
 * selection works without this script; the script only adds the dropdown behaviour: one open
 * panel at a time, close on outside click, Escape and focus leaving the pill, arrow-key movement
 * between options, and focus back on the pill when the panel is dismissed with the keyboard.
 *
 * @typedef {{ button: HTMLButtonElement, panel: HTMLElement }} Refs
 * @extends {Component<Refs>}
 */
class YvFooterLocaleComponent extends Component {
  requiredRefs = ['button', 'panel'];

  /** @type {AbortController | null} */
  #openController = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#openController?.abort();
    this.#openController = null;
  }

  get isOpen() {
    return !this.refs.panel.hidden;
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;

    for (const other of document.querySelectorAll('yv-footer-locale-component')) {
      if (other !== this && other instanceof YvFooterLocaleComponent) other.close();
    }

    const { button, panel } = this.refs;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');

    this.#openController = new AbortController();
    const { signal } = this.#openController;
    document.addEventListener('pointerdown', this.#handleOutsidePointer, { signal });
    this.addEventListener('keydown', this.#handleKeydown, { signal });
    this.addEventListener('focusout', this.#handleFocusOut, { signal });

    const current = panel.querySelector('[aria-current="true"]');
    if (current instanceof HTMLElement) current.scrollIntoView({ block: 'nearest' });
  }

  /**
   * @param {boolean} [restoreFocus] - Move focus back to the pill button.
   */
  close(restoreFocus = false) {
    if (!this.isOpen) return;

    const { button, panel } = this.refs;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    this.#openController?.abort();
    this.#openController = null;

    if (restoreFocus) button.focus();
  }

  /** @param {PointerEvent} event */
  #handleOutsidePointer = (event) => {
    if (event.target instanceof Node && this.contains(event.target)) return;
    this.close();
  };

  /** @param {FocusEvent} event */
  #handleFocusOut = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) return;
    this.close();
  };

  /** @param {KeyboardEvent} event */
  #handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;

    const options = /** @type {HTMLButtonElement[]} */ ([...this.refs.panel.querySelectorAll('button')]);
    if (!options.length) return;

    event.preventDefault();
    const index = options.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    let next = 0;

    if (event.key === 'End') {
      next = options.length - 1;
    } else if (event.key === 'ArrowDown') {
      next = index < 0 ? 0 : Math.min(index + 1, options.length - 1);
    } else if (event.key === 'ArrowUp') {
      next = index < 0 ? options.length - 1 : Math.max(index - 1, 0);
    }

    options[next]?.focus();
  };
}

if (!customElements.get('yv-footer-locale-component')) {
  customElements.define('yv-footer-locale-component', YvFooterLocaleComponent);
}
