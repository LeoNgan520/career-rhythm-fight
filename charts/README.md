# charts/ — Career-ChartUI

Fullscreen 應援團-style playfield (fills `container` 100%×100%). See **EMBED.md** for CombatFeel / bout host.

```js
window.CareerCharts.start({
  type: 'punch' | 'sword' | 'projectile',
  container: document.getElementById('chart-mount'), // fullscreen host
  onComplete({ judgment, accuracy, tallies, comboMax }) {}
});
```

Timing defaults: Perfect ±40ms · Good ±100ms. 暗器 → `projectile`. Demo: open `demo.html`.
