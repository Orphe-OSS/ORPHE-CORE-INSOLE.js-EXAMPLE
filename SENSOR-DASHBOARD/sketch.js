// Sensor Dashboard — ORPHE CORE / ORPHE INSOLE を 2 台まで同時に表示する。
// 各スロットは device-slot.js で CORE / INSOLE を選ぶ（種別変更時はページを再読み込みする）。

//--------------------------------------------------
// センサーカードの生成（左右カラム共通）
//--------------------------------------------------
const SIDE_LABELS = ['Left Foot', 'Right Foot'];

function valueRows(prefix, side, labels, initial = '0.000') {
    return labels.map((label, i) => `
        <div class="value-row">
            <span class="value-label">${label}</span>
            <span class="value-number" id="${prefix}-${i}-${side}">${initial}</span>
        </div>`).join('');
}

function metaInfo(prefix, side) {
    return `
        <div class="meta-info">
            <div>Timestamp: <span id="${prefix}-timestamp-${side}">—</span></div>
            <div>Packet: <span id="${prefix}-packet-${side}">—</span></div>
        </div>`;
}

function card(title, body, className = '') {
    return `<div class="sensor-card ${className}"><div class="sensor-title">${title}</div>${body}</div>`;
}

function infoRow(label, id) {
    return `<div class="info-row"><span class="info-label">${label}:</span><span class="info-value" id="${id}">—</span></div>`;
}

function renderSensorGrid(side) {
    const xyz = ['X', 'Y', 'Z'];
    const html = [
        // 共通
        card('Accelerometer', `<div class="values">${valueRows('acc', side, xyz)}</div>${metaInfo('acc', side)}`),
        card('Gyroscope', `<div class="values">${valueRows('gyro', side, xyz)}</div>${metaInfo('gyro', side)}`),
        card('Quaternion', `<div class="values">${valueRows('quat', side, ['W', 'X', 'Y', 'Z'])}</div>${metaInfo('quat', side)}`),
        card('Euler', `<div class="values">${valueRows('euler', side, ['Pitch', 'Roll', 'Yaw'])}</div>`),
        // INSOLE のみ
        card('Pressure', `<div class="values">${valueRows('press', side, [1, 2, 3, 4, 5, 6].map(n => `Sensor ${n}`), '0')}</div>${metaInfo('press', side)}`, 'insole-only'),
        // CORE のみ（STEP_ANALYSIS）
        card('Gait', `<div class="values">${valueRows('gait', side, ['Type', 'Direction', 'Calorie', 'Distance'])}</div>`, 'core-only'),
        card('Stride', `<div class="values">${valueRows('stride', side, ['Foot Angle', 'X', 'Y', 'Z'])}</div>`, 'core-only'),
        card('Pronation', `<div class="values">${valueRows('pronation', side, ['Landing Impact', 'X', 'Y', 'Z'])}</div>`, 'core-only'),
        card('Delta', `<div class="values">${valueRows('delta', side, xyz)}</div>`, 'core-only'),
        // 共通（最後のカード）
        card('STATUS', `<div id="device-info-${side}" style="margin-top: 15px;">
            ${infoRow('Device', `device-name-${side}`)}
            ${infoRow('Battery', `battery-${side}`)}
            ${infoRow('Mount Position', `mount-position-${side}`)}
            ${infoRow('Acc Range', `acc-range-${side}`)}
            ${infoRow('Gyro Range', `gyro-range-${side}`)}
        </div>`, 'status-card'),
    ];
    document.getElementById(`sensor-grid-${side}`).innerHTML = html.join('');
}

renderSensorGrid(0);
renderSensorGrid(1);

//--------------------------------------------------
// デバイススロット（CORE / INSOLE の選択。setup() は device-slot が呼ぶ）
//--------------------------------------------------
const slots = [0, 1].map(id => buildDeviceSlot(document.getElementById(`slot${id}`), id, {
    storageKey: 'sensor-dashboard',
    toolkit: false,
    defaultKind: 'insole',
}));
const devices = slots.map(slot => slot.device);
const isConnected = [false, false];

// mount_position とデバイスインデックスのマッピング
// mount_position bit0: 0=left, 1=right
// deviceToSideMapping[deviceIndex] = side（0=left, 1=right）
const deviceToSideMapping = {};

// 手動で設定された左右情報を保持（優先される）
const manualSideMapping = {};

// 3D 表示用の最新クォータニオン（side ごと）
const sideQuats = [null, null];

// スロットの種別に合わせて CORE / INSOLE 専用の操作を出し分ける
slots.forEach(slot => {
    document.getElementById(`slot-panel-${slot.id}`).dataset.kind = slot.kind;
});
refreshSideKinds();

