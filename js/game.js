
const BOARD_SIZE = 6;
const HAND_SIZE = 3;
const BLUE_FORCE_CAP = 4; // >= this many blue(tier1) cards on one board forces a merge

function newPlayerState(deck) {
  return {
    deck: deck.units,
    hand: [],
    board: Array(BOARD_SIZE).fill(null),
    spells: deck.spells,
    chips: deck.chips,
    graveyard: [],
    readyPlacement: false,
    readyAttack: false,
    attackAssignments: {}, // slotIndex -> { targetOwner, targetSlot }
    defendingSlots: {},     // slotIndex -> true : this card is defending itself this round
  };
}

function createMatch(seed, p1id = 'p1', p2id = 'p2') {
  const rng = new RngStream(seed);
  const deck1 = buildDeck(rng);
  const deck2 = buildDeck(rng);
  const state = {
    seed, rngCalls: rng.calls,
    round: 1,
    phase: 'placement',
    players: { [p1id]: newPlayerState(deck1), [p2id]: newPlayerState(deck2) },
    order: [p1id, p2id],
    pendingQueuedAttacks: [],
    log: [],
    winner: null,
  };
  state._rng = rng;
  drawToHand(state, p1id, HAND_SIZE);
  drawToHand(state, p2id, HAND_SIZE);
  return state;
}

function other(state, playerKey) {
  return state.order.find(k => k !== playerKey);
}

function pushLog(state, msg) { state.log.push(msg); }

function drawToHand(state, playerKey, count) {
  const p = state.players[playerKey];
  for (let i = 0; i < count; i++) {
    if (p.hand.length >= HAND_SIZE) break;
    if (p.deck.length === 0) break;
    p.hand.push(p.deck.shift());
  }
}

function boardCount(p) { return p.board.filter(Boolean).length; }
function emptySlot(p) { return p.board.findIndex(c => c === null); }

function abilityTrigger(state, playerKey, card, trigger) {
  if (!card || card.ability === 'none') return;
  const a = card.ability;
  const enemyKey = other(state, playerKey);
  const enemy = state.players[enemyKey];
  const me = state.players[playerKey];
  if (trigger === 'onplay') {
    if (a === 'onplay_dmg2' || a === 'onplay_dmg1') {
      const dmg = a === 'onplay_dmg2' ? 2 : 1;
      const target = weakestEnemyCard(enemy);
      if (target) { damageCard(state, enemyKey, target.slot, dmg); pushLog(state, `${card.name} deals ${dmg} to ${target.card.name}`); }
    } else if (a === 'onplay_heal2') {
      const target = weakestAllyCard(me, card.id);
      if (target) { healCard(target.card, 2); pushLog(state, `${card.name} heals ${target.card.name} 2hp`); }
    } else if (a === 'onplay_shield1') {
      card.bonusDefendCharge = (card.bonusDefendCharge || 0) + 1;
    }
  } else if (trigger === 'ondeath') {
    if (a === 'ondeath_dmg2') {
      const target = weakestEnemyCard(enemy);
      if (target) { damageCard(state, enemyKey, target.slot, 2); pushLog(state, `${card.name} (death) deals 2 to ${target.card.name}`); }
    } else if (a === 'ondeath_heal1') {
      const target = weakestAllyCard(me, card.id);
      if (target) { healCard(target.card, 1); pushLog(state, `${card.name} (death) heals ${target.card.name} 1hp`); }
    }
  }
}

function weakestEnemyCard(enemyPlayerState) {
  let best = null;
  enemyPlayerState.board.forEach((c, slot) => {
    if (c && (!best || c.hp < best.card.hp)) best = { card: c, slot };
  });
  return best;
}
function weakestAllyCard(playerState, excludeId) {
  let best = null;
  playerState.board.forEach((c, slot) => {
    if (c && c.id !== excludeId && (!best || c.hp < best.card.hp)) best = { card: c, slot };
  });
  return best;
}

function healCard(card, amt) { card.hp = Math.min(card.maxHp, card.hp + amt); }

