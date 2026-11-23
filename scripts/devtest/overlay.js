// scripts/devtest/overlay.js — 実機テストの補助パネル（scripts/devtest/serve.py が各ページに差し込む）
//
// ページのコードには手を入れず、SDK の OrpheCoreInsole.prototype.begin を包んで、ページ・toolkit・
// 独自の接続 UI（UDON の INSOLE など）が作ったすべてのデバイスを拾う。デバイスごとに
//   名前・種別・FW・接続状態・受信レート・欠損・切断と再接続・エラー
// を自動で記録し、ページごとのチェックリスト（自動判定 + 手で OK / NG を押す項目）と一緒に
// serve.py へ保存する。保存した結果は /__devtest/report.html でまとめて見られる。
(function () {
  'use strict';
  if (window.__devtest) return;
  var SDK = window.OrpheCoreInsoleJS;
  var PARTS = location.pathname.replace(/\/[^/]*\.html?$/, '').replace(/^\/+|\/+$/g, '').split('/');
  var PAGE = PARTS[PARTS.length - 1] || '(top)';
  // ORPHE-CORE.js（旧 SDK）のページ。class 宣言は window のプロパティにならないので、識別子で参照する
  /* global Orphe */
  var LegacyOrphe = typeof Orphe === 'function' ? Orphe : null;
  var LEGACY = !SDK && !!LegacyOrphe;
  var ALIAS = { 'GAME-UDON': 'UDON' };
  var STORE_KEY = 'devtest.v1.' + PAGE + (LEGACY ? '.legacy' : '');
  var t0 = Date.now();

  // ---------------------------------------------------------------- devices
  var devices = [];   // { ble, slot, kind, name, fw, fwName, state, connects, disconnects, reconnects, lost, samples, hz, history, errors, beginType, mode }
  function recordOf(ble) {
    for (var i = 0; i < devices.length; i++) if (devices[i].ble === ble) return devices[i];
    return null;
  }
  function kindOf(ble) {
    var k = ble && ble.profile && ble.profile.kind;
    if (k === 'core' || k === 'insole') return k;
    var name = ble && ble.transport && ble.transport.device && ble.transport.device.name;
    return name && /^INS/.test(name) ? 'insole' : (name ? 'core' : '?');
  }
  function track(ble, type, options) {
    var r = recordOf(ble);
    if (!r) {
      r = { ble: ble, slot: ble.id, kind: '?', name: null, fw: null, fwName: null, state: 'connecting', connects: 0, disconnects: 0,
        reconnects: 0, reconnectFailed: 0, lost: 0, lostFrames: 0, samples: 0, hz: 0, peakHz: 0, window: [], errors: [], beginType: type || null,
        packets: 0, lastSerial: null, lossHist: [], lossPct: null, lossPct10s: null,
        mode: options && (options.streamingMode || options.dataStreamingMode) || null, firstDataAt: null, lastDataAt: null };
      devices.push(r);
      ble.on('*', function (s) {
        if (!s || !(s.acc || s.converted_acc || s.press || s.quat)) return;
        var now = performance.now();
        var stamp = s.converted_acc || s.acc || s.quat || s.press;
        var serial = stamp && stamp.serial_number;
        if (typeof serial === 'number' && serial !== r.lastSerial) { r.packets++; r.lastSerial = serial; }
        r.samples++; r.window.push(now); r.lastDataAt = now;
        // data again after a disconnect = the link came back (auto-reconnect, or the page connected it again)
        if (r.awaitReconnect) { r.awaitReconnect = false; r.reconnects++; }
        if (r.firstDataAt === null) r.firstDataAt = now;
      });
      ble.on('lost_data', function (info) {
        r.lost++;
        if (info && Number.isFinite(info.serial) && Number.isFinite(info.prev)) r.lostFrames += Math.max(0, ((info.serial - info.prev + 65536) % 65536) - 1);
      });
      var ev = function (name, fn) { try { ble.onEvent(name, fn); } catch (e) { /* older SDK */ } };
      ev('onDisconnect', function () { r.disconnects++; r.state = 'disconnected'; r.awaitReconnect = true; });
      ev('onReconnectFailed', function () { r.reconnectFailed++; });
      ev('onError', function (e) { var m = e && (e.message || e.code || String(e)); if (m) { r.errors.push(String(m).slice(0, 200)); if (r.errors.length > 20) r.errors.shift(); } });
    }
    r.beginType = type || r.beginType;
    if (options && (options.streamingMode || options.dataStreamingMode)) r.mode = options.streamingMode || options.dataStreamingMode;
    return r;
  }
  function refresh(r) {
    var ble = r.ble;
    if (r.legacy) {
      if (ble.bluetoothDevice && ble.bluetoothDevice.name) r.name = ble.bluetoothDevice.name;
      r.state = ble.bluetoothDevice && ble.bluetoothDevice.gatt && ble.bluetoothDevice.gatt.connected ? 'connected' : 'disconnected';
      if (r.state === 'disconnected' && !r.awaitReconnect && r.samples > 0) { r.disconnects++; r.awaitReconnect = true; }
      return refreshRates(r);
    }
    r.kind = kindOf(ble);
    var dev = ble.transport && ble.transport.device;
    if (dev && dev.name) r.name = dev.name;
    var fw = ble.firmware;
    if (fw) {
      var d = String(fw.releaseDate);
      r.fw = d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6, 8);
      r.fwName = fw.name;
    }
    if (ble.profile && ble.profile.streaming_mode) r.mode = ble.profile.streaming_mode;
    var st = ble.connectionState;
    if (st) r.state = st;
    if (ble.sharedBridgeRole === 'secondary') r.state = 'secondary';
    refreshRates(r);
  }
  function refreshRates(r) {
    var now = performance.now();
    while (r.window.length && now - r.window[0] > 2000) r.window.shift();
    r.hz = r.window.length / 2;
    if (r.lastDataAt !== null && now - r.lastDataAt > 2000) r.hz = 0;
    if (r.hz > r.peakHz) r.peakHz = r.hz;
    // packet loss: cumulative, and over the last 10 s (snapshots once a second)
    if (r.packets + r.lostFrames > 0 && r.packets > 0) r.lossPct = Math.round(1000 * r.lostFrames / (r.packets + r.lostFrames)) / 10;
    var h = r.lossHist, last = h[h.length - 1];
    if (!last || now - last.t >= 1000) { h.push({ t: now, p: r.packets, l: r.lostFrames }); if (h.length > 11) h.shift(); }
    if (h.length >= 2) {
      var a = h[0], b = h[h.length - 1], dp = b.p - a.p, dl = b.l - a.l;
      r.lossPct10s = dp + dl > 0 ? Math.round(1000 * dl / (dp + dl)) / 10 : null;
    }
  }
  if (SDK && SDK.OrpheCoreInsole && SDK.OrpheCoreInsole.prototype && !SDK.OrpheCoreInsole.prototype.__devtestWrapped) {
    var proto = SDK.OrpheCoreInsole.prototype;
    var begin = proto.begin;
    proto.begin = function (type, options) {
      var r = track(this, type, options);
      var p = begin.apply(this, arguments);
      Promise.resolve(p).then(function () { r.connects++; refresh(r); }, function (e) {
        var m = e && (e.message || e.name);
        if (m && !/cancel|chooser/i.test(m)) { r.errors.push('begin: ' + String(m).slice(0, 200)); }
      });
      return p;
    };
    proto.__devtestWrapped = true;
  }
  // ORPHE-CORE.js（旧 SDK）: 同じ記録を取り、旧版と新版を同じ条件で比べられるようにする
  if (LEGACY && !LegacyOrphe.prototype.__devtestWrapped) {
    var op = LegacyOrphe.prototype;
    var legacyRecord = function (ble) {
      var r = recordOf(ble);
      if (!r) {
        r = { ble: ble, legacy: true, slot: ble.id, kind: 'core', name: null, fw: null, fwName: null, state: 'connected', connects: 1, disconnects: 0,
          reconnects: 0, reconnectFailed: 0, lost: 0, lostFrames: 0, samples: 0, hz: 0, peakHz: 0, window: [], errors: [], beginType: null, mode: null,
          firstDataAt: null, lastDataAt: null, packets: 0, lastSerial: null, lossHist: [], lossPct: null, lossPct10s: null };
        devices.push(r);
      }
      return r;
    };
    var onRead = op.onRead;
    op.onRead = function (data, uuid) {
      try {
        if (uuid === 'SENSOR_VALUES' && data && data.byteLength) {
          var r = legacyRecord(this), now = performance.now();
          var head = data.getUint8(0);
          var frames = head === 50 ? Math.max(1, Math.min(8, Math.floor((data.byteLength - 8 + 1) / 21))) : 1;
          for (var i = 0; i < frames; i++) r.window.push(now);
          r.samples += frames; r.lastDataAt = now; if (r.firstDataAt === null) r.firstDataAt = now;
          if (r.awaitReconnect) { r.awaitReconnect = false; r.reconnects++; }
        }
      } catch (e) { /* never break the SDK */ }
      return onRead.apply(this, arguments);
    };
    var gap = op._checkSerialGap;
    if (typeof gap === 'function') {
      op._checkSerialGap = function (current) {
        try {
          var r = legacyRecord(this);
          r.packets++;
          if (this._serialInitialized) {
            var d = (current - this.serial_number + 65536) % 65536;
            if (d !== 1) { r.lost++; r.lostFrames += Math.max(0, d - 1); }
          }
        } catch (e) { /* ignore */ }
        return gap.apply(this, arguments);
      };
    }
    op.__devtestWrapped = true;
  }

  // ---------------------------------------------------------------- page errors
  var errors = [];
  function addError(msg) {
    msg = String(msg || '').slice(0, 300);
    if (!msg || /GL Driver|ResizeObserver loop/.test(msg)) return;
    errors.push({ t: Math.round((Date.now() - t0) / 1000), msg: msg });
    if (errors.length > 50) errors.shift();
  }
  window.addEventListener('error', function (e) { addError((e.message || 'error') + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; addError('unhandled: ' + (r && (r.message || r.name) || r)); });
  var origError = console.error;
  console.error = function () {
    try { addError(Array.prototype.map.call(arguments, function (a) { return a && a.message ? a.message : String(a); }).join(' ')); } catch (e) { /* ignore */ }
    return origError.apply(console, arguments);
  };

  // ---------------------------------------------------------------- per-page checklist and live metrics
  var num = function (v, d) { return typeof v === 'number' && isFinite(v) ? +v.toFixed(d === undefined ? 2 : d) : v; };
  var PAGES = {
    'GAME-SUPER-START': {
      expect: [{ kind: 'core', count: 1 }],
      manual: [
        ['start-steady', 'SET で止めると STEADY になる'],
        ['start-reaction', '号砲で動かすと反応時間が出る（移植元と同じくらいの値）'],
        ['start-false', 'SET 中に動かすとフライングになる'],
        ['start-export', '結果カードの「計測データ」を保存できる'],
      ],
      metrics: function () {
        var d = window.startDebug; if (!d) return null;
        return { state: d.state, phase: d.phase, sensorRate: num(d.sensorRate, 0), clockUsable: d.clockUsable,
          attempts: (d.history || []).slice(-10).map(function (a) { return { type: a.type, ms: num(a.ms, 0) }; }) };
      },
    },
    'GAME-SUPER-RELAY': {
      expect: [{ kind: 'core', count: 1 }],
      manual: [
        ['relay-speed', '振ると加速し、止めると減速する'],
        ['relay-pass', 'ゾーンで止めて渡すと次の走者になる（スローの演出・パスの判定）'],
        ['relay-finish', '4 走まで完走して記録が出る'],
      ],
      metrics: function () {
        var d = window.relayDebug; if (!d) return null;
        var race = d.race || {};
        return { state: d.state, phase: d.phase, v: num(race.v), s: num(race.s, 1), leg: race.leg, finalPlace: d.finalPlace, reactionMs: num(d.reactionMs, 0),
          legStats: (d.legStats || []).map(function (l) { return { sec: num(l.sec), top: num(l.topSpeed), strokes: l.strokes }; }) };
      },
    },
    'GAME-SUPER-ADVENTURE': {
      expect: [{ kind: 'any', count: 2 }],
      manual: [
        ['adv-run', '足ぶみで走る（続けるとダッシュまで上がる）'],
        ['adv-jump', 'つま先を上げるとジャンプする'],
        ['adv-scope', '右上の生データのグラフが動く'],
        ['adv-insole', 'INSOLE でも走る・ジャンプできる（つま先の向きの自動判定）'],
      ],
      metrics: function () {
        var d = window.__adventure; if (!d || !d.sim) return null;
        var p = d.sim.p || {};
        return { mode: d.mode, gameMode: d.gameMode, topSpeed: num(p.topSpeed), jumps: p.jumps, hearts: p.hearts, finished: p.finished, time: num(p.time, 1) };
      },
    },
    'GAME-SUPER-HURDLE': {
      expect: [{ kind: 'any', count: 2 }],
      manual: [
        ['hurdle-run', '1 本走れる（足ぶみで走る・つま先上げでジャンプ）'],
        ['hurdle-stadium', 'スタジアムの表示（LED ボード・大型ビジョン）が以前どおり'],
        ['hurdle-cheer', '歓声の音が出る'],
      ],
      metrics: function () {
        var d = window.hurdleDebug; if (!d) return null;
        return { state: d.state, mode: d.mode, time: num(d.time), speed: num(d.speed), hits: d.hits, place: d.place, fps: num(d.fps, 0) };
      },
    },
    'GAME-SUPER-PINGPONG': {
      expect: [{ kind: 'core', count: 2 }],
      manual: [
        ['pp-start', '2 台そろってから開始できる'],
        ['pp-paddle', 'ラケットが動きに合わせて動く'],
        ['pp-report', '試合後のレポートが出る'],
        ['pp-drop', '試合中に 1 台切ると止まり、つなぎ直すと戻る'],
      ],
      metrics: function () {
        var d = window.pingpongDebug; if (!d) return null;
        return { phase: d.phase, fps: num(d.fps, 0), inputs: (d.inputs || []).map(function (i) { return { hz: num(i.hz, 0), calibrated: i.calibrated, deg: num(i.deg, 1) }; }) };
      },
    },
    'UDON': {
      expect: [{ kind: 'any', count: 2 }],
      manual: [
        ['udon-core', 'CORE：足ぶみが数えられる'],
        ['udon-insole-lr', 'INSOLE：左右のバッジ（左 / 右）が正しい'],
        ['udon-insole-step', 'INSOLE：踏むと数えられる（圧力で反応する）'],
        ['udon-finish', '1 杯つくり終わってレポートが出る'],
      ],
      metrics: function () {
        var g = window.UdonGame; if (!g || !g.state) return null;
        return { device: g.state.device, screen: g.state.screen };
      },
    },
  };
  var cfg = PAGES[ALIAS[PAGE] || PAGE] || { expect: [], manual: [], metrics: function () { return null; } };
  // CORE 3.0 (CR-3) streams 200 Hz (header 50); CORE 2.0 (CR-2) streams about 50 Hz (header 40, one sample a packet)
  var EXPECT_HZ = { core3: 160, core2: 40, insole1: 160, insole3: 160, insole4: 80 };
  function model(r) {
    var n = r.name || '';
    if (r.kind === 'core') return /^CR-2/.test(n) ? 'CORE 2.0' : /^CR-3/.test(n) ? 'CORE 3.0' : 'CORE';
    if (r.kind === 'insole') return /^INS2/.test(n) ? 'INSOLE 2.0' : 'INSOLE';
    return r.kind;
  }
  function minHz(r) {
    if (r.kind === 'insole') return EXPECT_HZ['insole' + (r.mode || 4)] || 80;
    return model(r) === 'CORE 3.0' ? EXPECT_HZ.core3 : EXPECT_HZ.core2;
  }

  function autoChecks() {
    var live = devices.filter(function (r) { return r.connects > 0; });
    var need = cfg.expect.reduce(function (n, e) { return n + e.count; }, 0);
    var kinds = {};
    live.forEach(function (r) { kinds[r.kind] = (kinds[r.kind] || 0) + 1; });
    var out = [];
    out.push({ id: 'auto-connect', label: '必要な台数がつながった（' + need + ' 台）', ok: need === 0 ? null : live.length >= need, detail: JSON.stringify(kinds) });
    out.push({ id: 'auto-rate', label: '受信レートが足りている（CORE 3.0 ≥160 Hz・CORE 2.0 ≥40 Hz・INSOLE mode4 ≥80 Hz）', ok: live.length ? live.every(function (r) { return r.peakHz >= minHz(r); }) : null,
      detail: live.map(function (r) { return r.slot + ':' + r.peakHz + '/' + minHz(r); }).join(' ') });
    out.push({ id: 'auto-loss', label: 'BLE の欠損が少ない（累計 5% 以下）', ok: live.some(function (r) { return r.lossPct !== null; }) ? live.every(function (r) { return r.lossPct === null || r.lossPct <= 5; }) : null,
      detail: live.map(function (r) { return r.slot + ':' + (r.lossPct === null ? '-' : r.lossPct + '%'); }).join(' ') });
    out.push({ id: 'auto-fw', label: 'FW 版を読めた', ok: live.length && !LEGACY ? live.every(function (r) { return !!r.fw; }) : null, detail: live.map(function (r) { return r.fw || '?'; }).join(' / ') });
    out.push({ id: 'auto-errors', label: 'ページのエラーなし', ok: errors.length === 0, detail: errors.length ? errors[errors.length - 1].msg : '' });
    out.push({ id: 'auto-reconnect', label: '電源を切って入れ直すと自動で再接続する（任意）', ok: devices.some(function (r) { return r.reconnects > 0; }) ? true : null,
      detail: devices.map(function (r) { return r.slot + ':' + r.disconnects + '/' + r.reconnects; }).join(' ') });
    return out;
  }

  // ---------------------------------------------------------------- saved manual state
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { saved = {}; }
  var manual = saved.manual || {};   // id -> { ok: true|false, note }
  var note = saved.note || '';
  var tester = saved.tester || localStorage.getItem('devtest.tester') || 'Yuya Kikukawa';
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ manual: manual, note: note, tester: tester })); localStorage.setItem('devtest.tester', tester); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- panel
  var css = '#devtest{position:fixed;left:8px;bottom:8px;z-index:2147483646;width:360px;max-height:70vh;overflow:auto;background:rgba(10,14,28,.94);color:#e8eefc;' +
    'font:12px/1.45 system-ui,-apple-system,"Hiragino Sans",sans-serif;border:1px solid #3a4a7a;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.5)}' +
    '#devtest.min{width:auto;max-height:none;overflow:visible}#devtest.min .dt-body{display:none}' +
    '#devtest .dt-head{display:flex;gap:6px;align-items:center;padding:6px 8px;background:#1a2547;border-radius:10px 10px 0 0;cursor:move;user-select:none}' +
    '#devtest.min .dt-head{border-radius:10px}#devtest .dt-head b{flex:1}#devtest button{font:inherit;color:#fff;background:#2c3d73;border:1px solid #4a5f9e;border-radius:6px;padding:2px 8px;cursor:pointer}' +
    '#devtest button.on-ok{background:#1f7a3a;border-color:#2fbf5c}#devtest button.on-ng{background:#8a2230;border-color:#e0485e}' +
    '#devtest .dt-body{padding:6px 8px}#devtest table{width:100%;border-collapse:collapse;margin:2px 0 6px}#devtest td,#devtest th{padding:1px 3px;border-bottom:1px solid #2a3558;text-align:left;font-weight:normal;white-space:nowrap}' +
    '#devtest th{color:#8fa6d6}#devtest .ok{color:#5be08a}#devtest .ng{color:#ff6b80}#devtest .na{color:#8fa6d6}#devtest .row{display:flex;gap:4px;align-items:flex-start;margin:3px 0}' +
    '#devtest .row span{flex:1}#devtest textarea,#devtest input{width:100%;box-sizing:border-box;background:#0d1530;color:#e8eefc;border:1px solid #3a4a7a;border-radius:6px;font:inherit;padding:3px}' +
    '#devtest .sec{margin:6px 0 2px;color:#9fc0ff;font-weight:600}#devtest pre{margin:0;white-space:pre-wrap;word-break:break-all;color:#c9d6f5;font-size:11px}#devtest .msg{color:#ffd34d}';
  var style = document.createElement('style'); style.textContent = css;
  var box = document.createElement('div'); box.id = 'devtest';
  if (localStorage.getItem('devtest.min') === '1') box.className = 'min';
  box.innerHTML = '<div class="dt-head"><b>実機テスト · ' + PAGE + (LEGACY ? '（旧 SDK）' : '') + '</b><button data-act="save" title="結果を保存（serve.py の結果フォルダへ）">保存</button>' +
    '<button data-act="report" title="これまでの結果">一覧</button><button data-act="min">_</button></div><div class="dt-body">' +
    '<div class="sec">デバイス（自動）</div><table><thead><tr><th>#</th><th>種別</th><th>名前</th><th>FW</th><th>状態</th><th>Hz</th><th>欠損%<br><small>10s/累計</small></th><th>切/再</th></tr></thead><tbody data-ref="dev"></tbody></table>' +
    '<div class="sec">自動チェック</div><div data-ref="auto"></div><div class="sec">手で確かめる</div><div data-ref="manual"></div>' +
    '<div class="sec">メモ（気づいたこと・症状）</div><textarea data-ref="note" rows="2"></textarea>' +
    '<div class="row"><span>確認者</span><input data-ref="tester" style="width:60%"></div>' +
    '<div class="sec">ゲームの値</div><pre data-ref="metrics"></pre><div class="msg" data-ref="msg"></div></div>';
  function mount() {
    if (!document.body) return setTimeout(mount, 50);
    document.head.appendChild(style); document.body.appendChild(box);
    var q = function (r) { return box.querySelector('[data-ref="' + r + '"]'); };
    q('note').value = note; q('tester').value = tester;
    q('note').addEventListener('input', function (e) { note = e.target.value; persist(); });
    q('tester').addEventListener('input', function (e) { tester = e.target.value; persist(); });
    // keep the game's keyboard shortcuts from firing while typing in the panel
    ['keydown', 'keyup', 'keypress'].forEach(function (t) { box.addEventListener(t, function (e) { e.stopPropagation(); }); });
    var mbox = q('manual');
    cfg.manual.forEach(function (m) {
      var row = document.createElement('div'); row.className = 'row';
      row.innerHTML = '<span>' + m[1] + '</span><button data-id="' + m[0] + '" data-v="ok">OK</button><button data-id="' + m[0] + '" data-v="ng">NG</button><button data-id="' + m[0] + '" data-v="skip" title="この回は試さない">－</button>';
      mbox.appendChild(row);
    });
    mbox.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var id = b.dataset.id, v = b.dataset.v;
      if (v === 'skip') delete manual[id]; else manual[id] = { ok: v === 'ok', at: new Date().toISOString() };
      persist(); paintManual();
    });
    box.querySelector('.dt-head').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'min') { box.classList.toggle('min'); localStorage.setItem('devtest.min', box.classList.contains('min') ? '1' : '0'); }
      if (b.dataset.act === 'report') window.open('/__devtest/report.html', 'devtest-report');
      if (b.dataset.act === 'save') save();
    });
    drag(box, box.querySelector('.dt-head'));
    paintManual();
    setInterval(paint, 500);
    function paintManual() {
      mbox.querySelectorAll('button').forEach(function (b) {
        var st = manual[b.dataset.id];
        b.classList.toggle('on-ok', !!st && st.ok && b.dataset.v === 'ok');
        b.classList.toggle('on-ng', !!st && !st.ok && b.dataset.v === 'ng');
      });
    }
    function paint() {
      devices.forEach(refresh);
      q('dev').innerHTML = devices.map(function (r) {
        return '<tr><td>' + r.slot + '</td><td>' + model(r) + (r.kind === 'insole' && r.mode ? '/m' + r.mode : '') + '</td><td>' + esc(r.name || '-') + '</td><td>' + (r.fw || '-') + '</td><td>' + r.state +
          '</td><td class="' + (r.hz >= minHz(r) ? 'ok' : (r.hz > 0 ? 'ng' : 'na')) + '">' + Math.round(r.hz) + '</td><td class="' + (r.lossPct10s === null ? 'na' : r.lossPct10s <= 2 ? 'ok' : 'ng') + '">' + (r.lossPct10s === null ? '-' : r.lossPct10s) + ' / ' + (r.lossPct === null ? '-' : r.lossPct) + '</td><td>' + r.disconnects + '/' + r.reconnects + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="na">まだ接続していません（接続ドックのスイッチで接続）</td></tr>';
      q('auto').innerHTML = autoChecks().map(function (c) {
        var cls = c.ok === true ? 'ok' : c.ok === false ? 'ng' : 'na', mark = c.ok === true ? '✓' : c.ok === false ? '✗' : '…';
        return '<div class="row"><span class="' + cls + '">' + mark + ' ' + c.label + (c.detail ? ' <small class="na">' + esc(c.detail) + '</small>' : '') + '</span></div>';
      }).join('');
      var m = null; try { m = cfg.metrics(); } catch (e) { m = { error: String(e) }; }
      q('metrics').textContent = m ? JSON.stringify(m) : '-';
    }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function drag(el, handle) {
    var sx, sy, ox, oy, on = false;
    handle.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; on = true; sx = e.clientX; sy = e.clientY; var r = el.getBoundingClientRect(); ox = r.left; oy = r.top; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', function (e) { if (!on) return; el.style.left = (ox + e.clientX - sx) + 'px'; el.style.top = (oy + e.clientY - sy) + 'px'; el.style.bottom = 'auto'; });
    handle.addEventListener('pointerup', function () { on = false; });
  }

  // ---------------------------------------------------------------- save
  function snapshot() {
    devices.forEach(refresh);
    var m = null; try { m = cfg.metrics(); } catch (e) { m = { error: String(e) }; }
    var sdkSrc = Array.prototype.map.call(document.scripts, function (s) { return s.src; }).filter(function (s) { return /orphe-core-insole\.js(\?|$)/.test(s); })[0] || null;
    return {
      page: ALIAS[PAGE] || PAGE, sourcePage: PAGE, legacySdk: LEGACY, url: location.pathname + location.search, savedAt: localIso(new Date()), tester: tester, note: note,
      sdk: LEGACY ? 'ORPHE-CORE.js (legacy)' : (sdkSrc ? (sdkSrc.match(/@(v[\d.]+)/) || [null, sdkSrc])[1] : null),
      devices: devices.filter(function (r) { return r.connects > 0 || r.samples > 0; }).map(function (r) {
        return { slot: r.slot, kind: r.kind, model: model(r), name: r.name, fw: r.fw, fwName: r.fwName, mode: r.mode, beginType: r.beginType, state: r.state, peakHz: r.peakHz,
          samples: r.samples, packets: r.packets, lost: r.lost, lostPackets: r.lostFrames, lossPct: r.lossPct, connects: r.connects, disconnects: r.disconnects, reconnects: r.reconnects, reconnectFailed: r.reconnectFailed, errors: r.errors.slice(-5) };
      }),
      auto: autoChecks(), manual: cfg.manual.map(function (x) { var st = manual[x[0]]; return { id: x[0], label: x[1], ok: st ? st.ok : null }; }),
      metrics: m, errors: errors.slice(-20), userAgent: navigator.userAgent, minutesOnPage: Math.round((Date.now() - t0) / 6000) / 10,
    };
  }
  function localIso(d) {
    var p = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-';
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) +
      sign + p(Math.floor(Math.abs(off) / 60)) + ':' + p(Math.abs(off) % 60);
  }
  function save() {
    var msg = box.querySelector('[data-ref="msg"]');
    var body = JSON.stringify(snapshot());
    var btn = box.querySelector('button[data-act="save"]');
    fetch('/__devtest/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body }).then(function (r) { return r.json(); }).then(function (j) {
      msg.textContent = '保存しました: ' + j.file.split('/').pop();
      btn.textContent = '保存済み ✓'; btn.classList.add('on-ok');
      setTimeout(function () { btn.textContent = '保存'; btn.classList.remove('on-ok'); }, 2500);
    }).catch(function (e) {
      msg.textContent = '保存できませんでした（serve.py で開いていますか？）: ' + e;
    });
  }
  window.__devtest = { devices: devices, errors: errors, snapshot: snapshot, save: save };
  mount();
})();
