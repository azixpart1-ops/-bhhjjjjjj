/* Modulo: Hero Highlight — marker rotation (stable/hug) + welded band marquee. Vanilla, reduced-motion safe. */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INTERVAL = 2300, SWAP = 300;
  var markerList = [];

  /* ── marker ── */
  function measure(marker, text) {
    var sizer = marker.querySelector('.modulo-hh__msizer');
    if (!sizer) return 0;
    sizer.textContent = text;
    return Math.ceil(sizer.getBoundingClientRect().width);
  }
  function parseWords(marker) {
    var raw = marker.getAttribute('data-hh-words') || '';
    var out = [], parts = raw.split(',');
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i].replace(/^\s+|\s+$/g, '');
      if (t) out.push(t);
    }
    return out;
  }
  function sizeStable(marker, words) {
    var max = 0;
    for (var i = 0; i < words.length; i++) {
      var w = measure(marker, words[i]);
      if (w > max) max = w;
    }
    if (max > 0) { marker.style.width = max + 'px'; marker.style.minWidth = '0'; }
  }

  function initMarker(marker) {
    if (marker.dataset.hhMarkerInit === '1') return;
    var wordEl = marker.querySelector('.modulo-hh__mword');
    if (!wordEl) return;
    var words = parseWords(marker);
    if (!words.length) words = [wordEl.textContent];
    var fit = marker.getAttribute('data-hh-fit') === 'hug' ? 'hug' : 'stable';
    marker._hhWords = words;
    marker._hhFit = fit;
    marker.dataset.hhMarkerInit = '1';

    wordEl.textContent = words[0];
    if (fit === 'stable') {
      sizeStable(marker, words);
    } else {
      var w0 = measure(marker, words[0]);
      if (w0 > 0) { marker.style.width = w0 + 'px'; marker.style.minWidth = '0'; }
    }
    markerList.push(marker);

    if (REDUCE || words.length < 2) return;

    var i = 0;
    marker._hhTimer = setInterval(function () {
      if (document.hidden) return;
      i = (i + 1) % words.length;
      var next = words[i];
      wordEl.classList.add('is-out');
      setTimeout(function () {
        wordEl.textContent = next;
        if (fit === 'hug') { var wn = measure(marker, next); if (wn > 0) marker.style.width = wn + 'px'; }
        wordEl.classList.remove('is-out');
        wordEl.classList.add('is-in');      // reposition below, masked by opacity 0
        void wordEl.offsetHeight;           // commit the reposition
        wordEl.classList.remove('is-in');   // roll up into place
      }, SWAP);
    }, INTERVAL);
  }

  function teardownMarker(marker) {
    if (marker._hhTimer) { clearInterval(marker._hhTimer); marker._hhTimer = null; }
    marker.dataset.hhMarkerInit = '';
    var idx = markerList.indexOf(marker);
    if (idx > -1) markerList.splice(idx, 1);
  }

  /* ── band (clone-to-fill marquee) ── */
  function fillBand(track, minWidth) {
    var kids = Array.prototype.slice.call(track.children);
    if (!kids.length) return;
    var guard = 0;
    while (track.scrollWidth < minWidth && guard < 20) {
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i].cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        track.appendChild(c);
      }
      guard++;
    }
  }
  function initBand(track) {
    if (track.dataset.hhBandReady === '1') return;
    if (REDUCE) return; // CSS centers the single set
    if (!track.children.length) return;
    var cycle = track.scrollWidth; // width of one original set (incl. margins)
    if (cycle <= 0) return;
    var viewport = (track.parentElement && track.parentElement.offsetWidth) || cycle;
    fillBand(track, viewport + cycle);
    track.style.setProperty('--modulo-hh-band-cycle', cycle + 'px');
    track.dataset.hhBandReady = '1';
  }

  /* ── boot ── */
  function initScope(root) {
    var mk = root.querySelectorAll('[data-hh-marker]');
    for (var i = 0; i < mk.length; i++) initMarker(mk[i]);
    var bd = root.querySelectorAll('[data-hh-band]');
    for (var j = 0; j < bd.length; j++) initBand(bd[j]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initScope(document); });
  } else {
    initScope(document);
  }

  // theme editor lifecycle
  document.addEventListener('shopify:section:load', function (e) {
    if (e.target && e.target.querySelectorAll) initScope(e.target);
  });
  document.addEventListener('shopify:section:unload', function (e) {
    if (!e.target || !e.target.querySelectorAll) return;
    var mk = e.target.querySelectorAll('[data-hh-marker]');
    for (var i = 0; i < mk.length; i++) teardownMarker(mk[i]);
  });

  // resize: re-fit stable markers + top up band clones
  var rt;
  window.addEventListener('resize', function () {
    if (rt) clearTimeout(rt);
    rt = setTimeout(function () {
      for (var i = 0; i < markerList.length; i++) {
        var m = markerList[i];
        if (m._hhWords && m._hhFit === 'stable') sizeStable(m, m._hhWords);
      }
      if (REDUCE) return;
      var bd = document.querySelectorAll('[data-hh-band]');
      for (var j = 0; j < bd.length; j++) {
        var track = bd[j];
        if (track.dataset.hhBandReady === '1' && track.parentElement) {
          fillBand(track, track.parentElement.offsetWidth * 2);
        }
      }
    }, 150);
  });
})();
