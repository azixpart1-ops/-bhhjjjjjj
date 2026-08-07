/* ============================================================
   Modulo: Sale Marquee — seamless scrolling-text engine.

   Mirrors section-marquee (clone-to-fill):
   - Measure one cycle = width of the original items + their gaps.
   - Clone the set until the track >= viewport + 1 cycle, so off-screen
     content is always queued -> no gap, no jump on loop.
   - Set --modulo-ms-cycle-width so CSS translates by exact pixels and
     lands on a clean boundary every loop.
   - Mark ready=1 so the CSS animation attaches (no jumpy first paint).
   - Under prefers-reduced-motion we don't clone or animate; CSS wraps +
     centers the originals instead.
   Each `[data-modulo-ms]` row inits independently (main + ghost row).
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

  function cloneSet(track, items) {
    for (var i = 0; i < items.length; i++) {
      var clone = items[i].cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('role');
      track.appendChild(clone);
    }
  }

  function init(row) {
    if (REDUCE) return;
    var track = row.querySelector('.modulo-ms__track');
    if (!track || track.dataset.moduloMsReady === '1') return;

    var items = Array.prototype.slice.call(track.children);
    if (items.length === 0) return;

    var gap = getGap(track);
    var cycle = measureCycle(items, gap);
    if (cycle <= 0) return; // layout not ready

    var viewport = row.offsetWidth || document.documentElement.clientWidth;
    var copiesNeeded = Math.max(2, Math.ceil((viewport + cycle) / cycle));
    for (var c = 0; c < copiesNeeded; c++) cloneSet(track, items);

    track.style.setProperty('--modulo-ms-cycle-width', cycle + 'px');
    track._msOrig = items.length; // remember original (pre-clone) count for re-measure
    track.dataset.moduloMsReady = '1';
  }

  // Re-derive the cycle from the ORIGINAL items — used after a custom web font
  // swaps in (font_display:swap changes glyph metrics after the one-time init
  // measurement, which would otherwise leave a seam once per loop).
  function recompute(track) {
    if (!track._msOrig || track.dataset.moduloMsReady !== '1') return;
    var items = Array.prototype.slice.call(track.children, 0, track._msOrig);
    var cycle = measureCycle(items, getGap(track));
    if (cycle > 0) track.style.setProperty('--modulo-ms-cycle-width', cycle + 'px');
  }

  function boot() {
    if (window.moduloLazyInit) {
      window.moduloLazyInit('[data-modulo-ms]', init);
    } else {
      var rows = document.querySelectorAll('[data-modulo-ms]');
      for (var i = 0; i < rows.length; i++) init(rows[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // If a custom font is in use, remeasure once it has swapped in. Tracks that
  // init AFTER the font loads already measured correctly; this only corrects
  // the ones measured against the fallback face.
  if (!REDUCE && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      var tracks = document.querySelectorAll('.modulo-ms__track[data-modulo-ms-ready="1"]');
      for (var i = 0; i < tracks.length; i++) recompute(tracks[i]);
    });
  }

  // Re-fill on resize (only ever ADD clones — cheap and safe).
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (REDUCE) return;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var rows = document.querySelectorAll('[data-modulo-ms]');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var track = row.querySelector('.modulo-ms__track');
        if (!track || track.dataset.moduloMsReady !== '1') continue;
        var needed = row.offsetWidth * 2;
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
