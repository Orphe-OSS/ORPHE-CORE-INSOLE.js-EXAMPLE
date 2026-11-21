// assets/js/home-button.js — 各 example の左上に「一覧へ戻る」ボタンを出し、接続ハブ（HUB/）の接続を引き継ぐ
//
// 読み込み方（各 example の index.html、</body> の直前）:
//   <script src="../assets/js/home-button.js"></script>
//
// - ボタンは左上に小さく出る。押すと一覧（../）へ。接続ハブの中で開いているときは、ハブのメニューへ戻る
//   （ページを移っても ORPHE CORE の接続はハブが持ち続ける）
// - 別のタブ（またはハブ）が同じスロットの ORPHE CORE をつないでいれば、そのページの CORE の接続スイッチを
//   自動で入れる。SDK のタブ間共有（BleSharedBridge）でデータを受け取るので、デバイスの選択画面は出ない
// - 置き場所はいつも左上（画面に固定）。ページの左上にロゴなどの帯があるときは、その先頭に
//   <span data-home-slot></span> を置くと、ボタンがそこに並ぶ（ロゴに重ならない）
//   別の隅にしたいとき／出さないとき: <body data-home-button="bottom-left|top-right|bottom-right"> / <body data-home-button="off">
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
    var slot = document.querySelector('[data-home-slot]');
    if (slot) {
      // ページの帯（ヘッダー）の先頭に並べる
      a.style.position = 'static';
      a.style.display = 'inline-flex';
      a.style.alignItems = 'center';
      a.style.marginRight = '10px';
      a.style.flex = '0 0 auto';
      slot.appendChild(a);
      return;
    }
    document.body.appendChild(a);
    place(a, /^(top|bottom)-(left|right)$/.test(mode || '') ? mode : 'top-left');
  }

  function place(a, corner) {
    var v = corner.split('-');
    a.style.top = v[0] === 'top' ? '8px' : 'auto';
    a.style.bottom = v[0] === 'bottom' ? '8px' : 'auto';
    a.style.left = v[1] === 'left' ? '8px' : 'auto';
    a.style.right = v[1] === 'right' ? '8px' : 'auto';
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
