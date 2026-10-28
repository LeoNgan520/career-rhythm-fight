# charts/ — Career-ChartUI

See **EMBED.md** for CombatFeel integration.

```js
window.CareerCharts.start({
  type: 'punch' | 'sword' | 'projectile',
  container: document.getElementById('chart-mount'),
  onComplete({ judgment, accuracy, tallies, comboMax }) {}
});
```

暗器 → `projectile`. Demo: open `demo.html`.
