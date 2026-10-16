//Starting point of canvas_placeholder
var mycanvas;
function setup() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    //mycanvas = createCanvas(canvas_width, canvas_height, WEBGL);
    mycanvas = createCanvas(canvas_width, canvas_height);
    document.querySelector('#canvas_placeholder').appendChild(mycanvas.elt);
    textSize(16);
    textFont('Roboto');
}

function draw() {
    background(200);
    let s = 'This is a creative canvas using p5.js. \nYou can create the various interactions using sensor data!';
    fill(0);
    text(s, 32, 32);
}

function windowResized() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    resizeCanvas(canvas_width, canvas_height);
}
//End point of canvas_placeholder




window.onload = function () {
    // CoreToolkit を画面に描画。これを呼ばないと接続スイッチが出てこない。
    // bles[0] / bles[1] は CoreToolkit.js が global として宣言済み。
    buildCoreToolkit(document.querySelector('#toolkit_placeholder'),
        '01', 0, 'STEP_ANALYSIS_AND_SENSOR_VALUES');
    buildCoreToolkit(document.querySelector('#toolkit_placeholder'),
        '02', 1, 'STEP_ANALYSIS_AND_SENSOR_VALUES');
    guardCoreToolkitBluetooth({ coreIds: [0, 1], messageElement: '#ble-support-message' });

    for (let ble of bles) {
        ble.onEvent('onConnect', function (uuid) {
            console.log('onConnect:', uuid);
        });
        ble.onEvent('onDisconnect', function () {
            console.log('onDisconnect');
        });

        // 旧 onConnectGATT は onConnect に統合された
        ble.onEvent('onConnect', function (uuid) {
            console.log('> connected GATT!');
            document.getElementById(`uuid_name${ble.id}`).innerHTML = uuid;
        });

        ble.onEvent('onScan', function (deviceName) {
            document.getElementById(`device_name${ble.id}`).innerHTML = deviceName;
        });

        ble.on('quat', function (quat) {
            document.querySelector(`#sq${ble.id}_w`).innerHTML = `${quat.w.toFixed(3)}`;
            document.querySelector(`#sq${ble.id}_x`).innerHTML = `${quat.x.toFixed(3)}`;
            document.querySelector(`#sq${ble.id}_y`).innerHTML = `${quat.y.toFixed(3)}`;
            document.querySelector(`#sq${ble.id}_z`).innerHTML = `${quat.z.toFixed(3)}`;
        });


        ble.on('euler', function (euler) {
            document.querySelector(`#el${ble.id}_x`).innerHTML = `${euler.pitch.toFixed(3)}`;
            document.querySelector(`#el${ble.id}_y`).innerHTML = `${euler.roll.toFixed(3)}`;
            document.querySelector(`#el${ble.id}_z`).innerHTML = `${euler.yaw.toFixed(3)}`;
        });

        ble.on('delta', function (delta) {
            document.querySelector(`#sd${ble.id}_x`).innerHTML = `${delta.x.toFixed(3)}`;
            document.querySelector(`#sd${ble.id}_y`).innerHTML = `${delta.y.toFixed(3)}`;
            document.querySelector(`#sd${ble.id}_z`).innerHTML = `${delta.z.toFixed(3)}`;
        });

        ble.on('gyro', function (gyro) {
            document.querySelector(`#svg${ble.id}_x`).innerHTML = `${gyro.x.toFixed(3)}`;
            document.querySelector(`#svg${ble.id}_y`).innerHTML = `${gyro.y.toFixed(3)}`;
            document.querySelector(`#svg${ble.id}_z`).innerHTML = `${gyro.z.toFixed(3)}`;
        });

        // on('converted_acc') は実 G 値 (range 設定に応じて ±2/±4/±8/±16 G) を返す。
        // テーブル表示用としては正規化値より直感的なのでこちらを使用。
        ble.on('converted_acc', function (acc) {
            document.querySelector(`#sva${ble.id}_x`).innerHTML = `${acc.x.toFixed(3)}`;
            document.querySelector(`#sva${ble.id}_y`).innerHTML = `${acc.y.toFixed(3)}`;
            document.querySelector(`#sva${ble.id}_z`).innerHTML = `${acc.z.toFixed(3)}`;
        });

        ble.on('gait', function (gait) {
            document.querySelector(`#gait${ble.id}_w`).innerHTML = gait.type;
            document.querySelector(`#gait${ble.id}_x`).innerHTML = gait.direction;
            document.querySelector(`#gait${ble.id}_y`).innerHTML = gait.calorie.toFixed(3);
            document.querySelector(`#gait${ble.id}_z`).innerHTML = gait.distance.toFixed(3);
        });
        ble.on('stride', function (stride) {

            document.querySelector(`#stride${ble.id}_x`).innerHTML = stride.x.toFixed(3);
            document.querySelector(`#stride${ble.id}_y`).innerHTML = stride.y.toFixed(3);
            document.querySelector(`#stride${ble.id}_z`).innerHTML = stride.z.toFixed(3);
        });
        ble.on('foot_angle', function (foot_angle) {
            document.querySelector(`#stride${ble.id}_w`).innerHTML = foot_angle.value.toFixed(3);
        });
        ble.on('pronation', function (pronation) {
            document.querySelector(`#pronation${ble.id}_x`).innerHTML = pronation.x.toFixed(3);
            document.querySelector(`#pronation${ble.id}_y`).innerHTML = pronation.y.toFixed(3);
            document.querySelector(`#pronation${ble.id}_z`).innerHTML = pronation.z.toFixed(3);
        });
        ble.on('landing_impact', function (landing_impact) {
            document.querySelector(`#pronation${ble.id}_w`).innerHTML = landing_impact.value.toFixed(3);
        });

        ble.onEvent('onStartNotify', function (uuid) {
            console.log('> Start Notify!');
            document.getElementById(`uuid_name${ble.id}`).innerHTML = uuid;
        });

        ble.onEvent('onStopNotify', function (uuid) {
            console.log('> Stop Notify!');
            //document.getElementById('uuid_name').innerHTML = uuid;
        });
    }
}

