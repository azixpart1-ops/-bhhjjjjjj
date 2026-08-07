/* ==========================================================================
   PawLunova — homepage behaviour
   No dependencies. Everything degrades to a usable page without JS.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     1. Scroll reveal
     Purpose: preventing a jarring change as sections enter. Marketing tier,
     so a 600ms curve is fine here where 300ms would be the UI ceiling.
     ---------------------------------------------------------------------- */
  var revealables = document.querySelectorAll('.reveal');

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

  /* ------------------------------------------------------------------------
     2. Header state — shadow + opacity once content scrolls under it
     ---------------------------------------------------------------------- */
  var header = document.getElementById('header');
  var sticky = document.getElementById('stickyCta');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.toggleAttribute('data-scrolled', y > 8);
    // Sticky CTA appears once the hero CTA has scrolled away, hides at the footer
    if (sticky) {
      var docH = document.documentElement.scrollHeight;
      var nearEnd = (y + window.innerHeight) > (docH - 640);
      sticky.toggleAttribute('data-show', y > window.innerHeight * 0.7 && !nearEnd);
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScroll);
  }, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------------
     2b. Mobile menu
     Enters and exits along the same path (down out of the header, back up
     into it), so the panel keeps its relationship to the button.
     ---------------------------------------------------------------------- */
  var menuBtn = document.getElementById('menuBtn');
  var mobileNav = document.getElementById('mobileNav');

  if (menuBtn && mobileNav) {
    var closeTimer;

    function setMenu(open) {
      window.clearTimeout(closeTimer);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (open) {
        // anchor the panel to wherever the header actually sits right now
        var bottom = header ? header.getBoundingClientRect().bottom : 62;
        mobileNav.style.setProperty('--nav-top', Math.max(bottom, 0) + 'px');
        mobileNav.hidden = false;
        // next frame, so the transition has a start value to move from
        requestAnimationFrame(function () { mobileNav.setAttribute('data-open', ''); });
      } else {
        mobileNav.removeAttribute('data-open');
        closeTimer = window.setTimeout(function () { mobileNav.hidden = true; }, reduceMotion ? 180 : 240);
      }
    }

    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });

    mobileNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuBtn.focus();
      }
    });

    window.matchMedia('(min-width: 1080px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ------------------------------------------------------------------------
     3. Announcement rotator
     Transitions (not keyframes) so a fast re-trigger retargets cleanly.
     ---------------------------------------------------------------------- */
  var announce = document.getElementById('announce');
  if (announce && !reduceMotion) {
    var items = announce.querySelectorAll('.announce__item');
    var idx = 0;
    setInterval(function () {
      if (document.hidden) return;
      items[idx].removeAttribute('data-active');
      idx = (idx + 1) % items.length;
      items[idx].setAttribute('data-active', '');
    }, 4200);
  }

  /* ------------------------------------------------------------------------
     4. FAQ accordion
     Opens via grid-template-rows 0fr → 1fr: animatable, no layout thrash,
     and the content keeps its natural height.
     ---------------------------------------------------------------------- */
  var faq = document.getElementById('faq');
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

  /* ------------------------------------------------------------------------
     5. Count-up for the headline numbers
     Tabular numerals in CSS keep the digits from shifting as they climb.
     ---------------------------------------------------------------------- */
  var counters = document.querySelectorAll('[data-count]');
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
        var duration = 1100;

        function frame(now) {
          var t = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - t, 3);           // ease-out cubic
          var value = (target * eased).toFixed(decimals);
          el.innerHTML = value + suffixHTML;
          if (t < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ------------------------------------------------------------------------
     6. Bed finder
     Live product data — name, handle, "from" price and stock read from the
     PawLunova Shopify catalogue. See README for the refresh procedure.
     ---------------------------------------------------------------------- */
  var BEDS = {
    buttermere_boucle: {
      name: 'The Buttermere Bouclé Nest Bed',
      short: 'Buttermere',
      handle: 'buttermere-boucle-nest-dog-bed',
      img: 'buttermere_boucle',
      from: '£69.00',
      stock: 8,
      alt: 'The Buttermere Bouclé Nest Bed, a deep-walled cream nest bed',
      why: 'Deep bouclé walls to lean into and a cloud-soft nest to sink into — the bed your dog has been trying to build out of your cushions. Made for the dog who circles twice and curls tight.'
    },
    windermere_nest: {
      name: 'The Windermere Nest Orthopaedic Bed',
      short: 'Windermere Nest',
      handle: 'windermere-high-wall-nest-bed',
      img: 'windermere_nest',
      from: '£69.00',
      stock: 6,
      alt: 'The Windermere Nest Orthopaedic Dog Bed with high walls, in a bright room',
      why: 'High walls to burrow into, over an orthopaedic base that does not flatten. For the dog who tucks their nose under their tail and wants something solid at their back — and whose mornings have started getting slower.'
    },
    coniston_ortho: {
      name: 'Coniston Orthopaedic Dog Bed',
      short: 'Coniston',
      handle: 'coniston-orthopaedic-dog-bed',
      img: 'coniston_ortho',
      from: '£99.00',
      stock: 5,
      alt: 'Coniston Orthopaedic Dog Bed with a dog resting inside',
      why: 'Pressure-relief support built for the dog who has met you at the door for years, and for whom getting up is now the hard part. Raised sides to curl against, memory foam underneath for the joints.'
    },
    langdale: {
      name: 'The Langdale Raised-Edge Orthopaedic Bed',
      short: 'Langdale',
      handle: 'dog-bed-kimba-orthopaedic-thick-padding-raised-edge',
      img: 'langdale',
      from: '£109.00',
      stock: 2,
      alt: 'The Langdale Raised-Edge Orthopaedic Dog Bed with a large dog stretched across it',
      why: 'A raised edge to lean into and a firm orthopaedic base that holds its shape — built for a big dog who curls, and whose joints need the support to still be there in year five.'
    },
    harrogate: {
      name: 'The Harrogate Heritage Dog Bed',
      short: 'Harrogate',
      handle: 'harrogate-heritage-dog-bed',
      img: 'harrogate',
      from: '£69.00',
      stock: 12,
      alt: 'The Harrogate Heritage Dog Bed with a golden retriever asleep on it',
      why: 'Deep charcoal sides, warm beige trim, and a bolster on every side to hook a chin over. Our most-reviewed bed — and the one owners of healthy, happy leaners keep coming back for.'
    },
    grasmere_sofa: {
      name: 'The Grasmere Bolster Sofa Dog Bed',
      short: 'Grasmere',
      handle: 'the-grasmere-bolster-sofa-dog-bed',
      img: 'grasmere_sofa',
      from: '£79.00',
      stock: 7,
      alt: 'The Grasmere Bolster Sofa Dog Bed with an older dog resting its head on the bolster',
      why: 'Built for the dog who does not curl up, they collapse — legs everywhere, chin hooked over the arm. The raised bolster takes the weight off the neck and shoulders as they start to stiffen.'
    },
    grasmere_ortho: {
      name: 'The Grasmere Orthopaedic Sofa Bed',
      short: 'Grasmere Orthopaedic',
      handle: 'the-grasmere-orthopaedic-sofa-bed',
      img: 'grasmere_ortho',
      from: '£89.00',
      stock: 4,
      alt: 'The Grasmere Orthopaedic Sofa Bed in a warm living room',
      why: 'A proper sofa shape over an orthopaedic core, so there is a bolster to lean on and real support underneath. The one we point diagnosed dogs towards when they still want the sofa silhouette.'
    },
    borrowdale: {
      name: 'The Borrowdale Orthopaedic Dog Bed',
      short: 'Borrowdale',
      handle: 'the-borrowdale-orthopaedic-dog-bed',
      img: 'borrowdale',
      from: '£154.00',
      stock: 2,
      single: true,
      sizeNote: 'One size — Large, for dogs over 25kg',
      alt: 'The Borrowdale Orthopaedic Dog Bed, a four-sided bolster memory foam bed',
      why: 'He used to drop. Now he lowers himself. Four-sided bolster over a 50kg/m³ memory foam core — something to lean into whichever way he turns, and support that will not bottom out under a big dog.'
    },
    sprawler: {
      name: 'The Sprawler Flat Orthopaedic Dog Bed',
      short: 'Sprawler',
      handle: 'dream-paws-geometric-bed-in-grey-modern-comfort-that-goes-with-everything',
      img: 'sprawler',
      from: '£59.00',
      stock: 5,
      single: true,
      sizeNote: 'One standard size',
      alt: 'The Sprawler Flat Orthopaedic Dog Bed in a modern grey quilted finish',
      why: 'No walls, no bolsters, nothing to get in the way — just a flat orthopaedic surface big enough to stretch out across. For the dog who wants the whole thing and none of the fuss.'
    },
    ambleside: {
      name: 'Ambleside Memory Foam Bed',
      short: 'Ambleside',
      handle: 'ambleside-memory-foam-dog-bed',
      img: 'ambleside',
      from: '£124.00',
      stock: 7,
      alt: 'Ambleside Memory Foam Bed with a dog lying flat on its side',
      why: 'Edge-to-edge memory foam, so there is no dead space and no half-on, half-off. Watch where he actually sleeps: flat on his side, legs at full stretch. This is the bed built for that dog as he starts to stiffen.'
    },
    kendal_cord: {
      name: 'The Kendal Corduroy Orthopaedic Bed',
      short: 'Kendal',
      handle: 'kendal-corduroy-orthopaedic-dog-bed',
      img: 'kendal_cord',
      from: '£169.00',
      stock: 9,
      alt: 'The Kendal Corduroy Orthopaedic Bed in a bright living room',
      why: 'Our most supportive build, for the dog whose mornings have got slower. A pause at the bottom of the stairs, a longer stretch before the first step — this is the bed we make for exactly that, with room to sprawl right across it.'
    }
  };

  /* style|joints → bed, with a size override where a bed does not come small
     enough or large enough for the dog. */
  var MATRIX = {
    'nest|fine':          { all: 'buttermere_boucle' },
    'nest|slowing':       { all: 'windermere_nest' },
    'nest|diagnosed':     { small: 'coniston_ortho', medium: 'coniston_ortho', large: 'langdale' },
    'bolster|fine':       { all: 'harrogate' },
    'bolster|slowing':    { all: 'grasmere_sofa' },
    'bolster|diagnosed':  { small: 'grasmere_ortho', medium: 'grasmere_ortho', large: 'borrowdale' },
    'flat|fine':          { all: 'sprawler' },
    'flat|slowing':       { all: 'ambleside' },
    'flat|diagnosed':     { all: 'kendal_cord' }
  };

  var SIZE_COPY = {
    small:  'Recommended size: Small — for dogs under 10kg',
    medium: 'Recommended size: Medium — for dogs 10–25kg',
    large:  'Recommended size: Large — for dogs over 25kg'
  };

  var app = document.getElementById('finderApp');
  if (!app) return;

  var steps   = app.querySelectorAll('.finder__step');
  var bar     = document.getElementById('finderBar');
  var label   = document.getElementById('finderStepLabel');
  var answers = { style: null, joints: null, size: null };
  var current = 0;

  function show(step) {
    current = step;
    steps.forEach(function (el) {
      el.toggleAttribute('data-active', Number(el.getAttribute('data-step')) === step);
    });
    var pct = Math.min(((step + 1) / 3) * 100, 100);
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = step < 3 ? 'Question ' + (step + 1) + ' of 3' : 'Your match';
  }

  function render() {
    var key = answers.style + '|' + answers.joints;
    var entry = MATRIX[key];
    if (!entry) return;

    var bed = BEDS[entry.all || entry[answers.size]];
    if (!bed) return;

    var img = document.getElementById('rImg');
    img.src = 'assets/img/' + bed.img + '@sm.jpg';
    img.alt = bed.alt;

    document.getElementById('rName').textContent = bed.name;
    document.getElementById('rWhy').textContent = bed.why;
    // "From" only where the bed actually has more than one size
    document.getElementById('rPrice').textContent = (bed.single ? '' : 'From ') + bed.from;
    document.getElementById('rSize').textContent = bed.single
      ? bed.sizeNote
      : (SIZE_COPY[answers.size] || '');

    var link = document.getElementById('rLink');
    link.href = 'https://pawlunova.co.uk/products/' + bed.handle;
    document.getElementById('rLinkText').textContent = 'See the ' + bed.short;

    var stock = document.getElementById('rStock');
    if (bed.stock > 0 && bed.stock <= 3) {
      stock.textContent = 'Only ' + bed.stock + ' left in stock';
      stock.hidden = false;
    } else {
      stock.hidden = true;
    }
  }

  app.addEventListener('click', function (e) {
    var opt = e.target.closest('.opt');
    if (opt) {
      var q = opt.getAttribute('data-q');
      answers[q] = opt.getAttribute('data-value');

      opt.closest('.finder__options').querySelectorAll('.opt').forEach(function (el) {
        el.setAttribute('aria-pressed', String(el === opt));
      });

      // Small pause so the selected state is actually seen before advancing
      window.setTimeout(function () {
        if (current < 2) {
          show(current + 1);
        } else {
          render();
          show(3);
        }
      }, reduceMotion ? 0 : 170);
      return;
    }

    if (e.target.closest('[data-back]')) {
      show(Math.max(0, current - 1));
      return;
    }

    if (e.target.closest('#rRestart')) {
      answers = { style: null, joints: null, size: null };
      app.querySelectorAll('.opt').forEach(function (el) { el.setAttribute('aria-pressed', 'false'); });
      show(0);
      app.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  });

  /* ------------------------------------------------------------------------
     7. Housekeeping
     ---------------------------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
