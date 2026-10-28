/**
 * Career-ChartUI — pure timing / judgment engine (no DOM).
 * Types: punch (拳圓點) | sword (劍線型) | projectile (暗器線型+連擊)
 *
 * Note: {
 *   t: number,              // ms from start
 *   lane?: 0|1|2,           // multi-lane (0 top … 2 bottom); default 1
 *   kind?: 'tap'|'hold'|'combo'|'double'|'burst'|'swipe',
 *   comboCount?: number,    // 2–4 combo / 4–6 burst
 *   holdMs?: number,        // hold length (default 400)
 *   dir?: 'up'|'down'|'left'|'right',  // swipe required direction
 *   id?: string
 * }
 */

export const DEFAULT_WINDOWS = Object.freeze({
  perfectMs: 40,
  goodMs: 100,
});

/** Scroll approach lead time (ms). */
export const APPROACH_MS = 1200;

/** @typedef {'perfect'|'good'|'miss'} Judgment */
/** @typedef {'punch'|'sword'|'projectile'} ChartType */
/** @typedef {'tap'|'hold'|'combo'|'double'|'burst'|'swipe'} NoteKind */
/** @typedef {'up'|'down'|'left'|'right'} SwipeDir */
/**
 * @typedef {{
 *   t: number,
 *   lane?: number,
 *   kind?: NoteKind,
 *   comboCount?: number,
 *   holdMs?: number,
 *   dir?: SwipeDir,
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

function clampLane(lane) {
  const n = lane == null ? 1 : Number(lane);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(2, Math.round(n)));
}

/**
 * Expand one logical note into chronological hit targets.
 * @param {ChartNote} note
 * @param {{ comboGapMs?: number, doubleGapMs?: number, burstGapMs?: number }} [opts]
 */
export function expandNoteHits(note, opts) {
  const o = {
    comboGapMs: 70,
    doubleGapMs: 55,
    burstGapMs: 48,
    ...(opts || {}),
  };
  const parentId = note.id || `n${note.t}`;
  const kind = note.kind || 'tap';
  const lane = clampLane(note.lane);
  const base = { lane, dir: note.dir, parentId, kind };

  if (kind === 'hold') {
    const holdMs = Math.max(200, note.holdMs || 400);
    return [
      {
        ...note,
        ...base,
        id: `${parentId}#press`,
        hitIndex: 0,
        t: note.t,
        phase: 'press',
        holdMs,
      },
      {
        ...note,
        ...base,
        id: `${parentId}#release`,
        hitIndex: 1,
        t: note.t + holdMs,
        phase: 'release',
        holdMs,
      },
    ];
  }

  if (kind === 'double') {
    return [0, 1].map((i) => ({
      ...note,
      ...base,
      id: `${parentId}#${i}`,
      hitIndex: i,
      t: note.t + i * o.doubleGapMs,
      kind: 'double',
      comboCount: 2,
    }));
  }

  if (kind === 'burst') {
    const count = Math.max(4, Math.min(6, note.comboCount || 5));
    const hits = [];
    for (let i = 0; i < count; i++) {
      hits.push({
        ...note,
        ...base,
        id: `${parentId}#${i}`,
        hitIndex: i,
        t: note.t + i * o.burstGapMs,
        kind: 'burst',
        comboCount: count,
      });
    }
    return hits;
  }

  if (kind === 'combo') {
    const count = Math.max(2, Math.min(4, note.comboCount || 3));
    const hits = [];
    for (let i = 0; i < count; i++) {
      hits.push({
        ...note,
        ...base,
        id: `${parentId}#${i}`,
        hitIndex: i,
        t: note.t + i * o.comboGapMs,
        kind: 'combo',
        comboCount: count,
      });
    }
    return hits;
  }

  // tap | swipe
  return [
    {
      ...note,
      ...base,
      id: `${parentId}#0`,
      hitIndex: 0,
      t: note.t,
      phase: kind === 'swipe' ? 'swipe' : 'tap',
    },
  ];
}

export function scheduleHits(chart, opts) {
  const hits = [];
  for (const n of chart || []) hits.push(...expandNoteHits(n, opts));
  hits.sort((a, b) => a.t - b.t || (a.hitIndex || 0) - (b.hitIndex || 0));
  return hits;
}

/**
 * Built-in demo charts — core feel + creative variants.
 * @param {ChartType} type
 * @returns {ChartNote[]}
 */
