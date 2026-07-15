// --- GLOBAL STATE ---
let state = null;
let mode = null; // 'bot' | 'mp'
let localKey = null, remoteKey = null;
let botDifficulty = 'Medium';
let botRng = null;
let net = null;

let selMode = null; 
let selHandIdx = null;
let selAttackerSlot = null;
let selSpellId = null;
let selChipId = null;

// --- SCREEN SYSTEM ---
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
}

// --- INITIALIZATION ---
window.addEventListener('load', () => {
  showScreen('screen-menu');

  // Menu Listeners
  document.getElementById('btn-vs-bot').onclick = () => showScreen('screen-bot-setup');
  document.getElementById('btn-host').onclick = startHost;
  document.getElementById('btn-join').onclick = () => showScreen('screen-join');
  document.getElementById('btn-rules').onclick = () => showScreen('screen-rules');
  document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => location.reload());

  // Bot Selection
  document.querySelectorAll('.diff-card').forEach(b => {
    b.onclick = () => {
      botDifficulty = b.dataset.diff;
      startVsBot();
    };
  });

  // Multiplayer Listeners
  document.getElementById('btn-join-confirm').onclick = startJoin;
  document.getElementById('btn-ready').onclick = handleReady;
  document.getElementById('btn-rematch').onclick = () => location.reload();
  document.getElementById('btn-defend-mode').onclick = toggleDefendMode;
});

// --- CORE LOGIC ---
function startVsBot() {
  mode = 'bot'; localKey = 'you'; remoteKey = 'bot';
  const seed = Math.floor(Math.random() * 999999);
  state = createMatch(seed, 'you', 'bot');
  botRng = new RngStream(seed + 123);
  showScreen('screen-game');
  render();
}

async function startHost() {
  mode = 'mp'; localKey = 'host'; remoteKey = 'guest';
  showScreen('screen-host');
  const seed = Math.floor(Math.random() * 999999);
  net = new NetSession({
    onInit: () => {},
    onApplied: (action) => { applyAction(state, action); render(); },
    onStatus: (s) => { document.getElementById('host-status').textContent = s; },
  });
  const code = await net.hostGame(seed);
  document.getElementById('room-code').textContent = code;
  state = createMatch(seed, 'host', 'guest');
}

async function startJoin() {
  const code = document.getElementById('join-code-input').value.toUpperCase().trim();
  if(!code) return;
  mode = 'mp'; localKey = 'guest'; remoteKey = 'host';
  net = new NetSession({
    onInit: (data) => { state = createMatch(data.seed, 'host', 'guest'); showScreen('screen-game'); render(); },
    onApplied: (action) => { if (state) { applyAction(state, action); render(); } },
    onStatus: (s) => { document.getElementById('join-status').textContent = s; },
  });
  await net.joinGame(code);
}

function dispatch(action) {
  action.player = localKey;
  if (mode === 'mp') net.submitAction(action);
  else {
    const res = applyAction(state, action);
    if (!res.ok) { showToast(res.error); return; }
    if (state.phase === 'placement') runBotPlacement(state, 'bot', botDifficulty, botRng);
    else if (state.phase === 'attack') runBotAttack(state, 'bot', botDifficulty, botRng);
    render();
  }
}

function handleReady() {
  dispatch({ type: state.phase === 'placement' ? 'readyPlacement' : 'readyAttack' });
  resetSelections();
}

function resetSelections() {
  selHandIdx = null; selAttackerSlot = null; selSpellId = null; selChipId = null; selMode = null;
}

function toggleDefendMode() {
  selMode = (selMode === 'defend') ? null : 'defend';
  render();
}

// --- CLICK HANDLER ---
document.getElementById('screen-game').onclick = (e) => {
  if (!state || state.phase === 'gameover') return;

  const handCard = e.target.closest('[data-role="hand-card"]');
  const spellCard = e.target.closest('[data-role="spell"]');
  const chipCard = e.target.closest('[data-role="chip"]');
  const slotEl = e.target.closest('.slot');

  if (handCard) {
    selHandIdx = parseInt(handCard.dataset.handIdx);
    render();
  } else if (slotEl) {
    const slot = parseInt(slotEl.dataset.slot);
    const owner = slotEl.dataset.owner;

    if (selHandIdx !== null && owner === localKey && !state.players[localKey].board[slot]) {
      dispatch({ type: 'place', handIndex: selHandIdx, slot });
      selHandIdx = null;
    } else if (selMode === 'defend' && owner === localKey && state.players[localKey].board[slot]) {
      const isDefending = state.players[localKey].defendingSlots[slot];
      dispatch({ type: isDefending ? 'cancelDefend' : 'defend', slot });
    } else if (state.phase === 'attack') {
      if (owner === localKey) selAttackerSlot = slot;
      else if (selAttackerSlot !== null) {
        dispatch({ type: 'attack', slot: selAttackerSlot, targetOwner: owner, targetSlot: slot });
        selAttackerSlot = null;
      }
    }
    render();
  }
};

function render() {
  if (!state) return;
  const btnReady = document.getElementById('btn-ready');
  const isPlacement = state.phase === 'placement';
  const meReady = isPlacement ? state.players[localKey].readyPlacement : state.players[localKey].readyAttack;
  const oppReady = isPlacement ? state.players[remoteKey].readyPlacement : state.players[remoteKey].readyAttack;
  const forced = isForced(state, localKey);

  // Ready Button Logic
  btnReady.className = 'primary-btn small';
  if (meReady) { btnReady.textContent = "Waiting..."; btnReady.classList.add('waiting'); }
  else {
    btnReady.textContent = "Ready";
    if (oppReady) btnReady.classList.add('opponent-ready');
    if (forced) btnReady.classList.add('action-disabled');
  }

  // Phase Labels
  document.getElementById('phase-label').textContent = state.phase.toUpperCase();
  document.getElementById('round-label').textContent = "Round " + state.round;

  // Boards
  renderBoard(document.getElementById('opponent-board'), state.players[remoteKey], remoteKey);
  renderBoard(document.getElementById('player-board'), state.players[localKey], localKey, { 
    forceGlowAll: forced,
    selectedSlot: selAttackerSlot 
  });
  
  // Hand/Deck
  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  renderDeck(document.getElementById('deck-row'), document.getElementById('deck-count'), state.players[localKey]);
  document.getElementById('forced-merge-banner').classList.toggle('hidden', !forced);

  if (state.phase === 'gameover') {
    document.getElementById('gameover-title').textContent = state.winner === localKey ? 'Victory!' : 'Defeat';
    document.getElementById('gameover-overlay').classList.remove('hidden');
  }
}