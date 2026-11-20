// assets/js/home-button.js — 各 example の左上に「一覧へ戻る」ボタンを出し、接続ハブ（HUB/）の接続を引き継ぐ
//
// 読み込み方（各 example の index.html、</body> の直前）:
//   <script src="../assets/js/home-button.js"></script>
//
// - ボタンは左上に小さく出る。押すと一覧（../）へ。接続ハブの中で開いているときは、ハブのメニューへ戻る
//   （ページを移っても ORPHE CORE の接続はハブが持ち続ける）
// - 別のタブ（またはハブ）が同じスロットの ORPHE CORE をつないでいれば、そのページの CORE の接続スイッチを
//   自動で入れる。SDK のタブ間共有（BleSharedBridge）でデータを受け取るので、デバイスの選択画面は出ない
// - 置き場所は左上。左上にロゴや文字・ボタンがあれば、空いている隅（左下 → 右上 → 右下）へ移す
//   固定したいとき／出さないとき: <body data-home-button="top-left|bottom-left|top-right|bottom-right"> / <body data-home-button="off">
(function () {
  'use strict';
  if (window.__orpheHomeButton) return;
  window.__orpheHomeButton = true;

  function hub() {
    try {
      if (window.parent !== window && window.parent.__orpheHub && window.parent.location.origin === window.location.origin) return window.parent.__orpheHub;
    } catch (e) { /* cross-origin parent */ }
    return null;
  }

  function addButton() {
    var mode = document.body && document.body.getAttribute('data-home-button');
    if (mode === 'off' || document.getElementById('orphe-home-button')) return;
    var inHub = !!hub();
    var a = document.createElement('a');
    a.id = 'orphe-home-button';
    a.href = '../';
    a.textContent = inHub ? '◀ メニュー' : '◀ 一覧';
    a.title = inHub ? '接続ハブのメニューへ戻る（接続はそのまま）' : 'example の一覧へ戻る';
    a.setAttribute('aria-label', a.title);
    a.style.cssText = [
      'position:fixed', 'top:8px', 'left:8px', 'z-index:2147483000',
      'padding:4px 10px', 'border-radius:999px', 'font:600 12px/1.4 system-ui,-apple-system,"Hiragino Sans",sans-serif',
      'color:#fff', 'background:rgba(15,20,40,.72)', 'border:1px solid rgba(255,255,255,.35)', 'text-decoration:none',
      'opacity:.8', 'backdrop-filter:blur(4px)', '-webkit-backdrop-filter:blur(4px)', 'cursor:pointer', 'user-select:none', 'white-space:nowrap',
    ].join(';');
    a.addEventListener('mouseenter', function () { a.style.opacity = '1'; });
    a.addEventListener('mouseleave', function () { a.style.opacity = '.8'; });
    a.addEventListener('click', function (e) {
      var h = hub();
      if (h) { e.preventDefault(); h.showMenu(); }
    });
    // keep the games' keyboard handlers from reacting to a click on the button
    a.addEventListener('keydown', function (e) { e.stopPropagation(); });
    document.body.appendChild(a);
    var fixed = /^(top|bottom)-(left|right)$/.test(mode || '') ? mode : null;
    place(a, fixed || 'top-left');
    // ページの UI ができあがってから（タイトル画面など）、左上がふさがっていれば空いている隅へ移す
    if (!fixed) setTimeout(function () { place(a, freeCorner(a)); }, 1200);
  }

  function place(a, corner) {
    var v = corner.split('-');
    a.style.top = v[0] === 'top' ? '8px' : 'auto';
    a.style.bottom = v[0] === 'bottom' ? '8px' : 'auto';
    a.style.left = v[1] === 'left' ? '8px' : 'auto';
    a.style.right = v[1] === 'right' ? '8px' : 'auto';
  }
  // 隅に文字・画像・ボタンなど「見えている中身」があるか。背景（canvas・大きな入れ物）は空きとみなす
  var CONTENT = /^(IMG|SVG|BUTTON|A|INPUT|LABEL|SELECT|TEXTAREA|VIDEO|svg|path|use|text)$/;
  function occupied(a, rect) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var pts = [[0.05, 0.1], [0.05, 0.9], [0.5, 0.5], [0.98, 0.1], [0.98, 0.5], [0.98, 0.9], [0.5, 0.05], [0.5, 0.95]];
    for (var i = 0; i < pts.length; i++) {
      var x = rect.left + rect.width * pts[i][0], y = rect.top + rect.height * pts[i][1];
      var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
      for (var j = 0; j < list.length; j++) {
        var el = list[j];
        if (el === a || a.contains(el) || el === document.body || el === document.documentElement) continue;
        if (el.closest && el.closest('#devtest')) continue;
        var tag = el.tagName;
        if (tag === 'CANVAS' || tag === 'IFRAME') break;     // 絵の上は置いてよい
        var r = el.getBoundingClientRect();
        if (r.width * r.height > vw * vh * 0.4) continue;    // 画面の大部分をおおう入れ物は背景
        if (CONTENT.test(tag)) return true;
        for (var k = 0; k < el.childNodes.length; k++) {
          var n = el.childNodes[k];
          if (n.nodeType === 3 && n.nodeValue.trim()) return true;   // 文字がある
        }
      }
    }
    return false;
  }
  function freeCorner(a) {
    var corners = ['top-left', 'bottom-left', 'top-right', 'bottom-right'];
    var w = a.offsetWidth || 72, h = a.offsetHeight || 26, vw = window.innerWidth, vh = window.innerHeight;
    var prevVisibility = a.style.visibility;
    a.style.visibility = 'hidden';
    try {
      for (var i = 0; i < corners.length; i++) {
        var v = corners[i].split('-');
        var rect = { left: v[1] === 'left' ? 8 : vw - 8 - w, top: v[0] === 'top' ? 8 : vh - 8 - h, width: w, height: h };
        if (!occupied(a, rect)) return corners[i];
      }
    } finally { a.style.visibility = prevVisibility; }
    return 'top-left';
  }

  // --- 接続の引き継ぎ（別タブ / ハブの ORPHE CORE を共有する）
  function remotePrimary(slot) {
    var SDK = window.OrpheCoreInsoleJS;
    if (!SDK || typeof SDK.BleSharedBridge !== 'function') return false;
    try {
      var bridge = new SDK.BleSharedBridge(slot);
      var ok = bridge.isRemotePrimaryAvailable();
      if (typeof bridge.release === 'function') bridge.release();
      return ok;
    } catch (e) { return false; }
  }
  var joined = {};
  function autoJoin() {
    var done = true;
    [0, 1].forEach(function (slot) {
      if (joined[slot]) return;
      var sw = document.getElementById('switch_ble' + slot);
      // CORE の接続 UI（buildCoreToolkit）のスイッチだけ。INSOLE の接続 UI は同じ id でもタブ間共有をしない
      if (!sw || !sw.closest('#core_toolkit' + slot)) { done = false; return; }
      if (sw.checked) { joined[slot] = true; return; }
      if (sw.disabled) { done = false; return; }
      if (!remotePrimary(slot)) return;
      joined[slot] = true;
      sw.click();   // toolkit の通常の接続処理。begin() が別タブの接続を見つけて Secondary として受信する
    });
    return done;
  }

  function start() {
    addButton();
    // toolkit を作るタイミングはページごとに違う（読み込み直後 / モジュールの boot() の中）。少しの間だけ見張る
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (autoJoin() || tries > 40) clearInterval(timer);
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
