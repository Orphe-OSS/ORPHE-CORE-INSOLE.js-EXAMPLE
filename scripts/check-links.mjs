#!/usr/bin/env node
/**
 * 静的チェック:
 *   1. 全 HTML の相対 src / href が実在するか
 *   2. catalog.json の links.demo / thumbnail が実在するか
 *   3. 旧ライブラリ（ORPHE-CORE.js / ORPHE-INSOLE.js / CoreToolkit.js 等）や ../../ 参照が残っていないか
 *   4. example のコード（.js と HTML の inline script）に互換 API（new Orphe( / got* = など）が残っていないか
 *   5. SDK の CDN 版が EXPECTED_SDK_VERSION か、vendor/ 参照（toggle-cdn local）が残っていないか
 *
 *   node scripts/check-links.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const EXPECTED_SDK_VERSION = 'v0.2.0';
const errors = [];

/** 同梱の第三者ライブラリ（互換 API の検出対象外） */
const THIRD_PARTY = /(^|\/)(p5(\.[\w]+)*\.js|chart(\.min)?\.js|gauge\.min\.js|bluejelly\.js|toxiclibs(\.min)?\.js|[\w.-]+\.min\.js)$/;

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'vendor', 'scripts', '_merge-src'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

const LEGACY = /<script\b[^>]*\bsrc\s*=\s*"[^"]*(ORPHE-CORE\.js|ORPHE-INSOLE\.js|CoreToolkit\.js|InsoleToolkit\.js|BleSharedBridge\.js|CoreCompanionToolkit\.js|Insole(Utils|Fifo|Gait|Simulator)\.js|float16\.min\.js|quaternion\.js)/;

/** 互換 API の使用（コメントを除いてから 1 行ずつ判定する） */
const LEGACY_API = [
  [/\bnew\s+(Orphe|OrpheInsole|OrpheInsoleFifo|OrpheInsoleGait|OrpheInsoleSimulator)\s*\(/, '互換クラスの生成'],
  [/\.(got[A-Z]\w*|lostData)\s*=(?!=)/, 'got* / lostData への代入（on() を使う）'],
  [/\b(bles|cores|insoles|orpheCore|ble|core|insole|device)(\[[^\]]+\])?\.onConnectGATT\s*=(?!=)/, 'onConnectGATT への代入（onEvent("onConnect") を使う）'],
  [/\b(bles|cores|insoles|orpheCore)(\[[^\]]+\])?\.on(Connect|Disconnect|Error|Scan|StartNotify|StopNotify|Write|Reconnect\w*|Clear|Reset)\s*=(?!=)/, 'ライフサイクルコールバックへの代入（onEvent() を使う）'],
  [/\b(bles|cores|insoles|orpheCore)(\[[^\]]+\])?\.setup\(/, 'setup() の呼び出し（新 API では不要）'],
  [/\.(getDeviceInformation|setDeviceInformation|resetMotionSensorAttitude|forgetLastBluetoothDevice|getFirmwareVersion|addSensorDataListener|syncCoreTime|getDateTime)\s*\(/, '互換メソッドの呼び出し'],
  [/\.(notification_type|isBridgeSecondary|bluetoothDevice)\b/, '互換プロパティの参照'],
  [/(?<![\w.$])(OrpheInsoleUtils|ORPHE_INSOLE_STREAMING_MODES)\s*\./, '互換グローバルの参照（OrpheCoreInsoleJS から取り出す）'],
];

/** ブロックコメントと行コメントを除く（文字列中の // は URL などで残す） */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

function checkLegacyApi(rel, code, baseLine = 1) {
  stripComments(code).split('\n').forEach((line, i) => {
    for (const [re, label] of LEGACY_API) {
      if (re.test(line)) errors.push(`${rel}:${baseLine + i}: ${label}: ${line.trim().slice(0, 100)}`);
    }
  });
}

for (const file of walk(ROOT, '.html')) {
  const rel = relative(ROOT, file);
  const raw = readFileSync(file, 'utf8');
  const html = raw.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
    errors.push(`${rel}: <meta name="robots" content="noindex"> が無い`);
  }
  if (LEGACY.test(html)) errors.push(`${rel}: 旧ライブラリの <script> が残っている`);
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)) {
    const url = m[1];
    const cdn = url.match(/ORPHE-CORE-INSOLE\.js@([^/]+)\//);
    if (cdn && cdn[1] !== EXPECTED_SDK_VERSION) errors.push(`${rel}: SDK の CDN 版が ${cdn[1]}（期待値 ${EXPECTED_SDK_VERSION}）`);
    if (/(^|\/)vendor\/orphe-core-insole/.test(url)) errors.push(`${rel}: vendor/ を参照している（node scripts/toggle-cdn.mjs cdn で戻す）`);
    if (/^(?:[a-z]+:|\/\/|#|\$\{|data:|javascript:|mailto:)/i.test(url) || url.includes('${')) continue;
    if (url.startsWith('../../')) errors.push(`${rel}: リポジトリ外を指す参照 ${url}`);
    const path = decodeURIComponent(url.split(/[?#]/)[0]);
    if (path === '') continue;
    const target = join(dirname(file), path);
    if (!existsSync(target)) errors.push(`${rel}: 見つからない ${url}`);
  }
  // inline script（src の無い <script>）。<pre> / <code> の説明用断片は対象外
  for (const m of raw.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const line = raw.slice(0, m.index).split('\n').length;
    checkLegacyApi(rel, m[1], line);
  }
}

for (const file of walk(ROOT, '.js')) {
  const rel = relative(ROOT, file);
  if (THIRD_PARTY.test(rel)) continue;
  checkLegacyApi(rel, readFileSync(file, 'utf8'));
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
