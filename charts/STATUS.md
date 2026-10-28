# Career-ChartUI — STATUS

**As of:** 2026-10-28 ~02:20 HKT (Asia/Hong_Kong)  
**Path:** `/workspace/career-rhythm-fight/charts/`

## Priority 1 — shipped

| File | Role |
|------|------|
| `chart-engine.js` | Pure timing/judge + note expand (hold/double/burst/combo/swipe/lanes) |
| `career-charts.js` | `CareerCharts.start` + `play`/`destroy` bout shim + canvas HUD |
| `career-charts.css` | Premium dark compact HUD |
| `demo.html` | Standalone: tabs 拳｜劍｜暗器, Start, judgments, combo |
| `test-engine.mjs` | Node asserts → `PASS` |
| `EMBED.md` | CombatFeel integration |
| `README.md` | API quickref |

## API (unchanged CEO lock)

```js
CareerCharts.start({ type: 'punch'|'sword'|'projectile', onComplete })
// onComplete({ judgment: 'perfect'|'good'|'miss', accuracy: 0..1 })
```

Map: punch=拳圓點, sword=劍線型, projectile=暗器線型+連擊 (+ burst).

## Variants (on top of core three)

- **hold** — press + release hits (`holdMs`, default 400)
- **multi-lane** — lanes 0/1/2 (Z / Space / X or click Y thirds)
- **swipe** (sword) — `dir` + arrow keys or drag
- **burst** (projectile) — 4–6 tight flurry hits
- **double** — 2-tap mini chain
- **combo** — 2–4 taps (暗器)

## Timing

- Perfect `|Δ| ≤ 40ms` · Good `|Δ| ≤ 100ms` · else Miss  
- **No window retune** this pass (baseline kept).  
- Approach lead: 1200ms · combo gap 70 · double 55 · burst 48

## Open

- Hold is press/release gated (no sustain gauge fill UI).
- Swipe notes reject Space unless `dir` also supplied via arrows/drag.
- Grok Canvas Page still optional / deferred.
- Root `index.html` should load `charts/*.js` after placeholder for live bout — see EMBED.

## Verify

```bash
node /workspace/career-rhythm-fight/charts/test-engine.mjs
# open charts/demo.html
```

## CEO locks (2026-10-28 ~02:20 HKT)

- Defer hold sustain-gauge UI.
- Defer Canvas Page.
- Core+variants as shipped = enough for bout wire.
- Overnight: on-call for CombatFeel integration bugs; optional polish only.
