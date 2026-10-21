const { OrpheCoreInsole, coreProfile } = OrpheCoreInsoleJS;

// ORPHE CORE を生成する（chooser の条件は名前が 'CR-' で始まるデバイス）
function createCore(id) {
    return new OrpheCoreInsole({
        profile: coreProfile({ namePrefix: 'CR-' }),
        id,
        events: {
            onError(error) { console.error(error); },
        },
    });
}

// 複数orphe coreを利用する場合は配列つかうと便利
const bles = [createCore(0), createCore(1)];


function sendLEDMessage(dom) {
    const json = JSON.parse(dom.value);
    const value = json.value;
    const id = json.id;
    if (value >= 0) {
        bles[id].commands.setLED(1, value).catch(console.error);
    }
    else {
        bles[id].commands.setLED(0, value).catch(console.error);
    }
}


function toggleConnect(dom) {
    console.log("toggleConnect(): ", dom.value);
    // ble
    if (dom.checked) {
        // 初めてつなぐ時はbegin()で
        bles[dom.value].begin().catch(console.error);
        document.querySelector(`#slider${dom.value}`).disabled = false;
        document.querySelector(`#btnradio${dom.value * 6 + 1}`).checked = true;
        for (let i = 0 + 6 * dom.value; i < 6 + 6 * dom.value; i++) {
            document.querySelector(`#btnradio${i}`).disabled = false;
        }
    }
    else {
        // 解除
        bles[dom.value].stop();
        document.querySelector(`#slider${dom.value}`).disabled = true;
        for (let i = 0 + 6 * dom.value; i < 6 + 6 * dom.value; i++) {
            document.querySelector(`#btnradio${i}`).disabled = true;
        }
    }

}

document.querySelector('#slider0').addEventListener('change', function () {
    bles[0].commands.setLEDBrightness(Number(this.value)).catch(console.error);
});

document.querySelector('#slider1').addEventListener('change', function () {
    bles[1].commands.setLEDBrightness(Number(this.value)).catch(console.error);
});