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
   "own literally everything" Forge Milestone, so partial collectors
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
  if (menuCard && !menuCard.dataset.bound) {
    menuCard.dataset.bound = 'true';
    menuCard.addEventListener('click', () => openTrialTowerScreen());
    if (typeof wirePressFeedback === 'function') wirePressFeedback(menuCard);
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
      if (trialTowerActive) resolveTrialTowerMatch(won);
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
    document.getElementById('quests-overlay')?.remove();
    openTrialTowerScreen();
  });

  document.getElementById('btn-do-prestige')?.addEventListener('click', () => doPrestige());
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
      checkAchievements();
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
    checkAchievements();
    updateThemeButtons();
    showToast('🎉 Code redeemed! Everything unlocked + 1,000,000 Bux.', 3800);
    Sound.sparkle();
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
    checkAchievements();
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

THEME_UNLOCK_CHECK.valentine = () => isValentineThemeUnlocked();
THEME_LOCK_MESSAGE.valentine = "💘 This one's a secret - you'll need the right code.";
if (!ALL_THEME_NAMES.includes('valentine')) ALL_THEME_NAMES.push('valentine');
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

      <section class="modern-shop-section">
        <div class="modern-shop-section-head">
          <div>
            <span class="modern-shop-section-kicker">MEHRBOD SHOP</span>
            <h3>Codes</h3>
            <p>Got a code from an event, a friend, or somewhere else? Redeem it here.</p>
          </div>
        </div>
        <div class="shop-code-row">
          <input type="text" id="shop-code-input" placeholder="Enter code..." maxlength="40" autocapitalize="none" autocomplete="off">
          <button type="button" class="primary-btn" id="shop-code-redeem-btn">Redeem</button>
        </div>
      </section>

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
  if (document.getElementById('profile-avatar-btn')) { updateProfileAvatar(); return; }
  const buxCounter = document.getElementById('bux-counter');
  if (!buxCounter || !buxCounter.parentNode) return;

  // Create top-left wrapper for profile avatar
  let leftWrapper = document.getElementById('top-left-hud');
  if (!leftWrapper) {
    leftWrapper = document.createElement('div');
    leftWrapper.id = 'top-left-hud';
    document.body.appendChild(leftWrapper);
  }

  const avatarBtn = document.createElement('button');
  avatarBtn.id = 'profile-avatar-btn';
  avatarBtn.setAttribute('aria-label', 'Open your profile');
  avatarBtn.innerHTML = `<span id="profile-avatar-letter"></span><span id="profile-prestige-badge" class="profile-exclaim hidden">!</span>`;
  avatarBtn.addEventListener('click', () => openProfilePanel());
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
        <div class="profile-stat-row">
          <div class="profile-stat-pill"><b>${battle.wins}</b><span>Wins</span></div>
          <div class="profile-stat-pill"><b>${battle.losses}</b><span>Losses</span></div>
          <div class="profile-stat-pill"><b>${winRate}%</b><span>Win Rate</span></div>
          <div class="profile-stat-pill"><b>${battle.streak}</b><span>Streak</span></div>
          <div class="profile-stat-pill"><b>${battle.bestStreak}</b><span>Best Streak</span></div>
          <div class="profile-stat-pill"><b>${battle.biggestWin}</b><span>Biggest Win</span></div>
        </div>

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

        <div class="profile-section-heading">📜 Match History</div>
        <div class="ledger-list">
          ${historyItems.length ? historyItems.slice(0, 10).map(x => `
            <div class="${x.result === 'Win' ? 'gain' : (x.result === 'Loss' ? 'loss' : '')}">
              <b>${x.result === 'Win' ? '🏆 Win' : x.result === 'Loss' ? '💀 Loss' : '🤝 Draw'}</b>
              <span>${escapePresetText(x.mode)} · ${x.rounds} round${x.rounds === 1 ? '' : 's'} · ${formatDuration(x.duration)}</span>
              <small>${new Date(x.at).toLocaleString()}</small>
            </div>`).join('') : '<p class="activity-empty">Finish a match to start building your history.</p>'}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

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
}

removeOldStatsFooterButton();
ensureProfileHud();
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
  const unlockAllBtn = document.getElementById('btn-secret-unlock-all-themes');
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
      const allUnitIds = [2, 3, 4].flatMap(tier => (typeof UNIT_ARCHETYPES !== 'undefined' && UNIT_ARCHETYPES[tier] ? UNIT_ARCHETYPES[tier].map(a => a.id) : []));
      const allSpellIds = (typeof SPELL_DEFS !== 'undefined') ? SPELL_DEFS.map(s => s.id) : [];
      const allChipIds = (typeof CHIP_DEFS !== 'undefined') ? CHIP_DEFS.map(c => c.id) : [];

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
        showToast('🃏 All Cards, Spells & Chips Unlocked (100% Collection)!', 4500);
      }

      if (execResult) {
        execResult.textContent = '✔ SUCCESS: All Units (Green/Red/Orange), Spells, and Chips unlocked! (100% Complete Collection)';
        execResult.className = 'secret-exec-result success';
        execResult.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Unlock all cards error:', err);
    }
  });

  unlockAllBtn?.addEventListener('click', () => {
    // Permanently unlock all themes in local storage
    try {
      localStorage.setItem('mehrbod_all_themes_unlocked', 'true');
      localStorage.setItem('theme_quantum_unlocked', 'true');
      localStorage.setItem('theme_glacier_unlocked', 'true');
      localStorage.setItem('theme_astral_unlocked', 'true');
      localStorage.setItem('theme_celestial_unlocked', 'true');

      // Also ensure cosmetics array contains shop themes so inventory is pristine
      const allShopThemes = ['theme_mrmoney', 'theme_cyberneon', 'theme_abyss', 'theme_magma'];
      const ownedCosmetics = JSON.parse(localStorage.getItem('mehrbod-cards-cosmetics') || '[]');
      allShopThemes.forEach(t => {
        if (!ownedCosmetics.includes(t)) ownedCosmetics.push(t);
      });
      localStorage.setItem('mehrbod-cards-cosmetics', JSON.stringify(ownedCosmetics));
    } catch (e) {}

    // Refresh UI & theme buttons
    if (typeof updateThemeButtons === 'function') updateThemeButtons();
    if (typeof fireConfetti === 'function') fireConfetti();
    if (typeof showToast === 'function') {
      showToast('✨ All Themes Unlocked! Enjoy your collection.', 4500);
    }

    if (execResult) {
      execResult.textContent = '✔ SUCCESS: All Themes have been unlocked & added to your collection!';
      execResult.className = 'secret-exec-result success';
      execResult.classList.remove('hidden');
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




