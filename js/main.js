
// ---- Global state ------------------------------------------------------
let state = null;
let mode = null;           // 'bot' | 'mp'
let localKey = null, remoteKey = null;
let botDifficulty = 'Medium';
let botRng = null;
let botActedKey = null;
let net = null;

let selMode = null;        // 'defend' | 'spell' | 'chip' | null
let selHandIdx = null;
let selAttackerSlot = null;
let selSpellId = null;
let selChipId = null;
let logVisible = false;
let suppressNextClick = false;
let gameOverAnnounced = false;
let animatingCombat = false;
const COMBAT_ANIM_MS = 900;

// ---- Screen management ---------------------------------------------------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
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

document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (net) { net.destroy(); net = null; }
    showScreen('screen-menu');
  });
});

document.getElementById('btn-rules').addEventListener('click', () => showScreen('screen-rules'));
document.getElementById('btn-vs-bot').addEventListener('click', () => showScreen('screen-bot-setup'));
document.querySelectorAll('.menu-card').forEach(wirePressFeedback);
document.querySelectorAll('.diff-card').forEach(btn => {
  wirePressFeedback(btn);
  btn.addEventListener('click', () => {
    botDifficulty = btn.dataset.diff;
    startVsBot();
  });
});

// ---- Vs Bot --------------------------------------------------------------
function startVsBot() {
  mode = 'bot';
  localKey = 'you'; remoteKey = 'bot';
  const seed = makeSeed();
  gameOverAnnounced = false;
  state = createMatch(seed, 'you', 'bot');
  botRng = new RngStream(seed + 999);
  botActedKey = null;
  resetSelections();
  showScreen('screen-game');
  document.getElementById('top-bar-info').textContent = `Vs Bot · ${botDifficulty}`;
  ensureBotActs();
  render();
}

// Every action - local or networked - flows through here so the combat
// animation logic only has to live in one place. When a readyAttack call
// actually triggers the simultaneous resolution, we freeze a snapshot of
// the pre-resolution boards, apply the action (which fully resolves combat
// AND advances to the next placement round in one synchronous step), then
// briefly show the snapshot with attack/death animations before revealing
// the real post-combat state.
const LIGHTNING_SVG = '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><polygon points="14,0 2,20 11,20 8,36 24,14 13,14" fill="#fff58a" stroke="#ffe066" stroke-width="1"/></svg>';

function spawnFloatingNumberOn(slotEl, text, kind) {
  const el = document.createElement('div');
  el.className = 'float-num float-' + kind;
  el.textContent = text;
  slotEl.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function spawnCastEffect(ownerKey, slot, kind, amount) {
  const boardEl = ownerKey === localKey ? document.getElementById('player-board') : document.getElementById('opponent-board');
  const slotEl = boardEl && boardEl.children[slot];
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
  } else {
    const fx = document.createElement('div');
    fx.className = 'cast-fx';
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 600);
    Sound.heal();
  }
  if (amount) spawnFloatingNumberOn(slotEl, amount.text, amount.kind);
}

