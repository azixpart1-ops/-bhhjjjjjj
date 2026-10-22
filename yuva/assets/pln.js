/* ==========================================================================
   PawLunova on Yuva — pln.js
   Vanilla, no dependencies, loads deferred once (every pln section requests
   it; the browser fetches it once; the guard below runs it once).

   What it does
     1. Delivery dates   [data-pln-delivery]   dispatch + transit working days,
                                              bank holidays, weekend orders
                                              counted from Monday. Never resets.
     2. Per-night        [data-pln-per-night]  price ÷ (guarantee years × 365),
                                              basis printed next to it.
     3. Reveal           .pln-reveal           opacity/transform only.
     4. Sticky bar       <pln-sticky-bar>      phones only; hides while the
                                              finder or footer is on screen.
     5. Offer gate       [data-pln-offer-ends] removes an offer the moment it
                                              has ended on the shopper's clock.
     6. First question   <pln-sleep-start>     one tap stores the answer and
                                              scrolls to the finder (or goes to
                                              /pages/bed-finder?style=…).
     7. Bed Finder       <pln-bed-finder>      3 questions + name → one bed in
                                              the right size, added to the
                                              basket from the result.
   Levers, honestly applied: choice architecture, commitment (progress 1 of 4),
   endowment (the dog's name, kept on the device), default effect (size
   pre-chosen), price framing (per-night with its working), risk reversal
   (trial + guarantee under the button). No invented urgency anywhere.

   20 Oct 2026: the dataset keys for delivery, per-night and offer-ends read
   data-yv-* while the markup writes data-pln-*, so the per-night price never
   filled and delivery only worked through its fallback string. Corrected to
   plnDelivery / plnPerNight / plnOfferEnds. Reveal also now shows everything
   after 1.5s as a failsafe, and the CSS no longer hides content without it.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__plnReady) return;
  window.__plnReady = true;

  var doc = document;
  var cfg = window.PLN || {};
  var money = cfg.moneyFormat || '£{{amount}}';

  function qs(s, el) { return (el || doc).querySelector(s); }
  function qsa(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
  function on(el, ev, fn) { el && el.addEventListener(ev, fn); }
  function fmtMoney(pence) {
    var pounds = pence / 100;
    var whole = Math.round(pounds * 100) % 100 === 0;
    var amount = whole ? String(Math.round(pounds)) : pounds.toFixed(2);
    return money.replace(/\{\{\s*amount[^}]*\}\}/, amount).replace(/<[^>]+>/g, '');
  }
  function store(key, val) {
    try { if (val === undefined) return JSON.parse(localStorage.getItem(key)); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
  }

  /* ---------------- 1. Delivery dates ---------------- */
  var HOLIDAYS = (cfg.holidays || []).reduce(function (m, d) { m[d] = 1; return m; }, {});
  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function isWorking(d) { var w = d.getDay(); return w !== 0 && w !== 6 && !HOLIDAYS[isoDate(d)]; }
  function addWorking(from, n) {
    var d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (!isWorking(d)) d.setDate(d.getDate() + 1); /* weekend / holiday order counts from the next working day */
    var left = n;
    while (left > 0) { d.setDate(d.getDate() + 1); if (isWorking(d)) left--; }
    return d;
  }
  function fmtDay(d) { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function deliveryWindow(dispMin, dispMax, trMin, trMax) {
    var now = new Date();
    var a = addWorking(addWorking(now, dispMin), trMin);
    var b = addWorking(addWorking(now, dispMax), trMax);
    return { from: a, to: b, text: fmtDay(a) + (isoDate(a) === isoDate(b) ? '' : ' to ' + fmtDay(b)) };
  }
  function initDelivery() {
    qsa('[data-pln-delivery]').forEach(function (el) {
      var d = el.dataset;
      var w = deliveryWindow(+d.dispatchMin || 0, +d.dispatchMax || 0, +d.transitMin || 0, +d.transitMax || 0);
      var tpl = d.plnDelivery || 'Arrives [dates]';
      el.textContent = tpl.replace('[dates]', w.text);
      el.hidden = false;
    });
  }

  /* ---------------- 2. Per-night ---------------- */
  function perNight(pence, years) {
    var nights = Math.max(1, (years || 5) * 365);
    var p = Math.ceil(pence / nights); /* rounded up: never understate */
    return p < 100 ? p + 'p' : fmtMoney(p);
  }
  function initPerNight() {
    qsa('[data-pln-per-night]').forEach(function (el) {
      var pence = +el.dataset.plnPerNight, years = +el.dataset.years || cfg.guaranteeYears || 5;
      if (!pence) return;
      qsa('[data-value]', el).forEach(function (v) { v.textContent = perNight(pence, years); });
      el.hidden = false;
    });
  }

  /* ---------------- 3. Reveal ---------------- */
  function initReveal() {
    var els = qsa('.pln-reveal');
    if (!els.length) return;
    var showAll = function () { els.forEach(function (e) { e.classList.add('is-in'); }); };
    if (!('IntersectionObserver' in window)) { showAll(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(showAll, 1500); /* failsafe: nothing stays hidden if the observer never fires */
  }

  /* ---------------- 4. Sticky bar ---------------- */
  function initSticky() {
    var bar = qs('pln-sticky-bar');
    if (!bar) return;
    var hero = qs(bar.dataset.after || '.pln-hero') || qs('main');
    var avoid = qsa('pln-bed-finder, footer, .pln-finder, #shopify-section-footer');
    var heroGone = false, avoidVisible = 0;
    function update() { bar.dataset.show = heroGone && !avoidVisible ? 'true' : 'false'; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { heroGone = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; update(); }).observe(hero);
      var io2 = new IntersectionObserver(function (es) { es.forEach(function (en) { avoidVisible += en.isIntersecting ? 1 : -1; }); avoidVisible = Math.max(0, avoidVisible); update(); });
      avoid.forEach(function (a) { io2.observe(a); });
    }
  }

  /* ---------------- 5. Offer gate ---------------- */
  function initOffer() {
    qsa('[data-pln-offer-ends]').forEach(function (el) {
      var t = Date.parse(el.dataset.plnOfferEnds.replace(' ', 'T'));
      if (t && Date.now() > t) el.remove();
    });
  }

  /* ---------------- 6 & 7. Bed Finder ---------------- */
  var STYLES = ['curl', 'lean', 'sprawl'], STAGES = ['fine', 'slowing', 'diagnosed'];
  var SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  var SIZE_WORDS = { xxs: 'XS', xs: 'XS', 'extra small': 'XS', small: 'S', s: 'S', medium: 'M', m: 'M', large: 'L', l: 'L', xl: 'XL', 'extra large': 'XL', xxl: 'XXL', '2xl': 'XXL', 'xl plus': 'XXL', giant: 'XXL' };
  var KEY = 'pln:finder';

  function sizeOf(variantTitle) {
    var t = String(variantTitle || '').toLowerCase();
    var m = t.match(/\b(xxs|xs|extra small|small|medium|large|extra large|xl plus|xxl|2xl|xl|giant)\b/);
    return m ? SIZE_WORDS[m[1]] : null;
  }

  function Finder(el) {
    this.el = el;
    var island = qs('script[type="application/json"]', el);
    this.cfg = island ? JSON.parse(island.textContent) : {};
    this.answers = store(KEY) || {};
    var q = new URLSearchParams(location.search);
    if (q.get('style') && STYLES.indexOf(q.get('style')) > -1) this.answers.style = q.get('style');
    this.step = this.answers.style ? 2 : 1;
    this.render();
  }
  Finder.prototype.save = function () { store(KEY, this.answers); };
  Finder.prototype.render = function () {
    var self = this, c = this.cfg, a = this.answers;
    qsa('.pln-finder__step', this.el).forEach(function (s) { s.hidden = +s.dataset.step !== self.step; });
    var pct = Math.min(100, Math.round(((this.step - 1) / 4) * 100));
    var bar = qs('.pln-finder__bar i', this.el); if (bar) bar.style.width = pct + '%';
    var label = qs('[data-step-label]', this.el); if (label) label.textContent = this.step <= 4 ? 'Step ' + this.step + ' of 4' : (a.name ? a.name + "'s bed" : 'Your match');
    qsa('.pln-finder__opt', this.el).forEach(function (b) {
      b.setAttribute('aria-pressed', String(a[b.dataset.key] === b.dataset.value));
      b.onclick = function () { a[b.dataset.key] = b.dataset.value; self.save(); self.next(); };
    });
    qsa('[data-back]', this.el).forEach(function (b) { b.onclick = function () { self.step = Math.max(1, self.step - 1); self.render(); }; });
    var form = qs('.pln-finder__name', this.el);
    if (form) form.onsubmit = function (e) { e.preventDefault(); a.name = (qs('input', form).value || '').trim().slice(0, 24); self.save(); self.match(); };
    var skip = qs('[data-skip]', this.el);
    if (skip) skip.onclick = function () { a.name = ''; self.save(); self.match(); };
    var restart = qs('[data-restart]', this.el);
    if (restart) restart.onclick = function () { self.answers = {}; self.save(); self.step = 1; self.render(); };
    if (this.step === 5) this.match();
  };
  Finder.prototype.next = function () {
    var self = this;
    setTimeout(function () { self.step = Math.min(5, self.step + 1); self.render(); }, 240);
  };
  /* Match: merchant block for style × stage first; the block's product must be
     available. Fall back to the same style at the previous stage, then any
     block for the style. */
  Finder.prototype.pick = function () {
    var a = this.answers, blocks = this.cfg.matches || [];
    var order = [a.stage].concat(STAGES.filter(function (s) { return s !== a.stage; }));
    for (var i = 0; i < order.length; i++) {
      var hit = blocks.filter(function (b) { return b.style === a.style && b.stage === order[i] && b.available; })[0];
      if (hit) return hit;
    }
    return blocks.filter(function (b) { return b.available; })[0] || null;
  };
  Finder.prototype.match = function () {
    var self = this, a = this.answers, c = this.cfg;
    this.step = 5; qsa('.pln-finder__step', this.el).forEach(function (s) { s.hidden = +s.dataset.step !== 5; });
    var bar = qs('.pln-finder__bar i', this.el); if (bar) bar.style.width = '100%';
    var label = qs('[data-step-label]', this.el); if (label) label.textContent = a.name ? a.name + "'s bed" : 'Your match';
    var out = qs('[data-result]', this.el), status = qs('[data-status]', this.el);
    var hit = this.pick();
    if (!hit) { out.innerHTML = '<p>' + (c.strings.empty || 'Nothing matches yet. Browse every bed instead.') + '</p>'; return; }
    status.textContent = c.strings.matching || 'Matching…';
    fetch(hit.url + '.js', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (p) {
      status.textContent = '';
      self.show(hit, p);
    }).catch(function () { status.textContent = ''; self.show(hit, null); });
  };
  Finder.prototype.show = function (hit, p) {
    var a = this.answers, c = this.cfg, s = c.strings;
    var variants = (p && p.variants) || [];
    var want = a.size || 'M';
    /* default effect: pre-choose the size from the answers; sold out → next size up, and say so */
    var byIdx = function (v) { return SIZE_ORDER.indexOf(sizeOf(v.title)); };
    var want_i = SIZE_ORDER.indexOf(want);
    var chosen = null, note = '';
    if (variants.length === 1 && !sizeOf(variants[0].title)) { chosen = variants[0]; }
    else {
      var exact = variants.filter(function (v) { return byIdx(v) === want_i; })[0];
      if (exact && exact.available) chosen = exact;
      else {
        var up = variants.filter(function (v) { return v.available && byIdx(v) === want_i + 1; })[0];
        if (up) { chosen = up; note = s.sizeUp || 'Your size is sold out, so we\'ve chosen the next size up.'; }
        else chosen = exact || variants.filter(function (v) { return v.available; })[0] || variants[0];
      }
    }
    var price = chosen ? chosen.price : (p ? p.price : hit.price);
    var compare = chosen && chosen.compare_at_price > chosen.price ? chosen.compare_at_price : 0;
    var name = a.name ? a.name : null;
    var dog = name || 'your dog';
    var why = [];
    why.push({ curl: s.whyCurl, lean: s.whyLean, sprawl: s.whySprawl }[a.style] || '');
    why.push({ fine: s.whyFine, slowing: s.whySlowing, diagnosed: s.whyDiagnosed }[a.stage] || '');
    if (chosen && sizeOf(chosen.title)) why.push((s.whySize || 'Size [size], from what you told us about [dog].').replace('[size]', chosen.title.split('/')[0].trim()).replace('[dog]', dog));
    why = why.filter(Boolean).map(function (w) { return w.replace('[dog]', dog); });
    var img = (p && p.featured_image) ? p.featured_image.replace(/(\.[a-z]+)(\?|$)/, '_900x$1$2') : hit.image;
    var html = '';
    html += '<div class="pln-media pln-media--4x3"><img src="' + img + '" alt="' + (p ? p.title : hit.title).replace(/"/g, '&quot;') + '" loading="lazy"></div>';
    html += '<div>';
    html += '<span class="pln-eyebrow">' + (name ? (s.headingNamed || "[dog]'s bed").replace('[dog]', name) : (s.heading || 'Our recommendation')) + '</span>';
    html += '<h3 class="pln-sub"><a href="' + hit.url + (chosen ? '?variant=' + chosen.id : '') + '">' + (p ? p.title : hit.title) + '</a></h3>';
    html += '<ul class="pln-result__reasons">' + why.map(function (w) { return '<li><svg class="pln-icon pln-icon--success" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>' + w + '</span></li>'; }).join('') + '</ul>';
    html += '<p class="pln-result__price">' + fmtMoney(price) + (compare ? ' <s>' + fmtMoney(compare) + '</s>' : '') + '</p>';
    if (c.perNight && c.guaranteeYears && hit.foam) html += '<p class="pln-small pln-muted">' + (s.perNight || 'About [per] a night over the [years]-year foam guarantee.').replace('[per]', perNight(price, c.guaranteeYears)).replace('[years]', c.guaranteeYears) + '</p>';
    if (chosen && sizeOf(chosen.title)) html += '<span class="pln-result__size">' + (s.sizeLine || 'Size: [size]').replace('[size]', chosen.title) + '</span>';
    if (note) html += '<p class="pln-small pln-muted">' + note + '</p>';
    var can = chosen && chosen.available;
    html += '<div class="pln-actions">';
    if (can) html += '<button class="pln-btn pln-btn--primary" type="button" data-add="' + chosen.id + '">' + (name ? (s.addNamed || "Add [dog]'s bed · [price]").replace('[dog]', name) : (s.add || 'Add to basket · [price]')).replace('[price]', fmtMoney(price)) + '</button>';
    html += '<a class="pln-btn pln-btn--secondary" href="' + hit.url + (chosen ? '?variant=' + chosen.id : '') + '">' + (s.details || 'See the bed') + '</a>';
    html += '</div>';
    if (c.riskText) html += '<div class="pln-result__promise">' + c.riskText + '</div>';
    if (c.vetNote) html += '<p class="pln-small pln-muted" style="margin-top:.75rem">' + c.vetNote + '</p>';
    html += '<p class="pln-small" style="margin-top:1.25rem"><button type="button" class="pln-btn pln-btn--ghost" data-restart>' + (s.restart || 'Start again') + '</button></p>';
    html += '</div>';
    var out = qs('[data-result]', this.el);
    out.innerHTML = html;
    var self = this;
    on(qs('[data-restart]', out), 'click', function () { self.answers = {}; self.save(); self.step = 1; self.render(); });
    on(qs('[data-add]', out), 'click', function (e) {
      var b = e.currentTarget; b.disabled = true; b.textContent = s.adding || 'Adding…';
      fetch((cfg.routes && cfg.routes.cartAdd) || '/cart/add.js', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: +b.dataset.add, quantity: 1 }] }) })
        .then(function (r) { if (!r.ok) throw new Error('add'); return r.json(); })
        .then(function () {
          doc.dispatchEvent(new CustomEvent('pln:cart:added', { detail: { variant: +b.dataset.add } }));
          /* Yuva's own drawer may listen for cart changes; if the page hasn't opened one within a beat, go to the basket. */
          setTimeout(function () { if (!doc.querySelector('[data-pln-drawer-open], .drawer--open, .cart-drawer.is-open, .mini-cart.open')) location.href = (cfg.routes && cfg.routes.cart) || '/cart'; }, 400);
        })
        .catch(function () { b.disabled = false; b.textContent = s.addError || 'Couldn\'t add it. Open the bed instead.'; });
    });
  };

  function initSleepStart() {
    qsa('pln-sleep-start').forEach(function (el) {
      qsa('[data-style]', el).forEach(function (b) {
        on(b, 'click', function () {
          var a = store(KEY) || {}; a.style = b.dataset.style; store(KEY, a);
          qsa('[data-style]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          var finder = qs('pln-bed-finder');
          if (finder && finder.__finder) { finder.__finder.answers = a; finder.__finder.step = 2; finder.__finder.render(); finder.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          else location.href = (el.dataset.finderUrl || '/pages/bed-finder') + '?style=' + b.dataset.style;
        });
      });
    });
  }
  function initFinder() { qsa('pln-bed-finder').forEach(function (el) { el.__finder = new Finder(el); }); }

  function init() { initDelivery(); initPerNight(); initReveal(); initSticky(); initOffer(); initFinder(); initSleepStart(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  doc.addEventListener('shopify:section:load', init);
})();
