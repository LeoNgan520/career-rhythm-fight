/**
 * bout.js — Career Rhythm Fight v0.1
 * 影炎 (LEFT) vs 赤焰 (RIGHT) — 三国武功切磋
 * Charts via CareerCharts.start (chart-bridge). CastArt PNGs in art/.
 */
(function () {
  'use strict';

  /* ALL 8 martial moves — top-to-bottom spar order (not random) */
  var MOVE_QUEUE = [
    { type: 'punch',   label: '點刺' },
    { type: 'sword',   label: '橫斬' },
    { type: 'brace',   label: '架開' },
    { type: 'deflect', label: '撥飛' },
    { type: 'charge',  label: '蓄力' },
    { type: 'dodge',   label: '閃身' },
    { type: 'lrCombo', label: '連擊' },
    { type: 'arc',     label: '弧斬' },
  ];

  /* Balance for 8 beats: Miss run (~11×8=88) still finishes; Perfect ~16×8 can KO */
  var DAMAGE = { Perfect: 16, Good: 9, Miss: 0 };
  var CHIP_GOOD = 4;
  var CHIP_MISS = 11;

  var state = {
    phase: 'idle',
    beatIndex: 0,
    hpPlayer: 100,
    hpEnemy: 100,
  };

  var el = {};

  function $(id) { return document.getElementById(id); }

  function cache() {
    el.camera = $('camera');
    el.fx = $('fx-layer');
    el.caption = $('phase-caption');
    el.moveBadge = $('move-badge');
    el.moveBadgeLabel = $('move-badge-label');
    el.resultFlash = $('result-flash');
    el.resultText = $('result-text');
    el.overlayStart = $('overlay-start');
    el.overlayEnd = $('overlay-end');
    el.endTitle = $('end-title');
    el.endDetail = $('end-detail');
    el.btnStart = $('btn-start');
    el.btnRestart = $('btn-restart');
    el.btnMute = $('btn-mute');
    el.chartOverlay = $('chart-overlay');
    el.chartMount = $('chart-mount');
    el.beatInfo = $('beat-info');
    el.beatCounter = $('beat-counter');
    el.hpPlayer = $('hp-player');
    el.hpEnemy = $('hp-enemy');
    el.fighterEnemy = $('fighter-enemy');
    el.fighterPlayer = $('fighter-player');
    el.telegraph = $('telegraph');
    el.telegraphBanner = $('telegraph-banner');
    el.app = $('app');
    el.imgPlayer = $('img-player');
    el.imgEnemy = $('img-enemy');
    el.spritePlayer = $('sprite-player');
    el.spriteEnemy = $('sprite-enemy');
  }

  /* ——— CastArt: show PNGs, silhouette CSS fallback on error ——— */
  function wireArt() {
    function bind(img, sprite) {
      if (!img || !sprite) return;
      function show() {
        img.removeAttribute('hidden');
        img.hidden = false;
        sprite.classList.add('has-art');
      }
      function fail() {
        img.hidden = true;
        sprite.classList.remove('has-art');
      }
      img.addEventListener('load', show);
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth > 0) show();
      else if (img.complete) fail();
      else show(); // optimistic unhide; error handler reverts
    }
    bind(el.imgPlayer, el.spritePlayer);
    bind(el.imgEnemy, el.spriteEnemy);
  }

  function triggerHit(sprite) {
    if (!sprite) return;
    sprite.classList.remove('is-hit');
    void sprite.offsetWidth;
    sprite.classList.add('is-hit');
    clearTimeout(sprite._hitTimer);
    sprite._hitTimer = setTimeout(function () {
      sprite.classList.remove('is-hit');
    }, 300);
  }

  function setCamera(mode) {
    el.camera.classList.remove('camera-idle', 'camera-showcase', 'camera-focus', 'camera-punch', 'camera-shake');
    el.camera.classList.add('camera-' + mode);
  }

  function shake(ms) {
    el.camera.classList.add('camera-shake');
    setTimeout(function () { el.camera.classList.remove('camera-shake'); }, ms || 280);
  }

  function fxBurst(kind) {
    if (!el.fx) return;
    var d = document.createElement('div');
    d.className = 'fx-burst fx-' + kind;
    el.fx.appendChild(d);
    setTimeout(function () { d.remove(); }, 700);
  }

  function setCaption(text) { el.caption.textContent = text; }

  function setEmphasis(onEnemy) {
    el.fighterEnemy.classList.toggle('emphasized', !!onEnemy);
    el.fighterPlayer.classList.toggle('emphasized', !onEnemy && state.phase === 'player_block');
    el.fighterEnemy.classList.toggle('dimmed', !onEnemy && state.phase !== 'idle');
    el.fighterPlayer.classList.toggle('dimmed', !!onEnemy);
  }

  function clearEmphasis() {
    el.fighterEnemy.classList.remove('emphasized', 'dimmed');
    el.fighterPlayer.classList.remove('emphasized', 'dimmed');
  }

  function updateHp(opts) {
    opts = opts || {};
    el.hpPlayer.style.width = Math.max(0, state.hpPlayer) + '%';
    el.hpEnemy.style.width = Math.max(0, state.hpEnemy) + '%';
    if (opts.drainPlayer && el.hpPlayer) {
      el.hpPlayer.classList.remove('draining');
      void el.hpPlayer.offsetWidth;
      el.hpPlayer.classList.add('draining');
      clearTimeout(el.hpPlayer._drainT);
      el.hpPlayer._drainT = setTimeout(function () { el.hpPlayer.classList.remove('draining'); }, 500);
    }
    if (opts.drainEnemy && el.hpEnemy) {
      el.hpEnemy.classList.remove('draining');
      void el.hpEnemy.offsetWidth;
      el.hpEnemy.classList.add('draining');
      clearTimeout(el.hpEnemy._drainT);
      el.hpEnemy._drainT = setTimeout(function () { el.hpEnemy.classList.remove('draining'); }, 500);
    }
  }

  function updateBeatInfo() {
    el.beatInfo.hidden = false;
    el.beatCounter.textContent = '招式 ' + (state.beatIndex + 1) + ' / ' + MOVE_QUEUE.length;
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function audio(fn) {
    if (globalThis.BattleAudio && typeof BattleAudio[fn] === 'function') BattleAudio[fn]();
  }

  function showResultFlash(judgment) {
    el.resultFlash.hidden = false;
    el.resultFlash.className = 'result-flash ' + judgment.toLowerCase();
    el.resultText.textContent = judgment === 'Perfect' ? 'PERFECT' : judgment === 'Good' ? 'GOOD' : 'MISS';
    return wait(900).then(function () { el.resultFlash.hidden = true; });
  }

  function startBout() {
    audio('unlock');
    if (globalThis.BattleAudio && typeof BattleAudio.startBed === 'function') {
      try { BattleAudio.startBed(); } catch (e) { /* */ }
    }
    state.phase = 'enemy_turn';
    state.beatIndex = 0;
    state.hpPlayer = 100;
    state.hpEnemy = 100;
    updateHp();
    el.overlayStart.hidden = true;
    el.overlayEnd.hidden = true;
    updateBeatInfo();
    setCamera('idle');
    runBeat();
  }

  function runBeat() {
    if (state.hpPlayer <= 0 || state.hpEnemy <= 0 || state.beatIndex >= MOVE_QUEUE.length) {
      endBout();
      return;
    }
    phaseEnemyTurn();
  }

  function phaseEnemyTurn() {
    state.phase = 'enemy_turn';
    setCaption('敵方出招');
    setCamera('showcase');
    setEmphasis(true);
    el.telegraph.hidden = false;
    if (el.telegraphBanner) el.telegraphBanner.hidden = false;
    el.moveBadge.hidden = true;
    el.chartOverlay.hidden = true;
    if (el.app) el.app.classList.remove('chart-open');
    audio('telegraph');
    return wait(1000).then(phaseMoveShowcase);
  }

  function phaseMoveShowcase() {
    state.phase = 'move_showcase';
    var move = MOVE_QUEUE[state.beatIndex];
    setCaption('招式展示');
    setCamera('showcase');
    setEmphasis(true);
    el.telegraph.hidden = true;
    if (el.telegraphBanner) el.telegraphBanner.hidden = true;
    el.moveBadge.hidden = false;
    el.moveBadgeLabel.textContent = move.label;
    audio('showcase');
    return wait(1500).then(phaseChartWindow);
  }

  function phaseChartWindow() {
    state.phase = 'chart_window';
    var move = MOVE_QUEUE[state.beatIndex];
    setCaption('節奏格擋');
    setCamera('focus');
    el.fighterEnemy.classList.remove('emphasized');
    el.fighterEnemy.classList.add('dimmed');
    el.fighterPlayer.classList.remove('dimmed');
    el.fighterPlayer.classList.add('emphasized');
    el.moveBadge.hidden = true;
    el.telegraph.hidden = true;
    if (el.telegraphBanner) el.telegraphBanner.hidden = true;

    el.chartOverlay.hidden = false;
    if (el.app) el.app.classList.add('chart-open');
    audio('chartOpen');

    state.phase = 'player_block';

    // Prefer CareerCharts.start directly; use engine default windows (±40/±100)
    if (window.CareerCharts && typeof window.CareerCharts.start === 'function') {
      if (window.RhythmCharts && window.RhythmCharts.destroy) window.RhythmCharts.destroy();
      window._boutChartSession = window.CareerCharts.start({
        type: move.type,
        container: el.chartMount,
        onHit: function (evt) {
          // Per-note SFX; phaseResult still owns perfect/good/miss result stingers
          if (!globalThis.BattleAudio) return;
          var j = String((evt && evt.judgment) || '').toLowerCase();
          if (j === 'perfect' || j === 'good') {
            if (typeof BattleAudio.hit === 'function') BattleAudio.hit();
          } else if (typeof BattleAudio.chartOpen === 'function') {
            BattleAudio.chartOpen(); // light tap
          }
        },
        onComplete: function (result) {
          window._boutChartSession = null;
          onChartComplete({
            judgment: capitalize(result && result.judgment),
            accuracy: (result && result.accuracy) || 0,
          });
        },
      });
    } else if (window.RhythmCharts && typeof window.RhythmCharts.play === 'function') {
      window.RhythmCharts.play(move.type, onChartComplete);
    } else {
      console.warn('[bout] No CareerCharts — Miss');
      setTimeout(function () { onChartComplete({ judgment: 'Miss', accuracy: 0 }); }, 500);
    }
  }

  function capitalize(j) {
    var s = String(j || '').toLowerCase();
    if (s === 'perfect') return 'Perfect';
    if (s === 'good') return 'Good';
    return 'Miss';
  }

  function onChartComplete(result) {
    el.chartOverlay.hidden = true;
    if (el.app) el.app.classList.remove('chart-open');
    if (window._boutChartSession && window._boutChartSession.stop) {
      try { window._boutChartSession.stop(); } catch (e) { /* */ }
      window._boutChartSession = null;
    }
    if (window.RhythmCharts && window.RhythmCharts.destroy) window.RhythmCharts.destroy();
    phaseResult(result);
  }

  function phaseResult(result) {
    state.phase = 'result';
    setCaption('結果');
    el.telegraph.hidden = true;
    if (el.telegraphBanner) el.telegraphBanner.hidden = true;
    el.moveBadge.hidden = true;
    el.fighterPlayer.classList.remove('emphasized');

    var j = result.judgment;
    if (j === 'Perfect') {
      setCamera('punch');
      shake(200);
      fxBurst('perfect');
      triggerHit(el.spriteEnemy);
      audio('perfect');
      audio('hit');
      state.hpEnemy -= DAMAGE.Perfect;
    } else if (j === 'Good') {
      setCamera('idle');
      fxBurst('good');
      triggerHit(el.spritePlayer);
      audio('good');
      state.hpEnemy -= DAMAGE.Good;
      state.hpPlayer -= CHIP_GOOD;
    } else {
      setCamera('shake');
      shake(420);
      fxBurst('miss');
      triggerHit(el.spritePlayer);
      audio('miss');
      state.hpPlayer -= CHIP_MISS;
    }
    state.hpPlayer = Math.max(0, state.hpPlayer);
    state.hpEnemy = Math.max(0, state.hpEnemy);
    updateHp({
      drainPlayer: j !== 'Perfect',
      drainEnemy: j === 'Perfect' || j === 'Good',
    });

    var hold = j === 'Perfect' ? 420 : j === 'Miss' ? 380 : 300;
    showResultFlash(j).then(function () { return wait(hold); }).then(function () {
      setCamera('idle');
      state.beatIndex += 1;
      if (state.hpPlayer <= 0 || state.hpEnemy <= 0 || state.beatIndex >= MOVE_QUEUE.length) {
        endBout();
      } else {
        updateBeatInfo();
        runBeat();
      }
    });
  }

  function endBout() {
    state.phase = 'idle';
    setCaption('切磋結束');
    setCamera('idle');
    clearEmphasis();
    el.telegraph.hidden = true;
    if (el.telegraphBanner) el.telegraphBanner.hidden = true;
    el.moveBadge.hidden = true;
    el.chartOverlay.hidden = true;
    if (el.app) el.app.classList.remove('chart-open');
    el.beatInfo.hidden = true;

    var lose = state.hpPlayer <= 0;
    var win = state.hpEnemy <= 0 || (!lose && state.hpEnemy < state.hpPlayer);
    if (lose && state.hpEnemy > 0) {
      el.endTitle.textContent = '惜敗';
      el.endDetail.textContent = '影炎未能接下赤焰八招——此番切磋，再練再戰。';
      audio('lose');
    } else if (win) {
      el.endTitle.textContent = '佔上風';
      el.endDetail.textContent = '影炎擋下赤焰八式武功。切磋告一段落。';
      audio('win');
    } else {
      el.endTitle.textContent = '切磋結束';
      el.endDetail.textContent = '八招演練完畢（影炎 ' + Math.round(state.hpPlayer) + ' · 赤焰 ' + Math.round(state.hpEnemy) + '）。平手亦是精進。';
    }
    el.overlayEnd.hidden = false;
  }

  function bind() {
    el.btnStart.addEventListener('click', startBout);
    el.btnRestart.addEventListener('click', startBout);
    el.btnMute.addEventListener('click', function () {
      if (!window.BattleAudio) return;
      var next = !BattleAudio.isMuted();
      BattleAudio.setMuted(next);
      el.btnMute.textContent = next ? '🔇' : '♪';
      el.btnMute.classList.toggle('muted', next);
    });
  }

  function init() {
    cache();
    wireArt();
    bind();
    setCaption('準備就緒');
    setCamera('idle');
    updateHp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
