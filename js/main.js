
// ---- Global state ------------------------------------------------------
let state = null;
let mode = null;           // 'bot' | 'mp'
let localKey = null, remoteKey = null;
let botDifficulty = loadLastDifficulty() || 'Medium';
let botRng = null;
let botActedKey = null;
let net = null;
let pendingGuestDeckConfig = null; // deck config picked in the deck builder before joining a host

let selMode = null;        // 'defend' | 'merge' | 'spell' | 'chip' | null
let selHandIdx = null;
let selAttackerSlot = null;
let selSpellId = null;
let selChipId = null;
let selMergeSlots = [];    // NEW: board slots picked while in 'merge' (Combine) mode, in pick order - 2 to 4 of the player's own cards
let logVisible = false;
let suppressNextClick = false;
let gameOverAnnounced = false;
let animatingCombat = false;
let matchStartTime = null;
let botThinkingTimer = null;
let currentWager = 0; // Mehrbod Bux staked on the current match, if any
let shopSelectedWager = 0;     // wager amount picked on the "Wager vs Bot" screen
let shopHostSelectedWager = 0; // wager amount picked on the "Host a Wagered Match" screen
// NEW: Victory Animations - `matchVictoryAnims` maps each player's key (e.g.
// 'you'/'bot' or 'host'/'guest') to the victory-animation cosmetic they had
// equipped when THIS match started ('meteor' or null/undefined). It's
// populated from each side's deckConfig, which already gets exchanged over
// the network during match setup - see beginHost()/join's onInit below -
// so both peers know which animation to play for the eventual winner even
// though cosmetic ownership itself is only ever stored locally per device.
// `meteorShowerDone` guards the shared celebration to at most once per match.
let matchVictoryAnims = {};
let meteorShowerDone = false;
let epicVictoryDone = false;
const _lowHpWarned = new Set(); // card ids we've already played the low-hp warning tone for
const COMBAT_ANIM_MS = 900;
const BOT_THINK_MS_MIN = 450, BOT_THINK_MS_MAX = 900;
const THEME_UNLOCK_CHECK = {};

function setMatchInfo(desktopText, mobileText) {
  const topBarInfo = document.getElementById('top-bar-info');
  if (topBarInfo) {
    topBarInfo.dataset.desktopText = desktopText;
    topBarInfo.dataset.mobileText = mobileText || desktopText;
    topBarInfo.textContent = window.innerWidth <= 768 ? topBarInfo.dataset.mobileText : topBarInfo.dataset.desktopText;
  }
}
window.addEventListener('resize', () => {
  const topBarInfo = document.getElementById('top-bar-info');
  if (topBarInfo && topBarInfo.dataset.desktopText) {
    topBarInfo.textContent = window.innerWidth <= 768 ? topBarInfo.dataset.mobileText : topBarInfo.dataset.desktopText;
  }
});

// ---- NEW FEATURE: Undo Last Placement --------------------------------------
// Single-level undo, local vs-bot matches only (skipped in multiplayer,
// since an undone action was already broadcast to and applied by the other
// side, and there's no way to un-send that). Deliberately scoped to ONLY
// placements, never merges: every placeable card is always Blue with
// ability 'none' (see cards.js), so undoing a placement can never need to
// unwind an ability side-effect (damage dealt, a card healed, a chip
// discarded, etc.) - it's purely "take this card back off the board",
// always perfectly safe to reverse. A merge's result can carry a real
// on-play ability that already fired, so merges are intentionally never
// undoable here.
let lastPlacement = null; // { slot } for the most recent successful local placement this round

// ---- NEW FEATURE: Battle Report (MVP card) ---------------------------------
// Tracks how much damage each of the local player's own cards dealt (and
// how many kills they landed) over the course of a match, purely for a fun
// "MVP" callout on the game-over screen - not persisted, not synced, reset
// at the start of every match.
let matchCardStats = {}; // cardName -> { dmg, kills }
function resetMatchCardStats() { matchCardStats = {}; }
function trackDamageStats(fxList) {
  (fxList || []).forEach(evt => {
    if (evt.type !== 'damage') return;
    if (!evt.source || evt.source.owner !== localKey) return;
    const name = evt.source.name || 'Unknown';
    if (!matchCardStats[name]) matchCardStats[name] = { dmg: 0, kills: 0 };
    matchCardStats[name].dmg += evt.amount || 0;
    if (evt.killed) matchCardStats[name].kills += 1;
  });
}

// ---- NEW FEATURE: Match Replays ------------------------------------------
let matchReplayData = null;
function initReplayLog(seed, p1id, p2id, deckConfigs) {
  matchReplayData = {
    seed,
    p1id,
    p2id,
    deckConfigs,
    actions: [],
    timestamp: Date.now()
  };
}
function logReplayAction(action) {
  if (matchReplayData) {
    matchReplayData.actions.push(action);
  }
}
function saveMatchReplay() {
  if (matchReplayData) {
    try {
      localStorage.setItem('mehrbod-cards-last-replay', JSON.stringify(matchReplayData));
    } catch (e) {
      console.error('Failed to save replay', e);
    }
  }
}

function loadReplayData() {
  try {
    const raw = localStorage.getItem('mehrbod-cards-last-replay');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

let replayInterval = null;
let currentReplayData = null;
let currentReplayIndex = 0;
let isReplayPlaying = false;
let replaySpeed = 1;

function cancelReplay() {
  if (replayInterval) {
    clearTimeout(replayInterval);
    replayInterval = null;
  }
  if (typeof combatAnimTimer !== 'undefined' && combatAnimTimer) {
    clearTimeout(combatAnimTimer);
    combatAnimTimer = null;
  }
  animatingCombat = false;
}

function renderReplayControls() {
  const controls = document.getElementById('replay-controls');
  if (!controls) return;
  if (mode !== 'replay') {
    controls.classList.add('hidden');
    return;
  }
  controls.classList.remove('hidden');
  document.getElementById('btn-replay-playpause').textContent = isReplayPlaying ? '⏸' : '▶';
  document.getElementById('replay-speed-label').textContent = replaySpeed + 'x';
}

function buildReplayState(upToIndex) {
  state = createMatch(currentReplayData.seed, currentReplayData.p1id, currentReplayData.p2id, currentReplayData.deckConfigs);
  resetMatchCardStats();
  const originalToast = window.showToast;
  window.showToast = () => {};
  for (let i = 0; i < upToIndex; i++) {
    const res = applyAction(state, currentReplayData.actions[i]);
    if (res && res.fx) trackDamageStats(res.fx);
  }
  window.showToast = originalToast;
  
  if (state.phase === 'gameover') state.phase = 'gameover_replay';
  render();
  if (state.phase === 'gameover_replay') state.phase = 'gameover';
}

function stepReplayForward(animate = false) {
  if (!currentReplayData || currentReplayIndex >= currentReplayData.actions.length) {
    isReplayPlaying = false;
    renderReplayControls();
    if (animate) showToast("Replay Finished!");
    return;
  }
  
  const action = currentReplayData.actions[currentReplayIndex];
  currentReplayIndex++;
  
  if (!animate) {
    buildReplayState(currentReplayIndex);
    return;
  }

  const isReadyAttack = action.type === 'readyAttack';
  const isChainLightning = action.type === 'spell' && action.spellId === 'chainlightning';
  const snapshot = (isReadyAttack || isChainLightning) ? snapshotBoards(state) : null;
  
  const originalToast = window.showToast;
  window.showToast = () => {};
  const res = applyAction(state, action);
  window.showToast = originalToast;
  
  if (res.ok) {
      if (action.type === 'place') Sound.place();
      else if (action.type === 'defend') Sound.defend();
      else if (action.type === 'merge') Sound.place();
  }
  
  if (state.phase === 'gameover') state.phase = 'gameover_replay'; 
  
  if (isChainLightning && res.ok && snapshot) {
    const realBoards = {};
    state.order.forEach(k => {
      realBoards[k] = state.players[k].board;
      state.players[k].board = snapshot[k].board;
    });
    render();
    state.order.forEach(k => { state.players[k].board = realBoards[k]; });
    playFx(res.fx);
    
    const activeCardCount = Object.values(snapshot).reduce((acc, p) => acc + (p.board || []).filter(Boolean).length, 0);
    const fxDelay = activeCardCount * 130 + 800;
    combatAnimTimer = setTimeout(() => {
      render();
      if (state.phase === 'gameover_replay') state.phase = 'gameover';
      if (isReplayPlaying) replayInterval = setTimeout(() => stepReplayForward(true), 800 / replaySpeed);
    }, fxDelay / replaySpeed);
  } else if (isReadyAttack && res.resolved) {
    playCombatAnimation(snapshot, res.fx || [], () => {
      render();
      if (state.phase === 'gameover_replay') state.phase = 'gameover';
      if (isReplayPlaying) replayInterval = setTimeout(() => stepReplayForward(true), 1000 / replaySpeed);
    }, replaySpeed);
  } else {
    render();
    if (res.ok) playFx(res.fx);
    if (state.phase === 'gameover_replay') state.phase = 'gameover';
    if (isReplayPlaying) replayInterval = setTimeout(() => stepReplayForward(true), 1200 / replaySpeed);
  }
}

function stepReplayBackward() {
  if (!currentReplayData || currentReplayIndex <= 0) return;
  currentReplayIndex--;
  buildReplayState(currentReplayIndex);
}

document.getElementById('btn-replay-prev').addEventListener('click', () => {
  if (typeof Sound !== 'undefined' && Sound.replayStep) Sound.replayStep();
  cancelReplay();
  isReplayPlaying = false;
  renderReplayControls();
  stepReplayBackward();
});
document.getElementById('btn-replay-next').addEventListener('click', () => {
  if (typeof Sound !== 'undefined' && Sound.replayStep) Sound.replayStep();
  cancelReplay();
  isReplayPlaying = false;
  renderReplayControls();
  stepReplayForward(false);
});
document.getElementById('btn-replay-playpause').addEventListener('click', () => {
  if (typeof Sound !== 'undefined' && Sound.replayStep) Sound.replayStep();
  if (isReplayPlaying) {
    isReplayPlaying = false;
    cancelReplay();
  } else {
    if (currentReplayIndex >= currentReplayData.actions.length) {
      currentReplayIndex = 0;
      buildReplayState(0);
    }
    isReplayPlaying = true;
    stepReplayForward(true);
  }
  renderReplayControls();
});
document.getElementById('replay-speed').addEventListener('input', (e) => {
  replaySpeed = parseFloat(e.target.value);
  document.getElementById('replay-speed-label').textContent = replaySpeed + 'x';
});

function watchLastReplay() {
  const data = loadReplayData();
  if (!data || !data.actions || data.actions.length === 0) {
    showToast("No recent replay found!");
    return;
  }
  
  mode = 'replay';
  tutorialActive = false;
  currentWager = 0;
  _lowHpWarned.clear();
  resetMatchCardStats();
  lastPlacement = null;
  cancelBotThinking();
  cancelReplay();
  
  currentReplayData = data;
  currentReplayIndex = 0;
  isReplayPlaying = true;
  replaySpeed = parseFloat(document.getElementById('replay-speed').value);
  
  localKey = data.p1id;
  remoteKey = data.p2id;
  
  resetSelections();
  showScreen('screen-game');
  setMatchInfo('▶ Match Replay', '▶ Replay');
  renderReplayControls();
  
  buildReplayState(0);
  replayInterval = setTimeout(() => stepReplayForward(true), 1000 / replaySpeed);
}

// ---- Screen management ---------------------------------------------------
function showScreen(id) {
  if (typeof Sound !== 'undefined' && Sound.screenTransition) Sound.screenTransition();
  if (id !== 'screen-game') {
    cancelReplay();
    mode = 'menu';
    const controls = document.getElementById('replay-controls');
    if (controls) controls.classList.add('hidden');
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  const buxCounter = document.getElementById('bux-counter');
  if (buxCounter) buxCounter.classList.toggle('hidden', id === 'screen-game');
  
  // Hide top-bar brand on main menu, but keep visible in matches and other screens
  const topBrand = document.querySelector('#top-bar .brand');
  if (topBrand) {
    const isMenu = (id === 'screen-menu');
    topBrand.style.visibility = isMenu ? 'hidden' : 'visible';
    topBrand.style.opacity = isMenu ? '0' : '1';
    topBrand.style.pointerEvents = isMenu ? 'none' : 'auto';
  }
}

// Explicit, per-element "pressed" feedback via Pointer Events instead of the
// CSS :active pseudo-class - guarantees only the exact button the user is
// touching/clicking ever gets the press effect, never its siblings.
function wirePressFeedback(el) {
  const press = () => {
    el.classList.add('pressed');
    if (typeof Sound !== 'undefined' && Sound.buttonPress && !el.classList.contains('no-sfx')) {
      Sound.buttonPress();
    }
  };
  const release = () => el.classList.remove('pressed');
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
}

// ---- Mehrbod Bux (in-app play currency) ------------------------------------
const STARTING_BUX = 50;
const WAGER_CAPS = Object.freeze({ Easy: 10, Medium: 25, Hard: 50, Expert: 100, Master: 200 });
const MAX_MULTIPLAYER_WAGER = 100;
function loadBux() {
  try {
    const raw = localStorage.getItem('mehrbod-cards-bux');
    if (raw === null) { saveBux(STARTING_BUX); return STARTING_BUX; }
    const n = Number(raw);
    return Number.isFinite(n) ? n : STARTING_BUX;
  } catch (e) { return STARTING_BUX; }
}
function saveBux(n) {
  try { localStorage.setItem('mehrbod-cards-bux', String(Math.max(0, Math.floor(n)))); } catch (e) {}
  queueMicrotask(() => { try { saveInventoryBackup(); } catch (e) {} });
}
function addBux(delta) {
  const n = Math.max(0, loadBux() + delta);
  saveBux(n);
  updateBuxDisplay();
  return n;
}
// NOTE: the old 10-Bux "safety net" floor (spending could never take a
// balance below 10) has been removed - it's no longer needed. Spending is
// now only ever limited by the actual balance, for both normal purchases
// and wagers.
function spendBux(amount, isWager = false) {
  const bal = loadBux();
  if (!(amount > 0) || !Number.isFinite(amount)) return false;
  const n = Math.floor(amount);
  if (n > bal) return false;
  saveBux(bal - n);
  updateBuxDisplay();
  return true;
}
function updateBuxDisplay() {
  const n = loadBux();
  const el = document.getElementById('bux-counter-value');
  if (el) el.textContent = n.toLocaleString();
}

// ---- Card collection & starter pack (v2.2) ---------------------------------
const ALL_SPELL_IDS = (typeof SPELL_DEFS !== 'undefined') ? SPELL_DEFS.map(s => s.id) : [];
const ALL_CHIP_IDS = (typeof CHIP_DEFS !== 'undefined') ? CHIP_DEFS.map(c => c.id) : [];
const ALL_NONBLUE_UNIT_IDS = [2, 3, 4].flatMap(tier => UNIT_ARCHETYPES[tier].map(a => a.id));

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function loadCollection() {
  try {
    const raw = JSON.parse(localStorage.getItem('mehrbod-cards-collection') || 'null');
    if (raw && Array.isArray(raw.spells) && Array.isArray(raw.chips)) {
      return { units: Array.isArray(raw.units) ? raw.units : [], spells: raw.spells, chips: raw.chips };
    }
  } catch (e) {}
  return { units: [], spells: [], chips: [] };
}
function saveCollection(col) {
  const normalized = normalizeInventory(col);
  try { localStorage.setItem('mehrbod-cards-collection', JSON.stringify(normalized)); } catch (e) {}
  queueMicrotask(() => { try { saveInventoryBackup(); } catch (e) {} });
}
function grantCards(unitIds, spellIds, chipIds) {
  const col = loadCollection();
  (unitIds || []).forEach(id => { if (!col.units.includes(id)) col.units.push(id); });
  (spellIds || []).forEach(id => { if (!col.spells.includes(id)) col.spells.push(id); });
  (chipIds || []).forEach(id => { if (!col.chips.includes(id)) col.chips.push(id); });
  saveCollection(col);
  updateThemeButtons();
  return col;
}
function isUnitArchetypeOwned(archetypeId) {
  if (UNIT_ARCHETYPES[1].some(a => a.id === archetypeId)) return true;
  return loadCollection().units.includes(archetypeId);
}
function isSpellOwned(spellId) {
  return loadCollection().spells.includes(spellId);
}
function isChipOwned(chipId) {
  return loadCollection().chips.includes(chipId);
}
function findArchetypeById(archetypeId) {
  for (let tier = 1; tier <= 4; tier++) {
    const found = UNIT_ARCHETYPES[tier].find(a => a.id === archetypeId);
    if (found) return { ...found, tier };
  }
  return null;
}

(function grantStarterPackIfNeeded() {
  try {
    if (localStorage.getItem('mehrbod-cards-starter-granted') === '1') return;
    const spellPick = shuffleArray(ALL_SPELL_IDS).slice(0, 4);
    const chipPick = shuffleArray(ALL_CHIP_IDS).slice(0, 2);
    grantCards([], spellPick, chipPick);
    localStorage.setItem('mehrbod-cards-starter-granted', '1');
  } catch (e) {}
})();

// BUGFIX: merging requires a matching-tier blueprint sitting in the deck -
// a player who owns zero non-Blue units can never merge at all (Blue+Blue
// has nothing to consume into a Green, and so on). The starter pack above
// only ever granted spells/chips, so every new player's deck builder
// showed nothing but Blue, and merging silently did nothing forever. Runs
// once, and also retroactively for anyone who already slipped through
// before this existed, to guarantee every player owns at least a small
// spread of Green/Red/Orange cards to actually merge into.
(function grantMergeStarterUnitsIfNeeded() {
  try {
    if (localStorage.getItem('mehrbod-cards-merge-starter-v1') === '1') return;
    const col = loadCollection();
    if (col.units.length === 0) {
      const greenPick = shuffleArray(UNIT_ARCHETYPES[2].map(a => a.id)).slice(0, 2);
      const redPick = shuffleArray(UNIT_ARCHETYPES[3].map(a => a.id)).slice(0, 1);
      const orangePick = shuffleArray(UNIT_ARCHETYPES[4].map(a => a.id)).slice(0, 1);
      grantCards([...greenPick, ...redPick, ...orangePick], [], []);
      setTimeout(() => showToast('🎁 Added a few Green/Red/Orange cards to your collection so you can start merging!', 3600), 400);
    }
    localStorage.setItem('mehrbod-cards-merge-starter-v1', '1');
  } catch (e) {}
})();

(function grantChainLightningToEveryone() {
  try {
    const col = loadCollection();
    const spellsToAdd = ['chainlightning', 'remainsmask', 'supremeshirt', 'revivespell', 'skeletonstaff'];
    let changed = false;
    spellsToAdd.forEach(sid => {
      if (!col.spells.includes(sid)) {
        col.spells.push(sid);
        changed = true;
      }
    });
    if (changed) {
      saveCollection(col);
    }
  } catch (e) {}
})();

const PACK_COST = 20;
function buyCardPack() {
  if (!spendBux(PACK_COST)) { showToast("You don't have enough Mehrbod Bux for a pack."); return; }
  if (typeof Sound !== 'undefined' && Sound.packTear) Sound.packTear();
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
  if (typeof Sound !== 'undefined' && Sound.packCardFlip) Sound.packCardFlip();
  const names = granted.map(g => {
    if (g.kind === 'unit') return findArchetypeById(g.id).name;
    return (g.kind === 'spell' ? SPELL_DEFS : CHIP_DEFS).find(d => d.id === g.id).name;
  });
  showToast(`🎁 Pack opened: ${names.join(', ')}!`, 3200);
}

// ---- Deck Builder (restoration) --------------------------------------------
// Every match-start path (Practice vs Bot, Host Match, Join Match) calls
// openDeckBuilder(onConfirm) before the match actually begins. The player
// picks exactly 12 units (any owned archetype, with a +/- stepper so the
// same archetype can be picked more than once), 4 spells, and 2 chips;
// onConfirm is invoked with { unitIds, spellIds, chipIds } once complete.
const REQUIRED_UNIT_COUNT = 12;
const REQUIRED_SPELL_COUNT = 4;
const REQUIRED_CHIP_COUNT = 2;
let dbUnitCounts = {};
let dbSelectedSpells = [];
let dbSelectedChips = [];
let dbOnConfirm = null;

function defaultDeckBuilderSelection() {
  dbUnitCounts = {};
  const col = loadCollection();
  // BUGFIX: the default pre-fill used to be all-Blue, so a player who just
  // clicked "Confirm Deck" without customizing anything ended up with zero
  // blueprints and could never merge. Seed a couple of owned Green/Red/
  // Orange picks in by default (if the player owns any), then top up with
  // Blue to fill the remaining slots.
  const ownedGreen = UNIT_ARCHETYPES[2].filter(a => col.units.includes(a.id));
  const ownedRed = UNIT_ARCHETYPES[3].filter(a => col.units.includes(a.id));
  const ownedOrange = UNIT_ARCHETYPES[4].filter(a => col.units.includes(a.id));
  const starterBlueprints = [...ownedGreen.slice(0, 2), ...ownedRed.slice(0, 1), ...ownedOrange.slice(0, 1)];
  starterBlueprints.forEach(a => { dbUnitCounts[a.id] = (dbUnitCounts[a.id] || 0) + 1; });
  const remaining = REQUIRED_UNIT_COUNT - dbTotalUnits();
  if (remaining > 0) dbUnitCounts['blue_sprite'] = (dbUnitCounts['blue_sprite'] || 0) + remaining;
  dbSelectedSpells = col.spells.slice(0, REQUIRED_SPELL_COUNT);
  dbSelectedChips = col.chips.slice(0, REQUIRED_CHIP_COUNT);
}

function dbTotalUnits() {
  return Object.values(dbUnitCounts).reduce((sum, n) => sum + n, 0);
}

function openDeckBuilder(onConfirm) {
  dbOnConfirm = onConfirm;
  defaultDeckBuilderSelection();
  renderDeckBuilder();
  renderDeckPresets();
  showScreen('screen-deck-builder');
}

function dbAdjustUnit(archetypeId, delta) {
  const current = dbUnitCounts[archetypeId] || 0;
  const total = dbTotalUnits();
  if (delta > 0 && total >= REQUIRED_UNIT_COUNT) return;
  const next = Math.max(0, current + delta);
  if (next === current) return;
  if (typeof Sound !== 'undefined') {
    if (delta > 0) {
      const arch = findArchetypeById(archetypeId);
      if (arch && Sound.tierChime) Sound.tierChime(arch.tier);
      else if (Sound.counterTick) Sound.counterTick(delta);
    } else {
      if (Sound.counterTick) Sound.counterTick(delta);
    }
  }
  if (next === 0) delete dbUnitCounts[archetypeId];
  else dbUnitCounts[archetypeId] = next;
  renderDeckBuilder();
}

function dbSpellCount(id) {
  return dbSelectedSpells.filter(s => s === id).length;
}

function dbAdjustSpell(id, delta) {
  const count = dbSpellCount(id);
  const total = dbSelectedSpells.length;
  if (delta > 0 && total >= REQUIRED_SPELL_COUNT) return;
  if (delta < 0 && count <= 0) return;
  if (delta > 0) {
    dbSelectedSpells.push(id);
    if (typeof Sound !== 'undefined') {
      if (Sound.spellChime) Sound.spellChime();
      else if (Sound.cardEquip) Sound.cardEquip();
    }
  } else if (delta < 0) {
    const idx = dbSelectedSpells.lastIndexOf(id);
    if (idx !== -1) dbSelectedSpells.splice(idx, 1);
    if (typeof Sound !== 'undefined' && Sound.undo) Sound.undo();
  }
  renderDeckBuilder();
}

function dbToggleSpell(id) {
  const count = dbSpellCount(id);
  const total = dbSelectedSpells.length;
  if (count > 0 && total >= REQUIRED_SPELL_COUNT) {
    dbAdjustSpell(id, -1);
  } else {
    dbAdjustSpell(id, 1);
  }
}
function dbToggleChip(id) {
  const idx = dbSelectedChips.indexOf(id);
  if (idx !== -1) {
    dbSelectedChips.splice(idx, 1);
    if (typeof Sound !== 'undefined' && Sound.undo) Sound.undo();
  } else if (dbSelectedChips.length < REQUIRED_CHIP_COUNT) {
    dbSelectedChips.push(id);
    if (typeof Sound !== 'undefined') {
      if (Sound.chipChime) Sound.chipChime();
      else if (Sound.cardEquip) Sound.cardEquip();
    }
  }
  renderDeckBuilder();
}

function renderDeckBuilder() {
  const col = loadCollection();
  const unitsContainer = document.getElementById('deck-builder-units');
  const spellsContainer = document.getElementById('deck-builder-spells');
  const chipsContainer = document.getElementById('deck-builder-chips');
  if (!unitsContainer) return;

  const totalUnits = dbTotalUnits();
  const atUnitCap = totalUnits >= REQUIRED_UNIT_COUNT;

  unitsContainer.innerHTML = '';
  [1, 2, 3, 4].forEach(tier => {
    UNIT_ARCHETYPES[tier].forEach(a => {
      const owned = isUnitArchetypeOwned(a.id);
      const count = dbUnitCounts[a.id] || 0;
      const el = document.createElement('div');
      el.className = `dcard unit-dcard tier${tier} ${owned ? '' : 'locked'}`;
      el.dataset.unitName = a.name;
      el.dataset.unitTier = String(tier);
      const abilityText = a.pool[0] === 'none' ? 'No special ability' : (ABILITIES[a.pool[0]] ? ABILITIES[a.pool[0]].label : 'Unique ability');
      el.innerHTML = `
        <div class="dcard-name">${a.name}</div>
        <div class="dcard-text">${TIERS[tier].name} · ${abilityText}</div>
        ${owned
          ? `<div class="dcard-stepper">
               <button type="button" class="stepper-btn" data-unit-dec="${a.id}" ${count <= 0 ? 'disabled' : ''}>−</button>
               <span class="stepper-count">${count}</span>
               <button type="button" class="stepper-btn" data-unit-inc="${a.id}" ${atUnitCap ? 'disabled' : ''}>+</button>
             </div>`
          : `<div class="dcard-lock">🔒 Unlock via Card Packs in the Shop</div>`}
      `;
      unitsContainer.appendChild(el);
    });
  });
  unitsContainer.querySelectorAll('[data-unit-inc]').forEach(btn => {
    btn.addEventListener('click', () => dbAdjustUnit(btn.dataset.unitInc, 1));
  });
  unitsContainer.querySelectorAll('[data-unit-dec]').forEach(btn => {
    btn.addEventListener('click', () => dbAdjustUnit(btn.dataset.unitDec, -1));
  });

  const atSpellCap = dbSelectedSpells.length >= REQUIRED_SPELL_COUNT;
  spellsContainer.innerHTML = '';
  SPELL_DEFS.forEach(s => {
    const owned = col.spells.includes(s.id);
    const count = dbSpellCount(s.id);
    const selected = count > 0;
    const el = document.createElement('div');
    el.className = `dcard ${owned ? '' : 'locked'} ${selected ? 'selected' : ''}`;
    el.innerHTML = `
      <div class="dcard-name">${s.name}</div>
      <div class="dcard-text">${s.text}</div>
      ${owned
        ? `<div class="dcard-stepper" style="margin-top: 8px;">
             <button type="button" class="stepper-btn" data-spell-dec="${s.id}" ${count <= 0 ? 'disabled' : ''}>−</button>
             <span class="stepper-count">${count}</span>
             <button type="button" class="stepper-btn" data-spell-inc="${s.id}" ${atSpellCap ? 'disabled' : ''}>+</button>
           </div>`
        : '<div class="dcard-lock">🔒 Locked</div>'}
    `;
    if (owned) {
      el.querySelector('[data-spell-inc]')?.addEventListener('click', (e) => { e.stopPropagation(); dbAdjustSpell(s.id, 1); });
      el.querySelector('[data-spell-dec]')?.addEventListener('click', (e) => { e.stopPropagation(); dbAdjustSpell(s.id, -1); });
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (!atSpellCap || count === 0) dbAdjustSpell(s.id, 1);
        else dbAdjustSpell(s.id, -1);
      });
    }
    spellsContainer.appendChild(el);
  });

  chipsContainer.innerHTML = '';
  CHIP_DEFS.forEach(c => {
    const owned = col.chips.includes(c.id);
    const selected = dbSelectedChips.includes(c.id);
    const el = document.createElement('div');
    el.className = `dcard ${owned ? '' : 'locked'} ${selected ? 'selected' : ''}`;
    el.innerHTML = `<div class="dcard-name">${c.name}</div><div class="dcard-text">${c.text}</div>${owned ? '' : '<div class="dcard-lock">🔒 Locked</div>'}`;
    if (owned) el.addEventListener('click', () => dbToggleChip(c.id));
    chipsContainer.appendChild(el);
  });

  document.getElementById('deck-builder-unit-count').textContent = `${totalUnits}/${REQUIRED_UNIT_COUNT}`;
  document.getElementById('deck-builder-spell-count').textContent = `${dbSelectedSpells.length}/${REQUIRED_SPELL_COUNT}`;
  document.getElementById('deck-builder-chip-count').textContent = `${dbSelectedChips.length}/${REQUIRED_CHIP_COUNT}`;

  const complete = totalUnits === REQUIRED_UNIT_COUNT && dbSelectedSpells.length === REQUIRED_SPELL_COUNT && dbSelectedChips.length === REQUIRED_CHIP_COUNT;
  const hint = document.getElementById('deck-completeness-hint');
  if (hint) {
    hint.textContent = complete ? 'DECK READY' : `${totalUnits}/${REQUIRED_UNIT_COUNT} UNITS`;
    hint.classList.toggle('complete', complete);
  }
  const confirmBtn = document.getElementById('btn-deck-builder-confirm');
  if (confirmBtn) confirmBtn.disabled = !complete;
  applyDeckBuilderFilter();
}

// ---- NEW FEATURE: Deck Builder search & filter -----------------------------
// The Collection screen has had search/filter since v2.6, but the Deck
// Builder itself never did - with 20 unit archetypes plus spells/chips to
// scroll through every time a deck is built, that's a real gap now that the
// card pool has grown. Filters purely by hiding/showing existing DOM nodes
// (same lightweight approach as setupCollectionTools), so it composes with
// re-renders from stepper clicks without any extra bookkeeping.
function applyDeckBuilderFilter() {
  const search = document.getElementById('deck-builder-search');
  const tierSel = document.getElementById('deck-builder-tier-filter');
  if (!search && !tierSel) return;
  const q = (search?.value || '').trim().toLowerCase();
  const tier = tierSel?.value || 'all';
  document.querySelectorAll('#deck-builder-units [data-unit-name]').forEach(el => {
    const name = (el.dataset.unitName || '').toLowerCase();
    const matchesQuery = !q || name.includes(q);
    const matchesTier = tier === 'all' || el.dataset.unitTier === tier;
    el.hidden = !(matchesQuery && matchesTier);
  });
}
document.getElementById('deck-builder-search')?.addEventListener('input', applyDeckBuilderFilter);
document.getElementById('deck-builder-tier-filter')?.addEventListener('change', applyDeckBuilderFilter);

document.getElementById('btn-deck-builder-confirm').addEventListener('click', () => {
  const totalUnits = dbTotalUnits();
  if (totalUnits !== REQUIRED_UNIT_COUNT || dbSelectedSpells.length !== REQUIRED_SPELL_COUNT || dbSelectedChips.length !== REQUIRED_CHIP_COUNT) return;
  const unitIds = [];
  Object.entries(dbUnitCounts).forEach(([id, count]) => { for (let i = 0; i < count; i++) unitIds.push(id); });
  const config = { unitIds, spellIds: dbSelectedSpells.slice(), chipIds: dbSelectedChips.slice(), victoryAnim: loadEquippedVictoryAnim() };
  const cb = dbOnConfirm;
  dbOnConfirm = null;
  if (cb) cb(config);
});

// ---- NEW FEATURE: Auto-Fill Remaining Deck Slots ---------------------------
// One click randomly fills whatever units/spells/chips are still missing
// from the player's OWNED pool - never touches slots already picked, so it
// composes with manual picks instead of overwriting them. Handy for
// quickly getting into a match, or for exploring random combinations.
function autoFillDeck() {
  if (typeof Sound !== 'undefined' && Sound.shuffle) Sound.shuffle();
  const col = loadCollection();
  const ownedUnitIds = [...UNIT_ARCHETYPES[1].map(a => a.id), ...col.units];
  let total = dbTotalUnits();
  let guard = 0;
  while (total < REQUIRED_UNIT_COUNT && ownedUnitIds.length && guard++ < 500) {
    const pick = ownedUnitIds[Math.floor(Math.random() * ownedUnitIds.length)];
    dbUnitCounts[pick] = (dbUnitCounts[pick] || 0) + 1;
    total++;
  }
  while (dbSelectedSpells.length < REQUIRED_SPELL_COUNT && col.spells.length) {
    const pick = col.spells[Math.floor(Math.random() * col.spells.length)];
    dbSelectedSpells.push(pick);
  }
  const remainingChips = col.chips.filter(id => !dbSelectedChips.includes(id));
  while (dbSelectedChips.length < REQUIRED_CHIP_COUNT && remainingChips.length) {
    const i = Math.floor(Math.random() * remainingChips.length);
    dbSelectedChips.push(remainingChips.splice(i, 1)[0]);
  }
  renderDeckBuilder();
  showToast('🎲 Filled the remaining deck slots randomly', 1800);
}
document.getElementById('btn-autofill-deck').addEventListener('click', autoFillDeck);

// ---- NEW FEATURE: Deck Presets ---------------------------------------------
// Building a full 12/4/2 deck from scratch every single match is tedious
// once a player has a loadout they actually like. This lets them save up to
// three named decks and reload one instantly from the deck builder screen,
// instead of re-picking every unit/spell/chip each time. Presets store
// archetype/spell/chip IDs only (not live card instances), so they stay
// valid even as new cards get merged/rebuilt inside an actual match.
const DECK_PRESETS_KEY = 'mehrbod_deck_presets_v1';
const MAX_DECK_PRESETS = 3;

function loadDeckPresets() {
  try {
    const p = JSON.parse(localStorage.getItem(DECK_PRESETS_KEY) || '[]');
    return Array.isArray(p) ? p : [];
  } catch (e) { return []; }
}
function saveDeckPresetsList(list) {
  try { localStorage.setItem(DECK_PRESETS_KEY, JSON.stringify(list.slice(0, MAX_DECK_PRESETS))); } catch (e) {}
}

function saveCurrentDeckAsPreset() {
  const totalUnits = dbTotalUnits();
  if (totalUnits !== REQUIRED_UNIT_COUNT || dbSelectedSpells.length !== REQUIRED_SPELL_COUNT || dbSelectedChips.length !== REQUIRED_CHIP_COUNT) {
    showToast('Finish building a complete deck (12 units, 4 spells, 2 chips) before saving it.');
    return;
  }
  const presets = loadDeckPresets();
  if (presets.length >= MAX_DECK_PRESETS) {
    showToast(`You can only save up to ${MAX_DECK_PRESETS} decks — delete one first.`);
    return;
  }
  const nameInput = document.getElementById('deck-preset-name-input');
  const name = (nameInput?.value || '').trim().slice(0, 20) || `Deck ${presets.length + 1}`;
  const unitIds = [];
  Object.entries(dbUnitCounts).forEach(([id, count]) => { for (let i = 0; i < count; i++) unitIds.push(id); });
  presets.push({
    id: 'preset_' + Date.now(),
    name,
    unitIds,
    spellIds: dbSelectedSpells.slice(),
    chipIds: dbSelectedChips.slice(),
  });
  saveDeckPresetsList(presets);
  if (nameInput) nameInput.value = '';
  if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
  showToast(`💾 Saved deck "${name}"`, 2200);
  renderDeckPresets();
}

function loadDeckPreset(id) {
  const preset = loadDeckPresets().find(p => p.id === id);
  if (!preset) return;
  if (typeof Sound !== 'undefined' && Sound.cardEquip) Sound.cardEquip();
  // Only load archetypes/spells/chips the player still actually owns (in
  // case their collection changed since saving) - never crash or silently
  // produce an invalid deck, just load whatever's still valid.
  dbUnitCounts = {};
  preset.unitIds.filter(uid => isUnitArchetypeOwned(uid)).forEach(uid => {
    dbUnitCounts[uid] = (dbUnitCounts[uid] || 0) + 1;
  });
  const col = loadCollection();
  dbSelectedSpells = preset.spellIds.filter(sid => col.spells.includes(sid)).slice(0, REQUIRED_SPELL_COUNT);
  dbSelectedChips = preset.chipIds.filter(cid => col.chips.includes(cid)).slice(0, REQUIRED_CHIP_COUNT);
  renderDeckBuilder();
  const totalUnits = dbTotalUnits();
  if (totalUnits < REQUIRED_UNIT_COUNT) {
    showToast(`📂 Loaded "${preset.name}" — some cards from it are no longer owned, so it's short ${REQUIRED_UNIT_COUNT - totalUnits} unit(s).`, 3200);
  } else {
    showToast(`📂 Loaded deck "${preset.name}"`, 2000);
  }
}

function deleteDeckPreset(id) {
  saveDeckPresetsList(loadDeckPresets().filter(p => p.id !== id));
  renderDeckPresets();
}

function renderDeckPresets() {
  const list = document.getElementById('deck-presets-list');
  const countEl = document.getElementById('deck-presets-count');
  if (!list) return;
  const presets = loadDeckPresets();
  if (countEl) countEl.textContent = `${presets.length}/${MAX_DECK_PRESETS}`;
  list.innerHTML = presets.length
    ? presets.map(p => `
      <div class="deck-preset-chip">
        <button type="button" class="deck-preset-load" data-load-preset="${p.id}">${p.name}</button>
        <button type="button" class="deck-preset-delete" data-delete-preset="${p.id}" title="Delete this deck" aria-label="Delete ${p.name}">✕</button>
      </div>`).join('')
    : '<p class="sub small">No saved decks yet — build one below, then save it here for next time.</p>';
  list.querySelectorAll('[data-load-preset]').forEach(btn => {
    btn.addEventListener('click', () => loadDeckPreset(btn.dataset.loadPreset));
  });
  list.querySelectorAll('[data-delete-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteDeckPreset(btn.dataset.deletePreset); });
  });
  const saveBtn = document.getElementById('btn-save-deck-preset');
  if (saveBtn) saveBtn.disabled = presets.length >= MAX_DECK_PRESETS;
}
document.getElementById('btn-save-deck-preset').addEventListener('click', saveCurrentDeckAsPreset);
document.getElementById('deck-preset-name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveCurrentDeckAsPreset();
});

