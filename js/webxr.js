// ---- WebXR Immersive 3D Cyber Arena for Quest 3 & Desktop -----------------

let xrScene, xrCamera, xrRenderer, xrControls;
let xrControllers = [];
let xrBoardSlots = []; // { mesh, type, slotIndex }
let xrHandCards = [];  // { mesh, card, handIndex }
let xrBoardCards = []; // { mesh, card, owner, slot }
let xrReadyButton = null;
let xrInteractiveGroup; // Group for raycastable elements
let selectedHandIndex = null;
let selectedBoardSlot = null; // { owner, slotIndex }
let lastXRSyncTime = 0;
let xrActiveTheme = 'prism';
let xrViewMode = 'menu'; // 'menu' | 'match' | 'shop' | 'collection' | 'stats'
let xrMenuButtons = [];

let xrSkyboxSphere = null;
let xrHandLight = null;
let xrAmbientLight = null;
let xrKeyLight = null;
let xrFillLight = null;
let xrFloorMeshes = [];
let xrWallMeshes = [];
let xrFloorMaterial = null;
let xrWallMaterial = null;
let xrHubRugMesh = null;
let xrThemeParticleGroup = null;
let xrThemeParticleData = [];
let xrTeleportPads = [];
let xrHubDustMotes = null;

let xrShopPacks = [];
let xrGrabbedPack = null;
let xrSelectedPackForCheckout = null;
let xrCheckoutDropZoneMesh = null;
let xrCheckoutScannerMesh = null;
let xrCheckoutScreenMesh = null;
let xrCheckoutDropPos = new THREE.Vector3(11.5, 0.42, -6.8);
let xrFloatingRewardCards = [];

// Pointer raycaster for mouse input
const xrRaycaster = new THREE.Raycaster();
const xrMouse = new THREE.Vector2();

function getThemeColorPalette(overrideTheme) {
  const theme = overrideTheme || localStorage.getItem('mehrbod-cards-theme') || 'prism';
  xrActiveTheme = theme;

  const palettes = {
    prism:      { primary: 0x00f3ff, accent: 0xa855f7, bg: 0x090514, table: 0x120a2a, grid: 0x00f3ff, wall: 0x2e1065, emissive: 0x9333ea, name: '💎 Prism Core' },
    darkmatter: { primary: 0xa855f7, accent: 0x06b6d4, bg: 0x070412, table: 0x100824, grid: 0xa855f7, wall: 0x3b0764, emissive: 0x7c3aed, name: '🔮 Dark Matter' },
    cyberneon:  { primary: 0x00f3ff, accent: 0xff00cc, bg: 0x060814, table: 0x0c1024, grid: 0x00f3ff, wall: 0x1e293b, emissive: 0x00f3ff, name: '🌆 Cyber Neon' },
    mrmoney:    { primary: 0x10b981, accent: 0xf59e0b, bg: 0x022c22, table: 0x064e3b, grid: 0x10b981, wall: 0x065f46, emissive: 0x059669, name: '💸 Mr Money' },
    magma:      { primary: 0xf97316, accent: 0xef4444, bg: 0x180503, table: 0x2a0805, grid: 0xf97316, wall: 0x7c2d12, emissive: 0xff3700, name: '🌋 Magma Core' },
    flame:      { primary: 0x38bdf8, accent: 0xf97316, bg: 0x0a0c1b, table: 0x161332, grid: 0x38bdf8, wall: 0x1e1b4b, emissive: 0x0284c7, name: '🔥 Azure Flame' },
    inferno:    { primary: 0xf59e0b, accent: 0xd97706, bg: 0x1c0d02, table: 0x361a04, grid: 0xf59e0b, wall: 0x78350f, emissive: 0xd97706, name: '🔥 Solar Inferno' },
    solar:      { primary: 0xfbbf24, accent: 0xf97316, bg: 0x1f1304, table: 0x382006, grid: 0xfbbf24, wall: 0x78350f, emissive: 0xf59e0b, name: '☀️ Solar Flare' },
    synthwave:  { primary: 0xec4899, accent: 0x06b6d4, bg: 0x110e2e, table: 0x1f194c, grid: 0xec4899, wall: 0x4c1d95, emissive: 0xdb2777, name: '⚡ Synthwave' },
    matrix:     { primary: 0x10b981, accent: 0x34d399, bg: 0x02140a, table: 0x052e16, grid: 0x10b981, wall: 0x064e3b, emissive: 0x10b981, name: '🟢 Digital Matrix' },
    galaxy:     { primary: 0x8b5cf6, accent: 0x38bdf8, bg: 0x0b0726, table: 0x180f4a, grid: 0x8b5cf6, wall: 0x3b0764, emissive: 0x7c3aed, name: '✨ Deep Space Galaxy' },
    astral:     { primary: 0xa78bfa, accent: 0x38bdf8, bg: 0x0e092b, table: 0x1c124e, grid: 0xa78bfa, wall: 0x4c1d95, emissive: 0x8b5cf6, name: '🌌 Astral Plane' },
    sakura:     { primary: 0xf472b6, accent: 0xfbbf24, bg: 0x1f0b18, table: 0x3b152e, grid: 0xf472b6, wall: 0x831843, emissive: 0xdb2777, name: '🌸 Sakura Blossom' },
    valentine:  { primary: 0xf43f5e, accent: 0xfbcfe8, bg: 0x240816, table: 0x421028, grid: 0xf43f5e, wall: 0x881337, emissive: 0xe11d48, name: '💖 Valentine Rose' },
    aurora:     { primary: 0x2dd4bf, accent: 0x818cf8, bg: 0x041820, table: 0x0a2f3d, grid: 0x2dd4bf, wall: 0x134e4a, emissive: 0x0d9488, name: '🌌 Northern Aurora' },
    glacier:    { primary: 0x38bdf8, accent: 0xa5f3fc, bg: 0x041b29, table: 0x0a334e, grid: 0x38bdf8, wall: 0x0e4e6f, emissive: 0x0284c7, name: '❄️ Sub-Zero Glacier' },
    abyss:      { primary: 0x06b6d4, accent: 0x14b8a6, bg: 0x021721, table: 0x052d3d, grid: 0x06b6d4, wall: 0x083344, emissive: 0x0891b2, name: '🌊 Abyssal Trench' },
    steampunk:  { primary: 0xd97706, accent: 0xb45309, bg: 0x1c1008, table: 0x321d0e, grid: 0xd97706, wall: 0x78350f, emissive: 0xb45309, name: '⚙️ Brass Steampunk' },
    verdant:    { primary: 0x22c55e, accent: 0x86efac, bg: 0x081c0c, table: 0x0f3417, grid: 0x22c55e, wall: 0x14532d, emissive: 0x16a34a, name: '🌿 Verdant Grove' },
    storm:      { primary: 0x60a5fa, accent: 0x818cf8, bg: 0x0c1322, table: 0x16233d, grid: 0x60a5fa, wall: 0x1e293b, emissive: 0x2563eb, name: '⚡ Tempests Storm' },
    sovereign:  { primary: 0xf59e0b, accent: 0xa855f7, bg: 0x170b28, table: 0x2b1548, grid: 0xf59e0b, wall: 0x3b0764, emissive: 0x7e22ce, name: '👑 Sovereign Gold' },
    pink:       { primary: 0xf472b6, accent: 0xfda4af, bg: 0x220b18, table: 0x3d142b, grid: 0xf472b6, wall: 0x831843, emissive: 0xdb2777, name: '🎀 Rose Crystal' },
    quantum:    { primary: 0xa855f7, accent: 0x06b6d4, bg: 0x0d0722, table: 0x190e3d, grid: 0xa855f7, wall: 0x3b0764, emissive: 0x9333ea, name: '⚛️ Quantum Grid' },
    celestial:  { primary: 0xfacc15, accent: 0xfef08a, bg: 0x1f1807, table: 0x3d3010, grid: 0xfacc15, wall: 0x713f12, emissive: 0xca8a04, name: '✨ Divine Celestial' },
    dark:       { primary: 0xf59e0b, accent: 0xd97706, bg: 0x140d07, table: 0x29180d, grid: 0xf59e0b, wall: 0x451a03, emissive: 0x000000, name: '🍺 Dark Oak Tavern' },
    light:      { primary: 0x0284c7, accent: 0xf59e0b, bg: 0x2a2218, table: 0x4a3b2a, grid: 0x0284c7, wall: 0x5c4d38, emissive: 0x000000, name: '☀️ Sunlit Timber' },
  };

  return palettes[theme] || palettes.prism;
}

function getXRContainerDimensions() {
  const container = document.getElementById('webxr-canvas-container');
  let width = container ? container.clientWidth : 0;
  let height = container ? container.clientHeight : 0;
  if (!width || width < 100) {
    width = window.innerWidth || 1200;
  }
  if (!height || height < 100) {
    height = window.innerHeight || 800;
  }
  return { width, height };
}

function showXRArenaScreen() {
  const screen = document.getElementById('screen-webxr-arena');
  if (screen) {
    screen.style.display = 'flex';
  }
  if (typeof showScreen === 'function') {
    showScreen('screen-webxr-arena');
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    screen?.classList.remove('hidden');
  }
  
  initThreeJS();
  onXRWindowResize();
  if (typeof setupMobileVRHubJoystickUI === 'function') {
    setupMobileVRHubJoystickUI();
  }

  // Defer resizing to let browser compute flex/dimensions layout
  setTimeout(() => {
    onXRWindowResize();
  }, 50);
  setTimeout(() => {
    onXRWindowResize();
  }, 150);
  setTimeout(() => {
    onXRWindowResize();
  }, 400);
}

function initThreeJS() {
  const container = document.getElementById('webxr-canvas-container');
  if (!container) return;
  if (xrRenderer) {
    if (!container.contains(xrRenderer.domElement)) {
      container.innerHTML = '';
      container.appendChild(xrRenderer.domElement);
    }
    onXRWindowResize();
    return;
  }

  const dim = getXRContainerDimensions();
  const palette = getThemeColorPalette();

  // Create scene
  xrScene = new THREE.Scene();
  xrScene.background = new THREE.Color(palette.bg);
  xrScene.fog = new THREE.FogExp2(palette.bg, 0.07);

  // Group to hold all interactive 3D board pieces
  xrInteractiveGroup = new THREE.Group();
  xrScene.add(xrInteractiveGroup);

  // Create camera
  xrCamera = new THREE.PerspectiveCamera(65, dim.width / dim.height, 0.1, 100);
  xrCamera.position.set(0, 2.8, 4.2); // Stood at edge of virtual table looking down

  // Create renderer
  xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  xrRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  xrRenderer.setSize(dim.width, dim.height);
  xrRenderer.xr.enabled = true;
  if (typeof xrRenderer.xr.setReferenceSpaceType === 'function') {
    try {
      xrRenderer.xr.setReferenceSpaceType('local-floor');
    } catch (_) {}
  }
  container.innerHTML = '';
  container.appendChild(xrRenderer.domElement);

  // Orbit controls for desktop preview
  xrControls = new THREE.OrbitControls(xrCamera, xrRenderer.domElement);
  xrControls.enableDamping = true;
  xrControls.dampingFactor = 0.05;
  xrControls.maxPolarAngle = Math.PI / 2 - 0.02;
  xrControls.minDistance = 1.8;
  xrControls.maxDistance = 14;
  xrControls.target.set(0, 0.5, 0);

  // Lights
  xrAmbientLight = new THREE.AmbientLight(0xffffff, 0.45);
  xrScene.add(xrAmbientLight);

  xrKeyLight = new THREE.DirectionalLight(palette.primary, 0.85);
  xrKeyLight.position.set(5, 10, 5);
  xrScene.add(xrKeyLight);

  xrFillLight = new THREE.DirectionalLight(palette.accent, 0.6);
  xrFillLight.position.set(-5, 5, -5);
  xrScene.add(xrFillLight);

  // Controller / Hand Dynamic Point Light
  xrHandLight = new THREE.PointLight(palette.primary, 1.8, 9.0);
  xrHandLight.position.set(0, 1.5, 1.0);
  xrScene.add(xrHandLight);

  // Build full 3D theme environment
  buildCyberArena();

  setupXRButton();
  setupXRControllers();

  window.addEventListener('resize', onXRWindowResize);
  xrRenderer.domElement.addEventListener('pointerdown', onXRPointerDown);

  // Apply initial active theme visuals
  updateXRTheme(palette.name ? xrActiveTheme : 'prism');

  xrRenderer.setAnimationLoop(animateXR);
}

function onXRWindowResize() {
  const container = document.getElementById('webxr-canvas-container');
  if (!container || !xrCamera || !xrRenderer) return;
  const dim = getXRContainerDimensions();
  xrCamera.aspect = dim.width / dim.height;
  xrCamera.updateProjectionMatrix();
  xrRenderer.setSize(dim.width, dim.height);
}

// ---- Dynamic Theme Procedural Texture Generators & Particle Engines --------

