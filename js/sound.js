// Tiny procedural sound engine - synthesized tones via the Web Audio API,
// so there are no external audio files to fetch or host. Muted state
// persists in localStorage across sessions.
const Sound = (function () {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('mehrbod-cards-muted') === '1'; } catch (e) { /* ignore */ }

  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, delay) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sweep(f0, f1, dur, type, vol) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    setMuted(m) { muted = m; try { localStorage.setItem('mehrbod-cards-muted', m ? '1' : '0'); } catch (e) {} },
    isMuted() { return muted; },
    place() { tone(440, 0.07, 'triangle', 0.10); },
    merge() { sweep(320, 760, 0.25, 'sine', 0.13); },
    attack() { tone(160, 0.12, 'square', 0.13); },
    death() { sweep(420, 50, 0.4, 'sawtooth', 0.15); },
    lightning() { sweep(700, 1600, 0.22, 'sine', 0.14); tone(1800, 0.12, 'sine', 0.07, 0.05); },
    heal() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'sine', 0.09, i * 0.06)); },
    defend() { tone(700, 0.14, 'sine', 0.09); },
    ready() { tone(520, 0.09, 'triangle', 0.09); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.11, i * 0.12)); },
    lowHp() { tone(880, 0.07, 'square', 0.06); tone(620, 0.1, 'square', 0.06, 0.08); },
  };
})();