//--------------------------------------------------
// コールバック設定
//--------------------------------------------------
function setupCallbacks(deviceIndex) {
    const device = devices[deviceIndex];
    const kind = slots[deviceIndex].kind;
    const sideOf = () => deviceToSideMapping[deviceIndex];

    device.onConnect = function () {
        updateConnectionStatus(deviceIndex, true);
    };

    device.onDisconnect = function () {
        updateConnectionStatus(deviceIndex, false);
        // マッピングをクリア
        const side = deviceToSideMapping[deviceIndex];
        delete deviceToSideMapping[deviceIndex];
        if (side !== undefined) sideQuats[side] = null;
        refreshSideKinds();
    };

    // 加速度 [G]
    device.gotConvertedAcc = function (acc) {
        const side = sideOf();
        if (side === undefined) return;
        updateVec('acc', side, [acc.x, acc.y, acc.z]);
        updateMeta('acc', side, acc);
    };

    // 角速度 [dps]
    device.gotConvertedGyro = function (gyro) {
        const side = sideOf();
        if (side === undefined) return;
        updateVec('gyro', side, [gyro.x, gyro.y, gyro.z]);
        updateMeta('gyro', side, gyro);
    };

    // クォータニオン（3D 表示にも使う。CORE / INSOLE 共通）
    device.gotQuat = function (quat) {
        const side = sideOf();
        if (side === undefined) return;
        sideQuats[side] = quat;
        updateVec('quat', side, [quat.w, quat.x, quat.y, quat.z]);
        updateMeta('quat', side, quat);
    };

    device.gotEuler = function (euler) {
        const side = sideOf();
        if (side === undefined) return;
        updateVec('euler', side, [euler.pitch, euler.roll, euler.yaw]);
    };

    if (kind === 'insole') {
        // 圧力センサー（6ch）
        device.gotPress = function (press) {
            const side = sideOf();
            if (side === undefined) return;
            press.values.forEach((value, i) => setText(`press-${i}-${side}`, value));
            updateMeta('press', side, press);
        };
        return;
    }

    // ─── CORE のみ（STEP_ANALYSIS） ───
    device.gotGait = function (gait) {
        const side = sideOf();
        if (side === undefined) return;
        setText(`gait-0-${side}`, gait.type);
        setText(`gait-1-${side}`, gait.direction);
        setText(`gait-2-${side}`, gait.calorie.toFixed(3));
        setText(`gait-3-${side}`, gait.distance.toFixed(3));
    };
    device.gotStride = function (stride) {
        const side = sideOf();
        if (side === undefined) return;
        updateVec('stride', side, [stride.x, stride.y, stride.z], 1);
    };
    device.gotFootAngle = function (footAngle) {
        const side = sideOf();
        if (side === undefined) return;
        setText(`stride-0-${side}`, footAngle.value.toFixed(3));
    };
    device.gotPronation = function (pronation) {
        const side = sideOf();
        if (side === undefined) return;
        updateVec('pronation', side, [pronation.x, pronation.y, pronation.z], 1);
    };
    device.gotLandingImpact = function (landingImpact) {
        const side = sideOf();
        if (side === undefined) return;
        setText(`pronation-0-${side}`, landingImpact.value.toFixed(3));
    };
    device.gotDelta = function (delta) {
        const side = sideOf();
        if (side === undefined) return;
        updateVec('delta', side, [delta.x, delta.y, delta.z]);
    };
}

setupCallbacks(0);
setupCallbacks(1);

//--------------------------------------------------
// 接続・切断
//--------------------------------------------------
function connectDevice(deviceIndex) {
    const device = devices[deviceIndex];
    const kind = slots[deviceIndex].kind;
    if (isConnected[deviceIndex]) {
        device.reset();
        updateConnectionStatus(deviceIndex, false);
        return;
    }
    // CORE は notification type を選べる。INSOLE は SENSOR_VALUES 固定
    const begin = kind === 'core'
        ? device.begin(document.getElementById(`char${deviceIndex}`).value)
        : device.begin();
    begin
        .then(() => {
            const deviceName = device.bluetoothDevice ? device.bluetoothDevice.name : 'Unknown';
            console.log(`Device ${deviceIndex + 1} connected: ${deviceName}`);
            // begin() 実行後、device_information を参照して左右を決める
            setupDeviceMapping(deviceIndex);
        })
        .catch(error => {
            console.error(`Device ${deviceIndex + 1} connection error:`, error);
            alert(`Device ${deviceIndex + 1} connection failed: ` + error.message);
        });
}

// CORE のみ: 姿勢（クォータニオン計算）をリセット
function resetAttitude(deviceIndex) {
    devices[deviceIndex].resetMotionSensorAttitude().catch(error => {
        console.error(`Device ${deviceIndex + 1} reset attitude error:`, error);
    });
}