function createThemeFloorTexture(theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (theme === 'magma') {
    // Volcanic Basalt Rock with Glowing Molten Fissures & Lava Bubbles
    ctx.fillStyle = '#0e0403';
    ctx.fillRect(0, 0, 512, 512);

    // Basalt jagged stone slab tiles
    for (let x = 0; x < 512; x += 128) {
      for (let y = 0; y < 512; y += 128) {
        ctx.fillStyle = (Math.random() > 0.5) ? '#1f0906' : '#150604';
        ctx.fillRect(x + 3, y + 3, 122, 122);
      }
    }

    // Glowing subterranean lava fissures & glowing veins
    const drawCrack = (x1, y1, x2, y2, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 45;
      const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 45;
      ctx.lineTo(midX, midY);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // Deep wide orange thermal glow under cracks
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ff4500';
    for (let i = 0; i < 18; i++) {
      const rx1 = Math.random() * 512;
      const ry1 = Math.random() * 512;
      const rx2 = rx1 + (Math.random() - 0.5) * 160;
      const ry2 = ry1 + (Math.random() - 0.5) * 160;
      drawCrack(rx1, ry1, rx2, ry2, 'rgba(255, 60, 0, 0.85)', 10);
      drawCrack(rx1, ry1, rx2, ry2, 'rgba(255, 140, 0, 0.95)', 5);
      drawCrack(rx1, ry1, rx2, ry2, 'rgba(255, 240, 100, 1.0)', 2);
    }
    ctx.shadowBlur = 0;

    // Bubbling molten lava pools
    for (let i = 0; i < 8; i++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      const grad = ctx.createRadialGradient(px, py, 4, px, py, 26);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#ffe600');
      grad.addColorStop(0.65, '#ff4500');
      grad.addColorStop(1, 'rgba(20, 5, 2, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'glacier') {
    // Translucent Frosted Sub-Zero Ice with Crystalline Fractures
    ctx.fillStyle = '#041b29';
    ctx.fillRect(0, 0, 512, 512);

    // Deep glacial ice sheets
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#08334c' : '#06283d';
      ctx.fillRect(0, y, 512, 60);
    }

    // Ice crystal branched fractals & frost lines
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 14; i++) {
      const sx = Math.random() * 512;
      const sy = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let s = 0; s < 4; s++) {
        ctx.lineTo(sx + (Math.random() - 0.5) * 80, sy + (Math.random() - 0.5) * 80);
      }
      ctx.stroke();
    }

    // Glowing cyan sub-surface light veins
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (theme === 'cyberneon' || theme === 'synthwave' || theme === 'matrix') {
    // High-Tech Carbon Composite with Glowing Neon Circuit Grid
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, 512, 512);

    // Hex / Square carbon fiber texture
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 0; y < 512; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }

    // Bright glowing neon power bus lines & cyber traces
    const primaryNeon = (theme === 'synthwave') ? '#ec4899' : (theme === 'matrix' ? '#10b981' : '#00f3ff');
    const accentNeon = (theme === 'synthwave') ? '#06b6d4' : (theme === 'matrix' ? '#34d399' : '#ff00a0');

    ctx.strokeStyle = primaryNeon;
    ctx.lineWidth = 3;
    for (let x = 64; x < 512; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 64; y < 512; y += 128) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }

    // Node vertices
    for (let x = 64; x < 512; x += 128) {
      for (let y = 64; y < 512; y += 128) {
        ctx.fillStyle = accentNeon;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (theme === 'galaxy' || theme === 'astral' || theme === 'aurora') {
    // Deep Space Midnight Indigo with Starfield and Nebula Swirls
    ctx.fillStyle = '#060318';
    ctx.fillRect(0, 0, 512, 512);

    // Nebula dust gradient clouds
    const g1 = ctx.createRadialGradient(160, 160, 10, 160, 160, 220);
    g1.addColorStop(0, 'rgba(139, 92, 246, 0.45)');
    g1.addColorStop(0.7, 'rgba(56, 189, 248, 0.25)');
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, 512, 512);

    const g2 = ctx.createRadialGradient(380, 360, 10, 380, 360, 200);
    g2.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
    g2.addColorStop(0.6, 'rgba(147, 51, 234, 0.2)');
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, 512, 512);

    // Glowing star nodes & constellation lines
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
    ctx.lineWidth = 1.5;
    const starCoords = [[80, 120], [180, 80], [290, 150], [420, 100], [460, 240], [350, 340], [210, 410], [90, 350], [256, 256]];
    ctx.beginPath();
    ctx.moveTo(starCoords[0][0], starCoords[0][1]);
    for (let s = 1; s < starCoords.length; s++) {
      ctx.lineTo(starCoords[s][0], starCoords[s][1]);
    }
    ctx.stroke();

    starCoords.forEach(([sx, sy]) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Random star dust
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#e0e7ff' : '#c084fc';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  } else if (theme === 'verdant') {
    // Ancient Druidic Flagstones with Glowing Emerald Moss & Creeping Vines
    ctx.fillStyle = '#08170c';
    ctx.fillRect(0, 0, 512, 512);

    for (let x = 0; x < 512; x += 128) {
      for (let y = 0; y < 512; y += 128) {
        ctx.fillStyle = (Math.random() > 0.5) ? '#122e18' : '#0d2212';
        ctx.fillRect(x + 2, y + 2, 124, 124);
      }
    }

    // Glowing green moss & nature rune veins
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'steampunk') {
    // Industrial Riveted Brass & Bronze Plates with Mechanical Gear Etchings
    ctx.fillStyle = '#221307';
    ctx.fillRect(0, 0, 512, 512);

    for (let x = 0; x < 512; x += 128) {
      for (let y = 0; y < 512; y += 128) {
        ctx.fillStyle = (Math.random() > 0.5) ? '#38200d' : '#2d1809';
        ctx.fillRect(x + 2, y + 2, 124, 124);

        // Corner brass rivets
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(x + 12, y + 12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 116, y + 12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 12, y + 116, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 116, y + 116, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Interlocking copper gear outlines
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
    ctx.lineWidth = 2.5;
    [ [128, 128], [384, 128], [256, 256], [128, 384], [384, 384] ].forEach(([gx, gy]) => {
      ctx.beginPath(); ctx.arc(gx, gy, 36, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(gx, gy, 12, 0, Math.PI * 2); ctx.stroke();
    });
  } else if (theme === 'prism' || theme === 'darkmatter') {
    // Dark Diamond Obsidian Facets with Rainbow Chromatic Dispersion Caustics
    ctx.fillStyle = '#080416';
    ctx.fillRect(0, 0, 512, 512);

    for (let x = 0; x < 512; x += 64) {
      for (let y = 0; y < 512; y += 64) {
        ctx.fillStyle = ((x + y) / 64) % 2 === 0 ? '#150a32' : '#0e0622';
        ctx.fillRect(x + 1, y + 1, 62, 62);
      }
    }

    // Prismatic spectral line reflections
    const spectralColors = ['rgba(0, 243, 255, 0.8)', 'rgba(168, 85, 247, 0.8)', 'rgba(244, 63, 94, 0.8)', 'rgba(251, 191, 36, 0.8)'];
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = spectralColors[i % spectralColors.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      const ox = Math.random() * 512;
      const oy = Math.random() * 512;
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 90, oy - 90);
      ctx.stroke();
    }
  } else if (theme === 'sakura' || theme === 'valentine' || theme === 'pink') {
    // Polished Ebony Rosewood with Scattered Cherry Blossom Petals
    ctx.fillStyle = '#1c0915';
    ctx.fillRect(0, 0, 512, 512);

    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#2c1022' : '#220b1a';
      ctx.fillRect(0, y, 512, 60);
    }

    // Cherry blossom petal shapes scattered
    for (let i = 0; i < 28; i++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      ctx.fillStyle = (i % 2 === 0) ? '#f472b6' : '#fb7185';
      ctx.beginPath();
      ctx.ellipse(px, py, 10, 6, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'mrmoney' || theme === 'sovereign') {
    // Luxury Emerald Casino Velvet & Inlaid Gold Coin Medallions
    ctx.fillStyle = (theme === 'sovereign') ? '#180a2b' : '#02241b';
    ctx.fillRect(0, 0, 512, 512);

    for (let x = 0; x < 512; x += 128) {
      for (let y = 0; y < 512; y += 128) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 4, 120, 120);

        // Gold coin center
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(x + 64, y + 64, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('$', x + 64, y + 70);
      }
    }
  } else {
    // Default / Dark Oak Tavern Planks
    return createWoodPlankTexture();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function createThemeWallTexture(theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (theme === 'magma') {
    ctx.fillStyle = '#140503';
    ctx.fillRect(0, 0, 512, 512);
    const rowH = 48;
    for (let y = 0; y < 512; y += rowH) {
      const isShift = (y / rowH) % 2 === 1;
      const brickW = 96;
      for (let x = isShift ? -48 : 0; x < 512 + 48; x += brickW) {
        ctx.fillStyle = (Math.random() > 0.5) ? '#280c07' : '#1e0805';
        ctx.fillRect(x + 2, y + 2, brickW - 4, rowH - 4);
        ctx.fillStyle = '#ff4500';
        ctx.fillRect(x, y + rowH - 2, brickW, 2);
      }
    }
  } else if (theme === 'glacier') {
    ctx.fillStyle = '#061f2e';
    ctx.fillRect(0, 0, 512, 512);
    const rowH = 48;
    for (let y = 0; y < 512; y += rowH) {
      const isShift = (y / rowH) % 2 === 1;
      const brickW = 96;
      for (let x = isShift ? -48 : 0; x < 512 + 48; x += brickW) {
        ctx.fillStyle = (Math.random() > 0.5) ? '#0f4464' : '#0a324b';
        ctx.fillRect(x + 2, y + 2, brickW - 4, rowH - 4);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x, y + rowH - 2, brickW, 1);
      }
    }
  } else if (theme === 'cyberneon' || theme === 'synthwave') {
    ctx.fillStyle = '#060914';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = '#0e162d';
      ctx.fillRect(4, y + 4, 504, 56);
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(4, y + 60, 504, 2);
    }
  } else {
    return createStoneWallTexture();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function createThemeSkyboxTexture(theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
  if (theme === 'magma') {
    grad.addColorStop(0, '#380d04');
    grad.addColorStop(0.5, '#200702');
    grad.addColorStop(1, '#0a0201');
  } else if (theme === 'glacier') {
    grad.addColorStop(0, '#0c3e5c');
    grad.addColorStop(0.5, '#052234');
    grad.addColorStop(1, '#021019');
  } else if (theme === 'cyberneon' || theme === 'synthwave') {
    grad.addColorStop(0, '#151b3b');
    grad.addColorStop(0.5, '#090d1f');
    grad.addColorStop(1, '#03050c');
  } else if (theme === 'galaxy' || theme === 'astral' || theme === 'aurora') {
    grad.addColorStop(0, '#1f0d3d');
    grad.addColorStop(0.5, '#0c041c');
    grad.addColorStop(1, '#04010a');
  } else if (theme === 'verdant') {
    grad.addColorStop(0, '#13381a');
    grad.addColorStop(0.5, '#081c0d');
    grad.addColorStop(1, '#030a05');
  } else {
    grad.addColorStop(0, '#2e180c');
    grad.addColorStop(0.5, '#1e0e06');
    grad.addColorStop(1, '#0d0502');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  return new THREE.CanvasTexture(canvas);
}

function updateThemeRug(theme) {
  if (!xrHubRugMesh) return;
  const rugCanvas = document.createElement('canvas');
  rugCanvas.width = 256;
  rugCanvas.height = 256;
  const rCtx = rugCanvas.getContext('2d');

  const palette = getThemeColorPalette(theme);

  rCtx.fillStyle = '#' + palette.bg.toString(16).padStart(6, '0');
  rCtx.beginPath();
  rCtx.arc(128, 128, 120, 0, Math.PI * 2);
  rCtx.fill();

  rCtx.strokeStyle = '#' + palette.primary.toString(16).padStart(6, '0');
  rCtx.lineWidth = 10;
  rCtx.stroke();

  rCtx.fillStyle = '#ffffff';
  rCtx.font = 'bold 20px Arial';
  rCtx.textAlign = 'center';
  rCtx.fillText(palette.name || '🍺 TAVERN COMMONS 🃏', 128, 135);

  xrHubRugMesh.material.map = new THREE.CanvasTexture(rugCanvas);
  xrHubRugMesh.material.needsUpdate = true;
}

function buildTheme3DParticles(theme) {
  if (xrThemeParticleGroup) {
    xrScene.remove(xrThemeParticleGroup);
  }
  xrThemeParticleGroup = new THREE.Group();
  xrThemeParticleData = [];
  xrScene.add(xrThemeParticleGroup);

  const chambers = [
    { x: 0, z: 0 },       // Central Atrium
    { x: 0, z: -11.5 },   // Battle Hall
    { x: -11.5, z: -5.5 },// Collection Library
    { x: 11.5, z: -5.5 }, // Tavern Shop
    { x: 8.5, z: 8.5 },   // Fortune Cellar
    { x: -8.5, z: 8.5 }   // Hall of Honor
  ];

  const particleCountPerChamber = 10;

  chambers.forEach(ch => {
    for (let i = 0; i < particleCountPerChamber; i++) {
      let mesh = null;
      let vy = 0.01;
      let vx = (Math.random() - 0.5) * 0.003;
      let vz = (Math.random() - 0.5) * 0.003;
      let rotSpeed = 0.01;

      if (theme === 'magma') {
        // Glowing hot magma embers rising from floor
        const radius = 0.05 + Math.random() * 0.08;
        const color = (Math.random() > 0.4) ? 0xff4500 : (Math.random() > 0.5 ? 0xff9900 : 0xef4444);
        const geom = new THREE.SphereGeometry(radius, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color });
        mesh = new THREE.Mesh(geom, mat);
        vy = 0.012 + Math.random() * 0.018; // Rising heat
      } else if (theme === 'glacier') {
        // Crystalline ice flakes drifting down
        const size = 0.08 + Math.random() * 0.1;
        const geom = new THREE.OctahedronGeometry(size, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.85 });
        mesh = new THREE.Mesh(geom, mat);
        vy = -0.008 - Math.random() * 0.012; // Falling snow
        rotSpeed = 0.03;
      } else if (theme === 'cyberneon' || theme === 'synthwave') {
        // Holographic wireframe digital cubes
        const size = 0.07 + Math.random() * 0.09;
        const color = (Math.random() > 0.5) ? 0x00f3ff : 0xff00cc;
        const geom = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
        mesh = new THREE.Mesh(geom, mat);
        vy = 0.008 + Math.random() * 0.014;
        rotSpeed = 0.04;
      } else if (theme === 'sakura' || theme === 'valentine') {
        // Falling pink cherry blossom petals
        const geom = new THREE.PlaneGeometry(0.12, 0.08);
        const color = (Math.random() > 0.5) ? 0xf472b6 : 0xfb7185;
        const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geom, mat);
        vy = -0.006 - Math.random() * 0.008;
        rotSpeed = 0.035;
      } else if (theme === 'verdant') {
        // Glowing nature spores
        const radius = 0.04 + Math.random() * 0.06;
        const geom = new THREE.SphereGeometry(radius, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x86efac });
        mesh = new THREE.Mesh(geom, mat);
        vy = (Math.random() - 0.5) * 0.004;
      } else if (theme === 'galaxy' || theme === 'astral' || theme === 'aurora') {
        // Cosmic star motes
        const size = 0.05 + Math.random() * 0.07;
        const color = (Math.random() > 0.5) ? 0xa78bfa : 0x38bdf8;
        const geom = new THREE.TetrahedronGeometry(size, 0);
        const mat = new THREE.MeshBasicMaterial({ color });
        mesh = new THREE.Mesh(geom, mat);
        vy = (Math.random() - 0.5) * 0.006;
        rotSpeed = 0.02;
      } else {
        // Ambient golden tavern motes
        const radius = 0.04 + Math.random() * 0.05;
        const geom = new THREE.SphereGeometry(radius, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.75 });
        mesh = new THREE.Mesh(geom, mat);
        vy = (Math.random() - 0.5) * 0.005;
      }

      const px = ch.x + (Math.random() - 0.5) * 6.5;
      const py = Math.random() * 3.8;
      const pz = ch.z + (Math.random() - 0.5) * 6.5;
      mesh.position.set(px, py, pz);

      xrThemeParticleGroup.add(mesh);
      xrThemeParticleData.push({
        mesh,
        originX: ch.x,
        originZ: ch.z,
        vx,
        vy,
        vz,
        rotSpeed
      });
    }
  });
}

function updateXRTheme(themeName) {
  if (!xrScene) return;
  const theme = themeName || localStorage.getItem('mehrbod-cards-theme') || 'prism';
  xrActiveTheme = theme;
  const palette = getThemeColorPalette(theme);

  // 1. Update Scene Background and Fog
  if (xrScene.background) xrScene.background.setHex(palette.bg);
  if (xrScene.fog) xrScene.fog.color.setHex(palette.bg);

  // 2. Update Lights
  if (xrKeyLight) xrKeyLight.color.setHex(palette.primary);
  if (xrFillLight) xrFillLight.color.setHex(palette.accent);
  if (xrHandLight) xrHandLight.color.setHex(palette.primary);
  if (xrFireplaceLight) {
    if (theme === 'glacier') xrFireplaceLight.color.setHex(0x38bdf8);
    else if (theme === 'cyberneon' || theme === 'synthwave') xrFireplaceLight.color.setHex(0x00f3ff);
    else if (theme === 'galaxy' || theme === 'astral') xrFireplaceLight.color.setHex(0x8b5cf6);
    else if (theme === 'verdant') xrFireplaceLight.color.setHex(0x22c55e);
    else if (theme === 'abyss') xrFireplaceLight.color.setHex(0x06b6d4);
    else if (theme === 'flame') xrFireplaceLight.color.setHex(0x00d2ff);
    else xrFireplaceLight.color.setHex(0xff6600);
  }

  // 3. Update Skybox / Ceiling Dome
  if (xrSkyboxSphere) {
    const skyTex = createThemeSkyboxTexture(theme);
    xrSkyboxSphere.material.map = skyTex;
    xrSkyboxSphere.material.needsUpdate = true;
  }

  // 4. Create and Apply New Floor & Wall Materials
  const floorTex = createThemeFloorTexture(theme);
  const wallTex = createThemeWallTexture(theme);

  let floorEmissive = palette.emissive || 0x000000;
  let floorEmissiveIntensity = floorEmissive !== 0 ? 0.35 : 0;
  let floorRoughness = (theme === 'glacier' || theme === 'prism') ? 0.2 : 0.7;
  let floorMetalness = (theme === 'cyberneon' || theme === 'steampunk' || theme === 'prism') ? 0.5 : 0.1;

  xrFloorMaterial = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: floorRoughness,
    metalness: floorMetalness,
    emissive: floorEmissive,
    emissiveIntensity: floorEmissiveIntensity
  });

  xrWallMaterial = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.8,
    metalness: theme === 'steampunk' ? 0.4 : 0.05
  });

  xrFloorMeshes.forEach(mesh => {
    if (mesh) {
      mesh.material = xrFloorMaterial;
      mesh.material.needsUpdate = true;
    }
  });

  xrWallMeshes.forEach(mesh => {
    if (mesh) {
      mesh.material = xrWallMaterial;
      mesh.material.needsUpdate = true;
    }
  });

  // 5. Update Tavern Commons Rug
  updateThemeRug(theme);

  // 6. Build Theme-Specific 3D Particle Atmosphere
  buildTheme3DParticles(theme);
}

// Expose updateXRTheme globally so applyTheme() can invoke it anytime
window.updateXRTheme = updateXRTheme;

// Legacy wood / stone fallback textures for initial bootstrap
function createWoodPlankTexture() {
  return createThemeFloorTexture('dark');
}

function createStoneWallTexture() {
  return createThemeWallTexture('dark');
}

let xrFireplaceLight = null;

function buildTavernSkyboxAndCeiling() {
  if (xrSkyboxSphere) xrScene.remove(xrSkyboxSphere);

  const skyGeom = new THREE.SphereGeometry(38, 32, 32);
  const tex = createThemeSkyboxTexture(xrActiveTheme || 'prism');
  const skyMat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.98
  });
  xrSkyboxSphere = new THREE.Mesh(skyGeom, skyMat);
  xrScene.add(xrSkyboxSphere);
}

function buildTeleportPads() {
  xrTeleportPads.forEach(p => {
    if (p.mesh) xrInteractiveGroup.remove(p.mesh);
    if (p.iconMesh) xrInteractiveGroup.remove(p.iconMesh);
  });
  xrTeleportPads = [];

  const padDefs = [
    { id: 'teleport_hub', label: '📍 TAVERN COMMONS', pos: [0, -0.48, 1.2], targetLook: [0, 0.8, -1.0] },
    { id: 'teleport_battle', label: '⚔️ BATTLE HALL', pos: [0, -0.48, -9.6], targetLook: [0, 0.4, -11.5] },
    { id: 'teleport_shop', label: '🍻 TAVERN SHOP & BAR', pos: [11.5, -0.48, -4.2], targetLook: [11.5, 0.8, -5.5] },
    { id: 'teleport_collection', label: '📜 GUILD COLLECTION', pos: [-11.5, -0.48, -4.2], targetLook: [-11.5, 0.8, -5.5] },
    { id: 'teleport_stats', label: '🏆 HALL OF HONOR', pos: [-8.5, -0.48, 7.2], targetLook: [-8.5, 0.8, 8.5] },
    { id: 'teleport_rewards', label: '🎁 FORTUNE CELLAR', pos: [8.5, -0.48, 7.2], targetLook: [8.5, 0.8, 8.5] },
  ];

  padDefs.forEach(def => {
    // Brass / Rune Ring Floor Pad
    const geom = new THREE.RingGeometry(0.42, 0.58, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(...def.pos);
    mesh.name = def.id;

    const iconCanvas = document.createElement('canvas');
    iconCanvas.width = 200;
    iconCanvas.height = 64;
    const iCtx = iconCanvas.getContext('2d');
    iCtx.fillStyle = 'rgba(28, 19, 12, 0.95)';
    iCtx.fillRect(0, 0, 200, 64);
    iCtx.strokeStyle = '#d97706';
    iCtx.lineWidth = 4;
    iCtx.strokeRect(2, 2, 196, 60);
    iCtx.fillStyle = '#fef3c7';
    iCtx.font = 'bold 15px Arial';
    iCtx.textAlign = 'center';
    iCtx.fillText(def.label, 100, 38);

    const iconMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.3),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(iconCanvas), side: THREE.DoubleSide, transparent: true })
    );
    iconMesh.rotation.x = -Math.PI / 2;
    iconMesh.position.set(def.pos[0], def.pos[1] + 0.02, def.pos[2]);
    iconMesh.name = def.id;

    xrInteractiveGroup.add(mesh);
    xrInteractiveGroup.add(iconMesh);
    xrTeleportPads.push({ mesh, iconMesh, targetPos: def.pos, targetLook: def.targetLook });
  });
}

function teleportToLocation(pos, targetLook = null) {
  if (xrCamera) {
    xrCamera.position.set(pos[0], pos[1] + 1.6, pos[2]);
    if (xrControls) {
      if (targetLook) {
        xrControls.target.set(targetLook[0], targetLook[1], targetLook[2]);
      } else {
        xrControls.target.set(pos[0], pos[1] + 0.5, pos[2] - 1.5);
      }
    }
  }
  if (typeof triggerHapticPulse === 'function') {
    triggerHapticPulse(null, 0.7, 150);
  }
  if (typeof Sound !== 'undefined' && Sound.place) {
    Sound.place();
  }
  if (typeof showToast === 'function') {
    showToast('📍 Teleported in Tavern Realm!', 1500);
  }
}

function buildHubDustMotes() {
  if (xrHubDustMotes) xrScene.remove(xrHubDustMotes);
  const count = 350;
  const geom = new THREE.BufferGeometry();
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 3) {
    posArr[i] = (Math.random() - 0.5) * 32;
    posArr[i + 1] = Math.random() * 4.5 + 0.2;
    posArr[i + 2] = (Math.random() - 0.5) * 32;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfcb352, size: 0.06, transparent: true, opacity: 0.75 });
  xrHubDustMotes = new THREE.Points(geom, mat);
  xrScene.add(xrHubDustMotes);
}

function updateHubDustMotes(camPos) {
  if (!xrHubDustMotes || !xrHubDustMotes.geometry) return;
  const posArr = xrHubDustMotes.geometry.attributes.position.array;
  for (let i = 0; i < posArr.length; i += 3) {
    posArr[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.0012;
    const dx = posArr[i] - camPos.x;
    const dz = posArr[i + 2] - camPos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < 1.8) {
      posArr[i] += dx * 0.006;
      posArr[i + 2] += dz * 0.006;
    }
  }
  xrHubDustMotes.geometry.attributes.position.needsUpdate = true;
}

// ---- Bustling Fantasy Tavern Environment Builder (5 Interconnected Chambers) --
let xrFortuneWheelMesh = null;
let xrFortuneWheelSpinning = false;
let xrFortuneWheelSpeed = 0;

