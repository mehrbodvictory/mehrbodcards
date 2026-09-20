/* ============================================================
   JUICE PASS — loaded after main.js. Overrides a handful of ordinary
   function declarations (safe to do, since every caller looks them
   up by name at call time) and adds new systems on top:
     - Pack opening flow (tear + flip reveal)
     - Reworked Meteor Shower (real crashing/exploding rock meteors)
     - Cosmetic reworks (Void Sleeves, Cyber Neon, Abyss, Prism Core)
     - General button ripple polish
     - Daily Login Reward (popup only - no footer tab)
     - A tabs-free Mehrbod Shop with daily-rotating Cosmetics / Card
       Packs (6 fixed sizes) / Individual Cards sections
     - Player Level (infinite XP progression) and Weekly Vault
       (weekly point track), both surfaced inside the Quests panel
   Storm theme is deliberately untouched throughout.
   ============================================================ */

/* ---------- Card Pack Opening (Pokemon / PVZ:GW2-style reveal) ---------- */
function playPackOpeningEffect(cards, onDone) {
  const old = document.querySelector('.packopen-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'packopen-overlay';
  overlay.innerHTML = `
    <div class="packopen-stage">
      <div class="packopen-pack" id="packopen-pack" role="button" tabindex="0" aria-label="Tap to open card pack">
        <div class="packopen-pack-shine"></div>
        <div class="packopen-pack-label">MEHRBOD<br>CARD PACK</div>
        <div class="packopen-tap-hint">Tap to open</div>
      </div>
      <div class="packopen-cards ${cards.length >= 6 ? 'cards-huge' : (cards.length >= 4 ? 'cards-many' : '')}"></div>
      <button type="button" class="primary-btn packopen-continue hidden">Continue</button>
    </div>`;
  document.body.appendChild(overlay);

  const pack = overlay.querySelector('#packopen-pack');
  const cardsRow = overlay.querySelector('.packopen-cards');
  const continueBtn = overlay.querySelector('.packopen-continue');

  const tierClass = (c) => c.kind === 'unit' ? ('tier' + c.tier) : (c.kind === 'spell' ? 'sc-spell' : 'sc-chip');
  const tierName = (c) => c.kind === 'unit' ? (TIERS[c.tier] ? TIERS[c.tier].name : '') : (c.kind === 'spell' ? 'Spell' : 'Chip');

  let opened = false;
  let allFlipped = false;
  const flipTimers = [];

  function tearPack() {
    if (opened) return;
    opened = true;
    Sound.packTear();
    if (typeof Sound !== 'undefined' && Sound.whoosh) Sound.whoosh('in', 0.08);
    pack.classList.add('tearing');
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'packopen-shred';
      p.style.setProperty('--a', (Math.random() * 360) + 'deg');
      p.style.setProperty('--d', (30 + Math.random() * 80) + 'px');
      p.style.animationDelay = (Math.random() * 0.08) + 's';
      pack.appendChild(p);
    }
    if (typeof vibrate === 'function') vibrate([20, 15, 30]);
    setTimeout(() => {
      pack.remove();
      revealCards();
    }, 450);
  }

  function finishRevealInstantly() {
    if (allFlipped) return;
    allFlipped = true;
    flipTimers.forEach(t => clearTimeout(t));
    flipTimers.length = 0;

    const cardElements = cardsRow.querySelectorAll('.packopen-card');
    cardElements.forEach(el => {
      el.classList.add('landed', 'flipped');
    });
    continueBtn.classList.remove('hidden');
    Sound.sparkle();
    if (typeof vibrate === 'function') vibrate(20);
  }

  function revealCards() {
    if (!cards.length) {
      continueBtn.classList.remove('hidden');
      return;
    }
    cards.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = `packopen-card ${tierClass(c)}`;
      el.innerHTML = `
        <div class="packopen-card-inner">
          <div class="packopen-card-back"><span>?</span></div>
          <div class="packopen-card-front">
            <div class="packopen-card-name">${c.name}</div>
            <div class="packopen-card-sub">${tierName(c)}</div>
          </div>
        </div>`;
      cardsRow.appendChild(el);
      
      const landTimer = setTimeout(() => { el.classList.add('landed'); }, 40 * i);
      flipTimers.push(landTimer);

      const flipDelay = 360 + i * 400;
      const flipTimer = setTimeout(() => {
        if (allFlipped) return;
        el.classList.add('flipped');
        if (typeof Sound !== 'undefined') {
          if (c.kind === 'spell') {
            if (Sound.spellChime) Sound.spellChime();
            Sound.packCardFlip();
          } else if (c.kind === 'chip') {
            if (Sound.chipChime) Sound.chipChime();
            Sound.packCardFlip();
          } else {
            if (Sound.tierChime) Sound.tierChime(c.tier || 1);
            if (c.tier === 4) Sound.packRareFlip(); else Sound.packCardFlip();
          }
        }
        if (typeof vibrate === 'function') vibrate(15);
        const burst = document.createElement('div');
        burst.className = 'packopen-burst';
        el.appendChild(burst);
        setTimeout(() => burst.remove(), 700);
      }, flipDelay);
      flipTimers.push(flipTimer);
    });

    const totalDelay = 360 + cards.length * 400 + 200;
    const finalTimer = setTimeout(() => {
      allFlipped = true;
      continueBtn.classList.remove('hidden');
      Sound.sparkle();
    }, totalDelay);
    flipTimers.push(finalTimer);
  }

  pack.addEventListener('click', tearPack);
  pack.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') tearPack(); });

  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.packopen-continue')) {
      overlay.remove();
      if (onDone) onDone();
      return;
    }
    if (!opened) {
      tearPack();
      return;
    }
    if (!allFlipped) {
      finishRevealInstantly();
    }
  });

  continueBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    if (onDone) onDone();
  });
}

/* ---------- Sized card packs (backs the shop's 6 pack sizes) ----------- */
function buyCardPackSized(count, cost, sizeName) {
  if (!spendBux(cost)) { showToast("You don't have enough Mehrbod Bux for that pack."); return; }
  const col = loadCollection();
  const unownedUnits = ALL_NONBLUE_UNIT_IDS.filter(id => !col.units.includes(id));
  const unownedSpells = ALL_SPELL_IDS.filter(id => !col.spells.includes(id));
  const unownedChips = ALL_CHIP_IDS.filter(id => !col.chips.includes(id));
  const pool = shuffleArray(
    unownedUnits.map(id => ({ id, kind: 'unit' }))
      .concat(unownedSpells.map(id => ({ id, kind: 'spell' })))
      .concat(unownedChips.map(id => ({ id, kind: 'chip' })))
  );
  if (pool.length === 0) {
    addBux(cost);
    showToast('🎉 Your collection is already complete! Refunded your Bux.', 2800);
    return;
  }
  const granted = pool.slice(0, count);
  granted.forEach(g => {
    if (g.kind === 'unit') col.units.push(g.id);
    else if (g.kind === 'spell') col.spells.push(g.id);
    else col.chips.push(g.id);
  });
  saveCollection(col);
  updateThemeButtons();
  if (typeof checkMilestones === 'function') checkMilestones();
  else if (typeof checkAchievements === 'function') checkAchievements();
  grantPlayerXP(6 + granted.length * 2, `${sizeName} opened`);
  grantWeeklyPoints(5 + granted.length);

  const cardsForReveal = granted.map(g => {
    if (g.kind === 'unit') {
      const arch = findArchetypeById(g.id);
      return { name: arch.name, tier: arch.tier, kind: 'unit' };
    }
    const def = (g.kind === 'spell' ? SPELL_DEFS : CHIP_DEFS).find(d => d.id === g.id);
    return { name: def.name, tier: null, kind: g.kind };
  });

  playPackOpeningEffect(cardsForReveal, () => {
    const names = cardsForReveal.map(c => c.name);
    showToast(`🎁 ${sizeName} opened: ${names.join(', ')}!`, 3200);
  });
}
// The classic Card Pack (2 cards) some older UI still calls by this name.
function buyCardPack() { buyCardPackSized(2, PACK_COST, 'Card Pack'); }

/* ---------- Meteor Shower rework: real rock meteors that crash into the
   ground and explode, instead of thin light streaks. Longer, denser, and
   paired with a bigger multi-pulse camera shake. ---------- */
function spawnMeteorExplosion(overlay, leftPct) {
  const boom = document.createElement('div');
  boom.className = 'meteor-explosion';
  boom.style.left = Math.min(97, Math.max(1, leftPct)) + '%';
  boom.innerHTML = `<div class="explosion-flash"></div><div class="explosion-shockwave"></div>`;
  for (let i = 0; i < 10; i++) {
    const ember = document.createElement('div');
    ember.className = 'explosion-ember';
    const angle = Math.random() * 360;
    const dist = 26 + Math.random() * 46;
    ember.style.setProperty('--angle', angle + 'deg');
    ember.style.setProperty('--dist', dist + 'px');
    ember.style.animationDelay = (Math.random() * 0.05) + 's';
    boom.appendChild(ember);
  }
  overlay.appendChild(boom);
  if (typeof Sound.meteorBoom === 'function') Sound.meteorBoom();
  setTimeout(() => boom.remove(), 750);
}

function normalizeVictoryEffectId(effectType) {
  const norm = (effectType || '').toLowerCase().trim();
  if (norm.includes('nuke')) return 'victoryanim_nuke';
  if (norm.includes('supernova')) return 'victoryanim_supernova';
  if (norm.includes('phoenix')) return 'victoryanim_phoenix';
  if (norm.includes('orbital') || norm.includes('laser')) return 'victoryanim_orbital';
  if (norm.includes('blackhole') || norm.includes('singularity') || norm.includes('hole')) return 'victoryanim_blackhole';
  if (norm.includes('blizzard') || norm.includes('frost') || norm.includes('subzero')) return 'victoryanim_blizzard';
  if (norm.includes('dragon') || norm.includes('flame')) return 'effect_dragonflame';
  if (norm.includes('lightning') || norm.includes('thunder')) return 'effect_lightning';
  if (norm.includes('cash') || norm.includes('money') || norm.includes('bux')) return 'effect_cashrain';
  if (norm.includes('starfountain') || norm.includes('fountain')) return 'effect_starfountain';
  if (norm.includes('firework')) return 'effect_fireworks';
  if (norm.includes('starburst') || (norm.includes('burst') && !norm.includes('plus'))) return 'effect_victoryburst';
  if (norm.includes('meteor')) return 'victoryanim_meteor';
  if (norm.includes('plus') || norm.includes('effect_confetti')) return 'effect_confetti';
  return 'default_confetti';
}

let _activeVictoryFinisher = null;

function cancelActiveVictoryFinisher() {
  if (_activeVictoryFinisher) {
    try {
      _activeVictoryFinisher.cancel();
    } catch (e) {}
    _activeVictoryFinisher = null;
  }
  const leftovers = document.querySelectorAll('.fullscreen-victory-canvas');
  leftovers.forEach(c => c.remove());
}
if (typeof window !== 'undefined') {
  window.cancelActiveVictoryFinisher = cancelActiveVictoryFinisher;
}

