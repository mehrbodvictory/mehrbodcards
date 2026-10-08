
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

  // 0. BOSS DEPLOYMENT: Always deploy Boss Card immediately into slot 0 if sitting in deck!
  const bossDeckIdx = p.deck.findIndex(c => c && (c.isBossCard || c.tier === 5));
  if (bossDeckIdx !== -1) {
    const empty = emptySlots(p.board);
    if (empty.length > 0) {
      const targetSlot = empty.includes(0) ? 0 : empty[0];
      placeCard(state, botKey, bossDeckIdx, targetSlot);
    }
  }

  // 1. Place cards from the deck into empty slots, resolving forced
  // Blue-merges as soon as they come up.
  let placementAttempts = 0;
  while (emptySlots(p.board).length > 0 && !isForced(state, botKey) && placementAttempts < 15) {
    placementAttempts++;
    const blueDeckIdx = p.deck.findIndex(c => c.tier === 1);
    if (blueDeckIdx === -1) break; // nothing placeable left in deck
    const slot = level >= 2 ? bestEmptySlot(p.board) : rng.pick(emptySlots(p.board));
    const res = placeCard(state, botKey, blueDeckIdx, slot);
    if (!res || !res.ok) {
      break; // prevent infinite loop if placeCard fails (e.g. invalid slot, etc.)
    }
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

  // 4.5. Cast placement-phase spells intelligently (buffs, heals, revives)
  if (level >= 1) {
    executeSmartSpells(state, botKey, 'placement', rng, level);
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
  // Audit Fix: Exclude Tier 4 (max) AND Tier 5 (Boss card / isBossCard) from merge pools!
  const filled = filledSlots(p.board).filter(i => p.board[i].tier !== 4 && p.board[i].tier !== 5 && !p.board[i].isBossCard);
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
  // Audit Fix: Exclude Tier 4 (max) AND Tier 5 (Boss card / isBossCard) from strategic fusions!
  const filled = filledSlots(p.board).filter(i => p.board[i].tier !== 4 && p.board[i].tier !== 5 && !p.board[i].isBossCard);
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
    // Prefer Boss card (tier 5) or highest tier unit for chip enhancement
    const target = myFilled.sort((a, b) => {
      const isBossA = p.board[a].isBossCard || p.board[a].tier === 5 ? 100 : p.board[a].tier;
      const isBossB = p.board[b].isBossCard || p.board[b].tier === 5 ? 100 : p.board[b].tier;
      return isBossB - isBossA;
    })[0];
    const res = attachChip(state, botKey, chip.id, botKey, target);
    if (!res || !res.ok) break;
  }
}

function hasFreeChipSlot(card) {
  // Audit Fix: Cards affected by Skeleton Staff cannot use chips! Respect cannotUseChips.
  if (!card || card.cannotUseChips) return false;
  const used = card.chipsAttached ? card.chipsAttached.length : 0;
  return used < (card.sp !== undefined ? card.sp : (TIERS[card.tier]?.sp || 0));
}

