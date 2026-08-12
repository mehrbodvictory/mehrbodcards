
// ---- Global state ------------------------------------------------------
let state = null;
let mode = null;           // 'bot' | 'mp'
let localKey = null, remoteKey = null;
let botDifficulty = loadLastDifficulty() || 'Medium';
let botRng = null;
let botActedKey = null;
let net = null;
let pendingGuestDeckConfig = null; // deck config picked in the deck builder before joining a host

let selMode = null;        // 'defend' | 'spell' | 'chip' | null
let selHandIdx = null;
let selAttackerSlot = null;
let selSpellId = null;
let selChipId = null;
let logVisible = false;
let suppressNextClick = false;
let gameOverAnnounced = false;
let animatingCombat = false;
let matchStartTime = null;
let botThinkingTimer = null;
let currentWager = 0; // Mehrbod Bux staked on the current match, if any
let currentWagerHeldAtFloor = false; // exact-10 wager: stake remains at 10 until result
let shopSelectedWager = 0;     // wager amount picked on the "Wager vs Bot" screen
let shopHostSelectedWager = 0; // wager amount picked on the "Host a Wagered Match" screen
const _lowHpWarned = new Set(); // card ids we've already played the low-hp warning tone for
const COMBAT_ANIM_MS = 900;
const BOT_THINK_MS_MIN = 450, BOT_THINK_MS_MAX = 900;

// ---- Screen management ---------------------------------------------------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  const buxCounter = document.getElementById('bux-counter');
  if (buxCounter) buxCounter.classList.toggle('hidden', id === 'screen-game');
}

// Explicit, per-element "pressed" feedback via Pointer Events instead of the
// CSS :active pseudo-class - guarantees only the exact button the user is
// touching/clicking ever gets the press effect, never its siblings.
function wirePressFeedback(el) {
  const press = () => el.classList.add('pressed');
  const release = () => el.classList.remove('pressed');
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
}

// ---- Mehrbod Bux (in-app play currency) ------------------------------------
const STARTING_BUX = 50;
const MIN_BUX_FLOOR = 10; // normal spending never takes a player below this floor
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
function spendBux(amount, isWager = false) {
  const bal = loadBux();
  if (!(amount > 0) || !Number.isFinite(amount)) return false;
  const n = Math.floor(amount);
  if (isWager) {
    if (n > bal) return false;
  } else if (bal - n < MIN_BUX_FLOOR) {
    return false;
  }
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
const ALL_SPELL_IDS = SPELL_DEFS.map(s => s.id);
const ALL_CHIP_IDS = CHIP_DEFS.map(c => c.id);
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

const PACK_COST = 20;
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
  dbUnitCounts['blue_sprite'] = REQUIRED_UNIT_COUNT;
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
  showScreen('screen-deck-builder');
}

function dbAdjustUnit(archetypeId, delta) {
  const current = dbUnitCounts[archetypeId] || 0;
  const total = dbTotalUnits();
  if (delta > 0 && total >= REQUIRED_UNIT_COUNT) return;
  const next = Math.max(0, current + delta);
  if (next === 0) delete dbUnitCounts[archetypeId];
  else dbUnitCounts[archetypeId] = next;
  renderDeckBuilder();
}

