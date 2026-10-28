/**
 * Node tests for martial chart engine (三国武功切磋).
 * Run: node charts/test-engine.mjs
 */
import {
  judge,
  DEFAULT_WINDOWS,
  aggregateJudgment,
  accuracyFromTallies,
  scheduleHits,
  demoChart,
  createHitTracker,
  expandNoteHits,
  normalizeType,
  typeToKind,
  sliderDurationMs,
  arcDurationMs,
  pathLength,
  pathProgress,
  combineJudgments,
  CIRCLE_APPROACH_MS,
  CANONICAL_TYPES,
  isCanonicalType,
  classifySwipe,
  isOutwardSwipe,
  normalizeDir,
  CHARGE_MIN_MS,
} from './chart-engine.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

assert(DEFAULT_WINDOWS.perfectMs === 40, 'perfect window 40ms');
assert(DEFAULT_WINDOWS.goodMs === 100, 'good window 100ms');
assert(CIRCLE_APPROACH_MS === 800, 'circle approach 800ms');

assert(judge(0) === 'perfect', 'delta 0 → perfect');
assert(judge(40) === 'perfect', 'delta 40 → perfect');
assert(judge(-40) === 'perfect', 'delta -40 → perfect');
assert(judge(41) === 'good', 'delta 41 → good');
assert(judge(-100) === 'good', 'delta -100 → good');
assert(judge(100) === 'good', 'delta 100 → good');
assert(judge(101) === 'miss', 'delta 101 → miss');
assert(judge(-101) === 'miss', 'delta -101 → miss');

assert(aggregateJudgment({ perfect: 8, good: 1, miss: 0 }) === 'perfect', 'agg mostly perfect');
assert(aggregateJudgment({ perfect: 0, good: 5, miss: 2 }) === 'good', 'agg mostly good');
assert(aggregateJudgment({ perfect: 0, good: 0, miss: 4 }) === 'miss', 'agg all miss');

const acc = accuracyFromTallies({ perfect: 1, good: 1, miss: 0 });
assert(Math.abs(acc - 0.8) < 1e-9, 'accuracy (1+0.6)/2 = 0.8');

// Aliases: projectile/shuriken → deflect (spinner gone)
assert(normalizeType('projectile') === 'deflect', 'projectile → deflect');
assert(normalizeType('shuriken') === 'deflect', 'shuriken → deflect');
assert(normalizeType('dart') === 'deflect', 'dart → deflect');
assert(normalizeType('hidden') === 'deflect', 'hidden → deflect');
assert(normalizeType('spinner') === 'deflect', 'spinner deprecated → deflect');
assert(normalizeType('fist') === 'punch', 'fist → punch');
assert(normalizeType('punch') === 'punch', 'punch unchanged');
assert(normalizeType('lrCombo') === 'lrCombo', 'lrCombo unchanged');

assert(CANONICAL_TYPES.length === 8, '8 canonical types');
assert(isCanonicalType('arc'), 'arc canonical');
assert(isCanonicalType('projectile'), 'projectile alias is canonical via normalize');
assert(!isCanonicalType('spinner_raw_unknown') && !CANONICAL_TYPES.includes('spinner'), 'spinner not canonical');

const KIND_MAP = {
  punch: 'circle',
  sword: 'slider',
  brace: 'brace',
  deflect: 'deflect',
  charge: 'charge',
  dodge: 'dodge',
  lrCombo: 'lrCombo',
  arc: 'arc',
};
for (const [ty, kind] of Object.entries(KIND_MAP)) {
  assert(typeToKind(ty) === kind, ty + ' → ' + kind);
}
assert(typeToKind('projectile') === 'deflect', 'projectile typeToKind → deflect');
assert(typeToKind('shuriken') === 'deflect', 'shuriken typeToKind → deflect');

assert(normalizeDir('left') === 'L', 'normalizeDir left');
assert(normalizeDir('R') === 'R', 'normalizeDir R');
assert(normalizeDir('back') === 'back', 'normalizeDir back');
assert(classifySwipe(-0.12, 0.01, 0.05) === 'L', 'swipe L');
assert(classifySwipe(0.12, 0.01, 0.05) === 'R', 'swipe R');
assert(classifySwipe(0.01, -0.12, 0.05) === 'back', 'swipe back');
assert(
  isOutwardSwipe({ x: 0.5, y: 0.5 }, { x: 0.65, y: 0.5 }, { x: 0.5, y: 0.5 }, 0.05),
  'outward swipe'
);

// Circle expand
const circ = expandNoteHits({ kind: 'circle', t: 1000, x: 0.5, y: 0.5, id: 'c' });
assert(circ.length === 1 && circ[0].kind === 'circle' && circ[0].t === 1000, 'circle expands 1:1');

// Slider speed
const shortPts = [
  { x: 0.3, y: 0.4 },
  { x: 0.5, y: 0.35 },
];
const len = pathLength(shortPts);
assert(len > 0 && len < 0.3, 'short slider path length < 0.3');
const dur = sliderDurationMs(shortPts);
assert(dur >= 160 && dur <= 280, 'slider duration snappy 160–280 (' + dur + ')');

// Arc longer
const arcPts = [
  { x: 0.25, y: 0.55 },
  { x: 0.4, y: 0.35 },
  { x: 0.6, y: 0.35 },
  { x: 0.75, y: 0.55 },
];
const adur = arcDurationMs(arcPts);
assert(adur >= 300 && adur <= 480, 'arc duration martial-snappy 300–480 (' + adur + ')');

