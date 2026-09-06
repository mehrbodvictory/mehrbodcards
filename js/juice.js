/* ============================================================
   JUICE PASS — loaded after main.js. Overrides a handful of ordinary
   function declarations (safe to do, since every caller looks them
   up by name at call time) and adds new systems on top:
     - Pack opening flow (tear + flip reveal)
     - Reworked Meteor Shower (real crashing/exploding rock meteors)
     - Cosmetic reworks (Void Sleeves, Cyber Neon, Abyss, Diamond Vault)
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
      <div class="packopen-pack" id="packopen-pack">
        <div class="packopen-pack-shine"></div>
        <div class="packopen-pack-label">MEHRBOD<br>CARD PACK</div>
        <div class="packopen-tap-hint">Tap to open</div>
      </div>
      <div class="packopen-cards"></div>
      <button type="button" class="primary-btn packopen-continue hidden">Continue</button>
    </div>`;
  document.body.appendChild(overlay);

  const pack = overlay.querySelector('#packopen-pack');
  const cardsRow = overlay.querySelector('.packopen-cards');
  const continueBtn = overlay.querySelector('.packopen-continue');

  const tierClass = (c) => c.kind === 'unit' ? ('tier' + c.tier) : (c.kind === 'spell' ? 'sc-spell' : 'sc-chip');
  const tierName = (c) => c.kind === 'unit' ? (TIERS[c.tier] ? TIERS[c.tier].name : '') : (c.kind === 'spell' ? 'Spell' : 'Chip');

  let opened = false;
  function tearPack() {
    if (opened) return;
    opened = true;
    Sound.packTear();
    pack.classList.add('tearing');
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'packopen-shred';
      p.style.setProperty('--a', (Math.random() * 360) + 'deg');
      p.style.setProperty('--d', (40 + Math.random() * 90) + 'px');
      p.style.animationDelay = (Math.random() * 0.08) + 's';
      pack.appendChild(p);
    }
    if (typeof vibrate === 'function') vibrate([20, 15, 30]);
    setTimeout(() => {
      pack.remove();
      revealCards();
    }, 480);
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
      setTimeout(() => { el.classList.add('landed'); }, 50 * i);
      const flipDelay = 420 + i * 460;
      setTimeout(() => {
        el.classList.add('flipped');
        if (c.tier === 4) Sound.packRareFlip(); else Sound.packCardFlip();
        if (typeof vibrate === 'function') vibrate(15);
        const burst = document.createElement('div');
        burst.className = 'packopen-burst';
        el.appendChild(burst);
        setTimeout(() => burst.remove(), 700);
      }, flipDelay);
    });
    const totalDelay = 420 + cards.length * 460 + 260;
    setTimeout(() => {
      continueBtn.classList.remove('hidden');
      Sound.sparkle();
    }, totalDelay);
  }

  pack.addEventListener('click', tearPack);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (!opened) { tearPack(); return; }
      overlay.remove();
      if (onDone) onDone();
    }
  });
  continueBtn.addEventListener('click', () => {
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
  checkAchievements();
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

function playMeteorShowerEffect(onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'meteor-shower-overlay';
  document.body.appendChild(overlay);

  const count = reducedMotion ? 0 : 26;
  for (let i = 0; i < count; i++) {
    const startLeft = Math.random() * 130 - 20;
    const scale = 0.65 + Math.random() * 1.05;
    const delay = Math.random() * 2.1;
    const dur = 0.95 + Math.random() * 0.7;
    const endLeft = startLeft + 55;

    const unit = document.createElement('div');
    unit.className = 'meteor-unit';
    unit.style.left = startLeft + '%';
    unit.style.animationDelay = delay + 's';
    unit.style.animationDuration = dur + 's';
    unit.style.setProperty('--meteor-scale', String(scale));
    unit.innerHTML = `<div class="meteor-tail"></div><div class="meteor-rock"></div>`;
    overlay.appendChild(unit);

    setTimeout(() => {
      unit.remove();
      if (overlay.isConnected) spawnMeteorExplosion(overlay, endLeft);
    }, (delay + dur) * 1000);
  }

  Sound.meteor();
  if (typeof vibrate === 'function') vibrate([50, 30, 50, 30, 80, 40, 90]);
  setTimeout(() => { if (typeof Sound.meteorBoom === 'function') Sound.meteorBoom(); }, 1500);

  if (!reducedMotion) {
    const screenEl = document.getElementById('screen-game');
    if (screenEl) {
      const shakeAt = [0, 800, 1650, 2500];
      shakeAt.forEach(t => setTimeout(() => {
        screenEl.classList.remove('screen-shake-big');
        void screenEl.offsetWidth; // restart the animation each pulse
        screenEl.classList.add('screen-shake-big');
      }, t));
      setTimeout(() => screenEl.classList.remove('screen-shake-big'), 3400);
    }
  }

  const duration = reducedMotion ? 150 : 3300;
  setTimeout(() => {
    overlay.remove();
    if (onDone) onDone();
  }, duration);
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
  if (!hasTutorialBeenSeen()) return;
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
const PLAYER_XP_KEY = 'mehrbod_player_xp_v1';
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

/* ---------- Progression hooks: wrap existing single-purpose functions so
   Player Level / Weekly Vault points accrue from real play, without
   touching the core rules engine in game.js. ---------- */
