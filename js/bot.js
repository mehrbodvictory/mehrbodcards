
// Difficulty affects: how good target selection is, whether it merges
// proactively, and whether it uses spells/chips/defense intelligently.
// Master sits above Expert: it merges more eagerly, heals sooner, coordinates
// focus fire, bypasses defending shields, and casts tactical attack-phase spells.
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];

function emptySlots(board) {
  return board.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
}
function filledSlots(board) {
  return board.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
}

function runBotPlacement(state, botKey, difficulty, rng) {
  const p = state.players[botKey];
  const level = DIFFICULTIES.indexOf(difficulty);

  // 1. Place cards from the deck into empty slots, resolving forced
  // Blue-merges as soon as they come up.
  while (emptySlots(p.board).length > 0 && !isForced(state, botKey)) {
    const blueDeckIdx = p.deck.findIndex(c => c.tier === 1);
    if (blueDeckIdx === -1) break; // nothing placeable left in deck
    const slot = level >= 2 ? bestEmptySlot(p.board) : rng.pick(emptySlots(p.board));
    placeCard(state, botKey, blueDeckIdx, slot);
    if (isForced(state, botKey)) autoResolveForcedMerges(state, botKey);
  }
  autoResolveForcedMerges(state, botKey); // safety net

  // 2. Merge proactively using blueprints up to MAX_MERGES_PER_ROUND.
  let botMergesThisCycle = 0;
  while (botMergesThisCycle < MAX_MERGES_PER_ROUND) {
    let merged = tryBlueprintMerge(state, botKey);
    if (!merged) {
      if (level >= 2) {
        merged = tryStrategicMerge(state, botKey, rng, level);
      } else if (level === 1 && rng.next() < 0.3) {
        merged = tryStrategicMerge(state, botKey, rng, level);
      }
    }
    if (!merged) break;
    botMergesThisCycle++;
  }

  // 3. Attach chips on Medium+ to high-tier units with available SP slots.
  if (level >= 1 && p.chips.length > 0) {
    attachSmartChips(state, botKey);
  }

  // 4. Assign defense on Expert+ (protect valuable low-HP cards that can actually defend).
  if (level >= 3) {
    assignSmartDefense(state, botKey, rng, level);
  }

  autoResolveForcedMerges(state, botKey); // final safety net before readying up
  readyPlacement(state, botKey);
}

function bestEmptySlot(board) {
  const slots = emptySlots(board);
  return slots[0];
}

function tryBlueprintMerge(state, botKey) {
  const p = state.players[botKey];
  const blueprintTiers = new Set(p.deck.filter(c => c.tier !== 1).map(c => c.tier));
  if (blueprintTiers.size === 0) return false;
  const filled = filledSlots(p.board).filter(i => p.board[i].tier !== 4);
  for (let size = 4; size >= 2; size--) {
    const combos = kCombinations(filled, size);
    for (const combo of combos) {
      const sum = combo.reduce((s, i) => s + p.board[i].tier, 0);
      if (sum > 4 || !blueprintTiers.has(sum)) continue;
      const res = mergeCards(state, botKey, combo);
      return !!(res && res.ok);
    }
  }
  return false;
}

function tryStrategicMerge(state, botKey, rng, level) {
  const p = state.players[botKey];
  const filled = filledSlots(p.board).filter(i => p.board[i].tier !== 4);
  if (filled.length < 2) return false;
  const boardCrowded = emptySlots(p.board).length <= 1;
  const shouldMerge = boardCrowded
    || (level === 4 && rng.next() < 0.75)
    || (level === 3 && rng.next() < 0.45);
  if (!shouldMerge) return false;

  const sizesToTry = level >= 3 ? [4, 3, 2] : [2, 3, 4];
  for (const size of sizesToTry) {
    if (filled.length < size) continue;
    const combos = kCombinations(filled, size);
    for (const combo of combos) {
      const sum = combo.reduce((s, i) => s + p.board[i].tier, 0);
      if (sum >= 2 && sum <= 4 && p.deck.some(c => c.tier === sum)) {
        const res = mergeCards(state, botKey, combo);
        return !!(res && res.ok);
      }
    }
  }
  return false;
}

