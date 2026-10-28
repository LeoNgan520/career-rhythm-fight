/**
 * audio.js — ORIGINAL procedural 傳統戰鼓 (ancient large-drum / 鼉鼓) bed + SFX.
 * Oscillators + noise only. No copyrighted melodies, samples, anime themes, or licensed taiko packs.
 * Layers: deep sub-100Hz boom hits, soft wood knocks, rare sparse fills, optional low drone.
 * Tuned for 低沉大鼓共鳴 — not modern kick/rim electronic.
 */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var musicGain = null;
  var sfxGain = null;
  var muted = false;
  var bedNodes = [];
  var bedTimers = [];
  var started = false;

  // Locked BPM for future chart beat-lock (matches audio/*.wav generators)
  var BPM = 132;
  var BEAT = 60 / BPM;
  var BAR = BEAT * 4;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.68;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.42;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.62;
    sfxGain.connect(master);
    return ctx;
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function track(node) {
    bedNodes.push(node);
    return node;
  }

  function scheduleTimer(fn, ms) {
    var id = setTimeout(fn, ms);
    bedTimers.push(id);
    return id;
  }

  function tone(freq, dur, type, gain, when) {
    if (!ensure() || muted) return;
    var t0 = when || ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sawtooth';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, gain) {
    if (!ensure() || muted) return;
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    g.gain.value = gain || 0.15;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    src.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    src.start();
  }

  /* ---- bed building blocks: 低沉大鼓 / 鼉鼓 procedural (original) ---- */

  /**
   * Deep resonant war drum: long sub boom + body sweep + soft membrane.
   * Sub-100Hz body, long decay — ancient large-drum feel, not snappy kick.
   */
  function playWarDrum(t, amp) {
    amp = amp == null ? 0.62 : amp;

    // Primary body: low sweep into sub (start ~58Hz → ~26Hz)
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(58, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 0.38);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(amp * 0.35, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    o.connect(g);
    g.connect(musicGain);
    o.start(t);
    o.stop(t + 0.78);
    track(o);

    // Dedicated sub boom (~42Hz) — long resonant tail (鼉鼓共鳴)
    var sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(46, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.55);
    var sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(amp * 0.72, t + 0.018);
    sg.gain.exponentialRampToValueAtTime(amp * 0.28, t + 0.35);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    var subLp = ctx.createBiquadFilter();
    subLp.type = 'lowpass';
    subLp.frequency.value = 90;
    subLp.Q.value = 0.9;
    sub.connect(subLp);
    subLp.connect(sg);
    sg.connect(musicGain);
    sub.start(t);
    sub.stop(t + 1.0);
    track(sub);

    // Soft membrane transient (low band — not bright stick crack)
    var n = Math.floor(ctx.sampleRate * 0.08);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.022));
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380;
    bp.Q.value = 0.7;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(amp * 0.28, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(musicGain);
    src.start(t);
    src.stop(t + 0.09);
    track(src);

    // Soft attack tone (low triangle, short — not snappy rim)
    var click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(110, t);
    click.frequency.exponentialRampToValueAtTime(48, t + 0.06);
    var cg = ctx.createGain();
    cg.gain.setValueAtTime(amp * 0.14, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    click.connect(cg);
    cg.connect(musicGain);
    click.start(t);
    click.stop(t + 0.08);
    track(click);
  }

  /** Soft wood knock (ancient stick-on-rim) — muted, mid-low, not hat/rim snap. */
  function playWoodRim(t, amp) {
    amp = amp == null ? 0.10 : amp;
    var freqs = [420, 680, 280];
    var gains = [0.5, 0.22, 0.28];
    for (var i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freqs[i], t);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * gains[i], t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      o.connect(g);
      g.connect(musicGain);
      o.start(t);
      o.stop(t + 0.065);
      track(o);
    }
    var n = Math.floor(ctx.sampleRate * 0.035);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var j = 0; j < n; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.012));
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(amp * 0.22, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(musicGain);
    src.start(t);
    src.stop(t + 0.04);
    track(src);
  }

  /** Deep mid drum for rare fills (not bright tom). */
  function playTom(t, freq, amp) {
    freq = freq || 95;
    amp = amp == null ? 0.32 : amp;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.42, t + 0.22);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g);
    g.connect(musicGain);
    o.start(t);
    o.stop(t + 0.36);
    track(o);

    // soft sub under fill hit
    var sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(Math.min(freq * 0.5, 48), t);
    var sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(amp * 0.4, t + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    sub.connect(sg);
    sg.connect(musicGain);
    sub.start(t);
    sub.stop(t + 0.42);
    track(sub);
  }

  function clearBedTimers() {
    bedTimers.forEach(function (id) {
      clearTimeout(id);
    });
    bedTimers = [];
  }

  function stopBedInternal() {
    clearBedTimers();
    bedNodes.forEach(function (n) {
      try { n.stop(); } catch (e) { /* */ }
      try { n.disconnect(); } catch (e2) { /* */ }
    });
    bedNodes = [];
  }

  function startBed() {
    if (!ensure() || muted || started) return;
    resume();
    stopBedInternal();
    started = true;
    var t0 = ctx.currentTime + 0.05;

    // --- Layer: low drone only (sine + soft detune) — no brass / pad lead ---
    var drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 41.2; // E1-ish — deeper than A1
    var drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 41.45;
    var droneSub = ctx.createOscillator();
    droneSub.type = 'sine';
    droneSub.frequency.value = 27.5;
    var droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 120;
    droneLp.Q.value = 0.8;
    var droneG = ctx.createGain();
    droneG.gain.value = 0.13;
    var droneLfo = ctx.createOscillator();
    droneLfo.type = 'sine';
    droneLfo.frequency.value = 0.09;
    var droneLfoG = ctx.createGain();
    droneLfoG.gain.value = 0.03;
    droneLfo.connect(droneLfoG);
    droneLfoG.connect(droneG.gain);
    drone.connect(droneLp);
    drone2.connect(droneLp);
    droneSub.connect(droneLp);
    droneLp.connect(droneG);
    droneG.connect(musicGain);
    drone.start(t0);
    drone2.start(t0);
    droneSub.start(t0);
    droneLfo.start(t0);
    track(drone);
    track(drone2);
    track(droneSub);
    track(droneLfo);

    // --- Layer: sparse deep war-drum pulse @ BPM 132 (few wood knocks, rare fills) ---
    var barIndex = 0;

    function scheduleBar() {
      if (!started || muted || !ctx) return;
      var now = ctx.currentTime;
      var barStart = now + 0.02;

      // Deep war drums on 1 and 3 (body of the groove)
      playWarDrum(barStart, 0.68);
      playWarDrum(barStart + BEAT * 2, 0.55);

      // Syncopated answer every other bar (still deep, quieter)
      if (barIndex % 2 === 1) {
        playWarDrum(barStart + BEAT * 3.5, 0.36);
      }

      // Soft wood knocks only on 2 and 4 — no offbeat hats
      playWoodRim(barStart + BEAT, 0.11);
      playWoodRim(barStart + BEAT * 3, 0.09);

      // Rare fill every 8 bars (deep drums into downbeat — no modern tom roll)
      if (barIndex > 0 && barIndex % 8 === 7) {
        playTom(barStart + BEAT * 3.0, 105, 0.30);
        playTom(barStart + BEAT * 3.35, 80, 0.34);
        playWarDrum(barStart + BEAT * 3.7, 0.58);
      }

      // Slight denser boom every 16 bars (escalation without brass / snappy rims)
      if (barIndex > 0 && barIndex % 16 === 0) {
        playWarDrum(barStart + BEAT * 1.5, 0.32);
      }

      barIndex++;
      scheduleTimer(scheduleBar, BAR * 1000 - 30);
    }

    scheduleBar();
  }

  var AudioFX = {
    unlock: function () {
      resume();
      if (!started) startBed();
      else if (musicGain && !muted) {
        var t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(0.42, t + 0.15);
      }
    },
    startBed: startBed,
    stopBed: function () {
      started = false;
      stopBedInternal();
    },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.68;
      if (!muted) {
        resume();
        if (!started) startBed();
      }
    },
    isMuted: function () { return muted; },
    telegraph: function () {
      tone(180, 0.18, 'sawtooth', 0.18);
      tone(240, 0.12, 'square', 0.1, ensure() ? ctx.currentTime + 0.08 : 0);
    },
    showcase: function () {
      tone(90, 0.4, 'sawtooth', 0.15);
      noiseBurst(0.15, 0.08);
    },
    chartOpen: function () {
      tone(440, 0.1, 'sine', 0.12);
      tone(660, 0.12, 'sine', 0.1, ensure() ? ctx.currentTime + 0.06 : 0);
    },
    perfect: function () {
      // Strong martial impact + bright confirm (audible even if bed is loud / muted bed still leaves SFX)
      noiseBurst(0.1, 0.28);
      tone(90, 0.14, 'sine', 0.32);
      tone(180, 0.1, 'square', 0.18);
      tone(523.25, 0.11, 'sine', 0.26, ensure() ? ctx.currentTime + 0.04 : 0);
      tone(783.99, 0.16, 'triangle', 0.22, ensure() ? ctx.currentTime + 0.09 : 0);
      tone(1046.5, 0.18, 'sine', 0.14, ensure() ? ctx.currentTime + 0.14 : 0);
    },
    good: function () {
      noiseBurst(0.08, 0.18);
      tone(110, 0.12, 'sine', 0.24);
      tone(392, 0.12, 'triangle', 0.2);
      tone(523.25, 0.14, 'sine', 0.14, ensure() ? ctx.currentTime + 0.07 : 0);
    },
    miss: function () {
      noiseBurst(0.28, 0.32);
      tone(55, 0.32, 'sawtooth', 0.28);
      tone(42, 0.4, 'sine', 0.18, ensure() ? ctx.currentTime + 0.05 : 0);
    },
    hit: function () {
      noiseBurst(0.12, 0.26);
      tone(120, 0.12, 'square', 0.22);
      tone(70, 0.16, 'sine', 0.2);
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0.22, 'triangle', 0.14, ensure() ? ctx.currentTime + i * 0.1 : 0);
      });
    },
    lose: function () {
      tone(200, 0.3, 'sawtooth', 0.15);
      tone(140, 0.4, 'sawtooth', 0.12, ensure() ? ctx.currentTime + 0.2 : 0);
    },
  };

  global.BattleAudio = AudioFX;
})(typeof window !== 'undefined' ? window : globalThis);
