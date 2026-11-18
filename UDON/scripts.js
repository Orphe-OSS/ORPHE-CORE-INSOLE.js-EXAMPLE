// bles（= cores）は orphe-core-insole-toolkit.js が提供する（OrpheCoreInsole + coreProfile の 2 台）。
// 再宣言すると Toolkit が接続する実体と別物になるため、ここでは宣言しない。
// SDK を読み込めなかったとき（CDN に届かないなど）は CORE の接続だけあきらめる。おためしモードは game.js だけで動く
if (typeof buildCoreToolkit === 'function' && typeof bles !== 'undefined') {
    buildCoreToolkit(document.querySelector('#toolkit_placeholder1'), '01', 0, 'SENSOR_VALUES');
    buildCoreToolkit(document.querySelector('#toolkit_placeholder2'), '02', 1, 'SENSOR_VALUES');
    guardCoreToolkitBluetooth({
        coreIds: [0, 1],
        messageElement: '#ble-support-message'
    });

    // ---------------------------------------------------------------------------
    // ここまでが CORE の接続。ここから下は、届いたセンサー値をゲームへ渡す橋渡しです。
    //
    // 従来は acc（正規化値）の「連続 2 サンプルの差」が 0.06 を超えたら 1 ふみ、という衝撃ベースの判定で、
    // かなり強く踏まないと反応しませんでした。いまは converted_acc（G 単位）をそのまま
    // step-detector.js に流し、感度（しきい値）を画面から選べるようにしています。
    //
    // 注意: onConnect は「CORE 1 台につき 1 回」ではなく GATT characteristic ごとに呼ばれます。
    // 回数を数えて「2 台つながった」と判断すると 1 台で条件を満たしてしまうので、
    // 接続状態は「その足のデータが実際に届いているか」で判断しています（game.js の liveFeet()）。
    // on() / onEvent() は多重登録になるので、ここで 1 回だけ登録します。
    // ---------------------------------------------------------------------------
    bles.forEach(function (ble, index) {
        // 正規化値（-1..1）の最新値。G 換算できないときの予備
        var latestAcc = null;
        ble.on('acc', function (acc) {
            latestAcc = acc;
        });
        ble.on('converted_acc', function (acc) {
            // device_information が読めていない等で G 換算できないときは、正規化値を ±16G とみなして渡す
            if (acc && isFinite(acc.x) && isFinite(acc.y) && isFinite(acc.z)) {
                UdonGame.pushAcc(index, acc);
            } else if (latestAcc) {
                UdonGame.pushAcc(index, {
                    x: latestAcc.x * 16, y: latestAcc.y * 16, z: latestAcc.z * 16, timestamp: latestAcc.timestamp
                });
            }
        });
        // ジャイロは、生データのきろく（画面上の ● ボタン）にだけ使います。ふみの判定には使いません
        ble.on('converted_gyro', function (gyro) {
            UdonGame.pushGyro(index, gyro);
        });
        ble.onEvent('onConnect', function () {
            UdonGame.coreEvent(index, 'connect');
        });
        ble.onEvent('onDisconnect', function () {
            UdonGame.coreEvent(index, 'disconnect');
        });
    });
}