function attachSmartChips(state, botKey) {
  const p = state.players[botKey];
  while (p.chips.length > 0) {
    const chip = p.chips[0];
    const myFilled = filledSlots(p.board).filter(s => hasFreeChipSlot(p.board[s]));
    if (myFilled.length === 0) break;
    // Prefer highest tier unit for chip enhancement
    const target = myFilled.sort((a, b) => p.board[b].tier - p.board[a].tier)[0];
    const res = attachChip(state, botKey, chip.id, botKey, target);
    if (!res || !res.ok) break;
  }
}

function hasFreeChipSlot(card) {
  const used = card.chipsAttached ? card.chipsAttached.length : 0;
  return used < card.sp;
}

function assignSmartDefense(state, botKey, rng, level) {
  const p = state.players[botKey];
  const filled = filledSlots(p.board);
  const hpThreshold = level === 4 ? 3 : 2;
  const fragile = filled.filter(s => {
    const card = p.board[s];
    const tierInfo = TIERS[card.tier];
    if (tierInfo.defends <= 0) return false;
    if (card.hp > hpThreshold) return false;
    if (card.tier === 1 && !p.everMergedUp) return false;
    if (card.tier === 1 && !hasRemainingBlueprints(p)) return false;
    const bonus = card.bonusDefendCharge || 0;
    const chargesLeft = tierInfo.defends === Infinity ? Infinity : (tierInfo.defends + bonus) - card.defendChargesUsed;
    return chargesLeft > 0;
  });
  fragile.forEach(slot => setDefend(state, botKey, slot));
}

// ----------------------------------------------------------------------------
// Attack Phase AI: Tactical Spell Casting, Shield Avoidance & Focus Fire
// ----------------------------------------------------------------------------
function runBotAttack(state, botKey, difficulty, rng) {
  const p = state.players[botKey];
  const enemyKey = state.order.find(k => k !== botKey);
  const enemy = state.players[enemyKey];
  const level = DIFFICULTIES.indexOf(difficulty);

  // 1. Cast attack-phase spells intelligently (finishers, threat removals, heals, revives)
  if (level >= 1) {
    executeSmartAttackSpells(state, botKey, enemyKey, rng, level);
  }

  // 2. Assign attacks with focus fire, avoiding invulnerable/defending shields
  const attackers = filledSlots(p.board).filter(s => !p.defendingSlots[s]);
  const enemyFilled = filledSlots(enemy.board);

  if (enemyFilled.length === 0 || attackers.length === 0) {
    readyAttack(state, botKey);
    return;
  }

  // Identify undefended enemy slots vs defending shields
  const undefendedSlots = enemyFilled.filter(s => !enemy.defendingSlots[s]);
  // Fallback to all slots if enemy has defended all cards
  const candidateTargets = undefendedSlots.length > 0 ? undefendedSlots : enemyFilled;

  // Track simulated damage across attack assignments to coordinate lethal focus fire
  const pendingDamageOnTarget = {};
  enemyFilled.forEach(s => { pendingDamageOnTarget[s] = 0; });

  attackers.forEach(slot => {
    const attackerCard = p.board[slot];
    if (!attackerCard) return;
    const atkDmg = attackerCard.dmg || 1;
    let targetSlot;

    if (level === 0) {
      targetSlot = rng.pick(enemyFilled);
    } else if (level === 1) {
      // Medium: Prefer undefended lowest-hp target
      targetSlot = rng.next() < 0.7
        ? candidateTargets.slice().sort((a, b) => enemy.board[a].hp - enemy.board[b].hp)[0]
        : rng.pick(candidateTargets);
    } else if (level <= 3) {
      // Hard/Expert: Focus fire on undefended targets, prioritize finishing kills, else highest threat
      // Look for a target where current attacker finishes off remaining HP
      const killable = candidateTargets.filter(s => {
        const remainingHp = enemy.board[s].hp - (pendingDamageOnTarget[s] || 0);
        return remainingHp > 0 && remainingHp <= atkDmg;
      });

      if (killable.length > 0) {
        // Kill highest tier first
        targetSlot = killable.sort((a, b) => enemy.board[b].tier - enemy.board[a].tier)[0];
      } else {
        // Pick undefended target with highest damage threat (Red/Orange glass cannons)
        const unkilled = candidateTargets.filter(s => (enemy.board[s].hp - (pendingDamageOnTarget[s] || 0)) > 0);
        const pool = unkilled.length > 0 ? unkilled : candidateTargets;
        targetSlot = pool.slice().sort((a, b) => {
          const threatA = enemy.board[a].dmg * 2 + enemy.board[a].tier;
          const threatB = enemy.board[b].dmg * 2 + enemy.board[b].tier;
          return threatB - threatA;
        })[0];
      }
    } else {
      // Master: Optimal lethal math & coordinated focus fire
      // Check for clean kills
      const killable = candidateTargets.filter(s => {
        const remainingHp = enemy.board[s].hp - (pendingDamageOnTarget[s] || 0);
        return remainingHp > 0 && remainingHp <= atkDmg;
      });

      if (killable.length > 0) {
        targetSlot = killable.sort((a, b) => (enemy.board[b].tier * 2 + enemy.board[b].dmg) - (enemy.board[a].tier * 2 + enemy.board[a].dmg))[0];
      } else {
        // Focus fire the highest-threat undefended card to bring down high-HP units together
        const unkilled = candidateTargets.filter(s => (enemy.board[s].hp - (pendingDamageOnTarget[s] || 0)) > 0);
        const pool = unkilled.length > 0 ? unkilled : candidateTargets;
        targetSlot = pool.slice().sort((a, b) => {
          // Weight damage threat, tier, and remaining HP for optimal tactical trade
          const scoreA = enemy.board[a].dmg * 3 + enemy.board[a].tier * 2 - enemy.board[a].hp * 0.5;
          const scoreB = enemy.board[b].dmg * 3 + enemy.board[b].tier * 2 - enemy.board[b].hp * 0.5;
          return scoreB - scoreA;
        })[0];
      }
    }

    if (targetSlot !== undefined) {
      pendingDamageOnTarget[targetSlot] = (pendingDamageOnTarget[targetSlot] || 0) + atkDmg;
      setAttack(state, botKey, slot, enemyKey, targetSlot);
    }
  });

  readyAttack(state, botKey);
}

