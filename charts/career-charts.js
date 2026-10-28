/**
 * Career-ChartUI — embeddable martial sparring player (三国武功切磋).
 * Fullscreen Ouendan-style objects only — NOT highway/staff.
 *
 * CEO API (locked):
 *   window.CareerCharts.start({
 *     type: 'punch'|'sword'|'brace'|'deflect'|'charge'|'dodge'|'lrCombo'|'arc',
 *     container,
 *     onComplete(result) // { judgment, accuracy, tallies?, comboMax? }
 *     onHit?(evt)        // optional SFX hook
 *   })
 *   → { stop(), reset(), getResult(), beginPlay() }
 *
 * Aliases: projectile/shuriken/dart/hidden → deflect. Spinner removed.
 * Bout shim: CareerCharts.play(type, mountEl, onComplete)
 */
(function (global) {
  'use strict';

  const Engine = global.CareerChartEngine;
  if (!Engine) {
    console.error('[CareerCharts] Load chart-engine.js before career-charts.js');
    return;
  }

  const DEMO_TYPES = Engine.CANONICAL_TYPES || [
    'punch',
    'sword',
    'brace',
    'deflect',
    'charge',
    'dodge',
    'lrCombo',
    'arc',
  ];

  const TYPE_LABEL = {
    punch: '拳 · 縮圈',
    sword: '劍 · 滑斬',
    brace: '架開',
    deflect: '撥飛',
    charge: '蓄力',
    dodge: '方向閃',
    lrCombo: '左右連擊',
    arc: '弧斬',
  };

  const TAB_LABEL = {
    punch: '拳縮圈',
    sword: '劍滑斬',
    brace: '架開',
    deflect: '撥飛',
    charge: '蓄力',
    dodge: '方向閃',
    lrCombo: '左右連擊',
    arc: '弧斬',
  };

  const TYPE_COLOR = {
    punch: '#ff6b4a',
    sword: '#6ec8ff',
    brace: '#f0c674',
    deflect: '#c084fc',
    charge: '#fb923c',
    dodge: '#34d399',
    lrCombo: '#f472b6',
    arc: '#38bdf8',
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
        DEMO_TYPES.map(function (t) {
          return (
            '<button type="button" class="cc-tab' +
            (type === t ? ' active' : '') +
            '" data-type="' +
            t +
            '">' +
            (TAB_LABEL[t] || t) +
            '</button>'
          );
        }).join('') +
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
      '<canvas class="cc-stage" width="960" height="540" aria-label="martial rhythm chart"></canvas>' +
      '<div class="cc-flash" aria-live="polite"></div>' +
      '</div>' +
      '<p class="cc-hint" data-hint></p>' +
      actionsHtml;

    container.innerHTML = '';
    container.appendChild(root);
    return root;
  }

  function hintFor(type) {
    const map = {
      punch: '拳：縮圈合邊時點擊 · Space 打當前編號',
      sword: '劍：沿短路徑快速拖曳橫斬',
      brace: '架開：按住並撐過撞擊窗 · 早放＝Miss/好',
      deflect: '撥飛：兵器逼近時向外短掃',
      charge: '蓄力：按住蓄力 · 亮拍放開',
      dodge: '方向閃：依提示向左／右／後滑閃',
      lrCombo: '左右連擊：依序點左／右側',
      arc: '弧斬：沿弧路徑跟刀（迴旋斬／掃腿）',
    };
    return map[type] || '';
  }

  function start(opts) {
    const options = opts || {};
    const type = Engine.normalizeType(options.type || 'punch');
    if (!Engine.isCanonicalType(type)) {
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

    let activePath = null;
    let activeBrace = null;
    let activeCharge = null;
    let activeSwipe = null; // deflect / dodge
    let pointerId = null;
    let pointerDownNorm = null;

    function nowMs() {
      return performance.now() - startPerf;
    }

    function emitHit(out) {
      if (typeof options.onHit === 'function' && out && out.hit) {
        try {
          options.onHit({
            judgment: out.judgment,
            type: type,
            kind: out.hit.kind,
            id: out.hit.id,
            number: out.hit.number,
          });
        } catch (e) {
          /* ignore SFX hook errors */
        }
      }
      if (typeof options.onJudge === 'function' && out) {
        try {
          options.onJudge(out);
        } catch (e) {
          /* ignore */
        }
      }
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
      emitHit(out);
      finishIfDone();
    }

    function finishIfDone() {
      if (!tracker.isComplete()) return;
      playing = false;
      cancelAnimationFrame(raf);
      raf = 0;
      activePath = null;
      activeBrace = null;
      activeCharge = null;
      activeSwipe = null;
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

    // ——— Draw helpers ———

    function drawCircle(hit, tNow, w, h, accent, r) {
      const approach = hit.approachMs || Engine.CIRCLE_APPROACH_MS;
      const appear = hit.t - approach;
      if (tNow < appear - 50) return;
      const px = toPx(hit.x, hit.y, w, h);
      let ringScale = 2.6;
      if (tNow >= appear) {
        const p = Math.min(1, Math.max(0, (tNow - appear) / approach));
        ringScale = 2.6 - p * 1.6;
      }
      const ringR = r * ringScale;

      ctx.beginPath();
      ctx.arc(px.x, px.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;

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

      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold ' + Math.round(r * 0.95) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hit.number || ''), px.x, px.y + 1);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function drawPathNote(hit, tNow, w, h, accent, r, thick) {
      const appear = hit.t - 500;
      if (tNow < appear) return;
      const pts = hit.points || [];
      if (pts.length < 2) return;

      ctx.beginPath();
      const p0 = toPx(pts[0].x, pts[0].y, w, h);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = toPx(pts[i].x, pts[i].y, w, h);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = Math.max(thick ? 14 : 10, r * (thick ? 0.7 : 0.55));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

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
            const tt = remain / seg;
            const p = toPx(a.x + (b.x - a.x) * tt, a.y + (b.y - a.y) * tt, w, h);
            ctx.lineTo(p.x, p.y);
            remain = 0;
          }
        }
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(thick ? 16 : 12, r * (thick ? 0.8 : 0.65));
        ctx.stroke();
      }

      const start = toPx(pts[0].x, pts[0].y, w, h);
      const end = toPx(pts[pts.length - 1].x, pts[pts.length - 1].y, w, h);
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

    function drawBrace(hit, tNow, w, h, accent, r) {
      if (tNow < hit.t - 500) return;
      const px = toPx(hit.x, hit.y, w, h);
      const rad = Math.max(r * 1.6, Math.min(w, h) * 0.1);

      // Clash plates
      const open = hit.braceHeld ? 0.15 : Math.max(0.2, Math.min(1, (hit.t - tNow) / 400));
      const gap = rad * (0.35 + open * 0.5);

      ctx.save();
      ctx.translate(px.x, px.y);
      ctx.fillStyle = accent;
      ctx.globalAlpha = hit.braceHeld ? 1 : 0.75;
      ctx.shadowColor = accent;
      ctx.shadowBlur = hit.braceHeld ? 20 : 8;
      // Left plate
      ctx.fillRect(-rad - gap * 0.5, -rad * 0.55, rad * 0.7, rad * 1.1);
      // Right plate
      ctx.fillRect(gap * 0.5, -rad * 0.55, rad * 0.7, rad * 1.1);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Hold progress bar through clash
      if (hit.braceHeld || (tNow >= hit.t - 80 && tNow <= hit.endT)) {
        const p = Math.min(1, Math.max(0, (tNow - hit.t) / (hit.durationMs || 280)));
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.15, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold ' + Math.round(rad * 0.35) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hit.number || ''), 0, 0);
      ctx.restore();
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function drawDeflect(hit, tNow, w, h, accent, r) {
      const approach = hit.approachMs || Engine.TELEGRAPH_MS;
      if (tNow < hit.t - approach - 40) return;
      const px = toPx(hit.x, hit.y, w, h);
      const p = Math.min(1, Math.max(0, (tNow - (hit.t - approach)) / approach));
      // Approaching marker from above-center
      const ay = px.y - (1 - p) * Math.min(h, w) * 0.22;
      const rad = r * (1.1 - p * 0.15);

      ctx.beginPath();
      ctx.moveTo(px.x, ay - rad);
      ctx.lineTo(px.x + rad * 0.7, ay + rad * 0.5);
      ctx.lineTo(px.x - rad * 0.7, ay + rad * 0.5);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.55 + p * 0.45;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Outward arrows near impact
      if (p > 0.55) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px.x - rad * 1.4, px.y);
        ctx.lineTo(px.x - rad * 2.2, px.y - rad * 0.3);
        ctx.moveTo(px.x + rad * 1.4, px.y);
        ctx.lineTo(px.x + rad * 2.2, px.y - rad * 0.3);
        ctx.stroke();
      }

      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold ' + Math.round(rad * 0.7) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hit.number || ''), px.x, ay);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function drawCharge(hit, tNow, w, h, accent, r) {
      if (tNow < hit.t - 900) return;
      const px = toPx(hit.x, hit.y, w, h);
      const rad = Math.max(r * 1.8, Math.min(w, h) * 0.11);
      let chargeP = 0;
      if (hit.chargeHeld && hit.chargePressT != null) {
        chargeP = Math.min(1, (tNow - hit.chargePressT) / (hit.minChargeMs || Engine.CHARGE_MIN_MS));
      } else if (tNow >= hit.t - 700) {
        // idle telegraph pulse toward release beat
        const until = hit.t - tNow;
        chargeP = until > 0 ? Math.max(0, 1 - until / 700) * 0.35 : 0;
      }

      // Aura
      ctx.beginPath();
      ctx.arc(px.x, px.y, rad * (0.7 + chargeP * 0.55), 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(4, rad * 0.08);
      ctx.globalAlpha = 0.4 + chargeP * 0.6;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10 + chargeP * 24;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Bright beat ring near ideal release
      const near = Math.abs(hit.t - tNow);
      if (near < 120) {
        ctx.beginPath();
        ctx.arc(px.x, px.y, rad * 1.05, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff8e7';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - near / 120;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(px.x, px.y, rad * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();

      ctx.fillStyle = '#0a0d14';
      ctx.font = 'bold ' + Math.round(rad * 0.28) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(hit.number || ''), px.x, px.y + 1);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function drawDodge(hit, tNow, w, h, accent, r) {
      const approach = hit.approachMs || Engine.TELEGRAPH_MS;
      if (tNow < hit.t - approach - 40) return;
      const px = toPx(hit.x, hit.y, w, h);
      const p = Math.min(1, Math.max(0, (tNow - (hit.t - approach)) / approach));
      const label = hit.dir === 'L' ? '←' : hit.dir === 'R' ? '→' : '↑';
      const txt = hit.dir === 'L' ? '左' : hit.dir === 'R' ? '右' : '後';

      // Threat disc
      ctx.beginPath();
      ctx.arc(px.x, px.y, r * (1.4 - p * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.25 + p * 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = accent;
      ctx.font = 'bold ' + Math.round(r * 1.6) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
      ctx.fillText(label, px.x, px.y - r * 0.15);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#eef2f8';
      ctx.font = 'bold ' + Math.round(r * 0.55) + 'px system-ui';
      ctx.fillText(txt, px.x, px.y + r * 1.1);
      ctx.font = 'bold ' + Math.round(r * 0.45) + 'px system-ui';
      ctx.fillStyle = '#0a0d14';
      ctx.fillText(String(hit.number || ''), px.x, px.y + r * 0.35);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function drawLrCombo(hit, tNow, w, h, accent, r) {
      if (tNow < hit.t - 500) return;
      const cy = hit.y * h;
      const leftX = w * 0.28;
      const rightX = w * 0.72;
      const step = hit.steps[hit.lrStep] || hit.steps[hit.steps.length - 1];

      function sidePad(x, side, active) {
        const rad = r * (active ? 1.35 : 1.05);
        ctx.beginPath();
        ctx.arc(x, cy, rad, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.globalAlpha = active ? 1 : 0.35;
        ctx.shadowColor = accent;
        ctx.shadowBlur = active ? 18 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0a0d14';
        ctx.font = 'bold ' + Math.round(rad * 0.7) + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(side, x, cy + 1);
      }

      const nextSide = step ? step.side : null;
      sidePad(leftX, 'L', nextSide === 'L');
      sidePad(rightX, 'R', nextSide === 'R');

      // Pattern preview
      ctx.fillStyle = '#8b95a8';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      const pat = (hit.pattern || []).join('·');
      ctx.fillText(pat + '  #' + (hit.number || ''), w * 0.5, cy - r * 2.2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    function draw() {
      const { w, h } = stageSize();
      ctx.clearRect(0, 0, w, h);

      const grd = ctx.createRadialGradient(
        w * 0.5,
        h * 0.45,
        0,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.7
      );
      grd.addColorStop(0, '#121826');
      grd.addColorStop(1, '#07090e');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      const accent = TYPE_COLOR[type] || '#e8c56a';
      const tNow = playing ? nowMs() : 0;
      const r = noteRadius(w, h);

      for (const hit of tracker.hits) {
        if (hit.resolved) continue;
        if (hit.kind === 'circle') drawCircle(hit, tNow, w, h, accent, r);
        else if (hit.kind === 'slider') drawPathNote(hit, tNow, w, h, accent, r, false);
        else if (hit.kind === 'arc') drawPathNote(hit, tNow, w, h, accent, r, true);
        else if (hit.kind === 'brace') drawBrace(hit, tNow, w, h, accent, r);
        else if (hit.kind === 'deflect') drawDeflect(hit, tNow, w, h, accent, r);
        else if (hit.kind === 'charge') drawCharge(hit, tNow, w, h, accent, r);
        else if (hit.kind === 'dodge') drawDodge(hit, tNow, w, h, accent, r);
        else if (hit.kind === 'lrCombo') drawLrCombo(hit, tNow, w, h, accent, r);
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
        if (h.judgment === 'miss') showFlash('miss');
        else if (h.judgment) showFlash(h.judgment);
        emitHit({ judgment: h.judgment || 'miss', hit: h, deltaMs: null });
        if (activePath && activePath.id === h.id) activePath = null;
        if (activeBrace && activeBrace.id === h.id) activeBrace = null;
        if (activeCharge && activeCharge.id === h.id) activeCharge = null;
        if (activeSwipe && activeSwipe.id === h.id) activeSwipe = null;
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
        if (d < rNorm * 2.8 && d < bestD) {
          bestD = d;
          best = hit;
        }
      }
      if (!best && cur) return cur;
      return best;
    }

    function hitTestPathStart(norm, kind) {
      const hit = tracker.currentOpen(kind);
      if (hit && hit.points && hit.points[0] && Engine.dist(norm, hit.points[0]) < 0.14) {
        return hit;
      }
      for (const h of tracker.hits) {
        if (h.resolved || h.kind !== kind || !h.points) continue;
        if (Engine.dist(norm, h.points[0]) < 0.12) return h;
      }
      return hit;
    }

    function onKeyDown(e) {
      if (!playing) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (type === 'punch') {
          applyJudge(tracker.input(nowMs(), { kind: 'circle' }));
        } else if (type === 'brace' && !activeBrace) {
          const hit = tracker.beginBrace(nowMs());
          if (hit) activeBrace = hit;
        } else if (type === 'charge' && !activeCharge) {
          const hit = tracker.beginCharge(nowMs());
          if (hit) activeCharge = hit;
        } else if (type === 'lrCombo') {
          // Space alternates as next required side
          const cur = tracker.currentOpen('lrCombo');
          if (cur && cur.steps[cur.lrStep]) {
            const out = tracker.tapLrCombo(nowMs(), cur.steps[cur.lrStep].side);
            if (out.hit) applyJudge(out);
            else if (!out.partial) updateHud();
          }
        }
      }
      if (type === 'lrCombo') {
        if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          const out = tracker.tapLrCombo(nowMs(), 'L');
          if (out.hit) applyJudge(out);
        }
        if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          const out = tracker.tapLrCombo(nowMs(), 'R');
          if (out.hit) applyJudge(out);
        }
      }
      if (type === 'dodge') {
        let dir = null;
        if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dir = 'L';
        if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = 'R';
        if (e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') dir = 'back';
        if (dir) {
          e.preventDefault();
          const hit = tracker.currentOpen('dodge');
          if (hit) {
            tracker.beginDodgeSwipe(nowMs(), hit.id, { x: hit.x, y: hit.y });
            let to = { x: hit.x, y: hit.y };
            if (dir === 'L') to = { x: hit.x - 0.12, y: hit.y };
            else if (dir === 'R') to = { x: hit.x + 0.12, y: hit.y };
            else to = { x: hit.x, y: hit.y - 0.12 };
            applyJudge(tracker.endDodgeSwipe(nowMs(), hit, to));
          }
        }
      }
    }

    function onKeyUp(e) {
      if (!playing) return;
      if (e.code === 'Space' || e.key === ' ') {
        if (type === 'brace' && activeBrace && !activeBrace.resolved) {
          const out = tracker.endBrace(nowMs(), activeBrace);
          activeBrace = null;
          applyJudge(out);
        }
        if (type === 'charge' && activeCharge && !activeCharge.resolved) {
          const out = tracker.endCharge(nowMs(), activeCharge);
          activeCharge = null;
          applyJudge(out);
        }
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
      pointerDownNorm = norm;
      const t = nowMs();

      if (type === 'punch') {
        const hit = hitTestCircle(norm);
        if (hit) applyJudge(tracker.input(t, { kind: 'circle', targetId: hit.id }));
        else {
          const out = tracker.input(t, { kind: 'circle' });
          if (out.hit) applyJudge(out);
        }
        return;
      }

      if (type === 'sword' || type === 'arc') {
        const kind = type === 'arc' ? 'arc' : 'slider';
        const hit = hitTestPathStart(norm, kind) || tracker.currentOpen(kind);
        if (hit) {
          const started =
            kind === 'arc' ? tracker.beginArc(t, hit.id) : tracker.beginSlider(t, hit.id);
          if (started) {
            activePath = started;
            tracker.movePath(started, norm);
          }
        }
        return;
      }

      if (type === 'brace') {
        const hit = tracker.beginBrace(t);
        if (hit) activeBrace = hit;
        return;
      }

      if (type === 'charge') {
        const hit = tracker.beginCharge(t);
        if (hit) activeCharge = hit;
        return;
      }

      if (type === 'deflect') {
        const hit = tracker.currentOpen('deflect');
        if (hit) {
          const started = tracker.beginDeflectSwipe(t, hit.id, norm);
          if (started) activeSwipe = started;
        }
        return;
      }

      if (type === 'dodge') {
        const hit = tracker.currentOpen('dodge');
        if (hit) {
          const started = tracker.beginDodgeSwipe(t, hit.id, norm);
          if (started) activeSwipe = started;
        }
        return;
      }

      if (type === 'lrCombo') {
        const { w } = stageSize();
        const side = norm.x < 0.5 ? 'L' : 'R';
        void w;
        const out = tracker.tapLrCombo(t, side);
        if (out.hit) applyJudge(out);
        return;
      }
    }

    function onPointerMove(e) {
      if (!playing) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      const norm = toNorm(e.clientX, e.clientY);

      if ((type === 'sword' || type === 'arc') && activePath && !activePath.resolved) {
        tracker.movePath(activePath, norm);
        if (activePath.sliderProgress >= 0.95) {
          const out = tracker.endPath(nowMs(), activePath);
          activePath = null;
          applyJudge(out);
        }
      }
    }

    function onPointerUp(e) {
      if (!playing) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      const norm = toNorm(e.clientX, e.clientY);
      const t = nowMs();

      if ((type === 'sword' || type === 'arc') && activePath && !activePath.resolved) {
        tracker.movePath(activePath, norm);
        const out = tracker.endPath(t, activePath);
        activePath = null;
        applyJudge(out);
      }

      if (type === 'brace' && activeBrace && !activeBrace.resolved) {
        const out = tracker.endBrace(t, activeBrace);
        activeBrace = null;
        applyJudge(out);
      }

      if (type === 'charge' && activeCharge && !activeCharge.resolved) {
        const out = tracker.endCharge(t, activeCharge);
        activeCharge = null;
        applyJudge(out);
      }

      if (type === 'deflect' && activeSwipe && !activeSwipe.resolved) {
        const out = tracker.endDeflectSwipe(t, activeSwipe, norm);
        activeSwipe = null;
        applyJudge(out);
      }

      if (type === 'dodge' && activeSwipe && !activeSwipe.resolved) {
        const out = tracker.endDodgeSwipe(t, activeSwipe, norm);
        activeSwipe = null;
        applyJudge(out);
      }

      pointerId = null;
      pointerDownNorm = null;
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
      activePath = null;
      activeBrace = null;
      activeCharge = null;
      activeSwipe = null;
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
      activePath = null;
      activeBrace = null;
      activeCharge = null;
      activeSwipe = null;
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
            onHit: options.onHit,
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
      onHit: opts && opts.onHit,
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
    TAB_LABEL: TAB_LABEL,
    CANONICAL_TYPES: DEMO_TYPES,
    Engine: Engine,
  };
})(typeof window !== 'undefined' ? window : globalThis);
