
function cardEl(card, { owner, slot, selected, defending, attacking, forceGlow, selectableClass, extraClass } = {}) {
  const el = document.createElement('div');
  el.className = `card tier${card.tier} ${extraClass || ''}`;
  if (selected) el.classList.add('selected');
  if (defending) el.classList.add('defending');
  if (attacking) el.classList.add('attacking-flag');
  if (forceGlow) el.classList.add('force-glow');
  el.dataset.owner = owner;
  el.dataset.slot = slot;
  el.dataset.cardId = card.id;
  const chips = card.chipsAttached ? card.chipsAttached.length : 0;
  const abilityText = card.ability && card.ability !== 'none' ? abilityLabel(card.ability) : '';
  el.innerHTML = `
    <div class="card-name">${card.name}</div>
    <div class="card-ability">${abilityText}</div>
    <div class="card-stats">
      <span class="hp">${Math.max(0, card.hp)}❤</span>
      <span class="dmg">${card.dmg}⚔</span>
      <span class="sp">${chips}/${card.sp}⛃</span>
    </div>`;
  return el;
}

const ABILITY_SHORT = {
  onplay_dmg2: 'Play: 2 dmg to weakest foe',
  onplay_dmg1: 'Play: 1 dmg to weakest foe',
  ondeath_dmg2: 'Death: 2 dmg to weakest foe',
  onplay_heal2: 'Play: heal ally 2',
  ondeath_heal1: 'Death: heal ally 1',
  onattack_pierce: 'Ignores defense',
  onplay_shield1: 'Play: +1 defend charge',
};
function abilityLabel(id) { return ABILITY_SHORT[id] || ''; }

function renderBoard(container, playerState, ownerKey, { selectedSlot, targetableSlots, forceGlowAll } = {}) {
  container.innerHTML = '';
  playerState.board.forEach((card, slot) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'slot';
    slotEl.dataset.owner = ownerKey;
    slotEl.dataset.slot = slot;
    if (targetableSlots && targetableSlots.includes(slot)) slotEl.classList.add('targetable');
    if (card) {
      const el = cardEl(card, {
        owner: ownerKey,
        slot,
        selected: selectedSlot === slot,
        defending: !!(playerState.defendingSlots && playerState.defendingSlots[slot]),
        attacking: !!(playerState.attackAssignments && playerState.attackAssignments[slot]),
        forceGlow: !!forceGlowAll && card.tier === 1,
      });
      slotEl.appendChild(el);
    } else if (selectedSlot === 'placing') {
      slotEl.classList.add('selectable');
    }
    container.appendChild(slotEl);
  });
}

function renderHand(container, playerState, selectedHandIdx) {
  container.innerHTML = '';
  playerState.hand.forEach((card, idx) => {
    const el = cardEl(card, { owner: 'hand', slot: idx, selected: selectedHandIdx === idx });
    el.dataset.handIdx = idx;
    el.dataset.role = 'hand-card';
    container.appendChild(el);
  });
}

// Always-visible, read-only strip showing every card still left in the
// player's deck (face up) - no more hidden information about what's coming.
function renderDeck(container, countEl, playerState) {
  container.innerHTML = '';
  playerState.deck.forEach((card, idx) => {
    const el = cardEl(card, { owner: 'deck', slot: idx });
    container.appendChild(el);
  });
  if (countEl) countEl.textContent = `(${playerState.deck.length})`;
}

function renderSpellsChips(container, playerState, selection) {
  container.innerHTML = '';
  playerState.spells.forEach(spell => {
    const el = document.createElement('div');
    el.className = 'sc-card spell';
    el.dataset.role = 'spell'; el.dataset.spellId = spell.id;
    if (selection && selection.mode === 'spell' && selection.id === spell.id) el.classList.add('selected');
    el.innerHTML = `<div class="card-name">${spell.name}</div><div class="card-ability">${spell.text}</div>`;
    container.appendChild(el);
  });
  playerState.chips.forEach(chip => {
    const el = document.createElement('div');
    el.className = 'sc-card chip';
    el.dataset.role = 'chip'; el.dataset.chipId = chip.id;
    if (selection && selection.mode === 'chip' && selection.id === chip.id) el.classList.add('selected');
    el.innerHTML = `<div class="card-name">${chip.name}</div><div class="card-ability">${chip.text}</div>`;
    container.appendChild(el);
  });
}

function showToast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), ms);
}

function renderLog(container, log) {
  container.innerHTML = log.slice(-40).map(l => `<div>${l}</div>`).join('');
  container.scrollTop = container.scrollHeight;
}
