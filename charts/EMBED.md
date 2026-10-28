# Embedding Career Charts into CombatFeel

## Load

```html
<link rel="stylesheet" href="charts/career-charts.css" />
<script type="module">
  import './charts/chart-engine.js'; // also sets window.CareerChartEngine
</script>
<script src="charts/career-charts.js"></script>
```

(Root bout uses `js/boot.js` to sequence engine → player → audio → bridge → bout.)

## Mount expectations (fullscreen)

`CareerCharts.start` paints **inside `container` at 100% × 100%**. The host must give that container the full play area:

- Bout: `#chart-overlay` is `position: fixed; inset: 0; z-index` above fighters; `#chart-mount` fills the overlay; add `#app.chart-open` while the chart is up (host dims/hides the stage).
- Demo: `#mount` is `position: fixed; inset: 0` (viewport).

Do **not** wrap the chart in a small centered card / max-width frame. No scrolling highway / judge-line.

## CEO API

```js
const handle = window.CareerCharts.start({
  type: 'punch' | 'sword' | 'projectile',
  container: document.getElementById('chart-mount'),
  onComplete({ judgment, accuracy, tallies, comboMax }) {
    // judgment: 'perfect'|'good'|'miss'
    // accuracy: 0..1
    resolveBlock(judgment, accuracy);
  },
});
// handle.stop() / handle.reset()
```

Omit `windows` to use engine defaults **Perfect ±40ms / Good ±100ms**.

## Type mapping (2026-10-28)

| `type` | Object | Feel | Input |
|--------|--------|------|-------|
| `punch` | Approach circles 縮圈 | Enemy POINT / fist | Tap circle when ring meets edge · Space = current number |
| `sword` | Fast sliders | Enemy LINE / slash | Drag along short path (snappy) |
| `projectile` | Spinner 轉盤 | Guard / block | Hold + rotate around center until meter fills |

Aliases: `shuriken`/`dart`/`hidden` → `projectile`; `fist` → `punch`.

## Bout shim

`CareerCharts.play(type, mountEl, cb)` maps `shuriken`→`projectile` and capitalizes judgment for `RhythmCharts`.

## Note kinds (engine)

`circle` | `slider` | `spinner` — coords normalized 0..1. See `chart-engine.js` `demoChart()`.

## Pure engine

`CareerChartEngine.judge(deltaMs)` · `createHitTracker(chart)` · `sliderDurationMs` · `judgeSpinnerFill` · ESM `import` from `chart-engine.js`.
