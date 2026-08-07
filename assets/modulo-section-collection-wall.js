/* Modulo: Collection Wall — tab switching + traveling ink underline.
   Reduced motion is handled entirely in CSS, so there's no REDUCE gate here:
   the tabs must still switch when motion is reduced, only the travel animates. */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // ONE window resize listener for the whole page, re-querying live nodes each
  // time. A per-instance listener would leak on every theme-editor re-render:
  // the fresh node lacks the init guard so initSection re-runs, and the old
  // handler's closure pins the detached node in memory.
  var globalResizeBound = false;
  function bindGlobalResize() {
    if (globalResizeBound) return;
    globalResizeBound = true;
    window.addEventListener('resize', function () {
      var live = document.querySelectorAll('[data-modulo-cw]');
      for (var i = 0; i < live.length; i++) {
        if (typeof live[i].__moduloCwSync === 'function') live[i].__moduloCwSync();
      }
    }, { passive: true });
  }

  function initSection(root) {
    if (!root || root.dataset.cwBound === '1') return;
    root.dataset.cwBound = '1';

    var rail = root.querySelector('[data-cw-tablist]');
    if (!rail) return;
    // The bar lives on the rail's non-scrolling parent (see the CSS note: a
    // scroll container would clip a bar sitting at bottom:-1px).
    var inkHost = rail.parentElement;
    if (!inkHost) return;

    var tabs = Array.prototype.slice.call(rail.querySelectorAll('[data-cw-tab]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-cw-panel]'));
    if (tabs.length < 2) return;

    // offsetLeft is a LAYOUT position measured from the offsetParent (inkHost,
    // the only positioned ancestor) and is unaffected by scrolling — so the
    // rail's scrollLeft must be subtracted to get the tab's VISUAL position.
    // The scroll listener below re-runs this, keeping the bar glued to its tab
    // while the rail scrolls.
    function moveInk(tab) {
      if (!tab) return;
      inkHost.style.setProperty('--ink-x', (tab.offsetLeft - rail.scrollLeft) + 'px');
      inkHost.style.setProperty('--ink-w', tab.offsetWidth + 'px');
    }

    function activate(tab, moveFocus) {
      var target = tab.getAttribute('data-cw-tab');

      // aria-selected is flipped BEFORE measuring: the active tab's CSS bumps
      // font-weight 500 -> 600, which reflows its width. Measuring first would
      // size the bar to the pre-bold width.
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
      });

      // Measure BEFORE the panel swap. moveInk's offsetLeft read forces a
      // synchronous layout; doing it here resolves against a tree where only
      // the tablist is dirty (cheap). After the swap it would pull the whole
      // new panel's relayout forward into the click handler — an INP hit on
      // every tab press.
      moveInk(tab);

      // Matched by data attribute, never by array index — resilient to blocks
      // being reordered in the theme editor.
      panels.forEach(function (p) {
        var on = p.getAttribute('data-cw-panel') === target;
        p.classList.toggle('is-active', on);
        if (on) { p.removeAttribute('hidden'); } else { p.setAttribute('hidden', ''); }
      });

      if (moveFocus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { activate(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var idx = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') idx = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') idx = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') idx = 0;
        else if (e.key === 'End') idx = tabs.length - 1;
        if (idx !== null) {
          e.preventDefault();
          activate(tabs[idx], true);
        }
      });
    });

    // Re-derive the target from the DOM rather than closing over a stale ref,
    // so sync() stays correct after any activate().
    function sync() {
      moveInk(rail.querySelector('[data-cw-tab][aria-selected="true"]') || tabs[0]);
    }
    root.__moduloCwSync = sync;

    requestAnimationFrame(sync);
    bindGlobalResize();
    // Keeps the bar glued to its tab while the rail scrolls (moveInk subtracts
    // scrollLeft, so this genuinely changes the result).
    rail.addEventListener('scroll', sync, { passive: true });
    // The section is font-family: inherit — a webfont swapping in after first
    // paint changes tab widths and would otherwise strand the bar.
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(sync); }
  }

  function bootstrap(scope) {
    var els = (scope || document).querySelectorAll('[data-modulo-cw]');
    for (var i = 0; i < els.length; i++) initSection(els[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bootstrap(); });
  } else {
    bootstrap();
  }

  // Theme editor: re-init on section re-render.
  document.addEventListener('shopify:section:load', function (e) {
    bootstrap(e.target || document);
  });
})();