// ---- Cosmetics (v2.0) -------------------------------------------------------
const COSMETIC_ITEMS = [
  // THEMES (11 total)
  { id: 'theme_mrmoney',    kind: 'theme',       name: '🤑 Mr Money Theme', desc: 'Green money-rain theme for the whole app.', cost: 1000, rarity: 'MYTHIC', art: '💸', original: 1500, tag: 'FEATURED' },
  { id: 'theme_cyberneon',  kind: 'theme',       name: '🌆 Cyber Neon Theme', desc: 'Neon-lit cyberpunk grid with drifting glyph particles.', cost: 1200, rarity: 'EPIC', art: '🌆', original: 1600, tag: 'CYBER' },
  { id: 'theme_abyss',      kind: 'theme',       name: '🌊 Abyss Theme', desc: 'Bioluminescent deep-sea vault with drifting jellyfish glow.', cost: 1200, rarity: 'EPIC', art: '🌊', original: 1600, tag: 'DEEP SEA' },
  { id: 'theme_magma',      kind: 'theme',       name: '🌋 Magma Theme', desc: 'Living volcanic core with undulating lava, fire embers, and magma fissures.', cost: 1200, rarity: 'MYTHIC', art: '🌋', original: 1600, tag: 'HOT' },
  { id: 'theme_synthwave',  kind: 'theme',       name: '⚡ Synthwave Theme', desc: 'Retro outrun grid with chrome horizon and synth wave pulses.', cost: 950, rarity: 'EPIC', art: '⚡', original: 1300, tag: 'RETRO' },
  { id: 'theme_matrix',     kind: 'theme',       name: '🟢 Digital Matrix Theme', desc: 'Cascading digital rain and tactical emerald terminal styling.', cost: 1100, rarity: 'EPIC', art: '🟢', original: 1400, tag: 'SPECIAL' },
  { id: 'theme_sakura',     kind: 'theme',       name: '🌸 Sakura Blossom Theme', desc: 'Serene Japanese zen garden with floating pink cherry blossom petals.', cost: 1100, rarity: 'EPIC', art: '🌸', original: 1400, tag: 'ZEN' },
  { id: 'theme_inferno',    kind: 'theme',       name: '🔥 Solar Inferno Theme', desc: 'Blazing solar flares, golden corona rays, and molten solar wind.', cost: 1300, rarity: 'MYTHIC', art: '🔥', original: 1700, tag: 'SOLAR' },
  { id: 'theme_aurora',     kind: 'theme',       name: '🌌 Northern Aurora Theme', desc: 'Curving arctic aurora borealis light curtains and shimmering stars.', cost: 1050, rarity: 'EPIC', art: '🌌', original: 1350, tag: 'ARCTIC' },
  { id: 'theme_steampunk',  kind: 'theme',       name: '⚙️ Brass Steampunk Theme', desc: 'Victorian brass clockwork gears, pressure gauges, and copper steam plumes.', cost: 950, rarity: 'RARE', art: '⚙️', original: 1200, tag: 'VINTAGE' },
  { id: 'theme_galaxy',     kind: 'theme',       name: '✨ Deep Space Galaxy Theme', desc: 'Swirling spiral nebulae, distant star clusters, and cosmic dust clouds.', cost: 1250, rarity: 'LEGENDARY', art: '✨', original: 1650, tag: 'COSMIC' },

  // SLEEVES (10 total)
  { id: 'sleeve_holo',      kind: 'sleeve',      name: '🌈 Holographic Sleeves', desc: 'Shimmering rainbow card outlines with dynamic refraction.', cost: 400, rarity: 'RARE', art: '✦', original: 0, tag: 'SHIMMER' },
  { id: 'sleeve_gold',      kind: 'sleeve',      name: '✨ Gold Sleeves', desc: 'Gilded 24k card outlines with a warm pulsing royal glow.', cost: 600, rarity: 'EPIC', art: '✨', original: 800, tag: 'ROYAL' },
  { id: 'sleeve_prismatic', kind: 'sleeve',      name: '🌈 Prismatic Sleeves', desc: 'A shifting spectrum chromatic frame around every card.', cost: 800, rarity: 'LEGENDARY', art: '🌈', original: 1000, tag: 'CHROMATIC' },
  { id: 'sleeve_void',      kind: 'sleeve',      name: '🕳️ Void Sleeves', desc: 'Deep-space dark matter frames with a pulsing violet singularity glow.', cost: 1200, rarity: 'MYTHIC', art: '◈', original: 1500, tag: 'DARK MATTER' },
  { id: 'sleeve_crimson',   kind: 'sleeve',      name: '🩸 Crimson Core Sleeves', desc: 'High-intensity ruby red glowing combat edges for cards.', cost: 550, rarity: 'RARE', art: '🩸', original: 700, tag: 'COMBAT' },
  { id: 'sleeve_cyber',     kind: 'sleeve',      name: '⚡ Cyber Circuit Sleeves', desc: 'Glowing neon cyan circuit trace lines pulsing around card edges.', cost: 500, rarity: 'RARE', art: '⚡', original: 650, tag: 'CYBER' },
  { id: 'sleeve_frost',     kind: 'sleeve',      name: '❄️ Glacial Frost Sleeves', desc: 'Crystalline ice borders with floating frost particle shimmer.', cost: 650, rarity: 'EPIC', art: '❄️', original: 850, tag: 'FROST' },
  { id: 'sleeve_phoenix',   kind: 'sleeve',      name: '🔥 Phoenix Ember Sleeves', desc: 'Radiant fiery flame borders shedding glowing phoenix sparks.', cost: 850, rarity: 'LEGENDARY', art: '🔥', original: 1100, tag: 'INFERNO' },
  { id: 'sleeve_emerald',   kind: 'sleeve',      name: '❇️ Emerald Empress Sleeves', desc: 'Luminous jade emerald gemstone borders with gilded corner accents.', cost: 700, rarity: 'EPIC', art: '❇️', original: 900, tag: 'GEM' },
  { id: 'sleeve_obsidian',  kind: 'sleeve',      name: '🖤 Tactical Obsidian Sleeves', desc: 'Sleek stealth carbon obsidian frames with crimson laser edging.', cost: 1000, rarity: 'MYTHIC', art: '🖤', original: 1300, tag: 'STEALTH' },

  // VICTORY EFFECTS (7 total)
  { id: 'effect_confetti',  kind: 'effect',      name: '🎉 Confetti+ Celebration', desc: 'Denser, longer-lasting victory confetti burst.', cost: 250, rarity: 'RARE', art: '🎉', original: 0, tag: 'CELEBRATE' },
  { id: 'effect_victoryburst', kind: 'effect',   name: '✨ Victory Starburst', desc: 'Expansive golden starburst shockwave rings upon victory.', cost: 350, rarity: 'EPIC', art: '✧', original: 500, tag: 'BURST' },
  { id: 'effect_fireworks', kind: 'effect',      name: '🎆 Fireworks Spectacular', desc: 'Multiple bursting colorful sky fireworks on match victory.', cost: 400, rarity: 'EPIC', art: '🎆', original: 550, tag: 'PYRO' },
  { id: 'effect_cashrain',  kind: 'effect',      name: '💸 Bux Cash Rain', desc: 'Cascading golden coins and dollar bills falling across the victory banner.', cost: 450, rarity: 'EPIC', art: '💸', original: 600, tag: 'LOOT' },
  { id: 'effect_lightning', kind: 'effect',      name: '⚡ Thunder Shockwave', desc: 'Crackling electric lightning bolts striking the victory podium.', cost: 380, rarity: 'RARE', art: '⚡', original: 500, tag: 'SHOCK' },
  { id: 'effect_starfountain', kind: 'effect',   name: '🌟 Golden Star Fountain', desc: 'A erupting fountain of spinning golden stars and glitter particles.', cost: 300, rarity: 'RARE', art: '🌟', original: 420, tag: 'GLOW' },
  { id: 'effect_dragonflame', kind: 'effect',    name: '🐉 Dragon Flame Aura', desc: 'A roaring dragon fire vortex swirling around your victory rank.', cost: 600, rarity: 'LEGENDARY', art: '🐉', original: 800, tag: 'DRAGON' },

  // VICTORY FINISHER ANIMATIONS (7 total)
  { id: 'victoryanim_meteor', kind: 'victoryAnim', name: '☄️ Meteor Shower Victory', desc: "Blazing meteor shower streaks down and erupts in shockwaves when you win.", cost: 500, rarity: 'MYTHIC', art: '☄️', original: 750, tag: 'FINISHER' },
  { id: 'victoryanim_supernova', kind: 'victoryAnim', name: '🌌 Cosmic Supernova', desc: 'Blinding stellar explosion and supernova shockwave across the screen.', cost: 650, rarity: 'LEGENDARY', art: '🌌', original: 850, tag: 'STELLAR' },
  { id: 'victoryanim_blackhole', kind: 'victoryAnim', name: '🕳️ Singularity Black Hole', desc: 'A swirling black hole devours the battlefield upon your ultimate win.', cost: 750, rarity: 'MYTHIC', art: '🕳️', original: 1000, tag: 'VOID' },
  { id: 'victoryanim_orbital', kind: 'victoryAnim', name: '🛰️ Orbital Laser Strike', desc: 'A massive satellite laser beam blasts down with screen-shaking impact.', cost: 700, rarity: 'LEGENDARY', art: '🛰️', original: 900, tag: 'ORBITAL' },
  { id: 'victoryanim_blizzard', kind: 'victoryAnim', name: '❄️ Subzero Frost Shatter', desc: 'Flash-freezes the arena into solid ice before shattering into crystalline shards.', cost: 550, rarity: 'EPIC', art: '❄️', original: 750, tag: 'SubZero' },
  { id: 'victoryanim_nuke', kind: 'victoryAnim', name: '☢️ Tactical Nuke Blast', desc: 'A dramatic nuclear countdown mushroom cloud shockwave across the UI.', cost: 800, rarity: 'MYTHIC', art: '☢️', original: 1100, tag: 'NUKE' },
  { id: 'victoryanim_phoenix', kind: 'victoryAnim', name: '🦅 Phoenix Rebirth Finisher', desc: 'A magnificent flaming phoenix spreads its wings in golden fire.', cost: 650, rarity: 'LEGENDARY', art: '🦅', original: 850, tag: 'PHOENIX' },
];

function loadOwnedCosmetics() {
  try {
    const raw = JSON.parse(localStorage.getItem('mehrbod-cards-owned-cosmetics') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}
function saveOwnedCosmetics(list) {
  const valid = new Set(COSMETIC_ITEMS.map(c => c.id));
  const normalized = [...new Set((Array.isArray(list) ? list : []).filter(id => valid.has(id)))];
  try { localStorage.setItem('mehrbod-cards-owned-cosmetics', JSON.stringify(normalized)); } catch (e) {}
  queueMicrotask(() => { try { saveInventoryBackup(); } catch (e) {} });
}
function ownsCosmetic(id) { return loadOwnedCosmetics().includes(id); }

// ---- Inventory integrity guard ---------------------------------------------
const INVENTORY_BACKUP_KEY = 'mehrbod-cards-inventory-backup-v1';
function normalizeInventory(col) {
  const validUnits = new Set(ALL_NONBLUE_UNIT_IDS);
  const validSpells = new Set(ALL_SPELL_IDS);
  const validChips = new Set(ALL_CHIP_IDS);
  return {
    units: [...new Set((Array.isArray(col?.units) ? col.units : []).filter(id => validUnits.has(id)))],
    spells: [...new Set((Array.isArray(col?.spells) ? col.spells : []).filter(id => validSpells.has(id)))],
    chips: [...new Set((Array.isArray(col?.chips) ? col.chips : []).filter(id => validChips.has(id)))]
  };
}
function inventoryFingerprint(payload) {
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function saveInventoryBackup() {
  try {
    const payload = JSON.stringify({
      bux: loadBux(),
      collection: normalizeInventory(loadCollection()),
      cosmetics: [...new Set(loadOwnedCosmetics().filter(x => COSMETIC_ITEMS.some(c => c.id === x)))],
      sleeve: loadEquippedSleeve()
    });
    localStorage.setItem(INVENTORY_BACKUP_KEY, JSON.stringify({
      payload, fingerprint: inventoryFingerprint(payload)
    }));
  } catch (e) {}
}
function restoreInventoryBackupIfTampered() {
  try {
    const raw = localStorage.getItem(INVENTORY_BACKUP_KEY);
    if (!raw) { saveInventoryBackup(); return; }
    const backup = JSON.parse(raw);
    if (!backup || inventoryFingerprint(backup.payload) !== backup.fingerprint) {
      localStorage.removeItem(INVENTORY_BACKUP_KEY);
      saveInventoryBackup();
      return;
    }
    const current = {
      bux: loadBux(),
      collection: normalizeInventory(loadCollection()),
      cosmetics: [...new Set(loadOwnedCosmetics().filter(x => COSMETIC_ITEMS.some(c => c.id === x)))],
      sleeve: loadEquippedSleeve()
    };
    if (JSON.stringify(current) !== backup.payload) {
      const saved = JSON.parse(backup.payload);
      saveBux(Math.max(0, Number(saved.bux) || 0));
      saveCollection(saved.collection);
      saveOwnedCosmetics(saved.cosmetics);
      equipSleeve(saved.sleeve || 'none');
    }
  } catch (e) {}
}

function loadEquippedSleeve() {
  try { return localStorage.getItem('mehrbod-cards-equipped-sleeve') || 'none'; } catch (e) { return 'none'; }
}
function equipSleeve(id) {
  try {
    const allowed = new Set(['none', ...COSMETIC_ITEMS.filter(c => c.kind === 'sleeve').map(c => c.id)]);
    localStorage.setItem('mehrbod-cards-equipped-sleeve', allowed.has(id) && ownsCosmetic(id) ? id : 'none');
  } catch (e) {}
  document.documentElement.classList.remove('sleeve-holo', 'sleeve-gold', 'sleeve-prismatic', 'sleeve-void');
  if (id !== 'none') document.documentElement.classList.add('sleeve-' + id.replace('sleeve_', ''));
  renderCosmeticsShop();
  // BUGFIX: every other piece of owned state (Bux, collection, cosmetics)
  // refreshes the tamper-check backup snapshot right after saving via
  // queueMicrotask(saveInventoryBackup) - but equipSleeve() never did, so
  // the backup kept remembering the PREVIOUS sleeve. The very next
  // restoreInventoryBackupIfTampered() tick (every 1.5s) would then see a
  // mismatch between "current sleeve" and "backed-up sleeve", treat it as
  // tampering, and silently revert the newly-equipped sleeve back to the
  // old one - so equipping a sleeve looked like it never took effect.
  queueMicrotask(() => { try { saveInventoryBackup(); } catch (e) {} });
}

function buyOrEquipCosmetic(item) {
  if (!ownsCosmetic(item.id)) {
    if (!spendBux(item.cost)) { showToast("You don't have enough Mehrbod Bux for that."); return; }
    if (typeof Sound !== 'undefined' && Sound.coinPurchase) Sound.coinPurchase();
    const owned = loadOwnedCosmetics();
    owned.push(item.id);
    saveOwnedCosmetics(owned);
    showToast(`🎉 Unlocked ${item.name}!`, 2600);
    if (item.kind === 'theme') updateThemeButtons();
    if (item.kind === 'sleeve') equipSleeve(item.id);
    renderCosmeticsShop();
    return;
  }
  if (item.kind === 'sleeve') {
    if (typeof Sound !== 'undefined' && Sound.cardEquip) Sound.cardEquip();
    equipSleeve(item.id);
  } else if (item.kind === 'theme') {
    showToast('Open Settings → Themes to wear it!', 2400);
  }
}

function renderCosmeticsShop() {
  const list = document.getElementById('shop-cosmetics-list');
  if (!list) return;

  const owned = loadOwnedCosmetics();
  const equippedSleeve = loadEquippedSleeve();
  const balance = loadBux();

  const items = [
    { id:'theme_mrmoney', kind:'theme', name:'Mr Money Theme', desc:'Turn the whole game into a money-soaked neon vault.', cost:1000, tag:'FEATURED', art:'💸', original:1500 },
    { id:'theme_cyberneon', kind:'theme', name:'Cyber Neon Theme', desc:'A neon cyberpunk grid with drifting glyph particles and scanlines.', cost:1200, tag:'NEW', art:'🌆', original:1600 },
    { id:'theme_abyss', kind:'theme', name:'Abyss Theme', desc:'A bioluminescent deep-sea vault - drifting jellyfish glow and rising bubbles.', cost:1200, tag:'NEW', art:'🌊', original:1600 },
    { id:'theme_magma', kind:'theme', name:'Magma Theme', desc:'A living volcanic core — undulating molten lava, rising fire embers, pulsing magma fissures, and seismic heat surges.', cost:1200, tag:'NEW', art:'🌋', original:1600 },
    { id:'victoryanim_meteor', kind:'victoryAnim', name:'Meteor Shower Victory', desc:'A blazing meteor shower streaks across the screen the instant you win - your opponent sees it too.', cost:500, tag:'NEW', art:'☄️', original:0 },
    { id:'sleeve_prismatic', kind:'sleeve', name:'Prismatic Sleeves', desc:'Animated spectrum borders for every card.', cost:800, tag:'', art:'🌈', original:1000 },
    { id:'sleeve_void', kind:'sleeve', name:'Void Sleeves', desc:'A dark cosmic frame with a violet glow.', cost:1200, tag:'RARE', art:'◈', original:1500 },
    { id:'sleeve_holo', kind:'sleeve', name:'Holographic Sleeves', desc:'Rainbow holographic card edges.', cost:400, tag:'', art:'✦', original:0 },
    { id:'sleeve_gold', kind:'sleeve', name:'Gold Sleeves', desc:'Gilded card outlines with a soft pulse.', cost:600, tag:'', art:'◆', original:0 },
    { id:'effect_victoryburst', kind:'effect', name:'Victory Burst', desc:'A bigger celebration when you win.', cost:350, tag:'', art:'✧', original:0 },
    { id:'effect_confetti', kind:'effect', name:'Confetti+', desc:'Longer, louder victory confetti.', cost:250, tag:'', art:'🎉', original:0 },
  ];

  const cardPack = {
    id:'card-pack', kind:'pack', name:'Card Pack', desc:'Unlock 2 new spells or chips for your collection.', cost:20,
    tag:'DAILY VALUE', art:'🎁', original:0
  };

  // Looked up by id rather than fixed array positions, so adding/removing
  // an item from `items` above can never silently misassign which cards
  // land in which shop section.
  const byId = (...ids) => ids.map(id => items.find(i => i.id === id)).filter(Boolean);
  const featured = byId('theme_mrmoney', 'theme_cyberneon', 'theme_abyss', 'theme_magma');
  const daily = byId('victoryanim_meteor', 'sleeve_prismatic', 'sleeve_void', 'sleeve_holo', 'sleeve_gold', 'effect_victoryburst', 'effect_confetti');
  const collection = [cardPack, ...items];

  const buyItem = (item) => {
    if (item.kind === 'pack') {
      buyCardPack();
      renderCosmeticsShop();
      return;
    }
    const actual = COSMETIC_ITEMS.find(x => x.id === item.id);
    if (!actual) return;
    buyOrEquipCosmetic(actual);
  };

  const itemCard = (item, large=false) => {
    const isOwned = item.kind !== 'pack' && ownsCosmetic(item.id);
    const isEquipped = item.kind === 'sleeve' && equippedSleeve === item.id;
    const discount = item.original && item.original > item.cost
      ? Math.round((1 - item.cost / item.original) * 100) : 0;
    const button = item.kind === 'pack'
      ? `OPEN FOR ${item.cost.toLocaleString()} BUX`
      : isOwned
        ? (isEquipped ? 'EQUIPPED' : item.kind === 'sleeve' ? 'EQUIP' : 'OWNED')
        : `PURCHASE ${item.cost.toLocaleString()} BUX`;

    return `
      <article class="modern-shop-card ${large ? 'large' : ''} ${isOwned ? 'is-owned' : ''}">
        <button class="modern-shop-art" data-shop-buy="${item.id}" data-kind="${item.kind}">
          <span class="modern-shop-art-glow"></span>
          <span class="modern-shop-art-symbol">${item.art}</span>
          ${item.tag ? `<span class="modern-shop-ribbon">${item.tag}</span>` : ''}
          ${discount ? `<span class="modern-shop-discount">-${discount}%</span>` : ''}
        </button>
        <div class="modern-shop-card-body">
          <div class="modern-shop-card-name">${item.name}</div>
          <div class="modern-shop-card-desc">${item.desc}</div>
          <div class="modern-shop-card-bottom">
            <div class="modern-shop-price">
              ${isOwned ? '<span class="owned-label">OWNED</span>' : `<strong>◉ ${item.cost.toLocaleString()}</strong><small>BUX</small>`}
              ${discount ? `<del>${item.original.toLocaleString()}</del>` : ''}
            </div>
            <button class="modern-shop-buy ${isOwned ? 'owned' : ''}" data-shop-buy="${item.id}">${button}</button>
          </div>
        </div>
      </article>`;
  };

  const section = (title, sub, data, cls='') => `
    <section class="modern-shop-section ${cls}" id="modern-shop-${cls}">
      <div class="modern-shop-section-head">
        <div>
          <span class="modern-shop-section-kicker">MEHRBOD SHOP</span>
          <h3>${title}</h3>
          <p>${sub}</p>
        </div>
        <button class="modern-shop-viewall" data-shop-scroll="${cls}">VIEW ALL</button>
      </div>
      <div class="modern-shop-grid">${data.map(x => itemCard(x)).join('')}</div>
    </section>`;

  list.innerHTML = `
    <div class="modern-shop">
      <header class="modern-shop-header">
        <div>
          <span class="modern-shop-kicker">LIVE STORE</span>
          <h2>ITEM SHOP</h2>
        </div>
        <div class="modern-shop-wallet">
          <span class="modern-shop-wallet-icon">◉</span>
          <strong>${balance.toLocaleString()}</strong>
          <span>BUX</span>
        </div>
      </header>

      <div class="modern-shop-tabs">
        <button class="active" data-shop-scroll="featured">FEATURED</button>
        <button data-shop-scroll="daily">DAILY</button>
        <button data-shop-scroll="bundles">BUNDLES</button>
        <button data-shop-scroll="collection">COLLECTION</button>
      </div>

      <div class="modern-shop-refresh">
        <span>SHOP REFRESHES IN</span>
        <strong id="modern-shop-countdown">23:59:59</strong>
      </div>

      <section class="modern-shop-hero">
        <div class="modern-shop-hero-copy">
          <span>FEATURED DROP</span>
          <h1>MR MONEY</h1>
          <p>Bring the vault with you. A premium theme with money-rain effects, green neon lighting, and a completely different atmosphere.</p>
          <button class="modern-shop-hero-button" data-shop-buy="theme_mrmoney">
            ${ownsCosmetic('theme_mrmoney') ? 'VIEW OWNED ITEM' : 'GET FOR 1,000 BUX'}
          </button>
        </div>
        <div class="modern-shop-hero-art">
          <div class="modern-shop-hero-ring ring-a"></div>
          <div class="modern-shop-hero-ring ring-b"></div>
          <div class="modern-shop-hero-coin">◉</div>
          <div class="modern-shop-hero-bill b1">＄</div>
          <div class="modern-shop-hero-bill b2">＄</div>
          <div class="modern-shop-hero-bill b3">＄</div>
        </div>
      </section>

      ${section("Today's Best Sellers", "Fresh cosmetics. Pick your favorites before the shop rotates.", featured, 'featured')}
      ${section("Daily Picks", "A rotating selection of sleeves and victory effects.", daily, 'daily')}
      ${section("Bundles", "Special value drops for collectors.", [
        { id:'bundle-vault', kind:'pack', name:'Vault Starter Bundle', desc:'Card Pack + premium cosmetic value drop.', cost:500, tag:'SAVE 25%', art:'💎', original:675 }
      ], 'bundles')}
      ${section("Collection", "Everything currently available in the shop.", collection, 'collection')}

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
      const id = btn.dataset.shopBuy;
      const item = id === 'card-pack' ? cardPack : [...items, {
        id:'bundle-vault', kind:'pack', name:'Vault Starter Bundle', desc:'Card Pack + premium cosmetic value drop.', cost:500
      }].find(x => x.id === id);
      if (item) buyItem(item);
    });
  });

  list.querySelectorAll('[data-shop-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      list.querySelectorAll('[data-shop-scroll]').forEach(x => {
        if (x.tagName === 'BUTTON' && x.closest('.modern-shop-tabs')) x.classList.remove('active');
      });
      if (btn.closest('.modern-shop-tabs')) btn.classList.add('active');
      const target = document.getElementById(`modern-shop-${btn.dataset.shopScroll}`);
      if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

document.getElementById('btn-how-to-play').addEventListener('click', () => startFullTutorial());
document.getElementById('btn-single-player').addEventListener('click', () => showScreen('screen-single-player'));
document.getElementById('btn-multiplayer').addEventListener('click', () => showScreen('screen-multiplayer'));
function openModernShop() {
  if (typeof Sound !== 'undefined' && Sound.coin) Sound.coin();
  updateBuxDisplay();
  renderCosmeticsShop();
  showScreen('screen-shop-cosmetics');
}
document.getElementById('btn-shop').addEventListener('click', openModernShop);
document.getElementById('bux-counter').addEventListener('click', openModernShop);

document.getElementById('btn-story-mode').addEventListener('click', () => {
  showToast('📖 Story Mode is coming soon!', 2400);
});
document.getElementById('btn-practice-bot').addEventListener('click', () => showScreen('screen-bot-mode'));

document.getElementById('btn-bot-mode-normal').addEventListener('click', () => { markLastPlayedDifficulty(); showScreen('screen-bot-setup'); });
document.getElementById('btn-bot-mode-wager').addEventListener('click', () => { updateBuxDisplay(); showScreen('screen-shop-bot'); });

document.getElementById('btn-host-menu').addEventListener('click', () => showScreen('screen-host-mode'));

document.getElementById('btn-matchmaking-menu').addEventListener('click', () => {
  openDeckBuilder((config) => beginMatchmaking(config));
});

document.getElementById('btn-matchmaking-cancel').addEventListener('click', () => {
  cancelMatchmaking();
});

document.getElementById('btn-host-mode-normal').addEventListener('click', () => {
  openDeckBuilder((config) => beginHost(0, config));
});
document.getElementById('btn-host-mode-wager').addEventListener('click', () => { updateBuxDisplay(); showScreen('screen-shop-host-setup'); });

document.getElementById('btn-join-menu').addEventListener('click', () => {
  openDeckBuilder((config) => { pendingGuestDeckConfig = config; showScreen('screen-join'); });
});

document.querySelectorAll('.menu-card').forEach(wirePressFeedback);

// ---- Back navigation --------------------------------------------------
// Every `.back-btn` returns to its screen's logical parent. This was
// missing entirely before - none of the back buttons in the app did
// anything, so there was no way to back out of any submenu.
const BACK_TARGETS = {
  'screen-single-player': 'screen-menu',
  'screen-trial-tower': 'screen-single-player',
  'screen-bot-mode': 'screen-single-player',
  'screen-multiplayer': 'screen-menu',
  'screen-host-mode': 'screen-multiplayer',
  'screen-shop-cosmetics': 'screen-menu',
  'screen-shop-bot': 'screen-bot-mode',
  'screen-shop-host-setup': 'screen-host-mode',
  'screen-deck-builder': 'screen-menu',
  'screen-collection': 'screen-menu',
  'screen-bot-setup': 'screen-single-player',
  'screen-host': 'screen-menu',
  'screen-join': 'screen-multiplayer',
  'screen-matchmaking': 'screen-multiplayer',
};
document.querySelectorAll('.back-btn').forEach(btn => {
  const screenEl = btn.closest('.screen');
  if (!screenEl) return;
  wirePressFeedback(btn);
  btn.addEventListener('click', () => {
    if (screenEl.id === 'screen-matchmaking') {
      cancelMatchmaking();
      return;
    }
    if ((screenEl.id === 'screen-host' || screenEl.id === 'screen-join') && net) {
      net.destroy();
      net = null;
    }
    showScreen(BACK_TARGETS[screenEl.id] || 'screen-menu');
  });
});

// ---- Shop: wager amount pickers --------------------------------------------
function wireWagerPicker(presetsSelector, inputId, setSelected) {
  document.querySelectorAll(`${presetsSelector} .wager-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      const v = Math.max(1, Math.floor(Number(btn.dataset.amt) || 0));
      setSelected(v);
      document.getElementById(inputId).value = String(v);
      document.querySelectorAll(`${presetsSelector} .wager-btn`).forEach(b => b.classList.toggle('active', b === btn));
    });
  });
  document.getElementById(inputId).addEventListener('input', (e) => {
    const v = Math.floor(Number(e.target.value));
    setSelected(v > 0 ? v : 0);
    document.querySelectorAll(`${presetsSelector} .wager-btn`).forEach(b => b.classList.remove('active'));
  });
}
wireWagerPicker('#wager-presets', 'wager-custom-input', (v) => { shopSelectedWager = v; });
wireWagerPicker('#wager-presets-host', 'wager-custom-input-host', (v) => { shopHostSelectedWager = v; });


/* ============================================================
   BATTLE QUALITY OF LIFE / PROGRESSION FEATURES
   ============================================================ */
const BATTLE_STATS_KEY = 'mehrbod_battle_stats_v1';
function getBattleStats() {
  try {
    return JSON.parse(localStorage.getItem(BATTLE_STATS_KEY) || '{"wins":0,"losses":0,"wagerWon":0,"wagerLost":0,"biggestWin":0,"streak":0,"bestStreak":0}');
  } catch (_) {
    return {wins:0, losses:0, wagerWon:0, wagerLost:0, biggestWin:0, streak:0, bestStreak:0};
  }
}
function saveBattleStats(s) {
  localStorage.setItem(BATTLE_STATS_KEY, JSON.stringify(s));
}
function recordBattleResult(win, wager = 0, payout = 0) {
  const s = getBattleStats();
  if (win) {
    s.wins++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.wagerWon += Math.max(0, payout - wager);
    s.biggestWin = Math.max(s.biggestWin, Math.max(0, payout - wager));
  } else {
    s.losses++;
    s.streak = 0;
    s.wagerLost += Math.max(0, wager);
  }
  saveBattleStats(s);
}

const ECONOMY_LEDGER_KEY = 'mehrbod_economy_ledger_v1';
function getEconomyLedger() {
  try { return JSON.parse(localStorage.getItem(ECONOMY_LEDGER_KEY) || '[]'); }
  catch (_) { return []; }
}
function recordEconomyChange(amount, reason) {
  if (!Number.isFinite(Number(amount)) || !amount) return;
  const ledger = getEconomyLedger();
  ledger.unshift({amount:Number(amount), reason:String(reason || 'Balance change'), at:Date.now()});
  localStorage.setItem(ECONOMY_LEDGER_KEY, JSON.stringify(ledger.slice(0,30)));
}
function escapePresetText(v) {
  return String(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function getRecentActivity() {
  try { return JSON.parse(localStorage.getItem('mehrbod_recent_activity') || '[]'); }
  catch (_) { return []; }
}
function recordRecentActivity(text) {
  const items = getRecentActivity();
  items.unshift({ text, at: Date.now() });
  localStorage.setItem('mehrbod_recent_activity', JSON.stringify(items.slice(0, 8)));
}

// ---- NEW FEATURE: Match History ---------------------------------------
// A lightweight persisted log of your last several matches (mode, opponent,
// result, how many rounds it took, how long it lasted), shown inside the
// Player Stats panel below the ledger/activity sections.
const MATCH_HISTORY_KEY = 'mehrbod_match_history_v1';
function getMatchHistory() {
  try { return JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || '[]'); }
  catch (_) { return []; }
}
function recordMatchHistory(entry) {
  const items = getMatchHistory();
  items.unshift({ ...entry, at: Date.now() });
  localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

// ---- Player Stats panel -----------------------------------------------
// Combines what used to be three separate feature-strip popups (Battle
// Stats, Bux Ledger, Recent Activity) into one panel, reached from the
// "📊 Stats" button in the menu footer (where "How to play" used to live -
// that's moved into the Single Player screen instead).
function showPlayerReport() {
  if (typeof openProfilePanel === 'function') {
    openProfilePanel();
  }
}

/* ============================================================
   CARD MASTERY
   ============================================================ */
const CARD_MASTERY_KEY = 'mehrbod_card_mastery_v1';

function getCardMastery() {
  try { return JSON.parse(localStorage.getItem(CARD_MASTERY_KEY) || '{}'); }
  catch (_) { return {}; }
}
function saveCardMastery(data) {
  localStorage.setItem(CARD_MASTERY_KEY, JSON.stringify(data));
}
function addCardMastery(cardIds, won = false) {
  const mastery = getCardMastery();
  [...new Set(cardIds || [])].forEach(id => {
    if (!id) return;
    const item = mastery[id] || { xp:0, level:1, battles:0, wins:0 };
    item.battles++;
    if (won) item.wins++;
    item.xp += won ? 40 : 25;
    const newLevel = Math.min(10, 1 + Math.floor(item.xp / 100));
    if (newLevel > item.level && typeof showToast === 'function') {
      showToast(`Card mastered: ${id} — Level ${newLevel}`, 2200);
    }
    item.level = newLevel;
    mastery[id] = item;
  });
  saveCardMastery(mastery);
}
function getCardMasteryLevel(id) {
  return getCardMastery()[id]?.level || 1;
}

// Free "Practice vs Bot" difficulty picker - scoped to screen-bot-setup only
// so it never fires for the visually-identical wager difficulty cards on
// the Wager Match screen (#shop-diff-list has its own listener). Picking a
// difficulty always leads into the deck builder before the match actually
// begins.
document.querySelectorAll('#screen-bot-setup .diff-card').forEach(btn => {
  wirePressFeedback(btn);
  btn.addEventListener('click', () => {
    const diff = btn.dataset.diff;
    botDifficulty = diff;
    saveLastDifficulty(diff);
    openDeckBuilder((config) => startVsBot(0, config));
  });
});

// ---- Shop: Wager vs Bot -----------------------------------------------------
function getCurrentBotWagerCap() {
  const selected = document.querySelector('#shop-diff-list .diff-card.selected, #shop-diff-list .diff-card.active');
  const diff = selected?.dataset.diff || null;
  return diff ? (WAGER_CAPS[diff] || 10) : Math.max(...Object.values(WAGER_CAPS));
}

function refreshBotWagerPicker(difficulty = null) {
  const cap = difficulty ? (WAGER_CAPS[difficulty] || 10) : Math.max(...Object.values(WAGER_CAPS));
  const input = document.getElementById('wager-custom-input');
  const label = document.getElementById('wager-cap-label');

  document.querySelectorAll('#wager-presets .wager-btn').forEach(btn => {
    const amount = Number(btn.dataset.amt);
    btn.disabled = amount > cap;
    btn.classList.toggle('wager-over-cap', amount > cap);
    btn.title = amount > cap ? `Requires a higher bot difficulty (max ${cap} Bux here)` : `${amount} Bux`;
  });

  if (label) label.textContent = `MAX ${cap} BUX`;

  if (input) {
    input.max = String(cap);
    if (Number(input.value) > cap) {
      input.value = String(cap);
      shopSelectedWager = cap;
    }
  }

  if (shopSelectedWager > cap) {
    shopSelectedWager = cap;
    if (input) input.value = String(cap);
  }
}

document.querySelectorAll('#shop-diff-list .diff-card').forEach(btn => {
  wirePressFeedback(btn);
  btn.addEventListener('click', () => {
    const diff = btn.dataset.diff;
    const cap = WAGER_CAPS[diff] || 10;

    document.querySelectorAll('#shop-diff-list .diff-card').forEach(b => {
      b.classList.toggle('selected', b === btn);
      b.classList.toggle('active', b === btn);
    });
    refreshBotWagerPicker(diff);

    const amt = Math.floor(shopSelectedWager);
    if (!amt || amt <= 0) {
      showToast(`Choose a wager up to ${cap} Bux for ${diff}.`);
      return;
    }
    if (amt > cap) {
      showToast(`${diff} has a maximum wager of ${cap} Bux.`);
      shopSelectedWager = cap;
      const input = document.getElementById('wager-custom-input');
      if (input) input.value = String(cap);
      document.querySelectorAll('#wager-presets .wager-btn').forEach(b =>
        b.classList.toggle('active', Number(b.dataset.amt) === cap)
      );
      return;
    }
    if (amt > loadBux()) {
      showToast(`You only have ${loadBux().toLocaleString()} Bux available.`);
      return;
    }

    openDeckBuilder((config) => {
      if (!spendBux(amt, true)) {
        showToast("You don't have enough Mehrbod Bux for that wager.");
        return;
      }
      botDifficulty = diff;
      saveLastDifficulty(diff);
      startVsBot(amt, config);
    });
  });
});

document.getElementById('wager-custom-input')?.addEventListener('input', (e) => {
  const diff = document.querySelector('#shop-diff-list .diff-card.selected, #shop-diff-list .diff-card.active')?.dataset.diff;
  const cap = diff ? WAGER_CAPS[diff] : Math.max(...Object.values(WAGER_CAPS));
  let value = Math.floor(Number(e.target.value || 0));
  if (value > cap) {
    value = cap;
    e.target.value = String(cap);
    showToast(`${diff || 'This wager'} is capped at ${cap} Bux.`);
  }
  shopSelectedWager = value;
});

refreshBotWagerPicker();

// ---- Shop: Host a Wagered Match ---------------------------------------------
document.getElementById('btn-host-wager-confirm').addEventListener('click', () => {
  const amt = Math.floor(shopHostSelectedWager);
  if (!amt || amt <= 0) { showToast('Pick a wager amount first.'); return; }
  if (amt > MAX_MULTIPLAYER_WAGER) { showToast(`Multiplayer wagers are capped at ${MAX_MULTIPLAYER_WAGER} Bux.`); return; }
  if (amt > loadBux()) { showToast(`You only have ${loadBux().toLocaleString()} Bux available.`); return; }
  openDeckBuilder((config) => {
    if (!spendBux(amt, true)) {
      showToast("You don't have enough Mehrbod Bux for that wager.");
      return;
    }
    beginHost(amt, config);
  });
});

// ---- Remembered difficulty -------------------------------------------------
function loadLastDifficulty() {
  try { return localStorage.getItem('mehrbod-cards-last-difficulty'); } catch (e) { return null; }
}
function saveLastDifficulty(diff) {
  try { localStorage.setItem('mehrbod-cards-last-difficulty', diff); } catch (e) {}
}
function markLastPlayedDifficulty() {
  document.querySelectorAll('#screen-bot-setup .diff-card .last-played-tag').forEach(el => el.remove());
  const last = loadLastDifficulty();
  if (!last) return;
  const btn = document.querySelector(`#screen-bot-setup .diff-card[data-diff="${last}"]`);
  if (!btn) return;
  const tag = document.createElement('span');
  tag.className = 'last-played-tag';
  tag.textContent = 'Last played';
  btn.appendChild(tag);
}

/* ============================================================
   DAILY CHALLENGE
   A single rotating objective, the same for everyone on a given
   calendar day (picked deterministically from a small pool, keyed
   off days-since-epoch so it changes at midnight local time).
   Progress is tracked passively as the player does normal things
   (merge, place, defend, win) - no separate "start challenge" step.
   Completing it pays out Bux and builds a day-streak that raises
   the payout, similar in spirit to the win-streak indicator but
   independent of it. Tutorial actions never count. Its progress
   and rewards now surface inside the 🏆 Quests panel instead of a
   dedicated menu button - see renderQuests() below.
   ============================================================ */
const DAILY_CHALLENGE_POOL = [
  { id: 'win1',     type: 'win',    target: 1,  desc: 'Win 1 match, in any mode.' },
  { id: 'merge3',   type: 'merge',  target: 3,  desc: 'Merge cards together 3 times.' },
  { id: 'place10',  type: 'place',  target: 10, desc: 'Place 10 Blue cards onto a board.' },
  { id: 'defend3',  type: 'defend', target: 3,  desc: 'Successfully defend against 3 attacks.' },
];
const DAILY_CHALLENGE_KEY = 'mehrbod_daily_challenge_v2';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function dailyPoolIndex() {
  return Math.floor(Date.now() / 86400000) % DAILY_CHALLENGE_POOL.length;
}
function loadDailyChallengeState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(DAILY_CHALLENGE_KEY) || 'null'); } catch (e) {}
  const today = todayKey();
  if (!s || s.date !== today) {
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yesterdayKey = `${yest.getFullYear()}-${yest.getMonth() + 1}-${yest.getDate()}`;
    const streak = (s && s.claimed && s.date === yesterdayKey) ? (s.streak || 0) : 0;
    s = { date: today, challenge: DAILY_CHALLENGE_POOL[dailyPoolIndex()].id, progress: 0, claimed: false, streak };
    try { localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  return s;
}
function saveDailyChallengeState(s) {
  try { localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(s)); } catch (e) {}
}
function getDailyChallengeDef() {
  const s = loadDailyChallengeState();
  return DAILY_CHALLENGE_POOL.find(c => c.id === s.challenge) || DAILY_CHALLENGE_POOL[0];
}
function dailyChallengeReward(streak) {
  return Math.min(60, 30 + streak * 5);
}
// Called from wherever the underlying action already happens (dispatch/
// applyActionAndRender/gameover). No-ops quietly if today's challenge is a
// different type, already claimed, or we're inside the scripted tutorial.
function progressDailyChallenge(type, amount = 1) {
  if (tutorialActive) return;
  const def = getDailyChallengeDef();
  if (def.type !== type) return;
  const s = loadDailyChallengeState();
  if (s.claimed) return;
  s.progress = Math.min(def.target, s.progress + amount);
  saveDailyChallengeState(s);
  if (s.progress >= def.target) completeDailyChallenge();
}
function completeDailyChallenge() {
  const s = loadDailyChallengeState();
  if (s.claimed) return;
  s.claimed = true;
  s.streak = (s.streak || 0) + 1;
  saveDailyChallengeState(s);
  const reward = dailyChallengeReward(s.streak);
  addBux(reward);
  recordEconomyChange(reward, 'Daily Challenge completed');
  recordRecentActivity(`Completed the Daily Challenge (${s.streak}-day streak) — +${reward} Bux`);
  showToast(`⚡ Daily Challenge complete! +${reward} Bux (${s.streak}-day streak)`, 3200);
  if (typeof Sound !== 'undefined' && Sound.questClaim) Sound.questClaim();
  else if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
  checkAchievements();
}

