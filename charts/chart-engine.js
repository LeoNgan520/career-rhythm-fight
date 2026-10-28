/**
 * Career-ChartUI — pure timing / judgment engine (no DOM).
 *
 * Type mapping (CEO 2026-10-28):
 *   punch      → approach circles 縮圈 (enemy POINT / fist)
 *   sword      → fast sliders       (enemy LINE / slash)
 *   projectile → spinner 轉盤       (guard / block)
 *
 * Note shapes:
 *   circle  { kind:'circle', t, x, y, number?, approachMs?, id? }
 *   slider  { kind:'slider', t, durationMs?, points:[{x,y}…], number?, id? }
 *   spinner { kind:'spinner', t, durationMs?, fillRequired?, x?, y?, id? }
 * Coordinates x/y are normalized 0..1 of the playfield.
 */

export const DEFAULT_WINDOWS = Object.freeze({
  perfectMs: 40,
  goodMs: 100,
});

/** Circle: time from appear → ring meets edge (ideal hit). */
export const CIRCLE_APPROACH_MS = 800;

/** Slider: default travel duration — snappy whip-slash, not leisurely. */
export const SLIDER_DEFAULT_DURATION_MS = 220;

/** Slider: max path length in normalized units for demo helpers. */
export const SLIDER_MAX_PATH_LEN = 0.28;

/** Spinner: radians of spin needed for full fill (≈1.5 turns). */
export const SPINNER_FILL_REQUIRED = Math.PI * 3;

/** Spinner: fill ratio thresholds. */
export const SPINNER_PERFECT_FILL = 1.0;
export const SPINNER_GOOD_FILL = 0.55;

/** @deprecated highway approach — kept as alias so old imports don't crash. Prefer CIRCLE_APPROACH_MS. */
export const APPROACH_MS = CIRCLE_APPROACH_MS;

/** @typedef {'perfect'|'good'|'miss'} Judgment */
/** @typedef {'punch'|'sword'|'projectile'} ChartType */
/** @typedef {'circle'|'slider'|'spinner'} NoteKind */
/**
 * @typedef {{ x: number, y: number }} NormPoint
 * @typedef {{
 *   kind?: NoteKind,
 *   t: number,
 *   x?: number,
 *   y?: number,
 *   number?: number,
 *   approachMs?: number,
 *   durationMs?: number,
 *   points?: NormPoint[],
 *   fillRequired?: number,
 *   id?: string
 * }} ChartNote
 */
/** @typedef {{ perfectMs?: number, goodMs?: number }} JudgeWindows */

/**
 * @param {number} deltaMs
 * @param {JudgeWindows} [windows]
 * @returns {Judgment}
 */
export function judge(deltaMs, windows) {
  const w = { ...DEFAULT_WINDOWS, ...(windows || {}) };
  const abs = Math.abs(Number(deltaMs));
  if (!Number.isFinite(abs)) return 'miss';
  if (abs <= w.perfectMs) return 'perfect';
  if (abs <= w.goodMs) return 'good';
  return 'miss';
}

export function judgmentScore(j) {
  if (j === 'perfect') return 1;
  if (j === 'good') return 0.6;
  return 0;
}

export function aggregateJudgment(tallies) {
  const p = tallies.perfect | 0;
  const g = tallies.good | 0;
  const m = tallies.miss | 0;
  const total = p + g + m;
  if (total === 0) return 'miss';
  const score = (p * 1 + g * 0.6) / total;
  if (score >= 0.85) return 'perfect';
  if (score >= 0.4) return 'good';
  return 'miss';
}

export function accuracyFromTallies(tallies) {
  const p = tallies.perfect | 0;
  const g = tallies.good | 0;
  const m = tallies.miss | 0;
  const total = p + g + m;
  if (total === 0) return 0;
  return (p * 1 + g * 0.6) / total;
}

