/* ============================================================
   Modulo: Feature scroll engine — shared by section-feature-marquee
   and section-feature-ticker.

   Seamless icon-strip scroller, mirrors the announcement-bar /
   marquee engine:
   - Measure one cycle = width of the original items + their gaps.
   - Clone the set until the track >= viewport + 1 cycle, so off-screen
     content is always queued -> no gap, no jump on loop, with any
     number/length of items.
   - Set --modulo-fs-cycle so the CSS keyframe translates by exact
     pixels and lands on a clean boundary every loop.
   - Mark data-modulo-fs-ready="1" so the CSS animation attaches
     (no jumpy first paint), and degrade to a static centered row
     when JS is off.
   - Under prefers-reduced-motion we don't clone or animate; CSS wraps
     + centers the originals instead.

   Each [data-modulo-fs] viewport inits independently. The engine is
   intentionally BEM-agnostic: it only touches data- hooks + the
   shared --modulo-fs-cycle var, so both sections share it verbatim.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getGap(el) {
    var style = getComputedStyle(el);
    var n = parseFloat(style.columnGap || style.gap || '0');
    return isNaN(n) ? 0 : n;
  }

  function measureCycle(items, gap) {
    var w = 0;
    for (var i = 0; i < items.length; i++) {
      w += items[i].getBoundingClientRect().width;
    }
    // One gap per item so the loop boundary stays aligned between repeats.
    return w + gap * items.length;
  }

  // aria-hidden clones must also leave the tab order: items can be <a> when
  // the merchant sets a block link, and a focusable aria-hidden element is
  // an off-screen keyboard trap.
  function neutralizeClone(clone) {
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('role');
    if (clone.tagName === 'A') clone.setAttribute('tabindex', '-1');
    var focusables = clone.querySelectorAll('a, button, [tabindex]');
    for (var i = 0; i < focusables.length; i++) {
      focusables[i].setAttribute('tabindex', '-1');
    }
  }

  function cloneSet(track, items) {
    for (var i = 0; i < items.length; i++) {
      var clone = items[i].cloneNode(true);
      neutralizeClone(clone);
      track.appendChild(clone);
    }
  }

  function init(viewport) {
    if (REDUCE) return;
    var track = viewport.querySelector('[data-modulo-fs-track]');
    if (!track || track.dataset.moduloFsReady === '1') return;

    var items = Array.prototype.slice.call(track.children);
    if (items.length === 0) return;

    var gap = getGap(track);
    var cycle = measureCycle(items, gap);
    if (cycle <= 0) return; // layout not ready

    var width = viewport.offsetWidth || document.documentElement.clientWidth;
    var copiesNeeded = Math.max(2, Math.ceil((width + cycle) / cycle));
    for (var c = 0; c < copiesNeeded; c++) cloneSet(track, items);

    track.style.setProperty('--modulo-fs-cycle', cycle + 'px');
    track.dataset.moduloFsReady = '1';
  }

  function boot() {
    if (window.moduloLazyInit) {
      window.moduloLazyInit('[data-modulo-fs]', init);
    } else {
      var rows = document.querySelectorAll('[data-modulo-fs]');
      for (var i = 0; i < rows.length; i++) init(rows[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Re-fill on resize (only ever ADD clones — cheap and safe).
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (REDUCE) return;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var rows = document.querySelectorAll('[data-modulo-fs]');
      for (var i = 0; i < rows.length; i++) {
        var track = rows[i].querySelector('[data-modulo-fs-track]');
        if (!track || track.dataset.moduloFsReady !== '1') continue;
        var needed = rows[i].offsetWidth * 2;
        var safety = 0;
        while (track.scrollWidth < needed && safety < 4) {
          var snapshot = Array.prototype.slice.call(track.children);
          for (var j = 0; j < snapshot.length; j++) {
            var clone = snapshot[j].cloneNode(true);
            neutralizeClone(clone);
            track.appendChild(clone);
          }
          safety++;
        }
      }
    }, 200);
  });

  // Theme editor re-renders a single section without re-running this deferred
  // script; re-init on shopify:section:load so newly added/edited strips animate.
  document.addEventListener('shopify:section:load', function (e) {
    if (REDUCE) return;
    var scope = (e && e.target) || document;
    if (!scope.querySelectorAll) return;
    var rows = scope.querySelectorAll('[data-modulo-fs]');
    for (var i = 0; i < rows.length; i++) init(rows[i]);
  });
})();
