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

  function checkAllFlipped() {
    const cardElements = cardsRow.querySelectorAll('.packopen-card');
    const flippedCount = cardsRow.querySelectorAll('.packopen-card.flipped').length;
    if (cardElements.length > 0 && flippedCount === cardElements.length && !allFlipped) {
      allFlipped = true;
      continueBtn.classList.remove('hidden');
      if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
      if (typeof vibrate === 'function') vibrate([20, 30]);
    }
  }

  function flipSingleCard(el, c) {
    if (!el || el.classList.contains('flipped')) return;
    el.classList.add('flipped');

    if (typeof Sound !== 'undefined') {
      if (c.kind === 'spell') {
        if (Sound.spellChime) Sound.spellChime();
        if (Sound.packCardFlip) Sound.packCardFlip();
      } else if (c.kind === 'chip') {
        if (Sound.chipChime) Sound.chipChime();
        if (Sound.packCardFlip) Sound.packCardFlip();
      } else {
        if (Sound.tierChime) Sound.tierChime(c.tier || 1);
        if (c.tier === 4) {
          if (Sound.packRareFlip) Sound.packRareFlip();
        } else {
          if (Sound.packCardFlip) Sound.packCardFlip();
        }
      }
    }
    if (typeof vibrate === 'function') vibrate(15);
    const burst = document.createElement('div');
    burst.className = 'packopen-burst';
    el.appendChild(burst);
    setTimeout(() => burst.remove(), 700);

    checkAllFlipped();
  }

  function finishRevealInstantly() {
    if (allFlipped) return;
    const cardElements = cardsRow.querySelectorAll('.packopen-card:not(.flipped)');
    cardElements.forEach((el, idx) => {
      const c = cards[idx] || {};
      setTimeout(() => {
        flipSingleCard(el, c);
      }, idx * 100);
    });
  }

  function revealCards() {
    if (!cards.length) {
      continueBtn.classList.remove('hidden');
      return;
    }
    cards.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = `packopen-card ${tierClass(c)}`;
      const glyph = c.kind === 'unit' ? (typeof TIER_GLYPHS !== 'undefined' && TIER_GLYPHS[c.tier] ? TIER_GLYPHS[c.tier] : '●') : (c.kind === 'spell' ? '⚡' : '💎');
      const statsHTML = c.kind === 'unit'
        ? `<div class="packopen-card-stats"><span>${c.hp || 1}❤</span><span>${c.dmg || 1}⚔</span><span>${c.sp || 1}⛃</span></div>`
        : '';
      el.innerHTML = `
        <div class="packopen-card-inner">
          <div class="packopen-card-back"><span>?</span></div>
          <div class="packopen-card-front">
            <div class="packopen-card-glyph">${glyph}</div>
            <div class="packopen-card-name">${c.name}</div>
            <div class="packopen-card-sub">${tierName(c)}</div>
            ${statsHTML}
          </div>
        </div>`;
      cardsRow.appendChild(el);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        flipSingleCard(el, c);
      });
      
      setTimeout(() => {
        el.classList.add('landed');
      }, 50 * i);
    });
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
  if (typeof isCollectionComplete === 'function' && isCollectionComplete()) {
    if (typeof Sound !== 'undefined' && typeof Sound.buzzer === 'function') {
      try { Sound.buzzer(); } catch (e) {}
    }
    showToast('🎉 Your card collection is already 100% complete!', 3000);
    return;
  }
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
    if (typeof Sound !== 'undefined' && typeof Sound.buzzer === 'function') {
      try { Sound.buzzer(); } catch (e) {}
    }
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
const DAILY_LOGIN_REWARDS = [5, 8, 10, 15, 20, 30, 50]; // Day 1..7, Day 7 is the big bonus

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
function grantPlayerXP(amount, reason) {
  if (!amount) return;
  if (typeof grantBattlePassXP === 'function') grantBattlePassXP(amount);
  const beforeLevel = playerLevelFromXP(loadPlayerXP()).level;
  const newXp = loadPlayerXP() + amount;
  savePlayerXP(newXp);
  const afterInfo = playerLevelFromXP(newXp);

  if (typeof showToast === 'function') {
    showToast(`⭐ +${amount} XP gained! (Added to Profile & Battle Pass)`, 2600);
  }

  if (afterInfo.level > beforeLevel) {
    const reward = Math.floor((20 + afterInfo.level * 5) / 2);
    addBux(reward);
    recordEconomyChange(reward, `Reached Player Level ${afterInfo.level}`);
    recordRecentActivity(`Reached Player Level ${afterInfo.level} — +${reward} Bux`);
    showToast(`⭐ Player Level ${afterInfo.level}! +${reward} Bux`, 3000);
    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();

    // Trigger tactile breathing pulse on top HUD profile button
    const avatarBtn = document.getElementById('profile-avatar-btn');
    if (avatarBtn) {
      avatarBtn.classList.remove('avatar-level-up-pulse');
      void avatarBtn.offsetWidth; // force reflow
      avatarBtn.classList.add('avatar-level-up-pulse');
      setTimeout(() => {
        avatarBtn.classList.remove('avatar-level-up-pulse');
      }, 1450);
    }
  }
  if (afterInfo.level >= 50 && localStorage.getItem('theme_astral_unlocked') !== 'true') {
    localStorage.setItem('theme_astral_unlocked', 'true');
    showToast(`🏆 Reached Level 50! Unlocked Trial Lord (S1) Theme!`, 4000);
    if (typeof updateThemeButtons === 'function') updateThemeButtons();
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
const WEEKLY_VAULT_REWARDS = [15, 30, 50, 75, 125];
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
  { id: 'b_win_2', type: 'win', title: 'Arena Domination', desc: 'Win 2 matches in Single Player, Bot, or Multiplayer', goal: 2, rewardBux: 75, rewardXP: 45, icon: '⚔️' },
  { id: 'b_place_10', type: 'play', title: 'Card Deployment', desc: 'Play 10 unit cards onto the battlefield', goal: 10, rewardBux: 60, rewardXP: 35, icon: '🃏' },
  { id: 'b_tower_1', type: 'tower', title: 'Tower Conqueror', desc: 'Conquer any Trial Tower floor', goal: 1, rewardBux: 100, rewardXP: 60, icon: '🗼' },
  { id: 'b_merge_3', type: 'merge', title: 'Fusion Mastery', desc: 'Merge 3 pairs or groups of cards in battle', goal: 3, rewardBux: 70, rewardXP: 40, icon: '🧬' },
  { id: 'b_spell_3', type: 'spell', title: 'Arcane Mastery', desc: 'Cast 3 tactical spells or battle chips', goal: 3, rewardBux: 65, rewardXP: 40, icon: '✨' },
  { id: 'b_streak_2', type: 'streak', title: 'Winning Momentum', desc: 'Achieve a 2-game winning streak', goal: 2, rewardBux: 125, rewardXP: 75, icon: '🔥' },
  { id: 'b_win_3', type: 'win', title: 'Gladiator Supreme', desc: 'Win 3 arena matches across any mode', goal: 3, rewardBux: 110, rewardXP: 70, icon: '👑' },
  { id: 'b_matches_3', type: 'match', title: 'Battle Veteran', desc: 'Complete 3 full matches in any arena mode', goal: 3, rewardBux: 55, rewardXP: 30, icon: '🛡️' },
  { id: 'b_play_green_3', type: 'play_green', title: 'Emerald Tactics', desc: 'Play 3 Green (Tier 2) cards onto the board', goal: 3, rewardBux: 75, rewardXP: 45, icon: '🟢' },
  { id: 'b_play_red_2', type: 'play_red', title: 'Ruby Destruction', desc: 'Play 2 Red (Tier 3) cards onto the board', goal: 2, rewardBux: 90, rewardXP: 55, icon: '🔴' },
  { id: 'b_play_orange_1', type: 'play_orange', title: 'Solar Sovereign', desc: 'Play 1 legendary Orange (Tier 4) card', goal: 1, rewardBux: 125, rewardXP: 80, icon: '🟠' },
  { id: 'b_arch_def', type: 'play_archetype_defender', title: 'Iron Guard', desc: 'Play 2 defensive cards (Chaplain, Warden, Bulwark, or Sentinel)', goal: 2, rewardBux: 80, rewardXP: 50, icon: '🛡️' },
  { id: 'b_arch_str', type: 'play_archetype_striker', title: 'War Offensive', desc: 'Play 2 offensive cards (Firestarter, Cannoneer, Duelist, or Devastator)', goal: 2, rewardBux: 80, rewardXP: 50, icon: '🔥' },
  { id: 'b_arch_rog', type: 'play_archetype_rogue', title: 'Shadow Agents', desc: 'Play 2 utility cards (Saboteur, Pathfinder, Footpad, or Reaper)', goal: 2, rewardBux: 80, rewardXP: 50, icon: '👥' }
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

function progressDailyBounties(type, amount = 1, extra = null) {
  if (typeof tutorialActive !== 'undefined' && tutorialActive) return;
  const quests = loadDailyQuests();
  let changed = false;
  let newlyFinished = null;

  function tickQuest(q, qType, qAmt) {
    if (q.claimed) return;
    if (q.type === qType) {
      const prev = q.current;
      q.current = Math.min(q.goal, q.current + qAmt);
      if (q.current !== prev) changed = true;
      if (prev < q.goal && q.current >= q.goal) {
        newlyFinished = q;
      }
    }
  }

  quests.forEach(q => {
    // Process core event type
    tickQuest(q, type, amount);

    // If type is card play, process sub-types based on card properties (tier, name)
    if (type === 'play' && extra) {
      if (extra.tier === 2) {
        tickQuest(q, 'play_green', amount);
      }
      if (extra.tier === 3) {
        tickQuest(q, 'play_red', amount);
      }
      if (extra.tier === 4) {
        tickQuest(q, 'play_orange', amount);
      }
      if (extra.name && ['Chaplain', 'Warden', 'Bulwark', 'Sentinel'].includes(extra.name)) {
        tickQuest(q, 'play_archetype_defender', amount);
      }
      if (extra.name && ['Firestarter', 'Cannoneer', 'Duelist', 'Devastator'].includes(extra.name)) {
        tickQuest(q, 'play_archetype_striker', amount);
      }
      if (extra.name && ['Saboteur', 'Pathfinder', 'Footpad', 'Reaper'].includes(extra.name)) {
        tickQuest(q, 'play_archetype_rogue', amount);
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
      if (!window.completedQuestsInCurrentMatch) {
        window.completedQuestsInCurrentMatch = [];
      }
      if (!window.completedQuestsInCurrentMatch.some(ex => ex.id === newlyFinished.id)) {
        window.completedQuestsInCurrentMatch.push(newlyFinished);
      }

      const inMatch = (typeof state !== 'undefined' && state && !state.winner);
      if (!inMatch) {
        showToast(`🎯 Bounty Complete: "${newlyFinished.title}"! Open Quests to claim reward!`, 3500);
        if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
      }
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
    const reward = Math.floor((20 + afterIdx * 15) / 2);
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
    const reward = Math.floor((20 + afterIdx * 15) / 2);
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
  if (count > 0) addBux(Math.max(1, Math.floor(count * 1)));
}
function canPrestigeNow() { return playerLevelFromXP(loadPlayerXP()).level >= PRESTIGE_LEVEL_REQUIREMENT; }
function doPrestige() {
  if (!canPrestigeNow()) return;
  const s = loadPrestigeState();
  s.count = (s.count || 0) + 1;
  savePrestigeState(s);
  savePlayerXP(0);
  const reward = Math.floor((150 + s.count * 50) / 2);
  addBux(reward);
  recordEconomyChange(reward, `Prestige ${s.count}`);
  recordRecentActivity(`Reached Prestige ${s.count} — +${reward} Bux`);
  showToast(`✦ Prestige ${s.count}! Player Level reset, +${reward} Bux, and +${Math.max(1, Math.floor(s.count * 1))} Bux on every future win.`, 4000);
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
  { id: 'green',  name: 'Green Set',  reward: 20,  owned: () => UNIT_ARCHETYPES[2].filter(a => isUnitArchetypeOwned(a.id)).length, total: () => UNIT_ARCHETYPES[2].length },
  { id: 'red',    name: 'Red Set',    reward: 35,  owned: () => UNIT_ARCHETYPES[3].filter(a => isUnitArchetypeOwned(a.id)).length, total: () => UNIT_ARCHETYPES[3].length },
  { id: 'orange', name: 'Orange Set', reward: 60,  owned: () => UNIT_ARCHETYPES[4].filter(a => isUnitArchetypeOwned(a.id)).length, total: () => UNIT_ARCHETYPES[4].length },
  { id: 'spells', name: 'Spell Set',  reward: 30,  owned: () => loadCollection().spells.length, total: () => ALL_SPELL_IDS.length },
  { id: 'chips',  name: 'Chip Set',   reward: 30,  owned: () => loadCollection().chips.length, total: () => ALL_CHIP_IDS.length },
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
  try {
    const s = JSON.parse(localStorage.getItem(TRIAL_TOWER_KEY) || 'null');
    if (s && typeof s.floor === 'number') {
      if (!Array.isArray(s.modifiers)) s.modifiers = [];
      if (!s.activeDebuff) s.activeDebuff = null;
      return s;
    }
  } catch (e) {}
  return { floor: 1, best: 0, pendingResult: null, lastRunFloor: 1, modifiers: [], activeDebuff: null };
}
function saveTrialTowerState(s) {
  try {
    if (!Array.isArray(s.modifiers)) s.modifiers = [];
    if (!s.activeDebuff) s.activeDebuff = null;
    localStorage.setItem(TRIAL_TOWER_KEY, JSON.stringify(s));
  } catch (e) {}
}

const TOWER_DEBUFF_POOL = [
  { id: 'd1', name: 'Weakness', desc: 'All units -1 ATK.' },
  { id: 'd2', name: 'Fragility', desc: 'All units -1 HP.' },
  { id: 'd3', name: 'Slowness', desc: 'Attacks happen slower.' },
  { id: 'd4', name: 'Curse', desc: 'Units deal -2 damage.' },
  { id: 'd5', name: 'Poison', desc: 'Units lose 1 HP every turn.' },
  { id: 'd6', name: 'Blindness', desc: 'Accuracy reduced.' },
  { id: 'd7', name: 'Silence', desc: 'Abilities disabled.' },
  { id: 'd8', name: 'Vulnerability', desc: 'Damage taken +1.' },
  { id: 'd9', name: 'Exhaustion', desc: 'Cannot attack every turn.' },
  { id: 'd10', name: 'Decay', desc: 'Healing reduced by 50%.' }
];

const TOWER_MODIFIER_POOL = [
  {
    id: 'splash',
    name: 'Splash Wave',
    icon: '[W]',
    tag: 'OFFENSIVE',
    desc: 'Every attack blasts ALL other enemy cards for 50% splash damage. Stacks up to 100% and 150%!'
  },
  {
    id: 'crit',
    name: 'Critical Strike',
    icon: '[C]',
    tag: 'BURST',
    desc: '40% chance per attack to deal DOUBLE damage. Stacks trigger chance up to 90%!'
  },
  {
    id: 'vampiric',
    name: 'Vampiric Drain',
    icon: '[V]',
    tag: 'SUSTAIN',
    desc: 'Heal your attacking cards for 50% of all attack damage dealt. Stacks heal percentage!'
  },
  {
    id: 'overcharge',
    name: 'Overcharge Surge',
    icon: '[O]',
    tag: 'STATS',
    desc: 'Every unit you place on the board permanently gains +2 ATK. Stacks +2 ATK per pick!'
  },
  {
    id: 'bastion',
    name: 'Bastion Plating',
    icon: '[B]',
    tag: 'DEFENSE',
    desc: 'Every unit you place enters battle with +3 Shield HP. Stacks +3 HP per pick!'
  },
  {
    id: 'twin_strike',
    name: 'Twin Strike',
    icon: '[2X]',
    tag: 'TEMPO',
    desc: 'Your Slot 0 Vanguard strikes twice every single round!'
  },
  {
    id: 'execute',
    name: 'Reaper Execution',
    icon: '[EX]',
    tag: 'LETHAL',
    desc: 'Instantly obliterates any enemy unit at or below 2 HP. Stacks threshold!'
  },
  {
    id: 'thorns',
    name: 'Thorns Matrix',
    icon: '[TH]',
    tag: 'REFLECT',
    desc: 'Reflects 2 damage back to attackers whenever your units are hit. Stacks reflect damage!'
  },
  {
    id: 'blaze',
    name: 'Solar Ignition',
    icon: '[SI]',
    tag: 'BURN',
    desc: 'Every attack ignites the defender for 2 bonus lingering burn damage. Stacks burn!'
  },
  {
    id: 'berserker',
    name: 'Berserker Rage',
    icon: '[R]',
    tag: 'BURST',
    desc: 'Every unit you place on the board gains +2 ATK, but -1 HP. Stacks stats!'
  },
  {
    id: 'spirit',
    name: 'Spirit Bond',
    icon: '[SB]',
    tag: 'STATS',
    desc: 'Every unit you place on the board gains +2 ATK and +2 HP. Stacks stats!'
  },
  {
    id: 'boss_bane',
    name: 'Boss Bane',
    icon: '[BB]',
    tag: 'BOSS',
    desc: 'Your units deal +2 damage to Boss units. Stacks damage!'
  },
  {
    id: 'mana_surge',
    name: 'Mana Surge',
    icon: '[MS]',
    tag: 'MANA',
    desc: 'Start battles with +1 extra Mana. Stacks mana!'
  },
  {
    id: 'quick_draw',
    name: 'Quick Draw',
    icon: '[QD]',
    tag: 'DRAW',
    desc: 'Draw 1 extra card at the start of each round. Stacks draw!'
  },
  {
    id: 'lucky_strike',
    name: 'Lucky Strike',
    icon: '[LS]',
    tag: 'CRIT',
    desc: '10% chance for units to deal double damage. Stacks chance!'
  },
  {
    id: 'hasty_retreat',
    name: 'Hasty Retreat',
    icon: '[HR]',
    tag: 'SURVIVE',
    desc: 'Units return to hand on fatal damage (once per battle). Stacks charges!'
  },
  {
    id: 'vampiric_touch',
    name: 'Vampiric Touch',
    icon: '[VT]',
    tag: 'HEAL',
    desc: 'Attacks heal for 1 HP. Stacks healing!'
  },
  {
    id: 'armor_pierce',
    name: 'Armor Pierce',
    icon: '[AP]',
    tag: 'PEN',
    desc: 'Attacks ignore 1 Shield HP. Stacks penetration!'
  },
  {
    id: 'echo_chamber',
    name: 'Echo Chamber',
    icon: '[EC]',
    tag: 'SPELL',
    desc: 'The first spell you cast each round is played twice. Stacks!'
  },
  {
    id: 'crystal_heart',
    name: 'Crystal Heart',
    icon: '[CH]',
    tag: 'HP',
    desc: 'All units gain +5 Max HP. Stacks HP!'
  },
  {
    id: 'shadow_step',
    name: 'Shadow Step',
    icon: '[SS]',
    tag: 'SPEED',
    desc: 'Units gain +1 Speed (attack sooner). Stacks speed!'
  }
];

window.getActiveTowerModifiers = function () {
  if (!trialTowerActive) return [];
  const s = loadTrialTowerState();
  return Array.isArray(s.modifiers) ? s.modifiers : [];
};

window.getActiveTowerDebuff = function () {
  if (!trialTowerActive) return null;
  const s = loadTrialTowerState();
  return s.activeDebuff;
};

function towerFloorDifficulty(floor) {
  const idx = Math.min(DIFFICULTIES.length - 1, Math.floor((floor - 1) / 3));
  return DIFFICULTIES[idx];
}
function towerFloorReward(floor) { return Math.floor((15 + floor * 5) / 2); }
const TOWER_DIFF_COLORS = { Easy: '#4C9A5B', Medium: '#d9b23c', Hard: '#e0752c', Expert: '#c1443c', Master: '#b23cf0' };
function trialTowerBrickColor(floor) { return TOWER_DIFF_COLORS[towerFloorDifficulty(floor)] || '#3E7CB1'; }

function triggerDustStormEffect() {
  const container = document.getElementById('screen-game') || document.body;
  const dustOverlay = document.createElement('div');
  dustOverlay.className = 'dust-storm-overlay';
  dustOverlay.innerHTML = `
    <div class="dust-storm-text">💨 BARBOD THROWS DUST IN YOUR EYES! 💨</div>
  `;
  container.appendChild(dustOverlay);

  if (typeof showToast === 'function') {
    showToast('💨 Barbod throws blinding dust at the screen!', 2500);
  }

  const screenEl = document.getElementById('screen-game');
  if (screenEl) {
    screenEl.classList.add('screen-shake');
    setTimeout(() => screenEl.classList.remove('screen-shake'), 500);
  }

  setTimeout(() => {
    dustOverlay.classList.add('fade-out');
    setTimeout(() => dustOverlay.remove(), 600);
  }, 1800);
}
window.triggerDustStormEffect = triggerDustStormEffect;

function showBossFloorWarningOverlay(floor, onEngage) {
  const overlay = document.getElementById('boss-floor-warning-overlay');
  if (!overlay) {
    if (onEngage) onEngage();
    return;
  }

  const bossDef = typeof getBossDefinition === 'function' ? getBossDefinition(floor) : null;
  if (!bossDef) {
    if (onEngage) onEngage();
    return;
  }

  const floorEl = document.getElementById('bfw-floor-num');
  if (floorEl) floorEl.textContent = floor;

  const nameEl = document.getElementById('bfw-boss-name');
  if (nameEl) nameEl.textContent = bossDef.name;

  const hpEl = document.getElementById('bfw-boss-hp');
  if (hpEl) hpEl.textContent = `❤️ ${bossDef.bossCard.hp} HP · Boss Tier 👑`;

  const auraEl = document.getElementById('bfw-boss-aura');
  if (auraEl) {
    auraEl.innerHTML = `<strong>⚡ ${bossDef.bossModifier.name}</strong><br>${bossDef.bossModifier.desc}`;
  }

  const tauntEl = document.getElementById('bfw-boss-taunt');
  if (tauntEl) {
    tauntEl.textContent = `"${bossDef.taunt || 'Prepare to face your doom!'}"`;
  }

  const iconEl = document.getElementById('bfw-boss-icon');
  if (iconEl) {
    iconEl.textContent = floor === 50 ? '👑' : '💀';
  }

  const engageBtn = document.getElementById('btn-boss-warning-engage');
  if (engageBtn) {
    engageBtn.onclick = () => {
      overlay.classList.add('hidden');
      if (typeof Sound !== 'undefined' && Sound.meteorBoom) Sound.meteorBoom();
      if (onEngage) onEngage();
    };
  }

  const closeBtn = document.getElementById('btn-boss-warning-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      overlay.classList.add('hidden');
    };
  }

  overlay.classList.remove('hidden');
  overlay.style.animation = 'none';
  overlay.offsetHeight;
  overlay.style.animation = '';
  if (typeof Sound !== 'undefined' && Sound.meteorBoom) Sound.meteorBoom();
  if (typeof vibrate === 'function') vibrate([40, 60, 80]);
}

let trialTowerActive = false;
function enterTrialTower(skipBossWarning = false) {
  const s = loadTrialTowerState();

  if (!skipBossWarning && typeof isBossFloor === 'function' && isBossFloor(s.floor)) {
    showBossFloorWarningOverlay(s.floor, () => {
      enterTrialTower(true);
    });
    return;
  }

  const diff = towerFloorDifficulty(s.floor);
  trialTowerActive = true;
  botDifficulty = diff;
  saveLastDifficulty(diff);
  document.getElementById('trial-tower-overlay')?.remove();
  document.getElementById('tower-ascent-modal')?.classList.add('hidden');
  const deck = (typeof buildDefaultTrialDeckConfig === 'function')
    ? buildDefaultTrialDeckConfig()
    : (typeof buildDefaultDeckConfig === 'function' ? buildDefaultDeckConfig() : null);
  startVsBot(0, deck);
}

function showTowerAscentModal(clearedFloor, reward, xp, unlockedTheme, unlockedMilestones) {
  const modal = document.getElementById('tower-ascent-modal');
  if (!modal) return;

  const s = loadTrialTowerState();
  const milestonesToAnnounce = unlockedMilestones || s.lastUnlockedMilestones || [];

  const titleEl = document.getElementById('ascent-title');
  if (titleEl) titleEl.textContent = `Floor ${clearedFloor} Conquered!`;

  const rewardsEl = document.getElementById('ascent-rewards-tag');
  if (rewardsEl) rewardsEl.textContent = `+${reward} Bux · +${xp} XP`;

  const themeBanner = document.getElementById('ascent-theme-unlock-banner');
  if (themeBanner) {
    if (unlockedTheme || (milestonesToAnnounce && milestonesToAnnounce.length > 0)) {
      themeBanner.classList.remove('hidden');
      const atuTitle = themeBanner.querySelector('.atu-title');
      const atuSub = themeBanner.querySelector('.atu-sub');
      if (milestonesToAnnounce && milestonesToAnnounce.length > 0) {
        const m = milestonesToAnnounce[0];
        if (atuTitle) atuTitle.textContent = `🏆 MILESTONE UNLOCKED: ${m.title.toUpperCase()}!`;
        if (atuSub) atuSub.textContent = `Unlocked ${m.borderName} & ${m.avatarName} Player Icon!`;
      } else if (unlockedTheme) {
        if (atuTitle) atuTitle.textContent = `THEME UNLOCKED: ${unlockedTheme.name.toUpperCase()}!`;
        if (atuSub) atuSub.textContent = `Cosmic milestone reached! Equip ${unlockedTheme.name} anytime in Themes.`;
      }
      if (typeof fireConfetti === 'function') fireConfetti();
      if (typeof updateThemeButtons === 'function') updateThemeButtons();
    } else {
      themeBanner.classList.add('hidden');
    }
  }

  const activeMods = Array.isArray(s.modifiers) ? s.modifiers : [];

  // Update active tray pills
  const trayPills = document.getElementById('ascent-active-pills');
  if (trayPills) {
    trayPills.innerHTML = '';
    if (activeMods.length === 0) {
      trayPills.innerHTML = '<span class="ascent-empty-pill">No modifiers yet</span>';
    } else {
      const counts = {};
      activeMods.forEach(m => { counts[m] = (counts[m] || 0) + 1; });
      Object.entries(counts).forEach(([mid, count]) => {
        const def = TOWER_MODIFIER_POOL.find(p => p.id === mid) || { name: mid, icon: '⚡' };
        const pill = document.createElement('span');
        pill.className = 'ascent-pill';
        pill.innerHTML = `<strong>${def.icon} ${def.name}</strong> <span class="pill-badge">x${count}</span>`;
        trayPills.appendChild(pill);
      });
    }
  }

  const choicesContainer = document.getElementById('ascent-modifier-choices');
  const nextBtn = document.getElementById('btn-ascent-next');
  const nextBtnText = document.getElementById('btn-ascent-next-text');
  let selectedMod = null;

  function renderChoices(choiceList) {
    if (!choicesContainer) return;
    choicesContainer.innerHTML = '';
    choiceList.forEach(mod => {
      const currentCount = activeMods.filter(m => m === mod.id).length;
      const card = document.createElement('div');
      card.className = 'ascent-mod-card';
      card.dataset.modId = mod.id;
      card.innerHTML = `
        <div class="ascent-mod-badge ${mod.tag.toLowerCase()}">${mod.tag}</div>
        <div class="ascent-mod-icon-wrap"><span class="ascent-mod-icon">${mod.icon}</span></div>
        <div class="ascent-mod-title">${mod.name}</div>
        <div class="ascent-mod-desc">${mod.desc}</div>
        <div class="ascent-mod-footer">
          ${currentCount > 0 
            ? `<span class="ascent-stack-chip stacked">Stack x${currentCount} ➜ <strong>x${currentCount + 1}</strong></span>` 
            : `<span class="ascent-stack-chip new">✨ New Modifier</span>`}
        </div>
      `;

      card.addEventListener('click', () => {
        choicesContainer.querySelectorAll('.ascent-mod-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMod = mod;
        if (typeof Sound !== 'undefined' && Sound.chipAttach) Sound.chipAttach();
        if (typeof vibrate === 'function') vibrate(30);

        if (nextBtn) {
          nextBtn.disabled = false;
          if (nextBtnText) {
            nextBtnText.textContent = `Ascend to Floor ${clearedFloor + 1}`;
          }
        }
      });

      choicesContainer.appendChild(card);
    });
  }

  if (nextBtn) {
    nextBtn.disabled = true;
    if (nextBtnText) nextBtnText.textContent = 'Select a Modifier to Continue';
  }

  // Draw 3 distinct random modifiers from pool
  let currentChoices = [...TOWER_MODIFIER_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  renderChoices(currentChoices);

  // Reroll Modifiers Button Listener (50 Bux)
  const rerollBtn = document.getElementById('btn-ascent-reroll');
  if (rerollBtn) {
    rerollBtn.onclick = () => {
      if (typeof spendBux === 'function') {
        if (!spendBux(50)) {
          if (typeof showToast === 'function') showToast(" You need 50 Bux to reroll modifier options!", 3000);
          if (typeof Sound !== 'undefined' && Sound.buzzer) Sound.buzzer();
          return;
        }
      }
      if (typeof Sound !== 'undefined' && Sound.counterTick) Sound.counterTick(1);
      else if (typeof Sound !== 'undefined' && Sound.chipAttach) Sound.chipAttach();

      currentChoices = [...TOWER_MODIFIER_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
      selectedMod = null;
      if (nextBtn) {
        nextBtn.disabled = true;
        if (nextBtnText) nextBtnText.textContent = 'Select a Modifier to Continue';
      }
      renderChoices(currentChoices);
      if (typeof showToast === 'function') showToast('🎲 Modifiers Rerolled! (-50 Bux)', 2500);
      if (typeof updateHUD === 'function') updateHUD();
    };
  }

  // Next Level button
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (!selectedMod) return;
      s.modifiers = s.modifiers || [];
      s.modifiers.push(selectedMod.id);
      s.floor = clearedFloor + 1;
      if (s.floor % 10 === 0) {
        s.activeDebuff = TOWER_DEBUFF_POOL[Math.floor(Math.random() * TOWER_DEBUFF_POOL.length)].id;
      }
      s.pendingResult = null;
      saveTrialTowerState(s);

      modal.classList.add('hidden');
      trialTowerActive = true;
      const diff = towerFloorDifficulty(s.floor);
      botDifficulty = diff;
      saveLastDifficulty(diff);

      if (typeof Sound !== 'undefined' && Sound.meteorBoom) Sound.meteorBoom();
      showToast(`⚡ Floor ${s.floor} Challenge Begins! Modifiers Stacked: ${s.modifiers.length}`, 3000);

      const deck = (typeof buildDefaultTrialDeckConfig === 'function')
        ? buildDefaultTrialDeckConfig()
        : (typeof buildDefaultDeckConfig === 'function' ? buildDefaultDeckConfig() : null);
      startVsBot(0, deck);
    };
  }

  // Exit & Save Run button
  const exitBtn = document.getElementById('btn-ascent-exit');
  if (exitBtn) {
    exitBtn.onclick = () => {
      if (selectedMod) {
        s.modifiers = s.modifiers || [];
        s.modifiers.push(selectedMod.id);
      }
      s.floor = clearedFloor + 1;
      s.pendingResult = 'win';
      saveTrialTowerState(s);
      modal.classList.add('hidden');
      trialTowerActive = false;
      openTrialTowerScreen();
    };
  }

  modal.classList.remove('hidden');
  if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
}

function renderCastleNodes(activeFloor) {
  const svg = document.querySelector('.tower-castle-svg');
  if (!svg) return;

  let nodesGroup = svg.querySelector('.castle-nodes');
  if (!nodesGroup) {
    nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'castle-nodes');
    svg.appendChild(nodesGroup);
  }

  const s = loadTrialTowerState();
  const clearedFloor = s.lastClearedFloor || (s.floor ? s.floor - 1 : 0);
  
  const floors = [
    { f: 1, x: 200, y: 530, label: 'L1' },
    { f: 5, x: 140, y: 450, label: 'L5' },
    { f: 10, x: 200, y: 380, label: 'L10' },
    { f: 15, x: 260, y: 320, label: 'L15' },
    { f: 20, x: 200, y: 270, label: 'L20' },
    { f: 30, x: 160, y: 180, label: 'L30' },
    { f: 50, x: 200, y: 70, label: 'L50' }
  ];

  nodesGroup.innerHTML = '';
  floors.forEach(item => {
    const isCleared = item.f <= clearedFloor;
    const isCurrent = item.f === activeFloor;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `castle-node-group ${isCleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''}`);

    // Stars floating above level node
    const starText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    starText.setAttribute('x', item.x);
    starText.setAttribute('y', item.y - 18);
    starText.setAttribute('text-anchor', 'middle');
    starText.setAttribute('font-size', '13');
    starText.setAttribute('fill', isCleared ? '#fbbf24' : (isCurrent ? '#38bdf8' : 'rgba(255,255,255,0.45)'));
    starText.setAttribute('filter', isCleared ? 'url(#glow)' : '');
    starText.textContent = isCleared ? '⭐⭐⭐' : (isCurrent ? '⭐' : '★');
    g.appendChild(starText);

    if (isCleared) {
      // Level node icon becomes a star when beaten
      const starIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      starIcon.setAttribute('x', item.x);
      starIcon.setAttribute('y', item.y + 6);
      starIcon.setAttribute('text-anchor', 'middle');
      starIcon.setAttribute('font-size', '18');
      starIcon.setAttribute('filter', 'url(#glow)');
      starIcon.textContent = '⭐';
      g.appendChild(starIcon);
    } else {
      // Unbeaten level circle badge
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', item.x);
      circle.setAttribute('cy', item.y);
      circle.setAttribute('r', isCurrent ? '13' : '10');
      circle.setAttribute('class', `cnode ${isCurrent ? 'current' : ''}`);
      circle.setAttribute('fill', isCurrent ? '#38bdf8' : '#1e293b');
      circle.setAttribute('stroke', isCurrent ? '#ffffff' : 'rgba(255,255,255,0.4)');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);

      const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelText.setAttribute('x', item.x);
      labelText.setAttribute('y', item.y + 4);
      labelText.setAttribute('text-anchor', 'middle');
      labelText.setAttribute('font-size', '9');
      labelText.setAttribute('font-weight', 'bold');
      labelText.setAttribute('fill', '#ffffff');
      labelText.textContent = item.label;
      g.appendChild(labelText);
    }

    nodesGroup.appendChild(g);
  });
}

function updatePlayerPawnPosition(floor) {
  const pawn = document.getElementById('tower-player-pawn');
  const pawnTag = document.getElementById('pawn-floor-tag');
  const pawnIcon = document.getElementById('pawn-avatar-icon');
  if (!pawn) return;

  const f = Math.max(1, Math.min(50, floor));
  const ratio = Math.min(1, Math.max(0, (f - 1) / 49));
  const y = 530 - ratio * 460;
  const x = 200 + Math.sin(ratio * Math.PI * 3) * 60;

  pawn.style.left = `${(x / 400 * 100).toFixed(2)}%`;
  pawn.style.top = `${(y / 600 * 100).toFixed(2)}%`;

  if (pawnTag) pawnTag.textContent = `Floor ${floor}`;

  let avatar = 'P';
  if (typeof loadUserProfile === 'function') {
    const prof = loadUserProfile();
    if (prof && prof.avatar) avatar = prof.avatar;
  }
  if (pawnIcon) pawnIcon.textContent = avatar;

  renderCastleNodes(floor);
}

function triggerTowerClashAnimation(clearedFloor, onDone) {
  const overlay = document.getElementById('tower-clash-overlay');
  const pAvatar = document.getElementById('clash-player-avatar');
  const pName = document.getElementById('clash-player-name');
  const eAvatar = document.getElementById('clash-enemy-avatar');
  const eName = document.getElementById('clash-enemy-name');

  if (!overlay) { if (onDone) onDone(); return; }

  let userAvatar = 'P';
  let userName = 'Player';
  if (typeof loadUserProfile === 'function') {
    const prof = loadUserProfile();
    if (prof) {
      if (prof.avatar) userAvatar = prof.avatar;
      if (prof.name) userName = prof.name;
    }
  }
  if (pAvatar) pAvatar.textContent = userAvatar;
  if (pName) pName.textContent = userName;

  const diff = towerFloorDifficulty(clearedFloor);
  if (eAvatar) eAvatar.textContent = 'AI';
  if (eName) eName.textContent = `${diff} AI`;

  overlay.classList.remove('hidden');
  if (typeof Sound !== 'undefined' && Sound.meteorBoom) Sound.meteorBoom();

  setTimeout(() => {
    overlay.classList.add('hidden');
    if (onDone) onDone();
  }, 1100);
}

function resolveTrialTowerMatch(won) {
  const s = loadTrialTowerState();
  if (won) {
    const reward = towerFloorReward(s.floor);
    const intel = towerFloorIntel(s.floor);
    addBux(reward);
    if (typeof grantPlayerXP === 'function') {
      grantPlayerXP(intel.xp || 50, `Trial Tower Floor ${s.floor}`);
    }
    recordEconomyChange(reward, `Trial Tower floor ${s.floor} cleared`);
    recordRecentActivity(`Cleared Trial Tower floor ${s.floor} — +${reward} Bux & +${intel.xp || 50} XP`);
    s.best = Math.max(s.best || 0, s.floor);
    
    const newlyUnlockedMilestones = checkAndGrantTowerMilestones(s.floor);

    let newlyUnlockedTheme = null;
    if (s.floor >= 10 || s.best >= 10) {
      if (localStorage.getItem('theme_quantum_unlocked') !== 'true') {
        localStorage.setItem('theme_quantum_unlocked', 'true');
        newlyUnlockedTheme = { id: 'quantum', name: 'Quantum Flux' };
      }
    }
    if (s.floor >= 15 || s.best >= 15) {
      if (localStorage.getItem('theme_glacier_unlocked') !== 'true') {
        localStorage.setItem('theme_glacier_unlocked', 'true');
        newlyUnlockedTheme = { id: 'glacier', name: 'Glacial Frost' };
      }
    }
    if (s.floor >= 50 || s.best >= 50) {
      if (localStorage.getItem('theme_astral_unlocked') !== 'true') {
        localStorage.setItem('theme_astral_unlocked', 'true');
        newlyUnlockedTheme = { id: 'astral', name: 'Trial Lord (S1)' };
      }
    }
    if (s.floor >= 50 || s.best >= 50) {
      if (localStorage.getItem('theme_celestial_unlocked') !== 'true') {
        localStorage.setItem('theme_celestial_unlocked', 'true');
        newlyUnlockedTheme = { id: 'celestial', name: 'Celestial Divinity' };
      }
    }

    s.lastClearedFloor = s.floor;
    s.lastRewardBux = reward;
    s.lastRewardXP = intel.xp;
    s.lastUnlockedTheme = newlyUnlockedTheme;
    s.lastUnlockedMilestones = newlyUnlockedMilestones;
    s.pendingResult = 'win_anim';
    saveTrialTowerState(s);

    // Immediately return player to screen-trial-tower for the clash & ascent sequence
    setTimeout(() => {
      document.getElementById('gameover-overlay')?.classList.add('hidden');
      openTrialTowerScreen();
    }, 120);

  } else {
    trialTowerActive = false;
    s.lastRunFloor = s.floor;
    if (s.floor > 1) showToast(`🗼 Trial Tower run ended at floor ${s.floor} — back to Floor 1.`, 3000);
    s.floor = 1;
    s.modifiers = [];
    s.pendingResult = 'loss';
    saveTrialTowerState(s);
  }
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
  const isBoss = typeof isBossFloor === 'function' && isBossFloor(floor);
  const bossDef = isBoss && typeof getBossDefinition === 'function' ? getBossDefinition(floor) : null;
  const diff = isBoss ? 'BOSS' : towerFloorDifficulty(floor);
  const reward = towerFloorReward(floor);
  const intel = towerFloorIntel(floor);

  const diffBadge = document.getElementById('tower-console-diff-badge');
  if (diffBadge) {
    diffBadge.textContent = diff;
    diffBadge.style.background = isBoss ? 'linear-gradient(135deg, #7e22ce, #e11d48)' : trialTowerBrickColor(floor);
  }

  const floorTitle = document.getElementById('tower-console-floor-title');
  if (floorTitle) {
    if (isBoss) {
      floorTitle.textContent = `FLOOR ${floor} BOSS: ${bossDef.name}`;
    } else {
      floorTitle.textContent = isCurrent ? `Floor ${floor} Challenge` : (isCleared ? `Floor ${floor} (Cleared)` : `Floor ${floor} (Upcoming)`);
    }
  }

  const descEl = document.getElementById('tower-console-desc');
  if (descEl) {
    if (isBoss) {
      descEl.textContent = `BOSS ENCOUNTER! ${bossDef.name} (${bossDef.bossCard.hp} HP) awaits. Specialized Boss Aura: ${bossDef.bossModifier.name} (${bossDef.bossModifier.desc}).`;
    } else {
      descEl.textContent = intel.desc;
    }
  }

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
    const s = loadTrialTowerState();
    const modCount = (s && Array.isArray(s.modifiers) && s.modifiers.length > 0) ? ` [${s.modifiers.length} Mods]` : '';
    if (isBoss) {
      startBtn.disabled = false;
      startBtn.innerHTML = `<span style="color:#f43f5e;font-weight:bold;">Battle ${bossDef.name} (Floor ${floor})${modCount}</span>`;
      startBtn.style.opacity = '1';
    } else if (isCurrent) {
      startBtn.disabled = false;
      startBtn.innerHTML = `<span>Ascend to Floor ${floor}${modCount}</span>`;
      startBtn.style.opacity = '1';
    } else if (isLocked) {
      startBtn.disabled = true;
      startBtn.innerHTML = `<span>Ascend to Floor ${floor} (Locked)</span>`;
      startBtn.style.opacity = '0.6';
    } else {
      startBtn.disabled = false;
      startBtn.innerHTML = `<span>Ascend to Floor ${activeFloor}${modCount}</span>`;
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
    const isBoss = typeof isBossFloor === 'function' && isBossFloor(f);
    const bossDef = isBoss && typeof getBossDefinition === 'function' ? getBossDefinition(f) : null;
    const brick = document.createElement('div');
    brick.className = `tower-brick ${isBoss ? 'brick-boss-floor' : ''}`;
    brick.dataset.floor = String(f);
    brick.style.setProperty('--brick-color', isBoss ? '#9333ea' : trialTowerBrickColor(f));
    
    const isCleared = f < clearedUpTo;
    const isCurrent = f === clearedUpTo;
    const isLocked = f > clearedUpTo;

    if (isCleared) brick.classList.add('cleared');
    if (isCurrent) brick.classList.add('current');
    if (isLocked) brick.classList.add('locked-preview');

    const diff = isBoss ? 'BOSS' : towerFloorDifficulty(f);
    const reward = towerFloorReward(f);

    brick.innerHTML = `
      <div class="tower-brick-left">
        <span class="tower-brick-num">${isBoss ? 'BOSS' : ''} Floor ${f}</span>
        <span class="tower-brick-diff">${isBoss ? bossDef.name : diff}</span>
      </div>
      <div class="tower-brick-right">
        <span class="tower-brick-bounty">+${reward} Bux</span>
        ${isCleared ? '<span class="tower-brick-check">✓</span>' : (isCurrent ? (isBoss ? '<span class="tower-brick-flag">BOSS</span>' : '<span class="tower-brick-flag">NOW</span>') : '<span style="font-size:0.75rem;opacity:0.6;">✦</span>')}
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
        <span class="tower-brick-flag">NOW</span>
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

    // Populate active run modifiers box in Trial Tower citadel
    const runBox = document.getElementById('tower-active-run-box');
    const modsRow = document.getElementById('tarb-mods-row');
    const countBadge = document.getElementById('tarb-count-badge');
    if (runBox && modsRow) {
      const curMods = Array.isArray(cur.modifiers) ? cur.modifiers : [];
      if (curMods.length > 0) {
        runBox.classList.remove('hidden');
        if (countBadge) countBadge.textContent = `${curMods.length} Stacked`;
        modsRow.innerHTML = '';
        const counts = {};
        curMods.forEach(m => { counts[m] = (counts[m] || 0) + 1; });
        Object.entries(counts).forEach(([mid, count]) => {
          const def = TOWER_MODIFIER_POOL.find(p => p.id === mid) || { name: mid, icon: '⚡' };
          const pill = document.createElement('div');
          pill.className = 'tarb-mod-pill';
          pill.innerHTML = `<span>${def.icon} ${def.name}</span> <span class="tarb-pill-count">x${count}</span>`;
          modsRow.appendChild(pill);
        });
      } else {
        runBox.classList.add('hidden');
      }
    }
  }

  if (s.pendingResult === 'win_anim') {
    const clearedFloor = s.lastClearedFloor || 1;
    const newFloor = clearedFloor + 1;
    s.pendingResult = null;
    saveTrialTowerState(s);

    // Render immediately to populate the view before animation triggers, avoiding flashes/lag
    renderTrialTowerBricks(stack, clearedFloor, clearedFloor);
    updatePlayerPawnPosition(clearedFloor);
    updateTowerConsoleForFloor(clearedFloor, true, false, false, newFloor, s.best);

    triggerTowerClashAnimation(clearedFloor, () => {
      // Smoothly ascend player pawn up the castle SVG
      updatePlayerPawnPosition(newFloor);
      if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();

      setTimeout(() => {
        showTowerAscentModal(clearedFloor, s.lastRewardBux || towerFloorReward(clearedFloor), s.lastRewardXP || 50, s.lastUnlockedTheme);
        settleView();
      }, 750);
    });
  } else if (s.pendingResult === 'loss') {
    const runFloor = s.lastRunFloor || 1;
    renderTrialTowerBricks(stack, runFloor, runFloor + 1);
    s.pendingResult = null;
    saveTrialTowerState(s);
    updateTowerConsoleForFloor(1, false, true, false, 1, s.best);
    updatePlayerPawnPosition(1);
    setTimeout(() => playTowerExplodeAnimation(citadelContainer, stack, settleView), 320);
  } else {
    updatePlayerPawnPosition(s.floor);
    settleView();
  }

  if (beginBtn && !beginBtn.dataset.bound) {
    beginBtn.dataset.bound = 'true';
    beginBtn.addEventListener('click', () => {
      enterTrialTower();
    });
    if (typeof wirePressFeedback === 'function') wirePressFeedback(beginBtn);
  }

  // Bind Milestones track button
  const milestonesBtn = document.getElementById('btn-tower-open-milestones-modal');
  if (milestonesBtn && !milestonesBtn.dataset.bound) {
    milestonesBtn.dataset.bound = 'true';
    milestonesBtn.addEventListener('click', () => {
      showTowerMilestonesModal();
    });
    if (typeof wirePressFeedback === 'function') wirePressFeedback(milestonesBtn);
  }

  // Update summary badge states
  const bestFloor = s.best || 0;
  [10, 20, 30, 40, 50].forEach(f => {
    const badge = document.getElementById(`tmsc-badge-${f}`);
    if (badge) {
      const isUnlocked = bestFloor >= f || isTowerMilestoneUnlocked(f);
      badge.classList.toggle('unlocked', isUnlocked);
      const statusEl = badge.querySelector('.tmsc-badge-status');
      if (statusEl && isUnlocked) {
        statusEl.textContent = '✓ Unlocked';
      }
    }
  });

  const loadoutBtn = document.getElementById('btn-tower-edit-loadout');
  if (loadoutBtn && !loadoutBtn.dataset.bound) {
    loadoutBtn.dataset.bound = 'true';
    loadoutBtn.addEventListener('click', () => {
      if (typeof openDeckBuilder === 'function') {
        openDeckBuilder((config) => {
          if (typeof saveActiveTrialTowerDeck === 'function') saveActiveTrialTowerDeck(config);
          if (typeof openTrialTowerScreen === 'function') openTrialTowerScreen();
        }, 'screen-trial-tower', true);
      }
    });
    if (typeof wirePressFeedback === 'function') wirePressFeedback(loadoutBtn);
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

/* ---------- Trial Tower Milestones Rewards Modal ---------- */
function showTowerMilestonesModal() {
  const existing = document.getElementById('tower-milestones-modal');
  if (existing) existing.remove();

  const s = loadTrialTowerState();
  const bestFloor = s.best || 0;

  const modal = document.createElement('div');
  modal.id = 'tower-milestones-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 100000;
    background: rgba(4, 6, 12, 0.88); backdrop-filter: blur(14px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeInModal 0.25s ease forwards;
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(145deg, #1e1b4b 0%, #0f172a 100%); border: 1px solid rgba(192, 132, 252, 0.4); border-radius: 20px; padding: 28px; max-width: 580px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.7); color: #fff; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <h3 style="font-size: 1.35rem; font-weight: 800; color: #fde047; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>Trial Lord Milestone Rewards</span>
          </h3>
          <p style="font-size: 0.8rem; color: #a855f7; margin: 4px 0 0 0;">Highest Tower Floor Record: <b>Floor ${bestFloor}</b></p>
        </div>
        <button type="button" class="feature-close" id="btn-close-milestones-modal" style="background:none; border:none; color:#fff; font-size:1.4rem; cursor:pointer;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
        ${TOWER_MILESTONE_REWARDS.map(m => {
          const unlocked = bestFloor >= m.floor || isTowerMilestoneUnlocked(m.floor);
          const isApex = m.floor === 50;
          return `
            <div style="background: ${unlocked ? 'rgba(192, 132, 252, 0.12)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${unlocked ? (isApex ? '#eab308' : '#a855f7') : 'rgba(255,255,255,0.08)'}; border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; transition: all 0.2s ease;">
              <div style="font-size: 2.2rem; min-width: 48px; text-align: center;">${m.icon}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span style="font-size: 0.95rem; font-weight: 800; color: ${unlocked ? '#fff' : '#94a3b8'};">Floor ${m.floor} · ${m.title}</span>
                  <span style="font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: ${unlocked ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.08)'}; color: ${unlocked ? '#4ade80' : '#64748b'}; border: 1px solid ${unlocked ? 'rgba(74, 222, 128, 0.4)' : 'transparent'};">
                    ${unlocked ? 'UNLOCKED' : `LOCKED (Reach Floor ${m.floor})`}
                  </span>
                </div>
                <div style="font-size: 0.78rem; color: #cbd5e1; margin-bottom: 8px;">${m.desc}</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button type="button" class="primary-btn small btn-equip-milestone-avatar" data-avatar-id="${m.avatarId}" ${!unlocked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="background: linear-gradient(135deg, #a855f7, #6366f1); border:none;"'}>
                    Equip Avatar
                  </button>
                  <button type="button" class="secondary-btn small btn-equip-milestone-border" data-frame-class="${m.frameClass}" ${!unlocked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                    Equip Border
                  </button>
                  ${m.themeId ? `
                    <button type="button" class="primary-btn small btn-equip-milestone-theme" data-theme-id="${m.themeId}" ${!unlocked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="background: linear-gradient(135deg, #eab308, #f59e0b); border:none; color:#000;"'}>
                      Equip Theme
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <button type="button" class="secondary-btn" id="btn-close-milestones-bottom" style="width: 100%; justify-content: center; padding: 10px;">Close Milestone Rewards</button>
    </div>
  `;

  document.body.appendChild(modal);

  const doClose = () => modal.remove();
  modal.querySelector('#btn-close-milestones-modal').onclick = doClose;
  modal.querySelector('#btn-close-milestones-bottom').onclick = doClose;

  modal.querySelectorAll('.btn-equip-milestone-avatar').forEach(btn => {
    btn.onclick = () => {
      const aId = btn.dataset.avatarId;
      if (typeof ParticleAvatarEngine !== 'undefined' && aId) {
        ParticleAvatarEngine.setActiveAvatarId(aId);
        showToast(`✨ Equipped Trial Lord Particle Avatar!`, 2500);
        if (typeof Sound !== 'undefined' && Sound.playLevelUp) Sound.playLevelUp();
      }
    };
  });

  modal.querySelectorAll('.btn-equip-milestone-border').forEach(btn => {
    btn.onclick = () => {
      const fc = btn.dataset.frameClass;
      setEquippedProfileBorder(fc);
      showToast(`🖼️ Equipped Trial Lord Cosmetic Border Frame!`, 2500);
      if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
    };
  });

  modal.querySelectorAll('.btn-equip-milestone-theme').forEach(btn => {
    btn.onclick = () => {
      const tId = btn.dataset.themeId;
      if (typeof setTheme === 'function' && tId) {
        setTheme(tId);
        showToast(`🌌 Equipped Trial Lord (S1) Theme!`, 2500);
        if (typeof Sound !== 'undefined' && Sound.themeSwitch) Sound.themeSwitch();
      }
    };
  });
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
  const _origCreateMatch = window.createMatch;
  if (typeof _origCreateMatch === 'function') {
    window.createMatch = function (...args) {
      window.completedQuestsInCurrentMatch = [];
      return _origCreateMatch(...args);
    };
  }

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

      // Show end-of-match quest completion toast rewards!
      if (window.completedQuestsInCurrentMatch && window.completedQuestsInCurrentMatch.length > 0) {
        window.completedQuestsInCurrentMatch.forEach((q, idx) => {
          setTimeout(() => {
            showToast(`🎯 Quest Complete: "${q.title}" (+${q.rewardBux} Bux, +${q.rewardXP} XP) 🎁`, 4200);
            if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
          }, 1100 + idx * 1600);
        });
        window.completedQuestsInCurrentMatch = [];
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
  { id: 'pack_large',    name: 'Large Pack',    count: 5,  cost: 55,  art: '🎴', tag: 'BEST VALUE', badge: '5 Cards', desc: '5 unowned cards including guaranteed high-tier synergy.' },
  { id: 'pack_mega',     name: 'Mega Pack',     count: 8,  cost: 90,  art: '💼', tag: 'ELITE HAUL', badge: '8 Cards', desc: 'Substantial 8-card unlock pack for rapid deckbuilding.' },
  { id: 'pack_ultra',    name: 'Ultra Pack',    count: 12, cost: 140, art: '🏆', tag: 'MYTHIC VAULT', badge: '12 Cards', desc: 'Massive 12-card grand bundle to complete your master vault.' },
];

function individualCardPrice(kind, tier) {
  if (kind === 'unit') return tier === 4 ? 200 : tier === 3 ? 130 : 80;
  return 60; // spell or chip
}

function buildTodaysShopPicks() {
  const seed = dayIndexSeed();
  // Filter out any Battle Pass cosmetics (cost 0 or tagged SEASON / BATTLE PASS):
  const shopEligibleCosmetics = COSMETIC_ITEMS.filter(c => c.cost > 0 && !(c.tag && c.tag.includes('SEASON')) && !c.id.startsWith('victoryanim_') && !c.id.includes('chronos') && !c.id.includes('quantum') && !c.id.includes('singularity') && !c.id.includes('apex') && !c.id.includes('hyperdrive') && !c.id.includes('solar') && !c.id.includes('nebula') && !c.id.includes('kraken'));
  const cosmeticIds = seededPick(shopEligibleCosmetics.map(c => c.id), seed, 8);

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
  if (isIndividualCardOwned(entry) || (typeof isCollectionComplete === 'function' && isCollectionComplete())) {
    if (typeof Sound !== 'undefined' && typeof Sound.buzzer === 'function') {
      try { Sound.buzzer(); } catch (e) {}
    }
    showToast('You already own this card.');
    return;
  }
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
    code: 'grandvault',
    reward: '💰 Master Tycoon Bounty: +2,500 Mehrbod Bux Vault Deposit',
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
  },
  {
    code: 'capitaloffrance',
    reward: '😊 Verity Theme: Unlocks the secret Verity theme with smiling yellow faces + 1,000 Bux bonus!',
    icon: '😊'
  },
  {
    code: 'Kareem',
    reward: '🌟 Kareem Bounty: Card Pack (2 Cards Opening Animation) + 300 Mehrbod Bux + ✨ Void Sleeves',
    icon: '🌟'
  },
  {
    code: 'code',
    reward: '😱 Jumpscare Code: Rapid strobe lights, black screen & loud jumpscare + 100 Mehrbod Bux',
    icon: '😱'
  },
  {
    code: 'barbod',
    reward: '🗑️ Barbod\'s Scam: -5 Mehrbod Bux and 1 piece of worthless dust',
    icon: '🗑️'
  }
];

function showCodeRewardModal(title, icon, rewardItems) {
  const existing = document.getElementById('code-reward-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'code-reward-modal';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 100000;
    background: rgba(4, 6, 12, 0.88); backdrop-filter: blur(16px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeInModal 0.25s ease forwards;
  `;

  const itemsHtml = rewardItems.map(item => `
    <div style="display: flex; align-items: center; gap: 14px; background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; text-align: left;">
      <div style="font-size: 1.8rem; background: rgba(255,255,255,0.06); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px;">${item.icon}</div>
      <div>
        <div style="font-weight: 700; font-size: 1rem; color: #fff;">${item.title}</div>
        <div style="font-size: 0.82rem; color: #94a3b8; margin-top: 2px;">${item.desc}</div>
      </div>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div style="background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(236, 72, 153, 0.4); border-radius: 24px; padding: 36px 28px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.7), 0 0 30px rgba(236, 72, 153, 0.3); text-align: center;">
      <div style="font-size: 3rem; margin-bottom: 12px; animation: bounceIcon 0.8s ease infinite alternate;">${icon}</div>
      <h3 style="font-size: 1.6rem; font-weight: 800; color: #fff; margin-bottom: 6px;">${title}</h3>
      <p style="font-size: 0.9rem; color: #ec4899; font-weight: 700; margin-bottom: 20px;">Code Successfully Redeemed!</p>
      <div style="margin-bottom: 24px;">
        ${itemsHtml}
      </div>
      <button type="button" class="primary-btn" id="btn-claim-code-reward" style="width: 100%; justify-content: center; padding: 12px; font-size: 1rem;">Awesome, Claim Rewards! 🎉</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const claimBtn = overlay.querySelector('#btn-claim-code-reward');
  claimBtn.onclick = () => {
    overlay.style.animation = 'fadeOutModal 0.2s ease forwards';
    setTimeout(() => overlay.remove(), 200);
    if (typeof Sound !== 'undefined' && Sound.select) Sound.select();
  };
}

function loadRedeemedCodes() {
  try { const a = JSON.parse(localStorage.getItem(REDEEMED_CODES_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function saveRedeemedCodes(list) {
  try { localStorage.setItem(REDEEMED_CODES_KEY, JSON.stringify([...new Set(list)])); } catch (e) {}
}
function redeemShopCode(rawCode) {
  const code = String(rawCode || '').trim().toLowerCase();
  const cleanCode = code.replace(/[^a-z0-9]/g, '');
  const inputEl = document.getElementById('shop-code-input');
  if (!code && !cleanCode) { showToast('Enter a code first.'); return; }

  const isVerityCode = (cleanCode === 'capitaloffrance' || cleanCode === 'paris' || cleanCode === 'france' || code === 'capital of france' || code === 'capitaloffrance');

  const redeemed = loadRedeemedCodes();
  
  // Skip redeemed check only for 'barbod' to ensure it's truly repeatable
  if (cleanCode !== 'barbod') {
    if (isVerityCode && (redeemed.includes('capitaloffrance') || redeemed.includes('paris') || redeemed.includes('capital of france'))) {
      showToast('That code has already been redeemed on this device.');
      return;
    }
    if (redeemed.includes(code) || (cleanCode && redeemed.includes(cleanCode))) {
      showToast('That code has already been redeemed on this device.');
      return;
    }
  }

  const moderateCodes = {
    frostbite: { bux: 150, xp: 50, bpXp: 1000, desc: '❄️ Frosty reward! +150 Bux, 50 Player XP & 1,000 BP XP.' },
    phoenix: { bux: 200, xp: 75, bpXp: 1500, desc: '🔥 Phoenix rebirth! +200 Bux, 75 Player XP & 1,500 BP XP.' },
    overcharge: { bux: 250, xp: 40, bpXp: 2000, desc: '⚡ Overcharged nodes! +250 Bux, 40 Player XP & 2,000 BP XP.' },
    neonwave: { bux: 175, xp: 100, bpXp: 1200, desc: '🌊 Neon retro waves! +175 Bux, 100 Player XP & 1,200 BP XP.' },
    goldengrail: { bux: 300, xp: 50, bpXp: 1000, desc: '🏆 Holy Grail! +300 Bux, 50 Player XP & 1,000 BP XP.' },
    shadowstep: { bux: 120, xp: 80, bpXp: 800, desc: '👥 Slid into shadows! +120 Bux, 80 Player XP & 800 BP XP.' },
    vortex: { bux: 180, xp: 60, bpXp: 1400, desc: '🌀 Swirling dimensional vortex! +180 Bux, 60 Player XP & 1,400 BP XP.' },
    aether: { bux: 220, xp: 70, bpXp: 1100, desc: '✨ Aetherial mist! +220 Bux, 70 Player XP & 1,100 BP XP.' },
    catalyst: { bux: 150, xp: 120, bpXp: 1300, desc: '⚗️ Catalyst active! +150 Bux, 120 Player XP & 1,300 BP XP.' },
    solarflare: { bux: 250, xp: 90, bpXp: 1800, desc: '☀️ Solar storm! +250 Bux, 90 Player XP & 1,800 BP XP.' },
    echoes: { bux: 130, xp: 70, bpXp: 900, desc: '🗣️ Echoes of the past! +130 Bux, 70 Player XP & 900 BP XP.' },
    titan: { bux: 300, xp: 50, bpXp: 1500, desc: '🛡️ Giant Titan! +300 Bux, 50 Player XP & 1,500 BP XP.' },
    gravity: { bux: 160, xp: 90, bpXp: 1000, desc: '🌌 Gravitational pull! +160 Bux, 90 Player XP & 1,000 BP XP.' },
    nebula: { bux: 240, xp: 80, bpXp: 1600, desc: '💫 Nebula dust! +240 Bux, 80 Player XP & 1,600 BP XP.' },
    apex: { bux: 350, xp: 100, bpXp: 2000, desc: '🌟 Apex status! +350 Bux, 100 Player XP & 2,000 BP XP.' },
    mirage: { bux: 140, xp: 65, bpXp: 1000, desc: '🏜️ Sandy Mirage! +140 Bux, 65 Player XP & 1,000 BP XP.' },
    blitz: { bux: 200, xp: 50, bpXp: 1200, desc: '🏃 Quick blitz! +200 Bux, 50 Player XP & 1,200 BP XP.' },
    specter: { bux: 190, xp: 85, bpXp: 1500, desc: '👻 Spooky Specter! +190 Bux, 85 Player XP & 1,500 BP XP.' },
    quantum: { bux: 280, xp: 110, bpXp: 1700, desc: '⚛️ Quantum leap! +280 Bux, 110 Player XP & 1,700 BP XP.' },
    relic: { bux: 210, xp: 100, bpXp: 1300, desc: '🏺 Ancient Relic! +210 Bux, 100 Player XP & 1,300 BP XP.' }
  };

  if (moderateCodes[cleanCode]) {
    const data = moderateCodes[cleanCode];
    addBux(data.bux);
    recordEconomyChange(data.bux, `Redeemed code: ${cleanCode}`);
    if (typeof savePlayerXP === 'function' && typeof loadPlayerXP === 'function') {
      savePlayerXP(loadPlayerXP() + data.xp);
    }
    try {
      const currentBpXp = parseInt(localStorage.getItem('mehrbod-cards-bp-xp') || '0', 10);
      localStorage.setItem('mehrbod-cards-bp-xp', (currentBpXp + data.bpXp).toString());
      if (typeof renderBattlePassScreen === 'function') renderBattlePassScreen();
    } catch (e) {}

    recordRecentActivity(`Redeemed code "${cleanCode}" — ${data.desc}`);
    showToast(data.desc, 4000);
    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();

    if (inputEl) inputEl.value = '';
    redeemed.push(code);
    if (cleanCode) redeemed.push(cleanCode);
    saveRedeemedCodes(redeemed);
    return;
  }

  if (cleanCode === 'kareem') {
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
    }
    const count = 2;
    const granted = pool.slice(0, count);
    granted.forEach(g => {
      if (g.kind === 'unit') { if (!col.units.includes(g.id)) col.units.push(g.id); }
      else if (g.kind === 'spell') { if (!col.spells.includes(g.id)) col.spells.push(g.id); }
      else { if (!col.chips.includes(g.id)) col.chips.push(g.id); }
    });
    saveCollection(col);
    updateThemeButtons();
    if (typeof checkMilestones === 'function') checkMilestones();
    else if (typeof checkAchievements === 'function') checkAchievements();

    addBux(300);
    recordEconomyChange(300, 'Redeemed code: Kareem (+300 Bux & Card Pack)');

    const ownedCosmetics = loadOwnedCosmetics();
    if (!ownedCosmetics.includes('sleeve_void')) {
      ownedCosmetics.push('sleeve_void');
      saveOwnedCosmetics(ownedCosmetics);
    }
    if (typeof equipSleeve === 'function') equipSleeve('sleeve_void');

    grantPlayerXP(30, 'Kareem Pack opened');
    recordRecentActivity('Redeemed code "Kareem" — Card Pack + 300 Bux + ✨ Void Sleeves');

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
      showCodeRewardModal('Kareem Bounty', '🌟', [
        { icon: '📦', title: 'Card Pack (2 Cards)', desc: `Unlocked: ${names.join(', ')}` },
        { icon: '💰', title: '+300 Mehrbod Bux', desc: 'Added to your vault balance' },
        { icon: '✨', title: 'Void Sleeves', desc: 'Mythic card sleeves unlocked & equipped' }
      ]);
      if (typeof renderCollectionScreen === 'function') renderCollectionScreen();
    });
    Sound.sparkle();
  } else if (cleanCode === 'leo') {
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
  } else if (cleanCode === '2ndyear') {
    unlockValentineTheme();
    recordRecentActivity('Redeemed a secret code — unlocked the Valentine theme');
    showCodeRewardModal('Secret Valentine', '💘', [
      { icon: '🎨', title: 'Valentine Theme', desc: 'Unlocked secret seasonal theme with floating hearts & cupids' }
    ]);
    Sound.sparkle();
  } else if (cleanCode === 'grandvault' || cleanCode === 'jackpot') {
    addBux(2500);
    recordEconomyChange(2500, 'Redeemed code: grandvault');
    recordRecentActivity('Redeemed secret code — +2,500 Bux');
    showCodeRewardModal('Grand Vault Reward', '💰', [
      { icon: '💰', title: '+2,500 Mehrbod Bux', desc: 'Added directly to your vault balance' }
    ]);
    Sound.sparkle();
  } else if (cleanCode === 'royalty') {
    const owned = loadOwnedCosmetics();
    const hasSleeve = owned.includes('sleeve_gold');
    if (!hasSleeve) {
      owned.push('sleeve_gold');
      saveOwnedCosmetics(owned);
      if (typeof equipSleeve === 'function') equipSleeve('sleeve_gold');
      addBux(500);
      recordEconomyChange(500, 'Redeemed code: royalty (Gold Sleeves + 500 Bux)');
      recordRecentActivity('Redeemed code "royalty" — unlocked ✨ Gold Sleeves + 500 Bux');
      showCodeRewardModal('Royalty Bounty', '👑', [
        { icon: '✨', title: 'Gold Sleeves', desc: 'Unlocked & equipped Epic gold card borders' },
        { icon: '💰', title: '+500 Mehrbod Bux', desc: 'Bonus vault deposit' }
      ]);
    } else {
      addBux(1000);
      recordEconomyChange(1000, 'Redeemed code: royalty (+1,000 Bux)');
      recordRecentActivity('Redeemed code "royalty" — +1,000 Bux');
      showCodeRewardModal('Royalty Bounty', '👑', [
        { icon: '💰', title: '+1,000 Mehrbod Bux', desc: 'Duplicate Gold Sleeves bonus vault deposit' }
      ]);
    }
    Sound.sparkle();
  } else if (cleanCode === 'lucky7') {
    addBux(777);
    recordEconomyChange(777, 'Redeemed a secret code');
    recordRecentActivity('Redeemed a secret code — +777 Bux');
    showToast('🎰 Lucky Sevens! +777 Mehrbod Bux added to your balance.', 3600);
    Sound.sparkle();
  } else if (cleanCode === 'cybergrid') {
    grantCards([], [], ALL_CHIP_IDS.slice());
    grantArenaRP(75);
    addBux(400);
    recordEconomyChange(400, 'Redeemed a secret code');
    recordRecentActivity('Redeemed a secret code — Chips unlocked + 75 Arena RP + 400 Bux');
    if (typeof checkMilestones === 'function') checkMilestones();
    else if (typeof checkAchievements === 'function') checkAchievements();
    showToast('⚡ System Overdrive! All Chips unlocked + 75 Arena RP + 400 Bux.', 4000);
    Sound.sparkle();
  } else if (cleanCode === 'givemelava') {
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
  } else if (cleanCode === 'stargazer') {
    addBux(350);
    recordEconomyChange(350, 'Redeemed a secret code');
    grantPlayerXP(80);
    grantWeeklyPoints(25);
    recordRecentActivity('Redeemed a secret code — +350 Bux + 80 XP + 25 Vault Pts');
    showToast('✨ Celestial boon granted! +350 Bux, 80 Player XP & 25 Vault Points.', 3800);
    Sound.sparkle();
  } else if (isVerityCode) {
    const owned = loadOwnedCosmetics();
    const alreadyOwned = owned.includes('theme_verity') || owned.includes('verity');
    if (!alreadyOwned) {
      owned.push('theme_verity');
      owned.push('verity');
      saveOwnedCosmetics(owned);
    }
    try {
      localStorage.setItem('theme_verity_unlocked', 'true');
    } catch (e) {}
    if (typeof saveInventoryBackup === 'function') saveInventoryBackup();
    if (typeof updateThemeButtons === 'function') updateThemeButtons();
    if (typeof renderCollectionScreen === 'function') renderCollectionScreen(typeof currentLockerTopTab !== 'undefined' ? currentLockerTopTab : 'themes');
    if (typeof applyTheme === 'function') applyTheme('verity');

    if (alreadyOwned) {
      addBux(1000);
      recordEconomyChange(1000, 'Redeemed code: CAPITALOFFRANCE (+1,000 Bux bonus)');
      recordRecentActivity('Redeemed code "CAPITALOFFRANCE" — equipped Verity theme + 1,000 Bux bonus');
      showToast('😊 Verity theme equipped! You already owned it, so here is +1,000 Bux!', 4000);
    } else {
      recordRecentActivity('Redeemed code "CAPITALOFFRANCE" — unlocked secret 😊 Verity theme');
      showToast('😊 Secret Code Correct! 😊 Verity theme unlocked & equipped!', 4200);
    }
    Sound.sparkle();
    redeemed.push('capitaloffrance');
  } else if (cleanCode === 'code') {
    // 1. Rapidly flashing lights of changing colors
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; z-index:999999; transition: background 0.04s ease; background:#ff0055;';
    document.body.appendChild(overlay);

    let flashCount = 0;
    const colors = ['#ff0055', '#00ffcc', '#ffff00', '#ff00ff', '#0000ff', '#ff4500', '#ffffff', '#00ff00', '#800080', '#ff1493'];
    const flashInterval = setInterval(() => {
      flashCount++;
      overlay.style.background = colors[Math.floor(Math.random() * colors.length)];
      if (flashCount > 35) {
        clearInterval(flashInterval);
        // 2. Ending at black screen
        overlay.style.background = '#000000';

        // 3. Jumpscare with loud noises after 1 second
        setTimeout(() => {
          overlay.innerHTML = `
            <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#000000; animation: jumpScareShake 0.05s infinite;">
              <div style="animation: jumpScarePop 0.08s ease infinite alternate; filter: drop-shadow(0 0 50px #ff0000); transform: scale(1.3);">
                <svg viewBox="0 0 400 400" width="340" height="340">
                  <ellipse cx="200" cy="200" rx="170" ry="195" fill="#050507" stroke="#1c1c24" stroke-width="5"/>
                  <ellipse cx="130" cy="155" rx="48" ry="38" fill="#000" stroke="#ff0000" stroke-width="5"/>
                  <ellipse cx="270" cy="155" rx="48" ry="38" fill="#000" stroke="#ff0000" stroke-width="5"/>
                  <circle cx="130" cy="155" r="16" fill="#ff0000"/>
                  <circle cx="270" cy="155" r="16" fill="#ff0000"/>
                  <path d="M 110 260 Q 200 390 290 260 Q 240 320 200 305 Q 160 320 110 260 Z" fill="#000" stroke="#ff0000" stroke-width="5"/>
                  <polygon points="125,265 138,315 150,270" fill="#fff"/>
                  <polygon points="150,270 162,325 175,275" fill="#fff"/>
                  <polygon points="175,275 188,330 200,280" fill="#fff"/>
                  <polygon points="200,280 212,330 225,275" fill="#fff"/>
                  <polygon points="225,275 238,325 250,270" fill="#fff"/>
                  <polygon points="250,270 262,315 275,265" fill="#fff"/>
                </svg>
              </div>
              <div style="font-size: 3.5rem; font-weight: 900; color: #ff0000; letter-spacing: 0.18em; margin-top: 15px; font-family: monospace; text-shadow: 0 0 25px #ff0000, 0 0 50px #ff0000;">JUMPSCARE!</div>
            </div>
          `;

          if (!document.getElementById('jumpscare-styles')) {
            const style = document.createElement('style');
            style.id = 'jumpscare-styles';
            style.innerHTML = `
              @keyframes jumpScareShake {
                0% { transform: translate(0, 0) rotate(0deg); }
                20% { transform: translate(-25px, 20px) rotate(-8deg); }
                40% { transform: translate(25px, -20px) rotate(8deg); }
                60% { transform: translate(-20px, -25px) rotate(-5deg); }
                80% { transform: translate(22px, 18px) rotate(6deg); }
                100% { transform: translate(0, 0) rotate(0deg); }
              }
              @keyframes jumpScarePop {
                0% { transform: scale(0.6); }
                100% { transform: scale(1.55); }
              }
            `;
            document.head.appendChild(style);
          }

          // Play very loud screamer & noise blast with Web Audio API
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(5000, audioCtx.currentTime + 1.2);

            osc2.type = 'square';
            osc2.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(2500, audioCtx.currentTime + 1.2);

            gain.gain.setValueAtTime(0.95, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);

            osc.connect(gain);
            osc2.connect(gain);

            // White noise static roar blast
            const bufferSize = audioCtx.sampleRate * 2;
            const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              output[i] = Math.random() * 2 - 1;
            }
            const whiteNoise = audioCtx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            const noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(2200, audioCtx.currentTime);
            noiseFilter.Q.setValueAtTime(2.5, audioCtx.currentTime);

            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.9, audioCtx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);

            whiteNoise.connect(noiseFilter).connect(noiseGain).connect(gain);

            gain.connect(audioCtx.destination);

            osc.start();
            osc2.start();
            whiteNoise.start();

            osc.stop(audioCtx.currentTime + 2.0);
            osc2.stop(audioCtx.currentTime + 2.0);
            whiteNoise.stop(audioCtx.currentTime + 2.0);
          } catch (e) {}

          // End jumpscare after 2 seconds (gives nothing, repeatable)
          setTimeout(() => {
            overlay.remove();
          }, 2000);

        }, 1000);
      }
    }, 70);

    if (inputEl) inputEl.value = '';
    return;
  } else if (cleanCode === 'dinnerbone') {
    if (window.__dinnerboneEndTime && Date.now() < window.__dinnerboneEndTime) {
      showToast('Dinnerbone is already active!');
      if (inputEl) inputEl.value = '';
      return;
    }
    const duration = 5 * 60 * 1000;
    const endTime = Date.now() + duration;
    window.__dinnerboneEndTime = endTime;

    document.documentElement.style.transition = 'transform 2s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    document.documentElement.style.transform = 'rotate(180deg)';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.overflow = 'hidden';

    const buxCounter = document.getElementById('bux-counter');
    const buxVal = document.getElementById('bux-counter-value');
    const buxIcon = buxCounter ? buxCounter.querySelector('.bux-icon-3d') : null;

    const timerSpan = document.createElement('span');
    timerSpan.id = 'dinnerbone-timer-display';
    timerSpan.style.color = '#ff4757';
    timerSpan.style.fontWeight = '900';
    timerSpan.style.fontSize = '1.1rem';
    timerSpan.style.textShadow = '0 0 10px rgba(255, 71, 87, 0.5)';
    
    if (buxVal) buxVal.style.display = 'none';
    if (buxIcon) buxIcon.style.display = 'none';
    if (buxCounter) buxCounter.appendChild(timerSpan);

    const updateTimer = () => {
      const remaining = Math.max(0, window.__dinnerboneEndTime - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      timerSpan.textContent = `🙃 ${mins}:${secs.toString().padStart(2, '0')}`;

      if (remaining > 0 && window.__dinnerboneEndTime > 0) {
        requestAnimationFrame(updateTimer);
      } else if (window.__dinnerboneEndTime > 0) {
        document.documentElement.style.transform = '';
        document.documentElement.style.overflow = '';
        if (buxVal) buxVal.style.display = '';
        if (buxIcon) buxIcon.style.display = '';
        timerSpan.remove();
        window.__dinnerboneEndTime = 0;
        showToast('The Dinnerbone curse has been lifted!');
      }
    };
    updateTimer();

    showToast('🙃 DINNERBONE! Gravity has inverted for 5 minutes.', 4000);
    Sound.sparkle();
    if (inputEl) inputEl.value = '';
    return;
  } else if (cleanCode === 'beautyofannihilation') {
    if (window.__rayGunActive) {
      showToast('Ray Gun is already online!');
      if (inputEl) inputEl.value = '';
      return;
    }
    initRayGunSystem();
    if (inputEl) inputEl.value = '';
    return;
  } else if (cleanCode === 'leo2') {
    if (localStorage.getItem('leo2_permanently_burned') === 'true') {
      showToast("Code 'leo2' has already been permanently consumed! It cannot be used again.", 4500);
      if (inputEl) inputEl.value = '';
      return;
    }

    // Set permanently burned state immediately so it can never be used again
    try {
      localStorage.setItem('leo2_permanently_burned', 'true');
    } catch (e) {}

    // Reset all used/redeemed codes so other codes can be reused
    saveRedeemedCodes([]);

    // Reset collection
    saveCollection({ units: [], spells: [], chips: [] });
    // Reset cosmetics and themes list
    saveOwnedCosmetics([]);
    // Remove individual theme unlocks from local storage
    try {
      localStorage.removeItem('theme_prism_unlocked');
      localStorage.removeItem('theme_darkmatter_unlocked');
      localStorage.removeItem('theme_collector_unlocked');
      localStorage.removeItem('theme_verity_unlocked');
      localStorage.removeItem('theme_magma_unlocked');
    } catch (e) {}
    // Reset theme to 'dark'
    if (typeof applyTheme === 'function') applyTheme('dark');
    // Reset Mehrbod's Bux to zero
    saveBux(0);
    if (typeof updateBuxDisplay === 'function') updateBuxDisplay();
    
    // Reset Player XP and Battlepass
    if (typeof savePlayerXP === 'function') savePlayerXP(0);
    try {
      localStorage.setItem('mehrbod-cards-bp-xp', '0');
      localStorage.setItem('mehrbod-cards-bp-claimed', '{}');
    } catch (e) {}
    
    // Update theme selections/collection screen if open
    if (typeof updateThemeButtons === 'function') updateThemeButtons();
    if (typeof renderCollectionScreen === 'function') renderCollectionScreen();
    if (typeof renderBattlePassScreen === 'function') {
      try { renderBattlePassScreen(); } catch (e) {}
    }
    
    showToast("🧹 SYSTEM RESET! All cards, cosmetics, battlepass progress, Bux, and code redemptions have been wiped. (leo2 is now permanently burned)", 5000);
    if (typeof Sound !== 'undefined' && Sound.select) Sound.select();
    if (inputEl) inputEl.value = '';
    return;
  } else if (cleanCode === 'barbod') {
    addBux(-5);
    recordEconomyChange(-5, 'Redeemed code: barbod (-5 Bux scam tax)');
    recordRecentActivity('Redeemed code "barbod" — Lost 5 Bux and received 1 worthless dust. Oof!');
    showToast('🗑️ Barbod scam code! You lost 5 Bux and received 1 piece of useless dust.', 4500);
    Sound.select();
    if (typeof triggerBarbodDustEffect === 'function') {
      setTimeout(() => triggerBarbodDustEffect(), 400);
    }
    if (inputEl) inputEl.value = '';
    return;
  } else {
    showToast("That code isn't valid.");
    return; // don't burn an attempt on a code that never worked
  }
  
  if (inputEl) inputEl.value = '';

  redeemed.push(code);
  if (cleanCode) redeemed.push(cleanCode);
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
    
    // Ensure the original price represents at least a 50% discount
    const originalPrice = (item.original && item.original > item.cost)
      ? Math.max(item.original, Math.round(item.cost * 2.15))
      : 0;

    const discount = originalPrice && originalPrice > item.cost
      ? Math.round((1 - item.cost / originalPrice) * 100) : 0;
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
                ${discount ? `<del class="fn-del">${originalPrice.toLocaleString()}</del>` : ''}
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
  const packCard = (p) => {
    const isComplete = typeof isCollectionComplete === 'function' && isCollectionComplete();
    return `
    <div class="fn-tile fn-epic ${isComplete ? 'collection-complete' : ''}" data-shop-buy="pack:${p.id}" ${isComplete ? 'style="border: 2px dashed #9ca3af; filter: grayscale(1) opacity(0.55);"' : ''}>
      <div class="fn-tile-bg" ${isComplete ? 'style="background: radial-gradient(circle at center, rgba(156, 163, 175, 0.15) 0%, rgba(0, 0, 0, 0) 70%);"' : ''}></div>
      <div class="fn-tile-top">
        ${isComplete ? `<span class="fn-tag" style="background: linear-gradient(135deg, #9ca3af, #4b5563); color: #fff; font-weight: 800; border-radius: 4px; box-shadow: 0 0 8px rgba(156, 163, 175, 0.5); text-shadow: none;">✓ COMPLETE</span>` : ''}
        <span class="fn-power-tag">${p.count} CARDS</span>
      </div>
      <div class="fn-tile-art">
        <span class="fn-tile-icon" ${isComplete ? 'style="filter: drop-shadow(0 0 8px #9ca3af);"' : ''}>${p.art}</span>
      </div>
      <div class="fn-tile-footer">
        <div class="fn-tile-name" ${isComplete ? 'style="color: #9ca3af;"' : ''}>${p.name}</div>
        ${isComplete ? `<div class="fn-tile-sub"><strong style="color: #9ca3af; font-size: 0.8rem; text-shadow: 0 0 4px rgba(156, 163, 175, 0.3);">MAX COLLECTION!</strong></div>` : ''}
        <div class="fn-tile-price-row">
          <div class="fn-price">
            <span class="fn-coin">◉</span>
            <span class="fn-cost">${p.cost.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>`;
  };

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
      </header>

      <!-- SECTION 0: LUCKY SPIN WHEEL -->
      <section class="fn-section fn-spin-wheel-section" style="margin-bottom: 30px;">
        <div class="fn-section-bar">
          <h2 class="fn-section-title">✨ LUCKY SPIN WHEEL</h2>
          <span class="fn-section-badge" id="spin-wheel-cost-badge">FREE DAILY SPIN AVAILABLE</span>
        </div>
        <div class="spin-wheel-container" style="display: flex; flex-direction: row; gap: 30px; background: rgba(15, 23, 42, 0.6); border: 1.5px solid rgba(236, 72, 153, 0.25); border-radius: 20px; padding: 24px; align-items: center; justify-content: center; flex-wrap: wrap; box-shadow: inset 0 0 20px rgba(236, 72, 153, 0.05); margin-top: 12px;">
          <!-- Canvas Wrapper -->
          <div style="position: relative; width: 280px; height: 280px; display: flex; align-items: center; justify-content: center;">
            <canvas id="lucky-spin-canvas" width="280" height="280" style="width: 280px; height: 280px; filter: drop-shadow(0 0 15px rgba(253, 224, 71, 0.25));"></canvas>
            <!-- Pointer peg at the top -->
            <div id="lucky-spin-pointer" style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%) rotate(0deg); transform-origin: top center; width: 18px; height: 32px; background: linear-gradient(180deg, #fff350 0%, #d4af37 100%); clip-path: polygon(50% 100%, 0 0, 100% 0); z-index: 10; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transition: transform 0.05s ease;"></div>
            <!-- Center golden spin button -->
            <button type="button" id="btn-spin-wheel-center" style="position: absolute; width: 68px; height: 68px; border-radius: 50%; background: radial-gradient(circle, #fff8d2 0%, #ffd700 40%, #7a5c10 100%); border: 3px solid #1e293b; color: #121008; font-family: var(--font-display, inherit); font-weight: 900; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 15px rgba(253, 224, 71, 0.4), inset 0 2px 4px rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; user-select: none; z-index: 12; transition: transform 0.1s ease;">SPIN</button>
          </div>
          <!-- Info Details Box -->
          <div class="spin-wheel-info" style="flex: 1; min-width: 250px; display: flex; flex-direction: column; justify-content: center; gap: 12px; text-align: left;">
            <h3 style="margin: 0; font-size: 1.35rem; color: #fff; font-family: var(--font-display, inherit);">Spin Mehrbod's Lucky Wheel!</h3>
            <p style="margin: 0; font-size: 0.88rem; color: #94a3b8; line-height: 1.5;">Spin the Daily Fortune Wheel every 24 hours for a <strong style="color: #10b981;">FREE</strong> chance at grand prizes! Extra spins can be unlocked for <strong style="color: #ec4899;">100 Bux</strong> each. Everything you win is added directly to your loadout collection or vault balance.</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button type="button" class="primary-btn" id="btn-spin-wheel-play" style="flex: 1; min-width: 150px; padding: 12px 20px; font-size: 1rem; border-radius: 12px; justify-content: center; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3); font-weight: 800; cursor: pointer;">
                SPIN FOR FREE! 🎁
              </button>
            </div>
            <div id="spin-wheel-timer-text" style="font-size: 0.78rem; color: #f43f5e; font-weight: 700; display: none;">⏱️ Free spin on cooldown. Next free spin in <span id="spin-wheel-timer-val">23:59:59</span></div>
          </div>
        </div>
      </section>

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

  // --- Initialize Lucky Spin Wheel ---
  function initLuckySpinWheel() {
    const canvas = document.getElementById('lucky-spin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pointer = document.getElementById('lucky-spin-pointer');
    const playBtn = document.getElementById('btn-spin-wheel-play');
    const centerBtn = document.getElementById('btn-spin-wheel-center');
    const badge = document.getElementById('spin-wheel-cost-badge');
    const timerText = document.getElementById('spin-wheel-timer-text');
    const timerVal = document.getElementById('spin-wheel-timer-val');

    const slices = [
      { label: '50 Bux', color: '#ec4899', type: 'bux', amount: 50, icon: '💰' },
      { label: 'Random Spell', color: '#8b5cf6', type: 'spell', amount: 1, icon: '🔮' },
      { label: '100 Bux', color: '#06b6d4', type: 'bux', amount: 100, icon: '💰' },
      { label: 'Scam Dust', color: '#475569', type: 'scam', amount: 0, icon: '🗑️' },
      { label: '250 Bux', color: '#10b981', type: 'bux', amount: 250, icon: '💰' },
      { label: 'Small Pack', color: '#f43f5e', type: 'pack', amount: 1, icon: '📦' },
      { label: '500 GRAND PRIZE!', color: '#eab308', type: 'bux', amount: 500, icon: '👑' },
      { label: 'Random Chip', color: '#a855f7', type: 'chip', amount: 1, icon: '💾' }
    ];

    const totalSlices = slices.length;
    const arcSize = (Math.PI * 2) / totalSlices;

    let currentAngle = 0;
    let spinVelocity = 0;
    let isSpinning = false;
    let lastTickAngle = 0;

    const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

    function getSpinCost() {
      try {
        const lastSpin = localStorage.getItem('mehrbod_last_spin_time');
        if (!lastSpin) return 0;
        const elapsed = Date.now() - parseInt(lastSpin, 10);
        if (elapsed >= SPIN_COOLDOWN_MS) return 0;
        return 100;
      } catch (e) {
        return 0;
      }
    }

    function updateSpinUI() {
      const cost = getSpinCost();
      if (cost === 0) {
        if (playBtn) {
          playBtn.textContent = 'SPIN FOR FREE! 🎁';
          playBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          playBtn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
        }
        if (badge) {
          badge.textContent = 'FREE DAILY SPIN AVAILABLE';
          badge.style.background = 'rgba(16, 185, 129, 0.15)';
          badge.style.color = '#34d399';
        }
        if (timerText) timerText.style.display = 'none';
      } else {
        if (playBtn) {
          playBtn.textContent = 'SPIN AGAIN (100 Bux) ◉';
          playBtn.style.background = 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)';
          playBtn.style.boxShadow = '0 4px 15px rgba(236, 72, 153, 0.3)';
        }
        if (badge) {
          badge.textContent = 'SPIN: 100 BUX';
          badge.style.background = 'rgba(236, 72, 153, 0.15)';
          badge.style.color = '#f472b6';
        }
        if (timerText) {
          timerText.style.display = 'block';
          updateTimerCountdown();
        }
      }
    }

    function updateTimerCountdown() {
      try {
        const lastSpin = localStorage.getItem('mehrbod_last_spin_time');
        if (!lastSpin) return;
        const elapsed = Date.now() - parseInt(lastSpin, 10);
        const remaining = Math.max(0, SPIN_COOLDOWN_MS - elapsed);
        if (remaining <= 0) {
          updateSpinUI();
          return;
        }
        const h = String(Math.floor(remaining / 3600000)).padStart(2, '0');
        const m = String(Math.floor(remaining / 60000) % 60).padStart(2, '0');
        const s = String(Math.floor(remaining / 1000) % 60).padStart(2, '0');
        if (timerVal) timerVal.textContent = `${h}:${m}:${s}`;
      } catch (e) {}
    }

    function drawWheel() {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = cx - 12;

      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
      const outerGrad = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 10);
      outerGrad.addColorStop(0, '#ffd700');
      outerGrad.addColorStop(1, '#7a5c10');
      ctx.fillStyle = outerGrad;
      ctx.fill();
      ctx.restore();

      for (let i = 0; i < 24; i++) {
        const dotAngle = (i * Math.PI * 2) / 24;
        const dotX = cx + Math.cos(dotAngle) * (radius + 2);
        const dotY = cy + Math.sin(dotAngle) * (radius + 2);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        const blink = Math.sin(Date.now() * 0.005 + i) > 0;
        ctx.fillStyle = blink ? '#ffffff' : '#b8860b';
        ctx.fill();
      }

      slices.forEach((slice, idx) => {
        const angleStart = currentAngle + idx * arcSize;
        const angleEnd = angleStart + arcSize;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, angleStart, angleEnd);
        ctx.closePath();

        const sliceGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, radius);
        sliceGrad.addColorStop(0, '#1e293b');
        sliceGrad.addColorStop(1, slice.color);
        ctx.fillStyle = sliceGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(cx, cy);
        const textAngle = angleStart + arcSize / 2;
        ctx.rotate(textAngle);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 11px var(--font-display, inherit)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(`${slice.icon} ${slice.label}`, radius - 20, 0);

        ctx.restore();
      });

      for (let i = 0; i < totalSlices; i++) {
        const pegAngle = currentAngle + i * arcSize;
        const pegX = cx + Math.cos(pegAngle) * (radius - 5);
        const pegY = cy + Math.sin(pegAngle) * (radius - 5);
        ctx.beginPath();
        ctx.arc(pegX, pegY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    function animateSpin() {
      if (!isSpinning) return;

      currentAngle += spinVelocity;
      spinVelocity *= 0.983;

      const normalizedAngle = (currentAngle - Math.PI / 2) % (Math.PI * 2);
      const tickIndex = Math.floor(normalizedAngle / arcSize);
      if (tickIndex !== lastTickAngle) {
        lastTickAngle = tickIndex;
        if (typeof Sound !== 'undefined' && typeof Sound.tone === 'function') {
          const pitch = 300 + (spinVelocity * 150);
          Sound.tone(pitch, 0.02, 'sine', 0.08);
        }
        if (pointer) {
          pointer.style.transform = 'translateX(-50%) rotate(-15deg)';
          setTimeout(() => {
            if (pointer) pointer.style.transform = 'translateX(-50%) rotate(0deg)';
          }, 40);
        }
      }

      drawWheel();

      if (spinVelocity < 0.002) {
        spinVelocity = 0;
        isSpinning = false;
        drawWheel();
        resolvePrize();
      } else {
        requestAnimationFrame(animateSpin);
      }
    }

    function resolvePrize() {
      let normalized = (Math.PI * 2.5 - (currentAngle % (Math.PI * 2))) % (Math.PI * 2);
      const sliceIdx = Math.floor(normalized / arcSize) % totalSlices;
      const wonPrize = slices[sliceIdx];

      let prizeTitle = '';
      let prizeDesc = '';
      let prizeIcon = wonPrize.icon;

      if (wonPrize.type === 'bux') {
        addBux(wonPrize.amount);
        if (typeof recordEconomyChange === 'function') {
          recordEconomyChange(wonPrize.amount, `Daily Spin prize: ${wonPrize.label}`);
        }
        prizeTitle = `+${wonPrize.amount} Mehrbod Bux`;
        prizeDesc = 'Credited directly to your vault balance. Spend them in the shop!';
      } else if (wonPrize.type === 'spell') {
        const col = loadCollection();
        const randomSpellId = ALL_SPELL_IDS[Math.floor(Math.random() * ALL_SPELL_IDS.length)];
        if (!col.spells.includes(randomSpellId)) {
          col.spells.push(randomSpellId);
          saveCollection(col);
        }
        const spellDef = SPELL_DEFS.find(s => s.id === randomSpellId);
        prizeTitle = `${spellDef ? spellDef.name : 'Random Spell'} Spell`;
        prizeDesc = 'Unlocked & added directly to your loadout collection!';
      } else if (wonPrize.type === 'chip') {
        const col = loadCollection();
        const randomChipId = ALL_CHIP_IDS[Math.floor(Math.random() * ALL_CHIP_IDS.length)];
        if (!col.chips.includes(randomChipId)) {
          col.chips.push(randomChipId);
          saveCollection(col);
        }
        const chipDef = CHIP_DEFS.find(c => c.id === randomChipId);
        prizeTitle = `${chipDef ? chipDef.name : 'Random Chip'} Chip`;
        prizeDesc = 'Unlocked & added directly to your loadout collection!';
      } else if (wonPrize.type === 'pack') {
        const size = SHOP_PACK_SIZES.find(p => p.id === 'pack_small') || { count: 2, cost: 20, name: 'Small Pack' };
        buyCardPackSized(size.count, 0, size.name);
        prizeTitle = 'Small Card Pack';
        prizeDesc = 'Check out your newly opened cards inside the Collection Book!';
      } else {
        prizeTitle = 'Barbod\'s worthless dust';
        prizeDesc = 'A handful of fine gray dust. Actually worth absolutely zero Bux. Oof!';
        if (typeof triggerBarbodDustEffect === 'function') {
          setTimeout(() => triggerBarbodDustEffect(), 2000);
        }
      }

      if (typeof Sound !== 'undefined') {
        if (wonPrize.type === 'scam') {
          if (Sound.buzzer) Sound.buzzer();
        } else {
          if (Sound.sparkle) Sound.sparkle();
          if (Sound.coin) Sound.coin();
        }
      }

      showCodeRewardModal('Lucky Spin Winner', prizeIcon, [
        { icon: prizeIcon, title: prizeTitle, desc: prizeDesc }
      ]);

      const cost = getSpinCost();
      if (cost === 0) {
        localStorage.setItem('mehrbod_last_spin_time', String(Date.now()));
      }

      updateSpinUI();
      updateThemeButtons();
      if (typeof renderCollectionScreen === 'function') renderCollectionScreen();
    }

    function startSpin() {
      if (isSpinning) return;

      const cost = getSpinCost();
      if (cost > 0) {
        if (!spendBux(cost)) {
          showToast("You don't have enough Mehrbod Bux to spin!");
          return;
        }
        if (typeof recordEconomyChange === 'function') {
          recordEconomyChange(-cost, 'Paid 100 Bux for Lucky Spin Wheel');
        }
      }

      isSpinning = true;
      spinVelocity = 0.35 + Math.random() * 0.25;
      lastTickAngle = -1;

      if (typeof Sound !== 'undefined' && Sound.select) Sound.select();

      requestAnimationFrame(animateSpin);
    }

    if (playBtn) playBtn.addEventListener('click', startSpin);
    if (centerBtn) centerBtn.addEventListener('click', startSpin);

    const timerInterval = setInterval(() => {
      if (!document.getElementById('lucky-spin-canvas')) {
        clearInterval(timerInterval);
        return;
      }
      updateTimerCountdown();
    }, 1000);

    drawWheel();
    updateSpinUI();
  }

  // Run initialization
  setTimeout(initLuckySpinWheel, 50);
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
  btn.style.background = getProfileAvatarGradientCss(name, null, true);
  
  // Add/Update frame
  let frame = btn.querySelector('.profile-frame');
  if (!frame) {
    frame = document.createElement('div');
    frame.className = 'profile-frame';
    btn.appendChild(frame);
  }
  frame.className = 'profile-frame';
  const eqBorder = getEquippedProfileBorder();
  if (eqBorder && eqBorder !== 'auto') {
    frame.classList.add(eqBorder);
  } else {
    const s = loadTrialTowerState();
    const highest = Math.max(s.best || 0, s.floor || 1);
    if (highest >= 50 || isTowerMilestoneUnlocked(50)) frame.classList.add('frame-trial-lord-apex');
    else if (highest >= 40 || isTowerMilestoneUnlocked(40)) frame.classList.add('frame-trial-lord-sovereign');
    else if (highest >= 30 || isTowerMilestoneUnlocked(30)) frame.classList.add('frame-trial-lord-conqueror');
    else if (highest >= 20 || isTowerMilestoneUnlocked(20)) frame.classList.add('frame-trial-lord-sentinel');
    else if (highest >= 10 || isTowerMilestoneUnlocked(10)) frame.classList.add('frame-trial-lord-novice');
    else {
      const rank = arenaRankIndexFromRP(loadArenaRankState().rp);
      if (rank >= 6) frame.classList.add('frame-gold');
      else if (rank >= 4) frame.classList.add('frame-silver');
      else if (rank >= 2) frame.classList.add('frame-bronze');
    }
  }
  
  if (badge) badge.classList.toggle('hidden', !canPrestigeNow());

  const hudCanvas = document.getElementById('hud-profile-particle-canvas');
  if (hudCanvas && typeof ParticleAvatarEngine !== 'undefined') {
    ParticleAvatarEngine.attachCanvas(hudCanvas, ParticleAvatarEngine.getActiveAvatarId(), { size: 40 });
  }
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

// ============================================================================
// TRIAL LORD TOWER MILESTONE REWARDS DATA REGISTRY
// ============================================================================
const TOWER_MILESTONE_REWARDS = [
  {
    floor: 10,
    title: 'Trial Lord Initiate',
    icon: '🥉',
    borderId: 'border_trial_lord_novice',
    borderName: 'Trial Lord Novice Border',
    frameClass: 'frame-trial-lord-novice',
    sleeveId: 'sleeve_trial_lord_novice',
    avatarId: 'trial-lord-initiate',
    avatarName: 'Trial Lord Initiate',
    desc: 'Exclusive Bronze Runic Spire Cosmetic Border & Initiate Player Icon!'
  },
  {
    floor: 20,
    title: 'Trial Lord Sentinel',
    icon: '🥈',
    borderId: 'border_trial_lord_sentinel',
    borderName: 'Trial Lord Sentinel Border',
    frameClass: 'frame-trial-lord-sentinel',
    sleeveId: 'sleeve_trial_lord_sentinel',
    avatarId: 'trial-lord-sentinel',
    avatarName: 'Trial Lord Sentinel',
    desc: 'Exclusive Cybernetic Electro-Cyan Cosmetic Border & Sentinel Player Icon!'
  },
  {
    floor: 30,
    title: 'Trial Lord Conqueror',
    icon: '🥇',
    borderId: 'border_trial_lord_conqueror',
    borderName: 'Trial Lord Conqueror Border',
    frameClass: 'frame-trial-lord-conqueror',
    sleeveId: 'sleeve_trial_lord_conqueror',
    avatarId: 'trial-lord-conqueror',
    avatarName: 'Trial Lord Conqueror',
    desc: 'Exclusive Solar Flare Gilded Cosmetic Border & Conqueror Player Icon!'
  },
  {
    floor: 40,
    title: 'Trial Lord Sovereign',
    icon: '💎',
    borderId: 'border_trial_lord_sovereign',
    borderName: 'Trial Lord Sovereign Border',
    frameClass: 'frame-trial-lord-sovereign',
    sleeveId: 'sleeve_trial_lord_sovereign',
    avatarId: 'trial-lord-sovereign',
    avatarName: 'Trial Lord Sovereign',
    desc: 'Exclusive Deep Void Singularity Cosmetic Border & Sovereign Player Icon!'
  },
  {
    floor: 50,
    title: 'Trial Lord Supreme Apex',
    icon: '👑',
    themeId: 'astral',
    themeName: 'Trial Lord (S1)',
    borderId: 'border_trial_lord_apex',
    borderName: 'Trial Lord Apex Sovereign Border',
    frameClass: 'frame-trial-lord-apex',
    sleeveId: 'sleeve_trial_lord_apex',
    avatarId: 'trial-lord-apex',
    avatarName: 'Trial Lord Supreme Monarch',
    desc: 'The Ultimate Trial Lord Apex Sovereign Crown Border, Particle Avatar, and Season 1 Trial Lord Theme!'
  }
];

function isTowerMilestoneUnlocked(floor) {
  const key = `tower_milestone_${floor}_unlocked`;
  if (localStorage.getItem(key) === 'true') return true;
  const s = typeof loadTrialTowerState === 'function' ? loadTrialTowerState() : { best: 0, floor: 1 };
  return (s.best || 0) >= floor || (s.floor || 1) >= floor;
}

function checkAndGrantTowerMilestones(floorVal) {
  const newlyUnlocked = [];
  TOWER_MILESTONE_REWARDS.forEach(m => {
    if (floorVal >= m.floor) {
      const key = `tower_milestone_${m.floor}_unlocked`;
      if (localStorage.getItem(key) !== 'true') {
        localStorage.setItem(key, 'true');
        localStorage.setItem(`border_${m.borderId}_unlocked`, 'true');
        localStorage.setItem(`avatar_${m.avatarId}_unlocked`, 'true');
        if (m.themeId) {
          localStorage.setItem(`theme_${m.themeId}_unlocked`, 'true');
        }
        newlyUnlocked.push(m);
      }
    }
  });
  return newlyUnlocked;
}

function getEquippedProfileBorder() {
  try {
    return localStorage.getItem('mehrbod_equipped_profile_border') || 'auto';
  } catch (e) {
    return 'auto';
  }
}

function setEquippedProfileBorder(borderClass) {
  try {
    localStorage.setItem('mehrbod_equipped_profile_border', borderClass);
  } catch (e) {}
  if (typeof updateProfileAvatar === 'function') updateProfileAvatar();
}

// ============================================================================
// ANIMATED PARTICLE AVATARS ENGINE
// High-performance canvas particle systems for player profiles and match HUD
// ============================================================================
const PARTICLE_AVATARS = [
  {
    id: 'cosmic-singularity',
    name: 'Cosmic Singularity',
    element: 'Void / Gravity',
    icon: '🌌',
    desc: 'Event horizon accretion vortex with spiraling violet stardust and gravitational lensing.',
    coreColor: '#3b0764',
    glowColor: '#a855f7',
    palette: ['#8b5cf6', '#6366f1', '#c084fc', '#ffffff', '#3b0764'],
    type: 'spiral'
  },
  {
    id: 'solar-phoenix',
    name: 'Solar Phoenix',
    element: 'Fire / Plasma',
    icon: '🔥',
    desc: 'Blazing incandescent solar core erupting turbulent fire embers and coronal plasma wind.',
    coreColor: '#7c2d12',
    glowColor: '#f97316',
    palette: ['#f97316', '#ef4444', '#fbbf24', '#fef08a', '#ffffff'],
    type: 'burst'
  },
  {
    id: 'cyber-overdrive',
    name: 'Cyber Overdrive',
    element: 'Tech / Neon',
    icon: '⚡',
    desc: 'Supercharged neural core with orbiting neon cyan data bits and digital scan pulses.',
    coreColor: '#022c22',
    glowColor: '#06b6d4',
    palette: ['#06b6d4', '#10b981', '#38bdf8', '#6ee7b7', '#ffffff'],
    type: 'orbit'
  },
  {
    id: 'glacial-frost',
    name: 'Glacial Frost',
    element: 'Ice / Cryo',
    icon: '❄️',
    desc: 'Sub-zero crystal nexus surrounded by drifting frost sparks and ethereal cryo mist.',
    coreColor: '#082f49',
    glowColor: '#00f5d4',
    palette: ['#00f5d4', '#38bdf8', '#e0f2fe', '#bae6fd', '#ffffff'],
    type: 'drift'
  },
  {
    id: 'celestial-divinity',
    name: 'Celestial Divinity',
    element: 'Light / Holy',
    icon: '✨',
    desc: 'Radiant sanctified star emitting concentric golden halos, starlight prisms, and divine motes.',
    coreColor: '#78350f',
    glowColor: '#ffd700',
    palette: ['#ffd700', '#fbbf24', '#fffbeb', '#fef08a', '#ffffff'],
    type: 'radiate'
  },
  {
    id: 'storm-tempest',
    name: 'Storm Tempest',
    element: 'Lightning / Storm',
    icon: '🌩️',
    desc: 'Kinetic thundercloud eye crackling with branching lightning arcs and plasma sparks.',
    coreColor: '#1e1b4b',
    glowColor: '#38bdf8',
    palette: ['#38bdf8', '#818cf8', '#60a5fa', '#ffffff', '#c7d2fe'],
    type: 'electric'
  },
  {
    id: 'toxic-biohazard',
    name: 'Toxic Biohazard',
    element: 'Acid / Bio',
    icon: '🧪',
    desc: 'Radioactive isotope reactor bubbling with neon lime bioluminescent spores and vapor.',
    coreColor: '#14532d',
    glowColor: '#22c55e',
    palette: ['#22c55e', '#84cc16', '#a3e635', '#ecfccb', '#ffffff'],
    type: 'bubble'
  },
  {
    id: 'mystic-arcana',
    name: 'Mystic Arcana',
    element: 'Arcane / Magic',
    icon: '🔮',
    desc: 'Esoteric runic prism veiled in swirling magenta spirit wisps and twilight ether.',
    coreColor: '#581c87',
    glowColor: '#ec4899',
    palette: ['#ec4899', '#d946ef', '#a855f7', '#fbcfe8', '#ffffff'],
    type: 'lissajous'
  },
  {
    id: 'dragon-heart',
    name: 'Dragon Heart',
    element: 'Inferno / Draconic',
    icon: '🐉',
    desc: 'Beating primordial dragon gemstone heart erupting ruby magma droplets and ash.',
    coreColor: '#450a0a',
    glowColor: '#dc2626',
    palette: ['#dc2626', '#b91c1c', '#f87171', '#fca5a5', '#ffffff'],
    type: 'pulse'
  },
  {
    id: 'aether-blossom',
    name: 'Aether Blossom',
    element: 'Spirit / Flora',
    icon: '🌸',
    desc: 'Spectral sakura spirit lotus surrounded by tumbling petal motes and gentle fireflies.',
    coreColor: '#064e3b',
    glowColor: '#f472b6',
    palette: ['#f472b6', '#fb7185', '#fda4af', '#34d399', '#ffffff'],
    type: 'flutter'
  },
  /* --- Trial Lord Milestone Avatars --- */
  {
    id: 'trial-lord-initiate',
    name: 'Trial Lord Initiate',
    element: 'Spire / Bronze',
    icon: '🗼',
    desc: 'Bronze runic spire particle aura with warm ember sparks unlocked at Trial Tower Floor 10.',
    coreColor: '#451a03',
    glowColor: '#d97706',
    palette: ['#d97706', '#f59e0b', '#fbbf24', '#fef08a', '#ffffff'],
    type: 'orbit',
    requiredFloor: 10
  },
  {
    id: 'trial-lord-sentinel',
    name: 'Trial Lord Sentinel',
    element: 'Spire / Arc',
    icon: '⚡',
    desc: 'Electro-cyan cyber spire particle aura with crackling plasma arcs unlocked at Trial Tower Floor 20.',
    coreColor: '#0c4a6e',
    glowColor: '#38bdf8',
    palette: ['#38bdf8', '#0284c7', '#7dd3fc', '#bae6fd', '#ffffff'],
    type: 'electric',
    requiredFloor: 20
  },
  {
    id: 'trial-lord-conqueror',
    name: 'Trial Lord Conqueror',
    element: 'Spire / Solar',
    icon: '🔥',
    desc: 'Gilded solar prominence particle aura with golden coronal flares unlocked at Trial Tower Floor 30.',
    coreColor: '#78350f',
    glowColor: '#fbbf24',
    palette: ['#fbbf24', '#f59e0b', '#fef08a', '#ffffff', '#eab308'],
    type: 'burst',
    requiredFloor: 30
  },
  {
    id: 'trial-lord-sovereign',
    name: 'Trial Lord Sovereign',
    element: 'Spire / Void',
    icon: '🌌',
    desc: 'Deep cosmic void singularity particle aura with swirling violet stardust unlocked at Trial Tower Floor 40.',
    coreColor: '#3b0764',
    glowColor: '#c084fc',
    palette: ['#c084fc', '#a855f7', '#e879f9', '#f0abfc', '#ffffff'],
    type: 'spiral',
    requiredFloor: 40
  },
  {
    id: 'trial-lord-apex',
    name: 'Trial Lord Supreme Monarch',
    element: 'Spire / Monarch',
    icon: '👑',
    desc: 'Master Spire Monarch particle aura with orbiting golden crowns and celestial stardust unlocked at Trial Tower Floor 50.',
    coreColor: '#451a03',
    glowColor: '#eab308',
    palette: ['#eab308', '#facc15', '#fef08a', '#c084fc', '#ffffff'],
    type: 'radiate',
    requiredFloor: 50
  }
];

const ParticleAvatarEngine = (function() {
  const STORAGE_KEY = 'mehrbod-cards-particle-avatar';
  const attachedCanvases = new Map();
  let animFrameId = null;
  let lastTime = performance.now();

  function getActiveAvatarId() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && PARTICLE_AVATARS.some(a => a.id === saved)) return saved;
    } catch (_) {}
    return 'cosmic-singularity';
  }

  function setActiveAvatarId(id) {
    if (!PARTICLE_AVATARS.some(a => a.id === id)) return;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('particle-avatar-changed', { detail: { id } }));
    updateAll();
    if (typeof updateProfileAvatar === 'function') updateProfileAvatar();
  }

  function getCustomFireColor() {
    try {
      return localStorage.getItem('mehrbod_custom_fire_color_v1') || '#f97316';
    } catch (e) {
      return '#f97316';
    }
  }
  function saveCustomFireColor(hex) {
    try {
      localStorage.setItem('mehrbod_custom_fire_color_v1', hex);
    } catch (e) {}
  }

  function showFireColorPickerModal(onConfirm) {
    const existing = document.getElementById('fire-color-modal');
    if (existing) existing.remove();

    const currentColor = getCustomFireColor();

    const modal = document.createElement('div');
    modal.id = 'fire-color-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(4, 6, 12, 0.85); backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      animation: fadeInModal 0.2s ease forwards;
    `;

    modal.innerHTML = `
      <div style="background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(249, 115, 22, 0.4); border-radius: 20px; padding: 28px; max-width: 380px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.6); text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🔥</div>
        <h3 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 4px;">Customize Fire Particle Color</h3>
        <p style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 20px;">Pick your custom flame shade using the RGB color picker below.</p>
        
        <div style="margin-bottom: 24px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <label style="font-size: 0.85rem; font-weight: 700; color: #f97316; display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <span>Flame Color:</span>
            <input type="color" id="fire-color-input" value="${currentColor}" style="width: 50px; height: 40px; border: none; border-radius: 8px; background: transparent; cursor: pointer;" />
          </label>
          <div id="fire-hex-preview" style="font-family: monospace; font-size: 0.85rem; color: #cbd5e1; background: rgba(255,255,255,0.06); padding: 4px 12px; border-radius: 6px;">${currentColor}</div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button type="button" class="secondary-btn" id="fire-color-cancel" style="flex:1; justify-content:center; padding: 10px;">Cancel</button>
          <button type="button" class="primary-btn" id="fire-color-confirm" style="flex:1; justify-content:center; padding: 10px; background: linear-gradient(135deg, #f97316, #ef4444); border:none;">Confirm 🔥</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const colorInput = modal.querySelector('#fire-color-input');
    const hexPreview = modal.querySelector('#fire-hex-preview');
    colorInput.oninput = (e) => {
      hexPreview.textContent = e.target.value;
    };

    modal.querySelector('#fire-color-cancel').onclick = () => {
      modal.remove();
    };

    modal.querySelector('#fire-color-confirm').onclick = () => {
      const selectedHex = colorInput.value;
      saveCustomFireColor(selectedHex);
      modal.remove();
      if (typeof onConfirm === 'function') onConfirm(selectedHex);
    };
  }

  function getAvatar(id) {
    const av = PARTICLE_AVATARS.find(a => a.id === id) || PARTICLE_AVATARS[0];
    if (av.id === 'solar-phoenix') {
      const customHex = getCustomFireColor();
      return {
        ...av,
        glowColor: customHex,
        palette: [customHex, '#ef4444', '#fbbf24', '#fef08a', '#ffffff']
      };
    }
    return av;
  }

  function createParticles(def, count = 24) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        dist: 5 + Math.random() * 26,
        angle: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.04,
        radius: 1.2 + Math.random() * 2.6,
        alpha: 0.3 + Math.random() * 0.7,
        color: def.palette[Math.floor(Math.random() * def.palette.length)],
        life: Math.random() * 100,
        maxLife: 60 + Math.random() * 80,
        seed: Math.random() * 1000
      });
    }
    return particles;
  }

  function attachCanvas(canvas, avatarId, options = {}) {
    if (!canvas) return;
    const def = getAvatar(avatarId || getActiveAvatarId());
    const count = options.particleCount || (options.size && options.size > 60 ? 32 : 20);
    const state = {
      canvas,
      ctx: canvas.getContext('2d'),
      avatarId: def.id,
      def,
      particles: createParticles(def, count),
      options,
      t: Math.random() * 100
    };
    attachedCanvases.set(canvas, state);
    startLoop();
  }

  function detachCanvas(canvas) {
    if (!canvas) return;
    attachedCanvases.delete(canvas);
  }

  function updateAll() {
    const activeId = getActiveAvatarId();
    for (const [canvas, state] of attachedCanvases.entries()) {
      if (!canvas.isConnected) {
        attachedCanvases.delete(canvas);
        continue;
      }
      if (state.options && state.options.useActive) {
        state.def = getAvatar(activeId);
        state.avatarId = activeId;
        state.particles = createParticles(state.def, state.particles.length);
      }
    }
  }

  function startLoop() {
    if (animFrameId) return;
    lastTime = performance.now();
    animFrameId = requestAnimationFrame(renderLoop);
  }

  function renderLoop(now) {
    animFrameId = null;
    if (attachedCanvases.size === 0) return;
    if (document.hidden || (typeof omegaPerformanceMode !== 'undefined' && omegaPerformanceMode)) {
      // Clear canvases and suspend loop in omega potato mode
      for (const [canvas, state] of attachedCanvases.entries()) {
        try {
          state.ctx.clearRect(0, 0, canvas.width, canvas.height);
        } catch (_) {}
      }
      return;
    }
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    let visibleCount = 0;
    for (const [canvas, state] of attachedCanvases.entries()) {
      if (!canvas.isConnected) {
        attachedCanvases.delete(canvas);
        continue;
      }
      if (canvas.offsetWidth === 0 && canvas.offsetHeight === 0) continue;
      visibleCount++;
      renderState(state, dt);
    }

    if (visibleCount > 0) {
      animFrameId = requestAnimationFrame(renderLoop);
    } else {
      animFrameId = null; // Suspend loop when no canvases are currently visible/rendered
    }
  }

  function renderState(state, dt) {
    const { canvas, ctx, def, particles } = state;
    const w = canvas.width;
    const h = canvas.height;
    state.t += dt;
    const t = state.t;

    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / 70;

    ctx.save();
    ctx.translate(cx, cy);

    // Draw central glow aura
    const pulse = 1 + 0.12 * Math.sin(t * 3);
    const auraRad = Math.max(8, 20 * scale * pulse);
    const grad = ctx.createRadialGradient(0, 0, 2 * scale, 0, 0, auraRad);
    grad.addColorStop(0, def.glowColor + 'cc');
    grad.addColorStop(0.4, def.glowColor + '44');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRad, 0, Math.PI * 2);
    ctx.fill();

    // Specific background geometry
    if (def.type === 'spiral') {
      ctx.strokeStyle = def.palette[0] + '33';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24 * scale, 16 * scale, t * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (def.type === 'orbit') {
      ctx.strokeStyle = def.palette[1] + '44';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26 * scale, 12 * scale, 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 26 * scale, 12 * scale, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (def.type === 'radiate') {
      const r1 = ((t * 20) % 28) * scale;
      ctx.strokeStyle = def.glowColor + '44';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, r1, 0, Math.PI * 2);
      ctx.stroke();
    } else if (def.type === 'electric') {
      if (Math.random() < 0.35) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6 * scale;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8 * scale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const targetAng = Math.random() * Math.PI * 2;
        const targetDist = (18 + Math.random() * 12) * scale;
        const steps = 4;
        for (let s = 1; s <= steps; s++) {
          const frac = s / steps;
          const nx = Math.cos(targetAng) * targetDist * frac + (Math.random() - 0.5) * 10 * scale;
          const ny = Math.sin(targetAng) * targetDist * frac + (Math.random() - 0.5) * 10 * scale;
          ctx.lineTo(nx, ny);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Update & draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life += dt * 40;
      if (p.life > p.maxLife) {
        p.life = 0;
        p.dist = (8 + Math.random() * 24) * scale;
        p.angle = Math.random() * Math.PI * 2;
        p.x = Math.cos(p.angle) * p.dist;
        p.y = Math.sin(p.angle) * p.dist;
        p.color = def.palette[Math.floor(Math.random() * def.palette.length)];
      }

      const lifeRatio = p.life / p.maxLife;
      const alpha = Math.sin(lifeRatio * Math.PI) * p.alpha;

      if (def.type === 'spiral') {
        p.angle += (1.8 + 20 / (p.dist / scale + 5)) * dt;
        p.dist -= 7 * scale * dt;
        if (p.dist < 2 * scale) p.dist = 28 * scale;
        p.x = Math.cos(p.angle) * p.dist;
        p.y = Math.sin(p.angle) * p.dist * 0.75;
      } else if (def.type === 'burst') {
        p.x += p.vx * scale * 1.5;
        p.y += p.vy * scale * 1.5 - 0.3 * scale;
        p.dist = Math.hypot(p.x, p.y);
      } else if (def.type === 'orbit') {
        p.angle += p.speed * 2;
        const rMajor = (20 + (i % 3) * 4) * scale;
        const rMinor = (10 + (i % 2) * 3) * scale;
        const tilt = (i % 2 === 0 ? 0.4 : -0.4);
        const ox = Math.cos(p.angle) * rMajor;
        const oy = Math.sin(p.angle) * rMinor;
        p.x = ox * Math.cos(tilt) - oy * Math.sin(tilt);
        p.y = ox * Math.sin(tilt) + oy * Math.cos(tilt);
      } else if (def.type === 'drift') {
        p.y += (0.4 + (i % 3) * 0.3) * scale;
        p.x += Math.sin(t * 2 + p.seed) * 0.5 * scale;
        if (p.y > 28 * scale) p.y = -28 * scale;
        if (p.x > 28 * scale) p.x = -28 * scale;
        if (p.x < -28 * scale) p.x = 28 * scale;
      } else if (def.type === 'radiate') {
        p.angle += 0.01;
        p.dist += (8 + (i % 3) * 6) * scale * dt;
        if (p.dist > 30 * scale) p.dist = 4 * scale;
        p.x = Math.cos(p.angle) * p.dist;
        p.y = Math.sin(p.angle) * p.dist;
      } else if (def.type === 'electric') {
        p.angle += (i % 2 === 0 ? 1 : -1) * 0.04;
        p.x = Math.cos(p.angle) * p.dist + (Math.random() - 0.5) * 3 * scale;
        p.y = Math.sin(p.angle) * p.dist + (Math.random() - 0.5) * 3 * scale;
      } else if (def.type === 'bubble') {
        p.y -= (0.8 + (i % 4) * 0.4) * scale;
        p.x += Math.sin(p.y * 0.1 + p.seed) * 0.4 * scale;
        if (p.y < -28 * scale) {
          p.y = (18 + Math.random() * 8) * scale;
          p.x = (Math.random() - 0.5) * 26 * scale;
        }
      } else if (def.type === 'lissajous') {
        const la = 2, lb = 3;
        const lt = t * 1.5 + p.seed;
        p.x = Math.sin(la * lt) * 24 * scale;
        p.y = Math.cos(lb * lt) * 20 * scale;
      } else if (def.type === 'pulse') {
        const beat = Math.pow(Math.sin(t * 3.5), 6);
        p.dist = (8 + (i % 4) * 5 + beat * 12) * scale;
        p.x = Math.cos(p.angle) * p.dist;
        p.y = Math.sin(p.angle) * p.dist;
      } else if (def.type === 'flutter') {
        p.x += Math.cos(t * 1.2 + p.seed) * 0.6 * scale;
        p.y += (0.5 + Math.sin(t * 0.8 + p.seed) * 0.3) * scale;
        if (p.y > 28 * scale) p.y = -28 * scale;
        if (p.x > 28 * scale) p.x = -28 * scale;
        if (p.x < -28 * scale) p.x = 28 * scale;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, p.radius * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // Core icon / center node
    ctx.globalAlpha = 0.95;
    ctx.font = `${Math.round(14 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = def.glowColor;
    ctx.fillText(def.icon, 0, 0);

    ctx.restore();
  }

  function populateTab(overlay) {
    const container = overlay.querySelector('#particle-tab-content-container');
    if (!container) return;

    const activeId = getActiveAvatarId();
    const activeDef = getAvatar(activeId);

    container.innerHTML = `
      <div class="avatars-tab-header">
        <div class="avatars-tab-title">✨ Animated Particle Avatars</div>
        <div class="avatars-tab-sub">Select your signature animated particle avatar. It renders in full motion alongside your name in the Match HUD and on your profile.</div>
      </div>

      <div class="particle-avatar-featured-showcase">
        <div class="pafs-canvas-box">
          <canvas id="pafs-featured-canvas" width="180" height="180"></canvas>
        </div>
        <div class="pafs-details">
          <div class="pafs-tag">${activeDef.element}</div>
          <div class="pafs-name" id="pafs-featured-name">${activeDef.name}</div>
          <div class="pafs-desc" id="pafs-featured-desc">${activeDef.desc}</div>
          <div class="pafs-status-chip">✓ Currently Active in Match HUD</div>
        </div>
      </div>

      <div class="profile-section-heading" style="margin-top:20px;">Avatar Roster (${PARTICLE_AVATARS.length})</div>
      <div class="particle-avatars-grid" id="particle-avatars-grid">
        ${PARTICLE_AVATARS.map(av => {
          const isEquipped = av.id === activeId;
          const isLocked = av.requiredFloor ? !isTowerMilestoneUnlocked(av.requiredFloor) : false;
          return `
            <div class="particle-avatar-card ${isEquipped ? 'equipped' : ''} ${isLocked ? 'locked' : ''}" data-avatar-id="${av.id}">
              <div class="pac-canvas-wrapper">
                <canvas class="pac-preview-canvas" data-avatar-id="${av.id}" width="128" height="128"></canvas>
              </div>
              <div class="pac-info">
                <div class="pac-header">
                  <span class="pac-name">${av.name}</span>
                  <span class="pac-element-tag">${av.element.split('/')[0].trim()}</span>
                </div>
                <div class="pac-desc">${av.desc}</div>
                <div style="display:flex; gap:6px; margin-top:6px;">
                  <button type="button" class="pac-equip-btn ${isEquipped ? 'active' : ''} ${isLocked ? 'locked-btn' : ''}" style="flex:1;" ${isLocked ? 'disabled' : ''}>
                    ${isEquipped ? '✓ Equipped' : (isLocked ? `🔒 Floor ${av.requiredFloor}` : 'Equip Avatar')}
                  </button>
                  ${av.id === 'solar-phoenix' ? `<button type="button" class="secondary-btn small" id="btn-customize-fire" style="padding:4px 8px; font-size:0.7rem;" title="Choose Custom Fire Color">🎨 Color</button>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach canvases
    const featuredCanvas = container.querySelector('#pafs-featured-canvas');
    if (featuredCanvas) {
      attachCanvas(featuredCanvas, activeId, { size: 90, particleCount: 36 });
    }

    container.querySelectorAll('.pac-preview-canvas').forEach(canv => {
      const aId = canv.dataset.avatarId;
      attachCanvas(canv, aId, { size: 64, particleCount: 22 });
    });

    // Bind card equip clicks
    container.querySelectorAll('.particle-avatar-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const aId = card.dataset.avatarId;
        if (!aId) return;

        const av = PARTICLE_AVATARS.find(a => a.id === aId);
        if (av && av.requiredFloor && !isTowerMilestoneUnlocked(av.requiredFloor)) {
          showToast(`🔒 Reach Floor ${av.requiredFloor} in Trial Tower to unlock!`, 2500);
          return;
        }

        const isColorBtn = e.target.closest('#btn-customize-fire');
        if (aId === 'solar-phoenix' && (isColorBtn || !e.target.closest('.pac-equip-btn'))) {
          showFireColorPickerModal((customHex) => {
            setActiveAvatarId(aId);
            if (typeof Sound !== 'undefined' && typeof Sound.playLevelUp === 'function') {
              try { Sound.playLevelUp(); } catch (_) {}
            }
            showToast(`🔥 Equipped "Solar Phoenix" with custom flame color!`, 2500);

            const heroCanvas = overlay.querySelector('#profile-hero-particle-canvas');
            if (heroCanvas) {
              attachCanvas(heroCanvas, aId, { size: 76, particleCount: 32 });
            }
            populateTab(overlay);
            updateAll();
          });
          return;
        }

        setActiveAvatarId(aId);
        if (typeof Sound !== 'undefined' && typeof Sound.playLevelUp === 'function') {
          try { Sound.playLevelUp(); } catch (_) {}
        } else if (typeof Sound !== 'undefined' && typeof Sound.claimQuest === 'function') {
          try { Sound.claimQuest(); } catch (_) {}
        }
        showToast(`✨ Equipped "${getAvatar(aId).name}" Particle Avatar!`, 2200);

        // Update hero canvas on profile modal
        const heroCanvas = overlay.querySelector('#profile-hero-particle-canvas');
        if (heroCanvas) {
          attachCanvas(heroCanvas, aId, { size: 76, particleCount: 32 });
        }

        // Re-populate tab
        populateTab(overlay);
      });
    });
  }

  return {
    getAllAvatars: () => PARTICLE_AVATARS,
    getActiveAvatarId,
    setActiveAvatarId,
    getAvatar,
    attachCanvas,
    detachCanvas,
    updateAll,
    populateTab,
    startLoop
  };
})();
window.ParticleAvatarEngine = ParticleAvatarEngine;

function openProfilePanel() {
  const old = document.getElementById('profile-overlay');
  if (old) old.remove();

  const name = loadPlayerName() || 'Player';
  const letter = name.trim().charAt(0).toUpperCase() || 'P';
  const avatarGradCss = getProfileAvatarGradientCss(name, null, true);

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
      <div class="profile-hero" style="background: ${avatarGradCss}; border-bottom: 2px solid rgba(255, 255, 255, 0.1);">
        <div class="profile-hero-row">
          <div class="profile-hero-avatar" id="profile-hero-avatar" title="Click to customize animated particle avatar" style="background:${avatarGradCss}">
            <canvas id="profile-hero-particle-canvas" class="profile-hero-particle-canvas" width="160" height="160"></canvas>
            <span id="profile-hero-avatar-letter">${letter}</span>
          </div>
          <div style="flex:1; min-width:0;">
            <div class="profile-hero-name" id="profile-name-container">
              <span id="profile-name-text">${escapePresetText(name)}</span>
              <button type="button" class="link-btn" id="btn-profile-rename" title="Change your player name">✎ rename</button>
              <button type="button" class="link-btn" id="btn-profile-avatars-shortcut" title="Choose Animated Particle Avatar">✨ avatar</button>
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
        <div class="profile-tabs" style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; flex-wrap: wrap;">
          <button type="button" class="profile-tab-btn active" data-tab="overview" style="flex:1; min-width:120px; padding: 8px 12px; border-radius: 8px; background: rgba(125,211,252,0.15); color: #7dd3fc; border: 1px solid rgba(125,211,252,0.3); font-weight: 700; font-size: 0.8rem; cursor: pointer;">Overview & Ledger</button>
          <button type="button" class="profile-tab-btn" data-tab="avatars" style="flex:1; min-width:130px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.05); color: var(--muted); border: 1px solid rgba(255,255,255,0.08); font-weight: 700; font-size: 0.8rem; cursor: pointer;">✨ Particle Avatars</button>
          <button type="button" class="profile-tab-btn" data-tab="performance" style="flex:1; min-width:130px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.05); color: var(--muted); border: 1px solid rgba(255,255,255,0.08); font-weight: 700; font-size: 0.8rem; cursor: pointer;">📈 Performance Trend</button>
        </div>

        <!-- Particle Avatars Tab Content -->
        <div id="profile-tab-content-avatars" class="profile-tab-content" style="display:none;">
          <div id="particle-tab-content-container"></div>
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

          <div class="profile-section-heading">📜 Match History Log (Last 10 Battles)</div>
          <div class="ledger-list">
            ${historyItems.length ? historyItems.slice(0, 10).map((x, idx) => `
              <div class="${x.result === 'Win' ? 'gain' : (x.result === 'Loss' ? 'loss' : '')}">
                <div>
                  <b>${x.result === 'Win' ? '🏆 Win' : x.result === 'Loss' ? '💀 Loss' : '🤝 Draw'}</b>
                  <div style="font-size: 0.72rem; color: var(--muted); margin-top: 2px;">
                    ${escapePresetText(x.mode)} · ${x.rounds} round${x.rounds === 1 ? '' : 's'} · ${formatDuration(x.duration)}
                  </div>
                  <small style="display: block; margin-top: 2px;">${new Date(x.at).toLocaleString()}</small>
                </div>
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
      const av = overlay.querySelector('#profile-tab-content-avatars');
      [ov, pf, av].forEach(el => {
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight; // trigger reflow
        el.style.animation = '';
      });
      if (tab === 'overview') {
        if (ov) ov.style.display = 'block';
        if (pf) pf.style.display = 'none';
        if (av) av.style.display = 'none';
      } else if (tab === 'avatars') {
        if (ov) ov.style.display = 'none';
        if (pf) pf.style.display = 'none';
        if (av) av.style.display = 'block';
        if (typeof ParticleAvatarEngine !== 'undefined') {
          ParticleAvatarEngine.populateTab(overlay);
        }
      } else {
        if (ov) ov.style.display = 'none';
        if (av) av.style.display = 'none';
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

  // Attach hero avatar particle canvas
  const heroCanvas = overlay.querySelector('#profile-hero-particle-canvas');
  if (heroCanvas && typeof ParticleAvatarEngine !== 'undefined') {
    ParticleAvatarEngine.attachCanvas(heroCanvas, ParticleAvatarEngine.getActiveAvatarId(), { size: 76, particleCount: 32 });
  }

  // Bind avatar shortcut buttons
  const btnAvatarShortcut = overlay.querySelector('#btn-profile-avatars-shortcut');
  if (btnAvatarShortcut) {
    btnAvatarShortcut.onclick = () => {
      const tabBtn = overlay.querySelector('.profile-tab-btn[data-tab="avatars"]');
      if (tabBtn) tabBtn.click();
    };
  }
  const heroAvatarEl = overlay.querySelector('#profile-hero-avatar');
  if (heroAvatarEl) {
    heroAvatarEl.onclick = () => {
      const tabBtn = overlay.querySelector('.profile-tab-btn[data-tab="avatars"]');
      if (tabBtn) tabBtn.click();
    };
  }

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
    const currentGrad = getActiveProfileGradient(currentName, true);
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
      
      const profileHero = overlay.querySelector('.profile-hero');
      if (profileHero) profileHero.style.background = gradCss;

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
    document.getElementById('top-left-hud')?.classList.toggle('hidden', id === 'screen-game' || id === 'screen-matchmaking');
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
  const unlockAllMasterBtn = document.getElementById('btn-secret-unlock-all');
  const grantBuxBtn = document.getElementById('btn-secret-grant-bux');
  const unlockAllCardsBtn = document.getElementById('btn-secret-unlock-all-cards');
  const launch3DHubBtn = document.getElementById('btn-secret-launch-3d-hub');
  const unlockAllCosmeticsBtn = document.getElementById('btn-secret-unlock-all-cosmetics') || document.getElementById('btn-secret-unlock-all-themes');
  const showCodesBtn = document.getElementById('btn-secret-show-codes');
  const codesManifest = document.getElementById('secret-codes-manifest');
  const execResult = document.getElementById('secret-exec-result');

  // Master Dev Unlock All Function
  window.devUnlockAll = function () {
    try {
      // 1. Gather all unit archetypes across all tiers (Green, Red, Orange), spells, and chips
      const allUnitIds = (typeof getAllNonBlueUnitIds === 'function') ? getAllNonBlueUnitIds() : [2, 3, 4].flatMap(tier => (typeof UNIT_ARCHETYPES !== 'undefined' && UNIT_ARCHETYPES[tier] ? UNIT_ARCHETYPES[tier].map(a => a.id) : []));
      const allSpellIds = (typeof getAllSpellIds === 'function') ? getAllSpellIds() : ((typeof SPELL_DEFS !== 'undefined') ? SPELL_DEFS.map(s => s.id) : []);
      const allChipIds = (typeof getAllChipIds === 'function') ? getAllChipIds() : ((typeof CHIP_DEFS !== 'undefined') ? CHIP_DEFS.map(c => c.id) : []);

      if (typeof grantCards === 'function') {
        grantCards(allUnitIds, allSpellIds, allChipIds);
      } else {
        const col = { units: allUnitIds, spells: allSpellIds, chips: allChipIds };
        localStorage.setItem('mehrbod-cards-collection', JSON.stringify(col));
      }

      // 2. Unlock Battle Pass: Premium Pass Active + Max Tier 100 (50,000 XP)
      localStorage.setItem('mehrbod-cards-bp-premium', 'true');
      localStorage.setItem('mehrbod-cards-bp-xp', (100 * 500).toString());
      localStorage.removeItem('mehrbod-cards-bp-claimed');
      if (typeof window.devUnlockBattlePass === 'function') {
        try { window.devUnlockBattlePass(false); } catch (_) {}
      }

      // 3. Unlock all cosmetics & difficulty themes in registries & local storage
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
      localStorage.setItem('theme_verdant_unlocked', 'true');
      localStorage.setItem('theme_pink_unlocked', 'true');
      localStorage.setItem('theme_flame_unlocked', 'true');
      localStorage.setItem('theme_aurora_unlocked', 'true');
      localStorage.setItem('theme_sovereign_unlocked', 'true');
      localStorage.setItem('theme_storm_unlocked', 'true');
      try {
        localStorage.setItem('mehrbod-cards-beaten-difficulties', JSON.stringify(['easy', 'medium', 'hard', 'expert', 'master', 'impossible']));
      } catch (_) {}

      const cosmeticIdsToUnlock = new Set(['prism', 'theme_prism', 'darkmatter', 'theme_darkmatter']);
      const bpCosmetics = [
        'theme_chronos', 'theme_neon_cyberpunk', 'theme_singularity', 'theme_quantum_horizon',
        'theme_solar_corona', 'theme_refractor', 'theme_nebula', 'theme_kraken', 'theme_apex_gold',
        'sleeve_chronos', 'sleeve_hyperdrive', 'sleeve_singularity', 'sleeve_quantum',
        'sleeve_solar', 'sleeve_nebula', 'sleeve_kraken', 'sleeve_apex_gold',
        'victoryanim_chronos_blast', 'victoryanim_hyperdrive_warp', 'victoryanim_singularity_collapse',
        'victoryanim_quantum_shatter', 'victoryanim_solar_flare', 'victoryanim_starlight_supernova',
        'victoryanim_kraken_tentacle', 'victoryanim_apex_orbital'
      ];
      bpCosmetics.forEach(id => {
        cosmeticIdsToUnlock.add(id);
        cosmeticIdsToUnlock.add('theme_' + id);
      });
      if (typeof COSMETIC_ITEMS !== 'undefined') COSMETIC_ITEMS.forEach(c => cosmeticIdsToUnlock.add(c.id));
      if (typeof THEME_DATA_REGISTRY !== 'undefined') {
        THEME_DATA_REGISTRY.forEach(t => {
          cosmeticIdsToUnlock.add(t.id);
          cosmeticIdsToUnlock.add('theme_' + t.id);
        });
      }
      if (typeof SLEEVE_DATA_REGISTRY !== 'undefined') SLEEVE_DATA_REGISTRY.forEach(s => cosmeticIdsToUnlock.add(s.id));
      if (typeof VICTORY_DATA_REGISTRY !== 'undefined') VICTORY_DATA_REGISTRY.forEach(v => cosmeticIdsToUnlock.add(v.id));

      const bpBadges = ['badge_chronos_gear', 'badge_cyber_reticle', 'badge_void_portal', 'badge_quantum_core', 'badge_solar_crest', 'badge_nebula_star', 'badge_kraken_eye', 'badge_apex_crown'];
      const bpTitles = ['Temporal Voyager', 'Cyber Pioneer', 'Void Walker', 'Quantum Operative', 'Solar Ascendant', 'Nebula Stargazer', 'Abyssal Monarch', 'Apex Sovereign'];
      try {
        localStorage.setItem('mehrbod-cards-unlocked-badges', JSON.stringify(bpBadges));
        localStorage.setItem('mehrbod-cards-unlocked-titles', JSON.stringify(bpTitles));
      } catch (_) {}

      const allCosmeticArray = [...cosmeticIdsToUnlock];
      if (typeof saveOwnedCosmetics === 'function') {
        saveOwnedCosmetics(allCosmeticArray);
      } else {
        localStorage.setItem('mehrbod-cards-owned-cosmetics', JSON.stringify(allCosmeticArray));
      }
      localStorage.setItem('mehrbod-cards-cosmetics', JSON.stringify(allCosmeticArray));

      // 4. Ensure plenty of Bux
      if (typeof saveBux === 'function') {
        saveBux(50000);
        if (typeof updateBuxDisplay === 'function') updateBuxDisplay();
      }

      // 5. Save inventory backup for anti-cheat
      if (typeof saveInventoryBackup === 'function') {
        saveInventoryBackup();
      }

      // 6. Refresh all UI components
      if (typeof renderBattlePassScreen === 'function') renderBattlePassScreen();
      if (typeof updateBattlePassBadge === 'function') updateBattlePassBadge();
      if (typeof updateThemeButtons === 'function') updateThemeButtons();
      if (typeof renderCollectionScreen === 'function') renderCollectionScreen();
      if (typeof renderDeckBuilder === 'function') renderDeckBuilder();
      if (typeof fireConfetti === 'function') fireConfetti();
      if (typeof showToast === 'function') {
        showToast('⚡ MASTER UNLOCK: All Cards, Max Tier 100 Battle Pass & All Cosmetics Unlocked!', 4500);
      }

      if (execResult) {
        execResult.textContent = '✔ SUCCESS: All Cards, Battle Pass Tiers (Max 100 & Premium), and Cosmetics unlocked!';
        execResult.className = 'secret-exec-result success';
        execResult.classList.remove('hidden');
      }
      return true;
    } catch (err) {
      console.error('devUnlockAll error:', err);
      return false;
    }
  };

  authForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = (cipherInput?.value || '').trim().toLowerCase();
    const validKeys = ['ohio', 'dev', 'developer', 'unlock', 'unlockall', 'mehrbod', 'admin'];
    if (validKeys.includes(entered)) {
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

  unlockAllMasterBtn?.addEventListener('click', () => {
    window.devUnlockAll();
  });

  grantBuxBtn?.addEventListener('click', () => {
    let newTotal = 50000;
    if (typeof AntiCheat !== 'undefined' && typeof AntiCheat.grantAuthorizedDevBux === 'function') {
      newTotal = AntiCheat.grantAuthorizedDevBux(50000);
    } else if (typeof addBux === 'function') {
      newTotal = addBux(50000);
    }
    if (typeof updateBuxDisplay === 'function') updateBuxDisplay();
    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
    if (typeof fireConfetti === 'function') fireConfetti();
    if (typeof showToast === 'function') {
      showToast(`💰 Granted +50,000 Mehrbod Bux! Total: ${newTotal.toLocaleString()} Bux`, 4000);
    }
    if (execResult) {
      execResult.textContent = `✔ SUCCESS: +50,000 Mehrbod Bux injected with executive anti-cheat verification! Total Balance: ${newTotal.toLocaleString()} Bux`;
      execResult.className = 'secret-exec-result success';
      execResult.classList.remove('hidden');
    }
  });

  unlockAllCardsBtn?.addEventListener('click', () => {
    window.devUnlockAll();
  });

  unlockAllCosmeticsBtn?.addEventListener('click', () => {
    window.devUnlockAll();
  });

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

  function handleMTap(e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    mClickCount++;
    clearTimeout(mResetTimer);

    if (mClickCount >= 5) {
      mClickCount = 0;
      if (typeof fireConfetti === 'function') fireConfetti();
      if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
      openSecretMenu();
    } else {
      mResetTimer = setTimeout(() => {
        mClickCount = 0;
      }, 3500);
    }
  }

  if (mTrigger) {
    mTrigger.addEventListener('click', handleMTap);
    mTrigger.addEventListener('pointerdown', handleMTap);
  }

  document.addEventListener('click', (e) => {
    if (e.target && (e.target.id === 'secret-m-trigger' || e.target.closest('#secret-m-trigger'))) {
      handleMTap(e);
    }
  });

  // Also support spamming 'M' on the keyboard 5 times from menus!
  let mKeyCount = 0;
  let mKeyResetTimer = null;
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'm' || e.key === 'M') {
      const gameScreen = document.getElementById('screen-game');
      if (!gameScreen || gameScreen.classList.contains('hidden')) {
        mKeyCount++;
        clearTimeout(mKeyResetTimer);
        if (mKeyCount >= 5) {
          mKeyCount = 0;
          if (typeof fireConfetti === 'function') fireConfetti();
          if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
          openSecretMenu();
        } else {
          mKeyResetTimer = setTimeout(() => {
            mKeyCount = 0;
          }, 3000);
        }
      }
    }
  });

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

  launch3DHubBtn?.addEventListener('click', () => {
    closeSecretMenu();
    if (typeof showXRArenaScreen === 'function') {
      showXRArenaScreen();
    }
    if (typeof enableMobileVRHubJoystick === 'function') {
      enableMobileVRHubJoystick();
    }
    if (typeof showToast === 'function') {
      showToast('🌐 3D VR Central Hub Simulation Launched! Use On-Screen Joystick or WASD keys to explore.', 4000);
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

      // Unlock Battle Pass Premium, Max Tier 100, and claim all 100 tiers
      localStorage.setItem('mehrbod-cards-bp-premium', 'true');
      localStorage.setItem('mehrbod-cards-bp-xp', (100 * 500).toString());
      const claimedMap = {};
      for (let i = 1; i <= 100; i++) {
        claimedMap[`${i}_free`] = true;
        claimedMap[`${i}_premium`] = true;
      }
      localStorage.setItem('mehrbod-cards-bp-claimed', JSON.stringify(claimedMap));
      if (typeof renderBattlePassScreen === 'function') renderBattlePassScreen();
      if (typeof updateBattlePassBadge === 'function') updateBattlePassBadge();

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
        showToast('🃏 All Cards, Battle Pass Tiers & Prism Core Theme Unlocked!', 4500);
      }

      if (execResult) {
        execResult.textContent = '✔ SUCCESS: All Cards, Spells, Chips, and Battle Pass Tiers Unlocked! (Max Tier 100 & Premium Pass Active)';
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

      // Unlock Battle Pass Premium, Max Tier 100, and claim all 100 tiers
      localStorage.setItem('mehrbod-cards-bp-premium', 'true');
      localStorage.setItem('mehrbod-cards-bp-xp', (100 * 500).toString());
      const claimedMap = {};
      for (let i = 1; i <= 100; i++) {
        claimedMap[`${i}_free`] = true;
        claimedMap[`${i}_premium`] = true;
      }
      localStorage.setItem('mehrbod-cards-bp-claimed', JSON.stringify(claimedMap));
      if (typeof renderBattlePassScreen === 'function') renderBattlePassScreen();
      if (typeof updateBattlePassBadge === 'function') updateBattlePassBadge();

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

function playPlayerBoardMilestoneAnimation(streakCount) {
  const board = document.getElementById('player-board');
  if (!board) return;

  // Add highly visual glow state & shake
  board.classList.add('milestone-celebrate');

  const glow = document.createElement('div');
  glow.className = 'player-board-milestone-glow';
  board.appendChild(glow);

  if (typeof Sound !== 'undefined') {
    if (Sound.sparkle) Sound.sparkle();
    if (Sound.whoosh) Sound.whoosh('in', 0.15);
  }

  // Calculate coordinates relative to the board's bounding rect
  const rect = board.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const count = 75;
  const colors = ['#fbbf24', '#fcd34d', '#f59e0b', '#ef4444', '#ec4899', '#ffffff'];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'milestone-burst-particle';
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.backgroundColor = color;

    // Center starting offsets
    p.style.left = `${centerX}px`;
    p.style.top = `${centerY}px`;

    const angle = Math.random() * 2 * Math.PI;
    const speed = 120 + Math.random() * 280;
    const x = Math.cos(angle) * speed;
    const y = Math.sin(angle) * speed;

    p.style.setProperty('--tx', `${x}px`);
    p.style.setProperty('--ty', `${y}px`);

    const size = 6 + Math.random() * 14;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.animationDelay = `${Math.random() * 0.12}s`;

    const shapeType = Math.random();
    if (shapeType < 0.45) {
      p.style.borderRadius = '50%';
    } else if (shapeType < 0.75) {
      p.style.borderRadius = '0';
    } else {
      p.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    }

    board.appendChild(p);

    setTimeout(() => { p.remove(); }, 1600);
  }

  setTimeout(() => {
    glow.remove();
    board.classList.remove('milestone-celebrate');
  }, 2400);
}
window.playPlayerBoardMilestoneAnimation = playPlayerBoardMilestoneAnimation;

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

      const triggerLetterBounce = (e) => {
        if (e && e.type === 'click' && e.detail === 0) return; // ignore synthetic
        
        const col = getLiveGradientColor(fraction);
        letter.style.setProperty('--live-glow', col.rgb);

        letter.classList.remove('letter-pop');
        void letter.offsetWidth; // force DOM reflow to restart animation seamlessly
        letter.classList.add('letter-pop');

        if (letter._popTimer) clearTimeout(letter._popTimer);
        letter._popTimer = setTimeout(() => {
          letter.classList.remove('letter-pop');
          letter._popTimer = null;
        }, 450);

        try {
          if (typeof Sound !== 'undefined' && Sound && typeof Sound.tap === 'function') {
            Sound.tap();
          }
        } catch (err) {}
      };

      letter.addEventListener('pointerenter', () => {
        const col = getLiveGradientColor(fraction);
        letter.style.setProperty('--live-glow', col.rgb);
      });

      if (!letter.dataset.bounceBound) {
        letter.dataset.bounceBound = 'true';
        letter.addEventListener('pointerdown', triggerLetterBounce);
      }
    });
  };

  // Delegated fallback for title letter clicks and taps
  document.addEventListener('click', (e) => {
    const letter = e.target.closest('.game-title .title-letter');
    if (!letter) return;
    
    const letters = Array.from(document.querySelectorAll('.game-title .title-letter'));
    const idx = letters.indexOf(letter);
    const fraction = (idx >= 0 ? idx : 0) / (letters.length - 1 || 1);
    const col = getLiveGradientColor(fraction);
    letter.style.setProperty('--live-glow', col.rgb);

    letter.classList.remove('letter-pop');
    void letter.offsetWidth;
    letter.classList.add('letter-pop');

    if (letter._popTimer) clearTimeout(letter._popTimer);
    letter._popTimer = setTimeout(() => {
      letter.classList.remove('letter-pop');
      letter._popTimer = null;
    }, 450);

    try { if (typeof Sound !== 'undefined' && Sound && Sound.tap) Sound.tap(); } catch (_) {}
  });

  window.setupTitleLetters = setupLetters;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLetters, { once: true });
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

function playSacrificeManSpellAnimation(owner) {
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
      <div style="font-size: 1.05rem; color: #fecaca; margin-top: 6px;">Sacrificed Red Card & Granted Sacrifice Man Spells!</div>
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
window.playSacrificeManSpellAnimation = playSacrificeManSpellAnimation;
window.playRemainsMaskAnimation = playRemainsMaskAnimation;
window.playSupremeShirtAnimation = playSupremeShirtAnimation;
window.playReviveAnimation = playReviveAnimation;
window.playSkeletonStaffAnimation = playSkeletonStaffAnimation;

// ---------- PRISM CORE INTERACTIVE CURSOR SPARKLE & CHIME ENGINE ----------
(function initPrismCoreInteractiveEngine() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let lastSparkleTime = 0;
  const SPARKLE_SYMBOLS = ['✨', '✦', '♦', '❇️', '💎', '⭐'];
  const SPARKLE_COLORS = ['#38bdf8', '#f43f5e', '#f59e0b', '#10b981', '#a855f7', '#ffffff'];
  let activeSparklesCount = 0;
  const MAX_ACTIVE_SPARKLES = 25;

  function spawnPrismSparkle(x, y, count = 1) {
    if (!document.documentElement.classList.contains('theme-prism') && !document.body.classList.contains('theme-prism')) return;
    if (activeSparklesCount >= MAX_ACTIVE_SPARKLES) return;

    const actualSpawnCount = Math.min(count, MAX_ACTIVE_SPARKLES - activeSparklesCount);

    for (let i = 0; i < actualSpawnCount; i++) {
      activeSparklesCount++;
      const p = document.createElement('span');
      p.className = 'prism-interactive-sparkle';
      p.textContent = SPARKLE_SYMBOLS[Math.floor(Math.random() * SPARKLE_SYMBOLS.length)];
      
      const offsetX = (Math.random() - 0.5) * 24;
      const offsetY = (Math.random() - 0.5) * 24;
      const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];

      p.style.cssText = `
        position: fixed;
        left: ${x + offsetX}px;
        top: ${y + offsetY}px;
        color: ${color};
        font-size: ${10 + Math.random() * 12}px;
        pointer-events: none;
        z-index: 9999;
        text-shadow: 0 0 8px ${color};
        transform: translate(-50%, -50%) scale(0.6) rotate(${Math.random() * 360}deg);
        animation: prismSparkleFloat 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      `;

      document.body.appendChild(p);
      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
        activeSparklesCount = Math.max(0, activeSparklesCount - 1);
      }, 850);
    }
  }

  // Mouse trail
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastSparkleTime > 50) {
      lastSparkleTime = now;
      spawnPrismSparkle(e.clientX, e.clientY, 1);
    }
  }, { passive: true });

  // Tap burst on Prism theme (chime sound removed as requested)
  document.addEventListener('click', (e) => {
    if (!document.documentElement.classList.contains('theme-prism') && !document.body.classList.contains('theme-prism')) return;
    spawnPrismSparkle(e.clientX, e.clientY, 6);
  }, { passive: true });
})();

// ============================================================
// UNIVERSAL CARD 3D PARALLAX & SPECULAR GLARE ENGINE
// Applies interactive mouse-follow 3D tilt, sub-element depth displacement,
// and moving specular glare reflections to ALL cards across menus and in-match!
// ============================================================
(function initUniversalCardParallaxEngine() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let activeCard = null;
  let moveX = 0;
  let moveY = 0;
  let renderScheduled = false;

  const CARD_SELECTOR = '.card, .dcard, .sc-card, .modern-shop-card, .merge-preview-card, .flip-card-3d, .bounty-card, .milestone-card-item, .packopen-card';

  function applyUniversalCardParallax(card, clientX, clientY) {
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normX = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width / 2)));
    const normY = Math.max(-1, Math.min(1, (clientY - centerY) / (rect.height / 2)));

    const rotateX = (-normY * 12).toFixed(2);
    const rotateY = (normX * 14).toFixed(2);
    const shadowX = (-normX * 10).toFixed(2);
    const shadowY = (-normY * 10).toFixed(2);

    const glareX = Math.max(0, Math.min(100, (((clientX - rect.left) / rect.width) * 100))).toFixed(1);
    const glareY = Math.max(0, Math.min(100, (((clientY - rect.top) / rect.height) * 100))).toFixed(1);

    // Set custom CSS variables for specular glare and shine
    card.style.setProperty('--shine-x', `${glareX}%`);
    card.style.setProperty('--shine-y', `${glareY}%`);
    card.style.setProperty('--glare-x', `${glareX}%`);
    card.style.setProperty('--glare-y', `${glareY}%`);
    card.style.setProperty('--glare-opacity', '1');

    // Make sure holographic / glare shine element exists
    if (!card.querySelector('.card-holo-shine') && !card.querySelector('.bp-card-glare') && !card.classList.contains('no-glare')) {
      const shine = document.createElement('div');
      shine.className = 'card-holo-shine';
      card.appendChild(shine);
    }

    card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(12px) scale(1.035)`;
    card.style.boxShadow = `${shadowX}px ${shadowY}px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.25)`;

    // Displace child layers for interior 3D depth
    const subName = card.querySelector('.card-name, .dcard-name, .modern-shop-card-name');
    const subAbility = card.querySelector('.card-ability, .dcard-text, .modern-shop-card-desc');
    const subStats = card.querySelector('.card-stats, .dcard-stat-pill, .dcard-rarity-pill');
    const subBadge = card.querySelector('.dcard-count-badge, .merge-pick-badge');

    if (subName) subName.style.transform = `translate3d(${(normX * 5).toFixed(1)}px, ${(normY * 5).toFixed(1)}px, 18px)`;
    if (subAbility) subAbility.style.transform = `translate3d(${(normX * 3).toFixed(1)}px, ${(normY * 3).toFixed(1)}px, 12px)`;
    if (subStats) subStats.style.transform = `translate3d(${(normX * 6).toFixed(1)}px, ${(normY * 6).toFixed(1)}px, 22px)`;
    if (subBadge) subBadge.style.transform = `translate3d(${(-normX * 4).toFixed(1)}px, ${(-normY * 4).toFixed(1)}px, 26px)`;
  }

  function resetUniversalCardParallax(card) {
    if (!card) return;
    card.style.transform = '';
    card.style.boxShadow = '';
    card.style.setProperty('--glare-opacity', '0');

    const subName = card.querySelector('.card-name, .dcard-name, .modern-shop-card-name');
    const subAbility = card.querySelector('.card-ability, .dcard-text, .modern-shop-card-desc');
    const subStats = card.querySelector('.card-stats, .dcard-stat-pill, .dcard-rarity-pill');
    const subBadge = card.querySelector('.dcard-count-badge, .merge-pick-badge');

    if (subName) subName.style.transform = '';
    if (subAbility) subAbility.style.transform = '';
    if (subStats) subStats.style.transform = '';
    if (subBadge) subBadge.style.transform = '';
  }

  document.addEventListener('pointermove', (e) => {
    // Avoid overriding battlepass tier cards which have dedicated setup
    if (e.target.closest('.bp-reward-card')) return;

    const card = e.target.closest(CARD_SELECTOR);
    if (!card) {
      if (activeCard) {
        resetUniversalCardParallax(activeCard);
        activeCard = null;
      }
      return;
    }

    if (activeCard && activeCard !== card) {
      resetUniversalCardParallax(activeCard);
    }
    activeCard = card;
    moveX = e.clientX;
    moveY = e.clientY;

    if (!renderScheduled) {
      renderScheduled = true;
      requestAnimationFrame(() => {
        if (activeCard) {
          applyUniversalCardParallax(activeCard, moveX, moveY);
        }
        renderScheduled = false;
      });
    }
  }, { passive: true });

  document.addEventListener('pointerleave', () => {
    if (activeCard) {
      resetUniversalCardParallax(activeCard);
      activeCard = null;
    }
  }, { passive: true });
})();

// ============================================================
// 3D BATTLE PASS THEMES MULTI-PLANE PARALLAX WORLD ENGINE
// Reacts dynamically to cursor positioning across the viewport
// creating multi-plane depth in both full-screen backgrounds and locker previews!
// Optimized with background tab suspension & DOM query caching.
// ============================================================
(function initThemeWorldParallaxEngine() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  let animId = null;
  let frameCount = 0;
  let activeBgsCache = [];
  let isTabActive = true;

  const THEME_BG_SELECTORS = [
    '#theme-chronos-bg',
    '#theme-neon_cyberpunk-bg',
    '#theme-void_singularity-bg',
    '#theme-quantum_overdrive-bg',
    '#theme-solar_prominence-bg',
    '#theme-prism_mythic-bg',
    '#theme-celestial_nebula-bg',
    '#theme-abyss_kraken-bg',
    '#theme-apex_sovereign-bg',
    '#theme-verity-bg',
    '.showcase-theme-canvas'
  ];

  function refreshActiveBgsCache() {
    activeBgsCache = [];
    THEME_BG_SELECTORS.forEach(sel => {
      const els = document.querySelectorAll(sel);
      els.forEach(el => {
        if (el && !el.classList.contains('hidden') && el.offsetParent !== null) {
          // Pre-cache query sub-selectors for maximum rendering speed and 0 frame-level DOM queries
          activeBgsCache.push({
            el: el,
            isCanvas: el.classList.contains('showcase-theme-canvas'),
            bgLayers: el.querySelectorAll('.temporal-grid, .cyber-highway-grid, .singularity-matter-streams, .quantum-subatomic-grid, .solar-corona-cells, .prism-shards-field, .celestial-star-dust, .abyss-trench-floor, .apex-colonnade-hall, .chronos-temporal-grid, .chronos-deep-void, .sovereign-celestial-void, .sovereign-3d-floor-grid'),
            midLayers: el.querySelectorAll('.chronos-astrolabe-3d, .cyber-skyline-parallax, .singularity-core-3d, .quantum-core-lattice, .solar-core-pulsar, .prism-diamond-core-3d, .celestial-dust-cloud, .abyss-caustics-layer, .apex-gilded-portal, .chronos-3d-stage, .chronos-celestial-rings-back, .chronos-dial-center, .sovereign-stargate-3d, .sovereign-3d-colonnade, .gilded-column'),
            fgLayers: el.querySelectorAll('.chronos-gear-ring, .cyber-scanlines-depth, .singularity-photon-ring, .quantum-particle-cloud, .solar-prominence-arcs, .prism-refractor-facets, .celestial-meteor-streak, .abyss-kraken-tentacle, .apex-runic-obelisk, .apex-cathedral-beams, .chronos-3d-pendulum, .chronos-hourglass-stream, .chronos-gear-clockwork, .chronos-stardust, .sovereign-3d-crown-stage, .sovereign-monolith-orbit, .sovereign-god-rays, .sovereign-gold-flakes')
          });
        }
      });
    });
  }

  function updateThemeParallax() {
    if (typeof performanceMode !== 'undefined' && (performanceMode || omegaPerformanceMode)) {
      animId = null;
      return; // Skip theme parallax computations completely in performance modes
    }

    if (!isTabActive || document.hidden) {
      setTimeout(() => {
        if (isTabActive && !document.hidden) {
          animId = requestAnimationFrame(updateThemeParallax);
        }
      }, 500);
      return;
    }

    // Refresh active DOM element cache once every 60 frames (1s) to eliminate high heap allocation & DOM lookups
    if (frameCount++ % 60 === 0) {
      refreshActiveBgsCache();
    }

    if (activeBgsCache.length === 0) {
      animId = null;
      return;
    }

    // Smooth lerp interpolation for 60fps cinematic fluidity
    const diffX = targetX - mouseX;
    const diffY = targetY - mouseY;
    const isMoving = Math.abs(diffX) > 0.0005 || Math.abs(diffY) > 0.0005;

    if (isMoving) {
      mouseX += diffX * 0.12;
      mouseY += diffY * 0.12;
    } else {
      if (window.__lastParallaxMoving !== false) {
        mouseX = targetX;
        mouseY = targetY;
        window.__lastParallaxMoving = false;
      } else {
        // Skip DOM writes entirely if mouse is idle
        animId = requestAnimationFrame(updateThemeParallax);
        return;
      }
    }
    window.__lastParallaxMoving = true;

    const rotX = (-mouseY * 3.0).toFixed(2);
    const rotY = (mouseX * 3.5).toFixed(2);

    const mXBg = '0';
    const mYBg = '0';
    const mXMid = (mouseX * 10).toFixed(1);
    const mYMid = (mouseY * 8).toFixed(1);
    const mxFg = (mouseX * 18).toFixed(1);
    const myFg = (mouseY * 14).toFixed(1);

    activeBgsCache.forEach(cache => {
      // Main 3D Scene Perspective Tilt & Multi-Plane Individual Layer Displacement
      if (cache.el) {
        if (cache.el.id === 'theme-verity-bg') {
          // Secret Verity theme: absolutely no parallax or perspective tilt
          cache.el.style.transform = 'none';
          cache.el.style.setProperty('--px-bg', '0px');
          cache.el.style.setProperty('--py-bg', '0px');
          cache.el.style.setProperty('--px-mid', '0px');
          cache.el.style.setProperty('--py-mid', '0px');
          cache.el.style.setProperty('--px-fg', '0px');
          cache.el.style.setProperty('--py-fg', '0px');
          return;
        }

        if (cache.el.id === 'theme-apex_sovereign-bg') {
          // Tier 100: Background stays static (0px bg offset, no stage rotation), floating elements above move with full parallax
          cache.el.style.transform = 'none';
          cache.el.style.setProperty('--px-bg', '0px');
          cache.el.style.setProperty('--py-bg', '0px');
          cache.el.style.setProperty('--px-mid', mXMid + 'px');
          cache.el.style.setProperty('--py-mid', mYMid + 'px');
          cache.el.style.setProperty('--px-fg', mxFg + 'px');
          cache.el.style.setProperty('--py-fg', myFg + 'px');
          return;
        }

        if (cache.isCanvas) {
          cache.el.style.transform = `perspective(900px) rotateX(${(rotX * 1.5).toFixed(2)}deg) rotateY(${(rotY * 1.5).toFixed(2)}deg)`;
        } else {
          cache.el.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        }

        // Set multi-plane individual element displacement custom properties
        cache.el.style.setProperty('--px-bg', mXBg + 'px');
        cache.el.style.setProperty('--py-bg', mYBg + 'px');
        cache.el.style.setProperty('--px-mid', mXMid + 'px');
        cache.el.style.setProperty('--py-mid', mYMid + 'px');
        cache.el.style.setProperty('--px-fg', mxFg + 'px');
        cache.el.style.setProperty('--py-fg', myFg + 'px');
      }
    });

    animId = requestAnimationFrame(updateThemeParallax);
  }

  window.addEventListener('pointermove', (e) => {
    // Normalized screen offset (-1.0 to 1.0)
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
    if (isTabActive) {
      window.__triggerThemeParallaxCheck();
      ParticleAvatarEngine.startLoop(); // Restart particle loop
    }
  });

  window.__triggerThemeParallaxCheck = function() {
    refreshActiveBgsCache();
    if (activeBgsCache.length > 0 && !animId && isTabActive && !document.hidden) {
      animId = requestAnimationFrame(updateThemeParallax);
    }
  };

  window.__triggerThemeParallaxCheck();
})();

/* ---------- Ray Gun Secret System ---------- */
function initRayGunSystem() {
  if (window.__rayGunActive) return;
  window.__rayGunActive = true;
  let plasmaBlueMat = null;

  const container = document.createElement('div');
  container.id = 'raygun-container';
  container.style.cssText = 'position:fixed; bottom:-10px; left:-10px; width:420px; height:380px; z-index:9999999; pointer-events:none;';
  document.body.appendChild(container);

  if (typeof THREE === 'undefined') {
    showToast('Three.js not loaded. Ray Gun failed to initialize.');
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 420 / 380, 0.1, 1000);
  camera.position.set(2.8, 1.2, 8.8);
  camera.lookAt(1.5, -0.1, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(420, 380);
  renderer.setPixelRatio(1); // Set to 1 to reduce fragment shader overhead by up to 75% on Retina displays
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Studio lighting to highlight the glossy red and chrome metallic finishes
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(6, 10, 8);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
  rimLight.position.set(-8, 6, -4);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xffe4e6, 0.5);
  fillLight.position.set(4, -4, 6);
  scene.add(fillLight);

  // --- Dynamic Textures ---
  // 1. Iconic Battery Meter Gauge Texture
  function createDialTexture() {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 512;
    const ctx = cv.getContext('2d');

    // Dark dial face
    const bgGrad = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
    bgGrad.addColorStop(0, '#2d0a0f');
    bgGrad.addColorStop(0.75, '#160406');
    bgGrad.addColorStop(1, '#0a0102');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Chrome outer ring
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(256, 256, 240, 0, Math.PI * 2);
    ctx.stroke();

    // Colored Meter Arc: Yellow to Vibrant Radioactive Green
    const meterGrad = ctx.createLinearGradient(90, 256, 430, 256);
    meterGrad.addColorStop(0, '#ef4444');
    meterGrad.addColorStop(0.25, '#f59e0b');
    meterGrad.addColorStop(0.65, '#84cc16');
    meterGrad.addColorStop(1, '#10b981');

    ctx.strokeStyle = meterGrad;
    ctx.lineWidth = 36;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Arc across the upper-right hemisphere
    ctx.arc(256, 256, 175, Math.PI * 0.9, Math.PI * 2.05);
    ctx.stroke();

    // Calibration hash marks
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    for (let a = Math.PI * 0.95; a <= Math.PI * 2.0; a += 0.13) {
      const x1 = 256 + Math.cos(a) * 150;
      const y1 = 256 + Math.sin(a) * 150;
      const x2 = 256 + Math.cos(a) * 195;
      const y2 = 256 + Math.sin(a) * 195;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Needle pointing into green zone
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(256, 256);
    const needleAng = Math.PI * 1.8;
    ctx.lineTo(256 + Math.cos(needleAng) * 165, 256 + Math.sin(needleAng) * 165);
    ctx.stroke();

    // Pivot hub
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(256, 256, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(256, 256, 12, 0, Math.PI * 2);
    ctx.fill();

    // Gold lightning sigil
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(235, 330);
    ctx.lineTo(270, 360);
    ctx.lineTo(245, 380);
    ctx.lineTo(275, 420);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  // 2. Dorsal Fin Gold Scrollwork Texture
  function createFinTexture() {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 512;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#bd0d22';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Flourish vine curves matching reference
    ctx.beginPath();
    ctx.moveTo(80, 420);
    ctx.bezierCurveTo(180, 360, 220, 240, 380, 160);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(170, 330);
    ctx.bezierCurveTo(120, 260, 160, 190, 240, 230);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(260, 250);
    ctx.bezierCurveTo(220, 150, 300, 100, 360, 140);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(320, 200);
    ctx.bezierCurveTo(360, 280, 430, 240, 460, 180);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  // --- High-Grade Materials ---
  const redCandyMat = new THREE.MeshStandardMaterial({
    color: 0xbd0d22,
    metalness: 0.65,
    roughness: 0.22,
  });

  const darkRedMat = new THREE.MeshStandardMaterial({
    color: 0x7a0512,
    metalness: 0.58,
    roughness: 0.32,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.96,
    roughness: 0.12,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.25,
  });

  plasmaBlueMat = new THREE.MeshStandardMaterial({
    color: 0x00d8ff,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: 0.92,
  });
  const bluePlasmaMat = plasmaBlueMat;

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.9,
  });

  const finTexture = createFinTexture();
  const finMat = new THREE.MeshStandardMaterial({
    map: finTexture,
    metalness: 0.6,
    roughness: 0.25,
  });

  const dialTexture = createDialTexture();
  const dialFaceMat = new THREE.MeshStandardMaterial({
    map: dialTexture,
    roughness: 0.2,
    metalness: 0.3,
  });

  // --- Master Ray Gun Model Group ---
  const gunGroup = new THREE.Group();
  scene.add(gunGroup);

  // 1. FRONT TRUMPET CONE MUZZLE (FUNNEL)
  const funnelOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.28, 1.5, 32, 1, false),
    redCandyMat
  );
  funnelOuter.rotation.z = Math.PI / 2;
  funnelOuter.position.set(3.45, 0.5, 0);
  gunGroup.add(funnelOuter);

  // Trumpet chrome rim lip
  const funnelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.045, 16, 32),
    chromeMat
  );
  funnelRim.rotation.y = Math.PI / 2;
  funnelRim.position.set(4.2, 0.5, 0);
  gunGroup.add(funnelRim);

  // Gold decorative band around funnel
  const funnelGoldBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.65, 0.16, 32),
    goldMat
  );
  funnelGoldBand.rotation.z = Math.PI / 2;
  funnelGoldBand.position.set(3.9, 0.5, 0);
  gunGroup.add(funnelGoldBand);

  // Gold stud rivets around the band
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), goldMat);
    stud.position.set(3.9, 0.5 + Math.cos(ang) * 0.68, Math.sin(ang) * 0.68);
    gunGroup.add(stud);
  }

  // Funnel interior cone
  const funnelInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.7, 1.45, 32, 1, true),
    darkRedMat
  );
  funnelInner.rotation.z = Math.PI / 2;
  funnelInner.position.set(3.45, 0.5, 0);
  gunGroup.add(funnelInner);

  // Central Emitter Antenna Probe (Rod extending straight through cone)
  const emitterRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 2.5, 16),
    chromeMat
  );
  emitterRod.rotation.z = Math.PI / 2;
  emitterRod.position.set(3.95, 0.5, 0);
  gunGroup.add(emitterRod);

  // Iconic Glossy Red Emitter Bead at very tip
  const emitterTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 16),
    redCandyMat
  );
  emitterTip.position.set(5.22, 0.5, 0);
  gunGroup.add(emitterTip);

  // Dynamic muzzle light for shot flashes
  const muzzleFlashLight = new THREE.PointLight(0x22c55e, 0, 12);
  muzzleFlashLight.position.set(5.3, 0.5, 0);
  gunGroup.add(muzzleFlashLight);

  // 2. FRONT RETICLE SIGHT (TALL SILVER POST WITH OCTAGON CROSSHAIR)
  const sightPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.4, 12),
    chromeMat
  );
  sightPost.position.set(2.4, 1.25, 0);
  gunGroup.add(sightPost);

  // Octagon crosshairs reticle
  const sightRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.03, 8, 8),
    chromeMat
  );
  sightRing.rotation.y = Math.PI / 2;
  sightRing.position.set(2.4, 1.95, 0);
  gunGroup.add(sightRing);

  // Internal crosshair bars
  const crossHoriz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8),
    chromeMat
  );
  crossHoriz.rotation.x = Math.PI / 2;
  crossHoriz.position.set(2.4, 1.95, 0);
  gunGroup.add(crossHoriz);

  const crossVert = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8),
    chromeMat
  );
  crossVert.position.set(2.4, 1.95, 0);
  gunGroup.add(crossVert);

  // 3. STEPPED FLUTED BARREL ASSEMBLY
  const barrelMid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.28, 0.9, 24),
    chromeMat
  );
  barrelMid.rotation.z = Math.PI / 2;
  barrelMid.position.set(2.25, 0.5, 0);
  gunGroup.add(barrelMid);

  // Ribbed barrel rings
  for (let i = 0; i < 3; i++) {
    const bRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.045, 12, 24),
      chromeMat
    );
    bRing.rotation.y = Math.PI / 2;
    bRing.position.set(2.0 + i * 0.25, 0.5, 0);
    gunGroup.add(bRing);
  }

  // 4. SWEPT DORSAL FIN (SHARK FIN WITH GOLD SCROLLWORK)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.95, 0);
  finShape.quadraticCurveTo(0.35, 0.85, -0.4, 1.05);
  finShape.quadraticCurveTo(-0.1, 0.4, 0, 0);

  const finGeom = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  finGeom.center();

  const dorsalFin = new THREE.Mesh(finGeom, finMat);
  dorsalFin.position.set(1.68, 1.08, 0);
  gunGroup.add(dorsalFin);

  // Gold trim outline around fin
  const finGoldTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.2),
    goldMat
  );
  finGoldTrim.position.set(1.68, 0.58, 0);
  gunGroup.add(finGoldTrim);

  // Gold "Z" collar badge below the fin
  const collarBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.42, 0.35, 24),
    darkRedMat
  );
  collarBadge.rotation.z = Math.PI / 2;
  collarBadge.position.set(1.68, 0.5, 0);
  gunGroup.add(collarBadge);

  // 5. BLUE PLASMA CANISTER (URANIUM BATTERY CELL)
  const plasmaCell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 1.65, 32),
    bluePlasmaMat
  );
  plasmaCell.rotation.z = Math.PI / 2;
  plasmaCell.position.set(0.85, 0.5, 0);
  gunGroup.add(plasmaCell);

  // Plasma battery interior light
  const plasmaPointLight = new THREE.PointLight(0x00d4ff, 0.8, 4);
  plasmaPointLight.position.set(0.85, 0.5, 0);
  gunGroup.add(plasmaPointLight);

  // Red front and rear caps of the plasma cell
  const frontCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    redCandyMat
  );
  frontCap.rotation.z = -Math.PI / 2;
  frontCap.position.set(1.67, 0.5, 0);
  gunGroup.add(frontCap);

  const rearCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    redCandyMat
  );
  rearCap.rotation.z = Math.PI / 2;
  rearCap.position.set(0.03, 0.5, 0);
  gunGroup.add(rearCap);

  // 3 Curved Chrome Retention Clamps / Brackets over plasma cell
  for (let i = 0; i < 3; i++) {
    const bracketX = 0.42 + i * 0.42;
    const bracket = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.045, 12, 32, Math.PI),
      chromeMat
    );
    bracket.position.set(bracketX, 0.5, 0);
    gunGroup.add(bracket);

    // Support lugs on both sides
    const lugL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), chromeMat);
    lugL.position.set(bracketX, 0.5, 0.52);
    gunGroup.add(lugL);

    const lugR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), chromeMat);
    lugR.position.set(bracketX, 0.5, -0.52);
    gunGroup.add(lugR);
  }

  // Top chrome runner rod connecting brackets
  const topRunner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.45, 12),
    chromeMat
  );
  topRunner.rotation.z = Math.PI / 2;
  topRunner.position.set(0.85, 1.02, 0);
  gunGroup.add(topRunner);

  // 6. LOWER BULBOUS POD (UNDER-CHAMBER)
  const lowerPod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.42, 1.1, 24),
    redCandyMat
  );
  lowerPod.rotation.z = Math.PI / 2;
  lowerPod.position.set(0.78, -0.25, 0);
  gunGroup.add(lowerPod);

  const podFrontCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 16, 16),
    redCandyMat
  );
  podFrontCap.position.set(1.33, -0.25, 0);
  gunGroup.add(podFrontCap);

  const podRearCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 16),
    redCandyMat
  );
  podRearCap.position.set(0.23, -0.25, 0);
  gunGroup.add(podRearCap);

  // Chrome pod socket cuff for hose
  const podCuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.05, 12, 20),
    chromeMat
  );
  podCuff.rotation.x = Math.PI / 2;
  podCuff.position.set(0.78, -0.7, 0.1);
  gunGroup.add(podCuff);

  // 7. SWEEPING UNDER-CABLE / HOSE (FROM LOWER POD TO BOTTOM OF GRIP)
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.78, -0.7, 0.08),
    new THREE.Vector3(0.72, -1.25, 0.12),
    new THREE.Vector3(0.42, -1.85, 0.14),
    new THREE.Vector3(-0.15, -2.25, 0.08),
    new THREE.Vector3(-0.68, -2.42, 0.0),
  ]);

  const hoseGeom = new THREE.TubeGeometry(hoseCurve, 32, 0.058, 12, false);
  const hoseMesh = new THREE.Mesh(hoseGeom, redCandyMat);
  gunGroup.add(hoseMesh);

  // Chrome grip connector cuff
  const gripHoseCuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.04, 12, 16),
    chromeMat
  );
  gripHoseCuff.position.set(-0.68, -2.42, 0);
  gunGroup.add(gripHoseCuff);

  // 8. MAIN RECEIVER BODY (HOUSING)
  const receiverMain = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 1.85, 1.25),
    redCandyMat
  );
  receiverMain.position.set(-0.65, 0.15, 0);
  gunGroup.add(receiverMain);

  // Rounded top shoulders for receiver
  const receiverTopCurve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 2.35, 24),
    redCandyMat
  );
  receiverTopCurve.rotation.z = Math.PI / 2;
  receiverTopCurve.position.set(-0.65, 0.95, 0);
  gunGroup.add(receiverTopCurve);

  // 3 Horizontal Chrome Speed Stripes on each side
  for (let side = -1; side <= 1; side += 2) {
    for (let s = 0; s < 3; s++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.065, 0.05),
        chromeMat
      );
      stripe.position.set(-0.65, -0.05 + s * 0.18, side * 0.64);
      gunGroup.add(stripe);
    }
  }

  // Rear Dual-Loop Reload Latch / Hammer
  const latchPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.4, 0.35),
    chromeMat
  );
  latchPost.position.set(-1.7, 0.9, 0);
  gunGroup.add(latchPost);

  // Dual metallic wire hoops sticking up and back
  for (let side = -1; side <= 1; side += 2) {
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.04, 12, 24, Math.PI * 1.5),
      chromeMat
    );
    loop.rotation.z = -Math.PI / 4;
    loop.position.set(-1.85, 1.25, side * 0.22);
    gunGroup.add(loop);
  }

  // Rear chrome knob / buffer
  const rearKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.45, 16),
    chromeMat
  );
  rearKnob.rotation.z = Math.PI / 2;
  rearKnob.position.set(-1.95, 0.15, 0);
  gunGroup.add(rearKnob);

  // 9. CIRCULAR BATTERY GAUGE / METER DIAL (PROMINENT RIGHT SIDE)
  const dialGroup = new THREE.Group();
  dialGroup.position.set(-0.62, 0.35, 0.62);
  gunGroup.add(dialGroup);

  // Raised bezel casing
  const dialBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.74, 0.24, 32),
    redCandyMat
  );
  dialBezel.rotation.x = Math.PI / 2;
  dialGroup.add(dialBezel);

  // Chrome bezel rim ring
  const dialChromeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.69, 0.04, 16, 32),
    chromeMat
  );
  dialChromeRing.position.set(0, 0, 0.12);
  dialGroup.add(dialChromeRing);

  // Dial face with canvas texture
  const dialFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.64, 32),
    dialFaceMat
  );
  dialFace.position.set(0, 0, 0.13);
  dialGroup.add(dialFace);

  // Glass dome cover
  const dialGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 0.04, 32),
    glassMat
  );
  dialGlass.rotation.x = Math.PI / 2;
  dialGlass.position.set(0, 0, 0.16);
  dialGroup.add(dialGlass);

  // 10. ERGONOMIC PISTOL GRIP & TRIGGER
  const gripGroup = new THREE.Group();
  gripGroup.position.set(-0.72, -0.65, 0);
  gunGroup.add(gripGroup);

  // Angled grip handle
  const gripMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 2.1, 0.76),
    redCandyMat
  );
  gripMesh.rotation.z = -0.28;
  gripMesh.position.set(0, -0.75, 0);
  gripGroup.add(gripMesh);

  // 6 Chrome grip ladder rungs along the rear backstrap
  for (let r = 0; r < 6; r++) {
    const rung = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.07, 0.62),
      chromeMat
    );
    // Calculated along the angled back of the grip
    const yOff = -0.15 - r * 0.24;
    const xOff = -0.38 + yOff * Math.tan(-0.28);
    rung.position.set(xOff, yOff, 0);
    gripGroup.add(rung);
  }

  // Chrome grip baseplate
  const gripBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.18, 0.84),
    chromeMat
  );
  gripBase.rotation.z = -0.28;
  gripBase.position.set(-0.35, -1.82, 0);
  gripGroup.add(gripBase);

  // Trigger guard
  const guardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.25, 0.0, 0),
    new THREE.Vector3(0.28, -0.3, 0),
    new THREE.Vector3(0.22, -0.9, 0),
    new THREE.Vector3(-0.15, -1.05, 0),
  ]);
  const guardMesh = new THREE.Mesh(
    new THREE.TubeGeometry(guardCurve, 20, 0.05, 10, false),
    redCandyMat
  );
  gripGroup.add(guardMesh);

  // Curved chrome trigger
  const triggerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.45, 0.16),
    chromeMat
  );
  triggerMesh.rotation.z = 0.35;
  triggerMesh.position.set(0.02, -0.45, 0);
  gripGroup.add(triggerMesh);

  // --- Initial Position & Cinematic Trophy Orientation ---
  gunGroup.position.set(-0.3, -0.35, 0);
  gunGroup.rotation.set(0.08, 0.72, 0.08);

  // Interactive mouse aim tracking
  let aimTargetY = 0.72;
  let aimTargetZ = 0.08;
  let aimCurrentY = 0.72;
  let aimCurrentZ = 0.08;

  let recoilX = 0;
  let recoilRotZ = 0;

  window.addEventListener('pointermove', (e) => {
    if (!window.__rayGunActive) return;
    const normX = e.clientX / window.innerWidth;
    const normY = e.clientY / window.innerHeight;
    aimTargetY = 0.55 + normX * 0.35;
    aimTargetZ = 0.02 + (0.5 - normY) * 0.22;
  }, { passive: true });

  function animate() {
    if (!window.__rayGunActive) return;
    requestAnimationFrame(animate);

    if (document.hidden) return; // Pause rendering if tab is hidden to save power

    const gameScreen = document.getElementById('screen-game');
    const xrScreen = document.getElementById('screen-webxr-arena');
    const isGameActive = (gameScreen && gameScreen.classList.contains('active-screen')) || 
                         (xrScreen && xrScreen.classList.contains('active-screen'));
    
    if (isGameActive) {
      if (container.style.display !== 'none') {
        container.style.display = 'none';
      }
      return; // Skip rendering frame when user is actively playing to maximize FPS
    } else {
      if (container.style.display === 'none') {
        container.style.display = 'block';
      }
    }

    const t = Date.now() * 0.0025;
    // Gentle floating idle breathing sway
    const idleY = Math.sin(t) * 0.04;
    const idleZ = Math.cos(t * 0.8) * 0.02;

    // Smooth lerp mouse aiming
    aimCurrentY += (aimTargetY - aimCurrentY) * 0.08;
    aimCurrentZ += (aimTargetZ - aimCurrentZ) * 0.08;

    // Recoil recovery
    recoilX *= 0.84;
    recoilRotZ *= 0.84;

    gunGroup.position.x = -0.3 - recoilX;
    gunGroup.position.y = -0.35 + idleY;
    gunGroup.rotation.y = aimCurrentY;
    gunGroup.rotation.z = aimCurrentZ + idleZ + recoilRotZ;

    // Pulse the blue plasma battery emissive glow
    if (plasmaBlueMat) {
      plasmaBlueMat.emissiveIntensity = 0.85 + Math.sin(t * 3.0) * 0.2;
    }
    if (plasmaPointLight) {
      plasmaPointLight.intensity = 0.8 + Math.sin(t * 3.0) * 0.25;
    }

    renderer.render(scene, camera);
  }
  animate();

  // --- Iconic Call of Duty Zombies Ray Gun Firing Sound Synthesizer ---
  function playAuthenticRayGunSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;

      // 1. Initial High-Frequency Laser Chirp ("Pchew")
      const oscChirp = audioCtx.createOscillator();
      const gainChirp = audioCtx.createGain();
      oscChirp.type = 'sawtooth';
      oscChirp.frequency.setValueAtTime(1900, now);
      oscChirp.frequency.exponentialRampToValueAtTime(110, now + 0.22);

      gainChirp.gain.setValueAtTime(0.55, now);
      gainChirp.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      // Lowpass filter to shape the electronic zap
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.25);

      oscChirp.connect(filter);
      filter.connect(gainChirp);
      gainChirp.connect(audioCtx.destination);
      oscChirp.start(now);
      oscChirp.stop(now + 0.25);

      // 2. Frequency Modulation for the iconic sci-fi plasma "buzz/flutter"
      const carrier = audioCtx.createOscillator();
      const modulator = audioCtx.createOscillator();
      const modGain = audioCtx.createGain();
      const carrierGain = audioCtx.createGain();

      carrier.type = 'triangle';
      carrier.frequency.setValueAtTime(950, now);
      carrier.frequency.exponentialRampToValueAtTime(180, now + 0.28);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(140, now); // FM rate
      modGain.gain.setValueAtTime(220, now);
      modGain.gain.exponentialRampToValueAtTime(10, now + 0.25);

      modulator.connect(carrier.frequency);
      carrier.connect(carrierGain);
      carrierGain.gain.setValueAtTime(0.45, now);
      carrierGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      carrierGain.connect(audioCtx.destination);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + 0.3);
      carrier.stop(now + 0.3);

      // 3. Deep Punch / Bass Thump
      const bassOsc = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(140, now);
      bassOsc.frequency.exponentialRampToValueAtTime(35, now + 0.22);
      bassGain.gain.setValueAtTime(0.6, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      bassOsc.connect(bassGain);
      bassGain.connect(audioCtx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.24);

      // 4. Lingering Metallic Spring / Sci-Fi Discharge Tail
      const tailOsc = audioCtx.createOscillator();
      const tailGain = audioCtx.createGain();
      tailOsc.type = 'sine';
      tailOsc.frequency.setValueAtTime(430, now + 0.05);
      tailOsc.frequency.exponentialRampToValueAtTime(180, now + 0.65);
      tailGain.gain.setValueAtTime(0.0, now);
      tailGain.gain.setValueAtTime(0.25, now + 0.05);
      tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      tailOsc.connect(tailGain);
      tailGain.connect(audioCtx.destination);
      tailOsc.start(now + 0.05);
      tailOsc.stop(now + 0.65);
    } catch (e) {}
  }

  // --- Firing Action ---
  function fireRayGun(targetX, targetY) {
    playAuthenticRayGunSound();

    // Kickback animation & muzzle pitch-up
    recoilX = 0.55;
    recoilRotZ = 0.18;

    // Flash green muzzle light
    if (muzzleFlashLight) {
      muzzleFlashLight.intensity = 8.0;
      setTimeout(() => { if (muzzleFlashLight) muzzleFlashLight.intensity = 0; }, 70);
    }

    // Flash plasma battery
    if (plasmaBlueMat) {
      plasmaBlueMat.emissiveIntensity = 2.5;
      setTimeout(() => { if (plasmaBlueMat) plasmaBlueMat.emissiveIntensity = 0.85; }, 100);
    }

    // Muzzle coordinates in screen pixels (bottom-left corner emitter tip)
    const startX = 145;
    const startY = window.innerHeight - 130;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // High-energy glowing green plasma bolt
    const bolt = document.createElement('div');
    bolt.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: ${startY}px;
      width: 50px;
      height: 12px;
      background: radial-gradient(circle, #ffffff 15%, #4ade80 60%, #16a34a 100%);
      border-radius: 999px;
      box-shadow: 0 0 25px 6px #22c55e, 0 0 50px 12px #15803d;
      z-index: 10000000;
      pointer-events: none;
      transform-origin: left center;
      transform: rotate(${angle}rad) scaleX(0.5);
      transition: transform 0.28s cubic-bezier(0.12, 0.7, 0.2, 1), opacity 0.28s ease-in;
    `;
    document.body.appendChild(bolt);

    requestAnimationFrame(() => {
      bolt.style.transform = `rotate(${angle}rad) translate(${dist}px, 0) scaleX(3.5)`;
      bolt.style.opacity = '0';
      setTimeout(() => bolt.remove(), 290);
    });

    // Muzzle smoke / energy ring
    const ring = document.createElement('div');
    ring.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: ${startY}px;
      width: 20px;
      height: 20px;
      border: 3px solid #4ade80;
      border-radius: 50%;
      box-shadow: 0 0 20px #22c55e;
      z-index: 10000000;
      pointer-events: none;
      transform: translate(-50%, -50%) scale(0.2);
      transition: transform 0.25s ease-out, opacity 0.25s ease-out;
    `;
    document.body.appendChild(ring);
    requestAnimationFrame(() => {
      ring.style.transform = `translate(-50%, -50%) scale(3.5)`;
      ring.style.opacity = '0';
      setTimeout(() => ring.remove(), 260);
    });

    // Impact explosion & plasma splash at click location
    setTimeout(() => {
      const impact = document.createElement('div');
      impact.style.cssText = `
        position: fixed;
        left: ${targetX}px;
        top: ${targetY}px;
        width: 14px;
        height: 14px;
        background: radial-gradient(circle, #ffffff 20%, #4ade80 70%, transparent 100%);
        border-radius: 50%;
        box-shadow: 0 0 35px 12px #22c55e, 0 0 70px 24px #16a34a;
        z-index: 10000000;
        pointer-events: none;
        transform: translate(-50%, -50%) scale(0.2);
        transition: transform 0.35s cubic-bezier(0.15, 0.85, 0.35, 1.2), opacity 0.35s ease-out;
      `;
      document.body.appendChild(impact);

      // Radial plasma splash particles
      for (let p = 0; p < 8; p++) {
        const spark = document.createElement('div');
        const spAng = (p / 8) * Math.PI * 2 + Math.random() * 0.4;
        const spDist = 30 + Math.random() * 45;
        spark.style.cssText = `
          position: fixed;
          left: ${targetX}px;
          top: ${targetY}px;
          width: 5px;
          height: 5px;
          background: #86efac;
          border-radius: 50%;
          box-shadow: 0 0 10px #22c55e;
          z-index: 10000000;
          pointer-events: none;
          transform: translate(-50%, -50%);
          transition: transform 0.32s ease-out, opacity 0.32s ease-out;
        `;
        document.body.appendChild(spark);
        requestAnimationFrame(() => {
          spark.style.transform = `translate(${Math.cos(spAng) * spDist - 2.5}px, ${Math.sin(spAng) * spDist - 2.5}px) scale(0)`;
          spark.style.opacity = '0';
          setTimeout(() => spark.remove(), 330);
        });
      }

      requestAnimationFrame(() => {
        impact.style.transform = `translate(-50%, -50%) scale(4.8)`;
        impact.style.opacity = '0';
        setTimeout(() => impact.remove(), 360);
      });
    }, 180);
  }

  window.addEventListener('mousedown', (e) => {
    if (!window.__rayGunActive) return;
    if (e.target.closest('button, input, a, .card, .menu-card, .tab-btn, .modal, .feature-close')) return;
    fireRayGun(e.clientX, e.clientY);
  });

  showToast('🔫 BEAUTY OF ANNIHILATION! Ray Gun Mark I online.', 4000);
}

