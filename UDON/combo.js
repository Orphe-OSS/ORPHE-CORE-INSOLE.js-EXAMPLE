/**
 * リズムのコンボ（UdonCombo）
 *
 * おなじ間隔でふみつづけると「コンボ」になり、1 ふみで進む量（もちもち度）が増えます。
 * 速さは問いません。そろっていることだけを見ます。純ロジックなので Node でテストできます
 * （tests/udon-combo.test.js）。
 *
 *   - 「おなじリズム」＝ ふむ間隔が、いつもの間隔（直近 4 回の中央値）の ±25% 以内
 *   - 左右で間隔がちがう人（タン・タ、タン・タ）は、ひとつ前の同じ側の間隔とそろっていればよい
 *   - または、同じ足どうしの間隔（ひとまたぎ。右→右、左→左）が、いつものひとまたぎ（直近 4 回の中央値）の
 *     ±25% 以内で、反対の足の 1 歩がひとまたぎの中のいつもの位置（±0.15）に入っていればよい。
 *     2 台の CORE は時計も BLE の届き方も足ごとにちがい、左右の「ふみ」の間隔にはそのずれが入るが、
 *     同じ足どうしの間隔にはほとんど入らない。反対の足の 1 歩が通信で欠けても切れない
 *   - 1 回ずれただけなら 1 段階さがるだけ。2 秒以上あいたら（または ひとやすみ明けは）最初から
 */
(function (root) {
  'use strict';

  var LEVELS = [
    { at: 3, mult: 1.5, call: 'いいリズム！ ×1.5' },
    { at: 7, mult: 2, call: 'のってきた！ ×2' },
    { at: 14, mult: 3, call: '職人のリズム！ ×3' }
  ];
  var TOLERANCE = 0.25;
  var MAX_GAP_MS = 2000;
  var WINDOW = 4;
  var PHASE_TOLERANCE = 0.15;   // ひとまたぎの中で、反対の足の 1 歩が入る位置（0〜1）のずれの許容

  /** つづいた回数 → コンボの段階（0 = なし、1〜3） */
  function level(streak) {
    var lv = 0;
    for (var i = 0; i < LEVELS.length; i++) if (streak >= LEVELS[i].at) lv = i + 1;
    return lv;
  }

  /** つづいた回数 → 1 ふみで進む量の倍率 */
  function mult(streak) {
    var lv = level(streak);
    return lv ? LEVELS[lv - 1].mult : 1;
  }

  function near(x, y) {
    return y > 0 && Math.abs(x - y) <= y * TOLERANCE;
  }

  /**
   * steps[i] のひとまたぎ（同じ足のひとつ前のふみからの間隔）。足が分からない・ひとやすみや
   * 長い間（MAX_GAP_MS 以上）をまたぐときは null
   */
  function strideAt(steps, i) {
    var f = steps[i].foot;
    if (f !== 0 && f !== 1) return null;
    for (var j = i - 1; j >= 0; j--) {
      if (steps[j + 1].rest || steps[j + 1].t - steps[j].t >= MAX_GAP_MS) return null;
      if (steps[j].foot === f) return steps[i].t - steps[j].t;
    }
    return null;
  }

  /** 最新のふみのひとまたぎが、いつものひとまたぎ（その前の直近 WINDOW 回の中央値）とそろっているか */
  function strideKept(steps) {
    var n = steps.length;
    var a = strideAt(steps, n - 1);
    if (a === null) return false;
    var prev = [];
    for (var j = n - 2; j >= 1 && prev.length < WINDOW; j--) {
      if (steps[j + 1].rest || steps[j + 1].t - steps[j].t >= MAX_GAP_MS) break;
      var d = strideAt(steps, j);
      if (d !== null) prev.push(d);
    }
    if (prev.length < 2) return false;
    prev.sort(function (x, y) { return x - y; });
    if (!near(a, (prev[(prev.length - 1) >> 1] + prev[prev.length >> 1]) / 2)) return false;
    // 反対の足の 1 歩が、ひとまたぎの中のいつもの位置に入っているか（ばらばらにふんだときは入らない）
    var p1 = phaseAt(steps, n - 1);
    if (p1 === null) return true;   // 反対の足の 1 歩が（通信などで）なかった
    for (var k = n - 2; k >= 1; k--) {
      if (steps[k + 1].rest || steps[k + 1].t - steps[k].t >= MAX_GAP_MS) break;
      if (steps[k].foot !== steps[n - 1].foot) continue;
      var p0 = phaseAt(steps, k);
      return p0 === null || Math.abs(p1 - p0) <= PHASE_TOLERANCE;
    }
    return true;
  }

  /** steps[i] のひとまたぎのうち、ひとつ前（反対の足）のふみから steps[i] までの割合。反対の足がなければ null */
  function phaseAt(steps, i) {
    var d = strideAt(steps, i);
    if (d === null || d <= 0 || steps[i - 1].foot === steps[i].foot) return null;
    return (steps[i].t - steps[i - 1].t) / d;
  }

  /**
   * 最新の 1 ふみを受けて、コンボがどうなるかを返す。
   * @param {Array<{t:number, rest?:boolean}>} steps これまでのふみ（最後が最新。t はミリ秒）
   * @param {number} streak 直前までにつづいていた回数
   * @returns {{ streak:number, broke:boolean }} broke = コンボがさがった／切れた
   */
  function advance(steps, streak) {
    var n = steps.length;
    if (n < 3) return { streak: 0, broke: false };
    var last = steps[n - 1];
    var a = last.t - steps[n - 2].t;
    // いつもの間隔: 直近 4 回ぶん（ひとやすみや長い間をまたがない）
    var prev = [];
    for (var j = n - 2; j >= 1 && prev.length < WINDOW; j--) {
      var gap = steps[j].t - steps[j - 1].t;
      if (steps[j].rest || gap >= MAX_GAP_MS) break;
      prev.push(gap);
    }
    var had = level(streak) > 0;
    if (last.rest || a >= MAX_GAP_MS || !prev.length) return { streak: 0, broke: had };

    var sorted = prev.slice().sort(function (x, y) { return x - y; });
    var ref = (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2;
    if (near(a, ref) || (prev.length >= 2 && near(a, prev[1])) || strideKept(steps)) return { streak: streak + 1, broke: false };

    // 1 回ずれた: 1 段階さがる
    var lv = level(streak);
    return { streak: lv > 1 ? LEVELS[lv - 2].at : 0, broke: had };
  }

  var UdonCombo = {
    LEVELS: LEVELS,
    TOLERANCE: TOLERANCE,
    MAX_GAP_MS: MAX_GAP_MS,
    FULL: LEVELS[LEVELS.length - 1].at,
    level: level,
    mult: mult,
    strideAt: strideAt,
    advance: advance
  };

  root.UdonCombo = UdonCombo;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonCombo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
