/* ============================================================
   Modulo: Marquee Bar — seamless ticker (clone-to-fill).

   Mirrors the announcement-bar / logo-cloud engine:
   - Measure one cycle = width of the original items + their gaps.
   - Clone the set until the track >= viewport + 1 cycle, so off-screen
     content is always queued -> no gap, no jump on loop, with any
     number/length of messages.
   - Set --modulo-am-cycle-width so CSS translates by exact pixels and
     lands on a clean boundary every loop.
   - Mark data-modulo-am-ready=1 so the CSS animation attaches (no jumpy
     first paint; degrades to a static clipped row if JS is off).
   - Under prefers-reduced-motion we don't clone or animate at all;
     CSS wraps + centers the original messages instead.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getGap(el) {
    var style = getComputedStyle(el);
    var raw = style.columnGap || style.gap || '0';
    var n = parseFloat(raw);
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

  function cloneSet(track, items) {
    for (var i = 0; i < items.length; i++) {
      var clone = items[i].cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('role');
      track.appendChild(clone);
    }
  }

  function init(el) {
    if (REDUCE) return;
    var viewport = el.querySelector('.modulo-am__viewport');
    var track = el.querySelector('.modulo-am__track');
    if (!viewport || !track || track.dataset.moduloAmReady === '1') return;

    var items = Array.prototype.slice.call(track.children);
    if (items.length === 0) return;

    var gap = getGap(track);
    var cycle = measureCycle(items, gap);
    if (cycle <= 0) return; // layout not ready

    var vpWidth = viewport.clientWidth || document.documentElement.clientWidth;
    var copiesNeeded = Math.max(2, Math.ceil((vpWidth + cycle) / cycle));
    for (var c = 0; c < copiesNeeded; c++) cloneSet(track, items);

    track.style.setProperty('--modulo-am-cycle-width', cycle + 'px');
    track.dataset.moduloAmReady = '1';
  }

  function boot() {
    var els = document.querySelectorAll('[data-modulo-am]');
    for (var i = 0; i < els.length; i++) init(els[i]);
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
      var els = document.querySelectorAll('[data-modulo-am]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var viewport = el.querySelector('.modulo-am__viewport');
        var track = el.querySelector('.modulo-am__track');
        if (!viewport || !track || track.dataset.moduloAmReady !== '1') continue;
        var needed = viewport.clientWidth * 2;
        var safety = 0;
        while (track.scrollWidth < needed && safety < 4) {
          var snapshot = Array.prototype.slice.call(track.children);
          for (var j = 0; j < snapshot.length; j++) {
            var clone = snapshot[j].cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.removeAttribute('role');
            track.appendChild(clone);
          }
          safety++;
        }
      }
    }, 200);
  });
})();