function buildTavernEnvironment() {
  const palette = getThemeColorPalette();

  xrFloorMeshes = [];
  xrWallMeshes = [];

  // 1. Cozy Tavern Ceiling Enclosure & Skybox
  buildTavernSkyboxAndCeiling();

  const woodTex = createWoodPlankTexture();
  const stoneTex = createStoneWallTexture();
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7, metalness: 0.1 });
  const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x2e190d, roughness: 0.8 });

  // =========================================================================
  // CHAMBER 0: CENTRAL TAVERN COMMONS (ATRIUM) - Center: (0, 0, 0)
  // =========================================================================
  const hubFloor = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), floorMat);
  hubFloor.rotation.x = -Math.PI / 2;
  hubFloor.position.set(0, -0.5, 0);
  xrScene.add(hubFloor);
  xrFloorMeshes.push(hubFloor);

  // Central Braided Rug
  const rugCanvas = document.createElement('canvas');
  rugCanvas.width = 256;
  rugCanvas.height = 256;
  const rCtx = rugCanvas.getContext('2d');
  rCtx.fillStyle = '#7f1d1d';
  rCtx.beginPath();
  rCtx.arc(128, 128, 120, 0, Math.PI * 2);
  rCtx.fill();
  rCtx.strokeStyle = '#f59e0b';
  rCtx.lineWidth = 10;
  rCtx.stroke();
  rCtx.fillStyle = '#fef3c7';
  rCtx.font = 'bold 20px Arial';
  rCtx.textAlign = 'center';
  rCtx.fillText('🍺 TAVERN COMMONS 🃏', 128, 135);

  const rugMesh = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 32),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(rugCanvas), roughness: 0.9 })
  );
  rugMesh.rotation.x = -Math.PI / 2;
  rugMesh.position.set(0, -0.47, 0);
  xrScene.add(rugMesh);
  xrHubRugMesh = rugMesh;

  // 4 Grand Carved Timber Support Pillars
  const pillarGeom = new THREE.BoxGeometry(0.5, 4.8, 0.5);
  [
    [-2.8, 2.0, -2.8],
    [2.8, 2.0, -2.8],
    [-2.8, 2.0, 2.8],
    [2.8, 2.0, 2.8],
  ].forEach(([px, py, pz]) => {
    const pillar = new THREE.Mesh(pillarGeom, timberMat);
    pillar.position.set(px, py, pz);
    xrScene.add(pillar);
  });

  // Central Ceiling Timber Crossbeams
  const crossbeam1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 10.4), timberMat);
  crossbeam1.position.set(0, 4.3, 0);
  xrScene.add(crossbeam1);
  const crossbeam2 = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.45, 0.35), timberMat);
  crossbeam2.position.set(0, 4.3, 0);
  xrScene.add(crossbeam2);

  // Hanging Iron 8-Candle Chandelier (Commons)
  const ringGeom = new THREE.TorusGeometry(1.2, 0.05, 12, 32);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.8, roughness: 0.3 });
  const chandelier = new THREE.Mesh(ringGeom, ringMat);
  chandelier.rotation.x = Math.PI / 2;
  chandelier.position.set(0, 3.6, 0);
  xrScene.add(chandelier);

  const chLight = new THREE.PointLight(0xffaa33, 2.6, 16.0);
  chLight.position.set(0, 3.4, 0);
  xrScene.add(chLight);

  // Roaring Stone Fireplace Hearth on South Wall of Commons
  const fireplaceGroup = new THREE.Group();
  fireplaceGroup.position.set(0, 0.6, 4.8);
  xrScene.add(fireplaceGroup);

  const mantleGeom = new THREE.BoxGeometry(2.8, 1.8, 0.8);
  const mantleMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
  const mantle = new THREE.Mesh(mantleGeom, mantleMat);
  fireplaceGroup.add(mantle);

  const fireGeom = new THREE.ConeGeometry(0.45, 0.6, 8);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
  const fireMesh = new THREE.Mesh(fireGeom, fireMat);
  fireMesh.position.set(0, -0.2, -0.35);
  fireMesh.name = 'tavern_fire_mesh';
  fireplaceGroup.add(fireMesh);

  xrFireplaceLight = new THREE.PointLight(0xff6600, 2.6, 12.0);
  xrFireplaceLight.position.set(0, 0.5, 4.2);
  xrScene.add(xrFireplaceLight);

  // Cozy Tavern Round Tables & Stools in Commons
  [[-2.4, -0.5, 1.6], [2.4, -0.5, 1.6]].forEach(([tx, ty, tz]) => {
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 16), timberMat);
    tableTop.position.set(tx, ty + 0.6, tz);
    xrScene.add(tableTop);
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.6, 8), timberMat);
    tableLeg.position.set(tx, ty + 0.3, tz);
    xrScene.add(tableLeg);

    // Stools
    [-0.8, 0.8].forEach(sx => {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.38, 8), timberMat);
      stool.position.set(tx + sx, ty + 0.19, tz);
      xrScene.add(stool);
    });

    // Pewter Mug on table
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.7 }));
    mug.position.set(tx + 0.1, ty + 0.73, tz + 0.1);
    xrScene.add(mug);
  });

  // Crossroads Directional Signpost at Center of Commons
  const signpostGroup = new THREE.Group();
  signpostGroup.position.set(0, 0, 0.4);
  xrScene.add(signpostGroup);

  const postPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 12), timberMat);
  postPole.position.set(0, 0.6, 0);
  signpostGroup.add(postPole);

  const signDefs = [
    { text: '⬆ BATTLE HALL', rot: 0, y: 1.5 },
    { text: '↖ COLLECTION & QUESTS', rot: 0.65, y: 1.25 },
    { text: '↗ TAVERN SHOP & BAR', rot: -0.65, y: 1.0 },
    { text: '↙ HALL OF HONOR', rot: 2.35, y: 0.75 },
    { text: '↘ FORTUNE CELLAR', rot: -2.35, y: 0.5 },
  ];

  signDefs.forEach(s => {
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 256;
    sCanvas.height = 56;
    const sc = sCanvas.getContext('2d');
    sc.fillStyle = '#451a03';
    sc.fillRect(0, 0, 256, 56);
    sc.strokeStyle = '#f59e0b';
    sc.lineWidth = 3;
    sc.strokeRect(2, 2, 252, 52);
    sc.fillStyle = '#fef3c7';
    sc.font = 'bold 16px Arial';
    sc.textAlign = 'center';
    sc.fillText(s.text, 128, 35);

    const sMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sCanvas), side: THREE.DoubleSide })
    );
    sMesh.rotation.y = s.rot;
    sMesh.position.set(0, s.y, 0);
    signpostGroup.add(sMesh);
  });

  // =========================================================================
  // CORRIDOR 1 (NORTH) -> CHAMBER 1: "BATTLE HALL" - Center: (0, 0, -11.5)
  // =========================================================================
  // Corridor Floor
  const northHallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.5), floorMat);
  northHallFloor.rotation.x = -Math.PI / 2;
  northHallFloor.position.set(0, -0.5, -5.8);
  xrScene.add(northHallFloor);
  xrFloorMeshes.push(northHallFloor);

  // Corridor Side Walls
  const nWallLeft = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.5), wallMat);
  nWallLeft.rotation.y = Math.PI / 2;
  nWallLeft.position.set(-1.8, 1.75, -5.8);
  xrScene.add(nWallLeft);
  xrWallMeshes.push(nWallLeft);

  const nWallRight = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.5), wallMat);
  nWallRight.rotation.y = -Math.PI / 2;
  nWallRight.position.set(1.8, 1.75, -5.8);
  xrScene.add(nWallRight);
  xrWallMeshes.push(nWallRight);

  // Corridor Arch Overheads with Torches
  [-4.0, -6.5].forEach(z => {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 0.3), timberMat);
    arch.position.set(0, 3.8, z);
    xrScene.add(arch);

    // Wall Torch Sconces
    [-1.7, 1.7].forEach(x => {
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8), timberMat);
      torch.position.set(x, 2.0, z);
      xrScene.add(torch);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff7700 }));
      flame.position.set(x, 2.22, z);
      xrScene.add(flame);
      const torchLight = new THREE.PointLight(0xff8822, 1.2, 5.0);
      torchLight.position.set(x * 0.85, 2.2, z);
      xrScene.add(torchLight);
    });
  });

  // Battle Hall Room Floor (12m x 9m)
  const battleFloor = new THREE.Mesh(new THREE.PlaneGeometry(12.0, 9.0), floorMat);
  battleFloor.rotation.x = -Math.PI / 2;
  battleFloor.position.set(0, -0.5, -11.5);
  xrScene.add(battleFloor);
  xrFloorMeshes.push(battleFloor);

  // Battle Hall Stone Walls
  const bNorthWall = new THREE.Mesh(new THREE.PlaneGeometry(12.0, 5.5), wallMat);
  bNorthWall.position.set(0, 2.25, -16.0);
  xrScene.add(bNorthWall);
  xrWallMeshes.push(bNorthWall);

  const bWestWall = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.5), wallMat);
  bWestWall.rotation.y = Math.PI / 2;
  bWestWall.position.set(-6.0, 2.25, -11.5);
  xrScene.add(bWestWall);
  xrWallMeshes.push(bWestWall);

  const bEastWall = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.5), wallMat);
  bEastWall.rotation.y = -Math.PI / 2;
  bEastWall.position.set(6.0, 2.25, -11.5);
  xrScene.add(bEastWall);
  xrWallMeshes.push(bEastWall);

  // Battle Hall Overhead Chandelier
  const battleChandelier = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 12, 32), ringMat);
  battleChandelier.rotation.x = Math.PI / 2;
  battleChandelier.position.set(0, 4.4, -11.5);
  xrScene.add(battleChandelier);

  const battleLight = new THREE.PointLight(0xffc066, 2.8, 18.0);
  battleLight.position.set(0, 4.2, -11.5);
  xrScene.add(battleLight);

  // Heavy Oak Grand Battle Table at (0, -0.08, -11.5)
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, -0.08, -11.5);
  xrScene.add(tableGroup);

  const tableGeom = new THREE.BoxGeometry(5.2, 0.65, 2.8);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.6 });
  const table = new THREE.Mesh(tableGeom, tableMat);
  tableGroup.add(table);

  // Green Felt Playing Mat on Battle Table
  const feltGeom = new THREE.PlaneGeometry(4.8, 2.4);
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
  const felt = new THREE.Mesh(feltGeom, feltMat);
  felt.rotation.x = -Math.PI / 2;
  felt.position.set(0, 0.33, 0);
  tableGroup.add(felt);

  // Build 6 Player Slots & 6 Opponent Slots on Battle Table
  xrBoardSlots = [];
  const slotGeom = new THREE.PlaneGeometry(0.62, 0.92);
  const playerSlotMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const opponentSlotMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.35, side: THREE.DoubleSide });

  // 6 Player Slots (Front Row: z = -11.0)
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Mesh(slotGeom, playerSlotMat.clone());
    slot.rotation.x = -Math.PI / 2;
    slot.position.set((i - 2.5) * 0.72, 0.26, -11.0);
    slot.name = `slot_player_${i}`;
    xrInteractiveGroup.add(slot);
    xrBoardSlots.push({ mesh: slot, type: 'player', slotIndex: i });

    const edges = new THREE.EdgesGeometry(slotGeom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 }));
    slot.add(line);
  }

  // 6 Opponent Slots (Back Row: z = -12.0)
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Mesh(slotGeom, opponentSlotMat.clone());
    slot.rotation.x = -Math.PI / 2;
    slot.position.set((i - 2.5) * 0.72, 0.26, -12.0);
    slot.name = `slot_opponent_${i}`;
    xrInteractiveGroup.add(slot);
    xrBoardSlots.push({ mesh: slot, type: 'opponent', slotIndex: i });

    const edges = new THREE.EdgesGeometry(slotGeom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 }));
    slot.add(line);
  }

  // 3D Battle Table Quick Duel Button
  const duelBtnCanvas = document.createElement('canvas');
  duelBtnCanvas.width = 320;
  duelBtnCanvas.height = 80;
  const dbCtx = duelBtnCanvas.getContext('2d');
  dbCtx.fillStyle = '#b91c1c';
  dbCtx.fillRect(0, 0, 320, 80);
  dbCtx.strokeStyle = '#fef08a';
  dbCtx.lineWidth = 6;
  dbCtx.strokeRect(3, 3, 314, 74);
  dbCtx.fillStyle = '#ffffff';
  dbCtx.font = 'bold 24px Arial';
  dbCtx.textAlign = 'center';
  dbCtx.fillText('⚔️ START DUEL VS BOT', 160, 50);

  const duelBtnMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.35),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(duelBtnCanvas), side: THREE.DoubleSide })
  );
  duelBtnMesh.position.set(-1.6, 0.32, -10.1);
  duelBtnMesh.rotation.set(-0.35, 0, 0);
  duelBtnMesh.name = 'menu_play_bot';
  xrInteractiveGroup.add(duelBtnMesh);

  // Spectator Benches in Battle Hall
  [-4.8, 4.8].forEach(bx => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 4.5), timberMat);
    bench.position.set(bx, -0.25, -11.5);
    xrScene.add(bench);
  });

  // =========================================================================
  // CORRIDOR 2 (NW) -> CHAMBER 2: "COLLECTION & QUESTS" - Center: (-11.5, 0, -5.5)
  // =========================================================================
  // Corridor Floor
  const nwHallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 7.5), floorMat);
  nwHallFloor.rotation.x = -Math.PI / 2;
  nwHallFloor.rotation.z = -0.7;
  nwHallFloor.position.set(-6.0, -0.5, -2.8);
  xrScene.add(nwHallFloor);
  xrFloorMeshes.push(nwHallFloor);

  // Collection & Quests Room Floor (9m x 9m)
  const collectionFloor = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 9.0), floorMat);
  collectionFloor.rotation.x = -Math.PI / 2;
  collectionFloor.position.set(-11.5, -0.5, -5.5);
  xrScene.add(collectionFloor);
  xrFloorMeshes.push(collectionFloor);

  // Room Walls
  const cNorthWall = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.0), wallMat);
  cNorthWall.position.set(-11.5, 2.0, -10.0);
  xrScene.add(cNorthWall);
  xrWallMeshes.push(cNorthWall);

  const cWestWall = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.0), wallMat);
  cWestWall.rotation.y = Math.PI / 2;
  cWestWall.position.set(-16.0, 2.0, -5.5);
  xrScene.add(cWestWall);
  xrWallMeshes.push(cWestWall);

  // Guild Library Bookshelves along West Wall
  const shelfGeom = new THREE.BoxGeometry(0.6, 3.2, 5.5);
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
  const bookshelf = new THREE.Mesh(shelfGeom, shelfMat);
  bookshelf.position.set(-15.4, 1.6, -5.5);
  xrScene.add(bookshelf);

  // Glowing Potion Jars & Spellbooks on Shelf
  [-1.6, 0, 1.6].forEach(oz => {
    const jar = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, roughness: 0.1 }));
    jar.position.set(-15.0, 1.8, -5.5 + oz);
    xrScene.add(jar);
  });

  // Large Guild Quest Bulletin Notice Board on North Wall
  const questBoardCanvas = document.createElement('canvas');
  questBoardCanvas.width = 512;
  questBoardCanvas.height = 360;
  const qbCtx = questBoardCanvas.getContext('2d');
  qbCtx.fillStyle = '#fef3c7'; // Parchment
  qbCtx.fillRect(0, 0, 512, 360);
  qbCtx.strokeStyle = '#b45309';
  qbCtx.lineWidth = 10;
  qbCtx.strokeRect(5, 5, 502, 350);

  qbCtx.fillStyle = '#451a03';
  qbCtx.font = 'bold 30px Arial';
  qbCtx.textAlign = 'center';
  qbCtx.fillText('📜 GUILD QUESTS & BOUNTIES', 256, 50);

  qbCtx.font = 'bold 18px Arial';
  qbCtx.textAlign = 'left';
  qbCtx.fillText('1. Daily War Quest: Win 2 Matches (Reward: 160 ◉)', 35, 110);
  qbCtx.fillText('2. Striker Challenge: Play 3 Tier-2 Units (Reward: 120 ◉)', 35, 160);
  qbCtx.fillText('3. Master Deckbuilder: Craft 1 Custom Deck (Reward: 200 ◉)', 35, 210);
  qbCtx.fillText('4. Spell Mastery: Cast 5 Spells in Arena (Reward: 150 ◉)', 35, 260);

  qbCtx.fillStyle = '#b45309';
  qbCtx.font = 'italic 16px Arial';
  qbCtx.textAlign = 'center';
  qbCtx.fillText('— Tap Buttons Below to Open Workshop or Collection —', 256, 320);

  const questBoardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 2.1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(questBoardCanvas), side: THREE.DoubleSide })
  );
  questBoardMesh.position.set(-11.5, 2.2, -9.8);
  xrScene.add(questBoardMesh);

  // Interactive 3D Wooden Buttons in Collection & Quests Wing
  const questButtons = [
    { id: 'menu_collection', label: '🎴 OPEN CARD COLLECTION', y: 0.75 },
    { id: 'menu_decks', label: '⚔️ OPEN DECK BUILDER', y: 0.35 },
    { id: 'menu_quests', label: '📜 VIEW GUILD QUESTS', y: -0.05 },
  ];

  questButtons.forEach(b => {
    const btnCanvas = document.createElement('canvas');
    btnCanvas.width = 360;
    btnCanvas.height = 70;
    const bc = btnCanvas.getContext('2d');
    bc.fillStyle = '#78350f';
    bc.fillRect(0, 0, 360, 70);
    bc.strokeStyle = '#f59e0b';
    bc.lineWidth = 5;
    bc.strokeRect(3, 3, 354, 64);
    bc.fillStyle = '#fef3c7';
    bc.font = 'bold 22px Arial';
    bc.textAlign = 'center';
    bc.fillText(b.label, 180, 44);

    const bMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.32),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(btnCanvas), side: THREE.DoubleSide })
    );
    bMesh.position.set(-11.5, b.y, -5.5);
    bMesh.name = b.id;
    xrScene.add(bMesh);
    xrInteractiveGroup.add(bMesh);
  });

  // =========================================================================
  // CORRIDOR 3 (NE) -> CHAMBER 3: "TAVERN SHOP & BAR" - Center: (11.5, 0, -5.5)
  // =========================================================================
  // Corridor Floor
  const neHallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 7.5), floorMat);
  neHallFloor.rotation.x = -Math.PI / 2;
  neHallFloor.rotation.z = 0.7;
  neHallFloor.position.set(6.0, -0.5, -2.8);
  xrScene.add(neHallFloor);
  xrFloorMeshes.push(neHallFloor);

  // Shop Room Floor (9m x 9m)
  const shopFloor = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 9.0), floorMat);
  shopFloor.rotation.x = -Math.PI / 2;
  shopFloor.position.set(11.5, -0.5, -5.5);
  xrScene.add(shopFloor);
  xrFloorMeshes.push(shopFloor);

  // Room Walls
  const sNorthWall = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.0), wallMat);
  sNorthWall.position.set(11.5, 2.0, -10.0);
  xrScene.add(sNorthWall);
  xrWallMeshes.push(sNorthWall);

  const sEastWall = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.0), wallMat);
  sEastWall.rotation.y = -Math.PI / 2;
  sEastWall.position.set(16.0, 2.0, -5.5);
  xrScene.add(sEastWall);
  xrWallMeshes.push(sEastWall);

  // Polished Curved Tavern Bar Counter
  const barCounter = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.85, 1.1), new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.4 }));
  barCounter.position.set(11.5, -0.08, -6.8);
  xrScene.add(barCounter);

  // Bar Stools
  [-1.6, -0.5, 0.5, 1.6].forEach(bx => {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.55, 12), timberMat);
    stool.position.set(11.5 + bx, -0.22, -5.6);
    xrScene.add(stool);
  });

  // Oak Beer & Ale Barrels on wall shelves
  [-1.4, 0, 1.4].forEach(bx => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.9, 14), timberMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(11.5 + bx, 1.2, -9.4);
    xrScene.add(barrel);
  });

  // Shop Header Banner on North Wall
  const shopCanvas = document.createElement('canvas');
  shopCanvas.width = 512;
  shopCanvas.height = 140;
  const sCtx = shopCanvas.getContext('2d');
  sCtx.fillStyle = '#451a03';
  sCtx.fillRect(0, 0, 512, 140);
  sCtx.strokeStyle = '#f59e0b';
  sCtx.lineWidth = 6;
  sCtx.strokeRect(3, 3, 506, 134);
  sCtx.fillStyle = '#fef3c7';
  sCtx.font = 'bold 30px Arial';
  sCtx.textAlign = 'center';
  sCtx.fillText('🍻 MEHRBOD TAVERN SHOP & BAR', 256, 52);
  sCtx.fillStyle = '#fbbf24';
  sCtx.font = '18px Arial';
  sCtx.fillText('Card Sleeves, Avatars, Packs & Realm Themes', 256, 95);

  const shopMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.88),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shopCanvas), side: THREE.DoubleSide })
  );
  shopMesh.position.set(11.5, 2.4, -9.8);
  xrScene.add(shopMesh);

  // Interactive 3D Shop Buttons
  const shopButtons = [
    { id: 'menu_shop', label: '🛒 OPEN MEHRBOD SHOP', y: 0.65 },
    { id: 'menu_theme', label: `🎨 CHANGE THEME (${palette.name.toUpperCase()})`, y: 0.25 },
  ];

  shopButtons.forEach(b => {
    const btnCanvas = document.createElement('canvas');
    btnCanvas.width = 360;
    btnCanvas.height = 70;
    const bc = btnCanvas.getContext('2d');
    bc.fillStyle = '#1e3a8a';
    bc.fillRect(0, 0, 360, 70);
    bc.strokeStyle = '#60a5fa';
    bc.lineWidth = 5;
    bc.strokeRect(3, 3, 354, 64);
    bc.fillStyle = '#ffffff';
    bc.font = 'bold 22px Arial';
    bc.textAlign = 'center';
    bc.fillText(b.label, 180, 44);

    const bMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.32),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(btnCanvas), side: THREE.DoubleSide })
    );
    bMesh.position.set(11.5, b.y, -5.5);
    bMesh.name = b.id;
    xrScene.add(bMesh);
    xrInteractiveGroup.add(bMesh);
  });

  // =========================================================================
  // CORRIDOR 4 (SW) -> CHAMBER 4: "HALL OF HONOR" - Center: (-8.5, 0, 8.5)
  // =========================================================================
  // Corridor Floor
  const swHallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.5), floorMat);
  swHallFloor.rotation.x = -Math.PI / 2;
  swHallFloor.rotation.z = 2.35;
  swHallFloor.position.set(-4.5, -0.5, 4.5);
  xrScene.add(swHallFloor);
  xrFloorMeshes.push(swHallFloor);

  // Hall of Honor Room Floor (8m x 8m)
  const honorFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 8.0), floorMat);
  honorFloor.rotation.x = -Math.PI / 2;
  honorFloor.position.set(-8.5, -0.5, 8.5);
  xrScene.add(honorFloor);
  xrFloorMeshes.push(honorFloor);

  // Walls
  const hSouthWall = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 5.0), wallMat);
  hSouthWall.position.set(-8.5, 2.0, 12.5);
  xrScene.add(hSouthWall);
  xrWallMeshes.push(hSouthWall);

  const hWestWall = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 5.0), wallMat);
  hWestWall.rotation.y = Math.PI / 2;
  hWestWall.position.set(-12.5, 2.0, 8.5);
  xrScene.add(hWestWall);
  xrWallMeshes.push(hWestWall);

  // Golden Trophy Pedestals with 3D Trophy Cups
  [-1.8, 1.8].forEach(tx => {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.3 }));
    ped.position.set(-8.5 + tx, -0.05, 10.5);
    xrScene.add(ped);

    const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 }));
    trophy.position.set(-8.5 + tx, 0.6, 10.5);
    xrScene.add(trophy);
  });

  // Grand Stone Tablet of Honor
  const honorCanvas = document.createElement('canvas');
  honorCanvas.width = 440;
  honorCanvas.height = 300;
  const hCtx = honorCanvas.getContext('2d');
  hCtx.fillStyle = '#1e1b4b';
  hCtx.fillRect(0, 0, 440, 300);
  hCtx.strokeStyle = '#818cf8';
  hCtx.lineWidth = 8;
  hCtx.strokeRect(4, 4, 432, 292);

  const winCount = localStorage.getItem('mehrbod-cards-wins') || '12';
  const buxBal = typeof loadBux === 'function' ? loadBux() : 1250;

  hCtx.fillStyle = '#ffffff';
  hCtx.font = 'bold 28px Arial';
  hCtx.textAlign = 'center';
  hCtx.fillText('🏆 CAREER HALL OF HONOR', 220, 50);

  hCtx.font = '20px Arial';
  hCtx.fillStyle = '#c7d2fe';
  hCtx.fillText(`• Total Victorious Matches: ${winCount}`, 220, 110);
  hCtx.fillText(`• Tavern Vault Balance: ${buxBal.toLocaleString()} ◉`, 220, 155);
  hCtx.fillText(`• Player Rank: Grand Champion 🎖️`, 220, 200);
  hCtx.fillText(`• Global Win Rate: 78.4% ⭐`, 220, 245);

  const honorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(honorCanvas), side: THREE.DoubleSide })
  );
  honorMesh.position.set(-8.5, 2.2, 12.3);
  xrScene.add(honorMesh);

  // Interactive Stats Button
  const statsBtnCanvas = document.createElement('canvas');
  statsBtnCanvas.width = 360;
  statsBtnCanvas.height = 70;
  const sbc = statsBtnCanvas.getContext('2d');
  sbc.fillStyle = '#3730a3';
  sbc.fillRect(0, 0, 360, 70);
  sbc.strokeStyle = '#a5b4fc';
  sbc.lineWidth = 5;
  sbc.strokeRect(3, 3, 354, 64);
  sbc.fillStyle = '#ffffff';
  sbc.font = 'bold 22px Arial';
  sbc.textAlign = 'center';
  sbc.fillText('📊 VIEW FULL CAREER STATS', 180, 44);

  const statsBtnMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.32),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(statsBtnCanvas), side: THREE.DoubleSide })
  );
  statsBtnMesh.position.set(-8.5, 0.45, 8.5);
  statsBtnMesh.name = 'menu_stats';
  xrScene.add(statsBtnMesh);
  xrInteractiveGroup.add(statsBtnMesh);

  // =========================================================================
  // CORRIDOR 5 (SE) -> CHAMBER 5: "FORTUNE CELLAR & REWARDS" - Center: (8.5, 0, 8.5)
  // =========================================================================
  // Corridor Floor
  const seHallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.5), floorMat);
  seHallFloor.rotation.x = -Math.PI / 2;
  seHallFloor.rotation.z = -2.35;
  seHallFloor.position.set(4.5, -0.5, 4.5);
  xrScene.add(seHallFloor);
  xrFloorMeshes.push(seHallFloor);

  // Cellar Room Floor (8m x 8m)
  const cellarFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 8.0), floorMat);
  cellarFloor.rotation.x = -Math.PI / 2;
  cellarFloor.position.set(8.5, -0.5, 8.5);
  xrScene.add(cellarFloor);
  xrFloorMeshes.push(cellarFloor);

  // Walls
  const cellSouthWall = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 5.0), wallMat);
  cellSouthWall.position.set(8.5, 2.0, 12.5);
  xrScene.add(cellSouthWall);
  xrWallMeshes.push(cellSouthWall);

  const cellEastWall = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 5.0), wallMat);
  cellEastWall.rotation.y = -Math.PI / 2;
  cellEastWall.position.set(12.5, 2.0, 8.5);
  xrScene.add(cellEastWall);
  xrWallMeshes.push(cellEastWall);

  // Overflowing Treasure Chest with 3D Gold Coins
  const chestGroup = new THREE.Group();
  chestGroup.position.set(8.5, 0.15, 10.8);
  xrScene.add(chestGroup);

  const chestBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), timberMat);
  chestGroup.add(chestBox);
  const goldCoins = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 }));
  goldCoins.position.set(0, 0.4, 0);
  chestGroup.add(goldCoins);

  // Giant 3D Spinning Wheel of Fortune
  const wheelCanvas = document.createElement('canvas');
  wheelCanvas.width = 384;
  wheelCanvas.height = 384;
  const wCtx = wheelCanvas.getContext('2d');
  const colorsList = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
  const prizes = ['+100 ◉', '+250 ◉', '+500 ◉', 'SLEEVE 🎴', '+150 ◉', 'MYTHIC 👑'];
  for (let i = 0; i < 6; i++) {
    wCtx.fillStyle = colorsList[i];
    wCtx.beginPath();
    wCtx.moveTo(192, 192);
    wCtx.arc(192, 192, 180, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3);
    wCtx.fill();
    wCtx.strokeStyle = '#ffffff';
    wCtx.lineWidth = 4;
    wCtx.stroke();

    wCtx.save();
    wCtx.translate(192, 192);
    wCtx.rotate(((i + 0.5) * Math.PI) / 3);
    wCtx.fillStyle = '#ffffff';
    wCtx.font = 'bold 18px Arial';
    wCtx.textAlign = 'right';
    wCtx.fillText(prizes[i], 160, 6);
    wCtx.restore();
  }

  xrFortuneWheelMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 32),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(wheelCanvas), side: THREE.DoubleSide })
  );
  xrFortuneWheelMesh.position.set(8.5, 2.0, 12.2);
  xrFortuneWheelMesh.name = 'menu_fortune_wheel';
  xrScene.add(xrFortuneWheelMesh);
  xrInteractiveGroup.add(xrFortuneWheelMesh);

  // Interactive Daily Rewards & Wheel Spin Buttons
  const rewardButtons = [
    { id: 'menu_daily_rewards', label: '🎁 CLAIM DAILY BONUS (+250 ◉)', y: 0.65 },
    { id: 'menu_fortune_wheel', label: '🎡 SPIN FORTUNE WHEEL', y: 0.25 },
  ];

  rewardButtons.forEach(b => {
    const btnCanvas = document.createElement('canvas');
    btnCanvas.width = 360;
    btnCanvas.height = 70;
    const bc = btnCanvas.getContext('2d');
    bc.fillStyle = '#047857';
    bc.fillRect(0, 0, 360, 70);
    bc.strokeStyle = '#6ee7b7';
    bc.lineWidth = 5;
    bc.strokeRect(3, 3, 354, 64);
    bc.fillStyle = '#ffffff';
    bc.font = 'bold 22px Arial';
    bc.textAlign = 'center';
    bc.fillText(b.label, 180, 44);

    const bMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.32),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(btnCanvas), side: THREE.DoubleSide })
    );
    bMesh.position.set(8.5, b.y, 8.5);
    bMesh.name = b.id;
    xrScene.add(bMesh);
    xrInteractiveGroup.add(bMesh);
  });

  // 6. Floating Ambient Dust Particles
  buildHubDustMotes();

  // 7. Teleportation Target Pads
  buildTeleportPads();

  // 8. Build Floating Live Battle HUD
  buildFloatingUI();

  // 9. Build Shop Pedestals Showcase
  buildShopPedestalsInArena();

  // 10. Build Interactive Relic Artifacts Showcase
  buildInteractiveArtifacts();

  // 11. Build 3D Card Pack Display Shelf & Designated Checkout Station
  buildShopCardPacksAndCheckout();

  // 12. Build 3D Gesture Emote Menu Console
  build3DEmoteMenu();

  // 13. Apply Full Theme Materials & Ambience to All Chambers
  updateXRTheme(xrActiveTheme);
}

