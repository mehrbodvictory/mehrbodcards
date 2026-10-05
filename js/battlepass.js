// ---- Battle Pass Module (Season 1: Neon Oblivion) -------------------------
// Full 100-Tier Progression System with Free Drip-Feed & 5,000 Bux Premium Track

(function() {
  'use strict';

  const BATTLEPASS_PRICE = 2500;
  const BATTLEPASS_XP_PER_TIER = 500;
  const BATTLEPASS_MAX_TIER = 100;

  function generate100BattlePassTiers() {
    const baseTiers = [
      { tier: 1, free: { kind: 'bux', amount: 25, label: '25 Bux', icon: '💰' }, premium: { kind: 'theme', id: 'theme_chronos', name: 'Chronos Horizon', label: 'Theme: Chronos Horizon', icon: '⏳' } },
      { tier: 2, free: { kind: 'badge', id: 'badge_chronos_gear', name: 'Temporal Gear', label: 'Badge: Temporal Gear', icon: '⚙️' }, premium: { kind: 'card', tierNum: 4, name: 'Chronos Sentinel', archetypeId: 'orange_chronos_sentinel', label: 'Apex Unit: Chronos Sentinel', icon: '🃏' } },
      { tier: 3, free: { kind: 'title', title: 'Temporal Voyager', label: 'Title: Temporal Voyager', icon: '🏷️' }, premium: { kind: 'pack', packType: 'chronos', count: 1, name: 'Chronos Cache', label: '1x Chronos Temporal Cache', icon: '📦' } },
      { tier: 4, free: { kind: 'bux', amount: 25, label: '25 Bux', icon: '💰' }, premium: { kind: 'sleeve', id: 'sleeve_chronos', name: 'Chronos Temporal Weave', label: 'Sleeve: Chronos Weave', icon: '🎴' } },
      { tier: 5, free: { kind: 'pack', packType: 'booster', count: 1, name: 'Standard Booster', label: '1x Booster Pack', icon: '📦' }, premium: { kind: 'pack', packType: 'void', count: 1, name: 'Void Apex Vault', label: '1x Void Apex Vault', icon: '📦' } },
      { tier: 6, free: { kind: 'bux', amount: 25, label: '25 Bux', icon: '💰' }, premium: { kind: 'victoryAnim', id: 'victoryanim_chronos_blast', name: 'Temporal Time Stop', label: 'Finisher: Time Stop', icon: '💥' } },
      { tier: 7, free: { kind: 'badge', id: 'badge_cyber_reticle', name: 'Cyber Reticle', label: 'Badge: Cyber Reticle', icon: '🎯' }, premium: { kind: 'card', tierNum: 3, name: 'Hyperdrive Drake', archetypeId: 'red_hyperdrive_drake', label: 'Epic Unit: Hyperdrive Drake', icon: '🃏' } },
      { tier: 8, free: { kind: 'bux', amount: 25, label: '25 Bux', icon: '💰' }, premium: { kind: 'pack', packType: 'hyperdrive', count: 1, name: 'Cyber-Crate', label: '1x Cyber-Crate Pack', icon: '📦' } },
      { tier: 9, free: { kind: 'title', title: 'Cyber Pioneer', label: 'Title: Cyber Pioneer', icon: '🏷️' }, premium: { kind: 'sleeve', id: 'sleeve_hyperdrive', name: 'Neon Grid Holo', label: 'Sleeve: Neon Grid Holo', icon: '🎴' } },
      { tier: 10, free: { kind: 'bux', amount: 38, label: '38 Bux', icon: '💰' }, premium: { kind: 'theme', id: 'theme_neon_cyberpunk', name: 'Hyperdrive Cyber-Grid', label: 'Theme: Cyber-Grid', icon: '🌆' } },
      { tier: 11, free: { kind: 'pack', packType: 'foil', count: 1, name: 'Foil Booster', label: '1x Foil Booster', icon: '📦' }, premium: { kind: 'pack', packType: 'chronos', count: 1, name: 'Chronos Cache', label: '1x Chronos Cache', icon: '📦' } },
      { tier: 12, free: { kind: 'bux', amount: 38, label: '38 Bux', icon: '💰' }, premium: { kind: 'card', tierNum: 2, name: 'Aether Glider', archetypeId: 'green_aether_glider', label: 'Rare Unit: Aether Glider', icon: '🃏' } },
      { tier: 13, free: { kind: 'badge', id: 'badge_void_portal', name: 'Void Portal', label: 'Badge: Void Portal', icon: '🌀' }, premium: { kind: 'victoryAnim', id: 'victoryanim_hyperdrive_warp', name: 'Hyperdrive Warp', label: 'Finisher: Warp Speed', icon: '🚀' } },
      { tier: 14, free: { kind: 'bux', amount: 38, label: '38 Bux', icon: '💰' }, premium: { kind: 'pack', packType: 'void', count: 1, name: 'Void Vault', label: '1x Void Apex Vault', icon: '📦' } },
      { tier: 15, free: { kind: 'title', title: 'Void Wanderer', label: 'Title: Void Wanderer', icon: '🏷️' }, premium: { kind: 'sleeve', id: 'sleeve_singularity', name: 'Event Horizon Void', label: 'Sleeve: Event Horizon', icon: '🎴' } },
      { tier: 16, free: { kind: 'pack', packType: 'booster', count: 1, name: 'Standard Booster', label: '1x Booster Pack', icon: '📦' }, premium: { kind: 'card', tierNum: 3, name: 'Cyber Valkyrie', archetypeId: 'red_cyber_valkyrie', label: 'Epic Unit: Cyber Valkyrie', icon: '🃏' } },
      { tier: 17, free: { kind: 'bux', amount: 38, label: '38 Bux', icon: '💰' }, premium: { kind: 'pack', packType: 'hyperdrive', count: 1, name: 'Cyber-Crate', label: '1x Cyber-Crate Pack', icon: '📦' } },
      { tier: 18, free: { kind: 'title', title: 'Pass Veteran', label: 'Title: Pass Veteran', icon: '🏷️' }, premium: { kind: 'pack', packType: 'void', count: 1, name: 'Void Vault', label: '1x Void Apex Vault', icon: '📦' } },
      { tier: 19, free: { kind: 'pack', packType: 'foil', count: 1, name: 'Foil Booster', label: '1x Foil Booster', icon: '📦' }, premium: { kind: 'card', tierNum: 4, name: 'Singularity Devourer', archetypeId: 'orange_singularity_devourer', label: 'Apex Unit: Devourer', icon: '🃏' } },
      { tier: 20, free: { kind: 'title', title: 'Neon Oblivion Master', label: 'Title: Neon Master', icon: '🏆' }, premium: { kind: 'theme', id: 'theme_void_singularity', name: 'Void Singularity', label: 'Theme: Void Singularity', icon: '🌌' } }
    ];

    // Total Free Bux sum across all 100 tiers is capped at exactly 1,500 Bux max (slashed 50%)!
    const freeBuxTiersMap = {
      21: 40, 25: 50, 28: 40, 32: 50, 37: 40, 42: 50, 45: 60,
      50: 75, 54: 50, 58: 50, 60: 75, 64: 50, 68: 50, 72: 60,
      75: 75, 79: 50, 80: 100, 84: 50, 88: 50, 90: 85, 94: 50,
      98: 50, 100: 100
    };

    for (let i = 21; i <= 100; i++) {
      let freeReward, premiumReward;

      if (i === 25) {
        freeReward = { kind: 'bux', amount: 50, label: '50 Bux', icon: '💰' };
        premiumReward = { kind: 'theme', id: 'theme_quantum_overdrive', name: 'Quantum Horizon', label: 'Theme: Quantum Horizon', icon: '⚛️' };
      } else if (i === 28) {
        freeReward = { kind: 'badge', id: 'badge_quantum_core', name: 'Quantum Core', label: 'Badge: Quantum Core', icon: '⚛️' };
        premiumReward = { kind: 'card', tierNum: 4, name: 'Quantum Colossus', archetypeId: 'orange_quantum_behemoth', label: 'Apex Unit: Quantum Colossus', icon: '🃏' };
      } else if (i === 30) {
        freeReward = { kind: 'title', title: 'Quantum Explorer', label: 'Title: Quantum Explorer', icon: '🏷️' };
        premiumReward = { kind: 'sleeve', id: 'sleeve_quantum', name: 'Quantum Grid Sleeves', label: 'Sleeve: Quantum Grid', icon: '🎴' };
      } else if (i === 32) {
        freeReward = { kind: 'bux', amount: 50, label: '50 Bux', icon: '💰' };
        premiumReward = { kind: 'victoryAnim', id: 'victoryanim_quantum_collapse', name: 'Quantum Collapse', label: 'Finisher: Quantum Collapse', icon: '⚛️' };
      } else if (i === 35) {
        freeReward = { kind: 'pack', packType: 'foil', count: 1, name: 'Foil Booster', label: '1x Foil Booster', icon: '📦' };
        premiumReward = { kind: 'theme', id: 'theme_solar_prominence', name: 'Solar Corona', label: 'Theme: Solar Corona', icon: '☀️' };
      } else if (i === 40) {
        freeReward = { kind: 'title', title: 'Solar Voyager', label: 'Title: Solar Voyager', icon: '🏷️' };
        premiumReward = { kind: 'card', tierNum: 3, name: 'Solar Phoenix', archetypeId: 'red_solar_phoenix', label: 'Epic Unit: Solar Phoenix', icon: '🃏' };
      } else if (i === 45) {
        freeReward = { kind: 'bux', amount: 60, label: '60 Bux', icon: '💰' };
        premiumReward = { kind: 'sleeve', id: 'sleeve_solar', name: 'Solar Prominence Sleeves', label: 'Sleeve: Solar Prominence', icon: '🎴' };
      } else if (i === 48) {
        freeReward = { kind: 'badge', id: 'badge_solar_crown', name: 'Solar Crown', label: 'Badge: Solar Crown', icon: '☀️' };
        premiumReward = { kind: 'victoryAnim', id: 'victoryanim_solar_flare', name: 'Solar Flare Eruption', label: 'Finisher: Solar Flare', icon: '☀️' };
      } else if (i === 50) {
        freeReward = { kind: 'bux', amount: 75, label: '75 Bux', icon: '💰' };
        premiumReward = { kind: 'theme', id: 'theme_prism_mythic', name: 'Diamond Refractor', label: 'Theme: Diamond Refractor', icon: '💎' };
      } else if (i === 55) {
        freeReward = { kind: 'title', title: 'Titan Slayer', label: 'Title: Titan Slayer', icon: '🏷️' };
        premiumReward = { kind: 'card', tierNum: 2, name: 'Verdant Titan', archetypeId: 'green_verdant_titan', label: 'Rare Unit: Verdant Titan', icon: '🃏' };
      } else if (i === 60) {
        freeReward = { kind: 'bux', amount: 75, label: '75 Bux', icon: '💰' };
        premiumReward = { kind: 'sleeve', id: 'sleeve_nebula', name: 'Celestial Starfall Sleeves', label: 'Sleeve: Celestial Starfall', icon: '🎴' };
      } else if (i === 62) {
        freeReward = { kind: 'badge', id: 'badge_nebula_star', name: 'Nebula Star', label: 'Badge: Nebula Star', icon: '🌠' };
        premiumReward = { kind: 'victoryAnim', id: 'victoryanim_starlight_shockwave', name: 'Starlight Shockwave', label: 'Finisher: Starlight Shockwave', icon: '🌠' };
      } else if (i === 65) {
        freeReward = { kind: 'pack', packType: 'void', count: 1, name: 'Void Vault', label: '1x Void Vault', icon: '📦' };
        premiumReward = { kind: 'theme', id: 'theme_celestial_nebula', name: 'Celestial Nebula', label: 'Theme: Celestial Nebula', icon: '🌠' };
      } else if (i === 70) {
        freeReward = { kind: 'title', title: 'Nebula Conqueror', label: 'Title: Nebula Conqueror', icon: '🏷️' };
        premiumReward = { kind: 'card', tierNum: 3, name: 'Nebula Valkyrie', archetypeId: 'red_nebula_valkyrie', label: 'Epic Unit: Nebula Valkyrie', icon: '🃏' };
      } else if (i === 75) {
        freeReward = { kind: 'bux', amount: 75, label: '75 Bux', icon: '💰' };
        premiumReward = { kind: 'sleeve', id: 'sleeve_kraken', name: 'Bioluminescent Kraken Sleeves', label: 'Sleeve: Kraken Sleeves', icon: '🎴' };
      } else if (i === 78) {
        freeReward = { kind: 'badge', id: 'badge_kraken_eye', name: 'Kraken Eye', label: 'Badge: Kraken Eye', icon: '🦑' };
        premiumReward = { kind: 'victoryAnim', id: 'victoryanim_kraken_strike', name: 'Kraken Void Strike', label: 'Finisher: Kraken Void Strike', icon: '🦑' };
      } else if (i === 80) {
        freeReward = { kind: 'bux', amount: 100, label: '100 Bux', icon: '💰' };
        premiumReward = { kind: 'theme', id: 'theme_abyss_kraken', name: 'Bioluminescent Kraken Abyss', label: 'Theme: Kraken Abyss', icon: '🦑' };
      } else if (i === 85) {
        freeReward = { kind: 'title', title: 'Sovereign Champion', label: 'Title: Sovereign Champion', icon: '🏷️' };
        premiumReward = { kind: 'card', tierNum: 4, name: 'Apex Sovereign Sentinel', archetypeId: 'orange_apex_sovereign_unit', label: 'Apex Unit: Sovereign Sentinel', icon: '🃏' };
      } else if (i === 90) {
        freeReward = { kind: 'bux', amount: 85, label: '85 Bux', icon: '💰' };
        premiumReward = { kind: 'sleeve', id: 'sleeve_apex_gold', name: '24k Gold Sovereign Sleeves', label: 'Sleeve: 24k Gold Sovereign', icon: '🎴' };
      } else if (i === 95) {
        freeReward = { kind: 'badge', id: 'badge_sovereign_crest', name: 'Sovereign Crest', label: 'Badge: Sovereign Crest', icon: '👑' };
        premiumReward = { kind: 'victoryAnim', id: 'victoryanim_apex_beam', name: 'Apex Sovereign Laser Blast', label: 'Finisher: Apex Laser Blast', icon: '👑' };
      } else if (i === 100) {
        freeReward = { kind: 'bux', amount: 100, label: '100 Bux', icon: '💰' };
        premiumReward = { kind: 'theme', id: 'theme_apex_sovereign', name: 'Apex Sovereign Gold', label: 'Theme: Apex Sovereign Gold', icon: '👑' };
      } else if (freeBuxTiersMap[i]) {
        const amt = freeBuxTiersMap[i];
        freeReward = { kind: 'bux', amount: amt, label: `${amt} Bux`, icon: '💰' };
        premiumReward = { kind: 'pack', packType: 'chronos', count: 1, name: 'Chronos Cache', label: '1x Chronos Cache', icon: '📦' };
      } else if (i % 3 === 0) {
        freeReward = { kind: 'pack', packType: 'booster', count: 1, name: 'Booster Pack', label: '1x Booster Pack', icon: '📦' };
        premiumReward = { kind: 'pack', packType: 'hyperdrive', count: 1, name: 'Cyber-Crate', label: '1x Cyber-Crate Pack', icon: '📦' };
      } else {
        freeReward = { kind: 'pack', packType: 'booster', count: 1, name: 'Booster Pack', label: '1x Booster Pack', icon: '📦' };
        premiumReward = { kind: 'pack', packType: 'void', count: 1, name: 'Void Vault', label: '1x Void Apex Vault', icon: '📦' };
      }

      baseTiers.push({
        tier: i,
        free: freeReward,
        premium: premiumReward
      });
    }

    return baseTiers;
  }

  const BATTLEPASS_TIERS = generate100BattlePassTiers();

  // --- Persistence Accessors ---
  function isBattlePassUnlocked() {
    try {
      return localStorage.getItem('mehrbod-cards-bp-premium') === 'true';
    } catch (e) {
      return false;
    }
  }

  function getBattlePassXP() {
    try {
      return parseInt(localStorage.getItem('mehrbod-cards-bp-xp') || '0', 10);
    } catch (e) {
      return 0;
    }
  }

  function saveBattlePassXP(xp) {
    try {
      localStorage.setItem('mehrbod-cards-bp-xp', Math.max(0, xp).toString());
    } catch (e) {}
  }

  function getBattlePassLevel() {
    const xp = getBattlePassXP();
    return Math.min(BATTLEPASS_MAX_TIER, Math.floor(xp / BATTLEPASS_XP_PER_TIER) + 1);
  }

  function getClaimedMap() {
    try {
      return JSON.parse(localStorage.getItem('mehrbod-cards-bp-claimed') || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveClaimedMap(map) {
    try {
      localStorage.setItem('mehrbod-cards-bp-claimed', JSON.stringify(map));
    } catch (e) {}
  }

  function isRewardClaimed(tierNum, track) {
    const map = getClaimedMap();
    return !!map[`${tierNum}_${track}`];
  }

  function setRewardClaimed(tierNum, track) {
    const map = getClaimedMap();
    map[`${tierNum}_${track}`] = true;
    saveClaimedMap(map);
  }

  // --- XP Granting Hook ---
  function grantBattlePassXP(amount) {
    if (!amount || amount <= 0) return;
    const beforeLevel = getBattlePassLevel();
    const newXP = getBattlePassXP() + amount;
    saveBattlePassXP(newXP);
    const afterLevel = getBattlePassLevel();

    if (afterLevel > beforeLevel) {
      if (typeof showToast === 'function') {
        showToast(`⚡ Battle Pass Level Up! Reached Tier ${afterLevel}!`, 3500);
      }
      if (typeof Sound !== 'undefined' && Sound.sparkle) {
        Sound.sparkle();
      }
      triggerBattlePassLevelUpCelebration(afterLevel, beforeLevel);
    }
    updateBattlePassBadge();
  }

  // --- Award Distribution Helper ---
  function awardItem(item) {
    if (!item) return;

    if (item.kind === 'bux') {
      if (typeof addBux === 'function') addBux(item.amount);
      if (typeof showToast === 'function') showToast(`💰 Received +${item.amount} Mehrbod Bux!`, 2500);
    } else if (item.kind === 'theme' || item.kind === 'sleeve' || item.kind === 'victoryAnim') {
      if (typeof unlockCosmetic === 'function') unlockCosmetic(item.id);
      if (typeof showToast === 'function') showToast(`✨ Unlocked ${item.name}!`, 3000);
    } else if (item.kind === 'title') {
      try {
        const titles = JSON.parse(localStorage.getItem('mehrbod-cards-unlocked-titles') || '[]');
        if (!titles.includes(item.title)) {
          titles.push(item.title);
          localStorage.setItem('mehrbod-cards-unlocked-titles', JSON.stringify(titles));
        }
      } catch (e) {}
      if (typeof showToast === 'function') showToast(`🏷️ Unlocked Title: "${item.title}"!`, 3000);
    } else if (item.kind === 'badge') {
      try {
        const badges = JSON.parse(localStorage.getItem('mehrbod-cards-unlocked-badges') || '[]');
        if (!badges.includes(item.id)) {
          badges.push(item.id);
          localStorage.setItem('mehrbod-cards-unlocked-badges', JSON.stringify(badges));
        }
      } catch (e) {}
      if (typeof showToast === 'function') showToast(`⚙️ Unlocked Badge: ${item.name}!`, 3000);
    } else if (item.kind === 'card') {
      try {
        if (typeof loadCollection === 'function' && typeof saveCollection === 'function') {
          const col = loadCollection();
          if (!col.units.includes(item.archetypeId)) {
            col.units.push(item.archetypeId);
            saveCollection(col);
          }
        }
      } catch (e) {}
      if (typeof showToast === 'function') showToast(`🃏 Unlocked Card: ${item.name}!`, 3500);
    } else if (item.kind === 'pack') {
      if (typeof showToast === 'function') showToast(`📦 Received ${item.count}x ${item.name}!`, 3000);
    }
  }

  // --- Single Reward Claim ---
  function claimBattlePassReward(tierNum, track) {
    const tierData = BATTLEPASS_TIERS.find(t => t.tier === tierNum);
    if (!tierData) return;

    const currentLevel = getBattlePassLevel();
    if (tierNum > currentLevel) {
      if (typeof showToast === 'function') showToast(`🔒 Reach Tier ${tierNum} first to claim this reward!`, 2000);
      return;
    }

    if (track === 'premium' && !isBattlePassUnlocked()) {
      if (typeof showToast === 'function') showToast('⚡ Unlock Premium Pass (10,000 Bux) to claim Premium rewards!', 2500);
      return;
    }

    if (isRewardClaimed(tierNum, track)) {
      if (typeof showToast === 'function') showToast('✓ Reward already claimed!', 1500);
      return;
    }

    const item = track === 'free' ? tierData.free : tierData.premium;
    setRewardClaimed(tierNum, track);
    awardItem(item);

    if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
    renderBattlePassScreen();
    updateBattlePassBadge();
  }

  // --- Subtle Vibration Noise for Claiming ---
  function playSubtleVibrationNoise() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([40, 25, 50]);
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // Two quick subtle haptic buzzes
      [0, 0.08].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(54, now + offset);
        osc.frequency.exponentialRampToValueAtTime(30, now + offset + 0.07);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(90, now + offset);

        gain.gain.setValueAtTime(0.08, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.08);
      });

      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 350);
    } catch (e) {}
  }

  // --- Dev Unlock Battle Pass Helper ---
  function devUnlockBattlePass(claimAll = false) {
    try {
      localStorage.setItem('mehrbod-cards-bp-premium', 'true');
      saveBattlePassXP(BATTLEPASS_MAX_TIER * BATTLEPASS_XP_PER_TIER); // 50,000 XP

      if (claimAll) {
        const claimedMap = {};
        for (let i = 1; i <= BATTLEPASS_MAX_TIER; i++) {
          claimedMap[`${i}_free`] = true;
          claimedMap[`${i}_premium`] = true;
          const tierData = BATTLEPASS_TIERS.find(t => t.tier === i);
          if (tierData) {
            if (tierData.free) awardItem(tierData.free);
            if (tierData.premium) awardItem(tierData.premium);
          }
        }
        saveClaimedMap(claimedMap);
      } else {
        localStorage.removeItem('mehrbod-cards-bp-claimed');
      }

      renderBattlePassScreen();
      updateBattlePassBadge();
      return true;
    } catch (e) {
      console.error('devUnlockBattlePass error:', e);
      return false;
    }
  }

  // --- Claim All Eligible Rewards ---
  function claimAllBattlePassRewards() {
    const currentLevel = getBattlePassLevel();
    const premiumUnlocked = isBattlePassUnlocked();
    let claimedCount = 0;

    for (let i = 1; i <= currentLevel; i++) {
      const tierData = BATTLEPASS_TIERS.find(t => t.tier === i);
      if (!tierData) continue;

      if (!isRewardClaimed(i, 'free')) {
        setRewardClaimed(i, 'free');
        awardItem(tierData.free);
        claimedCount++;
      }

      if (premiumUnlocked && !isRewardClaimed(i, 'premium')) {
        setRewardClaimed(i, 'premium');
        awardItem(tierData.premium);
        claimedCount++;
      }
    }

    if (claimedCount > 0) {
      playSubtleVibrationNoise();
      if (typeof showToast === 'function') showToast(`Claimed ${claimedCount} Battle Pass rewards!`, 3500);
      renderBattlePassScreen();
      updateBattlePassBadge();
    } else {
      if (typeof showToast === 'function') showToast('No unclaimed rewards available right now!', 2000);
    }
  }

  // --- Purchase Premium Pass ---
  function purchasePremiumPass() {
    if (isBattlePassUnlocked()) {
      if (typeof showToast === 'function') showToast('⚡ You already own the Premium Battle Pass!', 2000);
      return;
    }

    const currentBux = typeof loadBux === 'function' ? loadBux() : 0;
    if (currentBux < BATTLEPASS_PRICE) {
      if (typeof showToast === 'function') {
        showToast(`Insufficient Bux! Premium Pass costs 2,500 Bux (You have ${currentBux.toLocaleString()} Bux).`, 3000);
      }
      return;
    }

    if (typeof addBux === 'function') addBux(-BATTLEPASS_PRICE);
    try {
      localStorage.setItem('mehrbod-cards-bp-premium', 'true');
    } catch (e) {}

    playSubtleVibrationNoise();
    if (typeof showToast === 'function') showToast('PREMIUM BATTLE PASS UNLOCKED! All Premium Track rewards now claimable!', 4000);

    renderBattlePassScreen();
    updateBattlePassBadge();
  }

  // --- Check Unclaimed Count ---
  function hasUnclaimedRewards() {
    const currentLevel = getBattlePassLevel();
    const premiumUnlocked = isBattlePassUnlocked();

    for (let i = 1; i <= currentLevel; i++) {
      if (!isRewardClaimed(i, 'free')) return true;
      if (premiumUnlocked && !isRewardClaimed(i, 'premium')) return true;
    }
    return false;
  }

  function updateBattlePassBadge() {
    const unclaimedBadge = document.getElementById('bp-claim-indicator');
    const claimAllBtns = document.querySelectorAll('#bp-claim-all, #btn-bp-claim-all, .bp-claim-all-btn');
    const hasUnclaimed = hasUnclaimedRewards();

    if (unclaimedBadge) {
      if (hasUnclaimed) {
        unclaimedBadge.classList.remove('hidden');
      } else {
        unclaimedBadge.classList.add('hidden');
      }
    }

    claimAllBtns.forEach(btn => {
      if (hasUnclaimed) {
        btn.classList.add('bp-claim-all-breathing');
      } else {
        btn.classList.remove('bp-claim-all-breathing');
      }
    });
  }

  // --- Render Battle Pass Screen ---
  function renderBattlePassScreen() {
    const overlay = document.getElementById('battlepass-overlay');
    if (!overlay) return;

    const currentLevel = getBattlePassLevel();
    const currentXP = getBattlePassXP();
    const premiumUnlocked = isBattlePassUnlocked();
    const xpIntoLevel = currentXP % BATTLEPASS_XP_PER_TIER;
    const progressPercent = Math.min(100, Math.round((xpIntoLevel / BATTLEPASS_XP_PER_TIER) * 100));

    // Update Header Text
    const levelVal = document.getElementById('bp-level-val');
    if (levelVal) levelVal.textContent = `TIER ${currentLevel} / 100`;

    const progressVal = document.getElementById('bp-xp-val');
    if (progressVal) {
      if (currentLevel >= BATTLEPASS_MAX_TIER) {
        progressVal.textContent = 'MAX PASS TIER 100 REACHED!';
      } else {
        progressVal.textContent = `${xpIntoLevel} / ${BATTLEPASS_XP_PER_TIER} XP to Tier ${currentLevel + 1}`;
      }
    }

    const progressBar = document.getElementById('bp-progress-bar-fill');
    if (progressBar) {
      progressBar.style.width = (currentLevel >= BATTLEPASS_MAX_TIER ? '100%' : `${progressPercent}%`);
    }

    const passStatusBadge = document.getElementById('bp-pass-status-badge');
    if (passStatusBadge) {
      if (premiumUnlocked) {
        passStatusBadge.textContent = 'PREMIUM PASS ACTIVE';
        passStatusBadge.className = 'bp-status-pill premium';
      } else {
        passStatusBadge.textContent = 'STANDARD PASS (FREE)';
        passStatusBadge.className = 'bp-status-pill standard';
      }
    }

    const buyBtn = document.getElementById('btn-bp-buy-premium');
    if (buyBtn) {
      if (premiumUnlocked) {
        buyBtn.textContent = '✓ PREMIUM UNLOCKED';
        buyBtn.disabled = true;
        buyBtn.classList.add('owned');
      } else {
        buyBtn.textContent = '⚡ UNLOCK PREMIUM (2,500 BUX)';
        buyBtn.disabled = false;
        buyBtn.classList.remove('owned');
      }
    }

    // Render Track Tiers Grid
    const trackGrid = document.getElementById('bp-track-grid');
    if (trackGrid) {
      trackGrid.innerHTML = '';
      const lastSeenTier = parseInt(localStorage.getItem('mehrbod-cards-bp-seen-tier') || '1', 10);
      const isNewTierReached = currentLevel > lastSeenTier;

      BATTLEPASS_TIERS.forEach((t) => {
        const isReached = currentLevel >= t.tier;
        const isNewlyReached = isNewTierReached && t.tier > lastSeenTier && isReached;
        const freeClaimed = isRewardClaimed(t.tier, 'free');
        const premiumClaimed = isRewardClaimed(t.tier, 'premium');
        const isThemeTier = (t.free && t.free.kind === 'theme') || (t.premium && t.premium.kind === 'theme');

        const isTier100 = t.tier === 100;
        const col = document.createElement('div');
        col.className = `bp-tier-col ${isReached ? 'reached' : 'locked'} ${isNewlyReached ? 'bp-tier-newly-reached' : ''} ${isThemeTier ? 'theme-tier' : ''} ${isTier100 ? 'bp-tier-100-apex' : ''}`;

        // Header
        let headerHtml = `
          <div class="bp-tier-header">
            <span class="bp-tier-num">TIER ${t.tier}</span>
            ${isNewlyReached ? '<div class="bp-tier-new-badge">✨ NEW UNLOCK!</div>' : ''}
            ${isThemeTier ? '<span class="bp-theme-unlock-badge">🎨 THEME UNLOCK</span>' : ''}
            ${isNewlyReached ? '<div class="bp-tier-burst-ring"></div>' : ''}
          </div>
        `;

        // Free Card
        let freeBtnStateHtml = '';
        if (freeClaimed) {
          freeBtnStateHtml = `<button type="button" class="bp-claim-btn claimed" disabled>✓ Claimed</button>`;
        } else if (isReached) {
          freeBtnStateHtml = `<button type="button" class="bp-claim-btn active-free" onclick="claimBattlePassReward(${t.tier}, 'free')">Claim</button>`;
        } else {
          freeBtnStateHtml = `<button type="button" class="bp-claim-btn locked" disabled>Tier ${t.tier}</button>`;
        }

        let freeCardHtml = `
          <div class="bp-reward-card free-card ${freeClaimed ? 'claimed' : ''}">
            <div class="bp-card-glare"></div>
            <div class="bp-card-tag">FREE</div>
            <div class="bp-reward-icon">${t.free.icon}</div>
            <div class="bp-reward-title">${t.free.label}</div>
            ${freeBtnStateHtml}
          </div>
        `;

        // Premium Card
        let premBtnStateHtml = '';
        if (premiumClaimed) {
          premBtnStateHtml = `<button type="button" class="bp-claim-btn claimed" disabled>✓ Claimed</button>`;
        } else if (!premiumUnlocked) {
          premBtnStateHtml = `<button type="button" class="bp-claim-btn prem-locked" onclick="purchasePremiumPass()">10k Bux</button>`;
        } else if (isReached) {
          premBtnStateHtml = `<button type="button" class="bp-claim-btn active-prem" onclick="claimBattlePassReward(${t.tier}, 'premium')">Claim</button>`;
        } else {
          premBtnStateHtml = `<button type="button" class="bp-claim-btn locked" disabled>Tier ${t.tier}</button>`;
        }

        let apexAuraHtml = '';
        if (isTier100) {
          apexAuraHtml = `
            <div class="apex-persistent-aura" aria-hidden="true">
              <div class="apex-aura-glow"></div>
              <div class="apex-aura-corona"></div>
              <div class="apex-aura-particles">
                <span class="apex-p p1">✦</span><span class="apex-p p2">⭐</span><span class="apex-p p3">✨</span>
                <span class="apex-p p4">👑</span><span class="apex-p p5">✦</span><span class="apex-p p6">💎</span>
                <span class="apex-p p7">⭐</span><span class="apex-p p8">✨</span>
                <span class="apex-p p9">🔥</span><span class="apex-p p10">👑</span><span class="apex-p p11">💎</span><span class="apex-p p12">✨</span>
              </div>
              <div class="apex-3d-stargate-container">
                <div class="stargate-ring ring-outer"></div>
                <div class="stargate-ring ring-middle"></div>
                <div class="stargate-ring ring-inner"></div>
                <div class="stargate-core-orb"></div>
              </div>
              <div class="apex-cascading-gold">
                <span class="gold-ember g1"></span><span class="gold-ember g2"></span><span class="gold-ember g3"></span><span class="gold-ember g4"></span>
                <span class="gold-ember g5"></span><span class="gold-ember g6"></span><span class="gold-ember g7"></span><span class="gold-ember g8"></span>
              </div>
            </div>
            <div class="apex-sovereign-explosion-3d" aria-hidden="true">
              <div class="apex-exp-ring r1"></div>
              <div class="apex-exp-ring r2"></div>
              <div class="apex-exp-ring r3"></div>
              <div class="apex-exp-shard-cluster">
                <span class="apex-shard s1"></span><span class="apex-shard s2"></span><span class="apex-shard s3"></span><span class="apex-shard s4"></span>
                <span class="apex-shard s5"></span><span class="apex-shard s6"></span><span class="apex-shard s7"></span><span class="apex-shard s8"></span>
                <span class="apex-shard s9"></span><span class="apex-shard s10"></span><span class="apex-shard s11"></span><span class="apex-shard s12"></span>
              </div>
            </div>
          `;
        }

        let premCardHtml = `
          <div class="bp-reward-card prem-card ${isTier100 ? 'bp-apex-tier100-card' : ''} ${premiumClaimed ? 'claimed' : ''} ${premiumUnlocked ? 'unlocked' : ''}">
            ${apexAuraHtml}
            <div class="bp-card-glare"></div>
            <div class="bp-card-tag prem">${isTier100 ? '👑 APEX' : 'PREMIUM'}</div>
            <div class="bp-reward-icon">${t.premium.icon}</div>
            <div class="bp-reward-title">${t.premium.label}</div>
            ${premBtnStateHtml}
          </div>
        `;

        col.innerHTML = headerHtml + freeCardHtml + premCardHtml;
        col.dataset.tier = t.tier;
        trackGrid.appendChild(col);
      });

      // Update seen tier after marking new ones
      try {
        localStorage.setItem('mehrbod-cards-bp-seen-tier', currentLevel.toString());
      } catch (e) {}

      // Subtle Staggered Entrance Animation via IntersectionObserver
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('bp-tier-in-view');
            }
          });
        }, {
          root: trackGrid,
          threshold: 0.15,
          rootMargin: '0px 60px 0px 60px'
        });

        trackGrid.querySelectorAll('.bp-tier-col').forEach((colEl, idx) => {
          colEl.style.setProperty('--col-stagger', `${(idx % 6) * 40}ms`);
          observer.observe(colEl);
        });
      } else {
        trackGrid.querySelectorAll('.bp-tier-col').forEach(colEl => {
          colEl.classList.add('bp-tier-in-view');
        });
      }

      // Attach 3D Mouse-Follow Parallax Handler & Dynamic Specular Glare
      setupBattlePassParallax(trackGrid);

      setTimeout(() => {
        const newReachedCol = trackGrid.querySelector('.bp-tier-col.bp-tier-newly-reached');
        const activeCol = newReachedCol || trackGrid.querySelector('.bp-tier-col.reached:last-of-type') || trackGrid.querySelector('.bp-tier-col');
        if (activeCol && typeof activeCol.scrollIntoView === 'function') {
          activeCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 100);
    }
    updateBattlePassBadge();
  }

  // --- Subtle Mouse-Follow 3D Parallax Controller for Battle Pass Tier Cards with Dynamic Specular Glare ---
  function setupBattlePassParallax(trackGrid) {
    if (!trackGrid) return;

    let activeCard = null;
    let activeCol = null;

    const onPointerMove = (e) => {
      const card = e.target.closest('.bp-reward-card');
      const col = e.target.closest('.bp-tier-col');

      if (!card && !col) {
        if (activeCard) resetCardParallax(activeCard);
        if (activeCol) resetColParallax(activeCol);
        activeCard = null;
        activeCol = null;
        return;
      }

      // Handle card mouse-follow parallax & dynamic specular highlight
      if (card) {
        if (activeCard && activeCard !== card) {
          resetCardParallax(activeCard);
        }
        activeCard = card;
        applyCardParallax(card, e.clientX, e.clientY);
      } else if (activeCard) {
        resetCardParallax(activeCard);
        activeCard = null;
      }

      // Handle column mouse-follow parallax
      if (col) {
        if (activeCol && activeCol !== col) {
          resetColParallax(activeCol);
        }
        activeCol = col;
        applyColParallax(col, e.clientX, e.clientY);
      } else if (activeCol) {
        resetColParallax(activeCol);
        activeCol = null;
      }
    };

    const onPointerLeave = () => {
      if (activeCard) resetCardParallax(activeCard);
      if (activeCol) resetColParallax(activeCol);
      activeCard = null;
      activeCol = null;
    };

    function applyCardParallax(card, clientX, clientY) {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalized coordinates (-1.0 to 1.0)
      const normX = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width / 2)));
      const normY = Math.max(-1, Math.min(1, (clientY - centerY) / (rect.height / 2)));

      const rotateX = (-normY * 14).toFixed(2);
      const rotateY = (normX * 16).toFixed(2);
      const shadowX = (-normX * 12).toFixed(2);
      const shadowY = (-normY * 12).toFixed(2);

      // Specular glare position (0% - 100%)
      const glareX = Math.max(0, Math.min(100, (((clientX - rect.left) / rect.width) * 100))).toFixed(1);
      const glareY = Math.max(0, Math.min(100, (((clientY - rect.top) / rect.height) * 100))).toFixed(1);

      // Card container 3D transform, shadow offset, and dynamic specular highlight
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(18px) scale(1.03)`;
      card.style.boxShadow = `${shadowX}px ${shadowY}px 28px rgba(0, 0, 0, 0.65), 0 0 20px rgba(245, 158, 11, 0.35)`;
      card.style.borderColor = 'rgba(245, 158, 11, 0.85)';
      card.style.setProperty('--glare-x', `${glareX}%`);
      card.style.setProperty('--glare-y', `${glareY}%`);
      card.style.setProperty('--glare-opacity', '1');

      // Sub-layer parallax elements
      const icon = card.querySelector('.bp-reward-icon');
      const tag = card.querySelector('.bp-card-tag');
      const title = card.querySelector('.bp-reward-title');
      const btn = card.querySelector('.bp-claim-btn');

      if (icon) {
        icon.style.transform = `translate3d(${(normX * 10).toFixed(1)}px, ${(normY * 10).toFixed(1)}px, 48px) scale(1.15)`;
      }
      if (tag) {
        tag.style.transform = `translate3d(${(-normX * 5).toFixed(1)}px, ${(-normY * 5).toFixed(1)}px, 28px)`;
      }
      if (title) {
        title.style.transform = `translate3d(${(normX * 5).toFixed(1)}px, ${(normY * 5).toFixed(1)}px, 22px)`;
      }
      if (btn) {
        btn.style.transform = `translate3d(${(normX * 3).toFixed(1)}px, ${(normY * 3).toFixed(1)}px, 16px)`;
      }
    }

    function resetCardParallax(card) {
      if (!card) return;
      card.style.transform = '';
      card.style.boxShadow = '';
      card.style.borderColor = '';
      card.style.setProperty('--glare-opacity', '0');

      const icon = card.querySelector('.bp-reward-icon');
      const tag = card.querySelector('.bp-card-tag');
      const title = card.querySelector('.bp-reward-title');
      const btn = card.querySelector('.bp-claim-btn');

      if (icon) icon.style.transform = '';
      if (tag) tag.style.transform = '';
      if (title) title.style.transform = '';
      if (btn) btn.style.transform = '';
    }

    function applyColParallax(col, clientX, clientY) {
      const rect = col.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const normX = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width / 2)));
      const normY = Math.max(-1, Math.min(1, (clientY - centerY) / (rect.height / 2)));

      const rotateX = (-normY * 6).toFixed(2);
      const rotateY = (normX * 8).toFixed(2);

      col.style.transform = `perspective(900px) translateY(0) scale(1.015) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      col.style.borderColor = 'rgba(245, 158, 11, 0.65)';
    }

    function resetColParallax(col) {
      if (!col) return;
      col.style.transform = '';
      col.style.borderColor = '';
    }

    // Clean up previous event listeners if re-rendering
    if (trackGrid._parallaxHandler) {
      trackGrid.removeEventListener('pointermove', trackGrid._parallaxHandler);
      trackGrid.removeEventListener('pointerleave', trackGrid._parallaxLeaveHandler);
    }

    trackGrid._parallaxHandler = onPointerMove;
    trackGrid._parallaxLeaveHandler = onPointerLeave;

    trackGrid.addEventListener('pointermove', onPointerMove, { passive: true });
    trackGrid.addEventListener('pointerleave', onPointerLeave, { passive: true });
  }

  // --- 4-Second Hold "Claim All" Handlers with Dark Cinematic Horror Stinger (E Minor) ---
  let holdStartTime = 0;
  let holdAnimFrame = null;
  let holdAudioCtx = null;
  let holdGain = null;
  let holdFilter = null;
  let holdDelay = null;
  let holdOscs = [];

  function startHoldAudio() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      holdAudioCtx = new AudioContext();
      const now = holdAudioCtx.currentTime;

      // Subtle low rumble vibration hum during hold
      holdGain = holdAudioCtx.createGain();
      holdGain.gain.setValueAtTime(0.01, now);
      holdGain.gain.linearRampToValueAtTime(0.04, now + 3.8);

      const rumbleOsc = holdAudioCtx.createOscillator();
      rumbleOsc.type = 'triangle';
      rumbleOsc.frequency.setValueAtTime(42, now);
      rumbleOsc.frequency.linearRampToValueAtTime(48, now + 4.0);

      const rumbleFilter = holdAudioCtx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(70, now);

      rumbleOsc.connect(rumbleFilter);
      rumbleFilter.connect(holdGain);
      holdGain.connect(holdAudioCtx.destination);

      rumbleOsc.start(now);
      holdOscs = [rumbleOsc];
    } catch (e) {}
  }

  function stopHoldAudio() {
    try {
      if (holdOscs.length) {
        holdOscs.forEach(o => { try { o.stop(); o.disconnect(); } catch (_) {} });
        holdOscs = [];
      }
      if (holdAudioCtx) {
        holdAudioCtx.close();
        holdAudioCtx = null;
      }
    } catch (e) {}
  }

  function startHoldClaimAll(e) {
    if (e) e.preventDefault();
    const fillBar = document.getElementById('bp-hold-fill-bar');
    const btnText = document.getElementById('bp-hold-btn-text');

    holdStartTime = Date.now();
    startHoldAudio();

    function updateFill() {
      const elapsed = Date.now() - holdStartTime;
      const progress = Math.min(100, (elapsed / 4000) * 100);

      if (fillBar) fillBar.style.width = `${progress}%`;
      if (btnText) {
        const remainingSec = Math.max(0, (4 - elapsed / 1000)).toFixed(1);
        btnText.textContent = `HOLD (${remainingSec}s)...`;
      }

      if (elapsed >= 4000) {
        stopHoldClaimAll();
        claimAllBattlePassRewards();
      } else {
        holdAnimFrame = requestAnimationFrame(updateFill);
      }
    }

    holdAnimFrame = requestAnimationFrame(updateFill);
  }

  function stopHoldClaimAll(e) {
    if (holdAnimFrame) {
      cancelAnimationFrame(holdAnimFrame);
      holdAnimFrame = null;
    }
    stopHoldAudio();

    const fillBar = document.getElementById('bp-hold-fill-bar');
    const btnText = document.getElementById('bp-hold-btn-text');
    if (fillBar) fillBar.style.width = '0%';
    if (btnText) btnText.textContent = 'CLAIM ALL';
  }

  // --- Attach Event Listeners ---
  document.addEventListener('click', (e) => {
    const bpBtn = e.target.closest('#btn-open-battlepass, .battlepass-glow-btn');
    if (bpBtn) {
      if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
      renderBattlePassScreen();
      const overlay = document.getElementById('battlepass-overlay');
      if (overlay) overlay.classList.remove('hidden');
    }
  });

  function initBattlePassModule() {
    const btnOpen = document.getElementById('btn-open-battlepass');
    const overlay = document.getElementById('battlepass-overlay');
    const btnClose = document.getElementById('btn-battlepass-close');
    const btnBuy = document.getElementById('btn-bp-buy-premium');
    const claimAllBtns = document.querySelectorAll('#bp-claim-all, #btn-bp-claim-all, .bp-claim-all-btn');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
        renderBattlePassScreen();
        if (overlay) overlay.classList.remove('hidden');
      });
    }

    if (btnClose && overlay) {
      btnClose.addEventListener('click', () => {
        if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
        overlay.classList.add('hidden');
      });
    }

    if (btnBuy) {
      btnBuy.addEventListener('click', () => {
        if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
        purchasePremiumPass();
      });
    }

    claimAllBtns.forEach(btn => {
      btn.addEventListener('mousedown', startHoldClaimAll);
      btn.addEventListener('touchstart', startHoldClaimAll, { passive: false });

      btn.addEventListener('mouseup', stopHoldClaimAll);
      btn.addEventListener('mouseleave', stopHoldClaimAll);
      btn.addEventListener('touchend', stopHoldClaimAll);
      btn.addEventListener('touchcancel', stopHoldClaimAll);
    });

    updateBattlePassBadge();
  }

  function closeBattlePassLevelUpCelebration() {
    const overlay = document.getElementById('bp-levelup-celebration-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  function triggerBattlePassLevelUpCelebration(newLevel, oldLevel) {
    let overlay = document.getElementById('bp-levelup-celebration-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bp-levelup-celebration-overlay';
      overlay.className = 'hidden';
      overlay.role = 'dialog';
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Battle Pass Level Up Celebration');
      overlay.innerHTML = `
        <div class="bp-celebration-backdrop"></div>
        <div class="bp-celebration-rays"></div>
        
        <div class="bp-celebration-card">
          <div class="bp-celebration-header">
            <div class="bp-celebration-kicker">⚡ SEASON 1 PROGRESSION ⚡</div>
            <h2 class="bp-celebration-title">LEVEL UP!</h2>
            <div class="bp-celebration-subtitle">BATTLE PASS TIER REACHED</div>
          </div>

          <div class="bp-celebration-badge-stage">
            <div class="bp-celebration-ring ring-outer"></div>
            <div class="bp-celebration-ring ring-inner"></div>
            <div class="bp-celebration-badge">
              <span class="bp-badge-crown">👑</span>
              <span class="bp-badge-tier-label">TIER</span>
              <span id="bp-celebration-tier-num" class="bp-badge-tier-num">1</span>
            </div>
            <div class="bp-celebration-particles" id="bp-celebration-particles"></div>
          </div>

          <div class="bp-celebration-rewards-box">
            <div class="bp-celebration-rewards-title">REWARDS UNLOCKED AT TIER <span id="bp-celebration-reward-tier">1</span></div>
            <div id="bp-celebration-rewards-list" class="bp-celebration-rewards-list"></div>
          </div>

          <button type="button" id="btn-bp-celebration-continue" class="primary-btn bp-celebration-continue-btn">
            CONTINUE ➔
          </button>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#btn-bp-celebration-continue')?.addEventListener('click', () => {
        closeBattlePassLevelUpCelebration();
      });
      overlay.addEventListener('click', (e) => {
        if (e.target.id === 'bp-levelup-celebration-overlay' || e.target.classList.contains('bp-celebration-backdrop')) {
          closeBattlePassLevelUpCelebration();
        }
      });
    }

    const numEl = overlay.querySelector('#bp-celebration-tier-num');
    if (numEl) numEl.textContent = newLevel;

    const rewardTierEl = overlay.querySelector('#bp-celebration-reward-tier');
    if (rewardTierEl) rewardTierEl.textContent = newLevel;

    const listEl = overlay.querySelector('#bp-celebration-rewards-list');
    if (listEl) {
      listEl.innerHTML = '';
      const tierData = BATTLEPASS_TIERS.find(t => t.tier === newLevel);
      if (tierData) {
        if (tierData.free) {
          const freeCard = document.createElement('div');
          freeCard.className = 'bp-celebration-reward-card free';
          freeCard.innerHTML = `
            <span class="bp-celebration-reward-icon">${tierData.free.icon || '🎁'}</span>
            <span class="bp-celebration-reward-name">${tierData.free.name || tierData.free.label}</span>
            <span class="bp-celebration-reward-tag">FREE TRACK</span>
          `;
          listEl.appendChild(freeCard);
        }
        if (tierData.premium) {
          const premCard = document.createElement('div');
          premCard.className = 'bp-celebration-reward-card premium';
          premCard.innerHTML = `
            <span class="bp-celebration-reward-icon">${tierData.premium.icon || '👑'}</span>
            <span class="bp-celebration-reward-name">${tierData.premium.name || tierData.premium.label}</span>
            <span class="bp-celebration-reward-tag">PREMIUM PASS</span>
          `;
          listEl.appendChild(premCard);
        }
      }
    }

    // Spawn Particle Shards Explosion
    const particlesContainer = overlay.querySelector('#bp-celebration-particles');
    if (particlesContainer) {
      particlesContainer.innerHTML = '';
      const colors = ['#f59e0b', '#38bdf8', '#a855f7', '#f43f5e', '#22c55e', '#fef08a'];
      for (let i = 0; i < 32; i++) {
        const shard = document.createElement('div');
        shard.className = 'bp-particle-shard';
        const angle = (i / 32) * Math.PI * 2 + (Math.random() * 0.2);
        const distance = 80 + Math.random() * 110;
        const px = Math.cos(angle) * distance;
        const py = Math.sin(angle) * distance;
        const color = colors[i % colors.length];

        shard.style.setProperty('--px', `${px}px`);
        shard.style.setProperty('--py', `${py}px`);
        shard.style.backgroundColor = color;
        shard.style.boxShadow = `0 0 10px ${color}`;
        shard.style.animationDelay = `${Math.random() * 0.12}s`;
        particlesContainer.appendChild(shard);
      }
    }

    // Audio & Vibration
    try {
      if (typeof playSubtleVibrationNoise === 'function') playSubtleVibrationNoise();
      if (typeof Sound !== 'undefined') {
        if (Sound.buff) Sound.buff();
        if (Sound.sparkle) setTimeout(() => Sound.sparkle(), 200);
      }
    } catch (e) {}

    overlay.classList.remove('hidden');

    // In-grid tier highlight spotlight if Battle Pass modal is open
    if (typeof renderBattlePassScreen === 'function') {
      renderBattlePassScreen();
    }
    setTimeout(() => {
      const col = document.querySelector(`.bp-tier-col[data-tier="${newLevel}"]`);
      if (col) {
        col.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        col.classList.add('bp-tier-levelup-spotlight');
      }
    }, 200);
  }

  // Global Exports
  window.grantBattlePassXP = grantBattlePassXP;
  window.triggerBattlePassLevelUpCelebration = triggerBattlePassLevelUpCelebration;
  window.claimBattlePassReward = claimBattlePassReward;
  window.claimAllBattlePassRewards = claimAllBattlePassRewards;
  window.purchasePremiumPass = purchasePremiumPass;
  window.renderBattlePassScreen = renderBattlePassScreen;
  window.updateBattlePassBadge = updateBattlePassBadge;
  window.devUnlockBattlePass = devUnlockBattlePass;
  window.initBattlePassModule = initBattlePassModule;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBattlePassModule);
  } else {
    initBattlePassModule();
  }
})();