function playVictoryFinisherEffect(effectType = 'default_confetti', onDone) {
  cancelActiveVictoryFinisher();

  const mode = normalizeVictoryEffectId(effectType);

  const canvas = document.createElement('canvas');
  canvas.className = 'fullscreen-victory-canvas';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    if (onDone) onDone();
    return;
  }

  // Optimize resolution for high-DPI screens to maintain high frame rate without fillrate drops
  let w = (canvas.width = Math.min(window.innerWidth || 1280, 1920));
  let h = (canvas.height = Math.min(window.innerHeight || 720, 1080));

  const onResize = () => {
    if (!canvas.parentNode) return;
    w = canvas.width = Math.min(window.innerWidth || 1280, 1920);
    h = canvas.height = Math.min(window.innerHeight || 720, 1080);
  };
  window.addEventListener('resize', onResize);

  let animFrameId = null;
  let isCancelled = false;
  const startTime = performance.now();
  let lastTime = startTime;

  // Custom durations per effect archetype
  let maxDuration = 3000;
  if (mode === 'victoryanim_nuke') maxDuration = 3800;
  else if (mode === 'victoryanim_supernova') maxDuration = 3600;
  else if (mode === 'victoryanim_phoenix') maxDuration = 3400;
  else if (mode === 'effect_fireworks') maxDuration = 3400;
  else if (mode === 'victoryanim_blackhole') maxDuration = 3600;
  else if (mode === 'victoryanim_orbital') maxDuration = 3200;
  else if (mode === 'victoryanim_blizzard') maxDuration = 3400;
  else if (mode === 'effect_cashrain') maxDuration = 3200;
  else if (mode === 'effect_dragonflame') maxDuration = 3300;
  else if (mode === 'effect_lightning') maxDuration = 3000;
  else if (mode === 'effect_starfountain') maxDuration = 3000;
  else if (mode === 'effect_victoryburst') maxDuration = 2400;

  // Audio triggers
  if (typeof Sound !== 'undefined') {
    if (mode === 'victoryanim_nuke') {
      if (Sound.nuclearBlast) Sound.nuclearBlast();
      else if (Sound.meteorBoom) Sound.meteorBoom();
    } else if (mode === 'victoryanim_supernova') {
      if (Sound.supernova) Sound.supernova();
      else if (Sound.epicVictory) Sound.epicVictory();
    } else if (mode === 'victoryanim_phoenix') {
      if (Sound.phoenixRebirth) Sound.phoenixRebirth();
      else if (Sound.epicVictory) Sound.epicVictory();
    } else if (mode === 'victoryanim_orbital') {
      if (Sound.orbitalLaser) Sound.orbitalLaser();
      else if (Sound.meteor) Sound.meteor();
    } else if (mode === 'victoryanim_blackhole') {
      if (Sound.blackHole) Sound.blackHole();
      else if (Sound.meteorBoom) Sound.meteorBoom();
    } else if (mode === 'victoryanim_blizzard') {
      if (Sound.blizzardShatter) Sound.blizzardShatter();
      else if (Sound.sparkle) Sound.sparkle();
    } else if (mode === 'effect_dragonflame') {
      if (Sound.dragonFlame) Sound.dragonFlame();
      else if (Sound.meteor) Sound.meteor();
    } else if (mode === 'effect_lightning') {
      if (Sound.thunderStorm) Sound.thunderStorm();
      else if (Sound.chainLightningCrack) Sound.chainLightningCrack();
    } else if (mode === 'effect_cashrain') {
      if (Sound.cashRain) Sound.cashRain();
      else if (Sound.coin) Sound.coin();
    } else if (mode === 'effect_starfountain') {
      if (Sound.starFountain) Sound.starFountain();
      else if (Sound.sparkle) Sound.sparkle();
    } else if (mode === 'effect_fireworks') {
      if (Sound.fireworks) Sound.fireworks();
      else if (Sound.sparkle) Sound.sparkle();
    } else if (mode === 'effect_victoryburst') {
      if (Sound.starburst) Sound.starburst();
      else if (Sound.sparkle) Sound.sparkle();
    } else if (mode === 'victoryanim_meteor') {
      if (Sound.meteor) Sound.meteor();
      if (Sound.meteorBoom) {
        setTimeout(() => Sound.meteorBoom(), 600);
        setTimeout(() => Sound.meteorBoom(), 1400);
      }
    } else if (mode === 'effect_confetti') {
      if (Sound.confettiPlus) Sound.confettiPlus();
      else if (Sound.win) Sound.win();
    } else {
      if (Sound.win) Sound.win();
    }
  }

  // Haptic feedback
  if (typeof vibrate === 'function') {
    if (mode === 'victoryanim_nuke' || mode === 'victoryanim_orbital' || mode === 'victoryanim_supernova') {
      vibrate([50, 40, 70, 50, 120, 80, 200]);
    } else if (mode === 'effect_lightning' || mode === 'victoryanim_meteor' || mode === 'effect_dragonflame') {
      vibrate([60, 40, 60, 40, 90, 50, 100]);
    } else if (mode === 'victoryanim_blizzard' || mode === 'effect_fireworks' || mode === 'victoryanim_phoenix') {
      vibrate([40, 50, 60, 50, 80]);
    } else {
      vibrate([40, 40, 60]);
    }
  }

  // Thermal / Battery Saver & Reduced Motion check
  const isBatterySaving = (typeof window !== 'undefined' && typeof window.isBatterySaverActive === 'function')
    ? window.isBatterySaverActive()
    : (typeof document !== 'undefined' && document.documentElement.classList.contains('battery-saver'));
  const isLowPower = reducedMotion || isBatterySaving;

  // Screen shake
  if (!isLowPower) {
    const screenEl = document.getElementById('screen-game') || document.getElementById('screen-collection') || document.body;
    if (screenEl) {
      const isHeavy = ['victoryanim_nuke', 'victoryanim_supernova', 'victoryanim_orbital', 'victoryanim_meteor', 'effect_lightning', 'effect_dragonflame'].includes(mode);
      screenEl.classList.add(isHeavy ? 'screen-shake-big' : 'shake-light');
      setTimeout(() => {
        screenEl.classList.remove('screen-shake-big');
        screenEl.classList.remove('shake-light');
      }, isHeavy ? 1000 : 450);
    }
  }

  // ---- Particle System Initialization ---------------------------------------
  const particles = [];
  const secondary = [];
  const shockwaves = [];
  const meteors = [];
  const tertiary = {
    lightningStrikes: [],
    flashAlpha: 0,
    nextStrike: 0,
    laserPhase: 0,
    reticleRot: 0,
    shattered: false,
    shards: [],
    fireball: [],
    phoenixY: h + 40,
    phoenixWingAngle: 0,
    feathers: []
  };

  if (mode === 'default_confetti') {
    const count = isLowPower ? 30 : 75;
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#facc15', '#a855f7', '#ec4899', '#38bdf8', '#fb923c'];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: w * 0.15 + Math.random() * (w * 0.7),
        y: -15 - Math.random() * (h * 0.4),
        vx: (Math.random() - 0.5) * 3.5,
        vy: 2.2 + Math.random() * 3.2,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 6,
        color: colors[i % colors.length],
        w: 7 + Math.random() * 7,
        h: 10 + Math.random() * 8,
        shape: Math.random() > 0.3 ? 'rect' : 'circle',
        phase: Math.random() * Math.PI * 2
      });
    }
  } else if (mode === 'effect_confetti') {
    const cannonCount = isLowPower ? 35 : 95;
    const colors = ['#f59e0b', '#fbbf24', '#f43f5e', '#a855f7', '#06b6d4', '#10b981', '#ffffff', '#ec4899'];
    for (let i = 0; i < cannonCount; i++) {
      const fromLeft = i % 2 === 0;
      const angle = fromLeft ? -Math.PI / 4 - (Math.random() * 0.28) : -3 * Math.PI / 4 + (Math.random() * 0.28);
      const speed = 11 + Math.random() * 14;
      particles.push({
        x: fromLeft ? 0 : w,
        y: h * 0.95,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.28,
        drag: 0.985,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 10,
        color: colors[i % colors.length],
        isRibbon: i % 3 === 0,
        size: 5 + Math.random() * 6,
        life: 0,
        maxLife: 160 + Math.random() * 50
      });
    }
  } else if (mode === 'effect_victoryburst') {
    for (let r = 0; r < 3; r++) {
      shockwaves.push({
        x: w / 2,
        y: h / 2,
        radius: 4,
        maxRadius: Math.min(w, h) * (0.4 + r * 0.15),
        speed: 4.5 + r * 2.5,
        alpha: 1,
        color: r % 2 === 0 ? '#fbbf24' : '#f59e0b',
        delay: r * 16,
        life: 0
      });
    }
    const sparkCount = isLowPower ? 30 : 70;
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 8.5;
      particles.push({
        x: w / 2,
        y: h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 55 + Math.random() * 45,
        color: ['#fef08a', '#fde047', '#facc15', '#fbbf24', '#f59e0b', '#ffffff'][i % 6],
        size: 2.5 + Math.random() * 4.5,
        decay: 0.975
      });
    }
  } else if (mode === 'victoryanim_meteor') {
    const meteorCount = isLowPower ? 5 : 14;
    for (let i = 0; i < meteorCount; i++) {
      const startX = Math.random() * (w * 0.9) - (w * 0.05);
      const startY = -40 - Math.random() * (h * 0.5);
      const speed = 12 + Math.random() * 7;
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.18;
      meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4 + Math.random() * 3,
        trail: [],
        color: Math.random() > 0.3 ? '#ff5500' : '#ffaa00',
        hasExploded: false,
        spawnDelay: i * 110
      });
    }
  } else if (mode === 'victoryanim_supernova') {
    const starCount = isLowPower ? 20 : 65;
    for (let i = 0; i < starCount; i++) {
      secondary.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: 0.8 + Math.random() * 1.6,
        alpha: 0.3 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    const debrisCount = isLowPower ? 30 : 80;
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount;
      const speed = 2.5 + Math.random() * 7.5;
      particles.push({
        x: w / 2,
        y: h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 8,
        color: ['#c084fc', '#e879f9', '#38bdf8', '#818cf8', '#ffffff', '#fb7185'][i % 6],
        size: 2.5 + Math.random() * 4.5,
        life: 0,
        maxLife: 80 + Math.random() * 40
      });
    }
  } else if (mode === 'effect_fireworks') {
    const shellCount = isLowPower ? 3 : 5;
    const shellColors = [
      ['#ef4444', '#f87171', '#fca5a5', '#ffffff'],
      ['#10b981', '#34d399', '#6ee7b7', '#fef08a'],
      ['#06b6d4', '#38bdf8', '#93c5fd', '#ffffff'],
      ['#a855f7', '#c084fc', '#e879f9', '#fde047'],
      ['#f59e0b', '#fbbf24', '#fde047', '#ffffff']
    ];
    for (let s = 0; s < shellCount; s++) {
      secondary.push({
        targetX: w * (0.2 + (s * 0.15) + (Math.random() - 0.5) * 0.08),
        targetY: h * (0.22 + Math.random() * 0.22),
        currentX: w * (0.2 + (s * 0.15)),
        currentY: h + 20,
        speedY: -(11 + Math.random() * 3.5),
        exploded: false,
        colors: shellColors[s % shellColors.length],
        launchDelay: s * 22,
        trail: []
      });
    }
  } else if (mode === 'effect_cashrain') {
    const billCount = isLowPower ? 12 : 28;
    for (let i = 0; i < billCount; i++) {
      particles.push({
        type: 'bill',
        x: Math.random() * w,
        y: -30 - Math.random() * (h * 0.7),
        vx: (Math.random() - 0.5) * 1.8,
        vy: 2.0 + Math.random() * 2.5,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 3.5,
        phase: Math.random() * Math.PI * 2,
        w: 22 + Math.random() * 6,
        h: 12 + Math.random() * 4
      });
    }
    const coinCount = isLowPower ? 14 : 34;
    for (let i = 0; i < coinCount; i++) {
      secondary.push({
        type: 'coin',
        x: Math.random() * w,
        y: -20 - Math.random() * (h * 0.6),
        vx: (Math.random() - 0.5) * 2.5,
        vy: 4.0 + Math.random() * 4.5,
        radius: 6 + Math.random() * 3.5,
        rotX: Math.random() * Math.PI,
        vrotX: 0.08 + Math.random() * 0.1,
        bounces: 0,
        maxBounces: 3
      });
    }
  } else if (mode === 'effect_dragonflame') {
    const emberCount = isLowPower ? 28 : 75;
    for (let i = 0; i < emberCount; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * (w * 0.7),
        y: h * 0.7 + Math.random() * (h * 0.3),
        vx: (Math.random() - 0.5) * 3,
        vy: -(3.0 + Math.random() * 5.0),
        radius: 2.5 + Math.random() * 4.5,
        life: 0,
        maxLife: 40 + Math.random() * 35,
        color: ['#ff2200', '#ff5500', '#ff9900', '#ffcc00', '#ffffff'][i % 5],
        spiralArm: i % 2 === 0 ? 1 : -1,
        angle: Math.random() * Math.PI * 2
      });
    }
  } else if (mode === 'victoryanim_blackhole') {
    const suckCount = isLowPower ? 28 : 85;
    for (let i = 0; i < suckCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(w, h) * (0.32 + Math.random() * 0.42);
      particles.push({
        angle,
        dist,
        speed: 1.2 + Math.random() * 2.4,
        angularSpeed: 0.02 + Math.random() * 0.025,
        size: 1.5 + Math.random() * 2.5,
        color: ['#a855f7', '#c084fc', '#38bdf8', '#06b6d4', '#ffffff', '#e879f9'][i % 6]
      });
    }
  } else if (mode === 'victoryanim_blizzard') {
    const snowCount = isLowPower ? 30 : 90;
    for (let i = 0; i < snowCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: -(2.5 + Math.random() * 4.5),
        vy: 1.8 + Math.random() * 3.5,
        radius: 1.5 + Math.random() * 2.8,
        alpha: 0.35 + Math.random() * 0.55
      });
    }
  } else if (mode === 'victoryanim_nuke') {
    for (let i = 0; i < 45; i++) {
      tertiary.fireball.push({
        x: w / 2 + (Math.random() - 0.5) * 25,
        y: h * 0.85,
        vx: (Math.random() - 0.5) * 5,
        vy: -(2 + Math.random() * 6),
        radius: 12 + Math.random() * 18,
        life: 0,
        maxLife: 50 + Math.random() * 40,
        color: ['#ff1100', '#ff4400', '#ff8800', '#ffbb00', '#331100'][i % 5]
      });
    }
  }

  // ---- Main Rendering Animation Loop (Hardware Accelerated & Zero-Lag) ------
  function frame(timestamp) {
    if (isCancelled) return;
    const elapsed = timestamp - startTime;
    const dt = Math.min(2.0, (timestamp - lastTime) / 16.667) || 1.0;
    lastTime = timestamp;
    const progress = Math.min(1, elapsed / maxDuration);

    ctx.clearRect(0, 0, w, h);

    // ---- 1. DEFAULT CONFETTI ----
    if (mode === 'default_confetti') {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += (p.vx + Math.sin(p.phase + elapsed * 0.003) * 0.8) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

    // ---- 2. CONFETTI+ CELEBRATION ----
    } else if (mode === 'effect_confetti') {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += dt;
        p.vy += p.gravity * dt;
        p.vx *= Math.pow(p.drag, dt);
        p.vy *= Math.pow(p.drag, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);

        if (p.isRibbon) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-12, Math.sin(p.life * 0.1) * 7);
          ctx.quadraticCurveTo(0, Math.cos(p.life * 0.1) * 10, 12, -Math.sin(p.life * 0.1) * 7);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
        }
        ctx.restore();
      }

    // ---- 3. VICTORY STARBURST ----
    } else if (mode === 'effect_victoryburst') {
      const coreSize = Math.max(0, 1 - progress) * (Math.min(w, h) * 0.16);
      if (coreSize > 0) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(elapsed * 0.0015);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
        for (let s = 0; s < 8; s++) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(0, -coreSize * 2.0);
          ctx.lineTo(coreSize * 0.22, 0);
          ctx.lineTo(0, coreSize * 2.0);
          ctx.lineTo(-coreSize * 0.22, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      for (let i = 0; i < shockwaves.length; i++) {
        const sw = shockwaves[i];
        if (elapsed > sw.delay * 16) {
          sw.radius += sw.speed * dt;
          sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
          if (sw.alpha > 0) {
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = 3.0 * sw.alpha;
            ctx.globalAlpha = sw.alpha;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(p.decay, dt);
        p.vy *= Math.pow(p.decay, dt);
        p.life += dt;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

    // ---- 4. METEOR SHOWER VICTORY ----
    } else if (mode === 'victoryanim_meteor') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < meteors.length; i++) {
        const m = meteors[i];
        if (elapsed < m.spawnDelay) continue;
        m.trail.push({ x: m.x, y: m.y });
        if (m.trail.length > 8) m.trail.shift();
        m.x += m.vx * dt;
        m.y += m.vy * dt;

        for (let t = 0; t < m.trail.length; t++) {
          const pt = m.trail[t];
          const alpha = (t / m.trail.length) * 0.75;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, m.radius * (alpha * 1.3), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 90, 0, ${alpha * 0.75})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff7ed';
        ctx.fill();

        if (m.y >= h * 0.88 && !m.hasExploded) {
          m.hasExploded = true;
          shockwaves.push({
            x: m.x,
            y: Math.min(m.y, h - 10),
            radius: 2,
            maxRadius: 40,
            speed: 3.5,
            alpha: 1,
            color: '#f97316'
          });
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      for (let idx = shockwaves.length - 1; idx >= 0; idx--) {
        const sw = shockwaves[idx];
        sw.radius += sw.speed * dt;
        sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
        if (sw.alpha > 0) {
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = 2.5 * sw.alpha;
          ctx.globalAlpha = sw.alpha;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (sw.radius >= sw.maxRadius) shockwaves.splice(idx, 1);
      }

    // ---- 5. COSMIC SUPERNOVA ----
    } else if (mode === 'victoryanim_supernova') {
      for (let i = 0; i < secondary.length; i++) {
        const st = secondary[i];
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${st.alpha * (0.6 + 0.4 * Math.sin(elapsed * 0.005 + st.twinkle))})`;
        ctx.fill();
      }

      const explodeTime = 600;
      if (elapsed < explodeTime) {
        const comp = 1 - (elapsed / explodeTime);
        const radius = 25 + comp * 45 + Math.sin(elapsed * 0.05) * 8;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#c084fc');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
      } else {
        const postElapsed = elapsed - explodeTime;
        const blastRadius = postElapsed * 0.85;
        const blastAlpha = Math.max(0, 1 - postElapsed / (maxDuration - explodeTime));

        if (blastAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = blastAlpha * 0.75;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, blastRadius, 0, Math.PI * 2);
          const nebGrad = ctx.createRadialGradient(w / 2, h / 2, blastRadius * 0.7, w / 2, h / 2, blastRadius);
          nebGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
          nebGrad.addColorStop(0.5, 'rgba(232, 121, 249, 0.35)');
          nebGrad.addColorStop(1, 'rgba(56, 189, 248, 0.75)');
          ctx.fillStyle = nebGrad;
          ctx.fill();
          ctx.restore();
        }

        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life += dt;
          const alpha = Math.max(0, 1 - p.life / p.maxLife);
          if (alpha > 0) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

    // ---- 6. FIREWORKS SPECTACULAR ----
    } else if (mode === 'effect_fireworks') {
      for (let s = 0; s < secondary.length; s++) {
        const shell = secondary[s];
        if (elapsed < shell.launchDelay * 16) continue;
        if (!shell.exploded) {
          shell.currentY += shell.speedY * dt;
          shell.trail.push({ x: shell.currentX, y: shell.currentY });
          if (shell.trail.length > 5) shell.trail.shift();

          for (let t = 0; t < shell.trail.length; t++) {
            const pt = shell.trail[t];
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2 * (t / shell.trail.length), 0, Math.PI * 2);
            ctx.fillStyle = '#fef08a';
            ctx.fill();
          }

          if (shell.currentY <= shell.targetY) {
            shell.exploded = true;
            for (let i = 0; i < 45; i++) {
              const angle = Math.random() * Math.PI * 2;
              const spd = 2 + Math.random() * 6.5;
              particles.push({
                x: shell.currentX,
                y: shell.currentY,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                color: shell.colors[i % shell.colors.length],
                life: 0,
                maxLife: 50 + Math.random() * 25,
                size: 2.2 + Math.random() * 2.2
              });
            }
          }
        }
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.07 * dt;
        p.vx *= Math.pow(0.98, dt);
        p.vy *= Math.pow(0.98, dt);
        p.life += dt;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

    // ---- 7. BUX CASH RAIN ----
    } else if (mode === 'effect_cashrain') {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(p.phase + elapsed * 0.003) * 1.1) * dt;
        p.rot += p.vrot * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = '#166534';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-p.w / 2 + 1, -p.h / 2 + 1, p.w - 2, p.h - 2);
        ctx.fillStyle = '#dcfce7';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$ BUX', 0, 0);
        ctx.restore();
      }

      for (let i = 0; i < secondary.length; i++) {
        const c = secondary[i];
        c.y += c.vy * dt;
        c.x += c.vx * dt;
        c.vy += 0.25 * dt;
        c.rotX += c.vrotX * dt;

        if (c.y >= h * 0.92 && c.bounces < c.maxBounces) {
          c.y = h * 0.92;
          c.vy = -c.vy * 0.6;
          c.bounces++;
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(1, Math.cos(c.rotX));
        ctx.beginPath();
        ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#713f12';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪙', 0, 0);
        ctx.restore();
      }

    // ---- 8. THUNDER SHOCKWAVE ----
    } else if (mode === 'effect_lightning') {
      if (elapsed > tertiary.nextStrike) {
        tertiary.nextStrike = elapsed + 380 + Math.random() * 500;
        tertiary.flashAlpha = 0.75;

        const strikeStartX = w * (0.15 + Math.random() * 0.7);
        const strikeTargetX = strikeStartX + (Math.random() - 0.5) * 140;
        const points = [{ x: strikeStartX, y: 0 }];
        let curX = strikeStartX;
        let curY = 0;
        while (curY < h * 0.9) {
          curY += 25 + Math.random() * 35;
          curX += (Math.random() - 0.5) * 50;
          points.push({ x: curX, y: curY });
        }
        points.push({ x: strikeTargetX, y: h * 0.92 });
        tertiary.lightningStrikes.push({ points, life: 0, maxLife: 12 });

        shockwaves.push({
          x: strikeTargetX,
          y: h * 0.92,
          radius: 4,
          maxRadius: 70,
          speed: 6.5,
          alpha: 1,
          color: '#38bdf8'
        });
      }

      if (tertiary.flashAlpha > 0) {
        ctx.fillStyle = `rgba(186, 230, 253, ${tertiary.flashAlpha * 0.3})`;
        ctx.fillRect(0, 0, w, h);
        tertiary.flashAlpha = Math.max(0, tertiary.flashAlpha - 0.08 * dt);
      }

      for (let sIdx = tertiary.lightningStrikes.length - 1; sIdx >= 0; sIdx--) {
        const stk = tertiary.lightningStrikes[sIdx];
        stk.life += dt;
        const alpha = Math.max(0, 1 - stk.life / stk.maxLife);
        if (alpha > 0) {
          ctx.save();
          ctx.beginPath();
          for (let p = 0; p < stk.points.length; p++) {
            const pt = stk.points[p];
            if (p === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 6 * alpha;
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5 * alpha;
          ctx.stroke();
          ctx.restore();
        }
        if (stk.life >= stk.maxLife) tertiary.lightningStrikes.splice(sIdx, 1);
      }

      for (let idx = shockwaves.length - 1; idx >= 0; idx--) {
        const sw = shockwaves[idx];
        sw.radius += sw.speed * dt;
        sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
        if (sw.alpha > 0) {
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = 2.5 * sw.alpha;
          ctx.globalAlpha = sw.alpha;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (sw.radius >= sw.maxRadius) shockwaves.splice(idx, 1);
      }

    // ---- 9. GOLDEN STAR FOUNTAIN ----
    } else if (mode === 'effect_starfountain') {
      if (progress < 0.72) {
        for (let k = 0; k < 2; k++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.85;
          const spd = 11 + Math.random() * 8.5;
          particles.push({
            x: w / 2 + (Math.random() - 0.5) * 18,
            y: h,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            gravity: 0.3,
            rot: Math.random() * 360,
            vrot: (Math.random() - 0.5) * 10,
            size: 3.5 + Math.random() * 5.5,
            color: ['#fef08a', '#facc15', '#f59e0b', '#fbbf24', '#ffffff'][Math.floor(Math.random() * 5)],
            life: 0,
            maxLife: 90 + Math.random() * 35
          });
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          ctx.lineTo(Math.cos((18 + s * 72) * Math.PI / 180) * p.size, -Math.sin((18 + s * 72) * Math.PI / 180) * p.size);
          ctx.lineTo(Math.cos((54 + s * 72) * Math.PI / 180) * (p.size * 0.45), -Math.sin((54 + s * 72) * Math.PI / 180) * (p.size * 0.45));
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

    // ---- 10. DRAGON FLAME AURA ----
    } else if (mode === 'effect_dragonflame') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += dt;
        p.angle += 0.04 * p.spiralArm * dt;
        const radius = (1 - p.life / p.maxLife) * (w * 0.38);
        p.x = w / 2 + Math.cos(p.angle) * radius;
        p.y += p.vy * dt;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }

        if (p.life >= p.maxLife) {
          p.life = 0;
          p.y = h * 0.7 + Math.random() * (h * 0.28);
          p.angle = Math.random() * Math.PI * 2;
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(w / 2, h * 0.45);
      const auraScale = 1 + Math.sin(elapsed * 0.006) * 0.08;
      ctx.scale(auraScale, auraScale);
      ctx.fillStyle = 'rgba(255, 68, 0, 0.25)';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐉', 0, 0);
      ctx.restore();

    // ---- 11. SINGULARITY BLACK HOLE ----
    } else if (mode === 'victoryanim_blackhole') {
      const centerX = w / 2;
      const centerY = h / 2;

      ctx.strokeStyle = 'rgba(168, 85, 247, 0.12)';
      ctx.lineWidth = 1;
      for (let r = 20; r < Math.min(w, h) * 0.55; r += 35) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.angularSpeed * dt;
        p.dist -= p.speed * dt;
        if (p.dist <= 15) p.dist = Math.min(w, h) * (0.32 + Math.random() * 0.42);
        const px = centerX + Math.cos(p.angle) * p.dist;
        const py = centerY + Math.sin(p.angle) * (p.dist * 0.65);

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(elapsed * 0.003);
      const diskGrad = ctx.createRadialGradient(0, 0, 18, 0, 0, 90);
      diskGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      diskGrad.addColorStop(0.3, 'rgba(192, 132, 252, 0.85)');
      diskGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.55)');
      diskGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 95, 50, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#05070f';
      ctx.fill();

    // ---- 12. ORBITAL LASER STRIKE ----
    } else if (mode === 'victoryanim_orbital') {
      const centerX = w / 2;
      const centerY = h / 2;

      if (elapsed < 850) {
        tertiary.reticleRot += 0.03 * dt;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(tertiary.reticleRot);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(0, 0, 55, 0, Math.PI * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 55, Math.PI * 0.5, Math.PI * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 55, Math.PI, Math.PI * 1.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 55, Math.PI * 1.5, Math.PI * 1.9);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TARGET LOCKED', 0, -75);
        ctx.restore();
      } else {
        const blastElapsed = elapsed - 850;
        const beamAlpha = Math.max(0, 1 - blastElapsed / 2200);
        const beamW = Math.min(w * 0.2, 110 * (1 - blastElapsed / 2200));

        if (beamW > 0) {
          ctx.save();
          const beamGrad = ctx.createLinearGradient(centerX - beamW, 0, centerX + beamW, 0);
          beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
          beamGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
          beamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
          beamGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.8)');
          beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

          ctx.fillStyle = beamGrad;
          ctx.fillRect(centerX - beamW, 0, beamW * 2, h);
          ctx.restore();

          ctx.beginPath();
          ctx.ellipse(centerX, h * 0.85, blastElapsed * 0.65, blastElapsed * 0.22, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${beamAlpha * 0.5})`;
          ctx.fill();
        }
      }

    // ---- 13. SUBZERO FROST SHATTER ----
    } else if (mode === 'victoryanim_blizzard') {
      for (let i = 0; i < particles.length; i++) {
        const s = particles[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x < 0) s.x = w;
        if (s.y > h) s.y = 0;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 242, 254, ${s.alpha})`;
        ctx.fill();
      }

      const shatterTime = 900;
      if (elapsed < shatterTime) {
        const frostProgress = elapsed / shatterTime;
        ctx.save();
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.8)';
        ctx.lineWidth = 2.5;
        const corners = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h }];
        for (let c = 0; c < corners.length; c++) {
          const corner = corners[c];
          ctx.beginPath();
          ctx.moveTo(corner.x, corner.y);
          ctx.lineTo(corner.x + (w * 0.22 * frostProgress) * (corner.x === 0 ? 1 : -1), corner.y + (h * 0.22 * frostProgress) * (corner.y === 0 ? 1 : -1));
          ctx.stroke();
        }
        ctx.restore();
      } else {
        if (!tertiary.shattered) {
          tertiary.shattered = true;
          for (let k = 0; k < 45; k++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 3 + Math.random() * 10;
            tertiary.shards.push({
              x: w / 2 + (Math.random() - 0.5) * (w * 0.35),
              y: h / 2 + (Math.random() - 0.5) * (h * 0.35),
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              rot: Math.random() * 360,
              vrot: (Math.random() - 0.5) * 14,
              size: 5 + Math.random() * 10,
              life: 0,
              maxLife: 75
            });
          }
        }

        for (let s = 0; s < tertiary.shards.length; s++) {
          const sh = tertiary.shards[s];
          sh.life += dt;
          sh.x += sh.vx * dt;
          sh.y += sh.vy * dt;
          sh.vy += 0.2 * dt;
          sh.rot += sh.vrot * dt;
          const alpha = Math.max(0, 1 - sh.life / sh.maxLife);
          if (alpha > 0) {
            ctx.save();
            ctx.translate(sh.x, sh.y);
            ctx.rotate((sh.rot * Math.PI) / 180);
            ctx.fillStyle = `rgba(224, 242, 254, ${alpha * 0.85})`;
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-sh.size, -sh.size / 2);
            ctx.lineTo(sh.size, -sh.size);
            ctx.lineTo(sh.size / 2, sh.size);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }
      }

    // ---- 14. TACTICAL NUKE BLAST ----
    } else if (mode === 'victoryanim_nuke') {
      const flashStart = 550;
      const mushroomStart = 1000;

      if (elapsed < flashStart) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('☢️ TACTICAL NUKE INCOMING ☢️', w / 2, h * 0.35);
      } else if (elapsed < mushroomStart) {
        const flashAlpha = 1 - (elapsed - flashStart) / (mushroomStart - flashStart);
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.95})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        const nukeElapsed = elapsed - mushroomStart;
        const stemHeight = Math.min(h * 0.55, nukeElapsed * 0.35);

        ctx.save();
        const stemGrad = ctx.createLinearGradient(w / 2 - 25, h, w / 2 + 25, h);
        stemGrad.addColorStop(0, '#7f1d1d');
        stemGrad.addColorStop(0.5, '#f97316');
        stemGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = stemGrad;
        ctx.fillRect(w / 2 - 20, h - stemHeight, 40, stemHeight);

        ctx.beginPath();
        ctx.ellipse(w / 2, h - stemHeight, 100 + nukeElapsed * 0.05, 60 + nukeElapsed * 0.03, 0, 0, Math.PI * 2);
        const capGrad = ctx.createRadialGradient(w / 2, h - stemHeight, 10, w / 2, h - stemHeight, 100);
        capGrad.addColorStop(0, '#fef08a');
        capGrad.addColorStop(0.4, '#ea580c');
        capGrad.addColorStop(1, 'rgba(67, 20, 7, 0.8)');
        ctx.fillStyle = capGrad;
        ctx.fill();
        ctx.restore();

        const waveRadius = nukeElapsed * 0.7;
        const waveAlpha = Math.max(0, 1 - nukeElapsed / 2600);
        if (waveAlpha > 0) {
          ctx.beginPath();
          ctx.ellipse(w / 2, h * 0.95, waveRadius, waveRadius * 0.25, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(249, 115, 22, ${waveAlpha})`;
          ctx.lineWidth = 5;
          ctx.stroke();
        }
      }

    // ---- 15. PHOENIX REBIRTH FINISHER ----
    } else if (mode === 'victoryanim_phoenix') {
      tertiary.phoenixY = Math.max(h * 0.22, h + 40 - (elapsed * 0.26));
      tertiary.phoenixWingAngle += 0.08 * dt;

      if (progress < 0.82) {
        tertiary.feathers.push({
          x: w / 2 + (Math.random() - 0.5) * 70,
          y: tertiary.phoenixY + 25,
          vx: (Math.random() - 0.5) * 1.8,
          vy: 1.5 + Math.random() * 2.2,
          rot: Math.random() * 360,
          vrot: (Math.random() - 0.5) * 5,
          life: 0,
          maxLife: 80
        });
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < tertiary.feathers.length; i++) {
        const f = tertiary.feathers[i];
        f.life += dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.vrot * dt;
        const alpha = Math.max(0, 1 - f.life / f.maxLife);
        if (alpha > 0) {
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate((f.rot * Math.PI) / 180);
          ctx.fillStyle = '#facc15';
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.ellipse(0, 0, 3.5, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(w / 2, tertiary.phoenixY);
      const wingFlap = Math.sin(tertiary.phoenixWingAngle) * 18;

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-65, -35 + wingFlap, -110, -8 + wingFlap);
      ctx.quadraticCurveTo(-55, 18 + wingFlap, 0, 10);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.quadraticCurveTo(65, -35 + wingFlap, 110, -8 + wingFlap);
      ctx.quadraticCurveTo(55, 18 + wingFlap, 0, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -22, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (elapsed < maxDuration) {
      animFrameId = requestAnimationFrame(frame);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    if (isCancelled) return;
    isCancelled = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', onResize);
    canvas.style.transition = 'opacity 0.3s ease-out';
    canvas.style.opacity = '0';
    setTimeout(() => {
      canvas.remove();
      if (_activeVictoryFinisher && _activeVictoryFinisher.canvas === canvas) {
        _activeVictoryFinisher = null;
      }
      if (onDone) onDone();
    }, 320);
  }

  _activeVictoryFinisher = {
    canvas,
    cancel: () => {
      isCancelled = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', onResize);
      canvas.remove();
    }
  };

  animFrameId = requestAnimationFrame(frame);
}

function playMeteorShowerEffect(onDone) {
  playVictoryFinisherEffect('meteor', onDone);
}

/* ---------- General juice: a tactile ripple on presses across the app --- */
document.addEventListener('pointerdown', (e) => {
  const target = e.target.closest('.primary-btn, .menu-card, .diff-card, .mode-btn, .icon-btn, .modern-shop-buy, .theme-btn, .link-btn');
  if (!target) return;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ripple = document.createElement('span');
  ripple.className = 'juice-ripple';
  const size = Math.max(rect.width, rect.height) * 1.3;
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  const computed = getComputedStyle(target);
  if (computed.position === 'static') target.style.position = 'relative';
  if (computed.overflow === 'visible') target.style.overflow = 'hidden';
  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 620);
});

/* ============================================================
   Seeded daily rotation helper - shared by the Daily Login modal (via
   `todayKey`, already in main.js) and the shop's daily item selection.
   ============================================================ */
function dayIndexSeed() { return Math.floor(Date.now() / 86400000); }
function seededShuffleCopy(arr, seed) {
  let s = (seed >>> 0) || 1;
  const rand = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function seededPick(arr, seed, count) { return seededShuffleCopy(arr, seed).slice(0, count); }

/* ============================================================
   NEW PROGRESSION SYSTEM: Daily Login Rewards
   A classic "come back tomorrow" retention loop, separate from the
   existing Daily Challenge (which requires actually finishing a
   match). Just opening the app on a new calendar day is enough to
   claim that day's reward. Rewards escalate across a 7-day cycle and
   loop back to Day 1 after Day 7's bonus - missing a day resets the
   cycle to Day 1 (the all-time best streak is kept for bragging
   rights). Deliberately popup-only, with no menu-footer tab - it
   surfaces automatically once a day instead of needing a dedicated
   button to find it.
   ============================================================ */
const DAILY_LOGIN_KEY = 'mehrbod_daily_login_v1';
const DAILY_LOGIN_REWARDS = [10, 15, 20, 30, 40, 60, 100]; // Day 1..7, Day 7 is the big bonus

function loadDailyLoginState() {
  try {
    const s = JSON.parse(localStorage.getItem(DAILY_LOGIN_KEY) || 'null');
    if (s && typeof s === 'object') return s;
  } catch (e) {}
  return { lastClaimDate: null, cycleDay: 0, streakCount: 0, bestStreak: 0 };
}
function saveDailyLoginState(s) {
  try { localStorage.setItem(DAILY_LOGIN_KEY, JSON.stringify(s)); } catch (e) {}
}
function _dailyLoginYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function isDailyLoginClaimedToday() {
  return loadDailyLoginState().lastClaimDate === todayKey();
}
function pendingDailyLoginCycleDay() {
  const s = loadDailyLoginState();
  if (s.lastClaimDate === todayKey()) return s.cycleDay || 1;
  if (s.lastClaimDate === _dailyLoginYesterdayKey()) return (s.cycleDay % 7) + 1;
  return 1;
}
function claimDailyLogin() {
  if (isDailyLoginClaimedToday()) return null;
  const s = loadDailyLoginState();
  const nextDay = pendingDailyLoginCycleDay();
  const continuing = s.lastClaimDate === _dailyLoginYesterdayKey();
  const newStreak = continuing ? (s.streakCount || 0) + 1 : 1;
  const reward = DAILY_LOGIN_REWARDS[nextDay - 1];
  s.lastClaimDate = todayKey();
  s.cycleDay = nextDay;
  s.streakCount = newStreak;
  s.bestStreak = Math.max(s.bestStreak || 0, newStreak);
  saveDailyLoginState(s);
  addBux(reward);
  recordEconomyChange(reward, `Daily login reward (Day ${nextDay})`);
  recordRecentActivity(`Claimed Day ${nextDay} login reward — +${reward} Bux`);
  grantPlayerXP(8 + nextDay * 2, 'Daily login');
  grantWeeklyPoints(5);
  return { day: nextDay, reward, streak: newStreak };
}

function renderDailyLoginModal() {
  const old = document.getElementById('daily-login-overlay');
  if (old) old.remove();

  const s = loadDailyLoginState();
  const claimedToday = isDailyLoginClaimedToday();
  const highlightDay = pendingDailyLoginCycleDay();

  const daysHtml = DAILY_LOGIN_REWARDS.map((amt, i) => {
    const dayNum = i + 1;
    const done = dayNum < highlightDay || (dayNum === highlightDay && claimedToday);
    const isToday = dayNum === highlightDay && !claimedToday;
    return `<div class="dailylogin-day ${done ? 'done' : ''} ${isToday ? 'today' : ''} ${dayNum === 7 ? 'bonus' : ''}">
      <div class="dailylogin-day-label">Day ${dayNum}</div>
      <div class="dailylogin-day-icon">${done ? '✅' : (dayNum === 7 ? '🎁' : '💰')}</div>
      <div class="dailylogin-day-amt">${amt}</div>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'daily-login-overlay';
  overlay.className = 'feature-overlay';
  overlay.innerHTML = `
    <div class="feature-panel dailylogin-panel">
      <button class="feature-close">✕</button>
      <span class="feature-kicker">COME BACK TOMORROW TOO</span>
      <h2>🎁 Daily Login Reward</h2>
      <p>Open Mehrbod Cards every day for a bigger streak bonus. Miss a day and the streak resets to Day 1 — your best streak is still remembered.</p>
      <div class="dailylogin-strip">${daysHtml}</div>
      <div class="dailylogin-streak-note">🔥 Current streak: ${s.streakCount || 0} day${(s.streakCount || 0) === 1 ? '' : 's'} · Best: ${s.bestStreak || 0}</div>
      <button class="primary-btn dailylogin-claim-btn" id="btn-dailylogin-claim" ${claimedToday ? 'disabled' : ''}>
        ${claimedToday ? '✅ Claimed — see you tomorrow!' : `Claim Day ${highlightDay} — +${DAILY_LOGIN_REWARDS[highlightDay - 1]} Bux`}
      </button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('.feature-close').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const claimBtn = overlay.querySelector('#btn-dailylogin-claim');
  claimBtn.addEventListener('click', () => {
    const res = claimDailyLogin();
    if (!res) return;
    Sound.sparkle();
    if (typeof vibrate === 'function') vibrate([20, 30, 20]);
    showToast(`🎁 Day ${res.day} claimed! +${res.reward} Bux (${res.streak}-day streak)`, 3000);
    renderDailyLoginModal();
  });
}
function openDailyLoginModal() { renderDailyLoginModal(); }

// Fires at most once per page session. Triggers either shortly after load
// (for a returning player who already has the tutorial behind them) or the
// first time a brand-new player lands back on the main menu after their
// tutorial finishes - so nobody with an unclaimed day ever misses seeing it.
let _dailyLoginAutoShown = false;
function maybeAutoShowDailyLogin() {
  if (_dailyLoginAutoShown) return;
  if (typeof hasTutorialBeenSeen === 'function' && !hasTutorialBeenSeen()) return;
  if (isDailyLoginClaimedToday()) return;
  const menuEl = document.getElementById('screen-menu');
  if (!menuEl || menuEl.classList.contains('hidden')) return;
  _dailyLoginAutoShown = true;
  openDailyLoginModal();
}
(function wrapShowScreenForDailyLogin() {
  const original = window.showScreen;
  if (typeof original !== 'function') return;
  window.showScreen = function (id) {
    original(id);
    if (id === 'screen-menu') maybeAutoShowDailyLogin();
  };
})();
(function wrapTutorialEndForDailyLogin() {
  // tutorialEnd() itself doesn't navigate to the menu (a live match may
  // still be running underneath it), so the wrapped showScreen above will
  // naturally catch the popup once the player actually gets back to the
  // menu - this just makes sure that path is armed even if the tutorial
  // was skipped before hasTutorialBeenSeen() would otherwise have been set.
  const original = window.tutorialEnd;
  if (typeof original !== 'function') return;
  window.tutorialEnd = function () {
    original();
    maybeAutoShowDailyLogin();
  };
})();
setTimeout(maybeAutoShowDailyLogin, 900);

/* ============================================================
   NEW PROGRESSION SYSTEM: Player Level
   An uncapped XP track that never "runs out" of goals - unlike card
   collection or Forge Milestones, which a dedicated player can fully
   complete, Player Level keeps climbing for as long as someone keeps
   playing, opening packs, and logging in. Every level-up pays out a
   scaling Bux reward. Shown as a progress bar inside the Quests panel.
   ============================================================ */
var PLAYER_XP_KEY = 'mehrbod_player_xp_v1';
function loadPlayerXP() {
  try { const n = Number(localStorage.getItem(PLAYER_XP_KEY)); return Number.isFinite(n) && n >= 0 ? n : 0; }
  catch (e) { return 0; }
}
function savePlayerXP(n) { try { localStorage.setItem(PLAYER_XP_KEY, String(Math.max(0, Math.floor(n)))); } catch (e) {} }
function xpNeededForLevel(level) { return 100 + (level - 1) * 40; }
function playerLevelFromXP(xp) {
  let level = 1, remaining = xp;
  while (remaining >= xpNeededForLevel(level)) { remaining -= xpNeededForLevel(level); level++; }
  return { level, into: remaining, need: xpNeededForLevel(level) };
}
function grantPlayerXP(amount) {
  if (!amount) return;
  const beforeLevel = playerLevelFromXP(loadPlayerXP()).level;
  const newXp = loadPlayerXP() + amount;
  savePlayerXP(newXp);
  const afterInfo = playerLevelFromXP(newXp);
  if (afterInfo.level > beforeLevel) {
    const reward = 20 + afterInfo.level * 5;
    addBux(reward);
    recordEconomyChange(reward, `Reached Player Level ${afterInfo.level}`);
    recordRecentActivity(`Reached Player Level ${afterInfo.level} — +${reward} Bux`);
    showToast(`⭐ Player Level ${afterInfo.level}! +${reward} Bux`, 3000);
    Sound.sparkle();
  }
  if (typeof updateProfileAvatar === 'function') updateProfileAvatar(); // refresh the prestige "!" badge eligibility
}

/* ============================================================
   NEW PROGRESSION SYSTEM: Weekly Vault
   A weekly point track (wins, Daily Challenge completions, Daily
   Login claims, and Forge Milestones all contribute points) with a
   handful of claimable Bux tiers. Resets every week, giving engaged
   players a fresh short-term goal on top of the longer-running Player
   Level and card-collection goals - the classic three-layer loop
   (daily / weekly / long-term) most live-service games use to keep
   even their most invested players coming back.
   ============================================================ */
const WEEKLY_VAULT_KEY = 'mehrbod_weekly_vault_v1';
const WEEKLY_VAULT_TIERS = [50, 120, 220, 350, 500];
const WEEKLY_VAULT_REWARDS = [30, 60, 100, 150, 250];
function currentWeekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
function loadWeeklyVaultState() {
  try {
    const s = JSON.parse(localStorage.getItem(WEEKLY_VAULT_KEY) || 'null');
    if (s && s.week === currentWeekKey()) return s;
  } catch (e) {}
  return { week: currentWeekKey(), points: 0, claimedTiers: [] };
}
function saveWeeklyVaultState(s) { try { localStorage.setItem(WEEKLY_VAULT_KEY, JSON.stringify(s)); } catch (e) {} }
function grantWeeklyPoints(amount) {
  if (!amount) return;
  const s = loadWeeklyVaultState();
  s.points += amount;
  saveWeeklyVaultState(s);
}
function claimWeeklyVaultTier(tierIdx) {
  const s = loadWeeklyVaultState();
  if (s.claimedTiers.includes(tierIdx)) return null;
  if (s.points < WEEKLY_VAULT_TIERS[tierIdx]) return null;
  s.claimedTiers.push(tierIdx);
  saveWeeklyVaultState(s);
  const reward = WEEKLY_VAULT_REWARDS[tierIdx];
  addBux(reward);
  recordEconomyChange(reward, `Weekly Vault tier ${tierIdx + 1}`);
  recordRecentActivity(`Claimed Weekly Vault tier ${tierIdx + 1} — +${reward} Bux`);
  return reward;
}

/* ============================================================
   DAILY BOUNTIES PROGRESSION SYSTEM (2.0 Quests Hub)
   Deterministic daily rotations, multi-step progress tracking,
   and rewards for matches, cards played, fusions, spells, & tower.
   ============================================================ */
const DAILY_QUESTS_KEY = 'mehrbod_daily_quests_v2';
const DAILY_BOUNTY_POOL = [
  { id: 'b_win_2', type: 'win', title: 'Arena Domination', desc: 'Win 2 matches in Single Player, Bot, or Multiplayer', goal: 2, rewardBux: 150, rewardXP: 45, icon: '⚔️' },
  { id: 'b_place_10', type: 'play', title: 'Card Deployment', desc: 'Play 10 unit cards onto the battlefield', goal: 10, rewardBux: 120, rewardXP: 35, icon: '🃏' },
  { id: 'b_tower_1', type: 'tower', title: 'Tower Conqueror', desc: 'Conquer any Trial Tower floor', goal: 1, rewardBux: 200, rewardXP: 60, icon: '🗼' },
  { id: 'b_merge_3', type: 'merge', title: 'Fusion Mastery', desc: 'Merge 3 pairs or groups of cards in battle', goal: 3, rewardBux: 140, rewardXP: 40, icon: '🧬' },
  { id: 'b_spell_3', type: 'spell', title: 'Arcane Mastery', desc: 'Cast 3 tactical spells or battle chips', goal: 3, rewardBux: 130, rewardXP: 40, icon: '✨' },
  { id: 'b_streak_2', type: 'streak', title: 'Winning Momentum', desc: 'Achieve a 2-game winning streak', goal: 2, rewardBux: 250, rewardXP: 75, icon: '🔥' },
  { id: 'b_win_3', type: 'win', title: 'Gladiator Supreme', desc: 'Win 3 arena matches across any mode', goal: 3, rewardBux: 220, rewardXP: 70, icon: '👑' },
  { id: 'b_matches_3', type: 'match', title: 'Battle Veteran', desc: 'Complete 3 full matches in any arena mode', goal: 3, rewardBux: 110, rewardXP: 30, icon: '🛡️' }
];

function getDailyBountiesForDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);
  const pool = DAILY_BOUNTY_POOL.slice();
  const selected = [];
  const indices = [hash % pool.length, (hash + 2) % pool.length, (hash + 5) % pool.length];
  const uniqueIndices = [...new Set(indices)];
  while (uniqueIndices.length < 3) {
    const next = (uniqueIndices[uniqueIndices.length - 1] + 1) % pool.length;
    if (!uniqueIndices.includes(next)) uniqueIndices.push(next);
  }
  uniqueIndices.slice(0, 3).forEach(idx => {
    const item = pool[idx];
    selected.push({
      id: item.id,
      type: item.type,
      title: item.title,
      desc: item.desc,
      goal: item.goal,
      current: 0,
      rewardBux: item.rewardBux,
      rewardXP: item.rewardXP,
      icon: item.icon || '🎯',
      claimed: false
    });
  });
  return selected;
}

function loadDailyQuests() {
  const today = new Date().toDateString();
  try {
    const s = JSON.parse(localStorage.getItem(DAILY_QUESTS_KEY) || 'null');
    if (s && s.date === today && Array.isArray(s.quests) && s.quests.length > 0) {
      let valid = true;
      s.quests.forEach(q => {
        if (!q || typeof q.goal !== 'number' || typeof q.current !== 'number' || !q.title) valid = false;
      });
      if (valid) return s.quests;
    }
  } catch (e) {}

  // Also check if legacy v1 storage exists for today to preserve any in-progress goals
  try {
    const legacy = JSON.parse(localStorage.getItem('mehrbod_daily_quests_v1') || 'null');
    if (legacy && legacy.date === today && Array.isArray(legacy.quests)) {
      const generated = getDailyBountiesForDate(today);
      legacy.quests.forEach((lq, idx) => {
        if (generated[idx]) {
          generated[idx].current = Math.min(generated[idx].goal, lq.current || 0);
          generated[idx].claimed = !!lq.claimed;
        }
      });
      saveDailyQuests(generated);
      return generated;
    }
  } catch (e) {}

  const defaultQuests = getDailyBountiesForDate(today);
  saveDailyQuests(defaultQuests);
  return defaultQuests;
}
window.loadDailyQuests = loadDailyQuests;

function saveDailyQuests(quests) {
  try {
    localStorage.setItem(DAILY_QUESTS_KEY, JSON.stringify({ date: new Date().toDateString(), quests }));
  } catch (e) {}
}
window.saveDailyQuests = saveDailyQuests;

function progressDailyBounties(type, amount = 1) {
  if (typeof tutorialActive !== 'undefined' && tutorialActive) return;
  const quests = loadDailyQuests();
  let changed = false;
  let newlyFinished = null;
  quests.forEach(q => {
    if (q.claimed) return;
    if (q.type === type) {
      const prev = q.current;
      q.current = Math.min(q.goal, q.current + amount);
      if (q.current !== prev) changed = true;
      if (prev < q.goal && q.current >= q.goal) {
        newlyFinished = q;
      }
    } else if (type === 'streak_check' && q.type === 'streak') {
      const prev = q.current;
      q.current = Math.min(q.goal, Math.max(q.current, amount));
      if (q.current !== prev) changed = true;
      if (prev < q.goal && q.current >= q.goal) {
        newlyFinished = q;
      }
    }
  });
  if (changed) {
    saveDailyQuests(quests);
    if (newlyFinished) {
      showToast(`🎯 Bounty Complete: "${newlyFinished.title}"! Open Quests to claim reward!`, 3500);
      if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
    }
    const overlay = document.getElementById('quests-overlay');
    if (typeof renderQuests === 'function' && overlay && !overlay.classList.contains('hidden')) {
      renderQuests();
    }
  }
}
window.progressDailyBounties = progressDailyBounties;

function claimDailyQuest(questId) {
  const quests = loadDailyQuests();
  const q = quests.find(x => x.id === questId);
  if (!q || q.claimed || q.current < q.goal) return null;
  q.claimed = true;
  saveDailyQuests(quests);
  addBux(q.rewardBux);
  grantPlayerXP(q.rewardXP);
  grantWeeklyPoints(25);
  recordEconomyChange(q.rewardBux, `Quest Reward: ${q.title}`);
  recordRecentActivity(`Completed Daily Bounty "${q.title}" — +${q.rewardBux} Bux, +${q.rewardXP} XP`);
  return q;
}
window.claimDailyQuest = claimDailyQuest;


/* ============================================================
   NEW PROGRESSION SYSTEM: Arena Rank
   A competitive rank ladder separate from raw Player Level - Rank
   Points (RP) rise and fall with match results, so this reflects
   recent form rather than lifetime totals. Ranking up pays a Bux
   bonus and shows a visible badge in the Quests panel.
   ============================================================ */
const ARENA_RANK_KEY = 'mehrbod_arena_rank_v1';
const ARENA_RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster'];
const ARENA_RANK_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400];
function loadArenaRankState() {
  try { const s = JSON.parse(localStorage.getItem(ARENA_RANK_KEY) || 'null'); if (s && typeof s.rp === 'number') return s; }
  catch (e) {}
  return { rp: 0 };
}
function saveArenaRankState(s) { try { localStorage.setItem(ARENA_RANK_KEY, JSON.stringify(s)); } catch (e) {} }
function arenaRankIndexFromRP(rp) {
  let idx = 0;
  for (let i = 0; i < ARENA_RANK_THRESHOLDS.length; i++) { if (rp >= ARENA_RANK_THRESHOLDS[i]) idx = i; }
  return idx;
}
function applyArenaRankChange(won) {
  const s = loadArenaRankState();
  const beforeIdx = arenaRankIndexFromRP(s.rp);
  s.rp = Math.max(0, s.rp + (won ? 20 : -12));
  saveArenaRankState(s);
  const afterIdx = arenaRankIndexFromRP(s.rp);
  if (afterIdx > beforeIdx) {
    const reward = 20 + afterIdx * 15;
    addBux(reward);
    recordEconomyChange(reward, `Ranked up to ${ARENA_RANKS[afterIdx]}`);
    recordRecentActivity(`Ranked up to ${ARENA_RANKS[afterIdx]} — +${reward} Bux`);
    showToast(`🏅 Ranked up to ${ARENA_RANKS[afterIdx]}! +${reward} Bux`, 3000);
    Sound.sparkle();
  }
}

function grantArenaRP(amount) {
  if (!amount) return;
  const s = loadArenaRankState();
  const beforeIdx = arenaRankIndexFromRP(s.rp);
  s.rp = Math.max(0, s.rp + amount);
  saveArenaRankState(s);
  const afterIdx = arenaRankIndexFromRP(s.rp);
  if (afterIdx > beforeIdx) {
    const reward = 20 + afterIdx * 15;
    addBux(reward);
    recordEconomyChange(reward, `Ranked up to ${ARENA_RANKS[afterIdx]}`);
    recordRecentActivity(`Ranked up to ${ARENA_RANKS[afterIdx]} — +${reward} Bux`);
    showToast(`🏅 Ranked up to ${ARENA_RANKS[afterIdx]}! +${reward} Bux`, 3000);
    Sound.sparkle();
  }
}

/* ============================================================
   NEW PROGRESSION SYSTEM: Prestige
   Once a player reaches a high enough Player Level, they can choose
   to Prestige: their level resets to 1, but they keep a permanent
   Prestige count that grants a small permanent bonus Bux payout on
   every future win, plus a one-time reward for prestiging. This
   gives dedicated players who've already maxed out a reason to keep
   grinding instead of hitting a hard ceiling.
   ============================================================ */
const PRESTIGE_KEY = 'mehrbod_prestige_v1';
const PRESTIGE_LEVEL_REQUIREMENT = 15;
function loadPrestigeState() {
  try { const s = JSON.parse(localStorage.getItem(PRESTIGE_KEY) || 'null'); if (s && typeof s.count === 'number') return s; }
  catch (e) {}
  return { count: 0 };
}
function savePrestigeState(s) { try { localStorage.setItem(PRESTIGE_KEY, JSON.stringify(s)); } catch (e) {} }
function applyPrestigeWinBonus() {
  const count = loadPrestigeState().count || 0;
  if (count > 0) addBux(count * 2);
}
function canPrestigeNow() { return playerLevelFromXP(loadPlayerXP()).level >= PRESTIGE_LEVEL_REQUIREMENT; }
function doPrestige() {
  if (!canPrestigeNow()) return;
  const s = loadPrestigeState();
  s.count = (s.count || 0) + 1;
  savePrestigeState(s);
  savePlayerXP(0);
  const reward = 150 + s.count * 50;
  addBux(reward);
  recordEconomyChange(reward, `Prestige ${s.count}`);
  recordRecentActivity(`Reached Prestige ${s.count} — +${reward} Bux`);
  showToast(`✦ Prestige ${s.count}! Player Level reset, +${reward} Bux, and +${s.count * 2} Bux on every future win.`, 4000);
  Sound.sparkle();
  renderQuests();
}

/* ============================================================
   NEW PROGRESSION SYSTEM: Set Completion Bonuses
   A one-time Bux bonus for fully collecting each named subset of the
   card pool (all Green units, all Red units, all Orange units, every
   Spell, every Chip) - smaller, more frequent goals than the single
   "own literally everything" Forge Milestone, so players
   still have concrete near-term targets.
   ============================================================ */
const SET_BONUS_KEY = 'mehrbod_set_bonuses_v1';
const SET_DEFS = [
  { id: 'green',  name: 'Green Set',  reward: 40,  owned: () => UNIT_ARCHETYPES[2].filter(a => isUnitArchetypeOwned(a.id)).length, total: () => UNIT_ARCHETYPES[2].length },
  { id: 'red',    name: 'Red Set',    reward: 70,  owned: () => UNIT_ARCHETYPES[3].filter(a => isUnitArchetypeOwned(a.id)).length, total: () => UNIT_ARCHETYPES[3].length },
  { id: 'orange', name: 'Orange Set', reward: 120, owned: () => UNIT_ARCHETYPES[4].filter(a => isUnitArchetypeOwned(a.id)).length, total: () => UNIT_ARCHETYPES[4].length },
  { id: 'spells', name: 'Spell Set',  reward: 60,  owned: () => loadCollection().spells.length, total: () => ALL_SPELL_IDS.length },
  { id: 'chips',  name: 'Chip Set',   reward: 60,  owned: () => loadCollection().chips.length, total: () => ALL_CHIP_IDS.length },
];
function loadSetBonusState() {
  try { const s = JSON.parse(localStorage.getItem(SET_BONUS_KEY) || 'null'); if (s && Array.isArray(s.claimed)) return s; }
  catch (e) {}
  return { claimed: [] };
}
function saveSetBonusState(s) { try { localStorage.setItem(SET_BONUS_KEY, JSON.stringify(s)); } catch (e) {} }
function checkSetBonuses() {
  const s = loadSetBonusState();
  let changed = false;
  SET_DEFS.forEach(def => {
    if (s.claimed.includes(def.id)) return;
    if (def.owned() >= def.total()) {
      s.claimed.push(def.id);
      changed = true;
      addBux(def.reward);
      recordEconomyChange(def.reward, `${def.name} completed`);
      recordRecentActivity(`Completed the ${def.name} — +${def.reward} Bux`);
      showToast(`🧩 ${def.name} complete! +${def.reward} Bux`, 3000);
      Sound.sparkle();
    }
  });
  if (changed) saveSetBonusState(s);
}

/* ============================================================
   NEW PROGRESSION SYSTEM: Trial Tower
   An escalating single-track gauntlet of bot matches, launched from
   its own card in the Single Player menu. Clearing a floor pays Bux,
   stamps a checkmark on that floor's brick, and grows the tower by
   one more; losing brings the whole tower crashing down in a real
   explosion animation back to Floor 1 - but the highest floor ever
   cleared is kept forever as a permanent record, giving strong
   players an open-ended ladder to keep climbing well past the fixed
   5 practice difficulties.
   ============================================================ */
const TRIAL_TOWER_KEY = 'mehrbod_trial_tower_v1';
function loadTrialTowerState() {
  try { const s = JSON.parse(localStorage.getItem(TRIAL_TOWER_KEY) || 'null'); if (s && typeof s.floor === 'number') return s; }
  catch (e) {}
  return { floor: 1, best: 0, pendingResult: null, lastRunFloor: 1 };
}
function saveTrialTowerState(s) { try { localStorage.setItem(TRIAL_TOWER_KEY, JSON.stringify(s)); } catch (e) {} }
function towerFloorDifficulty(floor) {
  const idx = Math.min(DIFFICULTIES.length - 1, Math.floor((floor - 1) / 3));
  return DIFFICULTIES[idx];
}
function towerFloorReward(floor) { return 15 + floor * 5; }
const TOWER_DIFF_COLORS = { Easy: '#4C9A5B', Medium: '#d9b23c', Hard: '#e0752c', Expert: '#c1443c', Master: '#b23cf0' };
function trialTowerBrickColor(floor) { return TOWER_DIFF_COLORS[towerFloorDifficulty(floor)] || '#3E7CB1'; }

let trialTowerActive = false;
function enterTrialTower() {
  const s = loadTrialTowerState();
  const diff = towerFloorDifficulty(s.floor);
  trialTowerActive = true;
  botDifficulty = diff;
  saveLastDifficulty(diff);
  document.getElementById('trial-tower-overlay')?.remove();
  openDeckBuilder((config) => startVsBot(0, config));
}
function resolveTrialTowerMatch(won) {
  trialTowerActive = false;
  const s = loadTrialTowerState();
  if (won) {
    const reward = towerFloorReward(s.floor);
    addBux(reward);
    recordEconomyChange(reward, `Trial Tower floor ${s.floor} cleared`);
    recordRecentActivity(`Cleared Trial Tower floor ${s.floor} — +${reward} Bux`);
    showToast(`🗼 Floor ${s.floor} cleared! +${reward} Bux`, 3000);
    s.best = Math.max(s.best || 0, s.floor);
    
    // Check for Trial Tower theme unlocks at floors 10, 15, 30, and 50
    if (s.floor >= 10 || s.best >= 10) {
      if (localStorage.getItem('theme_quantum_unlocked') !== 'true') {
        localStorage.setItem('theme_quantum_unlocked', 'true');
        setTimeout(() => {
          showToast('⚡ CONGRATULATIONS! You reached Floor 10 and unlocked the QUANTUM FLUX Theme!', 5000);
          if (typeof fireConfetti === 'function') fireConfetti();
          if (typeof updateThemeButtons === 'function') updateThemeButtons();
        }, 800);
      }
    }
    if (s.floor >= 15 || s.best >= 15) {
      if (localStorage.getItem('theme_glacier_unlocked') !== 'true') {
        localStorage.setItem('theme_glacier_unlocked', 'true');
        setTimeout(() => {
          showToast('❄️ CONGRATULATIONS! You reached Floor 15 and unlocked the GLACIAL FROST Theme!', 5000);
          if (typeof fireConfetti === 'function') fireConfetti();
          if (typeof updateThemeButtons === 'function') updateThemeButtons();
        }, 1200);
      }
    }
    if (s.floor >= 30 || s.best >= 30) {
      if (localStorage.getItem('theme_astral_unlocked') !== 'true') {
        localStorage.setItem('theme_astral_unlocked', 'true');
        setTimeout(() => {
          showToast('🌌 CONGRATULATIONS! You cleared Floor 30 and unlocked the ASTRAL VOID Theme!', 5000);
          if (typeof fireConfetti === 'function') fireConfetti();
          if (typeof updateThemeButtons === 'function') updateThemeButtons();
        }, 1600);
      }
    }
    if (s.floor >= 50 || s.best >= 50) {
      if (localStorage.getItem('theme_celestial_unlocked') !== 'true') {
        localStorage.setItem('theme_celestial_unlocked', 'true');
        setTimeout(() => {
          showToast('👑 CONGRATULATIONS! You conquered Floor 50 and unlocked the CELESTIAL DIVINITY Theme!', 6000);
          if (typeof fireConfetti === 'function') fireConfetti();
          if (typeof updateThemeButtons === 'function') updateThemeButtons();
        }, 2000);
      }
    }

    s.floor += 1;
    s.pendingResult = 'win';
  } else {
    s.lastRunFloor = s.floor;
    if (s.floor > 1) showToast(`🗼 Trial Tower run ended at floor ${s.floor} — back to Floor 1.`, 3000);
    s.floor = 1;
    s.pendingResult = 'loss';
  }
  saveTrialTowerState(s);
}
// Any manual exit from a match (quit, or starting a fresh one via Play
// Again / Back to menu) should never leave a stale flag around to
// mis-tag a later, unrelated match as a Trial Tower attempt.
document.getElementById('btn-quit-match')?.addEventListener('click', () => { trialTowerActive = false; });
document.getElementById('btn-play-again')?.addEventListener('click', () => { trialTowerActive = false; });
document.getElementById('btn-rematch')?.addEventListener('click', () => { trialTowerActive = false; });

/* ---------- Trial Tower infographic: a real climbable/explodable tower ---------- */
function towerFloorIntel(floor) {
  const diff = towerFloorDifficulty(floor);
  if (diff === 'Easy') {
    return {
      desc: 'Baseline AI combatants with simple unit placement. Ascend through early defenses to build your rhythm.',
      xp: 45 + floor * 5,
    };
  } else if (diff === 'Medium') {
    return {
      desc: 'Tactical bots employing elemental synergies and adaptive counter-swaps. Plan your mana curves carefully.',
      xp: 65 + floor * 6,
    };
  } else if (diff === 'Hard') {
    return {
      desc: 'Aggressive bot decks wielding high-tier elemental fusions and heavy tempo swings. Expect relentless pressure.',
      xp: 90 + floor * 8,
    };
  } else if (diff === 'Expert') {
    return {
      desc: 'Elite tower guardians utilizing precision spell cards, chips, and tactical board wipes. One misplay can cost the run.',
      xp: 125 + floor * 10,
    };
  } else {
    return {
      desc: 'Grandmaster AI evaluating deep future lines, optimal chip combos, and ruthless counter-strategies. The apex trial.',
      xp: 175 + floor * 15,
    };
  }
}

function updateTowerConsoleForFloor(floor, isCleared, isCurrent, isLocked, activeFloor, bestRecord) {
  const diff = towerFloorDifficulty(floor);
  const reward = towerFloorReward(floor);
  const intel = towerFloorIntel(floor);

  const diffBadge = document.getElementById('tower-console-diff-badge');
  if (diffBadge) {
    diffBadge.textContent = diff;
    diffBadge.style.background = trialTowerBrickColor(floor);
  }

  const floorTitle = document.getElementById('tower-console-floor-title');
  if (floorTitle) {
    floorTitle.textContent = isCurrent ? `Floor ${floor} Challenge` : (isCleared ? `Floor ${floor} (Cleared)` : `Floor ${floor} (Upcoming)`);
  }

  const descEl = document.getElementById('tower-console-desc');
  if (descEl) descEl.textContent = intel.desc;

  const buxEl = document.getElementById('tower-console-bux-val');
  if (buxEl) buxEl.textContent = `+${reward} Bux`;

  const xpEl = document.getElementById('tower-console-xp-val');
  if (xpEl) xpEl.textContent = `+${intel.xp} XP`;

  const bestEl = document.getElementById('tower-console-best-val');
  if (bestEl) bestEl.textContent = `Floor ${bestRecord}`;

  const headerBest = document.getElementById('tower-header-best');
  if (headerBest) headerBest.textContent = `Floor ${bestRecord}`;

  const headerCur = document.getElementById('tower-header-current');
  if (headerCur) headerCur.textContent = `Floor ${activeFloor}`;

  const startBtn = document.getElementById('btn-tower-page-begin');
  if (startBtn) {
    if (isCurrent) {
      startBtn.disabled = false;
      startBtn.innerHTML = `<span>⚔️ Ascend to Floor ${floor} — vs ${diff} (+${reward} Bux)</span>`;
      startBtn.style.opacity = '1';
    } else if (isLocked) {
      startBtn.disabled = true;
      startBtn.innerHTML = `<span>🔒 Floor ${floor} Locked — Clear Floor ${activeFloor} First</span>`;
      startBtn.style.opacity = '0.6';
    } else {
      startBtn.disabled = false;
      startBtn.innerHTML = `<span>⚔️ Resume Active Ascent (Floor ${activeFloor})</span>`;
      startBtn.style.opacity = '1';
    }
  }
}

function renderTrialTowerBricks(container, targetFloor, clearedUpTo) {
  if (!container) return;
  container.innerHTML = '';
  const s = loadTrialTowerState();
  const activeFloor = s.floor || 1;
  const bestRecord = s.best || 1;

  const minFloor = Math.max(1, targetFloor - 7);
  const maxFloor = targetFloor + 3;

  if (minFloor > 1) {
    const more = document.createElement('div');
    more.className = 'tower-more-indicator';
    more.textContent = `⋮ +${minFloor - 1} cleared floor${minFloor - 1 === 1 ? '' : 's'} below`;
    container.appendChild(more);
  }

  for (let f = minFloor; f <= maxFloor; f++) {
    const brick = document.createElement('div');
    brick.className = 'tower-brick';
    brick.dataset.floor = String(f);
    brick.style.setProperty('--brick-color', trialTowerBrickColor(f));
    
    const isCleared = f < clearedUpTo;
    const isCurrent = f === clearedUpTo;
    const isLocked = f > clearedUpTo;

    if (isCleared) brick.classList.add('cleared');
    if (isCurrent) brick.classList.add('current');
    if (isLocked) brick.classList.add('locked-preview');

    const diff = towerFloorDifficulty(f);
    const reward = towerFloorReward(f);

    brick.innerHTML = `
      <div class="tower-brick-left">
        <span class="tower-brick-num">Floor ${f}</span>
        <span class="tower-brick-diff">${diff}</span>
      </div>
      <div class="tower-brick-right">
        <span class="tower-brick-bounty">+${reward} Bux</span>
        ${isCleared ? '<span class="tower-brick-check">✓</span>' : (isCurrent ? '<span class="tower-brick-flag">🚩</span>' : '<span style="font-size:0.75rem;opacity:0.6;">🔒</span>')}
      </div>
    `;

    brick.addEventListener('click', () => {
      updateTowerConsoleForFloor(f, isCleared, isCurrent, isLocked, activeFloor, bestRecord);
      if (typeof Sound !== 'undefined' && Sound && Sound.tap) Sound.tap();
    });

    container.appendChild(brick);
  }

  setTimeout(() => {
    const curEl = container.querySelector('.tower-brick.current');
    if (curEl) {
      curEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 70);
}

function playTowerAdvanceAnimation(stack, clearedFloor, newFloor, onDone) {
  const topBrick = stack.querySelector(`.tower-brick[data-floor="${clearedFloor}"]`);
  if (topBrick) {
    topBrick.classList.remove('current');
    topBrick.classList.add('cleared');
    const flag = topBrick.querySelector('.tower-brick-flag');
    if (flag) flag.remove();
    const check = document.createElement('span');
    check.className = 'tower-brick-check pop';
    check.textContent = '✓';
    const right = topBrick.querySelector('.tower-brick-right') || topBrick;
    right.appendChild(check);
  }
  if (typeof vibrate === 'function') vibrate([20, 30, 20]);
  setTimeout(() => {
    const newBrick = document.createElement('div');
    newBrick.className = 'tower-brick current new-brick';
    newBrick.dataset.floor = String(newFloor);
    newBrick.style.setProperty('--brick-color', trialTowerBrickColor(newFloor));
    const diff = towerFloorDifficulty(newFloor);
    const reward = towerFloorReward(newFloor);
    newBrick.innerHTML = `
      <div class="tower-brick-left">
        <span class="tower-brick-num">Floor ${newFloor}</span>
        <span class="tower-brick-diff">${diff}</span>
      </div>
      <div class="tower-brick-right">
        <span class="tower-brick-bounty">+${reward} Bux</span>
        <span class="tower-brick-flag">🚩</span>
      </div>
    `;
    stack.insertBefore(newBrick, stack.firstChild);
    if (typeof Sound !== 'undefined' && Sound && Sound.chipAttach) Sound.chipAttach();
    setTimeout(onDone, 520);
  }, 480);
}

function playTowerExplodeAnimation(wrapper, stack, onDone) {
  const bricks = Array.from(stack.querySelectorAll('.tower-brick'));
  if (typeof Sound !== 'undefined' && Sound && typeof Sound.meteorBoom === 'function') Sound.meteorBoom();
  if (typeof vibrate === 'function') vibrate([40, 30, 40, 30, 70]);
  if (wrapper) {
    wrapper.classList.add('tower-shake');
    setTimeout(() => wrapper.classList.remove('tower-shake'), 520);
  }
  bricks.forEach((b, i) => {
    setTimeout(() => {
      const angle = Math.random() * 360;
      const dist = 70 + Math.random() * 130;
      b.style.setProperty('--angle', angle + 'deg');
      b.style.setProperty('--dist', dist + 'px');
      b.classList.add('exploding');
    }, i * 40);
  });
  setTimeout(() => { stack.innerHTML = ''; onDone(); }, bricks.length * 40 + 650);
}

function openTrialTowerScreen() {
  if (typeof showScreen === 'function') {
    showScreen('screen-trial-tower');
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-trial-tower')?.classList.remove('hidden');
  }

  const stack = document.getElementById('tower-citadel-stack');
  const citadelContainer = document.getElementById('tower-citadel-container');
  const beginBtn = document.getElementById('btn-tower-page-begin');
  const s = loadTrialTowerState();

  function settleView() {
    const cur = loadTrialTowerState();
    renderTrialTowerBricks(stack, cur.floor, cur.floor);
    updateTowerConsoleForFloor(cur.floor, false, true, false, cur.floor, cur.best);
  }

  if (s.pendingResult === 'win') {
    const clearedFloor = s.floor - 1;
    renderTrialTowerBricks(stack, clearedFloor, clearedFloor);
    s.pendingResult = null;
    saveTrialTowerState(s);
    updateTowerConsoleForFloor(clearedFloor, true, false, false, s.floor, s.best);
    setTimeout(() => playTowerAdvanceAnimation(stack, clearedFloor, s.floor, settleView), 320);
  } else if (s.pendingResult === 'loss') {
    const runFloor = s.lastRunFloor || 1;
    renderTrialTowerBricks(stack, runFloor, runFloor + 1);
    s.pendingResult = null;
    saveTrialTowerState(s);
    updateTowerConsoleForFloor(1, false, true, false, 1, s.best);
    setTimeout(() => playTowerExplodeAnimation(citadelContainer, stack, settleView), 320);
  } else {
    settleView();
  }

  if (beginBtn && !beginBtn.dataset.bound) {
    beginBtn.dataset.bound = 'true';
    beginBtn.addEventListener('click', () => {
      enterTrialTower();
    });
    if (typeof wirePressFeedback === 'function') wirePressFeedback(beginBtn);
  }

  const backBtn = document.getElementById('btn-trial-tower-back');
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = 'true';
    backBtn.addEventListener('click', () => {
      if (typeof showScreen === 'function') showScreen('screen-single-player');
    });
    if (typeof wirePressFeedback === 'function') wirePressFeedback(backBtn);
  }
}

function ensureTrialTowerMenuCard() {
  const menuCard = document.getElementById('btn-trial-tower-menu');
  if (menuCard) {
    if (!menuCard.dataset) menuCard.dataset = {};
    if (!menuCard.dataset.bound) {
      menuCard.dataset.bound = 'true';
      menuCard.addEventListener('click', () => openTrialTowerScreen());
      if (typeof wirePressFeedback === 'function') wirePressFeedback(menuCard);
    }
  }

  const grid = document.querySelector('#screen-single-player .menu-grid');
  if (!grid) return;
  if (!document.getElementById('btn-trial-tower-menu') && !document.getElementById('btn-trial-tower')) {
    const btn = document.createElement('button');
    btn.className = 'menu-card';
    btn.id = 'btn-trial-tower';
    btn.innerHTML = `
      <span class="menu-card-title">🗼 Trial Tower</span>
      <span class="menu-card-sub">Climb an endless citadel of escalating bots</span>`;
    btn.addEventListener('click', () => openTrialTowerScreen());
    grid.appendChild(btn);
    if (typeof wirePressFeedback === 'function') wirePressFeedback(btn);
  }
}
ensureTrialTowerMenuCard();

/* ---------- Progression hooks: wrap existing single-purpose functions so
   Player Level / Weekly Vault / Arena Rank / Prestige / Trial Tower all
   accrue from real play, without touching the core rules engine in
   game.js. ---------- */
(function wireProgressionHooks() {
  const _origRecordResult = window.recordResult;
  if (typeof _origRecordResult === 'function') {
    window.recordResult = function (won) {
      _origRecordResult(won);
      grantPlayerXP(won ? 25 : 8);
      if (won) grantWeeklyPoints(10);
      applyArenaRankChange(won);
      if (won) applyPrestigeWinBonus();
      progressDailyBounties('match', 1);
      if (won) progressDailyBounties('win', 1);
      if (typeof loadRecord === 'function') {
        const r = loadRecord();
        if (r && r.streak) progressDailyBounties('streak_check', r.streak);
      }
      if (trialTowerActive) {
        resolveTrialTowerMatch(won);
        if (won) progressDailyBounties('tower', 1);
      }
    };
  }
  const _origRecordDifficultyBeaten = window.recordDifficultyBeaten;
  if (typeof _origRecordDifficultyBeaten === 'function') {
    window.recordDifficultyBeaten = function (diff) {
      const before = loadBeatenDifficulties();
      _origRecordDifficultyBeaten(diff);
      const after = loadBeatenDifficulties();
      if (after.length > before.length) grantPlayerXP(50);
    };
  }
  const _origUnlockAchievement = window.unlockAchievement;
  if (typeof _origUnlockAchievement === 'function') {
    window.unlockAchievement = function (id) {
      const before = loadUnlockedAchievements();
      _origUnlockAchievement(id);
      const after = loadUnlockedAchievements();
      if (after.length > before.length) { grantPlayerXP(20); grantWeeklyPoints(15); }
    };
  }
  const _origCompleteDailyChallenge = window.completeDailyChallenge;
  if (typeof _origCompleteDailyChallenge === 'function') {
    window.completeDailyChallenge = function () {
      const before = loadDailyChallengeState().claimed;
      _origCompleteDailyChallenge();
      const after = loadDailyChallengeState().claimed;
      if (!before && after) { grantPlayerXP(15); grantWeeklyPoints(15); }
    };
  }
  const _origGrantCards = window.grantCards;
  if (typeof _origGrantCards === 'function') {
    window.grantCards = function (unitIds, spellIds, chipIds) {
      const result = _origGrantCards(unitIds, spellIds, chipIds);
      checkSetBonuses();
      return result;
    };
  }
})();

/* ---------- Progression UI: appended into the existing Quests panel ----- */
function renderProgressionExtras() {
  const list = document.getElementById('quests-list');
  if (!list) return;

  const xp = loadPlayerXP();
  const info = playerLevelFromXP(xp);
  const pct = Math.round((info.into / info.need) * 100);
  const prestige = loadPrestigeState();
  const prestigeBadge = prestige.count > 0 ? ` <span style="color:var(--accent)">✦ Prestige ${prestige.count}</span>` : '';
  const prestigeButton = canPrestigeNow()
    ? `<button type="button" class="primary-btn small" id="btn-do-prestige" style="margin-top:8px;">✦ Prestige Now (resets Level, keeps a permanent win bonus)</button>`
    : `<div class="quest-desc" style="margin-top:4px;">Reach Player Level ${PRESTIGE_LEVEL_REQUIREMENT} to unlock Prestige.</div>`;
  const levelHtml = `
    <div class="deck-builder-heading" style="margin-top:18px;"><span>⭐ Player Level${prestigeBadge}</span><span>Lv ${info.level}</span></div>
    <div class="quest-row" style="flex-direction:column; align-items:stretch; gap:4px;">
      <div class="quest-desc">${info.into}/${info.need} XP to Level ${info.level + 1} — earned from wins, packs, dailies, and milestones</div>
      <div class="challenge-progress-track"><div class="challenge-progress-fill" style="width:${pct}%"></div></div>
      ${prestigeButton}
    </div>`;

  const rankState = loadArenaRankState();
  const rankIdx = arenaRankIndexFromRP(rankState.rp);
  const nextThreshold = ARENA_RANK_THRESHOLDS[rankIdx + 1];
  const rankPct = nextThreshold ? Math.round(((rankState.rp - ARENA_RANK_THRESHOLDS[rankIdx]) / (nextThreshold - ARENA_RANK_THRESHOLDS[rankIdx])) * 100) : 100;
  const rankHtml = `
    <div class="deck-builder-heading" style="margin-top:18px;"><span>🏅 Arena Rank</span><span>${ARENA_RANKS[rankIdx]}</span></div>
    <div class="quest-row" style="flex-direction:column; align-items:stretch; gap:4px;">
      <div class="quest-desc">${rankState.rp} RP${nextThreshold ? ` — ${nextThreshold - rankState.rp} RP to ${ARENA_RANKS[rankIdx + 1]}` : ' — top rank reached!'}</div>
      <div class="challenge-progress-track"><div class="challenge-progress-fill" style="width:${rankPct}%"></div></div>
      <div class="quest-desc" style="margin-top:2px;">+20 RP per win, −12 RP per loss.</div>
    </div>`;

  const tower = loadTrialTowerState();
  const towerHtml = `
    <div class="deck-builder-heading" style="margin-top:18px;"><span>🗼 Trial Tower</span><span>Best: Floor ${tower.best}</span></div>
    <div class="quest-row" id="quest-row-trial-tower" style="cursor:pointer;" title="Click to open Trial Tower">
      <div class="quest-icon">🗼</div>
      <div class="quest-body">
        <div class="quest-title">Currently on Floor ${tower.floor}</div>
        <div class="quest-desc">Click here or head to Single Player → 🗼 Trial Tower to climb.</div>
      </div>
      <div class="quest-status"><span style="color:var(--accent); font-size:0.8rem; font-weight:800;">OPEN →</span></div>
    </div>`;

  const setState = loadSetBonusState();
  const setRows = SET_DEFS.map(def => {
    const claimed = setState.claimed.includes(def.id);
    const owned = def.owned(), total = def.total();
    return `<div class="quest-row ${claimed ? 'complete' : ''}">
      <div class="quest-icon">${claimed ? '✅' : '🧩'}</div>
      <div class="quest-body">
        <div class="quest-title">${def.name}</div>
        <div class="quest-desc">${owned}/${total} owned · Reward: ${def.reward} Bux</div>
      </div>
      <div class="quest-status"></div>
    </div>`;
  }).join('');
  const setHtml = `
    <div class="deck-builder-heading" style="margin-top:18px;"><span>🧩 Set Completion Bonuses</span></div>
    <p class="sub small" style="margin:-4px 0 6px;">Auto-claimed the moment you own every card in a set.</p>
    ${setRows}`;

  const vault = loadWeeklyVaultState();
  const vaultRows = WEEKLY_VAULT_TIERS.map((need, i) => {
    const claimed = vault.claimedTiers.includes(i);
    const reached = vault.points >= need;
    return `<div class="quest-row ${claimed ? 'complete' : ''}">
      <div class="quest-icon">${claimed ? '✅' : (reached ? '🎁' : '🔒')}</div>
      <div class="quest-body">
        <div class="quest-title">Tier ${i + 1} — ${need} pts</div>
        <div class="quest-desc">Reward: ${WEEKLY_VAULT_REWARDS[i]} Bux</div>
      </div>
      <div class="quest-status">${claimed ? '' : (reached ? `<button type="button" class="primary-btn small" data-claim-vault="${i}">Claim</button>` : '')}</div>
    </div>`;
  }).join('');
  const vaultHtml = `
    <div class="deck-builder-heading" style="margin-top:18px;"><span>🗝️ Weekly Vault</span><span>${vault.points} pts</span></div>
    <p class="sub small" style="margin:-4px 0 6px;">Resets weekly. Earn points from wins, Daily Challenges, Daily Logins, and Forge Milestones.</p>
    ${vaultRows}`;

  list.insertAdjacentHTML('beforeend', levelHtml + rankHtml + towerHtml + setHtml + vaultHtml);

  document.getElementById('quest-row-trial-tower')?.addEventListener('click', () => {
    document.getElementById('quests-overlay')?.classList.add('hidden');
    openTrialTowerScreen();
  });
}

/* ============================================================
   MEHRBOD SHOP REWORK: tabs removed. Instead, three always-visible
   sections rotate daily (deterministically, so both a page reload and
   every other player see the same picks on the same calendar day):
   6 Cosmetics, 6 Card Packs (fixed sizes, not rotated - the sizes
   themselves ARE the variety), and 6 Individual Cards you can buy
   outright without RNG.
   ============================================================ */
const SHOP_PACK_SIZES = [
  { id: 'pack_small',    name: 'Small Pack',    count: 2,  cost: 20,  art: '🎁', tag: 'STARTER', badge: '2 Cards', desc: 'Unlocks 2 unique spells, chips, or units for your collection.' },
  { id: 'pack_standard', name: 'Standard Pack', count: 3,  cost: 32,  art: '📦', tag: 'POPULAR', badge: '3 Cards', desc: 'Balanced 3-card drop with elevated higher-tier chances.' },
  { id: 'pack_large',    name: 'Large Pack',    count: 5,  cost: 55,  art: '🧧', tag: 'BEST VALUE', badge: '5 Cards', desc: '5 unowned cards including guaranteed high-tier synergy.' },
  { id: 'pack_mega',     name: 'Mega Pack',     count: 8,  cost: 90,  art: '💼', tag: 'ELITE HAUL', badge: '8 Cards', desc: 'Substantial 8-card unlock pack for rapid deckbuilding.' },
  { id: 'pack_ultra',    name: 'Ultra Pack',    count: 12, cost: 140, art: '🏆', tag: 'MYTHIC VAULT', badge: '12 Cards', desc: 'Massive 12-card jackpot to complete your master vault.' },
];

function individualCardPrice(kind, tier) {
  if (kind === 'unit') return tier === 4 ? 200 : tier === 3 ? 130 : 80;
  return 60; // spell or chip
}

function buildTodaysShopPicks() {
  const seed = dayIndexSeed();
  // 8 rotating cosmetics daily:
  const cosmeticIds = seededPick(COSMETIC_ITEMS.map(c => c.id), seed, 8);

  const cardPool = [];
  ALL_NONBLUE_UNIT_IDS.forEach(id => {
    const a = findArchetypeById(id);
    if (a) cardPool.push({ id, kind: 'unit', tier: a.tier, name: a.name, cost: individualCardPrice('unit', a.tier), power: a.power || (a.tier * 2 + 1) });
  });
  ALL_SPELL_IDS.forEach(id => {
    const d = SPELL_DEFS.find(s => s.id === id);
    if (d) cardPool.push({ id, kind: 'spell', tier: null, name: d.name, cost: individualCardPrice('spell'), desc: d.desc || 'Tactical spell card' });
  });
  ALL_CHIP_IDS.forEach(id => {
    const d = CHIP_DEFS.find(c => c.id === id);
    if (d) cardPool.push({ id, kind: 'chip', tier: null, name: d.name, cost: individualCardPrice('chip'), desc: d.desc || 'Passive modifier chip' });
  });
  // 8 rotating individual cards daily:
  const cardIdxs = seededPick(cardPool.map((_, i) => i), seed + 777, 8);
  const cards = cardIdxs.map(i => cardPool[i]);

  return { cosmeticIds, cards };
}

function isIndividualCardOwned(entry) {
  const col = loadCollection();
  if (entry.kind === 'unit') return col.units.includes(entry.id);
  if (entry.kind === 'spell') return col.spells.includes(entry.id);
  return col.chips.includes(entry.id);
}
function buyIndividualCard(entry) {
  if (isIndividualCardOwned(entry)) { showToast('You already own this card.'); return; }
  if (!spendBux(entry.cost)) { showToast("You don't have enough Mehrbod Bux for that card."); return; }
  if (entry.kind === 'unit') grantCards([entry.id], [], []);
  else if (entry.kind === 'spell') grantCards([], [entry.id], []);
  else grantCards([], [], [entry.id]);
  if (typeof checkMilestones === 'function') checkMilestones();
  else if (typeof checkAchievements === 'function') checkAchievements();
  grantPlayerXP(10);
  grantWeeklyPoints(8);
  showToast(`🃏 Added ${entry.name} to your collection!`, 2400);
  Sound.sparkle();
  renderCosmeticsShop();
}

/* ---------- Shop Codes: a simple redeemable-code system --------------- */
const REDEEMED_CODES_KEY = 'mehrbod_redeemed_codes_v1';
const ALL_MEHRBOD_SHOP_CODES = [
  {
    code: 'Leo',
    reward: '🦁 Small Card Pack (2 Cards Opening Animation) + 25 Player XP + 10 Vault Points',
    icon: '🦁'
  },
  {
    code: 'coolsauce',
    reward: '👑 Master Unlock: All Units, Spells & Chips + All Cosmetics + 1,000,000 Mehrbod Bux',
    icon: '👑'
  },
  {
    code: 'jackpot',
    reward: '💰 High-Roller Bounty: +2,500 Mehrbod Bux Vault Deposit',
    icon: '💰'
  },
  {
    code: '2ndyear',
    reward: '💘 Secret Valentine Theme (Floating hearts, Cupid glow & card burst)',
    icon: '💘'
  },
  {
    code: 'royalty',
    reward: '👑 ✨ Gold Sleeves Equipped + 500 Bux (or +1,000 Bux if already owned)',
    icon: '✨'
  },
  {
    code: 'lucky7',
    reward: '🎰 Lucky Sevens: +777 Mehrbod Bux added to balance',
    icon: '🎰'
  },
  {
    code: 'cybergrid',
    reward: '⚡ System Overdrive: Unlock All Chips + 75 Arena RP + 400 Bux',
    icon: '⚡'
  },
  {
    code: 'givemelava',
    reward: '🌋 Molten Core: Unlock & Equip Magma Theme (+600 Bux if already owned)',
    icon: '🌋'
  },
  {
    code: 'prism',
    reward: '💎 Prism Core: Unlock & Equip Prism Core Theme (Living diamond crystal refractors with chromatic spectrum dispersion)',
    icon: '💎'
  },
  {
    code: 'stargazer',
    reward: '🌌 Celestial Boon: +350 Bux + 80 Player XP + 25 Weekly Vault Points',
    icon: '🌌'
  }
];

function loadRedeemedCodes() {
  try { const a = JSON.parse(localStorage.getItem(REDEEMED_CODES_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function saveRedeemedCodes(list) {
  try { localStorage.setItem(REDEEMED_CODES_KEY, JSON.stringify([...new Set(list)])); } catch (e) {}
}
function redeemShopCode(rawCode) {
  const code = String(rawCode || '').trim().toLowerCase();
  if (!code) { showToast('Enter a code first.'); return; }
  const redeemed = loadRedeemedCodes();
  if (redeemed.includes(code)) { showToast('That code has already been redeemed on this device.'); return; }

  if (code === 'leo') {
    const col = loadCollection();
    const unownedUnits = ALL_NONBLUE_UNIT_IDS.filter(id => !col.units.includes(id));
    const unownedSpells = ALL_SPELL_IDS.filter(id => !col.spells.includes(id));
    const unownedChips = ALL_CHIP_IDS.filter(id => !col.chips.includes(id));
    let pool = shuffleArray(
      unownedUnits.map(id => ({ id, kind: 'unit' }))
        .concat(unownedSpells.map(id => ({ id, kind: 'spell' })))
        .concat(unownedChips.map(id => ({ id, kind: 'chip' })))
    );
    let isFullCollection = false;
    if (pool.length === 0) {
      isFullCollection = true;
      pool = shuffleArray(
        ALL_NONBLUE_UNIT_IDS.map(id => ({ id, kind: 'unit' }))
          .concat(ALL_SPELL_IDS.map(id => ({ id, kind: 'spell' })))
          .concat(ALL_CHIP_IDS.map(id => ({ id, kind: 'chip' })))
      );
      addBux(300);
      recordEconomyChange(300, 'Redeemed code: Leo (Full Collection Bonus)');
    }
    const count = 2;
    const granted = pool.slice(0, count);
    if (!isFullCollection) {
      granted.forEach(g => {
        if (g.kind === 'unit') { if (!col.units.includes(g.id)) col.units.push(g.id); }
        else if (g.kind === 'spell') { if (!col.spells.includes(g.id)) col.spells.push(g.id); }
        else { if (!col.chips.includes(g.id)) col.chips.push(g.id); }
      });
      saveCollection(col);
      updateThemeButtons();
      if (typeof checkMilestones === 'function') checkMilestones();
      else if (typeof checkAchievements === 'function') checkAchievements();
    }
    grantPlayerXP(25, 'Leo Pack opened');
    grantWeeklyPoints(10);
    recordRecentActivity('Redeemed code "Leo" — opened a Small Card Pack');

    const cardsForReveal = granted.map(g => {
      if (g.kind === 'unit') {
        const arch = findArchetypeById(g.id);
        return { name: arch ? arch.name : 'Unknown Unit', tier: arch ? arch.tier : 2, kind: 'unit' };
      }
      const def = (g.kind === 'spell' ? SPELL_DEFS : CHIP_DEFS).find(d => d.id === g.id);
      return { name: def ? def.name : 'Secret Card', tier: null, kind: g.kind };
    });

    playPackOpeningEffect(cardsForReveal, () => {
      const names = cardsForReveal.map(c => c.name);
      if (isFullCollection) {
        showToast(`🦁 Leo Pack opened: ${names.join(', ')} (Already owned: +300 Bux bonus)!`, 3600);
      } else {
        showToast(`🦁 Leo Pack opened: ${names.join(', ')} added to your collection!`, 3600);
      }
      if (typeof renderCollectionScreen === 'function') renderCollectionScreen();
    });
    Sound.sparkle();
  } else if (code === 'coolsauce') {
    grantCards(ALL_NONBLUE_UNIT_IDS.slice(), ALL_SPELL_IDS.slice(), ALL_CHIP_IDS.slice());
    const owned = loadOwnedCosmetics();
    COSMETIC_ITEMS.forEach(c => { if (!owned.includes(c.id)) owned.push(c.id); });
    saveOwnedCosmetics(owned);
    addBux(1000000);
    recordEconomyChange(1000000, 'Redeemed code: coolsauce');
    recordRecentActivity('Redeemed code "coolsauce" — unlocked everything + 1,000,000 Bux');
    if (typeof checkMilestones === 'function') checkMilestones();
    else if (typeof checkAchievements === 'function') checkAchievements();
    updateThemeButtons();
    showToast('🎉 Code redeemed! Everything unlocked + 1,000,000 Bux.', 3800);
    Sound.sparkle();
  } else if (code === 'prism' || code === 'prismcore' || code === 'diamond' || code === 'darkmatter') {
    try {
      localStorage.setItem('theme_prism_unlocked', 'true');
      localStorage.setItem('theme_darkmatter_unlocked', 'true');
    } catch (e) {}
    updateThemeButtons();
    if (typeof applyTheme === 'function') applyTheme('prism');
    recordRecentActivity('Redeemed secret code — unlocked & equipped Prism Core theme!');
    showToast('💎 Prism Core theme unlocked and equipped!', 3800);
    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
  } else if (code === '2ndyear') {
    unlockValentineTheme();
    recordRecentActivity('Redeemed a secret code — unlocked the Valentine theme');
    showToast('💘 Secret theme unlocked! Open Options → Themes to wear it.', 3800);
    Sound.sparkle();
  } else if (code === 'jackpot') {
    addBux(2500);
    recordEconomyChange(2500, 'Redeemed code: jackpot');
    recordRecentActivity('Redeemed code "jackpot" — +2,500 Bux');
    showToast('💰 JACKPOT! +2,500 Mehrbod Bux added to your vault.', 3600);
    Sound.sparkle();
  } else if (code === 'royalty') {
    const owned = loadOwnedCosmetics();
    const hasSleeve = owned.includes('sleeve_gold');
    if (!hasSleeve) {
      owned.push('sleeve_gold');
      saveOwnedCosmetics(owned);
      if (typeof equipSleeve === 'function') equipSleeve('sleeve_gold');
      addBux(500);
      recordEconomyChange(500, 'Redeemed code: royalty (Gold Sleeves + 500 Bux)');
      recordRecentActivity('Redeemed code "royalty" — unlocked ✨ Gold Sleeves + 500 Bux');
      showToast('👑 Royalty redeemed! ✨ Gold Sleeves equipped + 500 Bux.', 3800);
    } else {
      addBux(1000);
      recordEconomyChange(1000, 'Redeemed code: royalty (+1,000 Bux)');
      recordRecentActivity('Redeemed code "royalty" — +1,000 Bux');
      showToast('👑 Royalty redeemed! You already own Gold Sleeves, so here is +1,000 Bux!', 3800);
    }
    Sound.sparkle();
  } else if (code === 'lucky7') {
    addBux(777);
    recordEconomyChange(777, 'Redeemed a secret code');
    recordRecentActivity('Redeemed a secret code — +777 Bux');
    showToast('🎰 Lucky Sevens! +777 Mehrbod Bux added to your balance.', 3600);
    Sound.sparkle();
  } else if (code === 'cybergrid') {
    grantCards([], [], ALL_CHIP_IDS.slice());
    grantArenaRP(75);
    addBux(400);
    recordEconomyChange(400, 'Redeemed a secret code');
    recordRecentActivity('Redeemed a secret code — Chips unlocked + 75 Arena RP + 400 Bux');
    if (typeof checkMilestones === 'function') checkMilestones();
    else if (typeof checkAchievements === 'function') checkAchievements();
    showToast('⚡ System Overdrive! All Chips unlocked + 75 Arena RP + 400 Bux.', 4000);
    Sound.sparkle();
  } else if (code === 'givemelava') {
    const owned = loadOwnedCosmetics();
    const alreadyOwned = owned.includes('theme_magma');
    if (!alreadyOwned) {
      owned.push('theme_magma');
      saveOwnedCosmetics(owned);
      if (typeof updateThemeButtons === 'function') updateThemeButtons();
    }
    if (typeof applyTheme === 'function') applyTheme('magma');
    if (alreadyOwned) {
      addBux(600);
      recordEconomyChange(600, 'Redeemed code: GIVEMELAVA (+600 Bux bonus)');
      recordRecentActivity('Redeemed code "GIVEMELAVA" — equipped Magma theme + 600 Bux bonus');
      showToast('🌋 Magma theme equipped! You already owned it, so here is +600 Bux!', 3800);
    } else {
      recordRecentActivity('Redeemed code "GIVEMELAVA" — unlocked the 🌋 Magma theme');
      showToast('🌋 The molten core awakes! 🌋 Magma theme unlocked & equipped!', 3800);
    }
    Sound.sparkle();
  } else if (code === 'stargazer') {
    addBux(350);
    recordEconomyChange(350, 'Redeemed a secret code');
    grantPlayerXP(80);
    grantWeeklyPoints(25);
    recordRecentActivity('Redeemed a secret code — +350 Bux + 80 XP + 25 Vault Pts');
    showToast('✨ Celestial boon granted! +350 Bux, 80 Player XP & 25 Vault Points.', 3800);
    Sound.sparkle();
  } else {
    showToast("That code isn't valid.");
    return; // don't burn an attempt on a code that never worked
  }

  const inputEl = document.getElementById('shop-code-input');
  if (inputEl) inputEl.value = '';

  redeemed.push(code);
  saveRedeemedCodes(redeemed);
  renderCosmeticsShop();
}

/* ---------- Secret Valentine theme: unlock, DOM injection, persistence -- */
function isValentineThemeUnlocked() { return loadRedeemedCodes().includes('2ndyear'); }

function ensureValentineBgLayer() {
  if (document.getElementById('theme-valentine-bg')) return;
  const bg = document.createElement('div');
  bg.id = 'theme-valentine-bg';
  bg.setAttribute('aria-hidden', 'true');
  let html = '<div class="valentine-cupid-glow"></div>';
  const heartGlyphs = ['💗', '💕', '❤️', '💖'];
  for (let i = 0; i < 18; i++) {
    const left = (Math.random() * 100).toFixed(1);
    const dur = (7 + Math.random() * 7).toFixed(2);
    const delay = (Math.random() * 9).toFixed(2);
    const size = (0.7 + Math.random() * 1.1).toFixed(2);
    const glyph = heartGlyphs[Math.floor(Math.random() * heartGlyphs.length)];
    html += `<span class="valentine-heart" style="left:${left}%; animation-duration:${dur}s; animation-delay:${delay}s; font-size:${size}rem;">${glyph}</span>`;
  }
  for (let i = 0; i < 3; i++) {
    const top = (10 + Math.random() * 60).toFixed(1);
    const delay = (i * 2.4 + Math.random() * 2).toFixed(2);
    html += `<div class="valentine-arrow" style="top:${top}%; animation-delay:${delay}s;"></div>`;
  }
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function ensureValentineThemeButton() {
  if (document.getElementById('theme-btn-valentine')) return;
  const container = document.getElementById('theme-options');
  if (!container) return;
  const btn = document.createElement('button');
  btn.className = 'theme-btn valentine-theme-btn';
  btn.id = 'theme-btn-valentine';
  btn.dataset.theme = 'valentine';
  btn.title = 'A secret Valentine theme!';
  btn.innerHTML = `<span class="theme-icon">💘</span><span>Valentine</span>`;
  btn.addEventListener('click', () => applyTheme('valentine'));
  container.appendChild(btn);
  updateThemeButtons();
}

if (typeof THEME_UNLOCK_CHECK !== 'undefined') THEME_UNLOCK_CHECK.valentine = () => isValentineThemeUnlocked();
if (typeof THEME_LOCK_MESSAGE !== 'undefined') THEME_LOCK_MESSAGE.valentine = "💘 This one's a secret - you'll need the right code.";
if (typeof ALL_THEME_NAMES !== 'undefined' && Array.isArray(ALL_THEME_NAMES) && !ALL_THEME_NAMES.includes('valentine')) {
  ALL_THEME_NAMES.push('valentine');
}
(function wrapThemeDisplayNameForValentine() {
  const original = window.themeDisplayName;
  if (typeof original !== 'function') return;
  window.themeDisplayName = function (t) { return t === 'valentine' ? 'Valentine' : original(t); };
})();

function unlockValentineTheme() {
  ensureValentineBgLayer();
  ensureValentineThemeButton();
}
(function initValentineThemeIfUnlocked() {
  if (!isValentineThemeUnlocked()) return;
  ensureValentineBgLayer();
  ensureValentineThemeButton();
  try { if (localStorage.getItem('mehrbod-cards-theme') === 'valentine') applyTheme('valentine'); } catch (e) {}
})();

function renderCosmeticsShop() {
  const list = document.getElementById('shop-cosmetics-list');
  if (!list) return;

  const balance = loadBux();
  const equippedSleeve = loadEquippedSleeve();
  const picks = buildTodaysShopPicks();

  const cosmeticItems = picks.cosmeticIds.map(id => COSMETIC_ITEMS.find(c => c.id === id)).filter(Boolean);

  const kindLabels = { theme: 'THEME', sleeve: 'SLEEVE', effect: 'VICTORY EFFECT', victoryAnim: 'FINISHER' };
  const rarityClass = {
    MYTHIC: 'fn-mythic',
    LEGENDARY: 'fn-legendary',
    EPIC: 'fn-epic',
    RARE: 'fn-rare',
    UNCOMMON: 'fn-uncommon'
  };

  // Clean Fortnite-style Cosmetic Tile
  const cosmeticCard = (item) => {
    const isOwned = ownsCosmetic(item.id);
    const isEquipped = item.kind === 'sleeve' && equippedSleeve === item.id;
    const discount = item.original && item.original > item.cost
      ? Math.round((1 - item.cost / item.original) * 100) : 0;
    const rarity = item.rarity || 'RARE';
    const rClass = rarityClass[rarity] || 'fn-rare';

    return `
      <div class="fn-tile ${rClass} ${isOwned ? 'is-owned' : ''}" data-shop-buy="cosmetic:${item.id}">
        <div class="fn-tile-bg"></div>
        <div class="fn-tile-top">
          ${discount ? `<span class="fn-tag fn-tag-sale">-${discount}%</span>` : `<span class="fn-tag">${rarity}</span>`}
        </div>
        <div class="fn-tile-art">
          <span class="fn-tile-icon">${item.art || '★'}</span>
        </div>
        <div class="fn-tile-footer">
          <div class="fn-tile-name">${item.name}</div>
          <div class="fn-tile-sub">${kindLabels[item.kind] || 'COSMETIC'}</div>
          <div class="fn-tile-price-row">
            ${isOwned ? (isEquipped ? '<span class="fn-pill fn-pill-equipped">EQUIPPED</span>' : (item.kind === 'sleeve' ? '<span class="fn-pill fn-pill-owned">EQUIP</span>' : '<span class="fn-pill fn-pill-owned">OWNED</span>')) : `
              <div class="fn-price">
                <span class="fn-coin">◉</span>
                <span class="fn-cost">${item.cost.toLocaleString()}</span>
                ${discount ? `<del class="fn-del">${item.original.toLocaleString()}</del>` : ''}
              </div>
            `}
          </div>
        </div>
      </div>`;
  };

  // Clean Fortnite-style Single Card Tile
  const cardEntryCard = (entry) => {
    const isOwned = isIndividualCardOwned(entry);
    const tierName = entry.kind === 'unit' ? (TIERS[entry.tier] ? `Tier ${entry.tier} Unit` : 'Unit') : (entry.kind === 'spell' ? 'Spell Card' : 'Chip Card');
    const rClass = entry.tier === 4 ? 'fn-mythic' : entry.tier === 3 ? 'fn-epic' : entry.kind === 'spell' ? 'fn-legendary' : 'fn-rare';
    const glyph = entry.kind === 'unit' ? (TIER_GLYPHS && entry.tier ? TIER_GLYPHS[entry.tier] : '⚔️') : (entry.kind === 'spell' ? '🔮' : '💾');

    return `
      <div class="fn-tile ${rClass} ${isOwned ? 'is-owned' : ''}" data-shop-buy="card:${entry.kind}:${entry.id}">
        <div class="fn-tile-bg"></div>
        <div class="fn-tile-top">
          <span class="fn-tag">${entry.kind.toUpperCase()}</span>
          ${entry.power ? `<span class="fn-power-tag">PWR ${entry.power}</span>` : ''}
        </div>
        <div class="fn-tile-art">
          <span class="fn-tile-icon">${glyph}</span>
        </div>
        <div class="fn-tile-footer">
          <div class="fn-tile-name">${entry.name}</div>
          <div class="fn-tile-sub">${tierName.toUpperCase()}</div>
          <div class="fn-tile-price-row">
            ${isOwned ? '<span class="fn-pill fn-pill-owned">OWNED</span>' : `
              <div class="fn-price">
                <span class="fn-coin">◉</span>
                <span class="fn-cost">${entry.cost.toLocaleString()}</span>
              </div>
            `}
          </div>
        </div>
      </div>`;
  };

  // Clean Fortnite-style Pack Tile
  const packCard = (p) => `
    <div class="fn-tile fn-epic" data-shop-buy="pack:${p.id}">
      <div class="fn-tile-bg"></div>
      <div class="fn-tile-top">
        <span class="fn-tag">${p.tag || 'PACK'}</span>
        <span class="fn-power-tag">${p.count} CARDS</span>
      </div>
      <div class="fn-tile-art">
        <span class="fn-tile-icon">${p.art}</span>
      </div>
      <div class="fn-tile-footer">
        <div class="fn-tile-name">${p.name}</div>
        <div class="fn-tile-sub">${p.badge || `${p.count} Cards Unbox`}</div>
        <div class="fn-tile-price-row">
          <div class="fn-price">
            <span class="fn-coin">◉</span>
            <span class="fn-cost">${p.cost.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>`;

  list.innerHTML = `
    <div class="fn-shop">
      <!-- HEADER -->
      <header class="fn-shop-header">
        <div class="fn-header-left">
          <h1 class="fn-shop-title">MEHRBOD SHOP</h1>
          <div class="fn-countdown-pill">
            <span class="fn-timer-icon">⏱️</span>
            <span>REFRESHES IN</span>
            <strong id="modern-shop-countdown">23:59:59</strong>
          </div>
        </div>
        <div class="fn-wallet-pill">
          <span class="fn-wallet-coin">◉</span>
          <strong class="fn-wallet-amount">${balance.toLocaleString()}</strong>
          <span class="fn-wallet-unit">BUX</span>
        </div>
      </header>

      <!-- SECTION 1: 8 FEATURED COSMETICS -->
      <section class="fn-section">
        <div class="fn-section-bar">
          <h2 class="fn-section-title">FEATURED COSMETICS</h2>
          <span class="fn-section-badge">${cosmeticItems.length} ITEMS</span>
        </div>
        <div class="fn-grid">
          ${cosmeticItems.map(cosmeticCard).join('')}
        </div>
      </section>

      <!-- SECTION 2: 8 DAILY CARD SINGLES -->
      <section class="fn-section">
        <div class="fn-section-bar">
          <h2 class="fn-section-title">DAILY CARDS</h2>
          <span class="fn-section-badge">${picks.cards.length} ITEMS</span>
        </div>
        <div class="fn-grid">
          ${picks.cards.map(cardEntryCard).join('')}
        </div>
      </section>

      <!-- SECTION 3: 5 CARD PACKS -->
      <section class="fn-section">
        <div class="fn-section-bar">
          <h2 class="fn-section-title">CARD PACKS</h2>
          <span class="fn-section-badge">5 SIZES</span>
        </div>
        <div class="fn-grid fn-grid-packs">
          ${SHOP_PACK_SIZES.map(packCard).join('')}
        </div>
      </section>

      <!-- SECTION 4: REDEEM CODE -->
      <section class="fn-section">
        <div class="fn-section-bar">
          <h2 class="fn-section-title">REDEEM CODE</h2>
        </div>
        <div class="fn-code-box">
          <div class="fn-code-input-row">
            <input type="text" id="shop-code-input" class="fn-code-input" placeholder="ENTER SECRET CODE..." maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false">
            <button type="button" class="fn-code-btn" id="shop-code-redeem-btn">REDEEM</button>
          </div>
        </div>
      </section>
    </div>`;

  // Countdown timer
  const refresh = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const diff = Math.max(0, tomorrow - now);
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const min = String(Math.floor(diff / 60000) % 60).padStart(2, '0');
    const sec = String(Math.floor(diff / 1000) % 60).padStart(2, '0');
    const el = document.getElementById('modern-shop-countdown');
    if (el) el.textContent = `${h}:${min}:${sec}`;
  };
  refresh();
  clearInterval(window.__mehrbodShopTimer);
  window.__mehrbodShopTimer = setInterval(refresh, 1000);

  // Quick code button clicks
  list.querySelectorAll('[data-quick-code]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.quickCode;
      const input = document.getElementById('shop-code-input');
      if (input) {
        input.value = code;
        redeemShopCode(code);
      }
    });
  });

  // Tile clicks (buy/equip)
  list.querySelectorAll('[data-shop-buy]').forEach(tile => {
    tile.addEventListener('click', () => {
      const [kind, a, b] = tile.dataset.shopBuy.split(':');
      if (kind === 'cosmetic') {
        const item = COSMETIC_ITEMS.find(c => c.id === a);
        if (item) buyOrEquipCosmetic(item);
      } else if (kind === 'pack') {
        const size = SHOP_PACK_SIZES.find(p => p.id === a);
        if (size) buyCardPackSized(size.count, size.cost, size.name);
      } else if (kind === 'card') {
        const entry = picks.cards.find(c => c.kind === a && String(c.id) === b);
        if (entry) buyIndividualCard(entry);
      }
    });
  });

  // Code input & button
  const codeInput = document.getElementById('shop-code-input');
  const codeBtn = document.getElementById('shop-code-redeem-btn');
  if (codeBtn && codeInput) {
    codeBtn.addEventListener('click', () => redeemShopCode(codeInput.value));
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') redeemShopCode(codeInput.value); });
  }
}

/* ============================================================
   PROFILE HUD: a colored-letter avatar next to the Bux counter,
   replacing the old "📊 Stats" footer link. Clicking it opens Stats
   2.0 - a single, much more polished profile hub covering battle
   stats, the ledger/activity/match-history that used to live in the
   old Player Stats panel, AND every progression system (Player
   Level, Prestige, Arena Rank, Trial Tower, Set Bonuses, Weekly
   Vault) in one place. An exclamation badge lights up on the avatar
   whenever a Prestige is available to claim.
   ============================================================ */
const ARENA_RANK_COLORS = ['#cd7f32', '#c0c0c0', '#ffd700', '#67e8f9', '#60a5fa', '#a78bfa', '#fb7185'];

const PROFILE_GRADIENT_KEY = 'mehrbod-cards-profile-gradient';
const PROFILE_GRADIENT_PRESETS = [
  { name: 'Astral Void', c1: '#8b5cf6', c2: '#06b6d4', angle: 135 },
  { name: 'Solar Flare', c1: '#f97316', c2: '#ef4444', angle: 135 },
  { name: 'Cyber Neon', c1: '#06b6d4', c2: '#3b82f6', angle: 135 },
  { name: 'Emerald Mint', c1: '#10b981', c2: '#059669', angle: 135 },
  { name: 'Royal Gold', c1: '#eab308', c2: '#ca8a04', angle: 135 },
  { name: 'Neon Rose', c1: '#ec4899', c2: '#8b5cf6', angle: 135 },
  { name: 'Molten Magma', c1: '#dc2626', c2: '#7c2d12', angle: 135 },
  { name: 'Deep Ocean', c1: '#0284c7', c2: '#1e1b4b', angle: 135 },
  { name: 'Twilight Rune', c1: '#6366f1', c2: '#4338ca', angle: 135 },
  { name: 'Pastel Sunset', c1: '#f472b6', c2: '#fb923c', angle: 135 },
  { name: 'Toxic Volt', c1: '#84cc16', c2: '#0d9488', angle: 135 },
  { name: 'Vampire Dark', c1: '#881337', c2: '#1c1917', angle: 135 },
];

function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function loadProfileGradient() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_GRADIENT_KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.c1 && raw.c2) {
      return {
        c1: String(raw.c1),
        c2: String(raw.c2),
        angle: typeof raw.angle === 'number' ? raw.angle : 135
      };
    }
  } catch (e) {}
  return null;
}

function saveProfileGradient(grad) {
  try {
    if (!grad) {
      localStorage.removeItem(PROFILE_GRADIENT_KEY);
    } else {
      localStorage.setItem(PROFILE_GRADIENT_KEY, JSON.stringify({
        c1: grad.c1,
        c2: grad.c2,
        angle: typeof grad.angle === 'number' ? grad.angle : 135
      }));
    }
  } catch (e) {}
}

function profileAvatarColors(name) {
  let hash = 0;
  const safeName = String(name || 'Player');
  for (let i = 0; i < safeName.length; i++) hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 40) % 360;
  return {
    c1: `hsl(${hue1}, 62%, 46%)`,
    c2: `hsl(${hue2}, 62%, 34%)`,
    hex1: hslToHex(hue1, 62, 46),
    hex2: hslToHex(hue2, 62, 34)
  };
}

function getActiveProfileGradient(name) {
  const custom = loadProfileGradient();
  if (custom) {
    return { ...custom, isCustom: true };
  }
  const defaultColors = profileAvatarColors(name || loadPlayerName() || 'Player');
  return {
    c1: defaultColors.hex1 || '#8b5cf6',
    c2: defaultColors.hex2 || '#06b6d4',
    angle: 150,
    isCustom: false
  };
}

function getProfileAvatarGradientCss(name) {
  const grad = getActiveProfileGradient(name);
  return `linear-gradient(${grad.angle || 135}deg, ${grad.c1}, ${grad.c2})`;
}

function removeOldStatsFooterButton() {
  const btn = document.getElementById('btn-player-stats');
  if (!btn) return;
  const dot = btn.nextElementSibling;
  if (dot && dot.classList.contains('footer-dot')) dot.remove();
  btn.remove();
}

function ensureProfileHud() {
  let avatarBtn = document.getElementById('profile-avatar-btn');
  if (avatarBtn) {
    if (!avatarBtn.dataset.bound) {
      avatarBtn.dataset.bound = 'true';
      avatarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openProfilePanel();
      });
    }
    updateProfileAvatar();
    return;
  }

  const buxCounter = document.getElementById('bux-counter');
  if (!buxCounter || !buxCounter.parentNode) return;

  // Create top-left wrapper for profile avatar
  let leftWrapper = document.getElementById('top-left-hud');
  if (!leftWrapper) {
    leftWrapper = document.createElement('div');
    leftWrapper.id = 'top-left-hud';
    document.body.appendChild(leftWrapper);
  }

  avatarBtn = document.createElement('button');
  avatarBtn.id = 'profile-avatar-btn';
  avatarBtn.setAttribute('type', 'button');
  avatarBtn.setAttribute('aria-label', 'Open your profile');
  avatarBtn.innerHTML = `<span id="profile-avatar-letter"></span><span id="profile-prestige-badge" class="profile-exclaim hidden">!</span>`;
  avatarBtn.dataset.bound = 'true';
  avatarBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openProfilePanel();
  });
  leftWrapper.appendChild(avatarBtn);

  // Leave bux counter in top-right wrapper
  let rightWrapper = document.getElementById('top-right-hud');
  if (!rightWrapper) {
    rightWrapper = document.createElement('div');
    rightWrapper.id = 'top-right-hud';
    buxCounter.parentNode.insertBefore(rightWrapper, buxCounter);
    rightWrapper.appendChild(buxCounter);
  }

  updateProfileAvatar();
}