function damageCard(state, ownerKey, slot, amount) {
  const p = state.players[ownerKey];
  const card = p.board[slot];
  if (!card) return;
  card.hp -= amount;
  if (card.hp <= 0) killCard(state, ownerKey, slot);
}

function killCard(state, ownerKey, slot) {
  const p = state.players[ownerKey];
  const card = p.board[slot];
  if (!card) return;
  const canReplenish = card.tier === 1 && nonBlueUnitsRemaining(p) > 0;
  p.board[slot] = null;               // remove from the board FIRST so on-death
  p.graveyard.push(card);             // targeting logic can never see/re-hit this card
  delete p.defendingSlots[slot];
  abilityTrigger(state, ownerKey, card, 'ondeath');
  if (canReplenish) replenishBlue(state, ownerKey, 1);
}

// Blue cards are an infinite resource: whenever one is consumed - by dying in
// combat or by being fused into something bigger - the player gets a fresh
// Blue back, as long as they still have at least one non-Blue card
// somewhere (deck, hand, or board). The instant a player is reduced to
// nothing but Blues, this stops for good: no more free Blues on merge or
// death from that point on.
function replenishBlue(state, playerKey, count) {
  const p = state.players[playerKey];
  for (let i = 0; i < count; i++) p.deck.push(makeUnitCard(1, state._rng));
  pushLog(state, `${playerKey} reclaims ${count} Blue card${count > 1 ? 's' : ''}`);
}

// Once a player has 4+ Blue cards on their board at once, they must resolve
// it by dragging one Blue onto another (merging) before doing anything
// else - placing, casting, defending, attacking, or readying up are all
// blocked until the merge happens. `isForced` (below) is the single source
// of truth the UI polls to show the "must merge" banner + glow.
function forcedBlock(state, playerKey) {
  if (isForced(state, playerKey)) {
    return { ok: false, error: 'You have too many Blue cards — merge two of them before doing anything else.' };
  }
  return null;
}

// ---- Placement actions -----------------------------------------------------

function placeCard(state, playerKey, handIndex, slot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  const p = state.players[playerKey];
  if (state.phase !== 'placement') return { ok: false, error: 'not placement phase' };
  if (handIndex < 0 || handIndex >= p.hand.length) return { ok: false, error: 'bad hand index' };
  if (p.board[slot] !== null) return { ok: false, error: 'slot occupied' };
  const card = p.hand.splice(handIndex, 1)[0];
  p.board[slot] = card;
  abilityTrigger(state, playerKey, card, 'onplay');
  return { ok: true };
}

function mergeCards(state, playerKey, slotA, slotB) {
  const p = state.players[playerKey];
  if (state.phase !== 'placement') return { ok: false, error: 'not placement phase' };
  const a = p.board[slotA], b = p.board[slotB];
  if (!a || !b || slotA === slotB) return { ok: false, error: 'invalid slots' };
  if (isForced(state, playerKey) && a.tier !== 1 && b.tier !== 1) {
    return { ok: false, error: 'You must merge a Blue card first.' };
  }
  const bluesConsumed = (a.tier === 1 ? 1 : 0) + (b.tier === 1 ? 1 : 0);
  const canReplenish = bluesConsumed > 0 && nonBlueUnitsRemaining(p) > 0; // checked BEFORE the merge creates its (non-Blue) survivor
  const newTier = mergedTier(a.tier, b.tier);
  const survivorHp = Math.min(TIERS[newTier].hp, a.hp + b.hp); // carries over some damage state
  const merged = {
    id: nextId(),
    kind: 'unit',
    tier: newTier,
    name: `${TIERS[newTier].name} Fusion`,
    hp: survivorHp,
    maxHp: TIERS[newTier].hp,
    dmg: TIERS[newTier].dmg,
    sp: TIERS[newTier].sp,
    ability: a.tier >= b.tier ? a.ability : b.ability,
    defendChargesUsed: 0,
    chipsAttached: [],
  };
  p.board[slotA] = merged;
  p.board[slotB] = null;
  delete p.attackAssignments[slotB];
  delete p.defendingSlots[slotB];
  if (canReplenish) replenishBlue(state, playerKey, bluesConsumed);
  abilityTrigger(state, playerKey, merged, 'onplay');
  pushLog(state, `${playerKey} merges into ${merged.name} (tier ${newTier})`);
  return { ok: true, mergedSlot: slotA };
}