//--------------------------------------------------
// 左右マッピング
//--------------------------------------------------
// mount_position（INSOLE）/ lr（CORE）の bit0: 0=left, 1=right / bit1: 0=足底, 1=足背
function mountPositionOf(info) {
    if (!info) return undefined;
    return info.mount_position !== undefined ? info.mount_position : info.lr;
}

function setupDeviceMapping(deviceIndex) {
    try {
        const deviceInfo = devices[deviceIndex].device_information;
        const kind = slots[deviceIndex].kind;
        console.log(`Device ${deviceIndex} info:`, deviceInfo);

        // 生データを16進数で表示
        if (deviceInfo && deviceInfo.raw) {
            let hexString = '';
            for (let i = 0; i < deviceInfo.raw.byteLength; i++) {
                hexString += deviceInfo.raw.getUint8(i).toString(16).padStart(2, '0').toUpperCase() + ' ';
            }
            console.log(`Device ${deviceIndex} raw hex: ${hexString}`);
        }

        // 手動設定が優先。なければ INSOLE は mount_position から自動判定、CORE はスロット番号（01=左, 02=右）
        let side;
        if (manualSideMapping[deviceIndex] !== undefined) {
            side = manualSideMapping[deviceIndex];
            console.log(`Device ${deviceIndex} using manual side setting: ${side} (${side === 0 ? 'left' : 'right'})`);
        } else if (kind === 'insole') {
            if (!deviceInfo) {
                console.error(`Device information not available for device ${deviceIndex}`);
                return;
            }
            const mountPosition = deviceInfo.mount_position;
            side = mountPosition & 1; // bit0 を取り出し: 0=left, 1=right
            console.log(`Device ${deviceIndex} auto-detected side ${side} (${side === 0 ? 'left' : 'right'}) based on mount_position: ${mountPosition} (bit0=${side})`);
        } else {
            side = deviceIndex;
            console.log(`Device ${deviceIndex} (CORE) uses slot side ${side} (${side === 0 ? 'left' : 'right'})`);
        }

        applySide(deviceIndex, side);
    } catch (error) {
        console.error(`Error setting up device mapping for device ${deviceIndex}:`, error);
    }
}

// 手動で左右を変更する
function updateDeviceSide(deviceIndex, newSide) {
    newSide = parseInt(newSide, 10);
    console.log(`Manually setting device ${deviceIndex} to side ${newSide} (${newSide === 0 ? 'left' : 'right'})`);
    manualSideMapping[deviceIndex] = newSide;

    // デバイスが接続されている場合のみマッピングを更新
    if (isConnected[deviceIndex]) {
        const oldSide = deviceToSideMapping[deviceIndex];
        if (oldSide !== undefined && oldSide !== newSide) sideQuats[oldSide] = null;
        applySide(deviceIndex, newSide);
        console.log(`Device ${deviceIndex} remapped from side ${oldSide} to ${newSide}`);
    }
}

function applySide(deviceIndex, side) {
    deviceToSideMapping[deviceIndex] = side;
    const selector = document.getElementById(`side-selector-${deviceIndex}`);
    if (selector) selector.value = side;
    updateDevicePositionInfo(deviceIndex, side);
    updateDeviceInformation(deviceIndex, side);
    refreshSideKinds();
}

// 左右カラムに出すカード（CORE / INSOLE 専用）を、そのカラムに割り当たったデバイスの種別で決める。
// 未割り当てのカラムは同じ番号のスロットの種別に合わせる
function refreshSideKinds() {
    for (let side = 0; side < 2; side++) {
        let kind = slots[side].kind;
        for (const [deviceIndex, mapped] of Object.entries(deviceToSideMapping)) {
            if (mapped === side) kind = slots[Number(deviceIndex)].kind;
        }
        document.getElementById(`side-${side}`).dataset.kind = kind;
    }
}

