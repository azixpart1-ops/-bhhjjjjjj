/* ==========================================================================
   Lunova — sections.js
   Small, progressive behaviour for the homepage & marketing sections.
   Everything here is optional: each section reads and works without it.

     [data-marquee]        pause / play control (WCAG 2.2.2); stays still
                           for reduced motion or when animations are off
     [data-hero-resume]    "See Bella's match again" for returning finder users
     [data-signs]          "Sounds familiar" self-check + live tally line
     [data-video]          click-to-load YouTube / Vimeo / Shopify video
     editor                a <details> block (FAQ question) opens while it is
                           selected in the theme editor's sidebar

   Idempotent: safe to run again on shopify:section:load. Several sections
   include this file, so it boots once per page.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__lunovaSections) return;
  window.__lunovaSections = true;

  var doc = document;
  var root = doc.documentElement;

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  function qsaSelf(selector, scope) {
    var list = qsa(selector, scope);
    if (scope && scope !== doc && scope.matches && scope.matches(selector)) list.unshift(scope);
    return list;
  }

  function once(el, flag) {
    var key = 'lunovaInit' + flag;
    if (el.dataset[key]) return false;
    el.dataset[key] = '1';
    return true;
  }

  function reducedMotion() {
    return (
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      root.classList.contains('no-motion')
    );
  }

  function L() {
    return window.Lunova || {};
  }

  /* ------------------------------------------------------------------------
     Marquee: a real pause button, kept in sync with reduced-motion changes.
     ---------------------------------------------------------------------- */
  function initMarquee(scope) {
    qsaSelf('[data-marquee]', scope).forEach(function (section) {
      if (!once(section, 'Marquee')) return;
      var button = section.querySelector('[data-marquee-toggle]');
      if (!button) return;
      var label = button.querySelector('[data-marquee-toggle-label]');

      function setPaused(paused) {
        section.classList.toggle('is-paused', paused);
        button.setAttribute('aria-pressed', paused ? 'true' : 'false');
        var text = paused ? button.getAttribute('data-label-play') : button.getAttribute('data-label-pause');
        if (label && text) label.textContent = text;
      }

      function sync() {
        /* Reduced motion: the band is static, so there is nothing to pause. */
        button.hidden = reducedMotion();
      }

      button.addEventListener('click', function () {
        setPaused(!section.classList.contains('is-paused'));
      });

      if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.addEventListener) mq.addEventListener('change', sync);
        else if (mq.addListener) mq.addListener(sync);
      }
      setPaused(false);
      sync();

      /* Save work while the band is off screen. */
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            section.classList.toggle('is-offscreen', !entry.isIntersecting);
          });
        }).observe(section);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Hero: link a returning visitor straight back to their finder match.
     ---------------------------------------------------------------------- */
  function productUrl(handle, variantId) {
    var base = (L().routes && L().routes.root) || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    var url = base + 'products/' + encodeURIComponent(handle);
    if (variantId) url += '?variant=' + encodeURIComponent(variantId);
    return url;
  }

  function applyResume(scope, data) {
    qsaSelf('[data-hero-resume]', scope).forEach(function (line) {
      var link = line.querySelector('[data-hero-resume-link]');
      var finder = L().finder;
      var result = data || (finder && typeof finder.get === 'function' ? finder.get() : null);
      if (!link || !result || !result.handle) {
        line.classList.remove('is-ready');
        line.hidden = true;
        return;
      }
      var name = typeof result.dogName === 'string' ? result.dogName.trim().slice(0, 40) : '';
      var named = link.getAttribute('data-template-named') || '';
      var plain = link.getAttribute('data-template-default') || link.textContent;
      /* textContent only: the dog's name is visitor input. */
      link.textContent = name && named.indexOf('[name]') > -1 ? named.replace('[name]', name) : plain;
      link.href = productUrl(String(result.handle), result.variantId);
      line.hidden = false;
      line.classList.add('is-ready');
    });
  }

  /* ------------------------------------------------------------------------
     Problem signs: tick the ones you recognise; the closing line reflects it.
     ---------------------------------------------------------------------- */
  function initSigns(scope) {
    qsaSelf('[data-signs]', scope).forEach(function (section) {
      if (!once(section, 'Signs')) return;
      var toggles = qsa('[data-sign-toggle]', section);
      var tally = section.querySelector('[data-sign-tally]');
      if (!toggles.length) return;

      function update() {
        var count = toggles.filter(function (t) {
          return t.getAttribute('aria-pressed') === 'true';
        }).length;
        if (!tally) return;
        var tpl;
        if (count === 0) tpl = tally.getAttribute('data-template-none');
        else if (count === toggles.length && toggles.length > 1) tpl = tally.getAttribute('data-template-all');
        else if (count === 1) tpl = tally.getAttribute('data-template-one');
        else tpl = tally.getAttribute('data-template-other');
        tally.textContent = String(tpl || '').replace(/\[count\]/g, String(count));
        section.classList.toggle('has-signs', count > 0);
      }

      toggles.forEach(function (button) {
        button.hidden = false;
        button.addEventListener('click', function () {
          var pressed = button.getAttribute('aria-pressed') === 'true';
          button.setAttribute('aria-pressed', pressed ? 'false' : 'true');
          var item = button.closest('[data-sign]');
          if (item) item.classList.toggle('is-familiar', !pressed);
          update();
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Video: load the player only when asked.
     ---------------------------------------------------------------------- */
  function initVideo(scope) {
    qsaSelf('[data-video]', scope).forEach(function (frame) {
      if (!once(frame, 'Video')) return;
      var play = frame.querySelector('[data-video-play]');
      if (!play) return;

      play.addEventListener('click', function (e) {
        var kind = frame.getAttribute('data-video-kind');
        if (kind === 'hosted') {
          var tpl = frame.querySelector('[data-video-template]');
          if (!tpl || !tpl.content) return;
          e.preventDefault();
          var node = tpl.content.cloneNode(true);
          var video = node.querySelector('video');
          frame.appendChild(node);
          frame.classList.add('is-playing');
          play.remove();
          if (video) {
            video.focus({ preventScroll: true });
            var p = video.play && video.play();
            if (p && p.catch) p.catch(function () {});
          }
          return;
        }
        var src = play.getAttribute('data-embed-url');
        if (!src) return; /* falls back to the plain link */
        e.preventDefault();
        var iframe = doc.createElement('iframe');
        iframe.className = 'video-section__media';
        iframe.src = src;
        iframe.title = play.getAttribute('data-embed-title') || '';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        frame.appendChild(iframe);
        frame.classList.add('is-playing');
        play.remove();
        iframe.focus({ preventScroll: true });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Boot + editor
     ---------------------------------------------------------------------- */
  function init(scope) {
    scope = scope || doc;
    initMarquee(scope);
    applyResume(scope);
    initSigns(scope);
    initVideo(scope);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', function () {
      init(doc);
    });
  } else {
    init(doc);
  }

  doc.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });

  /* Theme editor: show the answer being edited, then put it back as it was. */
  doc.addEventListener('shopify:block:select', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS') return;
    d.dataset.lunovaEditorOpened = d.open ? '' : '1';
    d.open = true;
  });

  doc.addEventListener('shopify:block:deselect', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS') return;
    if (d.dataset.lunovaEditorOpened === '1') d.open = false;
    delete d.dataset.lunovaEditorOpened;
  });

  doc.addEventListener('lunova:finder:complete', function () {
    /* Finder stores its result before firing; read it fresh. */
    window.setTimeout(function () {
      applyResume(doc);
    }, 0);
  });
})();