// Used by the bot (which has no UI to show a "must merge" banner) to resolve
// its own forced-merge state immediately and completely. Human players
// instead see a blocking prompt and drag-merge manually - see forcedBlock().
function autoResolveForcedMerges(state, playerKey) {
  const p = state.players[playerKey];
  let guard = 0;
  while (guard++ < 20 && isForced(state, playerKey)) {
    const blueSlots = p.board.map((c, i) => (c && c.tier === 1 ? i : -1)).filter(i => i >= 0);
    if (blueSlots.length < 2) break;
    mergeCards(state, playerKey, blueSlots[0], blueSlots[1]);
  }
}

function castSpell(state, playerKey, spellInstanceId, targetOwnerKey, targetSlot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  const p = state.players[playerKey];
  const idx = p.spells.findIndex(s => s.id === spellInstanceId);
  if (idx === -1) return { ok: false, error: 'spell not in hand' };
  const spell = p.spells[idx];
  const targetP = state.players[targetOwnerKey];
  const targetCard = targetP.board[targetSlot];
  if (!targetCard) return { ok: false, error: 'no target' };
  if (spell.dmg) damageCard(state, targetOwnerKey, targetSlot, spell.dmg);
  if (spell.heal) healCard(targetCard, spell.heal);
  if (spell.refreshDefense) targetCard.defendChargesUsed = 0;
  p.spells.splice(idx, 1);
  pushLog(state, `${playerKey} casts ${spell.name}`);
  return { ok: true };
}

function attachChip(state, playerKey, chipInstanceId, targetOwnerKey, targetSlot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  const p = state.players[playerKey];
  const idx = p.chips.findIndex(c => c.id === chipInstanceId);
  if (idx === -1) return { ok: false, error: 'chip not in hand' };
  const chip = p.chips[idx];
  const targetP = state.players[targetOwnerKey];
  const targetCard = targetP.board[targetSlot];
  if (!targetCard) return { ok: false, error: 'no target' };
  if (chipSlotsFree(targetCard) <= 0) return { ok: false, error: 'no free chip slots' };
  targetCard.chipsAttached = targetCard.chipsAttached || [];
  targetCard.chipsAttached.push(chip.defId);
  if (chip.dmg) targetCard.dmg += chip.dmg;
  if (chip.hp) { targetCard.maxHp += chip.hp; targetCard.hp += chip.hp; }
  p.chips.splice(idx, 1);
  pushLog(state, `${playerKey} attaches ${chip.name} to ${targetCard.name}`);
  return { ok: true };
}

// ---- Defense (can be declared during placement or at the start of attack) -
// Defense is self-only: a card blocks damage aimed at itself, becoming
// invincible for the round and forfeiting its own attack. It can never
// defend on behalf of another card, and while defending it cannot be used
// to protect anything else either - it is simply off the attack roster and
// immune to damage until next round.

function nonBlueUnitsRemaining(playerState) {
  const onBoard = playerState.board.filter(c => c && c.tier !== 1).length;
  const deckHandNonBlue = playerState.deck.concat(playerState.hand).filter(c => c.tier !== 1).length;
  return deckHandNonBlue + onBoard;
}

function setDefend(state, playerKey, slot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  const p = state.players[playerKey];
  const card = p.board[slot];
  if (!card) return { ok: false, error: 'no card in slot' };
  const tierInfo = TIERS[card.tier];
  if (tierInfo.defends <= 0) return { ok: false, error: 'this card cannot defend' };
  if (card.tier === 1 && nonBlueUnitsRemaining(p) === 0) {
    return { ok: false, error: 'blue cards can no longer defend: no non-blue cards remain' };
  }
  const bonus = card.bonusDefendCharge || 0;
  const chargesLeft = tierInfo.defends === Infinity ? Infinity : (tierInfo.defends + bonus) - card.defendChargesUsed;
  if (chargesLeft <= 0) return { ok: false, error: 'no defend charges left' };
  delete p.attackAssignments[slot]; // defending forfeits any queued attack
  p.defendingSlots[slot] = true;
  return { ok: true };
}

