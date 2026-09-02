/* ============================================================
   JUICE PASS — loaded after main.js, so the overrides below replace
   the plain versions of buyCardPack() and playMeteorShowerEffect()
   for every future call (both are ordinary function declarations,
   so re-assigning them on window changes what every other part of
   the app calls too). Also adds a general button-ripple pass and a
   brand new Daily Login Reward progression system.
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
      setTimeout(() => { el.classList.add('landed'); }, 60 * i);
      const flipDelay = 480 + i * 560;
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
    const totalDelay = 480 + cards.length * 560 + 300;
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

// Overrides buyCardPack() from main.js with the exact same logic, but
// routing the actual reveal through the pack-opening flow above instead of
// an instant toast. The "collection already complete -> refund" branch is
// left as a simple toast since there is nothing to open in that case.
function buyCardPack() {
  if (!spendBux(PACK_COST)) { showToast("You don't have enough Mehrbod Bux for a pack (you always keep at least 10)."); return; }
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
    addBux(PACK_COST);
    showToast('🎉 Your collection is already complete! Refunded your Bux.', 2800);
    return;
  }
  const granted = pool.slice(0, 2);
  granted.forEach(g => {
    if (g.kind === 'unit') col.units.push(g.id);
    else if (g.kind === 'spell') col.spells.push(g.id);
    else col.chips.push(g.id);
  });
  saveCollection(col);
  updateThemeButtons();
  checkAchievements();

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
    showToast(`🎁 Pack opened: ${names.join(', ')}!`, 3200);
  });
}

/* ---------- Meteor Shower rework: longer, denser, ground impacts, and a
   bigger multi-pulse camera shake. ---------- */
function playMeteorShowerEffect(onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'meteor-shower-overlay';
  document.body.appendChild(overlay);

  const count = reducedMotion ? 0 : 34;
  for (let i = 0; i < count; i++) {
    const m = document.createElement('div');
    m.className = 'meteor-streak';
    const startLeft = Math.random() * 130 - 20;
    const scale = 0.55 + Math.random() * 1.15;
    const delay = Math.random() * 2.0;
    const dur = 0.75 + Math.random() * 0.7;
    m.style.left = startLeft + '%';
    m.style.animationDelay = delay + 's';
    m.style.animationDuration = dur + 's';
    m.style.setProperty('--meteor-scale', String(scale));
    overlay.appendChild(m);

    // A ground impact flash roughly where each meteor's fall trajectory
    // lands, timed just after that streak finishes falling.
    const impact = document.createElement('div');
    impact.className = 'meteor-impact';
    impact.style.left = Math.min(96, Math.max(2, startLeft + 55)) + '%';
    impact.style.animationDelay = (delay + dur * 0.94) + 's';
    overlay.appendChild(impact);
  }

  Sound.meteor();
  if (typeof vibrate === 'function') vibrate([50, 30, 50, 30, 80, 40, 90]);

  // A second, deeper boom partway through sells the "bigger" shower.
  setTimeout(() => { if (typeof Sound.meteorBoom === 'function') Sound.meteorBoom(); }, 1400);

  if (!reducedMotion) {
    const screenEl = document.getElementById('screen-game');
    if (screenEl) {
      const shakeAt = [0, 750, 1550, 2350];
      shakeAt.forEach(t => setTimeout(() => {
        screenEl.classList.remove('screen-shake-big');
        void screenEl.offsetWidth; // restart the animation each pulse
        screenEl.classList.add('screen-shake-big');
      }, t));
      setTimeout(() => screenEl.classList.remove('screen-shake-big'), 3300);
    }
  }

  const duration = reducedMotion ? 150 : 3200; // roughly double the original ~1550ms
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
   NEW PROGRESSION SYSTEM: Daily Login Rewards
   A classic "come back tomorrow" retention loop, separate from the
   existing Daily Challenge (which requires actually finishing a
   match). Just opening the app on a new calendar day is enough to
   claim that day's reward. Rewards escalate across a 7-day cycle
   and loop back to Day 1 after Day 7's bonus - missing a day resets
   the cycle to Day 1 (but the all-time best streak is kept for
   bragging rights). Fully local (localStorage), no server needed,
   same pattern as the existing Daily Challenge / achievements code.
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
// The cycle day that WOULD be claimed right now (1-7), without claiming it.
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
  if (nextDay === 7) unlockAchievement && checkAchievements();
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
    updateDailyLoginBadge();
    renderDailyLoginModal();
  });

  updateDailyLoginBadge();
}
function openDailyLoginModal() { renderDailyLoginModal(); }

function updateDailyLoginBadge() {
  const badge = document.getElementById('daily-login-footer-badge');
  if (badge) badge.classList.toggle('hidden', isDailyLoginClaimedToday());
}

function ensureDailyLoginFooterButton() {
  const footer = document.querySelector('#screen-menu .menu-footer');
  if (!footer || document.getElementById('btn-daily-login')) return;
  const btn = document.createElement('button');
  btn.className = 'link-btn';
  btn.id = 'btn-daily-login';
  btn.innerHTML = `🎁 Daily<span id="daily-login-footer-badge" class="new-badge">!</span>`;
  btn.addEventListener('click', () => openDailyLoginModal());
  const dot = document.createElement('span');
  dot.className = 'footer-dot';
  dot.textContent = '·';
  footer.insertBefore(dot, footer.firstChild);
  footer.insertBefore(btn, footer.firstChild);
  updateDailyLoginBadge();
}

// Auto-popup once per day, but only after the first-run tutorial has
// already been seen (so a brand new player gets the tutorial uninterrupted
// and meets the daily reward loop starting their second visit), and only
// while the main menu is actually the screen on display.
function maybeAutoShowDailyLogin() {
  if (!hasTutorialBeenSeen()) return;
  if (isDailyLoginClaimedToday()) return;
  const menuEl = document.getElementById('screen-menu');
  if (!menuEl || menuEl.classList.contains('hidden')) return;
  openDailyLoginModal();
}

// Keep the footer badge fresh whenever the player lands back on the menu
// (e.g. after finishing a match), without needing to touch main.js.
(function wrapShowScreenForDailyLogin() {
  const original = window.showScreen;
  if (typeof original !== 'function') return;
  window.showScreen = function (id) {
    original(id);
    if (id === 'screen-menu') updateDailyLoginBadge();
  };
})();

ensureDailyLoginFooterButton();
setTimeout(maybeAutoShowDailyLogin, 900);
