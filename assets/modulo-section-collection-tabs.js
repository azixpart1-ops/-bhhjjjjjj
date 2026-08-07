(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initSection(root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-modulo-ct-tab]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-modulo-ct-panel]'));
    if (!panels.length) return;

    var prev = root.querySelector('[data-modulo-ct-prev]');
    var next = root.querySelector('[data-modulo-ct-next]');
    var shopAll = root.querySelector('[data-modulo-ct-shopall]');
    var current = 0;

    function activePanel() { return panels[current] || panels[0]; }

    function updateArrows() {
      if (!prev || !next) return;
      var p = activePanel();
      var scrollable = p.scrollWidth - p.clientWidth > 2;
      prev.disabled = !scrollable || p.scrollLeft <= 2;
      next.disabled = !scrollable || p.scrollLeft >= (p.scrollWidth - p.clientWidth - 2);
    }

    function setTab(i) {
      current = i;
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-modulo-ct-tab') === String(i);
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        if (on && shopAll) {
          var url = t.getAttribute('data-collection-url');
          if (url) shopAll.setAttribute('href', url);
        }
      });
      panels.forEach(function (p) {
        var on = p.getAttribute('data-modulo-ct-panel') === String(i);
        p.hidden = !on;
        p.classList.toggle('is-active', on);
        if (on) {
          p.scrollLeft = 0;
          if (!REDUCE) {
            p.classList.remove('is-entering');
            void p.offsetWidth; // restart entrance animation
            p.classList.add('is-entering');
          }
        }
      });
      updateArrows();
    }

    tabs.forEach(function (t, idx) {
      t.setAttribute('tabindex', idx === 0 ? '0' : '-1');
      t.addEventListener('click', function () {
        setTab(parseInt(t.getAttribute('data-modulo-ct-tab'), 10));
      });
      t.addEventListener('keydown', function (e) {
        var dir = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dir = 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dir = -1;
        else return;
        e.preventDefault();
        var target = tabs[(idx + dir + tabs.length) % tabs.length];
        target.focus();
        setTab(parseInt(target.getAttribute('data-modulo-ct-tab'), 10));
      });
    });

    function step(direction) {
      var p = activePanel();
      var card = p.querySelector('.modulo-ct__card');
      var styles = getComputedStyle(p);
      var gap = parseFloat(styles.columnGap || styles.gap || '22') || 22;
      var amount = card ? card.getBoundingClientRect().width + gap : 320;
      p.scrollBy({ left: direction * amount, behavior: REDUCE ? 'auto' : 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });

    panels.forEach(function (p) {
      p.addEventListener('scroll', function () {
        if (p === activePanel()) updateArrows();
      }, { passive: true });
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateArrows, 120);
    });

    updateArrows();
  }

  function bootstrap() {
    if (window.moduloLazyInit) {
      window.moduloLazyInit('[data-modulo-ct]', initSection);
    } else {
      var els = document.querySelectorAll('[data-modulo-ct]');
      for (var i = 0; i < els.length; i++) initSection(els[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
