// sensor-settings.js — 設定ドロワーの「加速」「ジャンプ」の感度
//
// - 感度は 5 段階のボタンでも、スライダーでも決められる（うどんふみふみの「ふみ心地」と同じ考え方）
// - ジャンプの角度は度（°）で表示する。ゲームの中（window.pitchThresholdJump）はラジアンのまま
// - 決めた値はこのブラウザに保存する（ページを開き直しても、接続ハブでゲームを切り替えても同じ）
//
// ここが決めるのは次の 4 つだけ。読むのは index.html のセンサーのスクリプト・main.js・insole.js・ui.js
//   window.accThresholdAccel  加速のしきい値 [G]（加速度の大きさ。止まっていても重力で 1.0 G）
//   window.pitchThresholdJump つま先を上げる角度のしきい値 [rad]
//   window.jumpCooldownMs     ジャンプのあと、次のジャンプを受け付けるまでの間隔 [ms]
//   window.jumpFoot           SOLO でジャンプに使う足: 'any' | 'left'（CORE 01） | 'right'（CORE 02）
//
// main.js（モジュール）より先に読み込むこと。main.js は値が無いときだけ既定値を入れる。
(function () {
  'use strict';

  var KEY = 'superhurdle.sensor';
  var DEG = 180 / Math.PI;
  // 既定値。ジャンプの 9° はこれまでの 0.15 rad（8.6°）にいちばん近い 1° 刻みの値
  var DEFAULTS = { accG: 1.1, jumpDeg: 9, cooldownMs: 700, foot: 'any' };
  // 左ほど強く動かす必要があり、右ほど小さな動きで反応する（うどんふみふみと同じ並び）
  var ACCEL_LEVELS = [
    { id: 1, label: 'しっかり', hint: '元気に足踏みする人向け', value: 1.8 },
    { id: 2, label: 'やや強め', hint: '立って足踏み', value: 1.4 },
    { id: 3, label: '標準', hint: 'これまでの設定', value: 1.1 },
    { id: 4, label: 'やさしい', hint: 'ゆっくり足踏み', value: 1.06 },
    { id: 5, label: 'とてもやさしい', hint: 'いすに座って足踏み（止まっていても反応しやすい）', value: 1.04 }
  ];
  var JUMP_LEVELS = [
    { id: 1, label: 'しっかり', hint: 'つま先を大きく上げたときだけ跳ぶ', value: 18 },
    { id: 2, label: 'やや大きく', hint: '足踏みで誤って跳びにくい', value: 13 },
    { id: 3, label: '標準', hint: 'これまでの設定', value: 9 },
    { id: 4, label: 'やさしい', hint: 'つま先を少し上げるだけで跳ぶ', value: 6 },
    { id: 5, label: 'とてもやさしい', hint: 'いすに座って（足踏みでも跳びやすい）', value: 4 }
  ];

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    return {
      accG: isFinite(s.accG) ? clamp(+s.accG, 1.02, 3) : DEFAULTS.accG,
      jumpDeg: isFinite(s.jumpDeg) ? clamp(Math.round(+s.jumpDeg), 2, 30) : DEFAULTS.jumpDeg,
      cooldownMs: isFinite(s.cooldownMs) ? clamp(Math.round(+s.cooldownMs), 300, 1500) : DEFAULTS.cooldownMs,
      foot: s.foot === 'left' || s.foot === 'right' ? s.foot : 'any'
    };
  }
  var cur = load();
  function apply() {
    window.accThresholdAccel = cur.accG;
    window.pitchThresholdJump = cur.jumpDeg / DEG;
    window.jumpCooldownMs = cur.cooldownMs;
    window.jumpFoot = cur.foot;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* storage unavailable */ }
  }
  apply();   // main.js より先に値を入れておく

  // ---------------------------------------------------------------- drawer UI
  function $(id) { return document.getElementById(id); }
  var near = function (a, b) { return Math.abs(a - b) < 1e-6; };
  var fmtG = function (g) { return g.toFixed(2) + ' G'; };
  var fmtDeg = function (d) { return Math.round(d) + '°'; };

  function levelButtons(el, levels, value, unit) {
    el.innerHTML = levels.map(function (lv) {
      var on = near(lv.value, value);
      return '<button type="button" role="radio" aria-checked="' + on + '" class="sens-level' + (on ? ' is-on' : '') + '" data-value="' + lv.value + '" title="' + lv.hint + '">' +
        '<i style="height:' + (0.35 + (6 - lv.id) * 0.25).toFixed(2) + 'em"></i><b>' + lv.label + '</b><small>' + unit(lv.value) + '</small></button>';
    }).join('');
  }
  function levelHint(el, levels, value, unit) {
    var lv = levels.filter(function (l) { return near(l.value, value); })[0];
    el.innerHTML = lv ? '<b>' + lv.label + '</b> ' + lv.hint + '（' + unit(value) + '）' : '<b>カスタム</b> スライダーで決めた値（' + unit(value) + '）';
  }

  function render() {
    levelButtons($('accel-levels'), ACCEL_LEVELS, cur.accG, fmtG);
    levelHint($('accel-level-hint'), ACCEL_LEVELS, cur.accG, fmtG);
    levelButtons($('jump-levels'), JUMP_LEVELS, cur.jumpDeg, fmtDeg);
    levelHint($('jump-level-hint'), JUMP_LEVELS, cur.jumpDeg, fmtDeg);
    $('accelThreshold').value = cur.accG;
    $('accelThresholdValue').textContent = fmtG(cur.accG);
    $('jumpPitchThreshold').value = cur.jumpDeg;
    $('jumpPitchThresholdValue').textContent = fmtDeg(cur.jumpDeg);
    $('jumpCooldown').value = (cur.cooldownMs / 1000).toFixed(2);
    $('jumpCooldownValue').textContent = (cur.cooldownMs / 1000).toFixed(2) + ' 秒';
    $('jumpFoot').value = cur.foot;
    // 操作説明の数値
    $('help-accel').textContent = '足踏み（加速度 > ' + fmtG(cur.accG) + '） → 前進加速';
    $('help-jump').textContent = 'つま先を ' + fmtDeg(cur.jumpDeg) + ' 以上上げる → ジャンプ';
    $('help-accel-en').textContent = 'Stamp feet (Accel > ' + fmtG(cur.accG) + ') → Accelerate forward';
    $('help-jump-en').textContent = 'Lift toes ' + fmtDeg(cur.jumpDeg) + ' or more → Jump';
    if (typeof window.updateThresholdVisuals === 'function') window.updateThresholdVisuals();
  }
  function set(patch) {
    for (var k in patch) cur[k] = patch[k];
    apply(); save(); render();
  }

  /** つま先の角度の基準（0°）。カウントダウン中と練習中に、足を 1.5 秒じっとさせると決まる（main.js） */
  function renderZero() {
    var z = window.hurdleZeroView, el = $('jump-zero-note');
    if (!el) return;
    var txt = function (r) { var d = Math.round((r || 0) * DEG); return (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) + '°'; };
    el.innerHTML = 'つま先の角度の基準（0°）：左 <b>' + txt(z && z[0]) + '</b> ／ 右 <b>' + txt(z && z[1]) + '</b>（センサーのもとの角度からのずれ）。' +
      'ジャンプ補助が ON のとき、練習中やカウントダウン中に足を 1.5 秒じっとさせると、その角度を 0° に合わせます。';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!$('accel-levels')) return;
    $('accel-levels').addEventListener('click', function (e) {
      var b = e.target.closest('.sens-level');
      if (b) set({ accG: +b.getAttribute('data-value') });
    });
    $('jump-levels').addEventListener('click', function (e) {
      var b = e.target.closest('.sens-level');
      if (b) set({ jumpDeg: +b.getAttribute('data-value') });
    });
    $('accelThreshold').addEventListener('input', function (e) { set({ accG: clamp(+e.target.value, 1.02, 3) }); });
    $('jumpPitchThreshold').addEventListener('input', function (e) { set({ jumpDeg: clamp(Math.round(+e.target.value), 2, 30) }); });
    $('jumpCooldown').addEventListener('input', function (e) { set({ cooldownMs: clamp(Math.round(+e.target.value * 1000), 300, 1500) }); });
    $('jumpFoot').addEventListener('change', function (e) { set({ foot: e.target.value }); });
    $('sens-reset').addEventListener('click', function () {
      cur = { accG: DEFAULTS.accG, jumpDeg: DEFAULTS.jumpDeg, cooldownMs: DEFAULTS.cooldownMs, foot: DEFAULTS.foot };
      apply(); save(); render();
    });
    render();
    renderZero();
    setInterval(renderZero, 500);
  });

  window.hurdleSensorSettings = { DEFAULTS: DEFAULTS, ACCEL_LEVELS: ACCEL_LEVELS, JUMP_LEVELS: JUMP_LEVELS, get: function () { return { accG: cur.accG, jumpDeg: cur.jumpDeg, cooldownMs: cur.cooldownMs, foot: cur.foot }; } };
})();
