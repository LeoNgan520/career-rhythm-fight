# charts/ — Career-ChartUI

Fullscreen 應援團-style objects (fills `container` 100%×100%). **No highway / judge-line.**

| type | object |
|------|--------|
| `punch` | 縮圈 circles (tap) |
| `sword` | fast sliders (drag) |
| `projectile` | spinner 轉盤 (hold+spin) |

```js
window.CareerCharts.start({
  type: 'punch' | 'sword' | 'projectile',
  container: document.getElementById('chart-mount'),
  onComplete({ judgment, accuracy, tallies, comboMax }) {}
});
```

Timing: Perfect ±40ms · Good ±100ms. See **EMBED.md**. Demo: open `demo.html`.
