// ORPHE TERMINAL — ORPHE CORE / ORPHE INSOLE の生データを hex で表示・送受信する。
// デバイス種別は device-slot.js のセレクトで選ぶ（変更するとページを再読込する）。

const TEXTAREA_BUFFER_LIMIT = 1024; // 表示用（約 1KB 分の要素）
const FILE_BUFFER_LIMIT = 1024 * 1000 * 10; // CSV 保存用（約 10MB 分の要素）

const DEVICE_LABELS = { core: 'ORPHE CORE', insole: 'ORPHE INSOLE' };

// Device Information のデコード済みテーブルの行定義（kind 別）
const INFO_ROWS = {
    core: [
        { name: 'Battery status', get: (i) => i.battery, abstract: '0:low, 1:normal, 2:high' },
        { name: 'Left Right Information', get: (i) => i.lr, abstract: 'bit0: 0=left / 1=right, bit1: 0=plantar / 1=instep' },
        { name: 'Recording Mode', get: (i) => i.rec_mode, abstract: 'stop:0, recording:1, paused:2' },
        { name: 'Auto Run Recording', get: (i) => i.rec_auto_run, abstract: 'off:0, on:1' },
        { name: 'Log Timer Unit upper', get: (i) => i.time01, abstract: '' },
        { name: 'Log Timer Unit lower', get: (i) => i.time02, abstract: '' },
        { name: 'LED Brightness', get: (i) => i.led_brightness, abstract: '0-255' },
        { name: 'Range of Acc', get: (i) => i.range && i.range.acc, abstract: '0: 2[g], 1: 4[g], 2: 8[g], 3: 16[g]' },
        { name: 'Range of Gyro', get: (i) => i.range && i.range.gyro, abstract: '0: 250[deg/s], 1: 500[deg/s], 2: 1000[deg/s], 3: 2000[deg/s]' },
    ],
    insole: [
        { name: 'Battery status', get: (i) => i.battery, abstract: '0:low, 1:normal, 2:high' },
        { name: 'Mount Position', get: (i) => i.mount_position, abstract: 'bit0: 0=left / 1=right, bit1: 0=plantar / 1=instep' },
        { name: 'Range of Acc', get: (i) => i.range && i.range.acc, abstract: '0: 2[g], 1: 4[g], 2: 8[g], 3: 16[g]' },
        { name: 'Range of Gyro', get: (i) => i.range && i.range.gyro, abstract: '0: 250[deg/s], 1: 500[deg/s], 2: 1000[deg/s], 3: 2000[deg/s]' },
    ],
};

// ─── hex ログ（表示用バッファと CSV 用バッファ） ─────────────────────

function toHex(byte) {
    return byte.toString(16).padStart(2, '0').toUpperCase();
}