function cancelDefend(state, playerKey, slot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  delete state.players[playerKey].defendingSlots[slot];
  return { ok: true };
}

// ---- Attack phase -----------------------------------------------------------

function setAttack(state, playerKey, slot, targetOwnerKey, targetSlot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  const p = state.players[playerKey];
  const card = p.board[slot];
  if (!card) return { ok: false, error: 'no card in slot' };
  if (p.defendingSlots[slot]) return { ok: false, error: 'card is defending this round and cannot attack' };
  // Snapshot damage/pierce/name now: if this attacker is later killed by a
  // spell/chip before the simultaneous resolution runs, its queued attack
  // (resolved at the start of next placement round) still uses these values.
  p.attackAssignments[slot] = { targetOwner: targetOwnerKey, targetSlot, dmg: card.dmg, pierce: card.ability === 'onattack_pierce', sourceName: card.name };
  return { ok: true };
}

function readyPlacement(state, playerKey) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  state.players[playerKey].readyPlacement = true;
  const allReady = state.order.every(k => state.players[k].readyPlacement);
  if (allReady) {
    state.phase = 'attack';
    state.order.forEach(k => { state.players[k].readyPlacement = false; });
  }
  return { ok: true, phaseChanged: allReady };
}

function readyAttack(state, playerKey) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  state.players[playerKey].readyAttack = true;
  const allReady = state.order.every(k => state.players[k].readyAttack);
  if (allReady) {
    resolveAttacks(state);
  }
  return { ok: true, resolved: allReady };
}

// Both players' attacks resolve simultaneously. Damage from all attackers is
// computed against a snapshot, then applied together; deaths & on-death
// abilities fire immediately after damage is applied. Any attack whose
// attacker died *before* this resolution (e.g. killed by a spell/chip
// earlier in this same attack phase) is queued and instead executes at the
// very start of the next placement phase.
function resolveAttacks(state) {
  // Any card that was assigned to attack but is already gone by the time
  // both sides are ready (killed by a spell/chip earlier in this same
  // attack phase) never gets to swing this round - its attack is queued
  // for the start of the next placement round instead. Cards that die
  // *as part of* this simultaneous exchange still count as having attacked,
  // since all attacks land at once.
  const queuedCandidates = [];
  state.order.forEach(attackerKey => {
    const p = state.players[attackerKey];
    Object.entries(p.attackAssignments).forEach(([slotStr, assign]) => {
      const slot = Number(slotStr);
      if (!p.board[slot]) queuedCandidates.push({ ownerKey: attackerKey, targetOwner: assign.targetOwner, targetSlot: assign.targetSlot, dmg: assign.dmg, pierce: assign.pierce });
    });
  });

  const blockedSlots = {}; // ownerKey -> Set of slots that actually blocked an attack this round
  state.order.forEach(k => { blockedSlots[k] = new Set(); });

  const damageMap = []; // { targetOwner, targetSlot, amount, sourceName }
  state.order.forEach(attackerKey => {
    const p = state.players[attackerKey];
    Object.entries(p.attackAssignments).forEach(([slotStr, assign]) => {
      const slot = Number(slotStr);
      const attacker = p.board[slot];
      if (!attacker) return; // already dead before resolution -> handled as queued attack below
      const defenderP = state.players[assign.targetOwner];
      const targetSlot = assign.targetSlot;
      if (!defenderP.board[targetSlot]) return;
      if (defenderP.defendingSlots[targetSlot] && !assign.pierce) {
        blockedSlots[assign.targetOwner].add(targetSlot); // invincible - attack is blocked entirely
        return;
      }
      damageMap.push({ targetOwner: assign.targetOwner, targetSlot, amount: assign.dmg, sourceName: assign.sourceName });
    });
  });

  damageMap.forEach(d => damageCard(state, d.targetOwner, d.targetSlot, d.amount));

  // A defend charge is spent only for cards that actually blocked something.
  state.order.forEach(k => {
    const p = state.players[k];
    blockedSlots[k].forEach(slot => {
      const card = p.board[slot];
      if (card) card.defendChargesUsed++;
    });
  });

  state.pendingQueuedAttacks.push(...queuedCandidates);

  state.order.forEach(k => {
    const p = state.players[k];
    p.attackAssignments = {};
    p.defendingSlots = {};
    p.readyAttack = false;
  });

  checkWinAndAdvance(state);
}

