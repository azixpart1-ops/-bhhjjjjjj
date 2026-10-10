// The Bed Finder matrix, run headless through the theme's own engine
// (Lunova.finderEngine.recommend, see lib/finder-engine.mjs): every style × stage ×
// size answer, checked against what a shopper must never be shown. Shared by
// test/finder-matrix.test.mjs and `check.mjs --real` (group [finder]).
//
// Problems (ERROR):
//   - an answer with no bed;
//   - a "Never recommend" bed (the Bed Finder section's list: dog houses, kennels,
//     day beds, the car seat, crate mats) or any Dog Houses type / car seat as the
//     main pick or the alternative;
//   - the alternative is the main pick again;
//   - a chosen size shorter than the shortest bed for that dog (Lunova.sizeMin), or
//     a one-size bed whose own size isn't the dog's or one up;
//   - a per-night sum or guarantee line on a bed the foam rule doesn't cover, or a
//     trial line on a product the trial doesn't cover (rules restated below from the
//     product data, independently of the theme's code);
//   - a reason line ("blurb") that runs two sentences together (/\.[A-Z]/);
//   - curl and lean getting the same bed for more than 2 of the 5 sizes at a stage.
import { stripHtml } from './util.mjs';

export const STYLES = ['curl', 'lean', 'sprawl'];
export const STAGES = ['fine', 'slowing', 'diagnosed'];

const tagsOf = (raw) => (Array.isArray(raw.tags) ? raw.tags : String(raw.tags || '').split(',')).map((t) => String(t).trim().toLowerCase()).filter(Boolean);

/** A custom.* metafield value from raw data: Admin API shape {type, value}, a drop, or plain. */
function customValue(raw, key) {
  const ns = raw.custom || (raw.metafields && raw.metafields.custom) || null;
  if (!ns || ns[key] == null) return null;
  const e = ns[key];
  const v = e && typeof e === 'object' && 'value' in e ? e.value : e;
  return v == null || v === '' ? null : v;
}

/**
 * The foam-guarantee rule as the contract states it (snippets/foam-bed, Lunova.foamBed):
 * custom.foam_guarantee decides when set; a core_type that isn't memory foam → not
 * covered; otherwise the older rule (tags, bed type, "no-flatten guarantee" in the copy).
 */
export function foamRule(raw) {
  const fg = customValue(raw, 'foam_guarantee');
  if (fg != null) return fg === true || String(fg).toLowerCase() === 'true';
  const core = customValue(raw, 'core_type');
  if (core != null && !/memory foam/i.test(String(core))) return false;
  const tags = tagsOf(raw);
  if (tags.includes('guarantee:no')) return false;
  if (tags.includes('guarantee:yes')) return true;
  const type = String(raw.product_type ?? raw.type ?? '').toLowerCase();
  const first = type.split('>')[0].trim();
  if (first && !first.includes('bed')) return false;
  if (tags.includes('dog car seat') || tags.includes('car seat') || /car seat/i.test(raw.title || '')) return false;
  return /no[- ]flatten guarantee/i.test(String(raw.body_html ?? raw.description ?? ''));
}

/** The trial rule (snippets/trial-eligible, Lunova.trialEligible) for an exclusion list. */
export function trialRule(raw, excluded) {
  const tags = tagsOf(raw);
  if (tags.includes('trial:no')) return false;
  if (tags.includes('trial:yes')) return true;
  const type = String(raw.product_type ?? raw.type ?? '').toLowerCase();
  return !excluded.some((l) => l && (type.includes(l) || tags.includes(l)));
}

const notABed = (p) => (/^dog houses/i.test(p.type || '') ? `type "${p.type}"` : /car seat/i.test(p.title || '') ? 'a car seat' : /crate mat/i.test(p.title || '') ? 'a crate mat' : null);

/**
 * Run every answer. `eng` from loadFinderEngine(); `raw` maps handle → the catalogue's
 * own product data (body_html, product_type, tags), for the independent rules.
 */