/* ============================================================
   FORGE MILESTONES (achievements)
   A fixed set of one-time milestones layered on top of the
   existing difficulty-quests (which only ever track "beat this
   difficulty"). These cover a wider range of play - first
   actions, totals, wagers, collection completion, and the Daily
   Challenge - each with its own one-time Bux reward.
   checkAchievements() is deliberately idempotent (safe to call
   repeatedly from several places) and never calls anything that
   could loop back into it. Its list now renders inside the
   🏆 Quests panel instead of a dedicated menu button - see
   renderQuests() below.
   ============================================================ */
const ACHIEVEMENTS = [
  { id: 'first_merge',     name: 'First Fusion',       desc: 'Perform your first merge.', icon: '🔗', reward: 15 },
  { id: 'first_orange',    name: 'Peak Tier',          desc: 'Create your first Orange card.', icon: '🔶', reward: 30 },
  { id: 'first_win',       name: 'First Blood',        desc: 'Win your first match.', icon: '🏅', reward: 20 },
  { id: 'win_master',      name: 'Master Slayer',      desc: 'Beat the Master difficulty bot.', icon: '👑', reward: 75 },
  { id: 'win_10',          name: 'Seasoned Duelist',   desc: 'Win 10 matches total.', icon: '⚔️', reward: 50 },
  { id: 'win_streak_3',    name: 'On a Roll',          desc: 'Win 3 matches in a row.', icon: '🔥', reward: 40 },
  { id: 'wager_win',       name: 'High Roller',        desc: 'Win a wagered match.', icon: '💰', reward: 25 },
  { id: 'all_diffs',       name: 'Undisputed',         desc: 'Beat every bot difficulty at least once.', icon: '🏆', reward: 100 },
  { id: 'full_collection', name: 'Completionist',      desc: 'Collect every card in the game.', icon: '💠', reward: 150 },
  { id: 'bux_500',         name: 'Vault Keeper',       desc: 'Hold 500 Mehrbod Bux at once.', icon: '🏦', reward: 20 },
  { id: 'daily_streak_3',  name: 'Creature of Habit',  desc: 'Complete the Daily Challenge 3 days in a row.', icon: '📅', reward: 30 },
  { id: 'mega_fusion',     name: 'Mega Fusion',        desc: 'Merge 3 or more cards together in a single fusion.', icon: '💥', reward: 25 },
];
const ACHIEVEMENTS_KEY = 'mehrbod_achievements_v1';
function loadUnlockedAchievements() {
  try { const a = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function saveUnlockedAchievements(list) {
  try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...new Set(list)])); } catch (e) {}
}
function unlockAchievement(id) {
  const unlocked = loadUnlockedAchievements();
  if (unlocked.includes(id)) return;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return;
  unlocked.push(id);
  saveUnlockedAchievements(unlocked);
  if (def.reward > 0) {
    addBux(def.reward);
    recordEconomyChange(def.reward, `Achievement: ${def.name}`);
  }
  recordRecentActivity(`Unlocked achievement "${def.name}"${def.reward > 0 ? ` — +${def.reward} Bux` : ''}`);
  showToast(`${def.icon} Achievement unlocked: ${def.name}!`, 3200);
  Sound.sparkle();
}
// Broad, idempotent sweep - checks every threshold-style achievement
// against current state. Never itself triggers game actions, so it's
// safe to call from many different hook points without looping.
function checkAchievements() {
  const stats = getBattleStats();
  const beaten = loadBeatenDifficulties();
  const daily = loadDailyChallengeState();
  if (stats.wins >= 1) unlockAchievement('first_win');
  if (stats.wins >= 10) unlockAchievement('win_10');
  if (stats.streak >= 3) unlockAchievement('win_streak_3');
  if (beaten.includes('Master')) unlockAchievement('win_master');
  if (isAllDiffsUnlocked(beaten)) unlockAchievement('all_diffs');
  if (isCollectionComplete()) unlockAchievement('full_collection');
  if (loadBux() >= 500) unlockAchievement('bux_500');
  if ((daily.streak || 0) >= 3) unlockAchievement('daily_streak_3');
}

// ---- Vs Bot --------------------------------------------------------------
let lastVsBotDeckConfig = null; // NEW FEATURE: lets "Play Again" reuse the deck you actually built
function startVsBot(wagerAmount = 0, deckConfig = null) {
  mode = 'bot';
  localKey = 'you'; remoteKey = 'bot';
  const seed = makeSeed();
  gameOverAnnounced = false;
  meteorShowerDone = false;
  epicVictoryDone = false;
  matchVictoryAnims = { you: deckConfig?.victoryAnim || null, bot: null };
  matchStartTime = Date.now();
  currentWager = wagerAmount || 0;
  _lowHpWarned.clear();
  resetMatchCardStats();
  lastPlacement = null;
  cancelBotThinking();
  if (deckConfig) lastVsBotDeckConfig = deckConfig;
  const configs1 = deckConfig ? { you: deckConfig } : {};
  state = createMatch(seed, 'you', 'bot', configs1);
  initReplayLog(seed, 'you', 'bot', configs1);
  botRng = new RngStream(seed + 999);
  botActedKey = null;
  resetSelections();
  showScreen('screen-game');
  setMatchInfo(
    `Vs Bot · ${botDifficulty}` + (currentWager > 0 ? ` · 💰${currentWager.toLocaleString()}` : ''),
    `${botDifficulty} vs Bot` + (currentWager > 0 ? ` · 💰${currentWager.toLocaleString()}` : '')
  );
  ensureBotActs(() => render());
  render();
}

// ---- Live guided tutorial ---------------------------------------------------
let tutorialActive = false;
let tutorialPhase = 'menu'; // 'menu' | 'match'
let tutorialStepIndex = 0;
let tutorialSuppressBot = false;

const MENU_TOUR_STEPS = [
  {
    text: "Welcome to Mehrbod Cards! Quick tour of the menu first, then we'll jump into a real practice match.",
    target: null,
  },
  {
    text: '💰 Your Mehrbod Bux balance lives here, top-right, on every menu screen. You start with 50 — tap it anytime to jump straight to the Shop.',
    target: () => document.getElementById('bux-counter'),
  },
  {
    text: 'Single Player is where Practice vs Bot lives — free matches against 5 AI difficulty levels. Story Mode is coming soon!',
    target: () => document.getElementById('btn-single-player'),
  },
  {
    text: 'The Mehrbod Shop sells Card Packs (unlock new spells, chips, and Green/Red/Orange cards), cosmetics like the Mr Money theme, and is where wagered matches for real stakes get set up.',
    target: () => document.getElementById('btn-shop'),
  },
  {
    text: "Multiplayer lets you host a room for a friend or join one with a 5-letter code — no account needed.",
    target: () => document.getElementById('btn-multiplayer'),
  },
  {
    text: '📖 Your Collection Book shows every card in the game and lets you switch themes. Cards you own are ready to use in the deck builder; greyed-out ones are still waiting to be unlocked from a Card Pack.',
    target: () => document.getElementById('btn-open-collection'),
  },
  {
    text: '🏆 Quests track theme unlocks, your Daily Challenge, and Forge Milestones, all in one place.',
    target: () => document.getElementById('btn-open-quests-menu'),
  },
  {
    text: "Alright, let's actually play. We'll drop straight into a practice match against an Easy bot and walk through everything step by step.",
    target: null,
  },
];

const MATCH_TUTORIAL_STEPS = [
  {
    text: "This is a real practice match against an Easy bot - nothing here is faked, this is the actual game.",
    target: null,
  },
  {
    text: 'These are all your cards, available from the start - no drawing needed. Drag any Blue card down onto an empty slot on your board to place it.',
    target: () => document.getElementById('hand-row'),
    waitFor: (action, res) => action.type === 'place' && res.ok,
  },
  {
    text: 'Nicely done! Place one more Blue card the same way.',
    target: () => document.getElementById('hand-row'),
    waitFor: (action, res) => action.type === 'place' && res.ok,
  },
  {
    text: "You've got two Blue cards on your board now. Drag one Blue card onto the other to merge them into a stronger Green card - this only works if you still have a Green card sitting in your cards to use as the blueprint. Blue is the only tier you can ever place directly - everything above it only ever comes from merging. Once you have 3+ cards down, try the 🧬 Combine button below to select several at once and fuse them all in one go.",
    target: () => document.getElementById('player-board'),
    waitFor: (action, res) => action.type === 'merge' && res.ok,
  },
  {
    text: "Spells and chips (below your cards) can target any card, on either side, at any point in the round - you don't need to wait for a special phase to use them.",
    target: () => document.getElementById('spells-chips-row'),
  },
  {
    text: "One more thing: before a real match, you'll pick your own deck in the deck builder - including any Green/Red/Orange cards you own. Those can't be placed directly either, but merging Blues into their exact tier consumes one and uses its special ability instead of a generic result. You can merge 2, 3, or even 4 cards in one go (say, four Blues straight into an Orange) as long as you have the matching blueprint. Run out of a tier's blueprint and you can never merge into it again for the rest of the match. We skipped the deck builder for this practice match so you could jump straight in.",
    target: null,
  },
  {
    text: 'If you ever get 4+ Blue cards on your board at once, you\u2019ll be forced to merge some before doing anything else - your Blues will glow and a banner will explain. Keep an eye out for it.',
    target: () => document.getElementById('player-board'),
  },
  {
    text: 'When your board looks good, hit Ready to lock in your placements for this round.',
    target: () => document.getElementById('btn-ready'),
    waitFor: (action, res) => action.type === 'readyPlacement' && res.ok,
    onComplete: () => { tutorialSuppressBot = false; ensureBotActs(() => render()); },
  },
  {
    text: 'Combat time! Tap one of your cards, then tap an enemy card to choose its target.',
    target: () => document.getElementById('opponent-board'),
    requirePhase: 'attack',
    waitFor: (action, res) => action.type === 'attack' && res.ok,
  },
  {
    text: 'Ready up again to resolve combat — both sides\u2019 attacks land at the exact same time.',
    target: () => document.getElementById('btn-ready'),
    requirePhase: 'attack',
    waitFor: (action, res) => action.type === 'readyAttack' && res.ok,
  },
  {
    text: 'New round! Instead of attacking, try tapping Defend below, then tapping one of your cards to block incoming damage with it.',
    target: () => document.querySelector('.mode-btn[data-mode="defend"]'),
    requirePhase: 'placement',
    waitFor: (action, res) => action.type === 'defend' && res.ok,
  },
  {
    text: "That's the core loop: place, merge, attack, defend, repeat until one side runs out of cards. Keep playing this practice match, or head back to the menu whenever you're ready. Good luck out there!",
    target: null,
  },
];

function currentTutorialSteps() { return tutorialPhase === 'menu' ? MENU_TOUR_STEPS : MATCH_TUTORIAL_STEPS; }
function currentTutorialStep() { return currentTutorialSteps()[tutorialStepIndex]; }

function startFullTutorial() {
  tutorialActive = true;
  tutorialPhase = 'menu';
  tutorialStepIndex = 0;
  showScreen('screen-menu');
  renderTutorialOverlay();
  markTutorialSeen();
}

function markTutorialSeen() {
  try { localStorage.setItem('mehrbod-cards-tutorial-seen', '1'); } catch (e) {}
}
function hasTutorialBeenSeen() {
  try { return localStorage.getItem('mehrbod-cards-tutorial-seen') === '1'; } catch (e) { return true; }
}

function startTutorialMatch() {
  mode = 'bot';
  botDifficulty = 'Easy';
  tutorialActive = true;
  tutorialPhase = 'match';
  tutorialStepIndex = 0;
  tutorialSuppressBot = true;
  localKey = 'you'; remoteKey = 'bot';
  const seed = makeSeed();
  gameOverAnnounced = false;
  meteorShowerDone = false;
  epicVictoryDone = false;
  matchVictoryAnims = {};
  matchStartTime = Date.now();
  currentWager = 0;
  _lowHpWarned.clear();
  resetMatchCardStats();
  lastPlacement = null;
  cancelBotThinking();
  // v3.0: no more hand to override with a predictable starter set - the
  // default random deck (buildDeck with no config) already has plenty of
  // Blues plus at least one Green/Red blueprint, which is exactly what the
  // guided steps below need, and since everything is visible from round 1
  // the deck's internal order no longer matters.
  state = createMatch(seed, 'you', 'bot');
  initReplayLog(seed, 'you', 'bot', {});
  botRng = new RngStream(seed + 999);
  botActedKey = null;
  resetSelections();

  showScreen('screen-game');
  setMatchInfo('Tutorial · Practice Match', 'Tutorial Match');
  render();
  renderTutorialOverlay();
}

function renderTutorialOverlay() {
  const overlay = document.getElementById('tutorial-overlay');
  if (!tutorialActive) { overlay.classList.add('hidden'); return; }

  if (tutorialPhase === 'menu') {
    if (document.getElementById('screen-menu').classList.contains('hidden')) { tutorialEnd(); return; }
  } else if (!state || state.phase === 'gameover') {
    tutorialEnd();
    return;
  }

  const steps = currentTutorialSteps();
  const step = currentTutorialStep();
  if (step.requirePhase && (!state || state.phase !== step.requirePhase)) {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');

  const callout = document.getElementById('tut-callout');
  document.getElementById('tut-callout-step').textContent = `Step ${tutorialStepIndex + 1} of ${steps.length}`;
  document.getElementById('tut-callout-text').textContent = step.text;
  const isLast = tutorialPhase === 'match' && tutorialStepIndex === steps.length - 1;
  document.getElementById('tut-callout-next').textContent = isLast ? 'Done' : 'Next →';

  const masks = ['tut-mask-top', 'tut-mask-bottom', 'tut-mask-left', 'tut-mask-right'].map(id => document.getElementById(id));
  const ring = document.getElementById('tut-highlight-ring');
  const arrow = document.getElementById('tut-callout-arrow');
  const targetEl = step.target ? step.target() : null;

  if (!targetEl) {
    masks.forEach(m => m.style.display = 'none');
    ring.style.display = 'none';
    arrow.style.display = 'none';
    callout.classList.add('centered');
    return;
  }

  callout.classList.remove('centered');
  masks.forEach(m => m.style.display = 'block');
  ring.style.display = 'block';

  const pad = 6;
  const r = targetEl.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const top = Math.max(0, r.top - pad), left = Math.max(0, r.left - pad);
  const right = Math.min(vw, r.right + pad), bottom = Math.min(vh, r.bottom + pad);

  masks[0].style.cssText = `display:block; left:0; top:0; width:${vw}px; height:${top}px;`;
  masks[1].style.cssText = `display:block; left:0; top:${bottom}px; width:${vw}px; height:${Math.max(0, vh - bottom)}px;`;
  masks[2].style.cssText = `display:block; left:0; top:${top}px; width:${left}px; height:${Math.max(0, bottom - top)}px;`;
  masks[3].style.cssText = `display:block; left:${right}px; top:${top}px; width:${Math.max(0, vw - right)}px; height:${Math.max(0, bottom - top)}px;`;
  ring.style.cssText = `display:block; left:${left}px; top:${top}px; width:${right - left}px; height:${bottom - top}px;`;

  const calloutHeight = 148;
  let calloutTop, arrowClass;
  if (bottom + calloutHeight + 16 < vh) { calloutTop = bottom + 14; arrowClass = 'top'; }
  else { calloutTop = Math.max(8, top - calloutHeight - 14); arrowClass = 'bottom'; }
  const calloutLeft = Math.min(Math.max(8, r.left), vw - 306);
  callout.style.top = calloutTop + 'px';
  callout.style.left = calloutLeft + 'px';
  arrow.style.display = 'block';
  arrow.className = arrowClass;
  arrow.style.left = Math.max(10, Math.min(260, (r.left + r.width / 2) - calloutLeft - 7)) + 'px';
}

function tutorialCheckAction(action, res) {
  if (!tutorialActive || tutorialPhase !== 'match') return;
  const step = currentTutorialStep();
  if (step.waitFor && step.waitFor(action, res)) tutorialAdvance();
}

function tutorialAdvance() {
  const steps = currentTutorialSteps();
  const step = currentTutorialStep();
  if (step.onComplete) step.onComplete();
  if (tutorialStepIndex < steps.length - 1) {
    tutorialStepIndex++;
    renderTutorialOverlay();
  } else if (tutorialPhase === 'menu') {
    startTutorialMatch();
  } else {
    tutorialEnd();
  }
}

function tutorialEnd() {
  tutorialActive = false;
  tutorialSuppressBot = false;
  document.getElementById('tutorial-overlay').classList.add('hidden');
  if (state && state.phase !== 'gameover') ensureBotActs(() => render());
}

function resetTutorialState() {
  tutorialActive = false;
  tutorialSuppressBot = false;
  document.getElementById('tutorial-overlay').classList.add('hidden');
}

document.getElementById('tut-callout-next').addEventListener('click', () => tutorialAdvance());
document.getElementById('tut-callout-skip').addEventListener('click', () => tutorialEnd());
window.addEventListener('resize', () => { if (tutorialActive) renderTutorialOverlay(); });

const LIGHTNING_SVG = '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><polygon points="14,0 2,20 11,20 8,36 24,14 13,14" fill="#fff58a" stroke="#ffe066" stroke-width="1"/></svg>';

function getSlotEl(owner, slot) {
  const boardEl = owner === localKey ? document.getElementById('player-board') : document.getElementById('opponent-board');
  return boardEl && boardEl.children[slot];
}

function spawnFloatingNumberOn(slotEl, text, kind) {
  if (!slotEl) return;
  const el = document.createElement('div');
  el.className = 'float-num float-' + kind;
  el.textContent = text;
  slotEl.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function describeSource(source) {
  if (!source) return 'unknown causes';
  if (source.kind === 'attack' || source.kind === 'queued-attack') return source.name;
  if (source.kind === 'spell') return source.name;
  if (source.kind === 'ability-onplay' || source.kind === 'ability-ondeath') return `${source.name}'s ability`;
  return source.name || 'unknown causes';
}

function spawnDeathCauseLabel(slotEl, source) {
  if (!slotEl) return;
  const label = document.createElement('div');
  label.className = 'death-cause';
  label.textContent = '☠ ' + describeSource(source);
  slotEl.appendChild(label);
  setTimeout(() => label.remove(), reducedMotion ? 900 : 1600);
}

function spawnAttackLine(fromEl, toEl, blocked) {
  if (!fromEl || !toEl || reducedMotion) return;
  const overlay = document.getElementById('attack-lines-overlay');
  const container = document.getElementById('screen-game');
  if (!overlay || !container) return;
  const cRect = container.getBoundingClientRect();
  const fRect = fromEl.getBoundingClientRect();
  const tRect = toEl.getBoundingClientRect();
  const x1 = fRect.left + fRect.width / 2 - cRect.left;
  const y1 = fRect.top + fRect.height / 2 - cRect.top;
  const x2 = tRect.left + tRect.width / 2 - cRect.left;
  const y2 = tRect.top + tRect.height / 2 - cRect.top;
  const ns = 'http://www.w3.org/2000/svg';

  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  line.setAttribute('class', 'attack-line' + (blocked ? ' blocked' : ''));
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  line.style.strokeDasharray = len;
  line.style.strokeDashoffset = len;
  overlay.appendChild(line);
  setTimeout(() => line.remove(), 550);

  const burst = document.createElementNS(ns, 'circle');
  burst.setAttribute('cx', x2); burst.setAttribute('cy', y2); burst.setAttribute('r', 3);
  burst.setAttribute('class', 'attack-impact' + (blocked ? ' blocked' : ''));
  overlay.appendChild(burst);
  setTimeout(() => burst.remove(), 500);
}

function drawLightningArc(x1, y1, x2, y2) {
  const overlay = document.getElementById('attack-lines-overlay');
  if (!overlay) return;
  const ns = 'http://www.w3.org/2000/svg';
  
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(3, Math.floor(dist / 30));
  
  const path = document.createElementNS(ns, 'path');
  let d = `M ${x1} ${y1}`;
  
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    let px = x1 + dx * t;
    let py = y1 + dy * t;
    
    const nx = -dy / dist;
    const ny = dx / dist;
    
    const offset = (Math.random() - 0.5) * 24;
    px += nx * offset;
    py += ny * offset;
    
    d += ` L ${px} ${py}`;
  }
  
  d += ` L ${x2} ${y2}`;
  path.setAttribute('d', d);
  path.setAttribute('class', 'lightning-arc-fx');
  overlay.appendChild(path);
  
  setTimeout(() => path.remove(), 600);
}

function drawArcingCurve(x1, y1, x2, y2) {
  const overlay = document.getElementById('attack-lines-overlay');
  if (!overlay) return;
  const ns = 'http://www.w3.org/2000/svg';
  
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return;
  
  // Create beautiful quadratic curve control point offset
  const nx = -dy / dist;
  const ny = dx / dist;
  const offset = dist * 0.18;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  
  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  
  // Background guide glow line
  const guide = document.createElementNS(ns, 'path');
  guide.setAttribute('d', d);
  guide.setAttribute('class', 'lightning-path-guide');
  overlay.appendChild(guide);
  
  // Foreground traveling spark line
  const spark = document.createElementNS(ns, 'path');
  spark.setAttribute('d', d);
  spark.setAttribute('class', 'lightning-path-spark');
  
  const len = Math.floor(dist * 1.15);
  spark.style.strokeDasharray = `${len}`;
  spark.style.strokeDashoffset = `${len}`;
  overlay.appendChild(spark);
  
  requestAnimationFrame(() => {
    // Force browser style evaluation
    void spark.getBoundingClientRect();
    spark.style.transition = 'stroke-dashoffset 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
    spark.style.strokeDashoffset = '0';
  });
  
  setTimeout(() => {
    guide.remove();
    spark.remove();
  }, 1200);
}

function triggerChainLightningArcs(targetOwner, targetSlot, fxList) {
  const container = document.getElementById('screen-game');
  if (!container) return;
  const cRect = container.getBoundingClientRect();

  Sound.chainLightningCrack();

  const chainDmgEvts = (fxList || []).filter(e => e.type === 'damage' && e.source && e.source.chainLightning);
  const chainBlockEvts = (fxList || []).filter(e => e.type === 'block' && e.source && e.source.chainLightning);
  const chainHealEvts = (fxList || []).filter(e => e.type === 'heal' && e.source && e.source.chainLightning);

  const activeSlots = [];
  [localKey, remoteKey].forEach(owner => {
    for (let slot = 0; slot < 5; slot++) {
      const slotEl = getSlotEl(owner, slot);
      if (slotEl && slotEl.querySelector('.card')) {
        activeSlots.push({ owner, slot, el: slotEl });
      }
    }
  });

  if (activeSlots.length === 0) return;

  if (!reducedMotion) {
    let shakeClass = 'shake-light';
    if (activeSlots.length >= 7) {
      shakeClass = 'shake-heavy';
    } else if (activeSlots.length >= 4) {
      shakeClass = 'shake-medium';
    }
    container.classList.remove('shake-light', 'shake-medium', 'shake-heavy');
    void container.offsetWidth;
    container.classList.add(shakeClass);
    setTimeout(() => {
      container.classList.remove(shakeClass);
    }, 600);
  }

  const startIdx = activeSlots.findIndex(s => s.owner === targetOwner && s.slot === targetSlot);
  let currentSlot = startIdx >= 0 ? activeSlots.splice(startIdx, 1)[0] : activeSlots.shift();
  
  if (!currentSlot) return;

  const chain = [currentSlot];
  while (activeSlots.length > 0) {
    const cRect1 = currentSlot.el.getBoundingClientRect();
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < activeSlots.length; i++) {
      const cRect2 = activeSlots[i].el.getBoundingClientRect();
      const dist = Math.hypot(cRect1.left - cRect2.left, cRect1.top - cRect2.top);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    currentSlot = activeSlots.splice(bestIdx, 1)[0];
    chain.push(currentSlot);
  }

  chain.forEach((node, idx) => {
    setTimeout(() => {
      if (idx < chain.length - 1) {
        const nextNode = chain[idx + 1];
        const r1 = node.el.getBoundingClientRect();
        const r2 = nextNode.el.getBoundingClientRect();
        
        const x1 = r1.left + r1.width / 2 - cRect.left;
        const y1 = r1.top + r1.height / 2 - cRect.top;
        const x2 = r2.left + r2.width / 2 - cRect.left;
        const y2 = r2.top + r2.height / 2 - cRect.top;
        
        drawLightningArc(x1, y1, x2, y2);
        drawArcingCurve(x1, y1, x2, y2);
      }
      spawnCastEffect(node.owner, node.slot, 'lightning', null);
      
      const dmgEvt = chainDmgEvts.find(e => e.targetOwner === node.owner && e.targetSlot === node.slot);
      const blockEvt = chainBlockEvts.find(e => e.owner === node.owner && e.slot === node.slot);
      
      if (blockEvt) {
        spawnFloatingNumberOn(node.el, 'BLOCKED', 'block');
        Sound.block();
      } else if (dmgEvt) {
        spawnFloatingNumberOn(node.el, '-' + dmgEvt.amount, 'damage');
        const cardNode = node.el.querySelector('.card');
        if (cardNode) {
          cardNode.classList.remove('anim-hit');
          void cardNode.offsetWidth;
          cardNode.classList.add('anim-hit');
          setTimeout(() => { if (cardNode.isConnected) cardNode.classList.remove('anim-hit'); }, 450);
        }
        if (dmgEvt.killed) {
          Sound.death();
          spawnFloatingNumberOn(node.el, '💀', 'damage');
          spawnDeathCauseLabel(node.el, dmgEvt.source);
        }
      }
      
      const slotEl = getSlotEl(node.owner, node.slot);
      if (slotEl) {
        slotEl.classList.remove('residual-charge');
        void slotEl.offsetWidth;
        slotEl.classList.add('residual-charge');
        setTimeout(() => slotEl.classList.remove('residual-charge'), 2000);
      }
    }, idx * 130);
  });

  const totalHitDuration = chain.length * 130;
  setTimeout(() => {
    chainHealEvts.forEach(evt => {
      const slotEl = getSlotEl(evt.targetOwner, evt.targetSlot);
      if (slotEl) {
        spawnCastEffect(evt.targetOwner, evt.targetSlot, 'cast', { text: '+' + evt.amount, kind: 'heal' });
      }
    });
  }, totalHitDuration + 150);
}

function spawnCastEffect(ownerKey, slot, kind, amount, tier) {
  const slotEl = getSlotEl(ownerKey, slot);
  if (!slotEl) return;
  if (kind === 'lightning') {
    const fx = document.createElement('div');
    fx.className = 'lightning-fx';
    fx.innerHTML = LIGHTNING_SVG;
    slotEl.appendChild(fx);
    const cardNode = slotEl.querySelector('.card');
    if (cardNode) cardNode.classList.add('spell-struck');
    setTimeout(() => fx.remove(), 550);
    Sound.lightning();
  } else if (kind === 'ability') {
    const fx = document.createElement('div');
    fx.className = 'ability-fx';
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 500);
    Sound.abilityPing();
  } else if (kind === 'chip') {
    const fx = document.createElement('div');
    fx.className = 'chip-fx';
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 450);
    Sound.chipAttach();
  } else if (kind === 'refresh') {
    const fx = document.createElement('div');
    fx.className = 'refresh-fx';
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 500);
    Sound.defend();
  } else if (kind === 'merge') {
    const fx = document.createElement('div');
    fx.className = 'merge-fx';
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 500);
    if (typeof Sound !== 'undefined' && Sound.merge) Sound.merge(tier || 2);
    vibrate([20, 25, 20]);
  } else if (kind === 'bigmerge') {
    // NEW: extra-juicy celebration for a 3-4 card fusion or any merge that
    // lands on the peak Orange tier - a bigger burst plus a ring of
    // sparkle particles flung outward from the slot.
    const fx = document.createElement('div');
    fx.className = 'merge-fx merge-fx-big';
    slotEl.appendChild(fx);
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'merge-particle';
      const angle = (360 / 8) * i;
      p.style.setProperty('--angle', angle + 'deg');
      p.style.animationDelay = (i * 0.02) + 's';
      slotEl.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
    setTimeout(() => fx.remove(), 780);
    if (typeof Sound !== 'undefined' && Sound.megaMerge) Sound.megaMerge(tier || 4);
    vibrate([25, 30, 40]);
  } else if (kind === 'defend') {
    const fx = document.createElement('div');
    fx.className = 'shield-slam-fx';
    fx.textContent = '🛡';
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 500);
  } else {
    const fx = document.createElement('div');
    fx.className = 'cast-fx';
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 600);
    Sound.heal();
  }
  if (amount) {
    spawnFloatingNumberOn(slotEl, amount.text, amount.kind);
    if (amount.kind === 'damage') {
      const cardNode = slotEl.querySelector('.card');
      if (cardNode) {
        cardNode.classList.remove('anim-hit');
        void cardNode.offsetWidth;
        cardNode.classList.add('anim-hit');
        setTimeout(() => { if (cardNode.isConnected) cardNode.classList.remove('anim-hit'); }, 450);
      }
    }
  } else if (kind === 'lightning') {
    const cardNode = slotEl.querySelector('.card');
    if (cardNode) {
      cardNode.classList.remove('anim-hit');
      void cardNode.offsetWidth;
      cardNode.classList.add('anim-hit');
      setTimeout(() => { if (cardNode.isConnected) cardNode.classList.remove('anim-hit'); }, 450);
    }
  }
}

