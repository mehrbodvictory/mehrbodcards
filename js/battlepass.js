// ---- Battle Pass Module (Season 1: Neon Oblivion) -------------------------
// Full 20-Tier Progression System with Free Drip-Feed & 10,000 Bux Premium Track

(function() {
  'use strict';

  const BATTLEPASS_PRICE = 10000;
  const BATTLEPASS_XP_PER_TIER = 500;
  const BATTLEPASS_MAX_TIER = 20;

  const BATTLEPASS_TIERS = [
    {
      tier: 1,
      free: { kind: 'bux', amount: 250, label: '250 Bux', icon: '💰' },
      premium: { kind: 'theme', id: 'theme_chronos', name: 'Chronos Horizon', label: 'Theme: Chronos Horizon', icon: '⏳' }
    },
    {
      tier: 2,
      free: { kind: 'badge', id: 'badge_chronos_gear', name: 'Temporal Gear', label: 'Badge: Temporal Gear', icon: '⚙️' },
      premium: { kind: 'card', tierNum: 4, name: 'Chronos Sentinel', archetypeId: 'orange_chronos_sentinel', label: 'Apex Unit: Chronos Sentinel', icon: '🃏' }
    },
    {
      tier: 3,
      free: { kind: 'title', title: 'Temporal Voyager', label: 'Title: Temporal Voyager', icon: '🏷️' },
      premium: { kind: 'pack', packType: 'chronos', count: 2, name: '2x Chronos Cache', label: '2x Chronos Temporal Cache', icon: '📦' }
    },
    {
      tier: 4,
      free: { kind: 'bux', amount: 300, label: '300 Bux', icon: '💰' },
      premium: { kind: 'sleeve', id: 'sleeve_chronos', name: 'Chronos Temporal Weave', label: 'Sleeve: Chronos Weave', icon: '🎴' }
    },
    {
      tier: 5,
      free: { kind: 'pack', packType: 'booster', count: 1, name: 'Standard Booster', label: '1x Booster Pack', icon: '📦' },
      premium: { kind: 'bux', amount: 500, label: '500 Bux Cashback', icon: '💎' }
    },
    {
      tier: 6,
      free: { kind: 'bux', amount: 350, label: '350 Bux', icon: '💰' },
      premium: { kind: 'victoryAnim', id: 'victoryanim_chronos_blast', name: 'Temporal Time Stop', label: 'Finisher: Time Stop', icon: '💥' }
    },
    {
      tier: 7,
      free: { kind: 'badge', id: 'badge_cyber_reticle', name: 'Cyber Reticle', label: 'Badge: Cyber Reticle', icon: '🎯' },
      premium: { kind: 'card', tierNum: 3, name: 'Hyperdrive Drake', archetypeId: 'red_hyperdrive_drake', label: 'Epic Unit: Hyperdrive Drake', icon: '🃏' }
    },
    {
      tier: 8,
      free: { kind: 'bux', amount: 400, label: '400 Bux', icon: '💰' },
      premium: { kind: 'pack', packType: 'hyperdrive', count: 2, name: '2x Cyber-Crates', label: '2x Cyber-Crate Packs', icon: '📦' }
    },
    {
      tier: 9,
      free: { kind: 'title', title: 'Cyber Pioneer', label: 'Title: Cyber Pioneer', icon: '🏷️' },
      premium: { kind: 'sleeve', id: 'sleeve_hyperdrive', name: 'Neon Grid Holo', label: 'Sleeve: Neon Grid Holo', icon: '🎴' }
    },
    {
      tier: 10,
      free: { kind: 'bux', amount: 500, label: '500 Bux', icon: '💰' },
      premium: { kind: 'theme', id: 'theme_neon_cyberpunk', name: 'Hyperdrive Cyber-Grid', label: 'Theme: Cyber-Grid', icon: '🌆' }
    },
    {
      tier: 11,
      free: { kind: 'pack', packType: 'foil', count: 1, name: 'Foil Booster', label: '1x Foil Booster', icon: '📦' },
      premium: { kind: 'bux', amount: 1000, label: '1,000 Bux Cashback', icon: '💎' }
    },
    {
      tier: 12,
      free: { kind: 'bux', amount: 600, label: '600 Bux', icon: '💰' },
      premium: { kind: 'card', tierNum: 2, name: 'Aether Glider', archetypeId: 'green_aether_glider', label: 'Rare Unit: Aether Glider', icon: '🃏' }
    },
    {
      tier: 13,
      free: { kind: 'badge', id: 'badge_void_portal', name: 'Void Portal', label: 'Badge: Void Portal', icon: '🌀' },
      premium: { kind: 'victoryAnim', id: 'victoryanim_hyperdrive_warp', name: 'Hyperdrive Warp', label: 'Finisher: Warp Speed', icon: '🚀' }
    },
    {
      tier: 14,
      free: { kind: 'bux', amount: 750, label: '750 Bux', icon: '💰' },
      premium: { kind: 'pack', packType: 'void', count: 2, name: '2x Void Vaults', label: '2x Void Apex Vaults', icon: '📦' }
    },
    {
      tier: 15,
      free: { kind: 'title', title: 'Void Wanderer', label: 'Title: Void Wanderer', icon: '🏷️' },
      premium: { kind: 'sleeve', id: 'sleeve_singularity', name: 'Event Horizon Void', label: 'Sleeve: Event Horizon', icon: '🎴' }
    },
    {
      tier: 16,
      free: { kind: 'bux', amount: 850, label: '850 Bux', icon: '💰' },
      premium: { kind: 'card', tierNum: 3, name: 'Cyber Valkyrie', archetypeId: 'red_cyber_valkyrie', label: 'Epic Unit: Cyber Valkyrie', icon: '🃏' }
    },
    {
      tier: 17,
      free: { kind: 'bux', amount: 1000, label: '1,000 Bux', icon: '💰' },
      premium: { kind: 'bux', amount: 1500, label: '1,500 Bux Cashback', icon: '💎' }
    },
    {
      tier: 18,
      free: { kind: 'title', title: 'Pass Veteran', label: 'Title: Pass Veteran', icon: '🏷️' },
      premium: { kind: 'pack', packType: 'void', count: 3, name: '3x Void Vaults', label: '3x Void Apex Vaults', icon: '📦' }
    },
    {
      tier: 19,
      free: { kind: 'bux', amount: 1200, label: '1,200 Bux', icon: '💰' },
      premium: { kind: 'card', tierNum: 4, name: 'Singularity Devourer', archetypeId: 'orange_singularity_devourer', label: 'Apex Unit: Devourer', icon: '🃏' }
    },
    {
      tier: 20,
      free: { kind: 'title', title: 'Neon Oblivion Master', label: 'Title: Neon Master', icon: '🏆' },
      premium: { kind: 'theme', id: 'theme_void_singularity', name: 'Void Singularity', label: 'Theme: Void Singularity + Badge', icon: '🌌' }
    }
  ];

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
      if (typeof Sound !== 'undefined' && Sound.cashRain) Sound.cashRain();
      if (typeof showToast === 'function') showToast(`🎁 Claimed ${claimedCount} Battle Pass rewards!`, 3500);
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
        showToast(`❌ Insufficient Bux! Premium Pass costs 10,000 Bux (You have ${currentBux.toLocaleString()} Bux).`, 3000);
      }
      return;
    }

    if (typeof addBux === 'function') addBux(-BATTLEPASS_PRICE);
    try {
      localStorage.setItem('mehrbod-cards-bp-premium', 'true');
    } catch (e) {}

    if (typeof Sound !== 'undefined' && Sound.cashRain) Sound.cashRain();
    if (typeof showToast === 'function') showToast('⚡ PREMIUM BATTLE PASS UNLOCKED! All Premium Track rewards now claimable!', 4000);

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
    if (unclaimedBadge) {
      if (hasUnclaimedRewards()) {
        unclaimedBadge.classList.remove('hidden');
      } else {
        unclaimedBadge.classList.add('hidden');
      }
    }
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
    if (levelVal) levelVal.textContent = `TIER ${currentLevel}`;

    const progressVal = document.getElementById('bp-xp-val');
    if (progressVal) {
      if (currentLevel >= BATTLEPASS_MAX_TIER) {
        progressVal.textContent = 'MAX PASS TIER REACHED!';
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
        passStatusBadge.textContent = '⚡ PREMIUM PASS ACTIVE';
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
        buyBtn.textContent = '⚡ UNLOCK PREMIUM (10,000 BUX)';
        buyBtn.disabled = false;
        buyBtn.classList.remove('owned');
      }
    }

    // Render Track Tiers Grid
    const trackGrid = document.getElementById('bp-track-grid');
    if (trackGrid) {
      trackGrid.innerHTML = '';

      BATTLEPASS_TIERS.forEach((t) => {
        const isReached = currentLevel >= t.tier;
        const freeClaimed = isRewardClaimed(t.tier, 'free');
        const premiumClaimed = isRewardClaimed(t.tier, 'premium');

        const col = document.createElement('div');
        col.className = `bp-tier-col ${isReached ? 'reached' : 'locked'}`;

        // Header
        let headerHtml = `<div class="bp-tier-header"><span class="bp-tier-num">TIER ${t.tier}</span></div>`;

        // Free Card
        let freeBtnStateHtml = '';
        if (freeClaimed) {
          freeBtnStateHtml = `<button type="button" class="bp-claim-btn claimed" disabled>✓ Claimed</button>`;
        } else if (isReached) {
          freeBtnStateHtml = `<button type="button" class="bp-claim-btn active-free" onclick="claimBattlePassReward(${t.tier}, 'free')">🎁 Claim</button>`;
        } else {
          freeBtnStateHtml = `<button type="button" class="bp-claim-btn locked" disabled>🔒 Tier ${t.tier}</button>`;
        }

        let freeCardHtml = `
          <div class="bp-reward-card free-card ${freeClaimed ? 'claimed' : ''}">
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
          premBtnStateHtml = `<button type="button" class="bp-claim-btn prem-locked" onclick="purchasePremiumPass()">🔒 10k Bux</button>`;
        } else if (isReached) {
          premBtnStateHtml = `<button type="button" class="bp-claim-btn active-prem" onclick="claimBattlePassReward(${t.tier}, 'premium')">⚡ Claim</button>`;
        } else {
          premBtnStateHtml = `<button type="button" class="bp-claim-btn locked" disabled>🔒 Tier ${t.tier}</button>`;
        }

        let premCardHtml = `
          <div class="bp-reward-card prem-card ${premiumClaimed ? 'claimed' : ''} ${premiumUnlocked ? 'unlocked' : ''}">
            <div class="bp-card-tag prem">PREMIUM</div>
            <div class="bp-reward-icon">${t.premium.icon}</div>
            <div class="bp-reward-title">${t.premium.label}</div>
            ${premBtnStateHtml}
          </div>
        `;

        col.innerHTML = headerHtml + freeCardHtml + premCardHtml;
        trackGrid.appendChild(col);
      });
    }
  }

  // --- Attach Event Listeners ---
  function initBattlePassModule() {
    const btnOpen = document.getElementById('btn-open-battlepass');
    const overlay = document.getElementById('battlepass-overlay');
    const btnClose = document.getElementById('btn-battlepass-close');
    const btnBuy = document.getElementById('btn-bp-buy-premium');
    const btnClaimAll = document.getElementById('btn-bp-claim-all');

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

    if (btnClaimAll) {
      btnClaimAll.addEventListener('click', () => {
        if (typeof Sound !== 'undefined' && Sound.click) Sound.click();
        claimAllBattlePassRewards();
      });
    }

    updateBattlePassBadge();
  }

  // Global Exports
  window.grantBattlePassXP = grantBattlePassXP;
  window.claimBattlePassReward = claimBattlePassReward;
  window.claimAllBattlePassRewards = claimAllBattlePassRewards;
  window.purchasePremiumPass = purchasePremiumPass;
  window.renderBattlePassScreen = renderBattlePassScreen;
  window.initBattlePassModule = initBattlePassModule;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBattlePassModule);
  } else {
    initBattlePassModule();
  }
})();
