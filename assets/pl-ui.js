/**
 * PawLunova UI helpers (loaded on every page, deferred).
 *
 * 1. Dated delivery lines: fills every [data-pl-delivery] from the store's own policy
 *    (dispatch + transit working days, no weekends or bank holidays). An order placed
 *    on a closed day counts from the next working day, as the shipping policy says.
 * 2. Bed Finder memory: shows the saved match on the product page ("Recommended for
 *    Bella: Medium") and the "welcome back" line wherever [data-pl-welcome] appears.
 */
const PL = window.PL || { settings: {}, strings: {} };
const S = PL.settings || {};
const decodeEntities = (v) => {
  // The `t` filter HTML-escapes apostrophes before they reach JSON; turn them back into text once.
  const ta = document.createElement('textarea');
  ta.innerHTML = String(v ?? '');
  return ta.value;
};
const T = Object.fromEntries(Object.entries(PL.strings || {}).map(([k, v]) => [k, typeof v === 'string' ? decodeEntities(v) : v]));
const STORE_KEY = 'pl:finder';

const HOLIDAYS = new Set(Array.isArray(S.holidays) ? S.holidays : []);

/** @param {Date} d */
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** @param {Date} d */
function isWorkingDay(d) {
  const day = d.getDay();
  return day !== 0 && day !== 6 && !HOLIDAYS.has(iso(d));
}

/** @param {Date} d @param {number} n */
function addWorkingDays(d, n) {
  const out = new Date(d);
  let added = 0;
  let guard = 0;
  while (added < n && guard < 120) {
    out.setDate(out.getDate() + 1);
    if (isWorkingDay(out)) added += 1;
    guard += 1;
  }
  return out;
}

/** "Thu 15 Oct" */
function fmt(d) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/**
 * The delivery window for an order placed now.
 * @param {{dispatchMin:number, dispatchMax:number, transitMin:number, transitMax:number}} o
 */
function deliveryWindow(o) {
  const now = new Date();
  // An order placed on a closed day counts from the next working day.
  let start = new Date(now);
  while (!isWorkingDay(start)) start.setDate(start.getDate() + 1);
  const dispatchEarliest = addWorkingDays(start, Math.max(0, o.dispatchMin));
  const dispatchLatest = addWorkingDays(start, Math.max(0, o.dispatchMax));
  const earliest = addWorkingDays(dispatchEarliest, Math.max(0, o.transitMin));
  const latest = addWorkingDays(dispatchLatest, Math.max(0, o.transitMax));
  return { earliest, latest };
}

function fillDeliveryLines(root = document) {
  const els = root.querySelectorAll('[data-pl-delivery]');
  for (const el of els) {
    if (!(el instanceof HTMLElement)) continue;
    const d = el.dataset;
    const dispatchMin = Number(d.dispatchMin ?? S.dispatchMin ?? 1);
    const dispatchMax = Number(d.dispatchMax ?? S.dispatchMax ?? 2);
    const w = deliveryWindow({
      dispatchMin,
      dispatchMax,
      transitMin: Number(S.transitMin ?? 4),
      transitMax: Number(S.transitMax ?? 6),
    });
    const main = el.querySelector('[data-pl-delivery-text]');
    if (main && T.deliveryDates) {
      main.textContent = T.deliveryDates.replace('[from]', fmt(w.earliest)).replace('[to]', fmt(w.latest));
    }
    const express = el.querySelector('[data-pl-delivery-express]');
    if (express instanceof HTMLElement) {
      if (d.express === 'true' && S.expressPrice && T.deliveryExpress) {
        const ew = deliveryWindow({
          dispatchMin,
          dispatchMax,
          transitMin: Number(S.expressMin ?? 2),
          transitMax: Number(S.expressMax ?? 3),
        });
        express.textContent = T.deliveryExpress.replace('[to]', fmt(ew.latest)).replace('[price]', String(S.expressPrice));
        express.hidden = false;
      } else {
        express.hidden = true;
      }
    }
    el.hidden = false;
  }
}

/* ---------- Bed Finder memory ---------- */
function readFinder() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || !v.handle) return null;
    return v;
  } catch (e) {
    return null;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function applyFinderMemory(root = document) {
  const saved = readFinder();
  if (!saved) return;
  const name = saved.dogName ? String(saved.dogName).trim() : '';

  // Product page chip
  for (const chip of root.querySelectorAll('[data-pl-finder-chip]')) {
    if (!(chip instanceof HTMLElement)) continue;
    if (chip.dataset.handle !== saved.handle) continue;
    const size = saved.sizeLabel || '';
    const tpl = name ? T.recommendedSize : T.recommendedSizeUnnamed;
    if (!tpl) continue;
    chip.textContent = tpl.replace('[name]', name).replace('[size]', size || '');
    chip.setAttribute('data-active', '');
  }

  // Cards: "Bella's match"
  for (const card of root.querySelectorAll('[data-pl-match-handle]')) {
    if (!(card instanceof HTMLElement)) continue;
    if (card.dataset.plMatchHandle !== saved.handle) continue;
    const tpl = name ? T.matchChip : T.matchChipUnnamed;
    if (!tpl) continue;
    card.textContent = tpl.replace('[name]', name);
    card.hidden = false;
  }

  // Welcome back (hero, finder teaser)
  for (const el of root.querySelectorAll('[data-pl-welcome]')) {
    if (!(el instanceof HTMLElement)) continue;
    const tpl = name ? T.welcomeBack : T.welcomeBackUnnamed;
    if (!tpl || !saved.url) continue;
    el.innerHTML = `${escapeHtml(tpl.replace('[name]', name))} <a class="pl-link" href="${escapeHtml(saved.url)}">${escapeHtml(saved.title || '')}</a>`;
    el.hidden = false;
  }
}

function init(root = document) {
  fillDeliveryLines(root);
  applyFinderMemory(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

// Re-run after section re-renders (variant change morphs the product section) and in the editor.
document.addEventListener('shopify:section:load', (e) => init(e.target instanceof Element ? e.target : document));
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node instanceof HTMLElement && (node.matches('[data-pl-delivery], [data-pl-finder-chip]') || node.querySelector('[data-pl-delivery], [data-pl-finder-chip]'))) {
        init(node);
        return;
      }
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

window.PL.ui = { deliveryWindow, fmt, readFinder, init };
