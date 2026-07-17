
// Difficulty affects: how good target selection is, whether it merges
// proactively, and whether it uses spells/chips/defense intelligently.
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'];

function emptySlots(board) {
  return board.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
}
function filledSlots(board) {
  return board.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
}

function runBotPlacement(state, botKey, difficulty, rng) {
  const p = state.players[botKey];
  const enemyKey = state.order.find(k => k !== botKey);
  const enemy = state.players[enemyKey];
  const level = DIFFICULTIES.indexOf(difficulty);

  // 1. Place cards from hand into empty slots, resolving forced Blue-merges
  // as soon as they come up (the bot has no UI to show a "must merge"
  // banner, so it just clears the condition immediately and keeps going).
  while (p.hand.length > 0 && emptySlots(p.board).length > 0 && !isForced(state, botKey)) {
    const slot = level >= 2 ? bestEmptySlot(p.board) : rng.pick(emptySlots(p.board));
    placeCard(state, botKey, 0, slot);
    if (isForced(state, botKey)) autoResolveForcedMerges(state, botKey);
  }
  autoResolveForcedMerges(state, botKey); // safety net

  // 2. Occasionally merge proactively on Hard/Expert to build stronger cards.
  if (level >= 2) {
    tryStrategicMerge(state, botKey, rng, level);
  } else if (level === 1 && rng.next() < 0.3) {
    tryStrategicMerge(state, botKey, rng, level);
  }

  // 3. Cast spells/attach chips on Medium+ if a good kill/heal is available.
  if (level >= 1) {
    maybeUseSpellsAndChips(state, botKey, enemyKey, rng, level);
  }

  // 4. Assign defense on Expert (protect the strongest low-hp card).
  if (level === 3) {
    assignSmartDefense(state, botKey, rng);
  }

  autoResolveForcedMerges(state, botKey); // final safety net before readying up
  readyPlacement(state, botKey);
}

function bestEmptySlot(board) {
  const slots = emptySlots(board);
  return slots[0];
}

function tryStrategicMerge(state, botKey, rng, level) {
  const p = state.players[botKey];
  const filled = filledSlots(p.board);
  if (filled.length < 2) return;
  const boardCrowded = emptySlots(p.board).length <= 1;
  const shouldMerge = boardCrowded || (level === 3 && rng.next() < 0.4);
  if (!shouldMerge) return;
  // Find any legal pair (neither Orange, tier sum lands on a real tier),
  // preferring the lowest-tier pair available.
  const sorted = filled.slice().sort((a, b) => p.board[a].tier - p.board[b].tier);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const ca = p.board[sorted[i]], cb = p.board[sorted[j]];
      if (ca.tier !== 4 && cb.tier !== 4 && ca.tier + cb.tier <= 4) {
        mergeCards(state, botKey, sorted[i], sorted[j]);
        return;
      }
    }
  }
}

function maybeUseSpellsAndChips(state, botKey, enemyKey, rng, level) {
  const p = state.players[botKey];
  const enemy = state.players[enemyKey];
  // Use a damage spell to secure a kill if possible.
  const enemyFilled = filledSlots(enemy.board);
  for (const spell of p.spells.slice()) {
    if (spell.dmg) {
      const killTarget = enemyFilled.find(slot => enemy.board[slot].hp <= spell.dmg);
      if (killTarget !== undefined && (level >= 2 || rng.next() < 0.5)) {
        castSpell(state, botKey, spell.id, enemyKey, killTarget);
        return; // one action per cycle keeps bot readable & fair
      }
    }
  }
  // Heal the most damaged ally if it's in danger (Expert only, to save resources).
  if (level === 3) {
    const myFilled = filledSlots(p.board);
    const hurt = myFilled.filter(s => p.board[s].hp < p.board[s].maxHp)
      .sort((a, b) => (p.board[a].hp / p.board[a].maxHp) - (p.board[b].hp / p.board[b].maxHp))[0];
    if (hurt !== undefined) {
      const healSpell = p.spells.find(s => s.heal);
      if (healSpell && p.board[hurt].hp <= p.board[hurt].maxHp * 0.4) {
        castSpell(state, botKey, healSpell.id, botKey, hurt);
        return;
      }
    }
  }
  // Attach a chip to the strongest card with a free slot.
  if (p.chips.length > 0) {
    const myFilled = filledSlots(p.board).filter(s => hasFreeChipSlot(p.board[s]));
    if (myFilled.length > 0) {
      const target = myFilled.sort((a, b) => p.board[b].tier - p.board[a].tier)[0];
      attachChip(state, botKey, p.chips[0].id, botKey, target);
    }
  }
}

function hasFreeChipSlot(card) {
  const used = card.chipsAttached ? card.chipsAttached.length : 0;
  return used < card.sp;
}

function assignSmartDefense(state, botKey, rng) {
  const p = state.players[botKey];
  const filled = filledSlots(p.board);
  // A card at risk of dying next round blocks its own damage instead of
  // attacking, if it still has a defend charge available (orange can't).
  const fragile = filled.filter(s => p.board[s].tier !== 4 && p.board[s].hp <= 2);
  fragile.forEach(slot => setDefend(state, botKey, slot));
}

function runBotAttack(state, botKey, difficulty, rng) {
  const p = state.players[botKey];
  const enemyKey = state.order.find(k => k !== botKey);
  const enemy = state.players[enemyKey];
  const level = DIFFICULTIES.indexOf(difficulty);
  const attackers = filledSlots(p.board).filter(s => !p.defendingSlots[s]);
  const enemyFilled = filledSlots(enemy.board);

  attackers.forEach(slot => {
    if (enemyFilled.length === 0) return;
    let targetSlot;
    if (level === 0) {
      targetSlot = rng.pick(enemyFilled);
    } else if (level === 1) {
      // Prefer lowest-hp target, otherwise random.
      targetSlot = rng.next() < 0.6
        ? enemyFilled.slice().sort((a, b) => enemy.board[a].hp - enemy.board[b].hp)[0]
        : rng.pick(enemyFilled);
    } else {
      // Hard/Expert: prioritize a guaranteed kill, else weakest, else highest threat (dmg).
      const attackerDmg = p.board[slot].dmg;
      const killable = enemyFilled.filter(s => enemy.board[s].hp <= attackerDmg && !enemy.defendingSlots[s]);
      if (killable.length > 0) {
        targetSlot = killable.sort((a, b) => enemy.board[b].tier - enemy.board[a].tier)[0];
      } else {
        targetSlot = enemyFilled.slice().sort((a, b) => (enemy.board[b].dmg - enemy.board[a].dmg) || (enemy.board[a].hp - enemy.board[b].hp))[0];
      }
    }
    setAttack(state, botKey, slot, enemyKey, targetSlot);
  });
  readyAttack(state, botKey);
}
