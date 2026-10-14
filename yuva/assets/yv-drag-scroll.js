import { Component } from '@theme/component';

/**
 * A horizontal scroll strip that can also be dragged with the mouse on desktop (touch devices use
 * native swiping). Used by the gallery carousel "Swipe" layout, collage and featured collections
 * list mobile strips. CSS (assets/yv-components.css) gives `.yv-drag-scroll` overflow-x: auto,
 * proximity snapping and a hidden scrollbar.
 *
 * Markup contract:
 * <yv-drag-scroll class="yv-drag-scroll" [data-snap="proximity|mandatory|none"]>
 *   <div>item</div> <div>item</div> …
 * </yv-drag-scroll>
 *
 * A drag never activates the link it started on. Emits `yv-drag-scroll:dragend`.
 */
export class YvDragScroll extends Component {
  /** @type {AbortController | null} */
  #controller = null;

  connectedCallback() {
    super.connectedCallback();
    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    this.addEventListener('pointerdown', this.#handlePointerDown, { signal });
    this.addEventListener('dragstart', (event) => event.preventDefault(), { signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#controller = null;
  }

  /** @param {PointerEvent} event */
  #handlePointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (this.scrollWidth <= this.clientWidth + 1) return;
    if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;

    const startX = event.clientX;
    const startScroll = this.scrollLeft;
    let moved = false;
    const drag = new AbortController();

    const onMove = (/** @type {PointerEvent} */ moveEvent) => {
      const dx = moveEvent.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) < 6) return;
        moved = true;
        this.setAttribute('data-dragging', '');
        this.style.scrollSnapType = 'none';
        this.style.scrollBehavior = 'auto';
      }
      moveEvent.preventDefault();
      this.scrollLeft = startScroll - dx;
    };

    const onUp = () => {
      drag.abort();
      if (!moved) return;

      const swallowClick = (/** @type {Event} */ clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
      };
      this.addEventListener('click', swallowClick, { capture: true, once: true });
      window.setTimeout(() => this.removeEventListener('click', swallowClick, { capture: true }), 80);

      this.removeAttribute('data-dragging');
      this.style.scrollBehavior = '';
      // Restoring snapping lets the browser settle on the nearest item.
      requestAnimationFrame(() => {
        this.style.scrollSnapType = '';
      });
      this.dispatchEvent(new CustomEvent('yv-drag-scroll:dragend', { bubbles: true }));
    };

    window.addEventListener('pointermove', onMove, { signal: drag.signal });
    window.addEventListener('pointerup', onUp, { signal: drag.signal });
    window.addEventListener('pointercancel', onUp, { signal: drag.signal });
  };
}

if (!customElements.get('yv-drag-scroll')) {
  customElements.define('yv-drag-scroll', YvDragScroll);
}
