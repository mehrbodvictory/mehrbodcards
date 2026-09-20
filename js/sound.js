// Context-aware procedural sound engine & ambient sound manager via Web Audio API.
// Features procedural SFX and gentle, looping background tracks tailored to each theme.
// Re-engineered Pink, Celestial Divinity, and Prism Core to have calm, peaceful,
// musical progressions and melodies instead of harsh sustained drone tones.
// Persists mute, volume, and ambient settings across sessions.

if (typeof window !== 'undefined') {
  if (typeof window.ctx === 'undefined') window.ctx = null;
}
var ctx = typeof window !== 'undefined' ? window.ctx : null;

const Sound = (function () {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('mehrbod-cards-muted') === '1'; } catch (e) { /* ignore */ }

  let volume = 1;
  try {
    const raw = localStorage.getItem('mehrbod-cards-volume');
    if (raw !== null) { const n = Number(raw); if (Number.isFinite(n)) volume = Math.max(0, Math.min(1, n)); }
  } catch (e) { /* ignore */ }

  let ambientEnabled = true;
  try {
    const raw = localStorage.getItem('mehrbod-cards-ambient-enabled');
    if (raw !== null) ambientEnabled = raw === '1';
  } catch (e) { /* ignore */ }

  let sfxEnabled = true;
  try {
    const raw = localStorage.getItem('mehrbod-cards-sfx-enabled');
    if (raw !== null) sfxEnabled = raw === '1';
  } catch (e) { /* ignore */ }

  let ambientVolume = 0.65;
  try {
    const raw = localStorage.getItem('mehrbod-cards-ambient-volume');
    if (raw !== null) { const n = Number(raw); if (Number.isFinite(n)) ambientVolume = Math.max(0, Math.min(1, n)); }
  } catch (e) { /* ignore */ }

  let ambientMasterGain = null;
  let currentTheme = 'dark';
  let currentTrack = null;
  let fadingTrack = null;
  let duckTimer = null;
  let audioUnlocked = false;

  // Shared procedural noise buffers (white, pink, brown)
  let noiseBuffers = null;

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (typeof window !== 'undefined') window.ctx = ctx;
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (ctx && !ambientMasterGain) {
      initAmbientEngine(ctx);
    }
    return ctx;
  }

  function getNoiseBuffers(c) {
    if (noiseBuffers && noiseBuffers.sampleRate === c.sampleRate) return noiseBuffers;
    const sampleRate = c.sampleRate;
    const length = sampleRate * 4; // 4 seconds seamless loop

    // 1. White Noise
    const white = c.createBuffer(1, length, sampleRate);
    const wData = white.getChannelData(0);
    for (let i = 0; i < length; i++) {
      wData[i] = Math.random() * 2 - 1;
    }

    // 2. Pink Noise (Paul Kellet 3-pole filter)
    const pink = c.createBuffer(1, length, sampleRate);
    const pData = pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const whiteSample = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + whiteSample * 0.0555179;
      b1 = 0.99332 * b1 + whiteSample * 0.0750759;
      b2 = 0.96900 * b2 + whiteSample * 0.1538520;
      b3 = 0.86650 * b3 + whiteSample * 0.3104856;
      b4 = 0.55000 * b4 + whiteSample * 0.5329522;
      b5 = -0.76160 * b5 - whiteSample * 0.0168980;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteSample * 0.5362) * 0.11;
      b6 = whiteSample * 0.115926;
    }

    // 3. Brown Noise (integrated noise)
    const brown = c.createBuffer(1, length, sampleRate);
    const brData = brown.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const whiteSample = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * whiteSample)) / 1.02;
      brData[i] = lastOut * 3.5;
    }

    noiseBuffers = { sampleRate, white, pink, brown };
    return noiseBuffers;
  }

  function createLoopingNoise(c, buffer) {
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  // ---- Basic SFX Synthesis --------------------------------------------------
  function tone(freq, dur, type, vol, delay) {
    if (muted || !sfxEnabled || volume <= 0) return;
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

  function sweep(f0, f1, dur, type, vol, delay) {
    if (muted || !sfxEnabled || volume <= 0) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
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

  // ---- Ambient Engine Master ------------------------------------------------
  const BASE_AMBIENT_SCALAR = 0.22; // subtle background mix level

  function calcTargetAmbientGain() {
    if (muted || !ambientEnabled || volume <= 0 || ambientVolume <= 0) return 0.0001;
    return volume * ambientVolume * BASE_AMBIENT_SCALAR;
  }

  function updateAmbientMasterGain(fadeTime = 0.2) {
    if (!ambientMasterGain || !ctx) return;
    const target = calcTargetAmbientGain();
    const t = ctx.currentTime;
    try {
      ambientMasterGain.gain.cancelScheduledValues(t);
      ambientMasterGain.gain.setValueAtTime(ambientMasterGain.gain.value, t);
      ambientMasterGain.gain.linearRampToValueAtTime(target, t + fadeTime);
    } catch (e) {
      ambientMasterGain.gain.value = target;
    }
    if (muted || !ambientEnabled || volume <= 0 || ambientVolume <= 0) {
      if (typeof stopWorldAmbientLayers === 'function') stopWorldAmbientLayers();
    } else {
      if (typeof startWorldAmbientLayers === 'function' && !ambientWorldActive) startWorldAmbientLayers();
    }
  }

  function initAmbientEngine(c) {
    if (ambientMasterGain) return;
    ambientMasterGain = c.createGain();
    ambientMasterGain.gain.setValueAtTime(calcTargetAmbientGain(), c.currentTime);
    ambientMasterGain.connect(c.destination);
    if (typeof ensureAmbientWorldGain === 'function') ensureAmbientWorldGain(c);
    if (ambientEnabled && !muted && volume > 0 && ambientVolume > 0) {
      if (typeof startWorldAmbientLayers === 'function') startWorldAmbientLayers();
    }
  }

  // ---- Procedural Theme Generators ------------------------------------------
  const THEME_GENERATORS = {
    // 1. FLAME: Crackling campfire pops, warm embers, gentle breathing hearth draft
    flame(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      // Layer A: Warm low draft / breathing hearth
      const draftSrc = createLoopingNoise(c, noise.pink);
      const draftFilter = c.createBiquadFilter();
      draftFilter.type = 'lowpass';
      draftFilter.frequency.setValueAtTime(320, t0);

      const draftLfo = c.createOscillator();
      draftLfo.frequency.setValueAtTime(0.24, t0);
      const draftLfoGain = c.createGain();
      draftLfoGain.gain.setValueAtTime(50, t0);
      draftLfo.connect(draftLfoGain).connect(draftFilter.frequency);
      draftLfo.start(t0);

      const draftGain = c.createGain();
      draftGain.gain.setValueAtTime(0.32, t0);
      draftSrc.connect(draftFilter).connect(draftGain).connect(trackGain);

      // Layer B: Hearth drone (warm fifth harmonic)
      const drone1 = c.createOscillator();
      drone1.type = 'sine';
      drone1.frequency.setValueAtTime(86, t0);
      const drone2 = c.createOscillator();
      drone2.type = 'sine';
      drone2.frequency.setValueAtTime(129, t0);
      const droneGain = c.createGain();
      droneGain.gain.setValueAtTime(0.05, t0);
      drone1.connect(droneGain);
      drone2.connect(droneGain);
      droneGain.connect(trackGain);
      drone1.start(t0);
      drone2.start(t0);

      // Layer C: Procedural Wood Crackle & Pop generator
      let active = true;
      let crackleTimeout = null;

      function scheduleCrackle() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        const isBigSnap = Math.random() < 0.15;
        const popDur = isBigSnap ? 0.025 : 0.012;
        const popFreq = 1600 + Math.random() * 2200;
        const popVol = isBigSnap ? 0.28 : (0.06 + Math.random() * 0.14);

        try {
          const popOsc = ctx.createOscillator();
          const popGain = ctx.createGain();
          const popFilter = ctx.createBiquadFilter();
          popFilter.type = 'bandpass';
          popFilter.frequency.setValueAtTime(popFreq, now);
          popFilter.Q.setValueAtTime(isBigSnap ? 8 : 12, now);

          popOsc.type = 'triangle';
          popOsc.frequency.setValueAtTime(popFreq, now);

          popGain.gain.setValueAtTime(popVol, now);
          popGain.gain.exponentialRampToValueAtTime(0.001, now + popDur);

          popOsc.connect(popFilter).connect(popGain).connect(trackGain);
          popOsc.start(now);
          popOsc.stop(now + popDur + 0.01);
        } catch (e) {}

        const delayMs = 80 + Math.random() * 260;
        crackleTimeout = setTimeout(scheduleCrackle, delayMs);
      }
      scheduleCrackle();

      return {
        theme: 'flame',
        gainNode: trackGain,
        stop() {
          active = false;
          if (crackleTimeout) clearTimeout(crackleTimeout);
          try {
            draftSrc.stop();
            draftLfo.stop();
            drone1.stop();
            drone2.stop();
          } catch (e) {}
        }
      };
    },

    // 2. STORM: Undulating howling wind gusts, steady rain patter, rolling thunder
    storm(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      // Layer A: Howling wind (swept bandpass pink noise)
      const windSrc = createLoopingNoise(c, noise.pink);
      const windFilter = c.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(460, t0);
      windFilter.Q.setValueAtTime(3.2, t0);

      const windLfo = c.createOscillator();
      windLfo.frequency.setValueAtTime(0.18, t0);
      const windLfoGain = c.createGain();
      windLfoGain.gain.setValueAtTime(260, t0);
      windLfo.connect(windLfoGain).connect(windFilter.frequency);
      windLfo.start(t0);

      const windVolLfo = c.createOscillator();
      windVolLfo.frequency.setValueAtTime(0.12, t0);
      const windVolLfoGain = c.createGain();
      windVolLfoGain.gain.setValueAtTime(0.12, t0);

      const windGain = c.createGain();
      windGain.gain.setValueAtTime(0.38, t0);
      windVolLfo.connect(windVolLfoGain).connect(windGain.gain);
      windVolLfo.start(t0);

      windSrc.connect(windFilter).connect(windGain).connect(trackGain);

      // Layer B: Steady driving rain
      const rainSrc = createLoopingNoise(c, noise.pink);
      const rainFilter = c.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.setValueAtTime(3200, t0);
      const rainGain = c.createGain();
      rainGain.gain.setValueAtTime(0.14, t0);
      rainSrc.connect(rainFilter).connect(rainGain).connect(trackGain);

      // Layer C: Rolling distant thunder
      const thunderSrc = createLoopingNoise(c, noise.brown);
      const thunderFilter = c.createBiquadFilter();
      thunderFilter.type = 'lowpass';
      thunderFilter.frequency.setValueAtTime(80, t0);
      const thunderGain = c.createGain();
      thunderGain.gain.setValueAtTime(0.0001, t0);
      thunderSrc.connect(thunderFilter).connect(thunderGain).connect(trackGain);

      let active = true;
      let thunderTimeout = null;

      function triggerThunder() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        try {
          thunderGain.gain.cancelScheduledValues(now);
          thunderGain.gain.setValueAtTime(0.001, now);
          thunderGain.gain.linearRampToValueAtTime(0.40, now + 1.2);
          thunderGain.gain.exponentialRampToValueAtTime(0.001, now + 4.2);
        } catch (e) {}

        const nextDelay = 8000 + Math.random() * 7000;
        thunderTimeout = setTimeout(triggerThunder, nextDelay);
      }
      thunderTimeout = setTimeout(triggerThunder, 3000);

      return {
        theme: 'storm',
        gainNode: trackGain,
        stop() {
          active = false;
          if (thunderTimeout) clearTimeout(thunderTimeout);
          try {
            windSrc.stop();
            windLfo.stop();
            windVolLfo.stop();
            rainSrc.stop();
            thunderSrc.stop();
          } catch (e) {}
        }
      };
    },

    // 3. ABYSS: Deep oceanic pressure trench rumble and resonant sonar/bubble pulses
    abyss(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const seaSrc = createLoopingNoise(c, noise.brown);
      const seaFilter = c.createBiquadFilter();
      seaFilter.type = 'lowpass';
      seaFilter.frequency.setValueAtTime(130, t0);
      seaFilter.Q.setValueAtTime(1.8, t0);
      const seaGain = c.createGain();
      seaGain.gain.setValueAtTime(0.44, t0);
      seaSrc.connect(seaFilter).connect(seaGain).connect(trackGain);

      const subDrone = c.createOscillator();
      subDrone.type = 'sine';
      subDrone.frequency.setValueAtTime(44, t0);
      const subGain = c.createGain();
      subGain.gain.setValueAtTime(0.12, t0);
      subDrone.connect(subGain).connect(trackGain);
      subDrone.start(t0);

      let active = true;
      let bubbleTimeout = null;

      function spawnBubble() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        try {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(220, now);
          filter.Q.setValueAtTime(4.0, now);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(260 + Math.random() * 80, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);

          g.gain.setValueAtTime(0.12, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

          osc.connect(filter).connect(g).connect(trackGain);
          osc.start(now);
          osc.stop(now + 0.3);
        } catch (e) {}

        bubbleTimeout = setTimeout(spawnBubble, 2400 + Math.random() * 2200);
      }
      bubbleTimeout = setTimeout(spawnBubble, 1500);

      return {
        theme: 'abyss',
        gainNode: trackGain,
        stop() {
          active = false;
          if (bubbleTimeout) clearTimeout(bubbleTimeout);
          try { seaSrc.stop(); subDrone.stop(); } catch (e) {}
        }
      };
    },

    // 4. MAGMA: Deep, warm volcanic low-music synthesizer & subterranean chord progression
    // Replaced the harsh white noise steam static with a rich, brooding low-frequency musical atmosphere
    magma(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      // Deep, warm subterranean air cushion (ultra-low filtered pink noise, zero harsh static)
      const airSrc = createLoopingNoise(c, noise.pink);
      const airFilter = c.createBiquadFilter();
      airFilter.type = 'lowpass';
      airFilter.frequency.setValueAtTime(110, t0);
      airFilter.Q.setValueAtTime(1.0, t0);
      const airGain = c.createGain();
      airGain.gain.setValueAtTime(0.02, t0);
      airSrc.connect(airFilter).connect(airGain).connect(trackGain);

      // Warm continuous sub-harmonic foundation (dual detuned sine waves for organic warmth)
      const sub1 = c.createOscillator();
      const sub2 = c.createOscillator();
      const subGain = c.createGain();
      sub1.type = 'sine';
      sub2.type = 'triangle';
      sub1.frequency.setValueAtTime(55.0, t0); // A1 fundamental
      sub2.frequency.setValueAtTime(55.25, t0); // subtle warm chorus beating
      const subLowpass = c.createBiquadFilter();
      subLowpass.type = 'lowpass';
      subLowpass.frequency.setValueAtTime(120, t0);
      subGain.gain.setValueAtTime(0.07, t0);
      sub1.connect(subLowpass);
      sub2.connect(subLowpass);
      subLowpass.connect(subGain).connect(trackGain);
      sub1.start(t0);
      sub2.start(t0);

      // Low Minor Chord Progression (D minor volcanic cavern harmonics)
      // Dm9 -> Bbmaj7 -> Gm9 -> Asus4
      const progression = [
        {
          bass: 73.42, // D2
          pad: [110.00, 146.83, 174.61, 220.00], // A2, D3, F3, A3
          melody: [146.83, 174.61, 220.00, 174.61] // D3, F3, A3, F3
        },
        {
          bass: 58.27, // Bb1
          pad: [116.54, 146.83, 174.61, 233.08], // Bb2, D3, F3, Bb3
          melody: [174.61, 146.83, 233.08, 146.83] // F3, D3, Bb3, D3
        },
        {
          bass: 49.00, // G1
          pad: [98.00, 146.83, 174.61, 196.00], // G2, D3, F3, G3
          melody: [146.83, 196.00, 174.61, 146.83] // D3, G3, F3, D3
        },
        {
          bass: 55.00, // A1
          pad: [110.00, 146.83, 164.81, 220.00], // A2, D3, E3, A3
          melody: [164.81, 220.00, 174.61, 146.83] // E3, A3, F3, D3
        }
      ];

      let currentPadOscs = [];
      const padFilter = c.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(320, t0);
      padFilter.Q.setValueAtTime(1.5, t0);
      const padMasterGain = c.createGain();
      padMasterGain.gain.setValueAtTime(0.065, t0);
      padFilter.connect(padMasterGain).connect(trackGain);

      let step = 0;
      let active = true;
      let musicTimer = null;
      let pulseTimer = null;

      function playMagmaChord(chordIdx) {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        const chord = progression[chordIdx % progression.length];

        // Fade out previous chord voices gracefully
        if (currentPadOscs.length) {
          const oldOscs = currentPadOscs;
          currentPadOscs = [];
          oldOscs.forEach(({ osc, gain }) => {
            try {
              gain.gain.cancelScheduledValues(now);
              gain.gain.setValueAtTime(gain.gain.value, now);
              gain.gain.linearRampToValueAtTime(0.0001, now + 1.8);
              setTimeout(() => { try { osc.stop(); osc.disconnect(); } catch (e) {} }, 1900);
            } catch (e) {}
          });
        }

        // Deep warm bass root
        try {
          const bassOsc = ctx.createOscillator();
          const bassGain = ctx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(chord.bass, now);
          bassGain.gain.setValueAtTime(0.0001, now);
          bassGain.gain.linearRampToValueAtTime(0.08, now + 1.0);
          bassOsc.connect(bassGain).connect(padFilter);
          bassOsc.start(now);
          currentPadOscs.push({ osc: bassOsc, gain: bassGain });
        } catch (e) {}

        // Rich low-mid synth pad voices
        chord.pad.forEach((freq, i) => {
          try {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = i % 2 === 0 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now);

            // Subtle pitch drift for analog volcanic warmth
            const lfo = ctx.createOscillator();
            const lfoG = ctx.createGain();
            lfo.frequency.setValueAtTime(0.18 + i * 0.05, now);
            lfoG.gain.setValueAtTime(1.2, now);
            lfo.connect(osc.frequency);
            lfo.start(now);

            g.gain.setValueAtTime(0.0001, now);
            g.gain.linearRampToValueAtTime(0.032, now + 1.4);
            osc.connect(g).connect(padFilter);
            osc.start(now);
            currentPadOscs.push({ osc, gain: g });
            setTimeout(() => { try { lfo.stop(); lfo.disconnect(); } catch (e) {} }, 5500);
          } catch (e) {}
        });

        // Warm, low muted plucked melodic motif
        chord.melody.forEach((noteFreq, idx) => {
          const noteTime = now + 0.6 + idx * 1.1;
          try {
            const mOsc = ctx.createOscillator();
            const mGain = ctx.createGain();
            const mFilt = ctx.createBiquadFilter();
            mFilt.type = 'lowpass';
            mFilt.frequency.setValueAtTime(360, noteTime);
            mFilt.Q.setValueAtTime(2.0, noteTime);

            mOsc.type = 'triangle';
            mOsc.frequency.setValueAtTime(noteFreq, noteTime);

            mGain.gain.setValueAtTime(0.0001, noteTime);
            mGain.gain.linearRampToValueAtTime(0.038, noteTime + 0.05);
            mGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.4);

            mOsc.connect(mFilt).connect(mGain).connect(trackGain);
            mOsc.start(noteTime);
            mOsc.stop(noteTime + 1.5);
          } catch (e) {}
        });

        step++;
        musicTimer = setTimeout(() => playMagmaChord(step), 5000);
      }

      // Soft, resonant volcanic core heartbeat / pulse (warm low-sine resonance every ~4.5s)
      function spawnMagmaPulse() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        try {
          const pOsc = ctx.createOscillator();
          const pGain = ctx.createGain();
          const pFilt = ctx.createBiquadFilter();
          pFilt.type = 'lowpass';
          pFilt.frequency.setValueAtTime(90, now);

          pOsc.type = 'sine';
          pOsc.frequency.setValueAtTime(75, now);
          pOsc.frequency.exponentialRampToValueAtTime(38, now + 0.35);

          pGain.gain.setValueAtTime(0.0001, now);
          pGain.gain.linearRampToValueAtTime(0.065, now + 0.04);
          pGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

          pOsc.connect(pFilt).connect(pGain).connect(trackGain);
          pOsc.start(now);
          pOsc.stop(now + 0.45);
        } catch (e) {}

        pulseTimer = setTimeout(spawnMagmaPulse, 4200 + Math.random() * 1200);
      }

      playMagmaChord(0);
      pulseTimer = setTimeout(spawnMagmaPulse, 2000);

      return {
        theme: 'magma',
        gainNode: trackGain,
        stop() {
          active = false;
          if (musicTimer) clearTimeout(musicTimer);
          if (pulseTimer) clearTimeout(pulseTimer);
          try {
            sub1.stop(); sub2.stop();
            airSrc.stop();
            currentPadOscs.forEach(({ osc }) => { try { osc.stop(); } catch (e) {} });
          } catch (e) {}
        }
      };
    },

    // 5. VERDANT: Soft forest canopy breeze & peaceful woodland ambiance
    verdant(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const breezeSrc = createLoopingNoise(c, noise.pink);
      const breezeFilter = c.createBiquadFilter();
      breezeFilter.type = 'bandpass';
      breezeFilter.frequency.setValueAtTime(540, t0);
      breezeFilter.Q.setValueAtTime(1.4, t0);

      const breezeLfo = c.createOscillator();
      breezeLfo.frequency.setValueAtTime(0.16, t0);
      const breezeLfoGain = c.createGain();
      breezeLfoGain.gain.setValueAtTime(120, t0);
      breezeLfo.connect(breezeLfoGain).connect(breezeFilter.frequency);
      breezeLfo.start(t0);

      const breezeGain = c.createGain();
      breezeGain.gain.setValueAtTime(0.26, t0);
      breezeSrc.connect(breezeFilter).connect(breezeGain).connect(trackGain);

      let active = true;
      let cricketTimeout = null;

      function spawnCricket() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        try {
          [0, 0.06].forEach(offset => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(4200 + Math.random() * 200, now + offset);
            g.gain.setValueAtTime(0.03, now + offset);
            g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.035);
            osc.connect(g).connect(trackGain);
            osc.start(now + offset);
            osc.stop(now + offset + 0.04);
          });
        } catch (e) {}

        cricketTimeout = setTimeout(spawnCricket, 3000 + Math.random() * 3500);
      }
      cricketTimeout = setTimeout(spawnCricket, 2000);

      return {
        theme: 'verdant',
        gainNode: trackGain,
        stop() {
          active = false;
          if (cricketTimeout) clearTimeout(crackleTimeout);
          try { breezeSrc.stop(); breezeLfo.stop(); } catch (e) {}
        }
      };
    },

    // 6. CYBER NEON: 60Hz transformer neon buzz & darkwave analog synth pad
    cyberneon(c, dest) {
      const t0 = c.currentTime;
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const hum60 = c.createOscillator();
      hum60.type = 'sine';
      hum60.frequency.setValueAtTime(60, t0);
      const hum120 = c.createOscillator();
      hum120.type = 'sine';
      hum120.frequency.setValueAtTime(120, t0);
      const humGain = c.createGain();
      humGain.gain.setValueAtTime(0.08, t0);
      hum60.connect(humGain);
      hum120.connect(humGain);
      humGain.connect(trackGain);
      hum60.start(t0);
      hum120.start(t0);

      const saw1 = c.createOscillator();
      saw1.type = 'sawtooth';
      saw1.frequency.setValueAtTime(110, t0);
      const saw2 = c.createOscillator();
      saw2.type = 'sawtooth';
      saw2.frequency.setValueAtTime(110.8, t0);

      const synthFilter = c.createBiquadFilter();
      synthFilter.type = 'lowpass';
      synthFilter.frequency.setValueAtTime(380, t0);
      synthFilter.Q.setValueAtTime(2.2, t0);

      const synthLfo = c.createOscillator();
      synthLfo.frequency.setValueAtTime(0.14, t0);
      const synthLfoGain = c.createGain();
      synthLfoGain.gain.setValueAtTime(110, t0);
      synthLfo.connect(synthLfoGain).connect(synthFilter.frequency);
      synthLfo.start(t0);

      const synthGain = c.createGain();
      synthGain.gain.setValueAtTime(0.09, t0);
      saw1.connect(synthFilter);
      saw2.connect(synthFilter);
      synthFilter.connect(synthGain).connect(trackGain);
      saw1.start(t0);
      saw2.start(t0);

      return {
        theme: 'cyberneon',
        gainNode: trackGain,
        stop() {
          try { hum60.stop(); hum120.stop(); saw1.stop(); saw2.stop(); synthLfo.stop(); } catch (e) {}
        }
      };
    },

    // 7. AURORA: Shimmering ethereal pad & polar solar wind
    aurora(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const notes = [293.66, 440.00, 739.99];
      const oscs = notes.map((f, i) => {
        const osc = c.createOscillator();
        osc.type = i === 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, t0);
        return osc;
      });

      const padGain = c.createGain();
      padGain.gain.setValueAtTime(0.065, t0);
      oscs.forEach(o => { o.connect(padGain); o.start(t0); });
      padGain.connect(trackGain);

      const windSrc = createLoopingNoise(c, noise.pink);
      const windFilter = c.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(1300, t0);
      windFilter.Q.setValueAtTime(2.2, t0);
      const windGain = c.createGain();
      windGain.gain.setValueAtTime(0.20, t0);
      windSrc.connect(windFilter).connect(windGain).connect(trackGain);

      return {
        theme: 'aurora',
        gainNode: trackGain,
        stop() {
          try { oscs.forEach(o => o.stop()); windSrc.stop(); } catch (e) {}
        }
      };
    },

    // 8. GLACIER: High whistling sub-zero blizzard wind & icy low drone
    glacier(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const windSrc = createLoopingNoise(c, noise.pink);
      const windFilter = c.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(1750, t0);
      windFilter.Q.setValueAtTime(8.5, t0);

      const windLfo = c.createOscillator();
      windLfo.frequency.setValueAtTime(0.19, t0);
      const windLfoGain = c.createGain();
      windLfoGain.gain.setValueAtTime(450, t0);
      windLfo.connect(windLfoGain).connect(windFilter.frequency);
      windLfo.start(t0);

      const windGain = c.createGain();
      windGain.gain.setValueAtTime(0.28, t0);
      windSrc.connect(windFilter).connect(windGain).connect(trackGain);

      const frostDrone = c.createOscillator();
      frostDrone.type = 'sine';
      frostDrone.frequency.setValueAtTime(70, t0);
      const frostGain = c.createGain();
      frostGain.gain.setValueAtTime(0.08, t0);
      frostDrone.connect(frostGain).connect(trackGain);
      frostDrone.start(t0);

      return {
        theme: 'glacier',
        gainNode: trackGain,
        stop() {
          try { windSrc.stop(); windLfo.stop(); frostDrone.stop(); } catch (e) {}
        }
      };
    },

    // 9. ASTRAL: Deep void cosmic space drone & radio astronomy pulsar ping
    astral(c, dest) {
      const t0 = c.currentTime;
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const void1 = c.createOscillator();
      void1.type = 'sine';
      void1.frequency.setValueAtTime(52, t0);
      const void2 = c.createOscillator();
      void2.type = 'sine';
      void2.frequency.setValueAtTime(78, t0);
      const voidGain = c.createGain();
      voidGain.gain.setValueAtTime(0.11, t0);
      void1.connect(voidGain);
      void2.connect(voidGain);
      voidGain.connect(trackGain);
      void1.start(t0);
      void2.start(t0);

      let active = true;
      let pulsarTimeout = null;

      function spawnPulsar() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        try {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          g.gain.setValueAtTime(0.05, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc.connect(g).connect(trackGain);
          osc.start(now);
          osc.stop(now + 0.85);
        } catch (e) {}

        pulsarTimeout = setTimeout(spawnPulsar, 4800 + Math.random() * 2000);
      }
      pulsarTimeout = setTimeout(spawnPulsar, 2500);

      return {
        theme: 'astral',
        gainNode: trackGain,
        stop() {
          active = false;
          if (pulsarTimeout) clearTimeout(pulsarTimeout);
          try { void1.stop(); void2.stop(); } catch (e) {}
        }
      };
    },

    // 10. CELESTIAL DIVINITY: Calm, sacred sanctuary meditation music with glass harp arpeggios
    // Replaced the harsh static sine drone with a relaxing, peaceful progression
    celestial(c, dest) {
      const t0 = c.currentTime;
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      // Sacred Ethereal Chords (Cmaj9 -> Fmaj9 -> Am9 -> Gsus4)
      const progression = [
        { bass: 65.41, notes: [196.00, 246.94, 293.66, 329.63, 392.00] },
        { bass: 87.31, notes: [174.61, 220.00, 261.63, 329.63, 392.00] },
        { bass: 55.00, notes: [164.81, 220.00, 246.94, 261.63, 329.63] },
        { bass: 49.00, notes: [146.83, 196.00, 220.00, 246.94, 293.66] }
      ];

      let currentPadOscs = [];
      const padFilter = c.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(320, t0);
      const padGain = c.createGain();
      padGain.gain.setValueAtTime(0.04, t0);
      padFilter.connect(padGain).connect(trackGain);

      let step = 0;
      let active = true;
      let celestialTimer = null;

      function playSacredChord(idx) {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        const chord = progression[idx % progression.length];

        // Cleanly crossfade out previous pad notes
        if (currentPadOscs.length) {
          const oldOscs = currentPadOscs;
          currentPadOscs = [];
          oldOscs.forEach(({ osc, gain }) => {
            try {
              gain.gain.cancelScheduledValues(now);
              gain.gain.setValueAtTime(gain.gain.value, now);
              gain.gain.linearRampToValueAtTime(0.0001, now + 1.8);
              setTimeout(() => { try { osc.stop(); osc.disconnect(); } catch (e) {} }, 1900);
            } catch (e) {}
          });
        }

        // Deep grounding sanctuary bass
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(chord.bass, now);
        bassGain.gain.setValueAtTime(0.001, now);
        bassGain.gain.linearRampToValueAtTime(0.045, now + 1.5);
        bassOsc.connect(bassGain).connect(padFilter);
        bassOsc.start(now);
        currentPadOscs.push({ osc: bassOsc, gain: bassGain });

        // Gentle warm cathedral harmony pad
        chord.notes.slice(0, 3).forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.015, now + 1.8);
          osc.connect(g).connect(padFilter);
          osc.start(now);
          currentPadOscs.push({ osc, gain: g });
        });

        // Delicate heavenly glass harp melody / arpeggio notes
        chord.notes.forEach((noteFreq, i) => {
          const noteTime = now + 0.4 + i * 0.9;
          try {
            const hOsc = ctx.createOscillator();
            const hGain = ctx.createGain();
            hOsc.type = 'sine';
            hOsc.frequency.setValueAtTime(noteFreq, noteTime);

            hGain.gain.setValueAtTime(0.0001, noteTime);
            hGain.gain.linearRampToValueAtTime(0.03, noteTime + 0.05);
            hGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 2.2);

            hOsc.connect(hGain).connect(trackGain);
            hOsc.start(noteTime);
            hOsc.stop(noteTime + 2.3);
          } catch (e) {}
        });
      }

      playSacredChord(0);

      function loopCelestial() {
        if (!active) return;
        step++;
        playSacredChord(step);
        celestialTimer = setTimeout(loopCelestial, 5200); // 5.2s peaceful spacing
      }
      celestialTimer = setTimeout(loopCelestial, 5200);

      return {
        theme: 'celestial',
        gainNode: trackGain,
        stop() {
          active = false;
          if (celestialTimer) clearTimeout(celestialTimer);
          currentPadOscs.forEach(({ osc }) => { try { osc.stop(); } catch (e) {} });
        }
      };
    },

    // 11. QUANTUM: FM synthesis tachyon particle hum & phase shifts
    quantum(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const carrier = c.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(125, t0);

      const mod = c.createOscillator();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(10, t0);
      const modGain = c.createGain();
      modGain.gain.setValueAtTime(32, t0);
      mod.connect(modGain).connect(carrier.frequency);
      mod.start(t0);

      const carrierGain = c.createGain();
      carrierGain.gain.setValueAtTime(0.08, t0);
      carrier.connect(carrierGain).connect(trackGain);
      carrier.start(t0);

      const phaseSrc = createLoopingNoise(c, noise.pink);
      const phaseFilter = c.createBiquadFilter();
      phaseFilter.type = 'bandpass';
      phaseFilter.frequency.setValueAtTime(800, t0);
      phaseFilter.Q.setValueAtTime(3.0, t0);
      const phaseGain = c.createGain();
      phaseGain.gain.setValueAtTime(0.14, t0);
      phaseSrc.connect(phaseFilter).connect(phaseGain).connect(trackGain);

      return {
        theme: 'quantum',
        gainNode: trackGain,
        stop() {
          try { carrier.stop(); mod.stop(); phaseSrc.stop(); } catch (e) {}
        }
      };
    },

    // 12. SOVEREIGN: Regal cathedral drone (C2 + G2 + C3)
    sovereign(c, dest) {
      const t0 = c.currentTime;
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const notes = [65.41, 97.99, 130.81];
      const oscs = notes.map((f, i) => {
        const osc = c.createOscillator();
        osc.type = i === 1 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, t0);
        return osc;
      });

      const droneFilter = c.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(180, t0);

      const droneGain = c.createGain();
      droneGain.gain.setValueAtTime(0.075, t0);
      oscs.forEach(o => { o.connect(droneFilter); o.start(t0); });
      droneFilter.connect(droneGain).connect(trackGain);

      return {
        theme: 'sovereign',
        gainNode: trackGain,
        stop() {
          try { oscs.forEach(o => o.stop()); } catch (e) {}
        }
      };
    },

    // 13. MR MONEY: Velvet high-roller lounge pad & subtle golden coin shimmers
    mrmoney(c, dest) {
      const t0 = c.currentTime;
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const chord = [174.61, 207.65, 261.63, 311.13];
      const oscs = chord.map(f => {
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t0);
        return osc;
      });

      const padFilter = c.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(450, t0);

      const padGain = c.createGain();
      padGain.gain.setValueAtTime(0.055, t0);
      oscs.forEach(o => o.connect(padFilter));
      padFilter.connect(padGain).connect(trackGain);
      oscs.forEach(o => o.start(t0));

      let active = true;
      let coinTimeout = null;

      function spawnCoinChime() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        try {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2400 + Math.random() * 400, now);
          g.gain.setValueAtTime(0.04, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(g).connect(trackGain);
          osc.start(now);
          osc.stop(now + 0.14);
        } catch (e) {}

        coinTimeout = setTimeout(spawnCoinChime, 5000 + Math.random() * 4000);
      }
      coinTimeout = setTimeout(spawnCoinChime, 3000);

      return {
        theme: 'mrmoney',
        gainNode: trackGain,
        stop() {
          active = false;
          if (coinTimeout) clearTimeout(coinTimeout);
          try { oscs.forEach(o => o.stop()); } catch (e) {}
        }
      };
    },

    // 14. PINK: Calm, soothing lo-fi bedroom pop progression with warm electric piano melody
    // Replaced the repetitive single key drone with gentle, relaxing music
    pink(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      // Warm lo-fi tape air (ultra subtle, soft blanket)
      const airSrc = createLoopingNoise(c, noise.pink);
      const airFilter = c.createBiquadFilter();
      airFilter.type = 'lowpass';
      airFilter.frequency.setValueAtTime(320, t0);
      const airGain = c.createGain();
      airGain.gain.setValueAtTime(0.015, t0);
      airSrc.connect(airFilter).connect(airGain).connect(trackGain);

      // Lo-fi Chord Progression: Fmaj7 -> Dm7 -> Cmaj7 -> Bbmaj7
      const progression = [
        { bass: 87.31, pad: [174.61, 220.00, 261.63, 329.63], melody: [261.63, 329.63, 440.00, 329.63] },
        { bass: 73.42, pad: [146.83, 174.61, 220.00, 261.63], melody: [220.00, 261.63, 349.23, 261.63] },
        { bass: 65.41, pad: [130.81, 164.81, 196.00, 246.94], melody: [196.00, 246.94, 293.66, 246.94] },
        { bass: 58.27, pad: [116.54, 146.83, 174.61, 220.00], melody: [174.61, 220.00, 261.63, 220.00] }
      ];

      let currentPadOscs = [];
      const padFilter = c.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(260, t0);
      const padMasterGain = c.createGain();
      padMasterGain.gain.setValueAtTime(0.045, t0);
      padFilter.connect(padMasterGain).connect(trackGain);

      let step = 0;
      let active = true;
      let musicTimer = null;

      function playChord(chordIdx) {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        const chord = progression[chordIdx % progression.length];

        // Fade out previous pad gently
        if (currentPadOscs.length) {
          const oldOscs = currentPadOscs;
          currentPadOscs = [];
          oldOscs.forEach(({ osc, gain }) => {
            try {
              gain.gain.cancelScheduledValues(now);
              gain.gain.setValueAtTime(gain.gain.value, now);
              gain.gain.linearRampToValueAtTime(0.0001, now + 1.2);
              setTimeout(() => { try { osc.stop(); osc.disconnect(); } catch (e) {} }, 1300);
            } catch (e) {}
          });
        }

        // Warm sub-bass note
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(chord.bass, now);
        bassGain.gain.setValueAtTime(0.001, now);
        bassGain.gain.linearRampToValueAtTime(0.04, now + 0.8);
        bassOsc.connect(bassGain).connect(padFilter);
        bassOsc.start(now);
        currentPadOscs.push({ osc: bassOsc, gain: bassGain });

        // Pillowy pad voices
        chord.pad.forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.02, now + 1.2);
          osc.connect(g).connect(padFilter);
          osc.start(now);
          currentPadOscs.push({ osc, gain: g });
        });

        // Calm melodic electric piano notes
        chord.melody.forEach((noteFreq, idx) => {
          const noteTime = now + 0.3 + idx * 0.95;
          try {
            const mOsc = ctx.createOscillator();
            const mGain = ctx.createGain();
            const mFilt = ctx.createBiquadFilter();
            mFilt.type = 'lowpass';
            mFilt.frequency.setValueAtTime(500, noteTime);

            mOsc.type = 'triangle';
            mOsc.frequency.setValueAtTime(noteFreq, noteTime);

            mGain.gain.setValueAtTime(0.001, noteTime);
            mGain.gain.linearRampToValueAtTime(0.035, noteTime + 0.04);
            mGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.4);

            mOsc.connect(mFilt).connect(mGain).connect(trackGain);
            mOsc.start(noteTime);
            mOsc.stop(noteTime + 1.5);
          } catch (e) {}
        });
      }

      playChord(0);

      function loopMusic() {
        if (!active) return;
        step++;
        playChord(step);
        musicTimer = setTimeout(loopMusic, 4200);
      }
      musicTimer = setTimeout(loopMusic, 4200);

      return {
        theme: 'pink',
        gainNode: trackGain,
        stop() {
          active = false;
          if (musicTimer) clearTimeout(musicTimer);
          try { airSrc.stop(); } catch (e) {}
          currentPadOscs.forEach(({ osc }) => { try { osc.stop(); } catch (e) {} });
        }
      };
    },

    // 15. LIGHT: Bright morning breeze & warm uplifting chord
    light(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const breezeSrc = createLoopingNoise(c, noise.pink);
      const breezeFilter = c.createBiquadFilter();
      breezeFilter.type = 'bandpass';
      breezeFilter.frequency.setValueAtTime(750, t0);
      breezeFilter.Q.setValueAtTime(1.0, t0);
      const breezeGain = c.createGain();
      breezeGain.gain.setValueAtTime(0.20, t0);
      breezeSrc.connect(breezeFilter).connect(breezeGain).connect(trackGain);

      const chord = [196.00, 293.66, 493.88];
      const oscs = chord.map(f => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t0);
        return osc;
      });
      const chordGain = c.createGain();
      chordGain.gain.setValueAtTime(0.045, t0);
      oscs.forEach(o => { o.connect(chordGain); o.start(t0); });
      chordGain.connect(trackGain);

      return {
        theme: 'light',
        gainNode: trackGain,
        stop() {
          try { breezeSrc.stop(); oscs.forEach(o => o.stop()); } catch (e) {}
        }
      };
    },

    // 16. DARK: Deep atmospheric synth drone & cavern ambiance (default)
    dark(c, dest) {
      const t0 = c.currentTime;
      const noise = getNoiseBuffers(c);
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const drone1 = c.createOscillator();
      drone1.type = 'triangle';
      drone1.frequency.setValueAtTime(55, t0);
      const drone2 = c.createOscillator();
      drone2.type = 'sine';
      drone2.frequency.setValueAtTime(82.4, t0);
      const droneGain = c.createGain();
      droneGain.gain.setValueAtTime(0.085, t0);
      drone1.connect(droneGain);
      drone2.connect(droneGain);
      droneGain.connect(trackGain);
      drone1.start(t0);
      drone2.start(t0);

      const caveSrc = createLoopingNoise(c, noise.brown);
      const caveFilter = c.createBiquadFilter();
      caveFilter.type = 'lowpass';
      caveFilter.frequency.setValueAtTime(160, t0);
      const caveGain = c.createGain();
      caveGain.gain.setValueAtTime(0.24, t0);
      caveSrc.connect(caveFilter).connect(caveGain).connect(trackGain);

      return {
        theme: 'dark',
        gainNode: trackGain,
        stop() {
          try { drone1.stop(); drone2.stop(); caveSrc.stop(); } catch (e) {}
        }
      };
    },

    // 17. PRISM CORE: Pristine glass harmonica, celestial crystal bells & shimmering harmonic caustics
    prism(c, dest) {
      const t0 = c.currentTime;
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      // Crystalline prismatic progression in Lydian/Major sparkling tonality
      const progression = [
        { bass: 65.41, notes: [261.63, 329.63, 392.00, 523.25, 659.25] }, // C Maj9
        { bass: 73.42, notes: [293.66, 369.99, 440.00, 587.33, 739.99] }, // D Maj9
        { bass: 82.41, notes: [329.63, 392.00, 493.88, 659.25, 783.99] }, // E min9
        { bass: 87.31, notes: [261.63, 349.23, 440.00, 523.25, 659.25] }  // F Maj7#11
      ];

      let currentPadOscs = [];
      const crystalFilter = c.createBiquadFilter();
      crystalFilter.type = 'lowpass';
      crystalFilter.frequency.setValueAtTime(1200, t0);
      const chamberGain = c.createGain();
      chamberGain.gain.setValueAtTime(0.045, t0);
      crystalFilter.connect(chamberGain).connect(trackGain);

      let step = 0;
      let active = true;
      let prismTimer = null;

      function playPrismChord(idx) {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        const chord = progression[idx % progression.length];

        // Crossfade previous pad
        if (currentPadOscs.length) {
          const oldOscs = currentPadOscs;
          currentPadOscs = [];
          oldOscs.forEach(({ osc, gain }) => {
            try {
              gain.gain.cancelScheduledValues(now);
              gain.gain.setValueAtTime(gain.gain.value, now);
              gain.gain.linearRampToValueAtTime(0.0001, now + 1.4);
              setTimeout(() => { try { osc.stop(); osc.disconnect(); } catch (e) {} }, 1500);
            } catch (e) {}
          });
        }

        // Deep warm crystal foundation
        const baseOsc = ctx.createOscillator();
        const baseGain = ctx.createGain();
        baseOsc.type = 'sine';
        baseOsc.frequency.setValueAtTime(chord.bass, now);
        baseGain.gain.setValueAtTime(0.001, now);
        baseGain.gain.linearRampToValueAtTime(0.035, now + 1.2);
        baseOsc.connect(baseGain).connect(crystalFilter);
        baseOsc.start(now);
        currentPadOscs.push({ osc: baseOsc, gain: baseGain });

        // Glass-harmonica shimmer harmony pad
        chord.notes.slice(0, 3).forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.022, now + 1.4);
          osc.connect(g).connect(crystalFilter);
          osc.start(now);
          currentPadOscs.push({ osc, gain: g });
        });

        // Sparkling crystal bell refractor arpeggio
        chord.notes.forEach((noteFreq, i) => {
          const noteTime = now + 0.2 + i * 0.75;
          try {
            const bellOsc = ctx.createOscillator();
            const bellGain = ctx.createGain();
            const bellFilter = ctx.createBiquadFilter();
            bellFilter.type = 'bandpass';
            bellFilter.frequency.setValueAtTime(noteFreq * 2, noteTime);
            bellFilter.Q.setValueAtTime(4.0, noteTime);

            bellOsc.type = 'triangle';
            bellOsc.frequency.setValueAtTime(noteFreq * 2, noteTime);

            bellGain.gain.setValueAtTime(0.0001, noteTime);
            bellGain.gain.linearRampToValueAtTime(0.032, noteTime + 0.02);
            bellGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.8);

            bellOsc.connect(bellFilter).connect(bellGain).connect(trackGain);
            bellOsc.start(noteTime);
            bellOsc.stop(noteTime + 1.9);
          } catch (e) {}
        });
      }

      playPrismChord(0);

      function loopPrism() {
        if (!active) return;
        step++;
        playPrismChord(step);
        prismTimer = setTimeout(loopPrism, 4400); // 4.4s spacing
      }
      prismTimer = setTimeout(loopPrism, 4400);

      return {
        theme: 'prism',
        gainNode: trackGain,
        stop() {
          active = false;
          if (prismTimer) clearTimeout(prismTimer);
          currentPadOscs.forEach(({ osc }) => { try { osc.stop(); } catch (e) {} });
        }
      };
    },

    darkmatter(c, dest) {
      return this.prism(c, dest);
    },

    // 18. VALENTINE: Heartbeat pulse & warm music box harmony
    valentine(c, dest) {
      const t0 = c.currentTime;
      const trackGain = c.createGain();
      trackGain.gain.setValueAtTime(0.0001, t0);
      trackGain.gain.linearRampToValueAtTime(1.0, t0 + 1.4);
      trackGain.connect(dest);

      const chord = [440.00, 554.37, 659.25];
      const oscs = chord.map(f => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t0);
        return osc;
      });
      const chordGain = c.createGain();
      chordGain.gain.setValueAtTime(0.045, t0);
      oscs.forEach(o => { o.connect(chordGain); o.start(t0); });
      chordGain.connect(trackGain);

      let active = true;
      let heartTimeout = null;

      function spawnHeartbeat() {
        if (!active || !ctx) return;
        const now = ctx.currentTime;
        try {
          [0, 0.22].forEach(offset => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(55, now + offset);
            g.gain.setValueAtTime(0.14, now + offset);
            g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
            osc.connect(g).connect(trackGain);
            osc.start(now + offset);
            osc.stop(now + offset + 0.18);
          });
        } catch (e) {}

        heartTimeout = setTimeout(spawnHeartbeat, 2400);
      }
      heartTimeout = setTimeout(spawnHeartbeat, 1200);

      return {
        theme: 'valentine',
        gainNode: trackGain,
        stop() {
          active = false;
          if (heartTimeout) clearTimeout(heartTimeout);
          try { oscs.forEach(o => o.stop()); } catch (e) {}
        }
      };
    }
  };

  // ---- Randomized Ambient World Layers Subsystem ----------------------------
  // Intermittently layers subtle organic atmospheric sounds on top of the
  // active theme background music:
  // - Distant songbirds & woodland chirps (FM natural sweeps)
  // - Low-frequency seismic / subterranean cavern hums (warm sub-bass swells)
  // - Mechanical clicking & clockwork relay chatter (crisp micro-ticks)
  // - Gentle wind gust sweeps (filtered pink noise breathing)
  // - Crystalline celestial harmonics & glass chimes (ethereal resonance)
  // - Solitary cave water droplets with soft reflections
  let ambientWorldTimer = null;
  let ambientWorldActive = false;
  let ambientWorldGain = null;

  function ensureAmbientWorldGain(c) {
    if (!ambientWorldGain && ambientMasterGain) {
      ambientWorldGain = c.createGain();
      ambientWorldGain.gain.setValueAtTime(1.0, c.currentTime);
      ambientWorldGain.connect(ambientMasterGain);
    }
    return ambientWorldGain;
  }

  // 1. Distant Birds: Organic songbird chirps and warbles with natural pitch sweeps
  function playWorldDistantBirds(c, dest) {
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.connect(dest);

    // Highpass filter to push the sound into the outdoor distance
    const hp = c.createBiquadFilter ? c.createBiquadFilter() : null;
    if (hp) {
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(1800, t);
      hp.Q.setValueAtTime(1.0, t);
      hp.connect(g);
    }
    const targetNode = hp || g;

    // Chirp 1: Upward swoop followed by gentle dip
    const chirp1 = c.createOscillator();
    const g1 = c.createGain();
    chirp1.type = 'sine';
    chirp1.frequency.setValueAtTime(2800, t);
    chirp1.frequency.exponentialRampToValueAtTime(3600, t + 0.06);
    chirp1.frequency.exponentialRampToValueAtTime(3100, t + 0.11);
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.linearRampToValueAtTime(0.038, t + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    chirp1.connect(g1);
    g1.connect(targetNode);
    chirp1.start(t);
    chirp1.stop(t + 0.13);

    // Chirp 2: Higher companion chirp slightly delayed
    const t2 = t + 0.15;
    const chirp2 = c.createOscillator();
    const g2 = c.createGain();
    chirp2.type = 'sine';
    chirp2.frequency.setValueAtTime(3300, t2);
    chirp2.frequency.exponentialRampToValueAtTime(4200, t2 + 0.05);
    chirp2.frequency.exponentialRampToValueAtTime(3700, t2 + 0.09);
    g2.gain.setValueAtTime(0.0001, t2);
    g2.gain.linearRampToValueAtTime(0.032, t2 + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.10);
    chirp2.connect(g2);
    g2.connect(targetNode);
    chirp2.start(t2);
    chirp2.stop(t2 + 0.11);

    // Occasional 3rd soft flourish (45% chance)
    if (Math.random() > 0.45) {
      const t3 = t2 + 0.14;
      const chirp3 = c.createOscillator();
      const g3 = c.createGain();
      chirp3.type = 'sine';
      chirp3.frequency.setValueAtTime(3900, t3);
      chirp3.frequency.exponentialRampToValueAtTime(3200, t3 + 0.08);
      g3.gain.setValueAtTime(0.0001, t3);
      g3.gain.linearRampToValueAtTime(0.028, t3 + 0.02);
      g3.gain.exponentialRampToValueAtTime(0.0001, t3 + 0.09);
      chirp3.connect(g3);
      g3.connect(targetNode);
      chirp3.start(t3);
      chirp3.stop(t3 + 0.10);
    }
  }

  // 2. Low-Frequency Hum: Deep subterranean resonance / cavern bass breathing
  function playWorldLowFreqHum(c, dest) {
    const t = c.currentTime;
    const baseFreq = 46 + Math.random() * 8; // 46Hz to 54Hz deep sub
    const duration = 5.2;

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.065, t + 2.0); // slow 2s gentle swell
    g.gain.setValueAtTime(0.065, t + 3.2);
    g.gain.linearRampToValueAtTime(0.0001, t + duration); // 2s gentle fadeout
    g.connect(dest);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(85, t);
    lp.Q.setValueAtTime(1.8, t);
    lp.connect(g);

    // Dual detuned oscillators for natural acoustic breathing
    const osc1 = c.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.connect(lp);

    const osc2 = c.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 1.5, t); // fifth overtone
    const osc2Gain = c.createGain();
    osc2Gain.gain.setValueAtTime(0.25, t);
    osc2.connect(osc2Gain);
    osc2Gain.connect(lp);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  // 3. Mechanical Clicking: Clockwork precision gear ticks and subtle relays
  function playWorldMechanicalClicks(c, dest) {
    const t = c.currentTime;
    const count = 3 + Math.floor(Math.random() * 3); // 3 to 5 micro-ticks
    let tickTime = t;

    for (let i = 0; i < count; i++) {
      const osc = c.createOscillator();
      const bp = c.createBiquadFilter();
      const g = c.createGain();

      const centerFreq = 1600 + (Math.random() * 700); // 1600 - 2300Hz metallic tick
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(centerFreq, tickTime);
      bp.Q.setValueAtTime(12, tickTime); // high resonance for metallic click

      osc.type = i % 2 === 0 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(centerFreq, tickTime);
      osc.frequency.exponentialRampToValueAtTime(centerFreq * 0.4, tickTime + 0.016);

      const tickVol = 0.022 + Math.random() * 0.016;
      g.gain.setValueAtTime(0.0001, tickTime);
      g.gain.linearRampToValueAtTime(tickVol, tickTime + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, tickTime + 0.022);

      osc.connect(bp);
      bp.connect(g);
      g.connect(dest);

      osc.start(tickTime);
      osc.stop(tickTime + 0.025);

      // Irregular, natural clockwork gear interval
      tickTime += 0.055 + Math.random() * 0.05;
    }
  }

  // 4. Gentle Wind Gust: Resonant swept pink noise breathing
  function playWorldWindGust(c, dest) {
    const t = c.currentTime;
    const noise = getNoiseBuffers(c);
    const src = c.createBufferSource();
    src.buffer = noise.pink;
    src.loop = false;

    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    const startFreq = 280 + Math.random() * 60;
    const peakFreq = 620 + Math.random() * 150;
    bp.frequency.setValueAtTime(startFreq, t);
    bp.frequency.linearRampToValueAtTime(peakFreq, t + 1.6);
    bp.frequency.linearRampToValueAtTime(startFreq * 0.9, t + 3.6);
    bp.Q.setValueAtTime(2.2, t);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075, t + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 3.8);

    src.connect(bp);
    bp.connect(g);
    g.connect(dest);

    src.start(t);
    src.stop(t + 4.0);
  }

  // 5. Crystalline Shimmer: Delicate ethereal glass chimes
  function playWorldCrystalChime(c, dest) {
    const t = c.currentTime;
    const notes = [1318.5, 1567.98, 1760.0, 1975.53, 2349.32]; // E6, G6, A6, B6, D7
    const note = notes[Math.floor(Math.random() * notes.length)];
    const duration = 2.6;

    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, t);

    // Subtle natural acoustic vibrato
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.setValueAtTime(4.5, t);
    lfoGain.gain.setValueAtTime(3.0, t);
    lfo.connect(osc.frequency);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(g);
    g.connect(dest);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + duration);
    osc.stop(t + duration);
  }

  // 6. Cave Droplet: Mysterious cavern drop with faint reflection
  function playWorldCaveDroplet(c, dest) {
    const t = c.currentTime;
    const dropFreq = 1400 + Math.random() * 300;

    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(dropFreq, t);
    osc.frequency.exponentialRampToValueAtTime(dropFreq * 0.45, t + 0.07);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.038, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.1);

    // Delayed soft echo reflection
    const tEcho = t + 0.22;
    const oscEcho = c.createOscillator();
    const gEcho = c.createGain();
    oscEcho.type = 'sine';
    oscEcho.frequency.setValueAtTime(dropFreq * 0.7, tEcho);
    oscEcho.frequency.exponentialRampToValueAtTime(dropFreq * 0.35, tEcho + 0.06);

    gEcho.gain.setValueAtTime(0.0001, tEcho);
    gEcho.gain.linearRampToValueAtTime(0.014, tEcho + 0.005);
    gEcho.gain.exponentialRampToValueAtTime(0.0001, tEcho + 0.08);

    oscEcho.connect(gEcho);
    gEcho.connect(dest);
    oscEcho.start(tEcho);
    oscEcho.stop(tEcho + 0.09);
  }

  const WORLD_LAYERS = {
    birds: playWorldDistantBirds,
    hum: playWorldLowFreqHum,
    clicks: playWorldMechanicalClicks,
    wind: playWorldWindGust,
    crystal: playWorldCrystalChime,
    drop: playWorldCaveDroplet
  };

  function selectRandomWorldLayer(theme) {
    theme = (theme || currentTheme || 'dark').toLowerCase();
    let pool = [];
    if (['verdant', 'light', 'pink', 'valentine'].includes(theme)) {
      pool = ['birds', 'birds', 'birds', 'wind', 'wind', 'crystal', 'clicks', 'hum'];
    } else if (['cyberneon', 'quantum', 'prism', 'darkmatter', 'sovereign'].includes(theme)) {
      pool = ['crystal', 'crystal', 'clicks', 'clicks', 'hum', 'hum', 'wind', 'birds'];
    } else if (['dark', 'abyss', 'magma', 'flame', 'storm'].includes(theme)) {
      pool = ['hum', 'hum', 'drop', 'drop', 'wind', 'wind', 'clicks', 'crystal'];
    } else if (['celestial', 'astral', 'aurora', 'glacier', 'mrmoney'].includes(theme)) {
      pool = ['crystal', 'crystal', 'crystal', 'wind', 'wind', 'clicks', 'hum', 'birds'];
    } else {
      pool = ['birds', 'hum', 'clicks', 'wind', 'crystal', 'drop'];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function triggerWorldAmbientLayer(explicitType) {
    const c = ensureCtx();
    if (!c || !ambientMasterGain) return;
    if (!ambientEnabled || muted || volume <= 0 || ambientVolume <= 0) return;

    const dest = ensureAmbientWorldGain(c);
    if (!dest) return;

    const type = explicitType && WORLD_LAYERS[explicitType] ? explicitType : selectRandomWorldLayer(currentTheme);
    const fn = WORLD_LAYERS[type];
    if (fn) {
      try {
        fn(c, dest);
      } catch (err) {}
    }
  }

  function scheduleNextWorldAmbientLayer() {
    if (!ambientWorldActive) return;
    if (ambientWorldTimer) clearTimeout(ambientWorldTimer);

    // Randomize intervals between 7 and 16 seconds
    const intervalMs = 7000 + Math.random() * 9000;
    ambientWorldTimer = setTimeout(() => {
      if (!ambientWorldActive) return;
      triggerWorldAmbientLayer();
      scheduleNextWorldAmbientLayer();
    }, intervalMs);
  }

  function startWorldAmbientLayers() {
    ambientWorldActive = true;
    scheduleNextWorldAmbientLayer();
  }

  function stopWorldAmbientLayers() {
    ambientWorldActive = false;
    if (ambientWorldTimer) {
      clearTimeout(ambientWorldTimer);
      ambientWorldTimer = null;
    }
  }

  // ---- Cross-fade Manager ---------------------------------------------------
  function crossfadeTo(newTheme) {
    newTheme = (newTheme || 'dark').toLowerCase();
    currentTheme = newTheme;

    const c = ensureCtx();
    if (!c) return;

    if (currentTrack && currentTrack.theme === newTheme && !fadingTrack) {
      return; // Already playing this theme
    }

    // Fade out previous track
    if (currentTrack) {
      const old = currentTrack;
      fadingTrack = old;
      currentTrack = null;
      const t = c.currentTime;
      try {
        old.gainNode.gain.cancelScheduledValues(t);
        old.gainNode.gain.setValueAtTime(old.gainNode.gain.value, t);
        old.gainNode.gain.linearRampToValueAtTime(0.0001, t + 1.2);
      } catch (e) {}
      setTimeout(() => {
        try { old.stop(); } catch (e) {}
        if (fadingTrack === old) fadingTrack = null;
      }, 1300);
    }

    if (!ambientEnabled || muted || volume <= 0) return;

    const generator = THEME_GENERATORS[newTheme] || THEME_GENERATORS['dark'];
    if (!generator) return;

    currentTrack = generator(c, ambientMasterGain);
    if (!ambientWorldActive) {
      startWorldAmbientLayers();
    }
  }

  function duckAmbient(durationMs = 1500, duckRatio = 0.25) {
    if (!ambientMasterGain || !ctx) return;
    if (duckTimer) clearTimeout(duckTimer);

    const normalGain = calcTargetAmbientGain();
    const duckedGain = normalGain * duckRatio;
    const now = ctx.currentTime;

    try {
      ambientMasterGain.gain.cancelScheduledValues(now);
      ambientMasterGain.gain.setValueAtTime(ambientMasterGain.gain.value, now);
      ambientMasterGain.gain.linearRampToValueAtTime(duckedGain, now + 0.15);
    } catch (e) {}

    duckTimer = setTimeout(() => {
      if (!ambientMasterGain || !ctx) return;
      const t = ctx.currentTime;
      try {
        ambientMasterGain.gain.cancelScheduledValues(t);
        ambientMasterGain.gain.setValueAtTime(ambientMasterGain.gain.value, t);
        ambientMasterGain.gain.linearRampToValueAtTime(normalGain, t + 0.8);
      } catch (e) {}
    }, durationMs);
  }

  // Handle browser autoplay policy by registering one-time gesture listeners
  function setupAutoplayUnlock() {
    if (audioUnlocked) return;
    const events = ['pointerdown', 'keydown', 'touchstart', 'click'];
    function onGesture() {
      audioUnlocked = true;
      events.forEach(e => window.removeEventListener(e, onGesture, true));
      const c = ensureCtx();
      if (c && c.state === 'suspended') {
        c.resume().then(() => {
          if (!currentTrack && ambientEnabled && !muted) {
            crossfadeTo(currentTheme);
          }
        }).catch(() => {});
      } else if (!currentTrack && ambientEnabled && !muted) {
        crossfadeTo(currentTheme);
      }
    }
    events.forEach(e => window.addEventListener(e, onGesture, { capture: true, once: true }));
  }

  if (typeof window !== 'undefined') {
    setupAutoplayUnlock();
  }

  // Public Ambient Sound Manager API
  const ambientManager = {
    setTheme(t) {
      crossfadeTo(t);
    },
    getTheme() {
      return currentTheme;
    },
    setEnabled(en) {
      ambientEnabled = !!en;
      try { localStorage.setItem('mehrbod-cards-ambient-enabled', ambientEnabled ? '1' : '0'); } catch (e) {}
      if (ambientEnabled && !currentTrack) {
        crossfadeTo(currentTheme);
      }
      updateAmbientMasterGain(0.3);
    },
    isEnabled() {
      return ambientEnabled;
    },
    setVolume(v) {
      ambientVolume = Math.max(0, Math.min(1, Number(v) || 0));
      try { localStorage.setItem('mehrbod-cards-ambient-volume', String(ambientVolume)); } catch (e) {}
      updateAmbientMasterGain(0.15);
    },
    getVolume() {
      return ambientVolume;
    },
    duck(dur, ratio) {
      duckAmbient(dur, ratio);
    },
    triggerLayer(type) {
      triggerWorldAmbientLayer(type);
    },
    startWorldLayers() {
      startWorldAmbientLayers();
    },
    stopWorldLayers() {
      stopWorldAmbientLayers();
    },
    getAvailableLayers() {
      return ['birds', 'hum', 'clicks', 'wind', 'crystal', 'drop'];
    },
    stop() {
      stopWorldAmbientLayers();
      if (currentTrack) {
        try { currentTrack.stop(); } catch (e) {}
        currentTrack = null;
      }
      if (fadingTrack) {
        try { fadingTrack.stop(); } catch (e) {}
        fadingTrack = null;
      }
    }
  };

  // Card hover throttle
  let lastHoverTime = 0;

  const soundObj = {
    ensureCtx,
    getCtx: ensureCtx,
    unlockAudio() {
      const c = ensureCtx();
      if (c && c.state === 'suspended') {
        c.resume().then(() => {
          audioUnlocked = true;
          console.log('[Web Audio Engine] Context successfully unlocked via user gesture.');
        }).catch(err => {
          console.warn('[Web Audio Engine] Failed to resume on gesture:', err);
        });
      } else if (c) {
        audioUnlocked = true;
      }
    },
    ambient: ambientManager,
    setTheme(t) { ambientManager.setTheme(t); },
    getTheme() { return ambientManager.getTheme(); },
    setAmbientEnabled(b) { ambientManager.setEnabled(b); },
    isAmbientEnabled() { return ambientManager.isEnabled(); },
    setAmbientVolume(v) { ambientManager.setVolume(v); },
    getAmbientVolume() { return ambientManager.getVolume(); },

    setSfxEnabled(b) {
      sfxEnabled = !!b;
      try { localStorage.setItem('mehrbod-cards-sfx-enabled', sfxEnabled ? '1' : '0'); } catch (e) {}
    },
    isSfxEnabled() { return sfxEnabled; },

    setMuted(m) {
      muted = m;
      try { localStorage.setItem('mehrbod-cards-muted', m ? '1' : '0'); } catch (e) {}
      updateAmbientMasterGain(0.2);
    },
    isMuted() { return muted; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      try { localStorage.setItem('mehrbod-cards-volume', String(volume)); } catch (e) {}
      updateAmbientMasterGain(0.2);
    },
    getVolume() { return volume; },

    // Game Combat & Board SFX
    place() { tone(440, 0.07, 'triangle', 0.10); },
    merge() { sweep(320, 760, 0.25, 'sine', 0.13); },
    megaMerge() {
      sweep(220, 980, 0.4, 'sine', 0.16);
      [660, 880, 1200].forEach((f, i) => tone(f, 0.2, 'triangle', 0.09, 0.12 + i * 0.07));
    },
    meteor() {
      duckAmbient(1800, 0.3);
      sweep(180, 900, 0.55, 'sawtooth', 0.14);
      [1300, 1700, 2100].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, 0.15 + i * 0.1));
    },
    meteorBoom() {
      duckAmbient(1500, 0.2);
      sweep(140, 30, 0.5, 'sawtooth', 0.16);
      tone(70, 0.35, 'square', 0.12, 0.05);
    },
    attack() { tone(160, 0.12, 'square', 0.13); },
    death() { sweep(420, 50, 0.4, 'sawtooth', 0.15); },
    lightning() {
      sweep(700, 1600, 0.22, 'sine', 0.14);
      tone(1800, 0.12, 'sine', 0.07, 0.05);
    },
    chainLightningCrack() {
      duckAmbient(1600, 0.3);
      sweep(2800, 100, 0.25, 'sawtooth', 0.18);
      tone(4000, 0.08, 'square', 0.15);
      tone(3200, 0.06, 'triangle', 0.12, 0.03);
      sweep(160, 40, 0.35, 'sawtooth', 0.14);
    },
    heal() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'sine', 0.09, i * 0.06)); },
    defend() { tone(700, 0.14, 'sine', 0.09); },
    ready() { tone(520, 0.09, 'triangle', 0.09); },
    win() {
      duckAmbient(2500, 0.2);
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.11, i * 0.12));
    },
    lowHp() { tone(880, 0.07, 'square', 0.06); tone(620, 0.1, 'square', 0.06, 0.08); },
    block() { tone(220, 0.09, 'square', 0.11); tone(160, 0.07, 'square', 0.09, 0.05); },
    chipAttach() { tone(1200, 0.05, 'square', 0.07); tone(950, 0.06, 'square', 0.06, 0.04); },
    sparkle() { [1046, 1318, 1568].forEach((f, i) => tone(f, 0.12, 'sine', 0.06, i * 0.05)); },
    abilityPing() { tone(980, 0.08, 'triangle', 0.08); },
    select() { tone(680, 0.05, 'triangle', 0.06); },
    click() { tone(600, 0.04, 'sine', 0.06); },
    packTear() { sweep(500, 130, 0.3, 'sawtooth', 0.14); tone(90, 0.18, 'square', 0.1, 0.08); },
    packCardFlip() { tone(700, 0.05, 'triangle', 0.07); tone(1050, 0.07, 'triangle', 0.08, 0.05); },
    packRareFlip() { [660, 990, 1320, 1760].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, i * 0.05)); },
    epicVictory() {
      duckAmbient(3200, 0.15);
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((f, i) => {
        tone(f, 0.45, 'triangle', 0.12, i * 0.08);
        tone(f * 1.5, 0.35, 'sine', 0.06, i * 0.08 + 0.04);
      });
      sweep(130, 40, 0.8, 'sawtooth', 0.15);
      [1567.98, 1975.53, 2093.00, 2637.02].forEach((f, i) => {
        tone(f, 0.25, 'sine', 0.07, 0.6 + i * 0.06);
      });
    },
    easyVictory() {
      duckAmbient(1800, 0.25);
      [523.25, 659.25, 783.99].forEach((f, i) => {
        tone(f, 0.25, 'sine', 0.08, i * 0.08);
      });
    },
    mediumVictory() {
      duckAmbient(2000, 0.25);
      const chord1 = [392.00, 493.88, 587.33];
      const chord2 = [523.25, 659.25, 783.99];
      chord1.forEach(f => tone(f, 0.2, 'triangle', 0.08));
      chord2.forEach((f, i) => tone(f, 0.3, 'sine', 0.08, 0.15 + i * 0.04));
    },
    hardVictory() {
      duckAmbient(2500, 0.2);
      sweep(100, 160, 0.2, 'sawtooth', 0.1);
      const fan1 = [329.63, 392.00, 523.25];
      const fan2 = [392.00, 493.88, 587.33];
      const fan3 = [523.25, 659.25, 783.99, 1046.50];
      fan1.forEach(f => tone(f, 0.15, 'triangle', 0.08, 0));
      fan2.forEach(f => tone(f, 0.15, 'triangle', 0.08, 0.12));
      fan3.forEach((f, i) => {
        tone(f, 0.35, 'triangle', 0.1, 0.24);
        tone(f * 1.5, 0.25, 'sine', 0.06, 0.28 + i * 0.03);
      });
    },

    // ---- Expanded Game SFX --------------------------------------------------
    // Card movement & interactions
    cardDraw() {
      sweep(800, 240, 0.08, 'triangle', 0.06);
      tone(320, 0.06, 'sine', 0.04, 0.02);
    },
    cardHover() {
      const now = Date.now();
      if (now - lastHoverTime < 110) return;
      lastHoverTime = now;
      tone(850, 0.015, 'triangle', 0.02);
    },
    cardSelect() {
      sweep(480, 720, 0.06, 'triangle', 0.08);
    },
    cardPlace(tier) {
      const baseFreq = 220 + (tier || 1) * 60;
      tone(baseFreq, 0.05, 'triangle', 0.08);
    },
    spellSelect() {
      [784, 1046].forEach((f, i) => tone(f, 0.08, 'sine', 0.06, i * 0.04));
    },
    chipSelect() {
      tone(1350, 0.04, 'triangle', 0.07);
    },
    undo() {
      sweep(320, 620, 0.07, 'sine', 0.07);
      sweep(620, 260, 0.10, 'triangle', 0.06, 0.05);
    },
    counterTick(dir) {
      tone(dir < 0 ? 1100 : 1600, 0.025, 'triangle', 0.08);
    },
    cardEquip() {
      tone(440, 0.04, 'square', 0.05);
      tone(880, 0.06, 'triangle', 0.07, 0.02);
    },
    shuffle() {
      [0, 0.035, 0.07, 0.11].forEach((d, i) => {
        tone(550 + i * 90, 0.03, 'triangle', 0.05, d);
      });
    },

    // UI & Navigation
    screenTransition() {
      sweep(380, 720, 0.11, 'sine', 0.045);
    },
    toast() {
      tone(784, 0.09, 'sine', 0.05);
      tone(1046.5, 0.13, 'sine', 0.06, 0.06);
    },
    modalOpen() {
      sweep(280, 560, 0.07, 'sine', 0.06);
    },
    modalClose() {
      sweep(500, 260, 0.06, 'sine', 0.05);
    },
    coin() {
      tone(2637, 0.07, 'sine', 0.07);
      tone(3951, 0.09, 'sine', 0.06, 0.02);
    },
    coinPurchase() {
      tone(1760, 0.06, 'sine', 0.07);
      tone(2637, 0.07, 'sine', 0.08, 0.05);
      tone(3520, 0.14, 'sine', 0.09, 0.10);
    },
    questClaim() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(f, 0.18, 'triangle', 0.08, i * 0.06);
      });
      [1567.98, 2093.00].forEach((f, i) => {
        tone(f, 0.22, 'sine', 0.06, 0.28 + i * 0.05);
      });
    },
    milestoneUnlock() {
      // Celebratory ascending fanfare chord + crystal sparkle
      [392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
        tone(f, 0.28, 'triangle', 0.10, i * 0.055);
      });
      [1567.98, 2093.00, 2637.02].forEach((f, i) => {
        tone(f, 0.35, 'sine', 0.08, 0.35 + i * 0.06);
      });
    },
    themeChange() {
      [440, 659.25, 880].forEach((f, i) => tone(f, 0.12, 'sine', 0.07, i * 0.04));
    },
    buttonPress() {
      tone(540, 0.03, 'sine', 0.05);
    },
    replayStep() {
      tone(1200, 0.02, 'triangle', 0.07);
      tone(800, 0.03, 'sine', 0.05, 0.01);
    },

    // Combat & Status
    turnStart() {
      [523.25, 659.25, 783.99].forEach((f, i) => {
        tone(f, 0.14, 'triangle', 0.07, i * 0.06);
      });
    },
    combatClash() {
      sweep(620, 180, 0.12, 'sawtooth', 0.12);
      tone(840, 0.09, 'triangle', 0.08);
    },
    playerDamage() {
      sweep(130, 45, 0.22, 'sawtooth', 0.16);
      tone(55, 0.2, 'square', 0.14, 0.04);
    },
    buff() {
      [659.25, 880, 1174.66].forEach((f, i) => {
        tone(f, 0.12, 'sine', 0.06, i * 0.04);
      });
    },

    // ---- Dedicated Victory Finisher Audio Synthesizers ---------------------
    confettiPlus() {
      duckAmbient(2800, 0.2);
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.3, 'triangle', 0.11, i * 0.09));
      [0.05, 0.25, 0.5, 0.75].forEach(d => {
        sweep(900, 240, 0.1, 'sine', 0.08, d);
        tone(1600 + Math.random() * 800, 0.06, 'triangle', 0.07, d + 0.02);
      });
    },
    starburst() {
      duckAmbient(2600, 0.2);
      [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760].forEach((f, i) => {
        tone(f, 0.4, 'sine', 0.09, i * 0.05);
      });
      sweep(300, 1800, 0.45, 'triangle', 0.12, 0.05);
      sweep(180, 60, 0.5, 'sine', 0.14, 0.15);
    },
    supernova() {
      duckAmbient(3800, 0.1);
      // Gravitational compression whoosh -> massive cosmic sub-bass blast -> shimmering celestial tail
      sweep(800, 90, 0.6, 'sawtooth', 0.14, 0);
      sweep(60, 25, 1.2, 'square', 0.18, 0.6);
      sweep(120, 40, 1.0, 'sawtooth', 0.16, 0.65);
      [1046.5, 1318.5, 1567.98, 2093, 2637, 3135.96].forEach((f, i) => {
        tone(f, 0.6, 'sine', 0.08, 0.8 + i * 0.08);
      });
    },
    fireworks() {
      duckAmbient(3200, 0.15);
      // 3 aerial rocket launches with whistle + booms + crackles
      [0, 0.65, 1.3].forEach((delay, idx) => {
        sweep(300, 1400, 0.45, 'sine', 0.10, delay);
        sweep(180, 40, 0.5, 'sawtooth', 0.16, delay + 0.45);
        tone(65, 0.35, 'square', 0.13, delay + 0.47);
        [0.6, 0.72, 0.84, 0.95].forEach((d, i) => {
          tone(2400 + (idx * 300) + (i * 200), 0.04, 'triangle', 0.06, delay + d);
        });
      });
    },
    cashRain() {
      duckAmbient(3000, 0.2);
      // Continuous coin clinks + register KA-CHING + jackpot fanfare
      [0, 0.12, 0.25, 0.38, 0.52, 0.68, 0.85, 1.05, 1.25, 1.5, 1.8].forEach((d, i) => {
        tone(2400 + (i % 4) * 400, 0.06, 'sine', 0.09, d);
        tone(3600 + (i % 3) * 500, 0.05, 'triangle', 0.07, d + 0.015);
      });
      // Register Ka-ching
      setTimeout(() => {
        sweep(900, 1800, 0.08, 'triangle', 0.14);
        tone(3520, 0.3, 'sine', 0.16, 0.06);
        tone(4186, 0.35, 'sine', 0.14, 0.09);
      }, 400);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.09, 0.8 + i * 0.08));
    },
    thunderStorm() {
      duckAmbient(3200, 0.15);
      // High-voltage lightning discharge + rolling sub-bass thunder
      sweep(3200, 120, 0.28, 'sawtooth', 0.20, 0);
      tone(4800, 0.06, 'square', 0.18, 0.01);
      tone(3600, 0.08, 'triangle', 0.15, 0.04);
      sweep(140, 30, 1.1, 'sawtooth', 0.19, 0.15);
      sweep(90, 25, 1.4, 'square', 0.17, 0.22);
      // Second rolling strike
      sweep(2600, 160, 0.22, 'sawtooth', 0.16, 0.9);
      sweep(110, 35, 0.9, 'sawtooth', 0.15, 1.05);
    },
    starFountain() {
      duckAmbient(3000, 0.2);
      // Rushing fountain hiss + rapid ascending crystal bell arpeggios
      sweep(300, 1600, 0.7, 'triangle', 0.11, 0);
      const scale = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1567.98, 1975.53, 2093.00];
      scale.forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.07));
      [0.6, 0.8, 1.0, 1.2, 1.4, 1.6].forEach((d, i) => {
        tone(1760 + (i % 3) * 440, 0.15, 'triangle', 0.06, d);
      });
    },
    dragonFlame() {
      duckAmbient(3500, 0.15);
      // Low guttural dragon roar + raging furnace fire whoosh + flame crackles
      sweep(90, 45, 0.9, 'sawtooth', 0.18, 0);
      tone(55, 1.1, 'square', 0.16, 0.05);
      sweep(220, 680, 0.8, 'sawtooth', 0.14, 0.3);
      sweep(580, 140, 0.9, 'sawtooth', 0.15, 0.7);
      [0.4, 0.65, 0.9, 1.2, 1.5, 1.8].forEach(d => {
        sweep(400, 150, 0.15, 'sawtooth', 0.09, d);
      });
    },
    blackHole() {
      duckAmbient(4000, 0.1);
      // Deep gravitational drone suction + event horizon spacetime warp
      sweep(240, 40, 1.5, 'sine', 0.18, 0);
      tone(48, 2.2, 'triangle', 0.16, 0.2);
      sweep(80, 320, 1.2, 'sawtooth', 0.12, 0.8);
      [880, 659.25, 523.25, 392, 261.63].forEach((f, i) => {
        tone(f, 0.5, 'sine', 0.07, 1.2 + i * 0.15);
      });
    },
    orbitalLaser() {
      duckAmbient(3500, 0.12);
      // Target lock beeps -> capacitor charge whine -> thunderous ion beam blast -> plasma detonation
      [0, 0.18, 0.36].forEach(d => tone(1760, 0.05, 'square', 0.08, d));
      sweep(400, 3200, 0.5, 'sine', 0.12, 0.5);
      // Massive beam blast
      sweep(2200, 80, 0.4, 'sawtooth', 0.22, 1.0);
      tone(70, 0.9, 'square', 0.18, 1.05);
      sweep(140, 35, 1.1, 'sawtooth', 0.16, 1.1);
      [1568, 2093, 2637].forEach((f, i) => tone(f, 0.35, 'triangle', 0.08, 1.3 + i * 0.08));
    },
    blizzardShatter() {
      duckAmbient(3500, 0.15);
      // Freezing wind sweep -> ice tension creak -> massive crystalline glass shatter -> sparkling frost chimes
      sweep(600, 1200, 0.7, 'sine', 0.10, 0);
      sweep(1400, 500, 0.5, 'triangle', 0.08, 0.4);
      // Shatter explosion at 1.0s
      sweep(3600, 180, 0.2, 'sawtooth', 0.20, 0.95);
      tone(4200, 0.08, 'square', 0.16, 0.96);
      tone(2800, 0.12, 'triangle', 0.14, 0.98);
      sweep(220, 50, 0.4, 'sawtooth', 0.13, 1.0);
      [2093, 2637, 3135.96, 4186, 3520].forEach((f, i) => {
        tone(f, 0.4, 'sine', 0.09, 1.15 + i * 0.09);
      });
    },
    nuclearBlast() {
      duckAmbient(4200, 0.08);
      // Klaxon siren -> blinding detonation sub-bass drop -> rolling earth-shaking shockwave
      [0, 0.25].forEach(d => { sweep(600, 950, 0.18, 'sawtooth', 0.11, d); });
      // Detonation
      sweep(180, 20, 1.8, 'sawtooth', 0.24, 0.55);
      tone(40, 2.4, 'square', 0.22, 0.6);
      sweep(90, 25, 2.0, 'sawtooth', 0.18, 0.8);
      sweep(300, 60, 1.4, 'sine', 0.15, 1.2);
    },
    phoenixRebirth() {
      duckAmbient(3800, 0.15);
      // Celestial angelic choir chord -> majestic avian chime cry -> warm radiant fire surge
      const choir = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      choir.forEach((f, i) => {
        tone(f, 0.8, 'sine', 0.09, i * 0.08);
      });
      // Avian chime cry
      sweep(880, 2637, 0.5, 'triangle', 0.14, 0.6);
      sweep(2637, 1318.5, 0.6, 'sine', 0.12, 1.05);
      sweep(180, 520, 0.7, 'sawtooth', 0.12, 1.2);
      [1567.98, 2093, 2637, 3135.96].forEach((f, i) => {
        tone(f, 0.5, 'sine', 0.08, 1.4 + i * 0.09);
      });
    },
    emoteCombat() {
      sweep(580, 180, 0.15, 'sawtooth', 0.11);
      tone(240, 0.08, 'square', 0.08);
    },
    emoteSocial() {
      tone(659.25, 0.06, 'sine', 0.08);
      tone(880, 0.08, 'sine', 0.08, 0.06);
    }
  };

  // Thermal & Battery Saver: Suspend Web Audio processing when app is hidden/minimized
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (ctx && ctx.state === 'running') {
          try { ctx.suspend().catch(() => {}); } catch (e) {}
        }
      } else {
        if (ctx && ctx.state === 'suspended' && !muted && (sfxEnabled || ambientEnabled)) {
          try { ctx.resume().catch(() => {}); } catch (e) {}
        }
      }
    });
  }

  return soundObj;
})();

// Global alias for compatibility
if (typeof window !== 'undefined') {
  window.Sound = Sound;
  window.SoundManager = Sound;
  window.AmbientSoundManager = Sound.ambient;
}
