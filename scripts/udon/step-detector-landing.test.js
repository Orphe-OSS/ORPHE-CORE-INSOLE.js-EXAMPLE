// 「下げた足が止まった瞬間だけ数える」検出を、物理的につじつまの合う合成波形で確かめる
// （上げる → 上で止まる → 下ろす → 着地。上下の速さの合計は 0 に戻る）
const assert = require('node:assert/strict');
const Det = require(require('node:path').join(__dirname, '../../UDON/step-detector.js'));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r()); }
const hs = (t, t0, w, a) => (t >= t0 && t <= t0 + w) ? a * Math.sin(Math.PI * (t - t0) / w) : 0;
// 1 歩: impact = 着地の山 [G]。hold = 上で止まっている時間。soft = 着地を鋭い山でなく、上げるときと同じゆるい山にする
function stepUp(t, s) {
  const W = s.w || 120, Wi = s.soft ? W : (s.wi || 30), A = s.impact * Wi / W, hold = s.hold || 0;
  return hs(t, s.t, W, A) + hs(t, s.t + W, W, -A) + hs(t, s.t + 2 * W + hold, W, -A) + hs(t, s.t + 3 * W + hold, Wi, s.impact);
}
const landT = s => s.t + 3 * (s.w || 120) + (s.hold || 0);
function signal({ durationMs, fs, gravity = [0, 0, 1], noise = 0.01, steps = [], seed = 1 }) {
  const rand = rng(seed), n = Math.floor(durationMs * fs / 1000), gn = Math.hypot(...gravity), g = gravity.map(v => v / gn), out = [];
  for (let i = 0; i < n; i++) {
    const t = i * 1000 / fs; let up = 0;
    for (const s of steps) up += stepUp(t, s);
    out.push({ t, x: g[0] * (1 + up) + gauss(rand) * noise, y: g[1] * (1 + up) + gauss(rand) * noise, z: g[2] * (1 + up) + gauss(rand) * noise });
  }
  return out;
}
function run(det, foot, sig, { packet = 1, ts = false } = {}) {
  const found = [];
  for (let i = 0; i < sig.length; i++) {
    const s = sig[i], arrive = sig[Math.min(sig.length - 1, (Math.floor(i / packet) + 1) * packet - 1)].t;
    const st = det.push(foot, s.x, s.y, s.z, arrive, ts ? 5000000 + s.t : undefined);
    if (st) found.push(st);
  }
  return found;
}
const train = (n, ivl, impact, extra = {}) => Array.from({ length: n }, (_, i) => Object.assign({ t: 1000 + i * ivl, impact }, extra));
function onLanding(found, steps, tolMs, label) {
  assert.equal(found.length, steps.length, label + ': count');
  found.forEach((f, i) => { const d = f.t - landT(steps[i]); assert.ok(d >= -5 && d <= tolMs, `${label}: step ${i} is counted at the landing (${d.toFixed(0)} ms after it starts)`); });
}
let n = 0; const ok = name => { n++; console.log('ok', n, name); };

{ // 1) しっかりふむ: 上げる山では数えず、着地で数える（200Hz・センサー時刻あり・4 サンプルずつ届く）
  const det = new Det(); det.setLevel(2);
  const steps = train(20, 800, 6);
  onLanding(run(det, 0, signal({ durationMs: 18000, fs: 200, steps }), { packet: 4, ts: true }), steps, 40, 'firm 200Hz');
  ok('firm stomps are counted once each, at the landing');
}
{ // 2) 50Hz・センサー時刻なし（CORE 2.0 相当）
  const det = new Det(); det.setLevel(2);
  const steps = train(20, 800, 4, { wi: 60 });
  onLanding(run(det, 0, signal({ durationMs: 18000, fs: 50, steps })), steps, 80, '50Hz');
  ok('50 Hz without sensor timestamps');
}
{ // 3) 取り付け向きがちがっても同じ
  const det = new Det(); det.setLevel(2);
  const steps = train(15, 700, 5);
  onLanding(run(det, 1, signal({ durationMs: 13000, fs: 200, gravity: [0.5, -0.6, 0.62], steps }), { packet: 4, ts: true }), steps, 40, 'tilted');
  ok('any mounting orientation');
}
{ // 4) 足を上げて、上で止めてから下ろす: 上で止まったときには数えず、着地で 1 回
  const det = new Det(); det.setLevel(2);
  const steps = train(10, 1500, 5, { hold: 500 });
  onLanding(run(det, 0, signal({ durationMs: 17000, fs: 200, steps }), { packet: 4, ts: true }), steps, 40, 'hold');
  ok('a foot held in the air is not a step; the landing is');
}
{ // 5) 弱い足踏みは、感度を上げれば着地で数えられる。低い感度では数えない
  const steps = train(15, 900, 0.5);
  for (const lv of [1, 2]) { const d = new Det(); d.setLevel(lv); assert.equal(run(d, 0, signal({ durationMs: 15000, fs: 200, steps }), { packet: 4, ts: true }).length, 0, 'weak steps are not counted at level ' + lv); }
  for (const lv of [4, 5]) { const d = new Det(); d.setLevel(lv); onLanding(run(d, 0, signal({ durationMs: 15000, fs: 200, noise: 0.004, steps }), { packet: 4, ts: true }), steps, 60, 'weak L' + lv); }
  ok('weak steps: counted at soft levels only');
}
{ // 6) そっと下ろす（鋭い衝撃がない）: 止まったところで 1 回
  const det = new Det(); det.setLevel(2);
  const steps = train(10, 1200, 0.9, { soft: true });
  const found = run(det, 0, signal({ durationMs: 14000, fs: 200, steps }), { packet: 4, ts: true });
  assert.equal(found.length, steps.length, 'soft landings are counted once each');
  found.forEach((f, i) => { const d = f.t - landT(steps[i]); assert.ok(d >= 0 && d <= 260, 'soft landing is counted when the foot stops (' + d.toFixed(0) + ' ms)'); });
  ok('a soft landing is counted when the foot comes to rest');
}
{ // 7) じっとしている・ノイズだけでは数えない
  for (const lv of [1, 2, 3, 4, 5]) { const d = new Det(); d.setLevel(lv); assert.equal(run(d, 0, signal({ durationMs: 10000, fs: 200, noise: 0.008 }), { packet: 4, ts: true }).length, 0, 'noise at level ' + lv); }
  ok('noise is never a step');
}
{ // 8) 速い足踏み（1 歩 0.4 秒）
  const det = new Det(); det.setLevel(2);
  const steps = train(25, 400, 6, { w: 80 });
  onLanding(run(det, 0, signal({ durationMs: 12000, fs: 200, steps }), { packet: 4, ts: true }), steps, 40, 'fast');
  ok('fast stepping');
}
{ // 9) landingOnly: false なら、上げる山も数える（これまでの動き）
  const det = new Det({ landingOnly: false }); det.setLevel(2);
  const found = run(det, 0, signal({ durationMs: 10000, fs: 200, steps: train(8, 1000, 6) }), { packet: 4, ts: true });
  assert.ok(found.length >= 8, 'legacy mode still counts');
  ok('landingOnly:false keeps the old behaviour');
}
console.log('all', n, 'passed');