function updateProfileAvatar() {
  const letterEl = document.getElementById('profile-avatar-letter');
  const btn = document.getElementById('profile-avatar-btn');
  const badge = document.getElementById('profile-prestige-badge');
  if (!letterEl || !btn) return;
  const name = loadPlayerName() || 'Player';
  const letter = name.trim().charAt(0).toUpperCase() || 'P';
  letterEl.textContent = letter;
  btn.style.background = getProfileAvatarGradientCss(name);
  if (badge) badge.classList.toggle('hidden', !canPrestigeNow());
}

function renderPerformanceChart(historyItems) {
  const container = document.getElementById('performance-chart');
  if (!container) return;

  let isFallback = false;
  let activeHistory = historyItems.filter(x => x.mode === 'Multiplayer').slice(0, 10);
  if (!activeHistory.length) {
    activeHistory = historyItems.slice(0, 10);
    isFallback = activeHistory.length > 0;
  }

  const heading = document.getElementById('performance-chart-heading');
  if (heading) {
    if (!activeHistory.length) {
      heading.textContent = '📈 Match Performance';
    } else {
      heading.textContent = isFallback ? '📈 Match Performance (Vs Bot)' : '📈 Match Performance (Last 10 MP Matches)';
    }
  }

  if (!activeHistory.length) {
    container.innerHTML = `
      <div class="activity-empty" style="padding: 24px; text-align: center; font-size: 0.65rem; width: 100%;">
        📈 Play a match to start tracking your recent performance trend!
      </div>
    `;
    return;
  }

  const data = [...activeHistory].reverse().map((d, i) => {
    let score = 1; // Draw
    if (d.result === 'Win') score = 2;
    if (d.result === 'Loss') score = 0;
    return {
      index: i + 1,
      result: d.result,
      score: score,
      rounds: d.rounds,
      mode: d.mode,
      date: new Date(d.at).toLocaleDateString()
    };
  });

  // Clear container
  container.innerHTML = '';

  // Get container width
  const rect = container.getBoundingClientRect();
  const width = Math.max(340, container.clientWidth || rect.width || 340);
  const height = 150;
  const margin = { top: 20, right: 35, bottom: 25, left: 55 };

  if (typeof d3 === 'undefined') {
    const w = 500;
    const h = 120;
    const paddingLeft = 55;
    const paddingRight = 35;
    const paddingTop = 20;
    const paddingBottom = 25;

    const xStep = data.length > 1 ? (w - paddingLeft - paddingRight) / (data.length - 1) : 0;
    const yScaleVal = (score) => {
      if (score === 0) return h - paddingBottom;
      if (score === 1) return h / 2;
      return paddingTop;
    };

    let points = '';
    let circles = '';
    data.forEach((d, i) => {
      const cx = paddingLeft + i * xStep;
      const cy = yScaleVal(d.score);
      points += `${cx},${cy} `;
      const color = d.result === 'Win' ? '#10b981' : (d.result === 'Loss' ? '#ef4444' : '#f59e0b');
      circles += `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}" stroke="#1e1e24" stroke-width="1.5">
        <title>Match #${d.index}\nMode: ${d.mode}\nResult: ${d.result}\nRounds: ${d.rounds}\nDate: ${d.date}</title>
      </circle>`;
    });

    container.innerHTML = `
      <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow: visible; font-family: system-ui, -apple-system, sans-serif;">
        <line x1="${paddingLeft}" y1="${yScaleVal(0)}" x2="${w - paddingRight}" y2="${yScaleVal(0)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
        <line x1="${paddingLeft}" y1="${yScaleVal(1)}" x2="${w - paddingRight}" y2="${yScaleVal(1)}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="3,3" />
        <line x1="${paddingLeft}" y1="${yScaleVal(2)}" x2="${w - paddingRight}" y2="${yScaleVal(2)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
        
        <text x="12" y="${yScaleVal(2) + 3}" fill="#10b981" font-size="8" font-weight="bold">WIN</text>
        <text x="12" y="${yScaleVal(1) + 3}" fill="#f59e0b" font-size="8" font-weight="bold">DRAW</text>
        <text x="12" y="${yScaleVal(0) + 3}" fill="#ef4444" font-size="8" font-weight="bold">LOSS</text>

        ${data.length > 1 ? `<polyline points="${points}" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
        ${circles}
      </svg>
    `;
    return;
  }

  const svg = d3.create('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Scales
  const xScale = d3.scaleLinear()
    .domain(data.length > 1 ? [1, data.length] : [0.5, 1.5])
    .range([margin.left, width - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([-0.3, 2.3]) // Padding for aesthetic curve breathing room
    .range([height - margin.bottom, margin.top]);

  const yValues = [0, 1, 2];
  const yLabels = { 0: 'Loss 💀', 1: 'Draw 🤝', 2: 'Win 🏆' };

  // Background grid lines
  svg.selectAll('.grid-line')
    .data(yValues)
    .enter()
    .append('line')
    .attr('class', 'grid-line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', d => yScale(d))
    .attr('y2', d => yScale(d))
    .attr('stroke', 'rgba(255, 255, 255, 0.08)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,3');

  // Y-axis labels
  svg.selectAll('.y-axis-label')
    .data(yValues)
    .enter()
    .append('text')
    .attr('class', 'y-axis-label')
    .attr('x', margin.left - 12)
    .attr('y', d => yScale(d) + 3)
    .attr('text-anchor', 'end')
    .attr('fill', '#94a3b8')
    .style('font-family', 'var(--font-display, inherit)')
    .style('font-size', '10px')
    .style('font-weight', '700')
    .text(d => yLabels[d]);

  // X-axis labels
  svg.selectAll('.x-axis-label')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'x-axis-label')
    .attr('x', d => xScale(d.index))
    .attr('y', height - 6)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748b')
    .style('font-family', 'var(--font-body, inherit)')
    .style('font-size', '9px')
    .text((d, i) => `#${i + 1}`);

  // Linear gradient for line stroke
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'chart-gradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '100%')
    .attr('y2', '0%');

  gradient.StopColor = '#3b82f6';
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#3b82f6'); // bright blue

  gradient.append('stop')
    .attr('offset', '50%')
    .attr('stop-color', '#ec4899'); // pink-magenta middle

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#a855f7'); // purple end

  // Define line generator
  const line = d3.line()
    .x(d => xScale(d.index))
    .y(d => yScale(d.score))
    .curve(d3.curveMonotoneX);

  // Add the path with drawing animation
  if (data.length > 1) {
    const path = svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'url(#chart-gradient)')
      .attr('stroke-width', 3)
      .attr('d', line);

    const totalLength = path.node().getTotalLength();

    path
      .attr('stroke-dasharray', totalLength + ' ' + totalLength)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);
  }

  // Highlight points
  const dots = svg.selectAll('.dot-group')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'chart-dot-group');

  dots.append('circle')
    .attr('class', 'dot')
    .attr('cx', d => xScale(d.index))
    .attr('cy', d => yScale(d.score))
    .attr('r', 0)
    .attr('fill', d => d.result === 'Win' ? '#10b981' : (d.result === 'Loss' ? '#ef4444' : '#f59e0b'))
    .attr('stroke', '#1e1e24')
    .attr('stroke-width', 1.8)
    .style('cursor', 'pointer')
    .transition()
    .delay((d, i) => (data.length > 1 ? 400 : 0) + i * 80)
    .duration(500)
    .ease(d3.easeBackOut)
    .attr('r', 5.5);

  // Tooltip interactive overlay
  dots.append('title')
    .text(d => `Match #${d.index}\nMode: ${d.mode}\nResult: ${d.result}\nRounds: ${d.rounds}\nDate: ${d.date}`);

  container.appendChild(svg.node());
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60), s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function openProfilePanel() {
  const old = document.getElementById('profile-overlay');
  if (old) old.remove();

  const name = loadPlayerName() || 'Player';
  const letter = name.trim().charAt(0).toUpperCase() || 'P';
  const avatarGradCss = getProfileAvatarGradientCss(name);

  const info = playerLevelFromXP(loadPlayerXP());
  const xpPct = Math.round((info.into / info.need) * 100);
  const prestige = loadPrestigeState();

  const battle = getBattleStats();
  const total = battle.wins + battle.losses;
  const winRate = total ? Math.round((battle.wins / total) * 100) : 0;

  const rankState = loadArenaRankState();
  const rankIdx = arenaRankIndexFromRP(rankState.rp);
  const rankColor = ARENA_RANK_COLORS[rankIdx];
  const nextThreshold = ARENA_RANK_THRESHOLDS[rankIdx + 1];
  const rankPct = nextThreshold ? Math.round(((rankState.rp - ARENA_RANK_THRESHOLDS[rankIdx]) / (nextThreshold - ARENA_RANK_THRESHOLDS[rankIdx])) * 100) : 100;

  const vault = loadWeeklyVaultState();
  const vaultMax = WEEKLY_VAULT_TIERS[WEEKLY_VAULT_TIERS.length - 1];
  const vaultPct = Math.min(100, Math.round((vault.points / vaultMax) * 100));

  const tower = loadTrialTowerState();
  const setState = loadSetBonusState();

  const ledgerItems = getEconomyLedger();
  const activityItems = getRecentActivity();
  const historyItems = getMatchHistory();

  const overlay = document.createElement('div');
  overlay.id = 'profile-overlay';
  overlay.className = 'feature-overlay';
  overlay.innerHTML = `
    <div class="profile-panel">
      <button class="feature-close">✕</button>
      <div class="profile-hero">
        <div class="profile-hero-row">
          <div class="profile-hero-avatar" id="profile-hero-avatar" title="Click to customize profile gradient" style="background:${avatarGradCss}">${letter}</div>
          <div style="flex:1; min-width:0;">
            <div class="profile-hero-name" id="profile-name-container">
              <span id="profile-name-text">${escapePresetText(name)}</span>
              <button type="button" class="link-btn" id="btn-profile-rename" title="Change your player name">✎ rename</button>
              <button type="button" class="link-btn" id="btn-profile-color" title="Pick profile avatar gradient">🎨 color</button>
            </div>
            <div class="profile-hero-sub">
              <span class="profile-level-chip">⭐ Level ${info.level}</span>
              ${prestige.count > 0 ? `<span class="profile-level-chip" style="margin-left:6px;">✦ Prestige ${prestige.count}</span>` : ''}
            </div>
          </div>
        </div>
        <div id="profile-gradient-picker-card" class="profile-gradient-picker-card hidden"></div>
        <div class="profile-xp-track"><div class="profile-xp-fill" style="width:${xpPct}%"></div></div>
        <div class="profile-xp-label"><span>${info.into}/${info.need} XP</span><span>Level ${info.level + 1}</span></div>
        ${canPrestigeNow() ? `<button type="button" class="primary-btn small" id="btn-profile-prestige" style="margin-top:12px;">✦ Prestige Now</button>` : ''}
      </div>
      <div class="profile-body">
        <!-- Profile Tabs -->
        <div class="profile-tabs" style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
          <button type="button" class="profile-tab-btn active" data-tab="overview" style="flex:1; padding: 8px 12px; border-radius: 8px; background: rgba(125,211,252,0.15); color: #7dd3fc; border: 1px solid rgba(125,211,252,0.3); font-weight: 700; font-size: 0.8rem; cursor: pointer;">Overview & Ledger</button>
          <button type="button" class="profile-tab-btn" data-tab="performance" style="flex:1; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.05); color: var(--muted); border: 1px solid rgba(255,255,255,0.08); font-weight: 700; font-size: 0.8rem; cursor: pointer;">📈 Performance Trend</button>
        </div>

        <div id="profile-tab-content-overview" class="profile-tab-content">
          <!-- Visual Win Streak Tracker Banner -->
          <div class="profile-streak-banner ${battle.streak >= 3 ? 'on-fire' : (battle.streak > 0 ? 'sparked' : 'extinguished')}">
            <div class="psb-flame">🔥</div>
            <div class="psb-content">
              <div class="psb-title">Win Streak: <b>${battle.streak}</b></div>
              <div class="psb-subtitle">
                ${battle.streak === 0 ? 'Win consecutive matches to spark your victory flame!' : 
                  (battle.streak >= 3 ? 'ON FIRE! Keep dominating the arena!' : 'Streak sparked! Keep the flame alive!')}
              </div>
            </div>
            ${battle.streak > 0 ? `<div class="psb-badge">×${battle.streak}</div>` : ''}
          </div>

          <div class="profile-stat-row">
            <div class="profile-stat-pill"><b>${battle.wins}</b><span>Wins</span></div>
            <div class="profile-stat-pill"><b>${battle.losses}</b><span>Losses</span></div>
            <div class="profile-stat-pill"><b>${winRate}%</b><span>Win Rate</span></div>
            <div class="profile-stat-pill"><b>${battle.streak}</b><span>Streak</span></div>
            <div class="profile-stat-pill"><b>${battle.bestStreak}</b><span>Best Streak</span></div>
            <div class="profile-stat-pill"><b>${battle.biggestWin}</b><span>Biggest Win</span></div>
            <div class="profile-stat-pill"><b>${battle.wagerWon - battle.wagerLost >= 0 ? '+' : ''}${battle.wagerWon - battle.wagerLost} Bux</b><span>Net Wager</span></div>
          </div>
          <button type="button" class="secondary-btn small" id="btn-profile-watch-replay" style="margin-top:10px; width:100%;">▶ Watch Last Match Replay</button>

          <div class="profile-section-heading">Progression</div>
          <div class="profile-cards-grid">
            <div class="profile-prog-card" style="--card-color:${rankColor}">
              <div class="ppc-icon">🏅</div>
              <div class="ppc-title">Arena Rank</div>
              <div class="ppc-value">${ARENA_RANKS[rankIdx]}</div>
              <div class="ppc-desc">${rankState.rp} RP${nextThreshold ? ` · ${nextThreshold - rankState.rp} to next` : ' · Top rank!'}</div>
              <div class="ppc-bar"><div class="ppc-bar-fill" style="width:${rankPct}%"></div></div>
            </div>
            <div class="profile-prog-card" style="--card-color:#22d3ee">
              <div class="ppc-icon">🗝️</div>
              <div class="ppc-title">Weekly Vault</div>
              <div class="ppc-value">${vault.points} pts</div>
              <div class="ppc-desc">${vault.claimedTiers.length}/${WEEKLY_VAULT_TIERS.length} tiers claimed</div>
              <div class="ppc-bar"><div class="ppc-bar-fill" style="width:${vaultPct}%"></div></div>
            </div>
            <div class="profile-prog-card" id="profile-card-trial-tower" style="--card-color:#f97316; cursor:pointer;" title="Click to open Trial Tower">
              <div class="ppc-icon">🗼</div>
              <div class="ppc-title">Trial Tower</div>
              <div class="ppc-value">Floor ${tower.floor}</div>
              <div class="ppc-desc">Best ever: Floor ${tower.best} · Click to open</div>
            </div>
            <div class="profile-prog-card" style="--card-color:#a78bfa">
              <div class="ppc-icon">🧩</div>
              <div class="ppc-title">Set Bonuses</div>
              <div class="ppc-value">${setState.claimed.length}/${SET_DEFS.length}</div>
              <div class="ppc-desc">Sets fully collected</div>
            </div>
          </div>

          <div class="profile-section-heading">◈ Bux Ledger</div>
          <div class="ledger-list">
            ${ledgerItems.length ? ledgerItems.slice(0, 12).map(x => `
              <div class="${x.amount >= 0 ? 'gain' : 'loss'}">
                <b>${x.amount >= 0 ? '+' : ''}${x.amount} Bux</b>
                <span>${escapePresetText(x.reason)}</span>
                <small>${new Date(x.at).toLocaleString()}</small>
              </div>`).join('') : '<p class="activity-empty">No balance changes have been recorded yet.</p>'}
          </div>

          <div class="profile-section-heading">◷ Recent Activity</div>
          <div class="activity-list">
            ${activityItems.length ? activityItems.map(x => `<div><span>✦</span><p>${escapePresetText(x.text)}<small>${new Date(x.at).toLocaleString()}</small></p></div>`).join('') : '<p class="activity-empty">Your important rewards and purchases will appear here.</p>'}
          </div>
        </div>

        <div id="profile-tab-content-performance" class="profile-tab-content" style="display: none;">
          <div class="profile-section-heading" id="performance-chart-heading">📈 Match Performance History</div>
          <div class="match-performance-section">
            <div id="performance-chart" class="performance-chart"></div>
          </div>

          <div class="profile-section-heading">⚙️ Adaptive Bot Algorithm Trend (Last 10 Matches)</div>
          <div class="match-performance-section" style="padding: 12px; background: rgba(255,255,255,0.02);">
            <div style="font-size: 0.75rem; color: var(--muted); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
              <span>Current Adaptive Difficulty:</span>
              <span id="profile-adaptive-level-badge" style="font-size: 0.7rem; font-weight: 700; background: rgba(125,211,252,0.15); color: #7dd3fc; padding: 2px 8px; border-radius: 6px;">Medium</span>
            </div>
            <div id="adaptive-profile-chart-container" style="width: 100%; height: 110px; position: relative;"></div>
            <div style="font-size: 0.65rem; color: var(--muted); margin-top: 6px; text-align: center;">
              Tracking your last 10 bot match outcomes. The adaptive bot scales difficulty dynamically.
            </div>
          </div>

          <div class="profile-section-heading">🔮 Adaptive Algorithm Simulator</div>
          <div style="padding: 12px; background: rgba(125,211,252,0.04); border: 1px dashed rgba(125,211,252,0.2); border-radius: 10px; margin-bottom: 16px;">
            <div style="font-size: 0.75rem; color: var(--text); margin-bottom: 8px; font-weight: 600;">Simulate your next match outcome to test adaptive bot scaling:</div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="primary-btn small" id="sim-win-btn" style="flex:1; background: #10b981; border: none; font-size: 0.72rem;">🏆 Simulate Win</button>
              <button type="button" class="secondary-btn small" id="sim-draw-btn" style="flex:1; background: #f59e0b; color:#fff; border: none; font-size: 0.72rem;">🤝 Simulate Draw</button>
              <button type="button" class="secondary-btn small" id="sim-loss-btn" style="flex:1; background: #ef4444; color:#fff; border: none; font-size: 0.72rem;">💀 Simulate Loss</button>
            </div>
            <div id="sim-result-feedback" style="font-size: 0.68rem; color: #7dd3fc; margin-top: 8px; text-align: center; min-height: 16px;"></div>
          </div>

          <div class="profile-section-heading">📜 Match History Log</div>
          <div class="ledger-list">
            ${historyItems.length ? historyItems.slice(0, 10).map(x => `
              <div class="${x.result === 'Win' ? 'gain' : (x.result === 'Loss' ? 'loss' : '')}">
                <b>${x.result === 'Win' ? '🏆 Win' : x.result === 'Loss' ? '💀 Loss' : '🤝 Draw'}</b>
                <span>${escapePresetText(x.mode)} · ${x.rounds} round${x.rounds === 1 ? '' : 's'} · ${formatDuration(x.duration)}</span>
                <small>${new Date(x.at).toLocaleString()}</small>
              </div>`).join('') : '<p class="activity-empty">Finish a match to start building your history.</p>'}
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Tab switching logic
  overlay.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      overlay.querySelectorAll('.profile-tab-btn').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.style.background = active ? 'rgba(125,211,252,0.15)' : 'rgba(255,255,255,0.05)';
        b.style.color = active ? '#7dd3fc' : 'var(--muted)';
        b.style.borderColor = active ? 'rgba(125,211,252,0.3)' : 'rgba(255,255,255,0.08)';
      });
      const ov = overlay.querySelector('#profile-tab-content-overview');
      const pf = overlay.querySelector('#profile-tab-content-performance');
      [ov, pf].forEach(el => {
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight; // trigger reflow
        el.style.animation = '';
      });
      if (tab === 'overview') {
        if (ov) ov.style.display = 'block';
        if (pf) pf.style.display = 'none';
      } else {
        if (ov) ov.style.display = 'none';
        if (pf) pf.style.display = 'block';
        const perfContainer = pf.querySelector('#performance-chart');
        const adaptContainer = pf.querySelector('#adaptive-profile-chart-container');
        if (perfContainer) perfContainer.innerHTML = '';
        if (adaptContainer) adaptContainer.innerHTML = '';
        if (typeof renderPerformanceChart === 'function') renderPerformanceChart(historyItems);
        if (typeof renderAdaptiveTrendChart === 'function') renderAdaptiveTrendChart();
      }
    };
  });

  // Claim quest buttons
  overlay.querySelectorAll('.claim-quest-btn').forEach(btn => {
    btn.onclick = () => {
      const qId = btn.dataset.questId;
      const res = claimDailyQuest(qId);
      if (res) {
        showToast(`🎯 Claimed quest "${res.title}"! +${res.rewardBux} Bux`, 2800);
        overlay.remove();
        openProfilePanel();
      }
    };
  });

  // Render D3-powered Match Performance Line Chart & Adaptive Trend Chart
  renderPerformanceChart(historyItems);
  if (typeof renderAdaptiveTrendChart === 'function') {
    renderAdaptiveTrendChart();
  }

  const simFeedback = overlay.querySelector('#sim-result-feedback');
  const simulateMatch = (simResult) => {
    const history = getMatchHistory();
    const simulatedMatch = {
      result: simResult,
      mode: 'Adaptive Bot (Simulated)',
      rounds: 5,
      at: Date.now()
    };
    history.unshift(simulatedMatch);
    if (typeof renderAdaptiveTrendChart === 'function') renderAdaptiveTrendChart();
    if (simResult === 'Win') simFeedback.textContent = '✨ Simulated Win! Adaptive bot difficulty scales UP for next challenge.';
    else if (simResult === 'Loss') simFeedback.textContent = '🌱 Simulated Loss. Adaptive bot difficulty eases DOWN to help you bounce back.';
    else simFeedback.textContent = '🤝 Simulated Draw. Adaptive difficulty holds steady.';
    setTimeout(() => {
      history.shift();
      if (typeof renderAdaptiveTrendChart === 'function') renderAdaptiveTrendChart();
      simFeedback.textContent = '';
    }, 4500);
  };

  overlay.querySelector('#sim-win-btn').onclick = () => simulateMatch('Win');
  overlay.querySelector('#sim-draw-btn').onclick = () => simulateMatch('Draw');
  overlay.querySelector('#sim-loss-btn').onclick = () => simulateMatch('Loss');

  overlay.querySelector('.feature-close').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const RANDOM_NAMES = [
    'ShadowBlade', 'VoidWalker', 'Solaris', 'NeonKnight', 'StormCaller',
    'CyberDuelist', 'MysticRune', 'FrostFang', 'AetherMage', 'VortexKing',
    'ChronoPilot', 'BlazeStrike', 'EchoStriker', 'TitanGuard', 'NexusHero',
    'StarGazer', 'Mehrbodian', 'ArcaneAce', 'ApexStriker', 'OmegaByte',
    'IronClaw', 'PhantomAce', 'NovaKnight', 'RuneSeeker', 'Vanguard'
  ];

  const renameBtn = document.getElementById('btn-profile-rename');
  const nameContainer = document.getElementById('profile-name-container');

  renameBtn?.addEventListener('click', () => {
    if (!nameContainer) return;
    const currentName = loadPlayerName() || 'Player';
    nameContainer.innerHTML = `
      <div class="profile-name-edit-box">
        <input type="text" id="profile-name-input" class="profile-inline-input" value="${escapePresetText(currentName)}" maxlength="24" placeholder="Enter name..." autocomplete="off">
        <div class="profile-name-actions">
          <button type="button" class="primary-btn profile-name-btn" id="btn-profile-name-save">Save</button>
          <button type="button" class="secondary-btn profile-name-btn" id="btn-profile-name-random" title="Generate random name">🎲 Random</button>
          <button type="button" class="link-btn profile-name-btn" id="btn-profile-name-cancel">Cancel</button>
        </div>
      </div>
    `;

    const input = document.getElementById('profile-name-input');
    const saveBtn = document.getElementById('btn-profile-name-save');
    const randBtn = document.getElementById('btn-profile-name-random');
    const cancelBtn = document.getElementById('btn-profile-name-cancel');

    if (input) {
      input.focus();
      input.select();
    }

    const doSave = () => {
      const val = (input?.value || '').trim();
      if (!val) {
        if (typeof showToast === 'function') showToast('Please enter a valid name.');
        input?.focus();
        return;
      }
      if (typeof savePlayerName === 'function') {
        savePlayerName(val);
      }
      updateProfileAvatar();
      openProfilePanel();
      if (typeof showToast === 'function') showToast(`✨ Name updated to ${val}!`, 2600);
    };

    const doCancel = () => {
      openProfilePanel();
    };

    saveBtn?.addEventListener('click', doSave);
    cancelBtn?.addEventListener('click', doCancel);
    randBtn?.addEventListener('click', () => {
      const available = RANDOM_NAMES.filter(n => n !== input?.value);
      const picked = available[Math.floor(Math.random() * available.length)] || 'ApexDuelist';
      if (input) {
        input.value = picked;
        input.focus();
        input.select();
      }
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        doCancel();
      }
    });
  });

  document.getElementById('btn-profile-prestige')?.addEventListener('click', () => {
    doPrestige();
    updateProfileAvatar();
    openProfilePanel();
  });

  // Profile Gradient Picker Setup
  const pickerCard = overlay.querySelector('#profile-gradient-picker-card');
  const heroAvatar = overlay.querySelector('#profile-hero-avatar');
  const colorBtn = document.getElementById('btn-profile-color');

  const renderPickerContent = () => {
    if (!pickerCard) return;
    const currentName = loadPlayerName() || 'Player';
    const currentGrad = getActiveProfileGradient(currentName);
    const defaultNameColors = profileAvatarColors(currentName);
    const isAuto = !currentGrad.isCustom;

    pickerCard.innerHTML = `
      <div class="picker-heading-row">
        <div class="picker-title">🎨 Avatar Gradient Customizer</div>
        <button type="button" class="link-btn" id="btn-picker-close">✕ close</button>
      </div>

      <div>
        <div class="picker-presets-label">Preset Palettes</div>
        <div class="picker-presets-grid">
          <button type="button" class="picker-preset-dot auto-default ${isAuto ? 'active' : ''}" 
            data-preset="auto" 
            title="Auto: Derived from player name (${defaultNameColors.hex1} ➔ ${defaultNameColors.hex2})" 
            style="background:linear-gradient(150deg, ${defaultNameColors.hex1}, ${defaultNameColors.hex2});"></button>
          ${PROFILE_GRADIENT_PRESETS.map((p, idx) => {
            const isMatch = currentGrad.isCustom && currentGrad.c1.toLowerCase() === p.c1.toLowerCase() && currentGrad.c2.toLowerCase() === p.c2.toLowerCase();
            return `<button type="button" class="picker-preset-dot ${isMatch ? 'active' : ''}" 
              data-preset-idx="${idx}" 
              title="${p.name} (${p.c1} ➔ ${p.c2})" 
              style="background:linear-gradient(${p.angle}deg, ${p.c1}, ${p.c2});"></button>`;
          }).join('')}
        </div>
      </div>

      <div class="picker-controls-row">
        <div class="picker-color-group">
          <span class="picker-color-label">Color 1</span>
          <input type="color" id="picker-c1" class="picker-color-input" value="${currentGrad.c1}">
          <span id="picker-c1-hex" class="picker-color-hex">${currentGrad.c1.toUpperCase()}</span>
        </div>

        <div class="picker-color-group">
          <span class="picker-color-label">Color 2</span>
          <input type="color" id="picker-c2" class="picker-color-input" value="${currentGrad.c2}">
          <span id="picker-c2-hex" class="picker-color-hex">${currentGrad.c2.toUpperCase()}</span>
        </div>

        <div class="picker-angle-group">
          <span class="picker-color-label">Angle</span>
          <input type="range" id="picker-angle" class="picker-angle-slider" min="0" max="360" step="5" value="${currentGrad.angle || 135}">
          <span id="picker-angle-val" class="picker-angle-val">${currentGrad.angle || 135}°</span>
        </div>
      </div>

      <div class="picker-actions-row">
        <button type="button" class="secondary-btn" id="btn-picker-random" title="Generate random custom gradient">🎲 Random</button>
        <button type="button" class="link-btn" id="btn-picker-reset" title="Reset to default name color">↺ Default</button>
      </div>
    `;

    const c1Input = pickerCard.querySelector('#picker-c1');
    const c2Input = pickerCard.querySelector('#picker-c2');
    const angleInput = pickerCard.querySelector('#picker-angle');
    const c1Hex = pickerCard.querySelector('#picker-c1-hex');
    const c2Hex = pickerCard.querySelector('#picker-c2-hex');
    const angleVal = pickerCard.querySelector('#picker-angle-val');
    const closeBtn = pickerCard.querySelector('#btn-picker-close');
    const randomBtn = pickerCard.querySelector('#btn-picker-random');
    const resetBtn = pickerCard.querySelector('#btn-picker-reset');

    const applyLive = (c1, c2, angle, isCustom) => {
      const gradCss = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
      if (heroAvatar) heroAvatar.style.background = gradCss;
      const hudBtn = document.getElementById('profile-avatar-btn');
      if (hudBtn) hudBtn.style.background = gradCss;

      if (isCustom) {
        saveProfileGradient({ c1, c2, angle });
      } else {
        saveProfileGradient(null);
      }
    };

    closeBtn?.addEventListener('click', () => {
      pickerCard.classList.add('hidden');
    });

    c1Input?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (c1Hex) c1Hex.textContent = val.toUpperCase();
      applyLive(val, c2Input.value, parseInt(angleInput.value, 10), true);
      pickerCard.querySelectorAll('.picker-preset-dot').forEach(d => d.classList.remove('active'));
    });

    c2Input?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (c2Hex) c2Hex.textContent = val.toUpperCase();
      applyLive(c1Input.value, val, parseInt(angleInput.value, 10), true);
      pickerCard.querySelectorAll('.picker-preset-dot').forEach(d => d.classList.remove('active'));
    });

    angleInput?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (angleVal) angleVal.textContent = `${val}°`;
      applyLive(c1Input.value, c2Input.value, val, true);
    });

    pickerCard.querySelectorAll('.picker-preset-dot[data-preset="auto"]').forEach(dot => {
      dot.addEventListener('click', () => {
        saveProfileGradient(null);
        applyLive(defaultNameColors.hex1, defaultNameColors.hex2, 150, false);
        renderPickerContent();
        if (typeof showToast === 'function') showToast('↺ Avatar gradient reset to name default.');
      });
    });

    pickerCard.querySelectorAll('.picker-preset-dot[data-preset-idx]').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.getAttribute('data-preset-idx'), 10);
        const preset = PROFILE_GRADIENT_PRESETS[idx];
        if (!preset) return;
        saveProfileGradient(preset);
        applyLive(preset.c1, preset.c2, preset.angle, true);
        renderPickerContent();
        if (typeof showToast === 'function') showToast(`✨ Applied "${preset.name}" gradient!`);
      });
    });

    randomBtn?.addEventListener('click', () => {
      const rHex = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
      const rc1 = rHex();
      const rc2 = rHex();
      const rAngle = [0, 45, 90, 135, 150, 180, 225, 270, 315][Math.floor(Math.random() * 9)];
      saveProfileGradient({ c1: rc1, c2: rc2, angle: rAngle });
      applyLive(rc1, rc2, rAngle, true);
      renderPickerContent();
      if (typeof showToast === 'function') showToast('🎲 Rolled random profile gradient!');
    });

    resetBtn?.addEventListener('click', () => {
      saveProfileGradient(null);
      applyLive(defaultNameColors.hex1, defaultNameColors.hex2, 150, false);
      renderPickerContent();
      if (typeof showToast === 'function') showToast('↺ Avatar gradient reset to name default.');
    });
  };

  const togglePicker = () => {
    if (!pickerCard) return;
    if (pickerCard.classList.contains('hidden')) {
      renderPickerContent();
      pickerCard.classList.remove('hidden');
    } else {
      pickerCard.classList.add('hidden');
    }
  };

  heroAvatar?.addEventListener('click', togglePicker);
  colorBtn?.addEventListener('click', togglePicker);

  document.getElementById('profile-card-trial-tower')?.addEventListener('click', () => {
    overlay.remove();
    openTrialTowerScreen();
  });

  document.getElementById('btn-profile-watch-replay')?.addEventListener('click', () => {
    overlay.remove();
    if (typeof watchLastReplay === 'function') watchLastReplay();
  });
}

removeOldStatsFooterButton();
ensureProfileHud();
document.addEventListener('DOMContentLoaded', ensureProfileHud);
window.addEventListener('load', ensureProfileHud);
(function wrapShowScreenForProfileHud() {
  const original = window.showScreen;
  if (typeof original !== 'function') return;
  window.showScreen = function (id) {
    original(id);
    document.getElementById('top-right-hud')?.classList.toggle('hidden', id === 'screen-game');
    document.getElementById('top-left-hud')?.classList.toggle('hidden', id === 'screen-game');
    updateProfileAvatar();
  };
})();
(function wrapSavePlayerNameForProfileHud() {
  const original = window.savePlayerName;
  if (typeof original !== 'function') return;
  window.savePlayerName = function (name) {
    const ok = original(name);
    if (ok) updateProfileAvatar();
    return ok;
  };
})();

/* Explain the new progression systems during the guided menu tour, right
   before the "let's actually play" closer. */
(function injectProgressionTutorialStep() {
  if (typeof MENU_TOUR_STEPS === 'undefined' || !Array.isArray(MENU_TOUR_STEPS) || !MENU_TOUR_STEPS.length) return;
  const newStep = {
    text: "👤 Your profile picture (top-right, next to your Bux) opens Stats 2.0 - your wins, Player Level, and four extra progression tracks worth checking often: 🏅 Arena Rank (a rising/falling competitive ladder), ✦ Prestige (reset your level for a permanent bonus once you're high enough - watch for a ! badge on your avatar), 🗼 Trial Tower (an endless run of tougher bot fights from the Single Player menu), and 🗝️ the Weekly Vault (bonus Bux for a good week).",
    target: () => document.getElementById('profile-avatar-btn'),
  };
  MENU_TOUR_STEPS.splice(MENU_TOUR_STEPS.length - 1, 0, newStep);
})();

/* ============================================================
   SECRET MENU // 5-TAP "M" CIPHER OVERRIDE
   ============================================================ */
(function initSecretMenuSystem() {
  let mClickCount = 0;
  let mResetTimer = null;
  const mTrigger = document.getElementById('secret-m-trigger');
  const overlay = document.getElementById('secret-menu-overlay');
  const closeBtn = document.getElementById('btn-secret-close');
  const authForm = document.getElementById('secret-auth-form');
  const cipherInput = document.getElementById('secret-cipher-input');
  const authStatus = document.getElementById('secret-auth-status');
  const stageAuth = document.getElementById('secret-stage-auth');
  const stageUnlocked = document.getElementById('secret-stage-unlocked');
  const unlockAllCardsBtn = document.getElementById('btn-secret-unlock-all-cards');
  const unlockAllCosmeticsBtn = document.getElementById('btn-secret-unlock-all-cosmetics') || document.getElementById('btn-secret-unlock-all-themes');
  const showCodesBtn = document.getElementById('btn-secret-show-codes');
  const codesManifest = document.getElementById('secret-codes-manifest');
  const execResult = document.getElementById('secret-exec-result');

  function renderCodesManifest() {
    if (!codesManifest) return;
    const redeemed = loadRedeemedCodes();
    codesManifest.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; padding:0 2px;">
        <span style="font-family:monospace; font-size:0.75rem; color:#38bdf8; letter-spacing:0.05em; font-weight:700;">CLASSIFIED SHOP PROMO CODES (${ALL_MEHRBOD_SHOP_CODES.length})</span>
        <span style="font-family:monospace; font-size:0.7rem; color:#c4b5fd;">${redeemed.length}/${ALL_MEHRBOD_SHOP_CODES.length} Claimed</span>
      </div>
    ` + ALL_MEHRBOD_SHOP_CODES.map(item => {
      const isRedeemed = redeemed.includes(item.code.toLowerCase());
      return `
        <div class="secret-code-item">
          <div class="secret-code-left">
            <div class="secret-code-tag">${item.icon} ${item.code}</div>
            <div class="secret-code-desc">${item.reward}</div>
          </div>
          <div>
            ${isRedeemed 
              ? `<button type="button" class="secret-code-redeem-btn redeemed" disabled>CLAIMED</button>`
              : `<button type="button" class="secret-code-redeem-btn" data-shop-code="${item.code}">⚡ REDEEM</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    codesManifest.querySelectorAll('.secret-code-redeem-btn[data-shop-code]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const codeToRedeem = btn.getAttribute('data-shop-code');
        if (codeToRedeem) {
          redeemShopCode(codeToRedeem);
          renderCodesManifest();
        }
      });
    });
  }

  function openSecretMenu() {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    stageAuth?.classList.remove('hidden');
    stageUnlocked?.classList.add('hidden');
    if (cipherInput) {
      cipherInput.value = '';
      setTimeout(() => cipherInput.focus(), 100);
    }
    if (authStatus) {
      authStatus.textContent = '';
      authStatus.className = 'secret-status-line';
    }
    if (execResult) {
      execResult.textContent = '';
      execResult.classList.add('hidden');
    }
    if (typeof playSound === 'function') {
      try { playSound('menu'); } catch (e) {}
    }
  }

  function closeSecretMenu() {
    overlay?.classList.add('hidden');
  }

  if (mTrigger) {
    mTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      mClickCount++;
      clearTimeout(mResetTimer);

      if (mClickCount >= 5) {
        mClickCount = 0;
        if (typeof fireConfetti === 'function') fireConfetti();
        openSecretMenu();
      } else {
        mResetTimer = setTimeout(() => {
          mClickCount = 0;
        }, 3500);
      }
    });
  }

  closeBtn?.addEventListener('click', closeSecretMenu);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeSecretMenu();
  });

  authForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = (cipherInput?.value || '').trim();
    if (entered.toLowerCase() === 'ohio') {
      // Access Granted!
      if (authStatus) {
        authStatus.textContent = 'STATUS: DECRYPT SUCCESSFUL. ACCESS GRANTED.';
        authStatus.className = 'secret-status-line success';
      }
      if (typeof fireConfetti === 'function') fireConfetti();
      setTimeout(() => {
        stageAuth?.classList.add('hidden');
        stageUnlocked?.classList.remove('hidden');
      }, 400);
    } else {
      // Access Denied
      if (authStatus) {
        authStatus.textContent = 'STATUS: ACCESS DENIED. INVALID CIPHER KEY.';
        authStatus.className = 'secret-status-line error';
      }
      const card = document.getElementById('secret-terminal-card');
      if (card) {
        card.classList.remove('terminal-shake');
        void card.offsetWidth;
        card.classList.add('terminal-shake');
      }
      if (cipherInput) {
        cipherInput.select();
        cipherInput.focus();
      }
    }
  });

  unlockAllCardsBtn?.addEventListener('click', () => {
    try {
      // Gather all unit archetypes across all tiers (Green, Red, Orange)
      const allUnitIds = (typeof getAllNonBlueUnitIds === 'function') ? getAllNonBlueUnitIds() : [2, 3, 4].flatMap(tier => (typeof UNIT_ARCHETYPES !== 'undefined' && UNIT_ARCHETYPES[tier] ? UNIT_ARCHETYPES[tier].map(a => a.id) : []));
      const allSpellIds = (typeof getAllSpellIds === 'function') ? getAllSpellIds() : ((typeof SPELL_DEFS !== 'undefined') ? SPELL_DEFS.map(s => s.id) : []);
      const allChipIds = (typeof getAllChipIds === 'function') ? getAllChipIds() : ((typeof CHIP_DEFS !== 'undefined') ? CHIP_DEFS.map(c => c.id) : []);

      if (typeof grantCards === 'function') {
        grantCards(allUnitIds, allSpellIds, allChipIds);
      } else {
        const col = {
          units: allUnitIds,
          spells: allSpellIds,
          chips: allChipIds
        };
        localStorage.setItem('mehrbod-cards-collection', JSON.stringify(col));
      }

      // Explicitly unlock Prism Core theme upon 100% card unlock
      try {
        localStorage.setItem('theme_prism_unlocked', 'true');
        localStorage.setItem('theme_darkmatter_unlocked', 'true');
      } catch (e) {}

      // Also ensure plenty of Mehrbod Bux
      if (typeof loadBux === 'function' && typeof saveBux === 'function') {
        const currentBux = loadBux();
        if (currentBux < 50000) {
          saveBux(50000);
          if (typeof updateBuxDisplay === 'function') updateBuxDisplay();
        }
      }

      // Refresh UI components
      if (typeof renderCollectionScreen === 'function') renderCollectionScreen();
      if (typeof updateThemeButtons === 'function') updateThemeButtons();
      if (typeof renderDeckBuilder === 'function') renderDeckBuilder();
      if (typeof fireConfetti === 'function') fireConfetti();
      if (typeof showToast === 'function') {
        showToast('🃏 All Cards, Spells & Chips Unlocked (100% Collection & Prism Core Theme)!', 4500);
      }

      if (execResult) {
        execResult.textContent = '✔ SUCCESS: All Units (Green/Red/Orange), Spells, and Chips unlocked! (100% Complete Collection & Prism Core Theme Unlocked)';
        execResult.className = 'secret-exec-result success';
        execResult.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Unlock all cards error:', err);
    }
  });

  unlockAllCosmeticsBtn?.addEventListener('click', () => {
    // Permanently unlock all themes & all cosmetics in local storage
    try {
      localStorage.setItem('mehrbod_all_themes_unlocked', 'true');
      localStorage.setItem('theme_prism_unlocked', 'true');
      localStorage.setItem('theme_darkmatter_unlocked', 'true');
      localStorage.setItem('theme_quantum_unlocked', 'true');
      localStorage.setItem('theme_glacier_unlocked', 'true');
      localStorage.setItem('theme_astral_unlocked', 'true');
      localStorage.setItem('theme_celestial_unlocked', 'true');
      localStorage.setItem('theme_valentine_unlocked', 'true');
      localStorage.setItem('theme_sakura_unlocked', 'true');
      localStorage.setItem('theme_solar_unlocked', 'true');
      localStorage.setItem('theme_steampunk_unlocked', 'true');
      localStorage.setItem('theme_galaxy_unlocked', 'true');
      localStorage.setItem('theme_mrmoney_unlocked', 'true');
      localStorage.setItem('theme_cyberneon_unlocked', 'true');
      localStorage.setItem('theme_abyss_unlocked', 'true');
      localStorage.setItem('theme_magma_unlocked', 'true');

      // Collect every cosmetic item across all registries
      const cosmeticIdsToUnlock = new Set(['prism', 'theme_prism', 'darkmatter', 'theme_darkmatter']);
      if (typeof COSMETIC_ITEMS !== 'undefined') {
        COSMETIC_ITEMS.forEach(c => cosmeticIdsToUnlock.add(c.id));
      }
      if (typeof THEME_DATA_REGISTRY !== 'undefined') {
        THEME_DATA_REGISTRY.forEach(t => {
          cosmeticIdsToUnlock.add(t.id);
          cosmeticIdsToUnlock.add('theme_' + t.id);
        });
      }
      if (typeof SLEEVE_DATA_REGISTRY !== 'undefined') {
        SLEEVE_DATA_REGISTRY.forEach(s => cosmeticIdsToUnlock.add(s.id));
      }
      if (typeof VICTORY_DATA_REGISTRY !== 'undefined') {
        VICTORY_DATA_REGISTRY.forEach(v => cosmeticIdsToUnlock.add(v.id));
      }

      const allCosmeticArray = [...cosmeticIdsToUnlock];
      if (typeof saveOwnedCosmetics === 'function') {
        saveOwnedCosmetics(allCosmeticArray);
      } else {
        localStorage.setItem('mehrbod-cards-owned-cosmetics', JSON.stringify(allCosmeticArray));
      }
      localStorage.setItem('mehrbod-cards-cosmetics', JSON.stringify(allCosmeticArray));

      if (typeof saveInventoryBackup === 'function') {
        saveInventoryBackup();
      }
    } catch (e) {
      console.error('Error unlocking all cosmetics:', e);
    }

    // Refresh UI & theme buttons & cosmetics shop
    if (typeof updateThemeButtons === 'function') updateThemeButtons();
    if (typeof renderCosmeticsShop === 'function') renderCosmeticsShop();
    if (typeof renderCollectionScreen === 'function') renderCollectionScreen();
    if (typeof fireConfetti === 'function') fireConfetti();
    if (typeof showToast === 'function') {
      showToast('✨ All Cosmetics Unlocked! Themes, Sleeves, Finishers & Effects added to inventory.', 4500);
    }

    if (execResult) {
      execResult.textContent = '✔ SUCCESS: All Cosmetics (Themes, Card Sleeves, Victory Finishers & Celebration Effects) have been unlocked!';
      execResult.className = 'secret-exec-result success';
      execResult.classList.remove('hidden');
    }
  });

  const testRevealBtn = document.getElementById('btn-secret-test-card-reveal');
  testRevealBtn?.addEventListener('click', () => {
    closeSecretMenu();
    const card = getRandomCardForReveal();
    showSingleCardReveal(card, () => {
      openSecretMenu();
      if (execResult) {
        execResult.textContent = `✔ REVEAL COMPLETE: Successfully simulated 3D reveal for "${card.name}"!`;
        execResult.className = 'secret-exec-result success';
        execResult.classList.remove('hidden');
      }
    });
  });

  const testEasyWinBtn = document.getElementById('btn-secret-test-easy-win');
  testEasyWinBtn?.addEventListener('click', () => {
    closeSecretMenu();
    if (typeof playEpicVictoryAnimation === 'function') {
      playEpicVictoryAnimation('Easy', () => {
        openSecretMenu();
        if (execResult) {
          execResult.textContent = '✔ TEST COMPLETE: Successfully simulated Easy Bot Victory celebrating with cheerful green theme!';
          execResult.className = 'secret-exec-result success';
          execResult.classList.remove('hidden');
        }
      });
    }
  });

  const testMediumWinBtn = document.getElementById('btn-secret-test-medium-win');
  testMediumWinBtn?.addEventListener('click', () => {
    closeSecretMenu();
    if (typeof playEpicVictoryAnimation === 'function') {
      playEpicVictoryAnimation('Medium', () => {
        openSecretMenu();
        if (execResult) {
          execResult.textContent = '✔ TEST COMPLETE: Successfully simulated Medium Bot Victory celebrating with gold theme!';
          execResult.className = 'secret-exec-result success';
          execResult.classList.remove('hidden');
        }
      });
    }
  });

  const testHardWinBtn = document.getElementById('btn-secret-test-hard-win');
  testHardWinBtn?.addEventListener('click', () => {
    closeSecretMenu();
    if (typeof playEpicVictoryAnimation === 'function') {
      playEpicVictoryAnimation('Hard', () => {
        openSecretMenu();
        if (execResult) {
          execResult.textContent = '✔ TEST COMPLETE: Successfully simulated Hard Bot Victory celebrating with fierce orange theme!';
          execResult.className = 'secret-exec-result success';
          execResult.classList.remove('hidden');
        }
      });
    }
  });

  const testExpertWinBtn = document.getElementById('btn-secret-test-expert-win');
  testExpertWinBtn?.addEventListener('click', () => {
    closeSecretMenu();
    if (typeof playEpicVictoryAnimation === 'function') {
      playEpicVictoryAnimation('Expert', () => {
        openSecretMenu();
        if (execResult) {
          execResult.textContent = '✔ TEST COMPLETE: Successfully simulated Expert Bot Victory celebrating with celestial aurora theme and chimes!';
          execResult.className = 'secret-exec-result success';
          execResult.classList.remove('hidden');
        }
      });
    }
  });

  const testMasterWinBtn = document.getElementById('btn-secret-test-master-win');
  testMasterWinBtn?.addEventListener('click', () => {
    closeSecretMenu();
    if (typeof playEpicVictoryAnimation === 'function') {
      playEpicVictoryAnimation('Master', () => {
        openSecretMenu();
        if (execResult) {
          execResult.textContent = '✔ TEST COMPLETE: Successfully simulated Master Bot Victory celebrating with royal crown theme and cascading chords!';
          execResult.className = 'secret-exec-result success';
          execResult.classList.remove('hidden');
        }
      });
    }
  });

  showCodesBtn?.addEventListener('click', () => {
    if (!codesManifest) return;
    if (codesManifest.classList.contains('hidden')) {
      renderCodesManifest();
      codesManifest.classList.remove('hidden');
      if (execResult) {
        execResult.textContent = 'ℹ MANIFEST DECRYPTED: All active Mehrbod Shop codes loaded.';
        execResult.className = 'secret-exec-result success';
        execResult.classList.remove('hidden');
      }
    } else {
      codesManifest.classList.add('hidden');
    }
  });
})();