/** Combine several sub-judgments into one note judgment. */
export function combineJudgments(list) {
  if (!list || !list.length) return 'miss';
  let score = 0;
  for (const j of list) score += judgmentScore(j);
  const avg = score / list.length;
  if (avg >= 0.85) return 'perfect';
  if (avg >= 0.399) return 'good';
  return 'miss';
}

export function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function dist(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return Math.hypot(dx, dy);
}

/** Polyline length in normalized units. */
export function pathLength(points) {
  if (!points || points.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
}

/**
 * Snappy slider duration from path length.
 * Short whip: ~160–280ms. Longer paths still capped.
 */
export function sliderDurationMs(points, overrideMs) {
  if (overrideMs != null && Number.isFinite(overrideMs) && overrideMs > 0) {
    return Math.max(120, Math.min(400, overrideMs));
  }
  const len = pathLength(points);
  // ~0.001 normalized unit / ms at baseline → short paths finish fast
  const raw = 140 + len * 450;
  return Math.max(160, Math.min(280, Math.round(raw)));
}

/**
 * Progress 0..1 of cursor along polyline (nearest-point projection chain).
 * Returns how far along the path the sample has reached (monotonic best).
 */
export function pathProgress(points, sample, prevProgress) {
  if (!points || points.length < 2) return prevProgress || 0;
  const total = pathLength(points);
  if (total <= 1e-9) return 1;
  // Find closest segment + cumulative distance
  let bestD = Infinity;
  let bestAlong = 0;
  let cum = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = dist(a, b);
    const ax = a.x || 0;
    const ay = a.y || 0;
    const bx = b.x || 0;
    const by = b.y || 0;
    const abx = bx - ax;
    const aby = by - ay;
    const t =
      segLen < 1e-9
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((sample.x - ax) * abx + (sample.y - ay) * aby) / (segLen * segLen)
            )
          );
    const px = ax + abx * t;
    const py = ay + aby * t;
    const d = Math.hypot(sample.x - px, sample.y - py);
    if (d < bestD) {
      bestD = d;
      bestAlong = cum + segLen * t;
    }
    cum += segLen;
  }
  // Snap radius: if too far from path, don't advance
  const snap = 0.12;
  let prog = bestAlong / total;
  if (bestD > snap) prog = prevProgress || 0;
  // Monotonic: never go backwards
  return Math.max(prevProgress || 0, Math.min(1, prog));
}

/** Spinner fill judgment from fill ratio (0..1+). */
export function judgeSpinnerFill(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r) || r < SPINNER_GOOD_FILL) return 'miss';
  if (r >= SPINNER_PERFECT_FILL) return 'perfect';
  return 'good';
}

/**
 * Normalize / expand one chart note into a runtime hit descriptor.
 * Circles/sliders/spinners are 1:1 (no multi-hit expand).
 * @param {ChartNote} note
 */
export function expandNoteHits(note) {
  const kind = note.kind || inferKind(note);
  const parentId = note.id || `n${note.t}`;
  const number = note.number != null ? note.number : undefined;

  if (kind === 'slider') {
    const points = (note.points || []).map((p) => ({
      x: clamp01(p.x),
      y: clamp01(p.y),
    }));
    const durationMs = sliderDurationMs(points, note.durationMs);
    return [
      {
        kind: 'slider',
        id: parentId,
        parentId,
        number,
        t: note.t,
        endT: note.t + durationMs,
        durationMs,
        points,
        x: points[0] ? points[0].x : 0.5,
        y: points[0] ? points[0].y : 0.5,
      },
    ];
  }

  if (kind === 'spinner') {
    const durationMs = Math.max(400, note.durationMs || 900);
    const fillRequired = note.fillRequired || SPINNER_FILL_REQUIRED;
    return [
      {
        kind: 'spinner',
        id: parentId,
        parentId,
        number,
        t: note.t,
        endT: note.t + durationMs,
        durationMs,
        fillRequired,
        x: clamp01(note.x == null ? 0.5 : note.x),
        y: clamp01(note.y == null ? 0.5 : note.y),
      },
    ];
  }

  // circle (default)
  const approachMs = Math.max(400, note.approachMs || CIRCLE_APPROACH_MS);
  return [
    {
      kind: 'circle',
      id: parentId,
      parentId,
      number,
      t: note.t,
      approachMs,
      x: clamp01(note.x == null ? 0.5 : note.x),
      y: clamp01(note.y == null ? 0.5 : note.y),
    },
  ];
}

