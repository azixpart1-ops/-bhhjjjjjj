/**
 * PawLunova Bed Finder.
 *
 * Four taps to one bed in the right size. The data is every bed in the chosen collection
 * (rendered by snippets/pl-finder-data.liquid with the theme's own foam-guarantee and trial
 * verdicts), so the result can never promise something the product page wouldn't.
 *
 * Scoring, in plain words:
 *  - how they sleep: a bed whose sleep_style metafield lists the answer scores; one that lists
 *    the opposite only loses a little, because joints and size matter more.
 *  - their joints: stiff/diagnosed → memory foam first, then egg-crate; low step-in is a bonus.
 *    slowing → any foam core; fine → anything, foam still edges ahead.
 *  - their size: a size whose label or weight band matches, else the next size up (noted),
 *    one-size beds by their own weight band. No fit → the bed is out.
 *  - in stock wins; the merchant can tie-break with a tag finder:priority-N.
 *
 * Adds to the basket the way Horizon's own product form does (a CartLinesUpdateEvent with a
 * promise), so the cart icon and drawer update natively.
 */
import { CartLinesUpdateEvent } from '@shopify/events';

const RANK = { xxs: 1, xs: 2, s: 3, m: 4, l: 5, xl: 6, xxl: 7, '2xl': 7, '3xl': 8, xxxl: 8, '4xl': 9 };
const WORDS = {
  'extra extra small': 1, 'extra small': 2, 'x small': 2, small: 3, medium: 4, large: 5, 'extra large': 6, 'x large': 6,
  'extra extra large': 7, giant: 8,
};
const BAND_FOR_RANK = { 1: 'upto10', 2: 'upto10', 3: 'upto10', 4: '10-25', 5: '25-40', 6: '40plus', 7: '40plus', 8: '40plus', 9: '40plus' };
const STORE_KEY = 'pl:finder';

