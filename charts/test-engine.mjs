/**
 * Node tests for Ouendan-style chart engine (circles / sliders / spinners).
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
  pathLength,
  pathProgress,
  judgeSpinnerFill,
  combineJudgments,
  CIRCLE_APPROACH_MS,
  SPINNER_FILL_REQUIRED,
  SPINNER_PERFECT_FILL,
  SPINNER_GOOD_FILL,
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

assert(normalizeType('shuriken') === 'projectile', 'shuriken → projectile');
assert(normalizeType('punch') === 'punch', 'punch unchanged');
assert(typeToKind('punch') === 'circle', 'punch → circle');
assert(typeToKind('sword') === 'slider', 'sword → slider');
assert(typeToKind('projectile') === 'spinner', 'projectile → spinner');

// Circle expand
const circ = expandNoteHits({ kind: 'circle', t: 1000, x: 0.5, y: 0.5, id: 'c' });
assert(circ.length === 1 && circ[0].kind === 'circle' && circ[0].t === 1000, 'circle expands 1:1');

// Slider speed helpers — short path → snappy duration
const shortPts = [
  { x: 0.3, y: 0.4 },
  { x: 0.5, y: 0.35 },
];
const len = pathLength(shortPts);
assert(len > 0 && len < 0.3, 'short slider path length < 0.3');
const dur = sliderDurationMs(shortPts);
assert(dur >= 160 && dur <= 280, 'slider duration snappy 160–280 (' + dur + ')');
assert(sliderDurationMs(shortPts, 200) === 200, 'slider duration override');

// Path progress monotonic
let prog = 0;
prog = pathProgress(shortPts, { x: 0.3, y: 0.4 }, prog);
assert(prog < 0.15, 'path start progress near 0');
prog = pathProgress(shortPts, { x: 0.4, y: 0.375 }, prog);
assert(prog > 0.3, 'path mid progress advances');
prog = pathProgress(shortPts, { x: 0.5, y: 0.35 }, prog);
assert(prog >= 0.95, 'path end progress ~1');

// Spinner fill thresholds
assert(judgeSpinnerFill(SPINNER_PERFECT_FILL) === 'perfect', 'spinner full → perfect');
assert(judgeSpinnerFill(SPINNER_GOOD_FILL) === 'good', 'spinner good threshold');
assert(judgeSpinnerFill(SPINNER_GOOD_FILL - 0.01) === 'miss', 'spinner under → miss');
assert(judgeSpinnerFill(0) === 'miss', 'spinner empty → miss');
assert(SPINNER_FILL_REQUIRED > Math.PI, 'spinner needs >1 turn');

assert(combineJudgments(['perfect', 'perfect', 'good']) === 'perfect', 'combine mostly perfect');
assert(combineJudgments(['good', 'good', 'miss']) === 'good', 'combine mixed good');
assert(combineJudgments(['miss', 'miss']) === 'miss', 'combine all miss');

// Demo charts + perfect play
for (const type of ['punch', 'sword', 'projectile']) {
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
    if (h.kind === 'circle') {
      tracker.input(h.t, { kind: 'circle', targetId: h.id });
    } else if (h.kind === 'slider') {
      tracker.input(h.t, { kind: 'slider', targetId: h.id });
    } else {
      tracker.input(h.t, { kind: 'spinner', targetId: h.id });
    }
  }
  const r = tracker.result();
  assert(r.judgment === 'perfect' && r.accuracy === 1, type + ' perfect-play');
}

// Circle miss if too late
{
  const t = createHitTracker([{ kind: 'circle', t: 1000, x: 0.5, y: 0.5, id: 'm' }]);
  t.tick(1200);
  assert(t.result().tallies.miss === 1, 'circle late miss via tick');
}

// Slider start+path+end aggregate
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

// Spinner hold+spin
{
  const t = createHitTracker([
    { kind: 'spinner', t: 500, durationMs: 800, id: 'sp', x: 0.5, y: 0.5 },
  ]);
  const hit = t.hits[0];
  t.beginSpinner(500, 'sp');
  t.spinSpinner(hit, SPINNER_FILL_REQUIRED);
  const out = t.endSpinner(hit);
  assert(out.judgment === 'perfect', 'spinner full fill → perfect');
}

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nPASS');