function assignSmartDefense(state, botKey, rng, level) {
  const p = state.players[botKey];
  const filled = filledSlots(p.board);
  const hpThreshold = level === 4 ? 3 : 2;
  const fragile = filled.filter(s => {
    const card = p.board[s];
    // Audit Fix: Stunned/disabled cards under All Aura or cards with cannotDefend/sanctioned cannot defend!
    if (card.disabledTurns > 0 || card.cannotDefend || card.sanctioned) return false;
    const tierInfo = TIERS[card.tier];
    if (tierInfo.defends <= 0) return false;
    // Audit Fix: Tier 5/Boss cards have massive HP but limited defend charges (2) they should protect strategically, so exempt them from the low-HP fragile threshold!
    if (card.hp > hpThreshold && card.tier !== 5 && !card.isBossCard) return false;
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

  // 1. Cast attack-phase spells intelligently
  if (level >= 1) {
    executeSmartSpells(state, botKey, 'attack', rng, level);
  }

  // 2. Assign attacks with focus fire, avoiding invulnerable/defending shields
  // Audit Fix: Stunned/disabled cards under All Aura cannot attack! Filter out cards with disabledTurns.
  const attackers = filledSlots(p.board).filter(s => !p.defendingSlots[s] && (!p.board[s].disabledTurns || p.board[s].disabledTurns <= 0));
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

function executeSmartSpells(state, botKey, phase, rng, level) {
  const p = state.players[botKey];
  const enemyKey = state.order.find(k => k !== botKey);
  const enemy = state.players[enemyKey];
  if (!p || !enemy) return;

  const myFilled = filledSlots(p.board);
  const enemyFilled = filledSlots(enemy.board);

  let spellsCastThisTurn = 0;

  for (const spell of p.spells.slice()) {
    if (spellsCastThisTurn >= 2) break;

    const defId = spell.defId || spell.id;

    // 1. Revive Spell (either phase)
    const isRevive = !!(spell.reviveSpell || defId === 'revivespell');
    if (isRevive && p.graveyard && p.graveyard.length > 0) {
      const empty = emptySlots(p.board);
      if (empty.length > 0) {
        const targetSlot = empty.includes(0) ? 0 : empty[0];
        const res = castSpell(state, botKey, spell.id, botKey, targetSlot);
        if (res && res.ok) {
          spellsCastThisTurn++;
          continue;
        }
      }
    }

    // 2. Buffs/Self Spells (Prefer Placement Phase)
    if (defId === 'warcry' || spell.buffAllDmg) {
      if (phase === 'placement' && myFilled.length >= 2) {
        const targetSlot = myFilled[0];
        const res = castSpell(state, botKey, spell.id, botKey, targetSlot);
        if (res && res.ok) {
          spellsCastThisTurn++;
          continue;
        }
      }
    }

    if (defId === 'supremeshirt' || spell.supremeShirt) {
      if (phase === 'placement' && myFilled.length > 0) {
        const bestAlly = myFilled.sort((a, b) => p.board[b].tier - p.board[a].tier)[0];
        const res = castSpell(state, botKey, spell.id, botKey, bestAlly);
        if (res && res.ok) {
          spellsCastThisTurn++;
          continue;
        }
      }
    }

    if (defId === 'adrenaline' || (spell.dmg === 1 && spell.buffDmg === 3)) {
      if (phase === 'placement' && myFilled.length > 0) {
        const healthyAllies = myFilled.filter(s => p.board[s].hp >= 3);
        if (healthyAllies.length > 0) {
          const bestAlly = healthyAllies.sort((a, b) => p.board[b].tier - p.board[a].tier)[0];
          const res = castSpell(state, botKey, spell.id, botKey, bestAlly);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    if (defId === 'purge' || spell.refreshDefense) {
      if (myFilled.length > 0) {
        const depletedAllies = myFilled.filter(s => p.board[s].defendChargesUsed > 0);
        if (depletedAllies.length > 0) {
          const bestAlly = depletedAllies.sort((a, b) => p.board[b].tier - p.board[a].tier)[0];
          const res = castSpell(state, botKey, spell.id, botKey, bestAlly);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    // 3. Healing Spells (either phase)
    if (spell.heal || defId === 'mend3' || defId === 'orange') {
      if (myFilled.length > 0) {
        if (defId === 'orange' || spell.orange) {
          const heavilyHurt = myFilled.filter(s => p.board[s].hp <= p.board[s].maxHp - 3);
          if (heavilyHurt.length > 0) {
            const bestAlly = heavilyHurt.sort((a, b) => p.board[b].tier - p.board[a].tier)[0];
            const res = castSpell(state, botKey, spell.id, botKey, bestAlly);
            if (res && res.ok) {
              spellsCastThisTurn++;
              continue;
            }
          }
        } else {
          const hurtAllies = myFilled.filter(s => p.board[s].hp <= p.board[s].maxHp - 2);
          if (hurtAllies.length > 0) {
            const bestAlly = hurtAllies.sort((a, b) => p.board[a].hp - p.board[b].hp)[0];
            const res = castSpell(state, botKey, spell.id, botKey, bestAlly);
            if (res && res.ok) {
              spellsCastThisTurn++;
              continue;
            }
          }
        }
      }
    }

    if (spell.healAll || defId === 'massmend') {
      if (myFilled.length > 0) {
        const hurtCount = myFilled.filter(s => p.board[s].hp < p.board[s].maxHp).length;
        if (hurtCount >= 2 || (hurtCount >= 1 && phase === 'attack')) {
          const res = castSpell(state, botKey, spell.id, botKey, myFilled[0]);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    // 4. Debuff / Control Spells on Enemy (Prefer Attack Phase)
    if (defId === 'skeletonstaff' || spell.skeletonStaff) {
      if (phase === 'attack' && enemyFilled.length > 0) {
        const bigThreats = enemyFilled.filter(s => enemy.board[s].tier >= 3 || enemy.board[s].dmg >= 4);
        if (bigThreats.length > 0) {
          const target = bigThreats.sort((a, b) => enemy.board[b].dmg - enemy.board[a].dmg)[0];
          const res = castSpell(state, botKey, spell.id, enemyKey, target);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    if (defId === 'sanctioned' || spell.sanctioned) {
      if (phase === 'attack' && enemyFilled.length > 0) {
        const highTier = enemyFilled.filter(s => enemy.board[s].tier >= 2 && !enemy.board[s].cannotDefend);
        if (highTier.length > 0) {
          const target = highTier.sort((a, b) => enemy.board[b].tier - enemy.board[a].tier)[0];
          const res = castSpell(state, botKey, spell.id, enemyKey, target);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    if (defId === 'allaura' || spell.allAura) {
      if (phase === 'attack' && enemyFilled.length > 0) {
        const activeThreats = enemyFilled.filter(s => !enemy.board[s].disabledTurns || enemy.board[s].disabledTurns <= 0);
        if (activeThreats.length > 0) {
          const target = activeThreats.sort((a, b) => enemy.board[b].dmg - enemy.board[a].dmg)[0];
          const res = castSpell(state, botKey, spell.id, enemyKey, target);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    if (spell.weakenDmg || defId === 'weaken') {
      if (phase === 'attack' && enemyFilled.length > 0) {
        const highDmg = enemyFilled.filter(s => enemy.board[s].dmg >= 3);
        if (highDmg.length > 0) {
          const target = highDmg.sort((a, b) => enemy.board[b].dmg - enemy.board[a].dmg)[0];
          const res = castSpell(state, botKey, spell.id, enemyKey, target);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    // 5. Damage Spells (Prefer Attack Phase)
    if (spell.dmg || defId === 'bolt3' || defId === 'bolt5' || defId === 'zap' || defId === 'rocketboom' || defId === 'hack') {
      if (phase === 'attack' && enemyFilled.length > 0) {
        if (defId === 'rocketboom' || spell.rocketBoom) {
          const healthyHighTier = enemyFilled.filter(s => enemy.board[s].hp >= 4);
          if (healthyHighTier.length > 0) {
            const target = healthyHighTier.sort((a, b) => enemy.board[b].tier - enemy.board[a].tier)[0];
            const res = castSpell(state, botKey, spell.id, enemyKey, target);
            if (res && res.ok) {
              spellsCastThisTurn++;
              continue;
            }
          }
        } else {
          const val = spell.dmg || (defId === 'zap' ? 5 : defId === 'hack' ? 2 : 3);
          const killable = enemyFilled.filter(s => enemy.board[s].hp <= val);
          if (killable.length > 0) {
            const target = killable.sort((a, b) => enemy.board[b].tier - enemy.board[a].tier)[0];
            const res = castSpell(state, botKey, spell.id, enemyKey, target);
            if (res && res.ok) {
              spellsCastThisTurn++;
              continue;
            }
          } else {
            const bigThreats = enemyFilled.filter(s => enemy.board[s].tier >= 2);
            if (bigThreats.length > 0) {
              const target = bigThreats.sort((a, b) => enemy.board[b].dmg - enemy.board[a].dmg)[0];
              const res = castSpell(state, botKey, spell.id, enemyKey, target);
              if (res && res.ok) {
                spellsCastThisTurn++;
                continue;
              }
            }
          }
        }
      }
    }

    // 6. Sacrifice Spells (Remains Mask)
    if (defId === 'remainsmask' || spell.remainsMask) {
      if (myFilled.length > 0 && p.spells.length <= 2) {
        const redAllies = myFilled.filter(s => p.board[s].tier === 3);
        if (redAllies.length > 0) {
          const res = castSpell(state, botKey, spell.id, botKey, redAllies[0]);
          if (res && res.ok) {
            spellsCastThisTurn++;
            continue;
          }
        }
      }
    }

    // 7. Specials (Chain Lightning, Sudden Death)
    if (defId === 'chainlightning' || defId === 'suddendeath') {
      if (phase === 'attack' && enemyFilled.length >= 2) {
        const res = castSpell(state, botKey, spell.id, enemyKey, enemyFilled[0]);
        if (res && res.ok) {
          spellsCastThisTurn++;
          continue;
        }
      }
    }
  }
}