/* ===== 3D CARD REVEAL ENGINE & PARTICLES SYSTEM ===== */
function getRandomCardForReveal() {
  const choice = Math.random();
  if (choice < 0.5) {
    const tier = [2, 3, 4][Math.floor(Math.random() * 3)];
    const pool = (typeof UNIT_ARCHETYPES !== 'undefined' && UNIT_ARCHETYPES[tier]) ? UNIT_ARCHETYPES[tier] : [];
    if (pool.length) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      return { name: card.name, tier: tier, kind: 'unit' };
    }
  } else if (choice < 0.75) {
    const pool = (typeof SPELL_DEFS !== 'undefined') ? SPELL_DEFS : [];
    if (pool.length) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      return { name: card.name, tier: null, kind: 'spell' };
    }
  } else {
    const pool = (typeof CHIP_DEFS !== 'undefined') ? CHIP_DEFS : [];
    if (pool.length) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      return { name: card.name, tier: null, kind: 'chip' };
    }
  }
  return { name: 'Titan Golem', tier: 4, kind: 'unit' };
}

function spawnParticleExplosion(container) {
  const count = 50;
  const colors = ['#38bdf8', '#818cf8', '#fbbf24', '#f87171', '#34d399', '#c084fc'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'reveal-sparkle';
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.backgroundColor = color;
    
    // Angle & speed vectors
    const angle = Math.random() * 2 * Math.PI;
    const speed = 100 + Math.random() * 180;
    const x = Math.cos(angle) * speed;
    const y = Math.sin(angle) * speed;
    
    p.style.setProperty('--tx', `${x}px`);
    p.style.setProperty('--ty', `${y}px`);
    
    // Size and offsets
    const size = 6 + Math.random() * 12;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.animationDelay = `${Math.random() * 0.12}s`;
    
    // Shapes selector
    const shapeType = Math.random();
    if (shapeType < 0.35) {
      p.style.borderRadius = '50%';
    } else if (shapeType < 0.7) {
      p.style.borderRadius = '0';
    } else {
      p.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    }
    
    container.appendChild(p);
  }
}

