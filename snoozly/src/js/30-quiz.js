/* ---------------------------------------------------------------------
   <sleep-quiz> — the Sleep Match
   Scores the answers against the five sleep needs, then shows the best
   need that actually has beds in it, with the right size pre-selected.
   --------------------------------------------------------------------- */
(() => {
  'use strict';
  const SZ = window.Snoozly;
  const { $, $$ } = SZ;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* How each answer moves the needle. Concern outweighs sleep style: an
     arthritic curler needs support before they need a nest. */
  const WEIGHTS = {
    pet: { cat: { cosy: 2 }, dog: {} },
    style: {
      curl: { cosy: 3, calm: 2 },
      sprawl: { stretch: 3, support: 1, cool: 1 },
      lean: { calm: 3, support: 1 },
      burrow: { cosy: 3, calm: 1 }
    },
    concern: {
      joints: { support: 5 },
      anxious: { calm: 5 },
      hot: { cool: 5, stretch: 1 },
      none: {}
    },
    size: { small: { cosy: 1 }, medium: {}, large: { support: 1, stretch: 1 }, giant: { support: 2, stretch: 1 } }
  };

  /* Size words as they appear in variant titles and supplier titles */
  const SIZE_MATCH = {
    small: /(^|[^a-z])(xs|s|small|extra small|mini)([^a-z]|$)|\b(50|60)\s*[x×]/,
    medium: /(^|[^a-z])(m|medium|med)([^a-z]|$)|\b(70|75|80)\s*[x×]/,
    large: /(^|[^a-z])(l|large)([^a-z]|$)|\b(90|100)\s*[x×]/,
    giant: /(^|[^a-z])(xl|xxl|2xl|3xl|extra large|extra-large|giant|jumbo)([^a-z]|$)|\b(110|120|130)\s*[x×]/
  };

  class SleepQuiz extends HTMLElement {
    connectedCallback() {
      try { this.data = JSON.parse($('[data-quiz-data]', this).textContent); } catch (e) { return; }
      this.steps = $$('.quiz__step', this);
      this.answers = {};
      this.history = [];
      this.label = $('[data-quiz-label]', this);
      this.progress = $('[data-quiz-progress]', this);
      this.back = $('[data-quiz-back]', this);
      this.result = $('[data-quiz-result]', this);
      this.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-answer]');
        if (opt) return this.answer(opt);
        if (e.target.closest('[data-quiz-back]')) return this.goBack();
        if (e.target.closest('[data-quiz-restart]')) return this.restart();
      });
    }
    get flow() { return this.answers.pet === 'cat' ? ['pet', 'style', 'concern'] : ['pet', 'style', 'concern', 'size']; }
    show(name) {
      this.steps.forEach((st) => {
        const on = st.dataset.step === name;
        st.hidden = !on;
        st.classList.toggle('is-active', on);
      });
      const flow = this.flow;
      const i = flow.indexOf(name);
      this.label.textContent = this.data.labels.step.replace('[step]', i + 1).replace('[total]', flow.length);
      this.progress.style.setProperty('--p', `${((i + 1) / (flow.length + 1)) * 100}%`);
      this.back.hidden = i === 0;
      const current = this.steps.find((st) => st.dataset.step === name);
      $$('[data-answer]', current).forEach((b) => b.setAttribute('aria-pressed', String(this.answers[name] === b.dataset.answer)));
      const first = $('[data-answer]', current);
      if (this.started && first) first.focus({ preventScroll: true });
    }
    answer(opt) {
      this.started = true;
      const step = opt.closest('.quiz__step').dataset.step;
      this.answers[step] = opt.dataset.answer;
      opt.classList.add('is-picked');
      setTimeout(() => opt.classList.remove('is-picked'), 400);
      const flow = this.flow;
      const i = flow.indexOf(step);
      this.history.push(step);
      if (i < flow.length - 1) {
        setTimeout(() => this.show(flow[i + 1]), 180);
      } else {
        setTimeout(() => this.finish(), 220);
      }
    }
    goBack() {
      const prev = this.history.pop();
      if (!this.result.hidden) { this.result.hidden = true; $('[data-quiz-steps]', this).hidden = false; }
      if (prev) this.show(prev);
    }
    restart() {
      this.answers = {};
      this.history = [];
      this.result.hidden = true;
      $('[data-quiz-steps]', this).hidden = false;
      this.show('pet');
      $('[data-answer]', this.steps[0]).focus({ preventScroll: true });
    }
    score() {
      const totals = { calm: 0, support: 0, cool: 0, cosy: 0, stretch: 0 };
      Object.entries(this.answers).forEach(([q, a]) => {
        const w = (WEIGHTS[q] || {})[a] || {};
        Object.entries(w).forEach(([need, pts]) => { totals[need] += pts; });
      });
      // Only needs that have beds in stock (or at least listed) can win
      const ranked = Object.keys(totals)
        .filter((k) => this.data.needs[k] && this.data.needs[k].products.length)
        .sort((a, b) => totals[b] - totals[a] || this.availableCount(b) - this.availableCount(a));
      return ranked;
    }
    availableCount(k) { return this.data.needs[k].products.filter((p) => p.available).length; }
    sizeKey() { return this.answers.pet === 'cat' ? 'cat' : (this.answers.size || 'medium'); }
    pickVariant(p) {
      const key = this.sizeKey();
      const re = SIZE_MATCH[key === 'cat' ? 'small' : key];
      if (!re) return null;
      const titleHit = re.test(` ${p.title.toLowerCase()} `);
      const v = p.variants.find((x) => x.a && re.test(` ${x.t} `)) || null;
      return v ? { id: v.id } : (titleHit ? { id: null } : null);
    }
    finish() {
      const ranked = this.score();
      this.progress.style.setProperty('--p', '100%');
      const L = this.data.labels;
      $('[data-quiz-steps]', this).hidden = true;
      this.back.hidden = false;
      this.label.textContent = L.match;
      if (!ranked.length) {
        this.result.innerHTML = `<p class="quiz__none">${esc(L.none)}</p><a class="btn" href="${esc(this.data.allUrl)}">${esc(L.shopAll.replace('{need}', ''))}</a>`;
        this.result.hidden = false;
        return;
      }
      const key = ranked[0];
      const need = this.data.needs[key];
      const alt = ranked[1] ? this.data.needs[ranked[1]] : null;
      try { localStorage.setItem('sz-match', JSON.stringify({ need: key, size: this.sizeKey(), pet: this.answers.pet, t: Date.now() })); } catch (e) { /* private mode */ }

      const products = need.products
        .map((p) => ({ ...p, fit: this.pickVariant(p) }))
        .sort((a, b) => (b.available - a.available) || ((b.fit ? 1 : 0) - (a.fit ? 1 : 0)))
        .slice(0, 3);

      const cards = products.map((p, i) => {
        const url = p.fit && p.fit.id ? `${p.url}?variant=${p.fit.id}` : p.url;
        return `<li class="qres__product${p.available ? '' : ' is-out'}">
          <a href="${esc(url)}" class="qres__link">
            <span class="qres__img">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" width="240" height="240">` : ''}</span>
            <span class="qres__meta">
              ${i === 0 && p.available ? `<span class="badge badge--moon">${esc(L.top)}</span>` : ''}
              <span class="qres__name">${esc(p.title)}</span>
              <span class="qres__price">${esc(p.price)}</span>
              ${!p.available ? `<span class="qres__flag">${esc(L.backSoon)}</span>` : (p.fit ? `<span class="qres__flag qres__flag--fit">✓ ${esc(L.inSize)}</span>` : '')}
            </span>
          </a>
        </li>`;
      }).join('');

      const sizeText = this.data.sizes[this.sizeKey()] || '';
      this.result.innerHTML = `
        <div class="qres need--${key}">
          <div class="qres__head">
            <span class="qres__icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/></svg></span>
            <div>
              <p class="qres__kicker">${esc(L.match)}</p>
              <h3 class="qres__need">${esc(need.label)} <em>${esc(need.for)}</em></h3>
            </div>
          </div>
          <p class="qres__why"><strong>${esc(L.why)}</strong> ${esc(need.why)}</p>
          ${sizeText ? `<p class="qres__size"><strong>${esc(L.size)}</strong> ${esc(sizeText)}</p>` : ''}
          <ul class="qres__products" role="list">${cards}</ul>
          <div class="qres__actions">
            ${need.url ? `<a class="btn qres__cta" href="${esc(need.url)}">${esc(L.shopAll.replace('{need}', need.label))}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}
            <button type="button" class="btn btn--ghost" data-quiz-restart>${esc(L.restart)}</button>
          </div>
          ${alt && alt.url ? `<p class="qres__alt">${esc(L.alsoTry)} <a href="${esc(alt.url)}" class="need--${esc(ranked[1])}">${esc(alt.label)} — ${esc(alt.for.toLowerCase())}</a></p>` : ''}
        </div>`;
      this.result.hidden = false;
      this.result.focus({ preventScroll: true });
      const top = this.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) this.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.dispatchEvent(new CustomEvent('sleep-match:result', { detail: { need: key, answers: this.answers } }));
    }
  }
  customElements.define('sleep-quiz', SleepQuiz);
})();
