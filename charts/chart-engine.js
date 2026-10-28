/**
 * Career-ChartUI — pure timing / judgment engine (no DOM).
 * Theme: 三国武功切磋 (Three Kingdoms martial sparring). Original art feel only.
 *
 * Canonical types (CEO 2026-10-28 locked — use verbatim):
 *   punch    → circle 縮圈 = 點刺／直拳
 *   sword    → slider 橫斬／連斬 (fast whip)
 *   brace    → brace  架開 hold-brace
 *   deflect  → deflect 撥飛 outward swipe
 *   charge   → charge 蓄力放開
 *   dodge    → dodge  方向閃 L/R/back
 *   lrCombo  → lrCombo 左右連擊
 *   arc      → arc    弧斬 longer martial path
 *
 * Aliases (bout back-compat):
 *   projectile / shuriken / dart / hidden → deflect
 *   fist → punch
 * Spinner gameplay REMOVED (no primary spinner mode).
 *
 * Timing (default): Perfect ±40ms · Good ±100ms for tap/release/start.
 * Brace hold-through uses the same windows for press timing; hold duration
 * is the note's durationMs (no widened ±ms — document only).
 */

export const DEFAULT_WINDOWS = Object.freeze({
  perfectMs: 40,
  goodMs: 100,
});

/** Circle: time from appear → ring meets edge (ideal hit). */
export const CIRCLE_APPROACH_MS = 800;

/** Sword slider: default travel — snappy whip, not leisurely. */
export const SLIDER_DEFAULT_DURATION_MS = 220;
export const SLIDER_MAX_PATH_LEN = 0.28;

/** Arc: longer than sword but still martial-snappy. */
export const ARC_DEFAULT_DURATION_MS = 380;
export const ARC_MAX_PATH_LEN = 0.55;

/** Brace: clash hold window after impact. */
export const BRACE_DEFAULT_DURATION_MS = 280;

/** Charge: minimum hold before release counts as charged. */
export const CHARGE_MIN_MS = 180;
/** Undercharge: released with some charge but short → good if ≥ this ratio of min. */
export const CHARGE_UNDER_GOOD_RATIO = 0.55;

/** Deflect: min outward swipe length (normalized). */
export const DEFLECT_MIN_SWIPE = 0.08;

/** Dodge: min swipe length + direction match. */
export const DODGE_MIN_SWIPE = 0.07;

/** lrCombo: default gap between sequential side taps. */
export const LR_COMBO_INTERVAL_MS = 280;

/** Telegraph lead before ideal t (visual only; engine uses approachMs on notes). */
export const TELEGRAPH_MS = 650;

/** @deprecated highway approach alias */
export const APPROACH_MS = CIRCLE_APPROACH_MS;

/** @typedef {'perfect'|'good'|'miss'} Judgment */
/** @typedef {'punch'|'sword'|'brace'|'deflect'|'charge'|'dodge'|'lrCombo'|'arc'} ChartType */
/** @typedef {'circle'|'slider'|'brace'|'deflect'|'charge'|'dodge'|'lrCombo'|'arc'} NoteKind */
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
 *   dir?: 'L'|'R'|'back'|'left'|'right',
 *   pattern?: Array<'L'|'R'|'left'|'right'>,
 *   intervalMs?: number,
 *   minChargeMs?: number,
 *   id?: string
 * }} ChartNote
 */
/** @typedef {{ perfectMs?: number, goodMs?: number }} JudgeWindows */

export const CANONICAL_TYPES = Object.freeze([
  'punch',
  'sword',
  'brace',
  'deflect',
  'charge',
  'dodge',
  'lrCombo',
  'arc',
]);

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