(function wireProgressionHooks() {
  const _origRecordResult = window.recordResult;
  if (typeof _origRecordResult === 'function') {
    window.recordResult = function (won) {
      _origRecordResult(won);
      grantPlayerXP(won ? 25 : 8);
      if (won) grantWeeklyPoints(10);
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
})();

/* ---------- Progression UI: appended into the existing Quests panel ----- */
function renderProgressionExtras() {
  const list = document.getElementById('quests-list');
  if (!list) return;

  const xp = loadPlayerXP();
  const info = playerLevelFromXP(xp);
  const pct = Math.round((info.into / info.need) * 100);
  const levelHtml = `
    <div class="deck-builder-heading" style="margin-top:18px;"><span>⭐ Player Level</span><span>Lv ${info.level}</span></div>
    <div class="quest-row" style="flex-direction:column; align-items:stretch; gap:4px;">
      <div class="quest-desc">${info.into}/${info.need} XP to Level ${info.level + 1} — earned from wins, packs, dailies, and milestones</div>
      <div class="challenge-progress-track"><div class="challenge-progress-fill" style="width:${pct}%"></div></div>
    </div>`;

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

  list.insertAdjacentHTML('beforeend', levelHtml + vaultHtml);
  list.querySelectorAll('[data-claim-vault]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.claimVault);
      const reward = claimWeeklyVaultTier(idx);
      if (reward) {
        showToast(`🗝️ Weekly Vault tier claimed! +${reward} Bux`, 2600);
        Sound.sparkle();
        renderQuests();
      }
    });
  });
}
(function wrapRenderQuestsForProgression() {
  const original = window.renderQuests;
  if (typeof original !== 'function') return;
  window.renderQuests = function () {
    original();
    renderProgressionExtras();
  };
})();

/* ============================================================
   MEHRBOD SHOP REWORK: tabs removed. Instead, three always-visible
   sections rotate daily (deterministically, so both a page reload and
   every other player see the same picks on the same calendar day):
   6 Cosmetics, 6 Card Packs (fixed sizes, not rotated - the sizes
   themselves ARE the variety), and 6 Individual Cards you can buy
   outright without RNG.
   ============================================================ */
const SHOP_PACK_SIZES = [
  { id: 'pack_mini',     name: 'Mini Pack',     count: 1,  cost: 12,  art: '🎴' },
  { id: 'pack_small',    name: 'Small Pack',    count: 2,  cost: 20,  art: '🎁' },
  { id: 'pack_standard', name: 'Standard Pack', count: 3,  cost: 32,  art: '📦' },
  { id: 'pack_large',    name: 'Large Pack',    count: 5,  cost: 55,  art: '🧧' },
  { id: 'pack_mega',     name: 'Mega Pack',     count: 8,  cost: 90,  art: '💼' },
  { id: 'pack_ultra',    name: 'Ultra Pack',    count: 12, cost: 140, art: '🏆' },
];

