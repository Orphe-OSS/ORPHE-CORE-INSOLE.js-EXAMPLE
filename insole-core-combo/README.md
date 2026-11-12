# ORPHE INSOLE + ORPHE CORE — Simultaneous Connection

A measurement tool that connects **two ORPHE INSOLE units (left/right) and one ORPHE CORE
on a single page**, and records them into one CSV with synchronized timestamps.

- INSOLE ×2: InsoleToolkit (`buildInsoleToolkit`, `insoles[0]` / `insoles[1]`).
  Each is an `OrpheCoreInsole` (insole profile); live pressure comes from `insoles[i].on('press', …)`.
  Live view uses Realtime streaming (gyro, acc, 6ch pressure at 200Hz);
  **during recording it automatically switches to FIFO (lossless recording)**
- CORE ×1: CoreCompanionToolkit (`buildCoreCompanionToolkit`, `orpheCore`). Always Realtime.
  `orpheCore` is an `OrpheCoreInsole` (core profile); IMU values come from
  `orpheCore.on('converted_acc' | 'converted_gyro', …)`
- Recording uses the toolkit session API (`getInsoleToolkitSession(i)`,
  `session.startMeasurement({ profile: 'fifo-recording' })` / `session.stopMeasurement()`)

## Usage

The supported browser is Chrome.

1. Open this page in Chrome (for local use, run `npx serve` or
   `python3 -m http.server` at the repository root and open it via localhost;
   any HTTPS-hosted copy also works)
2. Turn on each toggle in the header → devices starting with `INS` appear in the
   INSOLE dialogs, and devices starting with `CR-` in the CORE dialog
3. Select the CORE mount position (Waist / Chest / Head)
4. **REC** → records up to 30 seconds (manual STOP also possible) → after the drain
   phase (re-collecting outstanding FIFO data) completes, download with **CSV**

## CSV format

Rows from all three devices are mixed in one file, distinguished by the `device`
column. All rows are sorted by timestamp.

```
device,side,timestamp,serial_number,packet_number,press1..press6,acc_x,acc_y,acc_z,gyro_x,gyro_y,gyro_z
insole0,L,1787289494201,4365,0,231,502,...,0.0347,-0.0645,1.0088,0.35,-1.75,0.28
core,waist,1787289494210,17,2,,,,,,,0.1100,0.2200,-0.9900,10.10,-20.20,30.30
```

| Column | Contents |
|---|---|
| `device` | `insole0` / `insole1` / `core` |
| `side` | INSOLE: worn side `L`/`R` (auto-detected from mount_position). CORE: mount position `waist`/`chest`/`head` |
| `timestamp` | epoch ms. **All three devices share the same PC-clock basis** (device clocks are synced to the PC clock on connection; error ≈ BLE round-trip time / 2). On stop, all rows are trimmed to the [REC, STOP] window so the measurement span is aligned across devices |
| `serial_number` / `packet_number` | packet sequence number (uint16) and frame index within the packet (0–3) |
| `press1`–`press6` | 6ch pressure raw ADC values (INSOLE only; dimensionless, not a physical quantity) |
| `acc_*` [G] / `gyro_*` [deg/s] | converted IMU values |

Known limitation: when a recording crosses midnight, INSOLE row timestamps jump by
about 24 hours (same limitation as SENSOR_SPEC.md).
See the comment at the top of `app.js` for time-sync implementation details.

## Recording methods and known limitations (based on device testing)

| Device | Method | Characteristics |
|---|---|---|
| INSOLE, single unit | FIFO (pull-based, lost packets re-requested) | Lossless (zero serial gaps confirmed on real devices) |
| INSOLE, two units simultaneously | FIFO ×2 | **One side may drop data** depending on the host environment (see below) |
| CORE | Realtime (push-based) | Lost packets cannot be recovered. Reception rate depends on the host environment |

- **With two INSOLE units recording simultaneously, host-side BLE load can cause one
  side to fall behind and drop data** (a known limitation also documented in
  `examples/fifo-guide/`). Unrecoverable loss is shown immediately during recording
  as `!loss:n` in the status area and in the console — **only use recordings that
  show no `!loss`**.
- CORE losses can be detected as gaps in the CSV `serial_number` column.
  Always verify recording quality in your own environment.
- The 30-second recording limit matches the INSOLE FIFO on-device buffer (≈30s)
  (`RECORD_LIMIT_MS` in `app.js`).

## Troubleshooting

- Appending `?debug` to the URL shows a CORE notify diagnostics badge
  (per-characteristic reception counts, SV header distribution, packet length)
- When a recording stops, the console logs how many SV packets were received during
  the recording window and how many rows were produced (to distinguish reception-side
  loss from recording-side loss)

## Why CoreCompanionToolkit instead of CoreToolkit?

`buildCoreToolkit` uses the same globals (`cores`) and DOM ID scheme as the
multi-device toolkits. `buildCoreCompanionToolkit` is a single-CORE toolkit that
uses `core_`-namespaced DOM IDs and an independent global `orpheCore`, so it can sit
next to two InsoleToolkit slots on one page.

### CORE units that do not advertise the service UUID

Real CORE units (CR- series) do not include the service UUID in their advertising
packets. The companion toolkit creates `orpheCore` with
`coreProfile({ namePrefix: 'CR-' })`, so the chooser matches by name prefix as well as
by service. For CORE units whose names do not start with `CR-`, use
`buildCoreCompanionToolkit(el, title, { chooserNamePrefix: '...' })`.

## Script load order (important)

```html
<!-- 1. ORPHE-CORE-INSOLE.js (shared CORE / INSOLE SDK, load first) -->
<script src="../vendor/orphe-core-insole.js"></script>
<!-- 2. Toolkits (InsoleToolkit / CoreCompanionToolkit / fifo-recording session) -->
<script src="../vendor/orphe-core-insole-toolkit.js"></script>
```

Both INSOLE and CORE are `OrpheCoreInsole` instances (the device type is selected by
the profile), so subscribe with `on(field, …)`, `onEvent(name, …)` and `onRaw(…)`
instead of assigning `got*` / `on*` callbacks.