function executeSmartAttackSpells(state, botKey, enemyKey, rng, level) {
  const p = state.players[botKey];
  const enemy = state.players[enemyKey];
  const enemyFilled = filledSlots(enemy.board);

  for (const spell of p.spells.slice()) {
    // 1. Damage spells: execute undefended or killable enemies
    if (spell.dmg && enemyFilled.length > 0) {
      // Prefer killable high-tier target
      const killTargets = enemyFilled.filter(s => enemy.board[s].hp <= spell.dmg && !enemy.defendingSlots[s]);
      if (killTargets.length > 0 && (level >= 2 || rng.next() < 0.6)) {
        const bestTarget = killTargets.sort((a, b) => enemy.board[b].tier - enemy.board[a].tier)[0];
        const res = castSpell(state, botKey, spell.id, enemyKey, bestTarget);
        if (res && res.ok) return;
      }
      // If Hard/Master and enemy has a huge threat (Tier 3/4), soften them up with damage spell
      if (level >= 3) {
        const bigThreats = enemyFilled.filter(s => enemy.board[s].tier >= 3 && !enemy.defendingSlots[s]);
        if (bigThreats.length > 0) {
          const res = castSpell(state, botKey, spell.id, enemyKey, bigThreats[0]);
          if (res && res.ok) return;
        }
      }
    }

    // 2. Heal spells: restore heavily damaged ally (<=50% HP)
    if (spell.heal) {
      const myFilled = filledSlots(p.board);
      const hurtAllies = myFilled
        .filter(s => p.board[s].hp <= p.board[s].maxHp * 0.5)
        .sort((a, b) => (p.board[a].hp / p.board[a].maxHp) - (p.board[b].hp / p.board[b].maxHp));
      if (hurtAllies.length > 0) {
        const res = castSpell(state, botKey, spell.id, botKey, hurtAllies[0]);
        if (res && res.ok) return;
      }
    }

    // 3. Revive spell: revive dead high-tier card into empty slot
    const isRevive = !!(spell.reviveSpell || spell.defId === 'revivespell');
    if (isRevive && p.graveyard && p.graveyard.length > 0) {
      const empty = emptySlots(p.board);
      if (empty.length > 0) {
        const res = castSpell(state, botKey, spell.id, botKey, empty[0]);
        if (res && res.ok) return;
      }
    }
  }
}
