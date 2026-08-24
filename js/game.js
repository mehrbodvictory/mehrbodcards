
const BOARD_SIZE = 6;
const BLUE_FORCE_CAP = 4; // >= this many blue(tier1) cards on one board forces a merge

// ---- FX events -------------------------------------------------------------
// A transient, local-only event log describing exactly what happened during
// the current applyAction call and, crucially, *why* - e.g. a card died from
// a direct attack vs. a spell vs. a triggered ability. Nothing here is
// shipped over the network or affects game logic; each side of a multiplayer
// match derives its own fx from applying the same deterministic action to
// the same state, purely for local animation/juice. Reset at the top of
// every applyAction call and returned alongside the result.
function pushFx(state, evt) { if (state._fx) state._fx.push(evt); }

// v3.0: no more hand/draw step. `deck` is now the player's ENTIRE pool of
// units, visible and available to place (if Blue) or use as a merge
// blueprint (if Green/Red/Orange) from the very first round - nothing is
// hidden or drawn progressively. `everMergedUp` still tracks whether this
// player has ever completed a merge (used to unlock Blue defending).
function newPlayerState(deck) {
  return {
    deck: deck.units,
    board: Array(BOARD_SIZE).fill(null),
    spells: deck.spells,
    chips: deck.chips,
    graveyard: [],
    readyPlacement: false,
    readyAttack: false,
    attackAssignments: {}, // slotIndex -> { targetOwner, targetSlot }
    defendingSlots: {},     // slotIndex -> true : this card is defending itself this round
    everMergedUp: false,    // true forever, from the moment this player's first merge creates a non-Blue card
  };
}

// `deckConfigs`, if given, is { [playerKey]: { spellIds, chipIds } } - see
// buildDeck() in cards.js. A missing/absent config for a player (e.g. the
// bot) falls back to a random draft, same as before v2.0.
function createMatch(seed, p1id = 'p1', p2id = 'p2', deckConfigs = {}) {
  const rng = new RngStream(seed);
  const deck1 = buildDeck(rng, deckConfigs[p1id]);
  const deck2 = buildDeck(rng, deckConfigs[p2id]);
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
  return state;
}

function other(state, playerKey) {
  return state.order.find(k => k !== playerKey);
}

function pushLog(state, msg) { state.log.push(msg); }

function boardCount(p) { return p.board.filter(Boolean).length; }
function emptySlot(p) { return p.board.findIndex(c => c === null); }

// v3.0: the resource that lets a player keep merging upward - a matching-
// tier Green/Red/Orange card still sitting unused in their deck. Once this
// comes up empty, that player has permanently run out of ways to merge any
// further (see mergeCards) AND Blue cards stop regenerating on death/merge
// (see replenishBlue's callers) - the well is dry.
function hasRemainingBlueprints(playerState) {
  return playerState.deck.some(c => c.tier > 1);
}

