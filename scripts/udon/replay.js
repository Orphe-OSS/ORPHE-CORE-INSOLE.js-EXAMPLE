// うどんふみふみの生データ CSV（画面の ● で記録）を step-detector.js に流し直して採点する。
//   node scripts/udon/replay.js 記録.csv [記録.csv …]     THR=0.6 でしきい値を上書き、NO_GYRO=1 でジャイロなし
// 真値は、記録からあとで拾った着地の衝撃（足ごとに、前後 0.22 秒でいちばん大きい山）。
// 列: truth(L/R)=着地の数、det=数えたふみ、rec=記録したときにゲームが数えたふみ、miss / extra=数え落とし／数えすぎ、
//     onTime=着地から ±40 ms 以内、off=数えた時刻 − 着地 [ms]、maxCombo=コンボの模擬（combo.js）
const fs = require('fs'), path = require('path');
const REPO = process.env.UDON_DIR || path.join(__dirname, '../../UDON');
function fresh(name) { const p = path.join(REPO, name); delete require.cache[require.resolve(p)]; return require(p); }

function load(file) {
  const meta = {}, rows = [];
  let cols = null;
  for (const line of fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line) continue;
    if (line[0] === '#') { const m = line.match(/^# ([^:]+): (.*)$/); if (m) meta[m[1]] = m[2]; continue; }
    const c = line.split(',');
    if (!cols) { cols = c; continue; }
    const r = {}; cols.forEach((k, i) => r[k] = c[i]);
    rows.push(r);
  }
  const m = (meta.sensitivity || '').match(/imu threshold ([\d.]+)/);
  meta.thr = m ? +m[1] : 0.6;
  return { meta, rows };
}

function replay(file, opts) {
  opts = opts || {};
  const Det = fresh('step-detector.js'), Combo = fresh('combo.js');
  const { meta, rows } = load(file);
  const det = new Det(opts.cfg || {});
  det.setThreshold(opts.thr || meta.thr);
  if (opts.cfg) for (const k in opts.cfg) det.cfg[k] = opts.cfg[k];
  const series = [[], []], steps = [], recorded = [];
  let playT0 = null, playT1 = null;
  for (const r of rows) {
    const t = +r.t_ms;
    if (r.event === 'play') playT0 = t;
    if (/^end|^phase:boil/.test(r.event || '') && playT1 === null) playT1 = t;
    if (r.foot !== 'L' && r.foot !== 'R') continue;
    const foot = r.foot === 'L' ? 0 : 1;
    if (/^step:/.test(r.event || '')) recorded.push({ foot, at: t, count: +r.count, mult: +r.mult });
    if (r.ax_g === '' || r.ax_g === undefined) continue;
    const s = r.sensor_ms === '' ? undefined : +r.sensor_ms;
    const gyro = r.gx_dps === '' ? null : { x: +r.gx_dps, y: +r.gy_dps, z: +r.gz_dps };
    if (opts.gyro && gyro && det.pushGyro) det.pushGyro(foot, gyro.x, gyro.y, gyro.z);
    const st = det.push(foot, +r.ax_g, +r.ay_g, +r.az_g, t, s);
    const f = det.feet[foot];
    series[foot].push({ fall: det._fall ? det._fall(f) : 0, upMax: f.upMax, still: f.stillMs, armed: f.armed, t: f.lastT, at: t, dyn: f.dyn, env: f.env, mag: Math.hypot(+r.ax_g, +r.ay_g, +r.az_g), g: gyro ? Math.hypot(gyro.x, gyro.y, gyro.z) : 0 });
    if (st) { st.play = r.screen === 'play'; steps.push(st); }
  }
  if (playT1 === null) playT1 = +rows[rows.length - 1].t_ms;
  return { meta, det, series, steps, recorded, playT0, playT1, Combo };
}

// 真値: 足ごとの着地の衝撃。dyn の極大のうち、まわり ±sep ms でいちばん大きく、上位の山の中央値の frac 倍以上のもの
function truth(series, t0, t1, sep, frac) {
  sep = sep || 220; frac = frac || 0.4;
  const out = [];
  for (let foot = 0; foot < 2; foot++) {
    const s = series[foot].filter(p => p.at >= t0 && p.at <= t1);
    const cand = [];
    for (let i = 0; i < s.length; i++) {
      let ok = true;
      for (let j = i - 1; j >= 0 && s[i].t - s[j].t <= sep; j--) if (s[j].dyn > s[i].dyn) { ok = false; break; }
      for (let j = i + 1; ok && j < s.length && s[j].t - s[i].t <= sep; j++) if (s[j].dyn >= s[i].dyn) { ok = false; break; }
      if (ok && s[i].dyn > 0.15) cand.push(s[i]);
    }
    const h = cand.map(c => c.dyn).sort((a, b) => b - a);
    const top = h.slice(0, Math.max(1, Math.ceil(h.length * 0.4)));
    const ref = top[top.length >> 1] || 0;
    for (const c of cand) if (c.dyn >= ref * frac) out.push({ foot, t: c.t, at: c.at, dyn: c.dyn });
  }
  return out.sort((a, b) => a.t - b.t);
}

function evaluate(file, opts) {
  const R = replay(file, opts);
  const T = truth(R.series, R.playT0, R.playT1, opts && opts.sep, opts && opts.frac);
  const steps = R.steps.filter(s => s.play);
  const used = new Set(), offs = [], lat = [];
  let miss = 0;
  for (const tr of T) {
    let best = null;
    steps.forEach((s, i) => {
      if (s.foot !== tr.foot || used.has(i)) return;
      const d = s.t - tr.t;
      if (d < -500 || d > 150) return;
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { i, d };
    });
    if (!best) { miss++; continue; }
    used.add(best.i); offs.push(best.d); lat.push(steps[best.i].at - tr.at);
  }
  const extra = steps.length - used.size;
  // コンボの模擬（game.js の judgeRhythm と同じ並べ方。時刻は着地 impactT）
  const list = []; let streak = 0, maxCombo = 0, boosted = 0, breaks = 0;
  const t0 = steps.length ? steps[0].t : 0;
  for (const s of steps.slice().sort((a, b) => a.at - b.at)) {
    const rt = (s.landingClear || s.settled ? s.impactT : s.t) - t0;
    const item = { t: rt, foot: s.foot };
    let i = list.length; while (i > 0 && list[i - 1].t > item.t) i--;
    list.splice(i, 0, item);
    if (i !== list.length - 1) continue;
    const c = R.Combo.advance(list, streak, { lossy: [false, false] });
    if (c.broke) breaks++;
    streak = c.streak; if (streak > maxCombo) maxCombo = streak;
    if (R.Combo.mult(streak) > 1) boosted++;
  }
  const q = (a, p) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))]; };
  const abs = offs.map(Math.abs);
  return { file: path.basename(file), thr: R.det.cfg.threshold, truth: T.length, tL: T.filter(x => x.foot === 0).length, tR: T.filter(x => x.foot === 1).length,
    det: steps.length, rec: R.recorded.length, miss, extra, onTime: abs.filter(x => x <= 40).length, offMed: q(offs, 0.5), offP10: q(offs, 0.1), offP90: q(offs, 0.9), latMed: q(lat, 0.5), latP90: q(lat, 0.9),
    maxCombo, boosted, breaks, R, T, steps };
}

module.exports = { load, replay, truth, evaluate };

if (require.main === module) {
  const files = process.argv.slice(2);
  const pad = (v, n) => String(v).padStart(n);
  console.log('file                                    thr  truth(L/R)  det rec miss extra onTime  off[p10 med p90]ms  lat[med p90]  maxCombo boosted breaks');
  for (const f of files) {
    const e = evaluate(f, { thr: process.env.THR ? +process.env.THR : undefined, gyro: !process.env.NO_GYRO });
    console.log(e.file.replace('fumifumi-raw-2026', '').padEnd(28), pad(e.thr.toFixed(2), 5), pad(e.truth, 4), `(${e.tL}/${e.tR})`.padEnd(8), pad(e.det, 4), pad(e.rec, 3), pad(e.miss, 4), pad(e.extra, 5), pad(e.onTime, 6), ' ', pad(Math.round(e.offP10), 5), pad(Math.round(e.offMed), 4), pad(Math.round(e.offP90), 4), '   ', pad(Math.round(e.latMed), 4), pad(Math.round(e.latP90), 4), '   ', pad(e.maxCombo, 5), pad(e.boosted, 7), pad(e.breaks, 6));
  }
}
