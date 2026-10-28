/**
 * audio.js — royalty-free WebAudio battle bed + SFX (no copyrighted tracks).
 * Self-generated oscillators / noise only.
 */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var musicGain = null;
  var sfxGain = null;
  var muted = false;
  var bedNodes = [];
  var started = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.68;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.30;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(master);
    return ctx;
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
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

  function stopBed() {
    bedNodes.forEach(function (n) {
      try { n.stop(); } catch (e) { /* */ }
      try { n.disconnect(); } catch (e2) { /* */ }
    });
    bedNodes = [];
  }

  function startBed() {
    if (!ensure() || muted || started) return;
    resume();
    stopBed();
    started = true;
    var t0 = ctx.currentTime;

    // Low drone
    var drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    var dg = ctx.createGain();
    dg.gain.value = 0.09;
    var df = ctx.createBiquadFilter();
    df.type = 'lowpass';
    df.frequency.value = 180;
    drone.connect(df);
    df.connect(dg);
    dg.connect(musicGain);
    drone.start(t0);
    bedNodes.push(drone);

    // Pulse fifth
    var pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.value = 82.5;
    var pg = ctx.createGain();
    pg.gain.value = 0.055;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 2.2;
    var lfoG = ctx.createGain();
    lfoG.gain.value = 0.035;
    lfo.connect(lfoG);
    lfoG.connect(pg.gain);
    pulse.connect(pg);
    pg.connect(musicGain);
    pulse.start(t0);
    lfo.start(t0);
    bedNodes.push(pulse, lfo);

    // Sparse arpeggio beeps via scheduled tones
    function scheduleArp() {
      if (!started || muted || !ctx) return;
      var base = ctx.currentTime;
      var notes = [110, 146.83, 164.81, 220, 164.81, 146.83];
      notes.forEach(function (f, i) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        var t = base + i * 0.28;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g);
        g.connect(musicGain);
        o.start(t);
        o.stop(t + 0.25);
        bedNodes.push(o);
      });
      setTimeout(scheduleArp, 2200);
    }
    scheduleArp();
  }

  var AudioFX = {
    unlock: function () {
      resume();
      if (!started) startBed();
      else if (musicGain && !muted) {
        // bed already running — nudge presence on Start
        var t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(0.30, t + 0.15);
      }
    },
    startBed: startBed,
    stopBed: function () {
      started = false;
      stopBed();
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
      tone(523.25, 0.12, 'sine', 0.22);
      tone(659.25, 0.14, 'sine', 0.18, ensure() ? ctx.currentTime + 0.06 : 0);
      tone(783.99, 0.2, 'triangle', 0.16, ensure() ? ctx.currentTime + 0.12 : 0);
    },
    good: function () {
      tone(392, 0.12, 'triangle', 0.18);
      tone(494, 0.14, 'sine', 0.12, ensure() ? ctx.currentTime + 0.07 : 0);
    },
    miss: function () {
      noiseBurst(0.22, 0.2);
      tone(70, 0.25, 'sawtooth', 0.2);
    },
    hit: function () {
      noiseBurst(0.08, 0.12);
      tone(150, 0.1, 'square', 0.1);
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
