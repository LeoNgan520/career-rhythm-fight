/**
 * boot.js — load ChartUI (ESM engine → classic player) then CombatFeel scripts.
 * chart-engine.js uses export + attaches window.CareerChartEngine.
 */
import '../charts/chart-engine.js';

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
}

(async function () {
  try {
    await loadScript('charts/career-charts.js');
  } catch (e) {
    console.warn('[boot] CareerCharts not loaded — bout will use thin fallback', e);
  }
  await loadScript('js/audio.js');
  await loadScript('js/chart-bridge.js');
  await loadScript('js/bout.js');
})();
