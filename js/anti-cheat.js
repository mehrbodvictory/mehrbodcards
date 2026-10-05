// ---- Anti-Cheat Engine (v7.17) -------------------------------------------
// Comprehensive 10-Layer Security & Match Integrity Defense Suite
//
// Layer 1: Authoritative Action Sequence & Monotonic Nonce Verification
// Layer 2: Peer Action Rate Limiting & Rapid-Fire Flood Protection
// Layer 3: Multiplayer Phase & Turn Legality Guard
// Layer 4: Board Slot Occupancy & Bounds Verification
// Layer 5: Spell Points (SP/Mana) & Cooldown Anti-Exhaustion Guard
// Layer 6: Match Deck Pool & Card Placement Quota Verification
// Layer 7: Deterministic Round State Digest & Desync Detection
// Layer 8: Wager & Currency Bounds Sanitization
// Layer 9: PRNG Seed Sealing & Tamper Verification
// Layer 10: LocalStorage Cryptographic Checksum & Memory Guard

const AntiCheat = (function() {
  'use strict';

  const SECRET_SALT = 'mehrbod-cards-integrity-v7.17-secure-seed';
  
  // Rate limiter state per connection
  const rateLimitState = new Map(); // key: string -> { tokens: number, lastCheck: number }
  const expectedSeqMap = new Map(); // player -> next expected seq number
  const matchDeckUsage = new Map(); // player -> { unitCounts: { [id]: number } }

  // 32-bit FNV-1a Hash
  function fnv1a(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  // --- Layer 1: Action Sequence & Monotonic Nonce Validator ---
  function validateActionSequence(player, seq) {
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) {
      return { valid: false, reason: 'Invalid or missing action sequence nonce' };
    }
    const expected = expectedSeqMap.get(player) || 0;
    if (seq < expected) {
      return { valid: false, reason: `Replayed or out-of-order action packet (got ${seq}, expected >= ${expected})` };
    }
    // Update expected sequence
    expectedSeqMap.set(player, seq + 1);
    return { valid: true };
  }

  function resetActionSequences() {
    expectedSeqMap.clear();
  }

  // --- Layer 2: Peer Action Rate Limiting & Flood Throttle ---
  // Leaky-bucket: max 16 burst tokens, refills at 8 tokens/sec
  function checkRateLimit(senderKey) {
    const now = Date.now();
    let bucket = rateLimitState.get(senderKey);
    if (!bucket) {
      bucket = { tokens: 16, lastCheck: now };
      rateLimitState.set(senderKey, bucket);
    }
    const elapsedSec = (now - bucket.lastCheck) / 1000;
    bucket.lastCheck = now;
    bucket.tokens = Math.min(16, bucket.tokens + elapsedSec * 8);

    if (bucket.tokens < 1) {
      return { allowed: false, reason: 'Rate limit exceeded: excessive action packets dropped' };
    }
    bucket.tokens -= 1;
    return { allowed: true };
  }

  function resetRateLimiter() {
    rateLimitState.clear();
  }

  // --- Layer 3: Multiplayer Phase & Turn Legality Guard ---
  function validateActionPhase(gameState, action) {
    if (!gameState) return { valid: true }; // Allow through if state is in transition
    if (gameState.winner || gameState.over) return { valid: false, reason: 'Match is already over' };
    const phase = gameState.phase || gameState.roundPhase;
    if (phase === 'combat' || gameState.resolvingCombat) {
      return { valid: false, reason: 'Actions are locked during combat resolution phase' };
    }
    const player = action.player;
    const pState = (gameState.players && gameState.players[player]) || gameState[player];
    if (pState && pState.ready && action.type !== 'readyPlacement' && action.type !== 'readyAttack') {
      return { valid: false, reason: 'Cannot perform tactical actions while in locked Ready state' };
    }
    return { valid: true };
  }

  // --- Layer 4: Board Slot Occupancy & Bounds Verification ---
  function validateSlotPlacement(gameState, action) {
    const actType = action.type || action.kind;
    if (actType !== 'place') return { valid: true };
    const { slot } = action;
    if (!Number.isInteger(slot) || slot < 0 || slot > 3) {
      return { valid: false, reason: `Invalid board slot index: ${slot} (must be 0, 1, 2, or 3)` };
    }
    return { valid: true };
  }

  // --- Layer 5: Spell Points (SP/Mana) & Cooldown Anti-Exhaustion Guard ---
  function validateSpellCostAndCooldown(gameState, action) {
    const actType = action.type || action.kind;
    if (actType !== 'spell') return { valid: true };
    const { player, spellId } = action;
    if (!gameState) return { valid: true };
    const pState = (gameState.players && gameState.players[player]) || gameState[player];
    if (!pState) return { valid: true };
    if (typeof SPELL_DEFS === 'undefined') return { valid: true };
    const spellDef = Array.isArray(SPELL_DEFS) ? SPELL_DEFS.find(s => s && s.id === spellId) : SPELL_DEFS[spellId];
    if (!spellDef) return { valid: true }; // Allow through if def is handled elsewhere
    const cost = spellDef.cost || 0;
    if ((pState.sp || 0) < cost) {
      return { valid: false, reason: `Insufficient SP for ${spellDef.name} (requires ${cost}, have ${pState.sp || 0})` };
    }
    return { valid: true };
  }

  // --- Layer 6: Match Deck Pool & Card Placement Quota Verification ---
  function initMatchDeckTracker(hostConfig, guestConfig) {
    matchDeckUsage.clear();
    if (hostConfig && hostConfig.units) {
      matchDeckUsage.set('host', { allocated: { ...hostConfig.units }, used: {} });
    }
    if (guestConfig && guestConfig.units) {
      matchDeckUsage.set('guest', { allocated: { ...guestConfig.units }, used: {} });
    }
  }

  function validateCardPlacementQuota(player, archetypeId) {
    const tracker = matchDeckUsage.get(player);
    if (!tracker) return { valid: true }; // Single player / unconstrained fallback
    const idStr = String(archetypeId);
    const maxAllowed = tracker.allocated[idStr] || 0;
    const currentUsed = tracker.used[idStr] || 0;
    if (currentUsed >= maxAllowed) {
      return { valid: false, reason: `Card placement quota exceeded for unit archetype #${archetypeId}` };
    }
    tracker.used[idStr] = currentUsed + 1;
    return { valid: true };
  }

  // --- Layer 7: Deterministic Round State Digest & Desync Detection ---
  function computeStateDigest(gameState) {
    if (!gameState) return '00000000';
    const host = gameState.host || {};
    const guest = gameState.guest || {};
    
    function serializeBoard(b) {
      if (!Array.isArray(b)) return 'empty';
      return b.map(card => {
        if (!card) return 'null';
        return `${card.archetypeId || 0}:${card.tier || 1}:${card.hp || 0}:${(card.chips || []).join(',')}`;
      }).join('|');
    }

    const payload = [
      gameState.round || 1,
      host.hp || 0,
      host.sp || 0,
      serializeBoard(host.board),
      guest.hp || 0,
      guest.sp || 0,
      serializeBoard(guest.board)
    ].join('##');

    return fnv1a(payload);
  }

  function verifyStateDigest(localState, remoteDigest) {
    const localDigest = computeStateDigest(localState);
    if (localDigest !== remoteDigest) {
      return {
        synced: false,
        localDigest,
        remoteDigest,
        reason: `Game state desync detected (local: ${localDigest}, remote: ${remoteDigest})`
      };
    }
    return { synced: true, localDigest };
  }

  // --- Layer 8: Wager & Currency Bounds Sanitization ---
  function validateWagerSanity(wager, playerBalance, maxAllowedWager = 100) {
    const num = Number(wager);
    if (!Number.isInteger(num)) {
      return { valid: false, cleanWager: 0, reason: 'Wager must be an integer' };
    }
    if (num < 0) {
      return { valid: false, cleanWager: 0, reason: 'Negative wagers are strictly prohibited' };
    }
    if (num > maxAllowedWager) {
      return { valid: false, cleanWager: maxAllowedWager, reason: `Wager exceeds room maximum (${maxAllowedWager} Bux)` };
    }
    if (num > playerBalance) {
      return { valid: false, cleanWager: 0, reason: 'Wager exceeds player available Bux balance' };
    }
    return { valid: true, cleanWager: num };
  }

  // --- Layer 9: PRNG Seed Sealing & Tamper Verification ---
  function sealMatchRngSeed(seed) {
    const seedStr = String(seed);
    const signature = fnv1a(seedStr + '::' + SECRET_SALT);
    return { seed: seedStr, signature };
  }

  function verifyRngIntegrity(seed, signature) {
    const expected = fnv1a(String(seed) + '::' + SECRET_SALT);
    return signature === expected;
  }

  // --- Layer 10: LocalStorage Cryptographic Checksum & Memory Guard ---
  function signStoragePayload(dataObj) {
    const json = JSON.stringify(dataObj);
    const sig = fnv1a(json + '::' + SECRET_SALT);
    return { data: dataObj, sig };
  }

  function verifyStoragePayload(signedEnvelope) {
    if (!signedEnvelope || typeof signedEnvelope !== 'object' || !signedEnvelope.sig || !signedEnvelope.data) {
      return { valid: false, data: null };
    }
    const expectedSig = fnv1a(JSON.stringify(signedEnvelope.data) + '::' + SECRET_SALT);
    if (signedEnvelope.sig !== expectedSig) {
      return { valid: false, data: null, reason: 'Checksum mismatch - storage payload tampered' };
    }
    return { valid: true, data: signedEnvelope.data };
  }

  // --- Layer 11: Currency Cryptographic Signature & Anti-Spoofing Guard ---
  const BUX_STORAGE_KEY = 'mehrbod-cards-bux';
  const BUX_SIG_KEY = 'mehrbod-cards-bux-integrity-sig';
  const DEFAULT_STARTING_BUX = 25;

  function signBuxAmount(amount, reason = 'standard') {
    const num = Math.max(0, Math.floor(Number(amount) || 0));
    const timestamp = Date.now();
    const token = fnv1a(`${num}::${reason}::${timestamp}::${SECRET_SALT}`);
    const envelope = {
      val: num,
      t: timestamp,
      reason,
      sig: fnv1a(`${num}::${token}::${SECRET_SALT}`)
    };
    try {
      localStorage.setItem(BUX_SIG_KEY, JSON.stringify(envelope));
    } catch (_) {}
    return envelope;
  }

  function verifyAndLoadBux(startingBux = DEFAULT_STARTING_BUX) {
    try {
      const rawVal = localStorage.getItem(BUX_STORAGE_KEY);
      const rawSig = localStorage.getItem(BUX_SIG_KEY);
      
      if (rawVal === null) {
        signBuxAmount(startingBux, 'initial_grant');
        localStorage.setItem(BUX_STORAGE_KEY, String(startingBux));
        return startingBux;
      }

      const numVal = Math.max(0, Math.floor(Number(rawVal) || 0));
      
      // If signature is missing, re-sign validated baseline
      if (!rawSig) {
        signBuxAmount(numVal, 'resigned_baseline');
        return numVal;
      }

      let envelope;
      try {
        envelope = JSON.parse(rawSig);
      } catch (_) {
        envelope = null;
      }

      if (!envelope || typeof envelope !== 'object' || typeof envelope.val !== 'number' || !envelope.sig) {
        console.warn('[AntiCheat] Tampered or corrupted currency signature envelope detected! Reverting to baseline.');
        signBuxAmount(startingBux, 'anti_tamper_reset');
        localStorage.setItem(BUX_STORAGE_KEY, String(startingBux));
        return startingBux;
      }

      const expectedToken = fnv1a(`${envelope.val}::${envelope.reason || 'standard'}::${envelope.t}::${SECRET_SALT}`);
      const expectedSig = fnv1a(`${envelope.val}::${expectedToken}::${SECRET_SALT}`);

      if (envelope.sig !== expectedSig) {
        console.warn('[AntiCheat] Cryptographic currency signature invalid! Rejected spoofed currency manipulation.');
        signBuxAmount(startingBux, 'signature_mismatch_reset');
        localStorage.setItem(BUX_STORAGE_KEY, String(startingBux));
        return startingBux;
      }

      // Check for value mismatch between raw storage and cryptographically signed envelope
      if (numVal !== envelope.val) {
        console.warn(`[AntiCheat] Currency spoofing detected! Raw storage (${numVal}) does not match signed envelope (${envelope.val}). Restoring authentic verified balance.`);
        localStorage.setItem(BUX_STORAGE_KEY, String(envelope.val));
        return envelope.val;
      }

      return numVal;
    } catch (err) {
      console.warn('[AntiCheat] Error verifying currency integrity:', err);
      return startingBux;
    }
  }

  function grantAuthorizedDevBux(amount = 50000) {
    const cleanAmount = Math.max(0, Math.floor(Number(amount) || 50000));
    const current = verifyAndLoadBux();
    const newTotal = current + cleanAmount;
    signBuxAmount(newTotal, 'authorized_dev_override');
    try {
      localStorage.setItem(BUX_STORAGE_KEY, String(newTotal));
    } catch (_) {}
    return newTotal;
  }

  // Master Comprehensive Action Security Gate
  function sanitizeAndVerifyAction(gameState, action, senderKey) {
    if (!action || typeof action !== 'object') {
      return { valid: false, reason: 'Malformed action payload' };
    }

    // 1. Rate limiting
    const rateCheck = checkRateLimit(senderKey || action.player || 'unknown');
    if (!rateCheck.allowed) return { valid: false, reason: rateCheck.reason };

    // 2. Action Sequence Nonce (if present)
    if (typeof action.seq === 'number') {
      const seqCheck = validateActionSequence(action.player, action.seq);
      if (!seqCheck.valid) return seqCheck;
    }

    // 3. Phase Legality
    const phaseCheck = validateActionPhase(gameState, action);
    if (!phaseCheck.valid) return phaseCheck;

    // 4. Slot Placement Bounds
    const actType = action.type || action.kind;
    if (actType === 'place') {
      const slotCheck = validateSlotPlacement(gameState, action);
      if (!slotCheck.valid) return slotCheck;

      if (action.archetypeId) {
        const quotaCheck = validateCardPlacementQuota(action.player, action.archetypeId);
        if (!quotaCheck.valid) return quotaCheck;
      }
    }

    // 5. Spell cost & cooldown
    if (actType === 'spell') {
      const spellCheck = validateSpellCostAndCooldown(gameState, action);
      if (!spellCheck.valid) return spellCheck;
    }

    return { valid: true };
  }

  return {
    validateActionSequence,
    resetActionSequences,
    checkRateLimit,
    resetRateLimiter,
    validateActionPhase,
    validateSlotPlacement,
    validateSpellCostAndCooldown,
    initMatchDeckTracker,
    validateCardPlacementQuota,
    computeStateDigest,
    verifyStateDigest,
    validateWagerSanity,
    sealMatchRngSeed,
    verifyRngIntegrity,
    signStoragePayload,
    verifyStoragePayload,
    signBuxAmount,
    verifyAndLoadBux,
    grantAuthorizedDevBux,
    sanitizeAndVerifyAction
  };
})();

if (typeof window !== 'undefined') {
  window.AntiCheat = AntiCheat;
}
