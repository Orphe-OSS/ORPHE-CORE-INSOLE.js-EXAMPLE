#!/usr/bin/env node
/**
 * 静的チェック:
 *   1. 全 HTML の相対 src / href が実在するか
 *   2. catalog.json の links.demo / thumbnail が実在するか
 *   3. 旧ライブラリ（ORPHE-CORE.js / ORPHE-INSOLE.js / CoreToolkit.js 等）や ../../ 参照が残っていないか
 *
 *   node scripts/check-links.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const errors = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor', 'scripts'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const LEGACY = /<script\b[^>]*\bsrc\s*=\s*"[^"]*(ORPHE-CORE\.js|ORPHE-INSOLE\.js|CoreToolkit\.js|InsoleToolkit\.js|BleSharedBridge\.js|CoreCompanionToolkit\.js|Insole(Utils|Fifo|Gait|Simulator)\.js|float16\.min\.js|quaternion\.js)/;

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const html = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  if (LEGACY.test(html)) errors.push(`${rel}: 旧ライブラリの <script> が残っている`);
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)) {
    const url = m[1];
    if (/^(?:[a-z]+:|\/\/|#|\$\{|data:|javascript:|mailto:)/i.test(url) || url.includes('${')) continue;
    if (url.startsWith('../../')) errors.push(`${rel}: リポジトリ外を指す参照 ${url}`);
    const path = decodeURIComponent(url.split(/[?#]/)[0]);
    if (path === '') continue;
    const target = join(dirname(file), path);
    if (!existsSync(target)) errors.push(`${rel}: 見つからない ${url}`);
  }
}

const catalog = JSON.parse(readFileSync(join(ROOT, 'catalog.json'), 'utf8'));
for (const entry of catalog.entries) {
  for (const value of [entry.links?.demo, entry.thumbnail]) {
    if (!value || /^https?:/.test(value)) continue;
    if (!existsSync(join(ROOT, value))) errors.push(`catalog.json ${entry.id}: 見つからない ${value}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s)`);
  process.exit(1);
}
console.log('OK');