function createHexLog(prefix) {
    const textarea = document.querySelector(`#${prefix}_textarea_recv`);
    const textareaSize = document.querySelector(`#${prefix}_textarea_buffer_size`);
    const bufferSize = document.querySelector(`#${prefix}_buffer_size`);
    let textareaBuffer = [];
    let fileBuffer = [];

    // バッファを "AA,BB,CC\n" 形式の文字列にする
    const join = (buffer) => {
        let str = '';
        for (const d of buffer) {
            str += d === '\n' ? d : `${d},`;
        }
        return str;
    };

    const render = () => {
        textarea.value = join(textareaBuffer);
        textarea.scrollTop = textarea.scrollHeight;
        textareaSize.textContent = textareaBuffer.length;
        bufferSize.textContent = fileBuffer.length;
    };

    return {
        // DataView を 1 行として追記する。label があれば先頭列に入れる
        push(data, label) {
            const row = [];
            if (label) row.push(label);
            for (let i = 0; i < data.byteLength; i++) row.push(toHex(data.getUint8(i)));
            row.push('\n');
            textareaBuffer.push(...row);
            fileBuffer.push(...row);
            if (textareaBuffer.length > TEXTAREA_BUFFER_LIMIT) {
                textareaBuffer = textareaBuffer.slice(textareaBuffer.length - TEXTAREA_BUFFER_LIMIT);
            }
            if (fileBuffer.length > FILE_BUFFER_LIMIT) {
                fileBuffer = fileBuffer.slice(fileBuffer.length - FILE_BUFFER_LIMIT);
            }
            render();
        },
        clear() {
            textareaBuffer = [];
            fileBuffer = [];
            render();
        },
        download(filename) {
            const blob = new Blob([join(fileBuffer)], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.setAttribute('download', filename);
            a.click();
            setTimeout(() => window.URL.revokeObjectURL(a.href), 1000);
        },
    };
}

// ─── 状態 ─────────────────────────────────────────────────────────

let is_connected = false;
let is_playing = false;
let number_of_lost_data = 0;

const slot = buildDeviceSlot(document.getElementById('slot0'), 0, {
    storageKey: 'terminal',
    toolkit: false,
    defaultKind: 'insole',
});
const kind = slot.kind;
const device = slot.device;
const deviceLabel = DEVICE_LABELS[kind];

const diLog = createHexLog('di');
const dtLog = createHexLog('dt');
const arLog = createHexLog('ar');

function formatNumber(number) {
    return number.toString().padStart(4, '0');
}

// ─── UI ──────────────────────────────────────────────────────────

function setConnectionUI(state) {
    const connectButton = document.querySelector('#connectButton');
    const connectionStatus = document.querySelector('#connectionStatus');
    const labels = {
        connected: ['Disconnect', `Connected (${deviceLabel})`, 'connected'],
        disconnected: ['Connect Device', 'Not Connected', 'disconnected'],
        connecting: ['Connecting...', 'Connecting...', ''],
        disconnecting: ['Disconnecting...', 'Disconnecting...', ''],
        failed: ['Connect Device', 'Connection Failed', 'disconnected'],
        error: ['Connect Device', 'Disconnected (Error)', 'disconnected'],
    };
    const [button, status, className] = labels[state];
    connectButton.textContent = button;
    connectionStatus.textContent = status;
    connectionStatus.className = className;
    // 接続中は begin のオプションを変えられないようにする
    const busy = state !== 'disconnected' && state !== 'failed' && state !== 'error';
    document.querySelector('#coreNotification').disabled = busy;
    document.querySelector('#insoleStreamingMode').disabled = busy;
}

function renderInfoTable(info) {
    const tbody = document.querySelector('#di_table_body');
    tbody.textContent = '';
    for (const row of INFO_ROWS[kind]) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = row.name;
        const value = document.createElement('td');
        value.className = 'info-value-cell';
        const v = info ? row.get(info) : undefined;
        value.textContent = v === undefined || v === null ? '--' : String(v);
        const abstract = document.createElement('td');
        abstract.className = 'info-abstract';
        abstract.textContent = row.abstract;
        tr.append(th, value, abstract);
        tbody.appendChild(tr);
    }
}

function initUI() {
    document.querySelector('#coreNotificationLabel').hidden = kind !== 'core';
    document.querySelector('#insoleStreamingModeLabel').hidden = kind !== 'insole';

    const placeholder = `Please connect ${deviceLabel} to your computer....`;
    for (const id of ['#di_textarea_recv', '#dt_textarea_recv', '#ar_textarea_recv']) {
        document.querySelector(id).placeholder = placeholder;
    }
    renderInfoTable(null);
    setConnectionUI('disconnected');

    document.querySelector('#send_message').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') send(null, 'DEVICE_INFORMATION');
    });
    document.querySelector('#send_date_time_message').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') send(null, 'DATE_TIME');
    });

    document.querySelector('#button_di_clear').addEventListener('click', () => diLog.clear());
    document.querySelector('#button_dt_clear').addEventListener('click', () => dtLog.clear());
    document.querySelector('#button_ar_clear').addEventListener('click', () => arLog.clear());
    document.querySelector('#button_lost_data_clear').addEventListener('click', () => {
        document.querySelector('#textarea_lost_data').value = '';
        number_of_lost_data = 0;
        document.querySelector('#span_lost_data').textContent = number_of_lost_data;
    });

    document.querySelector('#button_di_download').addEventListener('click', () => diLog.download('device_information.csv'));
    document.querySelector('#button_dt_download').addEventListener('click', () => dtLog.download('date_time.csv'));
    document.querySelector('#button_ar_download').addEventListener('click', () => arLog.download('analysis_raw_notify.csv'));

    document.querySelector('#button_ar_pause').addEventListener('click', function () {
        is_playing = !is_playing;
        this.textContent = is_playing ? 'Pause' : 'Play';
    });
}

// ─── デバイスのコールバック ─────────────────────────────────────────

device.onEvent('onConnect', () => {
    const wasConnected = is_connected;
    is_connected = true;
    // 初回接続時のみ表示を再開する（再接続では一時停止状態を保つ）
    if (!wasConnected) {
        is_playing = true;
        document.querySelector('#button_ar_pause').textContent = 'Pause';
    }
    setConnectionUI('connected');
});

device.onEvent('onDisconnect', () => {
    const wasConnected = is_connected;
    is_connected = false;
    is_playing = false;
    setConnectionUI('disconnected');
    // 自分で切断したとき（connectDevice で先に is_connected=false にする）は通知しない
    if (wasConnected) {
        alert(`${deviceLabel}との接続が切れました`);
    }
});

