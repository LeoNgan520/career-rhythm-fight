/**
 * Career-ChartUI — embeddable Ouendan-style player for CombatFeel.
 *
 * CEO API (locked):
 *   window.CareerCharts.start({
 *     type: 'punch' | 'sword' | 'projectile',
 *     container,
 *     onComplete(result) // { judgment, accuracy, tallies?, comboMax? }
 *   })
 *   → { stop(), reset(), getResult(), beginPlay() }
 *
 * Type mapping:
 *   punch      → approach circles 縮圈 (tap)
 *   sword      → fast sliders (drag along path)
 *   projectile → spinner 轉盤 (hold + rotate to fill)
 *
 * Bout shim: CareerCharts.play(type, mountEl, onComplete)
 */
(function (global) {
  'use strict';

  const Engine = global.CareerChartEngine;
  if (!Engine) {
    console.error('[CareerCharts] Load chart-engine.js before career-charts.js');
    return;
  }

  const TYPE_LABEL = {
    punch: '拳 · 縮圈',
    sword: '劍 · 快斬',
    projectile: '暗器 · 轉盤',
  };

  const TYPE_COLOR = {
    punch: '#ff6b4a',
    sword: '#6ec8ff',
    projectile: '#c084fc',
  };

  let activeSession = null;

  function buildShell(container, type, withChrome) {
    const root = document.createElement('div');
    root.className = 'career-charts-root cc-fullscreen';
    root.dataset.type = type;
    if (withChrome) root.classList.add('cc-demo');

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
      '<canvas class="cc-stage" width="960" height="540" aria-label="rhythm chart"></canvas>' +
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
      return '劍：沿路徑快速拖曳斬擊 · 短距快掃';
    }
    if (type === 'projectile') {
      return '暗器：按住並繞中心旋轉填滿轉盤＝格擋';
    }
    return '拳：縮圈合邊時點擊圓點 · Space 打當前編號';
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
    if (container && container !== document.body) {
      if (!container.style.position) container.style.position = 'relative';
      if (!container.style.width) container.style.width = '100%';
      if (!container.style.height) container.style.height = '100%';
      if (!container.style.minHeight) container.style.minHeight = '100%';
    }
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

    // Interaction state
    let activeSlider = null;
    let activeSpinner = null;
    let lastPointerAngle = null;
    let pointerId = null;

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
      let w = wrap.clientWidth || 0;
      let h = wrap.clientHeight || 0;
      if (w < 40) w = Math.max(280, container.clientWidth || window.innerWidth || 960);
      if (h < 40) h = Math.max(240, container.clientHeight || window.innerHeight || 540);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function stageSize() {
      return {
        w: canvas.clientWidth || Math.max(280, window.innerWidth || 960),
        h: canvas.clientHeight || Math.max(240, window.innerHeight || 540),
      };
    }

    function toNorm(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Engine.clamp01((clientX - rect.left) / (rect.width || 1)),
        y: Engine.clamp01((clientY - rect.top) / (rect.height || 1)),
      };
    }

    function toPx(nx, ny, w, h) {
      return { x: nx * w, y: ny * h };
    }

    function noteRadius(w, h) {
      return Math.max(28, Math.min(w, h) * 0.055);
    }

    function spawnBurst(color, x, y) {
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 16,
          color: color,
        });
      }
    }

    function applyJudge(out) {
      if (!out || !out.hit) return;
      showFlash(out.judgment);
      const color =
        out.judgment === 'perfect'
          ? '#5eead4'
          : out.judgment === 'good'
            ? '#fbbf24'
            : '#f87171';
      const { w, h } = stageSize();
      const px = toPx(out.hit.x || 0.5, out.hit.y || 0.5, w, h);
      spawnBurst(color, px.x, px.y);
      updateHud();
      if (typeof options.onJudge === 'function') options.onJudge(out);
      finishIfDone();
    }

    function finishIfDone() {
      if (!tracker.isComplete()) return;
      playing = false;
      cancelAnimationFrame(raf);
      raf = 0;
      activeSlider = null;
      activeSpinner = null;
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

    function drawCircle(hit, tNow, w, h, accent, r) {
      const approach = hit.approachMs || Engine.CIRCLE_APPROACH_MS;
      const appear = hit.t - approach;
      if (tNow < appear - 50) return;
      const px = toPx(hit.x, hit.y, w, h);
      // Ring scale: 2.6 → 1.0 as t approaches hit.t
      let ringScale = 2.6;
      if (tNow >= appear) {
        const p = Math.min(1, Math.max(0, (tNow - appear) / approach));
        ringScale = 2.6 - p * 1.6; // 2.6 → 1.0
      }
      const ringR = r * ringScale;

      // Approach ring
      ctx.beginPath();
      ctx.arc(px.x, px.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Marker disc
      ctx.beginPath();
      ctx.arc(px.x, px.y, r, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Number
      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold ' + Math.round(r * 0.95) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hit.number || ''), px.x, px.y + 1);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function drawSlider(hit, tNow, w, h, accent, r) {
      const appear = hit.t - 500;
      if (tNow < appear) return;
      const pts = hit.points || [];
      if (pts.length < 2) return;

      // Path
      ctx.beginPath();
      const p0 = toPx(pts[0].x, pts[0].y, w, h);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = toPx(pts[i].x, pts[i].y, w, h);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = Math.max(10, r * 0.55);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Progress fill
      if (hit.sliderStarted && hit.sliderProgress > 0) {
        const total = Engine.pathLength(pts);
        let remain = total * hit.sliderProgress;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const seg = Engine.dist(a, b);
          if (remain <= 0) break;
          if (remain >= seg) {
            const p = toPx(b.x, b.y, w, h);
            ctx.lineTo(p.x, p.y);
            remain -= seg;
          } else {
            const t = remain / seg;
            const p = toPx(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, w, h);
            ctx.lineTo(p.x, p.y);
            remain = 0;
          }
        }
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(12, r * 0.65);
        ctx.stroke();
      }

      // Start / end markers
      const start = toPx(pts[0].x, pts[0].y, w, h);
      const end = toPx(pts[pts.length - 1].x, pts[pts.length - 1].y, w, h);

      // Approach pulse on start near t
      const dt = hit.t - tNow;
      let pulse = 1;
      if (dt > 0 && dt < 500) pulse = 1 + (dt / 500) * 0.6;

      ctx.beginPath();
      ctx.arc(start.x, start.y, r * 0.85 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold ' + Math.round(r * 0.75) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hit.number || ''), start.x, start.y + 1);

      ctx.beginPath();
      ctx.arc(end.x, end.y, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function drawSpinner(hit, tNow, w, h, accent, r) {
      if (tNow < hit.t - 400) return;
      const px = toPx(hit.x, hit.y, w, h);
      const rad = Math.max(r * 2.2, Math.min(w, h) * 0.12);
      const fill = Math.min(1, hit.spinnerFill / hit.fillRequired);

      // Outer ring
      ctx.beginPath();
      ctx.arc(px.x, px.y, rad, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(8, rad * 0.12);
      ctx.stroke();

      // Fill arc
      if (fill > 0) {
        ctx.beginPath();
        ctx.arc(px.x, px.y, rad, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(10, rad * 0.14);
        ctx.lineCap = 'round';
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Center disc
      ctx.beginPath();
      ctx.arc(px.x, px.y, rad * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = hit.spinnerHeld ? 1 : 0.75;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold ' + Math.round(rad * 0.28) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hit.number || ''), px.x, px.y + 1);

      // Hint arrows when active
      if (hit.spinnerHeld || (tNow >= hit.t - 100 && tNow <= hit.endT)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px.x, px.y, rad * 0.7, -0.8, 0.8);
        ctx.stroke();
      }
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function draw() {
      const { w, h } = stageSize();
      ctx.clearRect(0, 0, w, h);

      const grd = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
      grd.addColorStop(0, '#121826');
      grd.addColorStop(1, '#07090e');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      const accent = TYPE_COLOR[type] || '#e8c56a';
      const tNow = playing ? nowMs() : 0;
      const r = noteRadius(w, h);

      // Draw unresolved + active notes (no highway / judge-line)
      for (const hit of tracker.hits) {
        if (hit.resolved) continue;
        if (hit.kind === 'circle') drawCircle(hit, tNow, w, h, accent, r);
        else if (hit.kind === 'slider') drawSlider(hit, tNow, w, h, accent, r);
        else if (hit.kind === 'spinner') drawSpinner(hit, tNow, w, h, accent, r);
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
        ctx.globalAlpha = p.life / 16;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
        ctx.globalAlpha = 1;
      }

      if (!playing) {
        ctx.fillStyle = '#8b95a8';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(withChrome ? '按 Start 開始' : '…', w / 2, h - 36);
        ctx.textAlign = 'start';
      }
    }

    function loop() {
      if (!playing) return;
      const t = nowMs();
      const missed = tracker.tick(t);
      for (let i = 0; i < missed.length; i++) {
        const h = missed[i];
        // Only flash miss if actually missed (not successful spinner end)
        if (h.judgment === 'miss') showFlash('miss');
        else if (h.judgment) showFlash(h.judgment);
        if (typeof options.onJudge === 'function') {
          options.onJudge({ judgment: h.judgment || 'miss', hit: h, deltaMs: null });
        }
        if (activeSlider && activeSlider.id === h.id) activeSlider = null;
        if (activeSpinner && activeSpinner.id === h.id) activeSpinner = null;
      }
      if (missed.length) updateHud();
      draw();
      finishIfDone();
      if (playing) raf = requestAnimationFrame(loop);
    }

    function hitTestCircle(norm) {
      const { w, h } = stageSize();
      const r = noteRadius(w, h);
      const rNorm = r / Math.min(w, h);
      // Prefer current target if near it; else any visible circle under finger
      const cur = tracker.currentCircle();
      const candidates = tracker.hits.filter(function (hit) {
        return !hit.resolved && hit.kind === 'circle';
      });
      let best = null;
      let bestD = Infinity;
      for (const hit of candidates) {
        const d = Engine.dist(norm, { x: hit.x, y: hit.y });
        const appear = hit.t - (hit.approachMs || Engine.CIRCLE_APPROACH_MS);
        if (nowMs() < appear - 80) continue;
        // Hit area includes approach ring loosely
        if (d < rNorm * 2.8 && d < bestD) {
          bestD = d;
          best = hit;
        }
      }
      // Space / ambiguous: use current numbered
      if (!best && cur) return cur;
      return best;
    }

    function hitTestSliderStart(norm) {
      const hit = tracker.currentOpen('slider');
      if (!hit || !hit.points || !hit.points[0]) return null;
      if (Engine.dist(norm, hit.points[0]) < 0.12) return hit;
      // Also allow any upcoming slider start nearby
      for (const h of tracker.hits) {
        if (h.resolved || h.kind !== 'slider' || !h.points) continue;
        if (Engine.dist(norm, h.points[0]) < 0.1) return h;
      }
      return hit && Engine.dist(norm, hit.points[0]) < 0.18 ? hit : null;
    }

    function hitTestSpinner(norm) {
      for (const h of tracker.hits) {
        if (h.resolved || h.kind !== 'spinner') continue;
        if (Engine.dist(norm, { x: h.x, y: h.y }) < 0.18) return h;
      }
      return tracker.currentOpen('spinner');
    }

    function angleAt(norm, cx, cy) {
      return Math.atan2(norm.y - cy, norm.x - cx);
    }

    function onKeyDown(e) {
      if (!playing) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (type === 'punch') {
          const out = tracker.input(nowMs(), { kind: 'circle' });
          applyJudge(out);
        } else if (type === 'projectile') {
          // Space starts/holds current spinner (no spin without pointer — small nudge)
          if (!activeSpinner) {
            const hit = tracker.beginSpinner(nowMs());
            if (hit) {
              activeSpinner = hit;
              // Space alone adds a modest fill tick so keyboard can still clear demos
              tracker.spinSpinner(hit, Engine.SPINNER_FILL_REQUIRED * 0.08);
            }
          } else {
            tracker.spinSpinner(activeSpinner, Engine.SPINNER_FILL_REQUIRED * 0.08);
            if (activeSpinner.spinnerFill >= activeSpinner.fillRequired) {
              const out = tracker.endSpinner(activeSpinner);
              activeSpinner = null;
              applyJudge(out);
            }
          }
        }
      }
    }

    function onKeyUp(e) {
      if (!playing) return;
      if ((e.code === 'Space' || e.key === ' ') && type === 'projectile' && activeSpinner) {
        const out = tracker.endSpinner(activeSpinner);
        activeSpinner = null;
        applyJudge(out);
      }
    }

    function onPointerDown(e) {
      if (!playing) return;
      e.preventDefault();
      pointerId = e.pointerId;
      try {
        canvas.setPointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
      const norm = toNorm(e.clientX, e.clientY);
      const t = nowMs();

      if (type === 'punch') {
        const hit = hitTestCircle(norm);
        if (hit) {
          const out = tracker.input(t, { kind: 'circle', targetId: hit.id });
          applyJudge(out);
        } else {
          // Tap empty — try current target (lenient Space-equivalent)
          const out = tracker.input(t, { kind: 'circle' });
          if (out.hit) applyJudge(out);
        }
        return;
      }

      if (type === 'sword') {
        const hit = hitTestSliderStart(norm) || tracker.currentOpen('slider');
        if (hit) {
          const started = tracker.beginSlider(t, hit.id);
          if (started) {
            activeSlider = started;
            tracker.moveSlider(started, norm);
          }
        }
        return;
      }

      if (type === 'projectile') {
        const hit = hitTestSpinner(norm);
        if (hit) {
          const started = tracker.beginSpinner(t, hit.id);
          if (started) {
            activeSpinner = started;
            lastPointerAngle = angleAt(norm, hit.x, hit.y);
          }
        }
      }
    }

    function onPointerMove(e) {
      if (!playing) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      const norm = toNorm(e.clientX, e.clientY);

      if (type === 'sword' && activeSlider && !activeSlider.resolved) {
        tracker.moveSlider(activeSlider, norm);
        // Auto-complete when path done near end time
        if (activeSlider.sliderProgress >= 0.95) {
          const out = tracker.endSlider(nowMs(), activeSlider);
          activeSlider = null;
          applyJudge(out);
        }
        return;
      }

      if (type === 'projectile' && activeSpinner && !activeSpinner.resolved) {
        const ang = angleAt(norm, activeSpinner.x, activeSpinner.y);
        if (lastPointerAngle != null) {
          let d = ang - lastPointerAngle;
          // Wrap to [-π, π]
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          tracker.spinSpinner(activeSpinner, d);
          if (activeSpinner.spinnerFill >= activeSpinner.fillRequired) {
            const out = tracker.endSpinner(activeSpinner);
            activeSpinner = null;
            lastPointerAngle = null;
            applyJudge(out);
            return;
          }
        }
        lastPointerAngle = ang;
      }
    }

    function onPointerUp(e) {
      if (!playing) return;
      if (pointerId != null && e.pointerId !== pointerId) return;

      if (type === 'sword' && activeSlider && !activeSlider.resolved) {
        const norm = toNorm(e.clientX, e.clientY);
        tracker.moveSlider(activeSlider, norm);
        const out = tracker.endSlider(nowMs(), activeSlider);
        activeSlider = null;
        applyJudge(out);
      }

      if (type === 'projectile' && activeSpinner && !activeSpinner.resolved) {
        const out = tracker.endSpinner(activeSpinner);
        activeSpinner = null;
        lastPointerAngle = null;
        applyJudge(out);
      }

      pointerId = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    }

    function beginPlay() {
      tracker = Engine.createHitTracker(
        options.chart || Engine.demoChart(type),
        windows
      );
      particles.length = 0;
      playing = true;
      startPerf = performance.now();
      activeSlider = null;
      activeSpinner = null;
      lastPointerAngle = null;
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
      activeSlider = null;
      activeSpinner = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
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
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
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
