/**
 * chart-bridge.js — thin adapter (NOT a chart system).
 * Primary: window.CareerCharts.start per charts/EMBED.md
 * Fallback: auto Miss after short delay if ChartUI missing
 *
 * Bout uses: RhythmCharts.play(type, onComplete)
 * Canonical: punch|sword|brace|deflect|charge|dodge|lrCombo|arc
 * Aliases: projectile/shuriken/spinner → deflect
 */
(function (global) {
  'use strict';

  var TYPE_MAP = {
    punch: 'punch',
    sword: 'sword',
    brace: 'brace',
    deflect: 'deflect',
    charge: 'charge',
    dodge: 'dodge',
    lrCombo: 'lrCombo',
    arc: 'arc',
    projectile: 'deflect',
    shuriken: 'deflect',
    spinner: 'deflect',
    dart: 'deflect',
    hidden: 'deflect',
    fist: 'punch',
  };
  var LABEL = {
    punch: '點刺',
    sword: '橫斬',
    brace: '架開',
    deflect: '撥飛',
    charge: '蓄力',
    dodge: '閃身',
    lrCombo: '連擊',
    arc: '弧斬',
    projectile: '撥飛',
    shuriken: '撥飛',
    spinner: '撥飛',
  };
  var session = null;

  function capitalize(j) {
    if (!j) return 'Miss';
    var s = String(j).toLowerCase();
    if (s === 'perfect') return 'Perfect';
    if (s === 'good') return 'Good';
    return 'Miss';
  }

  function play(type, onComplete, mountEl) {
    var mapped = TYPE_MAP[type] || 'punch';
    var mount = mountEl || document.getElementById('chart-mount');
    var cb = typeof onComplete === 'function' ? onComplete : function () {};

    if (session && typeof session.stop === 'function') {
      try { session.stop(); } catch (e) { /* ignore */ }
      session = null;
    }
    if (mount) mount.innerHTML = '';

    if (global.CareerCharts && typeof global.CareerCharts.start === 'function') {
      session = global.CareerCharts.start({
        type: mapped,
        container: mount,
        onHit: function (evt) {
          if (!global.BattleAudio) return;
          var j = String((evt && evt.judgment) || '').toLowerCase();
          if (j === 'perfect' || j === 'good') {
            if (typeof global.BattleAudio.hit === 'function') global.BattleAudio.hit();
          } else if (typeof global.BattleAudio.chartOpen === 'function') {
            global.BattleAudio.chartOpen();
          }
        },
        onComplete: function (result) {
          session = null;
          cb({
            judgment: capitalize(result && result.judgment),
            score: Math.round(((result && result.accuracy) || 0) * 100),
            accuracy: (result && result.accuracy) || 0,
            tallies: (result && result.tallies) || null,
          });
        },
      });
      return;
    }

    console.warn('[chart-bridge] CareerCharts missing — fallback Miss');
    var t = setTimeout(function () {
      cb({ judgment: 'Miss', score: 0, accuracy: 0 });
    }, 600);
    session = { stop: function () { clearTimeout(t); } };
  }

  function destroy() {
    if (session && typeof session.stop === 'function') {
      try { session.stop(); } catch (e) { /* ignore */ }
    }
    session = null;
    var mount = document.getElementById('chart-mount');
    if (mount) mount.innerHTML = '';
  }

  global.RhythmCharts = { play: play, destroy: destroy, labels: LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