function buildCyberArena() {
  buildTavernEnvironment();
}

let xrEmoteGroup = null;
let xrParticleSystems = [];
let xrHands = [];
let xrHandPinchStates = [false, false];
let xrLastHoveredObject = null;
let lastGestureEmoteTime = 0;

function build3DEmoteMenu() {
  if (xrEmoteGroup) xrScene.remove(xrEmoteGroup);
  xrEmoteGroup = new THREE.Group();
  xrEmoteGroup.position.set(-1.8, 1.3, -0.2);
  xrEmoteGroup.rotation.y = 0.45; // Angled comfortably towards the user
  xrScene.add(xrEmoteGroup);

  // Emote Console Glass Header
  const headerCanvas = document.createElement('canvas');
  headerCanvas.width = 384;
  headerCanvas.height = 80;
  const hCtx = headerCanvas.getContext('2d');
  hCtx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  hCtx.fillRect(0, 0, 384, 80);
  hCtx.strokeStyle = '#f59e0b';
  hCtx.lineWidth = 4;
  hCtx.strokeRect(2, 2, 380, 76);
  hCtx.fillStyle = '#ffffff';
  hCtx.font = 'bold 22px Arial';
  hCtx.textAlign = 'center';
  hCtx.fillText('🎭 VR 3D EMOTE MENU', 192, 38);
  hCtx.fillStyle = '#fbbf24';
  hCtx.font = '14px Arial';
  hCtx.fillText('Pinch, Tap, or Gesture to Trigger', 192, 62);

  const headerTex = new THREE.CanvasTexture(headerCanvas);
  const headerMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.28),
    new THREE.MeshBasicMaterial({ map: headerTex, side: THREE.DoubleSide })
  );
  headerMesh.position.set(0, 0.55, 0);
  xrEmoteGroup.add(headerMesh);

  // 4 Interactive 3D Emote Buttons
  const emoteDefs = [
    { id: 'emote_victory', label: '👑 VICTORY POSE', color: '#f59e0b', type: 'stars' },
    { id: 'emote_fire', label: '🔥 INFERNO TAUNT', color: '#ef4444', type: 'fire' },
    { id: 'emote_hearts', label: '💖 GOOD GAME', color: '#ec4899', type: 'hearts' },
    { id: 'emote_cyber', label: '⚡ CYBER SPARK', color: '#00f3ff', type: 'cyber' },
  ];

  emoteDefs.forEach((def, idx) => {
    const btnCanvas = document.createElement('canvas');
    btnCanvas.width = 320;
    btnCanvas.height = 70;
    const bCtx = btnCanvas.getContext('2d');
    bCtx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    bCtx.fillRect(0, 0, 320, 70);
    bCtx.strokeStyle = def.color;
    bCtx.lineWidth = 4;
    bCtx.strokeRect(3, 3, 314, 64);
    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'bold 22px Arial';
    bCtx.textAlign = 'center';
    bCtx.fillText(def.label, 160, 44);

    const btnTex = new THREE.CanvasTexture(btnCanvas);
    const btnGeom = new THREE.PlaneGeometry(1.2, 0.24);
    const btnMat = new THREE.MeshBasicMaterial({ map: btnTex, side: THREE.DoubleSide });
    const btnMesh = new THREE.Mesh(btnGeom, btnMat);
    btnMesh.position.set(0, 0.26 - idx * 0.28, 0);
    btnMesh.name = def.id;
    xrEmoteGroup.add(btnMesh);
    xrInteractiveGroup.add(btnMesh);
  });
}

// ---- Three.js 3D Emote Particle Burst Engine -------------------------------
function trigger3DEmoteParticleBurst(type, originPos = new THREE.Vector3(0, 1.4, -0.2)) {
  const count = type === 'cyber' ? 90 : 60;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = [];

  const baseColor = new THREE.Color();
  if (type === 'fire') baseColor.setHex(0xff5500);
  else if (type === 'stars') baseColor.setHex(0xffd700);
  else if (type === 'hearts') baseColor.setHex(0xff0088);
  else baseColor.setHex(0x00f3ff);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = originPos.x;
    positions[i * 3 + 1] = originPos.y;
    positions[i * 3 + 2] = originPos.z;

    const vx = (Math.random() - 0.5) * 0.08;
    const vy = Math.random() * 0.08 + 0.03;
    const vz = (Math.random() - 0.5) * 0.08;
    velocities.push(new THREE.Vector3(vx, vy, vz));

    colors[i * 3] = Math.min(1, baseColor.r + (Math.random() - 0.5) * 0.2);
    colors[i * 3 + 1] = Math.min(1, baseColor.g + (Math.random() - 0.5) * 0.2);
    colors[i * 3 + 2] = Math.min(1, baseColor.b + (Math.random() - 0.5) * 0.2);
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending
  });

  const pSystem = new THREE.Points(geom, mat);
  xrScene.add(pSystem);

  xrParticleSystems.push({
    mesh: pSystem,
    velocities,
    life: 1.0,
    decay: 0.02 + Math.random() * 0.01,
    type
  });
}

function fireEmoteGesture(type, label) {
  const time = Date.now();
  if (time - lastGestureEmoteTime < 1500) return; // 1.5s cooldown
  lastGestureEmoteTime = time;

  trigger3DEmoteParticleBurst(type, new THREE.Vector3(0, 1.6, -0.3));

  if (typeof triggerHapticPulse === 'function') {
    triggerHapticPulse(null, 0.8, 250);
  }

  if (typeof showToast === 'function') {
    showToast(`🎭 VR Gesture Emote: ${label}! ✨`, 2500);
  }

  if (typeof Sound !== 'undefined' && Sound.place) {
    Sound.place();
  }
}

// ---- 3D Virtual Card Packs & Designated Checkout Area System --------------
const SHOP_PACK_DEFS = [
  {
    id: 'pack_standard',
    name: 'BOOSTER PACK',
    sub: '2 Cards • Spells, Chips & Units',
    cost: 20,
    count: 2,
    gradient: ['#0284c7', '#0369a1', '#082f49'],
    borderColor: '#38bdf8',
    icon: '🎴',
    tag: 'POPULAR'
  },
  {
    id: 'pack_units',
    name: 'UNIT STRIKER PACK',
    sub: '3 Units • Green, Red & Orange',
    cost: 35,
    count: 3,
    gradient: ['#059669', '#047857', '#064e3b'],
    borderColor: '#34d399',
    icon: '⚔️',
    tag: 'BEST VALUE'
  },
  {
    id: 'pack_mythic',
    name: 'CHAMPION PACK',
    sub: '4 High-Tier Cards • Foil Glow',
    cost: 50,
    count: 4,
    gradient: ['#d97706', '#b45309', '#451a03'],
    borderColor: '#f59e0b',
    icon: '👑',
    tag: 'RARE'
  },
  {
    id: 'pack_vault',
    name: 'ARCANE VAULT PACK',
    sub: '6 Cards • Mythic Odds + Bonus',
    cost: 100,
    count: 6,
    gradient: ['#7c3aed', '#6d28d9', '#2e1065'],
    borderColor: '#c084fc',
    icon: '🔮',
    tag: 'LEGENDARY'
  }
];

function buildCardPackCoverTexture(pack) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Radiant Foil Gradient
  const grad = ctx.createLinearGradient(0, 0, 384, 512);
  grad.addColorStop(0, pack.gradient[0]);
  grad.addColorStop(0.5, pack.gradient[1]);
  grad.addColorStop(1, pack.gradient[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 384, 512);

  // Holographic Foil Diagonal Sheen Stripes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (let i = -512; i < 768; i += 70) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 40, 0);
    ctx.lineTo(i - 160, 512);
    ctx.lineTo(i - 200, 512);
    ctx.closePath();
    ctx.fill();
  }

  // Outer Border & Metallic Corner Accents
  ctx.strokeStyle = pack.borderColor;
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 372, 500);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 352, 480);

  // Tag Badge
  if (pack.tag) {
    ctx.fillStyle = pack.borderColor;
    ctx.fillRect(92, 28, 200, 36);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`★ ${pack.tag} ★`, 192, 53);
  }

  // Big Central Emblem Icon
  ctx.font = '72px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(pack.icon, 192, 160);

  // Pack Name Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.shadowColor = pack.borderColor;
  ctx.shadowBlur = 12;
  ctx.fillText(pack.name, 192, 225);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(pack.sub, 192, 260);

  // Divider Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 290);
  ctx.lineTo(344, 290);
  ctx.stroke();

  // Price Badge Button
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(40, 320, 304, 75);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 320, 304, 75);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 26px Arial';
  ctx.fillText(`🪙 ${pack.cost} MEHRBOD BUX`, 192, 368);

  // Instruction Footer
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('📥 GRAB & DROP ON CHECKOUT 📥', 192, 445);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px Arial';
  ctx.fillText('Or Click / Tap with Pointer', 192, 475);

  return new THREE.CanvasTexture(canvas);
}

function buildCheckoutRegisterTexture(statusText = 'Drop Any Pack on Tray to Buy', isSuccess = false, isError = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Screen background
  ctx.fillStyle = isSuccess ? '#064e3b' : isError ? '#450a0a' : '#0f172a';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = isSuccess ? '#34d399' : isError ? '#ef4444' : '#38bdf8';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 248);

  // Header
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🏪 TAVERN SHOP CHECKOUT REGISTER', 256, 45);

  const bux = typeof loadBux === 'function' ? loadBux() : 1000;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(`Your Balance: ${bux.toLocaleString()} Mehrbod Bux ◉`, 256, 85);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 105);
  ctx.lineTo(482, 105);
  ctx.stroke();

  // Status Message
  ctx.fillStyle = isSuccess ? '#a7f3d0' : isError ? '#fca5a5' : '#e0f2fe';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(statusText, 256, 145);

  // Action Button Bar
  ctx.fillStyle = isSuccess ? '#059669' : '#0284c7';
  ctx.fillRect(40, 175, 432, 55);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 175, 432, 55);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('📥 DROP PACK HERE OR CLICK TO INSTANT BUY 💰', 256, 210);

  return new THREE.CanvasTexture(canvas);
}

function updateCheckoutRegisterScreen(statusText, isSuccess = false, isError = false) {
  if (xrCheckoutScreenMesh) {
    xrCheckoutScreenMesh.material.map = buildCheckoutRegisterTexture(statusText, isSuccess, isError);
    xrCheckoutScreenMesh.material.needsUpdate = true;
  }
}

