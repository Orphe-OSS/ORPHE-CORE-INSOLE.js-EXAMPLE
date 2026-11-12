/**
 * ORPHE INSOLE — Calibrated Pressure [N]
 *
 * 校正済みの圧力値（荷重[N]）を 6ch の折れ線グラフで表示する最小サンプル。
 *
 *  - on('press')           : ADC 生値
 *  - on('converted_press') : 荷重[N]（このサンプルで使う）
 *
 * 校正値は begin() の中でデバイスから自動取得され、insole.profile.pressure_calibrations に入る
 * （orphe-core-insole.js の形式: 6ch ぶんの { func, coefficients } または null）。
 * 取得できない ch・デバイスは null になり、SDK 内蔵の既定係数（ch ごとの 4 次多項式）で換算される。
 * 接続中は insole.commands.fetchPressureCalibrations() で取り直せる（失敗しても例外は出ず null）。
 */

const HISTORY = 100; // グラフに表示するサンプル数
const LABELS = ['1 つま先内', '2 母趾球', '3 つま先外', '4 中足中央', '5 中足外', '6 踵'];
const COLORS = ['#45e6e6', '#ff6040', '#ffffff', '#7f7f7f', '#ffcd56', '#9966ff'];

const charts = [];
const pending = [[], []]; // 受信したサンプルを描画まで溜めておく
const calibrationKeys = [];
const refetching = [false, false];

// insole.profile.pressure_calibrations を表示用の { sensor_index, func, coeffs } 配列にする（欠けた ch は null）
function pressureCalibrationOf(insole) {
  const list = insole.profile && insole.profile.pressure_calibrations;
  if (!Array.isArray(list) || list.every((c) => !c)) return null;
  return list.map((c, index) => c && { sensor_index: index, func: c.func, coeffs: c.coefficients });
}

// SDK の既定係数（ch ごとの 4 次多項式）。古い SDK では無いので表に出さない
function defaultCoefficientsOf(index) {
  const table = window.OrpheCoreInsoleJS && window.OrpheCoreInsoleJS.DEFAULT_PRESSURE_COEFFICIENTS;
  return table ? table[index] : null;
}

// 校正値の取り直し（SDK が対応していれば使える）
function canRefetch(insole) {
  return !!insole.commands && typeof insole.commands.fetchPressureCalibrations === 'function';
}

function renderCalibration(id) {
  const insole = insoles[id];
  const connected = insole.isConnected();
  const calibration = connected ? pressureCalibrationOf(insole) : null;
  const state = insole.connectionState;
  const fetching = refetching[id];
  const key = JSON.stringify([connected, state, fetching, calibration]);
  if (calibrationKeys[id] === key) return false;
  calibrationKeys[id] = key;

  const calibrated = calibration ? calibration.filter(Boolean).length : 0;
  const source = calibrated === 6 ? 'デバイスの校正値'
    : calibrated > 0 ? '校正値 + 既定係数'
      : connected ? '既定係数' : '未取得';
  charts[id].options.plugins.title.text = `Pressure [N]（${source}）`;
  const status = document.getElementById(`calibration-status${id}`);
  status.textContent = fetching ? '校正値を取り直しています…'
    : state === 'connecting' || state === 'reconnecting' ? '接続中・校正値未取得'
      : !connected ? '未接続・校正値未取得'
        : calibrated === 6 ? 'デバイスから取得した6chの校正値'
          : calibrated > 0 ? `${calibrated}ch は校正値、残りは既定係数で換算`
            : '校正値未取得・荷重は既定係数で換算';

  const refetchButton = document.getElementById(`calibration-refetch${id}`);
  refetchButton.hidden = !canRefetch(insole);
  refetchButton.disabled = !connected || fetching;

  const body = document.getElementById(`calibration-body${id}`);
  body.replaceChildren();
  if (connected) {
    LABELS.forEach((label, index) => {
      const row = calibration && calibration[index];
      const defaults = row ? null : defaultCoefficientsOf(index);
      if (!row && !defaults) return;
      const func = row ? row.func : 1;
      const coeffs = row ? row.coeffs : defaults;
      const tr = document.createElement('tr');
      const values = [label, row ? '個体別' : '既定', func === 0 ? '指数関数 (0)' : '4次多項式 (1)',
        ...coeffs.map((value, i) => func === 0 && i > 2
          ? `${value.toExponential()}（未使用）` : value.toExponential())];
      values.forEach((value, i) => {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.scope = 'row';
        cell.textContent = value;
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
  }
  document.getElementById(`calibration-table${id}`).hidden = body.childElementCount === 0;
  return true;
}

async function refetchCalibration(id) {
  const insole = insoles[id];
  if (!canRefetch(insole) || refetching[id]) return;
  refetching[id] = true;
  try {
    // 失敗しても例外は出ず null。そのときは既定係数で換算される
    await insole.commands.fetchPressureCalibrations();
  } finally {
    refetching[id] = false;
  }
}

function createChart(canvas) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: LABELS.map((label, i) => ({
        label,
        data: [],
        borderColor: COLORS[i],
        backgroundColor: COLORS[i],
        borderWidth: 1.5,
        pointRadius: 0,
      })),
    },
    options: {
      animation: false,
      plugins: { title: { display: true, text: 'Pressure [N]' } },
      scales: { y: { min: 0 } },
    },
  });
}

window.onload = function () {
  for (let id = 0; id < 2; id++) {
    // 1. 接続 UI を作る
    buildInsoleToolkit(document.getElementById(`toolkit${id}`), `INSOLE 0${id + 1}`, id, {
      streamingMode: 4,
      autoReconnect: true,
    });
    charts[id] = createChart(document.getElementById(`chart${id}`));
    document.getElementById(`calibration-refetch${id}`)
      .addEventListener('click', () => refetchCalibration(id));

    // insoles[id] は toolkit が作った OrpheCoreInsole（自分で作り直さない）
    const insole = insoles[id];

    // 2. 荷重[N] を受け取る（100Hz で届くので、ここでは溜めるだけ）
    insole.on('converted_press', (press) => {
      pending[id].push(press.values);
    });
  }

  // 3. 描画は requestAnimationFrame でまとめて行う（毎サンプル update すると重い）
  function render() {
    charts.forEach((chart, id) => {
      // 圧力通知がなくても、校正値の取得・切断を表示に反映する。
      const calibrationChanged = renderCalibration(id);
      if (pending[id].length === 0 && !calibrationChanged) return;
      for (const values of pending[id].splice(0)) {
        chart.data.labels.push('');
        values.forEach((v, ch) => chart.data.datasets[ch].data.push(v));
      }
      const excess = chart.data.labels.length - HISTORY;
      if (excess > 0) {
        chart.data.labels.splice(0, excess);
        chart.data.datasets.forEach((ds) => ds.data.splice(0, excess));
      }
      chart.update();
    });
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
};