function abilityTrigger(state, playerKey, card, trigger, slot, deathSource) {
  if (!card || card.ability === 'none') return;
  const a = card.ability;
  const enemyKey = other(state, playerKey);
  const enemy = state.players[enemyKey];
  const me = state.players[playerKey];
  const source = { kind: trigger === 'onplay' ? 'ability-onplay' : 'ability-ondeath', name: card.name, owner: playerKey, slot };
  if (trigger === 'onplay') {
    if (a === 'onplay_dmg2' || a === 'onplay_dmg1') {
      const dmg = a === 'onplay_dmg2' ? 2 : 1;
      const target = weakestEnemyCard(enemy);
      if (target) { damageCard(state, enemyKey, target.slot, dmg, source); pushLog(state, `${card.name} deals ${dmg} to ${target.card.name}`); }
    } else if (a === 'onplay_heal2') {
      const target = weakestAllyCard(me, card.id);
      if (target) {
        healCard(target.card, 2);
        pushFx(state, { type: 'heal', targetOwner: playerKey, targetSlot: target.slot, amount: 2, source });
        pushLog(state, `${card.name} heals ${target.card.name} 2hp`);
      }
    } else if (a === 'onplay_shield1') {
      card.bonusDefendCharge = (card.bonusDefendCharge || 0) + 1;
      pushFx(state, { type: 'shieldCharge', owner: playerKey, slot });
    } else if (a === 'green_onplay_healall1') {
      healAllAllies(state, playerKey, 1, source);
      pushLog(state, `${card.name} heals all of ${playerKey}'s cards 1hp`);
    } else if (a === 'green_onplay_selftoughen1') {
      card.maxHp += 1; card.hp += 1;
      pushFx(state, { type: 'selfBuff', owner: playerKey, slot, stat: 'hp', amount: 1 });
      pushLog(state, `${card.name} gains +1 max HP`);
    } else if (a === 'green_onplay_discard1') {
      discardRandomFromDeck(state, enemyKey, source);
    } else if (a === 'red_onplay_dmgall1') {
      damageAllEnemies(state, enemyKey, 1, source);
      pushLog(state, `${card.name} deals 1 dmg to every enemy card`);
    } else if (a === 'red_onplay_buffallies_dmg1') {
      buffAllAlliesDmg(state, playerKey, 1);
      pushLog(state, `${card.name} grants +1 DMG to all of ${playerKey}'s cards`);
    } else if (a === 'orange_onplay_execute') {
      const target = weakestEnemyCard(enemy);
      if (target) { damageCard(state, enemyKey, target.slot, target.card.hp, source); pushLog(state, `${card.name} executes ${target.card.name}`); }
    } else if (a === 'orange_onplay_scaledmg') {
      const bonus = boardCount(enemy);
      card.dmg += bonus;
      pushFx(state, { type: 'selfBuff', owner: playerKey, slot, stat: 'dmg', amount: bonus });
      pushLog(state, `${card.name} gains +${bonus} DMG (scaling with enemy board size)`);
    } else if (a === 'orange_onplay_refreshall') {
      refreshAllAlliesDefense(state, playerKey);
      pushLog(state, `${card.name} refreshes all of ${playerKey}'s defense charges`);
    }
  } else if (trigger === 'ondeath') {
    if (a === 'ondeath_dmg2') {
      const target = weakestEnemyCard(enemy);
      if (target) { damageCard(state, enemyKey, target.slot, 2, source); pushLog(state, `${card.name} (death) deals 2 to ${target.card.name}`); }
    } else if (a === 'ondeath_heal1') {
      const target = weakestAllyCard(me, card.id);
      if (target) {
        healCard(target.card, 1);
        pushFx(state, { type: 'heal', targetOwner: playerKey, targetSlot: target.slot, amount: 1, source });
        pushLog(state, `${card.name} (death) heals ${target.card.name} 1hp`);
      }
    } else if (a === 'green_ondeath_draw1') {
      // v3.0: no more hand to draw into - heal this player's weakest
      // surviving card instead, as a small consolation for the loss.
      const target = weakestAllyCard(me, card.id);
      if (target) {
        healCard(target.card, 1);
        pushFx(state, { type: 'heal', targetOwner: playerKey, targetSlot: target.slot, amount: 1, source });
        pushLog(state, `${card.name} (death) heals ${target.card.name} 1hp`);
      }
    } else if (a === 'red_ondeath_thorns1') {
      if (deathSource && deathSource.kind === 'attack' && deathSource.slot != null) {
        const atkP = state.players[deathSource.owner];
        if (atkP && atkP.board[deathSource.slot]) {
          damageCard(state, deathSource.owner, deathSource.slot, 1, { kind: 'ability-ondeath', name: card.name, owner: playerKey, slot });
          pushLog(state, `${card.name} (death) deals 1 thorns dmg back to its attacker`);
        }
      }
    } else if (a === 'orange_ondeath_dmg4') {
      const target = weakestEnemyCard(enemy);
      if (target) { damageCard(state, enemyKey, target.slot, 4, source); pushLog(state, `${card.name} (death) deals 4 to ${target.card.name}`); }
    }
  }
}

