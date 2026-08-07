/* ==========================================================================
   PawLunova — conversion homepage behaviour (Shopify build)

   Differences from the standalone build: the theme owns the header, nav,
   announcement bar and footer, so none of that lives here. Product data for
   the bed finder is rendered by Liquid into #pl-beds, so prices, stock and
   images stay live without touching this file.

   Safe to include from more than one section — it initialises once.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__plHomeInit) return;
  window.__plHomeInit = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {

    /* ----------------------------------------------------------------------
       Scroll reveal
       ---------------------------------------------------------------------- */
    var revealables = document.querySelectorAll('.pl .reveal:not([data-in])');

    if (!('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.setAttribute('data-in', ''); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute('data-in', '');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      revealables.forEach(function (el) { io.observe(el); });
    }

    /* ----------------------------------------------------------------------
       Sticky CTA — appears once the hero has gone, hides near the footer
       ---------------------------------------------------------------------- */
    var sticky = document.getElementById('plStickyCta');
    var ticking = false;

    function onScroll() {
      if (sticky) {
        var y = window.scrollY || window.pageYOffset;
        var docH = document.documentElement.scrollHeight;
        var nearEnd = (y + window.innerHeight) > (docH - 640);
        sticky.toggleAttribute('data-show', y > window.innerHeight * 0.7 && !nearEnd);
      }
      ticking = false;
    }
    if (sticky) {
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }, { passive: true });
      onScroll();
    }

    /* ----------------------------------------------------------------------
       FAQ accordion
       ---------------------------------------------------------------------- */
    var faq = document.getElementById('plFaq');
    if (faq) {
      faq.addEventListener('click', function (e) {
        var btn = e.target.closest('.faq__q');
        if (!btn) return;
        var item = btn.closest('.faq__item');
        var open = item.hasAttribute('data-open');

        faq.querySelectorAll('.faq__item[data-open]').forEach(function (el) {
          el.removeAttribute('data-open');
          el.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
        });

        if (!open) {
          item.setAttribute('data-open', '');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    /* ----------------------------------------------------------------------
       Count-up
       ---------------------------------------------------------------------- */
    var counters = document.querySelectorAll('.pl [data-count]');
    if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          cio.unobserve(el);

          var target = parseFloat(el.getAttribute('data-count'));
          var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
          var suffix = el.querySelector('sup, small');
          var suffixHTML = suffix ? suffix.outerHTML : '';
          var start = performance.now();

          function frame(now) {
            var t = Math.min((now - start) / 1100, 1);
            var eased = 1 - Math.pow(1 - t, 3);
            el.innerHTML = (target * eased).toFixed(decimals) + suffixHTML;
            if (t < 1) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { cio.observe(el); });
    }

    /* ----------------------------------------------------------------------
       Bed finder
       ---------------------------------------------------------------------- */
    var app = document.getElementById('plFinder');
    var dataEl = document.getElementById('pl-beds');
    if (!app || !dataEl) return;

    var BEDS;
    try {
      BEDS = JSON.parse(dataEl.textContent);
    } catch (err) {
      return; // leave the first question standing rather than showing a broken result
    }

    /* style|joints → bed key, with a size override where a bed does not come
       small enough or large enough for the dog. Keys match the handles listed
       in the section settings. */
    var MATRIX = {
      'nest|fine':         { all: 'nest_fine' },
      'nest|slowing':      { all: 'nest_slowing' },
      'nest|diagnosed':    { small: 'nest_diagnosed_sm', medium: 'nest_diagnosed_sm', large: 'nest_diagnosed_lg' },
      'bolster|fine':      { all: 'bolster_fine' },
      'bolster|slowing':   { all: 'bolster_slowing' },
      'bolster|diagnosed': { small: 'bolster_diagnosed_sm', medium: 'bolster_diagnosed_sm', large: 'bolster_diagnosed_lg' },
      'flat|fine':         { all: 'flat_fine' },
      'flat|slowing':      { all: 'flat_slowing' },
      'flat|diagnosed':    { all: 'flat_diagnosed' }
    };

    var SIZE_COPY = {
      small:  'Recommended size: Small — for dogs under 10kg',
      medium: 'Recommended size: Medium — for dogs 10–25kg',
      large:  'Recommended size: Large — for dogs over 25kg'
    };

    var steps   = app.querySelectorAll('.finder__step');
    var bar     = document.getElementById('plFinderBar');
    var label   = document.getElementById('plFinderStepLabel');
    var answers = { style: null, joints: null, size: null };
    var current = 0;

    function show(step) {
      current = step;
      steps.forEach(function (el) {
        el.toggleAttribute('data-active', Number(el.getAttribute('data-step')) === step);
      });
      if (bar) bar.style.width = Math.min(((step + 1) / 3) * 100, 100) + '%';
      if (label) label.textContent = step < 3 ? 'Question ' + (step + 1) + ' of 3' : 'Your match';
    }

    function render() {
      var entry = MATRIX[answers.style + '|' + answers.joints];
      if (!entry) return;
      var bed = BEDS[entry.all || entry[answers.size]];
      if (!bed || !bed.url) return;

      var img = document.getElementById('plResultImg');
      img.src = bed.img;
      img.alt = bed.title;

      document.getElementById('plResultName').textContent = bed.title;
      document.getElementById('plResultWhy').textContent  = bed.why;
      document.getElementById('plResultPrice').textContent =
        (bed.single ? '' : 'From ') + bed.price;
      document.getElementById('plResultSize').textContent =
        bed.single ? (bed.size_note || '') : (SIZE_COPY[answers.size] || '');

      var link = document.getElementById('plResultLink');
      link.href = bed.url;
      document.getElementById('plResultLinkText').textContent = 'See the ' + bed.short;

      // Live inventory, straight from Liquid — never a hardcoded number.
      var stock = document.getElementById('plResultStock');
      if (bed.available === false) {
        stock.textContent = 'Back in stock soon';
        stock.hidden = false;
      } else if (bed.stock > 0 && bed.stock <= 3) {
        stock.textContent = 'Only ' + bed.stock + ' left in stock';
        stock.hidden = false;
      } else {
        stock.hidden = true;
      }
    }

    app.addEventListener('click', function (e) {
      var opt = e.target.closest('.opt');
      if (opt) {
        answers[opt.getAttribute('data-q')] = opt.getAttribute('data-value');
        opt.closest('.finder__options').querySelectorAll('.opt').forEach(function (el) {
          el.setAttribute('aria-pressed', String(el === opt));
        });
        window.setTimeout(function () {
          if (current < 2) { show(current + 1); }
          else { render(); show(3); }
        }, reduceMotion ? 0 : 170);
        return;
      }

      if (e.target.closest('[data-back]')) { show(Math.max(0, current - 1)); return; }

      if (e.target.closest('#plFinderRestart')) {
        answers = { style: null, joints: null, size: null };
        app.querySelectorAll('.opt').forEach(function (el) { el.setAttribute('aria-pressed', 'false'); });
        show(0);
        app.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Theme editor re-renders sections without a page load
  document.addEventListener('shopify:section:load', function () {
    window.__plHomeInit = false;
    init();
    window.__plHomeInit = true;
  });
})();