function playFx(fxList) {
  trackDamageStats(fxList);
  (fxList || []).forEach(evt => {
    switch (evt.type) {
      case 'merge': {
        const cardCount = evt.cardCount || 2;
        const big = cardCount > 2 || evt.resultTier === 4;
        spawnCastEffect(evt.owner, evt.toSlot, big ? 'bigmerge' : 'merge', null, evt.resultTier);
        if (cardCount > 2) {
          showToast(`💥 ${cardCount}-card fusion → ${TIERS[evt.resultTier].name}!`, 2400);
          if (!tutorialActive) unlockAchievement('mega_fusion');
        } else if (evt.resultTier === 4) {
          showToast('🔶 Forged an Orange card!', 2000);
        } else if (evt.usedBlueprint) {
          showToast('🧩 Used a blueprint from your deck!', 1600);
        }
        break;
      }
      case 'chipAttach': {
        if (typeof Sound !== 'undefined' && Sound.chipAttach) Sound.chipAttach();
        let text = null;
        const parts = [];
        if (evt.dmgAmount) parts.push(`${evt.dmgAmount > 0 ? '+' : ''}${evt.dmgAmount}⚔`);
        if (evt.hpAmount) parts.push(`${evt.hpAmount > 0 ? '+' : ''}${evt.hpAmount}❤`);
        if (evt.bonusDefend) parts.push(`+${evt.bonusDefend}🛡`);
        if (parts.length) text = parts.join(' ');
        else if (evt.lifesteal) text = '🩸';
        spawnCastEffect(evt.owner, evt.slot, 'chip', text ? { text, kind: evt.hpAmount < 0 ? 'damage' : 'heal' } : null);
        break;
      }
      case 'defend': {
        spawnCastEffect(evt.owner, evt.slot, 'defend');
        break;
      }
      case 'refreshDefense': {
        if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
        spawnCastEffect(evt.owner, evt.slot, 'refresh');
        break;
      }
      case 'shieldCharge': {
        if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
        spawnFloatingNumberOn(getSlotEl(evt.owner, evt.slot), '+1🛡', 'heal');
        break;
      }
      case 'blueReplenish': {
        showToast(`🔵 Reclaimed ${evt.count} Blue card${evt.count > 1 ? 's' : ''}`, 1600);
        Sound.sparkle();
        break;
      }
      case 'chainLightning': {
        triggerChainLightningArcs(evt.targetOwner, evt.targetSlot, fxList);
        break;
      }
      case 'heal': {
        if (evt.source && evt.source.chainLightning) break;
        const kind = evt.source && evt.source.kind === 'spell' ? 'cast' : 'ability';
        spawnCastEffect(evt.targetOwner, evt.targetSlot, kind, { text: '+' + evt.amount, kind: 'heal' });
        break;
      }
      case 'block': {
        if (evt.source && evt.source.chainLightning) break;
        if (evt.source && evt.source.kind === 'attack') break;
        spawnFloatingNumberOn(getSlotEl(evt.owner, evt.slot), 'BLOCKED', 'block');
        Sound.block();
        break;
      }
      case 'damage': {
        if (evt.source && evt.source.chainLightning) break;
        if (evt.source && (evt.source.kind === 'attack' || evt.source.kind === 'queued-attack')) break;
        const slotEl = getSlotEl(evt.targetOwner, evt.targetSlot);
        const kind = evt.source && evt.source.kind === 'spell' ? 'lightning' : 'ability';
        spawnCastEffect(evt.targetOwner, evt.targetSlot, kind, evt.killed ? null : { text: '-' + evt.amount, kind: 'damage' });
        if (evt.killed) {
          Sound.death();
          spawnFloatingNumberOn(slotEl, '💀', 'damage');
          spawnDeathCauseLabel(slotEl, evt.source);
        } else if (evt.targetOwner === localKey && typeof Sound !== 'undefined' && Sound.playerDamage) {
          Sound.playerDamage();
        }
        break;
      }
      case 'selfBuff': {
        if (evt.amount === 0) break;
        if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
        // v3.11: Green Tinkerer's +1 chip slot buffs `sp`, not dmg/hp - give
        // it its own symbol instead of defaulting to the heart icon.
        const symbol = evt.stat === 'dmg' ? '⚔' : evt.stat === 'sp' ? '⛃' : '❤';
        const text = (evt.amount > 0 ? '+' : '') + evt.amount + symbol;
        spawnCastEffect(evt.owner, evt.slot, 'ability', { text, kind: evt.amount >= 0 ? 'heal' : 'damage' });
        break;
      }
      case 'discard': {
        const whose = evt.owner === localKey ? 'your' : (mode === 'bot' ? "the bot's" : "your opponent's");
        showToast(`🗑 ${evt.cardName} removed from ${whose} deck`, 1600);
        Sound.block();
        break;
      }
      case 'suddenDeath': {
        if (typeof playSuddenDeathAnimation === 'function') playSuddenDeathAnimation();
        showToast('💀 SUDDEN DEATH! All cards set to 1 HP!', 2800);
        break;
      }
      case 'hack': {
        if (typeof playHackAnimation === 'function') playHackAnimation(evt.targetOwner, evt.targetSlot);
        showToast('💻 HACK! 2 DMG dealt & allies healed!', 2000);
        break;
      }
      case 'orangeHeal': {
        if (typeof playOrangeHealAnimation === 'function') playOrangeHealAnimation(evt.targetOwner, evt.targetSlot);
        showToast('🍊 ORANGE! Card healed to full HP!', 2200);
        break;
      }
      case 'sacrificeSpell': {
        const whose = evt.owner === localKey ? 'your' : (mode === 'bot' ? "the bot's" : "your opponent's");
        showToast(`🔥 Sacrificed a spell card from ${whose} hand!`, 2000);
        break;
      }
      case 'rocketBoom': {
        if (typeof playRocketBoomAnimation === 'function') playRocketBoomAnimation(evt.targetOwner, evt.targetSlot);
        else showToast('🚀 ROCKET BOOM! Target set to 1 HP!', 2400);
        break;
      }
      case 'sanctioned': {
        if (typeof playSanctionedAnimation === 'function') playSanctionedAnimation(evt.targetOwner, evt.targetSlot);
        showToast('🔨 SANCTIONED! Target card cannot defend for entire match!', 2500);
        break;
      }
      case 'zap': {
        if (typeof playZapAnimation === 'function') playZapAnimation(evt.targetOwner, evt.targetSlot);
        showToast('⚡ ZAP! Dealt 5 DMG to enemy card!', 2000);
        break;
      }
      case 'allAura': {
        if (typeof playAllAuraAnimation === 'function') playAllAuraAnimation(evt.targetOwner, evt.targetSlot);
        showToast('✨ ALL AURA! Target cannot attack or defend for 3 turns!', 2500);
        break;
      }
      case 'sacrificeManRevive': {
        if (typeof playSacrificeManReviveAnimation === 'function') playSacrificeManReviveAnimation(evt.owner, evt.slot, evt.left);
        showToast(`🛡️ SACRIFICE MAN REVIVED! (${evt.left} uses left)`, 2200);
        break;
      }
      case 'remainsMask': {
        if (typeof playRemainsMaskAnimation === 'function') playRemainsMaskAnimation(evt.owner, evt.slot);
        showToast(`💀 REMAINS MASK! All Sacrifice Man cards fully recharged to 3 uses!`, 2500);
        break;
      }
      case 'supremeShirt': {
        if (typeof playSupremeShirtAnimation === 'function') playSupremeShirtAnimation(evt.targetOwner, evt.targetSlot);
        showToast(`🎽 SUPREME SHIRT! +2 HP, +2 DMG, +2 SP!`, 2200);
        break;
      }
      case 'reviveCard': {
        if (typeof playReviveAnimation === 'function') playReviveAnimation(evt.owner, evt.slot, evt.cardName);
        showToast(`✨ REVIVE! ${evt.cardName} brought back from the graveyard!`, 2500);
        break;
      }
      case 'skeletonStaff': {
        if (typeof playSkeletonStaffAnimation === 'function') playSkeletonStaffAnimation(evt.targetOwner, evt.targetSlot);
        showToast(`🦴 SKELETON STAFF! Target reduced to 1 HP, 1 ATK, 1 SP with no chips!`, 2500);
        break;
      }
      default: break;
    }
  });
}

function applyActionAndRender(action, { afterBotCheck } = {}) {
  if (!state) return { ok: false };
  const isReadyAttack = action.type === 'readyAttack';
  const isChainLightning = action.type === 'spell' && action.spellId === 'chainlightning';
  const snapshot = (isReadyAttack || isChainLightning) ? snapshotBoards(state) : null;

  const res = applyAction(state, action);
  if (!res.ok && action.player === localKey) showToast(res.error);
  if (res.ok) {
    logReplayAction(action);
    if (action.type === 'place') {
      const placedCard = state.players[action.player]?.board[action.slot];
      const tier = placedCard ? placedCard.tier : 1;
      Sound.cardPlace(tier);
      if (action.player === localKey) vibrate(20);
    }
    else if (action.type === 'merge') {
      const mergedCard = state.players[action.player]?.board[res.mergedSlot];
      const tier = mergedCard ? mergedCard.tier : 2;
      Sound.merge(tier);
      if (action.player === localKey) vibrate([20, 25, 20]);
    }
    else if (action.type === 'defend') Sound.defend();
    else if ((action.type === 'readyPlacement' || action.type === 'readyAttack') && action.player === localKey) Sound.ready();
  }
  // Daily Challenge / Forge Milestones progress - only for the local
  // player's own successful actions, in a real match (not the tutorial).
  if (res.ok && action.player === localKey) {
    if (action.type === 'place') {
      progressDailyChallenge('place', 1);
    } else if (action.type === 'merge') {
      progressDailyChallenge('merge', 1);
      if (!tutorialActive) {
        unlockAchievement('first_merge');
        const mergedCard = state.players[action.player]?.board[res.mergedSlot];
        if (mergedCard && mergedCard.tier === 4) unlockAchievement('first_orange');
      }
    } else if (action.type === 'defend') {
      progressDailyChallenge('defend', 1);
    }
  }
  
  if (isChainLightning && res.ok && snapshot) {
    const realBoards = {};
    state.order.forEach(k => {
      realBoards[k] = state.players[k].board;
      state.players[k].board = snapshot[k].board;
    });
    
    render();
    
    state.order.forEach(k => {
      state.players[k].board = realBoards[k];
    });
    
    playFx(res.fx);
    
    const activeCardCount = Object.values(snapshot).reduce((acc, p) => acc + (p.board || []).filter(Boolean).length, 0);
    const totalDuration = activeCardCount * 130 + 800;
    
    setTimeout(() => {
      render();
      if (afterBotCheck) ensureBotActs(() => render());
    }, totalDuration);
  } else if (isReadyAttack && res.resolved) {
    playCombatAnimation(snapshot, res.fx || [], () => {
      render();
      if (afterBotCheck) ensureBotActs(() => render());
    });
  } else {
    render();
    if (res.ok) playFx(res.fx);
    if (afterBotCheck) ensureBotActs(() => render());
  }
  return res;
}

function ensureBotActs(onDone) {
  if (mode !== 'bot' || state.phase === 'gameover') { if (onDone) onDone(); return; }
  if (tutorialActive && tutorialSuppressBot) { if (onDone) onDone(); return; }
  const key = state.phase + ':' + state.round;
  if (botActedKey === key) { if (onDone) onDone(); return; }
  botActedKey = key;
  setBotThinking(true);
  const delay = BOT_THINK_MS_MIN + Math.random() * (BOT_THINK_MS_MAX - BOT_THINK_MS_MIN);
  botThinkingTimer = setTimeout(() => {
    botThinkingTimer = null;
    setBotThinking(false);
    if (!state || state.phase === 'gameover') { if (onDone) onDone(); return; }
    if (state.phase === 'placement') {
      state._fx = [];
      runBotPlacement(state, 'bot', botDifficulty, botRng);
      playFx(state._fx);
      if (onDone) onDone();
    } else if (state.phase === 'attack') {
      const snapshot = snapshotBoards(state);
      state._fx = [];
      runBotAttack(state, 'bot', botDifficulty, botRng);
      const resolved = state.phase !== 'attack';
      if (resolved) {
        playCombatAnimation(snapshot, state._fx, () => {
          if (onDone) onDone();
          ensureBotActs(() => render());
        });
      } else {
        playFx(state._fx);
        if (onDone) onDone();
      }
    } else {
      if (onDone) onDone();
    }
  }, delay);
}

function setBotThinking(on) {
  const el = document.getElementById('bot-thinking-indicator');
  if (el) el.classList.toggle('hidden', !on);
}
function cancelBotThinking() {
  if (botThinkingTimer) { clearTimeout(botThinkingTimer); botThinkingTimer = null; }
  setBotThinking(false);
}

// ---- Multiplayer ----------------------------------------------------------
async function beginHost(wagerAmount, hostDeckConfig) {
  mode = 'mp'; localKey = 'host'; remoteKey = 'guest';
  currentWager = wagerAmount || 0;
  showScreen('screen-host');
  const seed = makeSeed();
  net = new NetSession({
    onInit: () => {},
    onApplied: (action) => applyActionAndRender(action),
    onStatus: (status) => {
      document.getElementById('host-status').textContent =
        status === 'waiting' ? 'Waiting for opponent to join…' :
        status === 'connected' ? 'Opponent connected! Finalizing match…' :
        status === 'disconnected' ? 'Opponent disconnected.' : 'Connecting…';
    },
    onGuestConfig: (guestDeckConfig) => {
      gameOverAnnounced = false;
      meteorShowerDone = false;
      epicVictoryDone = false;
      matchVictoryAnims = { host: hostDeckConfig?.victoryAnim || null, guest: guestDeckConfig?.victoryAnim || null };
      matchStartTime = Date.now();
      _lowHpWarned.clear();
      resetMatchCardStats();
      lastPlacement = null;
      state = createMatch(seed, 'host', 'guest', { host: hostDeckConfig, guest: guestDeckConfig });
      initReplayLog(seed, 'host', 'guest', { host: hostDeckConfig, guest: guestDeckConfig });
      resetSelections();
      showScreen('screen-game');
      setMatchInfo('Multiplayer · Host' + (currentWager > 0 ? ` · 💰${currentWager.toLocaleString()}` : ''), 'Host Match');
      render();
      net.sendInit();
    },
    onPeerError: (err) => {
      showToast(err.message || ('Connection error: ' + err.type));
      document.getElementById('host-status').textContent = err.message || 'Connection failed.';
      if (currentWager > 0) { addBux(currentWager); currentWager = 0; }
    },
    onForfeit: () => handleOpponentForfeit(),
  });
  try {
    const code = await net.hostGame(seed, currentWager, hostDeckConfig);
    document.getElementById('room-code').textContent = code;
  } catch (e) { showToast('Could not host: ' + e); }
}

document.getElementById('btn-join-confirm').addEventListener('click', async () => {
  const code = document.getElementById('join-code-input').value.trim();
  if (!code) return;
  mode = 'mp'; localKey = 'guest'; remoteKey = 'host';
  net = new NetSession({
    onInit: (data) => {
      gameOverAnnounced = false;
      meteorShowerDone = false;
      epicVictoryDone = false;
      matchVictoryAnims = { host: data.hostDeckConfig?.victoryAnim || null, guest: pendingGuestDeckConfig?.victoryAnim || null };
      matchStartTime = Date.now();
      currentWager = 0;
      if (data.wager && data.wager > 0) {
        if (spendBux(data.wager, true)) {
          currentWager = data.wager;
          showToast(`💰 Wager match: ${data.wager.toLocaleString()} Mehrbod Bux — good luck!`, 2600);
        } else {
          showToast("You don't have enough Mehrbod Bux to match this wager — playing without stakes.", 3200);
        }
      }
      _lowHpWarned.clear();
      resetMatchCardStats();
      lastPlacement = null;
  state = createMatch(data.seed, 'host', 'guest', { host: data.hostDeckConfig, guest: pendingGuestDeckConfig });
  initReplayLog(data.seed, 'host', 'guest', { host: data.hostDeckConfig, guest: pendingGuestDeckConfig });
      resetSelections();
      showScreen('screen-game');
      setMatchInfo('Multiplayer · Guest' + (currentWager > 0 ? ` · 💰${currentWager.toLocaleString()}` : ''), 'Guest Match');
      render();
    },
    onApplied: (action) => applyActionAndRender(action),
    onStatus: (status) => {
      document.getElementById('join-status').textContent =
        status === 'connected' ? 'Connected! Waiting for match data…' :
        status === 'disconnected' ? 'Host disconnected.' : 'Connecting…';
    },
    onPeerError: (err) => { document.getElementById('join-status').textContent = err.message || ('Error: ' + err.type); },
    onForfeit: () => handleOpponentForfeit(),
  });
  try { await net.joinGame(code, pendingGuestDeckConfig); } catch (e) { /* status already shown */ }
});

// NEW: pressing Enter while typing a room code submits it, same as tapping
// Connect - saves a reach-for-the-button trip on both desktop and mobile.
document.getElementById('join-code-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btn-join-confirm').click();
  }
});

let matchmakingRoomCode = null;
let matchmakingIsHost = false;

async function beginMatchmaking(deckConfig) {
  showScreen('screen-matchmaking');
  document.getElementById('matchmaking-status').textContent = 'Connecting to matchmaking server...';
  
  matchmakingRoomCode = null;
  matchmakingIsHost = false;
  
  try {
    let matchedLobby = null;

    // 1. Try Firebase Firestore matchmaking discovery
    if (typeof FirebaseMatchmaking !== 'undefined' && FirebaseMatchmaking.isAvailable()) {
      try {
        document.getElementById('matchmaking-status').textContent = 'Searching for open public matches...';
        matchedLobby = await FirebaseMatchmaking.findAndClaimLobby();
      } catch (fbErr) {
        console.warn('[Firebase Matchmaking] Search error, checking fallback:', fbErr);
      }
    }

    // 2. If no Firebase lobby found, check local API fallback if available
    if (!matchedLobby) {
      try {
        const joinRes = await fetch('/api/matchmaking/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (joinRes.ok) {
          const joinData = await joinRes.json();
          if (joinData && joinData.matchFound && joinData.roomCode) {
            matchedLobby = { roomCode: joinData.roomCode };
          }
        }
      } catch (apiErr) {
        // Fallback API unavailable - proceed to host
      }
    }
    
    if (matchedLobby && matchedLobby.roomCode) {
      document.getElementById('matchmaking-status').textContent = 'Match found! Establishing direct P2P connection...';
      matchmakingRoomCode = matchedLobby.roomCode;
      matchmakingIsHost = false;
      
      mode = 'mp'; localKey = 'guest'; remoteKey = 'host';
      pendingGuestDeckConfig = deckConfig;
      
      net = new NetSession({
        onInit: (data) => {
          gameOverAnnounced = false;
          meteorShowerDone = false;
          epicVictoryDone = false;
          matchVictoryAnims = { host: data.hostDeckConfig?.victoryAnim || null, guest: pendingGuestDeckConfig?.victoryAnim || null };
          matchStartTime = Date.now();
          currentWager = 0;
          _lowHpWarned.clear();
          resetMatchCardStats();
          lastPlacement = null;
          state = createMatch(data.seed, 'host', 'guest', { host: data.hostDeckConfig, guest: pendingGuestDeckConfig });
          initReplayLog(data.seed, 'host', 'guest', { host: data.hostDeckConfig, guest: pendingGuestDeckConfig });
          resetSelections();
          showScreen('screen-game');
          setMatchInfo('Multiplayer · Public Match (P2P)', 'Public Match');
          render();
        },
        onApplied: (action) => applyActionAndRender(action),
        onStatus: (status) => {
          document.getElementById('matchmaking-status').textContent =
            status === 'connected' ? 'Connected via P2P! Handshaking match data...' :
            status === 'disconnected' ? 'Match disconnected.' : 'Connecting to peer...';
        },
        onPeerError: (err) => {
          console.warn('Guest connection failed, transitioning to host fallback...', err);
          document.getElementById('matchmaking-status').textContent = 'Matched lobby went offline. Creating fresh lobby...';
          if (net) { net.destroy(); net = null; }
          startHostingMatchmaking(deckConfig);
        },
        onForfeit: () => handleOpponentForfeit(),
      });
      
      try {
        await net.joinGame(matchmakingRoomCode, pendingGuestDeckConfig);
      } catch (err) {
        console.warn('joinGame failed, falling back to host lobby:', err);
        if (net) { net.destroy(); net = null; }
        await startHostingMatchmaking(deckConfig);
      }
    } else {
      await startHostingMatchmaking(deckConfig);
    }
  } catch (err) {
    document.getElementById('matchmaking-status').textContent = 'Failed to connect to matchmaking: ' + (err.message || err);
    showToast('Matchmaking error: ' + (err.message || err));
  }
}

async function startHostingMatchmaking(deckConfig) {
  document.getElementById('matchmaking-status').textContent = 'Creating public lobby...';
  matchmakingIsHost = true;
  mode = 'mp'; localKey = 'host'; remoteKey = 'guest';
  currentWager = 0;
  
  const seed = makeSeed();
  net = new NetSession({
    onInit: () => {},
    onApplied: (action) => applyActionAndRender(action),
    onStatus: (status) => {
      document.getElementById('matchmaking-status').textContent =
        status === 'waiting' ? 'Lobby registered! Waiting for another player...' :
        status === 'connected' ? 'Player found! Instantiating direct P2P battle...' :
        status === 'disconnected' ? 'Player disconnected.' : 'Connecting...';
    },
    onGuestConfig: (guestDeckConfig) => {
      gameOverAnnounced = false;
      meteorShowerDone = false;
      epicVictoryDone = false;
      matchVictoryAnims = { host: deckConfig?.victoryAnim || null, guest: guestDeckConfig?.victoryAnim || null };
      matchStartTime = Date.now();
      _lowHpWarned.clear();
      resetMatchCardStats();
      lastPlacement = null;
      state = createMatch(seed, 'host', 'guest', { host: deckConfig, guest: guestDeckConfig });
      initReplayLog(seed, 'host', 'guest', { host: deckConfig, guest: guestDeckConfig });
      resetSelections();
      showScreen('screen-game');
      setMatchInfo('Multiplayer · Public Match (P2P)', 'Public Match');
      render();
      net.sendInit();

      // Once connected via direct P2P, deregister from Firebase lobby list
      if (typeof FirebaseMatchmaking !== 'undefined' && matchmakingRoomCode) {
        FirebaseMatchmaking.cancelLobby(matchmakingRoomCode).catch(() => {});
      }
    },
    onPeerError: (err) => {
      document.getElementById('matchmaking-status').textContent = err.message || ('Connection failed: ' + err.type);
      setTimeout(() => {
        if (!document.getElementById('screen-matchmaking').classList.contains('hidden')) {
          cancelMatchmaking();
        }
      }, 3000);
    },
    onForfeit: () => handleOpponentForfeit(),
  });
  
  try {
    const code = await net.hostGame(seed, 0, deckConfig);
    matchmakingRoomCode = code;
    
    // Register in Firebase Firestore
    if (typeof FirebaseMatchmaking !== 'undefined' && FirebaseMatchmaking.isAvailable()) {
      try {
        await FirebaseMatchmaking.registerLobby(code);
      } catch (fbErr) {
        console.warn('[Firebase Matchmaking] Failed to register in Firebase:', fbErr);
      }
    }

    // Also register on local API
    try {
      await fetch('/api/matchmaking/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code })
      });
    } catch (apiErr) {
      // Non-critical if Firebase is active
    }
  } catch (e) {
    document.getElementById('matchmaking-status').textContent = 'Failed to create public lobby.';
    showToast('Matchmaking host error: ' + e);
  }
}

async function cancelMatchmaking() {
  if (matchmakingIsHost && matchmakingRoomCode) {
    if (typeof FirebaseMatchmaking !== 'undefined') {
      try {
        await FirebaseMatchmaking.cancelLobby(matchmakingRoomCode);
      } catch (e) {
        console.warn('Could not deregister Firebase lobby: ', e);
      }
    }
    try {
      await fetch('/api/matchmaking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: matchmakingRoomCode })
      });
    } catch (e) {
      // Ignored
    }
  }
  
  if (net) {
    net.destroy();
    net = null;
  }
  
  matchmakingRoomCode = null;
  matchmakingIsHost = false;
  showScreen('screen-multiplayer');
}

// ---- Action dispatch --------------------------------------------------------
function dispatch(action) {
  action.player = localKey;
  if (mode === 'mp') {
    net.submitAction(action);
  } else {
    const res = applyActionAndRender(action, { afterBotCheck: true });
    if (res && res.ok) {
      // Track undo eligibility for the local player's own successful
      // actions only: a fresh placement becomes the (single) undoable
      // action; literally anything else invalidates it, since undo only
      // ever wants to reverse the MOST RECENT placement.
      if (action.type === 'place') lastPlacement = { slot: action.slot };
      else lastPlacement = null;
    }
    if (tutorialActive) tutorialCheckAction(action, res);
  }
}

// Reverses the local player's most recent placement (see the doc comment
// on `lastPlacement` above for why this is always safe to do).
function undoLastPlacement() {
  if (!lastPlacement || mode !== 'bot' || !state || state.phase !== 'placement') return;
  const p = state.players[localKey];
  const { slot } = lastPlacement;
  const card = p.board[slot];
  lastPlacement = null;
  if (!card) { render(); return; }
  p.board[slot] = null;
  p.deck.push(card);
  if (typeof Sound !== 'undefined' && Sound.undo) Sound.undo();
  showToast('↩️ Placement undone', 1400);
  render();
}
document.getElementById('btn-undo-placement').addEventListener('click', undoLastPlacement);

// ---- Selections -------------------------------------------------------------
function resetSelections() {
  selMode = null; selHandIdx = null; selAttackerSlot = null;
  selSpellId = null; selChipId = null; selMergeSlots = [];
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  if (!btn.dataset.mode) return; // skip non-mode mode-btn-styled buttons (mute/motion/themes/wager presets etc.)
  btn.addEventListener('click', () => {
    const m = btn.dataset.mode;
    const wasActive = selMode === m;
    resetSelections();
    selMode = wasActive ? null : m;
    if (selMode === 'merge') Sound.select();
    render();
  });
});

// ---- NEW FEATURE: Combine mode - merge 2-4 cards in a single fusion -------
// Tapping the 🧬 Combine mode-button, then tapping 2-4 of your own board
// cards, then Confirm, merges them all at once (e.g. four Blues straight
// into an Orange) - see mergeCards() in game.js for the underlying rule.
document.getElementById('btn-confirm-merge').addEventListener('click', () => {
  if (!state || selMode !== 'merge' || selMergeSlots.length < 2) return;
  const p = state.players[localKey];
  const slots = selMergeSlots.slice();
  const cards = slots.map(s => p.board[s]).filter(Boolean);
  if (cards.length !== slots.length) { showToast('One of the selected cards is no longer there.'); selMergeSlots = []; render(); return; }
  const sum = cards.reduce((s, c) => s + c.tier, 0);
  if (sum < 2 || sum > 4) { showToast("That combination doesn't add up to a valid tier (2, 3, or 4)."); return; }
  const deck = p.deck;
  const candidateIndices = deck.map((c, i) => (c.tier === sum ? i : -1)).filter(i => i >= 0);
  if (candidateIndices.length === 0) {
    showToast(`You need a ${TIERS[sum].name} card in your deck to merge into that tier - you're out.`);
    return;
  }
  const finish = (blueprintIndex) => {
    dispatch({ type: 'merge', slots, blueprintIndex });
    selMergeSlots = [];
    selMode = null;
    render();
  };
  if (candidateIndices.length > 1) {
    const candidates = candidateIndices.map(i => deck[i]);
    promptBlueprintChoice(candidates, candidateIndices, (chosenIndex) => {
      if (chosenIndex != null) finish(chosenIndex);
      else render();
    });
  } else {
    finish(candidateIndices[0]);
  }
});

function pressReady() {
  if (!state || state.phase === 'gameover' || animatingCombat) return;
  if (state.phase === 'placement') dispatch({ type: 'readyPlacement' });
  else if (state.phase === 'attack') dispatch({ type: 'readyAttack' });
  resetSelections();
}
document.getElementById('btn-ready').addEventListener('click', pressReady);

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || mode === 'replay') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const gameScreen = document.getElementById('screen-game');
  if (!gameScreen || gameScreen.classList.contains('hidden')) return;

  const key = e.key.toLowerCase();
  if (key === 'r') {
    e.preventDefault();
    pressReady();
  } else if (key === 'u') {
    e.preventDefault();
    const undoBtn = document.getElementById('btn-undo-placement');
    if (undoBtn && !undoBtn.classList.contains('hidden')) {
      undoLastPlacement();
    }
  } else if (key === 'm') {
    e.preventDefault();
    const confirmBtn = document.getElementById('btn-confirm-merge');
    if (selMode === 'merge' && selMergeSlots.length >= 2 && confirmBtn && !confirmBtn.classList.contains('hidden')) {
      confirmBtn.click();
    } else {
      const wasActive = selMode === 'merge';
      resetSelections();
      selMode = wasActive ? null : 'merge';
      if (selMode === 'merge') Sound.select();
      render();
    }
  }
});

document.getElementById('btn-log-toggle').addEventListener('click', () => {
  logVisible = !logVisible;
  document.getElementById('log-panel').classList.toggle('hidden', !logVisible);
  render();
});

function triggerEmote(owner, emoji) {
  const isLocal = owner === localKey;
  const targetBoard = isLocal ? document.getElementById('player-board') : document.getElementById('opponent-board');
  const gameScreen = document.getElementById('screen-game');
  if (!targetBoard || !gameScreen) return;
  
  const bubble = document.createElement('div');
  bubble.className = 'emote-bubble';
  bubble.textContent = emoji;
  
  if (emoji.length > 3) {
    bubble.classList.add('text-bubble');
    bubble.style.fontSize = '0.92rem';
    bubble.style.fontWeight = '700';
    bubble.style.borderRadius = '12px';
    bubble.style.fontFamily = 'var(--font-display)';
  }
  
  const rect = targetBoard.getBoundingClientRect();
  const gameRect = gameScreen.getBoundingClientRect();
  
  bubble.style.left = `${Math.max(20, Math.min(gameRect.width - 60, (rect.left + rect.width / 2 - gameRect.left) - 20))}px`;
  bubble.style.top = `${Math.max(10, (rect.top - gameRect.top + (isLocal ? -20 : 10)))}px`;
  
  gameScreen.appendChild(bubble);
  setTimeout(() => bubble.remove(), 1800);
  
  Sound.select();
  vibrate(10);
  
  if (isLocal && mode === 'mp' && net) {
    net.sendEmote(emoji);
  }
  
  if (isLocal && mode === 'bot' && Math.random() < 0.8) {
    let botPick;
    if (emoji === 'Good luck!') {
      const luckyReplies = ['Thanks, you too! 🍀', 'Good luck! ⚔️', 'Let the best deck win! 🤝'];
      botPick = luckyReplies[Math.floor(Math.random() * luckyReplies.length)];
    } else if (emoji === 'Well played!') {
      const wpReplies = ['Well played! 🤝', 'Thank you! 👏', 'Close match! 🔥'];
      botPick = wpReplies[Math.floor(Math.random() * wpReplies.length)];
    } else if (emoji === 'Nice move!') {
      const nmReplies = ['Thanks! ⚡', 'Haha, thanks! 😅', 'You too! 👏'];
      botPick = nmReplies[Math.floor(Math.random() * nmReplies.length)];
    } else if (emoji === 'Oops!') {
      const oopsReplies = ['Oops! 😅', 'No worries!', 'Calculated! 😎'];
      botPick = oopsReplies[Math.floor(Math.random() * oopsReplies.length)];
    } else {
      const botEmotes = ['⚔️', '🛡️', '🔥', '👏', '💀', '🤖'];
      botPick = botEmotes[Math.floor(Math.random() * botEmotes.length)];
    }
    setTimeout(() => {
      triggerEmote(remoteKey, botPick);
    }, 600 + Math.random() * 800);
  }
}

const emoteToggleBtn = document.getElementById('btn-emote-toggle');
const emotesPopover = document.getElementById('emotes-popover');

if (emoteToggleBtn && emotesPopover) {
  const togglePopover = (e) => {
    e.stopPropagation();
    e.preventDefault();
    emotesPopover.classList.toggle('hidden');
  };

  emoteToggleBtn.addEventListener('click', togglePopover);
  emoteToggleBtn.addEventListener('touchend', togglePopover, { passive: false });

  document.addEventListener('pointerdown', (e) => {
    if (!emotesPopover.classList.contains('hidden')) {
      const wrapper = document.getElementById('emote-picker-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        emotesPopover.classList.add('hidden');
      }
    }
  });
}

const handleEmoteItem = (e) => {
  e.stopPropagation();
  e.preventDefault();
  const emote = e.currentTarget.dataset.emote;
  const phrase = e.currentTarget.dataset.phrase;
  if (emote) triggerEmote(localKey, emote);
  if (phrase) triggerEmote(localKey, phrase);
  if (emotesPopover) emotesPopover.classList.add('hidden');
};

document.querySelectorAll('.emote-btn, .quick-chat-btn').forEach(btn => {
  btn.addEventListener('click', handleEmoteItem);
  btn.addEventListener('touchend', handleEmoteItem, { passive: false });
});

document.getElementById('btn-rematch').addEventListener('click', () => {
  document.getElementById('gameover-overlay').classList.add('hidden');
  document.getElementById('gameover-card').querySelectorAll('.confetti-piece').forEach(el => el.remove());
  cancelBotThinking();
  if (net) { net.destroy(); net = null; }
  state = null;
  showScreen('screen-menu');
});
document.getElementById('btn-play-again').addEventListener('click', () => {
  document.getElementById('gameover-overlay').classList.add('hidden');
  document.getElementById('gameover-card').querySelectorAll('.confetti-piece').forEach(el => el.remove());
  cancelBotThinking();
  // NEW FEATURE: Same Deck Rematch - reuse the exact deck you built last
  // time instead of falling back to a random one.
  startVsBot(0, lastVsBotDeckConfig);
});

// ---- Options modal ----------------------------------------------------------
function openOptions() {
  const inMatch = !!state && state.phase !== 'gameover';
  const isReplay = mode === 'replay';
  
  const quitSection = document.getElementById('quit-match-section');
  quitSection.classList.toggle('hidden', !inMatch && !isReplay);
  
  if (inMatch || isReplay) {
    const quitP = quitSection.querySelector('p');
    const quitBtn = document.getElementById('btn-quit-match');
    if (isReplay) {
      quitP.textContent = 'Leave the replay and return to the menu.';
      quitBtn.textContent = 'Close Replay';
      quitBtn.classList.remove('danger');
    } else {
      quitP.textContent = 'Leaving now forfeits the match.';
      quitBtn.textContent = 'Quit Match';
      quitBtn.classList.add('danger');
    }
  }
  
  const resetSection = document.getElementById('reset-progress-section');
  if (resetSection) resetSection.classList.toggle('hidden', inMatch || isReplay);
  const splashToggle = document.getElementById('btn-splash-toggle');
  if (splashToggle) splashToggle.classList.toggle('hidden', inMatch || isReplay);
  document.getElementById('options-overlay').classList.remove('hidden');
  if (typeof Sound !== 'undefined' && Sound.modalOpen) Sound.modalOpen();
}
document.getElementById('btn-options').addEventListener('click', openOptions);
document.getElementById('btn-open-settings-menu').addEventListener('click', openOptions);
document.getElementById('btn-options-close').addEventListener('click', () => {
  document.getElementById('options-overlay').classList.add('hidden');
  if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
});
document.getElementById('options-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'options-overlay') {
    document.getElementById('options-overlay').classList.add('hidden');
    if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
  }
});
let _activeConfirmCleanup = null;
function showConfirmDialog({ kicker = 'CONFIRMATION', title = 'Are you sure?', message = '', okText = 'Confirm', cancelText = 'Cancel', danger = true, onConfirm, onCancel }) {
  const overlay = document.getElementById('confirm-overlay');
  const kickerEl = document.getElementById('confirm-kicker');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  let okBtn = document.getElementById('btn-confirm-ok');
  let cancelBtn = document.getElementById('btn-confirm-cancel');
  let closeBtn = document.getElementById('btn-confirm-close');

  if (!overlay || !okBtn) {
    if (onConfirm) onConfirm();
    return;
  }

  // If a dialog was already open, clean up its previous listeners first
  if (typeof _activeConfirmCleanup === 'function') {
    _activeConfirmCleanup();
    _activeConfirmCleanup = null;
  }

  // Clone action buttons to strip any prior accumulated listeners
  const newOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  okBtn = newOk;

  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  cancelBtn = newCancel;

  const newClose = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newClose, closeBtn);
  closeBtn = newClose;

  if (kickerEl) kickerEl.textContent = kicker;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  okBtn.textContent = okText;
  okBtn.className = `primary-btn ${danger ? 'danger' : ''}`;
  cancelBtn.textContent = cancelText;

  let closed = false;
  const doClose = () => {
    if (closed) return;
    closed = true;
    overlay.classList.add('hidden');
    document.removeEventListener('keydown', handleKeydown, true);
    overlay.removeEventListener('click', handleBackdrop);
    _activeConfirmCleanup = null;
  };

  const handleOk = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    doClose();
    if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
    if (onConfirm) {
      try { onConfirm(); } catch (err) { console.error('Error in confirm action:', err); }
    }
  };

  const handleCancel = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    doClose();
    if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
    if (onCancel) {
      try { onCancel(); } catch (err) { console.error('Error in cancel action:', err); }
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === overlay) handleCancel(e);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      handleCancel(e);
    } else if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      handleOk(e);
    }
  };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  overlay.addEventListener('click', handleBackdrop);
  document.addEventListener('keydown', handleKeydown, true);

  _activeConfirmCleanup = doClose;

  overlay.classList.remove('hidden');
}

function quitCurrentMatch() {
  const midMatch = state && state.phase !== 'gameover';
  const optionsOverlay = document.getElementById('options-overlay');
  if (optionsOverlay) optionsOverlay.classList.add('hidden');
  const confirmOverlay = document.getElementById('confirm-overlay');
  if (confirmOverlay) confirmOverlay.classList.add('hidden');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  if (gameoverOverlay) gameoverOverlay.classList.add('hidden');

  cancelBotThinking();
  resetTutorialState();
  if (net && mode === 'mp' && midMatch) {
    try { net.sendForfeit(); } catch (e) {}
  }
  if (net) {
    try { net.destroy(); } catch (e) {}
    net = null;
  }
  currentWager = 0;
  state = null;
  if (typeof trialTowerActive !== 'undefined') trialTowerActive = false;

  const wasReplay = (mode === 'replay');
  showScreen('screen-menu');
  showToast(wasReplay ? '⏹ Replay closed.' : '🏳️ Match forfeited.');
}

function promptQuitMatch() {
  const midMatch = state && state.phase !== 'gameover';
  if (!midMatch || mode === 'replay') {
    quitCurrentMatch();
    return;
  }
  showConfirmDialog({
    kicker: 'FORFEIT MATCH',
    title: 'Quit this match?',
    message: 'Leaving now forfeits the match and returns to the menu. Your progress in this match will be lost.',
    okText: 'Quit Match',
    cancelText: 'Keep Playing',
    danger: true,
    onConfirm: () => {
      quitCurrentMatch();
    }
  });
}

document.getElementById('btn-quit-match').addEventListener('click', promptQuitMatch);

function handleOpponentForfeit() {
  if (!state || state.phase === 'gameover') return;
  state.phase = 'gameover';
  state.winner = localKey;
  state.forfeited = true;
  pushLog(state, `${remoteKey} forfeited the match.`);
  render();
}