export function demoChart(type) {
  if (type === 'punch') {
    // 圓點 — multi-lane + double-tap + hold
    return [
      { t: 700, kind: 'tap', lane: 1, id: 'p0' },
      { t: 1300, kind: 'tap', lane: 0, id: 'p1' },
      { t: 1800, kind: 'tap', lane: 2, id: 'p2' },
      { t: 2300, kind: 'double', lane: 1, id: 'p3' },
      { t: 3000, kind: 'tap', lane: 0, id: 'p4' },
      { t: 3500, kind: 'hold', lane: 1, holdMs: 420, id: 'p5' },
      { t: 4400, kind: 'tap', lane: 2, id: 'p6' },
      { t: 4900, kind: 'tap', lane: 1, id: 'p7' },
      { t: 5400, kind: 'double', lane: 0, id: 'p8' },
      { t: 6100, kind: 'tap', lane: 1, id: 'p9' },
    ];
  }
  if (type === 'sword') {
    // 線型 — swipe directions + holds + lanes
    return [
      { t: 800, kind: 'swipe', dir: 'right', lane: 1, id: 's0' },
      { t: 1400, kind: 'swipe', dir: 'down', lane: 0, id: 's1' },
      { t: 2000, kind: 'hold', lane: 1, holdMs: 380, id: 's2' },
      { t: 2800, kind: 'swipe', dir: 'left', lane: 2, id: 's3' },
      { t: 3400, kind: 'swipe', dir: 'up', lane: 1, id: 's4' },
      { t: 4000, kind: 'tap', lane: 0, id: 's5' },
      { t: 4500, kind: 'swipe', dir: 'right', lane: 1, id: 's6' },
      { t: 5100, kind: 'hold', lane: 2, holdMs: 360, id: 's7' },
      { t: 5900, kind: 'swipe', dir: 'down', lane: 1, id: 's8' },
    ];
  }
  // projectile 暗器 — combo + burst flurries + lanes
  return [
    { t: 650, kind: 'tap', lane: 1, id: 'd0' },
    { t: 1200, kind: 'combo', comboCount: 3, lane: 0, id: 'd1' },
    { t: 2000, kind: 'tap', lane: 2, id: 'd2' },
    { t: 2500, kind: 'burst', comboCount: 5, lane: 1, id: 'd3' },
    { t: 3400, kind: 'combo', comboCount: 2, lane: 2, id: 'd4' },
    { t: 4000, kind: 'tap', lane: 0, id: 'd5' },
    { t: 4500, kind: 'burst', comboCount: 4, lane: 1, id: 'd6' },
    { t: 5300, kind: 'double', lane: 2, id: 'd7' },
    { t: 5900, kind: 'combo', comboCount: 3, lane: 1, id: 'd8' },
    { t: 6700, kind: 'tap', lane: 0, id: 'd9' },
  ];
}

export function missDeadline(noteT, windows) {
  const w = { ...DEFAULT_WINDOWS, ...(windows || {}) };
  return noteT + w.goodMs + 16;
}

/**
 * @param {object} hit
 * @param {{ lane?: number, dir?: SwipeDir, phase?: string }} inputMeta
 * @returns {boolean}
 */
export function inputMatchesHit(hit, inputMeta) {
  const meta = inputMeta || {};
  // lane: if player specifies lane, must match; unspecified = any (Space)
  if (meta.lane != null && clampLane(meta.lane) !== clampLane(hit.lane)) {
    return false;
  }
  // swipe direction required
  if (hit.kind === 'swipe' || hit.dir) {
    if (!meta.dir || meta.dir !== hit.dir) return false;
  }
  // hold phases
  if (hit.phase === 'press' && meta.phase === 'release') return false;
  if (hit.phase === 'release' && meta.phase === 'press') return false;
  if (hit.phase === 'release' && meta.phase == null) return false;
  return true;
}

/**
 * Runtime tracker (unit-testable without rAF).
 * @param {ChartNote[]} chart
 * @param {JudgeWindows} [windows]
 */
export function createHitTracker(chart, windows) {
  const hits = scheduleHits(chart).map((h) => ({
    ...h,
    resolved: false,
    judgment: /** @type {Judgment|null} */ (null),
  }));
  const tallies = { perfect: 0, good: 0, miss: 0 };
  let combo = 0;
  let comboMax = 0;
  const w = { ...DEFAULT_WINDOWS, ...(windows || {}) };

  function resolve(hit, j) {
    hit.resolved = true;
    hit.judgment = j;
    tallies[j] += 1;
    if (j === 'miss') combo = 0;
    else {
      combo += 1;
      if (combo > comboMax) comboMax = combo;
    }
  }

  /**
   * @param {number} nowMs
   * @param {{ lane?: number, dir?: SwipeDir, phase?: 'press'|'release' }} [meta]
   */
  function input(nowMs, meta) {
    let best = null;
    let bestAbs = Infinity;
    for (const h of hits) {
      if (h.resolved) continue;
      if (!inputMatchesHit(h, meta)) continue;
      const delta = nowMs - h.t;
      const abs = Math.abs(delta);
      if (abs > w.goodMs) continue;
      if (abs < bestAbs) {
        bestAbs = abs;
        best = h;
      }
    }
    if (!best) {
      return { judgment: 'miss', hit: null, deltaMs: null };
    }
    const deltaMs = nowMs - best.t;
    const j = judge(deltaMs, w);
    resolve(best, j);
    return { judgment: j, hit: best, deltaMs };
  }

  function tick(nowMs) {
    const missed = [];
    for (const h of hits) {
      if (h.resolved) continue;
      if (nowMs >= missDeadline(h.t, w)) {
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
        lane: h.lane,
        dir: h.dir,
        judgment: h.judgment,
      })),
    };
  }

  return {
    hits,
    windows: w,
    input,
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

if (typeof window !== 'undefined') {
  window.CareerChartEngine = {
    DEFAULT_WINDOWS,
    APPROACH_MS,
    judge,
    judgmentScore,
    aggregateJudgment,
    accuracyFromTallies,
    expandNoteHits,
    scheduleHits,
    demoChart,
    missDeadline,
    createHitTracker,
    inputMatchesHit,
    normalizeType,
  };
}
