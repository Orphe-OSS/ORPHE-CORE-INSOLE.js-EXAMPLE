/**
 * device-slot.js — CORE / INSOLE を選べる「デバイススロット」の共通部品。
 *
 * マージした example（VISUALIZE / UDON / TERMINAL / SENSOR-DASHBOARD）で使う。
 * orphe-core-insole.js（と Toolkit を使う場合は orphe-core-insole-toolkit.js）の後に読み込む。
 *
 * スロットごとに CORE / INSOLE の種別セレクトを描く。種別はページ読み込み時に一度だけ決め、
 * 変更したら localStorage に保存してページを再読み込みする（Toolkit の DOM ID と
 * InsoleToolkitSession を二重に作らないため）。
 *
 * 種別の決まり方（優先順）:
 *   1. URL クエリ ?slot0=core&slot1=insole
 *   2. localStorage（キーは `${storageKey}:slot${id}`）
 *   3. options.defaultKind（既定 'insole'）
 *
 * 使い方:
 *   const slot = buildDeviceSlot(document.getElementById('slot0'), 0, {
 *     title: '01',
 *     storageKey: 'visualize',
 *     toolkit: true,                       // true: buildCoreToolkit / buildInsoleToolkit で接続 UI を作る
 *     coreNotification: 'SENSOR_VALUES',   // toolkit: true で CORE のときの begin 種別
 *     coreToolkitOptions: {},              // buildCoreToolkit の options
 *     insoleToolkitOptions: { streamingMode: 4, autoReconnect: true },
 *   });
 *   slot.kind    // 'core' | 'insole'
 *   slot.device  // Orphe（CORE）または OrpheInsole（INSOLE）のインスタンス。setup() 済み
 *
 * toolkit: false のときは device を new するだけで接続 UI は作らない（ページ側で begin() する）。
 */
(function (root) {
  'use strict';

  const KINDS = ['core', 'insole'];
  const LABELS = { core: 'ORPHE CORE', insole: 'ORPHE INSOLE' };

  function readKind(id, storageKey, defaultKind) {
    const query = new URLSearchParams(root.location.search).get(`slot${id}`);
    if (KINDS.includes(query)) return query;
    try {
      const saved = root.localStorage.getItem(`${storageKey}:slot${id}`);
      if (KINDS.includes(saved)) return saved;
    } catch (error) { void error; }
    return KINDS.includes(defaultKind) ? defaultKind : 'insole';
  }

  function saveKind(id, storageKey, kind) {
    try { root.localStorage.setItem(`${storageKey}:slot${id}`, kind); } catch (error) { void error; }
  }

  function createDevice(kind, id, options) {
    if (options.toolkit) {
      const list = kind === 'core' ? root.cores : root.insoles;
      if (!Array.isArray(list)) {
        throw new Error('device-slot: orphe-core-insole-toolkit.js を先に読み込んでください');
      }
      return list[id];
    }
    const Ctor = kind === 'core' ? root.Orphe : root.OrpheInsole;
    if (typeof Ctor !== 'function') {
      throw new Error('device-slot: orphe-core-insole.js を先に読み込んでください');
    }
    return new Ctor(id);
  }

  function buildDeviceSlot(parent, id, options = {}) {
    const storageKey = options.storageKey || root.location.pathname;
    const kind = readKind(id, storageKey, options.defaultKind);

    const wrap = root.document.createElement('div');
    wrap.className = 'device-slot';
    const select = root.document.createElement('select');
    select.className = 'device-slot-kind form-select form-select-sm';
    select.setAttribute('aria-label', 'device type');
    for (const value of KINDS) {
      const option = root.document.createElement('option');
      option.value = value;
      option.textContent = LABELS[value];
      option.selected = value === kind;
      select.appendChild(option);
    }
    const toolkitHost = root.document.createElement('div');
    toolkitHost.className = 'device-slot-toolkit';
    wrap.append(select, toolkitHost);
    parent.appendChild(wrap);

    const device = createDevice(kind, id, options);

    select.addEventListener('change', () => {
      if (device.isConnected && device.isConnected()) {
        const ok = root.confirm('接続中のデバイスを切断して種別を切り替えます。よろしいですか？');
        if (!ok) { select.value = kind; return; }
        try { device.reset(); } catch (error) { void error; }
      }
      saveKind(id, storageKey, select.value);
      const url = new URL(root.location.href);
      url.searchParams.delete(`slot${id}`);
      root.location.replace(url.toString());
    });

    if (options.toolkit) {
      const title = options.title != null ? String(options.title) : String(id + 1).padStart(2, '0');
      if (kind === 'core') {
        root.buildCoreToolkit(toolkitHost, title, id, options.coreNotification || 'SENSOR_VALUES', options.coreToolkitOptions || {});
      } else {
        root.buildInsoleToolkit(toolkitHost, title, id, options.insoleToolkitOptions || {});
      }
    }
    // Toolkit は setup() を呼ばないので、ここで必ず呼ぶ
    device.setup();

    const slot = { id, kind, device, select, toolkitHost, element: wrap };
    // 接続中は種別を変えられないようにする
    const lock = () => { select.disabled = !!(device.isConnected && device.isConnected()); };
    root.setInterval(lock, 500);
    return slot;
  }

  root.buildDeviceSlot = buildDeviceSlot;
})(typeof window !== 'undefined' ? window : globalThis);
