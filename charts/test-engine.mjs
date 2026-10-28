/**
 * Tiny node test for chart-engine judge windows + variants.
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
  inputMatchesHit,
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

const holdHits = expandNoteHits({ t: 1000, kind: 'hold', holdMs: 400, id: 'h' });
assert(holdHits.length === 2 && holdHits[1].t === 1400, 'hold expands press+release');

const burstHits = expandNoteHits({ t: 0, kind: 'burst', comboCount: 5, id: 'b' });
assert(burstHits.length === 5, 'burst expands 5');

const swipeOk = inputMatchesHit(
  { kind: 'swipe', dir: 'left', lane: 1 },
  { dir: 'left' }
);
const swipeBad = inputMatchesHit(
  { kind: 'swipe', dir: 'left', lane: 1 },
  { dir: 'right' }
);
assert(swipeOk && !swipeBad, 'swipe dir match');

for (const type of ['punch', 'sword', 'projectile']) {
  const hits = scheduleHits(demoChart(type));
  assert(hits.length >= 8, type + ' demo has >=8 hits (' + hits.length + ')');
  const perfect = createHitTracker(demoChart(type));
  for (const h of hits) {
    const meta = { phase: h.phase || 'press' };
    if (h.dir) meta.dir = h.dir;
    if (h.lane != null) meta.lane = h.lane;
    perfect.input(h.t, meta);
  }
  const r = perfect.result();
  assert(r.judgment === 'perfect' && r.accuracy === 1, type + ' perfect-play');
}

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nPASS');
