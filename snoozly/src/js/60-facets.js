/* ---------------------------------------------------------------------
   Collection and search filters: the real GET form, upgraded to refresh
   the grid in place through the Section Rendering API. The URL always
   carries the state, so a filtered view can be shared or used in an ad.
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $, $$ } = SZ;

  const root = () => $('[data-facets-section]');
  let controller;

  const render = async (url, push = true) => {
    const r = root();
    if (!r) { window.location.href = url; return; }
    const sectionId = r.dataset.facetsSection;
    const u = new URL(url, window.location.origin);
    const fetchUrl = new URL(u.toString());
    fetchUrl.searchParams.set('section_id', sectionId);
    controller && controller.abort();
    controller = new AbortController();
    const results = $('[data-facets-results]', r);
    results && results.classList.add('is-busy');
    try {
      const res = await fetch(fetchUrl.toString(), { signal: controller.signal });
      const doc = SZ.parseHTML(await res.text());
      ['[data-facets-results]', '[data-facets-active]', '[data-facets-toolbar] [role="status"]'].forEach((sel) => {
        const fresh = $(sel, doc);
        const cur = $(sel, r);
        if (fresh && cur) cur.innerHTML = fresh.innerHTML;
      });
      // Filters: keep the open/closed state of each group, replace values
      const freshFilters = $('[data-facets-filters]', doc);
      const curFilters = $('[data-facets-filters]', r);
      if (freshFilters && curFilters) {
        const open = $$('details.facet', curFilters).map((d) => d.open);
        curFilters.innerHTML = freshFilters.innerHTML;
        $$('details.facet', curFilters).forEach((d, i) => { if (open[i] !== undefined) d.open = open[i]; });
      }
      const drawerBtn = $('.plp-drawer-foot .btn', r);
      const freshBtn = $('.plp-drawer-foot .btn', doc);
      if (drawerBtn && freshBtn) drawerBtn.textContent = freshBtn.textContent;
      if (push) window.history.pushState({ facets: true }, '', u.pathname + u.search);
      SZ.initReveal(r);
    } catch (e) {
      if (e.name !== 'AbortError') window.location.href = url;
    } finally {
      const fresh = $('[data-facets-results]', r);
      fresh && fresh.classList.remove('is-busy');
    }
  };

  const formUrl = (form) => {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) { if (v !== '') params.append(k, v); }
    return `${form.getAttribute('action') || window.location.pathname}?${params.toString()}`;
  };

  document.addEventListener('change', SZ.debounce((e) => {
    const form = e.target.closest && e.target.closest('[data-facets-form]');
    if (form) render(formUrl(form));
  }, 300));

  document.addEventListener('input', SZ.debounce((e) => {
    if (!e.target.matches || !e.target.matches('.facet__price input')) return;
    const form = e.target.closest('[data-facets-form]');
    if (form) render(formUrl(form));
  }, 700));

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-facets-form]');
    if (!form) return;
    e.preventDefault();
    render(formUrl(form));
  });

  document.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-sort]');
    if (!sel) return;
    const form = $('[data-facets-form]');
    if (form) {
      const mirror = $('[data-sort-mirror]', form);
      if (mirror) mirror.value = sel.value;
      render(formUrl(form));
    } else {
      const u = new URL(window.location.href);
      u.searchParams.set('sort_by', sel.value);
      window.location.href = u.toString();
    }
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-facet-link]');
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    render(a.href);
    const r = root();
    if (r && a.closest('.pagination')) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('popstate', () => { if (root()) render(window.location.href, false); });
})();
