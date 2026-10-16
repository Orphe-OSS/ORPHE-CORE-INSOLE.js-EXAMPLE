(function () {
  const LANGUAGE_STORAGE_KEY = 'orphe-core-insole-examples-language';

  const uiText = {
    ja: {
      documentTitle: 'ORPHE-CORE-INSOLE.js Examples | ORPHE CORE / ORPHE INSOLE',
      toggle: 'English',
      title: 'ORPHE CORE / INSOLEで作れるものを探す。',
      lead: 'ORPHE COREとORPHE INSOLEの両方に対応したExample集です。接続やLED制御から、センサー値の取得、Gait Analysis、記録・解析、ゲーム、クリエイティブ表現まで、目的に合わせてExampleを選べます。',
      category: 'カテゴリー',
      allCategories: 'すべてのカテゴリー',
      difficulty: '難易度',
      allLevels: 'すべてのレベル',
      search: '検索',
      searchPlaceholder: 'タイトル・トピック・データで検索',
      stats: (total, filtered) => `${total}件中 ${filtered}件を表示`,
      empty: '条件に合うExampleがありません。',
      loadError: (message) => `catalog.json を読み込めませんでした: ${message}`,
      thumbnailFallback: 'サムネイル準備中',
      deviceUnit: (count) => `${count}台`,
      device: 'デバイス',
      allDevices: 'すべてのデバイス',
      deviceKind: { core: 'CORE', insole: 'INSOLE', both: 'CORE / INSOLE' }
    },
    en: {
      documentTitle: 'ORPHE-CORE-INSOLE.js Examples | ORPHE CORE / ORPHE INSOLE',
      toggle: '日本語',
      title: 'Find examples by what you want to build.',
      lead: 'Examples for both ORPHE CORE and ORPHE INSOLE. Choose an example for your goal, from connection and LED control to sensor values, Gait Analysis, recording, games, and creative coding.',
      category: 'Category',
      allCategories: 'All categories',
      difficulty: 'Difficulty',
      allLevels: 'All levels',
      search: 'Search',
      searchPlaceholder: 'Search title, topic, or data',
      stats: (total, filtered) => `${filtered} of ${total} examples shown`,
      empty: 'No examples match these filters.',
      loadError: (message) => `Could not load catalog.json: ${message}`,
      thumbnailFallback: 'Thumbnail coming soon',
      deviceUnit: (count) => `${count} ${count === 1 ? 'device' : 'devices'}`,
      device: 'Device',
      allDevices: 'All devices',
      deviceKind: { core: 'CORE', insole: 'INSOLE', both: 'CORE / INSOLE' }
    }
  };

  const categoryLabels = {
    ja: {
      'getting-started': 'はじめる',
      'sensor-basics': 'センサー基礎',
      'gait-analysis': 'Gait Analysis',
      'recording-analysis': '記録・解析',
      'virtual-sports': 'Virtual Sports',
      'playable-app': '遊べるアプリ',
      'creative-coding': 'Creative Coding',
      'research-integration': '研究・連携',
      'workshop-archive': 'ワークショップ',
      'developer-tool': '開発ツール',
      'internal-test': '内部テスト'
    },
    en: {
      'getting-started': 'Getting Started',
      'sensor-basics': 'Sensor Basics',
      'gait-analysis': 'Gait Analysis',
      'recording-analysis': 'Recording and Analysis',
      'virtual-sports': 'Virtual Sports',
      'playable-app': 'Playable Apps',
      'creative-coding': 'Creative Coding',
      'research-integration': 'Research and Integrations',
      'workshop-archive': 'Workshops',
      'developer-tool': 'Developer Tools',
      'internal-test': 'Internal Tests'
    }
  };

  const categoryOrder = [
    'getting-started',
    'sensor-basics',
    'gait-analysis',
    'recording-analysis',
    'virtual-sports',
    'playable-app',
    'creative-coding',
    'research-integration',
    'developer-tool',
    'workshop-archive',
    'internal-test'
  ];

  const difficultyLabels = {
    ja: {
      beginner: '初級',
      intermediate: '中級',
      advanced: '上級'
    },
    en: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced'
    }
  };

  const entryTextJa = {
    light: {
      title: 'LEDを制御する',
      value: 'ORPHE COREに接続し、LED制御を試す最初のExampleです。'
    },
    'coretoolkit-starter': {
      title: 'CoreToolkit Starter',
      value: 'CoreToolkit（orphe-core-insole-toolkit.js）で接続UIとセンサーモニターをすばやく立ち上げます。'
    },
    visualize: {
      title: 'センサー値の可視化',
      value: 'SENSOR_VALUESをシンプルな画面で可視化します。'
    },
    'foot-angle': {
      title: 'Foot Angle Visualizer',
      value: 'Gait Analysisから得られる足角度を可視化します。'
    },
    pronation: {
      title: 'Pronation Visualizer',
      value: 'プロネーションや接地に関わる歩行データを可視化します。'
    },
    airwalker: {
      title: 'Air Walker',
      value: '歩数や動き、アクティビティをダッシュボードで表示します。'
    },
    pose: {
      title: 'Pose + ORPHE CORE',
      value: 'MediaPipe PoseとORPHE COREのデータを組み合わせます。'
    },
    oh1: {
      title: 'OH1 Heart Rate',
      value: '外部BLE心拍センサーとORPHE COREを連携します。'
    },
    'sensor-calibration': {
      title: 'Sensor Calibration',
      value: 'キャリブレーション用にセンサーデータを記録・確認します。'
    },
    'gesture-demo': {
      title: 'Gesture Demo',
      value: 'ORPHE COREのデータからジェスチャー検出を試す起点です。'
    },
    'game-hurdle': {
      title: '110m ハードル走',
      value: 'Gait Analysisと足の動きで走る、Virtual Sportsの代表Exampleです。'
    },
    'game-sprint-100m-vs': {
      title: '100m走 VS',
      value: '2台のORPHE COREで対戦するバーチャル短距離走です。'
    },
    'game-hurdle-400m-vs': {
      title: '400mハードル走 VS',
      value: '2台のORPHE COREで走りとジャンプを競う対戦Exampleです。'
    },
    'move-your-feet': {
      title: '足パタパタゲーム',
      value: '足を動かして遊ぶエクササイズ系ゲームです。'
    },
    'game-pingpong': {
      title: 'ピンポンゲーム',
      value: '2人で遊べるシンプルな対戦ゲームです。'
    },
    'drum-test': {
      title: 'ドラムゲーム',
      value: '身体の動きで音を鳴らすサウンドExampleです。'
    },
    'orphe-piano': {
      title: 'Orphe Piano',
      value: 'ORPHE COREの動き、StepSUM、PD由来の音階テーブルで元作品のピアノサンプルを鳴らすWeb版移植です。'
    },
    'game-boxing': {
      title: 'ボクシングゲーム',
      value: 'パンチ動作を使うアクションゲームです。'
    },
    'game-ddr': {
      title: 'DDRゲーム',
      value: '音楽と足の動きを組み合わせたリズムゲームです。'
    },
    'game-mario': {
      title: '2Dアクションゲーム',
      value: '足の動きでキャラクターを操作するアクションゲームです。'
    },
    'game-pk': {
      title: 'PKゲーム',
      value: 'キック動作を使ったゲームExampleです。'
    },
    'game-shooting': {
      title: 'シューティングゲーム',
      value: '身体動作を入力に使うシューティングゲームです。'
    },
    'game-shooting2': {
      title: '3Dシューティングゲーム',
      value: '3D表現と身体動作を組み合わせたゲームExampleです。'
    },
    'workshop-07': {
      title: 'Fourier / DFT Workshop',
      value: 'YouTubeのORPHE CORE WSで扱ったDFT/FFT教材です。'
    },
    'starter-light': {
      title: 'LED Starter',
      value: 'LED制御からORPHE COREの接続を試します。'
    },
    'starter-accelerometer': {
      title: 'Accelerometer Starter',
      value: '加速度データを取得する最小構成です。'
    },
    'starter-gyro': {
      title: 'Gyro Starter',
      value: '角速度データを取得する最小構成です。'
    },
    'starter-quaternion': {
      title: 'Quaternion Starter',
      value: '姿勢推定に使うクォータニオンを取得します。'
    },
    'starter-euler': {
      title: 'Euler Starter',
      value: 'ロール・ピッチ・ヨーの姿勢角を取得します。'
    },
    'starter-steps': {
      title: 'Steps Starter',
      value: '歩数などのGait Analysisデータを取得します。'
    },
    'starter-stride': {
      title: 'Stride Starter',
      value: 'ストライド関連のGait Analysisデータを確認します。'
    },
    'starter-pronation': {
      title: 'Pronation Starter',
      value: 'プロネーション関連のGait Analysisデータを確認します。'
    },
    'starter-analysis-and-sensor-values': {
      title: 'Step Analysis + Sensor Values Starter',
      value: 'STEP_ANALYSISとSENSOR_VALUESを同時に扱う起点です。'
    },
    'guide-p5': {
      title: 'p5.jsではじめる',
      value: 'p5.jsでORPHE COREを使う流れを確認します。'
    },
    'guide-vscode': {
      title: 'VSCodeではじめる',
      value: 'VSCodeとローカルサーバでExampleを動かす手順です。'
    },
    'guide-led': {
      title: 'LED制御ガイド',
      value: 'LEDの制御を通して接続と基本操作を学びます。'
    },
    'guide-coretoolkit': {
      title: 'CoreToolkit.jsガイド',
      value: 'CoreToolkit.jsで接続UIと設定UIを使う手順です。'
    },
    'guide-electron': {
      title: 'Electronガイド',
      value: 'Electronでデスクトップアプリ化する入口です。'
    },
    'ws-tmu2025': {
      title: 'TMU 2025 授業成果ギャラリー',
      value: '東京都立大学での授業・ワークショップ成果を参照できます。'
    },
    'app-orphe-terminal': {
      title: 'ORPHE TERMINAL',
      value: 'ORPHE COREのデータを扱う開発用ツールです。'
    }
  };

  // ORPHE INSOLE とマージ済み example の日本語表記
  Object.assign(entryTextJa, {
      "showcase": {
          "title": "Showcase",
          "value": "製品仕様・6ch圧力ヒートマップ・IMUチャート・クォータニオン3D・CSV記録・コード例を1ページで。実機なしでもデモ再生で動きます。"
      },
      "exhibition": {
          "title": "展示用一覧ページ",
          "value": "16:9のディスプレイで、圧力マップ・全体圧力ゲージ・IMU・姿勢3D・Step Analysisを1画面に表示します。未接続の間はデモデータで動きます。"
      },
      "calibrated-pressure": {
          "title": "校正済み圧力",
          "value": "接続時に各INSOLEから取得した校正値で、6chの圧力を荷重[N]に換算してグラフ表示する最小サンプルです。"
      },
      "step-analysis": {
          "title": "Step Analysis + RAW Data",
          "value": "左右の歩容解析結果を1歩ごとに可視化し、直近10歩の推移とRealtime Rawセンサーグラフを同時に確認できます。"
      },
      "gait-report": {
          "title": "歩行レポート",
          "value": "左右20歩を計測し、平均±SD・左右差・ばらつき・接地の内訳をまとめた歩行レポートを1歩ごとにライブ生成します。"
      },
      "fifo-guide": {
          "title": "FIFOガイド",
          "value": "FIFOの入口。Realtimeとの違い、端末内バッファが約30秒である理由、serialの連続性と欠損の読み方を確認できます。"
      },
      "fifo-vs-realtime": {
          "title": "FIFO vs Realtime",
          "value": "通常(push)とFIFO(pull)を実測比較します。欠損率・シリアル連続性マップ・droppedCountを確認できます。"
      },
      "lab-recorder": {
          "title": "Lab Recorder",
          "value": "研究室向けのFIFO収録機（実験的）。同期マーカー・インパルス候補・試行メタデータ・来歴列・欠損レポートを出力します。"
      },
      "insole-core-combo": {
          "title": "INSOLE + CORE 同時収録",
          "value": "INSOLE 2台とCORE 1台を同時接続し、同期したCSVを収録する研究用ツールです。"
      },
      "balance-sway": {
          "title": "重心動揺",
          "value": "圧力中心の軌跡・揺れ指標・左右荷重比をデモストリーム付きで可視化します。医療機器ではありません。"
      },
      "balance-tuner": {
          "title": "Balance Tuner",
          "value": "推定荷重中心と左右バランスを、音程・パン・協和・不協和へ変換します。"
      },
      "hula-motion-sonifier": {
          "title": "Hula Motion Sonifier",
          "value": "圧力とIMUの複合信号からフラのステップを検出し、状態遷移を音に変換します。"
      },
      "music-shoe": {
          "title": "Music Shoe",
          "value": "インソールを手に持って演奏するジェスチャ楽器。ループ録音とジェスチャ収録LAB付き。マウス/キーボードでも試奏できます。"
      },
      "device-test": {
          "title": "実機テスト",
          "value": "リリース前の実機チェックリスト。通知中のread/write、モード切替、自動判定を行います。"
      },
      "quaternion-validation": {
          "title": "クォータニオン検証",
          "value": "クォータニオンの長時間実機検証。norm・yawドリフト・欠損率をCSVと数値レポートで確認します。"
      },
      "data-modes": {
          "title": "Data Mode Inspector",
          "value": "データモードごとのprofile遷移と計測APIを検証するエンジニアリング用ツールです。"
      },
      "terminal": {
          "title": "ターミナル",
          "value": "ORPHE CORE / INSOLEのデバイス情報表示、BLE characteristicのread/write、生の通知バイトの監視ができます。"
      },
      "visualize": {
          "title": "VISUALIZE",
          "value": "最大2台のセンサー値をChart.jsで時系列表示。スロットごとにCORE/INSOLEを選べ、INSOLEでは6ch圧力も表示します。"
      },
      "sensor-dashboard": {
          "title": "センサーダッシュボード",
          "value": "2台のセンサー値・靴の3D表示・左右割当を確認できます。COREは歩容解析、INSOLEは圧力も表示します。"
      },
      "udon": {
          "title": "おいしいうどんを作ろう！",
          "value": "その場で足踏みしてうどんをこねるゲーム。INSOLEはIMU＋圧力、COREはIMUの衝撃で1歩を判定します。未接続の間はデモで動きます。"
      },
      "game-hurdle-vs": {
          "title": "110mハードル 2人対戦",
          "value": "ORPHE COREで足踏みして2人で競うハードル走です。"
      },
      "game-hurdle-vs-advance": {
          "title": "110mハードル 2人対戦（発展版）",
          "value": "ORPHE COREで足踏みして2人で競うハードル走です。"
      },
      "game-hurdle-2d-vs": {
          "title": "2Dハードル 2人対戦",
          "value": "ORPHE COREで足踏みして2人で競うハードル走です。"
      }
  });

  const fallbackCategoryByType = {
    'starter-template': 'sensor-basics',
    guide: 'getting-started',
    workshop: 'workshop-archive',
    tool: 'developer-tool',
    'internal-test': 'internal-test'
  };

  const gallery = document.querySelector('#gallery');
  const stats = document.querySelector('#stats');
  const categoryFilter = document.querySelector('#categoryFilter');
  const difficultyFilter = document.querySelector('#difficultyFilter');
  const searchFilter = document.querySelector('#searchFilter');
  const languageToggle = document.querySelector('#languageToggle');
  const sdkLink = document.querySelector('#sdkLink');
  const pageTitle = document.querySelector('#pageTitle');
  const pageLead = document.querySelector('#pageLead');
  const categoryLabel = document.querySelector('#categoryLabel');
  const categoryAllOption = document.querySelector('#categoryAllOption');
  const difficultyLabelElement = document.querySelector('#difficultyLabel');
  const difficultyAllOption = document.querySelector('#difficultyAllOption');
  const searchLabel = document.querySelector('#searchLabel');
  const deviceFilter = document.querySelector('#deviceFilter');
  const deviceLabelElement = document.querySelector('#deviceLabel');
  const deviceAllOption = document.querySelector('#deviceAllOption');
  // ?all=1 で hidden / 内部向けの example も一覧に出す
  const showAll = new URLSearchParams(window.location.search).get('all') === '1';

  let allEntries = [];
  let lang = document.documentElement.dataset.lang || 'ja';

  function normalizeLanguage(value) {
    return value === 'ja' ? 'ja' : 'en';
  }

  function getInitialLanguage() {
    let storedLanguage = '';
    try {
      storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || '';
    } catch (error) {
      storedLanguage = '';
    }
    if (storedLanguage === 'ja' || storedLanguage === 'en') return storedLanguage;
    const browserLanguage = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^ja\b/i.test(browserLanguage) ? 'ja' : 'en';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeLink(value) {
    if (!value) return '#';
    if (/^https?:\/\//.test(value)) return value;
    // catalog のパスはリポジトリルート基準。ギャラリーもルートにあるのでそのまま使う
    return value.split('/').map(encodeURIComponent).join('/');
  }

  function demoLink(entry) {
    if (entry.links?.demo) return normalizeLink(entry.links.demo);
    if (!entry.path) return '#';
    if (entry.path.endsWith('.html')) return normalizeLink(entry.path);
    return normalizeLink(`${entry.path.replace(/\/?$/, '/')}index.html`);
  }

  function categoryFor(entry) {
    if (entry.category) return entry.category;
    if ((entry.topics || []).includes('game')) return 'playable-app';
    if ((entry.topics || []).includes('gait-analysis')) return 'gait-analysis';
    return fallbackCategoryByType[entry.type] || 'research-integration';
  }

  function difficultyFor(entry) {
    return entry.difficulty || (entry.type === 'starter-template' || entry.type === 'guide' ? 'beginner' : 'intermediate');
  }

  function difficultyLabel(entry) {
    const difficulty = difficultyFor(entry);
    return difficultyLabels[lang][difficulty] || difficulty;
  }

  function displayTitle(entry) {
    if (lang === 'ja') return entryTextJa[entry.id]?.title || entry.title || entry.id;
    return entry.title || entryTextJa[entry.id]?.title || entry.id;
  }

  function displayValue(entry) {
    if (lang === 'ja') return entryTextJa[entry.id]?.value || entry.value || '';
    return entry.value || entryTextJa[entry.id]?.value || '';
  }

  function sortValue(entry, index) {
    return Number.isInteger(entry.sort_order) ? entry.sort_order : 10000 + index;
  }

  function orderIndex(values, value) {
    const index = values.indexOf(value);
    return index === -1 ? values.length : index;
  }

  function isPublicEntry(entry) {
    if (showAll) return true;
    if (entry.type === 'internal-test') return false;
    if (entry.public_navigation === 'hidden') return false;
    return entry.status === 'public' || entry.status === 'public-candidate';
  }

  function populateFilters(entries) {
    const categories = [...new Set(entries.map(categoryFor))]
      .sort((a, b) => orderIndex(categoryOrder, a) - orderIndex(categoryOrder, b) || a.localeCompare(b));
    const difficultyOrder = ['beginner', 'intermediate', 'advanced'];
    const difficulties = [...new Set(entries.map(difficultyFor))]
      .sort((a, b) => orderIndex(difficultyOrder, a) - orderIndex(difficultyOrder, b) || a.localeCompare(b));

    categoryFilter.insertAdjacentHTML('beforeend', categories.map((category) => {
      const label = categoryLabels[lang][category] || category;
      return `<option value="${escapeHtml(category)}">${escapeHtml(label)}</option>`;
    }).join(''));

    difficultyFilter.insertAdjacentHTML('beforeend', difficulties.map((difficulty) => (
      `<option value="${escapeHtml(difficulty)}">${escapeHtml(difficultyLabels[lang][difficulty] || difficulty)}</option>`
    )).join(''));
  }

  function localizeFilterOptions() {
    [...categoryFilter.options].forEach((option) => {
      option.textContent = option.value ? (categoryLabels[lang][option.value] || option.value) : uiText[lang].allCategories;
    });
    [...difficultyFilter.options].forEach((option) => {
      option.textContent = option.value ? (difficultyLabels[lang][option.value] || option.value) : uiText[lang].allLevels;
    });
  }

  function updateStaticText() {
    const text = uiText[lang];
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.title = text.documentTitle;
    languageToggle.textContent = text.toggle;
    if (sdkLink) sdkLink.href = `https://orphe-oss.github.io/ORPHE-CORE-INSOLE.js/${lang === 'en' ? 'en/' : ''}`;
    pageTitle.textContent = text.title;
    pageLead.textContent = text.lead;
    categoryLabel.textContent = text.category;
    categoryAllOption.textContent = text.allCategories;
    difficultyLabelElement.textContent = text.difficulty;
    difficultyAllOption.textContent = text.allLevels;
    searchLabel.textContent = text.search;
    deviceLabelElement.textContent = text.device;
    deviceAllOption.textContent = text.allDevices;
    searchFilter.placeholder = text.searchPlaceholder;
  }

  function applyLanguage(nextLanguage, options = {}) {
    lang = normalizeLanguage(nextLanguage);
    updateStaticText();
    localizeFilterOptions();
    render();
    if (options.persist) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch (error) {
        // Ignore storage failures in private or restricted browser contexts.
      }
    }
  }

  function applyInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const difficulty = params.get('difficulty');
    const query = params.get('q');
    const device = params.get('device');
    if (device === 'core' || device === 'insole') deviceFilter.value = device;

    if (category && [...categoryFilter.options].some((option) => option.value === category)) {
      categoryFilter.value = category;
    }
    if (difficulty && [...difficultyFilter.options].some((option) => option.value === difficulty)) {
      difficultyFilter.value = difficulty;
    }
    if (query) {
      searchFilter.value = query;
    }
  }

  function entryMatches(entry) {
    const category = categoryFilter.value;
    const difficulty = difficultyFilter.value;
    const query = searchFilter.value.trim().toLowerCase();

    if (category && categoryFor(entry) !== category) return false;
    if (difficulty && difficultyFor(entry) !== difficulty) return false;
    const device = deviceFilter.value;
    if (device && entry.device !== device && entry.device !== 'both') return false;
    if (!query) return true;

    const haystack = [
      displayTitle(entry),
      displayValue(entry),
      entry.title,
      entry.value,
      ...(entry.topics || []),
      ...(entry.data || []),
      ...(entry.audience || [])
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  function card(entry) {
    const thumbnail = entry.thumbnail
      ? `<img src="${escapeHtml(normalizeLink(entry.thumbnail))}" alt="">`
      : `<span>${escapeHtml(uiText[lang].thumbnailFallback)}</span>`;
    const devices = entry.device_count || entry.devices || 1;

    return `
      <a class="card" href="${escapeHtml(demoLink(entry))}">
        <div class="thumb">${thumbnail}</div>
        <div class="card-body">
          <h3>${escapeHtml(displayTitle(entry))}</h3>
          <p>${escapeHtml(displayValue(entry))}</p>
          <div class="meta">
            <span class="pill">${escapeHtml(difficultyLabel(entry))}</span>
            <span class="pill">${escapeHtml(uiText[lang].deviceKind[entry.device] || uiText[lang].deviceKind.core)}</span>
            <span class="pill">${escapeHtml(uiText[lang].deviceUnit(devices))}</span>
          </div>
        </div>
      </a>
    `;
  }

  function render() {
    const filtered = allEntries.filter(entryMatches);
    const groups = new Map();

    filtered.forEach((entry) => {
      const category = categoryFor(entry);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(entry);
    });

    stats.textContent = uiText[lang].stats(allEntries.length, filtered.length);

    if (!filtered.length) {
      gallery.innerHTML = `<div class="empty">${escapeHtml(uiText[lang].empty)}</div>`;
      return;
    }

    gallery.innerHTML = [...groups.entries()].map(([category, entries]) => {
      const cards = entries
        .sort((a, b) => sortValue(a, a._index) - sortValue(b, b._index) || displayTitle(a).localeCompare(displayTitle(b)))
        .map(card)
        .join('');
      return `
        <section class="category">
          <h2>${escapeHtml(categoryLabels[lang][category] || category)}</h2>
          <div class="grid">${cards}</div>
        </section>
      `;
    }).join('');
  }

  function setError(error) {
    gallery.innerHTML = `<div class="error">${escapeHtml(uiText[lang].loadError(error.message))}</div>`;
  }

  updateStaticText();

  fetch('catalog.json')
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    })
    .then((catalog) => {
      allEntries = (catalog.entries || [])
        .filter(isPublicEntry)
        .map((entry, index) => ({ ...entry, _index: index }))
        .sort((a, b) => sortValue(a, a._index) - sortValue(b, b._index) || displayTitle(a).localeCompare(displayTitle(b)));
      populateFilters(allEntries);
      applyInitialFilters();
      applyLanguage(getInitialLanguage());
      render();
    })
    .catch(setError);

  [categoryFilter, deviceFilter, difficultyFilter, searchFilter].forEach((control) => {
    control.addEventListener('input', render);
  });

  languageToggle.addEventListener('click', () => {
    applyLanguage(lang === 'ja' ? 'en' : 'ja', { persist: true });
  });
}());