// ---- New-ability helper effects --------------------------------------------
function healAllAllies(state, playerKey, amount, source) {
  const p = state.players[playerKey];
  p.board.forEach((c, slot) => {
    if (!c) return;
    healCard(c, amount);
    pushFx(state, { type: 'heal', targetOwner: playerKey, targetSlot: slot, amount, source });
  });
}
function damageAllEnemies(state, enemyKey, amount, source) {
  const p = state.players[enemyKey];
  const slots = p.board.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
  slots.forEach(slot => damageCard(state, enemyKey, slot, amount, source));
}
function buffAllAlliesDmg(state, playerKey, amount) {
  const p = state.players[playerKey];
  p.board.forEach((c, slot) => {
    if (!c) return;
    c.dmg += amount;
    pushFx(state, { type: 'selfBuff', owner: playerKey, slot, stat: 'dmg', amount });
  });
}
function refreshAllAlliesDefense(state, playerKey) {
  const p = state.players[playerKey];
  p.board.forEach((c, slot) => {
    if (!c) return;
    c.defendChargesUsed = 0;
    pushFx(state, { type: 'refreshDefense', owner: playerKey, slot });
  });
}
// v3.0: "discard from hand" doesn't exist anymore - this permanently
// removes a random Blue card from the target's remaining DECK instead,
// denying them a future placement. If they have no Blue cards left in
// deck, this simply does nothing (no valid target).
function discardRandomFromDeck(state, playerKey, source) {
  const p = state.players[playerKey];
  const blueIdxs = p.deck.map((c, i) => (c.tier === 1 ? i : -1)).filter(i => i >= 0);
  if (blueIdxs.length === 0) return;
  const idx = blueIdxs[Math.floor(state._rng.next() * blueIdxs.length)];
  const [card] = p.deck.splice(idx, 1);
  pushFx(state, { type: 'discard', owner: playerKey, cardName: card.name, source });
  pushLog(state, `${card.name} removed from ${playerKey}'s deck`);
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

function damageCard(state, ownerKey, slot, amount, source) {
  const p = state.players[ownerKey];
  const card = p.board[slot];
  if (!card) return;
  card.hp = Math.max(0, card.hp - amount);
  const killed = card.hp <= 0;
  pushFx(state, {
    type: 'damage', targetOwner: ownerKey, targetSlot: slot, amount, killed,
    targetName: card.name, targetTier: card.tier, source: source || null,
  });
  if (killed) killCard(state, ownerKey, slot, source);
}

function killCard(state, ownerKey, slot, deathSource) {
  const p = state.players[ownerKey];
  const card = p.board[slot];
  if (!card) return;
  // v3.0: Blue only comes back if this player has both merged at least
  // once AND still has at least one non-Blue blueprint left in their deck
  // (see hasRemainingBlueprints) - once the blueprint well runs dry, Blue
  // stops regenerating for good, same as the "everMergedUp" gate already
  // permanently locks in once tripped.
  const canReplenish = card.tier === 1 && p.everMergedUp && hasRemainingBlueprints(p);
  p.board[slot] = null;               // remove from the board FIRST so on-death
  p.graveyard.push(card);             // targeting logic can never see/re-hit this card
  delete p.defendingSlots[slot];
  abilityTrigger(state, ownerKey, card, 'ondeath', slot, deathSource);
  if (canReplenish) replenishBlue(state, ownerKey, 1);
}

// Blue cards are an infinite resource ONLY while the player still has a
// non-Blue blueprint left to merge toward: whenever a Blue is consumed -
// by dying in combat or by being fused into something bigger - the player
// gets a fresh Blue back, as long as hasRemainingBlueprints() is still
// true. The instant a player runs out of blueprints entirely, this stops
// for good: no more free Blues on merge or death from that point on.
function replenishBlue(state, playerKey, count) {
  const p = state.players[playerKey];
  for (let i = 0; i < count; i++) p.deck.push(makeUnitCard(1, state._rng));
  pushFx(state, { type: 'blueReplenish', owner: playerKey, count });
  pushLog(state, `${playerKey} reclaims ${count} Blue card${count > 1 ? 's' : ''}`);
}

// Once a player has 4+ Blue cards on their board at once, they must resolve
// it by dragging one Blue onto another (merging) before doing anything
// else - placing, casting, defending, attacking, or readying up are all
// blocked until the merge happens. `isForced` (below) is the single source
// of truth the UI polls to show the "must merge" banner + glow.
//
// v3.0 safety valve: merges now require a matching-tier blueprint still in
// the deck (see mergeCards), so if a player has run completely out of
// blueprints there may be NO legal merge available among their Blues at
// all. Forcing a merge that can never happen would be a permanent
// softlock, so `isForced` only ever fires when at least one legal,
// blueprint-backed merge actually exists right now.
function canPerformAnyMerge(state, playerKey) {
  const p = state.players[playerKey];
  const filled = p.board.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
  for (let i = 0; i < filled.length; i++) {
    for (let j = i + 1; j < filled.length; j++) {
      const a = p.board[filled[i]], b = p.board[filled[j]];
      if (a.tier === 4 || b.tier === 4) continue;
      const sum = a.tier + b.tier;
      if (sum > 4) continue;
      if (p.deck.some(c => c.tier === sum)) return true;
    }
  }
  return false;
}

function forcedBlock(state, playerKey) {
  if (isForced(state, playerKey)) {
    return { ok: false, error: 'You have too many Blue cards — merge two of them before doing anything else.' };
  }
  return null;
}

// ---- Placement actions -----------------------------------------------------

// v3.0: `deckIndex` (still called `handIndex` in the action payload for
// backward-compatible wiring with the UI/bot/network layers, which just
// pass through whatever index the player picked) - there's no hand
// anymore, so this always indexes directly into the player's deck, the
// single pool every card lives in from the start of the match.
function placeCard(state, playerKey, deckIndex, slot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  const p = state.players[playerKey];
  if (state.phase !== 'placement') return { ok: false, error: 'not placement phase' };
  if (deckIndex < 0 || deckIndex >= p.deck.length) return { ok: false, error: 'bad card index' };
  if (p.board[slot] !== null) return { ok: false, error: 'slot occupied' };
  // v2.0: nothing above Blue can ever be placed directly - Green/Red/Orange
  // only ever come into being by merging Blues (and their fusions) upward.
  if (p.deck[deckIndex].tier !== 1) {
    return { ok: false, error: 'Only Blue cards can be placed directly - merge your way up to anything higher.' };
  }
  const card = p.deck.splice(deckIndex, 1)[0];
  p.board[slot] = card;
  pushFx(state, { type: 'place', owner: playerKey, slot });
  abilityTrigger(state, playerKey, card, 'onplay', slot);
  return { ok: true };
}

// v3.1: `blueprintIndex`, if given, is the index into the player's OWN deck
// array of the specific blueprint card they chose to merge into (see the
// picker UI in main.js, shown whenever more than one blueprint matches the
// resulting tier). It's an index rather than a card id deliberately: ids
// come from a per-session global counter that is never synced between a
// multiplayer host and guest, so it can't be trusted to name "the same
// card" on both sides - but both sides build their deck arrays
// deterministically from the same seed and apply the same sequence of
// actions, so the two decks stay in the same relative order and an index
// stays valid and meaningful across the network. If omitted, invalid, or
// pointing at a card of the wrong tier, this falls back to the first
// matching blueprint found (e.g. for the bot, or when there was only one
// legal choice to begin with).
function mergeCards(state, playerKey, slotA, slotB, blueprintIndex) {
  const p = state.players[playerKey];
  if (state.phase !== 'placement') return { ok: false, error: 'not placement phase' };
  const a = p.board[slotA], b = p.board[slotB];
  if (!a || !b || slotA === slotB) return { ok: false, error: 'invalid slots' };
  if (a.tier === 4 || b.tier === 4) {
    return { ok: false, error: 'Orange is already the highest tier and cannot merge with anything.' };
  }
  const sum = a.tier + b.tier;
  if (sum > 4) {
    return { ok: false, error: `${TIERS[a.tier].name} + ${TIERS[b.tier].name} has no valid result - that combination can't merge.` };
  }
  if (isForced(state, playerKey) && a.tier !== 1 && b.tier !== 1) {
    return { ok: false, error: 'You must merge a Blue card first.' };
  }
  const newTier = mergedTier(a.tier, b.tier);

  // v3.0: a merge can ONLY happen if the player still has a matching-tier
  // blueprint card sitting unused in their deck - there is no more generic
  // "Tier X Fusion" fallback. Run out of blueprints for a given tier and
  // that tier is permanently closed off to you for the rest of the match.
  let blueprintIdx = -1;
  if (Number.isInteger(blueprintIndex) && p.deck[blueprintIndex] && p.deck[blueprintIndex].tier === newTier) {
    blueprintIdx = blueprintIndex;
  }
  if (blueprintIdx === -1) blueprintIdx = p.deck.findIndex(c => c.tier === newTier);
  if (blueprintIdx === -1) {
    return { ok: false, error: `You need a ${TIERS[newTier].name} card in your deck to merge into that tier - you're out.` };
  }
  const blueprint = p.deck.splice(blueprintIdx, 1)[0];
  const mergedName = blueprint.name;
  const mergedAbility = blueprint.ability;

  const bluesConsumed = (a.tier === 1 ? 1 : 0) + (b.tier === 1 ? 1 : 0);
  // Every legal merge produces a tier >= 2 (Green/Red/Orange) card, so this
  // is the moment a player permanently unlocks Blue defense/replenishment -
  // it counts for this very merge too, not just future ones.
  p.everMergedUp = true;
  const survivorHp = Math.min(TIERS[newTier].hp, a.hp + b.hp); // carries over some damage state

  const merged = {
    id: nextId(),
    kind: 'unit',
    tier: newTier,
    name: mergedName,
    hp: survivorHp,
    maxHp: TIERS[newTier].hp,
    dmg: TIERS[newTier].dmg,
    sp: TIERS[newTier].sp,
    ability: mergedAbility,
    defendChargesUsed: 0,
    chipsAttached: [],
  };
  p.board[slotA] = merged;
  p.board[slotB] = null;
  delete p.attackAssignments[slotB];
  delete p.defendingSlots[slotB];
  // v3.1: replenish the FULL number of Blues consumed by this merge (not
  // capped to 1) - but only while a blueprint is still left somewhere in
  // the deck after this one was just spent (hasRemainingBlueprints, below,
  // checks post-consumption state). This is safe from the runaway-growth
  // problem an earlier build had: every merge - not just Blue+Blue ones -
  // permanently spends one finite blueprint card, so the number of merges
  // (and thus the total possible replenishment) is hard-capped by how many
  // blueprints exist in the deck to begin with. Once they're gone, this
  // stops for good and Blue can no longer merge or regenerate at all.
  const canReplenish = bluesConsumed > 0 && hasRemainingBlueprints(p);
  if (canReplenish) replenishBlue(state, playerKey, bluesConsumed);
  pushFx(state, { type: 'merge', owner: playerKey, fromSlotA: slotA, fromSlotB: slotB, toSlot: slotA, resultTier: newTier, usedBlueprint: true });
  abilityTrigger(state, playerKey, merged, 'onplay', slotA);
  pushLog(state, `${playerKey} merges into ${merged.name} (tier ${newTier}, using a blueprint from the deck)`);
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
    const before = p.board[blueSlots[0]];
    const res = mergeCards(state, playerKey, blueSlots[0], blueSlots[1]);
    if (!res.ok) break; // no blueprint available for this pairing - avoid spinning
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
  const source = { kind: 'spell', name: spell.name, owner: playerKey };
  if (spell.dmg) damageCard(state, targetOwnerKey, targetSlot, spell.dmg, source);
  if (spell.heal) {
    healCard(targetCard, spell.heal);
    pushFx(state, { type: 'heal', targetOwner: targetOwnerKey, targetSlot, amount: spell.heal, source });
  }
  if (spell.refreshDefense) {
    targetCard.defendChargesUsed = 0;
    pushFx(state, { type: 'refreshDefense', owner: targetOwnerKey, slot: targetSlot, source });
  }
  if (spell.splash) {
    const targetP = state.players[targetOwnerKey];
    const others = targetP.board.map((c, i) => (c && i !== targetSlot ? i : -1)).filter(i => i >= 0);
    if (others.length > 0) {
      const pick = others[Math.floor(state._rng.next() * others.length)];
      damageCard(state, targetOwnerKey, pick, spell.splash, source);
    }
  }
  if (spell.healAll) healAllAllies(state, targetOwnerKey, spell.healAll, source);
  if (spell.weakenDmg) {
    // targetCard may already be gone if spell.dmg killed it - re-check.
    const stillAlive = state.players[targetOwnerKey].board[targetSlot];
    if (stillAlive) {
      stillAlive.dmg = Math.max(0, stillAlive.dmg - spell.weakenDmg);
      pushFx(state, { type: 'selfBuff', owner: targetOwnerKey, slot: targetSlot, stat: 'dmg', amount: -spell.weakenDmg, source });
    }
  }
  if (spell.buffDmg) {
    const stillAlive = state.players[targetOwnerKey].board[targetSlot];
    if (stillAlive) {
      stillAlive.dmg += spell.buffDmg;
      pushFx(state, { type: 'selfBuff', owner: targetOwnerKey, slot: targetSlot, stat: 'dmg', amount: spell.buffDmg, source });
    }
  }
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
  pushFx(state, { type: 'chipAttach', owner: targetOwnerKey, slot: targetSlot, chipName: chip.name, dmgAmount: chip.dmg || 0, hpAmount: chip.hp || 0, lifesteal: !!chip.lifesteal });
  pushLog(state, `${playerKey} attaches ${chip.name} to ${targetCard.name}`);
  return { ok: true };
}

// ---- Defense (can be declared during placement or at the start of attack) -
// Defense is self-only: a card blocks damage aimed at itself, becoming
// invincible for the round and forfeiting its own attack. It can never
// defend on behalf of another card, and while defending it cannot be used
// to protect anything else either - it is simply off the attack roster and
// immune to damage until next round.

function setDefend(state, playerKey, slot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  const p = state.players[playerKey];
  const card = p.board[slot];
  if (!card) return { ok: false, error: 'no card in slot' };
  const tierInfo = TIERS[card.tier];
  if (tierInfo.defends <= 0) return { ok: false, error: 'this card cannot defend' };
  // v2.0: since every deck starts as mostly Blues, a player's Blues can't
  // defend until they've merged at least once - once that's happened, it's
  // unlocked for the rest of the match (even if that merged card later
  // dies), not re-checked live against whatever's currently on the board.
  if (card.tier === 1 && !p.everMergedUp) {
    return { ok: false, error: "blue cards can't defend yet - merge two Blues into something higher first" };
  }
  const bonus = card.bonusDefendCharge || 0;
  const chargesLeft = tierInfo.defends === Infinity ? Infinity : (tierInfo.defends + bonus) - card.defendChargesUsed;
  if (chargesLeft <= 0) return { ok: false, error: 'no defend charges left' };
  delete p.attackAssignments[slot]; // defending forfeits any queued attack
  p.defendingSlots[slot] = true;
  pushFx(state, { type: 'defend', owner: playerKey, slot });
  return { ok: true };
}

function cancelDefend(state, playerKey, slot) {
  const blocked = forcedBlock(state, playerKey);
  if (blocked) return blocked;
  delete state.players[playerKey].defendingSlots[slot];
  pushFx(state, { type: 'cancelDefend', owner: playerKey, slot });
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
  p.attackAssignments[slot] = { targetOwner: targetOwnerKey, targetSlot, dmg: card.dmg, pierce: card.ability === 'onattack_pierce', splash: card.ability === 'red_onattack_splash1', lifesteal: cardHasChip(card, 'chip_lifeblood'), sourceName: card.name };
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
      if (!p.board[slot]) queuedCandidates.push({ ownerKey: attackerKey, targetOwner: assign.targetOwner, targetSlot: assign.targetSlot, dmg: assign.dmg, pierce: assign.pierce, sourceName: assign.sourceName });
    });
  });

  const blockedSlots = {}; // ownerKey -> Set of slots that actually blocked an attack this round
  state.order.forEach(k => { blockedSlots[k] = new Set(); });

  const damageMap = []; // { targetOwner, targetSlot, amount, source }
  const lifestealHits = []; // attackers whose main hit landed and should heal themselves after
  state.order.forEach(attackerKey => {
    const p = state.players[attackerKey];
    Object.entries(p.attackAssignments).forEach(([slotStr, assign]) => {
      const slot = Number(slotStr);
      const attacker = p.board[slot];
      if (!attacker) return; // already dead before resolution -> handled as queued attack below
      const defenderP = state.players[assign.targetOwner];
      const targetSlot = assign.targetSlot;
      if (!defenderP.board[targetSlot]) return;
      const source = { kind: 'attack', name: assign.sourceName, owner: attackerKey, slot };
      if (defenderP.defendingSlots[targetSlot] && !assign.pierce) {
        blockedSlots[assign.targetOwner].add(targetSlot); // invincible - attack is blocked entirely
        pushFx(state, { type: 'block', owner: assign.targetOwner, slot: targetSlot, source });
        return;
      }
      damageMap.push({ targetOwner: assign.targetOwner, targetSlot, amount: assign.dmg, source });
      if (assign.lifesteal) lifestealHits.push({ ownerKey: attackerKey, slot });

      // Cannoneer-style splash: also hits a second random enemy card for 1,
      // if another one exists, independent of whether the primary hit was
      // blocked (splash bypasses the primary target's own shield).
      if (assign.splash) {
        const others = defenderP.board.map((c, i) => (c && i !== targetSlot ? i : -1)).filter(i => i >= 0);
        if (others.length > 0) {
          const pick = others[Math.floor(state._rng.next() * others.length)];
          damageMap.push({ targetOwner: assign.targetOwner, targetSlot: pick, amount: 1, source: { kind: 'ability-onplay', name: assign.sourceName + ' (splash)', owner: attackerKey, slot } });
        }
      }
    });
  });

  damageMap.forEach(d => damageCard(state, d.targetOwner, d.targetSlot, d.amount, d.source));

  // Lifeblood chip: heal the attacker 1hp for each successful hit, applied
  // after all damage so it can't offset its own attack's outcome mid-batch.
  lifestealHits.forEach(h => {
    const card = state.players[h.ownerKey].board[h.slot];
    if (card && card.hp > 0) {
      healCard(card, 1);
      pushFx(state, { type: 'heal', targetOwner: h.ownerKey, targetSlot: h.slot, amount: 1, source: { kind: 'ability-onplay', name: 'Lifeblood Chip', owner: h.ownerKey, slot: h.slot } });
    }
  });

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

