/**
 * audio.js — ORIGINAL procedural WebAudio battle bed + SFX.
 * Oscillators + noise only. No copyrighted melodies, samples, or anime themes.
 * Self-generated fight-energy bed (drums / bass / brass stabs / pad / riser).
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

  // ~138 BPM battle pulse
  var BPM = 138;
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
    musicGain.gain.value = 0.38;
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

  /* ---- bed building blocks (procedural, original) ---- */

  function makeNoiseBuffer(dur) {
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playKick(t) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(musicGain);
    o.start(t);
    o.stop(t + 0.25);
    track(o);

    // click transient
    var click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(180, t);
    click.frequency.exponentialRampToValueAtTime(60, t + 0.04);
    var cg = ctx.createGain();
    cg.gain.setValueAtTime(0.18, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    click.connect(cg);
    cg.connect(musicGain);
    click.start(t);
    click.stop(t + 0.06);
    track(click);
  }

  function playSnare(t) {
    var n = Math.floor(ctx.sampleRate * 0.18);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(musicGain);
    src.start(t);
    src.stop(t + 0.2);
    track(src);

    // body tone
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.12, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og);
    og.connect(musicGain);
    o.start(t);
    o.stop(t + 0.12);
    track(o);
  }

  function playHat(t, open) {
    var n = Math.floor(ctx.sampleRate * (open ? 0.12 : 0.04));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (open ? 0.05 : 0.012)));
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(open ? 0.09 : 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.11 : 0.035));
    src.connect(hp);
    hp.connect(g);
    g.connect(musicGain);
    src.start(t);
    src.stop(t + (open ? 0.14 : 0.05));
    track(src);
  }

  function playBrassStab(t, freq) {
    var freqs = [freq, freq * 1.005, freq * 0.497];
    var types = ['sawtooth', 'sawtooth', 'square'];
    for (var i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator();
      o.type = types[i];
      o.frequency.setValueAtTime(freqs[i], t);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(2200, t);
      f.frequency.exponentialRampToValueAtTime(900, t + 0.18);
      f.Q.value = 4;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.085, t + 0.012);
      g.gain.setValueAtTime(0.085, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(f);
      f.connect(g);
      g.connect(musicGain);
      o.start(t);
      o.stop(t + 0.22);
      track(o);
    }
  }

  function playRiser(t) {
    var n = Math.floor(ctx.sampleRate * 1.6);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(200, t);
    bp.frequency.exponentialRampToValueAtTime(4800, t + 1.5);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 1.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
    src.connect(bp);
    bp.connect(g);
    g.connect(musicGain);
    src.start(t);
    src.stop(t + 1.6);
    track(src);

    // rising saw sweep (original interval, not a motif)
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 1.5);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.06, t + 1.3);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
    var lf = ctx.createBiquadFilter();
    lf.type = 'lowpass';
    lf.frequency.setValueAtTime(400, t);
    lf.frequency.exponentialRampToValueAtTime(3000, t + 1.5);
    o.connect(lf);
    lf.connect(og);
    og.connect(musicGain);
    o.start(t);
    o.stop(t + 1.6);
    track(o);
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

    // --- Layer: heavy low bass / drone (saw + square, lowpass, slight LFO) ---
    var bass = ctx.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.value = 55; // A1
    var bass2 = ctx.createOscillator();
    bass2.type = 'square';
    bass2.frequency.value = 55.3;
    var bassLp = ctx.createBiquadFilter();
    bassLp.type = 'lowpass';
    bassLp.frequency.value = 220;
    bassLp.Q.value = 2;
    var bassG = ctx.createGain();
    bassG.gain.value = 0.16;
    var bassLfo = ctx.createOscillator();
    bassLfo.type = 'sine';
    bassLfo.frequency.value = 0.18;
    var bassLfoG = ctx.createGain();
    bassLfoG.gain.value = 80;
    bassLfo.connect(bassLfoG);
    bassLfoG.connect(bassLp.frequency);
    bass.connect(bassLp);
    bass2.connect(bassLp);
    bassLp.connect(bassG);
    bassG.connect(musicGain);
    bass.start(t0);
    bass2.start(t0);
    bassLfo.start(t0);
    track(bass);
    track(bass2);
    track(bassLfo);

    // sub sine for weight
    var sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 55;
    var subG = ctx.createGain();
    subG.gain.value = 0.14;
    sub.connect(subG);
    subG.connect(musicGain);
    sub.start(t0);
    track(sub);

    // --- Layer: tense pad / strings (two detuned saws, slow filter motion) ---
    var pad1 = ctx.createOscillator();
    pad1.type = 'sawtooth';
    pad1.frequency.value = 110; // A2
    var pad2 = ctx.createOscillator();
    pad2.type = 'sawtooth';
    pad2.frequency.value = 110.7;
    var pad3 = ctx.createOscillator();
    pad3.type = 'triangle';
    pad3.frequency.value = 164.81; // E3 fifth — static interval, not a melody
    var padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = 600;
    padLp.Q.value = 1.2;
    var padG = ctx.createGain();
    padG.gain.value = 0.055;
    var padLfo = ctx.createOscillator();
    padLfo.type = 'sine';
    padLfo.frequency.value = 0.07;
    var padLfoG = ctx.createGain();
    padLfoG.gain.value = 350;
    padLfo.connect(padLfoG);
    padLfoG.connect(padLp.frequency);
    pad1.connect(padLp);
    pad2.connect(padLp);
    pad3.connect(padLp);
    padLp.connect(padG);
    padG.connect(musicGain);
    pad1.start(t0);
    pad2.start(t0);
    pad3.start(t0);
    padLfo.start(t0);
    track(pad1);
    track(pad2);
    track(pad3);
    track(padLfo);

    // --- Layer: kick / snare / hat loop + brass stabs + occasional riser ---
    var barIndex = 0;
    // brass stab root notes cycling a simple original power progression (A / C / G / A)
    var brassRoots = [110, 130.81, 98, 110];

    function scheduleBar() {
      if (!started || muted || !ctx) return;
      var now = ctx.currentTime;
      var barStart = now + 0.02;

      // 16th-grid hats + kicks/snares for one bar
      for (var step = 0; step < 16; step++) {
        var t = barStart + step * (BEAT / 4);
        // closed hats on most 16ths
        if (step % 2 === 0) playHat(t, false);
        else if (step === 7 || step === 15) playHat(t, true);

        // kick on 1 and 3 (+ syncopated on beat 2.5 / 4.5-ish)
        if (step === 0 || step === 8 || step === 10 || step === 14) playKick(t);
        // snare on 2 and 4
        if (step === 4 || step === 12) playSnare(t);
      }

      // synth-brass stabs on off-beats (and of 2, and of 4)
      var root = brassRoots[barIndex % brassRoots.length];
      playBrassStab(barStart + BEAT * 1.5, root);
      playBrassStab(barStart + BEAT * 3.5, root * 1.5);

      // every 8 bars: short noise/filter riser for escalation
      if (barIndex > 0 && barIndex % 8 === 0) {
        playRiser(barStart);
      }

      barIndex++;
      // schedule next bar slightly before end to avoid gaps
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
        musicGain.gain.linearRampToValueAtTime(0.38, t + 0.15);
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
