# Career-ChartUI — STATUS

**As of:** 2026-10-28 ~12:15 HKT (Asia/Hong_Kong)  
**Path:** `/workspace/career-rhythm-fight/charts/`

## Rewrite (2026-10-28) — gameplay-first fullscreen

CEO directive: **not** a sheet-music / card overlay. Chart occupies the **entire viewport** during play (應援團 feel). Notes + judge line are the screen.

| Change | Detail |
|--------|--------|
| `career-charts.css` | Root fills container 100%×100%; no `max-width:540`; stage wrap flex-fills (no fixed 180px); corner HUD only |
| `career-charts.js` | `resizeCanvas()` uses full wrap W×H; large notes via `noteScale(h)`; big vertical judge line (~22% from left); API unchanged |
| Bout host | `#chart-overlay` `position:fixed; inset:0; z-index:60`; `#chart-mount` absolute fill; `#app.chart-open` hides stage |
| Timing | Bout/bridge **no** `{perfectMs:55,goodMs:120}` override — engine defaults **Perfect ±40 / Good ±100** |
| Deferred | Extra VFX, art/music polish, hold-gauge UI, Canvas Page |

## Priority 1 — shipped

| File | Role |
|------|------|
| `chart-engine.js` | Pure timing/judge + note expand (hold/double/burst/combo/swipe/lanes) |
| `career-charts.js` | `CareerCharts.start` + `play`/`destroy` bout shim + fullscreen canvas |
| `career-charts.css` | Fullscreen playfield + minimal corner HUD |
| `demo.html` | Standalone fullscreen: tabs 拳｜劍｜暗器, Start |
| `test-engine.mjs` | Node asserts → `PASS` |
| `EMBED.md` | CombatFeel integration (fullscreen container) |
| `README.md` | API quickref |

## API (unchanged CEO lock)

```js
CareerCharts.start({
  type: 'punch'|'sword'|'projectile',
  container,           // should be fullscreen (100% of overlay / viewport)
  onComplete({ judgment, accuracy })
})
// → { stop, reset, getResult, beginPlay }
```

Map: punch=拳圓點, sword=劍線型, projectile=暗器線型+連擊 (+ burst).

## Timing

- Perfect `|Δ| ≤ 40ms` · Good `|Δ| ≤ 100ms` · else Miss  
- Approach lead: 1200ms · combo gap 70 · double 55 · burst 48

## Verify

```bash
node /workspace/career-rhythm-fight/charts/test-engine.mjs   # must PASS
# open charts/demo.html — fullscreen notes, switch 拳/劍/暗器
# open index.html — during block phase chart fills screen (no card frame)
```

Sanity: `resizeCanvas` must not hardcode `h = 180`; CSS `.cc-stage-wrap` must not be `height: 180px`; bout must not pass custom windows.
