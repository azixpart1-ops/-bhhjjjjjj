/* ==========================================================================
   Lunova — customer.js
   Small, dependency-free helpers for the content and customer pages
   (contact, article, login/register/reset/activate, addresses, gift card).
   Everything here is progressive: each page works without it.

   1. Address forms      country → county/state select (all_country_option_tags)
   2. Confirm            <form data-confirm="…"> asks before submitting (delete address)
   3. Copy               [data-copy-text] copies text, announces "Copied"
   4. Native share       [data-share-native] uses the share sheet where supported
   5. Print              [data-print]
   6. Password toggle    [data-password-toggle] show / hide a password field
   7. Contact prefill    ?topic=order&order=#1001, and the dog's name from the Bed Finder
   8. Login / recover    #recover ⇄ #login focus handling
   9. Gift card QR code  #QrCode[data-identifier] via Shopify's vendor/qrcode.js
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(selector));
  }

  function bindOnce(el, key) {
    var flag = 'lunovaBound' + key;
    if (el.dataset[flag]) return false;
    el.dataset[flag] = '1';
    return true;
  }

  /* ------------------------------------------------------------------------
     1. Address forms
     ---------------------------------------------------------------------- */
  function selectByValue(select, value) {
    if (!value) return false;
    var wanted = String(value).toLowerCase();
    for (var i = 0; i < select.options.length; i++) {
      var opt = select.options[i];
      if (opt.value.toLowerCase() === wanted || opt.text.toLowerCase() === wanted) {
        select.selectedIndex = i;
        return true;
      }
    }
    return false;
  }

  function initAddressForms(root) {
    qsa('[data-address-country]', root).forEach(function (country) {
      if (!bindOnce(country, 'Country')) return;
      var form = country.closest('form');
      if (!form) return;
      var province = form.querySelector('[data-address-province]');
      var wrap = form.querySelector('[data-address-province-wrap]');

      selectByValue(country, country.getAttribute('data-default'));

      function update(useDefault) {
        if (!province) return;
        var opt = country.options[country.selectedIndex];
        var list = [];
        try {
          list = JSON.parse((opt && opt.getAttribute('data-provinces')) || '[]');
        } catch (e) {
          list = [];
        }
        var keep = useDefault ? province.getAttribute('data-default') : province.value;
        province.innerHTML = '';
        if (!list.length) {
          if (wrap) wrap.hidden = true;
          province.disabled = true;
          return;
        }
        if (wrap) wrap.hidden = false;
        province.disabled = false;
        list.forEach(function (pair) {
          province.add(new Option(pair[1], pair[0]));
        });
        if (!selectByValue(province, keep)) province.selectedIndex = 0;
      }

      update(true);
      country.addEventListener('change', function () {
        update(false);
      });
    });
  }

  /* ------------------------------------------------------------------------
     2. Confirm before submitting
     ---------------------------------------------------------------------- */
  doc.addEventListener('submit', function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    var message = form.getAttribute('data-confirm');
    if (message && !window.confirm(message)) e.preventDefault();
  });

  /* ------------------------------------------------------------------------
     3. Copy to clipboard
     ---------------------------------------------------------------------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = doc.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      doc.body.appendChild(area);
      area.select();
      try {
        doc.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      } finally {
        area.remove();
      }
    });
  }

  function initCopy(root) {
    qsa('[data-copy-text]', root).forEach(function (btn) {
      if (!bindOnce(btn, 'Copy')) return;
      var item = btn.closest('[data-copy-item]');
      if (item) item.hidden = false;
      btn.hidden = false;
      var label = btn.querySelector('[data-copy-label]');
      var original = label ? label.textContent : '';
      var timer;
      btn.addEventListener('click', function () {
        var done = btn.getAttribute('data-copy-done') || '';
        copyText(btn.getAttribute('data-copy-text') || '').then(function () {
          btn.classList.add('is-copied');
          if (label && done) label.textContent = done;
          var scope = btn.closest('[data-share-root], .gift-card') || doc;
          var status = scope.querySelector('[data-copy-status]');
          if (status) {
            status.textContent = '';
            window.setTimeout(function () { status.textContent = done; }, 30);
          }
          window.clearTimeout(timer);
          timer = window.setTimeout(function () {
            btn.classList.remove('is-copied');
            if (label) label.textContent = original;
          }, 2400);
        }).catch(function () {
          /* leave the visible text for manual copying */
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     4. Native share sheet
     ---------------------------------------------------------------------- */
  function initShare(root) {
    if (typeof navigator.share !== 'function') return;
    qsa('[data-share-native]', root).forEach(function (btn) {
      if (!bindOnce(btn, 'Share')) return;
      var item = btn.closest('[data-share-native-item]');
      if (item) item.hidden = false;
      btn.addEventListener('click', function () {
        navigator.share({
          title: btn.getAttribute('data-share-title') || doc.title,
          url: btn.getAttribute('data-share-url') || window.location.href
        }).catch(function () {
          /* dismissed */
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     5. Print
     ---------------------------------------------------------------------- */
  function initPrint(root) {
    if (typeof window.print !== 'function') return;
    qsa('[data-print]', root).forEach(function (btn) {
      if (!bindOnce(btn, 'Print')) return;
      btn.hidden = false;
      btn.addEventListener('click', function () {
        window.print();
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. Show / hide password
     ---------------------------------------------------------------------- */
  function initPasswordToggles(root) {
    qsa('[data-password-toggle]', root).forEach(function (btn) {
      if (!bindOnce(btn, 'Password')) return;
      var input = doc.getElementById(btn.getAttribute('aria-controls'));
      if (!input) return;
      btn.hidden = false;
      btn.closest('.password-field') && btn.closest('.password-field').classList.add('has-toggle');
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', show ? 'true' : 'false');
        btn.textContent = btn.getAttribute(show ? 'data-label-hide' : 'data-label-show') || btn.textContent;
      });
      /* Never submit with the password visible in the field's history. */
      var form = input.form;
      if (form) {
        form.addEventListener('submit', function () {
          input.type = 'password';
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     7. Contact form prefill
     ---------------------------------------------------------------------- */
  function initContact(root) {
    qsa('form.contact-form', root).forEach(function (form) {
      if (!bindOnce(form, 'Contact')) return;
      var params;
      try {
        params = new URLSearchParams(window.location.search);
      } catch (e) {
        params = null;
      }

      if (params) {
        var topic = params.get('topic');
        var select = form.querySelector('[data-contact-topic]');
        if (topic && select) {
          var match = select.querySelector('option[data-topic="' + topic.replace(/[^a-z_-]/gi, '') + '"]');
          if (match) select.value = match.value;
        }
        var order = params.get('order');
        var orderField = form.querySelector('[data-contact-order]');
        if (order && orderField && !orderField.value) {
          orderField.value = order.slice(0, 40);
        }
      }

      var dog = form.querySelector('[data-finder-prefill]');
      if (dog && !dog.value && window.Lunova && Lunova.finder && typeof Lunova.finder.get === 'function') {
        var stored = Lunova.finder.get();
        if (stored && typeof stored.dogName === 'string' && stored.dogName.trim()) {
          dog.value = stored.dogName.trim().slice(0, 40);
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     8. Login ⇄ recover password
     ---------------------------------------------------------------------- */
  function focusPanel(id) {
    var panel = doc.getElementById(id);
    if (!panel) return;
    var heading = panel.querySelector('.customer-auth__title') || panel;
    window.requestAnimationFrame(function () {
      heading.focus({ preventScroll: false });
    });
  }

  function initAuth(root) {
    qsa('[data-customer-auth]', root).forEach(function (auth) {
      if (!bindOnce(auth, 'Auth')) return;
      var recover = auth.querySelector('#recover');
      auth.addEventListener('click', function (e) {
        var link = e.target instanceof Element ? e.target.closest('[data-auth-show]') : null;
        if (!link) return;
        var target = link.getAttribute('data-auth-show');
        if (target === 'login' && recover) recover.classList.remove('is-open');
        /* let the hash change, then move focus to the panel that appeared */
        window.setTimeout(function () {
          focusPanel(target);
        }, 0);
      });
    });
  }

  /* ------------------------------------------------------------------------
     9. Gift card QR code
     ---------------------------------------------------------------------- */
  function initQr() {
    var el = doc.getElementById('QrCode');
    if (!el || el.dataset.lunovaQr || typeof window.QRCode !== 'function') return;
    var text = el.getAttribute('data-identifier');
    if (!text) return;
    el.dataset.lunovaQr = '1';
    try {
      /* global QRCode */
      new window.QRCode(el, { text: text, width: 120, height: 120 });
      qsa('img, canvas', el).forEach(function (node) {
        node.setAttribute('aria-hidden', 'true');
      });
    } catch (e) {
      el.hidden = true;
    }
  }

  /* ------------------------------------------------------------------------
     Boot, and re-boot when the theme editor reloads a section
     ---------------------------------------------------------------------- */
  function init(root) {
    root = root || doc;
    initAddressForms(root);
    initCopy(root);
    initShare(root);
    initPrint(root);
    initPasswordToggles(root);
    initContact(root);
    initAuth(root);
    initQr();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', function () { init(doc); });
  } else {
    init(doc);
  }

  doc.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });
})();
