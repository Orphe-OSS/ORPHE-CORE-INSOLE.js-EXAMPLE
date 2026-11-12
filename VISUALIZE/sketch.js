/**
 * ORPHE CORE / INSOLE — VISUALIZE
 *
 * 2台までのデバイスのセンサ値を Chart.js でリアルタイム表示するサンプル。
 * スロットごとに ORPHE CORE / ORPHE INSOLE を選べる（assets/js/device-slot.js）。
 *
 *  - INSOLE: 圧力(6ch)・加速度・ジャイロ・クォータニオン・オイラー角の5チャート
 *  - CORE  : 加速度・ジャイロ・クォータニオン・オイラー角の4チャート（圧力チャートは非表示）
 *
 * 100Hz/200Hz のデータレートに耐えるよう、チャート更新は
 * requestAnimationFrame でスロットリングする（描画は最大30fps、データは全サンプル保持）。
 */

const HISTORY = 100;          // チャートに表示するサンプル数
const RENDER_INTERVAL_MS = 33; // 描画間隔（約30fps）

const SERIES_COLORS = [
    'rgb(69, 230, 230)',
    'rgb(255, 96, 64)',
    'rgb(255, 255, 255)',
    'rgb(127, 127, 127)',
    'rgb(255, 205, 86)',
    'rgb(153, 102, 255)',
];

/**
 * 種別ごとの y 軸レンジ。
 * CORE は旧 CORE 版 VISUALIZE、INSOLE は旧 INSOLE 版 VISUALIZE の設定を引き継ぐ。
 */
const Y_RANGES = {
    core: { acc: [-2, 2], gyro: [-2, 2], quat: [-2, 2], euler: [-Math.PI, Math.PI] },
    insole: { acc: [-1, 1], gyro: [-1, 1], quat: [-1.2, 1.2], euler: [-3.2, 3.2] },
};

/**
 * 折れ線チャートを生成するファクトリ
 */
function makeLineChart(canvasId, title, seriesLabels, range) {
    const datasets = seriesLabels.map((label, i) => ({
        label,
        backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
        borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
        pointRadius: 0,
        borderWidth: 1.5,
        data: [],
    }));
    const scales = {};
    if (Array.isArray(range)) {
        scales.y = { min: range[0], max: range[1] };
    }
    return new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: { labels: [], datasets },
        options: {
            animation: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } },
                title: { display: true, text: title },
            },
            scales,
        },
    });
}

/**
 * 1チャート分の受信バッファ。コールバック（100Hz〜）で push し、
 * 描画ループ（30fps）でまとめて Chart.js に流し込む。
 */
class ChartFeed {
    constructor(chart) {
        this.chart = chart;
        this.pending = [];
        this.count = 0;
    }
    push(values) {
        this.pending.push(values);
    }
    flush() {
        if (this.pending.length === 0) return false;
        const data = this.chart.data;
        for (const values of this.pending) {
            data.labels.push(this.count++);
            values.forEach((v, i) => data.datasets[i].data.push(v));
        }
        this.pending.length = 0;
        while (data.labels.length > HISTORY) {
            data.labels.shift();
            data.datasets.forEach(ds => ds.data.shift());
        }
        return true;
    }
}

const slots = []; // slots[id] = buildDeviceSlot の戻り値 {kind, device, ...}
const feeds = []; // feeds[id] = {press?, acc, gyro, quat, euler}

/**
 * デバイスの装着位置から左右を返す（0=LEFT, 1=RIGHT, null=不明）。
 *  - INSOLE: profile.device_information.mount_position の bit0（0=LEFT, 1=RIGHT）
 *  - CORE  : profile.device_information.lr（0/2=LEFT, 1/3=RIGHT。0xFF などは未設定）
 */
function sideOf(slot) {
    const info = slot.device.profile.device_information;
    if (!info) return null;
    if (slot.kind === 'insole') {
        if (typeof info.mount_position === 'undefined') return null;
        return (info.mount_position & 0b1) === 1 ? 1 : 0;
    }
    if (typeof info.lr !== 'number' || info.lr < 0 || info.lr > 3) return null;
    return info.lr & 0b1;
}

