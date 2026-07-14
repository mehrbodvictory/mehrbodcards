import * as G from './game.js';
import * as Bot from './bot.js';
import { NetSession } from './network.js';
import { RngStream, makeSeed } from './rng.js';
import { renderBoard, renderHand, renderSpellsChips, renderLog, showToast } from './ui.js';

// ---- Global state ------------------------------------------------------
let state = null;
let mode = null;           // 'bot' | 'mp'
let localKey = null, remoteKey = null;
let botDifficulty = 'Medium';
let botRng = null;
let botActedKey = null;
let net = null;

let selMode = null;        // 'merge' | 'defend' | 'spell' | 'chip' | null
let selHandIdx = null;
let selAttackerSlot = null;
let selMergeFirst = null;
let selSpellId = null;
let selChipId = null;
let logVisible = false;

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
  state = G.createMatch(seed, 'you', 'bot');
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
  if (state.phase === 'placement') Bot.runBotPlacement(state, 'bot', botDifficulty, botRng);
  else if (state.phase === 'attack') Bot.runBotAttack(state, 'bot', botDifficulty, botRng);
}

// ---- Multiplayer ----------------------------------------------------------
document.getElementById('btn-host').addEventListener('click', async () => {
  mode = 'mp'; localKey = 'host'; remoteKey = 'guest';
  showScreen('screen-host');
  const seed = makeSeed();
  net = new NetSession({
    onInit: () => {},
    onApplied: (action) => { G.applyAction(state, action); render(); },
    onStatus: (status) => {
      document.getElementById('host-status').textContent =
        status === 'waiting' ? 'Waiting for opponent to join…' :
        status === 'connected' ? 'Opponent connected! Starting match…' :
        status === 'disconnected' ? 'Opponent disconnected.' : 'Connecting…';
      if (status === 'connected') {
        state = G.createMatch(seed, 'host', 'guest');
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
      state = G.createMatch(data.seed, 'host', 'guest');
      resetSelections();
      showScreen('screen-game');
      document.getElementById('top-bar-info').textContent = 'Multiplayer · Guest';
      render();
    },
    onApplied: (action) => { if (state) { G.applyAction(state, action); render(); } },
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
    const res = G.applyAction(state, action);
    if (!res.ok) showToast(res.error);
    ensureBotActs();
    render();
  }
}

// ---- Selections -------------------------------------------------------------
function resetSelections() {
  selMode = null; selHandIdx = null; selAttackerSlot = null;
  selMergeFirst = null; selSpellId = null; selChipId = null;
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

  const handCardEl = e.target.closest('[data-role="hand-card"]');
  const spellEl = e.target.closest('[data-role="spell"]');
  const chipEl = e.target.closest('[data-role="chip"]');
  const slotEl = e.target.closest('.slot');

  if (handCardEl) {
    if (state.phase !== 'placement') return;
    const idx = Number(handCardEl.dataset.handIdx);
    selMode = null; selMergeFirst = null; selSpellId = null; selChipId = null; selAttackerSlot = null;
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
    // Merge mode - own cards only, two-step.
    if (selMode === 'merge') {
      if (!card || !isMine) return;
      if (selMergeFirst === null) { selMergeFirst = slot; render(); return; }
      if (selMergeFirst === slot) { selMergeFirst = null; render(); return; }
      dispatch({ type: 'merge', slotA: selMergeFirst, slotB: slot });
      selMergeFirst = null; render(); return;
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

  let oppTargetable = [], ownTargetable = [];
  if (selSpellId) { oppTargetable = filled(state.players[remoteKey]); ownTargetable = filled(state.players[localKey]); }
  else if (selChipId) { ownTargetable = filled(state.players[localKey]); }
  else if (state.phase === 'attack' && selAttackerSlot !== null) { oppTargetable = filled(state.players[remoteKey]); }

  renderBoard(oppBoardEl, state.players[remoteKey], remoteKey, { targetableSlots: oppTargetable });
  renderBoard(myBoardEl, state.players[localKey], localKey, {
    targetableSlots: ownTargetable,
    selectedSlot: selHandIdx !== null ? 'placing' : (selMergeFirst !== null ? selMergeFirst : (selAttackerSlot !== null ? selAttackerSlot : null)),
  });

  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  renderSpellsChips(document.getElementById('spells-chips-row'), state.players[localKey],
    selSpellId ? { mode: 'spell', id: selSpellId } : (selChipId ? { mode: 'chip', id: selChipId } : null));

  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', selMode === btn.dataset.mode));

  const hint = document.getElementById('hint-text');
  if (selMode === 'merge') hint.textContent = selMergeFirst === null ? 'Tap two of your cards to fuse them.' : 'Tap a second card to complete the fusion.';
  else if (selMode === 'defend') hint.textContent = 'Tap your card to toggle defending (blocks all damage to itself, cannot attack).';
  else if (selHandIdx !== null) hint.textContent = 'Tap an empty slot on your board to place this card.';
  else if (selSpellId) hint.textContent = 'Tap any card to target it with this spell.';
  else if (selChipId) hint.textContent = 'Tap your own card with a free chip slot.';
  else if (state.phase === 'attack' && selAttackerSlot !== null) hint.textContent = 'Tap an enemy card to attack it.';
  else if (state.phase === 'attack') hint.textContent = 'Tap your card, then an enemy card, to assign an attack.';
  else hint.textContent = 'Tap a hand card to place it, or use Merge / Defend / spells / chips.';

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