function buildShopCardPacksAndCheckout() {
  xrShopPacks = [];

  // 1. Wooden Card Pack Display Shelf on East Wall of Chamber 3 (x: 15.3, z: -5.5)
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(15.2, 0.4, -5.5);
  shelfGroup.rotation.y = -Math.PI / 2; // Face towards room interior
  xrScene.add(shelfGroup);

  const timberMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x271202, roughness: 0.6 });

  // Vertical Posts
  [-1.4, 1.4].forEach(px => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.55), darkOakMat);
    post.position.set(px, 0.65, 0);
    shelfGroup.add(post);
  });

  // Shelf Tiers (Lower, Middle, Upper)
  [0.05, 0.70, 1.35].forEach((sy, idx) => {
    const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.6), timberMat);
    shelfBoard.position.set(0, sy, 0);
    shelfGroup.add(shelfBoard);

    // Front Brass Guard Rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 }));
    rail.position.set(0, sy + 0.06, 0.28);
    shelfGroup.add(rail);
  });

  // Shelf Header Board
  const shelfHeaderCanvas = document.createElement('canvas');
  shelfHeaderCanvas.width = 512;
  shelfHeaderCanvas.height = 100;
  const shc = shelfHeaderCanvas.getContext('2d');
  shc.fillStyle = '#271202';
  shc.fillRect(0, 0, 512, 100);
  shc.strokeStyle = '#f59e0b';
  shc.lineWidth = 6;
  shc.strokeRect(3, 3, 506, 94);
  shc.fillStyle = '#fef3c7';
  shc.font = 'bold 24px Arial';
  shc.textAlign = 'center';
  shc.fillText('🎴 VIRTUAL CARD PACKS SHELF', 256, 42);
  shc.fillStyle = '#38bdf8';
  shc.font = '16px Arial';
  shc.fillText('Grab Any Pack & Drop in Checkout Tray to Buy', 256, 75);

  const headerMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.55),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shelfHeaderCanvas), side: THREE.DoubleSide })
  );
  headerMesh.position.set(0, 1.72, 0.15);
  shelfGroup.add(headerMesh);

  // 2. Instantiate the 4 Foil Card Packs on the Shelves
  const packPositions = [
    { x: -0.75, y: 1.05, z: 0.05 }, // Upper Left
    { x: 0.75,  y: 1.05, z: 0.05 }, // Upper Right
    { x: -0.75, y: 0.40, z: 0.05 }, // Lower Left
    { x: 0.75,  y: 0.40, z: 0.05 }, // Lower Right
  ];

  SHOP_PACK_DEFS.forEach((pDef, idx) => {
    const posOffset = packPositions[idx] || { x: 0, y: 0.4, z: 0 };
    const coverTexture = buildCardPackCoverTexture(pDef);

    const packGeom = new THREE.BoxGeometry(0.55, 0.75, 0.1);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 }), // Right
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 }), // Left
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 }), // Top
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 }), // Bottom
      new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.15, metalness: 0.7 }), // Front (Cover)
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 }), // Back
    ];

    const packMesh = new THREE.Mesh(packGeom, materials);
    // Slight backward tilt on shelf for authentic retail display
    packMesh.position.set(posOffset.x, posOffset.y, posOffset.z);
    packMesh.rotation.x = -0.15;
    packMesh.name = `shop_pack_${pDef.id}`;
    shelfGroup.add(packMesh);
    xrInteractiveGroup.add(packMesh);

    // Save world position & rotation for return animation
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    packMesh.getWorldPosition(worldPos);
    packMesh.getWorldQuaternion(worldQuat);

    xrShopPacks.push({
      id: pDef.id,
      name: pDef.name,
      sub: pDef.sub,
      cost: pDef.cost,
      count: pDef.count,
      def: pDef,
      mesh: packMesh,
      parentGroup: shelfGroup,
      localPos: packMesh.position.clone(),
      localRot: packMesh.rotation.clone(),
      initialPos: worldPos.clone(),
      initialQuat: worldQuat.clone(),
      isGrabbed: false,
      isDropping: false
    });
  });

  // 3. Designated 'Checkout' Station & Drop Tray on Tavern Counter
  // Positioned at (11.5, 0.42, -6.8)
  const checkoutGroup = new THREE.Group();
  checkoutGroup.position.set(11.5, 0.35, -6.8);
  xrScene.add(checkoutGroup);

  // A. Checkout Tray Mat with Glowing Rune Border
  const trayCanvas = document.createElement('canvas');
  trayCanvas.width = 384;
  trayCanvas.height = 384;
  const tc = trayCanvas.getContext('2d');
  tc.fillStyle = '#064e3b';
  tc.fillRect(0, 0, 384, 384);

  tc.strokeStyle = '#10b981';
  tc.lineWidth = 14;
  tc.strokeRect(8, 8, 368, 368);

  tc.strokeStyle = '#f59e0b';
  tc.lineWidth = 4;
  tc.strokeRect(22, 22, 340, 340);

  tc.fillStyle = '#ffffff';
  tc.font = 'bold 28px Arial';
  tc.textAlign = 'center';
  tc.fillText('📥 CHECKOUT DROP TRAY', 192, 90);

  tc.font = '72px Arial';
  tc.fillText('🛍️', 192, 195);

  tc.fillStyle = '#a7f3d0';
  tc.font = 'bold 20px Arial';
  tc.fillText('Drop Any Card Pack Here', 192, 265);
  tc.fillStyle = '#fde047';
  tc.font = 'bold 22px Arial';
  tc.fillText('⚡ Instant Purchase & Open ⚡', 192, 310);

  const trayMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.06, 1.2),
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(trayCanvas),
      roughness: 0.3,
      metalness: 0.2
    })
  );
  trayMesh.position.set(0, 0.05, 0);
  trayMesh.name = 'checkout_drop_zone';
  checkoutGroup.add(trayMesh);
  xrInteractiveGroup.add(trayMesh);
  xrCheckoutDropZoneMesh = trayMesh;

  // B. Glowing Neon Outer Boundary Ring
  const borderRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.03, 12, 32),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  borderRing.rotation.x = Math.PI / 2;
  borderRing.position.set(0, 0.08, 0);
  checkoutGroup.add(borderRing);

  // C. Holographic Scanner Beam Ring
  const scanGeom = new THREE.TorusGeometry(0.75, 0.02, 12, 32);
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 });
  xrCheckoutScannerMesh = new THREE.Mesh(scanGeom, scanMat);
  xrCheckoutScannerMesh.rotation.x = Math.PI / 2;
  xrCheckoutScannerMesh.position.set(0, 0.25, 0);
  checkoutGroup.add(xrCheckoutScannerMesh);

  // D. 3D Cash Register Display Screen (angled comfortably towards player)
  const regGeom = new THREE.PlaneGeometry(2.0, 1.0);
  const regMat = new THREE.MeshBasicMaterial({
    map: buildCheckoutRegisterTexture('Drop Any Pack on Tray to Buy'),
    side: THREE.DoubleSide
  });
  xrCheckoutScreenMesh = new THREE.Mesh(regGeom, regMat);
  xrCheckoutScreenMesh.position.set(0, 0.95, -0.6);
  xrCheckoutScreenMesh.rotation.x = -0.25;
  xrCheckoutScreenMesh.name = 'checkout_register_screen';
  checkoutGroup.add(xrCheckoutScreenMesh);
  xrInteractiveGroup.add(xrCheckoutScreenMesh);

  // Set world drop position for proximity checking
  xrCheckoutDropPos.set(11.5, 0.42, -6.8);
}

function grantCardPackRewards(pack) {
  let col = { units: [], spells: [], chips: [] };
  if (typeof loadCollection === 'function') {
    try { col = loadCollection(); } catch (e) {}
  }
  if (!Array.isArray(col.units)) col.units = [];
  if (!Array.isArray(col.spells)) col.spells = [];
  if (!Array.isArray(col.chips)) col.chips = [];

  const unownedUnits = (typeof ALL_NONBLUE_UNIT_IDS !== 'undefined' ? ALL_NONBLUE_UNIT_IDS : []).filter(id => !col.units.includes(id));
  const unownedSpells = (typeof ALL_SPELL_IDS !== 'undefined' ? ALL_SPELL_IDS : []).filter(id => !col.spells.includes(id));
  const unownedChips = (typeof ALL_CHIP_IDS !== 'undefined' ? ALL_CHIP_IDS : []).filter(id => !col.chips.includes(id));

  let pool = [];
  if (pack.id === 'pack_units') {
    pool = unownedUnits.map(id => ({ id, kind: 'unit' }));
    if (pool.length === 0 && typeof ALL_NONBLUE_UNIT_IDS !== 'undefined') {
      pool = ALL_NONBLUE_UNIT_IDS.map(id => ({ id, kind: 'unit' }));
    }
  } else {
    pool = unownedUnits.map(id => ({ id, kind: 'unit' }))
      .concat(unownedSpells.map(id => ({ id, kind: 'spell' })))
      .concat(unownedChips.map(id => ({ id, kind: 'chip' })));
    if (pool.length === 0) {
      if (typeof ALL_NONBLUE_UNIT_IDS !== 'undefined') pool.push(...ALL_NONBLUE_UNIT_IDS.map(id => ({ id, kind: 'unit' })));
      if (typeof ALL_SPELL_IDS !== 'undefined') pool.push(...ALL_SPELL_IDS.map(id => ({ id, kind: 'spell' })));
      if (typeof ALL_CHIP_IDS !== 'undefined') pool.push(...ALL_CHIP_IDS.map(id => ({ id, kind: 'chip' })));
    }
  }

  // Shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const count = Math.min(pack.count || 2, Math.max(1, pool.length));
  const granted = pool.slice(0, count);

  const grantedNames = [];
  granted.forEach(g => {
    let cardName = g.id;
    if (g.kind === 'unit') {
      if (!col.units.includes(g.id)) col.units.push(g.id);
      if (typeof findArchetypeById === 'function') {
        const arch = findArchetypeById(g.id);
        if (arch && arch.name) cardName = arch.name;
      }
    } else if (g.kind === 'spell') {
      if (!col.spells.includes(g.id)) col.spells.push(g.id);
      if (typeof SPELL_DEFS !== 'undefined') {
        const def = SPELL_DEFS.find(d => d.id === g.id);
        if (def && def.name) cardName = def.name;
      }
    } else {
      if (!col.chips.includes(g.id)) col.chips.push(g.id);
      if (typeof CHIP_DEFS !== 'undefined') {
        const def = CHIP_DEFS.find(d => d.id === g.id);
        if (def && def.name) cardName = def.name;
      }
    }
    grantedNames.push(cardName);
  });

  if (typeof saveCollection === 'function') {
    try { saveCollection(col); } catch (e) {}
  }
  if (typeof updateThemeButtons === 'function') updateThemeButtons();
  if (typeof checkMilestones === 'function') checkMilestones();

  return { granted, names: grantedNames };
}

function spawnFloatingRewardCards(rewardNames, basePos) {
  rewardNames.forEach((name, idx) => {
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 256;
    cardCanvas.height = 384;
    const ctx = cardCanvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 384);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 376);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✨ UNLOCKED CARD ✨', 128, 40);

    ctx.font = '54px Arial';
    ctx.fillText('🃏', 128, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(name, 128, 220);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('✓ ADDED TO DECK', 128, 260);

    const cardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.68),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cardCanvas), side: THREE.DoubleSide, transparent: true, opacity: 0.98 })
    );

    const startX = basePos.x + (idx - (rewardNames.length - 1) / 2) * 0.55;
    cardMesh.position.set(startX, basePos.y + 0.2, basePos.z);
    xrScene.add(cardMesh);

    xrFloatingRewardCards.push({
      mesh: cardMesh,
      targetY: basePos.y + 0.95 + (idx % 2) * 0.15,
      life: 1.0,
      rotSpeed: 0.02 + Math.random() * 0.02
    });
  });
}

function executePackCheckout(pack) {
  if (!pack) return;
  if (typeof isCollectionComplete === 'function' && isCollectionComplete()) {
    triggerHapticPulse(null, 0.8, 300);
    if (typeof Sound !== 'undefined' && typeof Sound.buzzer === 'function') {
      try { Sound.buzzer(); } catch (e) {}
    }
    if (typeof showToast === 'function') {
      showToast(`⚠️ Collection Complete! No need to buy ${pack.name}.`, 3500);
    }
    updateCheckoutRegisterScreen(`⚠️ Collection Complete!`, false, true);
    animatePackReturnToShelf(pack);
    return;
  }
  const currentBux = typeof loadBux === 'function' ? loadBux() : 1000;

  if (currentBux < pack.cost) {
    triggerHapticPulse(null, 0.8, 300);
    if (typeof showToast === 'function') {
      showToast(`⚠️ Insufficient Bux! ${pack.name} costs ${pack.cost} ◉ (You have ${currentBux} ◉)`, 3500);
    }
    updateCheckoutRegisterScreen(`⚠️ Insufficient Bux! Needs ${pack.cost} ◉`, false, true);
    animatePackReturnToShelf(pack);
    return;
  }

  // Deduct Bux
  const remaining = currentBux - pack.cost;
  if (typeof saveBux === 'function') {
    saveBux(remaining);
  }

  // Haptic feedback & sounds
  triggerHapticPulse(null, 1.0, 400);
  if (typeof Sound !== 'undefined') {
    if (Sound.packTear) Sound.packTear();
    setTimeout(() => { if (Sound.packCardFlip) Sound.packCardFlip(); }, 200);
    setTimeout(() => { if (Sound.victory) Sound.victory(); }, 450);
  }

  // Spawn celebratory particle explosion at Checkout Tray
  spawn3DEmoteParticles(xrCheckoutDropPos, 0xf59e0b, 50);

  // Grant Cards to Player Collection
  const result = grantCardPackRewards(pack);

  // 3D Floating Reward Cards
  spawnFloatingRewardCards(result.names, xrCheckoutDropPos);

  // Update register screen
  updateCheckoutRegisterScreen(`✅ Purchased ${pack.name}! (-${pack.cost} ◉)`, true, false);

  if (typeof showToast === 'function') {
    showToast(`🎉 PURCHASED ${pack.name}! Unlocked: ${result.names.join(', ')}! 🎁`, 4500);
  }

  // Animate Pack opening: shrink/dissolve pack at checkout tray, then respawn fresh back on shelf
  pack.mesh.position.copy(xrCheckoutDropPos);
  pack.isDropping = true;

  setTimeout(() => {
    animatePackReturnToShelf(pack);
    pack.isDropping = false;
  }, 1200);
}

function animatePackReturnToShelf(pack) {
  if (!pack) return;
  pack.mesh.position.copy(pack.localPos);
  pack.mesh.rotation.copy(pack.localRot);
  pack.isGrabbed = false;
}

function handlePackClickOrPickup(pack) {
  if (!pack) return;
  xrSelectedPackForCheckout = pack;

  // On desktop / pointer click: Smoothly glide pack to Checkout Tray and execute checkout!
  triggerHapticPulse(null, 0.6, 150);
  if (typeof Sound !== 'undefined' && Sound.place) Sound.place();

  if (typeof showToast === 'function') {
    showToast(`🛒 Picked up ${pack.name}! Placing on Checkout Tray...`, 2000);
  }

  updateCheckoutRegisterScreen(`Scanning ${pack.name} (${pack.cost} ◉)...`);

  // Animate gliding over to the checkout tray
  pack.mesh.position.set(xrCheckoutDropPos.x, xrCheckoutDropPos.y + 0.3, xrCheckoutDropPos.z);
  pack.mesh.rotation.set(-0.25, 0, 0);

  setTimeout(() => {
    executePackCheckout(pack);
  }, 600);
}

// ---- Spatial Audio Synthesizer Engine for Tavern Hearth -------------------
let vrPortalAudioCtx = null;
let tavernFireplaceGain = null;
let tavernHearthOsc = null;
let isTavernAudioActive = false;

function initTavernAudio() {
  if (isTavernAudioActive) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!vrPortalAudioCtx) {
      vrPortalAudioCtx = (typeof Sound !== 'undefined' && Sound.ensureCtx) ? Sound.ensureCtx() : new AudioContextClass();
    }
    if (!vrPortalAudioCtx) return;

    if (vrPortalAudioCtx.state === 'suspended') {
      vrPortalAudioCtx.resume().catch(() => {});
    }

    // Warm hearth undertone oscillator
    tavernHearthOsc = vrPortalAudioCtx.createOscillator();
    tavernHearthOsc.type = 'sine';
    tavernHearthOsc.frequency.setValueAtTime(65, vrPortalAudioCtx.currentTime); // 65Hz warm resonance

    const hearthFilter = vrPortalAudioCtx.createBiquadFilter();
    hearthFilter.type = 'lowpass';
    hearthFilter.frequency.setValueAtTime(140, vrPortalAudioCtx.currentTime);

    tavernFireplaceGain = vrPortalAudioCtx.createGain();
    tavernFireplaceGain.gain.setValueAtTime(0, vrPortalAudioCtx.currentTime);

    tavernHearthOsc.connect(hearthFilter);
    hearthFilter.connect(tavernFireplaceGain);
    tavernFireplaceGain.connect(vrPortalAudioCtx.destination);

    tavernHearthOsc.start();
    isTavernAudioActive = true;
  } catch (e) {
    console.warn('Tavern spatial audio init error:', e);
  }
}

function updateTavernSpatialAudio(cameraPos) {
  if (!cameraPos) return;

  if (!isTavernAudioActive) {
    initTavernAudio();
  }

  if (vrPortalAudioCtx && vrPortalAudioCtx.state === 'suspended') {
    vrPortalAudioCtx.resume().catch(() => {});
  }

  // Calculate distance to the Fireplace Hearth at (0, 0.5, 4.8)
  const fireplacePos = new THREE.Vector3(0, 0.5, 4.8);
  const camVec = cameraPos instanceof THREE.Vector3 ? cameraPos : new THREE.Vector3(cameraPos.x || 0, cameraPos.y || 1.6, cameraPos.z || 0);
  const dist = camVec.distanceTo(fireplacePos);

  if (tavernFireplaceGain && vrPortalAudioCtx) {
    const now = vrPortalAudioCtx.currentTime;
    const maxDist = 9.0;
    if (dist > maxDist) {
      tavernFireplaceGain.gain.setTargetAtTime(0.0, now, 0.1);
    } else {
      const prox = 1.0 - (dist / maxDist);
      const vol = Math.pow(prox, 1.5) * 0.18;
      tavernFireplaceGain.gain.setTargetAtTime(vol, now, 0.08);
    }
  }
}

let xrShopPedestals = [];
let xrInteractiveArtifacts = [];
let xrGrabbedArtifact = null;
let xrGrabbedController = null;

function buildArtifactTexture(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 256, 384);

  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 376);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, 128, 50);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px Arial';
  ctx.fillText(subtitle, 128, 80);

  ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';
  ctx.fillRect(20, 110, 216, 200);

  ctx.fillStyle = '#00f3ff';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('🔮 VR RELIC', 128, 210);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '14px Arial';
  ctx.fillText('Trigger-Grab to Inspect', 128, 335);

  return new THREE.CanvasTexture(canvas);
}

function buildInteractiveArtifacts() {
  xrInteractiveArtifacts = [];
  const artifactData = [
    { title: "Chrono Knight", sub: "Legendary Unit", color: 0x3b82f6 },
    { title: "Void Sorcerer", sub: "Mythic Spellcaster", color: 0x8b5cf6 },
    { title: "Quantum Sentinel", sub: "Heavy Defender", color: 0x10b981 },
    { title: "Apex Overlord", sub: "Supreme Commander", color: 0xf59e0b }
  ];

  artifactData.forEach((data, idx) => {
    // Positioned along the podiums in Chamber 2 (Collection & Quests Library: x = -11.5, z = -5.5)
    const px = -11.5 + (idx - 1.5) * 1.4;
    const pz = -4.2;
    const py = 0.9;

    const texture = buildArtifactTexture(data.title, data.sub);
    const geom = new THREE.BoxGeometry(0.5, 0.75, 0.05);
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.2, metalness: 0.5 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(px, py, pz);
    mesh.name = `artifact_${idx}`;
    xrInteractiveGroup.add(mesh);

    xrInteractiveArtifacts.push({
      mesh,
      initialPos: mesh.position.clone(),
      data,
      floatOffset: idx * 1.5
    });
  });
}