function dbToggleSpell(id) {
  const idx = dbSelectedSpells.indexOf(id);
  if (idx !== -1) { dbSelectedSpells.splice(idx, 1); }
  else if (dbSelectedSpells.length < REQUIRED_SPELL_COUNT) { dbSelectedSpells.push(id); }
  renderDeckBuilder();
}
function dbToggleChip(id) {
  const idx = dbSelectedChips.indexOf(id);
  if (idx !== -1) { dbSelectedChips.splice(idx, 1); }
  else if (dbSelectedChips.length < REQUIRED_CHIP_COUNT) { dbSelectedChips.push(id); }
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
      const abilityText = a.pool.length === 1 && a.pool[0] === 'none' ? 'No special ability' : 'Rolls a unique ability';
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

  spellsContainer.innerHTML = '';
  SPELL_DEFS.forEach(s => {
    const owned = col.spells.includes(s.id);
    const selected = dbSelectedSpells.includes(s.id);
    const el = document.createElement('div');
    el.className = `dcard ${owned ? '' : 'locked'} ${selected ? 'selected' : ''}`;
    el.innerHTML = `<div class="dcard-name">${s.name}</div><div class="dcard-text">${s.text}</div>${owned ? '' : '<div class="dcard-lock">🔒 Locked</div>'}`;
    if (owned) el.addEventListener('click', () => dbToggleSpell(s.id));
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
}

document.getElementById('btn-deck-builder-confirm').addEventListener('click', () => {
  const totalUnits = dbTotalUnits();
  if (totalUnits !== REQUIRED_UNIT_COUNT || dbSelectedSpells.length !== REQUIRED_SPELL_COUNT || dbSelectedChips.length !== REQUIRED_CHIP_COUNT) return;
  const unitIds = [];
  Object.entries(dbUnitCounts).forEach(([id, count]) => { for (let i = 0; i < count; i++) unitIds.push(id); });
  const config = { unitIds, spellIds: dbSelectedSpells.slice(), chipIds: dbSelectedChips.slice() };
  const cb = dbOnConfirm;
  dbOnConfirm = null;
  if (cb) cb(config);
});

// ---- Cosmetics (v2.0) -------------------------------------------------------
const COSMETIC_ITEMS = [
  { id: 'theme_mrmoney',    kind: 'theme',  name: '🤑 Mr Money Theme', desc: 'Green money-rain theme for the whole app.', cost: 1000 },
  { id: 'sleeve_holo',      kind: 'sleeve', name: '🌈 Holographic Sleeves', desc: 'Shimmering rainbow card outlines.', cost: 400 },
  { id: 'sleeve_gold',      kind: 'sleeve', name: '✨ Gold Sleeves', desc: 'Gilded card outlines with a soft glow.', cost: 600 },
  { id: 'sleeve_prismatic', kind: 'sleeve', name: '🌈 Prismatic Sleeves', desc: 'A shifting spectrum frame around every card.', cost: 800 },
  { id: 'sleeve_void',      kind: 'sleeve', name: '🕳️ Void Sleeves', desc: 'Deep-space black frames with a violet glow.', cost: 1200 },
  { id: 'effect_confetti',  kind: 'effect', name: '🎉 Confetti+', desc: 'Bigger, longer victory confetti.', cost: 250 },
  { id: 'effect_victoryburst', kind: 'effect', name: '✨ Victory Burst', desc: 'Adds a brighter burst to your win celebration.', cost: 350 },
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
      saveBux(Math.max(MIN_BUX_FLOOR, Number(saved.bux) || MIN_BUX_FLOOR));
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
}

function buyOrEquipCosmetic(item) {
  if (!ownsCosmetic(item.id)) {
    if (!spendBux(item.cost)) { showToast("You don't have enough Mehrbod Bux for that (you always keep at least 10)."); return; }
    const owned = loadOwnedCosmetics();
    owned.push(item.id);
    saveOwnedCosmetics(owned);
    showToast(`🎉 Unlocked ${item.name}!`, 2600);
    if (item.kind === 'theme') updateThemeButtons();
    if (item.kind === 'sleeve') equipSleeve(item.id);
    renderCosmeticsShop();
    return;
  }
  if (item.kind === 'sleeve') equipSleeve(item.id);
  else if (item.kind === 'theme') showToast('Open Settings → Themes to wear it!', 2400);
}

function renderCosmeticsShop() {
  const list = document.getElementById('shop-cosmetics-list');
  if (!list) return;

  const owned = loadOwnedCosmetics();
  const equippedSleeve = loadEquippedSleeve();
  const balance = loadBux();

  const items = [
    { id:'theme_mrmoney', kind:'theme', name:'Mr Money Theme', desc:'Turn the whole game into a money-soaked neon vault.', cost:1000, tag:'FEATURED', art:'💸', original:1500 },
    { id:'sleeve_prismatic', kind:'sleeve', name:'Prismatic Sleeves', desc:'Animated spectrum borders for every card.', cost:800, tag:'NEW', art:'🌈', original:1000 },
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

  const featured = [items[0], items[1], items[2]];
  const daily = [items[3], items[4], items[5], items[6]];
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
        <button class="modern-shop-art" data-shop-buy="${item.id}">
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

document.getElementById('btn-multiplayer').addEventListener('click', () => showScreen('screen-multiplayer'));
function openModernShop() {
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
};
document.querySelectorAll('.back-btn').forEach(btn => {
  const screenEl = btn.closest('.screen');
  if (!screenEl) return;
  wirePressFeedback(btn);
  btn.addEventListener('click', () => {
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
function showBattleStats() {
  const s = getBattleStats();
  const total = s.wins + s.losses;
  const rate = total ? Math.round((s.wins / total) * 100) : 0;
  const old = document.getElementById('battle-stats-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'battle-stats-overlay';
  overlay.className = 'feature-overlay';
  overlay.innerHTML = `
    <div class="feature-panel battle-stats-panel">
      <button class="feature-close">✕</button>
      <span class="feature-kicker">PLAYER RECORD</span>
      <h2>BATTLE STATISTICS</h2>
      <div class="stats-grid">
        <div><b>${s.wins}</b><span>WINS</span></div>
        <div><b>${s.losses}</b><span>LOSSES</span></div>
        <div><b>${rate}%</b><span>WIN RATE</span></div>
        <div><b>${s.streak}</b><span>CURRENT STREAK</span></div>
        <div><b>${s.bestStreak}</b><span>BEST STREAK</span></div>
        <div><b>${s.biggestWin}</b><span>BIGGEST WIN</span></div>
      </div>
      <div class="stats-ledger">
        <span>NET WAGER PROFIT</span>
        <b>${s.wagerWon - s.wagerLost} BUX</b>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.feature-close').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
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
function showEconomyLedger() {
  const old = document.getElementById('economy-ledger-overlay');
  if (old) old.remove();
  const items = getEconomyLedger();
  const overlay = document.createElement('div');
  overlay.id = 'economy-ledger-overlay';
  overlay.className = 'feature-overlay';
  overlay.innerHTML = `
    <div class="feature-panel">
      <button class="feature-close">✕</button>
      <span class="feature-kicker">BUX HISTORY</span>
      <h2>ECONOMY LEDGER</h2>
      <div class="ledger-list">
        ${items.length ? items.map(x => `
          <div class="${x.amount >= 0 ? 'gain' : 'loss'}">
            <b>${x.amount >= 0 ? '+' : ''}${x.amount} Bux</b>
            <span>${escapePresetText(x.reason)}</span>
            <small>${new Date(x.at).toLocaleString()}</small>
          </div>`).join('') :
          '<p class="activity-empty">No balance changes have been recorded yet.</p>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.feature-close').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

function showCollectionRadar() {
  const col = loadCollection();
  const groups = [
    { name: 'Green', owned: UNIT_ARCHETYPES[2].filter(a => col.units.includes(a.id)).length, total: UNIT_ARCHETYPES[2].length },
    { name: 'Red', owned: UNIT_ARCHETYPES[3].filter(a => col.units.includes(a.id)).length, total: UNIT_ARCHETYPES[3].length },
    { name: 'Orange', owned: UNIT_ARCHETYPES[4].filter(a => col.units.includes(a.id)).length, total: UNIT_ARCHETYPES[4].length },
    { name: 'Spells', owned: col.spells.length, total: ALL_SPELL_IDS.length },
    { name: 'Chips', owned: col.chips.length, total: ALL_CHIP_IDS.length },
  ].map(g => ({ ...g, pct: Math.round(g.owned / Math.max(1, g.total) * 100) }))
   .sort((a, b) => a.pct - b.pct);

  const old = document.getElementById('collection-radar-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'collection-radar-overlay';
  overlay.className = 'feature-overlay';
  overlay.innerHTML = `
    <div class="feature-panel">
      <button class="feature-close">✕</button>
      <span class="feature-kicker">COLLECTION PROGRESS</span>
      <h2>COMPLETION RADAR</h2>
      <div class="radar-list">
        ${groups.map(g => `
          <div>
            <b>${escapePresetText(g.name)}</b>
            <span>${g.owned}/${g.total} · ${g.pct}%</span>
            <i><em style="width:${g.pct}%"></em></i>
          </div>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.feature-close').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
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
function openRecentActivity() {
  const old = document.getElementById('recent-activity-overlay');
  if (old) old.remove();
  const items = getRecentActivity();
  const overlay = document.createElement('div');
  overlay.id = 'recent-activity-overlay';
  overlay.className = 'feature-overlay';
  overlay.innerHTML = `
    <div class="feature-panel recent-activity-panel">
      <button class="feature-close">✕</button>
      <span class="feature-kicker">RECENT ACTIVITY</span>
      <h2>YOUR LATEST WINS</h2>
      <div class="activity-list">
        ${items.length ? items.map(x => `<div><span>✦</span><p>${escapePresetText(x.text)}<small>${new Date(x.at).toLocaleString()}</small></p></div>`).join('') :
          '<p class="activity-empty">Your important rewards and purchases will appear here.</p>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.feature-close').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

function renderStreakIndicator() {
  const s = getBattleStats();
  const existing = document.getElementById('match-streak-indicator');
  if (!s.streak) { if (existing) existing.remove(); return; }
  let el = existing;
  if (!el) {
    el = document.createElement('div');
    el.id = 'match-streak-indicator';
    document.body.appendChild(el);
  }
  el.textContent = `WIN STREAK ×${s.streak}`;
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    renderStreakIndicator();
    document.getElementById('btn-battle-stats')?.addEventListener('click', showBattleStats);
    document.getElementById('btn-economy-ledger')?.addEventListener('click', showEconomyLedger);
    document.getElementById('btn-collection-radar')?.addEventListener('click', showCollectionRadar);
    document.getElementById('btn-recent-activity')?.addEventListener('click', openRecentActivity);
  }, 250);
});


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
      if (amt === MIN_BUX_FLOOR && loadBux() === MIN_BUX_FLOOR) {
        currentWagerHeldAtFloor = true;
      } else if (!spendBux(amt, true)) {
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
    if (amt === MIN_BUX_FLOOR && loadBux() === MIN_BUX_FLOOR) {
      currentWagerHeldAtFloor = true;
    } else if (!spendBux(amt, true)) {
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

// ---- Vs Bot --------------------------------------------------------------
function startVsBot(wagerAmount = 0, deckConfig = null) {
  if (!wagerAmount) currentWagerHeldAtFloor = false;
  mode = 'bot';
  localKey = 'you'; remoteKey = 'bot';
  const seed = makeSeed();
  gameOverAnnounced = false;
  matchStartTime = Date.now();
  currentWager = wagerAmount || 0;
  _lowHpWarned.clear();
  cancelBotThinking();
  state = createMatch(seed, 'you', 'bot', deckConfig ? { you: deckConfig } : {});
  botRng = new RngStream(seed + 999);
  botActedKey = null;
  resetSelections();
  showScreen('screen-game');
  document.getElementById('top-bar-info').textContent = `Vs Bot · ${botDifficulty}` + (currentWager > 0 ? ` · 💰${currentWager.toLocaleString()}` : '');
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
    text: '🏆 Quests track the themes you can unlock by beating each bot difficulty at least once.',
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
    text: 'This is your hand. Drag any card down onto an empty slot on your board to place it.',
    target: () => document.getElementById('hand-row'),
    waitFor: (action, res) => action.type === 'place' && res.ok,
  },
  {
    text: 'Nicely done! Place one more card the same way.',
    target: () => document.getElementById('hand-row'),
    waitFor: (action, res) => action.type === 'place' && res.ok,
  },
  {
    text: "You've got two Blue cards on your board now. Drag one Blue card onto the other to merge them into a stronger Green card. Blue is the only tier you can ever place directly - everything above it only ever comes from merging.",
    target: () => document.getElementById('player-board'),
    waitFor: (action, res) => action.type === 'merge' && res.ok,
  },
  {
    text: 'Your whole deck stays visible face-up all game — no hidden information about what you might draw.',
    target: () => document.getElementById('deck-section'),
  },
  {
    text: "Spells and chips (below your hand) can target any card, on either side, at any point in the round - you don't need to wait for a special phase to use them.",
    target: () => document.getElementById('spells-chips-row'),
  },
  {
    text: "One more thing about your deck: before a real match, you'll pick it yourself in the deck builder - including any Green/Red/Orange cards you own. Those can't be placed directly either, but merging Blues into their exact tier consumes one from your hand and uses its special ability instead of a generic result. We skipped that step for this practice match so you could jump straight in.",
    target: null,
  },
  {
    text: 'If you ever get 4+ Blue cards on your board at once, you\u2019ll be forced to merge one before doing anything else - your Blues will glow and a banner will explain. Keep an eye out for it.',
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
  matchStartTime = Date.now();
  currentWager = 0;
  currentWagerHeldAtFloor = false;
  _lowHpWarned.clear();
  cancelBotThinking();
  state = createMatch(seed, 'you', 'bot');
  botRng = new RngStream(seed + 999);
  botActedKey = null;
  resetSelections();

  const handRng = new RngStream(seed + 555);
  state.players.you.hand = [
    makeUnitCard(1, handRng, 'none'),
    makeUnitCard(1, handRng, 'none'),
    makeUnitCard(1, handRng, 'none'),
  ];

  showScreen('screen-game');
  document.getElementById('top-bar-info').textContent = 'Tutorial · Practice Match';
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

function spawnCastEffect(ownerKey, slot, kind, amount) {
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
  if (amount) spawnFloatingNumberOn(slotEl, amount.text, amount.kind);
}

function playFx(fxList) {
  (fxList || []).forEach(evt => {
    switch (evt.type) {
      case 'merge': {
        spawnCastEffect(evt.owner, evt.toSlot, 'merge');
        if (evt.usedBlueprint) showToast('🧩 Used a blueprint from hand!', 1600);
        break;
      }
      case 'chipAttach': {
        let text = null;
        if (evt.dmgAmount && evt.hpAmount) text = `+${evt.dmgAmount}⚔ +${evt.hpAmount}❤`;
        else if (evt.dmgAmount) text = `+${evt.dmgAmount}⚔`;
        else if (evt.hpAmount) text = `+${evt.hpAmount}❤`;
        else if (evt.lifesteal) text = '🩸';
        spawnCastEffect(evt.owner, evt.slot, 'chip', text ? { text, kind: 'heal' } : null);
        break;
      }
      case 'defend': {
        spawnCastEffect(evt.owner, evt.slot, 'defend');
        break;
      }
      case 'refreshDefense': {
        spawnCastEffect(evt.owner, evt.slot, 'refresh');
        break;
      }
      case 'shieldCharge': {
        spawnFloatingNumberOn(getSlotEl(evt.owner, evt.slot), '+1🛡', 'heal');
        break;
      }
      case 'blueReplenish': {
        showToast(`🔵 Reclaimed ${evt.count} Blue card${evt.count > 1 ? 's' : ''}`, 1600);
        Sound.sparkle();
        break;
      }
      case 'heal': {
        const kind = evt.source && evt.source.kind === 'spell' ? 'cast' : 'ability';
        spawnCastEffect(evt.targetOwner, evt.targetSlot, kind, { text: '+' + evt.amount, kind: 'heal' });
        break;
      }
      case 'block': {
        if (evt.source && evt.source.kind === 'attack') break;
        spawnFloatingNumberOn(getSlotEl(evt.owner, evt.slot), 'BLOCKED', 'block');
        Sound.block();
        break;
      }
      case 'damage': {
        if (evt.source && (evt.source.kind === 'attack' || evt.source.kind === 'queued-attack')) break;
        const slotEl = getSlotEl(evt.targetOwner, evt.targetSlot);
        const kind = evt.source && evt.source.kind === 'spell' ? 'lightning' : 'ability';
        spawnCastEffect(evt.targetOwner, evt.targetSlot, kind, evt.killed ? null : { text: '-' + evt.amount, kind: 'damage' });
        if (evt.killed) {
          Sound.death();
          spawnFloatingNumberOn(slotEl, '💀', 'damage');
          spawnDeathCauseLabel(slotEl, evt.source);
        }
        break;
      }
      case 'selfBuff': {
        if (evt.amount === 0) break;
        const symbol = evt.stat === 'dmg' ? '⚔' : '❤';
        const text = (evt.amount > 0 ? '+' : '') + evt.amount + symbol;
        spawnCastEffect(evt.owner, evt.slot, 'ability', { text, kind: evt.amount >= 0 ? 'heal' : 'damage' });
        break;
      }
      case 'draw': {
        const who = evt.owner === localKey ? 'You' : (mode === 'bot' ? 'The bot' : 'Your opponent');
        showToast(`🃏 ${who} drew a card`, 1300);
        break;
      }
      case 'discard': {
        const whose = evt.owner === localKey ? 'your' : (mode === 'bot' ? "the bot's" : "your opponent's");
        showToast(`🗑 ${evt.cardName} discarded from ${whose} hand`, 1600);
        Sound.block();
        break;
      }
      default: break;
    }
  });
}

function applyActionAndRender(action, { afterBotCheck } = {}) {
  if (!state) return { ok: false };
  const isReadyAttack = action.type === 'readyAttack';
  const snapshot = isReadyAttack ? snapshotBoards(state) : null;

  const res = applyAction(state, action);
  if (!res.ok && action.player === localKey) showToast(res.error);
  if (res.ok) {
    if (action.type === 'place') Sound.place();
    else if (action.type === 'merge') Sound.merge();
    else if (action.type === 'defend') Sound.defend();
    else if ((action.type === 'readyPlacement' || action.type === 'readyAttack') && action.player === localKey) Sound.ready();
  }
  if (isReadyAttack && res.resolved) {
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
  if (!wagerAmount) currentWagerHeldAtFloor = false;
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
      matchStartTime = Date.now();
      _lowHpWarned.clear();
      state = createMatch(seed, 'host', 'guest', { host: hostDeckConfig, guest: guestDeckConfig });
      resetSelections();
      showScreen('screen-game');
      document.getElementById('top-bar-info').textContent = 'Multiplayer · Host' + (currentWager > 0 ? ` · 💰${currentWager.toLocaleString()}` : '');
      render();
      net.sendInit();
    },
    onPeerError: (err) => {
      showToast(err.message || ('Connection error: ' + err.type));
      document.getElementById('host-status').textContent = err.message || 'Connection failed.';
      if (currentWager > 0) { if (!currentWagerHeldAtFloor) addBux(currentWager); currentWager = 0; currentWagerHeldAtFloor = false; }
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
      matchStartTime = Date.now();
      currentWager = 0;
      if (data.wager && data.wager > 0) {
        if (data.wager === MIN_BUX_FLOOR && loadBux() === MIN_BUX_FLOOR) {
          currentWagerHeldAtFloor = true;
          currentWager = data.wager;
          showToast(`💰 Wager match: ${data.wager.toLocaleString()} Mehrbod Bux — your 10-Bux floor is protected.`, 2600);
        } else if (spendBux(data.wager, true)) {
          currentWager = data.wager;
          showToast(`💰 Wager match: ${data.wager.toLocaleString()} Mehrbod Bux — good luck!`, 2600);
        } else {
          showToast("You don't have enough Mehrbod Bux to match this wager — playing without stakes.", 3200);
        }
      }
      _lowHpWarned.clear();
  state = createMatch(data.seed, 'host', 'guest', { host: data.hostDeckConfig, guest: pendingGuestDeckConfig });
      resetSelections();
      showScreen('screen-game');
      document.getElementById('top-bar-info').textContent = 'Multiplayer · Guest' + (currentWager > 0 ? ` · 💰${currentWager.toLocaleString()}` : '');
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

// ---- Action dispatch --------------------------------------------------------
function dispatch(action) {
  action.player = localKey;
  if (mode === 'mp') {
    net.submitAction(action);
  } else {
    const res = applyActionAndRender(action, { afterBotCheck: true });
    if (tutorialActive) tutorialCheckAction(action, res);
  }
}

// ---- Selections -------------------------------------------------------------
function resetSelections() {
  selMode = null; selHandIdx = null; selAttackerSlot = null;
  selSpellId = null; selChipId = null;
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const m = btn.dataset.mode;
    const wasActive = selMode === m;
    resetSelections();
    selMode = wasActive ? null : m;
    render();
  });
});

function pressReady() {
  if (!state || state.phase === 'gameover' || animatingCombat) return;
  if (state.phase === 'placement') dispatch({ type: 'readyPlacement' });
  else if (state.phase === 'attack') dispatch({ type: 'readyAttack' });
  resetSelections();
}
document.getElementById('btn-ready').addEventListener('click', pressReady);

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (document.getElementById('screen-game').classList.contains('hidden')) return;
  e.preventDefault();
  pressReady();
});

document.getElementById('btn-log-toggle').addEventListener('click', () => {
  logVisible = !logVisible;
  document.getElementById('log-panel').classList.toggle('hidden', !logVisible);
  render();
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
  startVsBot();
});

// ---- Options modal ----------------------------------------------------------
function openOptions() {
  const inMatch = !!state && state.phase !== 'gameover';
  document.getElementById('quit-match-section').classList.toggle('hidden', !inMatch);
  document.getElementById('options-overlay').classList.remove('hidden');
}
document.getElementById('btn-options').addEventListener('click', openOptions);
document.getElementById('btn-open-settings-menu').addEventListener('click', openOptions);
document.getElementById('btn-options-close').addEventListener('click', () => {
  document.getElementById('options-overlay').classList.add('hidden');
});
document.getElementById('options-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'options-overlay') document.getElementById('options-overlay').classList.add('hidden');
});
document.getElementById('btn-quit-match').addEventListener('click', () => {
  const midMatch = state && state.phase !== 'gameover';
  if (midMatch && !confirm('Quit this match and return to the menu? Your progress in this match will be lost.')) return;
  document.getElementById('options-overlay').classList.add('hidden');
  cancelBotThinking();
  resetTutorialState();
  if (net && mode === 'mp' && midMatch) { net.sendForfeit(); }
  if (net) { net.destroy(); net = null; }
  currentWager = 0;
  currentWagerHeldAtFloor = false;
  state = null;
  showScreen('screen-menu');
});

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
  if (!state || state.phase === 'gameover') return;
  if (suppressNextClick) { suppressNextClick = false; return; }

  const handCardEl = e.target.closest('[data-role="hand-card"]');
  const spellEl = e.target.closest('[data-role="spell"]');
  const chipEl = e.target.closest('[data-role="chip"]');
  const slotEl = e.target.closest('.slot');

  if (handCardEl) {
    if (state.phase !== 'placement') return;
    const idx = Number(handCardEl.dataset.handIdx);
    selMode = null; selSpellId = null; selChipId = null; selAttackerSlot = null;
    selHandIdx = (selHandIdx === idx) ? null : idx;
    render();
    return;
  }

  if (spellEl) {
    const id = spellEl.dataset.spellId;
    resetSelections();
    selSpellId = id;
    render();
    return;
  }

  if (chipEl) {
    const id = chipEl.dataset.chipId;
    resetSelections();
    selChipId = id;
    render();
    return;
  }

  if (slotEl) {
    const owner = slotEl.dataset.owner;
    const slot = Number(slotEl.dataset.slot);
    const isMine = owner === localKey;
    const p = state.players[owner];
    const card = p.board[slot];

    if (selSpellId) {
      if (!card) return;
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
      if (state.players[localKey].defendingSlots[slot]) dispatch({ type: 'cancelDefend', slot });
      else dispatch({ type: 'defend', slot });
      render(); return;
    }
    if (selHandIdx !== null) {
      if (!isMine || card) { showToast('Choose an empty slot on your own board.'); return; }
      dispatch({ type: 'place', handIndex: selHandIdx, slot });
      selHandIdx = null; render(); return;
    }
    if (state.phase === 'attack') {
      if (selAttackerSlot === null) {
        if (!card || !isMine) return;
        if (state.players[localKey].defendingSlots[slot]) { showToast('This card is defending and cannot attack.'); return; }
        selAttackerSlot = slot; render(); return;
      } else {
        if (isMine) {
          if (card && !state.players[localKey].defendingSlots[slot]) { selAttackerSlot = slot; render(); }
          return;
        }
        if (!card) return;
        dispatch({ type: 'attack', slot: selAttackerSlot, targetOwner: owner, targetSlot: slot });
        selAttackerSlot = null; render(); return;
      }
    }
    if (state.phase === 'placement' && isMine && card) {
      showToast('Tap Defend below, then tap this card to defend with it.');
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

function playCombatAnimation(snapshot, fx, doneCallback) {
  animatingCombat = true;
  fx = fx || [];

  const dmgByTarget = {}, blockByTarget = {};
  fx.forEach(evt => {
    if (evt.type === 'damage') dmgByTarget[evt.targetOwner + '|' + evt.targetSlot] = evt;
    else if (evt.type === 'block') blockByTarget[evt.owner + '|' + evt.slot] = evt;
  });

  const anyAttacks = fx.some(e => e.source && (e.source.kind === 'attack' || e.source.kind === 'queued-attack'));
  if (anyAttacks) {
    Sound.attack();
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

  if (anyDeaths) Sound.death();

  if (!reducedMotion && lineJobs.length) {
    requestAnimationFrame(() => {
      lineJobs.forEach(job => {
        spawnAttackLine(getSlotEl(job.fromOwner, job.fromSlot), getSlotEl(job.toOwner, job.toSlot), job.blocked);
      });
    });
  }

  setTimeout(() => { animatingCombat = false; doneCallback(); }, reducedMotion ? 150 : COMBAT_ANIM_MS);
}

function render() {
  if (!state) return;
  document.getElementById('phase-label').textContent = state.phase === 'placement' ? 'Placement' : state.phase === 'attack' ? 'Attack' : 'Game Over';
  document.getElementById('round-label').textContent = `Round ${state.round}`;

  const readyField = state.phase === 'attack' ? 'readyAttack' : 'readyPlacement';
  const youBadge = document.getElementById('you-ready-badge');
  const oppBadge = document.getElementById('opp-ready-badge');
  const youReady = !!state.players[localKey][readyField];
  const oppReady = !!state.players[remoteKey][readyField];
  youBadge.textContent = youReady ? 'You ✓' : 'You';
  oppBadge.textContent = oppReady ? 'Opponent ✓' : 'Opponent';
  youBadge.classList.toggle('ready', youReady);
  oppBadge.classList.toggle('ready', oppReady);

  const oppBoardEl = document.getElementById('opponent-board');
  const myBoardEl = document.getElementById('player-board');
  const filled = (playerState) => playerState.board.map((c, i) => (c ? i : -1)).filter(i => i >= 0);

  const forced = isForced(state, localKey);
  if (forced) { selHandIdx = null; selSpellId = null; selChipId = null; selMode = null; selAttackerSlot = null; }

  let oppTargetable = [], ownTargetable = [];
  if (selSpellId) { oppTargetable = filled(state.players[remoteKey]); ownTargetable = filled(state.players[localKey]); }
  else if (selChipId) { ownTargetable = filled(state.players[localKey]); }
  else if (state.phase === 'attack' && selAttackerSlot !== null) { oppTargetable = filled(state.players[remoteKey]); }

  renderBoard(oppBoardEl, state.players[remoteKey], remoteKey, { targetableSlots: oppTargetable });

  const enemyCountEl = document.getElementById('enemy-count');
  if (enemyCountEl) {
    const enemy = state.players[remoteKey];
    const enemyTotal = enemy.board.filter(Boolean).length + enemy.hand.length + enemy.deck.length;
    enemyCountEl.textContent = enemyTotal;
  }

  renderBoard(myBoardEl, state.players[localKey], localKey, {
    targetableSlots: ownTargetable,
    selectedSlot: selHandIdx !== null ? 'placing' : (selAttackerSlot !== null ? selAttackerSlot : null),
    forceGlowAll: forced,
  });
  checkLowHpWarnings();

  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  const handCountEl = document.getElementById('hand-count');
  if (handCountEl) handCountEl.textContent = `(${state.players[localKey].hand.length}/5)`;
  renderSpellsChips(document.getElementById('spells-chips-row'), state.players[localKey],
    selSpellId ? { mode: 'spell', id: selSpellId } : (selChipId ? { mode: 'chip', id: selChipId } : null));
  renderDeck(document.getElementById('deck-row'), document.getElementById('deck-count'), state.players[localKey]);

  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', selMode === btn.dataset.mode));

  document.getElementById('forced-merge-banner').classList.toggle('hidden', !forced);
  document.getElementById('btn-ready').classList.toggle('action-disabled', forced);
  document.getElementById('hand-row').classList.toggle('action-disabled', forced);
  document.getElementById('spells-chips-row').classList.toggle('action-disabled', forced);
  document.getElementById('mode-bar').querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('action-disabled', forced));

  const hint = document.getElementById('hint-text');
  if (hint) hint.textContent = '';

  renderLog(document.getElementById('log-panel'), state.log);

  if (state.phase === 'gameover' && !document.getElementById('screen-game').classList.contains('hidden')) {
    const overlay = document.getElementById('gameover-overlay');
    const title = document.getElementById('gameover-title');
    if (state.winner === 'draw') title.textContent = "It's a draw!";
    else if (state.forfeited && state.winner === localKey) title.textContent = 'Your opponent forfeited — you win!';
    else if (state.winner === localKey) title.textContent = 'You win!';
    else title.textContent = mode === 'bot' ? 'The bot wins.' : 'Your opponent wins.';
    const durationEl = document.getElementById('gameover-duration');
    if (durationEl) durationEl.textContent = matchStartTime ? `Match length: ${formatDuration(Date.now() - matchStartTime)}` : '';
    overlay.classList.remove('hidden');
    document.getElementById('btn-play-again').classList.toggle('hidden', mode !== 'bot');
    if (!gameOverAnnounced) {
      gameOverAnnounced = true;
      if (state.winner === localKey) { launchConfetti(); Sound.win(); }
      if (state.winner === localKey || state.winner === remoteKey) recordResult(state.winner === localKey);
      if (state.winner === localKey && mode === 'bot' && !tutorialActive) recordDifficultyBeaten(botDifficulty);
      if (state.winner === localKey || state.winner === remoteKey) {
        const payoutForStats = currentWager > 0 && state.winner === localKey ? (currentWagerHeldAtFloor ? currentWager : currentWager * 2) : 0;
        recordBattleResult(state.winner === localKey, currentWager, payoutForStats);
        renderStreakIndicator();
      }
      if (currentWager > 0) {
        if (state.winner === localKey) {
          const payout = currentWagerHeldAtFloor ? currentWager : currentWager * 2;
          addBux(payout);
          recordEconomyChange(payout, mode === 'bot' ? `Won wager vs ${botDifficulty} bot` : 'Won multiplayer wager');
          recordRecentActivity(`Won ${payout.toLocaleString()} Bux on a wager match`);
          showToast(`💰 Won ${currentWager.toLocaleString()} Mehrbod Bux!`, 2800);
        } else if (state.winner === 'draw') {
          if (!currentWagerHeldAtFloor) { addBux(currentWager); recordEconomyChange(currentWager, 'Wager refunded (draw)'); }
          showToast('🤝 Draw — your wager was refunded.', 2400);
        } else {
          recordEconomyChange(-currentWager, mode === 'bot' ? `Lost wager vs ${botDifficulty} bot` : 'Lost multiplayer wager');
          showToast(`💸 Lost ${currentWager.toLocaleString()} Mehrbod Bux.`, 2400);
        }
        currentWager = 0;
        currentWagerHeldAtFloor = false;
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

// ---- Confetti (a little something extra for the winner) --------------------
function launchConfetti() {
  if (reducedMotion) return;
  const card = document.getElementById('gameover-card');
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

// ---- Drag-to-merge -----------------------------------------------------
const DRAG_THRESHOLD = 10;
let dragState = null;

document.getElementById('player-board').addEventListener('pointerdown', (e) => {
  if (!state || state.phase !== 'placement' || dragState) return;
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
  if (!state.players[localKey].hand[idx]) return;
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
          dispatch({ type: 'merge', slotA: dragState.sourceSlot, slotB: targetSlot });
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

// ---- Themes -----------------------------------------------------------------
const ALL_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];

const QUEST_DEFS = [
  { diff: 'Easy',   theme: 'verdant',   icon: '🌱', name: 'Sprout',      desc: 'Win a practice match on Easy difficulty.', badgeId: 'easy-verdant-badge' },
  { diff: 'Medium', theme: 'pink',      icon: '💗', name: 'In the Pink', desc: 'Win a practice match on Medium difficulty.', badgeId: 'medium-pink-badge' },
  { diff: 'Hard',   theme: 'storm',     icon: '⛈️', name: 'Storm Chaser',desc: 'Win a practice match on Hard difficulty.', badgeId: 'hard-storm-badge' },
  { diff: 'Expert', theme: 'aurora',    icon: '🌌', name: 'Stargazer',   desc: 'Win a practice match on Expert difficulty.', badgeId: 'expert-aurora-badge' },
  { diff: 'Master', theme: 'sovereign', icon: '👑', name: 'The Sovereign',desc: 'Win a practice match on Master difficulty.', badgeId: 'master-sovereign-badge' },
];
const FLAME_QUEST = { theme: 'flame', icon: '🔥', name: 'Undefeated', desc: 'Win a practice match on every difficulty at least once.' };

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
  if (!isFlameUnlocked(before) && isFlameUnlocked(set)) {
    showToast('🔥 Flame theme unlocked! You beat every difficulty!', 3000);
    Sound.sparkle();
    recordRecentActivity('Unlocked the Flame theme by beating every difficulty');
  }
  renderQuests();
}
function isThemeUnlockedByDiff(theme, set) {
  const q = QUEST_DEFS.find(q => q.theme === theme);
  return q ? (set || loadBeatenDifficulties()).includes(q.diff) : false;
}
function isFlameUnlocked(set) {
  const beaten = set || loadBeatenDifficulties();
  return ALL_DIFFICULTIES.every(d => beaten.includes(d));
}
function themeDisplayName(t) {
  return {
    dark: 'Dark', light: 'Light', verdant: 'Verdant', pink: 'Pink', storm: 'Storm',
    aurora: 'Aurora', sovereign: 'Sovereign', flame: 'Flame', mrmoney: 'Mr Money',
    collector: '100% Collector'
  }[t] || t;
}
function isCollectionComplete() {
  const owned = loadCollection();
  const allUnitsOwned = ALL_NONBLUE_UNIT_IDS.every(id => owned.units.includes(id));
  const allSpellsOwned = ALL_SPELL_IDS.every(id => owned.spells.includes(id));
  const allChipsOwned = ALL_CHIP_IDS.every(id => owned.chips.includes(id));
  return allUnitsOwned && allSpellsOwned && allChipsOwned;
}
const THEME_UNLOCK_CHECK = {
  dark: () => true, light: () => true,
  verdant: () => isThemeUnlockedByDiff('verdant'), pink: () => isThemeUnlockedByDiff('pink'),
  storm: () => isThemeUnlockedByDiff('storm'), aurora: () => isThemeUnlockedByDiff('aurora'),
  sovereign: () => isThemeUnlockedByDiff('sovereign'), flame: () => isFlameUnlocked(),
  mrmoney: () => ownsCosmetic('theme_mrmoney'),
  collector: () => isCollectionComplete(),
};
const THEME_LOCK_MESSAGE = {
  verdant: '🔒 Beat Easy difficulty to unlock the Verdant theme!',
  pink: '🔒 Beat Medium difficulty to unlock Pink Mode!',
  storm: '🔒 Beat Hard difficulty to unlock the Storm theme!',
  aurora: '🔒 Beat Expert difficulty to unlock the Aurora theme!',
  flame: '🔒 Beat every difficulty at least once to unlock the Flame theme!',
  sovereign: '🔒 Beat Master difficulty to unlock the Sovereign theme!',
  mrmoney: '🔒 Buy the Mr Money theme in the Mehrbod Shop for 1000 Bux!',
  collector: '🔒 Collect every current card to unlock the 100% Collector theme!',
};
const ALL_THEME_NAMES = ['dark', 'light', 'verdant', 'pink', 'storm', 'aurora', 'sovereign', 'flame', 'mrmoney', 'collector'];
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
  const flameHint = document.getElementById('flame-hint');
  if (flameHint) {
    flameHint.textContent = isFlameUnlocked(beaten)
      ? '🔥 Flame theme unlocked — you beat every difficulty!'
      : `🔥 Beat every difficulty at least once to unlock a secret 6th theme. (${beaten.length}/5)`;
  }
}
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});
applyTheme(currentTheme);
updateThemeButtons();

equipSleeve(loadEquippedSleeve());

// ---- Themes modal -----------------------------------------------------------
function openThemes() {
  updateThemeButtons();
  document.getElementById('themes-overlay').classList.remove('hidden');
}
document.getElementById('btn-open-themes').addEventListener('click', openThemes);
document.getElementById('btn-themes-close').addEventListener('click', () => {
  document.getElementById('themes-overlay').classList.add('hidden');
});
document.getElementById('themes-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'themes-overlay') document.getElementById('themes-overlay').classList.add('hidden');
});

// ---- Collection Book (Cards / Themes chooser) ------------------------------
// The single entry point for browsing owned cards or switching themes,
// reached from the one 📖 Collection link on the main menu footer.
function openCollectionBook() {
  document.getElementById('collection-book-overlay').classList.remove('hidden');
}
function closeCollectionBook() {
  document.getElementById('collection-book-overlay').classList.add('hidden');
}
document.getElementById('btn-open-collection').addEventListener('click', openCollectionBook);
document.getElementById('btn-collection-book-close').addEventListener('click', closeCollectionBook);
document.getElementById('collection-book-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'collection-book-overlay') closeCollectionBook();
});
document.getElementById('btn-collection-book-cards').addEventListener('click', () => {
  closeCollectionBook();
  renderCollectionScreen();
  showScreen('screen-collection');
});
document.getElementById('btn-collection-book-themes').addEventListener('click', () => {
  closeCollectionBook();
  openThemes();
});
document.getElementById('btn-collection-book-switch').addEventListener('click', () => {
  openThemes();
});

// Populates the Collection screen's six card grids (Blue/Green/Red/Orange/
// Spells/Chips) from the player's actual owned collection. This never ran
// before - the grids existed in the HTML but nothing ever filled them in.
function renderCollectionScreen() {
  const col = loadCollection();
  const tierContainerIds = { 1: 'collection-blue', 2: 'collection-green', 3: 'collection-red', 4: 'collection-orange' };
  [1, 2, 3, 4].forEach(tier => {
    const container = document.getElementById(tierContainerIds[tier]);
    if (!container) return;
    container.innerHTML = UNIT_ARCHETYPES[tier].map(a => {
      const owned = isUnitArchetypeOwned(a.id);
      const favorite = isFavoriteCard(a.id);
      const abilityText = a.pool.length === 1 && a.pool[0] === 'none' ? 'No special ability' : 'Rolls a unique ability';
      return `<button type="button" class="dcard unit-dcard tier${tier} ${owned ? '' : 'locked'}"
        data-collection-card data-card-id="${a.id}" data-card-name="${a.name}" data-card-group="${TIERS[tier].name}" data-owned="${owned}">
        <div class="dcard-name">${favorite ? '★ ' : ''}${a.name}</div>
        <div class="dcard-text">${abilityText}</div>
        ${owned ? '' : '<div class="dcard-lock">🔒 Locked</div>'}
      </button>`;
    }).join('');
  });

  const spellsContainer = document.getElementById('collection-spells');
  if (spellsContainer) {
    spellsContainer.innerHTML = SPELL_DEFS.map(s => {
      const owned = col.spells.includes(s.id);
      const favorite = isFavoriteCard(s.id);
      return `<div class="dcard ${owned ? '' : 'locked'}" data-collection-card data-card-id="${s.id}" data-card-name="${s.name}" data-card-group="Spells" data-owned="${owned}">
        <div class="dcard-name">${favorite ? '★ ' : ''}${s.name}</div><div class="dcard-text">${s.text}</div>${owned ? '' : '<div class="dcard-lock">🔒 Locked</div>'}
      </div>`;
    }).join('');
  }
  const chipsContainer = document.getElementById('collection-chips');
  if (chipsContainer) {
    chipsContainer.innerHTML = CHIP_DEFS.map(c => {
      const owned = col.chips.includes(c.id);
      const favorite = isFavoriteCard(c.id);
      return `<div class="dcard ${owned ? '' : 'locked'}" data-collection-card data-card-id="${c.id}" data-card-name="${c.name}" data-card-group="Chips" data-owned="${owned}">
        <div class="dcard-name">${favorite ? '★ ' : ''}${c.name}</div><div class="dcard-text">${c.text}</div>${owned ? '' : '<div class="dcard-lock">🔒 Locked</div>'}
      </div>`;
    }).join('');
  }

  document.querySelectorAll('#screen-collection [data-collection-card]').forEach(el => {
    el.addEventListener('click', () => {
      toggleFavoriteCard(el.dataset.cardId);
      renderCollectionScreen();
      setupCollectionTools();
    });
  });

  setupCollectionTools();
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
  return i < 0;
}
function isFavoriteCard(id) {
  return getFavoriteCards().includes(id);
}

function setupCollectionTools() {
  const search = document.getElementById('collection-search');
  const filter = document.getElementById('collection-filter');
  if (!search && !filter) return;

  const apply = () => {
    const query = (search?.value || '').trim().toLowerCase();
    const modeVal = filter?.value || 'all';

    document.querySelectorAll('[data-collection-card]').forEach(el => {
      const id = el.dataset.cardId || '';
      const name = (el.dataset.cardName || '').toLowerCase();
      const owned = el.dataset.owned === 'true';
      const favorite = isFavoriteCard(id);
      const matchesQuery = !query || name.includes(query);
      const matchesMode =
        modeVal === 'all' ||
        (modeVal === 'owned' && owned) ||
        (modeVal === 'missing' && !owned) ||
        (modeVal === 'favorites' && favorite);
      el.hidden = !(matchesQuery && matchesMode);
    });
  };

  if (search) search.addEventListener('input', apply);
  if (filter) filter.addEventListener('change', apply);
  apply();
}

// ---- Quests panel ------------------------------------------------------
function renderQuests() {
  const list = document.getElementById('quests-list');
  if (!list) return;
  const beaten = loadBeatenDifficulties();
  list.innerHTML = '';
  QUEST_DEFS.forEach(q => {
    const done = beaten.includes(q.diff);
    const row = document.createElement('div');
    row.className = 'quest-row' + (done ? ' complete' : '');
    row.innerHTML = `
      <div class="quest-icon">${q.icon}</div>
      <div class="quest-body">
        <div class="quest-title">${q.name} — unlocks ${themeDisplayName(q.theme)}</div>
        <div class="quest-desc">${q.desc}</div>
      </div>
      <div class="quest-status">${done ? '✅' : '⬜'}</div>`;
    list.appendChild(row);
  });
  const flameDone = isFlameUnlocked(beaten);
  const flameRow = document.createElement('div');
  flameRow.className = 'quest-row' + (flameDone ? ' complete' : '');
  flameRow.innerHTML = `
    <div class="quest-icon">${FLAME_QUEST.icon}</div>
    <div class="quest-body">
      <div class="quest-title">${FLAME_QUEST.name} — unlocks ${themeDisplayName(FLAME_QUEST.theme)}</div>
      <div class="quest-desc">${FLAME_QUEST.desc} (${beaten.length}/5)</div>
    </div>
    <div class="quest-status">${flameDone ? '✅' : '⬜'}</div>`;
  list.appendChild(flameRow);
}
function openQuests() {
  renderQuests();
  document.getElementById('quests-overlay').classList.remove('hidden');
}
document.getElementById('btn-open-quests').addEventListener('click', openQuests);
document.getElementById('btn-open-quests-menu').addEventListener('click', openQuests);
document.getElementById('btn-quests-close').addEventListener('click', () => {
  document.getElementById('quests-overlay').classList.add('hidden');
});
document.getElementById('quests-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'quests-overlay') document.getElementById('quests-overlay').classList.add('hidden');
});

// ---- Copy room code ------------------------------------------------------
document.getElementById('btn-copy-code').addEventListener('click', async () => {
  const code = document.getElementById('room-code').textContent.trim();
  if (!code || code === '------') return;
  try {
    await navigator.clipboard.writeText(code);
    showToast('Room code copied!');
  } catch (e) {
    showToast('Could not copy — select and copy it manually.');
  }
});

// ---- Patch notes --------------------------------------------------------
const CURRENT_VERSION = '2.10';
const PATCH_NOTES = [
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
  markPatchNotesSeen();
});
document.getElementById('btn-patchnotes-close').addEventListener('click', () => {
  document.getElementById('patchnotes-overlay').classList.add('hidden');
});
document.getElementById('patchnotes-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'patchnotes-overlay') document.getElementById('patchnotes-overlay').classList.add('hidden');
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
  const overlays = ['patchnotes-overlay', 'options-overlay', 'quests-overlay', 'themes-overlay', 'collection-book-overlay'];
  for (const id of overlays) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) { el.classList.add('hidden'); return; }
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

document.addEventListener('DOMContentLoaded', () => {
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