// ---- Click delegation on the game screen ------------------------------------
document.getElementById('screen-game').addEventListener('click', (e) => {
  if (mode === 'replay') return;
  if (!state || state.phase === 'gameover') return;
  if (suppressNextClick) { suppressNextClick = false; return; }

  const handCardEl = e.target.closest('[data-role="hand-card"]');
  const spellEl = e.target.closest('[data-role="spell"]');
  const chipEl = e.target.closest('[data-role="chip"]');
  const slotEl = e.target.closest('.slot');

  if (handCardEl) {
    if (state.phase !== 'placement') return;
    const idx = Number(handCardEl.dataset.handIdx);
    selMode = null; selSpellId = null; selChipId = null; selAttackerSlot = null; selMergeSlots = [];
    selHandIdx = (selHandIdx === idx) ? null : idx;
    if (selHandIdx !== null && typeof Sound !== 'undefined') {
      const card = state.players[localKey]?.deck[idx];
      const tier = card ? card.tier : 1;
      if (Sound.cardSelect) Sound.cardSelect(tier);
    }
    render();
    return;
  }

  if (spellEl) {
    const id = spellEl.dataset.spellId;
    resetSelections();
    selSpellId = id;
    if (typeof Sound !== 'undefined' && Sound.spellSelect) Sound.spellSelect();
    render();
    return;
  }

  if (chipEl) {
    const id = chipEl.dataset.chipId;
    resetSelections();
    selChipId = id;
    if (typeof Sound !== 'undefined' && Sound.chipSelect) Sound.chipSelect();
    render();
    return;
  }

  if (slotEl) {
    e.stopPropagation();
    const owner = slotEl.dataset.owner;
    const slot = Number(slotEl.dataset.slot);
    const isMine = owner === localKey;
    const p = state.players[owner];
    const card = p.board[slot];

    // NEW FEATURE: Combine mode - tapping own cards toggles them in/out of
    // the current multi-card merge selection (2-4 cards).
    if (selMode === 'merge') {
      if (!isMine) { showToast('Combine mode only selects your own cards.'); return; }
      if (!card) return;
      const idx = selMergeSlots.indexOf(slot);
      if (idx !== -1) {
        selMergeSlots.splice(idx, 1);
      } else {
        if (card.tier === 4) { showToast('Orange is already the highest tier and cannot merge with anything.'); return; }
        if (selMergeSlots.length >= 4) { showToast('You can combine at most 4 cards in one fusion.'); return; }
        selMergeSlots.push(slot);
        if (typeof Sound !== 'undefined') {
          if (Sound.tierChime) Sound.tierChime(card.tier);
          else if (Sound.select) Sound.select();
        }
      }
      render();
      return;
    }

    if (selSpellId) {
      const activeSpell = state.players[localKey]?.spells.find(s => s.id === selSpellId);
      const isRevive = activeSpell && (activeSpell.reviveSpell || activeSpell.defId === 'revivespell');
      if (isRevive) {
        if (!isMine) { showToast('Revive Spell must target an empty slot on your own board.'); return; }
        if (card) { showToast('Choose an empty slot on your board to revive a card into.'); return; }
      } else {
        if (!card) return;
      }
      dispatch({ type: 'spell', spellId: selSpellId, targetOwner: owner, targetSlot: slot });
      resetSelections(); render(); return;
    }
    if (selChipId) {
      if (!card || !isMine) { showToast('Chips only attach to your own cards.'); return; }
      dispatch({ type: 'chip', chipId: selChipId, targetOwner: owner, targetSlot: slot });
      resetSelections(); render(); return;
    }
    if (selMode === 'defend') {
      if (!card || !isMine) return;
      if (state.players[localKey].defendingSlots[slot]) {
        dispatch({ type: 'cancelDefend', slot });
        if (typeof Sound !== 'undefined' && Sound.undo) Sound.undo();
      } else {
        dispatch({ type: 'defend', slot });
      }
      render(); return;
    }
    if (selHandIdx !== null) {
      if (!isMine || card) { showToast('Choose an empty slot on your own board.'); return; }
      dispatch({ type: 'place', handIndex: selHandIdx, slot });
      resetSelections(); render(); return;
    }
    if (state.phase === 'attack') {
      if (selAttackerSlot === null) {
        if (!card || !isMine) return;
        if (state.players[localKey].defendingSlots[slot]) { showToast('This card is defending and cannot attack.'); return; }
        selAttackerSlot = slot;
        if (typeof Sound !== 'undefined' && Sound.cardSelect) Sound.cardSelect();
        render(); return;
      } else {
        if (isMine) {
          if (card && !state.players[localKey].defendingSlots[slot]) {
            selAttackerSlot = slot;
            if (typeof Sound !== 'undefined' && Sound.cardSelect) Sound.cardSelect();
            render();
          }
          return;
        }
        if (!card) return;
        dispatch({ type: 'attack', slot: selAttackerSlot, targetOwner: owner, targetSlot: slot });
        if (typeof Sound !== 'undefined' && Sound.cardSelect) Sound.cardSelect();
        selAttackerSlot = null; render(); return;
      }
    }
    if (state.phase === 'placement' && isMine && card) {
      showToast('Tap Defend below, then tap this card to defend with it — or Combine to fuse it with others.');
    }
  }
});

// ---- Render -------------------------------------------------------------
function snapshotBoards(state) {
  const snap = {};
  state.order.forEach(k => {
    const p = state.players[k];
    snap[k] = {
      board: p.board.map(c => (c ? { ...c } : null)),
      attackAssignments: { ...p.attackAssignments },
      defendingSlots: { ...p.defendingSlots },
    };
  });
  return snap;
}

let combatAnimTimer = null;
function playCombatAnimation(snapshot, fx, doneCallback, playbackSpeedModifier = 1) {
  animatingCombat = true;
  if (combatAnimTimer) clearTimeout(combatAnimTimer);
  fx = fx || [];
  trackDamageStats(fx);

  // ---- NEW FEATURE: Kill Combo callout ----
  // If 2+ of the LOCAL player's own attacks land a kill in this same
  // simultaneous resolution, call it out - a nice little dopamine hit that
  // also makes it obvious multiple things died at once.
  const localKillCount = fx.filter(e => e.type === 'damage' && e.killed && e.source
    && e.source.owner === localKey && (e.source.kind === 'attack' || e.source.kind === 'queued-attack')).length;
  if (localKillCount >= 2) {
    const comboLabel = localKillCount === 2 ? 'DOUBLE KILL!' : localKillCount === 3 ? 'TRIPLE KILL!' : `${localKillCount}x KILL COMBO!`;
    showToast(`🔥 ${comboLabel}`, 2600);
    Sound.sparkle();
  }

  const dmgByTarget = {}, blockByTarget = {};
  fx.forEach(evt => {
    if (evt.type === 'damage') dmgByTarget[evt.targetOwner + '|' + evt.targetSlot] = evt;
    else if (evt.type === 'block') blockByTarget[evt.owner + '|' + evt.slot] = evt;
  });

  // BUGFIX (perceived "cards randomly disappear" report): a card can be
  // killed by a *queued* attack - one whose original attacker died to a
  // spell/chip mid-attack-phase last round, so the hit itself lands at the
  // very start of THIS round instead. That's a real, working mechanic
  // (see startPlacementPhase in game.js), but it used to resolve totally
  // silently, folded invisibly into this same combat animation with no
  // indication of what just happened - to a player it looked exactly like
  // a card vanishing for no reason. Surface it explicitly so it reads as
  // "a delayed hit landed", not "a bug ate my card".
  const queuedAttackEvents = fx.filter(e => e.source && e.source.kind === 'queued-attack' && (e.type === 'damage' || e.type === 'block'));
  if (queuedAttackEvents.length) {
    const names = [...new Set(queuedAttackEvents.map(e => e.source.name))];
    showToast(`⏳ Delayed attack lands: ${names.join(', ')} finally connects from last round.`, 2800);
  }

  const anyAttacks = fx.some(e => e.source && (e.source.kind === 'attack' || e.source.kind === 'queued-attack'));
  if (anyAttacks) {
    Sound.attack();
    if (typeof Sound !== 'undefined' && Sound.combatClash) Sound.combatClash();
    vibrate(15);
    if (!reducedMotion) {
      const screenEl = document.getElementById('screen-game');
      screenEl.classList.add('screen-shake');
      setTimeout(() => screenEl.classList.remove('screen-shake'), 400);
    }
  }

  let anyDeaths = false;
  const lineJobs = [];

  [[document.getElementById('opponent-board'), remoteKey], [document.getElementById('player-board'), localKey]]
    .forEach(([container, key]) => {
      container.innerHTML = '';
      const snap = snapshot[key];
      const liveBoard = state.players[key].board;
      snap.board.forEach((card, slot) => {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        if (card) {
          const fxKey = key + '|' + slot;
          const dmgEvt = dmgByTarget[fxKey];
          const blockEvt = blockByTarget[fxKey];
          const died = !liveBoard[slot];
          const el = cardEl(card, {
            owner: key, slot,
            attackAnim: !!snap.attackAssignments[slot],
            deathAnim: died,
            hitAnim: !!dmgEvt && !died,
          });
          slotEl.appendChild(el);

          if (blockEvt) {
            spawnFloatingNumberOn(slotEl, 'BLOCKED', 'block');
          } else if (dmgEvt) {
            if (dmgEvt.killed) {
              anyDeaths = true;
              spawnFloatingNumberOn(slotEl, '💀', 'damage');
              spawnDeathCauseLabel(slotEl, dmgEvt.source);
            } else if (dmgEvt.amount > 0) {
              spawnFloatingNumberOn(slotEl, '-' + dmgEvt.amount, 'damage');
            }
          }

          const activeEvt = dmgEvt || blockEvt;
          const srcKind = activeEvt && activeEvt.source && activeEvt.source.kind;
          if (activeEvt && (srcKind === 'attack' || srcKind === 'queued-attack') && activeEvt.source.slot != null) {
            lineJobs.push({ fromOwner: activeEvt.source.owner, fromSlot: activeEvt.source.slot, toOwner: key, toSlot: slot, blocked: !!blockEvt });
          }
        }
        container.appendChild(slotEl);
      });
    });

  if (anyDeaths) { Sound.death(); vibrate(35); }

  if (!reducedMotion && lineJobs.length) {
    requestAnimationFrame(() => {
      lineJobs.forEach(job => {
        spawnAttackLine(getSlotEl(job.fromOwner, job.fromSlot), getSlotEl(job.toOwner, job.toSlot), job.blocked);
      });
    });
  }

  combatAnimTimer = setTimeout(() => { animatingCombat = false; doneCallback(); }, (reducedMotion ? 150 : COMBAT_ANIM_MS) / playbackSpeedModifier);
}

let _lastRenderedPhaseRound = null;
function render() {
  if (!state) return;
  
  const currentPR = state.phase + ':' + state.round;
  if (_lastRenderedPhaseRound !== currentPR) {
    const wasInitial = _lastRenderedPhaseRound === null;
    _lastRenderedPhaseRound = currentPR;
    if (!wasInitial && state.phase === 'placement' && typeof Sound !== 'undefined' && Sound.turnStart) {
      Sound.turnStart();
    }
  }

  const gameScreen = document.getElementById('screen-game');
  if (gameScreen) {
    gameScreen.classList.toggle('phase-placement', state.phase === 'placement');
    gameScreen.classList.toggle('phase-attack', state.phase === 'attack');
  }

  document.getElementById('phase-label').textContent = state.phase === 'placement' ? 'Placement' : state.phase === 'attack' ? 'Attack' : 'Game Over';
  document.getElementById('round-label').textContent = `Round ${state.round}`;

  const readyField = state.phase === 'attack' ? 'readyAttack' : 'readyPlacement';
  const youBadge = document.getElementById('you-ready-badge');
  const oppBadge = document.getElementById('opp-ready-badge');
  const youAvatarInner = document.getElementById('you-avatar-inner');
  const oppAvatarInner = document.getElementById('opp-avatar-inner');

  const youReady = !!state.players[localKey][readyField];
  const oppReady = !!state.players[remoteKey][readyField];

  const playerName = (typeof loadPlayerName === 'function' ? loadPlayerName() : null) || 'Player';
  const playerLetter = playerName.trim().charAt(0).toUpperCase() || 'P';
  if (youAvatarInner) {
    youAvatarInner.textContent = playerLetter;
    if (typeof getProfileAvatarGradientCss === 'function') {
      youAvatarInner.style.background = getProfileAvatarGradientCss(playerName);
    }
  }
  if (youBadge) youBadge.classList.toggle('ready', youReady);

  const isBot = (mode === 'bot' || remoteKey === 'bot');
  if (oppAvatarInner) {
    if (isBot) {
      oppAvatarInner.textContent = '🤖';
      oppAvatarInner.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)';
    } else {
      oppAvatarInner.textContent = 'O';
      oppAvatarInner.style.background = 'linear-gradient(135deg, #475569, #334155)';
    }
  }
  if (oppBadge) oppBadge.classList.toggle('ready', oppReady);

  const oppBoardEl = document.getElementById('opponent-board');
  const myBoardEl = document.getElementById('player-board');
  const filled = (playerState) => playerState.board.map((c, i) => (c ? i : -1)).filter(i => i >= 0);

  const forced = isForced(state, localKey);
  // BUGFIX: this used to unconditionally wipe selMode/selMergeSlots whenever
  // forced was true - but forced stays true for as long as 4+ Blues remain
  // unmerged, which is exactly the situation the player is supposed to
  // resolve via 🧬 Combine mode. Since every render() call (including the
  // ones fired by simply tapping a card to add it to the merge selection)
  // was clearing that in-progress selection immediately, multi-card Combine
  // could never actually be used while forced - only the single-pair drag
  // gesture worked, since it doesn't go through selMode at all. Now, a
  // merge-in-progress selection survives being forced; every other pending
  // selection (placement, spell, chip, attack) still gets cleared, since
  // none of those are legal while forced anyway.
  if (forced) {
    selHandIdx = null; selSpellId = null; selChipId = null; selAttackerSlot = null;
    if (selMode !== 'merge') { selMode = null; selMergeSlots = []; }
  }

  // Prune any merge-mode selection whose card no longer exists (e.g. died,
  // or was consumed by another action) so a stale slot index never lingers.
  if (selMergeSlots.length) {
    selMergeSlots = selMergeSlots.filter(s => state.players[localKey] && state.players[localKey].board[s]);
  }

  let oppTargetable = [], ownTargetable = [];
  if (selSpellId) {
    const activeSpell = state.players[localKey]?.spells.find(s => s.id === selSpellId);
    if (activeSpell && (activeSpell.reviveSpell || activeSpell.defId === 'revivespell')) {
      ownTargetable = state.players[localKey].board.map((c, i) => (!c ? i : -1)).filter(i => i >= 0);
      oppTargetable = [];
    } else {
      oppTargetable = filled(state.players[remoteKey]);
      ownTargetable = filled(state.players[localKey]);
    }
  }
  else if (selChipId) { ownTargetable = filled(state.players[localKey]); }
  else if (state.phase === 'attack' && selAttackerSlot !== null) { oppTargetable = filled(state.players[remoteKey]); }

  renderBoard(oppBoardEl, state.players[remoteKey], remoteKey, { targetableSlots: oppTargetable });

  const enemyCountEl = document.getElementById('enemy-count');
  if (enemyCountEl) {
    const enemy = state.players[remoteKey];
    const enemyTotal = enemy.board.filter(Boolean).length + enemy.deck.length;
    enemyCountEl.textContent = enemyTotal;
  }

  // ---- NEW FEATURE: Board Power Meter ----
  // A quick "who's ahead" gut-check: relative board strength (HP+DMG summed
  // across each side's live board), shown as a tug-of-war bar. Purely
  // informational, recomputed on every render.
  const boardPower = (playerState) => playerState.board.reduce((sum, c) => sum + (c ? c.hp + c.dmg : 0), 0);
  const myPower = boardPower(state.players[localKey]);
  const oppPower = boardPower(state.players[remoteKey]);
  const totalPower = myPower + oppPower;
  const youPct = totalPower > 0 ? Math.round((myPower / totalPower) * 100) : 50;
  const powerYouEl = document.getElementById('power-bar-you');
  const powerOppEl = document.getElementById('power-bar-opp');
  if (powerYouEl && powerOppEl) {
    powerYouEl.style.width = youPct + '%';
    powerOppEl.style.width = (100 - youPct) + '%';
  }

  renderBoard(myBoardEl, state.players[localKey], localKey, {
    targetableSlots: ownTargetable,
    selectedSlot: selHandIdx !== null ? 'placing' : (selAttackerSlot !== null ? selAttackerSlot : null),
    selectedSlots: selMode === 'merge' ? selMergeSlots : undefined,
    forceGlowAll: forced,
  });
  checkLowHpWarnings();

  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  const handCountEl = document.getElementById('hand-count');
  if (handCountEl) handCountEl.textContent = `(${state.players[localKey].deck.length})`;
  renderSpellsChips(document.getElementById('spells-chips-row'), state.players[localKey],
    selSpellId ? { mode: 'spell', id: selSpellId } : (selChipId ? { mode: 'chip', id: selChipId } : null));

  document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => btn.classList.toggle('active', selMode === btn.dataset.mode));

  const undoBtn = document.getElementById('btn-undo-placement');
  if (undoBtn) undoBtn.classList.toggle('hidden', !(lastPlacement && mode === 'bot' && state.phase === 'placement'));

  // ---- Combine mode: show/label the Confirm Merge button ----
  const confirmMergeBtn = document.getElementById('btn-confirm-merge');
  if (confirmMergeBtn) {
    const inMergeMode = selMode === 'merge';
    confirmMergeBtn.classList.toggle('hidden', !inMergeMode || selMergeSlots.length < 2);
    if (inMergeMode && selMergeSlots.length >= 2) {
      const sum = selMergeSlots.reduce((s, slot) => {
        const c = state.players[localKey].board[slot];
        return s + (c ? c.tier : 0);
      }, 0);
      const validSum = sum >= 2 && sum <= 4;
      confirmMergeBtn.textContent = validSum
        ? `✅ Merge ${selMergeSlots.length} → ${TIERS[sum].name}`
        : `⚠ Invalid combo (${sum})`;
      confirmMergeBtn.disabled = !validSum;
      confirmMergeBtn.classList.toggle('action-disabled', !validSum);
    }
  }

  // ---- NEW FEATURE: Merge Preview - shows exactly what a Combine
  // selection will produce (tier, HP/DMG/SP, and which blueprint(s) it
  // could pull from) before the player commits, so multi-card fusions are
  // never a blind commitment.
  const mergePreviewEl = document.getElementById('merge-preview');
  if (mergePreviewEl) {
    const inMergeMode = selMode === 'merge';
    if (inMergeMode && selMergeSlots.length >= 2) {
      const cards = selMergeSlots.map(s => state.players[localKey].board[s]).filter(Boolean);
      const sum = cards.reduce((s, c) => s + c.tier, 0);
      if (sum >= 2 && sum <= 4) {
        const t = TIERS[sum];
        const hpTotal = Math.min(t.hp, cards.reduce((s, c) => s + c.hp, 0));
        const deckCards = state.players[localKey].deck;
        const candidates = deckCards.filter(c => c.tier === sum);
        const note = candidates.length === 0
          ? { text: `⚠ No ${t.name} blueprint left in your deck - this merge can't be made.`, warn: true }
          : candidates.length === 1
            ? { text: `Becomes: ${candidates[0].name}`, warn: false }
            : { text: `Becomes one of ${candidates.length} blueprints - you'll choose which.`, warn: false };
        mergePreviewEl.classList.remove('hidden');
        mergePreviewEl.innerHTML = `
          <div class="merge-preview-card">
            <div class="merge-preview-swatch" style="background:${t.hex}">${TIER_GLYPHS[sum] || ''}</div>
            <div class="merge-preview-body">
              <div class="merge-preview-stats"><span>${hpTotal}❤</span><span>${t.dmg}⚔</span><span>${t.sp}⛃</span></div>
              <div class="merge-preview-note${note.warn ? ' warn' : ''}">${note.text}</div>
            </div>
          </div>`;
      } else {
        mergePreviewEl.classList.remove('hidden');
        mergePreviewEl.innerHTML = `
          <div class="merge-preview-card">
            <div class="merge-preview-body">
              <div class="merge-preview-note warn">⚠ That combination adds up to tier ${sum}, which doesn't exist - pick a combo that sums to 2, 3, or 4.</div>
            </div>
          </div>`;
      }
    } else {
      mergePreviewEl.classList.add('hidden');
      mergePreviewEl.innerHTML = '';
    }
  }

  document.getElementById('forced-merge-banner').classList.toggle('hidden', !forced);
  document.getElementById('btn-ready').classList.toggle('action-disabled', forced);
  document.getElementById('hand-row').classList.toggle('action-disabled', forced);
  document.getElementById('spells-chips-row').classList.toggle('action-disabled', forced);
  document.getElementById('mode-bar').querySelectorAll('.mode-btn[data-mode="defend"]').forEach(b => b.classList.toggle('action-disabled', forced));

  const hint = document.getElementById('hint-text');
  if (hint) hint.textContent = '';

  renderLog(document.getElementById('log-panel'), state.log);

  if (state.phase === 'gameover' && !document.getElementById('screen-game').classList.contains('hidden')) {
    // NEW: Victory Animations - if the winner (on either side of a
    // multiplayer match, or the local player in a bot match) has a victory
    // animation equipped, play it first, full-screen, and defer the actual
    // "You Win"/"You Lose" card + all match-end bookkeeping (stats, quest
    // progress, wager payout, etc.) until it finishes. Both peers in a
    // multiplayer match run this same check locally against the same
    // matchVictoryAnims data exchanged at match start, so the shower plays
    // for both of them at effectively the same moment, not just the winner.
    const wantsMeteor = !meteorShowerDone && state.winner !== 'draw' && matchVictoryAnims[state.winner] === 'meteor';
    if (wantsMeteor) {
      meteorShowerDone = true;
      playMeteorShowerEffect(() => render());
      return;
    }

    const isBotWin = !epicVictoryDone && state.winner === localKey && mode === 'bot';
    if (isBotWin) {
      epicVictoryDone = true;
      if (typeof window.playEpicVictoryAnimation === 'function') {
        window.playEpicVictoryAnimation(botDifficulty, () => render());
        return;
      }
    }
    const overlay = document.getElementById('gameover-overlay');
    const title = document.getElementById('gameover-title');
    if (state.winner === 'draw') title.textContent = "It's a draw!";
    else if (state.forfeited && state.winner === localKey) title.textContent = 'Your opponent forfeited — you win!';
    else if (state.winner === localKey) title.textContent = 'You win!';
    else title.textContent = mode === 'bot' ? 'The bot wins.' : 'Your opponent wins.';
    const durationEl = document.getElementById('gameover-duration');
    if (durationEl) durationEl.textContent = matchStartTime ? `Match length: ${formatDuration(Date.now() - matchStartTime)}` : '';
    const mvpEl = document.getElementById('gameover-mvp');
    if (mvpEl) {
      const mvpEntries = Object.entries(matchCardStats).sort((a, b) => b[1].dmg - a[1].dmg);
      mvpEl.textContent = mvpEntries.length && mvpEntries[0][1].dmg > 0
        ? `⭐ MVP: ${mvpEntries[0][0]} — ${mvpEntries[0][1].dmg} dmg, ${mvpEntries[0][1].kills} kill${mvpEntries[0][1].kills === 1 ? '' : 's'}`
        : '';
    }
    overlay.classList.remove('hidden');
    const isWin = state.winner === localKey;
    const isDraw = state.winner === 'draw';
    const cardEl = document.getElementById('gameover-card');
    if (cardEl) {
      cardEl.classList.remove('is-win', 'is-loss');
      if (isWin) cardEl.classList.add('is-win');
      else if (!isDraw) cardEl.classList.add('is-loss');
    }
    const particleContainer = document.getElementById('gameover-particles');
    if (particleContainer) {
      particleContainer.innerHTML = '';
      const count = isWin ? 35 : 22;
      const colors = isWin ? ['#4ade80', '#fbbf24', '#38bdf8', '#f43f5e'] : ['#f87171', '#fb923c', '#a855f7'];
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'gameover-particle';
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = `${Math.random() * 100}%`;
        p.style.top = `${60 + Math.random() * 40}%`;
        p.style.width = `${4 + Math.random() * 7}px`;
        p.style.height = p.style.width;
        p.style.animationDelay = `${Math.random() * 1.5}s`;
        p.style.animationDuration = `${1.2 + Math.random() * 1.5}s`;
        particleContainer.appendChild(p);
      }
    }
    document.getElementById('btn-play-again').classList.toggle('hidden', mode !== 'bot');
    if (!gameOverAnnounced) {
      gameOverAnnounced = true;
      saveMatchReplay();
      if (!tutorialActive) {
        recordMatchHistory({
          mode: mode === 'bot' ? `Vs Bot (${botDifficulty})` : 'Multiplayer',
          result: state.winner === 'draw' ? 'Draw' : (state.winner === localKey ? 'Win' : 'Loss'),
          rounds: state.round,
          duration: matchStartTime ? Date.now() - matchStartTime : 0,
        });
      }
      if (state.winner === localKey) { launchConfetti(); Sound.win(); vibrate([40, 50, 40, 50, 60]); }
      if (state.winner === localKey || state.winner === remoteKey) recordResult(state.winner === localKey);
      if (state.winner === localKey && mode === 'bot' && !tutorialActive) recordDifficultyBeaten(botDifficulty);
      if (state.winner === localKey || state.winner === remoteKey) {
        const payoutForStats = currentWager > 0 && state.winner === localKey ? currentWager * 2 : 0;
        recordBattleResult(state.winner === localKey, currentWager, payoutForStats);
      }
      if (state.winner === localKey && !tutorialActive) {
        progressDailyChallenge('win', 1);
        if (currentWager > 0) unlockAchievement('wager_win');
      }
      if (!tutorialActive) checkAchievements();
      if (currentWager > 0) {
        if (state.winner === localKey) {
          const payout = currentWager * 2;
          addBux(payout);
          recordEconomyChange(payout, mode === 'bot' ? `Won wager vs ${botDifficulty} bot` : 'Won multiplayer wager');
          recordRecentActivity(`Won ${payout.toLocaleString()} Bux on a wager match`);
          showToast(`💰 Won ${currentWager.toLocaleString()} Mehrbod Bux!`, 2800);
        } else if (state.winner === 'draw') {
          addBux(currentWager);
          recordEconomyChange(currentWager, 'Wager refunded (draw)');
          showToast('🤝 Draw — your wager was refunded.', 2400);
        } else {
          recordEconomyChange(-currentWager, mode === 'bot' ? `Lost wager vs ${botDifficulty} bot` : 'Lost multiplayer wager');
          showToast(`💸 Lost ${currentWager.toLocaleString()} Mehrbod Bux.`, 2400);
        }
        currentWager = 0;
      }
    }
  }
  if (tutorialActive) renderTutorialOverlay();
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60), s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function checkLowHpWarnings() {
  if (!state) return;
  [localKey, remoteKey].forEach(key => {
    const p = state.players[key];
    if (!p) return;
    p.board.forEach(card => {
      if (!card) return;
      if (card.hp === 1 && card.maxHp > 1 && !_lowHpWarned.has(card.id)) {
        _lowHpWarned.add(card.id);
        Sound.lowHp();
      }
    });
  });
}

// ---- Persistent win/loss record (localStorage) -----------------------------
function loadRecord() {
  try {
    const r = JSON.parse(localStorage.getItem('mehrbod-cards-record') || '{"wins":0,"losses":0,"streak":0,"bestStreak":0}');
    return { wins: r.wins || 0, losses: r.losses || 0, streak: r.streak || 0, bestStreak: r.bestStreak || 0 };
  } catch (e) { return { wins: 0, losses: 0, streak: 0, bestStreak: 0 }; }
}
function recordResult(won) {
  const r = loadRecord();
  if (won) { r.wins++; r.streak++; r.bestStreak = Math.max(r.bestStreak, r.streak); }
  else { r.losses++; r.streak = 0; }
  try { localStorage.setItem('mehrbod-cards-record', JSON.stringify(r)); } catch (e) {}
  updateRecordDisplay();
}
function updateRecordDisplay() {
  const el = document.getElementById('record-display');
  if (!el) return;
  const r = loadRecord();
  if (!r.wins && !r.losses) { el.textContent = ''; return; }
  let text = `Record: ${r.wins}W – ${r.losses}L`;
  if (r.streak >= 3) text += ` · 🔥 ${r.streak} win streak`;
  else if (r.bestStreak >= 3) text += ` · Best streak: ${r.bestStreak}`;
  el.textContent = text;
}

// ---- Confetti / Victory Finisher celebration -------------------------------
function launchConfetti() {
  if (reducedMotion) return;
  const equipped = loadEquippedVictoryAnim();
  if (typeof playVictoryFinisherEffect === 'function') {
    playVictoryFinisherEffect(equipped);
    return;
  }
  const card = document.getElementById('gameover-card') || document.body;
  const colors = ['#3E7CB1', '#4C9A5B', '#C1443C', '#E08A2C', '#ffffff'];
  const enhanced = ownsCosmetic('effect_confetti');
  const count = enhanced ? 90 : 46;
  const lifespan = enhanced ? 4200 : 2800;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (enhanced ? (1.6 + Math.random() * 1.6) : (1.2 + Math.random() * 1.1)) + 's';
    piece.style.animationDelay = (Math.random() * (enhanced ? 0.7 : 0.4)) + 's';
    piece.style.borderRadius = Math.random() < 0.5 ? '50%' : '2px';
    card.appendChild(piece);
    setTimeout(() => piece.remove(), lifespan);
  }
}

// ---- NEW COSMETIC: Victory Animations (Meteor Shower & Finishers) -----------
function playMeteorShowerEffect(onDone) {
  if (typeof playVictoryFinisherEffect === 'function') {
    playVictoryFinisherEffect('victoryanim_meteor', onDone);
    return;
  }
  if (onDone) onDone();
}

// ---- NEW FEATURE: choose which blueprint a merge consumes ------------------
// If a merge's resulting tier has more than one matching blueprint sitting
// in the deck (e.g. two different Green archetypes), let the player pick
// which one to consume instead of silently taking whichever comes first.
// `candidates`/`candidateIndices` are parallel arrays; onChoose receives
// the chosen candidate's actual index in the deck (or null on cancel).
function promptBlueprintChoice(candidates, candidateIndices, onChoose) {
  const old = document.getElementById('blueprint-picker-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'blueprint-picker-overlay';
  overlay.className = 'feature-overlay';
  overlay.innerHTML = `
    <div class="feature-panel" style="max-height:82vh; overflow-y:auto;">
      <button class="feature-close">✕</button>
      <span class="feature-kicker">CHOOSE A BLUEPRINT</span>
      <h2>MERGE INTO...</h2>
      <p>You have more than one match for this tier - pick which one to consume.</p>
      <div class="deck-builder-grid" id="blueprint-picker-grid"></div>
    </div>`;
  document.body.appendChild(overlay);
  const grid = overlay.querySelector('#blueprint-picker-grid');
  let resolved = false;
  const finish = (val) => { if (resolved) return; resolved = true; overlay.remove(); onChoose(val); };
  candidates.forEach((card, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `dcard unit-dcard tier${card.tier}`;
    const abilityText = card.ability && card.ability !== 'none' ? abilityLabel(card.ability) : 'No special ability';
    el.innerHTML = `<div class="dcard-name">${card.name}</div><div class="dcard-text">${abilityText}</div>`;
    el.addEventListener('click', () => finish(candidateIndices[i]));
    grid.appendChild(el);
  });
  overlay.querySelector('.feature-close').onclick = () => finish(null);
  overlay.onclick = e => { if (e.target === overlay) finish(null); };
}

// ---- Drag-to-merge -----------------------------------------------------
const DRAG_THRESHOLD = 10;
let dragState = null;

document.getElementById('player-board').addEventListener('pointerdown', (e) => {
  if (!state || state.phase !== 'placement' || dragState) return;
  if (selMode === 'merge') return; // Combine mode handles selection via tap, not drag
  const cardElx = e.target.closest('.card');
  if (!cardElx || cardElx.dataset.owner !== localKey) return;
  const slot = Number(cardElx.dataset.slot);
  if (!state.players[localKey].board[slot]) return;
  dragState = {
    kind: 'merge', sourceSlot: slot, sourceEl: cardElx,
    startX: e.clientX, startY: e.clientY,
    dragging: false, ghostEl: null, pointerId: e.pointerId,
  };
});

document.getElementById('hand-row').addEventListener('pointerdown', (e) => {
  if (!state || state.phase !== 'placement' || dragState) return;
  const cardElx = e.target.closest('[data-role="hand-card"]');
  if (!cardElx) return;
  const idx = Number(cardElx.dataset.handIdx);
  if (!state.players[localKey].deck[idx]) return;
  dragState = {
    kind: 'place', sourceHandIdx: idx, sourceEl: cardElx,
    startX: e.clientX, startY: e.clientY,
    dragging: false, ghostEl: null, pointerId: e.pointerId,
  };
});

document.addEventListener('pointermove', (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
  if (!dragState.dragging) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragState.dragging = true;
    if (dragState.kind === 'place') { selHandIdx = null; selMode = null; selSpellId = null; selChipId = null; }
    const rect = dragState.sourceEl.getBoundingClientRect();
    const ghost = dragState.sourceEl.cloneNode(true);
    ghost.className = dragState.sourceEl.className + ' drag-ghost';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    document.body.appendChild(ghost);
    dragState.ghostEl = ghost;
    dragState.sourceEl.classList.add('dragging-source');
  }
  const ghost = dragState.ghostEl;
  ghost.style.left = (e.clientX - ghost.offsetWidth / 2) + 'px';
  ghost.style.top = (e.clientY - ghost.offsetHeight / 2) + 'px';

  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  ghost.style.display = 'none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  ghost.style.display = '';
  const slotEl = under && under.closest && under.closest('.slot');
  if (slotEl && slotEl.dataset.owner === localKey) {
    const targetSlot = Number(slotEl.dataset.slot);
    const hasCard = !!state.players[localKey].board[targetSlot];
    const validTarget = dragState.kind === 'merge'
      ? (targetSlot !== dragState.sourceSlot && hasCard)
      : !hasCard;
    if (validTarget) slotEl.classList.add('drop-target');
  }
});

document.addEventListener('pointerup', (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const wasDragging = dragState.dragging;
  if (wasDragging) {
    const ghost = dragState.ghostEl;
    ghost.style.display = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    ghost.remove();
    dragState.sourceEl.classList.remove('dragging-source');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const slotEl = under && under.closest && under.closest('.slot');
    if (slotEl && slotEl.dataset.owner === localKey) {
      const targetSlot = Number(slotEl.dataset.slot);
      const hasCard = !!state.players[localKey].board[targetSlot];
      if (dragState.kind === 'merge') {
        if (targetSlot !== dragState.sourceSlot && hasCard) {
          const slotA = dragState.sourceSlot, slotB = targetSlot;
          const a = state.players[localKey].board[slotA], b = state.players[localKey].board[slotB];
          const newTier = a && b ? a.tier + b.tier : null;
          const deck = state.players[localKey].deck;
          const candidateIndices = newTier ? deck.map((c, i) => (c.tier === newTier ? i : -1)).filter(i => i >= 0) : [];
          if (candidateIndices.length > 1) {
            const candidates = candidateIndices.map(i => deck[i]);
            promptBlueprintChoice(candidates, candidateIndices, (chosenIndex) => {
              if (chosenIndex != null) dispatch({ type: 'merge', slots: [slotA, slotB], blueprintIndex: chosenIndex });
              render();
            });
          } else {
            dispatch({ type: 'merge', slots: [slotA, slotB] });
          }
        }
      } else if (!hasCard) {
        dispatch({ type: 'place', handIndex: dragState.sourceHandIdx, slot: targetSlot });
      }
    }
    suppressNextClick = true;
    setTimeout(() => { suppressNextClick = false; }, 400);
    dragState = null;
    render();
  } else {
    dragState = null;
  }
});

document.addEventListener('pointercancel', (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  if (dragState.ghostEl) dragState.ghostEl.remove();
  if (dragState.sourceEl) dragState.sourceEl.classList.remove('dragging-source');
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  dragState = null;
});

// ---- Mute toggle ------------------------------------------------------------
function updateMuteButton() {
  const btn = document.getElementById('btn-mute-toggle');
  if (btn) btn.textContent = Sound.isMuted() ? '🔇 Sound: Off' : '🔊 Sound: On';
}
document.getElementById('btn-mute-toggle').addEventListener('click', () => {
  Sound.setMuted(!Sound.isMuted());
  updateMuteButton();
});
updateMuteButton();

// ---- NEW SETTING: master volume slider -------------------------------------
function updateVolumeUI() {
  const slider = document.getElementById('volume-slider');
  const label = document.getElementById('volume-value');
  const pct = Math.round(Sound.getVolume() * 100);
  if (slider) slider.value = String(pct);
  if (label) label.textContent = pct + '%';
}
document.getElementById('volume-slider')?.addEventListener('input', (e) => {
  Sound.setVolume(Number(e.target.value) / 100);
  updateVolumeUI();
});
updateVolumeUI();

// ---- Ambient background sound controls ------------------------------------
function updateAmbientUI() {
  const btn = document.getElementById('btn-ambient-toggle');
  if (btn && typeof Sound !== 'undefined' && Sound.ambient) {
    btn.textContent = Sound.ambient.isEnabled() ? '🎵 Ambience: On' : '🔇 Ambience: Off';
  }
  const slider = document.getElementById('ambient-volume-slider');
  const label = document.getElementById('ambient-volume-value');
  if (typeof Sound !== 'undefined' && Sound.ambient) {
    const pct = Math.round(Sound.ambient.getVolume() * 100);
    if (slider) slider.value = String(pct);
    if (label) label.textContent = pct + '%';
  }
}
document.getElementById('btn-ambient-toggle')?.addEventListener('click', () => {
  if (typeof Sound !== 'undefined' && Sound.ambient) {
    Sound.ambient.setEnabled(!Sound.ambient.isEnabled());
    updateAmbientUI();
  }
});
document.getElementById('ambient-volume-slider')?.addEventListener('input', (e) => {
  if (typeof Sound !== 'undefined' && Sound.ambient) {
    Sound.ambient.setVolume(Number(e.target.value) / 100);
    updateAmbientUI();
  }
});
updateAmbientUI();

