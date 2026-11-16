#!/usr/bin/env node
/**
 * example が読み込む ORPHE-CORE-INSOLE.js の CDN 版を一括で上げる。
 * SDK の新しいタグ（v<version>）が jsDelivr から配信されてから実行する（.github/workflows/sdk-bump.yml が自動で呼ぶ）。
 *
 *   node scripts/bump-sdk.mjs v0.3.1     # 全 example・README・scripts の版を v0.3.1 にする
 *   node scripts/bump-sdk.mjs --current  # 現在の版（check-links.mjs の EXPECTED_SDK_VERSION）を出力する
 *
 * 書き換えるもの:
 *   - .html / .js の CDN URL（…/ORPHE-CORE-INSOLE.js@v<旧>/…）
 *   - scripts/toggle-cdn.mjs の CDN、scripts/check-links.mjs の EXPECTED_SDK_VERSION
 *   - README.md の CDN URL と版表記
 * CHANGELOG などの .md は過去の記録なので書き換えない。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CHECK_LINKS = join(ROOT, 'scripts/check-links.mjs');
const TOGGLE_CDN = join(ROOT, 'scripts/toggle-cdn.mjs');
const README = join(ROOT, 'README.md');

const current = readFileSync(CHECK_LINKS, 'utf8').match(/const EXPECTED_SDK_VERSION = '(v[^']+)';/)?.[1];
if (!current) {
  console.error('scripts/check-links.mjs に EXPECTED_SDK_VERSION が見つからない');
  process.exit(1);
}

const arg = process.argv[2];
if (arg === '--current') {
  console.log(current);
  process.exit(0);
}
if (!/^v\d+\.\d+\.\d+(-[\w.]+)?$/.test(arg ?? '')) {
  console.error('usage: node scripts/bump-sdk.mjs <v<major>.<minor>.<patch>|--current>');
  process.exit(1);
}
const next = arg;
if (next === current) {
  console.log(`${current} のまま（変更なし）`);
  process.exit(0);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cdnRe = new RegExp(`ORPHE-CORE-INSOLE\\.js@${escape(current)}/`, 'g');
const cdnTo = `ORPHE-CORE-INSOLE.js@${next}/`;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', '.tmp', 'node_modules', 'vendor', 'scripts', '_merge-src'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(name)) out.push(p);
  }
  return out;
}

/** [ファイル, 置換の組] */
const targets = [
  ...walk(ROOT).map((file) => [file, [[cdnRe, cdnTo]]]),
  [TOGGLE_CDN, [[cdnRe, cdnTo]]],
  [CHECK_LINKS, [[new RegExp(`'${escape(current)}'`, 'g'), `'${next}'`]]],
  // README は CDN URL と、本文中の `v<版>` / `@v<版>` の表記
  [README, [[cdnRe, cdnTo], [new RegExp(`(\`@?)${escape(current)}\``, 'g'), `$1${next}\``]]],
];

let count = 0;
let files = 0;
for (const [file, rules] of targets) {
  const src = readFileSync(file, 'utf8');
  let dst = src;
  for (const [re, to] of rules) {
    count += dst.match(re)?.length ?? 0;
    dst = dst.replace(re, to);
  }
  if (dst !== src) {
    writeFileSync(file, dst);
    files++;
    console.log(`updated ${relative(ROOT, file)}`);
  }
}
console.log(`${current} -> ${next}: ${count} references in ${files} files`);