export function pathLength(points) {
  if (!points || points.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
}

/**
 * Snappy sword slider duration from path length (~160–280ms).
 */
export function sliderDurationMs(points, overrideMs) {
  if (overrideMs != null && Number.isFinite(overrideMs) && overrideMs > 0) {
    return Math.max(120, Math.min(400, overrideMs));
  }
  const len = pathLength(points);
  const raw = 140 + len * 450;
  return Math.max(160, Math.min(280, Math.round(raw)));
}

/**
 * Arc duration — longer than sword, still martial-snappy (~300–480ms).
 */
export function arcDurationMs(points, overrideMs) {
  if (overrideMs != null && Number.isFinite(overrideMs) && overrideMs > 0) {
    return Math.max(220, Math.min(560, overrideMs));
  }
  const len = pathLength(points);
  const raw = 260 + len * 380;
  return Math.max(300, Math.min(480, Math.round(raw)));
}

export function pathProgress(points, sample, prevProgress) {
  if (!points || points.length < 2) return prevProgress || 0;
  const total = pathLength(points);
  if (total <= 1e-9) return 1;
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
            Math.min(1, ((sample.x - ax) * abx + (sample.y - ay) * aby) / (segLen * segLen))
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
  const snap = 0.12;
  let prog = bestAlong / total;
  if (bestD > snap) prog = prevProgress || 0;
  return Math.max(prevProgress || 0, Math.min(1, prog));
}

/** Normalize dir token → 'L' | 'R' | 'back' */
export function normalizeDir(dir) {
  const d = String(dir || '').toLowerCase();
  if (d === 'l' || d === 'left') return 'L';
  if (d === 'r' || d === 'right') return 'R';
  if (d === 'back' || d === 'b' || d === 'down' || d === 's') return 'back';
  return 'L';
}

/**
 * Classify a swipe vector into L / R / back (or null if too short).
 * Screen coords: +x right, +y down. back = primarily upward (away from foe / retreat).
 */
export function classifySwipe(dx, dy, minLen) {
  const len = Math.hypot(dx, dy);
  if (len < (minLen || DODGE_MIN_SWIPE)) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Strong vertical up → back
  if (dy < 0 && ay >= ax * 0.85) return 'back';
  if (dx < 0 && ax >= ay) return 'L';
  if (dx > 0 && ax >= ay) return 'R';
  if (dy < 0) return 'back';
  return null;
}

/** Outward from center: swipe moves away from note center. */
export function isOutwardSwipe(from, to, center, minLen) {
  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const len = Math.hypot(vx, vy);
  if (len < (minLen || DEFLECT_MIN_SWIPE)) return false;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const tx = to.x - center.x;
  const ty = to.y - center.y;
  // End farther from center than start, and movement mostly radial out
  const d0 = Math.hypot(fx, fy);
  const d1 = Math.hypot(tx, ty);
  if (d1 < d0 + 0.02) return false;
  const radial = fx * vx + fy * vy;
  return radial >= 0 || d1 > d0 + minLen * 0.5;
}

/**
 * Normalize / expand one chart note into runtime hit descriptor(s).
 * lrCombo expands to one parent hit with steps[] (resolved as one judgment).
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

  if (kind === 'arc') {
    const points = (note.points || []).map((p) => ({
      x: clamp01(p.x),
      y: clamp01(p.y),
    }));
    const durationMs = arcDurationMs(points, note.durationMs);
    return [
      {
        kind: 'arc',
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

  if (kind === 'brace') {
    const durationMs = Math.max(160, note.durationMs || BRACE_DEFAULT_DURATION_MS);
    return [
      {
        kind: 'brace',
        id: parentId,
        parentId,
        number,
        t: note.t,
        endT: note.t + durationMs,
        durationMs,
        x: clamp01(note.x == null ? 0.5 : note.x),
        y: clamp01(note.y == null ? 0.48 : note.y),
      },
    ];
  }

  if (kind === 'deflect') {
    return [
      {
        kind: 'deflect',
        id: parentId,
        parentId,
        number,
        t: note.t,
        approachMs: Math.max(350, note.approachMs || TELEGRAPH_MS),
        x: clamp01(note.x == null ? 0.5 : note.x),
        y: clamp01(note.y == null ? 0.42 : note.y),
      },
    ];
  }

  if (kind === 'charge') {
    const minChargeMs = Math.max(80, note.minChargeMs || CHARGE_MIN_MS);
    return [
      {
        kind: 'charge',
        id: parentId,
        parentId,
        number,
        t: note.t,
        minChargeMs,
        x: clamp01(note.x == null ? 0.5 : note.x),
        y: clamp01(note.y == null ? 0.5 : note.y),
      },
    ];
  }

  if (kind === 'dodge') {
    const dir = normalizeDir(note.dir || 'L');
    return [
      {
        kind: 'dodge',
        id: parentId,
        parentId,
        number,
        t: note.t,
        dir,
        approachMs: Math.max(350, note.approachMs || TELEGRAPH_MS),
        x: clamp01(note.x == null ? 0.5 : note.x),
        y: clamp01(note.y == null ? 0.5 : note.y),
      },
    ];
  }

  if (kind === 'lrCombo') {
    const pattern = (note.pattern || ['L', 'R']).map(normalizeDir).map((d) => (d === 'back' ? 'L' : d));
    const interval = Math.max(120, note.intervalMs || LR_COMBO_INTERVAL_MS);
    const steps = pattern.map((side, i) => ({
      side,
      t: note.t + i * interval,
      index: i,
    }));
    const endT = steps.length ? steps[steps.length - 1].t : note.t;
    return [
      {
        kind: 'lrCombo',
        id: parentId,
        parentId,
        number,
        t: note.t,
        endT,
        intervalMs: interval,
        pattern,
        steps,
        x: clamp01(note.x == null ? 0.5 : note.x),
        y: clamp01(note.y == null ? 0.55 : note.y),
      },
    ];
  }

  // circle (punch default)
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
  if (note.pattern && note.pattern.length) return 'lrCombo';
  if (note.dir != null && !note.points) return 'dodge';
  if (note.minChargeMs != null) return 'charge';
  if (note.points && note.points.length) {
    const len = pathLength(note.points);
    if (note.kind === 'arc' || len > SLIDER_MAX_PATH_LEN) return note.kind === 'slider' ? 'slider' : 'arc';
    return 'slider';
  }
  if (note.kind) return note.kind;
  return 'circle';
}

export function scheduleHits(chart) {
  const hits = [];
  for (const n of chart || []) hits.push(...expandNoteHits(n));
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
  if (
    hit.kind === 'slider' ||
    hit.kind === 'arc' ||
    hit.kind === 'brace' ||
    hit.kind === 'lrCombo'
  ) {
    return (hit.endT != null ? hit.endT : hit.t) + w.goodMs + 16;
  }
  if (hit.kind === 'charge') {
    return hit.t + w.goodMs + 16;
  }
  return hit.t + w.goodMs + 16;
}

/**
 * Built-in demo charts — martial objects, visual-telegraph first (BPM not locked).
 * @param {string} type
 * @returns {ChartNote[]}
 */
export function demoChart(type) {
  const t = normalizeType(type);

  if (t === 'punch') {
    return [
      { kind: 'circle', t: 900, x: 0.5, y: 0.45, number: 1, id: 'c1' },
      { kind: 'circle', t: 1500, x: 0.28, y: 0.35, number: 2, id: 'c2' },
      { kind: 'circle', t: 2100, x: 0.72, y: 0.55, number: 3, id: 'c3' },
      { kind: 'circle', t: 2700, x: 0.4, y: 0.65, number: 4, id: 'c4' },
      { kind: 'circle', t: 3300, x: 0.62, y: 0.3, number: 5, id: 'c5' },
      { kind: 'circle', t: 3900, x: 0.35, y: 0.5, number: 6, id: 'c6' },
      { kind: 'circle', t: 4500, x: 0.68, y: 0.6, number: 7, id: 'c7' },
      { kind: 'circle', t: 5100, x: 0.5, y: 0.4, number: 8, id: 'c8' },
    ];
  }

  if (t === 'sword') {
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

  if (t === 'brace') {
    return [
      { kind: 'brace', t: 900, durationMs: 280, x: 0.5, y: 0.48, number: 1, id: 'b1' },
      { kind: 'brace', t: 1800, durationMs: 300, x: 0.38, y: 0.42, number: 2, id: 'b2' },
      { kind: 'brace', t: 2700, durationMs: 260, x: 0.62, y: 0.52, number: 3, id: 'b3' },
      { kind: 'brace', t: 3600, durationMs: 320, x: 0.5, y: 0.45, number: 4, id: 'b4' },
      { kind: 'brace', t: 4600, durationMs: 280, x: 0.42, y: 0.55, number: 5, id: 'b5' },
      { kind: 'brace', t: 5500, durationMs: 300, x: 0.58, y: 0.4, number: 6, id: 'b6' },
    ];
  }

  if (t === 'deflect') {
    return [
      { kind: 'deflect', t: 900, x: 0.5, y: 0.4, number: 1, id: 'd1' },
      { kind: 'deflect', t: 1600, x: 0.35, y: 0.45, number: 2, id: 'd2' },
      { kind: 'deflect', t: 2300, x: 0.65, y: 0.38, number: 3, id: 'd3' },
      { kind: 'deflect', t: 3000, x: 0.45, y: 0.5, number: 4, id: 'd4' },
      { kind: 'deflect', t: 3700, x: 0.55, y: 0.42, number: 5, id: 'd5' },
      { kind: 'deflect', t: 4500, x: 0.4, y: 0.48, number: 6, id: 'd6' },
      { kind: 'deflect', t: 5200, x: 0.6, y: 0.45, number: 7, id: 'd7' },
    ];
  }

  if (t === 'charge') {
    return [
      { kind: 'charge', t: 1200, minChargeMs: 200, x: 0.5, y: 0.5, number: 1, id: 'ch1' },
      { kind: 'charge', t: 2400, minChargeMs: 220, x: 0.4, y: 0.45, number: 2, id: 'ch2' },
      { kind: 'charge', t: 3600, minChargeMs: 180, x: 0.6, y: 0.52, number: 3, id: 'ch3' },
      { kind: 'charge', t: 4800, minChargeMs: 240, x: 0.5, y: 0.48, number: 4, id: 'ch4' },
      { kind: 'charge', t: 6000, minChargeMs: 200, x: 0.45, y: 0.55, number: 5, id: 'ch5' },
    ];
  }

  if (t === 'dodge') {
    return [
      { kind: 'dodge', t: 900, dir: 'L', x: 0.5, y: 0.5, number: 1, id: 'dg1' },
      { kind: 'dodge', t: 1600, dir: 'R', x: 0.5, y: 0.48, number: 2, id: 'dg2' },
      { kind: 'dodge', t: 2300, dir: 'back', x: 0.5, y: 0.52, number: 3, id: 'dg3' },
      { kind: 'dodge', t: 3000, dir: 'L', x: 0.48, y: 0.5, number: 4, id: 'dg4' },
      { kind: 'dodge', t: 3700, dir: 'R', x: 0.52, y: 0.48, number: 5, id: 'dg5' },
      { kind: 'dodge', t: 4500, dir: 'back', x: 0.5, y: 0.5, number: 6, id: 'dg6' },
      { kind: 'dodge', t: 5200, dir: 'R', x: 0.5, y: 0.46, number: 7, id: 'dg7' },
    ];
  }

  if (t === 'lrCombo') {
    return [
      { kind: 'lrCombo', t: 800, pattern: ['L', 'R'], intervalMs: 260, number: 1, id: 'lr1' },
      { kind: 'lrCombo', t: 1700, pattern: ['R', 'L'], intervalMs: 260, number: 2, id: 'lr2' },
      { kind: 'lrCombo', t: 2600, pattern: ['L', 'R', 'L'], intervalMs: 240, number: 3, id: 'lr3' },
      { kind: 'lrCombo', t: 3800, pattern: ['R', 'L', 'R'], intervalMs: 240, number: 4, id: 'lr4' },
      { kind: 'lrCombo', t: 5000, pattern: ['L', 'R'], intervalMs: 280, number: 5, id: 'lr5' },
    ];
  }

  // arc — 弧斬／掃腿
  return [
    {
      kind: 'arc',
      t: 800,
      number: 1,
      id: 'a1',
      durationMs: 360,
      points: [
        { x: 0.25, y: 0.55 },
        { x: 0.4, y: 0.35 },
        { x: 0.6, y: 0.35 },
        { x: 0.75, y: 0.55 },
      ],
    },
    {
      kind: 'arc',
      t: 1600,
      number: 2,
      id: 'a2',
      durationMs: 340,
      points: [
        { x: 0.7, y: 0.3 },
        { x: 0.55, y: 0.45 },
        { x: 0.35, y: 0.5 },
        { x: 0.25, y: 0.65 },
      ],
    },
    {
      kind: 'arc',
      t: 2500,
      number: 3,
      id: 'a3',
      durationMs: 400,
      points: [
        { x: 0.3, y: 0.4 },
        { x: 0.45, y: 0.55 },
        { x: 0.65, y: 0.55 },
        { x: 0.75, y: 0.4 },
      ],
    },
    {
      kind: 'arc',
      t: 3500,
      number: 4,
      id: 'a4',
      durationMs: 350,
      points: [
        { x: 0.2, y: 0.5 },
        { x: 0.4, y: 0.3 },
        { x: 0.65, y: 0.35 },
        { x: 0.8, y: 0.55 },
      ],
    },
    {
      kind: 'arc',
      t: 4500,
      number: 5,
      id: 'a5',
      durationMs: 380,
      points: [
        { x: 0.75, y: 0.35 },
        { x: 0.55, y: 0.5 },
        { x: 0.35, y: 0.55 },
        { x: 0.2, y: 0.4 },
      ],
    },
    {
      kind: 'arc',
      t: 5500,
      number: 6,
      id: 'a6',
      durationMs: 360,
      points: [
        { x: 0.35, y: 0.6 },
        { x: 0.5, y: 0.35 },
        { x: 0.7, y: 0.45 },
      ],
    },
  ];
}

/**
 * Runtime tracker — unit-testable without rAF.
 *
 * @param {ChartNote[]} chart
 * @param {JudgeWindows} [windows]
 */
export function createHitTracker(chart, windows) {
  const hits = scheduleHits(chart).map((h) => ({
    ...h,
    resolved: false,
    judgment: /** @type {Judgment|null} */ (null),
    // slider / arc
    sliderStarted: false,
    sliderProgress: 0,
    sliderStartJudgment: /** @type {Judgment|null} */ (null),
    // brace
    braceHeld: false,
    bracePressT: null,
    braceStartJudgment: /** @type {Judgment|null} */ (null),
    // charge
    chargeHeld: false,
    chargePressT: null,
    // deflect / dodge swipe staging
    swipeFrom: null,
    // lrCombo
    lrStep: 0,
    lrJudgments: /** @type {Judgment[]} */ ([]),
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
   * Generic / perfect-play helper.
   * @param {number} nowMs
   * @param {{ kind?: string, targetId?: string, number?: number, side?: string, dx?: number, dy?: number, from?: NormPoint, to?: NormPoint }} [meta]
   */
  function input(nowMs, meta) {
    const m = meta || {};
    const kind = m.kind;

    if (!kind || kind === 'circle' || kind === 'tap') {
      return tapCircle(nowMs, m);
    }
    if (kind === 'slider' || kind === 'arc') {
      return autoCompletePath(nowMs, m, kind === 'arc' ? 'arc' : 'slider');
    }
    if (kind === 'brace') {
      return autoCompleteBrace(nowMs, m);
    }
    if (kind === 'deflect') {
      return autoCompleteDeflect(nowMs, m);
    }
    if (kind === 'charge') {
      return autoCompleteCharge(nowMs, m);
    }
    if (kind === 'dodge') {
      return autoCompleteDodge(nowMs, m);
    }
    if (kind === 'lrCombo') {
      return autoCompleteLrCombo(nowMs, m);
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
      target = currentCircle();
    }
    if (!target) {
      return { judgment: 'miss', hit: null, deltaMs: null };
    }
    const deltaMs = nowMs - target.t;
    if (Math.abs(deltaMs) > w.goodMs) {
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

  // —— Path notes (sword slider / arc) ——
  function beginPath(nowMs, targetId, kind) {
    const k = kind || 'slider';
    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === k)
      : currentOpen(k);
    if (!hit || hit.sliderStarted) return null;
    const delta = nowMs - hit.t;
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

  function beginSlider(nowMs, targetId) {
    return beginPath(nowMs, targetId, 'slider');
  }

  function beginArc(nowMs, targetId) {
    return beginPath(nowMs, targetId, 'arc');
  }

  function movePath(hit, sampleNorm) {
    if (!hit || hit.resolved || !hit.sliderStarted) return 0;
    hit.sliderProgress = pathProgress(hit.points, sampleNorm, hit.sliderProgress);
    return hit.sliderProgress;
  }

  function moveSlider(hit, sampleNorm) {
    return movePath(hit, sampleNorm);
  }

  function endPath(nowMs, hit) {
    if (!hit || hit.resolved) return { judgment: 'miss', hit: null };
    if (!hit.sliderStarted) {
      if (nowMs >= missDeadline(hit, w)) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit };
      }
      return { judgment: 'miss', hit: null };
    }
    const endDelta = nowMs - hit.endT;
    const endJ = judge(endDelta, w);
    const startJ = hit.sliderStartJudgment || 'miss';
    let pathJ = 'miss';
    if (hit.sliderProgress >= 0.92) pathJ = 'perfect';
    else if (hit.sliderProgress >= 0.65) pathJ = 'good';
    const j = combineJudgments([startJ, pathJ, endJ]);
    resolve(hit, j);
    return { judgment: j, hit, progress: hit.sliderProgress };
  }

  function endSlider(nowMs, hit) {
    return endPath(nowMs, hit);
  }

  function autoCompletePath(nowMs, meta, kind) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen(kind);
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    beginPath(hit.t, hit.id, hit.kind);
    hit.sliderProgress = 1;
    return endPath(hit.endT, hit);
  }

  // —— Brace 架開 ——
  function beginBrace(nowMs, targetId) {
    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === 'brace')
      : currentOpen('brace');
    if (!hit || hit.braceHeld) return null;
    if (nowMs < hit.t - w.goodMs) return null;
    if (nowMs > missDeadline(hit, w)) {
      resolve(hit, 'miss');
      return hit;
    }
    hit.braceHeld = true;
    hit.bracePressT = nowMs;
    hit.braceStartJudgment = judge(nowMs - hit.t, w);
    return hit;
  }

  function endBrace(nowMs, hit) {
    if (!hit || hit.resolved) return { judgment: 'miss', hit: null };
    if (!hit.braceHeld) {
      if (nowMs >= missDeadline(hit, w)) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit };
      }
      return { judgment: 'miss', hit: null };
    }
    hit.braceHeld = false;
    const startJ = hit.braceStartJudgment || 'miss';
    // Held through end of clash window?
    if (nowMs >= hit.endT - 8) {
      const j = startJ === 'miss' ? 'good' : startJ;
      resolve(hit, j);
      return { judgment: j, hit, heldThrough: true };
    }
    // Early release after impact → good if past t; else miss
    if (nowMs >= hit.t) {
      resolve(hit, 'good');
      return { judgment: 'good', hit, heldThrough: false };
    }
    resolve(hit, 'miss');
    return { judgment: 'miss', hit, heldThrough: false };
  }

  function autoCompleteBrace(nowMs, meta) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen('brace');
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    beginBrace(hit.t, hit.id);
    return endBrace(hit.endT, hit);
  }

  // —— Deflect 撥飛 ——
  function beginDeflectSwipe(nowMs, targetId, fromNorm) {
    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === 'deflect')
      : currentOpen('deflect');
    if (!hit) return null;
    if (nowMs < hit.t - w.goodMs) return null;
    if (nowMs > missDeadline(hit, w)) {
      resolve(hit, 'miss');
      return hit;
    }
    hit.swipeFrom = fromNorm || { x: hit.x, y: hit.y };
    return hit;
  }

  function endDeflectSwipe(nowMs, hit, toNorm) {
    if (!hit || hit.resolved) return { judgment: 'miss', hit: null };
    const from = hit.swipeFrom || { x: hit.x, y: hit.y };
    const to = toNorm || from;
    const outward = isOutwardSwipe(from, to, { x: hit.x, y: hit.y }, DEFLECT_MIN_SWIPE);
    const deltaMs = nowMs - hit.t;
    hit.swipeFrom = null;
    if (!outward) {
      if (deltaMs > w.goodMs) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit, deltaMs };
      }
      return { judgment: 'miss', hit: null, deltaMs };
    }
    if (Math.abs(deltaMs) > w.goodMs) {
      if (deltaMs > w.goodMs) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit, deltaMs };
      }
      return { judgment: 'miss', hit: null, deltaMs };
    }
    const j = judge(deltaMs, w);
    resolve(hit, j);
    return { judgment: j, hit, deltaMs };
  }

  function autoCompleteDeflect(nowMs, meta) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen('deflect');
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    beginDeflectSwipe(hit.t, hit.id, { x: hit.x, y: hit.y });
    return endDeflectSwipe(hit.t, hit, { x: hit.x + 0.15, y: hit.y - 0.05 });
  }

  // —— Charge 蓄力放開 ——
  function beginCharge(nowMs, targetId) {
    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === 'charge')
      : currentOpen('charge');
    if (!hit || hit.chargeHeld) return null;
    // Allow press early — charge builds toward release at t
    if (nowMs > hit.t + w.goodMs) {
      resolve(hit, 'miss');
      return hit;
    }
    // Too late to start a meaningful charge if past ideal already without hold
    hit.chargeHeld = true;
    hit.chargePressT = nowMs;
    return hit;
  }

  function endCharge(nowMs, hit) {
    if (!hit || hit.resolved) return { judgment: 'miss', hit: null };
    if (!hit.chargeHeld) {
      if (nowMs >= missDeadline(hit, w)) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit };
      }
      return { judgment: 'miss', hit: null };
    }
    hit.chargeHeld = false;
    const held = nowMs - (hit.chargePressT || nowMs);
    const minC = hit.minChargeMs || CHARGE_MIN_MS;
    const releaseDelta = nowMs - hit.t;
    const timingJ = judge(releaseDelta, w);

    if (held < minC * CHARGE_UNDER_GOOD_RATIO) {
      resolve(hit, 'miss');
      return { judgment: 'miss', hit, heldMs: held, deltaMs: releaseDelta };
    }
    if (held < minC) {
      // Undercharge but some charge — good if timing in window, else miss
      if (timingJ === 'miss') {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit, heldMs: held, deltaMs: releaseDelta };
      }
      resolve(hit, 'good');
      return { judgment: 'good', hit, heldMs: held, deltaMs: releaseDelta };
    }
    // Full charge — timing decides (±40/±100 only; no widened window)
    resolve(hit, timingJ);
    return { judgment: timingJ, hit, heldMs: held, deltaMs: releaseDelta };
  }

  function autoCompleteCharge(nowMs, meta) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen('charge');
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    const pressAt = hit.t - (hit.minChargeMs || CHARGE_MIN_MS) - 20;
    beginCharge(pressAt, hit.id);
    return endCharge(hit.t, hit);
  }

  // —— Dodge 方向閃 ——
  function beginDodgeSwipe(nowMs, targetId, fromNorm) {
    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === 'dodge')
      : currentOpen('dodge');
    if (!hit) return null;
    if (nowMs < hit.t - w.goodMs) return null;
    if (nowMs > missDeadline(hit, w)) {
      resolve(hit, 'miss');
      return hit;
    }
    hit.swipeFrom = fromNorm || { x: hit.x, y: hit.y };
    return hit;
  }

  function endDodgeSwipe(nowMs, hit, toNorm) {
    if (!hit || hit.resolved) return { judgment: 'miss', hit: null };
    const from = hit.swipeFrom || { x: hit.x, y: hit.y };
    const to = toNorm || from;
    const classified = classifySwipe(to.x - from.x, to.y - from.y, DODGE_MIN_SWIPE);
    hit.swipeFrom = null;
    const deltaMs = nowMs - hit.t;
    const dirOk = classified === hit.dir;
    if (!dirOk) {
      if (deltaMs > w.goodMs) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit, deltaMs, dir: classified };
      }
      return { judgment: 'miss', hit: null, deltaMs, dir: classified };
    }
    if (Math.abs(deltaMs) > w.goodMs) {
      if (deltaMs > w.goodMs) {
        resolve(hit, 'miss');
        return { judgment: 'miss', hit, deltaMs, dir: classified };
      }
      return { judgment: 'miss', hit: null, deltaMs, dir: classified };
    }
    const j = judge(deltaMs, w);
    resolve(hit, j);
    return { judgment: j, hit, deltaMs, dir: classified };
  }

  function autoCompleteDodge(nowMs, meta) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen('dodge');
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    beginDodgeSwipe(hit.t, hit.id, { x: hit.x, y: hit.y });
    let to = { x: hit.x, y: hit.y };
    if (hit.dir === 'L') to = { x: hit.x - 0.12, y: hit.y };
    else if (hit.dir === 'R') to = { x: hit.x + 0.12, y: hit.y };
    else to = { x: hit.x, y: hit.y - 0.12 };
    return endDodgeSwipe(hit.t, hit, to);
  }

  // —— lrCombo 左右連擊 ——
  function tapLrCombo(nowMs, side, targetId) {
    const sideN = normalizeDir(side);
    const sideLR = sideN === 'back' ? null : sideN;
    if (!sideLR) return { judgment: 'miss', hit: null };

    let hit = targetId
      ? hits.find((h) => !h.resolved && h.id === targetId && h.kind === 'lrCombo')
      : currentOpen('lrCombo');
    if (!hit) return { judgment: 'miss', hit: null };

    const step = hit.steps[hit.lrStep];
    if (!step) {
      resolve(hit, combineJudgments(hit.lrJudgments));
      return { judgment: hit.judgment, hit };
    }

    // Wrong side before window → ignore; after → miss step
    if (sideLR !== step.side) {
      if (nowMs > step.t + w.goodMs) {
        hit.lrJudgments.push('miss');
        hit.lrStep += 1;
        if (hit.lrStep >= hit.steps.length) {
          const j = combineJudgments(hit.lrJudgments);
          resolve(hit, j);
          return { judgment: j, hit };
        }
      }
      return { judgment: 'miss', hit: null };
    }

    const deltaMs = nowMs - step.t;
    if (deltaMs < -w.goodMs) {
      return { judgment: 'miss', hit: null, deltaMs };
    }
    if (deltaMs > w.goodMs) {
      hit.lrJudgments.push('miss');
    } else {
      hit.lrJudgments.push(judge(deltaMs, w));
    }
    hit.lrStep += 1;
    if (hit.lrStep >= hit.steps.length) {
      const j = combineJudgments(hit.lrJudgments);
      resolve(hit, j);
      return { judgment: j, hit, deltaMs };
    }
    return { judgment: hit.lrJudgments[hit.lrJudgments.length - 1], hit: null, deltaMs, partial: true };
  }

  function autoCompleteLrCombo(nowMs, meta) {
    const hit = meta.targetId
      ? hits.find((h) => !h.resolved && h.id === meta.targetId)
      : currentOpen('lrCombo');
    if (!hit) return { judgment: 'miss', hit: null, deltaMs: null };
    let out = { judgment: 'miss', hit: null };
    for (const step of hit.steps) {
      out = tapLrCombo(step.t, step.side, hit.id);
    }
    return out.hit ? out : { judgment: hit.judgment || 'miss', hit, deltaMs: null };
  }

  function tick(nowMs) {
    const missed = [];
    for (const h of hits) {
      if (h.resolved) continue;

      if ((h.kind === 'slider' || h.kind === 'arc') && h.sliderStarted) {
        if (nowMs >= missDeadline(h, w)) {
          endPath(nowMs, h);
          missed.push(h);
        }
        continue;
      }

      if (h.kind === 'brace' && h.braceHeld) {
        if (nowMs >= h.endT) {
          endBrace(nowMs, h);
          missed.push(h);
        }
        continue;
      }

      if (h.kind === 'charge' && h.chargeHeld) {
        // Still holding past good window after ideal → force release miss/good
        if (nowMs >= h.t + w.goodMs + 16) {
          endCharge(nowMs, h);
          missed.push(h);
        }
        continue;
      }

      if (h.kind === 'lrCombo') {
        // Miss overdue steps
        while (h.lrStep < h.steps.length && nowMs >= h.steps[h.lrStep].t + w.goodMs + 16) {
          h.lrJudgments.push('miss');
          h.lrStep += 1;
        }
        if (h.lrStep >= h.steps.length && !h.resolved) {
          const j = combineJudgments(h.lrJudgments);
          resolve(h, j);
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
    beginArc,
    moveSlider: movePath,
    movePath,
    endSlider: endPath,
    endPath,
    beginBrace,
    endBrace,
    beginDeflectSwipe,
    endDeflectSwipe,
    beginCharge,
    endCharge,
    beginDodgeSwipe,
    endDodgeSwipe,
    tapLrCombo,
    currentCircle,
    currentOpen,
    tick,
    isComplete,
    result,
    getCombo: () => combo,
    getTallies: () => ({ ...tallies }),
  };
}

/**
 * Normalize bout alias → canonical type.
 * projectile / shuriken / dart / hidden → deflect (spinner removed).
 */
export function normalizeType(type) {
  if (type === 'projectile' || type === 'shuriken' || type === 'dart' || type === 'hidden') {
    return 'deflect';
  }
  if (type === 'fist') return 'punch';
  if (type === 'spinner') return 'deflect'; // deprecated → deflect
  return type;
}

/** Map chart type → primary note kind */
export function typeToKind(type) {
  const t = normalizeType(type);
  const map = {
    punch: 'circle',
    sword: 'slider',
    brace: 'brace',
    deflect: 'deflect',
    charge: 'charge',
    dodge: 'dodge',
    lrCombo: 'lrCombo',
    arc: 'arc',
  };
  return map[t] || 'circle';
}

export function isCanonicalType(type) {
  return CANONICAL_TYPES.includes(normalizeType(type));
}

if (typeof window !== 'undefined') {
  window.CareerChartEngine = {
    DEFAULT_WINDOWS,
    CIRCLE_APPROACH_MS,
    SLIDER_DEFAULT_DURATION_MS,
    SLIDER_MAX_PATH_LEN,
    ARC_DEFAULT_DURATION_MS,
    ARC_MAX_PATH_LEN,
    BRACE_DEFAULT_DURATION_MS,
    CHARGE_MIN_MS,
    CHARGE_UNDER_GOOD_RATIO,
    DEFLECT_MIN_SWIPE,
    DODGE_MIN_SWIPE,
    LR_COMBO_INTERVAL_MS,
    TELEGRAPH_MS,
    APPROACH_MS,
    CANONICAL_TYPES,
    judge,
    judgmentScore,
    aggregateJudgment,
    accuracyFromTallies,
    combineJudgments,
    clamp01,
    dist,
    pathLength,
    sliderDurationMs,
    arcDurationMs,
    pathProgress,
    normalizeDir,
    classifySwipe,
    isOutwardSwipe,
    expandNoteHits,
    scheduleHits,
    demoChart,
    missDeadline,
    createHitTracker,
    normalizeType,
    typeToKind,
    isCanonicalType,
  };
}