// A hard backstop so no match can run forever. Lowered from 300 -> 60: 300
// was never actually reachable in a real interactive session (hours of
// round-trips) and was masking the real problem, which was the merge-
// economy bug fixed above making matches trend toward never emptying a
// deck/board naturally. Past this cap the player with the stronger overall
// position (board HP, cards left, unused spells/chips) wins outright, with
// a further tie counted as a draw.
const MAX_ROUNDS = 60;
function tiebreakScore(playerState) {
  const boardHp = playerState.board.reduce((sum, c) => sum + (c ? c.hp : 0), 0);
  const cardsLeft = boardCount(playerState) + playerState.deck.length;
  return boardHp + cardsLeft * 2 + playerState.spells.length + playerState.chips.length;
}

function checkWinAndAdvance(state) {
  const dead = {};
  state.order.forEach(k => {
    const p = state.players[k];
    const totalLeft = boardCount(p) + p.deck.length;
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
  } else if (state.round >= MAX_ROUNDS) {
    const score1 = tiebreakScore(state.players[k1]);
    const score2 = tiebreakScore(state.players[k2]);
    state.phase = 'gameover';
    state.winner = score1 === score2 ? 'draw' : (score1 > score2 ? k1 : k2);
    pushLog(state, `Round cap reached -> stronger position decides: ${state.winner}`);
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
    const source = { kind: 'queued-attack', name: q.sourceName, owner: q.ownerKey };
    if (defenderP.defendingSlots[q.targetSlot] && !q.pierce) {
      pushFx(state, { type: 'block', owner: q.targetOwner, slot: q.targetSlot, source });
      pushLog(state, `Queued attack from fallen ${q.ownerKey} card is blocked`);
      return;
    }
    pushLog(state, `Queued attack from fallen ${q.ownerKey} card resolves for ${q.dmg}`);
    damageCard(state, q.targetOwner, q.targetSlot, q.dmg, source);
  });
  // v3.0: no draw step - every remaining deck card has been visible and
  // placeable/mergeable since round 1 already.
}