function applyActionAndRender(action, { afterBotCheck } = {}) {
  if (!state) return { ok: false };
  const isReadyAttack = action.type === 'readyAttack';
  const snapshot = isReadyAttack ? snapshotBoards(state) : null;

  let castFx = null, castAmount = null;
  if (action.type === 'spell') {
    const spell = state.players[action.player] && state.players[action.player].spells.find(s => s.id === action.spellId);
    if (spell) {
      castFx = spell.dmg ? 'lightning' : 'cast';
      if (spell.dmg) castAmount = { text: '-' + spell.dmg, kind: 'damage' };
      else if (spell.heal) castAmount = { text: '+' + spell.heal, kind: 'heal' };
    }
  } else if (action.type === 'chip') {
    castFx = 'cast';
    const chip = state.players[action.player] && state.players[action.player].chips.find(c => c.id === action.chipId);
    if (chip && chip.hp) castAmount = { text: '+' + chip.hp, kind: 'heal' };
  }

  const res = applyAction(state, action);
  if (!res.ok && action.player === localKey) showToast(res.error);
  if (res.ok) {
    if (action.type === 'place') Sound.place();
    else if (action.type === 'merge') Sound.merge();
    else if (action.type === 'defend') Sound.defend();
    else if ((action.type === 'readyPlacement' || action.type === 'readyAttack') && action.player === localKey) Sound.ready();
  }
  if (isReadyAttack && res.resolved) {
    playCombatAnimation(snapshot, () => {
      if (afterBotCheck) ensureBotActs();
      render();
    });
  } else {
    if (afterBotCheck) ensureBotActs();
    render();
    if (res.ok && castFx) spawnCastEffect(action.targetOwner, action.targetSlot, castFx, castAmount);
  }
  return res;
}

function ensureBotActs() {
  if (mode !== 'bot' || state.phase === 'gameover') return;
  const key = state.phase + ':' + state.round;
  if (botActedKey === key) return;
  botActedKey = key;
  if (state.phase === 'placement') runBotPlacement(state, 'bot', botDifficulty, botRng);
  else if (state.phase === 'attack') runBotAttack(state, 'bot', botDifficulty, botRng);
}

// ---- Multiplayer ----------------------------------------------------------
document.getElementById('btn-host').addEventListener('click', async () => {
  mode = 'mp'; localKey = 'host'; remoteKey = 'guest';
  showScreen('screen-host');
  const seed = makeSeed();
  net = new NetSession({
    onInit: () => {},
    onApplied: (action) => applyActionAndRender(action),
    onStatus: (status) => {
      document.getElementById('host-status').textContent =
        status === 'waiting' ? 'Waiting for opponent to join…' :
        status === 'connected' ? 'Opponent connected! Starting match…' :
        status === 'disconnected' ? 'Opponent disconnected.' : 'Connecting…';
      if (status === 'connected') {
        gameOverAnnounced = false;
  state = createMatch(seed, 'host', 'guest');
        resetSelections();
        showScreen('screen-game');
        document.getElementById('top-bar-info').textContent = 'Multiplayer · Host';
        render();
      }
    },
    onPeerError: (err) => {
      showToast(err.message || ('Connection error: ' + err.type));
      document.getElementById('host-status').textContent = err.message || 'Connection failed.';
    },
  });
  try {
    const code = await net.hostGame(seed);
    document.getElementById('room-code').textContent = code;
  } catch (e) { showToast('Could not host: ' + e); }
});

document.getElementById('btn-join').addEventListener('click', () => showScreen('screen-join'));
document.getElementById('btn-join-confirm').addEventListener('click', async () => {
  const code = document.getElementById('join-code-input').value.trim();
  if (!code) return;
  mode = 'mp'; localKey = 'guest'; remoteKey = 'host';
  net = new NetSession({
    onInit: (data) => {
      gameOverAnnounced = false;
  state = createMatch(data.seed, 'host', 'guest');
      resetSelections();
      showScreen('screen-game');
      document.getElementById('top-bar-info').textContent = 'Multiplayer · Guest';
      render();
    },
    onApplied: (action) => applyActionAndRender(action),
    onStatus: (status) => {
      document.getElementById('join-status').textContent =
        status === 'connected' ? 'Connected! Waiting for match data…' :
        status === 'disconnected' ? 'Host disconnected.' : 'Connecting…';
    },
    onPeerError: (err) => { document.getElementById('join-status').textContent = err.message || ('Error: ' + err.type); },
  });
  try { await net.joinGame(code); } catch (e) { /* status already shown */ }
});

