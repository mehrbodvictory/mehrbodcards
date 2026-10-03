// ---- 2.5D Story Mode: Chronicles of Mehrbod (v7.18) -----------------------
// Interactive 2.5D Isometric World Map, Dynamic Elevation Engine,
// 5 Thematic Chapters, Narrative Dialogue Cutscenes, Boss Encounters & Rewards.

const StoryMode = (function() {
  'use strict';

  const STORAGE_KEY = 'mehrbod-cards-story-progress-v1';

  // --- Story Chapters & Nodes Data Definition ---
  const CHAPTERS = [
    {
      id: 1,
      title: 'Chapter 1: The Azure Shoreline',
      subtitle: 'Awakening at the Crystal Coast',
      theme: 'azure',
      bgGradient: ['#0f172a', '#0369a1', '#0284c7'],
      groundColor: '#0c4a6e',
      gridColor: 'rgba(56, 189, 248, 0.25)',
      description: 'Master the fundamentals of energy, unit placement, and infinite Blue-tier defense charges along the tranquil crystal coastline.',
      nodes: [
        {
          id: '1-1',
          name: 'Tidepool Outpost',
          type: 'battle',
          x: -2, y: -2, z: 0,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '🌊',
            text: 'Greetings, duelist! The tides are calm today. Place your Blue units to establish line control and absorb initial strikes with unlimited defense charges!'
          },
          enemy: {
            name: 'Coastal Scout',
            avatar: '🦀',
            difficulty: 'Easy',
            hp: 20,
            deckTheme: 'blue_basics',
            customDeck: { units: { 1: 4, 2: 4, 3: 2 }, spells: ['zap', 'heal', 'shield'], chips: ['atk1'] }
          },
          rewards: { bux: 35, xp: 50, title: 'Tidewatcher' },
          mutator: null
        },
        {
          id: '1-2',
          name: 'Sunken Shallows',
          type: 'battle',
          x: 0, y: -1, z: 0.5,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '🌊',
            text: 'Beware of spell disruptions! Cast your utility cards wisely to heal wounded allies and break past enemy guardians.'
          },
          enemy: {
            name: 'Coral Sentinel',
            avatar: '🐚',
            difficulty: 'Easy',
            hp: 24,
            deckTheme: 'blue_defense',
            customDeck: { units: { 1: 3, 2: 4, 4: 3 }, spells: ['zap', 'shield', 'draw'], chips: ['hp1', 'atk1'] }
          },
          rewards: { bux: 50, xp: 75, title: 'Coral Guardian' },
          mutator: 'Tidal Surge: +1 SP on Turn 1'
        },
        {
          id: '1-3',
          name: 'Shrine of the Torrent',
          type: 'boss',
          x: 2, y: 0, z: 1.2,
          dialogue: {
            speaker: 'Aquascout Sentinel',
            avatar: '🔱',
            text: 'None shall disturb the ancient waters! Witness the relentless tide of Azure momentum!'
          },
          enemy: {
            name: 'Aquascout Sentinel',
            avatar: '🔱',
            difficulty: 'Medium',
            hp: 30,
            deckTheme: 'blue_boss',
            customDeck: { units: { 1: 4, 2: 3, 3: 3 }, spells: ['zap', 'shield', 'fireball'], chips: ['hp1', 'atk1', 'regen1'] }
          },
          rewards: { bux: 100, xp: 150, title: 'Master of Tides', badge: 'azure_champion' },
          mutator: 'Ocean Bastion: All Blue units gain +1 HP'
        }
      ]
    },
    {
      id: 2,
      title: 'Chapter 2: The Viridian Canopy',
      subtitle: 'Roots of the Ancient Forest',
      theme: 'viridian',
      bgGradient: ['#052e16', '#14532d', '#15803d'],
      groundColor: '#064e3b',
      gridColor: 'rgba(74, 222, 128, 0.25)',
      description: 'Venture deep into overgrown jade groves. Learn the power of Green tier units, regenerative life links, and strategic card merging.',
      nodes: [
        {
          id: '2-1',
          name: 'Bramble Crossing',
          type: 'battle',
          x: -2, y: 1, z: 0.4,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '🌿',
            text: 'Green tier cards possess heightened health and single-block defense charges. Combine two units to unleash their combined potency!'
          },
          enemy: {
            name: 'Thorn Scout',
            avatar: '🍃',
            difficulty: 'Medium',
            hp: 28,
            deckTheme: 'green_basics',
            customDeck: { units: { 101: 3, 102: 3, 1: 4 }, spells: ['heal', 'zap', 'shield'], chips: ['hp1'] }
          },
          rewards: { bux: 60, xp: 100, title: 'Pathfinder' },
          mutator: null
        },
        {
          id: '2-2',
          name: 'Overgrown Sanctum',
          type: 'battle',
          x: 0, y: 2, z: 1.0,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '🌿',
            text: 'Equip chips directly onto your durable units to amplify their recovery and counter-attack prowess.'
          },
          enemy: {
            name: 'Grove Warden',
            avatar: '🦌',
            difficulty: 'Medium',
            hp: 32,
            deckTheme: 'green_resilience',
            customDeck: { units: { 101: 3, 103: 3, 2: 4 }, spells: ['heal', 'boost', 'shield'], chips: ['hp2', 'regen1'] }
          },
          rewards: { bux: 80, xp: 140, title: 'Grove Warden' },
          mutator: 'Deep Roots: Health recovery effects increased by 50%'
        },
        {
          id: '2-3',
          name: 'Heart of the Elder Wood',
          type: 'boss',
          x: 2, y: 3, z: 1.8,
          dialogue: {
            speaker: 'Elder Thornweaver',
            avatar: '🌲',
            text: 'The forest remembers every intruder. You shall become nourishment for our roots!'
          },
          enemy: {
            name: 'Elder Thornweaver',
            avatar: '🌲',
            difficulty: 'Hard',
            hp: 38,
            deckTheme: 'green_boss',
            customDeck: { units: { 101: 3, 102: 3, 104: 2, 2: 2 }, spells: ['heal', 'boost', 'fireball'], chips: ['hp2', 'pierce1', 'regen1'] }
          },
          rewards: { bux: 150, xp: 220, title: 'Viridian Sovereign', badge: 'viridian_champion' },
          mutator: 'Verdant Aura: First unit placed each round gains +2 Max HP'
        }
      ]
    },
    {
      id: 3,
      title: 'Chapter 3: The Crimson Caldera',
      subtitle: 'Wrath of the Scorched Spire',
      theme: 'crimson',
      bgGradient: ['#450a0a', '#7f1d1d', '#991b1b'],
      groundColor: '#450a0a',
      gridColor: 'rgba(248, 113, 113, 0.25)',
      description: 'Ascend the searing volcanic peaks. Harness high-impact Red tier strikers with ferocious attack values and unblockable pierce mechanics.',
      nodes: [
        {
          id: '3-1',
          name: 'Obsidian Fissure',
          type: 'battle',
          x: -1, y: -2, z: 0.6,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '🔥',
            text: 'Red tier cards have zero defense charges, but their raw damage is terrifying. Strike first, strike decisive!'
          },
          enemy: {
            name: 'Pyre Vanguard',
            avatar: '🌋',
            difficulty: 'Hard',
            hp: 34,
            deckTheme: 'red_aggro',
            customDeck: { units: { 201: 2, 202: 2, 101: 3, 1: 3 }, spells: ['fireball', 'zap', 'boost'], chips: ['atk2'] }
          },
          rewards: { bux: 90, xp: 160, title: 'Flame Walker' },
          mutator: null
        },
        {
          id: '3-2',
          name: 'The Molten Forge',
          type: 'battle',
          x: 1, y: -1, z: 1.4,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '🔥',
            text: 'Use offensive spells like Fireball to clear high-tier blockers and expose the enemy commander directly.'
          },
          enemy: {
            name: 'Magma Smith',
            avatar: '⚒️',
            difficulty: 'Hard',
            hp: 38,
            deckTheme: 'red_burn',
            customDeck: { units: { 201: 2, 203: 2, 102: 3, 2: 3 }, spells: ['fireball', 'zap', 'weaken'], chips: ['atk2', 'pierce1'] }
          },
          rewards: { bux: 120, xp: 200, title: 'Magma Forger' },
          mutator: 'Volcanic Heat: Both players take 1 damage at the end of each round'
        },
        {
          id: '3-3',
          name: 'Crest of the Pyre Titan',
          type: 'boss',
          x: 3, y: 1, z: 2.2,
          dialogue: {
            speaker: 'Pyre Titan Ignis',
            avatar: '☄️',
            text: 'Burn to cinders! All that enters the caldera is forged or incinerated!'
          },
          enemy: {
            name: 'Pyre Titan Ignis',
            avatar: '☄️',
            difficulty: 'Expert',
            hp: 44,
            deckTheme: 'red_boss',
            customDeck: { units: { 201: 2, 202: 2, 204: 2, 101: 2, 1: 2 }, spells: ['fireball', 'zap', 'boost'], chips: ['atk2', 'pierce1', 'crit1'] }
          },
          rewards: { bux: 220, xp: 320, title: 'Lord of Cinders', badge: 'crimson_champion' },
          mutator: 'Hyper-Conflagration: All Red units deal +1 bonus damage'
        }
      ]
    },
    {
      id: 4,
      title: 'Chapter 4: The Solar Citadel',
      subtitle: 'Bastion of the Sun Archons',
      theme: 'solar',
      bgGradient: ['#451a03', '#78350f', '#9a3412'],
      groundColor: '#78350f',
      gridColor: 'rgba(251, 191, 36, 0.3)',
      description: 'Climb the towering celestial spires. Master Orange Apex tier juggernauts, monumental card merges, and game-ending combos.',
      nodes: [
        {
          id: '4-1',
          name: 'Sunstone Courtyard',
          type: 'battle',
          x: -2, y: 0, z: 0.8,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '☀️',
            text: 'Orange tier cards represent the pinnacle of mortal power. Merging two Tier 2s or a Tier 1 and 3 summons an Apex colossus!'
          },
          enemy: {
            name: 'Solar Herald',
            avatar: '🌅',
            difficulty: 'Expert',
            hp: 40,
            deckTheme: 'solar_merges',
            customDeck: { units: { 301: 1, 302: 1, 201: 2, 101: 3, 1: 3 }, spells: ['boost', 'shield', 'heal'], chips: ['atk2', 'hp2'] }
          },
          rewards: { bux: 140, xp: 240, title: 'Dawn Bringer' },
          mutator: null
        },
        {
          id: '4-2',
          name: 'Sanctum of the Eclipse',
          type: 'battle',
          x: 0, y: 1, z: 1.6,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '☀️',
            text: 'Manage your SP generation carefully — higher tier units require immense tactical preparation to field and protect.'
          },
          enemy: {
            name: 'Corona Templar',
            avatar: '🛡️',
            difficulty: 'Expert',
            hp: 45,
            deckTheme: 'solar_combo',
            customDeck: { units: { 301: 1, 303: 1, 202: 2, 102: 3, 2: 3 }, spells: ['boost', 'fireball', 'shield'], chips: ['hp2', 'atk2', 'regen1'] }
          },
          rewards: { bux: 180, xp: 300, title: 'Solar Templar' },
          mutator: 'Solar Flare: +2 bonus SP awarded to both sides every 2 rounds'
        },
        {
          id: '4-3',
          name: 'The Zenith Pinnacle',
          type: 'boss',
          x: 2, y: 2, z: 2.6,
          dialogue: {
            speaker: 'Archon Sol Invictus',
            avatar: '👑',
            text: 'I am the unbroken sun. Before my celestial radiance, your cards shall crumble into dust!'
          },
          enemy: {
            name: 'Archon Sol Invictus',
            avatar: '👑',
            difficulty: 'Master',
            hp: 50,
            deckTheme: 'solar_boss',
            customDeck: { units: { 301: 1, 302: 1, 304: 1, 201: 2, 101: 2, 1: 3 }, spells: ['boost', 'fireball', 'heal'], chips: ['atk2', 'hp2', 'crit1', 'pierce1'] }
          },
          rewards: { bux: 300, xp: 450, title: 'Solar Archon', badge: 'solar_champion' },
          mutator: 'Celestial Radiance: Orange units regenerate 1 HP per turn'
        }
      ]
    },
    {
      id: 5,
      title: 'Chapter 5: The Prism Nexus',
      subtitle: 'The Void Core & Grand Sovereign',
      theme: 'prism',
      bgGradient: ['#0f172a', '#3b0764', '#1e1b4b'],
      groundColor: '#1e1b4b',
      gridColor: 'rgba(192, 132, 252, 0.35)',
      description: 'The final dimensional convergence. Confront Chronos, Sovereign of the Prism, in a multi-phase ultimate test of tactical supremacy.',
      nodes: [
        {
          id: '5-1',
          name: 'Dimensional Rift',
          type: 'battle',
          x: -1, y: -1, z: 1.0,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '✨',
            text: 'The rules of reality are fluid here. All four elements collide in harmonic fury. Trust in your complete deck!'
          },
          enemy: {
            name: 'Prism Echo',
            avatar: '🌌',
            difficulty: 'Master',
            hp: 48,
            deckTheme: 'prism_hybrid',
            customDeck: { units: { 301: 1, 201: 2, 101: 3, 1: 4 }, spells: ['fireball', 'boost', 'shield'], chips: ['atk2', 'hp2', 'crit1'] }
          },
          rewards: { bux: 200, xp: 350, title: 'Rift Strider' },
          mutator: null
        },
        {
          id: '5-2',
          name: 'The Quantum Gate',
          type: 'battle',
          x: 1, y: 0, z: 2.0,
          dialogue: {
            speaker: 'Guide Aria',
            avatar: '✨',
            text: 'You are on the threshold of the Prism Core. This is where champions become legends!'
          },
          enemy: {
            name: 'Core Sentinel',
            avatar: '💠',
            difficulty: 'Master',
            hp: 52,
            deckTheme: 'prism_heavy',
            customDeck: { units: { 302: 1, 202: 2, 102: 3, 2: 4 }, spells: ['fireball', 'heal', 'boost'], chips: ['atk2', 'hp2', 'regen1', 'crit1'] }
          },
          rewards: { bux: 280, xp: 480, title: 'Prism Vanguard' },
          mutator: 'Resonance: Critical strike chance increased by 20% for all cards'
        },
        {
          id: '5-3',
          name: 'The Eternal Prism Core',
          type: 'boss',
          x: 3, y: 2, z: 3.2,
          dialogue: {
            speaker: 'Chronos, Sovereign of the Prism',
            avatar: '💎',
            text: 'Countless duelists have attempted to claim the Prism Core. All have fallen into the endless void. Prove your worth or fade into memory!'
          },
          enemy: {
            name: 'Chronos, Sovereign of the Prism',
            avatar: '💎',
            difficulty: 'Master',
            hp: 60,
            deckTheme: 'grand_boss',
            customDeck: { units: { 301: 1, 302: 1, 201: 2, 202: 2, 101: 2, 1: 2 }, spells: ['fireball', 'boost', 'heal'], chips: ['atk2', 'hp2', 'crit1', 'pierce1', 'regen1'] }
          },
          rewards: { bux: 600, xp: 1200, title: 'Prism Grandmaster', badge: 'prism_sovereign', unlockCosmetic: 'theme_prism_unlocked' },
          mutator: 'Omni-Resonance: All units receive +1 HP, +1 ATK, and abilities trigger with double intensity'
        }
      ]
    }
  ];

  // --- State & Progress Management ---
  let progress = {
    currentChapter: 1,
    clearedNodes: [],
    claimedRewards: [],
    selectedNodeId: '1-1'
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.clearedNodes)) {
          progress = Object.assign(progress, parsed);
        }
      }
    } catch (_) {}
    return progress;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (_) {}
  }

  function isNodeCleared(nodeId) {
    return progress.clearedNodes.includes(nodeId);
  }

  function isNodeUnlocked(node) {
    const ch = CHAPTERS.find(c => c.nodes.some(n => n.id === node.id));
    if (!ch) return false;
    const nodeIdx = ch.nodes.findIndex(n => n.id === node.id);
    if (nodeIdx === 0) {
      if (ch.id === 1) return true;
      const prevCh = CHAPTERS.find(c => c.id === ch.id - 1);
      const lastNodeOfPrev = prevCh ? prevCh.nodes[prevCh.nodes.length - 1] : null;
      return lastNodeOfPrev ? isNodeCleared(lastNodeOfPrev.id) : false;
    }
    const prevNodeInCh = ch.nodes[nodeIdx - 1];
    return isNodeCleared(prevNodeInCh.id);
  }

  // --- 2.5D Isometric Canvas Renderer ---
  let canvas = null;
  let ctx = null;
  let animId = null;
  let currentChapterIdx = 0;
  
  // Isometric camera state
  const camera = {
    angle: Math.PI / 6, // 30 degrees isometric tilt
    scale: 44,
    offsetX: 0,
    offsetY: 0,
    targetOffsetX: 0,
    targetOffsetY: 0,
    elevationScale: 32,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    t: 0
  };

  let hoveredNode = null;

  function project2D5(x, y, z) {
    const cosA = Math.cos(camera.angle);
    const sinA = Math.sin(camera.angle);
    
    // Isometric transformation in logical CSS pixels
    const isoX = (x - y) * cosA * camera.scale;
    const isoY = (x + y) * sinA * camera.scale - z * camera.elevationScale;

    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas ? (canvas.width / dpr) : 400;
    const logicalH = canvas ? (canvas.height / dpr) : 300;

    const screenX = logicalW / 2 + isoX + camera.offsetX;
    const screenY = logicalH / 2 + isoY + camera.offsetY;

    return { x: screenX, y: screenY, depth: x + y + z * 2 };
  }

  function initCanvas(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    bindCanvasControls();
    injectMobileControls();
    startRenderLoop();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(280, Math.floor(rect.width * dpr));
    canvas.height = Math.max(280, Math.floor(rect.height * dpr));
    if (ctx) ctx.scale(dpr, dpr);
  }

  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerMoved = false;

  function bindCanvasControls() {
    if (!canvas) return;

    canvas.addEventListener('pointerdown', (e) => {
      camera.isDragging = true;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      pointerMoved = false;
      camera.dragStartX = e.clientX - camera.targetOffsetX;
      camera.dragStartY = e.clientY - camera.targetOffsetY;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left);
      const mouseY = (e.clientY - rect.top);

      if (Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY) > 7) {
        pointerMoved = true;
      }

      if (camera.isDragging && pointerMoved) {
        camera.targetOffsetX = e.clientX - camera.dragStartX;
        camera.targetOffsetY = e.clientY - camera.dragStartY;
      } else {
        // Hit test nodes in 2.5D logical pixel space
        const ch = CHAPTERS[currentChapterIdx];
        let found = null;
        for (const n of ch.nodes) {
          const pt = project2D5(n.x, n.y, n.z);
          const dx = mouseX - pt.x;
          const dy = mouseY - pt.y;
          if (Math.hypot(dx, dy) < 32) {
            found = n;
            break;
          }
        }
        hoveredNode = found;
        canvas.style.cursor = hoveredNode ? 'pointer' : (camera.isDragging ? 'grabbing' : 'grab');
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (camera.isDragging) {
        camera.isDragging = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      }

      // If it was a clean tap/click without heavy dragging
      if (!pointerMoved) {
        const rect = canvas.getBoundingClientRect();
        const tapX = e.clientX - rect.left;
        const tapY = e.clientY - rect.top;

        const ch = CHAPTERS[currentChapterIdx];
        for (const n of ch.nodes) {
          const pt = project2D5(n.x, n.y, n.z);
          const dx = tapX - pt.x;
          const dy = tapY - pt.y;
          if (Math.hypot(dx, dy) < 36) {
            selectStoryNode(n);
            if (typeof Sound !== 'undefined' && typeof Sound.click === 'function') {
              Sound.click();
            }
            break;
          }
        }
      }
    });
  }

  function injectMobileControls() {
    const container = canvas ? canvas.parentElement : null;
    if (!container || container.querySelector('.story-canvas-floating-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'story-canvas-floating-controls';
    controls.innerHTML = `
      <button type="button" class="scfc-btn" id="scfc-zoom-in" aria-label="Zoom In">+</button>
      <button type="button" class="scfc-btn" id="scfc-zoom-out" aria-label="Zoom Out">−</button>
      <button type="button" class="scfc-btn" id="scfc-reset" aria-label="Reset Camera">🎯</button>
    `;
    container.appendChild(controls);

    controls.querySelector('#scfc-zoom-in')?.addEventListener('click', (e) => {
      e.stopPropagation();
      camera.scale = Math.min(65, camera.scale * 1.2);
    });
    controls.querySelector('#scfc-zoom-out')?.addEventListener('click', (e) => {
      e.stopPropagation();
      camera.scale = Math.max(26, camera.scale * 0.8);
    });
    controls.querySelector('#scfc-reset')?.addEventListener('click', (e) => {
      e.stopPropagation();
      camera.scale = 44;
      camera.targetOffsetX = 0;
      camera.targetOffsetY = 0;
    });
  }

  function startRenderLoop() {
    if (animId) cancelAnimationFrame(animId);
    let lastT = performance.now();

    function render(now) {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      camera.t += dt;

      // Smooth camera pan easing
      camera.offsetX += (camera.targetOffsetX - camera.offsetX) * 0.12;
      camera.offsetY += (camera.targetOffsetY - camera.offsetY) * 0.12;

      drawScene();
      animId = requestAnimationFrame(render);
    }
    animId = requestAnimationFrame(render);
  }

  function drawScene() {
    if (!ctx || !canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const ch = CHAPTERS[currentChapterIdx];

    ctx.clearRect(0, 0, w, h);

    // 1. Atmospheric Full-Viewport Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, ch.bgGradient[0]);
    bgGrad.addColorStop(0.5, ch.bgGradient[1]);
    bgGrad.addColorStop(1, ch.bgGradient[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Distant 2.5D Mountain Horizon Parallax (Seamless Wrapping)
    drawMountainParallax(w, h, ch);

    // 3. 2.5D Solid Isometric Terrain Island & Ground Surface
    const gridSize = 7;
    drawTerrainPlane(ch, gridSize);

    // 4. Glowing 2.5D Grid Overlay
    drawIsometricGrid(ch, gridSize);

    // 5. Connecting Energy Pathways between Chapter Nodes
    drawConnectingBridges(ch);

    // 6. Render 2.5D Elevated Nodes & Shrines
    drawNodes(ch);

    // 7. Atmospheric Floating Particles & Shimmer
    drawAmbientParticles(w, h, ch);
  }

  function drawMountainParallax(w, h, ch) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const mWidth = 260;
    const totalSpan = w + mWidth * 3;
    
    for (let i = -2; i < Math.ceil(w / mWidth) + 3; i++) {
      const rawX = i * mWidth + camera.offsetX * 0.2 + camera.t * 6;
      let px = ((rawX % totalSpan) + totalSpan) % totalSpan - mWidth;
      const py = h * 0.48 + Math.sin(i * 1.7 + camera.t * 0.4) * 22;

      ctx.beginPath();
      ctx.moveTo(px, h);
      ctx.lineTo(px + mWidth * 0.5, py);
      ctx.lineTo(px + mWidth, h);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTerrainPlane(ch, gridSize) {
    ctx.save();
    const top = project2D5(-gridSize, -gridSize, 0);
    const right = project2D5(gridSize, -gridSize, 0);
    const bottom = project2D5(gridSize, gridSize, 0);
    const left = project2D5(-gridSize, gridSize, 0);

    // Fill Ground Surface Diamond
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();

    const groundGrad = ctx.createLinearGradient(top.x, top.y, bottom.x, bottom.y);
    groundGrad.addColorStop(0, ch.groundColor || '#0c4a6e');
    groundGrad.addColorStop(1, '#020617');
    ctx.fillStyle = groundGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 32;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2.5D Isometric Cliff Depth Walls
    const cliffDepth = 28;
    // Right Cliff Surface
    ctx.beginPath();
    ctx.moveTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y + cliffDepth);
    ctx.lineTo(right.x, right.y + cliffDepth);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // Left Cliff Surface
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(left.x, left.y + cliffDepth);
    ctx.lineTo(bottom.x, bottom.y + cliffDepth);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();

    ctx.restore();
  }

  function drawIsometricGrid(ch, gridSize = 7) {
    ctx.save();
    ctx.strokeStyle = ch.gridColor;
    ctx.lineWidth = 1;

    for (let x = -gridSize; x <= gridSize; x++) {
      const p1 = project2D5(x, -gridSize, 0);
      const p2 = project2D5(x, gridSize, 0);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let y = -gridSize; y <= gridSize; y++) {
      const p1 = project2D5(-gridSize, y, 0);
      const p2 = project2D5(gridSize, y, 0);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawConnectingBridges(ch) {
    ctx.save();

    for (let i = 0; i < ch.nodes.length - 1; i++) {
      const n1 = ch.nodes[i];
      const n2 = ch.nodes[i + 1];
      const p1 = project2D5(n1.x, n1.y, n1.z);
      const p2 = project2D5(n2.x, n2.y, n2.z);

      const isCleared = isNodeCleared(n1.id);
      const isUnlocked = isNodeUnlocked(n2);

      // Pathway Line
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = isCleared ? 4 : 2;
      ctx.strokeStyle = isCleared 
        ? '#38bdf8' 
        : (isUnlocked ? 'rgba(255, 255, 255, 0.4)' : 'rgba(100, 116, 139, 0.25)');
      if (!isCleared && isUnlocked) {
        ctx.setLineDash([6, 6]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();

      // Energy Pulse Animation on Active Path
      if (isCleared && isUnlocked) {
        const pulseRatio = (camera.t * 0.8) % 1;
        const px = p1.x + (p2.x - p1.x) * pulseRatio;
        const py = p1.y + (p2.y - p1.y) * pulseRatio;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  function drawNodes(ch) {
    // Sort nodes by depth for correct 2.5D painter's rendering order
    const sorted = ch.nodes.slice().sort((a, b) => {
      const pa = project2D5(a.x, a.y, a.z);
      const pb = project2D5(b.x, b.y, b.z);
      return pa.depth - pb.depth;
    });

    for (const node of sorted) {
      const pt = project2D5(node.x, node.y, node.z);
      const groundPt = project2D5(node.x, node.y, 0);
      const nx = pt.x;
      const ny = pt.y;
      const gx = groundPt.x;
      const gy = groundPt.y;

      const isCleared = isNodeCleared(node.id);
      const isUnlocked = isNodeUnlocked(node);
      const isSelected = progress.selectedNodeId === node.id;
      const isHovered = hoveredNode && hoveredNode.id === node.id;

      // 1. Isometric Vertical Elevation Pillar & Drop Shadow
      ctx.save();
      // Drop Shadow on Ground Plane
      ctx.beginPath();
      ctx.ellipse(gx, gy, 18, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      // Elevation Beam / Cyber Pillar
      if (node.z > 0) {
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(nx, ny);
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.strokeStyle = isUnlocked 
          ? 'rgba(56, 189, 248, 0.45)' 
          : 'rgba(148, 163, 184, 0.15)';
        ctx.stroke();
      }

      // 2. 2.5D Isometric Pedestal / Hexagon Shrine Base
      const pulse = Math.sin(camera.t * 3 + node.x) * 2;
      const radius = (node.type === 'boss' ? 24 : 18) + (isSelected ? 4 : 0) + (isHovered ? 2 : 0);

      // Base Pedestal
      ctx.beginPath();
      ctx.arc(nx, ny + pulse, radius, 0, Math.PI * 2);
      if (isCleared) {
        ctx.fillStyle = 'rgba(14, 165, 233, 0.85)';
        ctx.strokeStyle = '#38bdf8';
      } else if (isUnlocked) {
        ctx.fillStyle = node.type === 'boss' ? 'rgba(239, 68, 68, 0.85)' : 'rgba(234, 179, 8, 0.85)';
        ctx.strokeStyle = node.type === 'boss' ? '#f87171' : '#fde047';
      } else {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.strokeStyle = '#475569';
      }
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isSelected ? 16 : (isUnlocked ? 8 : 0);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Node Icon / Badge
      ctx.font = `${node.type === 'boss' ? '18px' : '14px'} sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (!isUnlocked) {
        ctx.fillText('🔒', nx, ny + pulse);
      } else if (isCleared) {
        ctx.fillText('✓', nx, ny + pulse);
      } else {
        ctx.fillText(node.type === 'boss' ? '👑' : '⚔️', nx, ny + pulse);
      }

      // 4. Node Title Tag in 2.5D Space
      ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = isSelected ? '#ffffff' : (isUnlocked ? '#e2e8f0' : '#64748b');
      ctx.fillText(node.name, nx, ny + pulse + radius + 14);

      if (node.mutator && isUnlocked) {
        ctx.font = '9px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('⚡ Mutator Stage', nx, ny + pulse + radius + 26);
      }

      ctx.restore();
    }
  }

  function drawAmbientParticles(w, h, ch) {
    ctx.save();
    const colors = ch.theme === 'crimson' 
      ? ['#f87171', '#ef4444', '#f59e0b'] 
      : (ch.theme === 'viridian' ? ['#4ade80', '#22c55e', '#86efac'] : ['#38bdf8', '#818cf8', '#e0e7ff']);

    for (let i = 0; i < 20; i++) {
      const seed = i * 137.5;
      const px = ((seed + camera.t * 12) % w);
      const py = ((seed * 1.7 + Math.sin(camera.t + i) * 30 + h) % h);
      const rad = 1 + (i % 3);
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(camera.t * 2 + i);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- UI & Story Interaction Handlers ---
  function selectStoryNode(node) {
    progress.selectedNodeId = node.id;
    saveProgress();
    renderNodeInspector(node);
  }

  function renderNodeInspector(node) {
    const panel = document.getElementById('story-node-inspector');
    if (!panel) return;

    const isCleared = isNodeCleared(node.id);
    const isUnlocked = isNodeUnlocked(node);
    const ch = CHAPTERS.find(c => c.nodes.some(n => n.id === node.id)) || CHAPTERS[0];

    panel.innerHTML = `
      <div class="story-inspector-card ${node.type === 'boss' ? 'boss-node' : ''}">
        <div class="story-inspector-header">
          <div>
            <div class="story-node-tag">${ch.title} · ${node.id}</div>
            <div class="story-node-title">${node.name}</div>
          </div>
          <div class="story-node-status-badge ${isCleared ? 'cleared' : (isUnlocked ? 'ready' : 'locked')}">
            ${isCleared ? '✓ Cleared' : (isUnlocked ? '⚔️ Ready' : '🔒 Locked')}
          </div>
        </div>

        <div class="story-inspector-dialogue-preview">
          <div class="sid-avatar">${node.dialogue.avatar}</div>
          <div class="sid-body">
            <div class="sid-speaker">${node.dialogue.speaker}</div>
            <div class="sid-text">"${node.dialogue.text}"</div>
          </div>
        </div>

        <div class="story-enemy-brief">
          <div class="seb-header">
            <span>Enemy Commander: <strong>${node.enemy.name}</strong></span>
            <span class="seb-difficulty difficulty-${node.enemy.difficulty.toLowerCase()}">${node.enemy.difficulty}</span>
          </div>
          <div class="seb-hp">Base Health: ${node.enemy.hp} HP</div>
          ${node.mutator ? `<div class="seb-mutator">⚡ <strong>Mutator:</strong> ${node.mutator}</div>` : ''}
        </div>

        <div class="story-rewards-box">
          <div class="srb-title">🎁 First Clear Rewards</div>
          <div class="srb-items">
            <span class="srb-item">🪙 +${node.rewards.bux} Bux</span>
            <span class="srb-item">⭐ +${node.rewards.xp} XP</span>
            ${node.rewards.title ? `<span class="srb-item">🏷️ "${node.rewards.title}"</span>` : ''}
          </div>
        </div>

        <div class="story-inspector-actions">
          ${isUnlocked ? `
            <button type="button" class="primary-btn story-deploy-btn" id="btn-story-deploy">
              <span>⚔️ Deploy to Battle</span>
            </button>
          ` : `
            <button type="button" class="primary-btn story-deploy-btn disabled" disabled>
              <span>🔒 Clear previous stages to unlock</span>
            </button>
          `}
        </div>
      </div>
    `;

    const deployBtn = panel.querySelector('#btn-story-deploy');
    if (deployBtn) {
      deployBtn.addEventListener('click', () => {
        launchStoryBattle(node);
      });
    }
  }

  function launchStoryBattle(node) {
    if (typeof openDeckBuilder !== 'function') return;

    // Launch deck builder with callback to start match
    openDeckBuilder((playerDeckConfig) => {
      if (typeof startVsBot !== 'function') return;
      
      // Store active story battle node
      window._activeStoryNode = node;
      
      // Launch bot battle with story enemy parameters
      startVsBot(0, playerDeckConfig, {
        storyMode: true,
        nodeId: node.id,
        botName: node.enemy.name,
        botDifficulty: node.enemy.difficulty,
        botDeckConfig: node.enemy.customDeck,
        mutator: node.mutator
      });
    }, 'screen-story-mode');
  }

  function getDailyBountyData() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const daySeed = todayStr.split('-').reduce((acc, part) => acc + Number(part), 0);
    
    const mutators = [
      { name: 'Arcane Overclock', desc: 'Both sides gain +3 bonus SP per round and spell effectiveness is doubled.' },
      { name: 'Solar Overdrive', desc: 'Orange and Apex units regenerate 2 HP and gain +1 ATK every round.' },
      { name: 'Shield Matrix', desc: 'All deployed units spawn with a 5 HP temporary protective barrier.' },
      { name: 'Double Fusion Yield', desc: 'Merging cards immediately draws +1 bonus spell card into hand.' },
      { name: 'Omni-Resonance', desc: 'Units of matching elements gain +2 ATK and +3 HP upon placement.' }
    ];

    const enemies = [
      { name: 'Void Sovereign Chronos', avatar: '⌛', hp: 55, difficulty: 'Master' },
      { name: 'Solar Archon Sol Invictus', avatar: '👑', hp: 50, difficulty: 'Master' },
      { name: 'Apex Juggernaut Megalith', avatar: '🪨', hp: 48, difficulty: 'Expert' },
      { name: 'Crimson Drake Ignis', avatar: '🐉', hp: 52, difficulty: 'Master' }
    ];

    const mutatorObj = mutators[daySeed % mutators.length];
    const enemyObj = enemies[(daySeed * 3) % enemies.length];
    const isCompletedToday = progress.dailyBountyClearedDate === todayStr;

    return {
      id: `daily-${todayStr}`,
      date: todayStr,
      name: `Daily Bounty: ${mutatorObj.name}`,
      type: 'boss',
      dialogue: {
        speaker: 'Tactical Bounty Board',
        avatar: '📜',
        text: `Target: ${enemyObj.name}. Mutator active: ${mutatorObj.name}! Complete this daily challenge for 300 Bux & 450 XP!`
      },
      enemy: {
        name: enemyObj.name,
        avatar: enemyObj.avatar,
        difficulty: enemyObj.difficulty,
        hp: enemyObj.hp,
        deckTheme: 'daily_bounty_hybrid',
        customDeck: { units: { 301: 1, 302: 1, 201: 2, 101: 3, 1: 3 }, spells: ['fireball', 'boost', 'shield', 'heal'], chips: ['atk2', 'hp2', 'crit1'] }
      },
      mutator: `${mutatorObj.name}: ${mutatorObj.desc}`,
      rewards: { bux: 300, xp: 450, title: 'Tactical Bounty Hunter' },
      isCompletedToday
    };
  }

  function renderDailyBountyBanner() {
    let container = document.getElementById('story-daily-bounty-widget');
    const header = document.querySelector('.story-mode-header');
    if (!header) return;

    if (!container) {
      container = document.createElement('div');
      container.id = 'story-daily-bounty-widget';
      container.className = 'story-daily-bounty-banner';
      header.appendChild(container);
    }

    const bounty = getDailyBountyData();
    container.innerHTML = `
      <div class="sdbb-content">
        <div class="sdbb-badge">🎯 DAILY BOUNTY</div>
        <div class="sdbb-title">${bounty.name}</div>
        <div class="sdbb-mutator">${bounty.mutator}</div>
      </div>
      <button type="button" class="sdbb-btn ${bounty.isCompletedToday ? 'completed' : ''}" id="btn-launch-daily-bounty">
        ${bounty.isCompletedToday ? '✓ COMPLETED TODAY' : '⚔️ LAUNCH BOUNTY (+300 BUX)'}
      </button>
    `;

    container.querySelector('#btn-launch-daily-bounty')?.addEventListener('click', () => {
      selectStoryNode(bounty);
      launchStoryBattle(bounty);
    });
  }

  function handleStoryBattleVictory(nodeId) {
    if (nodeId && String(nodeId).startsWith('daily-')) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (progress.dailyBountyClearedDate !== todayStr) {
        progress.dailyBountyClearedDate = todayStr;
        progress.dailyStreak = (progress.dailyStreak || 0) + 1;
        saveProgress();

        if (typeof addBux === 'function') addBux(300);
        if (typeof loadPlayerXP === 'function' && typeof savePlayerXP === 'function') {
          savePlayerXP(loadPlayerXP() + 450);
        }

        if (typeof showToast === 'function') {
          showToast(`🎯 Daily Tactical Bounty Cleared! +300 Bux, +450 XP (Streak: ${progress.dailyStreak} Days)!`, 5000);
        }
        renderDailyBountyBanner();
      }
      return;
    }

    const node = CHAPTERS.flatMap(c => c.nodes).find(n => n.id === nodeId);
    if (!node) return;

    const isFirstClear = !progress.clearedNodes.includes(node.id);
    if (isFirstClear) {
      progress.clearedNodes.push(node.id);
      saveProgress();

      // Grant rewards
      if (typeof addBux === 'function') addBux(node.rewards.bux);
      if (typeof loadPlayerXP === 'function' && typeof savePlayerXP === 'function') {
        savePlayerXP(loadPlayerXP() + node.rewards.xp);
      }

      if (typeof showToast === 'function') {
        showToast(`🎉 Story Victory! +${node.rewards.bux} Bux, +${node.rewards.xp} XP earned!`, 4000);
      }
    }
  }

  function setChapter(chapterIdx) {
    currentChapterIdx = Math.max(0, Math.min(CHAPTERS.length - 1, chapterIdx));
    const ch = CHAPTERS[currentChapterIdx];
    const defaultNode = ch.nodes.find(n => isNodeUnlocked(n) && !isNodeCleared(n.id)) || ch.nodes[0];
    selectStoryNode(defaultNode);
    updateChapterTabs();
  }

  function updateChapterTabs() {
    const container = document.getElementById('story-chapter-tabs');
    if (!container) return;

    container.innerHTML = CHAPTERS.map((ch, idx) => {
      const isActive = idx === currentChapterIdx;
      const isCleared = ch.nodes.every(n => isNodeCleared(n.id));
      return `
        <button type="button" class="story-ch-tab ${isActive ? 'active' : ''}" data-ch-idx="${idx}">
          <span>${ch.title.split(':')[0]}</span>
          ${isCleared ? '<span class="ch-badge">✓</span>' : ''}
        </button>
      `;
    }).join('');

    container.querySelectorAll('.story-ch-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.chIdx);
        setChapter(idx);
      });
    });
  }

  function openStoryScreen() {
    loadProgress();
    if (typeof showScreen === 'function') {
      showScreen('screen-story-mode');
    }
    const canvasEl = document.getElementById('story-2d5-canvas');
    if (canvasEl) {
      if (!canvas || canvas !== canvasEl) {
        initCanvas(canvasEl);
      } else {
        resizeCanvas();
      }
    }
    // Measure DOM after layout transition
    setTimeout(() => {
      resizeCanvas();
    }, 60);

    updateChapterTabs();
    renderDailyBountyBanner();
    const ch = CHAPTERS[currentChapterIdx];
    const targetNode = ch.nodes.find(n => n.id === progress.selectedNodeId) || ch.nodes[0];
    selectStoryNode(targetNode);
  }

  return {
    getChapters: () => CHAPTERS,
    loadProgress,
    saveProgress,
    isNodeCleared,
    isNodeUnlocked,
    openStoryScreen,
    setChapter,
    handleStoryBattleVictory,
    launchStoryBattle
  };
})();

if (typeof window !== 'undefined') {
  window.StoryMode = StoryMode;
}
