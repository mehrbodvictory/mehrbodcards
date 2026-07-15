
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

// ---- Screen management ---------------------------------------------------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (net) { net.destroy(); net = null; }
    showScreen('screen-menu');
  });
});

document.getElementById('btn-rules').addEventListener('click', () => showScreen('screen-rules'));
document.getElementById('btn-vs-bot').addEventListener('click', () => showScreen('screen-bot-setup'));
document.querySelectorAll('.diff-card').forEach(btn => {
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
  state = createMatch(seed, 'you', 'bot');
  botRng = new RngStream(seed + 999);
  botActedKey = null;
  resetSelections();
  showScreen('screen-game');
  document.getElementById('top-bar-info').textContent = `Vs Bot · ${botDifficulty}`;
  ensureBotActs();
  render();
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
    onApplied: (action) => { applyAction(state, action); render(); },
    onStatus: (status) => {
      document.getElementById('host-status').textContent =
        status === 'waiting' ? 'Waiting for opponent to join…' :
        status === 'connected' ? 'Opponent connected! Starting match…' :
        status === 'disconnected' ? 'Opponent disconnected.' : 'Connecting…';
      if (status === 'connected') {
        state = createMatch(seed, 'host', 'guest');
        resetSelections();
        showScreen('screen-game');
        document.getElementById('top-bar-info').textContent = 'Multiplayer · Host';
        render();
      }
    },
    onPeerError: (err) => showToast('Connection error: ' + err.type),
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
      state = createMatch(data.seed, 'host', 'guest');
      resetSelections();
      showScreen('screen-game');
      document.getElementById('top-bar-info').textContent = 'Multiplayer · Guest';
      render();
    },
    onApplied: (action) => { if (state) { applyAction(state, action); render(); } },
    onStatus: (status) => {
      document.getElementById('join-status').textContent =
        status === 'connected' ? 'Connected! Waiting for match data…' :
        status === 'disconnected' ? 'Host disconnected.' : 'Connecting…';
    },
    onPeerError: (err) => { document.getElementById('join-status').textContent = 'Error: ' + err.type; },
  });
  try { await net.joinGame(code); } catch (e) { /* status already shown */ }
});

// ---- Action dispatch --------------------------------------------------------
function dispatch(action) {
  action.player = localKey;
  if (mode === 'mp') {
    net.submitAction(action);
  } else {
    const res = applyAction(state, action);
    if (!res.ok) showToast(res.error);
    ensureBotActs();
    render();
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

document.getElementById('btn-ready').addEventListener('click', () => {
  if (!state || state.phase === 'gameover') return;
  if (state.phase === 'placement') dispatch({ type: 'readyPlacement' });
  else if (state.phase === 'attack') dispatch({ type: 'readyAttack' });
  resetSelections();
});

document.getElementById('btn-log-toggle').addEventListener('click', () => {
  logVisible = !logVisible;
  document.getElementById('log-panel').classList.toggle('hidden', !logVisible);
  render();
});

document.getElementById('btn-rematch').addEventListener('click', () => {
  document.getElementById('gameover-overlay').classList.add('hidden');
  if (net) { net.destroy(); net = null; }
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
function render() {
  if (!state) return;
  document.getElementById('phase-label').textContent = state.phase === 'placement' ? 'Placement' : state.phase === 'attack' ? 'Attack' : 'Game Over';
  document.getElementById('round-label').textContent = `Round ${state.round}`;

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
