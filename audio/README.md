# Career Rhythm Fight — war drum loops (procedural · deep 鼉鼓)

Original sine+noise synthesis only. No copyrighted samples / taiko packs / anime themes.

**CEO retune 2026-10-28 HKT:** deeper sub-100Hz body, longer boom decay, fewer snappy hat/rim fills — 低沉大鼓共鳴 / ancient large-drum feel (not modern electronic kick).

All loops locked at **132 BPM** (44.1 kHz mono 16-bit PCM). Reproducible via `python3 gen_war_drums.py` (seed 42).

| File | Description |
|------|-------------|
| `war-drums-sparse.wav` | Slow sparse 鼉鼓 pulse (deep sub boom, rare soft wood) ~10.9s |
| `war-drums-mid.wav` | Mid 战斗鼓: deep boom + soft wood + rare deep fills ~14.5s |
| `war-drums-climax.wav` | Dense escalating 激战鼓 (boom-led, soft quarter knocks — no double-time hats) ~14.5s |
| `war-drums-drone.wav` | Drums + low E1 drone only (no brass/melody) ~10.9s |

Legacy underscore stereo set (`war_drum_*.wav` via `synth_war_drums.py`) is older / brighter — prefer the hyphenated set above.

## Preview

- Open the `.wav` in any player, or:
- `ffplay -nodisp -autoexit audio/war-drums-mid.wav`
- `aplay audio/war-drums-mid.wav`
- Local server: http://127.0.0.1:8765/audio/war-drums-mid.wav
- Also: sparse / climax / drone under the same `/audio/` path
