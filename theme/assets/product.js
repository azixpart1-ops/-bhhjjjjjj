/* ==========================================================================
   Lunova — product.js
   Product page + quick-add behaviour. Vanilla ES2019, no dependencies.

   Custom elements
     <variant-picker>           options → variant; updates price, per-night,
                                instalments, honest stock, delivery, Add button,
                                URL, size guide; Bed Finder pre-selection;
                                emits lunova:variant:change {sectionId, variant}
     <product-form>             AJAX add (Lunova.cart.add) → basket drawer,
                                inline errors, no-JS safe
     <sticky-atc>               bottom bar once the main button scrolls away
     <media-gallery>            carousel / thumbnails / grid, lightbox zoom,
                                deferred video + 3D, follows the variant
     <product-recommendations>  lazy Section Rendering fetch
     <recently-viewed>          localStorage list → cards from /products/x.js

   Everything for one product lives in a "scope": the main-product section
   ([data-product-scope]) or the quick-add drawer body ([data-quick-add-product]).
   The scope holds the JSON island (script[data-product-json]) that every
   component reads.
   ========================================================================== */
(function () {
  'use strict';

  var L = (window.Lunova = window.Lunova || {});
  if (L._productReady) return;
  L._productReady = true;

  var doc = document;
  var RECENT_KEY = 'lunova:recent';
  var RECENT_MAX = 8;

  /* ------------------------------------------------------------------------
     Small helpers (lean on global.js when it is there)
     ---------------------------------------------------------------------- */
  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  function define(name, cls) {
    if (!customElements.get(name)) customElements.define(name, cls);
  }

  function on(name, fn) {
    doc.addEventListener(name, fn);
    return function () {
      doc.removeEventListener(name, fn);
    };
  }

  function emit(name, detail) {
    if (typeof L.emit === 'function') L.emit(name, detail);
    else doc.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function fill(template, vars) {
    if (typeof L.fill === 'function') return L.fill(template, vars);
    return String(template || '').replace(/\[(\w+)\]/g, function (m, k) {
      return vars && vars[k] != null ? String(vars[k]) : m;
    });
  }

  var decodeBox = null;
  function decode(value) {
    if (typeof value !== 'string' || value.indexOf('&') === -1) return value;
    decodeBox = decodeBox || doc.createElement('textarea');
    decodeBox.innerHTML = value;
    return decodeBox.value;
  }

  function money(cents) {
    if (typeof L.money === 'function') return L.money(cents);
    return '£' + (Number(cents || 0) / 100).toFixed(2);
  }

  function moneyShort(cents) {
    return money(cents).replace(/([.,])00(?!\d)/, '');
  }

  function settings() {
    return L.settings || {};
  }

  function reducedMotion() {
    return (
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      doc.documentElement.classList.contains('no-motion')
    );
  }

  function designMode() {
    return !!((window.Shopify && window.Shopify.designMode) || L.designMode);
  }

  function focusEl(el) {
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      el.focus();
    }
  }

  function vh(text) {
    var span = doc.createElement('span');
    span.className = 'visually-hidden';
    span.textContent = text;
    return span;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  /* ------------------------------------------------------------------------
     Scope + product data
     ---------------------------------------------------------------------- */
  function scopeOf(el) {
    if (!el || !el.closest) return null;
    return el.closest('[data-quick-add-product]') || el.closest('[data-product-scope]') || null;
  }

  function productData(scope) {
    if (!scope) return null;
    if (scope.__lunovaProduct) return scope.__lunovaProduct;
    var el = scope.querySelector('script[data-product-json]');
    if (!el) return null;
    var data;
    try {
      data = JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
    data.byId = {};
    (data.variants || []).forEach(function (v) {
      data.byId[v.id] = v;
    });
    var strings = data.strings || {};
    Object.keys(strings).forEach(function (k) {
      strings[k] = decode(strings[k]);
    });
    data.strings = strings;
    scope.__lunovaProduct = data;
    return data;
  }

  function currentVariant(scope, data) {
    if (scope.__lunovaVariant !== undefined) return scope.__lunovaVariant;
    var input = scope.querySelector('[data-variant-id-input]');
    var id = input ? parseInt(input.value, 10) : data && data.currentId;
    return (data && data.byId[id]) || null;
  }

  function sameOptions(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function findVariant(data, options) {
    var list = data.variants || [];
    for (var i = 0; i < list.length; i += 1) {
      if (sameOptions(list[i].options, options)) return list[i];
    }
    return null;
  }

  /** The best variant with option[idx] = value: most options in common with
      the current selection, available ones first. */
  function bestVariantFor(data, idx, value, selection) {
    var best = null;
    var bestScore = -1;
    (data.variants || []).forEach(function (v) {
      if (v.options[idx] !== value) return;
      var score = v.available ? 100 : 0;
      for (var i = 0; i < v.options.length; i += 1) {
        if (i !== idx && v.options[i] === selection[i]) score += 1;
      }
      if (score > bestScore) {
        best = v;
        bestScore = score;
      }
    });
    return best;
  }

  function cheapestWith(data, idx, value) {
    var best = null;
    (data.variants || []).forEach(function (v) {
      if (v.options[idx] !== value) return;
      if (!best || v.price < best.price) best = v;
    });
    return best;
  }

  /** All-lowercase text gets a capital, as snippets/variant-picker shows it. */
  function displayCase(text) {
    var t = String(text == null ? '' : text);
    return t && t === t.toLowerCase() ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  /** A size by its own name, as the picker shows it in bold, for sentences
      ("Only 3 left in Large", the sticky bar): "Large" for "Large · 91 ×
      69cm" or "Large: Cocker | Staffie" (Lunova.sizeParse, the same rule as
      snippets/size-hints mode size_label). Never another size's name. */
  function sizeLabelFor(value) {
    if (value == null || value === '') return '';
    var label = typeof L.sizeParse === 'function' ? L.sizeParse(value).label : '';
    return displayCase(label || String(value));
  }

  /** "Large / Dark Grey" for the sticky bar and status messages: the size by
      its name, other options as the picker shows them. */
  function variantDisplayTitle(data, v) {
    if (!v) return '';
    if (data.onlyDefault) return '';
    return (v.options || [])
      .map(function (o, i) {
        return i === data.sizeIndex ? sizeLabelFor(o) : displayCase(o);
      })
      .join(' / ');
  }

  function variantSizeLabel(data, v) {
    if (!v) return '';
    if (data.sizeIndex >= 0) return sizeLabelFor(v.options[data.sizeIndex]);
    if (!data.onlyDefault) return variantDisplayTitle(data, v);
    return '';
  }

  function stockFor(data, v, inStockText) {
    var s = data.strings;
    if (!v) return { state: 'out', text: s.unavailable };
    var stock = v.stock || {};
    var state = stock.state || (v.available ? 'in' : 'out');
    var size = variantSizeLabel(data, v);
    var text;
    if (state === 'low') {
      text = size ? fill(s.low, { count: stock.qty, size: size }) : fill(s.lowSingle, { count: stock.qty });
    } else if (state === 'backorder') {
      text = s.backorder;
    } else if (state === 'out') {
      text = size ? fill(s.soldOutIn, { size: size }) : s.soldOutSingle;
    } else {
      text = inStockText || s.inStock;
    }
    return { state: state, text: text };
  }

  /* ------------------------------------------------------------------------
     Price rendering (mirrors snippets/price.liquid)
     ---------------------------------------------------------------------- */
  function savingText(price, compare, strings) {
    var saved = compare - price;
    var amount = settings().savingsFormat === 'percent' ? Math.floor((saved * 100) / compare) + '%' : moneyShort(saved);
    return fill(strings.save, { amount: amount });
  }

  function renderPriceInto(el, opts, strings) {
    var price = opts.price;
    var compare = opts.compare || 0;
    var onSale = compare > price;
    el.textContent = '';
    if (onSale) {
      el.appendChild(vh(strings.wasPrice || ''));
      var s = doc.createElement('s');
      s.className = 'price__compare';
      s.setAttribute('data-price-compare', '');
      s.textContent = money(compare);
      el.appendChild(s);
      el.appendChild(vh(strings.salePrice || ''));
    } else {
      el.appendChild(vh(strings.regularPrice || ''));
    }
    if (opts.from) {
      var from = doc.createElement('span');
      from.className = 'price__from';
      from.setAttribute('data-price-from', '');
      from.textContent = strings.from || '';
      el.appendChild(from);
    }
    var cur = doc.createElement('span');
    cur.className = 'price__current';
    cur.setAttribute('data-price-current', '');
    cur.textContent = money(price);
    el.appendChild(cur);
    if (onSale && settings().showCompareSavings !== false && opts.showSave !== false) {
      var save = doc.createElement('span');
      save.className = 'price__save';
      save.setAttribute('data-price-save', '');
      save.textContent = savingText(price, compare, strings);
      el.appendChild(save);
    }
    if (opts.soldOut && strings.priceSoldOut) {
      var so = doc.createElement('span');
      so.className = 'price__sold-out';
      so.textContent = strings.priceSoldOut;
      el.appendChild(so);
    }
    el.classList.toggle('price--on-sale', onSale);
    el.classList.toggle('price--sold-out', !!opts.soldOut);
  }

  /* ------------------------------------------------------------------------
     Bring a scope in line with a variant
     ---------------------------------------------------------------------- */
  function quantityIn(scope) {
    var q = scope.querySelector('product-form [data-qty-input]');
    var n = q ? parseInt(q.value, 10) : 1;
    return n > 0 ? n : 1;
  }

  function updateAddButtons(scope, data, v) {
    var s = data.strings;
    qsa('product-form', scope).forEach(function (pf) {
      var btn = pf.querySelector('[data-add-button]');
      if (!btn) return;
      var label = btn.querySelector('[data-add-label]') || btn;
      var priceInButton = pf.getAttribute('data-price-in-button') !== 'false';
      var text;
      var disabled = false;
      if (!v) {
        text = s.unavailable;
        disabled = true;
      } else if (!v.available) {
        text = s.soldOut;
        disabled = true;
      } else {
        var total = v.price * quantityIn(scope);
        var backorder = v.stock && v.stock.state === 'backorder';
        if (backorder) text = priceInButton ? fill(s.preorderPrice, { price: money(total) }) : s.preorder;
        else text = priceInButton ? fill(s.addPrice, { price: money(total) }) : s.add;
      }
      label.textContent = text;
      btn.disabled = disabled;
      var dyn = pf.querySelector('[data-dynamic-checkout]');
      if (dyn) dyn.hidden = disabled;
    });
  }

  function updateScope(scope, data, v) {
    if (!scope || !data) return;
    scope.__lunovaVariant = v;
    var s = data.strings;

    qsa('[data-variant-id-input]', scope).forEach(function (input) {
      input.value = v ? v.id : '';
      input.disabled = !v;
    });

    if (v) {
      // .price wrappers only — the per-night line carries data-price too.
      qsa('[data-price]:not([data-per-night])', scope).forEach(function (el) {
        renderPriceInto(el, { price: v.price, compare: v.compare_at_price, soldOut: false }, s);
      });
      if (typeof L.updatePerNight === 'function') L.updatePerNight(scope, v.price);
      qsa('[data-installments]', scope).forEach(function (el) {
        var count = parseInt(el.getAttribute('data-count'), 10) || 3;
        el.textContent = fill(s.installments, {
          count: count,
          amount: money(Math.floor(v.price / count)),
          provider: el.getAttribute('data-provider') || ''
        });
      });
    }

    var stockState = 'out';
    qsa('[data-stock]', scope).forEach(function (el) {
      var info = stockFor(data, v, el.getAttribute('data-in-stock-text'));
      stockState = info.state;
      el.className = 'stock stock--' + info.state;
      var textEl = el.querySelector('[data-stock-text]') || el;
      textEl.textContent = info.text;
      el.hidden = info.state === 'in' && el.getAttribute('data-show-in-stock') === 'false';
    });
    if (!scope.querySelector('[data-stock]')) stockState = stockFor(data, v).state;

    qsa('[data-delivery-wrap]', scope).forEach(function (el) {
      var hide = stockState === 'out' || stockState === 'backorder';
      el.hidden = hide;
      qsa('[data-countdown]', el).forEach(function (cd) {
        if (hide) cd.setAttribute('data-unavailable', '');
        else cd.removeAttribute('data-unavailable');
        if (L.delivery && typeof L.delivery.render === 'function') L.delivery.render(cd);
      });
    });

    if (v) {
      qsa('[data-free-delivery]', scope).forEach(function (el) {
        var threshold = parseInt(el.getAttribute('data-threshold'), 10) || 0;
        var qualifies = threshold > 0 && v.price * quantityIn(scope) >= threshold;
        el.classList.toggle('is-qualified', qualifies);
        var t = el.querySelector('[data-free-delivery-text]') || el;
        t.textContent = qualifies ? s.qualifies : fill(s.threshold, { amount: moneyShort(threshold) });
      });
    }

    updateAddButtons(scope, data, v);

    if (data.sizeIndex >= 0) {
      var size = v ? v.options[data.sizeIndex] : null;
      qsa('[data-size-row]', scope).forEach(function (row) {
        var isCurrent = row.getAttribute('data-value') === size;
        row.classList.toggle('is-current', isCurrent);
        var btn = row.querySelector('[data-size-guide-choose]');
        if (btn) btn.setAttribute('aria-pressed', String(isCurrent));
      });
    }
  }

  /* ------------------------------------------------------------------------
     Bed Finder
     ---------------------------------------------------------------------- */
  function finderData() {
    if (!settings().finderEnabled || !L.finder || typeof L.finder.get !== 'function') return null;
    try {
      return L.finder.get();
    } catch (e) {
      return null;
    }
  }

  function norm(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** {variant?, value?} for this product from the stored finder result. */
  function recommendation(data) {
    var f = finderData();
    if (!f || !data) return null;
    var exact = f.variantId ? data.byId[parseInt(f.variantId, 10)] : null;
    if (exact) {
      return { variant: exact, value: data.sizeIndex >= 0 ? exact.options[data.sizeIndex] : null };
    }
    if (!f.size || data.sizeIndex < 0) return null;
    var values = [];
    data.variants.forEach(function (v) {
      var val = v.options[data.sizeIndex];
      if (values.indexOf(val) === -1) values.push(val);
    });
    var want = norm(f.size);
    for (var i = 0; i < values.length; i += 1) {
      if (norm(values[i]) === want) return { value: values[i] };
    }
    // The size that suits that dog on THIS bed (breeds or dimensions in the
    // value count), else the next size up: Lunova.sizeMatch.
    if (typeof L.sizeMatch === 'function') {
      var m = L.sizeMatch(values, f.size);
      return m ? { value: m.value } : null;
    }
    if (typeof L.sizeHint === 'function') {
      var wantHint = L.sizeHint(f.size);
      if (wantHint) {
        for (var j = 0; j < values.length; j += 1) {
          var h = L.sizeHint(values[j]);
          if (h && (h === wantHint || norm(h.value) === norm(wantHint.value))) return { value: values[j] };
        }
      }
    }
    return null;
  }

  function updateFinderPrompts(scope, data, rec) {
    var s = (data && data.strings) || {};
    qsa('[data-finder-prompt]', scope).forEach(function (el) {
      var def = el.querySelector('[data-finder-prompt-default]');
      var res = el.querySelector('[data-finder-prompt-result]');
      var textEl = el.querySelector('[data-finder-result-text]');
      // The size row's finder link has no result text: it only swaps to "Retake".
      var show = !!(rec && rec.value && (textEl || res));
      if (show && textEl) {
        var name = L.finder && typeof L.finder.name === 'function' ? L.finder.name() : '';
        var tpl = name ? s.finderResult : s.finderResultDefault;
        /* The finder's own name for the size (Lunova.sizeLabel, as its
           result card says it: "Medium" for "M"), so the recommendation
           reads the same here as it did in the finder. */
        var recLabel = typeof L.sizeLabel === 'function' ? displayCase(L.sizeLabel(rec.value)) : sizeLabelFor(rec.value);
        var vars = { name: name, size: recLabel || sizeLabelFor(rec.value) };
        if (typeof L.fillInto === 'function') L.fillInto(textEl, tpl, vars);
        else textEl.textContent = fill(tpl, vars);
      }
      if (def) def.hidden = show;
      if (res) res.hidden = !show;
      el.classList.toggle('has-result', show);
    });
  }

  /* ------------------------------------------------------------------------
     <variant-picker>
     ---------------------------------------------------------------------- */
  class VariantPicker extends HTMLElement {
    connectedCallback() {
      this.scope = scopeOf(this);
      this.data = productData(this.scope);
      if (!this.data) return;
      this.sectionId = this.getAttribute('data-section-id');
      this.chipIndex = parseInt(this.getAttribute('data-chip-index'), 10) || 0;
      this.status = this.querySelector('[data-variant-status]');
      this.userChose = false;

      var id = parseInt(this.getAttribute('data-current-id'), 10);
      this.variant = this.data.byId[id] || null;
      this.selected = this.variant ? this.variant.options.slice() : this.readSelection();
      if (this.scope.__lunovaVariant === undefined) this.scope.__lunovaVariant = this.variant;

      this._onChange = this.onChange.bind(this);
      this.addEventListener('change', this._onChange);
      var self = this;
      this._offs = [
        on('lunova:finder:complete', function () {
          self.applyFinder(true);
        })
      ];

      this.applyFinder(false);
      this.refreshValues();
    }

    disconnectedCallback() {
      this.removeEventListener('change', this._onChange);
      (this._offs || []).forEach(function (off) {
        off();
      });
    }

    fieldsets() {
      return qsa('fieldset[data-option-index]', this);
    }

    readSelection() {
      return this.fieldsets().map(function (fs) {
        var checked = fs.querySelector('[data-value-input]:checked');
        return checked ? checked.value : null;
      });
    }

    hasUrlVariant() {
      if (!this.hasAttribute('data-update-url')) return false;
      try {
        return new URLSearchParams(window.location.search).has('variant');
      } catch (e) {
        return false;
      }
    }

    onChange(e) {
      var input = e.target;
      if (!input || !input.matches || !input.matches('[data-value-input]')) return;
      var fs = input.closest('fieldset[data-option-index]');
      if (!fs) return;
      this.userChose = true;
      this.choose(parseInt(fs.getAttribute('data-option-index'), 10), input.value, 'picker');
    }

    /** Public: select a value for one option (size guide uses this). */
    selectValue(idx, value) {
      this.userChose = true;
      this.choose(idx, value, 'size-guide');
    }

    choose(idx, value, source) {
      var sel = this.selected.slice();
      sel[idx] = value;
      var v = findVariant(this.data, sel);
      if (!v) {
        v = bestVariantFor(this.data, idx, value, sel);
        if (v) sel = v.options.slice();
      }
      this.select(v, { user: true, selection: sel, source: source, changedIndex: idx });
    }

    select(v, opts) {
      opts = opts || {};
      this.variant = v;
      this.selected = v ? v.options.slice() : opts.selection || this.selected;
      var sel = this.selected;

      this.fieldsets().forEach(function (fs) {
        var idx = parseInt(fs.getAttribute('data-option-index'), 10);
        qsa('[data-value-input]', fs).forEach(function (input) {
          input.checked = input.value === sel[idx];
        });
        // The legend, and the visible label row above the size option, in
        // the picker's display text ("Large", "Beige"), not the raw value.
        var shown = sel[idx] || '';
        qsa('[data-value-input]', fs).forEach(function (input) {
          if (input.value === sel[idx] && input.hasAttribute('data-display')) shown = input.getAttribute('data-display');
        });
        qsa('[data-selected-value]', fs.closest('.variant-picker__group') || fs).forEach(function (label) {
          label.textContent = shown;
        });
      });

      this.refreshValues();
      updateScope(this.scope, this.data, v);

      if (v && opts.user && this.hasAttribute('data-update-url') && window.history && history.replaceState) {
        try {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', v.id);
          history.replaceState(history.state, '', url.toString());
        } catch (e) {
          /* ignore */
        }
      }

      emit('lunova:variant:change', { sectionId: this.sectionId, variant: v, source: opts.source || 'picker' });

      if (opts.user) this.announce(v, opts.changedIndex);
    }

    refreshValues() {
      var data = this.data;
      var sel = this.selected;
      var s = data.strings;
      var self = this;
      this.fieldsets().forEach(function (fs) {
        var idx = parseInt(fs.getAttribute('data-option-index'), 10);
        qsa('[data-value-input]', fs).forEach(function (input) {
          var label = input.id ? self.querySelector('label[for="' + cssEscape(input.id) + '"]') : null;
          if (!label) return;
          var trial = sel.slice();
          trial[idx] = input.value;
          var exact = findVariant(data, trial);
          var state = exact ? (exact.available ? 'available' : 'sold-out') : 'unavailable';
          label.classList.toggle('is-unavailable', state !== 'available');
          var stateEl = label.querySelector('[data-value-state]');
          if (stateEl) {
            if (stateEl.hasAttribute('data-visible-state')) {
              stateEl.textContent = state === 'sold-out' ? s.soldOut : state === 'unavailable' ? s.unavailable : '';
            } else {
              stateEl.textContent =
                state === 'sold-out' ? ', ' + s.valueSoldOut : state === 'unavailable' ? ', ' + s.valueUnavailable : '';
            }
          }
          var priceEl = label.querySelector('[data-value-price]');
          if (priceEl) {
            var pv = exact || cheapestWith(data, idx, input.value);
            if (pv) priceEl.textContent = money(pv.price);
          }
        });
      });
    }

    applyFinder(fromEvent) {
      var rec = recommendation(this.data);
      var chipIdx = this.chipIndex;
      var recValue = rec && rec.value;
      qsa('fieldset[data-option-index]', this).forEach(function (fs) {
        var idx = parseInt(fs.getAttribute('data-option-index'), 10);
        qsa('[data-value-label]', fs).forEach(function (label) {
          var match = idx === chipIdx && recValue != null && label.getAttribute('data-value') === recValue;
          var chip = label.querySelector('[data-recommended-chip]');
          if (chip) chip.hidden = !match;
          // "Most chosen" stays put: the finder's tag sits on the card's edge,
          // so hiding it here would only shift the card's text.
          label.classList.toggle('is-recommended', match);
        });
      });
      if (typeof L.applyFinder === 'function') {
        try {
          L.applyFinder(this);
        } catch (e) {
          /* ignore */
        }
      }
      updateFinderPrompts(this.scope, this.data, rec);

      if (!rec) return;
      if (!fromEvent && (this.hasUrlVariant() || this.userChose)) return;

      var target = rec.variant || null;
      if (!target && recValue != null) {
        var sel = this.selected.slice();
        sel[this.data.sizeIndex] = recValue;
        target = findVariant(this.data, sel);
        if (!target || !target.available) target = bestVariantFor(this.data, this.data.sizeIndex, recValue, sel) || target;
      }
      if (target && target !== this.variant) {
        this.select(target, { user: !!fromEvent, source: 'finder' });
      }
    }

    announce(v, changedIndex) {
      if (!this.status) return;
      var s = this.data.strings;
      var value = v ? variantDisplayTitle(this.data, v) : '';
      if (changedIndex != null) {
        var raw = this.selected[changedIndex];
        value = raw;
        qsa('fieldset[data-option-index="' + changedIndex + '"] [data-value-input]', this).forEach(function (input) {
          if (input.value === raw && input.hasAttribute('data-display')) value = input.getAttribute('data-display');
        });
      }
      var stockEl = this.scope.querySelector('[data-stock]');
      var stock = stockFor(this.data, v, stockEl ? stockEl.getAttribute('data-in-stock-text') : null);
      var msg = v ? fill(s.status, { value: value, price: money(v.price), stock: stock.text }) : s.unavailable;
      var status = this.status;
      status.textContent = '';
      setTimeout(function () {
        status.textContent = msg;
      }, 80);
    }
  }
  // Defined further down, after <sticky-atc> and <media-gallery>, so their
  // listeners exist before the picker's first lunova:variant:change.

  /* ------------------------------------------------------------------------
     <product-form>
     ---------------------------------------------------------------------- */
  function cartDrawer() {
    var d = doc.querySelector('cart-drawer');
    if (!d || typeof d.open !== 'function') return null;
    if (d.disabled) return null;
    return d;
  }

  class ProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      if (this._wired) {
        this.listenFinder();
        return;
      }
      if (!this.form) return;
      this._wired = true;
      this.scope = scopeOf(this);
      this.button = this.querySelector('[data-add-button]');
      this.errorEl = this.querySelector('[data-form-error]');
      this.messageEl = this.querySelector('[data-form-message]');
      this.busy = false;
      // Native validation stays on without JavaScript (a personalised bed
      // can't post without its name); here the form checks the field itself
      // and says what's wrong next to it.
      this.form.noValidate = true;
      this.form.addEventListener('submit', this.onSubmit.bind(this));
      this.addEventListener('click', this.onClick.bind(this));
      this.addEventListener('input', this.onInput.bind(this));
      this.personalise = this.querySelector('[data-personalise-input]');
      this.listenFinder();
    }

    listenFinder() {
      if (!this.personalise || this._offFinder) return;
      var self = this;
      this.prefillName();
      this._offFinder = on('lunova:finder:complete', function () {
        self.prefillName();
      });
    }

    disconnectedCallback() {
      if (this._offFinder) this._offFinder();
      this._offFinder = null;
    }

    /** Personalised: start the name field with the dog's name from the Bed
        Finder, if there is one and nothing has been typed. They still check
        it: the hint under the field says it's made exactly as typed. */
    prefillName() {
      var input = this.personalise;
      if (!input || input.value) return;
      var f = finderData();
      var name = f && typeof f.dogName === 'string' ? f.dogName.trim() : '';
      if (!name) return;
      var max = parseInt(input.getAttribute('maxlength'), 10) || 0;
      input.value = max > 0 ? name.slice(0, max) : name;
    }

    /** True when every required personalisation field is filled in. */
    checkPersonalise() {
      var input = this.personalise;
      if (!input) return true;
      var value = String(input.value || '').replace(/\s+/g, ' ').trim();
      input.value = value;
      var errorEl = this.querySelector('[data-personalise-error]');
      if (value) {
        this.clearPersonaliseError();
        return true;
      }
      var message = errorEl ? errorEl.getAttribute('data-message') || '' : '';
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
        var ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
        if (ids.indexOf(errorEl.id) === -1) ids.push(errorEl.id);
        input.setAttribute('aria-describedby', ids.join(' '));
      }
      input.setAttribute('aria-invalid', 'true');
      try {
        input.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      } catch (e) {
        /* older browsers */
      }
      focusEl(input);
      this.dispatchEvent(new CustomEvent('product-form:end', { bubbles: true, detail: { error: message } }));
      return false;
    }

    clearPersonaliseError() {
      var input = this.personalise;
      var errorEl = this.querySelector('[data-personalise-error]');
      if (!input) return;
      input.removeAttribute('aria-invalid');
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
        var ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(function (id) {
          return id && id !== errorEl.id;
        });
        input.setAttribute('aria-describedby', ids.join(' '));
      }
    }

    data() {
      return productData(this.scope);
    }

    onClick(e) {
      var step = e.target.closest && e.target.closest('[data-qty-step]');
      if (!step) return;
      var input = this.querySelector('[data-qty-input]');
      if (!input) return;
      var min = parseInt(input.min, 10) || 1;
      var max = parseInt(input.max, 10) || 999;
      var next = (parseInt(input.value, 10) || min) + (parseInt(step.getAttribute('data-qty-step'), 10) || 0);
      input.value = Math.min(max, Math.max(min, next));
      this.refresh();
    }

    onInput(e) {
      if (e.target && e.target.matches && e.target.matches('[data-qty-input]')) this.refresh();
      if (e.target && e.target === this.personalise && String(e.target.value || '').trim()) this.clearPersonaliseError();
    }

    refresh() {
      var data = this.data();
      if (!data || !this.scope) return;
      var v = currentVariant(this.scope, data);
      if (v) updateScope(this.scope, data, v);
      else updateAddButtons(this.scope, data, v);
    }

    setBusy(busy) {
      this.busy = busy;
      if (!this.button) return;
      if (busy) this.button.setAttribute('aria-busy', 'true');
      else this.button.removeAttribute('aria-busy');
    }

    clearMessages() {
      if (this.errorEl) {
        this.errorEl.textContent = '';
        this.errorEl.hidden = true;
      }
      if (this.messageEl) this.messageEl.textContent = '';
    }

    showError(message) {
      if (!this.errorEl) return;
      this.errorEl.textContent = message;
      this.errorEl.hidden = false;
    }

    showAdded() {
      if (!this.messageEl) return;
      var s = (this.data() || {}).strings || {};
      this.messageEl.textContent = '';
      var p = doc.createElement('p');
      p.className = 'product-form__added';
      p.appendChild(doc.createTextNode((s.added || '') + ' '));
      var a = doc.createElement('a');
      a.href = (L.routes && (L.routes.cartUrl || L.routes.cart)) || '/cart';
      a.textContent = s.viewBasket || '';
      p.appendChild(a);
      this.messageEl.appendChild(p);
    }

    onSubmit(e) {
      if (!this.checkPersonalise()) {
        e.preventDefault();
        return;
      }
      if (!window.fetch || !L.cart || typeof L.cart.add !== 'function') return; // native post
      e.preventDefault();
      if (this.busy) return;
      if (this.button && this.button.disabled) return;

      var fd = new FormData(this.form);
      /* The picker's own id field, so a stray "id" input from any other
         script or app block can't override the chosen variant. */
      var own = this.form.querySelector('[data-variant-id-input]');
      var ids = fd.getAll('id');
      var id = parseInt(own && own.value ? own.value : ids[ids.length - 1], 10);
      var s = (this.data() || {}).strings || {};
      if (!id) {
        this.showError(s.unavailable || s.error || '');
        return;
      }
      var quantity = Math.max(1, parseInt(fd.get('quantity'), 10) || 1);
      var item = { id: id, quantity: quantity };
      var properties = {};
      var hasProps = false;
      fd.forEach(function (value, key) {
        var m = /^properties\[(.+)\]$/.exec(key);
        if (m && typeof value === 'string' && value !== '') {
          properties[m[1]] = value;
          hasProps = true;
        }
      });
      if (hasProps) item.properties = properties;
      var plan = fd.get('selling_plan');
      if (plan) item.selling_plan = plan;

      var cfg = settings();
      var onCartPage = L.template === 'cart';
      var drawer = cfg.cartType !== 'page' && !onCartPage ? cartDrawer() : null;
      var sectionId = drawer ? drawer.getAttribute('data-section-id') || 'cart-drawer' : null;
      var self = this;

      this.clearMessages();
      this.setBusy(true);
      this.dispatchEvent(new CustomEvent('product-form:start', { bubbles: true }));

      L.cart
        .add([item], { sections: sectionId ? [sectionId] : null, source: 'product-form' })
        .then(function (res) {
          self.setBusy(false);
          self.dispatchEvent(new CustomEvent('product-form:end', { bubbles: true, detail: {} }));
          if (cfg.cartType === 'page' || onCartPage) {
            window.location.href = (L.routes && (L.routes.cartUrl || L.routes.cart)) || '/cart';
            return;
          }
          if (!drawer) {
            self.showAdded();
            return;
          }
          var added = null;
          var items = (res && res.items) || [];
          items.some(function (it) {
            if (it.variant_id === id || it.id === id) {
              added = it;
              return true;
            }
            return false;
          });
          if (!added && res && res.cart && res.cart.items) {
            res.cart.items.some(function (it) {
              if (it.variant_id === id) {
                added = it;
                return true;
              }
              return false;
            });
          }
          emit('lunova:cart:open', { added: added || { variant_id: id }, reason: 'add', opener: self.button, cart: res && res.cart });
        })
        .catch(function (err) {
          self.setBusy(false);
          if (!err || !err.status) {
            // Network trouble: the plain form post still works.
            self.form.submit();
            return;
          }
          var message = (err && err.description) || s.error || '';
          self.showError(message);
          self.dispatchEvent(new CustomEvent('product-form:end', { bubbles: true, detail: { error: message } }));
        });
    }
  }
  define('product-form', ProductForm);

  /* ------------------------------------------------------------------------
     <sticky-atc>
     ---------------------------------------------------------------------- */
  class StickyAtc extends HTMLElement {
    connectedCallback() {
      if (this._wired) return;
      this.scope = scopeOf(this);
      this.data = productData(this.scope);
      this.main = this.scope ? this.scope.querySelector('product-form [data-add-button]') : null;
      this.btn = this.querySelector('[data-sticky-add]');
      this.errorEl = this.querySelector('[data-sticky-error]');
      if (!this.main || !this.btn || !('IntersectionObserver' in window)) return;
      this._wired = true;
      this.sectionId = this.getAttribute('data-section-id');
      this.past = false;
      this.below = false;
      this.nearFooter = false;
      var self = this;

      // The bar is there whenever the main Add button is out of view: below
      // the fold at first paint (a cold mobile visitor would otherwise scroll
      // ~800px before any Add button shows, with the size already chosen) and
      // after it has scrolled up past the top. It steps aside while the main
      // button is on screen, so there are never two Add buttons in view.
      // Read from geometry on every scroll frame, not from intersection
      // changes: a jump from below the viewport to above it (anchor link,
      // scroll restore, a fast fling) never intersects, so an observer alone
      // would miss it. A display:none button reads a 0×0 rect at 0, so it
      // never counts as out of view.
      this._check = function () {
        if (self._raf) return;
        self._raf = window.requestAnimationFrame(function () {
          self._raf = 0;
          if (!self.main) return;
          var r = self.main.getBoundingClientRect();
          var vh = window.innerHeight || doc.documentElement.clientHeight;
          self.past = r.bottom < 0;
          self.below = r.top > vh;
          self.toggle();
        });
      };
      window.addEventListener('scroll', this._check, { passive: true });
      window.addEventListener('resize', this._check);
      window.addEventListener('pageshow', this._check);

      // The observer only tracks the footer, where the bar steps aside.
      this.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          self.nearFooter = entry.isIntersecting;
        });
        self.toggle();
      });
      var footer = doc.querySelector('.shopify-section-group-footer-group') || doc.querySelector('footer');
      if (footer) this.io.observe(footer);

      this.btn.addEventListener('click', this.add.bind(this));
      this._offs = [
        on('lunova:variant:change', function (e) {
          var d = e.detail || {};
          if (d.sectionId === self.sectionId) self.update(d.variant);
        })
      ];
      this._onStart = function () {
        if (self.fromSticky) self.btn.setAttribute('aria-busy', 'true');
        if (self.errorEl) self.errorEl.hidden = true;
      };
      this._onEnd = function (e) {
        self.btn.removeAttribute('aria-busy');
        var err = e.detail && e.detail.error;
        if (err && self.fromSticky && self.errorEl) {
          self.errorEl.textContent = err;
          self.errorEl.hidden = false;
        }
        self.fromSticky = false;
      };
      this.scope.addEventListener('product-form:start', this._onStart);
      this.scope.addEventListener('product-form:end', this._onEnd);
      this._onOpen = function () {
        self.btn.removeAttribute('aria-busy');
        self.fromSticky = false;
      };
      this._offs.push(on('lunova:cart:open', this._onOpen));

      // The picker may already have chosen a variant (Bed Finder size, a
      // theme-editor reload) before this bar was upgraded: show that one,
      // not the server-rendered default.
      if (this.data) this.update(currentVariant(this.scope, this.data));
      this._check();
    }

    disconnectedCallback() {
      if (this.io) this.io.disconnect();
      if (this._check) {
        window.removeEventListener('scroll', this._check);
        window.removeEventListener('resize', this._check);
        window.removeEventListener('pageshow', this._check);
      }
      if (this._raf) {
        window.cancelAnimationFrame(this._raf);
        this._raf = 0;
      }
      this._shown = undefined;
      (this._offs || []).forEach(function (off) {
        off();
      });
      if (this.scope) {
        this.scope.removeEventListener('product-form:start', this._onStart);
        this.scope.removeEventListener('product-form:end', this._onEnd);
      }
      doc.documentElement.classList.remove('has-sticky-atc');
      this._wired = false;
    }

    toggle() {
      // Below the fold the bar is an offer to buy now, so a disabled
      // "Sold out" bar never greets a visitor; once they have scrolled past
      // the main button it keeps them company whatever the variant's state.
      var out = this.past || (this.below && !this.btn.disabled);
      var show = out && !this.nearFooter;
      if (show === this._shown) return;
      this._shown = show;
      if (!show && this.contains(doc.activeElement)) focusEl(this.main);
      this.classList.toggle('is-visible', show);
      this.setAttribute('aria-hidden', String(!show));
      if (show) this.removeAttribute('inert');
      else this.setAttribute('inert', '');
      // The bar's real height feeds scroll-padding-bottom (product.css), so
      // focus scrolled into view never lands underneath it (WCAG 2.4.11).
      if (show && this.offsetHeight) doc.documentElement.style.setProperty('--sticky-atc-h', this.offsetHeight + 'px');
      doc.documentElement.classList.toggle('has-sticky-atc', show);
    }

    add() {
      if (!this.main || this.main.disabled) return;
      var form = this.main.form;
      this.fromSticky = true;
      if (form && typeof form.requestSubmit === 'function') form.requestSubmit(this.main);
      else this.main.click();
    }

    update(v) {
      var data = this.data;
      var s = (data && data.strings) || {};
      var label = this.querySelector('[data-sticky-label]');
      if (!v) {
        this.btn.disabled = true;
        if (label) label.textContent = s.unavailable || '';
        if (this._wired) this.toggle();
        return;
      }
      this.btn.disabled = !v.available;
      // Availability decides whether the bar may show below the fold.
      if (this._wired) this.toggle();
      if (label) {
        if (!v.available) label.textContent = s.soldOut || '';
        else if (v.stock && v.stock.state === 'backorder') label.textContent = s.preorder || '';
        else label.textContent = s.add || '';
      }
      var title = this.querySelector('[data-sticky-variant]');
      if (title) title.textContent = data ? variantDisplayTitle(data, v) : v.title;
      var price = this.querySelector('[data-sticky-price]');
      if (price) price.textContent = money(v.price);
      var compare = this.querySelector('[data-sticky-compare]');
      if (compare) {
        var onSale = v.compare_at_price > v.price && settings().showCompareSavings !== false;
        compare.hidden = !onSale;
        compare.textContent = onSale ? money(v.compare_at_price) : '';
      }
      var img = this.querySelector('[data-sticky-image]');
      var src = (v.featured_media && v.featured_media.src) || (data && data.image);
      if (img && src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    }
  }
  define('sticky-atc', StickyAtc);

  /* ------------------------------------------------------------------------
     Dialog helper (size guide, lightbox)
     ---------------------------------------------------------------------- */
  function openDialog(dlg, opener) {
    if (!dlg || dlg.open) return;
    dlg.__opener = opener || doc.activeElement;
    if (!dlg.__wired) {
      dlg.__wired = true;
      dlg.addEventListener('close', function () {
        if (typeof L.unlockScroll === 'function') L.unlockScroll();
        var o = dlg.__opener;
        dlg.__opener = null;
        if (o && doc.contains(o)) focusEl(o);
      });
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) dlg.close();
      });
    }
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    if (typeof L.lockScroll === 'function') L.lockScroll();
  }

  function closeDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.close === 'function' && dlg.open) dlg.close();
    else dlg.removeAttribute('open');
  }

  /* ------------------------------------------------------------------------
     <media-gallery>
     ---------------------------------------------------------------------- */
  class MediaGallery extends HTMLElement {
    connectedCallback() {
      if (this._wired) return;
      this.track = this.querySelector('[data-gallery-track]');
      if (!this.track) return;
      this._wired = true;
      this.sectionId = this.getAttribute('data-section-id');
      this.index = 0;
      this.collect();

      var self = this;
      this._onScroll = function () {
        if (self._raf) return;
        self._raf = window.requestAnimationFrame(function () {
          self._raf = null;
          self.syncFromScroll();
        });
      };
      this.track.addEventListener('scroll', this._onScroll, { passive: true });
      this.addEventListener('click', this.onClick.bind(this));
      this.addEventListener('keydown', this.onKeydown.bind(this));
      this._offs = [
        on('lunova:variant:change', function (e) {
          var d = e.detail || {};
          if (d.sectionId !== self.sectionId || !d.variant || !d.variant.featured_media) return;
          self.showMedia(d.variant.featured_media.id);
        })
      ];
      this.update(0);

      // Follow a variant the picker chose before this gallery was upgraded
      // (Bed Finder size). For the server-rendered variant this is a no-op:
      // its photo is already first.
      var sc = scopeOf(this);
      var cv = sc && sc.__lunovaVariant;
      if (cv && cv.featured_media) this.showMedia(cv.featured_media.id);
    }

    disconnectedCallback() {
      if (this.track) this.track.removeEventListener('scroll', this._onScroll);
      (this._offs || []).forEach(function (off) {
        off();
      });
      this._wired = false;
    }

    collect() {
      this.slides = qsa('[data-gallery-slide]', this);
      this.slides.forEach(function (slide, i) {
        slide.setAttribute('data-index', i);
      });
      this.thumbs = qsa('[data-gallery-thumb]', this);
      this.dots = qsa('[data-gallery-dot]', this);
      this.counter = this.querySelector('[data-gallery-current]');
      this.prevBtn = this.querySelector('[data-gallery-prev]');
      this.nextBtn = this.querySelector('[data-gallery-next]');
    }

    isGrid() {
      return this.getAttribute('data-layout') === 'grid' && window.matchMedia('(min-width: 990px)').matches;
    }

    onClick(e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      var thumb = t.closest('[data-gallery-thumb]');
      if (thumb) {
        this.showMedia(thumb.getAttribute('data-media-id'), parseInt(thumb.getAttribute('data-index'), 10));
        return;
      }
      if (t.closest('[data-gallery-prev]')) return this.go(this.index - 1);
      if (t.closest('[data-gallery-next]')) return this.go(this.index + 1);

      var play = t.closest('[data-deferred-play]');
      if (play) {
        this.activateDeferred(play.closest('[data-deferred-media]'));
        return;
      }

      var zoomBtn = t.closest('[data-zoom-open]');
      var zoomArea = t.closest('[data-zoom-target]');
      if (zoomBtn || zoomArea) {
        var slide = t.closest('[data-gallery-slide]');
        if (slide) this.openLightbox(slide, zoomBtn || slide.querySelector('[data-zoom-open]'));
        return;
      }

      var lb = t.closest('[data-lightbox]');
      if (lb) this.onLightboxClick(e, lb);
    }

    onKeydown(e) {
      if (e.target.closest && e.target.closest('[data-lightbox]')) {
        this.onLightboxKey(e);
        return;
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (!e.target.closest || !e.target.closest('.gallery__viewer, [data-gallery-thumbs]')) return;
      if (this.isGrid()) return;
      e.preventDefault();
      var dir = e.key === 'ArrowRight' ? 1 : -1;
      if (doc.documentElement.dir === 'rtl') dir *= -1;
      this.go(this.index + dir, true);
    }

    go(i, focusZoom) {
      if (!this.slides.length) return;
      i = Math.max(0, Math.min(this.slides.length - 1, i));
      this.scrollToIndex(i, true);
      this.update(i);
      if (focusZoom) {
        var z = this.slides[i].querySelector('[data-zoom-open], [data-deferred-play]');
        if (z) focusEl(z);
      }
    }

    scrollToIndex(i, smooth) {
      var slide = this.slides[i];
      if (!slide || this.isGrid()) return;
      var self = this;
      // While a programmatic scroll glides, don't let scroll events pull the
      // counter back through the slides it passes.
      this._target = i;
      clearTimeout(this._targetTimer);
      this._targetTimer = setTimeout(function () {
        self._target = null;
        self.syncFromScroll();
      }, 900);
      this.track.scrollTo({ left: slide.offsetLeft, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    }

    showMedia(mediaId, fallbackIndex) {
      var id = String(mediaId);
      var slide = this.querySelector('[data-gallery-slide][data-media-id="' + cssEscape(id) + '"]');
      if (!slide) {
        if (fallbackIndex != null && !isNaN(fallbackIndex)) this.go(fallbackIndex);
        return;
      }
      if (this.isGrid()) {
        // Grid on desktop: bring the variant's photo to the top, no page jump.
        if (slide !== this.track.firstElementChild) {
          this.track.insertBefore(slide, this.track.firstElementChild);
          this.collect();
        }
        this.update(0);
        return;
      }
      this.go(this.slides.indexOf(slide));
    }

    syncFromScroll() {
      if (this.isGrid() || !this.slides.length) return;
      var x = Math.abs(this.track.scrollLeft);
      var best = 0;
      var bestDist = Infinity;
      for (var i = 0; i < this.slides.length; i += 1) {
        var d = Math.abs(this.slides[i].offsetLeft - x);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      if (this._target != null) {
        if (best !== this._target) return;
        this._target = null;
        clearTimeout(this._targetTimer);
      }
      if (best !== this.index) this.update(best);
    }

    update(i) {
      var prev = this.index;
      this.index = i;
      var self = this;
      this.slides.forEach(function (slide, n) {
        var active = n === i;
        slide.classList.toggle('is-active', active);
        qsa('[data-zoom-open], [data-deferred-play]', slide).forEach(function (b) {
          if (active || self.isGrid()) b.removeAttribute('tabindex');
          else b.setAttribute('tabindex', '-1');
        });
        if (!active && n === prev) self.pauseSlide(slide);
      });
      if (this.counter) this.counter.textContent = String(i + 1);
      this.dots.forEach(function (dot, n) {
        dot.classList.toggle('is-active', n === i);
      });
      var activeId = this.slides[i] ? this.slides[i].getAttribute('data-media-id') : null;
      var list = this.querySelector('.gallery__thumb-list');
      this.thumbs.forEach(function (thumb) {
        var on = thumb.getAttribute('data-media-id') === activeId;
        thumb.setAttribute('aria-current', on ? 'true' : 'false');
        if (on && list && list.scrollWidth > list.clientWidth) {
          var left = thumb.parentElement.offsetLeft - (list.clientWidth - thumb.parentElement.offsetWidth) / 2;
          list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
      });
      if (this.prevBtn) this.prevBtn.disabled = i <= 0;
      if (this.nextBtn) this.nextBtn.disabled = i >= this.slides.length - 1;
    }

    pauseSlide(slide) {
      qsa('video', slide).forEach(function (v) {
        try {
          v.pause();
        } catch (e) {
          /* ignore */
        }
      });
      var deferred = slide.querySelector('[data-deferred-media][data-loaded]');
      if (deferred) this.deactivateDeferred(deferred);
    }

    activateDeferred(box) {
      if (!box || box.hasAttribute('data-loaded')) return;
      var tpl = box.querySelector('template[data-deferred-template]');
      var poster = box.querySelector('[data-deferred-play]');
      if (!tpl) return;
      box.setAttribute('data-loaded', '');
      var content = tpl.content.cloneNode(true);
      var holder = doc.createElement('div');
      holder.className = 'gallery__embed';
      holder.setAttribute('data-deferred-holder', '');
      holder.appendChild(content);
      box.appendChild(holder);
      if (poster) poster.hidden = true;

      if (box.hasAttribute('data-model') && window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
        window.Shopify.loadFeatures([
          {
            name: 'model-viewer-ui',
            version: '1.0',
            onLoad: function (err) {
              if (err) return;
              var mv = holder.querySelector('model-viewer');
              if (mv && window.Shopify.ModelViewerUI) {
                try {
                  holder.__ui = new window.Shopify.ModelViewerUI(mv);
                } catch (e) {
                  /* ignore */
                }
              }
            }
          }
        ]);
      }
      var focusable = holder.querySelector('iframe, video, model-viewer');
      if (focusable) focusEl(focusable);
    }

    deactivateDeferred(box) {
      var holder = box.querySelector('[data-deferred-holder]');
      if (holder) holder.remove();
      box.removeAttribute('data-loaded');
      var poster = box.querySelector('[data-deferred-play]');
      if (poster) poster.hidden = false;
    }

    /* -- Lightbox ------------------------------------------------------ */
    lightbox() {
      return this.querySelector('[data-lightbox]');
    }

    buildLightbox(lb) {
      if (lb.__built) return;
      lb.__built = true;
      var track = lb.querySelector('[data-lightbox-track]');
      var self = this;
      this.lbItems = [];
      qsa('[data-zoom-open]', this).forEach(function (btn) {
        var fig = doc.createElement('figure');
        fig.className = 'gallery-lightbox__item';
        fig.setAttribute('data-lightbox-item', '');
        var img = doc.createElement('img');
        img.className = 'gallery-lightbox__img';
        img.alt = btn.getAttribute('data-zoom-alt') || '';
        img.decoding = 'async';
        img.loading = 'lazy';
        img.setAttribute('data-src', btn.getAttribute('data-zoom-src'));
        var w = btn.getAttribute('data-zoom-width');
        var h = btn.getAttribute('data-zoom-height');
        if (w && h) {
          img.width = parseInt(w, 10);
          img.height = parseInt(h, 10);
        }
        fig.appendChild(img);
        track.appendChild(fig);
        var slide = btn.closest('[data-gallery-slide]');
        self.lbItems.push({ fig: fig, img: img, mediaId: slide ? slide.getAttribute('data-media-id') : null });
      });
      track.addEventListener(
        'scroll',
        function () {
          if (self._lbRaf) return;
          self._lbRaf = window.requestAnimationFrame(function () {
            self._lbRaf = null;
            self.syncLightbox();
          });
        },
        { passive: true }
      );
      lb.addEventListener('close', function () {
        self.lbItems.forEach(function (it) {
          it.fig.classList.remove('is-zoomed');
        });
        lb.classList.remove('is-zoomed');
      });
    }

    openLightbox(slide, opener) {
      var lb = this.lightbox();
      if (!lb) return;
      this.buildLightbox(lb);
      var id = slide.getAttribute('data-media-id');
      var idx = 0;
      this.lbItems.forEach(function (it, n) {
        if (it.mediaId === id) idx = n;
      });
      openDialog(lb, opener);
      this.lbShow(idx, false);
    }

    lbLoad(n) {
      var it = this.lbItems && this.lbItems[n];
      if (it && !it.img.getAttribute('src')) it.img.setAttribute('src', it.img.getAttribute('data-src'));
    }

    lbShow(n, smooth) {
      if (!this.lbItems || !this.lbItems.length) return;
      n = Math.max(0, Math.min(this.lbItems.length - 1, n));
      this.lbLoad(n);
      this.lbLoad(n + 1);
      this.lbLoad(n - 1);
      var lb = this.lightbox();
      var track = lb.querySelector('[data-lightbox-track]');
      var fig = this.lbItems[n].fig;
      track.scrollTo({ left: fig.offsetLeft, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
      this.lbSet(n);
    }

    lbSet(n) {
      this.lbIndex = n;
      var lb = this.lightbox();
      var counter = lb.querySelector('[data-lightbox-counter]');
      if (counter) counter.textContent = n + 1 + ' / ' + this.lbItems.length;
      var prev = lb.querySelector('[data-lightbox-prev]');
      var next = lb.querySelector('[data-lightbox-next]');
      if (prev) prev.disabled = n <= 0;
      if (next) next.disabled = n >= this.lbItems.length - 1;
      var hideNav = this.lbItems.length < 2;
      if (prev) prev.hidden = hideNav;
      if (next) next.hidden = hideNav;
    }

    syncLightbox() {
      var lb = this.lightbox();
      if (!lb || !this.lbItems || lb.classList.contains('is-zoomed')) return;
      var track = lb.querySelector('[data-lightbox-track]');
      var x = Math.abs(track.scrollLeft);
      var best = 0;
      var bestDist = Infinity;
      this.lbItems.forEach(function (it, n) {
        var d = Math.abs(it.fig.offsetLeft - x);
        if (d < bestDist) {
          bestDist = d;
          best = n;
        }
      });
      if (best !== this.lbIndex) {
        this.lbLoad(best + 1);
        this.lbLoad(best - 1);
        this.lbSet(best);
      }
    }

    onLightboxClick(e, lb) {
      var t = e.target;
      if (t.closest('[data-lightbox-close]')) return closeDialog(lb);
      if (t.closest('[data-lightbox-prev]')) return this.lbShow(this.lbIndex - 1, true);
      if (t.closest('[data-lightbox-next]')) return this.lbShow(this.lbIndex + 1, true);
      var fig = t.closest('[data-lightbox-item]');
      if (fig && t.tagName === 'IMG') this.toggleZoom(fig, e);
    }

    toggleZoom(fig, e) {
      var lb = this.lightbox();
      var zoomed = !fig.classList.contains('is-zoomed');
      var img = fig.querySelector('img');
      var rect = img.getBoundingClientRect();
      var rx = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
      var ry = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;
      fig.classList.toggle('is-zoomed', zoomed);
      lb.classList.toggle('is-zoomed', zoomed);
      if (zoomed) {
        window.requestAnimationFrame(function () {
          fig.scrollLeft = Math.max(0, rx * fig.scrollWidth - fig.clientWidth / 2);
          fig.scrollTop = Math.max(0, ry * fig.scrollHeight - fig.clientHeight / 2);
        });
      }
    }

    onLightboxKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var lb = this.lightbox();
        if (lb.classList.contains('is-zoomed')) return;
        e.preventDefault();
        this.lbShow(this.lbIndex + (e.key === 'ArrowRight' ? 1 : -1), true);
      }
    }
  }
  define('media-gallery', MediaGallery);
  define('variant-picker', VariantPicker);

  /* ------------------------------------------------------------------------
     <product-recommendations>
     ---------------------------------------------------------------------- */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (this._wired) return;
      this._wired = true;
      var url = this.getAttribute('data-url');
      this.section = this.closest('section');
      if (!url) return;
      var self = this;
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(
          function (entries) {
            if (!entries.some(function (en) { return en.isIntersecting; })) return;
            self.io.disconnect();
            self.load(url);
          },
          { rootMargin: '0px 0px 600px 0px' }
        );
        // A hidden section has no box to intersect; watch its wrapper instead.
        this.io.observe((this.section && this.section.parentElement) || this);
      } else {
        this.load(url);
      }
    }

    disconnectedCallback() {
      if (this.io) this.io.disconnect();
      this._wired = false;
    }

    load(url) {
      var self = this;
      fetch(url, { credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (html) {
          var parsed = new DOMParser().parseFromString(html, 'text/html');
          var fresh = parsed.querySelector('product-recommendations');
          var list = fresh && fresh.querySelector('[data-recs-list]');
          if (list && list.children.length) {
            self.innerHTML = fresh.innerHTML;
            if (self.section) self.section.hidden = false;
          } else {
            self.empty();
          }
        })
        .catch(function () {
          self.empty();
        });
    }

    /** Nothing recommended: the same-type products the page rendered into
        <template data-recs-fallback>, else hide the section. */
    empty() {
      if (designMode()) return;
      var tpl = this.querySelector('template[data-recs-fallback]');
      if (tpl && tpl.content && tpl.content.querySelector('[data-recs-list] > *')) {
        this.innerHTML = tpl.innerHTML;
        if (this.section) this.section.hidden = false;
        return;
      }
      if (this.section) this.section.hidden = true;
    }
  }
  define('product-recommendations', ProductRecommendations);

  /* ------------------------------------------------------------------------
     Recently viewed
     ---------------------------------------------------------------------- */
  /** Same test as snippets/buy-box (minus the metafield, which /products/x.js
      doesn't carry): type mentions Personalised, or tag personalised /
      personalized / personalised dog bed / personalisation:yes; tag
      personalisation:no turns it off. */
  function personalised(p) {
    if (!p) return false;
    var tags = p.tags || [];
    if (typeof tags === 'string') tags = tags.split(',');
    tags = tags.map(function (t) {
      return String(t).trim().toLowerCase();
    });
    if (tags.indexOf('personalisation:no') !== -1) return false;
    var type = String(p.type || p.product_type || '').toLowerCase();
    if (/personalis|personaliz/.test(type)) return true;
    return ['personalised', 'personalized', 'personalised dog bed', 'personalized dog bed', 'personalisation:yes'].some(function (t) {
      return tags.indexOf(t) !== -1;
    });
  }

  function recentList() {
    var list = L.store && typeof L.store.get === 'function' ? L.store.get(RECENT_KEY) : null;
    return Array.isArray(list) ? list.filter(function (h) { return typeof h === 'string' && h; }) : [];
  }

  function saveRecent(list) {
    if (L.store && typeof L.store.set === 'function') L.store.set(RECENT_KEY, list.slice(0, RECENT_MAX));
  }

  function recordView(handle) {
    if (!handle) return;
    var list = recentList().filter(function (h) {
      return h !== handle;
    });
    list.unshift(handle);
    saveRecent(list);
  }

  function withWidth(src, width) {
    if (!src) return '';
    return src + (src.indexOf('?') > -1 ? '&' : '?') + 'width=' + width;
  }

  class RecentlyViewed extends HTMLElement {
    connectedCallback() {
      if (this._wired) return;
      this._wired = true;
      this.section = this.closest('[data-recently-viewed-section]');
      this.list = this.querySelector('[data-recent-list]');
      this.tpl = this.querySelector('template[data-recent-template]');
      this.status = this.querySelector('[data-recent-status]');
      this.strings = {};
      var self = this;
      var stpl = this.querySelector('template[data-recent-strings]');
      if (stpl) {
        qsa('[data-k]', stpl.content).forEach(function (el) {
          var k = el.getAttribute('data-k');
          self.strings[k] = k === 'plusIcon' ? el.innerHTML : el.textContent;
        });
      }
      this.clearBtn = this.section ? this.section.querySelector('[data-recent-clear]') : null;
      if (this.clearBtn) this.clearBtn.addEventListener('click', this.clear.bind(this));

      // data-exclude is a comma-separated list: the product you're on, or on
      // the basket page every bed already in the basket.
      this.exclude = (this.getAttribute('data-exclude') || '').split(',').map(function (h) {
        return h.trim();
      }).filter(Boolean);
      this.limit = parseInt(this.getAttribute('data-limit'), 10) || 4;
      var handles = this.wanted();
      if (this.hasAttribute('data-cart-sync')) {
        this.offCart = on('lunova:cart:updated', function (e) {
          var cart = e && e.detail && e.detail.cart;
          if (cart && cart.items) self.syncCart(cart);
        });
      }
      if (!handles.length) {
        this.hide();
        return;
      }
      if ('IntersectionObserver' in window && this.section) {
        this.io = new IntersectionObserver(
          function (entries) {
            if (!entries.some(function (en) { return en.isIntersecting; })) return;
            self.io.disconnect();
            self.io = null;
            self.load(self.wanted());
          },
          { rootMargin: '0px 0px 600px 0px' }
        );
        // A hidden section has no box to intersect; watch its parent instead.
        this.io.observe(this.section.parentElement || this.section);
      } else {
        this.load(handles);
      }
    }

    disconnectedCallback() {
      if (this.io) this.io.disconnect();
      if (this.offCart) this.offCart();
      this._wired = false;
    }

    /** Stored handles minus the excluded ones, newest first, up to the limit. */
    wanted() {
      var ex = this.exclude || [];
      return recentList()
        .filter(function (h) {
          return ex.indexOf(h) === -1;
        })
        .slice(0, this.limit || 4);
    }

    /** Basket page: keep the row to beds that aren't in the basket as it changes. */
    syncCart(cart) {
      var next = cart.items
        .map(function (it) {
          return it && it.handle;
        })
        .filter(Boolean);
      this.exclude = next;
      if (this.io) return; // not loaded yet: the observer reads wanted() when it fires
      var handles = this.wanted();
      var shown = this.list
        ? qsa('[data-finder-match-handle]', this.list).map(function (el) {
            return el.getAttribute('data-finder-match-handle');
          })
        : [];
      if (handles.join(',') === shown.join(',') && !(this.section && this.section.hidden)) return;
      if (!handles.length) {
        this._seq = (this._seq || 0) + 1; // drop any load still in flight
        if (this.list && !designMode()) this.list.textContent = '';
        this.hide();
        return;
      }
      this.load(handles);
    }

    hide() {
      if (designMode()) return;
      if (this.section) this.section.hidden = true;
    }

    root() {
      var r = this.getAttribute('data-root') || (L.routes && L.routes.root) || '/';
      return r.charAt(r.length - 1) === '/' ? r : r + '/';
    }

    load(handles) {
      var self = this;
      var root = this.root();
      var seq = (this._seq = (this._seq || 0) + 1);
      Promise.all(
        handles.map(function (h) {
          return fetch(root + 'products/' + encodeURIComponent(h) + '.js', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
          })
            .then(function (res) {
              if (res.status === 404) return { __gone: h };
              return res.ok ? res.json() : null;
            })
            .catch(function () {
              return null;
            });
        })
      ).then(function (results) {
        if (seq !== self._seq) return; // a newer load (the basket changed) supersedes this one
        var gone = results.filter(function (r) { return r && r.__gone; }).map(function (r) { return r.__gone; });
        if (gone.length) {
          saveRecent(recentList().filter(function (h) { return gone.indexOf(h) === -1; }));
        }
        var products = results.filter(function (p) {
          return p && p.handle && p.url;
        });
        if (!products.length) {
          self.hide();
          return;
        }
        self.render(products);
      });
    }

    render(products) {
      if (!this.list || !this.tpl) return;
      var self = this;
      var frag = doc.createDocumentFragment();
      products.forEach(function (p, i) {
        var node = self.card(p, i);
        if (node) frag.appendChild(node);
      });
      this.list.textContent = '';
      this.list.appendChild(frag);
      if (this.section) this.section.hidden = false;
      if (this.clearBtn) this.clearBtn.hidden = false;
      var slider = this.querySelector('slider-row');
      if (slider && typeof slider.update === 'function') slider.update();
    }

    card(p, i) {
      var s = this.strings;
      var frag = this.tpl.content.cloneNode(true);
      var li = frag.firstElementChild;
      if (!li) return null;
      var card = li.querySelector('.product-card');
      card.setAttribute('data-finder-match-handle', p.handle);
      card.setAttribute('data-product-id', p.id);
      card.setAttribute('data-product-url', p.url);
      card.style.setProperty('--i', String(i + 1));
      if (!p.available) card.classList.add('is-sold-out');

      var link = card.querySelector('[data-card-link]');
      link.href = p.url;
      link.textContent = p.title;

      var media = card.querySelector('[data-card-media]');
      var src = p.featured_image || (p.media && p.media[0] && p.media[0].preview_image && p.media[0].preview_image.src);
      if (src) {
        var img = doc.createElement('img');
        img.className = 'product-card__img product-card__img--primary';
        img.src = withWidth(src, 540);
        img.srcset = [240, 360, 540, 720].map(function (w) { return withWidth(src, w) + ' ' + w + 'w'; }).join(', ');
        img.sizes = '(min-width: 1200px) 300px, (min-width: 990px) 25vw, (min-width: 750px) 40vw, 78vw';
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        var pi = p.media && p.media[0] && p.media[0].preview_image;
        if (pi && pi.width && pi.height) {
          img.width = 540;
          img.height = Math.round((540 * pi.height) / pi.width);
        }
        media.appendChild(img);
      }

      var variants = p.variants || [];
      var from = variants.reduce(function (best, v) {
        if (!best || v.price < best.price || (v.price === best.price && v.available && !best.available)) return v;
        return best;
      }, null);
      var priceEl = card.querySelector('[data-card-price]');
      renderPriceInto(
        priceEl,
        {
          price: from ? from.price : p.price_min || p.price,
          compare: from ? from.compare_at_price || 0 : 0,
          from: !!p.price_varies,
          showSave: false
        },
        { wasPrice: s.was, salePrice: s.sale, regularPrice: s.regular, from: s.from }
      );

      var badges = card.querySelector('[data-card-badges]');
      if (!p.available && badges) {
        var sold = doc.createElement('span');
        sold.className = 'badge badge--muted';
        var inner = doc.createElement('span');
        inner.textContent = s.soldOut || '';
        sold.appendChild(inner);
        badges.appendChild(sold);
      }

      var actions = card.querySelector('[data-card-actions]');
      if (actions && p.available && this.getAttribute('data-quick-add') === 'true') {
        var forText = fill(s.quickFor || '', { title: p.title });
        // A personalised product needs its name field, so it always opens the
        // quick-add drawer (snippets/buy-box), never a one-tap add.
        if (variants.length > 1 || personalised(p)) {
          var hasSize = (p.options || []).some(function (o) {
            var name = typeof o === 'string' ? o : o && o.name;
            return /size/i.test(name || '');
          });
          var a = doc.createElement('a');
          a.className = 'btn btn--secondary btn--sm btn--block product-card__quick-add';
          a.href = p.url;
          a.setAttribute('data-quick-add', '');
          a.setAttribute('data-handle', p.handle);
          a.setAttribute('data-url', p.url);
          var t = doc.createElement('span');
          t.textContent = hasSize ? s.chooseSize : s.chooseOptions;
          a.appendChild(t);
          a.appendChild(vh(forText));
          actions.appendChild(a);
        } else if (variants[0]) {
          var form = doc.createElement('form');
          form.action = ((L.routes && L.routes.cartAdd) || '/cart/add');
          form.method = 'post';
          form.className = 'product-card__form';
          form.setAttribute('data-quick-add-single', '');
          form.setAttribute('data-product-handle', p.handle);
          var idIn = doc.createElement('input');
          idIn.type = 'hidden';
          idIn.name = 'id';
          idIn.value = variants[0].id;
          var qIn = doc.createElement('input');
          qIn.type = 'hidden';
          qIn.name = 'quantity';
          qIn.value = '1';
          var btn = doc.createElement('button');
          btn.type = 'submit';
          btn.className = 'btn btn--secondary btn--sm btn--block product-card__quick-add';
          if (s.plusIcon) {
            var holder = doc.createElement('span');
            holder.innerHTML = s.plusIcon;
            while (holder.firstChild) btn.appendChild(holder.firstChild);
          }
          var bt = doc.createElement('span');
          bt.textContent = s.add || '';
          btn.appendChild(bt);
          btn.appendChild(vh(forText));
          var err = doc.createElement('p');
          err.className = 'product-card__error';
          err.setAttribute('role', 'alert');
          err.setAttribute('data-quick-add-error', '');
          err.hidden = true;
          form.appendChild(idIn);
          form.appendChild(qIn);
          form.appendChild(btn);
          form.appendChild(err);
          actions.appendChild(form);
        }
        actions.hidden = false;
      }
      return li;
    }

    clear() {
      saveRecent([]);
      // On a product page the bed you're looking at stays your latest view.
      var current = this.getAttribute('data-current');
      if (current) saveRecent([current]);
      if (this.status) this.status.textContent = this.strings.cleared || '';
      if (this.section) {
        var heading = this.section.querySelector('h2');
        if (this.clearBtn) this.clearBtn.hidden = true;
        if (this.list) this.list.textContent = '';
        if (!designMode()) {
          var main = doc.getElementById('MainContent');
          if (heading && main) focusEl(main);
          this.section.hidden = true;
        }
      }
    }
  }
  define('recently-viewed', RecentlyViewed);

  /* ------------------------------------------------------------------------
     Timeline: live [dispatch_day] / [arrival]
     ---------------------------------------------------------------------- */
  var timelineTimer = null;

  function renderTimelines() {
    var live = qsa('[data-timeline-live]');
    if (!live.length) {
      if (timelineTimer) {
        clearInterval(timelineTimer);
        timelineTimer = null;
      }
      return;
    }
    var est = L.delivery && typeof L.delivery.estimate === 'function' ? L.delivery.estimate() : null;
    if (!est) return;
    var fmt = L.delivery.format;
    live.forEach(function (el) {
      var section = el.closest('[data-timeline]');
      var kind = el.getAttribute('data-timeline-live');
      if (kind === 'dispatch_day') {
        var today = section && section.getAttribute('data-str-today');
        var tomorrow = section && section.getAttribute('data-str-tomorrow');
        var onDay = section && section.getAttribute('data-str-on-day');
        if (est.dispatchToday && today) el.textContent = today;
        else if (est.dispatchTomorrow && tomorrow) el.textContent = tomorrow;
        else if (onDay) el.textContent = fill(onDay, { day: fmt(est.dispatchDate) });
      } else if (kind === 'arrival') {
        var from = fmt(est.arriveFrom);
        var to = fmt(est.arriveTo);
        var range = (L.strings && L.strings.arrivalRange) || '[from]–[to]';
        el.textContent = from === to ? from : fill(range, { from: from, to: to });
      }
    });
  }

  function initTimelines() {
    if (!qsa('[data-timeline-live]').length) return;
    renderTimelines();
    if (!timelineTimer) timelineTimer = setInterval(renderTimelines, 60000);
  }

  /* ------------------------------------------------------------------------
     Delegated: size guide, dialog close, review link
     ---------------------------------------------------------------------- */
  doc.addEventListener('click', function (e) {
    var t = e.target instanceof Element ? e.target : null;
    if (!t) return;

    var open = t.closest('[data-size-guide-open]');
    if (open) {
      var scope = scopeOf(open);
      var dlg = scope ? scope.querySelector('[data-size-guide]') : null;
      if (!dlg) return;
      e.preventDefault();
      openDialog(dlg, open);
      return;
    }

    var choose = t.closest('[data-size-guide-choose]');
    if (choose) {
      var cScope = scopeOf(choose);
      var picker = cScope ? cScope.querySelector('variant-picker') : null;
      var cDlg = choose.closest('dialog');
      if (picker && typeof picker.selectValue === 'function') {
        picker.selectValue(parseInt(choose.getAttribute('data-option-index'), 10), choose.getAttribute('data-value'));
        if (cDlg) {
          var checked = picker.querySelector('[data-value-input]:checked');
          if (checked) cDlg.__opener = checked;
        }
      }
      if (cDlg) closeDialog(cDlg);
      return;
    }

    var closer = t.closest('[data-dialog-close]');
    if (closer) {
      var d = closer.closest('dialog');
      if (d) closeDialog(d);
      return;
    }

    var reviews = t.closest('[data-reviews-link]');
    if (reviews) {
      var target =
        doc.getElementById('reviews') ||
        doc.querySelector('[id$="__reviews"], [id$="__reviews-wrap"], [data-reviews], .reviews-app');
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      focusEl(target);
    }
  });

  /* ------------------------------------------------------------------------
     Init per scope (also for single-variant products with no picker)
     ---------------------------------------------------------------------- */
  function initScope(scope) {
    var data = productData(scope);
    if (!data) return;
    if (!scope.querySelector('variant-picker')) updateFinderPrompts(scope, data, recommendation(data));
    // The quick-add drawer's header shows the product's "From" price; bring
    // it in line with the size that is actually selected below it.
    if (scope.matches('[data-quick-add-product]')) {
      var v = currentVariant(scope, data);
      if (v) updateScope(scope, data, v);
    }
  }

  function init(root) {
    root = root || doc;
    var scopes = qsa('[data-product-scope], [data-quick-add-product]', root);
    if (root !== doc && root.matches && root.matches('[data-product-scope], [data-quick-add-product]')) scopes.unshift(root);
    scopes.forEach(function (scope) {
      if (scope.matches('[data-product-scope]') && scope.closest('[data-quick-add-product]')) return;
      initScope(scope);
    });
    qsa('[data-record-view]', root).forEach(function (el) {
      recordView(el.getAttribute('data-record-view'));
    });
    if (root !== doc && root.matches && root.matches('[data-record-view]')) recordView(root.getAttribute('data-record-view'));
    initTimelines();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(doc); });
  else init(doc);

  on('shopify:section:load', function (e) {
    if (e.target && e.target.nodeType === 1) init(e.target);
  });

  // Theme editor: selecting a collapsible row opens it.
  on('shopify:block:select', function (e) {
    var details = e.target && e.target.querySelector ? e.target.querySelector('details.product-accordion') : null;
    if (details) details.open = true;
  });

  on('lunova:finder:complete', function () {
    qsa('[data-product-scope], [data-quick-add-product]').forEach(function (scope) {
      if (!scope.querySelector('variant-picker')) {
        var data = productData(scope);
        if (data) updateFinderPrompts(scope, data, recommendation(data));
      }
    });
  });

  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'visible') renderTimelines();
  });

  L.product = {
    productData: productData,
    updateScope: updateScope,
    recordView: recordView,
    recent: recentList
  };
})();
