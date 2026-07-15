// Inside render() in js/main.js

function render() {
  if (!state) return;
  
  // ... (existing code for phase labels) ...

  const btnReady = document.getElementById('btn-ready');
  const isPlacement = state.phase === 'placement';
  const isAttack = state.phase === 'attack';
  
  // 1. Determine states
  const meReady = isPlacement ? state.players[localKey].readyPlacement : state.players[localKey].readyAttack;
  const oppReady = isPlacement ? state.players[remoteKey].readyPlacement : state.players[remoteKey].readyAttack;
  const forced = isForced(state, localKey);

  // 2. Update Button Text
  if (state.phase === 'gameover') {
    btnReady.textContent = 'Game Over';
  } else if (meReady) {
    btnReady.textContent = 'Waiting...';
  } else {
    btnReady.textContent = 'Ready';
  }

  // 3. Apply Classes
  // Remove classes first to reset state
  btnReady.classList.remove('opponent-ready', 'waiting', 'action-disabled');

  if (forced) {
    btnReady.classList.add('action-disabled');
  } else if (meReady) {
    btnReady.classList.add('waiting', 'action-disabled');
  } else if (oppReady) {
    // This is the specific request: glow blue if opponent is ready and you aren't
    btnReady.classList.add('opponent-ready');
  }

  // ... (rest of the render function) ...
}