// ---- NEW SETTING: haptics (vibration) toggle -------------------------------
// A short buzz on hits, deaths, merges, and wins, mirroring what most
// mobile games offer as a toggleable "Vibration" option. No-ops silently
// on devices/browsers without the Vibration API (e.g. desktop, iOS Safari).
function loadHapticsSetting() {
  try {
    const v = localStorage.getItem('mehrbod-cards-haptics');
    return v === null ? true : v === '1';
  } catch (e) { return true; }
}
function saveHapticsSetting(v) {
  try { localStorage.setItem('mehrbod-cards-haptics', v ? '1' : '0'); } catch (e) {}
}
let hapticsEnabled = loadHapticsSetting();
function vibrate(pattern) {
  if (!hapticsEnabled) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported - ignore */ }
}
function updateHapticsButton() {
  const btn = document.getElementById('btn-haptics-toggle');
  if (btn) btn.textContent = hapticsEnabled ? '📳 Vibration: On' : '📳 Vibration: Off';
}
document.getElementById('btn-haptics-toggle')?.addEventListener('click', () => {
  hapticsEnabled = !hapticsEnabled;
  saveHapticsSetting(hapticsEnabled);
  updateHapticsButton();
  if (hapticsEnabled) vibrate(20); // quick confirmation buzz so the toggle itself is felt
});
updateHapticsButton();

// ---- NEW SETTING: Reset All Progress ---------------------------------------
// A standard "danger zone" settings option - wipes every locally-saved
// piece of state (Bux, collection, cosmetics, decks, stats, achievements,
// theme, and the other toggles on this list) after a two-step confirmation,
// then reloads so every on-screen number/badge is guaranteed consistent
// with the now-empty save instead of trying to patch dozens of already-
// rendered elements by hand.
const RESET_PROGRESS_KEYS = [
  'mehrbod-cards-bux', 'mehrbod-cards-collection', 'mehrbod-cards-owned-cosmetics',
  'mehrbod-cards-equipped-sleeve', 'mehrbod-cards-starter-granted', 'mehrbod-cards-merge-starter-v1',
  'mehrbod_deck_presets_v1', 'mehrbod_battle_stats_v1', 'mehrbod_economy_ledger_v1',
  'mehrbod_recent_activity', 'mehrbod_match_history_v1', 'mehrbod_card_mastery_v1',
  'mehrbod-cards-beaten-diffs', 'mehrbod-cards-pink-unlocked', 'mehrbod-cards-reset-ehe-v1',
  'mehrbod_daily_challenge_v2', 'mehrbod_achievements_v1', 'mehrbod-cards-record',
  'mehrbod-cards-theme', 'mehrbod-cards-last-difficulty', 'mehrbod-cards-tutorial-seen',
  'mehrbod-cards-player-name', 'mehrbod-cards-profile-gradient', 'mehrbod_favorite_cards', 'mehrbod-cards-inventory-backup-v1',
  'mehrbod-cards-last-seen-version', 'mehrbod-cards-muted', 'mehrbod-cards-reduced-motion',
  'mehrbod-cards-volume', 'mehrbod-cards-haptics', 'mehrbod-cards-splash-text-enabled',
];
function resetAllProgress() {
  showConfirmDialog({
    kicker: 'DANGER ZONE',
    title: 'Reset All Progress?',
    message: 'This permanently erases your Mehrbod Bux, card collection, achievements, stats, and saved decks on this device. This cannot be undone.',
    okText: 'Erase Everything',
    cancelText: 'Cancel',
    danger: true,
    onConfirm: () => {
      try { RESET_PROGRESS_KEYS.forEach(k => localStorage.removeItem(k)); } catch (e) {}
      showToast('🗑 Progress reset. Reloading…', 1600);
      setTimeout(() => location.reload(), 700);
    }
  });
}
document.getElementById('btn-reset-progress')?.addEventListener('click', resetAllProgress);

updateRecordDisplay();
updateBuxDisplay();

// ---- Reduced motion -----------------------------------------------------
let reducedMotion = loadReducedMotion();
function loadReducedMotion() {
  try {
    const saved = localStorage.getItem('mehrbod-cards-reduced-motion');
    if (saved !== null) return saved === '1';
  } catch (e) {}
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}
function applyReducedMotion(on) {
  reducedMotion = on;
  document.getElementById('app').classList.toggle('reduced-motion', on);
  const btn = document.getElementById('btn-motion-toggle');
  if (btn) btn.textContent = on ? '🎬 Reduced motion: On' : '🎬 Reduced motion: Off';
  try { localStorage.setItem('mehrbod-cards-reduced-motion', on ? '1' : '0'); } catch (e) {}
}
document.getElementById('btn-motion-toggle').addEventListener('click', () => applyReducedMotion(!reducedMotion));
applyReducedMotion(reducedMotion);

// ---- Splash text setting ------------------------------------------------
let splashTextEnabled = loadSplashTextSetting();
function loadSplashTextSetting() {
  try {
    const saved = localStorage.getItem('mehrbod-cards-splash-text-enabled');
    if (saved !== null) return saved === '1';
  } catch (e) {}
  return false;
}
function applySplashTextSetting(on) {
  splashTextEnabled = on;
  const splashEl = document.getElementById('minecraft-splash');
  if (splashEl) {
    splashEl.classList.toggle('hidden', !on);
    if (on) {
      initMinecraftSplashText();
    }
  }
  const btn = document.getElementById('btn-splash-toggle');
  if (btn) btn.textContent = on ? '✨ Splash Text: On' : '✨ Splash Text: Off';
  try { localStorage.setItem('mehrbod-cards-splash-text-enabled', on ? '1' : '0'); } catch (e) {}
}
document.getElementById('btn-splash-toggle')?.addEventListener('click', () => applySplashTextSetting(!splashTextEnabled));
applySplashTextSetting(splashTextEnabled);

// ---- Themes -----------------------------------------------------------------
const ALL_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];

// NOTE: Flame and Storm swapped which unlock condition they use - Flame is
// now the single-difficulty reward (Hard) and Storm is now the "beat every
// difficulty" secret reward, the reverse of how they used to be assigned.
const QUEST_DEFS = [
  { diff: 'Easy',   theme: 'verdant',   icon: '🌱', name: 'Sprout',      desc: 'Win a practice match on Easy difficulty.', badgeId: 'easy-verdant-badge' },
  { diff: 'Medium', theme: 'pink',      icon: '💗', name: 'In the Pink', desc: 'Win a practice match on Medium difficulty.', badgeId: 'medium-pink-badge' },
  { diff: 'Hard',   theme: 'flame',     icon: '🔥', name: 'Firestarter', desc: 'Win a practice match on Hard difficulty.', badgeId: 'hard-storm-badge' },
  { diff: 'Expert', theme: 'aurora',    icon: '🌌', name: 'Stargazer',   desc: 'Win a practice match on Expert difficulty.', badgeId: 'expert-aurora-badge' },
  { diff: 'Master', theme: 'sovereign', icon: '👑', name: 'The Sovereign',desc: 'Win a practice match on Master difficulty.', badgeId: 'master-sovereign-badge' },
];
const ALL_DIFFS_QUEST = { theme: 'storm', icon: '⛈️', name: 'Undefeated', desc: 'Win a practice match on every difficulty at least once.' };

(function partialResetEasyHardExpert() {
  try {
    if (localStorage.getItem('mehrbod-cards-reset-ehe-v1') === '1') return;
    const raw = JSON.parse(localStorage.getItem('mehrbod-cards-beaten-diffs') || '[]');
    const kept = (Array.isArray(raw) ? raw : []).filter(d => d === 'Medium' || d === 'Master');
    localStorage.setItem('mehrbod-cards-beaten-diffs', JSON.stringify(kept));
    localStorage.setItem('mehrbod-cards-reset-ehe-v1', '1');
  } catch (e) {}
})();

function loadBeatenDifficulties() {
  try {
    const raw = JSON.parse(localStorage.getItem('mehrbod-cards-beaten-diffs') || '[]');
    let set = Array.isArray(raw) ? raw.filter(d => ALL_DIFFICULTIES.includes(d)) : [];
    if (localStorage.getItem('mehrbod-cards-pink-unlocked') === '1' && !set.includes('Master')) {
      set = set.concat('Master');
      localStorage.setItem('mehrbod-cards-beaten-diffs', JSON.stringify(set));
    }
    return set;
  } catch (e) { return []; }
}
function recordDifficultyBeaten(diff) {
  if (!ALL_DIFFICULTIES.includes(diff)) return;
  const set = loadBeatenDifficulties();
  if (set.includes(diff)) return;
  const before = set.slice();
  set.push(diff);
  try { localStorage.setItem('mehrbod-cards-beaten-diffs', JSON.stringify(set)); } catch (e) {}

  updateThemeButtons();
  QUEST_DEFS.forEach(q => {
    if (!before.includes(q.diff) && set.includes(q.diff)) {
      showToast(`${q.icon} ${themeDisplayName(q.theme)} theme unlocked! Check Options to try it.`, 2600);
      Sound.sparkle();
      recordRecentActivity(`Unlocked the ${themeDisplayName(q.theme)} theme by beating ${q.diff}`);
    }
  });
  if (!isAllDiffsUnlocked(before) && isAllDiffsUnlocked(set)) {
    showToast('⛈️ Storm theme unlocked! You beat every difficulty!', 3000);
    Sound.sparkle();
    recordRecentActivity('Unlocked the Storm theme by beating every difficulty');
  }
  renderQuests();
}
function isThemeUnlockedByDiff(theme, set) {
  const q = QUEST_DEFS.find(q => q.theme === theme);
  return q ? (set || loadBeatenDifficulties()).includes(q.diff) : false;
}
function isAllDiffsUnlocked(set) {
  const beaten = set || loadBeatenDifficulties();
  return ALL_DIFFICULTIES.every(d => beaten.includes(d));
}
function isAllThemesUnlocked() {
  try {
    return localStorage.getItem('mehrbod_all_themes_unlocked') === 'true';
  } catch (e) {
    return false;
  }
}

function isAstralThemeUnlocked() {
  if (isAllThemesUnlocked()) return true;
  try {
    if (localStorage.getItem('theme_astral_unlocked') === 'true') return true;
    if (typeof loadTrialTowerState === 'function') {
      const tower = loadTrialTowerState();
      if (tower && (tower.best >= 30 || tower.floor >= 30)) return true;
    }
  } catch (e) {}
  return false;
}

function isQuantumThemeUnlocked() {
  if (isAllThemesUnlocked()) return true;
  try {
    if (localStorage.getItem('theme_quantum_unlocked') === 'true') return true;
    if (typeof loadTrialTowerState === 'function') {
      const tower = loadTrialTowerState();
      if (tower && (tower.best >= 10 || tower.floor >= 10)) return true;
    }
  } catch (e) {}
  return false;
}

function isGlacierThemeUnlocked() {
  if (isAllThemesUnlocked()) return true;
  try {
    if (localStorage.getItem('theme_glacier_unlocked') === 'true') return true;
    if (typeof loadTrialTowerState === 'function') {
      const tower = loadTrialTowerState();
      if (tower && (tower.best >= 15 || tower.floor >= 15)) return true;
    }
  } catch (e) {}
  return false;
}

function isCelestialThemeUnlocked() {
  if (isAllThemesUnlocked()) return true;
  try {
    if (localStorage.getItem('theme_celestial_unlocked') === 'true') return true;
    if (typeof loadTrialTowerState === 'function') {
      const tower = loadTrialTowerState();
      if (tower && (tower.best >= 50 || tower.floor >= 50)) return true;
    }
  } catch (e) {}
  return false;
}

function themeDisplayName(t) {
  return {
    dark: 'Dark', light: 'Light', verdant: 'Verdant', pink: 'Pink', storm: 'Storm',
    aurora: 'Aurora', sovereign: 'Sovereign', flame: 'Flame', mrmoney: 'Mr Money',
    cyberneon: 'Cyber Neon', abyss: 'Abyss', magma: 'Magma', quantum: 'Quantum Flux',
    glacier: 'Glacial Frost', astral: 'Astral Void', celestial: 'Celestial Divinity', collector: '100% Collector'
  }[t] || t;
}
function isCollectionComplete() {
  const owned = loadCollection();
  const allUnitsOwned = ALL_NONBLUE_UNIT_IDS.every(id => owned.units.includes(id));
  const allSpellsOwned = ALL_SPELL_IDS.every(id => owned.spells.includes(id));
  const allChipsOwned = ALL_CHIP_IDS.every(id => owned.chips.includes(id));
  return allUnitsOwned && allSpellsOwned && allChipsOwned;
}
Object.assign(THEME_UNLOCK_CHECK, {
  dark: () => true, light: () => true,
  verdant: () => isAllThemesUnlocked() || isThemeUnlockedByDiff('verdant'),
  pink: () => isAllThemesUnlocked() || isThemeUnlockedByDiff('pink'),
  flame: () => isAllThemesUnlocked() || isThemeUnlockedByDiff('flame'),
  aurora: () => isAllThemesUnlocked() || isThemeUnlockedByDiff('aurora'),
  sovereign: () => isAllThemesUnlocked() || isThemeUnlockedByDiff('sovereign'),
  storm: () => isAllThemesUnlocked() || isAllDiffsUnlocked(),
  mrmoney: () => isAllThemesUnlocked() || ownsCosmetic('theme_mrmoney'),
  cyberneon: () => isAllThemesUnlocked() || ownsCosmetic('theme_cyberneon'),
  abyss: () => isAllThemesUnlocked() || ownsCosmetic('theme_abyss'),
  magma: () => isAllThemesUnlocked() || ownsCosmetic('theme_magma'),
  quantum: () => isQuantumThemeUnlocked(),
  glacier: () => isGlacierThemeUnlocked(),
  astral: () => isAstralThemeUnlocked(),
  celestial: () => isCelestialThemeUnlocked(),
  collector: () => isAllThemesUnlocked() || isCollectionComplete(),
  valentine: () => isAllThemesUnlocked() || ownsCosmetic('theme_valentine') || localStorage.getItem('theme_valentine_unlocked') === 'true',
  sakura: () => isAllThemesUnlocked() || ownsCosmetic('theme_sakura') || localStorage.getItem('theme_sakura_unlocked') === 'true',
  solar: () => isAllThemesUnlocked() || ownsCosmetic('theme_solar') || localStorage.getItem('theme_solar_unlocked') === 'true',
  steampunk: () => isAllThemesUnlocked() || ownsCosmetic('theme_steampunk') || localStorage.getItem('theme_steampunk_unlocked') === 'true',
  galaxy: () => isAllThemesUnlocked() || ownsCosmetic('theme_galaxy') || localStorage.getItem('theme_galaxy_unlocked') === 'true',
});
const THEME_LOCK_MESSAGE = {
  verdant: '🔒 Beat Easy difficulty to unlock the Verdant theme!',
  pink: '🔒 Beat Medium difficulty to unlock Pink Mode!',
  flame: '🔒 Beat Hard difficulty to unlock the Flame theme!',
  aurora: '🔒 Beat Expert difficulty to unlock the Aurora theme!',
  storm: '🔒 Beat every difficulty at least once to unlock the Storm theme!',
  sovereign: '🔒 Beat Master difficulty to unlock the Sovereign theme!',
  mrmoney: '🔒 Buy the Mr Money theme in the Mehrbod Shop for 1000 Bux!',
  cyberneon: '🔒 Buy the Cyber Neon theme in the Mehrbod Shop for 1200 Bux!',
  abyss: '🔒 Buy the Abyss theme in the Mehrbod Shop for 1200 Bux!',
  magma: '🔒 Buy the Magma theme in the Mehrbod Shop for 1200 Bux!',
  quantum: '🔒 Reach Floor 10 of the Trial Tower to unlock the Quantum Flux theme!',
  glacier: '🔒 Reach Floor 15 of the Trial Tower to unlock the Glacial Frost theme!',
  astral: '🔒 Clear Floor 30 of the Trial Tower to unlock the Astral Void theme!',
  celestial: '🔒 Reach Floor 50 of the Trial Tower to unlock the Celestial Divinity theme!',
  collector: '🔒 Collect every current card to unlock the 100% Collector theme!',
  valentine: '🔒 Secret code required or available in Mehrbod Shop!',
  sakura: '🔒 Unlocked in Mehrbod Shop or special events!',
  solar: '🔒 Unlocked in Mehrbod Shop or Trial Tower!',
  steampunk: '🔒 Unlocked in Mehrbod Shop or Master Quests!',
  galaxy: '🔒 Unlocked in Mehrbod Shop or Cosmic Quests!',
};
const ALL_THEME_NAMES = [
  'dark', 'light', 'verdant', 'pink', 'flame', 'aurora', 'sovereign', 'storm',
  'mrmoney', 'cyberneon', 'abyss', 'magma', 'quantum', 'glacier', 'astral',
  'celestial', 'collector', 'valentine', 'sakura', 'solar', 'steampunk', 'galaxy'
];
function isThemeUnlocked(theme) {
  if (typeof isAllThemesUnlocked === 'function' && isAllThemesUnlocked()) return true;
  if (!theme || theme === 'dark' || theme === 'light') return true;
  if (THEME_UNLOCK_CHECK[theme]) return THEME_UNLOCK_CHECK[theme]();
  if (typeof ownsCosmetic === 'function') {
    if (ownsCosmetic('theme_' + theme) || ownsCosmetic(theme)) return true;
  }
  return false;
}

function loadTheme() {
  try {
    const saved = localStorage.getItem('mehrbod-cards-theme');
    if (saved && THEME_UNLOCK_CHECK[saved] && !THEME_UNLOCK_CHECK[saved]()) return 'dark';
    if (saved && THEME_UNLOCK_CHECK[saved]) return saved;
  } catch (e) {}
  return 'dark';
}
let currentTheme = loadTheme();
function applyTheme(theme) {
  const check = THEME_UNLOCK_CHECK[theme];
  if (!check || !check()) {
    showToast(THEME_LOCK_MESSAGE[theme] || "This theme isn't unlocked yet.");
    return;
  }
  currentTheme = theme;
  document.documentElement.classList.remove(...ALL_THEME_NAMES.filter(t => t !== 'dark').map(t => 'theme-' + t));
  if (theme !== 'dark') document.documentElement.classList.add('theme-' + theme);
  try { localStorage.setItem('mehrbod-cards-theme', theme); } catch (e) {}
  updateThemeButtons();
  const themesBtn = document.getElementById('btn-open-themes');
  if (themesBtn) themesBtn.textContent = `🎨 Themes: ${themeDisplayName(theme)}`;
  if (typeof Sound !== 'undefined') {
    if (Sound.themeChange) Sound.themeChange();
    if (Sound.ambient && Sound.ambient.setTheme) {
      Sound.ambient.setTheme(theme);
    }
  }
}
function updateThemeButtons() {
  const beaten = loadBeatenDifficulties();
  ALL_THEME_NAMES.forEach(t => {
    const btn = document.getElementById('theme-btn-' + t);
    if (!btn) return;
    btn.classList.toggle('active', currentTheme === t);
    if (THEME_UNLOCK_CHECK[t]) btn.classList.toggle('locked', !THEME_UNLOCK_CHECK[t]());
  });
  QUEST_DEFS.forEach(q => {
    const badge = document.getElementById(q.badgeId);
    if (!badge) return;
    const unlocked = beaten.includes(q.diff);
    badge.classList.toggle('unlocked', unlocked);
    badge.title = unlocked ? `${themeDisplayName(q.theme)} theme unlocked! Try it in Options.` : `Beat ${q.diff} to unlock the ${themeDisplayName(q.theme)} theme!`;
  });
  const stormHint = document.getElementById('storm-hint');
  if (stormHint) {
    stormHint.textContent = isAllDiffsUnlocked(beaten)
      ? '⛈️ Storm theme unlocked — you beat every difficulty!'
      : `⛈️ Beat every difficulty at least once to unlock a secret 6th theme. (${beaten.length}/5)`;
  }
}
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (typeof Sound !== 'undefined' && Sound.themeChange) Sound.themeChange();
    applyTheme(btn.dataset.theme);
  });
});
applyTheme(currentTheme);
updateThemeButtons();

// ---- Collection Book (Fortnite Locker: Cards, Victory Effects, Themes, Sleeves) ----
let currentLockerTopTab = 'cards';
let currentInspectedLockerItem = null;
let victoryPreviewAnimTimer = null;

function loadEquippedVictoryAnim() {
  try {
    const saved = localStorage.getItem('mehrbod-cards-equipped-victory-anim');
    if (saved) {
      if (saved === 'default_confetti' || ownsCosmetic(saved)) return saved;
    }
    if (ownsCosmetic('victoryanim_meteor')) return 'victoryanim_meteor';
  } catch (e) {}
  return 'default_confetti';
}

function equipVictoryAnim(id) {
  try {
    localStorage.setItem('mehrbod-cards-equipped-victory-anim', id);
  } catch (e) {}
  if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
  if (typeof renderCollectionScreen === 'function') {
    renderCollectionScreen(currentLockerTopTab || 'victoryeffects');
  }
}

function loadEquippedSleeve() {
  try {
    const saved = localStorage.getItem('mehrbod-cards-equipped-sleeve');
    if (saved && (saved === 'none' || ownsCosmetic(saved))) return saved;
  } catch (e) {}
  return 'none';
}

function equipSleeve(id) {
  try {
    localStorage.setItem('mehrbod-cards-equipped-sleeve', id);
  } catch (e) {}
  if (typeof Sound !== 'undefined' && Sound.buff) Sound.buff();
  if (typeof renderCollectionScreen === 'function') {
    renderCollectionScreen(currentLockerTopTab || 'sleeves');
  }
}

try {
  loadEquippedSleeve();
} catch (e) {}

// ---- Themes modal -----------------------------------------------------------
function openThemes() {
  if (typeof Sound !== 'undefined' && Sound.modalOpen) Sound.modalOpen();
  updateThemeButtons();
  document.getElementById('themes-overlay').classList.remove('hidden');
}
document.getElementById('btn-open-themes').addEventListener('click', openThemes);
document.getElementById('btn-themes-close').addEventListener('click', () => {
  if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
  document.getElementById('themes-overlay').classList.add('hidden');
});
document.getElementById('themes-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'themes-overlay') {
    if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
    document.getElementById('themes-overlay').classList.add('hidden');
  }
});

// ---- Collection Book (Cards / Themes chooser) ------------------------------
// The single entry point for browsing owned cards or switching themes,
// reached from the one 📖 Collection link on the main menu footer (and the
// COLLECTION card in the feature strip, which jumps straight to Cards).

const THEME_DATA_REGISTRY = [
  { id: 'dark', name: 'Dark Theme', emblem: '🌑', rarity: 'STARTER', rarityClass: 'rare', desc: 'Classic sleek obsidian dark theme with emerald green energy highlights.', unlockHint: 'Default unlocked starter theme', primary: '#4ade80', panel: '#151c2e', bg: '#0b0f19' },
  { id: 'light', name: 'Light Theme', emblem: '☀️', rarity: 'STARTER', rarityClass: 'rare', desc: 'Crisp clean paper-white layout with cerulean blue accents.', unlockHint: 'Default unlocked starter theme', primary: '#0284c7', panel: '#ffffff', bg: '#f1f5f9' },
  { id: 'verdant', name: 'Verdant', emblem: '🌱', rarity: 'QUEST', rarityClass: 'uncommon', desc: 'Lush evergreen canopy theme infused with life-force moss and jade accents.', unlockHint: 'Unlocked by defeating Easy Difficulty AI', primary: '#22c55e', panel: '#14532d', bg: '#052e16' },
  { id: 'pink', name: 'Pink Mode', emblem: '💗', rarity: 'QUEST', rarityClass: 'rare', desc: 'Vibrant neon bubblegum aesthetic with sweet berry tones.', unlockHint: 'Unlocked by defeating Medium Difficulty AI', primary: '#f472b6', panel: '#831843', bg: '#500724' },
  { id: 'flame', name: 'Flame', emblem: '🔥', rarity: 'QUEST', rarityClass: 'epic', desc: 'Blazing embers and scorched emberstone warmth.', unlockHint: 'Unlocked by defeating Hard Difficulty AI', primary: '#f97316', panel: '#7c2d12', bg: '#431407' },
  { id: 'aurora', name: 'Aurora', emblem: '🌌', rarity: 'QUEST', rarityClass: 'epic', desc: 'Northern polar light auroras shimmering across icy glaciers.', unlockHint: 'Unlocked by defeating Expert Difficulty AI', primary: '#2dd4bf', panel: '#134e4a', bg: '#042f2e' },
  { id: 'sovereign', name: 'The Sovereign', emblem: '👑', rarity: 'MASTER', rarityClass: 'legendary', desc: 'Imperial 24k gilded royal majesty with antique gold trim.', unlockHint: 'Unlocked by defeating Master Difficulty AI', primary: '#eab308', panel: '#713f12', bg: '#422006' },
  { id: 'storm', name: 'Storm', emblem: '⛈️', rarity: 'LEGENDARY', rarityClass: 'legendary', desc: 'Crackling azure lightning surges across torrential thundercloud skies.', unlockHint: 'Unlocked by conquering all difficulty quests', primary: '#38bdf8', panel: '#0c4a6e', bg: '#082f49' },
  { id: 'mrmoney', name: 'Mr Money', emblem: '🤑', rarity: 'SHOP', rarityClass: 'legendary', desc: 'Opulent high-roller casino vault dripping in gold bullion & banknotes.', unlockHint: 'Purchased in Cosmetics Shop for 1,000 Bux', primary: '#22c55e', panel: '#064e3b', bg: '#022c22' },
  { id: 'cyberneon', name: 'Cyber Neon', emblem: '🌆', rarity: 'SHOP', rarityClass: 'exotic', desc: 'Cyberpunk neon grid lines pulsating with synthwave laser energy.', unlockHint: 'Purchased in Cosmetics Shop for 1,200 Bux', primary: '#f43f5e', panel: '#1e1b4b', bg: '#030712' },
  { id: 'abyss', name: 'Abyss', emblem: '🌊', rarity: 'SHOP', rarityClass: 'exotic', desc: 'Deep oceanic hydrothermal trenches illuminated by bioluminescent jellyfish.', unlockHint: 'Purchased in Cosmetics Shop for 1,200 Bux', primary: '#06b6d4', panel: '#082f49', bg: '#021422' },
  { id: 'magma', name: 'Magma', emblem: '🌋', rarity: 'SHOP', rarityClass: 'mythic', desc: 'A living volcanic caldera with undulating molten lava and rising heat sparks.', unlockHint: 'Purchased in Cosmetics Shop for 1,200 Bux', primary: '#ff4500', panel: '#4a0e04', bg: '#200600' },
  { id: 'quantum', name: 'Quantum', emblem: '⚛️', rarity: 'LEVEL 10', rarityClass: 'mythic', desc: 'Subatomic quark fields and violet singularity particle distortions.', unlockHint: 'Unlocked at Player Level 10', primary: '#c084fc', panel: '#3b0764', bg: '#180828' },
  { id: 'glacier', name: 'Glacier', emblem: '❄️', rarity: 'TRIAL TOWER', rarityClass: 'epic', desc: 'Crystalline sub-zero permafrost radiating pristine arctic frost.', unlockHint: 'Unlocked by clearing Floor 15 in the Trial Tower', primary: '#67e8f9', panel: '#0e4a66', bg: '#082736' },
  { id: 'astral', name: 'Astral', emblem: '🌌', rarity: 'TRIAL TOWER', rarityClass: 'exotic', desc: 'Interstellar nebulas and distant spiral galaxies drifting in silent space.', unlockHint: 'Unlocked by clearing Floor 30 in the Trial Tower', primary: '#a855f7', panel: '#1f0b40', bg: '#09041a' },
  { id: 'celestial', name: 'Celestial', emblem: '☀️', rarity: 'TRIAL TOWER', rarityClass: 'mythic', desc: 'Radiant golden divine solar flares from the throne of the stars.', unlockHint: 'Unlocked by conquering Floor 50 in the Trial Tower', primary: '#fde047', panel: '#593c06', bg: '#261a04' },
  { id: 'collector', name: '100% Collector', emblem: '🏆', rarity: 'COMPLETION', rarityClass: 'mythic', desc: 'Exclusive prismatic aura awarded only to the master card collection archivist.', unlockHint: 'Unlocked when 100% of all cards, spells, and chips are collected', primary: '#f43f5e', panel: '#292524', bg: '#1c1917' },
  { id: 'valentine', name: 'Valentine', emblem: '💘', rarity: 'SECRET', rarityClass: 'exotic', desc: 'Sweetheart confectionery theme filled with romantic rose petals.', unlockHint: 'Unlocked with secret code: LOVE', primary: '#fb7185', panel: '#881337', bg: '#4c0519' },
];

const SLEEVE_DATA_REGISTRY = [
  { id: 'none', name: 'Standard Sleek', rarity: 'COMMON', rarityClass: 'rare', desc: 'Standard clean titanium card border.', cost: 0, sleeveClass: 'sleeve-none' },
  { id: 'sleeve_holo', name: 'Holographic Sleeves', rarity: 'RARE', rarityClass: 'rare', desc: 'Dynamic shimmering rainbow iridescent sheen that glides across cards.', cost: 400, sleeveClass: 'sleeve-holo' },
  { id: 'sleeve_gold', name: 'Gold Sleeves', rarity: 'EPIC', rarityClass: 'epic', desc: 'Gilded 24k gold card borders with a warm pulsing royal glow.', cost: 600, sleeveClass: 'sleeve-gold' },
  { id: 'sleeve_crimson', name: 'Crimson Core Sleeves', rarity: 'RARE', rarityClass: 'rare', desc: 'High-intensity ruby red glowing combat edges for cards.', cost: 550, sleeveClass: 'sleeve-crimson' },
  { id: 'sleeve_prismatic', name: 'Prismatic Sleeves', rarity: 'LEGENDARY', rarityClass: 'legendary', desc: 'A continuously shifting spectrum frame rotating through chromatic colors.', cost: 800, sleeveClass: 'sleeve-prismatic' },
  { id: 'sleeve_void', name: 'Void Sleeves', rarity: 'MYTHIC', rarityClass: 'mythic', desc: 'Deep-space dark matter cosmic frames pulsing with violet singularity energy.', cost: 1200, sleeveClass: 'sleeve-void' },
  { id: 'sleeve_cyber', name: 'Cyber Circuit Sleeves', rarity: 'RARE', rarityClass: 'rare', desc: 'Glowing neon cyan circuit trace lines pulsing around card edges.', cost: 500, sleeveClass: 'sleeve-cyber' },
  { id: 'sleeve_frost', name: 'Glacial Frost Sleeves', rarity: 'EPIC', rarityClass: 'epic', desc: 'Crystalline ice borders with floating frost particle shimmer.', cost: 650, sleeveClass: 'sleeve-frost' },
  { id: 'sleeve_phoenix', name: 'Phoenix Ember Sleeves', rarity: 'LEGENDARY', rarityClass: 'legendary', desc: 'Radiant fiery flame borders shedding glowing phoenix sparks.', cost: 850, sleeveClass: 'sleeve-phoenix' },
  { id: 'sleeve_emerald', name: 'Emerald Empress Sleeves', rarity: 'EPIC', rarityClass: 'epic', desc: 'Luminous jade emerald gemstone borders with gilded corner accents.', cost: 700, sleeveClass: 'sleeve-emerald' },
  { id: 'sleeve_obsidian', name: 'Tactical Obsidian Sleeves', rarity: 'MYTHIC', rarityClass: 'mythic', desc: 'Sleek stealth carbon obsidian frames with crimson laser edging.', cost: 1000, sleeveClass: 'sleeve-obsidian' },
];

const VICTORY_DATA_REGISTRY = [
  { id: 'default_confetti', name: 'Classic Victory Confetti', rarity: 'STANDARD', rarityClass: 'rare', desc: 'Festive multicolored confetti burst upon securing victory.', cost: 0, animType: 'confetti' },
  { id: 'victoryanim_meteor', name: 'Meteor Shower Victory', rarity: 'MYTHIC', rarityClass: 'mythic', desc: 'A blazing storm of meteors streaks down and erupts in explosive shockwaves when you win!', cost: 500, animType: 'meteor' },
  { id: 'effect_confetti', name: 'Confetti+ Celebration', rarity: 'RARE', rarityClass: 'rare', desc: 'Denser, longer-lasting celebration confetti with enhanced gravity physics.', cost: 250, animType: 'confetti_plus' },
  { id: 'effect_victoryburst', name: 'Victory Starburst', rarity: 'EPIC', rarityClass: 'epic', desc: 'A blazing central starburst explosion with shimmering golden shockwave rings.', cost: 350, animType: 'burst' },
  { id: 'victoryanim_supernova', name: 'Cosmic Supernova', rarity: 'LEGENDARY', rarityClass: 'legendary', desc: 'Blinding stellar explosion and cosmic shockwave across the screen.', cost: 650, animType: 'burst' },
  { id: 'effect_fireworks', name: 'Fireworks Spectacular', rarity: 'EPIC', rarityClass: 'epic', desc: 'Multiple bursting colorful sky fireworks on match victory.', cost: 400, animType: 'burst' },
  { id: 'effect_cashrain', name: 'Bux Cash Rain', rarity: 'EPIC', rarityClass: 'epic', desc: 'Cascading golden coins and dollar bills falling across the victory banner.', cost: 450, animType: 'confetti_plus' },
  { id: 'effect_lightning', name: 'Thunder Shockwave', rarity: 'RARE', rarityClass: 'rare', desc: 'Crackling electric lightning bolts striking the victory podium.', cost: 380, animType: 'burst' },
  { id: 'effect_starfountain', name: 'Golden Star Fountain', rarity: 'RARE', rarityClass: 'rare', desc: 'A erupting fountain of spinning golden stars and glitter particles.', cost: 300, animType: 'burst' },
  { id: 'effect_dragonflame', name: 'Dragon Flame Aura', rarity: 'LEGENDARY', rarityClass: 'legendary', desc: 'A roaring dragon fire vortex swirling around your victory rank.', cost: 600, animType: 'meteor' },
  { id: 'victoryanim_blackhole', name: 'Singularity Black Hole', rarity: 'MYTHIC', rarityClass: 'mythic', desc: 'A swirling black hole devours the battlefield upon your ultimate win.', cost: 750, animType: 'meteor' },
  { id: 'victoryanim_orbital', name: 'Orbital Laser Strike', rarity: 'LEGENDARY', rarityClass: 'legendary', desc: 'A massive satellite laser beam blasts down with screen-shaking impact.', cost: 700, animType: 'meteor' },
  { id: 'victoryanim_blizzard', name: 'Subzero Frost Shatter', rarity: 'EPIC', rarityClass: 'epic', desc: 'Flash-freezes the arena into solid ice before shattering into crystalline shards.', cost: 550, animType: 'burst' },
  { id: 'victoryanim_nuke', name: 'Tactical Nuke Blast', rarity: 'MYTHIC', rarityClass: 'mythic', desc: 'A dramatic nuclear countdown mushroom cloud shockwave across the UI.', cost: 800, animType: 'meteor' },
  { id: 'victoryanim_phoenix', name: 'Phoenix Rebirth Finisher', rarity: 'LEGENDARY', rarityClass: 'legendary', desc: 'A magnificent flaming phoenix spreads its wings in golden fire.', cost: 650, animType: 'burst' },
];

function openCollectionBook(initialTab = 'cards') {
  if (typeof Sound !== 'undefined' && Sound.modalOpen) Sound.modalOpen();
  currentLockerTopTab = initialTab;
  renderCollectionScreen(currentLockerTopTab);
  showScreen('screen-collection');
}
function closeCollectionBook() {
  if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
  document.getElementById('collection-book-overlay').classList.add('hidden');
}

const btnOpenCollection = document.getElementById('btn-open-collection');
if (btnOpenCollection) btnOpenCollection.addEventListener('click', () => openCollectionBook('cards'));
const btnCloseCollection = document.getElementById('btn-collection-book-close');
if (btnCloseCollection) btnCloseCollection.addEventListener('click', closeCollectionBook);
const overlayCollection = document.getElementById('collection-book-overlay');
if (overlayCollection) {
  overlayCollection.addEventListener('click', (e) => {
    if (e.target.id === 'collection-book-overlay') closeCollectionBook();
  });
}
const btnBookCards = document.getElementById('btn-collection-book-cards');
if (btnBookCards) btnBookCards.addEventListener('click', () => { closeCollectionBook(); openCollectionBook('cards'); });
const btnBookThemes = document.getElementById('btn-collection-book-themes');
if (btnBookThemes) btnBookThemes.addEventListener('click', () => { closeCollectionBook(); openCollectionBook('themes'); });
const btnBookSwitch = document.getElementById('btn-collection-book-switch');
if (btnBookSwitch) btnBookSwitch.addEventListener('click', () => { openCollectionBook('themes'); });

const SPELL_RARITIES = {
  bolt3:       { class: 'uncommon', name: 'UNCOMMON', effectText: '3 DMG' },
  bolt5:       { class: 'epic',     name: 'EPIC',     effectText: '5 DMG' },
  mend3:       { class: 'uncommon', name: 'UNCOMMON', effectText: '3 HEAL' },
  purge:       { class: 'rare',     name: 'RARE',     effectText: 'REFRESH DEF' },
  chainbolt:   { class: 'epic',     name: 'EPIC',     effectText: '2+1 SPLASH' },
  massmend:    { class: 'legendary',name: 'LEGENDARY',effectText: 'ALL HEAL 2' },
  weaken:      { class: 'rare',     name: 'RARE',     effectText: '-2 DMG' },
  adrenaline:  { class: 'exotic',   name: 'EXOTIC',   effectText: '+3 DMG' },
  frostbolt:   { class: 'rare',     name: 'RARE',     effectText: '2 DMG / -1 ATK' },
  warcry:      { class: 'mythic',   name: 'MYTHIC',   effectText: 'ALL +1 DMG' },
  chainlightning: { class: 'legendary', name: 'LEGENDARY', effectText: '1 DMG ALL / OWN HEAL 2' },
};