function buildPedestalPlateTexture(item) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = item.rarity === 'MYTHIC' ? '#f59e0b' : '#00f3ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 124);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(item.name || 'Cosmetic', 128, 36);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Arial';
  let descLine1 = item.desc || '';
  if (descLine1.length > 40) descLine1 = descLine1.substring(0, 38) + '...';
  ctx.fillText(descLine1, 128, 62);

  const isOwned = typeof ownsCosmetic === 'function' && ownsCosmetic(item.id);
  ctx.fillStyle = isOwned ? '#10b981' : '#f59e0b';
  ctx.font = 'bold 14px Arial';
  const statusText = isOwned ? (item.kind === 'sleeve' ? '✓ OWNED' : '✓ UNLOCKED') : `🛒 ${item.cost.toLocaleString()} BUX`;
  ctx.fillText(statusText, 128, 100);

  return new THREE.CanvasTexture(canvas);
}

function buildShopPedestalsInArena() {
  xrShopPedestals = [];
  const items = (typeof COSMETIC_ITEMS !== 'undefined' ? COSMETIC_ITEMS : []).slice(0, 8);

  items.forEach((item, idx) => {
    // Placed along display counters in Chamber 3 (Tavern Shop & Bar: x = 11.5, z = -5.5)
    const px = 11.5 + ((idx % 4) - 1.5) * 1.35;
    const pz = -4.0 - Math.floor(idx / 4) * 2.2;

    const pedGroup = new THREE.Group();
    pedGroup.position.set(px, -0.5, pz);
    xrScene.add(pedGroup);

    const baseGeom = new THREE.CylinderGeometry(0.35, 0.45, 0.8, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.4;
    pedGroup.add(base);

    const rimGeom = new THREE.TorusGeometry(0.36, 0.02, 8, 24);
    const rimMat = new THREE.MeshBasicMaterial({ color: item.rarity === 'MYTHIC' ? 0xf59e0b : 0x00f3ff });
    const rim = new THREE.Mesh(rimGeom, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.81;
    pedGroup.add(rim);

    const texture = buildPedestalPlateTexture(item);
    const plateGeom = new THREE.PlaneGeometry(0.55, 0.28);
    const plateMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const plate = new THREE.Mesh(plateGeom, plateMat);
    plate.position.set(0, 0.55, 0.42);
    plate.rotation.set(-0.25, 0, 0);
    plate.name = `shop_plate_${item.id}`;
    xrInteractiveGroup.add(plate);

    const geom = new THREE.OctahedronGeometry(0.2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff00cc, emissive: 0x701a75, roughness: 0.1 });
    const previewMesh = new THREE.Mesh(geom, mat);
    previewMesh.position.set(0, 1.1, 0);
    previewMesh.name = `shop_preview_${item.id}`;
    xrInteractiveGroup.add(previewMesh);

    xrShopPedestals.push({ group: pedGroup, item, panelMesh: plate, previewMesh });
  });
}

function triggerXRShopPurchase(itemId) {
  const item = COSMETIC_ITEMS.find(x => x.id === itemId);
  if (!item) return;

  if (typeof buyOrEquipCosmetic === 'function') {
    buyOrEquipCosmetic(item);
  } else {
    const isOwned = typeof ownsCosmetic === 'function' && ownsCosmetic(item.id);
    if (!isOwned) {
      const bal = typeof loadBux === 'function' ? loadBux() : 1000;
      if (bal >= item.cost) {
        if (typeof saveBux === 'function') saveBux(bal - item.cost);
        if (typeof unlockCosmetic === 'function') unlockCosmetic(item.id);
        if (typeof showToast === 'function') showToast(`Purchased ${item.name} in VR! 🛍️`);
      } else {
        if (typeof showToast === 'function') showToast(`Not enough Bux! Needs ${item.cost} ◉`);
      }
    } else {
      if (typeof showToast === 'function') showToast(`Already own ${item.name}! ✓`);
    }
  }

  xrShopPedestals.forEach(p => {
    if (p.item.id === itemId) {
      p.panelMesh.material.map = buildPedestalPlateTexture(p.item);
      p.panelMesh.material.needsUpdate = true;
    }
  });
}

let xrMenuConsoleGroup = null;
let xrHudGroup = null;
let xrHudCanvas = null;
let xrHudTexture = null;

function build3DMenuButtonTexture(label, isHighlighted = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  const palette = getThemeColorPalette();

  ctx.fillStyle = isHighlighted ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(0, 0, 384, 80);

  ctx.strokeStyle = isHighlighted ? '#f59e0b' : '#00f3ff';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 378, 74);

  ctx.fillStyle = isHighlighted ? '#fbbf24' : '#ffffff';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = isHighlighted ? '#f59e0b' : '#00f3ff';
  ctx.shadowBlur = 10;
  ctx.fillText(label, 192, 50);

  return new THREE.CanvasTexture(canvas);
}

function buildFloatingUI() {
  const palette = getThemeColorPalette();

  // 1. Giant Spectator Billboard Screen on North Wall of Battle Hall
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 15, 30, 0.88)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 124);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MEHRBOD CARDS TAVERN BATTLE ENGINE', 256, 46);
  ctx.fillStyle = '#fde68a';
  ctx.font = '16px Arial';
  ctx.fillText(`Active Theme: ${palette.name}`, 256, 82);

  const texture = new THREE.CanvasTexture(canvas);
  const screenGeom = new THREE.PlaneGeometry(6, 1.8);
  const screenMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
  const screen = new THREE.Mesh(screenGeom, screenMat);
  screen.position.set(0, 4.2, -15.4);
  xrScene.add(screen);

  // 2. 3D Floating Interactive Main Menu Console in Tavern Commons Atrium
  if (xrMenuConsoleGroup) xrScene.remove(xrMenuConsoleGroup);
  xrMenuConsoleGroup = new THREE.Group();
  xrMenuConsoleGroup.position.set(0, 1.6, -2.2);
  xrScene.add(xrMenuConsoleGroup);

  // Menu Console Header
  const menuHeaderCanvas = document.createElement('canvas');
  menuHeaderCanvas.width = 512;
  menuHeaderCanvas.height = 96;
  const mCtx = menuHeaderCanvas.getContext('2d');
  mCtx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  mCtx.fillRect(0, 0, 512, 96);
  mCtx.strokeStyle = '#00f3ff';
  mCtx.lineWidth = 4;
  mCtx.strokeRect(2, 2, 508, 92);
  mCtx.fillStyle = '#ffffff';
  mCtx.font = 'bold 28px Arial';
  mCtx.textAlign = 'center';
  mCtx.fillText('🎴 3D TAVERN CONSOLE 🎴', 256, 42);
  mCtx.fillStyle = '#f59e0b';
  mCtx.font = '18px Arial';
  mCtx.fillText('Select an option with VR Laser or Pointer Click', 256, 74);

  const menuHeaderTex = new THREE.CanvasTexture(menuHeaderCanvas);
  const menuHeaderMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.42),
    new THREE.MeshBasicMaterial({ map: menuHeaderTex, side: THREE.DoubleSide })
  );
  menuHeaderMesh.position.set(0, 0.8, 0);
  xrMenuConsoleGroup.add(menuHeaderMesh);

  // 3D Menu Buttons
  const menuButtonsDef = [
    { id: 'menu_play_bot', label: '⚔️ PLAY MATCH VS BOT' },
    { id: 'menu_shop', label: '🛍️ MEHRBOD SHOP' },
    { id: 'menu_collection', label: '🎴 COLLECTION & DECK' },
    { id: 'menu_stats', label: '📊 CAREER STATS & BUX' },
    { id: 'menu_theme', label: `🎨 THEME: ${palette.name}` },
  ];

  xrMenuButtons = [];
  menuButtonsDef.forEach((btnDef, idx) => {
    const tex = build3DMenuButtonTexture(btnDef.label);
    const btnGeom = new THREE.PlaneGeometry(1.8, 0.28);
    const btnMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const btnMesh = new THREE.Mesh(btnGeom, btnMat);
    btnMesh.position.set(0, 0.35 - idx * 0.34, 0);
    btnMesh.name = btnDef.id;
    xrMenuConsoleGroup.add(btnMesh);
    xrInteractiveGroup.add(btnMesh);
    xrMenuButtons.push({ mesh: btnMesh, id: btnDef.id, label: btnDef.label });
  });

  // 3. 3D Live Battle HUD & Scoreboard (Centered above the Battle Table)
  if (xrHudGroup) xrScene.remove(xrHudGroup);
  xrHudGroup = new THREE.Group();
  xrHudGroup.position.set(0, 2.3, -11.5);
  xrScene.add(xrHudGroup);

  xrHudCanvas = document.createElement('canvas');
  xrHudCanvas.width = 640;
  xrHudCanvas.height = 160;
  xrHudTexture = new THREE.CanvasTexture(xrHudCanvas);

  const hudGeom = new THREE.PlaneGeometry(3.0, 0.75);
  const hudMat = new THREE.MeshBasicMaterial({ map: xrHudTexture, side: THREE.DoubleSide, transparent: true });
  const hudMesh = new THREE.Mesh(hudGeom, hudMat);
  xrHudGroup.add(hudMesh);

  // 4. 3D READY / END TURN Button on Battle Table right edge
  const readyCanvas = document.createElement('canvas');
  readyCanvas.width = 256;
  readyCanvas.height = 128;
  const rCtx = readyCanvas.getContext('2d');
  rCtx.fillStyle = '#059669';
  rCtx.fillRect(0, 0, 256, 128);
  rCtx.strokeStyle = '#ffffff';
  rCtx.lineWidth = 6;
  rCtx.strokeRect(3, 3, 250, 122);
  rCtx.fillStyle = '#ffffff';
  rCtx.font = 'bold 32px Arial';
  rCtx.textAlign = 'center';
  rCtx.fillText('END TURN ⚔️', 128, 76);

  const readyTex = new THREE.CanvasTexture(readyCanvas);
  const readyGeom = new THREE.BoxGeometry(0.75, 0.16, 0.38);
  const readyMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ map: readyTex }),
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
  ];
  xrReadyButton = new THREE.Mesh(readyGeom, readyMaterials);
  xrReadyButton.position.set(1.6, 0.35, -10.5);
  xrReadyButton.name = 'ready_btn';
  xrInteractiveGroup.add(xrReadyButton);
}

// ---- WebXR Setup ---------------------------------------------------------
function setupXRButton() {
  const btnContainer = document.getElementById('webxr-button-container');
  if (!btnContainer) return;
  btnContainer.innerHTML = '';

  if (typeof THREE.VRButton !== 'undefined') {
    const vrButton = THREE.VRButton.createButton(xrRenderer);
    vrButton.className = 'primary-btn glass-pill-btn';
    vrButton.style.position = 'static';
    vrButton.style.margin = '0 auto';
    btnContainer.appendChild(vrButton);
  } else {
    btnContainer.innerHTML = '<div style="color: #94a3b8; font-size: 0.82rem;">XR Mode Offline - View as 3D Hologram</div>';
  }
}

function setupXRControllers() {
  xrControllers = [];
  xrHands = [];

  // Setup local controller 1 (Right)
  const c1 = xrRenderer.xr.getController(0);
  c1.addEventListener('selectstart', onXRSelectStart);
  c1.addEventListener('selectend', onXRSelectEnd);
  xrScene.add(c1);
  xrControllers.push(c1);

  // Setup local controller 2 (Left)
  const c2 = xrRenderer.xr.getController(1);
  c2.addEventListener('selectstart', onXRSelectStart);
  c2.addEventListener('selectend', onXRSelectEnd);
  xrScene.add(c2);
  xrControllers.push(c2);

  // Add glowing laser pointer lines to both controllers
  const pointerGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -4)
  ]);
  const pointerMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.6 });
  const laserLine = new THREE.Line(pointerGeom, pointerMat);
  laserLine.name = 'laser';

  c1.add(laserLine.clone());
  c2.add(laserLine.clone());

  // WebXR Hand Tracking Support (Index-to-Thumb Pinch & Gestures)
  if (typeof xrRenderer.xr.getHand === 'function') {
    for (let i = 0; i < 2; i++) {
      const hand = xrRenderer.xr.getHand(i);
      xrScene.add(hand);
      xrHands.push(hand);
    }
  }
}

// ---- Interactive Dynamic Card Texture Builder -----------------------------
function buildCardTexture(card) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  // Solid background representing card Tier
  const tierColors = {
    1: ['#1e40af', '#1d4ed8'], // Blue
    2: ['#166534', '#15803d'], // Green
    3: ['#991b1b', '#b91c1c'], // Red
    4: ['#9a3412', '#c2410c']  // Orange
  };
  const colors = tierColors[card.tier] || ['#334155', '#475569'];
  const gradient = ctx.createLinearGradient(0, 0, 0, 384);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 384);

  // Card border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 374);

  // Card Header / Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(card.name || 'Unit', 128, 50);

  // Divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 70);
  ctx.lineTo(236, 70);
  ctx.stroke();

  // Ability / Description text
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px Arial';
  const abilityLabel = card.ability && card.ability.id !== 'none' ? (card.ability.label || 'Special ability') : 'Standard Unit';
  const words = abilityLabel.split(' ');
  let line = '';
  let y = 160;
  for (let i = 0; i < words.length; i++) {
    let testLine = line + words[i] + ' ';
    let metrics = ctx.measureText(testLine);
    if (metrics.width > 220 && i > 0) {
      ctx.fillText(line, 128, y);
      line = words[i] + ' ';
      y += 22;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 128, y);

  // Bottom stats panel background
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(15, 305, 226, 60);

  // Stat values (HP, ATK/DMG, SP)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`❤️ HP: ${card.hp}/${card.maxHp || card.hp}`, 30, 342);
  ctx.textAlign = 'right';
  ctx.fillText(`⚔️ DMG: ${card.dmg}`, 226, 342);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ---- Live Game Loop Synchronization ---------------------------------------
function update3DHudCanvas() {
  if (!xrHudCanvas || !xrHudTexture) return;
  const ctx = xrHudCanvas.getContext('2d');
  ctx.clearRect(0, 0, 640, 160);

  const myKey = typeof localKey !== 'undefined' ? localKey : 'you';
  const opKey = typeof remoteKey !== 'undefined' ? remoteKey : 'bot';

  if (typeof state !== 'undefined' && state && state.players) {
    const p1 = state.players[myKey] || {};
    const p2 = state.players[opKey] || {};

    // Background Glass Panel
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, 0, 640, 160);
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 636, 156);

    // Round & Phase Banner
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`ROUND ${state.round || 1} • PHASE: ${(state.phase || 'PLACEMENT').toUpperCase()}`, 320, 36);

    // Player Stats (Left Side)
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`YOU (${myKey})`, 30, 75);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    ctx.fillText(`❤️ Deck Pool: ${p1.deck ? p1.deck.length : 0}`, 30, 108);
    ctx.fillText(`🛡️ Defending: ${Object.keys(p1.defendingSlots || {}).length}`, 30, 138);

    // Opponent Stats (Right Side)
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`BOT (${opKey})`, 610, 75);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    ctx.fillText(`❤️ Deck Pool: ${p2.deck ? p2.deck.length : 0}`, 610, 108);
    ctx.fillText(`🛡️ Defending: ${Object.keys(p2.defendingSlots || {}).length}`, 610, 138);
  } else {
    // Menu Mode Scoreboard Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, 640, 160);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 636, 156);

    const palette = getThemeColorPalette();
    const bux = typeof loadBux === 'function' ? loadBux() : 1000;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ 3D VR ARENA READY ⚡', 320, 50);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '20px Arial';
    ctx.fillText(`💰 Balance: ${bux} Bux  |  🎨 Theme: ${palette.name}`, 320, 95);
    ctx.fillStyle = '#67e8f9';
    ctx.font = '16px Arial';
    ctx.fillText('Click "PLAY MATCH VS BOT" to begin 3D Battle!', 320, 135);
  }

  xrHudTexture.needsUpdate = true;
}

function syncLiveGameStateTo3D() {
  update3DHudCanvas();

  if (typeof state === 'undefined' || !state) {
    if (xrMenuConsoleGroup) xrMenuConsoleGroup.position.set(0, 1.6, -2.2);
    return;
  } else {
    // Elevate Menu Console out of active battle line of sight during match
    if (xrMenuConsoleGroup) xrMenuConsoleGroup.position.set(0, 5.0, -11.5);
  }

  const myKey = typeof localKey !== 'undefined' ? localKey : 'you';
  const opKey = typeof remoteKey !== 'undefined' ? remoteKey : 'bot';

  const myPlayer = state.players[myKey];
  const opPlayer = state.players[opKey];
  if (!myPlayer || !opPlayer) return;

  // 1. Sync Hands (Deck) - Positioned in front of the player seated at the battle table
  xrHandCards.forEach(c => xrInteractiveGroup.remove(c.mesh));
  xrHandCards = [];

  const handCards = myPlayer.deck || [];
  handCards.forEach((c, idx) => {
    if (idx > 5) return;

    const texture = buildCardTexture(c);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ map: texture }),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    ];

    const cardGeom = new THREE.BoxGeometry(0.5, 0.75, 0.01);
    const cardMesh = new THREE.Mesh(cardGeom, materials);

    const arcAngle = 0.35;
    const offset = (idx - (Math.min(handCards.length, 6) - 1) / 2) * 0.52;
    cardMesh.position.set(offset, 0.62, -9.6);
    cardMesh.rotation.set(-0.32, -offset * arcAngle, 0);
    cardMesh.name = `hand_card_${idx}`;

    if (selectedHandIndex === idx) {
      cardMesh.position.y += 0.12;
      cardMesh.position.z -= 0.05;
      cardMesh.scale.set(1.1, 1.1, 1);
    }

    xrInteractiveGroup.add(cardMesh);
    xrHandCards.push({ mesh: cardMesh, card: c, handIndex: idx });
  });

  // 2. Sync Board Cards on Battle Table (z = -11.0 for Player, z = -12.0 for Opponent)
  xrBoardCards.forEach(c => xrInteractiveGroup.remove(c.mesh));
  xrBoardCards = [];

  // Sync Player Board
  const myBoard = myPlayer.board || [];
  myBoard.forEach((c, idx) => {
    if (!c || idx > 5) return;
    const texture = buildCardTexture(c);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ map: texture }),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    ];

    const cardGeom = new THREE.BoxGeometry(0.58, 0.88, 0.02);
    const cardMesh = new THREE.Mesh(cardGeom, materials);

    cardMesh.position.set((idx - 2.5) * 0.72, 0.29, -11.0);
    cardMesh.rotation.set(-Math.PI / 2, 0, 0);
    cardMesh.name = `board_card_player_${idx}`;

    const isDefending = myPlayer.defendingSlots && myPlayer.defendingSlots[idx];
    if (isDefending) {
      cardMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
      cardMesh.position.y += 0.08;
    }

    xrInteractiveGroup.add(cardMesh);
    xrBoardCards.push({ mesh: cardMesh, card: c, owner: 'player', slot: idx });
  });

  // Sync Opponent Board
  const opBoard = opPlayer.board || [];
  opBoard.forEach((c, idx) => {
    if (!c || idx > 5) return;
    const texture = buildCardTexture(c);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a }),
      new THREE.MeshStandardMaterial({ map: texture }),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    ];

    const cardGeom = new THREE.BoxGeometry(0.58, 0.88, 0.02);
    const cardMesh = new THREE.Mesh(cardGeom, materials);

    cardMesh.position.set((idx - 2.5) * 0.72, 0.29, -12.0);
    cardMesh.rotation.set(-Math.PI / 2, 0, Math.PI);
    cardMesh.name = `board_card_opponent_${idx}`;

    const isDefending = opPlayer.defendingSlots && opPlayer.defendingSlots[idx];
    if (isDefending) {
      cardMesh.rotation.set(-Math.PI / 2, 0, Math.PI + Math.PI / 4);
      cardMesh.position.y += 0.08;
    }

    xrInteractiveGroup.add(cardMesh);
    xrBoardCards.push({ mesh: cardMesh, card: c, owner: 'opponent', slot: idx });
  });
}