function showSingleCardReveal(card, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'single-reveal-overlay';
  
  const tierClass = card.kind === 'unit' ? ('tier' + card.tier) : (card.kind === 'spell' ? 'sc-spell' : 'sc-chip');
  const tierLabel = card.kind === 'unit' ? ((typeof TIERS !== 'undefined' && TIERS[card.tier]) ? TIERS[card.tier].name : 'Unit') : (card.kind === 'spell' ? 'Spell' : 'Chip');
  
  overlay.innerHTML = `
    <div class="single-reveal-stage">
      <div class="single-reveal-card-container">
        <div class="single-reveal-card ${tierClass}" id="single-reveal-card">
          <div class="single-reveal-inner">
            <div class="single-reveal-back">
              <div class="single-reveal-back-deco-lines-top"></div>
              <div class="single-reveal-back-brand">MEHRBOD CARDS</div>
              <div class="single-reveal-back-deco-lines-bottom"></div>
              <div class="single-reveal-prompt">TAP TO REVEAL</div>
            </div>
            <div class="single-reveal-front">
              <div class="single-reveal-rarity">${tierLabel.toUpperCase()}</div>
              <div class="single-reveal-art-box">${card.kind === 'unit' ? '🛡️' : card.kind === 'spell' ? '⚡' : '💎'}</div>
              <div class="single-reveal-name">${card.name}</div>
              <div class="single-reveal-flavor">Newly Discovered!</div>
            </div>
          </div>
        </div>
      </div>
      <div class="single-reveal-particle-layer"></div>
      <button type="button" class="primary-btn single-reveal-confirm hidden">Claim Reward</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const cardEl = overlay.querySelector('#single-reveal-card');
  const confirmBtn = overlay.querySelector('.single-reveal-confirm');
  const particleLayer = overlay.querySelector('.single-reveal-particle-layer');
  
  let flipped = false;
  cardEl.addEventListener('click', () => {
    if (flipped) return;
    flipped = true;
    
    cardEl.classList.add('flipped');
    if (card.tier === 4) {
      if (typeof Sound.packRareFlip === 'function') {
        try { Sound.packRareFlip(); } catch (e) {}
      }
    } else {
      if (typeof Sound.packCardFlip === 'function') {
        try { Sound.packCardFlip(); } catch (e) {}
      }
    }
    if (typeof vibrate === 'function') vibrate([25, 35]);
    
    spawnParticleExplosion(particleLayer);
    
    setTimeout(() => {
      confirmBtn.classList.remove('hidden');
      confirmBtn.classList.add('fade-in-btn');
      if (typeof Sound.sparkle === 'function') {
        try { Sound.sparkle(); } catch (e) {}
      }
    }, 850);
  });
  
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    if (onDone) onDone();
  });
}

window.showSingleCardReveal = showSingleCardReveal;

// ===== GLOBAL COPY & SELECTION PREVENTION =====
(function initCopyPrevention() {
  document.addEventListener('copy', function(e) {
    e.preventDefault();
  }, { capture: true });

  document.addEventListener('cut', function(e) {
    e.preventDefault();
  }, { capture: true });

  document.addEventListener('selectstart', function(e) {
    e.preventDefault();
  }, { capture: true });

  document.addEventListener('dragstart', function(e) {
    e.preventDefault();
  }, { capture: true });
})();

/* ============================================================
   INTERACTIVE GAME TITLE LETTER GLOW BOUNCE (GRADIENT-SYNCED)
   ============================================================ */
(function initTitleLetterInteractions() {
  const GRADIENT_STOPS = [
    { pos: 0.00, r: 62,  g: 124, b: 177 }, // Tier 1 Blue #3e7cb1
    { pos: 0.30, r: 76,  g: 154, b: 91  }, // Tier 2 Green #4c9a5b
    { pos: 0.60, r: 208, g: 72,  b: 72  }, // Tier 3 Red #d04848
    { pos: 0.85, r: 224, g: 138, b: 44  }, // Tier 4 Orange #e08a2c
    { pos: 1.00, r: 62,  g: 124, b: 177 }, // Wrap to Tier 1 Blue
  ];

  function getLiveGradientColor(fraction) {
    const cycle = ((performance.now() % 7000) / 7000);
    const bgShift = (1 - Math.cos(cycle * 2 * Math.PI)) / 2;
    let t = (fraction * 0.35 + bgShift * 0.65) % 1.0;
    if (t < 0) t += 1.0;

    let lower = GRADIENT_STOPS[0];
    let upper = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
    for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
      if (t >= GRADIENT_STOPS[i].pos && t <= GRADIENT_STOPS[i + 1].pos) {
        lower = GRADIENT_STOPS[i];
        upper = GRADIENT_STOPS[i + 1];
        break;
      }
    }

    const range = upper.pos - lower.pos || 1;
    const ratio = Math.max(0, Math.min(1, (t - lower.pos) / range));
    const r = Math.round(lower.r + (upper.r - lower.r) * ratio);
    const g = Math.round(lower.g + (upper.g - lower.g) * ratio);
    const b = Math.round(lower.b + (upper.b - lower.b) * ratio);

    return {
      r, g, b,
      rgb: `rgb(${r}, ${g}, ${b})`,
      glow1: `rgba(${r}, ${g}, ${b}, 0.95)`,
      glow2: `rgba(${r}, ${g}, ${b}, 0.65)`,
      subtle: `rgba(${r}, ${g}, ${b}, 0.4)`
    };
  }

  const setupLetters = () => {
    const letters = document.querySelectorAll('.game-title .title-letter');
    if (!letters.length) return;

    letters.forEach((letter, idx) => {
      const fraction = idx / (letters.length - 1 || 1);

      letter.addEventListener('pointerenter', () => {
        const col = getLiveGradientColor(fraction);
        letter.style.setProperty('--live-glow', col.rgb);
      });

      if (letter.dataset.bounceBound) return;
      letter.dataset.bounceBound = 'true';

      let currentAnim = null;

      const triggerLetterBounce = () => {
        const col = getLiveGradientColor(fraction);
        letter.style.setProperty('--live-glow', col.rgb);

        if (currentAnim) {
          currentAnim.cancel();
          currentAnim = null;
        }

        currentAnim = letter.animate([
          { transform: 'scale(1) translateY(0)', filter: `drop-shadow(0 0 10px ${col.glow1}) drop-shadow(0 0 20px ${col.glow2}) brightness(1.2)` },
          { transform: 'scale(1.42) translateY(-16px) rotate(-4deg)', filter: `drop-shadow(0 0 28px ${col.glow1}) drop-shadow(0 0 50px ${col.glow2}) drop-shadow(0 0 80px ${col.subtle}) brightness(1.85)`, offset: 0.28 },
          { transform: 'scale(0.85) translateY(5px) rotate(2deg)', filter: `drop-shadow(0 0 18px ${col.glow1}) brightness(1.3)`, offset: 0.60 },
          { transform: 'scale(1.12) translateY(-3px)', filter: `drop-shadow(0 0 14px ${col.glow2})`, offset: 0.82 },
          { transform: 'scale(1) translateY(0) rotate(0deg)', filter: 'none' }
        ], {
          duration: 420,
          easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.35)',
          fill: 'none'
        });

        currentAnim.onfinish = () => {
          currentAnim = null;
        };

        try {
          if (typeof Sound !== 'undefined' && Sound && typeof Sound.tap === 'function') {
            Sound.tap();
          }
        } catch (e) {}
      };

      letter.addEventListener('pointerdown', () => {
        triggerLetterBounce();
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLetters);
  } else {
    setupLetters();
  }
})();

function playEpicVictoryAnimation(difficulty, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'epic-victory-overlay';
  
  const configs = {
    Easy: {
      themeClass: 'epic-easy',
      badgeEmoji: '🟢',
      titleText: 'EASY BOT DEFEATED',
      subText: 'A humble victory. A great first step on your journey!',
      colors: ['#4C9A5B', '#81c784', '#a5d6a7', '#fbbf24'],
      soundName: 'easyVictory',
      vibratePattern: [80]
    },
    Medium: {
      themeClass: 'epic-medium',
      badgeEmoji: '🟡',
      titleText: 'MEDIUM BOT VANQUISHED',
      subText: 'A solid triumph! Your tactical awareness is growing.',
      colors: ['#d9b23c', '#fbbf24', '#fcd34d', '#4C9A5B'],
      soundName: 'mediumVictory',
      vibratePattern: [80, 50, 80]
    },
    Hard: {
      themeClass: 'epic-hard',
      badgeEmoji: '🟠',
      titleText: 'HARD BOT OVERTHROWN',
      subText: 'A magnificent feat! You matched their fierce intensity.',
      colors: ['#e0752c', '#f97316', '#fb923c', '#f59e0b'],
      soundName: 'hardVictory',
      vibratePattern: [100, 50, 100, 50, 100]
    },
    Expert: {
      themeClass: 'epic-expert',
      badgeEmoji: '🌌',
      titleText: 'EXPERT BOT CONQUERED',
      subText: 'You have vanquished the cosmic Stargazer Bot!',
      colors: ['#38bdf8', '#818cf8', '#6366f1', '#fbbf24'],
      soundName: 'epicVictory',
      vibratePattern: [80, 50, 80, 50, 150]
    },
    Master: {
      themeClass: 'epic-master',
      badgeEmoji: '👑',
      titleText: 'MASTER BOT CONQUERED',
      subText: 'You have triumphed over the Grandmaster Bot!',
      colors: ['#c084fc', '#a855f7', '#fbbf24', '#f59e0b'],
      soundName: 'epicVictory',
      vibratePattern: [80, 50, 80, 50, 150]
    }
  };

  const cfg = configs[difficulty] || configs.Easy;
  
  overlay.innerHTML = `
    <div class="epic-victory-container ${cfg.themeClass}">
      <div class="epic-victory-badge">${cfg.badgeEmoji}</div>
      <div class="epic-victory-title">${cfg.titleText}</div>
      <div class="epic-victory-subtitle">${cfg.subText}</div>
      <button type="button" class="primary-btn epic-victory-btn">CLAIM GLORY</button>
    </div>
    <div class="epic-victory-sparkle-container"></div>
  `;
  
  document.body.appendChild(overlay);
  
  // Custom sound
  if (typeof Sound !== 'undefined' && typeof Sound[cfg.soundName] === 'function') {
    Sound[cfg.soundName]();
  }
  
  // Haptics
  if (typeof vibrate === 'function') {
    vibrate(cfg.vibratePattern);
  }
  
  // Confetti burst
  if (typeof launchConfetti === 'function') {
    launchConfetti();
  }
  
  // Spawn drifting sparkles
  const sparkleContainer = overlay.querySelector('.epic-victory-sparkle-container');
  const count = 40;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'epic-victory-spark';
    const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    s.style.backgroundColor = color;
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.width = `${4 + Math.random() * 8}px`;
    s.style.height = s.style.width;
    s.style.animationDelay = `${Math.random() * 2}s`;
    s.style.animationDuration = `${1.5 + Math.random() * 2}s`;
    sparkleContainer.appendChild(s);
  }
  
  const btn = overlay.querySelector('.epic-victory-btn');
  btn.addEventListener('click', () => {
    overlay.remove();
    if (onDone) onDone();
  });
}

window.playEpicVictoryAnimation = playEpicVictoryAnimation;

/* ---------- 3D Holographic Card Tilt & Specular Glare System ---------- */
(function initCard3DTiltSystem() {
  let activeCard = null;

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const card = e.target.closest('.card, .sc-card');
    if (!card) {
      if (activeCard) {
        resetCard(activeCard);
        activeCard = null;
      }
      return;
    }

    if (activeCard && activeCard !== card) {
      resetCard(activeCard);
    }
    activeCard = card;

    let shine = card.querySelector('.card-holo-shine');
    if (!shine) {
      shine = document.createElement('div');
      shine.className = 'card-holo-shine';
      card.appendChild(shine);
    }

    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    const rotateY = ((x - centerX) / centerX) * 10;
    const rotateX = -((y - centerY) / centerY) * 10;

    card.style.transform = `perspective(600px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.1)`;
    card.style.setProperty('--shine-x', `${percentX.toFixed(1)}%`);
    card.style.setProperty('--shine-y', `${percentY.toFixed(1)}%`);
  });

  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card, .sc-card');
    if (card && !card.contains(e.relatedTarget)) {
      resetCard(card);
      if (activeCard === card) activeCard = null;
    }
  });

  function resetCard(card) {
    card.style.transform = '';
  }
})();

/* ---------- New Spell FX Animations ---------- */

function playRocketBoomAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 80, height: 100 };
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  // Create Rocket projectile element
  const rocket = document.createElement('div');
  rocket.style.cssText = `
    position: fixed;
    z-index: 9999;
    font-size: 2.6rem;
    pointer-events: none;
    left: ${window.innerWidth / 2}px;
    top: ${window.innerHeight + 40}px;
    transform: translate(-50%, -50%) rotate(-45deg);
    transition: all 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
    filter: drop-shadow(0 0 14px #ff4500);
  `;
  rocket.textContent = '🚀';
  document.body.appendChild(rocket);

  // Animate rocket flight to target
  requestAnimationFrame(() => {
    rocket.style.left = targetX + 'px';
    rocket.style.top = targetY + 'px';
    rocket.style.transform = 'translate(-50%, -50%) scale(1.4) rotate(15deg)';
  });

  setTimeout(() => {
    if (rocket.parentNode) rocket.parentNode.removeChild(rocket);

    // Screen Shake & Sound
    if (typeof shakeScreen === 'function') shakeScreen(14);
    if (typeof Sound !== 'undefined' && Sound.epicDmg) Sound.epicDmg();

    // Spawn massive explosion blast ring
    const explosion = document.createElement('div');
    explosion.style.cssText = `
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      left: ${targetX}px;
      top: ${targetY}px;
      transform: translate(-50%, -50%);
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background: radial-gradient(circle, #ffffff 10%, #ff4500 50%, rgba(255, 69, 0, 0) 80%);
      animation: rocketExplodeRing 0.5s ease-out forwards;
    `;
    document.body.appendChild(explosion);

    // Spawn flame and particle explosion emojis
    const emojis = ['💥', '🔥', '⚡', '💥', '✨'];
    emojis.forEach((emoji, i) => {
      const p = document.createElement('div');
      p.textContent = emoji;
      const angle = (i / emojis.length) * Math.PI * 2;
      const dist = 38 + Math.random() * 32;
      p.style.cssText = `
        position: fixed;
        z-index: 10000;
        font-size: 1.8rem;
        pointer-events: none;
        left: ${targetX}px;
        top: ${targetY}px;
        transform: translate(-50%, -50%) scale(0.5);
        transition: transform 0.45s ease-out, opacity 0.45s ease-out;
      `;
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(angle) * dist - 50}%, ${Math.sin(angle) * dist - 50}%) scale(1.6)`;
        p.style.opacity = '0';
      });
      setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 500);
    });

    setTimeout(() => { if (explosion.parentNode) explosion.parentNode.removeChild(explosion); }, 500);

    // Floating label over slot
    if (targetEl && typeof spawnFloatingNumberOn === 'function') {
      spawnFloatingNumberOn(targetEl, '🚀 1 HP!', 'damage');
    }
  }, 360);
}

