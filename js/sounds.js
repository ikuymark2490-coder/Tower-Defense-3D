/*
ไฟล์: sounds.js
หน้าที่: ระบบเสียง Web Audio API (ไม่ต้องใช้ไฟล์ภายนอก)
- shoot_gun, shoot_slow, shoot_cannon
- enemy_die, wave_start
- place, upgrade, sell, error
- เสียงสังเคราะห์จาก oscillator
*/

window.SoundSystem = (() => {
  'use strict';

  let _ctx = null;
  let _masterGain = null;
  let _enabled = true;

  function _getCtx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        _masterGain = _ctx.createGain();
        _masterGain.gain.value = 0.35;
        _masterGain.connect(_ctx.destination);
      } catch(e) { _enabled = false; }
    }
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // ── Generic synth ──────────────────────────────
  function _tone({ type='sine', freq=440, freqEnd=null, vol=0.4, attack=0.005, decay=0.15, duration=0.2 }) {
    if (!_enabled) return;
    const ctx = _getCtx(); if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + attack + decay);
    osc.connect(gain);
    gain.connect(_masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + attack + decay + 0.02);
  }

  // ── Noise burst ────────────────────────────────
  function _noise({ vol=0.3, attack=0.003, decay=0.12, filter=800 }) {
    if (!_enabled) return;
    const ctx = _getCtx(); if (!ctx) return;
    const bufLen = Math.floor(ctx.sampleRate * (attack + decay));
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    const gain   = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + attack + decay);
    const bpf    = ctx.createBiquadFilter();
    bpf.type     = 'bandpass';
    bpf.frequency.value = filter;
    src.connect(bpf); bpf.connect(gain); gain.connect(_masterGain);
    src.start(ctx.currentTime);
  }

  // ── Sound library ──────────────────────────────
  const SOUNDS = {
    shoot_gun: () => {
      _tone({ type: 'sawtooth', freq: 520, freqEnd: 200, vol: 0.25, attack: 0.003, decay: 0.10 });
    },
    shoot_slow: () => {
      _tone({ type: 'sine', freq: 320, freqEnd: 520, vol: 0.22, attack: 0.01, decay: 0.18 });
      _tone({ type: 'sine', freq: 220, freqEnd: 420, vol: 0.14, attack: 0.01, decay: 0.18 });
    },
    shoot_cannon: () => {
      _noise({ vol: 0.5, attack: 0.005, decay: 0.22, filter: 300 });
      _tone({ type: 'square', freq: 90, freqEnd: 35, vol: 0.35, attack: 0.003, decay: 0.25 });
    },
    enemy_die: () => {
      _tone({ type: 'sawtooth', freq: 300, freqEnd: 80, vol: 0.3, decay: 0.15 });
      _noise({ vol: 0.2, decay: 0.1, filter: 600 });
    },
    boss_die: () => {
      _tone({ type: 'sawtooth', freq: 160, freqEnd: 50, vol: 0.5, decay: 0.4 });
      _noise({ vol: 0.6, decay: 0.35, filter: 200 });
    },
    wave_start: () => {
      _tone({ type: 'square', freq: 440, vol: 0.3, decay: 0.1 });
      setTimeout(() => _tone({ type: 'square', freq: 550, vol: 0.3, decay: 0.1 }), 120);
      setTimeout(() => _tone({ type: 'square', freq: 660, vol: 0.35, decay: 0.18 }), 240);
    },
    place: () => {
      _tone({ type: 'sine', freq: 440, freqEnd: 880, vol: 0.28, attack: 0.01, decay: 0.12 });
    },
    upgrade: () => {
      _tone({ type: 'sine', freq: 523, vol: 0.25, decay: 0.08 });
      setTimeout(() => _tone({ type: 'sine', freq: 659, vol: 0.25, decay: 0.08 }), 80);
      setTimeout(() => _tone({ type: 'sine', freq: 784, vol: 0.3,  decay: 0.15 }), 160);
    },
    sell: () => {
      _tone({ type: 'triangle', freq: 660, freqEnd: 440, vol: 0.28, decay: 0.18 });
    },
    error: () => {
      _tone({ type: 'square', freq: 200, freqEnd: 150, vol: 0.3, attack: 0.003, decay: 0.12 });
    },
    wave_clear: () => {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => _tone({ type: 'sine', freq: f, vol: 0.28, decay: 0.2 }), i * 100)
      );
    },
    life_lost: () => {
      _tone({ type: 'sawtooth', freq: 180, freqEnd: 90, vol: 0.4, decay: 0.3 });
    },
  };

  function play(name) {
    if (!_enabled) return;
    const fn = SOUNDS[name];
    if (fn) {
      try { fn(); } catch(e) {}
    }
  }

  function setEnabled(v) { _enabled = v; }

  // Unlock audio context on first user interaction
  document.addEventListener('click',     () => _getCtx(), { once: false, passive: true });
  document.addEventListener('touchstart',() => _getCtx(), { once: false, passive: true });

  return { play, setEnabled };
})();
