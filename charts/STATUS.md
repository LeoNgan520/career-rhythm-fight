# Career-ChartUI — STATUS

**As of:** 2026-10-28 ~12:30 HKT (Asia/Hong_Kong)  
**Path:** `/workspace/career-rhythm-fight/charts/`

## Rewrite (2026-10-28) — 應援團 objects (CEO confirmed)

**DROPPED:** scrolling notes into a vertical/horizontal judge line / sheet-music highway.

**SHIPPED:** fullscreen playfield with three object types:

| `type` | Object | Engine kind | Input |
|--------|--------|-------------|-------|
| `punch` | Approach circles 縮圈 | `circle` | Tap when ring meets edge; Space = current # |
| `sword` | Fast sliders | `slider` | Drag short path (whip-slash, 160–280ms) |
| `projectile` | Spinner 轉盤 | `spinner` | Hold + rotate; fill meter = block |

| Change | Detail |
|--------|--------|
| `chart-engine.js` | Circles / sliders / spinners; path helpers; spinner fill thresholds; no highway schedule |
| `career-charts.js` | Canvas draws rings / paths / spinners; no judge-line draw path |
| `career-charts.css` | Fullscreen; centered flash; radial vignette (not corridor) |
| `test-engine.mjs` | Windows + slider speed + spinner fill → `PASS` |
| Docs | EMBED / STATUS / README type mapping |

Deferred: art/music polish, extra VFX, hold-gauge UI, Canvas Page.

## API (unchanged CEO lock — CombatFeel re-host OK)

```js
CareerCharts.start({
  type: 'punch'|'sword'|'projectile',
  container,           // fullscreen (100% of overlay / viewport)
  onComplete({ judgment, accuracy, tallies, comboMax })
})
// → { stop, reset, getResult, beginPlay }
```

## Timing

- Perfect `|Δ| ≤ 40ms` · Good `|Δ| ≤ 100ms` · else Miss (circles + slider start/end)
- Circle approach: 800ms ring shrink
- Slider duration: snappy 160–280ms from path length
- Spinner: fill ≥1.0 perfect · ≥0.55 good · else miss (~1.5 turns)

## Verify

```bash
node /workspace/career-rhythm-fight/charts/test-engine.mjs   # must PASS
# open charts/demo.html — tabs 拳=circles / 劍=sliders / 暗器=spinner, fullscreen
```

Sanity: no leftover highway/judge-line as primary draw mode; `resizeCanvas` must not hardcode `h = 180`.