function playSuddenDeathAnimation() {
  if (typeof shakeScreen === 'function') shakeScreen(10);
  if (typeof Sound !== 'undefined' && Sound.epicDmg) Sound.epicDmg();

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    background: radial-gradient(circle at center, rgba(220, 38, 38, 0.45) 0%, rgba(0, 0, 0, 0.85) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: suddenDeathFade 1.2s ease-out forwards;
  `;
  overlay.innerHTML = `
    <div style="text-align: center; color: #ef4444; text-shadow: 0 0 20px #dc2626, 0 0 40px #991b1b; font-family: 'Playfair Display', serif; transform: scale(1.2);">
      <div style="font-size: 3.5rem;">💀</div>
      <div style="font-size: 2.2rem; font-weight: 900; letter-spacing: 3px; text-transform: uppercase;">Sudden Death!</div>
      <div style="font-size: 1rem; color: #fca5a5; margin-top: 4px;">All cards set to 1 HP</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 1200);
}

function playHackAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  if (targetEl) {
    targetEl.classList.add('glitch-pulse');
    setTimeout(() => targetEl.classList.remove('glitch-pulse'), 800);
    if (typeof spawnFloatingNumberOn === 'function') {
      spawnFloatingNumberOn(targetEl, '-2 💻', 'damage');
    }
  }
  if (typeof Sound !== 'undefined' && Sound.spellChime) Sound.spellChime();
}

function playOrangeHealAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  if (targetEl) {
    if (typeof spawnFloatingNumberOn === 'function') {
      spawnFloatingNumberOn(targetEl, '🍊 FULL HP!', 'heal');
    }
    if (typeof spawnCastEffect === 'function') {
      spawnCastEffect(targetOwner, targetSlot, 'heal', { text: '🍊 FULL HP!', kind: 'heal' });
    }
  }
  if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
}

function playSanctionedAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 80, height: 100 };
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  // Slamming Hammer Element
  const hammer = document.createElement('div');
  hammer.style.cssText = `
    position: fixed;
    z-index: 9999;
    font-size: 3.5rem;
    pointer-events: none;
    left: ${targetX}px;
    top: ${targetY - 220}px;
    transform: translate(-50%, -50%) rotate(-45deg) scale(0.8);
    transition: all 0.28s cubic-bezier(0.5, 0, 0.75, 0);
    filter: drop-shadow(0 0 16px #facc15);
  `;
  hammer.textContent = '🔨';
  document.body.appendChild(hammer);

  requestAnimationFrame(() => {
    hammer.style.top = targetY + 'px';
    hammer.style.transform = 'translate(-50%, -50%) rotate(25deg) scale(1.3)';
  });

  setTimeout(() => {
    if (hammer.parentNode) hammer.parentNode.removeChild(hammer);

    if (typeof shakeScreen === 'function') shakeScreen(15);
    if (typeof Sound !== 'undefined' && Sound.epicDmg) Sound.epicDmg();

    // Yellow Golden Cracks & Spark Burst
    const sparks = ['✨', '⚡', '💛', '💥', '✨'];
    sparks.forEach((s, i) => {
      const p = document.createElement('div');
      p.textContent = s;
      const angle = (i / sparks.length) * Math.PI * 2;
      p.style.cssText = `
        position: fixed;
        z-index: 10000;
        font-size: 1.6rem;
        pointer-events: none;
        left: ${targetX}px;
        top: ${targetY}px;
        transform: translate(-50%, -50%) scale(0.5);
        transition: transform 0.4s ease-out, opacity 0.4s ease-out;
      `;
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(angle) * 40 - 50}%, ${Math.sin(angle) * 40 - 50}%) scale(1.4)`;
        p.style.opacity = '0';
      });
      setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 450);
    });

    if (targetEl) {
      targetEl.classList.add('sanctioned-cracked');
      if (typeof spawnFloatingNumberOn === 'function') {
        spawnFloatingNumberOn(targetEl, '🔨 SANCTIONED!', 'damage');
      }
    }
  }, 290);
}

function playZapAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 80, height: 100 };
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  // High-voltage Yellow Electric Bolt
  const bolt = document.createElement('div');
  bolt.style.cssText = `
    position: fixed;
    z-index: 9999;
    font-size: 3.8rem;
    pointer-events: none;
    left: ${targetX}px;
    top: ${targetY - 180}px;
    transform: translate(-50%, -50%) scale(0.5);
    transition: all 0.2s ease-out;
    filter: drop-shadow(0 0 20px #facc15);
  `;
  bolt.textContent = '⚡';
  document.body.appendChild(bolt);

  requestAnimationFrame(() => {
    bolt.style.top = targetY + 'px';
    bolt.style.transform = 'translate(-50%, -50%) scale(1.5)';
  });

  setTimeout(() => {
    if (bolt.parentNode) bolt.parentNode.removeChild(bolt);
    if (typeof shakeScreen === 'function') shakeScreen(10);
    if (typeof Sound !== 'undefined' && Sound.spellChime) Sound.spellChime();

    if (targetEl) {
      targetEl.classList.add('yellow-zap-glow');
      setTimeout(() => targetEl.classList.remove('yellow-zap-glow'), 600);
      if (typeof spawnFloatingNumberOn === 'function') {
        spawnFloatingNumberOn(targetEl, '⚡ -5 DMG!', 'damage');
      }
    }
  }, 210);
}

function playAllAuraAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  if (targetEl) {
    targetEl.classList.add('all-aura-glow');
    if (typeof spawnFloatingNumberOn === 'function') {
      spawnFloatingNumberOn(targetEl, '✨ ALL AURA (3 TNS)!', 'heal');
    }
  }
  if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
}

function playSacrificeManReviveAnimation(owner, slot, left) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(owner, slot) : null;
  if (targetEl) {
    targetEl.classList.add('yellow-zap-glow');
    setTimeout(() => targetEl.classList.remove('yellow-zap-glow'), 800);
    if (typeof spawnFloatingNumberOn === 'function') {
      spawnFloatingNumberOn(targetEl, `🛡️ REVIVED! (${left} LEFT)`, 'heal');
    }
  }
  if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
}

function playRemainsMaskAnimation(owner, slot) {
  if (typeof shakeScreen === 'function') shakeScreen(12);
  if (typeof Sound !== 'undefined' && Sound.epicDmg) Sound.epicDmg();

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    background: radial-gradient(circle at center, rgba(185, 28, 28, 0.5) 0%, rgba(15, 23, 42, 0.85) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: suddenDeathFade 1.1s ease-out forwards;
  `;
  overlay.innerHTML = `
    <div style="text-align: center; color: #f87171; text-shadow: 0 0 24px #dc2626, 0 0 48px #991b1b; font-family: 'Playfair Display', serif; transform: scale(1.15);">
      <div style="font-size: 3.5rem;">🎭💀</div>
      <div style="font-size: 2.2rem; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">Remains Mask!</div>
      <div style="font-size: 1.05rem; color: #fecaca; margin-top: 6px;">All Sacrifice Man cards regenerated to full uses!</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 1100);

  const slotEl = typeof getSlotEl === 'function' ? getSlotEl(owner, slot) : null;
  if (slotEl && typeof spawnFloatingNumberOn === 'function') {
    spawnFloatingNumberOn(slotEl, '💀 SACRIFICED RED CARD', 'damage');
  }
}

function playSupremeShirtAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 80, height: 100 };
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const icon = document.createElement('div');
  icon.style.cssText = `
    position: fixed;
    z-index: 9999;
    font-size: 3.5rem;
    pointer-events: none;
    left: ${targetX}px;
    top: ${targetY - 50}px;
    transform: translate(-50%, -50%) scale(0.5);
    transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    filter: drop-shadow(0 0 16px #f59e0b);
  `;
  icon.textContent = '🎽';
  document.body.appendChild(icon);

  requestAnimationFrame(() => {
    icon.style.transform = 'translate(-50%, -50%) scale(1.4)';
  });

  setTimeout(() => {
    if (icon.parentNode) icon.parentNode.removeChild(icon);
    if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
    if (targetEl) {
      targetEl.classList.add('yellow-zap-glow');
      setTimeout(() => targetEl.classList.remove('yellow-zap-glow'), 700);
      if (typeof spawnFloatingNumberOn === 'function') {
        spawnFloatingNumberOn(targetEl, '🎽 +2 HP · +2 DMG · +2 SP!', 'heal');
      }
    }
  }, 350);
}

function playReviveAnimation(owner, slot, cardName) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(owner, slot) : null;
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 80, height: 100 };
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const glyph = document.createElement('div');
  glyph.style.cssText = `
    position: fixed;
    z-index: 9999;
    font-size: 3.2rem;
    pointer-events: none;
    left: ${targetX}px;
    top: ${targetY}px;
    transform: translate(-50%, -50%) scale(0.2);
    transition: all 0.4s ease-out;
    filter: drop-shadow(0 0 20px #10b981);
  `;
  glyph.textContent = '✨⚰️✨';
  document.body.appendChild(glyph);

  requestAnimationFrame(() => {
    glyph.style.transform = 'translate(-50%, -50%) scale(1.3)';
  });

  setTimeout(() => {
    if (glyph.parentNode) glyph.parentNode.removeChild(glyph);
    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
    if (targetEl) {
      targetEl.classList.add('all-aura-glow');
      setTimeout(() => targetEl.classList.remove('all-aura-glow'), 800);
      if (typeof spawnFloatingNumberOn === 'function') {
        spawnFloatingNumberOn(targetEl, `✨ REVIVED ${cardName || 'CARD'}!`, 'heal');
      }
    }
  }, 400);
}

function playSkeletonStaffAnimation(targetOwner, targetSlot) {
  const targetEl = typeof getSlotEl === 'function' ? getSlotEl(targetOwner, targetSlot) : null;
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 80, height: 100 };
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const staff = document.createElement('div');
  staff.style.cssText = `
    position: fixed;
    z-index: 9999;
    font-size: 3.6rem;
    pointer-events: none;
    left: ${targetX}px;
    top: ${targetY - 140}px;
    transform: translate(-50%, -50%) rotate(-30deg) scale(0.7);
    transition: all 0.28s cubic-bezier(0.5, 0, 0.75, 0);
    filter: drop-shadow(0 0 16px #a855f7);
  `;
  staff.textContent = '🦴🪄';
  document.body.appendChild(staff);

  requestAnimationFrame(() => {
    staff.style.top = targetY + 'px';
    staff.style.transform = 'translate(-50%, -50%) rotate(15deg) scale(1.3)';
  });

  setTimeout(() => {
    if (staff.parentNode) staff.parentNode.removeChild(staff);
    if (typeof shakeScreen === 'function') shakeScreen(10);
    if (typeof Sound !== 'undefined' && Sound.death) Sound.death();

    if (targetEl) {
      targetEl.classList.add('glitch-pulse');
      setTimeout(() => targetEl.classList.remove('glitch-pulse'), 800);
      if (typeof spawnFloatingNumberOn === 'function') {
        spawnFloatingNumberOn(targetEl, '🦴 1 HP · 1 ATK · 1 SP (NO CHIPS)', 'damage');
      }
    }
  }, 280);
}

window.playRocketBoomAnimation = playRocketBoomAnimation;
window.playSuddenDeathAnimation = playSuddenDeathAnimation;
window.playHackAnimation = playHackAnimation;
window.playOrangeHealAnimation = playOrangeHealAnimation;
window.playSanctionedAnimation = playSanctionedAnimation;
window.playZapAnimation = playZapAnimation;
window.playAllAuraAnimation = playAllAuraAnimation;
window.playSacrificeManReviveAnimation = playSacrificeManReviveAnimation;
window.playRemainsMaskAnimation = playRemainsMaskAnimation;
window.playSupremeShirtAnimation = playSupremeShirtAnimation;
window.playReviveAnimation = playReviveAnimation;
window.playSkeletonStaffAnimation = playSkeletonStaffAnimation;