export function runFinderMatrix(eng, { raw = new Map() } = {}) {
  const { L, engine, cfg, sizes } = eng;
  const problems = [];
  const warns = [];
  const records = [];
  const settings = L.settings || {};
  const excluded = (settings.trialExcluded || []).map((x) => String(x).trim().toLowerCase());
  const nights = Number(settings.trialNights) || 0;
  const years = Number(settings.guaranteeYears) || 0;
  const fail = (msg) => problems.push(msg);

  // Every product the finder can recommend: its reason line and its claims.
  for (const p of Object.values(cfg.products)) {
    if (/\.[A-Z]/.test(p.blurb || '')) fail(`${p.handle}: reason line runs sentences together: "${p.blurb.slice(0, 90)}"`);
    const r = raw.get(p.handle);
    if (!r) continue;
    const c = engine.claims(p);
    const foam = foamRule(r);
    if (c.foam !== foam) fail(`${p.handle}: foam guarantee ${c.foam ? 'claimed' : 'withheld'}, but the rule says ${foam ? 'covered' : 'not covered'}`);
    if (!foam && (c.perNight || c.guaranteeYears > 0)) fail(`${p.handle}: per-night/guarantee shown without the foam guarantee`);
    const trial = nights > 0 && trialRule(r, excluded);
    if ((c.trialNights > 0) !== trial) fail(`${p.handle}: trial ${c.trialNights > 0 ? 'promised' : 'withheld'}, but the rule says ${trial ? 'covered' : 'not covered'}`);
  }

  for (const style of STYLES) for (const stage of STAGES) for (const size of sizes) {
    const a = { style, stage, size };
    const at = `${style}/${stage}/${size}`;
    const res = engine.recommend(cfg, a, true, null);
    const want = engine.hintIndex(size);
    const rec = { style, stage, size, main: null, alt: null };
    records.push(rec);
    if (!res.main) { fail(`${at}: no bed`); continue; }
    for (const [role, pick] of [['main', res.main], ['alternative', res.alt]]) {
      if (!pick) continue;
      const p = pick.product;
      const fit = pick.fit;
      const one = /^one/.test(fit.kind);
      const value = one ? null : fit.value;
      const parsed = value != null ? L.sizeParse(value) : (fit.dims ? L.sizeParse(`One size · ${fit.dims}`) : null);
      const length = parsed && parsed.length != null ? Math.round(parsed.length * 10) / 10 : null;
      const c = engine.claims(p);
      rec[role === 'main' ? 'main' : 'alt'] = {
        handle: p.handle, title: p.title, type: p.type, kind: fit.kind, value, dims: one ? fit.dims || '' : '', length, cls: one ? fit.cls : undefined,
        variant: fit.variant && fit.variant.title, price: fit.variant && fit.variant.price,
        sizeLine: one ? '' : engine.displaySize(value), foam: c.foam, perNight: c.perNight, guaranteeYears: c.guaranteeYears, trialNights: c.trialNights,
        personalised: p.personalised === true,
      };
      const bad = notABed(p);
      if (bad) fail(`${at}: ${role} is ${bad}: ${p.title}`);
      if (p.excluded) fail(`${at}: ${role} is on the "Never recommend" list: ${p.title}`);
      const min = L.sizeMin(want);
      if (min != null && length != null && length < min) fail(`${at}: ${role} ${p.title} "${value || fit.dims}" is ${length}cm, shorter than the ${min}cm a ${size} dog needs`);
      if (one && !(fit.cls === want || fit.cls === want + 1) && !(fit.kind === 'one' && pick.block)) fail(`${at}: ${role} ${p.title} is one size made for ${fit.cls > -1 ? sizes[fit.cls] : 'an unknown size'}, not ${size} or one up`);
      if (!one && fit.kind === 'larger' && fit.jump > 1) fail(`${at}: ${role} ${p.title} is ${fit.jump} sizes up`);
      if (!c.foam && (c.perNight || c.guaranteeYears > 0)) fail(`${at}: ${role} ${p.title} shows per-night/guarantee without the foam guarantee`);
    }
    if (res.alt && res.alt.product.handle === res.main.product.handle) fail(`${at}: the alternative is the main pick again (${res.main.product.title})`);
  }

  // How much the answers change the pick: curl and lean should rarely share a bed.
  for (const stage of STAGES) {
    const same = sizes.filter((size) => {
      const c = records.find((r) => r.style === 'curl' && r.stage === stage && r.size === size);
      const l = records.find((r) => r.style === 'lean' && r.stage === stage && r.size === size);
      return c && l && c.main && l.main && c.main.handle === l.main.handle;
    });
    if (sizes.length - same.length < Math.min(3, sizes.length)) fail(`${stage}: curl and lean get the same bed for ${same.length}/${sizes.length} sizes (${same.join(', ')})`);
  }

  const distinct = {};
  for (const r of records) if (r.main) distinct[r.main.title] = (distinct[r.main.title] || 0) + 1;
  const alts = new Set(records.filter((r) => r.alt).map((r) => r.alt.title));
  const summary = `${records.length} answers · ${records.filter((r) => r.main).length} with a bed · ${Object.keys(distinct).length} distinct beds (+${[...alts].filter((t) => !distinct[t]).length} more as alternatives) · ${records.filter((r) => r.main && r.main.perNight).length} results with a per-night line · ${problems.length} problems`;
  return { records, problems, warns, distinct, summary };
}

/** "Bella" grid lines for a report: one row per style/stage. */
export function matrixGrid(result, sizes) {
  const short = (m) => (m ? m.title.replace(/^The /, '').split(/\s+/).slice(0, 2).join(' ') : '(none)');
  const rows = [];
  for (const style of STYLES) for (const stage of STAGES) {
    rows.push(`${`${style}/${stage}`.padEnd(18)} ${sizes.map((size) => { const r = result.records.find((x) => x.style === style && x.stage === stage && x.size === size); return `${size}:${short(r && r.main)}`; }).join(' | ')}`);
  }
  return rows;
}

/** handle → the product's own data for the independent rules; `overlay` adds its custom.*
 *  metafields ({products: {handle: {key: {type, value}}}}, fixtures/real-metafields.json). */
export function rawByHandle(products, overlay = null) {
  const mf = (overlay && overlay.products) || {};
  return new Map((products || []).map((p) => [p.handle, { ...p, body_html: p.body_html ?? stripHtml(p.description || ''), custom: p.custom || mf[p.handle] || null }]));
}
