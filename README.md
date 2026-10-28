# Career Rhythm Fight — v0.1

**影炎** (LEFT, dark purple) vs **赤焰** (RIGHT, fiery)  
Standalone HTML rhythm-block turn fighter. No build step. No SNK IP.

Owned by **Career-CombatFeel** · charts by **Career-ChartUI** · art by **Career-CastArt**.


## STATUS (v0.1 — 2026-10-28 HKT)

**Playable + attractive click-through: YES**

- Bout: Idle → 敵方出招 → 招式展示 → CareerCharts.start → Result ×3 (拳/劍/暗器) → end
- Cast: 影炎 LEFT (`ying-yan.png`) · 赤焰 RIGHT (`chi-yan.png`) · HUD busts · `.is-hit` flash
- Audio: WebAudio bed + SFX (royalty-free, no KOF IP)
- Charts: `CareerCharts.start` primary (`charts/EMBED.md`); bridge fallback only
- Open: `python3 -m http.server 8765 --directory /workspace/career-rhythm-fight` → http://localhost:8765/

## How to open / play

```bash
python3 -m http.server 8765 --directory /workspace/career-rhythm-fight
# → http://localhost:8765/
```

Or open `index.html` via any static server (ES modules need http(s), not always `file://`).

### Controls
1. **開始對戰** (unlocks WebAudio bed)
2. Watch 赤焰 telegraph → 招式展示 (**拳 / 劍 / 暗器**)
3. Chart overlay: **Space** or **click** to block
4. Perfect / Good / Miss → HP → next beat (3 moves) → end
5. **♪** mute toggle · **再來一場** restart

### Camera
| Phase | Feel |
|-------|------|
| Idle | Subtle drift |
| Enemy / showcase | Orbit + dolly |
| Chart | FREEZE / FOCUS |
| Perfect | Punch-in + gold flash |
| Miss | Shake + red flash |

## File tree

```
career-rhythm-fight/
  index.html
  css/bout.css
  js/boot.js              # loads ChartUI ESM engine → player → audio → bout
  js/bout.js              # state machine + camera + juice
  js/audio.js             # royalty-free WebAudio bed/SFX
  js/chart-bridge.js      # thin CareerCharts.start wrapper (optional)
  js/chart-placeholder.js # DEPRECATED stub
  charts/                 # Career-ChartUI (CareerCharts.start)
  art/                    # CastArt: ying-yan.png, chi-yan.png, …
  README.md
```

## ChartUI integration (primary)

Per `charts/EMBED.md`:

```js
CareerCharts.start({
  type: 'punch' | 'sword' | 'projectile', // 暗器 → projectile
  container: document.getElementById('chart-mount'),
  onComplete({ judgment, accuracy, tallies, comboMax }) { … }
});
```

`bout.js` calls `CareerCharts.start` directly. `chart-bridge.js` is a thin optional adapter only.

## CastArt

| Slot | Alias | File | Side |
|------|-------|------|------|
| `#sprite-player` / `#img-player` | 影炎 | `art/ying-yan.png` | LEFT |
| `#sprite-enemy` / `#img-enemy` | 赤焰 | `art/chi-yan.png` | RIGHT |

PNG shown on load; `cast-silhouettes.css` if img errors.

## Solid vs placeholder

| Solid | Placeholder / deferred |
|-------|------------------------|
| Bout loop 3 moves end-to-end | Deeper move VFX |
| CareerCharts embed | Chart timing polish (ChartUI) |
| Camera modes + juice | Real 3D |
| CastArt PNGs wired | More skins |
| WebAudio bed/SFX | Licensed music pack |

## Handoffs

1. **ChartUI** — tighten windows / charts in `charts/`; keep `start` API
2. **CastArt** — more poses/VFX into `art/`
3. **CombatFeel** — damage table, pacing in `bout.js`
