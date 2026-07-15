let state = null, mode = null, localKey = null, remoteKey = null, botDifficulty = 'Medium', botRng = null, net = null;
let selMode = null, selHandIdx = null, selAttackerSlot = null, selSpellId = null, selChipId = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// Logic for vs Bot
function startVsBot() {
  mode = 'bot'; localKey = 'you'; remoteKey = 'bot';
  const seed = Math.floor(Math.random() * 999999);
  state = createMatch(seed, 'you', 'bot');
  botRng = new RngStream(seed + 123);
  showScreen('screen-game');
  render();
}

document.getElementById('btn-vs-bot').onclick = () => showScreen('screen-bot-setup');
document.querySelectorAll('.diff-card').forEach(b => b.onclick = () => { botDifficulty = b.dataset.diff; startVsBot(); });
document.getElementById('btn-rules').onclick = () => showScreen('screen-rules');
document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => location.reload());

function dispatch(action) {
  action.player = localKey;
  if (mode === 'mp') net.submitAction(action);
  else {
    applyAction(state, action);
    if (state.phase === 'placement' && mode === 'bot') runBotPlacement(state, 'bot', botDifficulty, botRng);
    if (state.phase === 'attack' && mode === 'bot') runBotAttack(state, 'bot', botDifficulty, botRng);
    render();
  }
}

function render() {
  if (!state) return;
  const btnReady = document.getElementById('btn-ready');
  const isPlacement = state.phase === 'placement';
  const meReady = isPlacement ? state.players[localKey].readyPlacement : state.players[localKey].readyAttack;
  const oppReady = isPlacement ? state.players[remoteKey].readyPlacement : state.players[remoteKey].readyAttack;
  const forced = isForced(state, localKey);

  btnReady.className = 'primary-btn small';
  if (state.phase === 'gameover') { btnReady.textContent = 'Over'; btnReady.classList.add('waiting'); }
  else if (meReady) { btnReady.textContent = 'Waiting...'; btnReady.classList.add('waiting'); }
  else {
    btnReady.textContent = 'Ready';
    if (forced) btnReady.classList.add('action-disabled');
    else if (oppReady) btnReady.classList.add('opponent-ready');
  }

  renderBoard(document.getElementById('opponent-board'), state.players[remoteKey], remoteKey);
  renderBoard(document.getElementById('player-board'), state.players[localKey], localKey, { 
    forceGlowAll: forced,
    selectedSlot: selAttackerSlot 
  });
  renderHand(document.getElementById('hand-row'), state.players[localKey], selHandIdx);
  renderSpellsChips(document.getElementById('spells-chips-row'), state.players[localKey]);
  renderDeck(document.getElementById('deck-row'), document.getElementById('deck-count'), state.players[localKey]);

  document.getElementById('forced-merge-banner').classList.toggle('hidden', !forced);
  document.getElementById('phase-label').textContent = state.phase;
  document.getElementById('round-label').textContent = "Round " + state.round;
}

// Simple click handler for slots
document.getElementById('screen-game').onclick = (e) => {
  const slotEl = e.target.closest('.slot');
  if (!slotEl) return;
  const slot = parseInt(slotEl.dataset.slot);
  const owner = slotEl.dataset.owner;

  if (selHandIdx !== null && owner === localKey && !state.players[localKey].board[slot]) {
    dispatch({ type: 'place', handIndex: selHandIdx, slot });
    selHandIdx = null;
  } else if (state.phase === 'attack' && owner === remoteKey && selAttackerSlot !== null) {
    dispatch({ type: 'attack', slot: selAttackerSlot, targetOwner: remoteKey, targetSlot: slot });
    selAttackerSlot = null;
  } else if (owner === localKey && state.players[localKey].board[slot]) {
    selAttackerSlot = slot;
  }
  render();
};

document.getElementById('btn-ready').onclick = () => {
  dispatch({ type: state.phase === 'placement' ? 'readyPlacement' : 'readyAttack' });
};