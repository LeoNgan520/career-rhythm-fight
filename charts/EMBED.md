# Embedding Career Charts into CombatFeel

## Load

```html
<link rel="stylesheet" href="charts/career-charts.css" />
<script src="charts/chart-engine.js"></script>
<script src="charts/career-charts.js"></script>
```

Mount: `#chart-mount`.

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

## Bout shim

`CareerCharts.play(type, mountEl, cb)` maps `shuriken`→`projectile` and capitalizes judgment for `RhythmCharts`.

## Note kinds

`tap` | `hold` | `combo` | `double` | `burst` | `swipe` (+ `lane` 0–2, `dir`, `holdMs`, `comboCount`)

## Pure engine

`CareerChartEngine.judge(deltaMs)` · `createHitTracker(chart)` · ESM `import` from `chart-engine.js`.