const CHIP_RARITIES = {
  chip_atk:        { class: 'uncommon', name: 'UNCOMMON', boostText: '+1 DMG' },
  chip_hp:         { class: 'uncommon', name: 'UNCOMMON', boostText: '+2 HP' },
  chip_twin:       { class: 'rare',     name: 'RARE',     boostText: '+1 DMG / +1 HP' },
  chip_overcharge: { class: 'rare',     name: 'RARE',     boostText: '+2 DMG' },
  chip_fortify:    { class: 'rare',     name: 'RARE',     boostText: '+3 HP' },
  chip_lifeblood:  { class: 'epic',     name: 'EPIC',     boostText: '1 LIFESTEAL' },
  chip_vampiric:   { class: 'legendary',name: 'LEGENDARY',boostText: '2 LIFESTEAL' },
  chip_barrier:    { class: 'epic',     name: 'EPIC',     boostText: '+1 DEFENSE' },
  chip_reflect:    { class: 'exotic',   name: 'EXOTIC',   boostText: '1 REFLECT' },
  chip_focus:      { class: 'mythic',   name: 'MYTHIC',   boostText: '+2 DMG / -1 HP' },
};

// Start or stop live particle canvas preview for victory effects
function startVictoryPreviewCanvas(animType) {
  if (victoryPreviewAnimTimer) {
    cancelAnimationFrame(victoryPreviewAnimTimer);
    victoryPreviewAnimTimer = null;
  }
  const canvas = document.getElementById('victory-preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = (canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth || 320 : 320);
  const h = (canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight || 200 : 200);

  const particles = [];
  const meteors = [];
  const shockwaves = [];

  if (animType === 'meteor') {
    for (let i = 0; i < 6; i++) {
      meteors.push({
        x: Math.random() * w * 0.9 - w * 0.1,
        y: -20 - Math.random() * 120,
        vx: 3.5 + Math.random() * 2.5,
        vy: 5.5 + Math.random() * 3.5,
        trail: [],
        color: Math.random() > 0.35 ? '#ff5500' : '#ffaa00',
        radius: 3 + Math.random() * 2.5,
        hasExploded: false
      });
    }
  } else if (animType === 'burst') {
    for (let r = 0; r < 2; r++) {
      shockwaves.push({
        x: w / 2,
        y: h / 2,
        radius: 5,
        maxRadius: Math.min(w, h) * 0.45,
        speed: 3 + r * 1.5,
        alpha: 0.9,
        color: r === 0 ? '#facc15' : '#38bdf8',
        delay: r * 30
      });
    }
    for (let i = 0; i < 45; i++) {
      const angle = (Math.PI * 2 * i) / 45 + (Math.random() - 0.5) * 0.4;
      const speed = 1.2 + Math.random() * 3.8;
      particles.push({
        x: w / 2,
        y: h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 45 + Math.random() * 35,
        color: ['#facc15', '#f59e0b', '#38bdf8', '#ec4899', '#ffffff', '#a855f7'][Math.floor(Math.random() * 6)],
        size: 2 + Math.random() * 3,
        decay: 0.97
      });
    }
  } else {
    // Confetti or Confetti+
    const count = animType === 'confetti_plus' ? 65 : 35;
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#facc15', '#a855f7', '#ec4899', '#ffffff', '#fb923c'];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 1.4 + Math.random() * 2.5,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3.5 + Math.random() * 4.5,
        shape: Math.random() > 0.4 ? 'rect' : 'circle'
      });
    }
  }

  function loop() {
    ctx.fillStyle = 'rgba(5, 7, 14, 0.22)';
    ctx.fillRect(0, 0, w, h);

    if (animType === 'meteor') {
      meteors.forEach(m => {
        m.trail.push({ x: m.x, y: m.y });
        if (m.trail.length > 10) m.trail.shift();
        m.x += m.vx;
        m.y += m.vy;

        for (let i = 0; i < m.trail.length; i++) {
          const pt = m.trail[i];
          const alpha = i / m.trail.length;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, m.radius * (alpha * 1.2), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 120, 0, ${alpha * 0.8})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff7ed';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (m.y > h * 0.88 || m.x > w) {
          if (!m.hasExploded) {
            m.hasExploded = true;
            shockwaves.push({
              x: m.x,
              y: Math.min(m.y, h - 10),
              radius: 2,
              maxRadius: 28,
              speed: 2.5,
              alpha: 1,
              color: '#f97316'
            });
          }
          if (m.y > h + 20 || m.x > w + 20) {
            m.x = Math.random() * w * 0.7 - w * 0.1;
            m.y = -20 - Math.random() * 60;
            m.trail = [];
            m.hasExploded = false;
          }
        }
      });

      shockwaves.forEach((sw, idx) => {
        sw.radius += sw.speed;
        sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 2 * sw.alpha;
        ctx.globalAlpha = sw.alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (sw.radius >= sw.maxRadius) shockwaves.splice(idx, 1);
      });

    } else if (animType === 'burst') {
      shockwaves.forEach(sw => {
        sw.radius += sw.speed;
        sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3 * sw.alpha;
        ctx.globalAlpha = sw.alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (sw.radius >= sw.maxRadius) {
          sw.radius = 2;
        }
      });

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.decay;
        p.vy *= p.decay;
        p.life++;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        if (p.life >= p.maxLife) {
          p.x = w / 2;
          p.y = h / 2;
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.2 + Math.random() * 3.8;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.life = 0;
        }
      });

    } else {
      particles.forEach(p => {
        p.x += p.vx + Math.sin(p.y / 20) * 0.6;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        if (p.y > h) {
          p.y = -10;
          p.x = Math.random() * w;
        }
      });
    }

    victoryPreviewAnimTimer = requestAnimationFrame(loop);
  }

  loop();
}

// Master inspect function handling both cards and all cosmetics
function inspectLockerItem(item, animate = false) {
  if (!item) return;
  currentInspectedLockerItem = item;

  // Highlight active tile in left grid
  document.querySelectorAll('#screen-collection [data-locker-item-id]').forEach(el => {
    el.classList.toggle('selected', el.dataset.lockerItemId === item.id);
  });

  const showcaseRarity = document.getElementById('showcase-rarity');
  const showcaseCat = document.getElementById('showcase-category');
  const showcaseTitle = document.getElementById('showcase-title');
  const showcaseStage = document.getElementById('showcase-card-stage');
  const showcaseStats = document.getElementById('showcase-stats-grid');
  const showcaseDesc = document.getElementById('showcase-desc');
  const showcaseGlow = document.getElementById('showcase-glow');
  const equipBtn = document.getElementById('showcase-equip-btn');
  const testAnimBtn = document.getElementById('showcase-preview-anim-btn');
  const favBtn = document.getElementById('showcase-favorite-btn');
  const favText = document.getElementById('showcase-fav-text');
  const shopBtn = document.getElementById('showcase-shop-link-btn');

  if (!showcaseTitle || !showcaseStage) return;

  if (victoryPreviewAnimTimer) {
    cancelAnimationFrame(victoryPreviewAnimTimer);
    victoryPreviewAnimTimer = null;
  }

  const kind = item.kind || (item.type ? 'card' : 'item');

  // Reset visibility for labels
  if (showcaseCat) showcaseCat.style.display = 'block';
  if (showcaseRarity) showcaseRarity.style.display = 'inline-block';
  if (showcaseTitle) {
    showcaseTitle.style.display = 'block';
    showcaseTitle.textContent = item.name;
  }

  // Update Rarity & Category
  const rarityName = item.rarityName || item.rarity || 'RARE';
  const rarityClass = item.rarityClass || 'rare';
  if (showcaseRarity) {
    showcaseRarity.textContent = rarityName;
    showcaseRarity.className = `showcase-rarity-pill ${rarityClass}`;
  }
  if (showcaseGlow) showcaseGlow.className = `showcase-bg-glow glow-${rarityClass}`;

  if (kind === 'card') {
    let catText = 'UNIT CARD';
    if (item.type === 'unit') catText = `TIER ${item.tier} UNIT`;
    else if (item.type === 'spell') catText = 'SPELL CARD';
    else if (item.type === 'chip') catText = 'CHIP CARD';
    if (showcaseCat) showcaseCat.textContent = catText;

    let heroClass = item.type === 'unit' ? `tier${item.tier}` : item.rarityClass || 'rare';
    let glyph = item.type === 'unit' ? (TIER_GLYPHS[item.tier] || '●') : item.type === 'spell' ? '⚡' : '💎';
    let statsHTML = item.type === 'unit'
      ? `<span>${item.hp}❤</span><span>${item.dmg}⚔</span><span>${item.sp}⛃</span>`
      : item.type === 'spell' ? `<span>${item.effectText}</span>` : `<span>${item.boostText}</span>`;

    showcaseStage.innerHTML = `
      <div class="flip-card-3d ${animate ? 'is-flipping' : ''}" id="showcase-flip-3d">
        <div class="flip-card-face flip-card-front">
          <div class="showcase-card-hero ${heroClass} ${item.owned ? '' : 'locked'}">
            <div class="sc-hero-glyph">${glyph}</div>
            <div class="sc-hero-name">${item.name}</div>
            <div class="sc-hero-stats">${statsHTML}</div>
            ${item.favorite ? '<div class="sc-hero-fav">★</div>' : ''}
            ${!item.owned ? '<div class="sc-hero-lock">🔒 LOCKED</div>' : ''}
          </div>
        </div>
        <div class="flip-card-face flip-card-back">
          <div class="card-back-inner">
            <div class="card-back-emblem">⚡💎</div>
            <div class="card-back-text">LOCKER</div>
          </div>
        </div>
      </div>`;

    if (showcaseStats) {
      showcaseStats.style.display = 'grid';
      if (item.type === 'unit') {
        showcaseStats.innerHTML = `
          <div class="sc-stat-box"><span class="sc-label">HEALTH</span><strong>${item.hp}❤</strong></div>
          <div class="sc-stat-box"><span class="sc-label">DAMAGE</span><strong>${item.dmg}⚔</strong></div>
          <div class="sc-stat-box"><span class="sc-label">CHIP SLOTS</span><strong>${item.sp}⛃</strong></div>
        `;
      } else if (item.type === 'spell') {
        showcaseStats.innerHTML = `
          <div class="sc-stat-box"><span class="sc-label">TYPE</span><strong>SPELL</strong></div>
          <div class="sc-stat-box"><span class="sc-label">POWER</span><strong>${item.effectText}</strong></div>
          <div class="sc-stat-box"><span class="sc-label">TARGET</span><strong>BOARD</strong></div>
        `;
      } else {
        showcaseStats.innerHTML = `
          <div class="sc-stat-box"><span class="sc-label">TYPE</span><strong>CHIP</strong></div>
          <div class="sc-stat-box"><span class="sc-label">STAT BOOST</span><strong>${item.boostText}</strong></div>
          <div class="sc-stat-box"><span class="sc-label">SLOT REQ</span><strong>1</strong></div>
        `;
      }
    }

    if (showcaseDesc) showcaseDesc.textContent = item.text || item.abilityText || 'Select a card to view combat details.';

    if (equipBtn) equipBtn.style.display = 'none';
    if (testAnimBtn) testAnimBtn.style.display = 'none';
    if (favBtn) {
      favBtn.style.display = item.owned ? 'inline-flex' : 'none';
      if (favText) favText.textContent = item.favorite ? 'FAVORITED ★' : 'FAVORITE';
      favBtn.classList.toggle('is-fav', !!item.favorite);
    }
    if (shopBtn) shopBtn.style.display = 'none';

  } else if (kind === 'theme') {
    if (showcaseCat) showcaseCat.style.display = 'none';
    if (showcaseRarity) showcaseRarity.style.display = 'none';
    if (showcaseTitle) showcaseTitle.style.display = 'none';
    if (showcaseStats) showcaseStats.style.display = 'none';

    const isCurrent = currentTheme === item.id;
    const isUnlocked = isThemeUnlocked(item.id);

    // Get live animated background effects for this theme if available in DOM
    const themeBgDom = document.getElementById('theme-' + item.id + '-bg');
    const bgEffectsHtml = themeBgDom ? themeBgDom.innerHTML : '';

    showcaseStage.innerHTML = `
      <div class="showcase-theme-canvas theme-${item.id}" style="background: ${item.bg}; border-color: ${item.primary}; box-shadow: 0 16px 40px ${item.primary}40;">
        <div class="showcase-theme-bg-layer">${bgEffectsHtml}</div>
      </div>`;

    if (showcaseDesc) {
      showcaseDesc.innerHTML = `
        <div style="margin-bottom:6px;">${item.desc}</div>
        <div style="font-weight:800; color:${item.primary}">✦ How to unlock: ${item.unlockHint}</div>
      `;
    }

    if (favBtn) favBtn.style.display = 'none';
    if (testAnimBtn) testAnimBtn.style.display = 'none';

    if (equipBtn) {
      equipBtn.style.display = 'inline-flex';
      if (isCurrent) {
        equipBtn.textContent = '✓ CURRENTLY EQUIPPED';
        equipBtn.className = 'locker-action-btn equipped';
        equipBtn.onclick = null;
      } else if (isUnlocked) {
        equipBtn.textContent = 'EQUIP THEME';
        equipBtn.className = 'locker-action-btn primary';
        equipBtn.onclick = () => {
          applyTheme(item.id);
          renderCollectionScreen(currentLockerTopTab);
          inspectLockerItem({ ...item, equipped: true });
        };
      } else {
        equipBtn.textContent = '🔒 LOCKED THEME';
        equipBtn.className = 'locker-action-btn secondary';
        equipBtn.onclick = () => {
          if (typeof Sound !== 'undefined' && Sound.error) Sound.error();
        };
      }
    }

    if (shopBtn) shopBtn.style.display = 'none';

  } else if (kind === 'sleeve') {
    if (showcaseCat) showcaseCat.textContent = 'CARD SLEEVE';
    if (showcaseStats) showcaseStats.style.display = 'none';

    const equippedSleeve = loadEquippedSleeve();
    const isEquipped = equippedSleeve === item.id;
    const isOwned = item.id === 'none' || ownsCosmetic(item.id);

    showcaseStage.innerHTML = `
      <div class="showcase-sleeve-stage">
        <div class="sleeve-preview-hero ${item.sleeveClass}">
          <div style="font-size: 2.2rem;">🛡️</div>
          <div style="font-family:var(--font-display); font-weight:900; font-size:0.9rem; color:#fff;">${item.name}</div>
          <div style="font-size:0.65rem; color:#94a3b8; letter-spacing:0.06em;">SLEEVE PREVIEW</div>
        </div>
      </div>`;

    if (showcaseDesc) {
      showcaseDesc.innerHTML = `
        <div style="margin-bottom:6px;">${item.desc}</div>
        <div style="font-weight:800; color:#38bdf8;">✦ Cost: ${item.cost ? `${item.cost} Bux in Shop` : 'Default Free'}</div>
      `;
    }

    if (favBtn) favBtn.style.display = 'none';
    if (testAnimBtn) testAnimBtn.style.display = 'none';

    if (equipBtn) {
      equipBtn.style.display = 'inline-flex';
      if (isEquipped) {
        equipBtn.textContent = '✓ CURRENTLY EQUIPPED';
        equipBtn.className = 'locker-action-btn equipped';
        equipBtn.onclick = null;
      } else if (isOwned) {
        equipBtn.textContent = 'EQUIP SLEEVE';
        equipBtn.className = 'locker-action-btn primary';
        equipBtn.onclick = () => {
          equipSleeve(item.id);
          renderCollectionScreen(currentLockerTopTab);
          inspectLockerItem({ ...item, equipped: true });
        };
      } else {
        equipBtn.textContent = `🛒 UNLOCK (${item.cost} BUX)`;
        equipBtn.className = 'locker-action-btn secondary';
        equipBtn.onclick = () => {
          const btnShop = document.getElementById('btn-shop');
          if (btnShop) btnShop.click();
        };
      }
    }

    if (shopBtn) shopBtn.style.display = 'none';

  } else if (kind === 'victoryAnim' || kind === 'victory') {
    if (showcaseCat) showcaseCat.textContent = 'VICTORY FINISHER';
    if (showcaseStats) showcaseStats.style.display = 'none';

    const equippedVic = loadEquippedVictoryAnim();
    const isEquipped = equippedVic === item.id;
    const isOwned = item.id === 'default_confetti' || ownsCosmetic(item.id);

    showcaseStage.innerHTML = `
      <div class="showcase-victory-stage">
        <canvas id="victory-preview-canvas" class="victory-preview-canvas"></canvas>
      </div>`;

    startVictoryPreviewCanvas(item.animType || 'confetti');

    if (showcaseDesc) {
      showcaseDesc.innerHTML = `
        <div style="margin-bottom:6px;">${item.desc}</div>
        <div style="font-weight:800; color:#facc15;">✦ Celebration: Triggers with sound upon securing match victory.</div>
      `;
    }

    if (favBtn) favBtn.style.display = 'none';
    if (shopBtn) shopBtn.style.display = 'none';

    if (testAnimBtn) {
      testAnimBtn.style.display = 'inline-flex';
      testAnimBtn.onclick = () => {
        if (typeof playVictoryFinisherEffect === 'function') {
          playVictoryFinisherEffect(item.animType || item.id);
        } else if (typeof playMeteorShowerEffect !== 'undefined' && (item.animType === 'meteor' || item.id === 'victoryanim_meteor')) {
          playMeteorShowerEffect(() => {});
        } else if (typeof launchConfetti !== 'undefined') {
          launchConfetti();
        }
      };
    }

    if (equipBtn) {
      equipBtn.style.display = 'inline-flex';
      if (isEquipped) {
        equipBtn.textContent = '✓ CURRENTLY EQUIPPED';
        equipBtn.className = 'locker-action-btn equipped';
        equipBtn.onclick = null;
      } else if (isOwned) {
        equipBtn.textContent = 'EQUIP FINISHER';
        equipBtn.className = 'locker-action-btn primary';
        equipBtn.onclick = () => {
          equipVictoryAnim(item.id);
          renderCollectionScreen(currentLockerTopTab);
          inspectLockerItem({ ...item, equipped: true });
        };
      } else {
        equipBtn.textContent = `🛒 UNLOCK (${item.cost} BUX)`;
        equipBtn.className = 'locker-action-btn secondary';
        equipBtn.onclick = () => {
          const btnShop = document.getElementById('btn-shop');
          if (btnShop) btnShop.click();
        };
      }
    }
  }

  if (animate && typeof Sound !== 'undefined') {
    if (Sound.select) Sound.select();
  }
}

// Top Category Tabs setup (Cards, Victory Effects, Themes, Sleeves)
function setupLockerTopTabs() {
  document.querySelectorAll('.locker-main-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const topTab = btn.dataset.topTab;
      if (topTab) {
        currentLockerTopTab = topTab;
        if (typeof Sound !== 'undefined' && Sound.whoosh) Sound.whoosh('fast', 0.05);
        renderCollectionScreen(currentLockerTopTab);
      }
    };
  });
}

function setupLockerCategoryTabs() {
  document.querySelectorAll('.locker-cat-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.locker-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (typeof Sound !== 'undefined' && Sound.whoosh) Sound.whoosh('fast', 0.05);
      const cat = btn.dataset.cat;
      document.querySelectorAll('#locker-cards-container .locker-section').forEach(sec => {
        const secCat = sec.dataset.section;
        if (cat === 'all') {
          sec.style.display = 'block';
        } else if (cat === 'units') {
          sec.style.display = ['blue', 'green', 'red', 'orange'].includes(secCat) ? 'block' : 'none';
        } else if (cat === 'spells') {
          sec.style.display = secCat === 'spells' ? 'block' : 'none';
        } else if (cat === 'chips') {
          sec.style.display = secCat === 'chips' ? 'block' : 'none';
        } else if (cat === 'radar') {
          sec.style.display = secCat === 'radar' ? 'block' : 'none';
        }
      });
      if (typeof Sound !== 'undefined' && Sound.select) Sound.select();
    };
  });
}

function renderCollectionScreen(activeTopTab = 'cards') {
  currentLockerTopTab = activeTopTab;
  const col = loadCollection();

  // Update top tabs active state
  document.querySelectorAll('.locker-main-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.topTab === activeTopTab);
  });

  // Toggle visible grid containers
  const cardsContainer = document.getElementById('locker-cards-container');
  const cardsSubnav = document.getElementById('locker-cards-subnav');
  const victoryContainer = document.getElementById('locker-victory-container');
  const themesContainer = document.getElementById('locker-themes-container');
  const sleevesContainer = document.getElementById('locker-sleeves-container');

  if (cardsContainer) cardsContainer.style.display = activeTopTab === 'cards' ? 'block' : 'none';
  if (cardsSubnav) cardsSubnav.style.display = activeTopTab === 'cards' ? 'flex' : 'none';
  if (victoryContainer) victoryContainer.style.display = activeTopTab === 'victory' ? 'block' : 'none';
  if (themesContainer) themesContainer.style.display = activeTopTab === 'themes' ? 'block' : 'none';
  if (sleevesContainer) sleevesContainer.style.display = activeTopTab === 'sleeves' ? 'block' : 'none';

  const badgeLabel = document.getElementById('locker-badge-label');
  const totalCountEl = document.getElementById('locker-collected-count');

  let activeItemList = [];

  if (activeTopTab === 'cards') {
    if (badgeLabel) badgeLabel.textContent = 'COLLECTED';
    let totalUnitsCount = 0, totalOwnedUnits = 0;
    [1, 2, 3, 4].forEach(t => {
      totalUnitsCount += UNIT_ARCHETYPES[t].length;
      totalOwnedUnits += UNIT_ARCHETYPES[t].filter(a => col.units.includes(a.id)).length;
    });
    const totalSpellsCount = ALL_SPELL_IDS.length;
    const totalOwnedSpells = col.spells.length;
    const totalChipsCount = ALL_CHIP_IDS.length;
    const totalOwnedChips = col.chips.length;
    const grandTotal = totalUnitsCount + totalSpellsCount + totalChipsCount;
    const grandOwned = totalOwnedUnits + totalOwnedSpells + totalOwnedChips;
    const grandPct = Math.round((grandOwned / Math.max(1, grandTotal)) * 100);

    if (totalCountEl) totalCountEl.textContent = `${grandOwned}/${grandTotal} (${grandPct}%)`;

    const radarEl = document.getElementById('collection-radar-summary');
    if (radarEl) {
      const groups = [
        { name: 'Green', owned: UNIT_ARCHETYPES[2].filter(a => col.units.includes(a.id)).length, total: UNIT_ARCHETYPES[2].length },
        { name: 'Red', owned: UNIT_ARCHETYPES[3].filter(a => col.units.includes(a.id)).length, total: UNIT_ARCHETYPES[3].length },
        { name: 'Orange', owned: UNIT_ARCHETYPES[4].filter(a => col.units.includes(a.id)).length, total: UNIT_ARCHETYPES[4].length },
        { name: 'Spells', owned: col.spells.length, total: ALL_SPELL_IDS.length },
        { name: 'Chips', owned: col.chips.length, total: ALL_CHIP_IDS.length },
      ].map(g => ({ ...g, pct: Math.round(g.owned / Math.max(1, g.total) * 100) }));
      radarEl.innerHTML = `
        <div class="locker-section-head"><span>◎ Completion Radar</span></div>
        <div class="radar-list">
          ${groups.map(g => `
            <div>
              <b>${g.name}</b>
              <span>${g.owned}/${g.total} · ${g.pct}%</span>
              <i><em style="width:${g.pct}%"></em></i>
            </div>`).join('')}
        </div>`;
    }

    const tierContainerIds = { 1: 'collection-blue', 2: 'collection-green', 3: 'collection-red', 4: 'collection-orange' };
    const tierRarityNames = { 1: 'RARE', 2: 'UNCOMMON', 3: 'EPIC', 4: 'LEGENDARY' };
    const tierRarityClasses = { 1: 'rare', 2: 'uncommon', 3: 'epic', 4: 'legendary' };

    [1, 2, 3, 4].forEach(tier => {
      const container = document.getElementById(tierContainerIds[tier]);
      if (!container) return;
      const tierDef = TIERS[tier] || { hp: tier, dmg: tier, sp: Math.max(0, tier - 1) };

      container.innerHTML = UNIT_ARCHETYPES[tier].map(a => {
        const owned = isUnitArchetypeOwned(a.id);
        const favorite = isFavoriteCard(a.id);
        const abilityText = a.pool[0] === 'none' ? 'No special ability' : (ABILITIES[a.pool[0]] ? ABILITIES[a.pool[0]].label : 'Unique ability');
        const cardObj = {
          id: a.id,
          name: a.name,
          tier,
          type: 'unit',
          kind: 'card',
          hp: tierDef.hp,
          dmg: tierDef.dmg,
          sp: a.sp || tierDef.sp,
          abilityText,
          text: a.text || abilityText,
          owned,
          favorite,
          rarityName: tierRarityNames[tier],
          rarityClass: tierRarityClasses[tier]
        };
        activeItemList.push(cardObj);

        return `
        <button type="button" 
                class="locker-tile tier${tier} ${tierRarityClasses[tier]} ${owned ? '' : 'locked'}"
                data-locker-item-id="${a.id}"
                data-collection-card="true"
                data-card-id="${a.id}"
                data-card-name="${a.name}"
                data-owned="${owned}">
          <span class="tile-rarity-tag ${tierRarityClasses[tier]}">${tierRarityNames[tier]}</span>
          ${favorite ? '<span class="tile-fav-star">★</span>' : ''}
          <div class="tile-body">
            <span class="tile-glyph">${TIER_GLYPHS[tier] || '●'}</span>
            <span class="tile-name">${a.name}</span>
          </div>
          <div class="tile-tooltip">
            <span class="tile-tooltip-stat hp">❤ ${tierDef.hp}</span>
            <span class="tile-tooltip-stat dmg">⚔ ${tierDef.dmg}</span>
            <span class="tile-tooltip-stat sp">⛃ ${a.sp || tierDef.sp}</span>
          </div>
          ${owned ? '' : '<div class="tile-lock-overlay">🔒</div>'}
        </button>`;
      }).join('');
    });

    const spellsContainer = document.getElementById('collection-spells');
    if (spellsContainer) {
      spellsContainer.innerHTML = ALL_SPELL_IDS.map(id => {
        const spell = typeof SPELL_DEFS !== 'undefined' ? SPELL_DEFS.find(s => s.id === id) : null;
        if (!spell) return '';
        const owned = isSpellOwned(id);
        const favorite = isFavoriteCard(id);
        const rarityInfo = SPELL_RARITIES[id] || { class: 'rare', name: 'RARE', effectText: 'SPELL' };
        const cardObj = {
          id,
          name: spell.name,
          type: 'spell',
          kind: 'card',
          text: spell.text || spell.desc || '',
          effectText: rarityInfo.effectText,
          owned,
          favorite,
          rarityName: rarityInfo.name,
          rarityClass: rarityInfo.class
        };
        activeItemList.push(cardObj);

        return `
        <button type="button" 
                class="locker-tile ${rarityInfo.class} ${owned ? '' : 'locked'}"
                data-locker-item-id="${id}"
                data-collection-card="true"
                data-card-id="${id}"
                data-card-name="${spell.name}"
                data-owned="${owned}">
          <span class="tile-rarity-tag ${rarityInfo.class}">${rarityInfo.name}</span>
          ${favorite ? '<span class="tile-fav-star">★</span>' : ''}
          <div class="tile-body">
            <span class="tile-glyph">⚡</span>
            <span class="tile-name">${spell.name}</span>
          </div>
          <div class="tile-tooltip">
            <span class="tile-tooltip-stat effect">⚡ ${rarityInfo.effectText}</span>
          </div>
          ${owned ? '' : '<div class="tile-lock-overlay">🔒</div>'}
        </button>`;
      }).join('');
    }

    const chipsContainer = document.getElementById('collection-chips');
    if (chipsContainer) {
      chipsContainer.innerHTML = ALL_CHIP_IDS.map(id => {
        const chip = typeof CHIP_DEFS !== 'undefined' ? CHIP_DEFS.find(c => c.id === id) : null;
        if (!chip) return '';
        const owned = isChipOwned(id);
        const favorite = isFavoriteCard(id);
        const rarityInfo = CHIP_RARITIES[id] || { class: 'rare', name: 'RARE', boostText: 'BOOST' };
        const cardObj = {
          id,
          name: chip.name,
          type: 'chip',
          kind: 'card',
          text: chip.text || chip.desc || '',
          boostText: rarityInfo.boostText,
          owned,
          favorite,
          rarityName: rarityInfo.name,
          rarityClass: rarityInfo.class
        };
        activeItemList.push(cardObj);

        return `
        <button type="button" 
                class="locker-tile ${rarityInfo.class} ${owned ? '' : 'locked'}"
                data-locker-item-id="${id}"
                data-collection-card="true"
                data-card-id="${id}"
                data-card-name="${chip.name}"
                data-owned="${owned}">
          <span class="tile-rarity-tag ${rarityInfo.class}">${rarityInfo.name}</span>
          ${favorite ? '<span class="tile-fav-star">★</span>' : ''}
          <div class="tile-body">
            <span class="tile-glyph">💎</span>
            <span class="tile-name">${chip.name}</span>
          </div>
          <div class="tile-tooltip">
            <span class="tile-tooltip-stat effect">💎 ${rarityInfo.boostText}</span>
          </div>
          ${owned ? '' : '<div class="tile-lock-overlay">🔒</div>'}
        </button>`;
      }).join('');
    }

  } else if (activeTopTab === 'themes') {
    if (badgeLabel) badgeLabel.textContent = 'THEMES';
    const themesGrid = document.getElementById('collection-themes');
    if (themesGrid) {
      const totalThemes = THEME_DATA_REGISTRY.length;
      const unlockedThemes = THEME_DATA_REGISTRY.filter(t => isThemeUnlocked(t.id)).length;
      if (totalCountEl) totalCountEl.textContent = `${unlockedThemes}/${totalThemes} (${Math.round((unlockedThemes / totalThemes) * 100)}%)`;

      themesGrid.innerHTML = THEME_DATA_REGISTRY.map(t => {
        const unlocked = isThemeUnlocked(t.id);
        const equipped = currentTheme === t.id;
        const themeObj = { ...t, kind: 'theme', owned: unlocked, equipped };
        activeItemList.push(themeObj);

        return `
        <button type="button"
                class="locker-tile theme-preview-tile ${t.rarityClass} ${unlocked ? '' : 'locked'}"
                data-locker-item-id="${t.id}"
                data-collection-card="true"
                data-card-id="${t.id}"
                data-card-name="${t.name}"
                data-owned="${unlocked}"
                style="background: ${t.bg}; border-color: ${t.primary}; box-shadow: 0 8px 24px ${t.primary}25;">
          ${equipped ? '<span class="tile-equipped-badge">✓ EQUIPPED</span>' : ''}
          <div class="tile-body">
            <span class="tile-glyph">${t.emblem}</span>
            <span class="tile-name" style="color: ${t.primary}; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">${t.name}</span>
            <div class="tile-theme-swatches">
              <span class="tile-theme-swatch" style="background:${t.primary}"></span>
              <span class="tile-theme-swatch" style="background:${t.panel}"></span>
              <span class="tile-theme-swatch" style="background:${t.bg}"></span>
            </div>
          </div>
          <div class="tile-tooltip">
            <span class="tile-tooltip-stat effect">${t.name} Theme</span>
          </div>
          ${unlocked ? '' : '<div class="tile-lock-overlay">🔒</div>'}
        </button>`;
      }).join('');
    }

  } else if (activeTopTab === 'sleeves') {
    if (badgeLabel) badgeLabel.textContent = 'SLEEVES';
    const sleevesGrid = document.getElementById('collection-sleeves');
    if (sleevesGrid) {
      const equippedSleeve = loadEquippedSleeve();
      const ownedSleeves = SLEEVE_DATA_REGISTRY.filter(s => s.id === 'none' || ownsCosmetic(s.id)).length;
      const totalSleeves = SLEEVE_DATA_REGISTRY.length;
      if (totalCountEl) totalCountEl.textContent = `${ownedSleeves}/${totalSleeves} (${Math.round((ownedSleeves / totalSleeves) * 100)}%)`;

      sleevesGrid.innerHTML = SLEEVE_DATA_REGISTRY.map(s => {
        const owned = s.id === 'none' || ownsCosmetic(s.id);
        const equipped = equippedSleeve === s.id;
        const sleeveObj = { ...s, kind: 'sleeve', owned, equipped };
        activeItemList.push(sleeveObj);

        return `
        <button type="button"
                class="locker-tile ${s.rarityClass} ${owned ? '' : 'locked'}"
                data-locker-item-id="${s.id}"
                data-collection-card="true"
                data-card-id="${s.id}"
                data-card-name="${s.name}"
                data-owned="${owned}">
          <span class="tile-rarity-tag ${s.rarityClass}">${s.rarity}</span>
          ${equipped ? '<span class="tile-equipped-badge">✓ EQUIPPED</span>' : ''}
          <div class="tile-body">
            <span class="tile-glyph">🛡️</span>
            <span class="tile-name">${s.name}</span>
          </div>
          <div class="tile-tooltip">
            <span class="tile-tooltip-stat effect">${s.name}</span>
          </div>
          ${owned ? '' : '<div class="tile-lock-overlay">🔒</div>'}
        </button>`;
      }).join('');
    }

  } else if (activeTopTab === 'victory') {
    if (badgeLabel) badgeLabel.textContent = 'EFFECTS';
    const victoryGrid = document.getElementById('collection-victory');
    if (victoryGrid) {
      const equippedVic = loadEquippedVictoryAnim();
      const ownedVic = VICTORY_DATA_REGISTRY.filter(v => v.id === 'default_confetti' || ownsCosmetic(v.id)).length;
      const totalVic = VICTORY_DATA_REGISTRY.length;
      if (totalCountEl) totalCountEl.textContent = `${ownedVic}/${totalVic} (${Math.round((ownedVic / totalVic) * 100)}%)`;

      victoryGrid.innerHTML = VICTORY_DATA_REGISTRY.map(v => {
        const owned = v.id === 'default_confetti' || ownsCosmetic(v.id);
        const equipped = equippedVic === v.id;
        const vicObj = { ...v, kind: 'victoryAnim', owned, equipped };
        activeItemList.push(vicObj);

        return `
        <button type="button"
                class="locker-tile ${v.rarityClass} ${owned ? '' : 'locked'}"
                data-locker-item-id="${v.id}"
                data-collection-card="true"
                data-card-id="${v.id}"
                data-card-name="${v.name}"
                data-owned="${owned}">
          <span class="tile-rarity-tag ${v.rarityClass}">${v.rarity}</span>
          ${equipped ? '<span class="tile-equipped-badge">✓ EQUIPPED</span>' : ''}
          <div class="tile-body">
            <span class="tile-glyph">🎆</span>
            <span class="tile-name">${v.name}</span>
          </div>
          <div class="tile-tooltip">
            <span class="tile-tooltip-stat effect">${v.name}</span>
          </div>
          ${owned ? '' : '<div class="tile-lock-overlay">🔒</div>'}
        </button>`;
      }).join('');
    }
  }

  // Bind click inspection across all tiles
  document.querySelectorAll('#screen-collection [data-locker-item-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.lockerItemId;
      const found = activeItemList.find(item => item.id === id);
      if (found) {
        inspectLockerItem(found, true);
      }
    });
  });

  // Auto inspect first or previously selected item
  if (activeItemList.length) {
    let toInspect = null;
    if (currentInspectedLockerItem) {
      toInspect = activeItemList.find(item => item.id === currentInspectedLockerItem.id);
    }
    if (!toInspect) {
      toInspect = activeItemList.find(item => item.equipped) || activeItemList.find(item => item.owned) || activeItemList[0];
    }
    if (toInspect) {
      inspectLockerItem(toInspect, false);
    }
  }

  setupLockerTopTabs();
  setupLockerCategoryTabs();
  setupCollectionTools();

  // Wire showcase favorite button
  const favBtn = document.getElementById('showcase-favorite-btn');
  if (favBtn) {
    favBtn.onclick = () => {
      if (!currentInspectedLockerItem) return;
      toggleFavoriteCard(currentInspectedLockerItem.id);
      renderCollectionScreen(currentLockerTopTab);
    };
  }

  // Wire shop link buttons
  const shopLinkBtn = document.getElementById('btn-collection-shop-link');
  if (shopLinkBtn) {
    shopLinkBtn.onclick = () => {
      const btnShop = document.getElementById('btn-shop');
      if (btnShop) btnShop.click();
    };
  }
  const showcaseShopBtn = document.getElementById('showcase-shop-link-btn');
  if (showcaseShopBtn) {
    showcaseShopBtn.onclick = () => {
      const btnShop = document.getElementById('btn-shop');
      if (btnShop) btnShop.click();
    };
  }
}

function getFavoriteCards() {
  try { return JSON.parse(localStorage.getItem('mehrbod_favorite_cards') || '[]'); }
  catch (_) { return []; }
}
function saveFavoriteCards(list) {
  localStorage.setItem('mehrbod_favorite_cards', JSON.stringify([...new Set(list)]));
}
function toggleFavoriteCard(id) {
  const favorites = getFavoriteCards();
  const i = favorites.indexOf(id);
  if (i >= 0) favorites.splice(i, 1);
  else favorites.push(id);
  saveFavoriteCards(favorites);
  if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
  return i < 0;
}
function isFavoriteCard(id) {
  return getFavoriteCards().includes(id);
}