// v3.0: forcing a merge only makes sense if a legal, blueprint-backed merge
// actually exists - see canPerformAnyMerge's doc comment above.
function isForced(state, playerKey) {
  const p = state.players[playerKey];
  const blueSlots = p.board.filter(c => c && c.tier === 1).length;
  return blueSlots >= BLUE_FORCE_CAP && canPerformAnyMerge(state, playerKey);
}

function boardFull(playerState) { return boardCount(playerState) >= BOARD_SIZE; }

// Single entry point used by local UI, the bot, and the network layer so
// every action flows through one deterministic dispatcher.
function applyAction(state, action) {
  state._fx = [];
  let result;
  switch (action.type) {
    case 'place': result = placeCard(state, action.player, action.handIndex, action.slot); break;
    case 'merge': result = mergeCards(state, action.player, action.slotA, action.slotB, action.blueprintIndex); break;
    case 'spell': result = castSpell(state, action.player, action.spellId, action.targetOwner, action.targetSlot); break;
    case 'chip': result = attachChip(state, action.player, action.chipId, action.targetOwner, action.targetSlot); break;
    case 'defend': result = setDefend(state, action.player, action.slot); break;
    case 'cancelDefend': result = cancelDefend(state, action.player, action.slot); break;
    case 'attack': result = setAttack(state, action.player, action.slot, action.targetOwner, action.targetSlot); break;
    case 'readyPlacement': result = readyPlacement(state, action.player); break;
    case 'readyAttack': result = readyAttack(state, action.player); break;
    default: result = { ok: false, error: 'unknown action ' + action.type };
  }
  result.fx = state._fx;
  return result;
}
