#!/usr/bin/env node
/**
 * orphe-core-insole.js の読み込み先を CDN とローカル vendor/ で一括切替する。
 * タグ未発行で CDN が 404 の間や、未リリースの SDK を試すときに使う。
 *
 *   node scripts/toggle-cdn.mjs local   # CDN → ../vendor/
 *   node scripts/toggle-cdn.mjs cdn     # ../vendor/ → CDN（コミット前に必ず戻す）
 *
 * vendor/ には ORPHE-CORE-INSOLE.js で `npm run build:browser` した dist/browser/ の
 * orphe-core-insole.js と orphe-core-insole-toolkit.js を置く（.gitignore 済み）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CDN = 'https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE-INSOLE.js@v0.1.0/dist/browser/';
const LOCAL = '../vendor/';
const mode = process.argv[2];
if (mode !== 'local' && mode !== 'cdn') {
  console.error('usage: node scripts/toggle-cdn.mjs <local|cdn>');
  process.exit(1);
}
const [from, to] = mode === 'local' ? [CDN, LOCAL] : [LOCAL, CDN];
const re = new RegExp(`(["'])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(orphe-core-insole(?:-toolkit)?(?:\\.min)?\\.js)`, 'g');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor', 'scripts'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

let count = 0;
for (const file of walk(ROOT)) {
  // ルート直下の HTML（ギャラリー）は vendor/ を ./vendor/ で参照する
  const depth = relative(ROOT, file).split('/').length - 1;
  const local = depth === 0 ? './vendor/' : LOCAL;
  const src = readFileSync(file, 'utf8');
  const fromRe = mode === 'local' ? re : new RegExp(`(["'])${local.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(orphe-core-insole(?:-toolkit)?(?:\\.min)?\\.js)`, 'g');
  const dst = src.replace(fromRe, (_, q, name) => { count++; return `${q}${mode === 'local' ? local : CDN}${name}`; });
  if (dst !== src) writeFileSync(file, dst);
}
console.log(`${mode}: ${count} references updated`);