let prog = 0;
prog = pathProgress(shortPts, { x: 0.3, y: 0.4 }, prog);
assert(prog < 0.15, 'path start progress near 0');
prog = pathProgress(shortPts, { x: 0.5, y: 0.35 }, prog);
assert(prog >= 0.95, 'path end progress ~1');

assert(combineJudgments(['perfect', 'perfect', 'good']) === 'perfect', 'combine mostly perfect');
assert(combineJudgments(['good', 'good', 'miss']) === 'good', 'combine mixed good');
assert(combineJudgments(['miss', 'miss']) === 'miss', 'combine all miss');

// Demo charts + perfect play for ALL 8 kinds
for (const type of CANONICAL_TYPES) {
  const chart = demoChart(type);
  const hits = scheduleHits(chart);
  assert(hits.length >= 5, type + ' demo has >=5 hits (' + hits.length + ')');
  const expectedKind = typeToKind(type);
  assert(
    hits.every((h) => h.kind === expectedKind),
    type + ' all hits are ' + expectedKind
  );

  const tracker = createHitTracker(chart);
  for (const h of hits) {
    tracker.input(h.t, { kind: h.kind, targetId: h.id });
  }
  const r = tracker.result();
  assert(r.judgment === 'perfect' && r.accuracy === 1, type + ' perfect-play');
}

// Alias demo: projectile chart === deflect
{
  const a = demoChart('projectile');
  const b = demoChart('deflect');
  assert(a.length === b.length && a[0].kind === 'deflect', 'projectile demo maps to deflect notes');
}

// Circle miss if too late
{
  const t = createHitTracker([{ kind: 'circle', t: 1000, x: 0.5, y: 0.5, id: 'm' }]);
  t.tick(1200);
  assert(t.result().tallies.miss === 1, 'circle late miss via tick');
}

// Slider start+path+end
{
  const note = {
    kind: 'slider',
    t: 1000,
    durationMs: 200,
    id: 'sl',
    points: [
      { x: 0.4, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ],
  };
  const t = createHitTracker([note]);
  const hit = t.hits[0];
  t.beginSlider(1000, 'sl');
  t.moveSlider(hit, { x: 0.5, y: 0.5 });
  t.moveSlider(hit, { x: 0.6, y: 0.5 });
  const out = t.endSlider(1200, hit);
  assert(out.judgment === 'perfect', 'slider perfect start+path+end');
}

// Brace hold-through
{
  const t = createHitTracker([
    { kind: 'brace', t: 1000, durationMs: 280, id: 'br', x: 0.5, y: 0.5 },
  ]);
  const hit = t.hits[0];
  t.beginBrace(1000, 'br');
  const out = t.endBrace(1280, hit);
  assert(out.judgment === 'perfect' && out.heldThrough, 'brace hold-through → perfect');
}

// Brace early release after impact → good
{
  const t = createHitTracker([
    { kind: 'brace', t: 1000, durationMs: 280, id: 'br2', x: 0.5, y: 0.5 },
  ]);
  const hit = t.hits[0];
  t.beginBrace(1000, 'br2');
  const out = t.endBrace(1100, hit);
  assert(out.judgment === 'good' && !out.heldThrough, 'brace early release → good');
}

// Deflect outward swipe
{
  const t = createHitTracker([{ kind: 'deflect', t: 1000, id: 'df', x: 0.5, y: 0.4 }]);
  const hit = t.hits[0];
  t.beginDeflectSwipe(1000, 'df', { x: 0.5, y: 0.4 });
  const out = t.endDeflectSwipe(1000, hit, { x: 0.65, y: 0.35 });
  assert(out.judgment === 'perfect', 'deflect outward → perfect');
}

// Charge release on beat
{
  const t = createHitTracker([
    { kind: 'charge', t: 1000, minChargeMs: CHARGE_MIN_MS, id: 'ch', x: 0.5, y: 0.5 },
  ]);
  const hit = t.hits[0];
  t.beginCharge(1000 - CHARGE_MIN_MS - 20, 'ch');
  const out = t.endCharge(1000, hit);
  assert(out.judgment === 'perfect', 'charge full + on-beat → perfect');
}

// Dodge correct dir
{
  const t = createHitTracker([{ kind: 'dodge', t: 1000, dir: 'L', id: 'dg', x: 0.5, y: 0.5 }]);
  const hit = t.hits[0];
  t.beginDodgeSwipe(1000, 'dg', { x: 0.5, y: 0.5 });
  const out = t.endDodgeSwipe(1000, hit, { x: 0.38, y: 0.5 });
  assert(out.judgment === 'perfect', 'dodge L → perfect');
}

// lrCombo L-R
{
  const t = createHitTracker([
    { kind: 'lrCombo', t: 1000, pattern: ['L', 'R'], intervalMs: 280, id: 'lr' },
  ]);
  t.tapLrCombo(1000, 'L', 'lr');
  const out = t.tapLrCombo(1280, 'R', 'lr');
  assert(out.judgment === 'perfect', 'lrCombo L-R → perfect');
}

// Arc path
{
  const note = {
    kind: 'arc',
    t: 1000,
    durationMs: 360,
    id: 'ar',
    points: [
      { x: 0.3, y: 0.5 },
      { x: 0.5, y: 0.3 },
      { x: 0.7, y: 0.5 },
    ],
  };
  const t = createHitTracker([note]);
  const hit = t.hits[0];
  t.beginArc(1000, 'ar');
  t.movePath(hit, { x: 0.5, y: 0.3 });
  t.movePath(hit, { x: 0.7, y: 0.5 });
  hit.sliderProgress = 1;
  const out = t.endPath(1360, hit);
  assert(out.judgment === 'perfect', 'arc perfect path');
}

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nPASS');
