#!/usr/bin/env node
// Real-catalogue fixture for the Lunova harness (--real / ?real=1).
//
//   node fixtures/fetch-real.mjs            download the live catalogue (storefront JSON, read-only;
//                                           a failed download keeps the file already there)
//   node fixtures/fetch-real.mjs --offline  skip the network and copy the snapshot
//   node fixtures/fetch-real.mjs --check    print what the cached file holds
//
// Writes .out/real-products.json (gitignored):
//   { meta: { source, fetched_at, origin },
//     products: [...]             ← exactly what /products.json?limit=250 returns
//     all: ['handle', …]          ← /collections/all order (Shopify's default listing)
//     collections: [{ handle, title, description, products: ['handle', …] }] }
//
// Only public storefront GETs are made (products.json, collections.json and
// collections/<h>/products.json). Node's fetch ignores HTTPS_PROXY, so this shells
// out to curl, which honours it. Offline, it copies the snapshot instead (REAL_SNAPSHOT
// env var, else the committed fixtures/real-catalogue.json: the live /products.json
// with 64 products) and derives `all` (title order) and `frontpage` (the last known
// home-page product).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { OUT_DIR, parseArgs } from '../lib/util.mjs';

export const REAL_ORIGIN = process.env.REAL_STORE_ORIGIN || 'https://pawlunova.co.uk';
export const REAL_FILE = path.join(OUT_DIR, 'real-products.json');
/** The committed snapshot (fixtures/real-catalogue.json): the offline fallback, and the
 *  fixed catalogue the finder-matrix self-test runs against (it never changes under a test). */
export const REAL_FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'real-catalogue.json');
export const REAL_SNAPSHOT = process.env.REAL_SNAPSHOT || REAL_FIXTURE;
/** The home-page collection's product when the snapshot was taken (used offline only). */
const SNAPSHOT_FRONTPAGE = ['ennerdale-gel-memory-foam-orthopaedic-dog-bed'];

function curlJson(url, { timeout = 45 } = {}) {
  const out = execFileSync('curl', ['-sS', '-L', '--fail', '--max-time', String(timeout), '-H', 'Accept: application/json', url], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function curlJsonAsync(url, { timeout = 30 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sS', '-L', '--fail', '--max-time', String(timeout), '-H', 'Accept: application/json', url], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (err, out) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
    });
  });
}

/**
 * products.json leaves out image alt text and media ids. /products/<handle>.js has both;
 * fold them into each product's images (image.alt, image.media_id). Best effort.
 */