/**
 * 左足デバイスのパネルを画面左、右足デバイスのパネルを画面右に並べ替える。
 * どちらのスロットから接続しても、表示位置は実際の左右に追従する。
 */
function updatePanelOrder() {
    for (let id = 0; id < slots.length; id++) {
        const panel = document.getElementById(`panel${id}`);
        if (!panel) continue;
        const side = sideOf(slots[id]);
        panel.style.order = side === null ? id : side; // 未接続・左右不明時は元の並び
    }
}

/**
 * profile.device_information は接続処理の中で onConnect の後に取得されることがあるため、
 * 左右が分かるまで短時間ポーリングしてからパネルを並べ替える。
 */
function updatePanelOrderWhenReady(id, tries = 20) {
    if (sideOf(slots[id]) !== null) {
        updatePanelOrder();
        return;
    }
    if (tries <= 0) return;
    setTimeout(() => updatePanelOrderWhenReady(id, tries - 1), 250);
}

function createFeeds(id, kind) {
    const range = Y_RANGES[kind];
    const feed = {
        acc: new ChartFeed(makeLineChart(`chart${id}_acc`, 'Accelerometer (normalized)',
            ['x', 'y', 'z'], range.acc)),
        gyro: new ChartFeed(makeLineChart(`chart${id}_gyro`, 'Gyro (normalized)',
            ['x', 'y', 'z'], range.gyro)),
        quat: new ChartFeed(makeLineChart(`chart${id}_quat`, 'Quaternion',
            ['w', 'x', 'y', 'z'], range.quat)),
        euler: new ChartFeed(makeLineChart(`chart${id}_euler`, 'Euler [rad]',
            ['pitch', 'roll', 'yaw'], range.euler)),
    };
    const pressCanvas = document.getElementById(`chart${id}_press`);
    if (kind === 'insole') {
        feed.press = new ChartFeed(makeLineChart(`chart${id}_press`, 'Pressure (6ch raw)',
            ['p0', 'p1', 'p2', 'p3', 'p4', 'p5']));
    } else if (pressCanvas) {
        pressCanvas.hidden = true; // CORE には圧力センサが無い
    }
    return feed;
}

window.onload = function () {
    for (let id = 0; id < 2; id++) {
        const slot = buildDeviceSlot(document.getElementById(`toolkit${id}`), id, {
            title: id === 0 ? '01' : '02',
            storageKey: 'visualize',
            toolkit: true,
            defaultKind: 'insole',
            coreNotification: 'SENSOR_VALUES',
            coreToolkitOptions: { autoReconnect: true },
            insoleToolkitOptions: { streamingMode: 4, autoReconnect: true },
        });
        slots[id] = slot;
        feeds[id] = createFeeds(id, slot.kind);

        const device = slot.device;
        if (slot.kind === 'insole') {
            device.on('press', (press) => {
                feeds[id].press.push(press.values);
            });
        }
        device.on('acc', (acc) => {
            feeds[id].acc.push([acc.x, acc.y, acc.z]);
        });
        device.on('gyro', (gyro) => {
            feeds[id].gyro.push([gyro.x, gyro.y, gyro.z]);
        });
        device.on('quat', (quat) => {
            feeds[id].quat.push([quat.w, quat.x, quat.y, quat.z]);
        });
        device.on('euler', (euler) => {
            feeds[id].euler.push([euler.pitch, euler.roll, euler.yaw]);
        });
        device.on('lost_data', ({ serial, prev }) => {
            console.warn(`${slot.kind.toUpperCase()}${id}: lost packets ${prev} -> ${serial}`);
        });
        device.onEvent('onConnect', () => {
            updatePanelOrderWhenReady(id);
        });
        device.onEvent('onReconnectSuccess', () => {
            updatePanelOrderWhenReady(id);
        });
    }

    // 描画ループ: pending データがあるチャートだけ update する
    let lastRender = 0;
    function renderLoop(now) {
        if (now - lastRender >= RENDER_INTERVAL_MS) {
            lastRender = now;
            for (const feed of feeds) {
                for (const key of Object.keys(feed)) {
                    if (feed[key].flush()) feed[key].chart.update();
                }
            }
        }
        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
};