function setupCollectionTools() {
  const search = document.getElementById('collection-search');
  const filter = document.getElementById('collection-filter');

  const apply = () => {
    const query = (search?.value || '').trim().toLowerCase();
    const modeVal = filter?.value || 'all';

    const activeContainerId = currentLockerTopTab === 'themes' ? 'locker-themes-container'
      : currentLockerTopTab === 'sleeves' ? 'locker-sleeves-container'
      : currentLockerTopTab === 'victory' ? 'locker-victory-container'
      : 'locker-cards-container';
    
    const activeContainer = document.getElementById(activeContainerId);
    if (!activeContainer) return;

    activeContainer.querySelectorAll('[data-locker-item-id]').forEach(el => {
      const id = el.dataset.lockerItemId || '';
      const name = (el.dataset.cardName || '').toLowerCase();
      const owned = el.dataset.owned === 'true';
      const favorite = isFavoriteCard(id);
      const isEquipped = el.querySelector('.tile-equipped-badge') !== null;
      const matchesQuery = !query || name.includes(query);
      const matchesMode =
        modeVal === 'all' ||
        (modeVal === 'owned' && owned) ||
        (modeVal === 'missing' && !owned) ||
        (modeVal === 'equipped' && isEquipped) ||
        (modeVal === 'favorites' && favorite);
      
      const visible = matchesQuery && matchesMode;
      el.hidden = !visible;
      el.style.display = visible ? 'flex' : 'none';
    });

    // Reset and conditionally adjust locker sections within active container only
    activeContainer.querySelectorAll('.locker-section').forEach(sec => {
      const tiles = sec.querySelectorAll('[data-locker-item-id]');
      if (tiles.length > 0) {
        const hasVisible = Array.from(tiles).some(t => t.style.display !== 'none');
        sec.style.display = hasVisible ? 'block' : 'none';
      } else {
        sec.style.display = 'block';
      }
    });
  };

  if (search) {
    search.oninput = apply;
    search.onsearch = apply;
    search.onkeyup = apply;
  }
  if (filter) filter.onchange = apply;
  apply();
}

// ---- Quests panel -------------------------------------------------------
// Now the single home for: theme-unlock quests (beat each difficulty),
// the Daily Challenge, and Forge Milestones (achievements) - these last
// two used to be separate popups reached from their own main-menu feature-
// strip buttons; that strip is trimmed down to just Collection now, and
// everything progression-related lives in this one panel instead.
function renderQuests() {
  const list = document.getElementById('quests-list');
  if (!list) return;

  const daily = loadDailyChallengeState();
  const def = getDailyChallengeDef();
  const pct = Math.round(Math.min(100, (daily.progress / def.target) * 100));
  const dailyHtml = `
    <div class="deck-builder-heading"><span>⚡ Daily Challenge</span></div>
    <div class="quest-row${daily.claimed ? ' complete' : ''}" style="flex-direction:column; align-items:stretch; gap:4px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div class="quest-body">
          <div class="quest-title">${def.desc}</div>
          <div class="quest-desc">${daily.progress}/${def.target}${daily.claimed ? ' · Claimed for today' : ` · Reward ${dailyChallengeReward((daily.streak || 0) + 1)} Bux`}</div>
        </div>
        <div class="quest-status">${daily.claimed ? '✅' : '⬜'}</div>
      </div>
      <div class="challenge-progress-track"><div class="challenge-progress-fill" style="width:${pct}%"></div></div>
      <div class="challenge-streak-pill">🔥 ${daily.streak || 0}-day streak</div>
    </div>
  `;

  const unlocked = loadUnlockedAchievements();
  const achievementsHtml = `
    <div class="deck-builder-heading" style="margin-top:18px;"><span>🏆 Forge Milestones</span><span>${unlocked.length}/${ACHIEVEMENTS.length}</span></div>
    ${ACHIEVEMENTS.map(a => {
      const done = unlocked.includes(a.id);
      return `<div class="quest-row achievement-row ${done ? 'complete' : 'locked'}">
        <div class="quest-icon">${a.icon}</div>
        <div class="quest-body">
          <div class="quest-title">${a.name}</div>
          <div class="quest-desc">${a.desc}</div>
          ${a.reward > 0 ? `<div class="achievement-reward">Reward: ${a.reward} Bux</div>` : ''}
        </div>
        <div class="quest-status">${done ? '✅' : '🔒'}</div>
      </div>`;
    }).join('')}
  `;

  const beaten = loadBeatenDifficulties();
  const themeRowsHtml = QUEST_DEFS.map(q => {
    const done = beaten.includes(q.diff);
    return `<div class="quest-row${done ? ' complete' : ''}">
      <div class="quest-icon">${q.icon}</div>
      <div class="quest-body">
        <div class="quest-title">${q.name} — unlocks ${themeDisplayName(q.theme)}</div>
        <div class="quest-desc">${q.desc}</div>
      </div>
      <div class="quest-status">${done ? '✅' : '⬜'}</div>
    </div>`;
  }).join('');
  const allDiffsDone = isAllDiffsUnlocked(beaten);
  const allDiffsRowHtml = `<div class="quest-row${allDiffsDone ? ' complete' : ''}">
    <div class="quest-icon">${ALL_DIFFS_QUEST.icon}</div>
    <div class="quest-body">
      <div class="quest-title">${ALL_DIFFS_QUEST.name} — unlocks ${themeDisplayName(ALL_DIFFS_QUEST.theme)}</div>
      <div class="quest-desc">${ALL_DIFFS_QUEST.desc} (${beaten.length}/5)</div>
    </div>
    <div class="quest-status">${allDiffsDone ? '✅' : '⬜'}</div>
  </div>`;

  list.innerHTML = dailyHtml + achievementsHtml +
    `<div class="deck-builder-heading" style="margin-top:18px;"><span>🎨 Theme Quests</span></div>` +
    themeRowsHtml + allDiffsRowHtml;
}
function openQuests() {
  if (typeof Sound !== 'undefined' && Sound.modalOpen) Sound.modalOpen();
  renderQuests();
  document.getElementById('quests-overlay').classList.remove('hidden');
}
document.getElementById('btn-open-quests').addEventListener('click', openQuests);
document.getElementById('btn-open-quests-menu').addEventListener('click', openQuests);
document.getElementById('btn-quests-close').addEventListener('click', () => {
  if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
  document.getElementById('quests-overlay').classList.add('hidden');
});
document.getElementById('quests-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'quests-overlay') {
    if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
    document.getElementById('quests-overlay').classList.add('hidden');
  }
});

// ---- Copy room code ------------------------------------------------------
document.getElementById('btn-copy-code').addEventListener('click', async () => {
  const code = document.getElementById('room-code').textContent.trim();
  if (!code || code === '------') return;
  try {
    await navigator.clipboard.writeText(code);
    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
    showToast('Room code copied!');
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const success = document.execCommand('copy');
      ta.remove();
      if (success) {
        if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
        showToast('Room code copied!');
        return;
      }
    } catch (_) {}
    showToast('Could not copy — select and copy it manually.');
  }
});

// ---- Patch notes --------------------------------------------------------
const CURRENT_VERSION = '4.0';
const PATCH_NOTES = [
  {
    version: '4.0',
    notes: [
      "REWORKED: Stats accessibility — removed the redundant menu footer 'Stats' button. All player progress, including the Bux Ledger, Recent Activity, Match History, Net Wager Profit, and the new ▶ Watch Last Replay button, has been unified under the main Player Profile panel (accessible via the top-left avatar).",
      "NEW: Watch Last Replay button added directly to the Player Profile panel for easier access to your previous match.",
      "NEW: Net Wager Profit displayed directly in the Player Profile stats grid.",
      "NEW: opening a Card Pack is now a real pack-opening moment — tear the foil pack open, then flip each card one by one with tier-colored glow, sound, and sparkle bursts, instead of an instant toast.",
      "NEW progression system: Daily Login Rewards — a 7-day escalating streak, separate from the Daily Challenge, claimable once per calendar day from the menu footer.",
      "REWORKED: Meteor Shower victory animation is longer and hits harder — more meteors, ground impact flashes, a deeper secondary boom, and a multi-pulse camera shake.",
      "REWORKED: Void Sleeves now swirl with an animated corner portal and a pulsing void-energy glow.",
      "REWORKED: Cyber Neon theme gained a periodic full-screen scan beam and a subtle glitch-flicker on cards.",
      "REWORKED: Abyss theme gained a sweeping anglerfish lure light and a stronger jellyfish pulse.",
      "REWORKED: 100% Collector (Diamond Vault) cards throw a little sparkle burst on hover.",
      "POLISH: buttons and cards across the whole app got a tactile ripple/press feel and slightly livelier hover motion.",
    ],
  },
  {
    version: '3.14',
    notes: [
      "PROFILE HUD: moved your colored-letter profile avatar button to the top-left corner of the screen so your Bux balance sits alone in the top-right corner.",
      "IN-MATCH OPTIONS: hid the 'Reset All Progress' button from the Options menu while inside an active battle match (retained in main menu Settings).",
      "MOBILE EMOTES FIX: fixed emote popover positioning on touch devices using viewport-fixed coordinates to prevent overflow clipping in mobile battle docks.",
      "MOBILE OVERHAUL: completely redesigned the battle UI for touch screens with a glassmorphic header bar, compact 'R' ready button, responsive board slots, and horizontal deck scrolling, plus fixed a bug where the battle UI remained visible at the bottom of menu screens on mobile.",
      "IN-MATCH EMOTES: added an Emote Popover menu ('💬 Emotes') in the battle bar that expands on hover/tap to let you send animated reaction bubbles (⚔️, 🛡️, 🔥, 👏, 💀) floating over boards with sound effects, haptics, and bot counter-reactions.",
      "HOTKEYS: added global battle keyboard shortcuts (R to Ready, U to Undo placement, M to Combine/Merge) with contextual desktop key hints that automatically hide on touch/mobile devices.",
      "MOBILE FIX: elevated the main menu footer (Collection, Quests, Settings, and Stats) above the Magma and Flame theme animations, giving it dedicated glass-pad styling and high-contrast typography so it never gets obscured by rolling lava waves on mobile devices.",
      "VISUAL: completely reworked the Flame theme into a living blue fire inferno — replacing the rigid polygonal cutouts with organic fluid flame plumes, roaring dual plasma beds, deep subterranean thermal surges, dynamic multi-layered combustion cores, floating embers, and electric sparks.",
      "QOL: moved the Mehrbod Shop exit button to the top left corner instead of the bottom, and added keyboard shortcut support so pressing Escape instantly takes you out of the shop to the main menu.",
      "NEW: added a new living Magma theme to the Mehrbod Shop rotation — featuring undulating molten lava waves, buoyant rising embers, glowing fissure veins, and seismic thermal surges.",
      "NEW: several new secret redeemable codes have been added to the Mehrbod Shop's Codes section — find and enter them to earn Bux, cosmetics, and progression rewards.",
      "BALANCE: removed overpowered card-granting codes from the code redemption system to preserve progression balance.",
      "FIX: the Quit Match button in the in-battle Options menu now reliably forfeits the match, cancels bot routines, cleans up connections, and returns to the main menu with a custom in-game confirmation dialog that works consistently across all environments.",
      "CLEANUP: removed the experimental header forfeit button from the battle bar so the in-game header stays clean and uncluttered.",
    ],
  },
  {
    version: '3.13',
    notes: [
      "NEW: a colored-letter profile avatar now sits next to your Bux counter (top-right) - click it for Stats 2.0, a completely rebuilt profile hub covering battle stats, your Bux ledger, recent activity, and match history alongside every progression system (Player Level, Prestige, Arena Rank, Trial Tower, Set Bonuses, Weekly Vault) in one polished screen. The old footer Stats button is gone - everything lives behind your avatar now.",
      "NEW: a small ! badge appears on your profile picture whenever you're eligible to Prestige.",
      "MOVED: Trial Tower now has its own entry in the Single Player menu instead of a quick-start row in Quests.",
      "NEW: a real Trial Tower infographic - a climbable tower of floor-bricks color-coded by difficulty. Winning stamps a checkmark and grows the tower by a floor with its own drop-in animation; losing makes the whole tower explode (screen shake, flying debris, the works) before resetting to Floor 1.",
      "NEW: the guided menu tour now explains Arena Rank, Prestige, Trial Tower, and the Weekly Vault via your new profile picture.",
      "NEW: a secret Valentine's theme, hidden entirely until unlocked with the right code from the Shop's Codes section - floating hearts, a cupid's-glow pulse, the occasional arrow streak across the screen, and its own card-hover heart-burst.",
      "NEW: a Codes section in the Mehrbod Shop for redeeming one-time codes.",
    ],
  },
  {
    version: '3.12',
    notes: [
      "NEW: 4 more progression systems, on top of Player Level and the Weekly Vault - Arena Rank (a rising/falling RP ladder from Bronze to Grandmaster), Prestige (reset your Player Level at Lv 15+ for a permanent bonus on every future win), Set Completion Bonuses (auto-claimed Bux for fully owning the Green/Red/Orange/Spell/Chip sets), and Trial Tower (an escalating single-track bot gauntlet with a permanent best-floor record). All four live in the 🏆 Quests panel.",
      "NEW: 12 new cards - 3 per tier, including Blue. The 9 new Green/Red/Orange abilities are all built around mechanics no existing card used: a damage-negating Ward, stealing an enemy card outright, permanent chip-slot growth, a 2-round burn, an HP-threshold board wipe, striking twice per attack, a stat that scales with the match's total death count, dying into two fresh Blue cards, and an immediate bonus strike on placement.",
      "RULE CHANGE: the per-round merge cap is now 2 (up from 1). Bots now actually use up to the same cap too - previously bot AI only ever attempted a single merge per round no matter what the cap allowed.",
      "NEW: a Codes section in the Mehrbod Shop for redeeming one-time codes.",
      "FIX: cards in the placement row (and the spells/chips row) could still get visually clipped on hover, even after the board fix - their horizontal scroll strip was implicitly clipping vertical movement too. Fixed with breathing room instead of removing the scroll behavior.",
    ],
  },
  {
    version: '3.10',
    notes: [
      "RULE CHANGE: merging is now capped at 1 voluntary merge per player per round (any size, 2-4 cards). Merges needed to clear a forced 4+-Blue board are exempt from this cap, so the forced-merge safety valve always still works.",
      "REMOVED: the 10-Bux 'safety net' floor. Spending is now only ever limited by your actual balance, for both normal purchases and wagers.",
      "REWORKED: the Mehrbod Shop dropped its tab bar entirely. It now shows three fixed, always-visible sections that quietly rotate once a day: 6 Cosmetics, 6 Card Packs (six fixed sizes, from Mini to Ultra), and 6 Individual Cards you can buy outright with no randomness.",
      "NEW progression systems: Player Level (an uncapped XP track from wins, packs, dailies, and milestones, with a Bux reward on every level-up) and the Weekly Vault (a weekly point track with five claimable Bux tiers) - both live inside the 🏆 Quests panel.",
      "CHANGED: the Daily Login Reward popup no longer has a menu-footer button - it now only ever appears as the once-a-day popup, including the first time a brand-new player gets back to the menu after finishing the tutorial.",
      "REWORKED: the Meteor Shower victory animation now uses real tumbling rock meteors with glowing tails that crash into the ground and explode (flash + shockwave + flying embers), instead of plain light streaks.",
      "FIX: hovering a card in either board could get visually clipped instead of floating cleanly above its neighbors.",
      "FIX: with 4+ Blue cards forcing a merge, 🧬 Combine mode's multi-card selection was being wiped by every render before you could ever confirm it - only the single-pair drag gesture actually worked. Both now work while forced.",
      "FIX: the bot would defend forever with unlimited-charge Blue cards once it had no non-Blue blueprints left to ever merge or attack meaningfully with, effectively turtling for the rest of the match. It now stops treating Blue as defend-eligible once its blueprints run out.",
      "FIX: equipping a card sleeve could silently revert within a couple of seconds - the equip action never refreshed the save-integrity backup snapshot the way every other purchase does, so the anti-tamper check mistook the new sleeve for corruption and rolled it back.",
    ],
  },
  {
    version: '3.9',
    notes: [
      "NEW: opening a Card Pack is now a real pack-opening moment — tear the foil pack open, then flip each card one by one with tier-colored glow, sound, and sparkle bursts, instead of an instant toast.",
      "REWORKED: Meteor Shower victory animation is longer, denser, and hits harder — more meteors, ground impact flashes, and a bigger multi-pulse camera shake.",
      "REWORKED: Void Sleeves now swirl with an animated corner portal and a pulsing void-energy glow instead of a static outline.",
      "REWORKED: Cyber Neon theme gained a periodic full-screen scan beam and a subtle glitch-flicker on cards.",
      "REWORKED: Abyss theme gained a sweeping anglerfish lure light and pulsing jellyfish glow.",
      "REWORKED: 100% Collector (Diamond Vault) cards now throw a little sparkle burst on hover.",
      "POLISH: buttons and cards across the whole app got a tactile ripple/press feel and slightly livelier hover motion.",
    ],
  },
  {
    version: '3.8',
    notes: [
      "SWAPPED: Flame and Storm now unlock the opposite way they used to - Flame is the single-difficulty reward (beat Hard), and Storm is the secret 6th theme for beating every difficulty.",
      "REDESIGNED: Storm theme - a real supercell now, with a violet storm-glow horizon, four independent lightning bolts, a full-sky flash that fires with each strike, wind-blown streaks, and nearly twice the rainfall.",
      "REDESIGNED: 100% Collector theme, now a 'Diamond Vault' - an icy-white, rose-gold, and champagne palette with a sweeping spotlight and faceted diamond card edges, replacing the old gold/cyan/pink mix so it no longer overlaps visually with Sovereign or the old Collector look.",
      "NEW: two purchasable themes in the Mehrbod Shop - Cyber Neon (1200 Bux: a neon cyberpunk grid with drifting glyph particles and CRT scanlines) and Abyss (1200 Bux: a bioluminescent deep-sea vault with drifting jellyfish glow, rising bubbles, and caustic light rays).",
      "NEW cosmetic category: Victory Animations. The first one, Meteor Shower (500 Bux), plays a full-screen meteor shower the instant its owner wins a match, visible to BOTH players right before the win/lose screen appears - equipped-victory-animation info is exchanged between host and guest at match start so it's never a surprise only the winner sees.",
    ],
  },
  {
    version: '3.7',
    notes: [
      "REMOVED: Round Timer. Matches are untimed again.",
      "REMOVED: Card of the Day.",
      "FIX: quitting your own multiplayer match could flash \"Your opponent forfeited — you win!\" at the very person who quit, instead of only ever showing to the player who was actually left behind. Closing your own connection was triggering your own forfeit handler; it's now only ever triggered by a genuine disconnect from the other side.",
      "FIX: pressing Enter while typing a room code on the Join screen now submits it, same as tapping Connect.",
      "FIX: removed a floating \"WIN STREAK\" badge that duplicated the win-streak text already shown under the main menu buttons.",
      "NEW: a Volume slider in Options, alongside the existing mute toggle.",
      "NEW: a Vibration toggle in Options - short haptic buzzes on hits, deaths, merges, and wins on devices that support it.",
      "NEW: Reset All Progress in Options - a two-step-confirmed way to wipe all locally saved Bux, cards, achievements, stats, and settings on this device.",
    ],
  },
  {
    version: '3.6',
    notes: [
      "NEW: Deck Builder search & filter - a search box and a tier dropdown now sit above the Units grid, matching the Collection Book's tools, so building a deck from a growing card pool doesn't mean endless scrolling.",
      "NEW: Merge Preview - while picking cards in 🧬 Combine mode, a live preview panel shows the exact HP/DMG/chip-slots the resulting card will have and names which blueprint(s) it'll pull from, before you commit to the fusion.",
    ],
  },
  {
    version: '3.5',
    notes: [
      "NEW: Combine mode — merge 2, 3, or 4 of your own cards in a single fusion instead of only ever pairs. Four Blues can now go straight to Orange, three Blues straight to Red, a Blue + Green straight to Orange, and so on, as long as the tiers add up to 2, 3, or 4 and you still have the matching blueprint. Tap 🧬 Combine in the mode bar, tap 2-4 of your cards to pick them, then Confirm — the classic drag-one-card-onto-another merge for pairs still works exactly as before.",
      "JUICE: bigger fusions (3-4 cards) and any merge that lands on Orange now get a dedicated 'mega fusion' burst — an outward ring of sparkle particles, a richer chime, and its own toast — instead of the same small pulse every merge used to get.",
      "NEW achievement: Mega Fusion, for merging 3+ cards together in one go.",
      "The bot now looks for the biggest legal fusion available (up to 4 cards) before falling back to a plain pair, on every difficulty.",
    ],
  },
  {
    version: '3.4',
    notes: [
      "POLISH: unified every popup in the app (Quests, Themes, Options, Patch Notes, Game Over, Player Stats, Card of the Day) onto the same design - a blurred backdrop, a soft glow inside the card that re-colors itself to match your active theme, a consistent shadow, a small kicker label, and the same bouncy pop-in entrance. Several of these used to be noticeably flatter/plainer than the rest.",
      "POLISH: the Player Stats panel's inner sections (ledger, activity, radar bars) now use theme colors throughout instead of a hardcoded dark palette, so they actually match Pink/Aurora/Sovereign/etc. themes instead of always looking the same navy blue.",
      "POLISH: the wager-amount picker's selected-button glow, and the deck builder's 'DECK READY' label, now use your active theme's accent color and get a small celebratory pulse instead of a flat, hardcoded highlight.",
    ],
  },
  {
    version: '3.3',
    notes: [
      "FIX: new players started with zero Green/Red/Orange cards owned, so their deck was 100% Blue and merging could never do anything - Blue+Blue had no blueprint to consume into. Every player now starts with a small owned spread across Green/Red/Orange (retroactively too, if you were affected), and the deck builder's default pre-fill now seeds in a couple of owned blueprints automatically instead of defaulting to all-Blue.",
      "CLEANUP: removed the leftover duplicate Collection shortcut beneath the main menu buttons.",
      "NEW: Board Power Meter - a live tug-of-war bar in-match showing relative board strength (HP+DMG) between you and your opponent.",
      "NEW: Match History - your last 20 matches (mode, result, rounds, duration) are now logged and viewable in the 📊 Player Stats panel.",
      "NEW: Colorblind-friendly tier glyphs - every card now shows a small shape (●▲■★) next to its name matching its tier, so tier is never conveyed by color alone.",
    ],
  },
  {
    version: '3.2',
    notes: [
      "FIX: restored each non-Blue card's own single, fixed, unique ability. Green Warden, Red Wraith, and Orange Colossus had regressed into sharing randomized ability pools (Wraith and Colossus could even roll the identical ability, and Warden could roll no ability at all) - every one of the 15 non-Blue archetypes is now locked to exactly one ability that belongs to it and nothing else.",
      "CLEANUP: removed the duplicate Collection shortcut that sat beneath the main menu buttons - the footer's 📖 Collection link is the one way in now.",
      "NEW: 4 chips - Vampiric Chip (heal 2 on attack), Barrier Chip (+1 bonus defend charge), Reflect Chip (1 dmg back to attackers), Focus Chip (+2 DMG / -1 HP).",
      "NEW: 2 spells - Frost Bolt (2 dmg + permanent -1 DMG), War Cry (permanent +1 DMG to all of a player's cards).",
      "NEW: Same Deck Rematch - Play Again after a bot match now reuses the exact deck you built instead of a random one.",
      "NEW: Card of the Day - a daily-rotating spotlight on one non-Blue archetype, from the main menu footer.",
      "NEW: Auto-Fill Remaining Slots in the deck builder - one click randomly fills whatever units/spells/chips you haven't picked yet from your owned collection.",
    ],
  },
  {
    version: '3.1',
    notes: [
      "RULE CHANGE: merging into a tier with more than one matching blueprint in your deck now lets you pick exactly which one to consume, instead of it being chosen for you.",
      "RULE CHANGE: a merge now replenishes the FULL number of Blues it consumed (not capped to 1) as long as a blueprint is still left in your deck afterward - every merge permanently spends one of those finite blueprints though, so this can't run away forever; once blueprints are gone, Blue stops regenerating and merging into that tier is closed for good.",
      "NEW: Undo Last Placement — a single-level undo for your most recent Blue placement, available in vs-bot matches before you ready up. Merges are never undoable (their on-play effects may have already happened), only placements (which are always effect-free).",
      "NEW: Battle Report — the game-over screen now calls out your MVP card for the match (most damage dealt, plus its kill count).",
      "NEW: Kill Combo callouts — landing 2+ kills with your own attacks in the same simultaneous resolution now gets its own toast (DOUBLE KILL! / TRIPLE KILL! / etc).",
    ],
  },
  {
    version: '3.0',
    notes: [
      "BIG CHANGE: the hand and draw step are gone. Every card in your deck is visible and available to place (if Blue) or use as a merge blueprint (if Green/Red/Orange) from round 1 - nothing is hidden or drawn progressively anymore.",
      "RULE CHANGE: merging now always requires a matching-tier blueprint card still sitting unused in your deck - there's no more generic fallback fusion. Run out of a tier's blueprint and you can never merge into that tier again for the rest of the match, so pick some Green/Red/Orange cards in the deck builder if you want to fuse up.",
      "RULE CHANGE: Blue cards only regenerate on death or merge while you still have at least one non-Blue blueprint left in your deck. Once you're completely out, Blue stops replenishing for good.",
      "SAFETY: the forced-merge rule (4+ Blues on one board) now only triggers when a legal, blueprint-backed merge actually exists, so running out of blueprints can never lock you out of your own turn.",
      "FIX: matches against the bot could run on forever. Merging two Blue cards was quietly minting an extra card out of thin air every time (2 cards in, 1 merged card + 2 replenished Blues out) instead of staying card-count-neutral, so decks kept growing faster than combat could shrink them. Merging now always hands back at most 1 Blue when a Blue was consumed, matching how a Blue's death-and-replenish already worked.",
      "FIX: cards could appear to vanish from the board 'for no reason' right as a new round started. That's a delayed attack finally landing - a queued hit from an attacker that died to a spell/chip mid-attack-phase last round - which was resolving completely silently. It's now called out with its own toast so a losing card always has a visible, explained cause.",
      "SAFETY: the round cap that force-ends a stalemated match is lowered from 300 to 60.",
      "REORG: Daily Challenge and Forge Milestones now live inside the 🏆 Quests panel instead of their own menu buttons.",
      "REORG: Battle Stats, Bux Ledger, and Recent Activity are now one combined Player Stats panel, opened from the menu footer.",
      "REORG: the Collection Radar's completion percentages now show directly at the top of the Collection Book instead of a separate popup, and the main-menu strip has a single Collection shortcut.",
      "REORG: 'How to play' moved into the Single Player menu; the footer button in its place opens the new Player Stats panel.",
    ],
  },
  {
    version: '2.10',
    notes: [
      "FIX: the game was completely unplayable — starting any match (Practice vs Bot, Host Match, or Join Match) crashed immediately because the deck builder screen was never actually implemented. It's now a real screen: pick 12 units, 4 spells, and 2 chips, then confirm.",
      "FIX: none of the Back buttons anywhere in the app did anything. Every screen now returns to its correct parent.",
      "FIX: the Collection Book (Cards / Themes chooser) could never be opened — its buttons existed but had no listeners. It now opens from the single 📖 Collection entry on the main menu.",
      "FIX: the Collection screen's card grids (Blue/Green/Red/Orange/Spells/Chips) never actually rendered anything. They now show your real owned collection, with working search and filters.",
      "FIX: a multiplayer guest's deck selection was stored in an undeclared variable relying on implicit globals; it's now declared properly.",
      "CLEANUP: the main menu's utility strip is trimmed down to four buttons that all actually work (Battle Stats, Recent Activity, Bux Ledger, Collection Radar). The old strip's Collection button duplicated the footer's own — there is now exactly one way to get to the Collection Book.",
    ],
  },
  {
    version: '2.9',
    notes: [
      "NEW: Card Mastery — every owned card now tracks individual battle experience and mastery levels.",
    ],
  },
  {
    version: '2.8',
    notes: [
      "NEW: Battle Statistics — track wins, losses, win rate, wagers won/lost, and biggest win.",
      "NEW: Match Streaks — consecutive wins build a streak with a subtle in-match indicator.",
      "NEW: Economy Ledger — recent Bux gains and losses are recorded so your balance changes are easier to understand.",
      "NEW: Collection Completion Radar — the Collection Book highlights your closest unfinished card groups.",
    ],
  },
  {
    version: '2.6',
    notes: [
      "NEW: Favorite Cards — mark cards as favorites and quickly find them in the Collection Book.",
      "NEW: Collection search/filter tools — search by card name and filter owned, missing, favorites, or all cards.",
      "NEW: Recent Activity panel so important rewards and purchases are easier to keep track of."
    ],
  },
  {
    version: '2.5',
    notes: [
      "ECONOMY: VS Bot wagers now have difficulty-based caps so Easy cannot be used as a high-volume, low-risk Bux farm.",
      "Wager caps: Easy 10 Bux, Medium 25, Hard 50, Expert 100, Master 200.",
    ],
  },
  {
    version: '2.3',
    notes: [
      "MAJOR SHOP REDESIGN: Mehrbod Shop is now a modern live-service storefront with a large featured area, rotating-style daily picks, bundles, category rails, clear Bux pricing, ownership states, and a shop refresh countdown.",
    ],
  },
  {
    version: '2.2',
    notes: [
      "NEW: Collection is now a real Collection Book. Press Collection from the main menu and choose whether you want to browse Cards or Themes.",
    ],
  },
  {
    version: '2.1',
    notes: [
      "NEW: the 100% Collector theme has been completely redesigned as a high-end cosmic collector vault.",
    ],
  },
  {
    version: '2.0',
    notes: [
      "Big one: the main menu is now Single Player / Mehrbod Shop / Multiplayer instead of three flat buttons.",
      "New currency: Mehrbod Bux. First-time players start with 50, and a balance can never drop below 10.",
      "Rule change: Green, Red, and Orange can no longer be placed or drawn directly — the only way to get one onto the board is by merging.",
      "New: a full card collection, and a deck builder where you pick exactly 12 units, 4 spells, and 2 chips before every match.",
    ],
  },
  {
    version: '1.0',
    notes: [
      'Initial release: browser card battler with vs-bot (4 difficulty levels) and peer-to-peer multiplayer.',
      'Built as a static site (HTML/CSS/JS) ready to host on GitHub Pages.',
    ],
  },
];

function renderPatchNotes() {
  const list = document.getElementById('patchnotes-list');
  list.innerHTML = PATCH_NOTES.map((entry, i) => `
    <div class="patch-entry">
      <div class="patch-version">v${entry.version} ${i === 0 ? '<span class="current-tag">current</span>' : ''}</div>
      <ul>${entry.notes.map(n => `<li>${n}</li>`).join('')}</ul>
    </div>
  `).join('');
}

document.getElementById('btn-version').textContent = `v${CURRENT_VERSION}`;
updateVersionBadge();
document.getElementById('btn-version').addEventListener('click', () => {
  renderPatchNotes();
  document.getElementById('patchnotes-overlay').classList.remove('hidden');
  if (typeof Sound !== 'undefined' && Sound.modalOpen) Sound.modalOpen();
  markPatchNotesSeen();
});
document.getElementById('btn-patchnotes-close').addEventListener('click', () => {
  document.getElementById('patchnotes-overlay').classList.add('hidden');
  if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
});
document.getElementById('patchnotes-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'patchnotes-overlay') {
    document.getElementById('patchnotes-overlay').classList.add('hidden');
    if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
  }
});

// ---- "NEW" badge for unseen patch notes ------------------------------------
function updateVersionBadge() {
  const badge = document.getElementById('version-badge');
  if (!badge) return;
  let lastSeen = null;
  try { lastSeen = localStorage.getItem('mehrbod-cards-last-seen-version'); } catch (e) {}
  badge.classList.toggle('hidden', lastSeen === CURRENT_VERSION);
}
function markPatchNotesSeen() {
  try { localStorage.setItem('mehrbod-cards-last-seen-version', CURRENT_VERSION); } catch (e) {}
  const badge = document.getElementById('version-badge');
  if (badge) badge.classList.add('hidden');
}

// ---- Esc closes whatever overlay is currently open, or clears a selection ---
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const overlays = ['confirm-overlay', 'patchnotes-overlay', 'options-overlay', 'quests-overlay', 'themes-overlay', 'collection-book-overlay', 'player-name-overlay', 'stats-hub-overlay'];
  for (const id of overlays) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) {
      el.classList.add('hidden');
      if (typeof Sound !== 'undefined' && Sound.modalClose) Sound.modalClose();
      return;
    }
  }

  // Pack opening overlay
  const packOverlay = document.querySelector('.packopen-overlay');
  if (packOverlay) {
    const contBtn = packOverlay.querySelector('.packopen-continue:not(.hidden)');
    if (contBtn) { contBtn.click(); return; }
    packOverlay.remove();
    return;
  }

  // Pressing Escape takes you out of the Mehrbod shop to the main menu
  const shopEl = document.getElementById('screen-shop-cosmetics');
  if (shopEl && !shopEl.classList.contains('hidden')) {
    e.preventDefault();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    showScreen('screen-menu');
    return;
  }
  const legacyShopEl = document.getElementById('screen-shop');
  if (legacyShopEl && !legacyShopEl.classList.contains('hidden')) {
    e.preventDefault();
    showScreen('screen-menu');
    return;
  }
  const shopBotEl = document.getElementById('screen-shop-bot');
  if (shopBotEl && !shopBotEl.classList.contains('hidden')) {
    e.preventDefault();
    showScreen('screen-menu');
    return;
  }
  const shopHostEl = document.getElementById('screen-shop-host-setup');
  if (shopHostEl && !shopHostEl.classList.contains('hidden')) {
    e.preventDefault();
    showScreen('screen-menu');
    return;
  }

  if (!state || document.getElementById('screen-game').classList.contains('hidden')) return;
  if (isForced(state, localKey)) return;
  if (selMode !== null || selHandIdx !== null || selAttackerSlot !== null || selSpellId !== null || selChipId !== null) {
    resetSelections();
    render();
  }
});

// ---- Player name -> first-run tutorial --------------------------------------
const PLAYER_NAME_KEY = 'mehrbod-cards-player-name';
function loadPlayerName() {
  try { return (localStorage.getItem(PLAYER_NAME_KEY) || '').trim(); } catch (e) { return ''; }
}
function savePlayerName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!cleaned) return false;
  try { localStorage.setItem(PLAYER_NAME_KEY, cleaned); } catch (e) { return false; }
  return true;
}
function showPlayerNamePrompt(afterSave) {
  const overlay = document.getElementById('player-name-overlay');
  const input = document.getElementById('player-name-input');
  const error = document.getElementById('player-name-error');
  if (!overlay || !input) { afterSave(); return; }
  overlay.classList.remove('hidden');
  input.value = loadPlayerName();
  const submit = () => {
    if (!savePlayerName(input.value)) {
      if (error) error.textContent = 'Please enter a name.';
      input.focus();
      return;
    }
    overlay.classList.add('hidden');
    if (error) error.textContent = '';
    afterSave();
  };
  input.onkeydown = e => { if (e.key === 'Enter') submit(); };
  document.getElementById('player-name-confirm').onclick = submit;
  setTimeout(() => input.focus(), 30);
}
function ensurePlayerNameThen(action) {
  if (loadPlayerName()) action();
  else showPlayerNamePrompt(action);
}

restoreInventoryBackupIfTampered();
setInterval(restoreInventoryBackupIfTampered, 1500);

if (!hasTutorialBeenSeen()) {
  ensurePlayerNameThen(() => startFullTutorial());
}

// Minecraft-style Splash Texts for MEHRBOD CARDS Logo
const MINECRAFT_SPLASH_TEXTS = [
  "Blue merges into Green!",
  "Break every board!",
  "100% Organic Bux!",
  "Now with 3D Card Flips!",
  "Don't let the bot win!",
  "Try Story Mode!",
  "Over 9000 Bux!",
  "Better than Solitaire!",
  "Powered by Mehrbod Bux!",
  "Awesome card art!",
  "Press M for a secret!",
  "Master Tier Bot awaits!",
  "Also try Trial Tower!",
  "Climb the citadel!",
  "So many themes to unlock!",
  "Burn the other side to zero!",
  "Draft 12, fuse smart!",
  "Spells & Chips included!",
  "GG WP!",
  "Mythic rarity unlocked!",
  "It's a secret to everybody!",
  "Do a barrel roll!",
  "Sovereign Gold approved!",
  "Cyberneon aesthetic!",
  "Glacier subzero freezing!",
  "Magma heat surge active!",
  "Lifesteal activated!",
  "Check the Card Locker!",
  "Daily challenges ready!",
  "Also play in Multiplayer!",
  "Made with love!",
  "Subzero frostbolts!",
  "Warcry buffed!",
  "Unstoppable combo!",
  "Victory is yours!",
  "Press Start to Play!",
  "Unlimited potential!",
  "Top tier strategies!",
  "No mock data here!",
  "100% Pure Skill!"
];

function initMinecraftSplashText() {
  const splashEl = document.getElementById('minecraft-splash');
  if (!splashEl) return;

  if (typeof splashTextEnabled !== 'undefined' && !splashTextEnabled) {
    splashEl.classList.add('hidden');
    return;
  }
  splashEl.classList.remove('hidden');

  const splash = MINECRAFT_SPLASH_TEXTS[Math.floor(Math.random() * MINECRAFT_SPLASH_TEXTS.length)];
  splashEl.textContent = splash;
}
initMinecraftSplashText();

document.addEventListener('DOMContentLoaded', () => {
  initMinecraftSplashText();
  setTimeout(() => {
    const mastery = getCardMastery();
    document.querySelectorAll('[data-card-id]').forEach(card => {
      const id = card.dataset.cardId;
      if (!id || !mastery[id]) return;
      let badge = card.querySelector('.card-mastery-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'card-mastery-badge';
        badge.title = 'Card Mastery';
        card.appendChild(badge);
      }
      badge.textContent = `M${mastery[id].level}`;
    });
  }, 350);
});

// Run once, at the very end of the script, so every function/const this
// transitively touches (ALL_DIFFICULTIES, loadBeatenDifficulties, etc.) is
// guaranteed to already be declared - calling this any earlier as top-level
// code risks a Temporal Dead Zone crash that silently aborts every listener
// registered further down the file.
checkAchievements();
