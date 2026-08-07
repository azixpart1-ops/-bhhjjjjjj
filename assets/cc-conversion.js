/*
  Comfort Crest — conversion behaviours.

  Deliberately small and dependency-free: one observer and a little DOM
  work. Everything degrades to a perfectly usable page with JS off,
  so this file is loaded `defer` and never blocks render.
*/
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------- Reveal */

  function initReveal(root) {
    const targets = (root || document).querySelectorAll('[data-cc-reveal]:not(.is-revealed)');
    if (!targets.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const delay = Number(entry.target.dataset.ccReveal) || 0;
          window.setTimeout(() => entry.target.classList.add('is-revealed'), delay);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    targets.forEach((el) => observer.observe(el));
  }

  /* --------------------------------------------------------- Marquee */

  /*
    Duplicate the track content so the -50% keyframe loops seamlessly no
    matter how many items the merchant added.
  */
  function initMarquee(root) {
    (root || document).querySelectorAll('[data-cc-marquee]:not([data-cc-marquee-ready])').forEach((track) => {
      track.setAttribute('data-cc-marquee-ready', '');
      track.innerHTML += track.innerHTML;
      track.querySelectorAll(':scope > *').forEach((child, index, all) => {
        if (index >= all.length / 2) child.setAttribute('aria-hidden', 'true');
      });
    });
  }

  /* ------------------------------------------------------------ Boot */

  function boot(root) {
    initReveal(root);
    initMarquee(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(document));
  } else {
    boot(document);
  }

  // Theme editor: re-run when a section is added or re-rendered.
  document.addEventListener('shopify:section:load', (event) => boot(event.target));
})();
