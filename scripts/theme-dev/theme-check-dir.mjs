#!/usr/bin/env node
// Run Shopify's theme-check (@shopify/theme-check-node) on any theme folder.
//
//   node theme-check-dir.mjs <themeDir> [--only=pln] [--json] [--ignore=MissingAsset,...]
//
// --only=<prefix>   report offenses only for files whose basename starts with <prefix>
//                   (e.g. pln, so a partial snapshot of a store theme can be checked
//                   for the files we own without noise from files we did not pull)
// --ignore=a,b      drop these check names
// --json            print offenses as JSON
// Exit code 1 when any reported offense is an error (severity 0).
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const dir = path.resolve(argv.find((a) => !a.startsWith('--')) || '.');
const opt = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const ignore = new Set(String(opt.ignore || '').split(',').filter(Boolean));
const only = opt.only ? String(opt.only) : null;

const require = createRequire(import.meta.url);
const tc = require('@shopify/theme-check-node');

const res = await tc.themeCheckRun(dir, undefined, () => {});
const rows = [];
for (const o of res.offenses) {
  const file = o.uri.replace(/^file:\/\//, '').replace(dir + path.sep, '');
  if (ignore.has(o.check)) continue;
  if (only && !path.basename(file).startsWith(only)) continue;
  rows.push({
    severity: o.severity === 0 ? 'error' : o.severity === 1 ? 'warn' : 'info',
    check: o.check,
    file,
    line: o.start ? o.start.line + 1 : null,
    message: o.message,
  });
}
rows.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));
if (opt.json) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  for (const r of rows) console.log(`${r.severity.toUpperCase().padEnd(5)} ${r.check.padEnd(28)} ${r.file}:${r.line ?? ''}  ${r.message}`);
  const c = { error: 0, warn: 0, info: 0 };
  rows.forEach((r) => c[r.severity]++);
  console.log(`SUMMARY errors=${c.error} warnings=${c.warn} info=${c.info} (of ${res.offenses.length} total offenses before filters)`);
}
process.exit(rows.some((r) => r.severity === 'error') ? 1 : 0);
