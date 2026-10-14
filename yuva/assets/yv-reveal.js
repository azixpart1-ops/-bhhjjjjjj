import { prefersReducedMotion } from '@theme/utilities';

/**
 * Yuva scroll reveal (spec part 3 §0.5 item 5, Horizon authoring guide §10.3).
 *
 * Reveals [data-yv-reveal] elements the first time 15% of them enters the viewport. The visual
 * states are styled in assets/yv-base.css (body.yv-animate; --yv-reveal-distance, --yv-reveal-duration).
 * Only elements that start below the fold are hidden, and only by this script, so a failed or
 * blocked script never hides content. Disabled in the theme editor and for visitors who prefer
 * reduced motion. Loaded only when settings.yv_enable_animation is on.
 *
 * Attribute values:
 * - data-yv-reveal / data-yv-reveal="fade-up"   fade up (default)
 * - data-yv-reveal="fade"                        fade only
 * - data-yv-reveal="zoom-out"                    fade in while scaling down to 1 (banner images)
 * The script stores that effect in data-yv-reveal-effect and then uses data-yv-reveal as the state:
 * "pending" (hidden, waiting) → "done" (revealed). Optional inline --yv-reveal-delay staggers siblings.
 *
 * Elements added later (Section Rendering API, infinite scroll, quick view) are picked up automatically.
 */
const SELECTOR = '[data-yv-reveal]:not([data-yv-reveal="done"]):not([data-yv-reveal="pending"])';
const EFFECTS = new Set(['fade', 'zoom-out', 'fade-up']);

function init() {
  if (prefersReducedMotion() || window.Shopify?.designMode || !('IntersectionObserver' in window)) return;

  /** @type {WeakSet<Element>} */
  const seen = new WeakSet();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const element = /** @type {HTMLElement} */ (entry.target);

        if (!seen.has(element)) {
          // First report: decide whether this element starts below the fold.
          seen.add(element);
          if (entry.isIntersecting) {
            element.dataset.yvReveal = 'done';
            observer.unobserve(element);
          } else {
            element.dataset.yvReveal = 'pending';
          }
          continue;
        }

        if (entry.isIntersecting) {
          element.dataset.yvReveal = 'done';
          observer.unobserve(element);
        }
      }
    },
    { threshold: 0.15 }
  );

  /** @param {ParentNode} root */
  const scan = (root) => {
    const elements = /** @type {HTMLElement[]} */ ([...root.querySelectorAll(SELECTOR)]);
    if (root instanceof HTMLElement && root.matches(SELECTOR)) elements.unshift(root);

    for (const element of elements) {
      const effect = element.dataset.yvReveal || '';
      if (EFFECTS.has(effect)) element.dataset.yvRevealEffect = effect;
      observer.observe(element);
    }
  };

  scan(document);

  // Pick up content inserted after load, batched to one scan per frame.
  /** @type {Set<HTMLElement>} */
  const queue = new Set();
  let frame = 0;
  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) queue.add(node);
      }
    }
    if (!queue.size || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const node of queue) if (node.isConnected) scan(node);
      queue.clear();
    });
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