function inferKind(note) {
  if (note.points && note.points.length) return 'slider';
  if (note.fillRequired != null || note.kind === 'spinner') return 'spinner';
  return 'circle';
}

export function scheduleHits(chart) {
  const hits = [];
  for (const n of chart || []) hits.push(...expandNoteHits(n));
  // Number sequence if missing
  let auto = 1;
  for (const h of hits) {
    if (h.number == null) h.number = auto;
    auto = h.number + 1;
  }
  hits.sort((a, b) => a.t - b.t || (a.number || 0) - (b.number || 0));
  return hits;
}

export function missDeadline(hit, windows) {
  const w = { ...DEFAULT_WINDOWS, ...(windows || {}) };
  if (hit.kind === 'slider' || hit.kind === 'spinner') {
    return (hit.endT != null ? hit.endT : hit.t) + w.goodMs + 16;
  }
  return hit.t + w.goodMs + 16;
}

/**
 * Built-in demo charts — Ouendan objects, gameplay-first.
 * @param {ChartType} type
 * @returns {ChartNote[]}
 */
export function demoChart(type) {
  if (type === 'punch') {
    // Approach circles — numbered sequence across the field
    return [
      { kind: 'circle', t: 900, x: 0.5, y: 0.45, number: 1, id: 'c1' },
      { kind: 'circle', t: 1500, x: 0.28, y: 0.35, number: 2, id: 'c2' },
      { kind: 'circle', t: 2100, x: 0.72, y: 0.55, number: 3, id: 'c3' },
      { kind: 'circle', t: 2700, x: 0.4, y: 0.65, number: 4, id: 'c4' },
      { kind: 'circle', t: 3300, x: 0.62, y: 0.3, number: 5, id: 'c5' },
      { kind: 'circle', t: 3900, x: 0.35, y: 0.5, number: 6, id: 'c6' },
      { kind: 'circle', t: 4500, x: 0.68, y: 0.6, number: 7, id: 'c7' },
      { kind: 'circle', t: 5100, x: 0.5, y: 0.4, number: 8, id: 'c8' },
      { kind: 'circle', t: 5700, x: 0.25, y: 0.55, number: 9, id: 'c9' },
      { kind: 'circle', t: 6300, x: 0.75, y: 0.4, number: 10, id: 'c10' },
    ];
  }
  if (type === 'sword') {
    // Fast short sliders — whip-slash arcs / lines
    return [
      {
        kind: 'slider',
        t: 800,
        number: 1,
        id: 's1',
        durationMs: 200,
        points: [
          { x: 0.3, y: 0.4 },
          { x: 0.5, y: 0.35 },
        ],
      },
      {
        kind: 'slider',
        t: 1400,
        number: 2,
        id: 's2',
        durationMs: 180,
        points: [
          { x: 0.65, y: 0.3 },
          { x: 0.7, y: 0.5 },
        ],
      },
      {
        kind: 'slider',
        t: 2000,
        number: 3,
        id: 's3',
        durationMs: 220,
        points: [
          { x: 0.35, y: 0.55 },
          { x: 0.55, y: 0.65 },
          { x: 0.7, y: 0.55 },
        ],
      },
      {
        kind: 'slider',
        t: 2800,
        number: 4,
        id: 's4',
        durationMs: 190,
        points: [
          { x: 0.25, y: 0.35 },
          { x: 0.45, y: 0.45 },
        ],
      },
      {
        kind: 'slider',
        t: 3400,
        number: 5,
        id: 's5',
        durationMs: 200,
        points: [
          { x: 0.6, y: 0.6 },
          { x: 0.4, y: 0.5 },
        ],
      },
      {
        kind: 'slider',
        t: 4100,
        number: 6,
        id: 's6',
        durationMs: 210,
        points: [
          { x: 0.5, y: 0.3 },
          { x: 0.55, y: 0.5 },
          { x: 0.45, y: 0.65 },
        ],
      },
      {
        kind: 'slider',
        t: 4900,
        number: 7,
        id: 's7',
        durationMs: 180,
        points: [
          { x: 0.28, y: 0.5 },
          { x: 0.48, y: 0.4 },
        ],
      },
      {
        kind: 'slider',
        t: 5500,
        number: 8,
        id: 's8',
        durationMs: 200,
        points: [
          { x: 0.7, y: 0.35 },
          { x: 0.55, y: 0.55 },
        ],
      },
    ];
  }
  // projectile — guard spinners
  return [
    {
      kind: 'spinner',
      t: 700,
      durationMs: 1000,
      x: 0.5,
      y: 0.48,
      number: 1,
      id: 'sp1',
    },
    {
      kind: 'spinner',
      t: 2200,
      durationMs: 900,
      x: 0.35,
      y: 0.4,
      number: 2,
      id: 'sp2',
    },
    {
      kind: 'spinner',
      t: 3600,
      durationMs: 1100,
      x: 0.65,
      y: 0.55,
      number: 3,
      id: 'sp3',
    },
    {
      kind: 'spinner',
      t: 5200,
      durationMs: 950,
      x: 0.5,
      y: 0.45,
      number: 4,
      id: 'sp4',
    },
    {
      kind: 'spinner',
      t: 6600,
      durationMs: 1000,
      x: 0.4,
      y: 0.5,
      number: 5,
      id: 'sp5',
    },
  ];
}

