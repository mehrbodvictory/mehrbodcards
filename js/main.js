// Screen Switcher Logic
function showScreen(id) {
  console.log("Switching to screen:", id);
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
}

// Global Vars
let state = null, mode = null, localKey = null, remoteKey = null, botDifficulty = 'Medium', botRng = null, net = null;
let selHandIdx = null, selAttackerSlot = null;

// Initialize on Load
window.addEventListener('load', () => {
  showScreen('screen-menu');

  // Menu Buttons
  document.getElementById('btn-vs-bot').onclick = () => showScreen('screen-bot-setup');
  document.getElementById('btn-host').onclick = () => startHost();
  document.getElementById('btn-join').onclick = () => showScreen('screen-join');
  document.getElementById('btn-rules').onclick = () => showScreen('screen-rules');
  document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => location.reload());

  // Bot Difficulty selection
  document.querySelectorAll('.diff-card').forEach(b => {
    b.onclick = () => {
      botDifficulty = b.dataset.diff;
      startVsBot();
    };
  });

  // Join Confirm
  document.getElementById('btn-join-confirm').onclick = () => startJoin();
  
  // Game Ready Button
  document.getElementById('btn-ready').onclick = () => {
    dispatch({ type: state.phase === 'placement' ? 'readyPlacement' : 'readyAttack' });
  };
});

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
    applyAction(state, action);
    if (mode === 'bot') {
        if (state.phase === 'placement') runBotPlacement(state, 'bot', botDifficulty, botRng);
        if (state.phase === 'attack') runBotAttack(state, 'bot', botDifficulty, botRng);
    }
    render();
  }
}

function render() {
  if (!state) return;
  
  // Update Ready Button
  const btnReady = document.getElementById('btn-ready');
  const isPlacement = state.phase === 'placement';
  const meReady = isPlacement ? state.players[localKey].readyPlacement : state.players[localKey].readyAttack;
  const oppReady = isPlacement ? state.players[remoteKey].readyPlacement : state.players[remoteKey].readyAttack;
  const forced = isForced(state, localKey);

  btnReady.className = 'primary-btn small';
  if (meReady) { btnReady.textContent = "Waiting..."; btnReady.classList.add('waiting'); }
  else {
    btnReady.textContent = "Ready";
    if (oppReady) btnReady.classList.add('opponent-ready');
    if (forced) btnReady.classList.add('action-disabled');
  }

  // Boards
  renderBoard(document.getElementById('opponent-board'), state.players[remoteKey], remoteKey);
  renderBoard(document.getElementById('player-board'), state.players[localKey], localKey, { 
    forceGlowAll: forced,
    selectedSlot: selAttackerSlot 
  });
  
  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  renderDeck(document.getElementById('deck-row'), document.getElementById('deck-count'), state.players[localKey]);
  
  document.getElementById('forced-merge-banner').classList.toggle('hidden', !forced);
  document.getElementById('phase-label').textContent = state.phase.toUpperCase();
  document.getElementById('round-label').textContent = "Round " + state.round;
}

// Global Click handler for Game Screen
document.getElementById('screen-game').onclick = (e) => {
  const handCard = e.target.closest('[data-role="hand-card"]');
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