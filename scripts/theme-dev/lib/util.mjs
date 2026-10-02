// Small shared helpers for the Lunova theme dev harness (no dependencies).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HARNESS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = path.resolve(HARNESS_DIR, '..', '..');
export const DEFAULT_THEME_DIR = path.join(REPO_DIR, 'theme');
export const FIXTURE_IMG_DIR = path.join(REPO_DIR, 'assets', 'img');
export const OUT_DIR = path.join(HARNESS_DIR, '.out');

export function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

export function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

export function exists(file) {
  try { fs.accessSync(file); return true; } catch { return false; }
}

export function listFiles(dir, { recursive = false, ext = null } = {}) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive) out.push(...listFiles(p, { recursive, ext }));
    } else if (!ext || ext.some((x) => e.name.endsWith(x))) {
      out.push(p);
    }
  }
  return out.sort();
}

/** Shopify JSON templates may open with a single /* *\/ comment block. */
export function stripJsonComment(src) {
  return String(src).replace(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/, '');
}

export function parseJsonFile(file) {
  const src = readText(file);
  if (src == null) return { ok: false, error: 'file not found', missing: true };
  try {
    return { ok: true, value: JSON.parse(stripJsonComment(src)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function handleize(str) {
  return String(str == null ? '' : str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['"’‘“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtml(str) {
  return String(str == null ? '' : str)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '');
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge(target, src) {
  if (!isPlainObject(src)) return target;
  for (const [k, v] of Object.entries(src)) {
    if (isPlainObject(v) && isPlainObject(target[k])) deepMerge(target[k], v);
    else if (isPlainObject(v)) target[k] = deepMerge({}, v);
    else target[k] = v;
  }
  return target;
}

export function getPath(obj, dotted) {
  let cur = obj;
  for (const part of String(dotted).split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Read width/height from a JPEG or PNG header without dependencies. */
export function imageSize(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return null; }
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

export const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.liquid': 'text/plain; charset=utf-8',
};

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

/** Error/warning collector shared by renderer, server and checks. */
export class Issues {
  constructor() { this.list = []; this.seen = new Set(); }
  add(level, kind, message, where = {}) {
    const file = where.file ? relTheme(where.file) : '';
    const key = `${level}|${kind}|${file}|${where.line || ''}|${message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push({ level, kind, message, file, line: where.line || null, ...(where.extra || {}) });
  }
  error(kind, message, where) { this.add('error', kind, message, where); }
  warn(kind, message, where) { this.add('warn', kind, message, where); }
  get errors() { return this.list.filter((x) => x.level === 'error'); }
  get warnings() { return this.list.filter((x) => x.level === 'warn'); }
}

let THEME_ROOT_FOR_REL = DEFAULT_THEME_DIR;
export function setThemeRootForRel(dir) { THEME_ROOT_FOR_REL = dir; }
export function relTheme(file) {
  if (!file) return '';
  const s = String(file);
  if (s.startsWith(THEME_ROOT_FOR_REL)) return s.slice(THEME_ROOT_FOR_REL.length + 1);
  return s;
}

export function formatIssue(i) {
  const loc = i.file ? `${i.file}${i.line ? ':' + i.line : ''}` : '';
  return `${i.level === 'error' ? 'ERROR' : 'WARN '} ${i.kind.padEnd(20)} ${loc ? loc + ' ' : ''}${i.message}`;
}