/**
 * Runtime tracker — unit-testable without rAF.
 *
 * Circles: input({ kind:'circle', targetId? }) at nowMs
 * Sliders: beginSlider / moveSlider / endSlider
 * Spinners: beginSpinner / spinSpinner(deltaRad) / endSpinner
 *
 * @param {ChartNote[]} chart
 * @param {JudgeWindows} [windows]
 */
export function createHitTracker(chart, windows) {
  const hits = scheduleHits(chart).map((h) => ({
    ...h,
    resolved: false,
    judgment: /** @type {Judgment|null} */ (null),
    // slider runtime
    sliderStarted: false,
    sliderProgress: 0,
    sliderStartJudgment: /** @type {Judgment|null} */ (null),
    // spinner runtime
    spinnerHeld: false,
    spinnerFill: 0,
    spinnerAngle: null,
  }));
  const tallies = { perfect: 0, good: 0, miss: 0 };
  let combo = 0;
  let comboMax = 0;
  const w = { ...DEFAULT_WINDOWS, ...(windows || {}) };

  function resolve(hit, j) {
    if (hit.resolved) return;
    hit.resolved = true;
    hit.judgment = j;
    tallies[j] += 1;
    if (j === 'miss') combo = 0;
    else {
      combo += 1;
      if (combo > comboMax) comboMax = combo;
    }
  }

  /** Next unresolved circle (for Space / current-target tap). */
  function currentCircle() {
    for (const h of hits) {
      if (!h.resolved && h.kind === 'circle') return h;
    }
    return null;
  }

  function currentOpen(kind) {
    for (const h of hits) {
      if (!h.resolved && h.kind === kind) return h;
    }
    return null;
  }

  /**
   * Generic input for circles (and perfect-play helpers).
   * @param {number} nowMs
   * @param {{ kind?: string, targetId?: string, number?: number }} [meta]
   */
  function input(nowMs, meta) {
    const m = meta || {};
    // Prefer explicit circle / default to circle tap
    if (!m.kind || m.kind === 'circle' || m.kind === 'tap') {
      return tapCircle(nowMs, m);
    }
    if (m.kind === 'slider') {
      // Convenience: one-shot perfect path for tests
      return autoCompleteSlider(nowMs, m);
    }
    if (m.kind === 'spinner') {
      return autoCompleteSpinner(nowMs, m);
    }
    return { judgment: 'miss', hit: null, deltaMs: null };
  }

  function tapCircle(nowMs, meta) {
    let target = null;
    if (meta.targetId) {
      target = hits.find((h) => !h.resolved && h.id === meta.targetId && h.kind === 'circle');
    } else if (meta.number != null) {
      target = hits.find(
        (h) => !h.resolved && h.kind === 'circle' && h.number === meta.number
      );
    } else {
      // Current numbered target only (Ouendan sequence)
      target = currentCircle();
    }
    if (!target) {
      return { judgment: 'miss', hit: null, deltaMs: null };
    }
    const deltaMs = nowMs - target.t;
    if (Math.abs(deltaMs) > w.goodMs) {
      // Too early/late for this target — count as miss only if past window;
      // early taps that miss the window don't resolve (player can retry)
      if (deltaMs > w.goodMs) {
        resolve(target, 'miss');
        return { judgment: 'miss', hit: target, deltaMs };
      }
      return { judgment: 'miss', hit: null, deltaMs };
    }
    const j = judge(deltaMs, w);
    resolve(target, j);
    return { judgment: j, hit: target, deltaMs };
  }

  function beginSlider(nowMs, targetId) {
    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === 'slider')
      : currentOpen('slider');
    if (!hit || hit.sliderStarted) return null;
    const delta = nowMs - hit.t;
    // Allow start slightly early within good window, or once past t until deadline
    if (delta < -w.goodMs) return null;
    if (nowMs > missDeadline(hit, w)) {
      resolve(hit, 'miss');
      return hit;
    }
    hit.sliderStarted = true;
    hit.sliderStartJudgment = judge(delta, w);
    hit.sliderProgress = 0;
    return hit;
  }

  function moveSlider(hit, sampleNorm) {
    if (!hit || hit.resolved || !hit.sliderStarted) return 0;
    hit.sliderProgress = pathProgress(hit.points, sampleNorm, hit.sliderProgress);
    return hit.sliderProgress;
  }

  function endSlider(nowMs, hit) {
    if (!hit || hit.resolved) return { judgment: 'miss', hit: null };
    if (!hit.sliderStarted) {
      // Never started — treat as miss if past window
      if (nowMs >= missDeadline(hit, w)) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit };
      }
      return { judgment: 'miss', hit: null };
    }
    const endDelta = nowMs - hit.endT;
    const endJ = judge(endDelta, w);
    const startJ = hit.sliderStartJudgment || 'miss';
    // Path completion: perfect ≥0.92, good ≥0.65, else miss
    let pathJ = 'miss';
    if (hit.sliderProgress >= 0.92) pathJ = 'perfect';
    else if (hit.sliderProgress >= 0.65) pathJ = 'good';
    const j = combineJudgments([startJ, pathJ, endJ]);
    resolve(hit, j);
    return { judgment: j, hit, progress: hit.sliderProgress };
  }

  function autoCompleteSlider(nowMs, meta) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen('slider');
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    beginSlider(hit.t, hit.id);
    hit.sliderProgress = 1;
    return endSlider(hit.endT, hit);
  }

  function beginSpinner(nowMs, targetId) {
    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === 'spinner')
      : currentOpen('spinner');
    if (!hit) return null;
    // Active window: from t - goodMs … endT
    if (nowMs < hit.t - w.goodMs) return null;
    if (nowMs > hit.endT + w.goodMs) {
      resolve(hit, 'miss');
      return hit;
    }
    hit.spinnerHeld = true;
    return hit;
  }

  function spinSpinner(hit, deltaRad) {
    if (!hit || hit.resolved || !hit.spinnerHeld) return 0;
    const d = Math.abs(Number(deltaRad)) || 0;
    hit.spinnerFill += d;
    return hit.spinnerFill / hit.fillRequired;
  }

  function endSpinner(hit) {
    if (!hit || hit.resolved) return { judgment: 'miss', hit: null };
    hit.spinnerHeld = false;
    const ratio = hit.spinnerFill / hit.fillRequired;
    const j = judgeSpinnerFill(ratio);
    resolve(hit, j);
    return { judgment: j, hit, fill: ratio };
  }

  function autoCompleteSpinner(nowMs, meta) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen('spinner');
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    beginSpinner(Math.max(nowMs, hit.t), hit.id);
    hit.spinnerFill = hit.fillRequired;
    return endSpinner(hit);
  }

  function tick(nowMs) {
    const missed = [];
    for (const h of hits) {
      if (h.resolved) continue;
      if (h.kind === 'slider' && h.sliderStarted) {
        // Auto-end if past end + good window
        if (nowMs >= missDeadline(h, w)) {
          const out = endSlider(nowMs, h);
          missed.push(h);
          void out;
        }
        continue;
      }
      if (h.kind === 'spinner' && h.spinnerHeld) {
        if (nowMs >= h.endT) {
          endSpinner(h);
          // not a "miss flash" if filled — still push for UI update
          missed.push(h);
        }
        continue;
      }
      if (nowMs >= missDeadline(h, w)) {
        resolve(h, 'miss');
        missed.push(h);
      }
    }
    return missed;
  }

  function isComplete() {
    return hits.every((h) => h.resolved);
  }

  function result() {
    return {
      judgment: aggregateJudgment(tallies),
      accuracy: accuracyFromTallies(tallies),
      tallies: { ...tallies },
      comboMax,
      hits: hits.map((h) => ({
        id: h.id,
        t: h.t,
        kind: h.kind,
        number: h.number,
        judgment: h.judgment,
      })),
    };
  }

  return {
    hits,
    windows: w,
    input,
    tapCircle,
    beginSlider,
    moveSlider,
    endSlider,
    beginSpinner,
    spinSpinner,
    endSpinner,
    currentCircle,
    currentOpen,
    tick,
    isComplete,
    result,
    getCombo: () => combo,
    getTallies: () => ({ ...tallies }),
  };
}

/** Normalize bout alias → canonical type */
export function normalizeType(type) {
  if (type === 'shuriken' || type === 'dart' || type === 'hidden') return 'projectile';
  if (type === 'fist') return 'punch';
  return type;
}

/** Map chart type → primary note kind */
export function typeToKind(type) {
  const t = normalizeType(type);
  if (t === 'sword') return 'slider';
  if (t === 'projectile') return 'spinner';
  return 'circle';
}

if (typeof window !== 'undefined') {
  window.CareerChartEngine = {
    DEFAULT_WINDOWS,
    CIRCLE_APPROACH_MS,
    SLIDER_DEFAULT_DURATION_MS,
    SLIDER_MAX_PATH_LEN,
    SPINNER_FILL_REQUIRED,
    SPINNER_PERFECT_FILL,
    SPINNER_GOOD_FILL,
    APPROACH_MS,
    judge,
    judgmentScore,
    aggregateJudgment,
    accuracyFromTallies,
    combineJudgments,
    clamp01,
    dist,
    pathLength,
    sliderDurationMs,
    pathProgress,
    judgeSpinnerFill,
    expandNoteHits,
    scheduleHits,
    demoChart,
    missDeadline,
    createHitTracker,
    normalizeType,
    typeToKind,
  };
}