function individualCardPrice(kind, tier) {
  if (kind === 'unit') return tier === 4 ? 200 : tier === 3 ? 130 : 80;
  return 60; // spell or chip
}

function buildTodaysShopPicks() {
  const seed = dayIndexSeed();
  const cosmeticIds = seededPick(COSMETIC_ITEMS.map(c => c.id), seed, 6);

  const cardPool = [];
  ALL_NONBLUE_UNIT_IDS.forEach(id => {
    const a = findArchetypeById(id);
    if (a) cardPool.push({ id, kind: 'unit', tier: a.tier, name: a.name, cost: individualCardPrice('unit', a.tier) });
  });
  ALL_SPELL_IDS.forEach(id => {
    const d = SPELL_DEFS.find(s => s.id === id);
    if (d) cardPool.push({ id, kind: 'spell', tier: null, name: d.name, cost: individualCardPrice('spell') });
  });
  ALL_CHIP_IDS.forEach(id => {
    const d = CHIP_DEFS.find(c => c.id === id);
    if (d) cardPool.push({ id, kind: 'chip', tier: null, name: d.name, cost: individualCardPrice('chip') });
  });
  const cardIdxs = seededPick(cardPool.map((_, i) => i), seed + 777, 6);
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
  checkAchievements();
  grantPlayerXP(10);
  grantWeeklyPoints(8);
  showToast(`🃏 Added ${entry.name} to your collection!`, 2400);
  Sound.sparkle();
  renderCosmeticsShop();
}