function checkWinAndAdvance(state) {
  const dead = {};
  state.order.forEach(k => {
    const p = state.players[k];
    const totalLeft = boardCount(p) + p.hand.length + p.deck.length;
    dead[k] = totalLeft === 0;
  });
  const [k1, k2] = state.order;
  if (dead[k1] && dead[k2]) {
    const score1 = state.players[k1].spells.length + state.players[k1].chips.length;
    const score2 = state.players[k2].spells.length + state.players[k2].chips.length;
    state.phase = 'gameover';
    state.winner = score1 === score2 ? 'draw' : (score1 > score2 ? k1 : k2);
    pushLog(state, `Both boards empty -> fail-safe decides: ${state.winner}`);
    return;
  } else if (dead[k1] || dead[k2]) {
    state.phase = 'gameover';
    state.winner = dead[k1] ? k2 : k1;
    pushLog(state, `${state.winner} wins!`);
    return;
  }
  startPlacementPhase(state);
}

function startPlacementPhase(state) {
  state.round++;
  state.phase = 'placement';
  // Resolve queued attacks (from cards that died mid-swing last attack phase)
  // before any new placement actions happen this cycle.
  const queue = state.pendingQueuedAttacks;
  state.pendingQueuedAttacks = [];
  queue.forEach(q => {
    const defenderP = state.players[q.targetOwner];
    if (!defenderP.board[q.targetSlot]) return;
    if (defenderP.defendingSlots[q.targetSlot] && !q.pierce) {
      pushLog(state, `Queued attack from fallen ${q.ownerKey} card is blocked`);
      return;
    }
    pushLog(state, `Queued attack from fallen ${q.ownerKey} card resolves for ${q.dmg}`);
    damageCard(state, q.targetOwner, q.targetSlot, q.dmg);
  });
  state.order.forEach(k => drawToHand(state, k, HAND_SIZE));
}

function isForced(state, playerKey) {
  const p = state.players[playerKey];
  const blueSlots = p.board.filter(c => c && c.tier === 1).length;
  return blueSlots >= BLUE_FORCE_CAP;
}

function boardFull(playerState) { return boardCount(playerState) >= BOARD_SIZE; }

// Single entry point used by local UI, the bot, and the network layer so
// every action flows through one deterministic dispatcher.
function applyAction(state, action) {
  switch (action.type) {
    case 'place': return placeCard(state, action.player, action.handIndex, action.slot);
    case 'merge': return mergeCards(state, action.player, action.slotA, action.slotB);
    case 'spell': return castSpell(state, action.player, action.spellId, action.targetOwner, action.targetSlot);
    case 'chip': return attachChip(state, action.player, action.chipId, action.targetOwner, action.targetSlot);
    case 'defend': return setDefend(state, action.player, action.slot);
    case 'cancelDefend': return cancelDefend(state, action.player, action.slot);
    case 'attack': return setAttack(state, action.player, action.slot, action.targetOwner, action.targetSlot);
    case 'readyPlacement': return readyPlacement(state, action.player);
    case 'readyAttack': return readyAttack(state, action.player);
    default: return { ok: false, error: 'unknown action ' + action.type };
  }
}
// Global hotkey to Ready Up when 'R' is pressed
document.addEventListener('keydown', (event) => {
  // Prevent triggering if the user is currently typing in an input field (like room code join box)
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  if (event.key.toLowerCase() === 'r') {
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn && readyBtn.style.display !== 'none' && !readyBtn.disabled) {
      readyBtn.click();
    }
  }
});
