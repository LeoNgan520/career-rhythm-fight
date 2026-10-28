/**
 * Career-ChartUI — embeddable player for CombatFeel.
 *
 * CEO API (locked):
 *   window.CareerCharts.start({
 *     type: 'punch' | 'sword' | 'projectile',
 *     onComplete(result) // { judgment, accuracy }
 *   })
 *   → { stop(), reset(), getResult() }
 *
 * Bout shim: CareerCharts.play(type, mountEl, onComplete) — also accepts
 *   legacy 'shuriken' (→ projectile). onComplete gets Perfect/Good/Miss + score
 *   for RhythmCharts adapter compatibility.
 */
(function (global) {
  'use strict';

  const Engine = global.CareerChartEngine;
  if (!Engine) {
    console.error('[CareerCharts] Load chart-engine.js before career-charts.js');
    return;
  }

  const TYPE_LABEL = {
    punch: '拳 · 圓點',
    sword: '劍 · 線斬',
    projectile: '暗器 · 連擊',
  };

  const TYPE_COLOR = {
    punch: '#ff6b4a',
    sword: '#6ec8ff',
    projectile: '#c084fc',
  };

  const DIR_ARROW = { up: '↑', down: '↓', left: '←', right: '→' };

  let activeSession = null;

  function laneY(h, lane) {
    const mid = h * 0.5;
    const spread = h * 0.22;
    const L = lane == null ? 1 : lane;
    return mid + (L - 1) * spread;
  }

  function buildShell(container, type, withChrome) {
    const root = document.createElement('div');
    root.className = 'career-charts-root';
    root.dataset.type = type;

    let tabsHtml = '';
    let actionsHtml = '';
    if (withChrome) {
      tabsHtml =
        '<div class="cc-tabs" role="tablist">' +
        ['punch', 'sword', 'projectile']
          .map(function (t) {
            const labels = { punch: '拳', sword: '劍', projectile: '暗器' };
            return (
              '<button type="button" class="cc-tab' +
              (type === t ? ' active' : '') +
              '" data-type="' +
              t +
              '">' +
              labels[t] +
              '</button>'
            );
          })
          .join('') +
        '</div>';
      actionsHtml =
        '<div class="cc-actions">' +
        '<button type="button" class="cc-btn primary" data-act="start">Start</button>' +
        '<button type="button" class="cc-btn" data-act="stop" disabled>Stop</button>' +
        '</div>';
    }

    root.innerHTML =
      tabsHtml +
      '<div class="cc-hud">' +
      '<div class="cc-brand"><span class="cc-mark"></span>' +
      '<span class="cc-type" data-type="' +
      type +
      '">' +
      (TYPE_LABEL[type] || type) +
      '</span></div>' +
      '<div class="cc-stats">' +
      '<span class="cc-combo">COMBO <b data-combo>0</b></span>' +
      '<span class="cc-pill p">P <b data-p>0</b></span>' +
      '<span class="cc-pill g">G <b data-g>0</b></span>' +
      '<span class="cc-pill m">M <b data-m>0</b></span>' +
      '</div></div>' +
      '<div class="cc-stage-wrap">' +
      '<div class="cc-vignette"></div>' +
      '<canvas class="cc-stage" width="520" height="180" aria-label="rhythm chart"></canvas>' +
      '<div class="cc-flash" aria-live="polite"></div>' +
      '</div>' +
      '<p class="cc-hint" data-hint></p>' +
      actionsHtml;

    container.innerHTML = '';
    container.appendChild(root);
    return root;
  }

  function hintFor(type) {
    if (type === 'sword') {
      return '劍：方向鍵／拖曳斬擊 · Space 普斬 · 長按 hold';
    }
    if (type === 'projectile') {
      return '暗器：連打 Space／點擊 · 爆發段要密';
    }
    return '拳：Space／點擊格擋 · Z/X 換道 · 長按 hold · 雙擊 double';
  }

  /**
   * @param {object} opts
   * @returns {{ stop: Function, reset: Function, getResult: Function, beginPlay: Function }}
   */
  function start(opts) {
    const options = opts || {};
    const type = Engine.normalizeType(options.type || 'punch');
    if (!['punch', 'sword', 'projectile'].includes(type)) {
      throw new Error('CareerCharts.start: unknown type "' + options.type + '"');
    }

    if (activeSession) {
      try {
        activeSession.stop();
      } catch (e) {
        /* ignore */
      }
      activeSession = null;
    }

    const container =
      options.container ||
      document.getElementById('chart-mount') ||
      document.body;

    const withChrome = !!options.demoChrome;
    const root = buildShell(container, type, withChrome);
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const flashEl = root.querySelector('.cc-flash');
    const comboEl = root.querySelector('[data-combo]');
    const pEl = root.querySelector('[data-p]');
    const gEl = root.querySelector('[data-g]');
    const mEl = root.querySelector('[data-m]');
    const typeEl = root.querySelector('.cc-type');
    const hintEl = root.querySelector('[data-hint]');
    const markEl = root.querySelector('.cc-mark');
    hintEl.textContent = hintFor(type);
    markEl.style.background = TYPE_COLOR[type];

    const chart = options.chart || Engine.demoChart(type);
    const windows = options.windows || Engine.DEFAULT_WINDOWS;
    let tracker = Engine.createHitTracker(chart, windows);

    let playing = false;
    let startPerf = 0;
    let raf = 0;
    let flashTimer = 0;
    const particles = [];
    let pointerDownAt = null;
    let holdPressArmed = false;

    function nowMs() {
      return performance.now() - startPerf;
    }

    function updateHud() {
      const t = tracker.getTallies();
      comboEl.textContent = String(tracker.getCombo());
      pEl.textContent = String(t.perfect);
      gEl.textContent = String(t.good);
      mEl.textContent = String(t.miss);
    }

    function showFlash(judgment) {
      const label =
        judgment === 'perfect' ? '完美' : judgment === 'good' ? '好' : 'Miss';
      flashEl.textContent = label;
      flashEl.className = 'cc-flash show ' + judgment;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        flashEl.classList.remove('show');
      }, 300);
    }

    function resizeCanvas() {
      const wrap = canvas.parentElement;
      const w = Math.max(280, wrap.clientWidth || 520);
      const h = 180;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnBurst(color, jx, jy) {
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: jx,
          y: jy,
          vx: (Math.random() - 0.25) * 5,
          vy: (Math.random() - 0.5) * 6,
          life: 14,
          color: color,
        });
      }
    }

    function draw() {
      const w = canvas.clientWidth || 520;
      const h = canvas.clientHeight || 180;
      ctx.clearRect(0, 0, w, h);

      // premium stage wash
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#0a0d14');
      grd.addColorStop(0.5, '#121826');
      grd.addColorStop(1, '#080a10');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      const judgeX = Math.floor(w * 0.2);
      const approach = Engine.APPROACH_MS;
      const tNow = playing ? nowMs() : 0;
      const accent = TYPE_COLOR[type] || '#e8c56a';

      // lane guides
      for (let L = 0; L < 3; L++) {
        const y = laneY(h, L);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(judgeX, y);
        ctx.lineTo(w - 10, y);
        ctx.stroke();
      }

      // corridor glow
      ctx.fillStyle = 'rgba(232,197,106,0.04)';
      ctx.fillRect(judgeX, 16, w - judgeX - 8, h - 32);

      // judge zone
      ctx.fillStyle = 'rgba(232,197,106,0.12)';
      ctx.fillRect(judgeX - 20, 14, 40, h - 28);
      ctx.strokeStyle = '#e8c56a';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(232,197,106,0.45)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(judgeX, 14);
      ctx.lineTo(judgeX, h - 14);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // notes
      for (const hit of tracker.hits) {
        if (hit.resolved) continue;
        const dt = hit.t - tNow;
        const x = judgeX + (dt / approach) * (w - judgeX - 20);
        if (x < -50 || x > w + 50) continue;
        const y = laneY(h, hit.lane);

        if (hit.phase === 'release') {
          // hold tail drawn from paired press — find press
          continue;
        }

        if (hit.kind === 'hold' && hit.phase === 'press') {
          const release = tracker.hits.find(function (r) {
            return r.parentId === hit.parentId && r.phase === 'release';
          });
          const endT = release ? release.t : hit.t + (hit.holdMs || 400);
          const x2 = judgeX + ((endT - tNow) / approach) * (w - judgeX - 20);
          const left = Math.min(x, x2);
          const right = Math.max(x, x2);
          ctx.fillStyle = accent + '55';
          ctx.strokeStyle = accent;
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
          ctx.stroke();
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (type === 'punch') {
          const r = hit.kind === 'double' ? 12 : 15;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.shadowColor = accent;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 2;
          ctx.stroke();
          if (hit.kind === 'double' && hit.hitIndex === 0) {
            ctx.fillStyle = '#fb923c';
            ctx.font = 'bold 10px system-ui';
            ctx.fillText('×2', x + 12, y - 12);
          }
        } else if (type === 'sword') {
          ctx.save();
          ctx.translate(x, y);
          if (hit.dir === 'up' || hit.dir === 'down') ctx.rotate(hit.dir === 'up' ? -1.2 : 1.2);
          else if (hit.dir === 'left') ctx.rotate(3.0);
          else ctx.rotate(-0.5);
          const len = 46;
          ctx.fillStyle = accent;
          ctx.shadowColor = accent;
          ctx.shadowBlur = 8;
          ctx.fillRect(-3, -len / 2, 6, len);
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(-1, -len / 2, 2, len);
          ctx.restore();
          if (hit.dir) {
            ctx.fillStyle = '#e8ecf4';
            ctx.font = 'bold 14px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(DIR_ARROW[hit.dir] || '', x, y - 28);
            ctx.textAlign = 'start';
          }
        } else {
          // projectile
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          const s = hit.kind === 'burst' ? 9 : 12;
          ctx.fillStyle = accent;
          ctx.shadowColor = accent;
          ctx.shadowBlur = 10;
          ctx.fillRect(-s, -s, s * 2, s * 2);
          ctx.shadowBlur = 0;
          ctx.restore();
          if ((hit.kind === 'combo' || hit.kind === 'burst') && hit.hitIndex === 0) {
            ctx.fillStyle = hit.kind === 'burst' ? '#f472b6' : '#fb923c';
            ctx.font = 'bold 10px system-ui';
            ctx.fillText(
              (hit.kind === 'burst' ? 'BURST×' : '×') + (hit.comboCount || ''),
              x + 14,
              y - 14
            );
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 1;
        p.x += p.vx;
        p.y += p.vy;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life / 14;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1;
      }

      if (!playing) {
        ctx.fillStyle = '#8b95a8';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(withChrome ? '按 Start 開始' : '…', w / 2, h - 12);
        ctx.textAlign = 'start';
      }
    }

    function finishIfDone() {
      if (!tracker.isComplete()) return;
      playing = false;
      cancelAnimationFrame(raf);
      raf = 0;
      const result = tracker.result();
      updateHud();
      if (typeof options.onComplete === 'function') {
        options.onComplete({
          judgment: result.judgment,
          accuracy: result.accuracy,
          tallies: result.tallies,
          comboMax: result.comboMax,
        });
      }
      const stopBtn = root.querySelector('[data-act="stop"]');
      const startBtn = root.querySelector('[data-act="start"]');
      if (stopBtn) stopBtn.disabled = true;
      if (startBtn) startBtn.disabled = false;
    }

    function applyJudge(out) {
      if (!out.hit) return;
      showFlash(out.judgment);
      const color =
        out.judgment === 'perfect'
          ? '#5eead4'
          : out.judgment === 'good'
            ? '#fbbf24'
            : '#f87171';
      const w = canvas.clientWidth || 520;
      const h = canvas.clientHeight || 180;
      spawnBurst(color, Math.floor(w * 0.2), laneY(h, out.hit.lane));
      updateHud();
      if (typeof options.onJudge === 'function') options.onJudge(out);
      finishIfDone();
    }

    function loop() {
      if (!playing) return;
      const t = nowMs();
      const missed = tracker.tick(t);
      for (let i = 0; i < missed.length; i++) {
        showFlash('miss');
        if (typeof options.onJudge === 'function') {
          options.onJudge({ judgment: 'miss', hit: missed[i], deltaMs: null });
        }
      }
      if (missed.length) updateHud();
      draw();
      finishIfDone();
      if (playing) raf = requestAnimationFrame(loop);
    }

    function tapInput(meta) {
      if (!playing) return;
      const out = tracker.input(nowMs(), meta || {});
      applyJudge(out);
    }

    function dirFromKeys(e) {
      if (e.code === 'ArrowUp' || e.key === 'ArrowUp') return 'up';
      if (e.code === 'ArrowDown' || e.key === 'ArrowDown') return 'down';
      if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') return 'left';
      if (e.code === 'ArrowRight' || e.key === 'ArrowRight') return 'right';
      return null;
    }

    function laneFromKey(e) {
      if (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z') return 0;
      if (e.code === 'KeyX' || e.key === 'x' || e.key === 'X') return 2;
      return null;
    }

    function onKeyDown(e) {
      if (!playing) return;
      const dir = dirFromKeys(e);
      if (dir) {
        e.preventDefault();
        tapInput({ dir: dir, phase: 'press' });
        return;
      }
      const lane = laneFromKey(e);
      if (e.code === 'Space' || e.key === ' ' || lane != null) {
        e.preventDefault();
        holdPressArmed = true;
        tapInput({
          lane: lane != null ? lane : undefined,
          phase: 'press',
        });
      }
    }

    function onKeyUp(e) {
      if (!playing) return;
      if (e.code === 'Space' || e.key === ' ') {
        if (holdPressArmed) {
          tapInput({ phase: 'release' });
          holdPressArmed = false;
        }
      }
    }

    function onPointerDown(e) {
      if (!playing) return;
      pointerDownAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      const rect = canvas.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const h = rect.height || 180;
      let lane;
      if (relY < h * 0.33) lane = 0;
      else if (relY > h * 0.66) lane = 2;
      else lane = 1;
      holdPressArmed = true;
      tapInput({ lane: lane, phase: 'press' });
    }

    function onPointerUp(e) {
      if (!playing) return;
      if (pointerDownAt) {
        const dx = e.clientX - pointerDownAt.x;
        const dy = e.clientY - pointerDownAt.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 28 && type === 'sword') {
          let dir;
          if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
          else dir = dy > 0 ? 'down' : 'up';
          tapInput({ dir: dir, phase: 'press' });
          pointerDownAt = null;
          holdPressArmed = false;
          return;
        }
      }
      if (holdPressArmed) {
        tapInput({ phase: 'release' });
        holdPressArmed = false;
      }
      pointerDownAt = null;
    }

    function beginPlay() {
      tracker = Engine.createHitTracker(
        options.chart || Engine.demoChart(type),
        windows
      );
      particles.length = 0;
      playing = true;
      startPerf = performance.now();
      holdPressArmed = false;
      updateHud();
      typeEl.textContent = TYPE_LABEL[type] || type;
      typeEl.dataset.type = type;
      const stopBtn = root.querySelector('[data-act="stop"]');
      const startBtn = root.querySelector('[data-act="start"]');
      if (stopBtn) stopBtn.disabled = false;
      if (startBtn) startBtn.disabled = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      playing = false;
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(flashTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.parentElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      const stopBtn = root.querySelector('[data-act="stop"]');
      const startBtn = root.querySelector('[data-act="start"]');
      if (stopBtn) stopBtn.disabled = true;
      if (startBtn) startBtn.disabled = false;
      draw();
    }

    function reset() {
      stop();
      tracker = Engine.createHitTracker(
        options.chart || Engine.demoChart(type),
        windows
      );
      updateHud();
      // rebind after stop unbound
      bind();
      draw();
    }

    function getResult() {
      const r = tracker.result();
      return {
        judgment: r.judgment,
        accuracy: r.accuracy,
        tallies: r.tallies,
        comboMax: r.comboMax,
      };
    }

    function onResize() {
      resizeCanvas();
      draw();
    }

    function bind() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      canvas.parentElement.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('resize', onResize);
    }

    resizeCanvas();
    updateHud();
    draw();
    bind();

    if (withChrome) {
      root.querySelectorAll('.cc-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const next = btn.getAttribute('data-type');
          stop();
          activeSession = null;
          start({
            type: next,
            demoChrome: true,
            container: container,
            onComplete: options.onComplete,
            onJudge: options.onJudge,
            windows: options.windows,
          });
        });
      });
      root.querySelector('[data-act="start"]').addEventListener('click', beginPlay);
      root.querySelector('[data-act="stop"]').addEventListener('click', stop);
    } else {
      beginPlay();
    }

    const handle = { stop: stop, reset: reset, getResult: getResult, beginPlay: beginPlay };
    activeSession = handle;
    return handle;
  }

  function mountDemo(container, opts) {
    return start({
      type: (opts && opts.type) || 'punch',
      container: container || document.getElementById('chart-mount') || document.body,
      demoChrome: true,
      onComplete: opts && opts.onComplete,
      onJudge: opts && opts.onJudge,
      chart: opts && opts.chart,
      windows: opts && opts.windows,
    });
  }

  /**
   * Bout / RhythmCharts compatibility.
   * play(type, mountEl, onComplete) OR play(type, onComplete)
   */
  function play(type, mountOrCb, maybeCb) {
    let mount = document.getElementById('chart-mount');
    let onComplete = function () {};
    if (typeof mountOrCb === 'function') {
      onComplete = mountOrCb;
    } else if (mountOrCb) {
      mount = mountOrCb;
      if (typeof maybeCb === 'function') onComplete = maybeCb;
    } else if (typeof maybeCb === 'function') {
      onComplete = maybeCb;
    }
    const mapped = Engine.normalizeType(type);
    return start({
      type: mapped,
      container: mount || document.body,
      onComplete: function (r) {
        const cap =
          r.judgment === 'perfect'
            ? 'Perfect'
            : r.judgment === 'good'
              ? 'Good'
              : 'Miss';
        onComplete({
          judgment: cap,
          score: Math.round((r.accuracy || 0) * 100),
          accuracy: r.accuracy,
          // lowercase also present for CEO consumers reading play results
          judgmentRaw: r.judgment,
          tallies: r.tallies,
          comboMax: r.comboMax,
        });
      },
    });
  }

  function destroy() {
    if (activeSession) {
      try {
        activeSession.stop();
      } catch (e) {
        /* ignore */
      }
      activeSession = null;
    }
    const mount = document.getElementById('chart-mount');
    if (mount) mount.innerHTML = '';
  }

  global.CareerCharts = {
    start: start,
    play: play,
    destroy: destroy,
    mountDemo: mountDemo,
    TYPE_LABEL: TYPE_LABEL,
    Engine: Engine,
  };
})(typeof window !== 'undefined' ? window : globalThis);