// ---- Controller Interaction Handlers ---------------------------------------
function handleXRIntersection(intersections) {
  if (intersections.length === 0) return;
  const obj = intersections[0].object;

  // A. Teleporter Locomotion Pads
  if (obj.name && obj.name.startsWith('teleport_')) {
    if (obj.name === 'teleport_hub') teleportToLocation([0, -0.48, 2.0]);
    else if (obj.name === 'teleport_battle') teleportToLocation([0, -0.48, -10.0]);
    else if (obj.name === 'teleport_collection') teleportToLocation([-10.0, -0.48, 0.0]);
    else if (obj.name === 'teleport_shop') teleportToLocation([10.0, -0.48, 0.0]);
    else if (obj.name === 'teleport_stats') teleportToLocation([-7.5, -0.48, 7.5]);
    else if (obj.name === 'teleport_rewards') teleportToLocation([7.5, -0.48, 7.5]);
    return;
  }

  // A1. Interactive Shop Shelf Item Selection -> Move to Checkout Tray
  if (obj.name && obj.name.startsWith('shopitem_')) {
    if (obj.userData && obj.userData.name) {
      xrSelectedShopItem = obj.userData;
      // Animate item mesh onto Checkout Tray
      obj.position.set(9.6, 0.45, -1.2);
      if (typeof Sound !== 'undefined' && Sound.place) Sound.place();
      if (typeof showToast === 'function') {
        showToast(`🛒 MOVED ${obj.userData.name} TO CHECKOUT TRAY! PRESS REGISTER TO BUY!`, 2500);
      }

      // Refresh Register Screen Mesh Canvas
      if (xrCheckoutBannerMesh) {
        const regCanvas = document.createElement('canvas');
        regCanvas.width = 384;
        regCanvas.height = 192;
        const regCtx = regCanvas.getContext('2d');
        regCtx.fillStyle = '#1e293b';
        regCtx.fillRect(0, 0, 384, 192);
        regCtx.strokeStyle = '#f59e0b';
        regCtx.lineWidth = 6;
        regCtx.strokeRect(3, 3, 378, 186);

        regCtx.fillStyle = '#fef3c7';
        regCtx.font = 'bold 22px Arial';
        regCtx.textAlign = 'center';
        regCtx.fillText('🔔 MEHRBOD SHOP REGISTER', 192, 40);

        regCtx.fillStyle = '#38bdf8';
        regCtx.font = '16px Arial';
        regCtx.fillText(`ITEM: ${xrSelectedShopItem.name}`, 192, 85);
        regCtx.fillText(`PRICE: ${xrSelectedShopItem.price} BUX ◉`, 192, 120);

        regCtx.fillStyle = '#16a34a';
        regCtx.fillRect(20, 140, 344, 42);
        regCtx.fillStyle = '#ffffff';
        regCtx.font = 'bold 18px Arial';
        regCtx.fillText('💰 CLICK TO BUY & CLAIM ITEM', 192, 168);

        xrCheckoutBannerMesh.material.map = new THREE.CanvasTexture(regCanvas);
        xrCheckoutBannerMesh.material.needsUpdate = true;
      }
    }
    return;
  }

  // A2. Cash Register Buy Button Click
  if (obj.name === 'menu_buy_checkout_item') {
    const currentBux = typeof loadBux === 'function' ? loadBux() : 1000;
    const price = xrSelectedShopItem.price || 350;
    if (currentBux >= price) {
      if (typeof saveBux === 'function') saveBux(currentBux - price);
      if (typeof Sound !== 'undefined' && Sound.place) Sound.place();
      triggerEmoteBurst('stars', 180);
      if (typeof showToast === 'function') {
        showToast(`🎉 PURCHASED ${xrSelectedShopItem.name}! ADDED TO COLLECTION! 🪙`, 3500);
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`⚠️ INSUFFICIENT BUX! (Need ${price} Bux, you have ${currentBux} Bux)`, 3000);
      }
    }
    return;
  }

  // A2. 3D Main Menu Console Buttons & Emote Buttons
  if (obj.name === 'emote_victory') {
    fireEmoteGesture('stars', 'VICTORY CELEBRATION 👑');
    return;
  }
  if (obj.name === 'emote_fire') {
    fireEmoteGesture('fire', 'INFERNO TAUNT 🔥');
    return;
  }
  if (obj.name === 'emote_hearts') {
    fireEmoteGesture('hearts', 'GOOD GAME 💖');
    return;
  }
  if (obj.name === 'emote_cyber') {
    fireEmoteGesture('cyber', 'CYBER SPARK ⚡');
    return;
  }

  if (obj.name === 'menu_play_bot') {
    if (typeof startVsBot === 'function') {
      startVsBot(0);
      if (typeof showToast === 'function') showToast('⚔️ TAVERN MATCH STARTED VS BOT!');
    }
    return;
  }

  if (obj.name === 'menu_shop') {
    if (typeof showScreen === 'function') showScreen('screen-shop');
    if (typeof showToast === 'function') showToast('🛍️ MEHRBOD TAVERN SHOP OPENED!');
    return;
  }

  if (obj.name === 'menu_collection') {
    if (typeof showScreen === 'function') showScreen('screen-collection');
    if (typeof showToast === 'function') showToast('🎴 CARD COLLECTION OPENED!');
    return;
  }

  if (obj.name === 'menu_decks') {
    if (typeof showScreen === 'function') showScreen('screen-deckbuilder');
    if (typeof showToast === 'function') showToast('⚔️ DECK BUILDER OPENED!');
    return;
  }

  if (obj.name === 'menu_quests') {
    if (typeof showScreen === 'function') showScreen('screen-quests');
    if (typeof showToast === 'function') showToast('📜 TAVERN QUESTS OPENED!');
    return;
  }

  if (obj.name === 'menu_daily_rewards') {
    const bux = typeof loadBux === 'function' ? loadBux() : 1000;
    const bonus = 250;
    if (typeof saveBux === 'function') saveBux(bux + bonus);
    if (typeof Sound !== 'undefined' && Sound.place) Sound.place();
    if (typeof showToast === 'function') showToast(`🎁 CLAIMED TAVERN DAILY BONUS +${bonus} BUX! 🪙`, 3000);
    return;
  }

  if (obj.name === 'menu_stats') {
    if (typeof showScreen === 'function') showScreen('screen-stats');
    if (typeof showToast === 'function') showToast('📊 CAREER HALL OF HONOR OPENED!');
    return;
  }

  if (obj.name === 'menu_theme') {
    const themeList = ['prism', 'cyberneon', 'mrmoney', 'magma', 'inferno', 'synthwave', 'matrix', 'galaxy', 'sakura', 'aurora', 'steampunk'];
    const curr = localStorage.getItem('mehrbod-cards-theme') || 'prism';
    const nextIdx = (themeList.indexOf(curr) + 1) % themeList.length;
    const nextTheme = themeList[nextIdx];
    localStorage.setItem('mehrbod-cards-theme', nextTheme);
    if (typeof applyTheme === 'function') applyTheme(nextTheme);

    // Rebuild 3D Arena to apply new theme colors in VR!
    if (xrScene) {
      while (xrScene.children.length > 0) {
        xrScene.remove(xrScene.children[0]);
      }
      xrInteractiveGroup = new THREE.Group();
      xrScene.add(xrInteractiveGroup);
      buildCyberArena();
      if (typeof showToast === 'function') {
        const pal = getThemeColorPalette();
        showToast(`🎨 3D THEME SWITCHED: ${pal.name}!`);
      }
    }
    return;
  }

  // B. Hand Card Selection with Weight-based Physical Feedback
  if (obj.name.startsWith('hand_card_')) {
    const idx = parseInt(obj.name.replace('hand_card_', ''));
    const handObj = xrHandCards[idx];
    const card = handObj ? handObj.card : null;
    const rarity = card ? (card.rarity || 'common').toLowerCase() : 'common';

    if (rarity === 'legendary' || rarity === 'mythic') {
      triggerHapticPulse(null, 1.0, 220); // Heavy physical weight feel
    } else if (rarity === 'rare' || rarity === 'epic') {
      triggerHapticPulse(null, 0.65, 140); // Medium physical weight feel
    } else {
      triggerHapticPulse(null, 0.35, 80); // Light physical weight feel
    }

    selectedHandIndex = (selectedHandIndex === idx) ? null : idx;
    if (typeof Sound !== 'undefined' && Sound.cardHover) Sound.cardHover();
    syncLiveGameStateTo3D();
    return;
  }

  // C. Player Board Slot Click
  if (obj.name.startsWith('slot_player_')) {
    const slotIdx = parseInt(obj.name.replace('slot_player_', ''));
    if (selectedHandIndex !== null) {
      if (typeof applyActionAndRender === 'function') {
        const myKey = typeof localKey !== 'undefined' ? localKey : 'you';
        applyActionAndRender({
          type: 'place',
          player: myKey,
          handIndex: selectedHandIndex,
          slot: slotIdx
        });
        selectedHandIndex = null;
        if (typeof Sound !== 'undefined' && Sound.place) Sound.place();
      }
    }
    return;
  }

  // D. Toggle Defense on Board Card
  if (obj.name.startsWith('board_card_player_')) {
    const slotIdx = parseInt(obj.name.replace('board_card_player_', ''));
    if (typeof applyActionAndRender === 'function') {
      const myKey = typeof localKey !== 'undefined' ? localKey : 'you';
      applyActionAndRender({
        type: 'defend',
        player: myKey,
        slot: slotIdx
      });
    }
    return;
  }

  // E. Direct Attack on Opponent Card
  if (obj.name.startsWith('board_card_opponent_')) {
    const enemySlotIdx = parseInt(obj.name.replace('board_card_opponent_', ''));
    const myKey = typeof localKey !== 'undefined' ? localKey : 'you';
    const opKey = typeof remoteKey !== 'undefined' ? remoteKey : 'bot';
    const myPlayer = state?.players[myKey];
    if (myPlayer) {
      const activeSlot = myPlayer.board.findIndex((c, i) => c !== null && !myPlayer.defendingSlots[i]);
      if (activeSlot !== -1 && typeof applyActionAndRender === 'function') {
        applyActionAndRender({
          type: 'attack',
          player: myKey,
          slot: activeSlot,
          targetOwner: opKey,
          targetSlot: enemySlotIdx
        });
      }
    }
    return;
  }

  // F. Ready / End Turn Button
  if (obj.name === 'ready_btn') {
    if (typeof applyActionAndRender === 'function') {
      const myKey = typeof localKey !== 'undefined' ? localKey : 'you';
      applyActionAndRender({
        type: 'readyPlacement',
        player: myKey
      });
    }
    return;
  }

  // G. Shop Pedestals
  if (obj.name && obj.name.startsWith('shop_plate_')) {
    const itemId = obj.name.replace('shop_plate_', '');
    triggerXRShopPurchase(itemId);
    return;
  }

  // H. Shop Virtual Card Packs & Designated Checkout Tray
  if (obj.name && obj.name.startsWith('shop_pack_')) {
    const packId = obj.name.replace('shop_pack_', '');
    const pack = xrShopPacks.find(p => p.id === packId);
    if (pack) {
      handlePackClickOrPickup(pack);
    }
    return;
  }

  if (obj.name === 'checkout_drop_zone' || obj.name === 'checkout_register_screen') {
    if (xrSelectedPackForCheckout) {
      executePackCheckout(xrSelectedPackForCheckout);
    } else if (xrShopPacks.length > 0) {
      handlePackClickOrPickup(xrShopPacks[0]);
    }
    return;
  }

  // I. Artifact Inspection
  if (obj.name && obj.name.startsWith('artifact_')) {
    const artIdx = parseInt(obj.name.replace('artifact_', ''));
    const art = xrInteractiveArtifacts[artIdx];
    if (art && typeof showToast === 'function') {
      showToast(`Inspected Relic: ${art.data.title} 🔮`);
    }
    return;
  }

  // J. 3D Wheel of Fortune
  if (obj.name === 'menu_fortune_wheel' || obj.name === 'fortune_wheel_mesh') {
    spin3DFortuneWheel();
    return;
  }
}

let isFortuneWheelSpinning = false;
let fortuneWheelVelocity = 0;

function spin3DFortuneWheel() {
  if (isFortuneWheelSpinning) {
    if (typeof showToast === 'function') showToast('The Wheel of Fortune is currently spinning! 🎡');
    return;
  }
  isFortuneWheelSpinning = true;
  fortuneWheelVelocity = 0.42 + Math.random() * 0.25;
  triggerHapticPulse(null, 0.8, 250);
  if (typeof Sound !== 'undefined' && Sound.sparkle) Sound.sparkle();
  if (typeof showToast === 'function') showToast('🎡 Spinning the Wheel of Fortune!');
}

function onXRPointerDown(event) {
  const container = document.getElementById('webxr-canvas-container');
  if (!container) return;

  // Calculate mouse position in normalized device coordinates
  const rect = xrRenderer.domElement.getBoundingClientRect();
  xrMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  xrMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  xrRaycaster.setFromCamera(xrMouse, xrCamera);
  const intersections = xrRaycaster.intersectObjects(xrInteractiveGroup.children, true);
  handleXRIntersection(intersections);
}

function triggerHapticPulse(controller, intensity = 0.5, duration = 150) {
  try {
    const session = xrRenderer?.xr?.getSession();
    if (!session || !session.inputSources) return;
    for (const source of session.inputSources) {
      if (source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators.length > 0) {
        const actuator = source.gamepad.hapticActuators[0];
        if (typeof actuator.pulse === 'function') {
          actuator.pulse(intensity, duration);
        }
      }
    }
  } catch (e) {}
}

function onXRSelectStart(event) {
  const controller = event.target;
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersections = raycaster.intersectObjects(xrInteractiveGroup.children, true);
  if (intersections.length > 0) {
    const hitObj = intersections[0].object;

    // A. Pick up Card Pack from shelf
    if (hitObj.name && hitObj.name.startsWith('shop_pack_')) {
      const packId = hitObj.name.replace('shop_pack_', '');
      const pack = xrShopPacks.find(p => p.id === packId);
      if (pack) {
        xrGrabbedPack = pack;
        xrGrabbedController = controller;
        pack.isGrabbed = true;
        triggerHapticPulse(controller, 0.7, 180);
        if (typeof Sound !== 'undefined' && Sound.cardHover) Sound.cardHover();
        if (typeof showToast === 'function') {
          showToast(`🛒 Picked up ${pack.name}! Move over Checkout Tray and release trigger to purchase! 📥`, 3500);
        }
        updateCheckoutRegisterScreen(`Ready to checkout ${pack.name} (${pack.cost} ◉)`);
        return;
      }
    }

    // B. Grab inspection artifact
    if (hitObj.name && hitObj.name.startsWith('artifact_')) {
      const artIdx = parseInt(hitObj.name.replace('artifact_', ''));
      xrGrabbedArtifact = xrInteractiveArtifacts[artIdx];
      xrGrabbedController = controller;
      triggerHapticPulse(controller, 0.7, 200);
      if (typeof showToast === 'function') {
        showToast(`Grabbed Relic: ${xrGrabbedArtifact.data.title} ✊🔮`);
      }
      return;
    }
  }

  handleXRIntersection(intersections);
}

function onXRSelectEnd(event) {
  const controller = event.target;
  if (xrGrabbedController === controller) {
    // Check if player was holding a card pack
    if (xrGrabbedPack) {
      const pack = xrGrabbedPack;
      const distToCheckout = pack.mesh.position.distanceTo(xrCheckoutDropPos);
      if (distToCheckout < 1.45) {
        executePackCheckout(pack);
      } else {
        animatePackReturnToShelf(pack);
        if (typeof showToast === 'function') {
          showToast(`Returned ${pack.name} to shelf.`);
        }
      }
      pack.isGrabbed = false;
      xrGrabbedPack = null;
      xrGrabbedController = null;
      return;
    }

    triggerHapticPulse(controller, 0.3, 100);
    if (xrGrabbedArtifact && typeof showToast === 'function') {
      showToast(`Released Relic: ${xrGrabbedArtifact.data.title} ✨`);
    }
    xrGrabbedArtifact = null;
    xrGrabbedController = null;
  }
}

function updateXRHandTrackingAndGestures() {
  if (!xrHands || xrHands.length === 0) return;

  xrHands.forEach((hand, handIdx) => {
    if (!hand || !hand.joints) return;

    const indexTip = hand.joints['index-finger-tip'];
    const thumbTip = hand.joints['thumb-tip'];
    const middleTip = hand.joints['middle-finger-tip'];
    const ringTip = hand.joints['ring-finger-tip'];
    const pinkyTip = hand.joints['pinky-finger-tip'];
    const wrist = hand.joints['wrist'];

    if (indexTip && thumbTip) {
      const posI = new THREE.Vector3();
      const posT = new THREE.Vector3();
      indexTip.getWorldPosition(posI);
      thumbTip.getWorldPosition(posT);

      // Pinch gesture distance check (<3.8cm)
      const pinchDist = posI.distanceTo(posT);
      const isPinchingNow = pinchDist < 0.038;

      const pinchMidPos = new THREE.Vector3().addVectors(posI, posT).multiplyScalar(0.5);

      if (isPinchingNow && !xrHandPinchStates[handIdx]) {
        xrHandPinchStates[handIdx] = true;

        const pinchRaycaster = new THREE.Raycaster(pinchMidPos, new THREE.Vector3(0, 0, -1));
        const intersections = pinchRaycaster.intersectObjects(xrInteractiveGroup.children, true);
        if (intersections.length > 0) {
          handleXRIntersection(intersections);
          triggerHapticPulse(null, 0.6, 180);
        }
      } else if (!isPinchingNow && xrHandPinchStates[handIdx]) {
        xrHandPinchStates[handIdx] = false;
      }
    }

    // Gesture Recognition for Emotes (Open Palm, Fist, Victory)
    if (wrist && indexTip && middleTip && ringTip && pinkyTip) {
      const posW = new THREE.Vector3();
      const posI = new THREE.Vector3();
      const posM = new THREE.Vector3();
      const posR = new THREE.Vector3();
      const posP = new THREE.Vector3();

      wrist.getWorldPosition(posW);
      indexTip.getWorldPosition(posI);
      middleTip.getWorldPosition(posM);
      ringTip.getWorldPosition(posR);
      pinkyTip.getWorldPosition(posP);

      const dI = posI.distanceTo(posW);
      const dM = posM.distanceTo(posW);
      const dR = posR.distanceTo(posW);
      const dP = posP.distanceTo(posW);

      // Victory Peace gesture: Index & Middle extended (>0.12m), Ring & Pinky folded (<0.07m)
      if (dI > 0.12 && dM > 0.12 && dR < 0.07 && dP < 0.07) {
        fireEmoteGesture('stars', 'VICTORY POSE 👑');
      }
      // Fist gesture: All fingertips folded close to wrist (<0.07m)
      else if (dI < 0.07 && dM < 0.07 && dR < 0.07 && dP < 0.07) {
        fireEmoteGesture('fire', 'INFERNO TAUNT 🔥');
      }
      // Open Palm gesture: All fingertips extended (>0.14m)
      else if (dI > 0.14 && dM > 0.14 && dR > 0.14 && dP > 0.14) {
        fireEmoteGesture('cyber', 'CYBER SPARK ⚡');
      }
    }
  });
}