/** @param {string} v */
function sizeRank(v) {
  const raw = String(v || '').trim();
  const label = raw.split(/\s·\s|\s-\s|:\s|:|\s\(/)[0].trim().toLowerCase().replace(/-/g, ' ');
  if (/^(one size|onesize|default title|os|one size fits all)$/.test(label)) return 0;
  if (RANK[label] !== undefined) return RANK[label];
  if (WORDS[label] !== undefined) return WORDS[label];
  const first = label.split(' ')[0];
  if (WORDS[first] !== undefined) return WORDS[first];
  if (RANK[first] !== undefined) return RANK[first];
  return -1;
}

/** @param {string} v */
function sizeLabel(v) {
  return String(v || '').trim().split(/\s·\s|\s-\s|:\s|:|\s\(/)[0].trim();
}

/** "Up to 10kg" | "10–25kg" | "25–40kg" | "40kg+" → band key */
function bandKey(s) {
  const t = String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
  if (!t) return '';
  if (/^upto\d+kg$/.test(t)) return 'upto10';
  if (/^10-25kg$/.test(t)) return '10-25';
  if (/^25-40kg$/.test(t)) return '25-40';
  if (/^40kg\+$/.test(t) || /^40kg\+?$/.test(t)) return '40plus';
  return t;
}

function money(cents, format) {
  const pounds = cents / 100;
  const whole = Number.isInteger(pounds);
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: (window.PL && window.PL.settings && window.PL.settings.currency) || 'GBP',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(pounds);
  } catch (e) {
    return `£${whole ? pounds : pounds.toFixed(2)}`;
  }
}

function perNightText(cents, years) {
  const nights = Math.floor((years * 1461) / 4);
  if (!(nights > 0) || !(cents > 0)) return '';
  const pence = Math.max(1, Math.floor((cents * 2 + nights) / (nights * 2)));
  return pence < 100 ? `${pence}p` : money(pence);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function decodeEntities(s) {
  // The `t` filter HTML-escapes apostrophes and quotes before they reach JSON, so strings arrive as
  // "Bella&#39;s"; this turns them back into text once, and esc() re-escapes them where they go into HTML.
  const ta = document.createElement('textarea');
  ta.innerHTML = String(s ?? '');
  return ta.value;
}

function fill(tpl, vars) {
  return String(tpl || '').replace(/\[(\w+)\]/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

class PlBedFinder extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = 'true';
    this.products = this.#readJson('[data-pl-finder-products]') || [];
    this.sizes = this.#readJson('[data-pl-finder-sizes]') || [];
    this.exclude = (this.#readJson('[data-pl-finder-exclude]') || []).map((s) => String(s).toLowerCase());
    this.t = Object.fromEntries(
      Object.entries(this.#readJson('[data-pl-finder-strings]') || {}).map(([k, v]) => [k, typeof v === 'string' ? decodeEntities(v) : v])
    );
    this.answers = { style: null, stage: null, size: null, name: '' };
    this.steps = ['style', 'stage', 'size'];
    if (this.dataset.askName !== 'false') this.steps.push('name');
    this.stepIndex = 0;
    this.#bind();
    this.#show(0);
    this.#presetFromUrl();
  }

  /**
   * Answers the first questions from the URL (?style=curl|lean|sprawl&stage=fine|slowing|diagnosed),
   * so the "First question" cards and the Bed Finder page can hand a shopper straight to the next
   * unanswered step. Nothing happens for a URL without them.
   */
  #presetFromUrl() {
    let params;
    try {
      params = new URL(window.location.href).searchParams;
    } catch (e) {
      return;
    }
    const style = params.get('style');
    const stage = params.get('stage');
    if (!style && !stage) return;
    this.preset({ style, stage }, { scroll: true });
  }

  /**
   * Fills in answers given elsewhere and shows the next unanswered step.
   * @param {{style?: string|null, stage?: string|null}} answers
   * @param {{scroll?: boolean}} [opts]
   */
  preset(answers, opts = {}) {
    const allowed = { style: ['curl', 'lean', 'sprawl'], stage: ['fine', 'slowing', 'diagnosed'] };
    let next = 0;
    for (const key of ['style', 'stage']) {
      const value = answers && answers[key];
      if (!value || !allowed[key].includes(value)) break;
      this.answers[key] = value;
      const group = this.querySelector(`[data-step="${key}"]`);
      if (group) {
        for (const b of group.querySelectorAll('[data-answer]')) {
          b.setAttribute('aria-pressed', b.getAttribute('data-value') === value ? 'true' : 'false');
        }
      }
      next = this.steps.indexOf(key) + 1;
    }
    if (next > 0) this.#show(Math.min(next, this.steps.length - 1));
    if (opts.scroll) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  #readJson(sel) {
    const el = this.querySelector(sel);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || 'null');
    } catch (e) {
      return null;
    }
  }

  #bind() {
    this.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const opt = target.closest('[data-answer]');
      if (opt instanceof HTMLElement && this.contains(opt)) {
        this.#answer(opt.dataset.answer, opt.dataset.value, opt);
        return;
      }
      if (target.closest('[data-back]')) {
        this.#show(Math.max(0, this.stepIndex - 1));
        return;
      }
      if (target.closest('[data-show-match]')) {
        const input = this.querySelector('[data-name-input]');
        this.answers.name = input instanceof HTMLInputElement ? input.value.trim().slice(0, 24) : '';
        this.#result();
        return;
      }
      const skip = target.closest('[data-skip-name]');
      if (skip && skip !== this) {
        this.answers.name = '';
        this.#result();
        return;
      }
      if (target.closest('[data-change]')) {
        this.#show(0);
        return;
      }
      const add = target.closest('[data-add]');
      if (add instanceof HTMLButtonElement) {
        this.#add(add);
      }
    });
    const input = this.querySelector('[data-name-input]');
    if (input instanceof HTMLInputElement) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.answers.name = input.value.trim().slice(0, 24);
          this.#result();
        }
      });
      input.addEventListener('input', () => {
        const btn = this.querySelector('[data-show-match]');
        const name = input.value.trim();
        if (btn) btn.textContent = name ? fill(this.t.showMatchNamed, { name }) : this.t.showMatch;
      });
    }
  }

  #answer(key, value, el) {
    this.answers[key] = value;
    const group = el.closest('[data-step]');
    if (group) {
      for (const b of group.querySelectorAll('[data-answer]')) b.setAttribute('aria-pressed', b === el ? 'true' : 'false');
    }
    const next = this.stepIndex + 1;
    if (next < this.steps.length) {
      setTimeout(() => this.#show(next), 140);
    } else {
      this.#result();
    }
  }

  #show(index) {
    this.stepIndex = index;
    const name = this.steps[index];
    for (const step of this.querySelectorAll('[data-step]')) {
      const el = /** @type {HTMLElement} */ (step);
      el.hidden = el.dataset.step !== name;
    }
    const total = this.steps.length;
    const stepOf = this.querySelector('[data-step-of]');
    if (stepOf) stepOf.textContent = fill(this.t.stepOf, { step: index + 1, total });
    const bar = this.querySelector('[data-progress]');
    if (bar instanceof HTMLElement) bar.style.width = `${Math.round(((index + 1) / (total + 1)) * 100)}%`;
    const back = this.querySelector('[data-back]');
    if (back instanceof HTMLElement) back.hidden = index === 0;
    const q = this.querySelector(`[data-step="${name}"] .pl-finder__q, [data-step="${name}"] legend, [data-step="${name}"] label`);
    if (q instanceof HTMLElement && index > 0) {
      q.setAttribute('tabindex', '-1');
      q.focus({ preventScroll: true });
    }
  }

  /* ---------- scoring ---------- */

  #excluded(p) {
    const hay = `${p.ty || ''} ${p.sh || ''}`.toLowerCase();
    return this.exclude.some((x) => x && hay.includes(x));
  }

  #wantRank() {
    const r = sizeRank(this.answers.size || '');
    return r > 0 ? r : 4;
  }

  /** Pick the variant for the wanted size. Returns {variant, kind, label} or null. */
  #fitVariant(p) {
    const want = this.#wantRank();
    const wantBand = BAND_FOR_RANK[want] || '';
    const variants = Array.isArray(p.v) ? p.v : [];
    if (!variants.length) return null;
    const si = typeof p.si === 'number' ? p.si : -1;
    const sized = variants.map((v) => {
      const sizeValue = si >= 0 && Array.isArray(v.o) ? v.o[si] : v.t;
      return { v, rank: sizeRank(sizeValue), label: sizeLabel(sizeValue), band: bandKey(v.sw) };
    });
    const hasSizes = sized.some((x) => x.rank > 0);
    const available = (list) => list.find((x) => x.v.a) || null;
    if (hasSizes) {
      // exact size label
      let hit = available(sized.filter((x) => x.rank === want));
      if (hit) return { variant: hit.v, kind: 'exact', label: hit.label };
      // weight band on the variant
      hit = available(sized.filter((x) => wantBand && x.band === wantBand));
      if (hit) return { variant: hit.v, kind: 'band', label: hit.label };
      // the next size up only
      hit = available(sized.filter((x) => x.rank === want + 1));
      if (hit) return { variant: hit.v, kind: 'up', label: hit.label };
      // XS wanted but the smallest is S
      if (want <= 2) {
        hit = available(sized.filter((x) => x.rank === 3));
        if (hit) return { variant: hit.v, kind: 'up', label: hit.label };
      }
      return null;
    }
    // one-size bed: its own weight band decides
    const one = sized[0];
    const band = one.band || bandKey(variants.find((v) => v.sw)?.sw);
    if (band) {
      if (band === wantBand) return { variant: available(sized) ? available(sized).v : one.v, kind: 'one', label: '' };
      const order = ['upto10', '10-25', '25-40', '40plus'];
      const wi = order.indexOf(wantBand);
      const bi = order.indexOf(band);
      if (wi >= 0 && bi === wi + 1) return { variant: one.v, kind: 'one-up', label: '' };
      return null;
    }
    return { variant: available(sized) ? available(sized).v : one.v, kind: 'one-unknown', label: '' };
  }

  #score(p) {
    const { style, stage } = this.answers;
    const styles = (Array.isArray(p.st) ? p.st : []).map((s) => String(s).toLowerCase());
    const core = String(p.c || '').toLowerCase();
    const isMemory = core.includes('memory');
    const isEgg = core.includes('egg');
    const isFoam = core.includes('foam');
    const isFibre = core.includes('fibre') || core.includes('fiber');
    const isMesh = core.includes('mesh');
    let score = 0;
    const why = [];

    // style
    const styleKey = { curl: 'curls', lean: 'head', sprawl: 'stretch' }[style] || '';
    if (styles.length === 0) {
      score += 0.5;
    } else if (styles.some((s) => s.includes(styleKey))) {
      score += 3;
      why.push(style === 'curl' ? this.t.whyStyleCurl : style === 'lean' ? this.t.whyStyleLean : this.t.whyStyleSprawl);
    } else {
      score -= 2;
      why.push(this.t.whyStyleMiss);
    }

    // joints
    if (stage === 'diagnosed') {
      if (isMemory) {
        score += 3.5;
        why.push(this.t.whyFoamDiagnosed);
      } else if (isEgg) {
        score += 2;
        why.push(this.t.whyEggDiagnosed);
      } else if (isFoam) {
        score += 1.5;
      } else if (isFibre || isMesh) {
        score -= 3;
      } else {
        score -= 1;
      }
      if (p.le) {
        score += 1.5;
        why.push(this.t.whyLowEntry);
      }
    } else if (stage === 'slowing') {
      if (isMemory) {
        score += 2.5;
        why.push(this.t.whyFoamSlowing);
      } else if (isEgg || isFoam) {
        score += 2;
        why.push(this.t.whyFoamSlowing);
      } else if (isFibre) {
        score -= 1.5;
      } else if (isMesh) {
        score -= 1;
      }
      if (p.le) {
        score += 1;
        why.push(this.t.whyLowEntry);
      }
    } else {
      if (isMemory || isEgg || isFoam) {
        score += 1;
        why.push(this.t.whyFoamFine);
      } else if (isFibre) {
        score += 0.5;
        why.push(this.t.whySoft);
      }
    }
    if (p.fg) score += 0.5;
    if (p.av === false) score -= 6;

    const prio = (Array.isArray(p.tags) ? p.tags : []).map((t) => /^finder:priority-(\d+)$/i.exec(String(t))).find(Boolean);
    if (prio) score += Math.min(10, Number(prio[1])) * 0.3;

    return { score, why };
  }

  #rank() {
    const want = this.#wantRank();
    const hint = this.sizes.find((s) => sizeRank(s.v) === want) || null;
    const out = [];
    for (const p of this.products) {
      if (this.#excluded(p)) continue;
      const fit = this.#fitVariant(p);
      if (!fit) continue;
      const { score, why } = this.#score(p);
      let s = score;
      let sizeWhy = '';
      if (fit.kind === 'exact' || fit.kind === 'band') {
        s += 2;
        if (fit.variant.sw) sizeWhy = fill(this.t.whySizeBand, { size: fit.label, weight: fit.variant.sw });
        else if (hint && hint.b) sizeWhy = fill(this.t.whySizeBreeds, { size: fit.label, breeds: hint.b });
        else sizeWhy = fill(this.t.sizeLine, { size: fit.label });
      } else if (fit.kind === 'up') {
        s += 0.5;
        sizeWhy = fill(this.t.whySizeUp, { size: fit.label });
      } else if (fit.kind === 'one') {
        s += 1.5;
        sizeWhy = fit.variant.sw ? fill(this.t.whySizeBand, { size: this.t.oneSize, weight: fit.variant.sw }) : this.t.whySizeOne;
      } else if (fit.kind === 'one-up') {
        s += 0.25;
        sizeWhy = this.t.whySizeOne;
      } else {
        s -= 0.5;
        sizeWhy = this.t.whySizeOne;
      }
      if (!fit.variant.a) s -= 6;
      out.push({ p, fit, score: s, why: [...why, sizeWhy].filter(Boolean) });
    }
    out.sort((a, b) => b.score - a.score || a.p.p - b.p.p);
    return out;
  }

  /* ---------- result ---------- */

  #result() {
    const ranked = this.#rank();
    const best = ranked[0] || null;
    const alt = ranked.find((r) => best && r.p.h !== best.p.h && (r.p.sh !== best.p.sh || r.p.c !== best.p.c)) || ranked[1] || null;
    const root = this.querySelector('[data-result]');
    if (!(root instanceof HTMLElement)) return;
    const name = this.answers.name;
    const years = Number(this.dataset.years || 0);
    const showPerNight = this.dataset.perNight === 'true';
    const trialOn = this.dataset.trial === 'true';

    if (!best) {
      root.innerHTML = `<p class="pl-lede">${esc(this.t.noMatch)}</p><div class="pl-actions"><a class="button" href="${esc(this.dataset.browseUrl || '/collections/all')}">${esc(this.t.browseAll)}</a><button type="button" class="pl-link" data-change>${esc(this.t.change)}</button></div>`;
      this.#showResult();
      return;
    }

    const v = best.fit.variant;
    const price = money(v.p);
    const sizeLine = best.fit.label ? fill(this.t.sizeLine, { size: best.fit.label }) : this.t.oneSize;
    const whyItems = best.why.slice(0, 4);
    if (best.p.fg && years > 0) whyItems.push(fill(this.t.whyGuarantee, { years }));
    const perNight = showPerNight && best.p.fg ? perNightText(v.p, years) : '';
    const url = `${best.p.u}${best.p.u.includes('?') ? '&' : '?'}variant=${v.id}`;
    const answers = [
      this.querySelector(`[data-answer="style"][data-value="${this.answers.style}"] strong`)?.textContent,
      this.querySelector(`[data-answer="stage"][data-value="${this.answers.stage}"] strong`)?.textContent,
      this.sizes.find((s) => s.v === this.answers.size)?.l,
    ].filter(Boolean);

    root.innerHTML = `
      <div class="pl-finder__answers">
        ${answers.map((a) => `<span class="pl-chip">${esc(a)}</span>`).join('')}
        <button type="button" class="pl-link pl-small" data-change>${esc(this.t.change)}</button>
      </div>
      <div class="pl-finder__match">
        <a href="${esc(url)}" aria-label="${esc(best.p.t)}">
          ${best.p.i ? `<img class="pl-finder__img" src="${esc(best.p.i)}" alt="${esc(best.p.t)}" width="640" height="640" loading="lazy">` : ''}
        </a>
        <div class="pl-finder__match-copy">
          <p class="pl-eyebrow pl-eyebrow--accent">${esc(name ? fill(this.t.resultHeadingNamed, { name }) : this.t.resultHeading)}</p>
          <h3 class="h3 pl-finder__match-title">${esc(best.p.t)}</h3>
          ${best.p.bf ? `<p class="pl-muted" style="margin:0"><strong>${esc(this.t.bestFor)}:</strong> ${esc(best.p.bf)}</p>` : ''}
          <p style="margin:0"><span class="pl-finder__price">${esc(price)}</span> <span class="pl-muted">· ${esc(sizeLine)}</span></p>
          ${perNight ? `<p class="pl-small pl-muted" style="margin:0">${esc(fill(this.t.perNight, { amount: perNight }))}</p>` : ''}
          <div class="pl-finder__why">
            <p class="pl-eyebrow pl-finder__why-heading">${esc(name ? fill(this.t.whyNamed, { name }) : this.t.why)}</p>
            <ul class="pl-list">${whyItems.map((w) => `<li><svg class="pl-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg><span>${esc(w)}</span></li>`).join('')}</ul>
          </div>
          ${this.answers.stage === 'diagnosed' ? `<p class="pl-small pl-muted" style="margin:0">${esc(this.t.vetNote)}</p>` : ''}
          <div class="pl-finder__cta">
            ${v.a ? `<button type="button" class="button" data-add data-variant-id="${esc(String(v.id))}" data-product-id="${esc(String(best.p.h))}">${esc(name ? fill(this.t.addNamed, { name }) : this.t.add)} · ${esc(price)}</button>` : `<p class="pl-muted" style="margin:0">${esc(this.t.soldOut)}</p>`}
            <a class="button-secondary" href="${esc(url)}">${esc(this.t.details)}</a>
            ${trialOn && best.p.tr ? `<p class="pl-small pl-muted" style="margin:0">${esc(this.t.trialLine)}</p>` : ''}
            <p class="pl-finder__error" data-error hidden></p>
          </div>
        </div>
      </div>
      ${alt ? `
        <div>
          <p class="pl-eyebrow" style="margin-bottom:.5rem">${esc(this.t.also)}</p>
          <a class="pl-finder__alt" href="${esc(`${alt.p.u}${alt.p.u.includes('?') ? '&' : '?'}variant=${alt.fit.variant.id}`)}">
            ${alt.p.i ? `<img src="${esc(alt.p.i)}" alt="" width="72" height="72" loading="lazy">` : ''}
            <span class="pl-finder__alt-copy">
              <strong>${esc(alt.p.t)}</strong>
              <span class="pl-muted">${esc(alt.p.bf || alt.p.sub || '')}</span>
              <span>${esc(money(alt.fit.variant.p))}${alt.fit.label ? ` · ${esc(fill(this.t.sizeLine, { size: alt.fit.label }))}` : ''}</span>
            </span>
          </a>
        </div>` : ''}
    `;

    this.#remember({ handle: best.p.h, variantId: v.id, sizeLabel: best.fit.label || '', dogName: name, title: best.p.t, url, ts: Date.now() });
    this.#showResult();
  }

  #showResult() {
    for (const step of this.querySelectorAll('[data-step]')) {
      const el = /** @type {HTMLElement} */ (step);
      el.hidden = el.dataset.step !== 'result';
    }
    const bar = this.querySelector('[data-progress]');
    if (bar instanceof HTMLElement) bar.style.width = '100%';
    const stepOf = this.querySelector('[data-step-of]');
    if (stepOf) stepOf.textContent = this.t.resultEyebrow || '';
    const back = this.querySelector('[data-back]');
    if (back instanceof HTMLElement) back.hidden = true;
    this.stepIndex = this.steps.length;
    const card = this.querySelector('[data-pl-finder-ui]');
    if (card instanceof HTMLElement) {
      const top = card.getBoundingClientRect().top + window.scrollY - 96;
      if (card.getBoundingClientRect().top < 0) window.scrollTo({ top, behavior: 'smooth' });
    }
    const h = this.querySelector('.pl-finder__match-title');
    if (h instanceof HTMLElement) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }

  #remember(obj) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch (e) {
      /* private mode: fine */
    }
  }

  /* ---------- add to basket, the Horizon way ---------- */

  async #add(button) {
    const variantId = button.dataset.variantId;
    if (!variantId || button.disabled) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = this.t.adding;
    const error = this.querySelector('[data-error]');
    if (error instanceof HTMLElement) error.hidden = true;

    const sectionIds = [];
    for (const el of document.querySelectorAll('cart-items-component')) {
      if (el instanceof HTMLElement && el.dataset.sectionId) sectionIds.push(el.dataset.sectionId);
    }
    const body = new FormData();
    body.append('id', variantId);
    body.append('quantity', '1');
    if (sectionIds.length) body.append('sections', sectionIds.join(','));

    const deferred = CartLinesUpdateEvent.createPromise();
    document.dispatchEvent(
      new CartLinesUpdateEvent({
        action: 'add',
        context: 'product',
        lines: [{ merchandiseId: variantId, quantity: 1 }],
        promise: deferred.promise,
      })
    );

    try {
      const routes = (window.Theme && window.Theme.routes) || {};
      const addUrl = routes.cart_add_url || '/cart/add.js';
      const res = await fetch(addUrl, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/javascript' },
        body,
      });
      const json = await res.json();
      if (json.status) throw new Error(json.description || json.message || 'add failed');
      const cartRes = await fetch(`${routes.cart_url || '/cart'}.json`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      const ajaxCart = await cartRes.json();
      deferred.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(ajaxCart),
        detail: {
          items: ajaxCart.items,
          source: 'pl-bed-finder',
          sourceId: this.dataset.sectionId || 'pl-bed-finder',
          itemCount: 1,
          productId: button.dataset.productId,
          sections: json.sections,
          didError: false,
        },
      });
      button.textContent = this.t.added;
      setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 2500);
      // If the drawer did not open itself (page cart), say so and move on.
      const drawer = document.getElementById('cart-drawer');
      if (!drawer) {
        const cartUrl = routes.cart_url || '/cart';
        window.location.href = cartUrl;
      }
    } catch (e) {
      deferred.reject(e);
      button.disabled = false;
      button.textContent = original;
      if (error instanceof HTMLElement) {
        error.textContent = this.t.addError;
        error.hidden = false;
      }
    }
  }
}

if (!customElements.get('pl-bed-finder')) customElements.define('pl-bed-finder', PlBedFinder);
