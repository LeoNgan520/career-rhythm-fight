/**
 * chart-bridge.js — thin adapter (NOT a chart system).
 * Primary: window.CareerCharts.start per charts/EMBED.md
 * Fallback: auto Miss after short delay if ChartUI missing
 *
 * Bout uses: RhythmCharts.play(type, onComplete)
 * type: 'punch' | 'sword' | 'projectile'  (暗器 = projectile; 'shuriken' aliased)
 */
(function (global) {
  'use strict';

  var TYPE_MAP = { punch: 'punch', sword: 'sword', projectile: 'projectile', shuriken: 'projectile' };
  var LABEL = { punch: '拳', sword: '劍', projectile: '暗器', shuriken: '暗器' };
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