// ---- Main Render Frame Loop ----------------------------------------------
function animateXR() {
  // Heavy optimization: Do not run 3D raycasting, matrix calculations, and rendering passes
  // when the browser tab is hidden or when the 3D screen is not currently open/active
  if (typeof document !== 'undefined' && document.hidden) return;
  const isPresenting = Boolean(xrRenderer && xrRenderer.xr && xrRenderer.xr.isPresenting);
  if (!isPresenting) {
    const xrScreen = typeof document !== 'undefined' ? document.getElementById('screen-webxr-arena') : null;
    if (!xrScreen || xrScreen.classList.contains('hidden') || xrScreen.style.display === 'none') {
      return;
    }
  }

  const time = Date.now();

  // Update non-VR mobile joystick & keyboard movement
  if (typeof updateNonVRJoystickMovement === 'function') {
    updateNonVRJoystickMovement();
  }

  // Periodically synchronize the 3D meshes with the 2D game state (every 400ms)
  if (time - lastXRSyncTime > 400) {
    syncLiveGameStateTo3D();
    lastXRSyncTime = time;
  }

  // Process Hand Tracking & Gesture Recognition
  updateXRHandTrackingAndGestures();

  // Animate Fireplace Hearth Flame Light Flicker & Update Spatial Audio
  if (xrFireplaceLight) {
    xrFireplaceLight.intensity = 2.2 + Math.sin(time * 0.012) * 0.5 + (Math.random() - 0.5) * 0.3;
  }
  if (xrCamera) {
    updateTavernSpatialAudio(xrCamera.position);
  }

  // Dynamic 3D Theme Particle Animations
  if (xrThemeParticleData && xrThemeParticleData.length > 0) {
    for (let i = 0; i < xrThemeParticleData.length; i++) {
      const p = xrThemeParticleData[i];
      if (!p || !p.mesh) continue;

      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      p.mesh.rotation.y += p.rotSpeed;
      p.mesh.rotation.x += p.rotSpeed * 0.5;

      // Wrap-around bounds checking in chamber
      if (p.vy > 0 && p.mesh.position.y > 4.2) {
        p.mesh.position.y = -0.45;
        p.mesh.position.x = p.originX + (Math.random() - 0.5) * 6;
        p.mesh.position.z = p.originZ + (Math.random() - 0.5) * 6;
      } else if (p.vy < 0 && p.mesh.position.y < -0.45) {
        p.mesh.position.y = 4.2;
        p.mesh.position.x = p.originX + (Math.random() - 0.5) * 6;
        p.mesh.position.z = p.originZ + (Math.random() - 0.5) * 6;
      }
    }
  }

  // Living glowing fissure / grid pulsation for active theme floors
  if (xrFloorMaterial && xrFloorMaterial.emissive && xrFloorMaterial.emissive.getHex() !== 0) {
    if (xrActiveTheme === 'magma') {
      xrFloorMaterial.emissiveIntensity = 0.32 + Math.sin(time * 0.0035) * 0.2 + (Math.random() - 0.5) * 0.04;
    } else if (xrActiveTheme === 'cyberneon' || xrActiveTheme === 'synthwave' || xrActiveTheme === 'quantum') {
      xrFloorMaterial.emissiveIntensity = 0.35 + Math.sin(time * 0.005) * 0.15;
    } else if (xrActiveTheme === 'glacier' || xrActiveTheme === 'abyss' || xrActiveTheme === 'flame') {
      xrFloorMaterial.emissiveIntensity = 0.28 + Math.sin(time * 0.0025) * 0.12;
    }
  }

  // Slowly rotate background skybox nebula
  if (xrSkyboxSphere) {
    xrSkyboxSphere.rotation.y += 0.0004;
    xrSkyboxSphere.rotation.x += 0.0001;
  }

  // Follow hand controller position with dynamic point light
  if (xrHandLight && xrControllers[0]) {
    const cPos = new THREE.Vector3();
    xrControllers[0].getWorldPosition(cPos);
    xrHandLight.position.copy(cPos);
  }

  // Update 3D Fortune Wheel spinning physics
  if (xrFortuneWheelMesh && isFortuneWheelSpinning) {
    xrFortuneWheelMesh.rotation.z += fortuneWheelVelocity;
    fortuneWheelVelocity *= 0.985;

    if (Math.random() < 0.25 && typeof Sound !== 'undefined' && Sound.click) {
      Sound.click();
    }

    if (fortuneWheelVelocity < 0.003) {
      fortuneWheelVelocity = 0;
      isFortuneWheelSpinning = false;

      const normalizedAngle = ((xrFortuneWheelMesh.rotation.z % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
      const sliceIdx = Math.floor((normalizedAngle / (Math.PI * 2)) * 6) % 6;
      const prizeList = [
        { name: '100 Bux', bux: 100 },
        { name: '250 Bux', bux: 250 },
        { name: '500 Bux Jackpot', bux: 500 },
        { name: 'Exclusive Velvet Sleeve', bux: 200 },
        { name: '150 Bux', bux: 150 },
        { name: 'Mythic Crown Bonus (+350 Bux)', bux: 350 }
      ];
      const prize = prizeList[sliceIdx] || { name: '150 Bux', bux: 150 };

      if (prize.bux) {
        const currBux = typeof loadBux === 'function' ? loadBux() : 1000;
        if (typeof saveBux === 'function') saveBux(currBux + prize.bux);
      }

      spawn3DEmoteParticles(xrFortuneWheelMesh.position, 0xf59e0b, 35);
      if (typeof Sound !== 'undefined' && Sound.victory) Sound.victory();
      if (typeof showToast === 'function') {
        showToast(`🎉 FORTUNE WHEEL PRIZE WON: ${prize.name}! 🎁`, 4000);
      }
    }
  }

  // Update floating artifacts or grabbed inspection artifact
  const t = time * 0.002;
  xrInteractiveArtifacts.forEach((art) => {
    if (art === xrGrabbedArtifact && xrGrabbedController) {
      const targetPos = new THREE.Vector3();
      xrGrabbedController.getWorldPosition(targetPos);
      const dir = new THREE.Vector3(0, 0, -0.35).applyMatrix4(xrGrabbedController.matrixWorld);
      art.mesh.position.copy(targetPos).add(dir);
      art.mesh.quaternion.copy(xrGrabbedController.quaternion);
    } else {
      art.mesh.position.y = art.initialPos.y + Math.sin(t + art.floatOffset) * 0.1;
      art.mesh.rotation.y += 0.005;
    }
  });

  // Update 3D Virtual Card Packs on Shelf or in Player Hands
  xrShopPacks.forEach((pack) => {
    if (pack === xrGrabbedPack && xrGrabbedController) {
      const targetPos = new THREE.Vector3();
      xrGrabbedController.getWorldPosition(targetPos);
      const dir = new THREE.Vector3(0, 0, -0.45).applyMatrix4(xrGrabbedController.matrixWorld);
      pack.mesh.position.copy(targetPos).add(dir);
      pack.mesh.quaternion.copy(xrGrabbedController.quaternion);

      // Pulse scanner if near checkout drop tray
      const distToCheckout = pack.mesh.position.distanceTo(xrCheckoutDropPos);
      if (xrCheckoutScannerMesh) {
        xrCheckoutScannerMesh.material.color.setHex(distToCheckout < 1.45 ? 0xfbbf24 : 0x34d399);
      }
    } else if (!pack.isDropping && !pack.isGrabbed) {
      // Gentle shelf hover oscillation
      pack.mesh.position.y = pack.localPos.y + Math.sin(t + pack.cost) * 0.015;
    }
  });

  // Update Checkout Scanner Animation
  if (xrCheckoutScannerMesh) {
    xrCheckoutScannerMesh.rotation.z += 0.025;
    xrCheckoutScannerMesh.position.y = 0.2 + Math.sin(t * 3.0) * 0.08;
  }

  // Update Floating Reward Cards from opened packs
  for (let i = xrFloatingRewardCards.length - 1; i >= 0; i--) {
    const rc = xrFloatingRewardCards[i];
    rc.life -= 0.006;
    if (rc.mesh.position.y < rc.targetY) {
      rc.mesh.position.y += 0.018;
    }
    rc.mesh.rotation.y += rc.rotSpeed;
    if (rc.life <= 0) {
      xrScene.remove(rc.mesh);
      if (rc.mesh.geometry) rc.mesh.geometry.dispose();
      if (rc.mesh.material) rc.mesh.material.dispose();
      xrFloatingRewardCards.splice(i, 1);
      continue;
    }
    if (rc.life < 0.35) {
      rc.mesh.material.opacity = rc.life / 0.35;
    }
  }

  // Update 3D Emote Particle Systems
  for (let i = xrParticleSystems.length - 1; i >= 0; i--) {
    const ps = xrParticleSystems[i];
    ps.life -= ps.decay;
    if (ps.life <= 0) {
      xrScene.remove(ps.mesh);
      if (ps.mesh.geometry) ps.mesh.geometry.dispose();
      if (ps.mesh.material) ps.mesh.material.dispose();
      xrParticleSystems.splice(i, 1);
      continue;
    }
    ps.mesh.material.opacity = ps.life;
    const posArr = ps.mesh.geometry.attributes.position.array;
    for (let j = 0; j < ps.velocities.length; j++) {
      const v = ps.velocities[j];
      posArr[j * 3] += v.x;
      posArr[j * 3 + 1] += v.y;
      posArr[j * 3 + 2] += v.z;
    }
    ps.mesh.geometry.attributes.position.needsUpdate = true;
  }

  // Update Spatial Audio & Dust Motes for VR Hub
  if (xrCamera) {
    const camPos = new THREE.Vector3();
    xrCamera.getWorldPosition(camPos);
    updateTavernSpatialAudio(camPos);
    updateHubDustMotes(camPos);
  }

  // Update Orbit controls damping
  if (xrControls) {
    xrControls.update();
  }

  // Poll WebXR VR Controllers for Menu Button Press -> Open Settings Menu
  let menuButtonPressedThisFrame = false;
  if (xrRenderer && xrRenderer.xr && xrRenderer.xr.isPresenting) {
    const session = xrRenderer.xr.getSession();
    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.buttons) {
          // Standard VR gamepad mapping: buttons[4] (Menu / Y / B) or buttons[5] or buttons[3]
          const btns = source.gamepad.buttons;
          const isMenuPressed = Boolean((btns[4] && btns[4].pressed) || (btns[5] && btns[5].pressed) || (btns[3] && btns[3].pressed));
          if (isMenuPressed) {
            menuButtonPressedThisFrame = true;
            if (!window.xrMenuBtnWasPressed) {
              window.xrMenuBtnWasPressed = true;
              const settingsBtn = document.getElementById('btn-open-settings-menu') || document.getElementById('btn-open-settings');
              if (settingsBtn) {
                settingsBtn.click();
              } else {
                const overlay = document.getElementById('settings-overlay');
                if (overlay) overlay.classList.toggle('hidden');
              }
              if (typeof Sound !== 'undefined' && typeof Sound.modalOpen === 'function') {
                Sound.modalOpen();
              }
            }
          }
        }
      }
    }
  }
  if (!menuButtonPressedThisFrame) {
    window.xrMenuBtnWasPressed = false;
  }

  // Handle immersive XR VR controllers raycast laser & card hover scale/glow effect
  let currentHoveredObj = null;

  xrControllers.forEach(controller => {
    const laser = controller.getObjectByName('laser');
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersections = raycaster.intersectObjects(xrInteractiveGroup.children, true);
    if (intersections.length > 0) {
      if (laser) {
        laser.scale.z = intersections[0].distance;
        laser.material.color.setHex(0xff00cc); // Glowing neon pink on target lock!
      }
      if (!currentHoveredObj) {
        currentHoveredObj = intersections[0].object;
      }
    } else {
      if (laser) {
        laser.scale.z = 4;
        laser.material.color.setHex(0x00f3ff); // Standard cyber cyan
      }
    }
  });

  // 3D Card Hover Scaling & Emissive Glow Highlight
  xrHandCards.concat(xrBoardCards).forEach(cardObj => {
    const mesh = cardObj.mesh;
    if (!mesh) return;

    const isHovered = (mesh === currentHoveredObj || mesh.parent === currentHoveredObj);
    const isSelected = (cardObj.card && selectedHandIndex !== null && xrHandCards[selectedHandIndex]?.mesh === mesh);

    const targetScale = isHovered ? 1.25 : (isSelected ? 1.15 : 1.0);

    mesh.scale.x += (targetScale - mesh.scale.x) * 0.15;
    mesh.scale.y += (targetScale - mesh.scale.y) * 0.15;

    if (mesh.material && Array.isArray(mesh.material)) {
      const frontMat = mesh.material[4];
      if (frontMat) {
        if (!frontMat.emissive) frontMat.emissive = new THREE.Color(0x000000);
        const targetEmissiveColor = isHovered ? new THREE.Color(0x00f3ff) : (isSelected ? new THREE.Color(0xf59e0b) : new THREE.Color(0x000000));
        frontMat.emissive.lerp(targetEmissiveColor, 0.2);
      }
    }

    if (isHovered && xrLastHoveredObject !== mesh) {
      xrLastHoveredObject = mesh;
      if (typeof Sound !== 'undefined' && Sound.cardHover) Sound.cardHover();
      triggerHapticPulse(null, 0.2, 80);
    }
  });

  if (!currentHoveredObj) xrLastHoveredObject = null;

  // Render standard pass
  xrRenderer.render(xrScene, xrCamera);
}

// ---- Global exports -------------------------------------------------------
window.showXRArenaScreen = showXRArenaScreen;
window.initThreeJS = initThreeJS;
window.enterVRDirectly = enterVRDirectly;

function enterVRDirectly() {
  showXRArenaScreen();

  if (!xrRenderer) {
    initThreeJS();
  }
  onXRWindowResize();

  const subBtn = document.querySelector('#webxr-button-container button');
  if (subBtn) {
    try {
      subBtn.click();
      return;
    } catch (_) {}
  }

  if (navigator.xr && typeof navigator.xr.requestSession === 'function') {
    try {
      const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
      navigator.xr.requestSession('immersive-vr', sessionInit)
        .then(async (session) => {
          if (xrRenderer && xrRenderer.xr) {
            await xrRenderer.xr.setSession(session);
          }
        })
        .catch((err) => {
          console.warn('Direct WebXR requestSession error:', err);
        });
    } catch (err) {
      console.warn('Synchronous WebXR request failed:', err);
    }
  }
}

// ---- VR Device Detection & Button Visibility -----------------------------
function detectVRDeviceAndShowButton() {
  const vrBtn = document.getElementById('btn-enter-vr');
  if (!vrBtn) return;

  // Specifically check whether the User-Agent is explicitly a VR headset (Meta Quest 1/2/3/Pro, HTC Vive, Pico, Apple Vision Pro, Wolvic, etc.)
  const ua = (navigator.userAgent || '') + ' ' + (navigator.appVersion || '');
  const isVRHeadsetUA = /OculusBrowser|Quest|Oculus|Pico|HTC_Vive|AppleVisionPro|MetaQuest|Vive|Wolvic|VRDesktop|RealityOS/i.test(ua);

  if (isVRHeadsetUA) {
    vrBtn.classList.remove('hidden');
  } else {
    // Keep button hidden on all non-VR devices (standard desktop, laptop, mobile phones)
    vrBtn.classList.add('hidden');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(detectVRDeviceAndShowButton, 500);
  });
} else {
  setTimeout(detectVRDeviceAndShowButton, 500);
}

// ---- Non-VR Mobile Touch Joystick & Keyboard Movement System -------------
let xrJoystickActive = false;
let xrJoystickVector = { x: 0, y: 0 };
let xrKeyboardKeys = { w: false, a: false, s: false, d: false };
let xrJoystickEnabled = true;

function enableMobileVRHubJoystick() {
  xrJoystickEnabled = true;
  setupMobileVRHubJoystickUI();
}

function setupMobileVRHubJoystickUI() {
  const container = document.getElementById('webxr-canvas-container');
  if (!container) return;

  let overlay = document.getElementById('xr-joystick-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'xr-joystick-overlay';
    overlay.style.cssText = 'position: absolute; bottom: 16px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; z-index: 100; font-family: system-ui, sans-serif;';
    
    overlay.innerHTML = `
      <div id="xr-joystick-base" style="width: 110px; height: 110px; background: rgba(15, 23, 42, 0.78); border: 2.5px solid rgba(0, 243, 255, 0.65); border-radius: 50%; position: relative; pointer-events: auto; touch-action: none; box-shadow: 0 0 20px rgba(0, 243, 255, 0.35); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center;">
        <div id="xr-joystick-knob" style="width: 48px; height: 48px; background: linear-gradient(135deg, #00f3ff, #a855f7); border-radius: 50%; box-shadow: 0 0 16px rgba(0, 243, 255, 0.9); pointer-events: none; transition: transform 0.05s ease-out;"></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; pointer-events: auto; align-items: flex-end;">
        <button id="btn-xr-toggle-joystick" class="primary-btn small" type="button" style="padding: 6px 12px; font-size: 0.8rem; background: rgba(15, 23, 42, 0.88); border: 1.5px solid #00f3ff; color: #00f3ff; backdrop-filter: blur(8px); border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 0 10px rgba(0,243,255,0.2);">🕹️ Touch Joystick: ON</button>
        <button id="btn-xr-reset-view" class="primary-btn small" type="button" style="padding: 6px 12px; font-size: 0.8rem; background: rgba(15, 23, 42, 0.88); border: 1.5px solid #a855f7; color: #c4b5fd; backdrop-filter: blur(8px); border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 0 10px rgba(168,85,247,0.2);">🎯 Reset Hub Center</button>
      </div>
    `;

    container.appendChild(overlay);

    const base = document.getElementById('xr-joystick-base');
    const knob = document.getElementById('xr-joystick-knob');

    function handlePointer(e) {
      if (!base || !knob) return;
      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = e.clientX - centerX;
      let dy = e.clientY - centerY;

      const maxRadius = 38;
      const dist = Math.hypot(dx, dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      xrJoystickVector.x = dx / maxRadius;
      xrJoystickVector.y = dy / maxRadius;
    }

    if (base) {
      base.addEventListener('pointerdown', (e) => {
        xrJoystickActive = true;
        base.setPointerCapture(e.pointerId);
        handlePointer(e);
      });

      base.addEventListener('pointermove', (e) => {
        if (xrJoystickActive) handlePointer(e);
      });

      const releasePointer = () => {
        xrJoystickActive = false;
        xrJoystickVector.x = 0;
        xrJoystickVector.y = 0;
        if (knob) knob.style.transform = 'translate(0px, 0px)';
      };

      base.addEventListener('pointerup', releasePointer);
      base.addEventListener('pointercancel', releasePointer);
    }

    const toggleBtn = document.getElementById('btn-xr-toggle-joystick');
    toggleBtn?.addEventListener('click', () => {
      xrJoystickEnabled = !xrJoystickEnabled;
      toggleBtn.textContent = xrJoystickEnabled ? '🕹️ Touch Joystick: ON' : '🕹️ Touch Joystick: OFF';
      if (base) base.style.display = xrJoystickEnabled ? 'flex' : 'none';
    });

    const resetBtn = document.getElementById('btn-xr-reset-view');
    resetBtn?.addEventListener('click', () => {
      teleportToLocation([0, -0.48, 2.2]);
    });
  }

  // Keyboard Event Listeners (WASD & Arrow Keys for desktop non-VR movement)
  if (!window._xrKeyboardInitialized) {
    window._xrKeyboardInitialized = true;
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') xrKeyboardKeys.w = true;
      if (k === 'a' || k === 'arrowleft') xrKeyboardKeys.a = true;
      if (k === 's' || k === 'arrowdown') xrKeyboardKeys.s = true;
      if (k === 'd' || k === 'arrowright') xrKeyboardKeys.d = true;
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') xrKeyboardKeys.w = false;
      if (k === 'a' || k === 'arrowleft') xrKeyboardKeys.a = false;
      if (k === 's' || k === 'arrowdown') xrKeyboardKeys.s = false;
      if (k === 'd' || k === 'arrowright') xrKeyboardKeys.d = false;
    });
  }
}

function updateNonVRJoystickMovement() {
  if (!xrCamera || !xrControls) return;

  let moveX = xrJoystickVector.x;
  let moveZ = xrJoystickVector.y;

  if (xrKeyboardKeys.a) moveX -= 1;
  if (xrKeyboardKeys.d) moveX += 1;
  if (xrKeyboardKeys.w) moveZ -= 1;
  if (xrKeyboardKeys.s) moveZ += 1;

  if (Math.abs(moveX) < 0.05 && Math.abs(moveZ) < 0.05) return;

  const len = Math.hypot(moveX, moveZ);
  if (len > 1) {
    moveX /= len;
    moveZ /= len;
  }

  const speed = 0.075;

  const forward = new THREE.Vector3();
  xrCamera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate();

  const moveDelta = new THREE.Vector3()
    .addScaledVector(forward, -moveZ * speed)
    .addScaledVector(right, moveX * speed);

  xrCamera.position.add(moveDelta);
  xrControls.target.add(moveDelta);
}