//--------------------------------------------------
// 表示更新
//--------------------------------------------------
function updateDeviceInformation(deviceIndex, side) {
    try {
        const device = devices[deviceIndex];
        const deviceInfo = device.device_information;
        const name = device.bluetoothDevice ? device.bluetoothDevice.name : '—';
        setText(`device-name-${side}`, `${name || '—'} (${slots[deviceIndex].kind.toUpperCase()})`);
        if (!deviceInfo) return;

        // バッテリー情報 (0: 少ない, 1: 普通, 2: フル)
        if (deviceInfo.battery !== undefined) {
            const batteryLevels = ['Low', 'Normal', 'Full'];
            setText(`battery-${side}`, batteryLevels[deviceInfo.battery] || `Unknown (${deviceInfo.battery})`);
        }

        // 取り付け位置
        const mountPosition = mountPositionOf(deviceInfo);
        if (mountPosition !== undefined) {
            const isLeft = (mountPosition & 1) === 0; // bit0 で左右判定
            const isTopMount = (mountPosition & 2) !== 0; // bit1 で足底/足背判定
            setText(`mount-position-${side}`, `${isLeft ? 'Left' : 'Right'} Foot${isTopMount ? ' (Top)' : ''}`);
        }

        // 加速度レンジ (0: 2g, 1: 4g, 2: 8g, 3: 16g)
        if (deviceInfo.range && deviceInfo.range.acc !== undefined) {
            const accRanges = ['±2g', '±4g', '±8g', '±16g'];
            setText(`acc-range-${side}`, accRanges[deviceInfo.range.acc] || `±${deviceInfo.range.acc}g`);
        }

        // ジャイロレンジ (0: 250, 1: 500, 2: 1000, 3: 2000 deg/s)
        if (deviceInfo.range && deviceInfo.range.gyro !== undefined) {
            const gyroRanges = ['±250°/s', '±500°/s', '±1000°/s', '±2000°/s'];
            setText(`gyro-range-${side}`, gyroRanges[deviceInfo.range.gyro] || `±${deviceInfo.range.gyro}°/s`);
        }
    } catch (error) {
        console.error(`Error updating device information for device ${deviceIndex}:`, error);
    }
}

function updateDevicePositionInfo(deviceIndex, side) {
    setText(`device-position-${deviceIndex}`, SIDE_LABELS[side]);
    document.getElementById(`device-side-info-${deviceIndex}`).classList.add('visible');
}

function updateConnectionStatus(deviceIndex, connected) {
    isConnected[deviceIndex] = connected;
    const statusIndicator = document.getElementById(`status-indicator-${deviceIndex}`);
    const connectBtn = document.getElementById(`connect-btn-${deviceIndex}`);

    statusIndicator.className = connected ? 'status-indicator connected' : 'status-indicator';
    setText(`connection-status-info-${deviceIndex}`, connected ? 'Connected' : 'Not Connected');
    connectBtn.classList.toggle('connected', connected);
    if (!connected) {
        document.getElementById(`device-side-info-${deviceIndex}`).classList.remove('visible');
    }

    // CORE: 接続中は notification type を固定し、姿勢リセットを有効にする
    document.getElementById(`char${deviceIndex}`).disabled = connected;
    document.getElementById(`reset_button${deviceIndex}`).disabled = !connected;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function updateVec(prefix, side, values, offset = 0) {
    values.forEach((value, i) => {
        setText(`${prefix}-${i + offset}-${side}`, typeof value === 'number' ? value.toFixed(3) : value);
    });
}

function updateMeta(prefix, side, sample) {
    setText(`${prefix}-timestamp-${side}`, formatTimestamp(sample.timestamp));
    setText(`${prefix}-packet-${side}`, sample.packet_number ?? '—');
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

//--------------------------------------------------
// p5.js（WEBGL）: 靴モデルを quat で回転して表示
//--------------------------------------------------
let shoeModels = [null, null]; // [Left, Right]
function preload() {
    shoeModels = [
        loadModel('../assets/models/orphe_shoeL3.stl'),
        loadModel('../assets/models/orphe_shoeR3.stl'),
    ];
}

function canvasSize() {
    const width = document.querySelector('#canvas_placeholder').clientWidth;
    return [width, Math.round(width * 9 / 16 * 0.6)];
}

function setup() {
    const [w, h] = canvasSize();
    const mycanvas = createCanvas(w, h, WEBGL);
    document.querySelector('#canvas_placeholder').appendChild(mycanvas.elt);
}

function draw() {
    background(200);
    // VIEW と同じ視点（上下反転のため x=-100 が画面右、x=+100 が画面左に見える）
    camera(
        0, 400, 400,
        0, 0, 0,
        0, 1, 0
    );
    for (let side = 0; side < 2; side++) {
        const quat = sideQuats[side];
        push();
        // Left Foot を画面左、Right Foot を画面右に置く
        translate(side === 0 ? 100 : -100, 0, 0);
        if (quat) {
            const quatr = new toxi.geom.Quaternion(quat.z, -quat.x, quat.y, quat.w);
            const axisAngle = quatr.toAxisAngle();
            rotateZ(PI);
            rotate(axisAngle[0], createVector(axisAngle[1], axisAngle[2], axisAngle[3]));
        }
        // 太陽光が手前上から当たる
        directionalLight(255, 255, 255, 0, -100, -100);
        ambientMaterial(255, 255, 255);
        noStroke();
        model(shoeModels[side]);
        pop();
    }
}

function windowResized() {
    const [w, h] = canvasSize();
    resizeCanvas(w, h);
}