/* ---------- Barbod's Scam Dust Overlay & Screen Wiping Effect ---------- */
function triggerBarbodDustEffect() {
  window.triggerBarbodDustEffect = triggerBarbodDustEffect;
  if (document.getElementById('barbod-dust-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'barbod-dust-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: transparent;
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    pointer-events: auto;
    font-family: var(--font-display, inherit);
    padding: 24px; box-sizing: border-box;
    transition: opacity 0.5s ease;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    background: rgba(15, 23, 42, 0.95);
    border: 1.5px solid #ef4444;
    border-radius: 12px;
    padding: 12px 24px;
    text-align: center;
    color: #fff;
    font-weight: 800;
    font-size: 0.95rem;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    pointer-events: none;
    line-height: 1.4;
    z-index: 10;
    position: relative;
  `;
  header.innerHTML = `⚠️ SCREEN CONTAMINATED BY BARBOD'S SCAM DUST!<br><span style="color:#94a3b8; font-size:0.78rem; font-weight:500;">👉 Use your mouse or finger to swipe and wipe the gray dust smudges off the glass!</span>`;
  overlay.appendChild(header);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position: absolute; inset: 0; z-index: 1;
    cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='16' cy='16' r='12' fill='rgba(255,255,255,0.2)' stroke='white' stroke-width='2'/></svg>") 16 16, auto;
  `;
  const w = canvas.width = window.innerWidth;
  const h = canvas.height = window.innerHeight;
  overlay.appendChild(canvas);

  const footer = document.createElement('button');
  footer.type = 'button';
  footer.style.cssText = `
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 9999px;
    padding: 10px 24px;
    color: #fff;
    font-weight: 800;
    font-size: 0.85rem;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
    transition: transform 0.1s ease;
    z-index: 10;
    position: relative;
  `;
  footer.textContent = '💨 Use Bux Blower (1,000 Bux) ◉';
  footer.onclick = () => {
    const cost = 1000;
    if (typeof spendBux === 'function' && spendBux(cost)) {
      if (typeof recordEconomyChange === 'function') {
        recordEconomyChange(-cost, 'Used Bux Blower to clear Scam Dust');
      }
      fadeOutAndRemove();
    } else {
      if (typeof Sound !== 'undefined' && Sound.buzzer) Sound.buzzer();
      showToast('❌ Not enough Bux! You must wipe the dust with your fingers!', 3500);
    }
  };
  overlay.appendChild(footer);

  document.body.appendChild(overlay);

  const ctx = canvas.getContext('2d');
  const DUST_STORAGE_KEY = 'mehrbod_scam_dust_particles_v2';
  let particles = [];
  const debris = [];

  try {
    const raw = localStorage.getItem(DUST_STORAGE_KEY);
    if (raw) {
      particles = JSON.parse(raw);
    }
  } catch (e) {}

  if (!particles || !particles.length) {
    // Generate 600 dust particles (WAY more dust!)
    for (let i = 0; i < 600; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 5 + Math.random() * 25,
        alpha: 0.45 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? '#52525b' : '#71717a',
        wiped: false
      });
    }
    try {
      localStorage.setItem(DUST_STORAGE_KEY, JSON.stringify(particles));
    } catch (e) {}
  }

  // --- Highly Optimized Cached Offscreen Buffer Drawing ---
  const bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = w;
  bufferCanvas.height = h;
  const bCtx = bufferCanvas.getContext('2d');

  function drawDustToBuffer() {
    bCtx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      if (!p.wiped) {
        bCtx.save();
        bCtx.beginPath();
        bCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        const grad = bCtx.createRadialGradient(p.x, p.y, p.r * 0.25, p.x, p.y, p.r);
        grad.addColorStop(0, `rgba(113, 113, 122, ${p.alpha})`);
        grad.addColorStop(0.5, `rgba(113, 113, 122, ${p.alpha * 0.6})`);
        grad.addColorStop(1, 'rgba(113, 113, 122, 0)');
        bCtx.fillStyle = grad;
        bCtx.fill();
        bCtx.restore();
      }
    });
  }

  // Pre-render the initial static dust smudges
  drawDustToBuffer();

  let animationId = null;

  function render() {
    ctx.clearRect(0, 0, w, h);

    // Fast Single Call Bitmap Transfer instead of 600 costly loops
    ctx.drawImage(bufferCanvas, 0, 0);

    // Draw little floating debris (dynamic sparks only)
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.12; // gravity
      d.life -= 1;
      if (d.life <= 0) {
        debris.splice(i, 1);
      } else {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(161, 161, 170, ${d.life / 30})`;
        ctx.fill();
      }
    }

    let activeCount = 0;
    particles.forEach(p => { if (!p.wiped) activeCount++; });

    if (activeCount / particles.length < 0.08) {
      fadeOutAndRemove();
    } else {
      // Loop Suspend Optimizer: Pause frame renders when static and idle
      if (debris.length > 0 || isWiping) {
        animationId = requestAnimationFrame(render);
      } else {
        animationId = null;
      }
    }
  }

  function fadeOutAndRemove() {
    if (animationId) cancelAnimationFrame(animationId);
    overlay.style.opacity = '0';
    try {
      localStorage.removeItem(DUST_STORAGE_KEY);
    } catch (e) {}
    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
    showToast('✨ Screen cleaned successfully!');
    setTimeout(() => {
      overlay.remove();
    }, 500);
  }

  let isWiping = false;
  let lastWipeTime = 0;

  function handleWipe(clientX, clientY) {
    const brushRadius = 38;
    let didWipeAny = false;

    // Use fast squared distance comparison (no Math.sqrt!) to avoid math locks
    const r2 = brushRadius * brushRadius;
    particles.forEach(p => {
      if (!p.wiped) {
        const dx = clientX - p.x;
        const dy = clientY - p.y;
        if (dx * dx + dy * dy < r2) {
          p.wiped = true;
          didWipeAny = true;

          // Spawn floating sparks
          for (let k = 0; k < 2; k++) {
            debris.push({
              x: p.x + (Math.random() - 0.5) * 15,
              y: p.y + (Math.random() - 0.5) * 15,
              vx: (Math.random() - 0.5) * 3,
              vy: -1 - Math.random() * 2,
              size: 1 + Math.random() * 2,
              life: 20 + Math.random() * 15
            });
          }
        }
      }
    });

    // INSTANT GRAPHICS BOOSTER: Erase directly from the offscreen canvas in 0.01 milliseconds
    // using hardware-accelerated destination-out composite operation! No more loops!
    bCtx.save();
    bCtx.globalCompositeOperation = 'destination-out';
    bCtx.beginPath();
    bCtx.arc(clientX, clientY, brushRadius, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.restore();

    if (didWipeAny) {
      const now = Date.now();
      if (now - lastWipeTime > 90) {
        lastWipeTime = now;
        playWipeSound();
      }

      try {
        localStorage.setItem(DUST_STORAGE_KEY, JSON.stringify(particles));
      } catch (e) {}

      // Restart frame renderer if paused
      if (animationId === null) {
        animationId = requestAnimationFrame(render);
      }
    } else {
      // Force redraw of dynamic elements (sparks/debris) on wipe movements
      if (animationId === null) {
        animationId = requestAnimationFrame(render);
      }
    }
  }

  function playWipeSound() {
    if (typeof Sound === 'undefined') return;
    const c = Sound.ensureCtx ? Sound.ensureCtx() : (window.ctx || new (window.AudioContext || window.webkitAudioContext)());
    if (!c || Sound.muted) return;
    try {
      const bufferSize = c.sampleRate * 0.06;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.03 * (1 - i / bufferSize);
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, c.currentTime);
      filter.Q.setValueAtTime(2.5, c.currentTime);
      src.connect(filter).connect(c.destination);
      src.start();
    } catch (e) {}
  }

  overlay.addEventListener('mousedown', (e) => {
    isWiping = true;
    handleWipe(e.clientX, e.clientY);
  });
  overlay.addEventListener('mousemove', (e) => {
    if (isWiping) handleWipe(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => { isWiping = false; });

  overlay.addEventListener('touchstart', (e) => {
    isWiping = true;
    const touch = e.touches[0];
    handleWipe(touch.clientX, touch.clientY);
  });
  overlay.addEventListener('touchmove', (e) => {
    if (isWiping) {
      const touch = e.touches[0];
      handleWipe(touch.clientX, touch.clientY);
    }
  });
  window.addEventListener('touchend', () => { isWiping = false; });

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    bufferCanvas.width = window.innerWidth;
    bufferCanvas.height = window.innerHeight;
    drawDustToBuffer();
    if (animationId === null) {
      animationId = requestAnimationFrame(render);
    }
  });

  render();
}

// Auto-reinitialize persistent scam dust on startup if active
(function initPersistentScamDust() {
  try {
    if (localStorage.getItem('mehrbod_scam_dust_particles_v2')) {
      setTimeout(() => triggerBarbodDustEffect(), 1500);
    }
  } catch (e) {}
})();





