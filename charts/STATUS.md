# Career-ChartUI — STATUS

**As of:** 2026-10-28 ~13:00 HKT (Asia/Hong_Kong)  
**Path:** `/workspace/career-rhythm-fight/charts/`

## Rewrite v3 — 三国武功切磋 (CEO locked)

**REMOVED:** spinner primary gameplay · toy-minigame framing · highway/staff.

**SHIPPED:** fullscreen martial objects — all 8 types:

| `type` | 中文 | kind | Input |
|--------|------|------|-------|
| `punch` | 拳縮圈 | `circle` | Tap when ring meets edge |
| `sword` | 劍滑斬 | `slider` | Fast short drag |
| `brace` | 架開 | `brace` | Hold through clash |
| `deflect` | 撥飛 | `deflect` | Outward swipe |
| `charge` | 蓄力 | `charge` | Hold · release on beat |
| `dodge` | 方向閃 | `dodge` | Swipe L/R/back |
| `lrCombo` | 左右連擊 | `lrCombo` | Sequential side taps |
| `arc` | 弧斬 | `arc` | Arc path follow |

Aliases: `projectile`/`shuriken`/`dart`/`hidden`/`spinner` → `deflect`; `fist` → `punch`.

| Change | Detail |
|--------|--------|
| `chart-engine.js` | 8 kinds; spinner deleted; alias normalize; demo charts |
| `career-charts.js` | Canvas telegraphs for all 8; `onHit` SFX hook; tabs |
| `career-charts.css` | Fullscreen; 8 tab accents; corner HUD |
| `demo.html` | Tabs: 拳縮圈\|劍滑斬\|架開\|撥飛\|蓄力\|方向閃\|左右連擊\|弧斬 |
| `test-engine.mjs` | PASS covering each kind + aliases |
| Docs | EMBED / STATUS / README type id table |

## API

```js
CareerCharts.start({
  type: 'punch'|'sword'|'brace'|'deflect'|'charge'|'dodge'|'lrCombo'|'arc',
  container,
  onComplete({ judgment, accuracy, tallies, comboMax })
})
// → { stop, reset, getResult, beginPlay }
```

## Timing

- Perfect ±40ms · Good ±100ms (tap/release/start) — **unchanged**
- Brace: hold length = `durationMs` (default 280); no wider ± window
- Charge undercharge = ratio of `minChargeMs`, not widened ±

## Verify

```bash
node /workspace/career-rhythm-fight/charts/test-engine.mjs   # must PASS
# open charts/demo.html — each of 8 tabs playable fullscreen
```

**Ready for CombatFeel wire-up** (aliases keep old bout `projectile` calls working → deflect).
