/* ==========================================================================
   PawLunova — conversion homepage behaviour (Shopify build)

   Differences from the standalone build: the theme owns the header, nav,
   announcement bar and footer, so none of that lives here. Product data for
   the bed finder is rendered by Liquid into #pl-beds, so prices, stock and
   images stay live without touching this file.

   Safe to include from more than one pl-section — it initialises once.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__plHomeInit) return;
  window.__plHomeInit = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ------------------------------------------------------------------------
     Slide-out cart
     Contents are re-rendered by Shopify through the Section Rendering API
     after every change, so prices, discounts and currency stay server-side.
     ---------------------------------------------------------------------- */
  function initDrawer() {
    var drawer = document.getElementById('plDrawer');
    if (!drawer || drawer.__plBound) return;
    drawer.__plBound = true;

    var panel = drawer.querySelector('.pl-drawer__panel');
    var lastFocus = null;
    // Shopify qualifies section ids in JSON templates, so read the real one
    // off the element rather than assuming the key used in the template.
    var sectionId = drawer.getAttribute('data-section-id') || 'pl_cart_drawer';

    function open() {
      if (drawer.hasAttribute('data-open')) return;
      lastFocus = document.activeElement;
      drawer.setAttribute('data-open', '');
      drawer.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      var close = drawer.querySelector('.pl-drawer__close');
      if (close) close.focus();
    }

    function close() {
      if (!drawer.hasAttribute('data-open')) return;
      drawer.removeAttribute('data-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    window.plCartDrawer = { open: open, close: close, refresh: refresh };

    drawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-drawer-close]')) { e.preventDefault(); close(); return; }

      var step = e.target.closest('[data-line]');
      if (step) {
        e.preventDefault();
        change(Number(step.getAttribute('data-line')), Number(step.getAttribute('data-qty')));
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!drawer.hasAttribute('data-open')) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      // keep focus inside the panel while it is open
      var f = panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Any link to the cart opens the drawer instead of navigating.
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || link.hasAttribute('data-drawer-close')) return;
      var href = link.getAttribute('href') || '';
      if (!/^\/?(cart)\/?($|\?)/.test(href.replace(/^https?:\/\/[^/]+/, ''))) return;
      if (link.closest('.pl-drawer')) return;      // checkout form links stay as they are
      e.preventDefault();
      open();
    });

    function change(line, quantity) {
      var body = document.getElementById('plDrawerBody');
      if (body) body.classList.add('pl-drawer__busy');
      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line: line, quantity: quantity })
      })
        .then(function (r) { return r.ok ? refresh() : null; })
        .catch(function () { window.location.href = '/cart'; })
        .finally(function () { if (body) body.classList.remove('pl-drawer__busy'); });
    }

    function refresh() {
      return fetch(window.location.pathname + '?sections=' + encodeURIComponent(sectionId), { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var html = data[sectionId];
          if (!html) return;
          var fresh = new DOMParser().parseFromString(html, 'text/html').getElementById('plDrawer');
          if (!fresh) return;
          var wasOpen = drawer.hasAttribute('data-open');
          drawer.querySelector('.pl-drawer__panel').innerHTML = fresh.querySelector('.pl-drawer__panel').innerHTML;
          panel = drawer.querySelector('.pl-drawer__panel');
          if (wasOpen) drawer.setAttribute('data-open', '');
          syncCount(fresh);
        })
        .catch(function () { /* leave the drawer as-is rather than blanking it */ });
    }

    function syncCount(fresh) {
      var m = (fresh.querySelector('.pl-drawer__title span') || {}).textContent || '';
      var n = parseInt(m, 10);
      if (isNaN(n)) return;
      document.querySelectorAll('.cart-bubble__text, [data-cart-count], .cart-count').forEach(function (el) {
        el.textContent = String(n);
      });
    }
  }


  /* ------------------------------------------------------------------------
     Collection filters
     Runs over the cards already on the page, so filtering is instant and
     costs no round trip. Facets are derived from the products themselves.
     ---------------------------------------------------------------------- */
  function initFilters() {
    var root = document.getElementById('plFilters');
    var grid = document.querySelector('.pl .cgrid');
    if (!root || !grid || root.__plBound) return;
    root.__plBound = true;

    var cards  = Array.prototype.slice.call(grid.querySelectorAll('.pl-card'));
    var toggle = document.getElementById('plFiltersToggle');
    var badge  = document.getElementById('plFilterCount');
    var results= document.getElementById('plFilterResults');
    var clear  = document.getElementById('plFiltersClear');
    var active = { fit: [], need: [], price: [] };

    // Which size bands a card can serve, read off its real size options.
    var BAND = {
      small:  ['xs', 's', 'small'],
      medium: ['m', 'medium'],
      large:  ['l', 'large', 'xl', 'xxl', '2xl', '3xl']
    };

    function fits(card, band) {
      var sizes = (card.getAttribute('data-sizes') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!sizes.length) return true;               // one-size beds suit anyone
      return sizes.some(function (sz) { return BAND[band].indexOf(sz) !== -1; });
    }

    function needs(card, need) {
      var hay = (card.getAttribute('data-type') || '') + ',' + (card.getAttribute('data-tags') || '');
      if (need === 'orthopaedic') return /orthopaedic|orthopedic|memory foam|joint|arthritis|senior/.test(hay);
      if (need === 'nest')        return /nest|bolster|calming|high.?sided|raised edge|sofa/.test(hay);
      if (need === 'waterproof')  return /waterproof|wipe.?clean/.test(hay);
      return true;
    }

    function matches(card) {
      if (active.fit.length   && !active.fit.some(function (b) { return fits(card, b); })) return false;
      if (active.need.length  && !active.need.some(function (n) { return needs(card, n); })) return false;
      if (active.price.length && active.price.indexOf(card.getAttribute('data-price-band')) === -1) return false;
      return true;
    }

    var empty = null;
    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = matches(c);
        c.hidden = !ok;
        if (ok) shown++;
      });

      var n = active.fit.length + active.need.length + active.price.length;
      if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
      if (clear) clear.hidden = n === 0;
      if (results) results.textContent = n === 0 ? '' : shown + (shown === 1 ? ' bed' : ' beds') + ' match';

      if (!shown) {
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'cgrid__none';
          empty.innerHTML = '<h3>No beds match all of that.</h3><p>Try loosening one filter — most dogs have more than one bed that suits them.</p>';
          grid.appendChild(empty);
        }
        empty.hidden = false;
      } else if (empty) {
        empty.hidden = true;
      }

      // keep the filter state shareable
      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        ['fit', 'need', 'price'].forEach(function (k) {
          if (active[k].length) url.searchParams.set(k, active[k].join(','));
          else url.searchParams.delete(k);
        });
        window.history.replaceState({}, '', url.toString());
      }
    }

    root.addEventListener('click', function (e) {
      var chip = e.target.closest('.fchip');
      if (chip) {
        var facet = chip.closest('[data-facet]').getAttribute('data-facet');
        var val = chip.getAttribute('data-value');
        var i = active[facet].indexOf(val);
        if (i === -1) active[facet].push(val); else active[facet].splice(i, 1);
        chip.setAttribute('aria-pressed', String(i === -1));
        apply();
        return;
      }
      if (e.target.closest('#plFiltersClear')) {
        active = { fit: [], need: [], price: [] };
        root.querySelectorAll('.fchip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        apply();
      }
    });

    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = root.hasAttribute('data-open');
        root.toggleAttribute('data-open', !open);
        toggle.setAttribute('aria-expanded', String(!open));
      });
    }

    // restore from the URL so a filtered link opens filtered
    var params = new URLSearchParams(window.location.search);
    var restored = false;
    ['fit', 'need', 'price'].forEach(function (k) {
      var v = params.get(k);
      if (!v) return;
      active[k] = v.split(',').filter(Boolean);
      active[k].forEach(function (val) {
        var chip = root.querySelector('[data-facet="' + k + '"] .fchip[data-value="' + val + '"]');
        if (chip) chip.setAttribute('aria-pressed', 'true');
      });
      restored = true;
    });
    if (restored) {
      root.setAttribute('data-open', '');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
      apply();
    }
  }

  function init() {

    initDrawer();
    initFilters();

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
       Sticky CTA — appears once the pl-hero has gone, hides near the footer
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
    if (!app || !dataEl) { initPdp(); return; }

    var BEDS;
    try {
      BEDS = JSON.parse(dataEl.textContent);
    } catch (err) {
      return; // leave the first question standing rather than showing a broken result
    }

    /* style|joints → bed key, with a size override where a bed does not come
       small enough or large enough for the dog. Keys match the handles listed
       in the pl-section settings. */
    /* style|joints -> slot, with a size override wherever the obvious bed
       does not come in a size that actually fits that dog. Both overrides
       below exist because of the products' own published dimensions:
       the Windermere nest stops at 71cm, and the Borrowdale is a single
       size its description puts at "to 25kg". */
    var MATRIX = {
      'nest|fine':         { all: 'nest_fine' },
      'nest|slowing':      { small: 'nest_slowing', medium: 'nest_slowing', large: 'nest_slowing_lg' },
      'nest|diagnosed':    { all: 'nest_diagnosed' },
      'bolster|fine':      { all: 'bolster_fine' },
      'bolster|slowing':   { all: 'bolster_slowing' },
      'bolster|diagnosed': { small: 'bolster_diagnosed', medium: 'bolster_diagnosed_md', large: 'bolster_diagnosed' },
      'flat|fine':         { all: 'flat_fine' },
      'flat|slowing':      { all: 'flat_slowing' },
      'flat|diagnosed':    { all: 'flat_diagnosed' }
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

      // Each bed carries a resolved variant per size band, so the customer is
      // sent to the size that actually fits rather than a generic "size: large".
      var band = (bed.bands && bed.bands[answers.size]) || null;

      var img = document.getElementById('plResultImg');
      img.src = bed.img;
      img.alt = bed.title;

      document.getElementById('plResultName').textContent = bed.title;
      document.getElementById('plResultWhy').textContent  = bed.why;
      document.getElementById('plResultPrice').textContent = band ? band.price : '';

      var sizeEl = document.getElementById('plResultSize');
      sizeEl.textContent = band && band.size && !/^default title$/i.test(band.size)
        ? 'Size ' + band.size.toUpperCase()
        : 'One size';

      var dimsEl = document.getElementById('plResultDims');
      if (dimsEl) {
        if (band && band.dims) { dimsEl.textContent = band.dims; dimsEl.hidden = false; }
        else dimsEl.hidden = true;
      }

      var link = document.getElementById('plResultLink');
      link.href = band && band.url ? band.url : bed.url;   // preselects the size
      document.getElementById('plResultLinkText').textContent = 'See the ' + bed.short;

      var stock = document.getElementById('plResultStock');
      if (band && band.available === false) {
        stock.textContent = 'That size is back in stock soon';
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

    /* ----------------------------------------------------------------------
       Product page: variants, gallery, add to cart
       Everything is driven by #pl-variants, which Liquid renders from the
       product itself — so this file never needs to know about a specific one.
       ---------------------------------------------------------------------- */
    initPdp();
  }

  function initPdp() {
    var dataEl = document.getElementById('pl-variants');
    var form = document.getElementById('plForm');
    if (!dataEl || !form) return;

    var DATA;
    try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var VARIANTS = DATA.variants || [];

    var idField  = document.getElementById('plVariantId');
    var priceEl  = document.getElementById('plPrice');
    var wasEl    = document.getElementById('plWas');
    var saveEl   = document.getElementById('plSave');
    var stockEl  = document.getElementById('plStock');
    var atc      = document.getElementById('plAtc');
    var atcText  = document.getElementById('plAtcText');
    var barPrice = document.getElementById('plBarPrice');
    var msg      = document.getElementById('plMsg');
    var slides   = document.getElementById('plGalSlides');

    /* --- gallery: scroll-snap strip + thumbnails ----------------------- */
    var thumbs = Array.prototype.slice.call(document.querySelectorAll('.gal__thumb'));

    function goTo(i) {
      if (!slides) return;
      var slide = slides.children[i];
      if (!slide) return;
      slides.scrollTo({ left: slide.offsetLeft - slides.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () { goTo(Number(t.getAttribute('data-goto'))); });
    });
    if (slides && thumbs.length) {
      var syncing = false;
      slides.addEventListener('scroll', function () {
        if (syncing) return;
        syncing = true;
        window.requestAnimationFrame(function () {
          var i = Math.round(slides.scrollLeft / slides.clientWidth);
          thumbs.forEach(function (t, n) { t.setAttribute('aria-current', String(n === i)); });
          syncing = false;
        });
      }, { passive: true });
    }

    /* --- variant matching --------------------------------------------- */
    function selected() {
      var vals = [];
      document.querySelectorAll('.opt-values input:checked').forEach(function (input) {
        vals[Number(input.getAttribute('data-option-index'))] = input.value;
      });
      return vals;
    }

    function match(vals) {
      for (var i = 0; i < VARIANTS.length; i++) {
        var ok = true;
        for (var j = 0; j < vals.length; j++) {
          if (vals[j] !== undefined && VARIANTS[i].options[j] !== vals[j]) { ok = false; break; }
        }
        if (ok) return VARIANTS[i];
      }
      return null;
    }

    /* Cross out option values that don't exist in stock alongside the rest
       of the current selection — the standard "combined listing" behaviour. */
    function markUnavailable(vals) {
      document.querySelectorAll('.opt-values input').forEach(function (input) {
        var idx = Number(input.getAttribute('data-option-index'));
        var probe = vals.slice();
        probe[idx] = input.value;
        var found = null;
        for (var i = 0; i < VARIANTS.length; i++) {
          var ok = true;
          for (var j = 0; j < probe.length; j++) {
            if (probe[j] !== undefined && VARIANTS[i].options[j] !== probe[j]) { ok = false; break; }
          }
          if (ok) { found = VARIANTS[i]; break; }
        }
        var label = input.nextElementSibling;
        if (!label) return;
        if (found && found.available) label.removeAttribute('data-unavailable');
        else label.setAttribute('data-unavailable', '');
      });
    }

    function apply(variant) {
      if (!variant) {
        if (atc) { atc.disabled = true; }
        if (atcText) atcText.textContent = DATA.unavailableLabel || 'Unavailable';
        if (stockEl) stockEl.hidden = true;
        return;
      }

      if (idField) idField.value = variant.id;
      if (priceEl) priceEl.textContent = variant.price;
      if (barPrice) barPrice.textContent = variant.price;

      if (wasEl) {
        if (variant.compareAt) { wasEl.textContent = variant.compareAt; wasEl.hidden = false; }
        else wasEl.hidden = true;
      }
      if (saveEl) {
        if (variant.save) { saveEl.textContent = 'Save ' + variant.save; saveEl.hidden = false; }
        else saveEl.hidden = true;
      }

      if (atc) atc.disabled = !variant.available;
      if (atcText) atcText.textContent = variant.available ? (DATA.atcLabel || 'Add to basket') : (DATA.soldOutLabel || 'Sold out');

      // Low stock only when inventory is actually tracked and actually low.
      if (stockEl) {
        var threshold = Number(DATA.lowStockAt || 0);
        var tracked = variant.managed === 'shopify';
        if (variant.available && tracked && threshold > 0 && variant.qty > 0 && variant.qty <= threshold) {
          stockEl.textContent = 'Only ' + variant.qty + ' left in stock';
          stockEl.className = 'buy__stock';
          stockEl.hidden = false;
        } else if (variant.available) {
          stockEl.textContent = 'In stock, ready to dispatch';
          stockEl.className = 'buy__stock buy__stock--ok';
          stockEl.hidden = false;
        } else {
          stockEl.hidden = true;
        }
      }

      if (variant.mediaIndex !== null && variant.mediaIndex !== undefined) goTo(variant.mediaIndex);

      // keep the URL shareable without reloading
      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    form.addEventListener('change', function (e) {
      if (!e.target.matches('.opt-values input')) return;
      var idx = e.target.getAttribute('data-option-index');
      var label = document.querySelector('[data-selected-for="' + idx + '"]');
      if (label) label.textContent = e.target.value;
      var vals = selected();
      markUnavailable(vals);
      apply(match(vals));
    });

    if (document.querySelector('.opt-values input')) {
      var initial = selected();
      markUnavailable(initial);
      apply(match(initial));
    } else if (VARIANTS.length === 1) {
      apply(VARIANTS[0]);
    }

    /* --- add to cart ---------------------------------------------------- */
    function say(text, isError, withLink) {
      if (!msg) return;
      msg.className = 'atc-msg' + (isError ? ' atc-msg--error' : '');
      msg.innerHTML = '';
      var span = document.createElement('span');
      span.textContent = text;
      msg.appendChild(span);
      if (withLink) {
        var a = document.createElement('a');
        a.href = DATA.cartUrl || '/cart';
        a.textContent = 'View basket';
        msg.appendChild(document.createTextNode(' '));
        msg.appendChild(a);
      }
      msg.setAttribute('data-show', '');
    }

    form.addEventListener('submit', function (e) {
      if (!window.fetch || !idField) return; // let the native POST handle it
      e.preventDefault();

      var busyLabel = 'Adding…';
      var restore = atcText ? atcText.textContent : '';
      if (atcText) atcText.textContent = busyLabel;
      if (atc) atc.disabled = true;

      fetch(DATA.cartUrl ? '/cart/add.js' : '/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(idField.value), quantity: 1 }] })
      })
        .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
        .then(function (res) {
          if (!res.ok) {
            say((res.body && res.body.description) || 'Sorry, that could not be added.', true, false);
            return;
          }
          if (window.plCartDrawer) {
            // Our own drawer is on the page: refresh it and slide it in.
            // Deliberately no cart:* events here — the theme's drawer listens
            // for those and we would end up with two open at once.
            window.plCartDrawer.refresh().then(function () { window.plCartDrawer.open(); });
          } else {
            say('Added to your basket.', false, true);
            ['cart:lines-update', 'cart:refresh', 'cart:update'].forEach(function (name) {
              document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { action: 'add', source: 'pl-pdp' } }));
            });
          }
        })
        .catch(function () {
          // network failed — fall back to the plain form post, which always works
          form.submit();
        })
        .finally(function () {
          if (atcText) atcText.textContent = restore || DATA.atcLabel || 'Add to basket';
          if (atc) atc.disabled = false;
        });
    });

    var barAtc = document.getElementById('plBarAtc');
    if (barAtc) {
      barAtc.addEventListener('click', function () {
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      });
    }


    /* --- size helper panel ------------------------------------------- */
    var help = document.getElementById('plSizeHelp');
    if (help) {
      var hq = help.querySelector('.sizehelp__q');
      hq.addEventListener('click', function () {
        var open = help.hasAttribute('data-open');
        help.toggleAttribute('data-open', !open);
        hq.setAttribute('aria-expanded', String(!open));
      });
    }

    /* --- image zoom ---------------------------------------------------
       Built once, on first use. Escape and backdrop both close it, and
       focus returns to the image that opened it. */
    var box = null, lastOpener = null;

    function lightbox(src, alt) {
      if (!box) {
        box = document.createElement('div');
        box.className = 'pl-lightbox';
        box.innerHTML = '<button class="pl-lightbox__close" type="button" aria-label="Close">\u00d7</button><img alt="">';
        document.body.appendChild(box);
        box.addEventListener('click', function (e) {
          if (e.target === box || e.target.closest('.pl-lightbox__close')) close();
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && box.hasAttribute('data-open')) close();
        });
      }
      var img = box.querySelector('img');
      img.src = src;
      img.alt = alt || '';
      box.setAttribute('data-open', '');
      box.querySelector('.pl-lightbox__close').focus();
    }

    function close() {
      if (!box) return;
      box.removeAttribute('data-open');
      if (lastOpener) lastOpener.focus();
    }

    if (slides) {
      slides.querySelectorAll('img').forEach(function (img) {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', function () {
          lastOpener = img;
          // srcset picks a display-sized file; ask the CDN for a big one
          var big = (img.currentSrc || img.src).replace(/([?&])width=\d+/, '$1width=1600');
          lightbox(big, img.alt);
        });
      });
    }

    /* --- sticky buy bar: show once the real button scrolls away --------- */
    var bar = document.getElementById('plBuyBar');
    if (bar && atc && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          bar.toggleAttribute('data-show', !entry.isIntersecting && entry.boundingClientRect.top < 0);
        });
      }, { threshold: 0 }).observe(atc);
    }
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