// ---- Action dispatch --------------------------------------------------------
function dispatch(action) {
  action.player = localKey;
  if (mode === 'mp') {
    net.submitAction(action);
  } else {
    applyActionAndRender(action, { afterBotCheck: true });
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

// 'R' hotkey to ready up - ignored while typing in a text field (e.g. the
// room-code input) and while the game screen isn't the active one.
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
  if (net) { net.destroy(); net = null; }
  showScreen('screen-menu');
});

// ---- Options modal ----------------------------------------------------------
document.getElementById('btn-options').addEventListener('click', () => {
  document.getElementById('options-overlay').classList.remove('hidden');
});
document.getElementById('btn-options-close').addEventListener('click', () => {
  document.getElementById('options-overlay').classList.add('hidden');
});
document.getElementById('options-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'options-overlay') document.getElementById('options-overlay').classList.add('hidden');
});
document.getElementById('btn-quit-match').addEventListener('click', () => {
  document.getElementById('options-overlay').classList.add('hidden');
  if (net) { net.destroy(); net = null; }
  state = null;
  showScreen('screen-menu');
});

// ---- Click delegation on the game screen ------------------------------------
document.getElementById('screen-game').addEventListener('click', (e) => {
  if (!state || state.phase === 'gameover') return;
  if (suppressNextClick) { suppressNextClick = false; return; } // a drag-to-merge gesture just happened here

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

    // Spell targeting - any card, any phase.
    if (selSpellId) {
      if (!card) return;
      dispatch({ type: 'spell', spellId: selSpellId, targetOwner: owner, targetSlot: slot });
      resetSelections(); render(); return;
    }
    // Chip targeting - own cards only.
    if (selChipId) {
      if (!card || !isMine) { showToast('Chips only attach to your own cards.'); return; }
      dispatch({ type: 'chip', chipId: selChipId, targetOwner: owner, targetSlot: slot });
      resetSelections(); render(); return;
    }
    // Defend mode - own cards only, toggle.
    if (selMode === 'defend') {
      if (!card || !isMine) return;
      if (state.players[localKey].defendingSlots[slot]) dispatch({ type: 'cancelDefend', slot });
      else dispatch({ type: 'defend', slot });
      render(); return;
    }
    // Placement - hand card selected, target own empty slot.
    if (selHandIdx !== null) {
      if (!isMine || card) { showToast('Choose an empty slot on your own board.'); return; }
      dispatch({ type: 'place', handIndex: selHandIdx, slot });
      selHandIdx = null; render(); return;
    }
    // Default attack assignment during attack phase.
    if (state.phase === 'attack') {
      if (selAttackerSlot === null) {
        if (!card || !isMine) return;
        if (state.players[localKey].defendingSlots[slot]) { showToast('This card is defending and cannot attack.'); return; }
        selAttackerSlot = slot; render(); return;
      } else {
        if (isMine) { // switch attacker selection
          if (card && !state.players[localKey].defendingSlots[slot]) { selAttackerSlot = slot; render(); }
          return;
        }
        if (!card) return;
        dispatch({ type: 'attack', slot: selAttackerSlot, targetOwner: owner, targetSlot: slot });
        selAttackerSlot = null; render(); return;
      }
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

function playCombatAnimation(snapshot, doneCallback) {
  animatingCombat = true;

  const anyAttacks = state.order.some(k => Object.keys(snapshot[k].attackAssignments).length > 0);
  if (anyAttacks) {
    Sound.attack();
    const screenEl = document.getElementById('screen-game');
    screenEl.classList.add('screen-shake');
    setTimeout(() => screenEl.classList.remove('screen-shake'), 400);
  }

  // Anyone who was the target of at least one attack this round, so we can
  // flash cards that got hit but survived (and skip the flash for anyone
  // whose defend actually blocked every incoming attack).
  const hitSlots = {}; // ownerKey -> Set(slot)
  state.order.forEach(k => { hitSlots[k] = new Set(); });
  state.order.forEach(attackerKey => {
    Object.values(snapshot[attackerKey].attackAssignments).forEach(assign => {
      hitSlots[assign.targetOwner].add(assign.targetSlot);
    });
  });

  let anyDeaths = false;

  [[document.getElementById('opponent-board'), remoteKey], [document.getElementById('player-board'), localKey]]
    .forEach(([container, key]) => {
      container.innerHTML = '';
      const snap = snapshot[key];
      const liveBoard = state.players[key].board;
      snap.board.forEach((card, slot) => {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        if (card) {
          const died = !liveBoard[slot];
          const wasBlocked = !!snap.defendingSlots[slot];
          const wasTargeted = hitSlots[key].has(slot);
          const wasHit = wasTargeted && !wasBlocked;
          const el = cardEl(card, {
            owner: key, slot,
            attackAnim: !!snap.attackAssignments[slot],
            deathAnim: died,
            hitAnim: wasHit && !died,
          });
          slotEl.appendChild(el);

          if (wasTargeted) {
            if (wasBlocked) {
              spawnFloatingNumberOn(slotEl, 'BLOCKED', 'block');
            } else if (died) {
              anyDeaths = true;
              spawnFloatingNumberOn(slotEl, '💀', 'damage');
            } else {
              const live = liveBoard[slot];
              const dmgAmt = live ? Math.max(0, card.hp - live.hp) : card.hp;
              if (dmgAmt > 0) spawnFloatingNumberOn(slotEl, '-' + dmgAmt, 'damage');
            }
          }
        }
        container.appendChild(slotEl);
      });
    });

  if (anyDeaths) Sound.death();

  setTimeout(() => { animatingCombat = false; doneCallback(); }, COMBAT_ANIM_MS);
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

  renderBoard(myBoardEl, state.players[localKey], localKey, {
    targetableSlots: ownTargetable,
    selectedSlot: selHandIdx !== null ? 'placing' : (selAttackerSlot !== null ? selAttackerSlot : null),
    forceGlowAll: forced,
  });

  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  renderSpellsChips(document.getElementById('spells-chips-row'), state.players[localKey],
    selSpellId ? { mode: 'spell', id: selSpellId } : (selChipId ? { mode: 'chip', id: selChipId } : null));
  renderDeck(document.getElementById('deck-row'), document.getElementById('deck-count'), state.players[localKey]);

  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', selMode === btn.dataset.mode));

  // Forced-merge banner + lock out everything except the drag-to-merge gesture.
  document.getElementById('forced-merge-banner').classList.toggle('hidden', !forced);
  document.getElementById('btn-ready').classList.toggle('action-disabled', forced);
  document.getElementById('hand-row').classList.toggle('action-disabled', forced);
  document.getElementById('spells-chips-row').classList.toggle('action-disabled', forced);
  document.getElementById('mode-bar').querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('action-disabled', forced));

  const hint = document.getElementById('hint-text');
  if (forced) hint.textContent = 'Drag one of your Blue cards onto another to merge them.';
  else if (selMode === 'defend') hint.textContent = 'Tap your card to toggle defending (blocks all damage to itself, cannot attack).';
  else if (selHandIdx !== null) hint.textContent = 'Tap an empty slot on your board to place this card.';
  else if (selSpellId) hint.textContent = 'Tap any card to target it with this spell.';
  else if (selChipId) hint.textContent = 'Tap your own card with a free chip slot.';
  else if (state.phase === 'attack' && selAttackerSlot !== null) hint.textContent = 'Tap an enemy card to attack it.';
  else if (state.phase === 'attack') hint.textContent = 'Tap your card, then an enemy card, to assign an attack.';
  else hint.textContent = 'Tap a hand card to place it, drag a card onto another to fuse them, or use Defend / spells / chips.';

  renderLog(document.getElementById('log-panel'), state.log);

  if (state.phase === 'gameover') {
    const overlay = document.getElementById('gameover-overlay');
    const title = document.getElementById('gameover-title');
    if (state.winner === 'draw') title.textContent = "It's a draw!";
    else if (state.winner === localKey) title.textContent = 'You win!';
    else title.textContent = mode === 'bot' ? 'The bot wins.' : 'Your opponent wins.';
    overlay.classList.remove('hidden');
    if (!gameOverAnnounced) {
      gameOverAnnounced = true;
      if (state.winner === localKey) { launchConfetti(); Sound.win(); }
      if (state.winner === localKey || state.winner === remoteKey) recordResult(state.winner === localKey);
    }
  }
}

// ---- Persistent win/loss record (localStorage) -----------------------------
function loadRecord() {
  try { return JSON.parse(localStorage.getItem('mehrbod-cards-record') || '{"wins":0,"losses":0}'); }
  catch (e) { return { wins: 0, losses: 0 }; }
}
function recordResult(won) {
  const r = loadRecord();
  if (won) r.wins++; else r.losses++;
  try { localStorage.setItem('mehrbod-cards-record', JSON.stringify(r)); } catch (e) {}
  updateRecordDisplay();
}
function updateRecordDisplay() {
  const el = document.getElementById('record-display');
  if (!el) return;
  const r = loadRecord();
  el.textContent = (r.wins || r.losses) ? `Record: ${r.wins}W – ${r.losses}L` : '';
}

// ---- Confetti (a little something extra for the winner) --------------------
function launchConfetti() {
  const card = document.getElementById('gameover-card');
  const colors = ['#3E7CB1', '#4C9A5B', '#C1443C', '#E08A2C', '#ffffff'];
  for (let i = 0; i < 46; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.2 + Math.random() * 1.1) + 's';
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    piece.style.borderRadius = Math.random() < 0.5 ? '50%' : '2px';
    card.appendChild(piece);
    setTimeout(() => piece.remove(), 2800);
  }
}

// ---- Drag-to-merge -----------------------------------------------------
// Merging is done by dragging one of your own board cards and dropping it
// onto another of your own board cards - no mode button needed. Works with
// mouse and touch alike via Pointer Events. Only active during placement
// (merging never happens mid-attack).
const DRAG_THRESHOLD = 10; // px of movement before a tap becomes a drag
let dragState = null; // { sourceSlot, sourceEl, ghostEl, startX, startY, dragging, pointerId }

document.getElementById('player-board').addEventListener('pointerdown', (e) => {
  if (!state || state.phase !== 'placement' || dragState) return;
  const cardElx = e.target.closest('.card');
  if (!cardElx || cardElx.dataset.owner !== localKey) return;
  const slot = Number(cardElx.dataset.slot);
  if (!state.players[localKey].board[slot]) return;
  dragState = {
    sourceSlot: slot, sourceEl: cardElx,
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
  if (slotEl && slotEl.dataset.owner === localKey && Number(slotEl.dataset.slot) !== dragState.sourceSlot
      && state.players[localKey].board[Number(slotEl.dataset.slot)]) {
    slotEl.classList.add('drop-target');
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
      if (targetSlot !== dragState.sourceSlot && state.players[localKey].board[targetSlot]) {
        dispatch({ type: 'merge', slotA: dragState.sourceSlot, slotB: targetSlot });
      }
    }
    suppressNextClick = true; // this gesture was a drag, not a tap - don't let the click handler also fire
  }
  dragState = null;
  render();
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

// ---- Patch notes --------------------------------------------------------
// Newest first. Bump CURRENT_VERSION and add a new entry at the top of this
// array with every update.
const CURRENT_VERSION = '1.11';
const PATCH_NOTES = [
  {
    version: '1.11',
    notes: [
      'Added a 5th bot difficulty, Master, above Expert: it merges up more aggressively, heals sooner, and defends any card that still can.',
      'Rebalanced defense: Green now defends once (down from twice), and Red can no longer defend at all (Orange still never could).',
      "Moved the +1 defense charge ability off Red (where it's now useless) onto Green, where it matters more.",
    ],
  },
  {
    version: '1.10',
    notes: [
      'Added a version number to the main menu — click it to see these patch notes.',
      'Redesigned the main menu: MEHRBOD CARDS is now front and center in a big animated rainbow title, with the rest of the menu centered under it.',
      'Fixed peer-to-peer connections failing on restrictive networks (school/work wifi): added STUN + TURN relay servers and clearer connection-timeout messaging.',
    ],
  },
  {
    version: '1.9',
    notes: [
      'Added floating damage / heal / block numbers over cards during combat and spell casts.',
      'Added procedural sound effects (synthesized in-browser, no audio files) with a mute toggle in Options.',
      'Added a persistent win/loss record on the main menu.',
    ],
  },
  {
    version: '1.8',
    notes: [
      'Tightened merge rules: Orange can no longer merge with anything, and only tier sums that land exactly on Green/Red/Orange are legal (no more capping Green+Red into Orange).',
      "Added an 'R' hotkey to ready up.",
      'Added combat animations: attack scale-pop, screen shake, hit flash, and a death shatter, plus a lightning-bolt effect for damage spells.',
      'Spell cards are now yellow/gold, chip cards are purple.',
    ],
  },
  {
    version: '1.7',
    notes: [
      'Fixed the card pop-in animation replaying on every card whenever any action happened (e.g. pressing Ready) — now it only plays once per card, the first time it appears.',
      'Fixed Orange + Orange merges silently destroying a card for no benefit.',
    ],
  },
  {
    version: '1.6',
    notes: [
      'Redesigned the difficulty-select screen as a centered list, color-coded per difficulty (green/amber/orange/red), dim by default and glowing on hover.',
      'Fixed a visual bug where pressing one difficulty/menu card could visually affect the others.',
    ],
  },
  {
    version: '1.5',
    notes: [
      'Buttons now have hover "jump" (lift, scale, slight rotate) and press feedback across every screen.',
      'Added an Options menu (gear icon) with a Quit Match button.',
      'Added ready-up indicators showing when you and your opponent have each locked in.',
      'Added a confetti celebration on winning a match.',
    ],
  },
  {
    version: '1.4',
    notes: [
      'Blue cards are now an infinite resource: merging or losing one gives you a fresh Blue back, as long as you still have a non-Blue card somewhere. Once you\'re down to nothing but Blues, that stops for good.',
      'Hitting 4+ Blue cards on your board now glows them and locks out every other action with a banner until you drag-merge one.',
      'Your whole deck is now visible face-up at all times, not just your hand.',
    ],
  },
  {
    version: '1.3',
    notes: [
      'Merging is now done by dragging one of your cards onto another instead of a Merge button.',
      'Added a holographic shield effect (with a hover tooltip) on defending cards.',
    ],
  },
  {
    version: '1.2',
    notes: [
      'Fixed the game not working when opened directly from disk (converted from ES modules to classic scripts so a local web server is no longer required).',
    ],
  },
  {
    version: '1.1',
    notes: ['Renamed the project to Mehrbod Cards.'],
  },
  {
    version: '1.0',
    notes: [
      'Initial release: browser card battler with vs-bot (4 difficulty levels) and peer-to-peer multiplayer.',
      '12-card draft plus 4 spells and 2 chips per player, four unit tiers (Blue/Green/Red/Orange), merging, self-only defense, and simultaneous attack resolution.',
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
document.getElementById('btn-version').addEventListener('click', () => {
  renderPatchNotes();
  document.getElementById('patchnotes-overlay').classList.remove('hidden');
});
document.getElementById('btn-patchnotes-close').addEventListener('click', () => {
  document.getElementById('patchnotes-overlay').classList.add('hidden');
});
document.getElementById('patchnotes-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'patchnotes-overlay') document.getElementById('patchnotes-overlay').classList.add('hidden');
});
