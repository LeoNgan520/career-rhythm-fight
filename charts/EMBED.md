# Embedding Career Charts into CombatFeel

Theme: **三国武功切磋** (martial sparring). Fullscreen objects only — no highway / judge-line.

## Load

```html
<link rel="stylesheet" href="charts/career-charts.css" />
<script type="module">
  import './charts/chart-engine.js'; // also sets window.CareerChartEngine
</script>
<script src="charts/career-charts.js"></script>
```

## Mount expectations (fullscreen)

`CareerCharts.start` paints **inside `container` at 100% × 100%**. Host must give that container the full play area (bout overlay / demo viewport). Corner HUD only.

## CEO API

```js
const handle = window.CareerCharts.start({
  type: 'punch' | 'sword' | 'brace' | 'deflect' | 'charge' | 'dodge' | 'lrCombo' | 'arc',
  container: document.getElementById('chart-mount'),
  onComplete({ judgment, accuracy, tallies, comboMax }) {
    // judgment: 'perfect'|'good'|'miss' · accuracy: 0..1
  },
  onHit({ judgment, type, kind, id }) {}, // optional SFX hook
});
// handle.stop() / handle.reset() / handle.getResult() / handle.beginPlay()
```

## Type id table (locked strings)

| `type` | 中文 | Engine kind | Control |
|--------|------|-------------|---------|
| `punch` | 拳縮圈 | `circle` | Tap when approach ring meets edge · Space = current # |
| `sword` | 劍滑斬 | `slider` | Very fast short-path drag (whip) |
| `brace` | 架開 | `brace` | Press & HOLD through clash window |
| `deflect` | 撥飛 | `deflect` | Short outward swipe away from center |
| `charge` | 蓄力 | `charge` | Hold to charge · release on bright beat |
| `dodge` | 方向閃 | `dodge` | Swipe L / R / back per telegraph |
| `lrCombo` | 左右連擊 | `lrCombo` | Sequential L then R taps (pattern) |
| `arc` | 弧斬 | `arc` | Finger follows arc path (longer than sword, still snappy) |

### Aliases (bout back-compat)

| Alias | Maps to |
|-------|---------|
| `projectile` | `deflect` |
| `shuriken` | `deflect` |
| `dart` / `hidden` | `deflect` |
| `fist` | `punch` |
| `spinner` (deprecated) | `deflect` |

**Spinner gameplay removed** — do not ship spinner as a primary mode.

## Timing windows

- **Perfect** `|Δ| ≤ 40ms` · **Good** `|Δ| ≤ 100ms` · else Miss  
  Applies to tap / release / swipe / path-start timing.
- **No widened ±ms** for brace/charge. Brace uses note `durationMs` (default 280) as the hold-through clash length; press timing still ±40/±100. Charge undercharge uses fill-ratio thresholds (`CHARGE_UNDER_GOOD_RATIO`), not a wider timing window.
- Circle approach: 800ms ring shrink. Sword path: 160–280ms. Arc path: 300–480ms.
- BPM / music **not locked** — rely on visual telegraphs; optional `onHit` SFX callback.

## Bout shim

`CareerCharts.play(type, mountEl, cb)` runs `normalizeType` (so `projectile`→`deflect`) and capitalizes judgment for legacy `RhythmCharts`.
