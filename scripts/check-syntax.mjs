#!/usr/bin/env node
/**
 * 構文チェック: example の全 .js と、HTML の inline <script> を実行せずに構文だけ検査する。
 *   - classic script は vm.Script、type="module" は node --check（一時ファイル）で検査する
 *   - 同梱の第三者ライブラリ（*.min.js など）も対象に含める（壊れていれば読み込めないため）
 *
 *   node scripts/check-syntax.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname;
const errors = [];
const tmp = mkdtempSync(join(tmpdir(), 'orphe-syntax-'));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor', '_merge-src'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html)$/.test(name)) out.push(p);
  }
  return out;
}

function checkModule(rel, code) {
  const file = join(tmp, `${errors.length}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, code);
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    const message = String(error.stderr || error.message).split('\n').find(line => /Error/.test(line)) || 'SyntaxError';
    errors.push(`${rel}: ${message.trim()}`);
  }
}

function checkClassic(rel, code) {
  try {
    new vm.Script(code, { filename: rel });
  } catch (error) {
    errors.push(`${rel}: ${error.message}`);
  }
}

let checked = 0;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  if (file.endsWith('.html')) {
    for (const m of source.matchAll(/<script\b(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1];
      if (/type\s*=\s*["'](?!module|text\/javascript|application\/javascript)/i.test(attrs)) continue; // JSON / テンプレートなど
      const line = source.slice(0, m.index).split('\n').length;
      const label = `${rel}:${line}`;
      if (/type\s*=\s*["']module["']/i.test(attrs)) checkModule(label, m[2]);
      else checkClassic(label, m[2]);
      checked++;
    }
  } else if (file.endsWith('.mjs') || /^\s*(import|export)\s/m.test(source)) {
    checkModule(rel, source);
    checked++;
  } else {
    checkClassic(rel, source);
    checked++;
  }
}
rmSync(tmp, { recursive: true, force: true });

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) in ${checked} scripts`);
  process.exit(1);
}
console.log(`OK (${checked} scripts)`);