async function addMediaDetails(origin, products, { concurrency = 6 } = {}) {
  let done = 0;
  const base = (u) => String(u || '').split('?')[0].split('/').pop();
  const queue = [...products];
  async function worker() {
    for (let p = queue.shift(); p; p = queue.shift()) {
      try {
        const j = await curlJsonAsync(`${origin}/products/${encodeURIComponent(p.handle)}.js`);
        const media = Array.isArray(j.media) ? j.media : [];
        for (const im of p.images || []) {
          const m = media.find((x) => base(x.src || (x.preview_image && x.preview_image.src)) === base(im.src));
          if (m) { im.alt = m.alt == null ? null : m.alt; im.media_id = m.id; }
        }
        done++;
      } catch { /* keep products.json data */ }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return done;
}

/** Every page of a products.json endpoint (250 per page, Shopify's maximum). */
function allPages(base) {
  const list = [];
  for (let page = 1; page <= 20; page++) {
    const j = curlJson(`${base}${base.includes('?') ? '&' : '?'}limit=250&page=${page}`);
    const got = Array.isArray(j.products) ? j.products : [];
    list.push(...got);
    if (got.length < 250) break;
  }
  return list;
}

export async function fetchLive(origin = REAL_ORIGIN) {
  const products = allPages(`${origin}/products.json`);
  if (!products.length) throw new Error('products.json returned no products');
  const detailed = await addMediaDetails(origin, products);
  let all = [];
  try { all = allPages(`${origin}/collections/all/products.json`).map((p) => p.handle); } catch { all = []; }
  const collections = [];
  let listed = [];
  try { listed = (curlJson(`${origin}/collections.json?limit=250`).collections || []); } catch { listed = []; }
  for (const c of listed) {
    if (!c || !c.handle || c.handle === 'all') continue;
    let handles = [];
    try { handles = allPages(`${origin}/collections/${encodeURIComponent(c.handle)}/products.json`).map((p) => p.handle); } catch { handles = []; }
    collections.push({ handle: c.handle, title: c.title || c.handle, description: c.body_html || c.description || '', products: handles });
  }
  return { meta: { source: 'live', origin, fetched_at: new Date().toISOString(), media_details: `${detailed}/${products.length}` }, products, all, collections };
}

export function fromSnapshot(file = REAL_SNAPSHOT) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const products = Array.isArray(j) ? j : j.products;
  if (!Array.isArray(products) || !products.length) throw new Error(`${file}: no products`);
  const handles = new Set(products.map((p) => p.handle));
  const all = Array.isArray(j.all) && j.all.length ? j.all : [...products].sort((a, b) => a.title.localeCompare(b.title)).map((p) => p.handle);
  const front = SNAPSHOT_FRONTPAGE.filter((h) => handles.has(h));
  const collections = Array.isArray(j.collections) && j.collections.length
    ? j.collections
    : [{ handle: 'frontpage', title: 'Home page', description: '', products: front.length ? front : [products[0].handle] }];
  return { meta: { source: 'snapshot', origin: REAL_ORIGIN, file, fetched_at: (j.meta && j.meta.fetched_at) || fs.statSync(file).mtime.toISOString() }, products, all, collections };
}

function write(data, file = REAL_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

/**
 * Make sure .out/real-products.json exists (download, else snapshot) and return it.
 * refresh:true re-downloads even when the file exists (a failed refresh keeps the file
 * already there); offline:true never touches the network and copies the snapshot.
 */
export function ensureRealProducts({ refresh = false, offline = false, log = () => {} } = {}) {
  const existing = fs.existsSync(REAL_FILE) ? (() => { try { return JSON.parse(fs.readFileSync(REAL_FILE, 'utf8')); } catch { return null; } })() : null;
  if (existing && !refresh) return existing;
  if (!offline) {
    const tmp = `${REAL_FILE}.download-${process.pid}`;
    try {
      // fetchLive is async (parallel media requests); a child process keeps this function synchronous.
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--download-only', '--to', tmp], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180000 });
      const data = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      if (!data.meta || data.meta.source !== 'live' || !Array.isArray(data.products) || !data.products.length) throw new Error('download wrote no products');
      write(data);
      log(`real catalogue: ${data.products.length} products from ${data.meta.origin} (media details ${data.meta.media_details}) → ${REAL_FILE}`);
      return data;
    } catch (e) {
      const why = String((e.stderr && String(e.stderr).trim()) || e.message).split('\n')[0];
      if (existing) { log(`real catalogue: download failed (${why}) — keeping ${REAL_FILE} (${existing.meta && existing.meta.source} ${existing.meta && existing.meta.fetched_at})`); return existing; }
      log(`real catalogue: download failed (${why}) — falling back to the snapshot`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  const data = write(fromSnapshot());
  log(`real catalogue: ${data.products.length} products from snapshot ${data.meta.file} → ${REAL_FILE}`);
  return data;
}

/** The cached real catalogue (created on first use). */
let cached = null;
export function loadRealCatalog({ log = (m) => process.stderr.write(`${m}\n`) } = {}) {
  if (cached && cached.mtime === (fs.existsSync(REAL_FILE) ? fs.statSync(REAL_FILE).mtimeMs : 0)) return cached.data;
  const data = ensureRealProducts({ log });
  cached = { data, mtime: fs.existsSync(REAL_FILE) ? fs.statSync(REAL_FILE).mtimeMs : 0 };
  return data;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = parseArgs(process.argv.slice(2));
  if (args['download-only']) {
    fetchLive().then((d) => write(d, args.to ? path.resolve(String(args.to)) : REAL_FILE)).then(() => process.exit(0), (e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
  } else try {
    const data = args.check ? JSON.parse(fs.readFileSync(REAL_FILE, 'utf8')) : ensureRealProducts({ refresh: true, offline: !!args.offline, log: console.log });
    const types = {};
    for (const p of data.products) types[p.product_type || '(none)'] = (types[p.product_type || '(none)'] || 0) + 1;
    console.log(`source=${data.meta.source} fetched_at=${data.meta.fetched_at} products=${data.products.length} variants=${data.products.reduce((s, p) => s + p.variants.length, 0)}`);
    console.log(`collections: all(${data.all.length}) ${data.collections.map((c) => `${c.handle}(${c.products.length})`).join(' ')}`);
    for (const [t, n] of Object.entries(types).sort()) console.log(`  ${String(n).padStart(3)}  ${t}`);
  } catch (e) {
    console.error(`fetch-real: ${e.message}`);
    process.exit(1);
  }
}