function renderCosmeticsShop() {
  const list = document.getElementById('shop-cosmetics-list');
  if (!list) return;

  const balance = loadBux();
  const owned = loadOwnedCosmetics();
  const equippedSleeve = loadEquippedSleeve();
  const picks = buildTodaysShopPicks();

  const cosmeticArt = { theme: '🎨', sleeve: '🃏', effect: '✨', victoryAnim: '☄️' };
  const cosmeticItems = picks.cosmeticIds.map(id => COSMETIC_ITEMS.find(c => c.id === id)).filter(Boolean);

  const cosmeticCard = (item) => {
    const isOwned = ownsCosmetic(item.id);
    const isEquipped = item.kind === 'sleeve' && equippedSleeve === item.id;
    const button = isOwned
      ? (isEquipped ? 'EQUIPPED' : item.kind === 'sleeve' ? 'EQUIP' : 'OWNED')
      : `${item.cost.toLocaleString()} BUX`;
    return `
      <article class="modern-shop-card ${isOwned ? 'is-owned' : ''}">
        <button class="modern-shop-art" data-shop-buy="cosmetic:${item.id}" data-kind="${item.kind}">
          <span class="modern-shop-art-glow"></span>
          <span class="modern-shop-art-symbol">${cosmeticArt[item.kind] || '★'}</span>
        </button>
        <div class="modern-shop-card-body">
          <div class="modern-shop-card-name">${item.name}</div>
          <div class="modern-shop-card-desc">${item.desc}</div>
          <div class="modern-shop-card-bottom">
            <div class="modern-shop-price">
              ${isOwned ? '<span class="owned-label">OWNED</span>' : `<strong>◉ ${item.cost.toLocaleString()}</strong><small>BUX</small>`}
            </div>
            <button class="modern-shop-buy ${isOwned ? 'owned' : ''}" data-shop-buy="cosmetic:${item.id}">${button}</button>
          </div>
        </div>
      </article>`;
  };

  const packCard = (p) => `
    <article class="modern-shop-card">
      <button class="modern-shop-art" data-shop-buy="pack:${p.id}" data-kind="pack">
        <span class="modern-shop-art-glow"></span>
        <span class="modern-shop-art-symbol">${p.art}</span>
        <span class="modern-shop-ribbon">${p.count} CARD${p.count > 1 ? 'S' : ''}</span>
      </button>
      <div class="modern-shop-card-body">
        <div class="modern-shop-card-name">${p.name}</div>
        <div class="modern-shop-card-desc">Unlocks ${p.count} new spell, chip, or unit card${p.count > 1 ? 's' : ''} you don't already own.</div>
        <div class="modern-shop-card-bottom">
          <div class="modern-shop-price"><strong>◉ ${p.cost.toLocaleString()}</strong><small>BUX</small></div>
          <button class="modern-shop-buy" data-shop-buy="pack:${p.id}">OPEN</button>
        </div>
      </div>
    </article>`;

  const cardEntryCard = (entry) => {
    const isOwned = isIndividualCardOwned(entry);
    const tierLabel = entry.kind === 'unit' ? (TIERS[entry.tier] ? TIERS[entry.tier].name : '') : (entry.kind === 'spell' ? 'Spell' : 'Chip');
    return `
      <article class="modern-shop-card ${isOwned ? 'is-owned' : ''}">
        <button class="modern-shop-art" data-shop-buy="card:${entry.kind}:${entry.id}" data-kind="card">
          <span class="modern-shop-art-glow"></span>
          <span class="modern-shop-art-symbol">${TIER_GLYPHS && entry.tier ? (TIER_GLYPHS[entry.tier] || '🃏') : '🃏'}</span>
        </button>
        <div class="modern-shop-card-body">
          <div class="modern-shop-card-name">${entry.name}</div>
          <div class="modern-shop-card-desc">${tierLabel} · buy it directly, no randomness.</div>
          <div class="modern-shop-card-bottom">
            <div class="modern-shop-price">
              ${isOwned ? '<span class="owned-label">OWNED</span>' : `<strong>◉ ${entry.cost.toLocaleString()}</strong><small>BUX</small>`}
            </div>
            <button class="modern-shop-buy ${isOwned ? 'owned' : ''}" data-shop-buy="card:${entry.kind}:${entry.id}">${isOwned ? 'OWNED' : `${entry.cost.toLocaleString()} BUX`}</button>
          </div>
        </div>
      </article>`;
  };

  const section = (title, sub, html) => `
    <section class="modern-shop-section">
      <div class="modern-shop-section-head">
        <div>
          <span class="modern-shop-section-kicker">MEHRBOD SHOP</span>
          <h3>${title}</h3>
          <p>${sub}</p>
        </div>
      </div>
      <div class="modern-shop-grid">${html}</div>
    </section>`;

  list.innerHTML = `
    <div class="modern-shop">
      <header class="modern-shop-header">
        <div>
          <span class="modern-shop-kicker">TODAY'S SELECTION</span>
          <h2>ITEM SHOP</h2>
        </div>
        <div class="modern-shop-wallet">
          <span class="modern-shop-wallet-icon">◉</span>
          <strong>${balance.toLocaleString()}</strong>
          <span>BUX</span>
        </div>
      </header>

      <div class="modern-shop-refresh">
        <span>TODAY'S PICKS REFRESH IN</span>
        <strong id="modern-shop-countdown">23:59:59</strong>
      </div>

      ${section('Cosmetics', "Today's rotating cosmetic picks - a new six every day.", cosmeticItems.map(cosmeticCard).join(''))}
      ${section('Card Packs', 'Six fixed pack sizes, always available - pick how big a gamble you want.', SHOP_PACK_SIZES.map(packCard).join(''))}
      ${section('Individual Cards', "Today's six specific cards, buyable outright with no randomness.", picks.cards.map(cardEntryCard).join(''))}

      <div class="modern-shop-footer-note">
        <span>◉</span>
        Your Bux balance: <strong>${balance.toLocaleString()}</strong>
        <span>•</span>
        Purchases are permanent.
      </div>
    </div>`;

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

  list.querySelectorAll('[data-shop-buy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [kind, a, b] = btn.dataset.shopBuy.split(':');
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
}
