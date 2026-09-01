/* ==========================================================================
   ComfortCrest — behaviour
   --------------------------------------------------------------------------
   Loaded once by cc-assets. Every cc-* section renders that snippet, so this
   file can be requested several times per page; the guard below makes the
   second and later evaluations no-ops.

   Everything here is progressive enhancement. With JS off or failed, content
   is visible, links work, and forms submit — see .no-js in cc-core.css.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__ccApp) return;
  window.__ccApp = true;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Reveal on scroll -------------------------------------------------- */
  function initReveal(root) {
    var nodes = (root || document).querySelectorAll('.cc-reveal:not([data-cc-seen])');
    if (!nodes.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.setAttribute('data-cc-seen', ''); n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    nodes.forEach(function (n) { n.setAttribute('data-cc-seen', ''); io.observe(n); });
  }

  /* --- Announcement ticker (phones only, CSS hides the rest) ------------- */
  function initTicker(root) {
    (root || document).querySelectorAll('[data-cc-ticker]:not([data-cc-bound])').forEach(function (bar) {
      bar.setAttribute('data-cc-bound', '');
      var items = bar.querySelectorAll('.cc-ticker__item');
      if (items.length < 2) { if (items[0]) items[0].classList.add('is-on'); return; }
      var i = 0;
      items[0].classList.add('is-on');
      // Only rotates where the layout actually stacks them; above 900px every
      // message is on screen at once and swapping would just make them blink.
      var mq = window.matchMedia('(max-width: 900px)');
      setInterval(function () {
        if (!mq.matches || reduced) return;
        items[i].classList.remove('is-on');
        i = (i + 1) % items.length;
        items[i].classList.add('is-on');
      }, 4200);
    });
  }

  /* --- Bed finder -------------------------------------------------------- */
  /* Three chip groups narrow to a collection URL with size and type filters
     appended. Nothing is required: an unanswered question is simply not
     added to the query, so the button always leads somewhere sensible. */
  function initFinder(root) {
    (root || document).querySelectorAll('[data-cc-finder]:not([data-cc-bound])').forEach(function (form) {
      form.setAttribute('data-cc-bound', '');
      var out = form.querySelector('[data-cc-finder-go]');
      var summary = form.querySelector('[data-cc-finder-summary]');
      if (!out) return;

      var picked = {};

      function base() {
        var t = picked.type;
        return (t && t.indexOf('/') === 0) ? t : (form.getAttribute('data-default-url') || '/collections/all');
      }

      function update() {
        var url = base();
        var params = [];
        if (picked.size) params.push('filter.v.option.size=' + encodeURIComponent(picked.size));
        if (picked.budget) params.push(picked.budget);
        out.setAttribute('href', url + (params.length ? '?' + params.join('&') : ''));

        if (summary) {
          var bits = [];
          if (picked.typeLabel) bits.push(picked.typeLabel);
          if (picked.sizeLabel) bits.push(picked.sizeLabel);
          if (picked.budgetLabel) bits.push(picked.budgetLabel);
          summary.textContent = bits.length
            ? bits.join(' · ')
            : (summary.getAttribute('data-empty') || 'Answer as many as you like');
        }
      }

      form.querySelectorAll('.cc-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var group = chip.getAttribute('data-group');
          var on = chip.getAttribute('aria-pressed') === 'true';
          form.querySelectorAll('.cc-chip[data-group="' + group + '"]').forEach(function (c) {
            c.setAttribute('aria-pressed', 'false');
          });
          if (on) {
            delete picked[group];
            delete picked[group + 'Label'];
          } else {
            chip.setAttribute('aria-pressed', 'true');
            picked[group] = chip.getAttribute('data-value') || '';
            picked[group + 'Label'] = (chip.getAttribute('data-label') || chip.textContent).trim();
          }
          update();
        });
      });

      update();
    });
  }

  /* --- Accordion: one open at a time within a group ---------------------- */
  function initAccordion(root) {
    (root || document).querySelectorAll('[data-cc-acc-single]:not([data-cc-bound])').forEach(function (group) {
      group.setAttribute('data-cc-bound', '');
      var items = group.querySelectorAll('details');
      items.forEach(function (d) {
        d.addEventListener('toggle', function () {
          if (!d.open) return;
          items.forEach(function (o) { if (o !== d) o.open = false; });
        });
      });
    });
  }

  /* --- Newsletter/sample forms: keep the success state on the page ------- */
  function initFormState(root) {
    (root || document).querySelectorAll('[data-cc-form]:not([data-cc-bound])').forEach(function (form) {
      form.setAttribute('data-cc-bound', '');
      form.addEventListener('submit', function () {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.setAttribute('aria-busy', 'true'); btn.disabled = true; }
      });
    });
  }

  function boot(root) {
    initReveal(root);
    initTicker(root);
    initFinder(root);
    initAccordion(root);
    initFormState(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  /* Theme editor re-renders a section's markup in place. Re-run against the
     new subtree so a section the merchant just edited still animates and its
     chips still respond. */
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
  document.addEventListener('shopify:section:select', function (e) { boot(e.target); });
})();
