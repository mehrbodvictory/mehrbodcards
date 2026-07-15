let state = null, mode = null, localKey = null, remoteKey = null, botDifficulty = 'Medium', botRng = null, net = null;
let selMode = null, selHandIdx = null, selAttackerSlot = null, selSpellId = null, selChipId = null;

// SCREEN MANAGEMENT
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
}

// INITIALIZATION
window.onload = () => {
  showScreen('screen-menu');
};

// NAVIGATION
document.getElementById('btn-vs-bot').onclick = () => showScreen('screen-bot-setup');
document.getElementById('btn-rules').onclick = () => showScreen('screen-rules');
document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => location.reload());

// BOT DIFFICULTY BUTTONS
document.querySelectorAll('.diff-card').forEach(b => {
  b.onclick = () => { 
    botDifficulty = b.dataset.diff;
    mode = 'bot'; localKey = 'you'; remoteKey = 'bot';
    const seed = Math.floor(Math.random() * 999999);
    state = createMatch(seed, 'you', 'bot');
    botRng = new RngStream(seed + 123);
    showScreen('screen-game');
    render();
  };
});

// HOSTING
document.getElementById('btn-host').onclick = async () => {
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
};

// JOINING
document.getElementById('btn-join').onclick = () => showScreen('screen-join');
document.getElementById('btn-join-confirm').onclick = async () => {
  const codeInput = document.getElementById('join-code-input').value.toUpperCase().trim();
  if (!codeInput) return;
  mode = 'mp'; localKey = 'guest'; remoteKey = 'host';
  net = new NetSession({
    onInit: (data) => { 
        state = createMatch(data.seed, 'host', 'guest'); 
        showScreen('screen-game'); 
        render(); 
    },
    onApplied: (action) => { if (state) { applyAction(state, action); render(); } },
    onStatus: (s) => { document.getElementById('join-status').textContent = s; },
  });
  await net.joinGame(codeInput);
};

// GAME LOGIC DISPATCHER
function dispatch(action) {
  action.player = localKey;
  if (mode === 'mp') {
    net.submitAction(action);
  } else {
    const res = applyAction(state, action);
    if (!res.ok) { showToast(res.error); return; }
    if (state.phase === 'placement') runBotPlacement(state, 'bot', botDifficulty, botRng);
    else if (state.phase === 'attack') runBotAttack(state, 'bot', botDifficulty, botRng);
    render();
  }
}

// INTERACTION HANDLER
document.getElementById('screen-game').onclick = (e) => {
  if (!state || state.phase === 'gameover') return;

  const handCard = e.target.closest('[data-role="hand-card"]');
  const slotEl = e.target.closest('.slot');

  if (handCard) {
    const idx = parseInt(handCard.dataset.handIdx);
    selHandIdx = (selHandIdx === idx) ? null : idx;
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

document.getElementById('btn-ready').onclick = () => {
  dispatch({ type: state.phase === 'placement' ? 'readyPlacement' : 'readyAttack' });
};

document.getElementById('btn-rematch').onclick = () => location.reload();

function render() {
  if (!state) return;
  const btnReady = document.getElementById('btn-ready');
  const isPlacement = state.phase === 'placement';
  const meReady = isPlacement ? state.players[localKey].readyPlacement : state.players[localKey].readyAttack;
  const oppReady = isPlacement ? state.players[remoteKey].readyPlacement : state.players[remoteKey].readyAttack;
  const forced = isForced(state, localKey);

  // Status Labels
  document.getElementById('phase-label').textContent = state.phase;
  document.getElementById('round-label').textContent = "Round " + state.round;

  // Ready Button Styling
  btnReady.className = 'primary-btn small';
  if (state.phase === 'gameover') { 
    btnReady.textContent = 'Game Over'; 
    btnReady.classList.add('waiting'); 
  } else if (meReady) { 
    btnReady.textContent = 'Waiting...'; 
    btnReady.classList.add('waiting'); 
  } else {
    btnReady.textContent = 'Ready';
    if (forced) btnReady.classList.add('action-disabled');
    else if (oppReady) btnReady.classList.add('opponent-ready');
  }

  // Boards
  renderBoard(document.getElementById('opponent-board'), state.players[remoteKey], remoteKey);
  renderBoard(document.getElementById('player-board'), state.players[localKey], localKey, { 
    forceGlowAll: forced,
    selectedSlot: selAttackerSlot 
  });
  
  // HUD
  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  renderDeck(document.getElementById('deck-row'), document.getElementById('deck-count'), state.players[localKey]);
  document.getElementById('forced-merge-banner').classList.toggle('hidden', !forced);
  
  if (state.phase === 'gameover') {
    document.getElementById('gameover-title').textContent = state.winner === localKey ? 'Victory!' : 'Defeat';
    document.getElementById('gameover-overlay').classList.remove('hidden');
  }
}