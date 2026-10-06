#!/usr/bin/env node
/**
 * ORPHE-CORE.js / ORPHE-INSOLE.js の examples を ORPHE-CORE-INSOLE.js（orphe-core-insole.js）へ
 * 置き換えるための一回限りの移行スクリプト。
 *
 *   node scripts/migrate.mjs            # 置換を適用
 *   node scripts/migrate.mjs --dry-run  # 件数だけ表示
 *
 * 各 HTML について次を行う:
 *   - 旧 SDK（ORPHE-CORE.js / ORPHE-INSOLE.js）の <script> を orphe-core-insole.js 1 本に置換（2 回目以降は削除）
 *   - 旧 Toolkit（CoreToolkit.js / InsoleToolkit.js / CoreCompanionToolkit.js）の <script> を
 *     orphe-core-insole-toolkit.js 1 本に置換（2 回目以降は削除）
 *   - SDK に内蔵された補助ライブラリ（BleSharedBridge / float16 / quaternion / Insole*.js）の <script> を削除
 *   - 旧リポジトリのルート資産（../../js, ../../css, ../../images, ../../assets）を ../assets/ へ付け替え
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CDN = 'https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE-INSOLE.js@v0.1.0/dist/browser';
const SDK_TAG = `<script src="${CDN}/orphe-core-insole.js"></script>`;
const TOOLKIT_TAG = `<script src="${CDN}/orphe-core-insole-toolkit.js"></script>`;
const DRY = process.argv.includes('--dry-run');
const SKIP_DIRS = new Set(['.git', 'node_modules', '_merge-src', 'scripts', 'vendor', 'assets', '_thumbnails']);

const OLD_CORE_CDN = String.raw`https://cdn\.jsdelivr\.net/gh/Orphe-OSS/ORPHE-CORE\.js(?:@[^/"]+)?/js/`;
const RE_SDK = new RegExp(String.raw`^(?:\.\./\.\./js/|${OLD_CORE_CDN})ORPHE-CORE\.js(?:\?.*)?$|^\.\./\.\./src/ORPHE-INSOLE\.js(?:\?.*)?$`);
const RE_TOOLKIT = /^(?:\.\.\/\.\.\/js\/CoreToolkit\.js|\.\.\/\.\.\/src\/(?:InsoleToolkit|CoreCompanionToolkit)\.js)(?:\?.*)?$/;
const RE_BUNDLED = new RegExp(
  String.raw`^(?:(?:\.\./\.\./js/|${OLD_CORE_CDN})(?:BleSharedBridge|float16\.min|quaternion)\.js|\.\./\.\./src/(?:InsoleUtils|InsoleFifo|InsoleGait|InsoleSimulator)\.js)(?:\?.*)?$`,
);
const RE_SCRIPT = /[ \t]*<script\b[^>]*?\bsrc\s*=\s*"([^"]*)"[^>]*>\s*<\/script>[ \t]*\r?\n?/g;
const RE_COMMENT = /<!--[\s\S]*?-->/g;

const stats = { files: 0, sdk: 0, toolkit: 0, removed: 0, commentRemoved: 0, paths: 0 };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, out);
    } else if (name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

function isLibSrc(src) {
  return RE_SDK.test(src) || RE_TOOLKIT.test(src) || RE_BUNDLED.test(src);
}

function migrate(html) {
  // 旧ライブラリの <script> だけを含むコメントは丸ごと削除（重複判定を誤らないため）
  html = html.replace(RE_COMMENT, (comment) => {
    const srcs = [...comment.matchAll(/<script\b[^>]*?\bsrc\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
    if (srcs.length === 0 || !srcs.every(isLibSrc)) return comment;
    const rest = comment.replace(/^<!--|-->$/g, '').replace(/<script\b[^>]*>\s*(<\/script>)?/g, '').trim();
    if (rest !== '') return comment;
    stats.commentRemoved++;
    return '';
  });

  let sdkDone = false;
  let toolkitDone = false;
  html = html.replace(RE_SCRIPT, (tag, src) => {
    const indent = tag.match(/^[ \t]*/)[0];
    const eol = /\n$/.test(tag) ? '\n' : '';
    if (RE_SDK.test(src)) {
      if (sdkDone) { stats.removed++; return ''; }
      sdkDone = true; stats.sdk++;
      return `${indent}${SDK_TAG}${eol}`;
    }
    if (RE_TOOLKIT.test(src)) {
      if (toolkitDone) { stats.removed++; return ''; }
      toolkitDone = true; stats.toolkit++;
      return `${indent}${TOOLKIT_TAG}${eol}`;
    }
    if (RE_BUNDLED.test(src)) { stats.removed++; return ''; }
    return tag;
  });

  // ルート資産のパス付け替え
  const pathRules = [
    [/(["'])\.\.\/\.\.\/js\/(bootstrap\.bundle\.min|p5|site-analytics)\.js/g, '$1../assets/js/$2.js'],
    [/(["'])\.\.\/\.\.\/css\/(custom|orphe_custom)\.css/g, '$1../assets/css/$2.css'],
    [/(["'])\.\.\/\.\.\/images\//g, '$1../assets/images/'],
    [/(["'])\.\.\/\.\.\/assets\/images\//g, '$1../assets/images/'],
    [/(["'])\.\.\/\.\.\/models\//g, '$1../assets/models/'],
    [/(["'])\.\.\/\.\.\/fonts\//g, '$1../assets/fonts/'],
    [/href="\.\.\/\.\.\/index\.html(?:#examples)?"/g, 'href="../index.html"'],
    [/href="\.\.\/\.\.\/docs\/"/g, 'href="https://orphe-oss.github.io/ORPHE-INSOLE.js/docs/"'],
    [/href="\.\.\/\.\.\/"/g, 'href="../index.html"'],
  ];
  for (const [re, to] of pathRules) {
    html = html.replace(re, (...args) => { stats.paths++; return args[0].replace(re, to); });
  }

  // SDK より前に Toolkit が来ていないか確認
  const iSdk = html.indexOf(SDK_TAG);
  const iTk = html.indexOf(TOOLKIT_TAG);
  if (iTk !== -1 && (iSdk === -1 || iTk < iSdk)) {
    throw new Error('toolkit tag appears before SDK tag');
  }
  return html;
}

for (const file of walk(ROOT)) {
  const before = readFileSync(file, 'utf8');
  let after;
  try {
    after = migrate(before);
  } catch (error) {
    console.error(`${relative(ROOT, file)}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  if (after !== before) {
    stats.files++;
    if (!DRY) writeFileSync(file, after);
    console.log(`${DRY ? '[dry] ' : ''}${relative(ROOT, file)}`);
  }
}
console.log(stats);
