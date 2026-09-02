// Tiny procedural sound engine - synthesized tones via the Web Audio API,
// so there are no external audio files to fetch or host. Muted state
// persists in localStorage across sessions.
const Sound = (function () {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('mehrbod-cards-muted') === '1'; } catch (e) { /* ignore */ }
  // NEW: master volume (0-1), separate from the hard mute toggle - most
  // games offer both. Every tone/sweep's own per-effect volume (the `vol`
  // argument, tuned per-sound so e.g. a merge chime isn't as loud as an
  // attack hit) is scaled by this multiplier rather than replaced by it.
  let volume = 1;
  try {
    const raw = localStorage.getItem('mehrbod-cards-volume');
    if (raw !== null) { const n = Number(raw); if (Number.isFinite(n)) volume = Math.max(0, Math.min(1, n)); }
  } catch (e) { /* ignore */ }

  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, delay) {
    if (muted || volume <= 0) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime((vol || 0.12) * volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sweep(f0, f1, dur, type, vol) {
    if (muted || volume <= 0) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime((vol || 0.12) * volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    setMuted(m) { muted = m; try { localStorage.setItem('mehrbod-cards-muted', m ? '1' : '0'); } catch (e) {} },
    isMuted() { return muted; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      try { localStorage.setItem('mehrbod-cards-volume', String(volume)); } catch (e) {}
    },
    getVolume() { return volume; },
    place() { tone(440, 0.07, 'triangle', 0.10); },
    merge() { sweep(320, 760, 0.25, 'sine', 0.13); },
    megaMerge() { sweep(220, 980, 0.4, 'sine', 0.16); [660, 880, 1200].forEach((f, i) => tone(f, 0.2, 'triangle', 0.09, 0.12 + i * 0.07)); },
    meteor() { sweep(180, 900, 0.55, 'sawtooth', 0.14); [1300, 1700, 2100].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, 0.15 + i * 0.1)); },
    // NEW: a deeper follow-up boom, used by the reworked longer meteor
    // shower for its later, bigger impacts.
    meteorBoom() { sweep(140, 30, 0.5, 'sawtooth', 0.16); tone(70, 0.35, 'square', 0.12, 0.05); },
    attack() { tone(160, 0.12, 'square', 0.13); },
    death() { sweep(420, 50, 0.4, 'sawtooth', 0.15); },
    lightning() { sweep(700, 1600, 0.22, 'sine', 0.14); tone(1800, 0.12, 'sine', 0.07, 0.05); },
    heal() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'sine', 0.09, i * 0.06)); },
    defend() { tone(700, 0.14, 'sine', 0.09); },
    ready() { tone(520, 0.09, 'triangle', 0.09); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.11, i * 0.12)); },
    lowHp() { tone(880, 0.07, 'square', 0.06); tone(620, 0.1, 'square', 0.06, 0.08); },
    block() { tone(220, 0.09, 'square', 0.11); tone(160, 0.07, 'square', 0.09, 0.05); },
    chipAttach() { tone(1200, 0.05, 'square', 0.07); tone(950, 0.06, 'square', 0.06, 0.04); },
    sparkle() { [1046, 1318, 1568].forEach((f, i) => tone(f, 0.12, 'sine', 0.06, i * 0.05)); },
    abilityPing() { tone(980, 0.08, 'triangle', 0.08); },
    select() { tone(680, 0.05, 'triangle', 0.06); },
    // NEW: pack-opening sounds (Pokemon/GW2-style pack reveal flow).
    packTear() { sweep(500, 130, 0.3, 'sawtooth', 0.14); tone(90, 0.18, 'square', 0.1, 0.08); },
    packCardFlip() { tone(700, 0.05, 'triangle', 0.07); tone(1050, 0.07, 'triangle', 0.08, 0.05); },
    packRareFlip() { [660, 990, 1320, 1760].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, i * 0.05)); },
  };
})();
