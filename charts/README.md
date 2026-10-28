# charts/ — Career-ChartUI

Fullscreen **三国武功切磋** objects (fills `container` 100%×100%). **No highway / judge-line. No spinner.**

| type | 中文 | control |
|------|------|---------|
| `punch` | 拳縮圈 | shrink-circle tap |
| `sword` | 劍滑斬 | fast short drag |
| `brace` | 架開 | hold through clash |
| `deflect` | 撥飛 | outward swipe |
| `charge` | 蓄力 | hold · release on beat |
| `dodge` | 方向閃 | swipe L/R/back |
| `lrCombo` | 左右連擊 | sequential side taps |
| `arc` | 弧斬 | arc path follow |

Aliases: `projectile`/`shuriken` → `deflect`.

```js
window.CareerCharts.start({
  type: 'punch' | 'sword' | 'brace' | 'deflect' | 'charge' | 'dodge' | 'lrCombo' | 'arc',
  container: document.getElementById('chart-mount'),
  onComplete({ judgment, accuracy, tallies, comboMax }) {}
});
```

Timing: Perfect ±40ms · Good ±100ms. See **EMBED.md**. Demo: open `demo.html`.