device.on('lost_data', ({ serial, prev }) => {
    const textarea = document.querySelector('#textarea_lost_data');
    textarea.value += `[${formatNumber(number_of_lost_data)}]: ${prev} <-> ${serial}\n`;
    number_of_lost_data++;
    document.querySelector('#span_lost_data').textContent = number_of_lost_data;
    textarea.scrollTop = textarea.scrollHeight;
});

// onRaw で notify の生 DataView が届く（read() の結果はここには来ない）
device.onRaw((uuid, data) => {
    if (uuid === 'DEVICE_INFORMATION') {
        diLog.push(data);
    } else if (uuid === 'DATE_TIME') {
        dtLog.push(data);
    } else if (is_playing) {
        // CORE の STEP_ANALYSIS_AND_SENSOR_VALUES では 2 種類が混ざるので先頭列に uuid を入れる
        const label = device.lastBeginType === 'STEP_ANALYSIS_AND_SENSOR_VALUES' ? uuid : undefined;
        arLog.push(data, label);
    }
});

// ─── 送受信 ───────────────────────────────────────────────────────

function parseHexList(message) {
    const commands = [];
    for (const token of message.split(',')) {
        const trimmed = token.trim();
        if (trimmed === '') continue;
        const value = parseInt(trimmed, 16);
        if (!/^(0x)?[0-9a-f]{1,2}$/i.test(trimmed) || Number.isNaN(value) || value > 0xff) {
            return null;
        }
        commands.push(value);
    }
    return commands.length > 0 ? commands : null;
}

async function send(dom, characteristic = 'DEVICE_INFORMATION') {
    if (!is_connected) {
        alert(`${deviceLabel}に接続してください`);
        return;
    }
    const inputs = {
        DEVICE_INFORMATION: '#send_message',
        DATE_TIME: '#send_date_time_message',
    };
    if (!inputs[characteristic]) {
        alert('characteristicが不正です');
        return;
    }
    const commands = parseHexList(document.querySelector(inputs[characteristic]).value);
    if (!commands) {
        alert('00〜FF の16進数をカンマ区切りで入力してください（例: 01,02,03）');
        return;
    }
    console.log(characteristic, commands);
    try {
        await device.transport.write(characteristic, new Uint8Array(commands));
    } catch (error) {
        console.error('write error:', error);
        alert(`書き込みに失敗しました: ${error && error.message ? error.message : error}`);
    }
}

async function read(dom, characteristic = 'DEVICE_INFORMATION') {
    if (!is_connected) {
        alert(`${deviceLabel}に接続してください`);
        return;
    }
    try {
        if (characteristic === 'DEVICE_INFORMATION') {
            // transport.read('DEVICE_INFORMATION') では profile.device_information が更新されないので commands.readDeviceInformation() を使う
            const info = await device.commands.readDeviceInformation();
            diLog.push(info.raw);
            renderInfoTable(info);
        } else if (characteristic === 'DATE_TIME') {
            const ret = await device.readDateTime();
            dtLog.push(ret.raw);
            document.querySelector('#dt_decoded').textContent = ret.date.toLocaleString();
            document.querySelector('#dt_round_trip_time').textContent = ret.round_trip_time;
        }
    } catch (error) {
        console.error('read error:', error);
        alert(`読み出しに失敗しました: ${error && error.message ? error.message : error}`);
    }
}

// ─── 接続 ─────────────────────────────────────────────────────────

async function connectDevice() {
    if (is_connected) {
        setConnectionUI('disconnecting');
        // 先に切断状態にしておく（onDisconnect は非同期に届くことがあり、自分で切った場合は通知しない）
        is_connected = false;
        is_playing = false;
        try {
            await device.reset();
            setConnectionUI('disconnected');
        } catch (error) {
            console.error('Disconnect error:', error);
            setConnectionUI('error');
        }
        return;
    }

    setConnectionUI('connecting');
    try {
        if (kind === 'core') {
            await device.begin(document.querySelector('#coreNotification').value);
        } else {
            const streamingMode = Number(document.querySelector('#insoleStreamingMode').value);
            await device.begin('SENSOR_VALUES', { streamingMode });
        }
        // begin() が onConnect を呼ばない場合に備えて手動で更新
        if (!is_connected) {
            is_connected = true;
            is_playing = true;
            document.querySelector('#button_ar_pause').textContent = 'Pause';
        }
        setConnectionUI('connected');
        // begin() の中で読んだデバイス情報があればテーブルに出しておく
        if (device.profile.device_information) renderInfoTable(device.profile.device_information);
    } catch (error) {
        console.error('Connection error:', error);
        is_connected = false;
        is_playing = false;
        setConnectionUI('failed');
    }
}

initUI();
