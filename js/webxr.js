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

// Pointer raycaster for mouse input
const xrRaycaster = new THREE.Raycaster();
const xrMouse = new THREE.Vector2();

function showXRArenaScreen() {
  // Hide all screens and open XR screen
  if (typeof showScreen === 'function') {
    showScreen('screen-webxr-arena');
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-webxr-arena')?.classList.remove('hidden');
  }
  
  // Initialize Three.js scene
  initThreeJS();
}

function initThreeJS() {
  const container = document.getElementById('webxr-canvas-container');
  if (!container) return;
  if (xrRenderer) {
    // Re-trigger resize to ensure it fits perfectly
    onXRWindowResize();
    return;
  }

  // Create scene
  xrScene = new THREE.Scene();
  xrScene.background = new THREE.Color(0x060814);
  // Add space fog for atmosphere
  xrScene.fog = new THREE.FogExp2(0x060814, 0.08);

  // Group to hold all interactive 3D board pieces
  xrInteractiveGroup = new THREE.Group();
  xrScene.add(xrInteractiveGroup);

  // Create camera
  xrCamera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 100);
  xrCamera.position.set(0, 3, 4.5); // Stood at the edge of the virtual table looking down

  // Create renderer
  xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  xrRenderer.setPixelRatio(window.devicePixelRatio);
  xrRenderer.setSize(container.clientWidth, container.clientHeight);
  xrRenderer.xr.enabled = true; // Enable WebXR!
  container.innerHTML = ''; // Clear container
  container.appendChild(xrRenderer.domElement);

  // Add standard orbit controls for hybrid non-VR desktop/mobile players!
  xrControls = new THREE.OrbitControls(xrCamera, xrRenderer.domElement);
  xrControls.enableDamping = true;
  xrControls.dampingFactor = 0.05;
  xrControls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't let camera clip beneath the futuristic floor
  xrControls.minDistance = 2;
  xrControls.maxDistance = 15;
  xrControls.target.set(0, 0.5, 0);

  // Add Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  xrScene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0x00f3ff, 0.8);
  keyLight.position.set(5, 10, 5);
  xrScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xff00cc, 0.5);
  fillLight.position.set(-5, 5, -5);
  xrScene.add(fillLight);

  // Build the sci-fi environment
  buildCyberArena();

  // Setup WebXR VR button and controller support
  setupXRButton();
  setupXRControllers();

  // Resize listener
  window.addEventListener('resize', onXRWindowResize);

  // Setup pointer raycast listeners
  xrRenderer.domElement.addEventListener('pointerdown', onXRPointerDown);

  // Start the frame loop
  xrRenderer.setAnimationLoop(animateXR);
}

function onXRWindowResize() {
  const container = document.getElementById('webxr-canvas-container');
  if (!container || !xrCamera || !xrRenderer) return;
  xrCamera.aspect = container.clientWidth / container.clientHeight;
  xrCamera.updateProjectionMatrix();
  xrRenderer.setSize(container.clientWidth, container.clientHeight);
}

// ---- Sci-Fi Cyber Stadium Environment Builder -----------------------------
function buildCyberArena() {
  // 1. Grid floor
  const floorGrid = new THREE.GridHelper(30, 30, 0x00f3ff, 0x1e293b);
  floorGrid.position.y = -0.5;
  xrScene.add(floorGrid);

  // 2. Cosmic particle stars
  const starsGeom = new THREE.BufferGeometry();
  const starsCount = 400;
  const starsPos = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i += 3) {
    starsPos[i] = (Math.random() - 0.5) * 50;
    starsPos[i + 1] = Math.random() * 25 - 2;
    starsPos[i + 2] = (Math.random() - 0.5) * 50;
  }
  starsGeom.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0x00f3ff, size: 0.1, transparent: true, opacity: 0.8 });
  const starField = new THREE.Points(starsGeom, starsMat);
  xrScene.add(starField);

  // 3. Central futuristic table
  const tableGeom = new THREE.CylinderGeometry(2, 2.2, 0.8, 8);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x0c1024,
    roughness: 0.2,
    metalness: 0.8,
    bumpScale: 0.05
  });
  const table = new THREE.Mesh(tableGeom, tableMat);
  table.position.set(0, -0.1, 0);
  xrScene.add(table);

  // Neon ring edge
  const ringGeom = new THREE.RingGeometry(2, 2.05, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.31, 0);
  xrScene.add(ring);

  // 4. Create Board Slots representing current match board spaces
  // Local (player) board is 4 slots closer to user, Remote (opponent) board is 4 slots farther
  xrBoardSlots = [];
  const slotGeom = new THREE.PlaneGeometry(0.7, 1);
  const playerSlotMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
  const opponentSlotMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.2, side: THREE.DoubleSide });

  // 4 Player Slots (closter to user)
  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(slotGeom, playerSlotMat.clone());
    slot.rotation.x = -Math.PI / 2;
    // Spaced horizontally on the table
    slot.position.set((i - 1.5) * 0.9, 0.32, 0.4);
    slot.name = `slot_player_${i}`;
    xrInteractiveGroup.add(slot);
    xrBoardSlots.push({ mesh: slot, type: 'player', slotIndex: i });

    // Inner wireframe glow
    const edges = new THREE.EdgesGeometry(slotGeom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00f3ff, linewidth: 2 }));
    slot.add(line);
  }

  // 4 Opponent Slots (farther from user)
  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(slotGeom, opponentSlotMat.clone());
    slot.rotation.x = -Math.PI / 2;
    slot.position.set((i - 1.5) * 0.9, 0.32, -0.6);
    slot.name = `slot_opponent_${i}`;
    xrInteractiveGroup.add(slot);
    xrBoardSlots.push({ mesh: slot, type: 'opponent', slotIndex: i });

    // Inner wireframe glow
    const edges = new THREE.EdgesGeometry(slotGeom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff00cc, linewidth: 2 }));
    slot.add(line);
  }

  // 5. Build 3D floating info screens
  buildFloatingUI();

  // 6. Build 3D Mehrbod Shop Showroom Pedestals around the Arena
  buildShopPedestalsInArena();
}

let xrShopPedestals = [];

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
  const radius = 6.5;

  items.forEach((item, idx) => {
    const theta = (idx / items.length) * Math.PI * 2;
    const px = Math.cos(theta) * radius;
    const pz = Math.sin(theta) * radius;

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

function buildFloatingUI() {
  // Giant floating Curved Spectator/Theatre Screen
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 124);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MEHRBOD CARDS Cyber Arena', 256, 46);
  ctx.fillStyle = '#67e8f9';
  ctx.font = '16px Arial';
  ctx.fillText('Interactive WebXR VR Edition', 256, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const screenGeom = new THREE.PlaneGeometry(6, 1.8);
  const screenMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
  const screen = new THREE.Mesh(screenGeom, screenMat);
  screen.position.set(0, 4.5, -4); // Giant monitor floating high up and far away
  xrScene.add(screen);

  // 3D READY / END TURN Button on the table edge
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
  rCtx.font = 'bold 36px Arial';
  rCtx.textAlign = 'center';
  rCtx.fillText('READY ⚔️', 128, 76);

  const readyTex = new THREE.CanvasTexture(readyCanvas);
  const readyGeom = new THREE.BoxGeometry(0.7, 0.15, 0.35);
  // Separate materials so only front has texture
  const readyMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ map: readyTex }), // Top
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
    new THREE.MeshStandardMaterial({ color: 0x047857 }),
  ];
  xrReadyButton = new THREE.Mesh(readyGeom, readyMaterials);
  xrReadyButton.position.set(1.6, 0.4, 1.1); // Placed comfortably on player's right table side
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
function syncLiveGameStateTo3D() {
  if (typeof state === 'undefined' || !state) return;

  const myKey = typeof localKey !== 'undefined' ? localKey : 'you';
  const opKey = typeof remoteKey !== 'undefined' ? remoteKey : 'bot';

  const myPlayer = state.players[myKey];
  const opPlayer = state.players[opKey];
  if (!myPlayer || !opPlayer) return;

  // 1. Sync Hands (Deck)
  // Clear old hand meshes
  xrHandCards.forEach(c => xrInteractiveGroup.remove(c.mesh));
  xrHandCards = [];

  const handCards = myPlayer.deck || [];
  handCards.forEach((c, idx) => {
    // Render only the first 6 cards to avoid visual clutter in 3D
    if (idx > 5) return;

    // Create front card texture dynamically
    const texture = buildCardTexture(c);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ map: texture }),     // Front
      new THREE.MeshStandardMaterial({ color: 0x1e293b })  // Back
    ];

    const cardGeom = new THREE.BoxGeometry(0.5, 0.75, 0.01);
    const cardMesh = new THREE.Mesh(cardGeom, materials);

    // Arrange hand in a gorgeous curved shape right in front of the player
    const arcAngle = 0.4;
    const offset = (idx - (Math.min(handCards.length, 6) - 1) / 2) * 0.55;
    cardMesh.position.set(offset, 0.6, 1.6);
    cardMesh.rotation.set(-0.35, -offset * arcAngle, 0);
    cardMesh.name = `hand_card_${idx}`;

    // Highlight if selected
    if (selectedHandIndex === idx) {
      cardMesh.position.y += 0.12; // float up slightly
      cardMesh.position.z -= 0.05;
      cardMesh.scale.set(1.1, 1.1, 1);
    }

    xrInteractiveGroup.add(cardMesh);
    xrHandCards.push({ mesh: cardMesh, card: c, handIndex: idx });
  });

  // 2. Sync Board Cards
  // Clear old board card meshes
  xrBoardCards.forEach(c => xrInteractiveGroup.remove(c.mesh));
  xrBoardCards = [];

  // Sync Player Board (Local)
  const myBoard = myPlayer.board || [];
  myBoard.forEach((c, idx) => {
    if (!c) return;
    const texture = buildCardTexture(c);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ map: texture }),     // Front
      new THREE.MeshStandardMaterial({ color: 0x1e293b })  // Back
    ];

    const cardGeom = new THREE.BoxGeometry(0.65, 0.95, 0.02);
    const cardMesh = new THREE.Mesh(cardGeom, materials);

    // Place exactly on player's table slot coordinates
    cardMesh.position.set((idx - 1.5) * 0.9, 0.35, 0.4);
    cardMesh.rotation.set(-Math.PI / 2, 0, 0); // Flat on the futuristic table
    cardMesh.name = `board_card_player_${idx}`;

    // If defending, rotate slightly and lift
    const isDefending = myPlayer.defendingSlots && myPlayer.defendingSlots[idx];
    if (isDefending) {
      cardMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 4); // turned at 45 degrees
      cardMesh.position.y += 0.08;
    }

    xrInteractiveGroup.add(cardMesh);
    xrBoardCards.push({ mesh: cardMesh, card: c, owner: 'player', slot: idx });
  });

  // Sync Opponent Board (Remote)
  const opBoard = opPlayer.board || [];
  opBoard.forEach((c, idx) => {
    if (!c) return;
    const texture = buildCardTexture(c);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ color: 0x0f172a }), // Side
      new THREE.MeshStandardMaterial({ map: texture }),     // Front
      new THREE.MeshStandardMaterial({ color: 0x1e293b })  // Back
    ];

    const cardGeom = new THREE.BoxGeometry(0.65, 0.95, 0.02);
    const cardMesh = new THREE.Mesh(cardGeom, materials);

    // Place exactly on opponent's table slot coordinates
    cardMesh.position.set((idx - 1.5) * 0.9, 0.35, -0.6);
    cardMesh.rotation.set(-Math.PI / 2, 0, Math.PI); // Flat on the table facing user
    cardMesh.name = `board_card_opponent_${idx}`;

    // If defending, rotate slightly and lift
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

  // 1. Pointed at hand card
  if (obj.name.startsWith('hand_card_')) {
    const idx = parseInt(obj.name.replace('hand_card_', ''));
    selectedHandIndex = (selectedHandIndex === idx) ? null : idx; // Toggle select
    if (typeof Sound !== 'undefined' && Sound.cardHover) Sound.cardHover();
    syncLiveGameStateTo3D();
    return;
  }

  // 2. Pointed at board slot (to place a card)
  if (obj.name.startsWith('slot_player_')) {
    const slotIdx = parseInt(obj.name.replace('slot_player_', ''));
    if (selectedHandIndex !== null) {
      // Execute play/place action directly into the game engine!
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

  // 3. Pointed at active player board card to toggle defense
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

  // 4. Pointed at active opponent board card to trigger attack
  if (obj.name.startsWith('board_card_opponent_')) {
    const enemySlotIdx = parseInt(obj.name.replace('board_card_opponent_', ''));
    // If we have an active selected player card, command an attack on this opponent card!
    // Simply use the first player board card that can attack for this shortcut
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

  // 5. Ready Button Click
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

  // 6. Shop Pedestal Interactivity in VR / 3D Mode
  if (obj.name && obj.name.startsWith('shop_plate_')) {
    const itemId = obj.name.replace('shop_plate_', '');
    triggerXRShopPurchase(itemId);
    return;
  }
  if (obj.name && obj.name.startsWith('shop_preview_')) {
    const itemId = obj.name.replace('shop_preview_', '');
    triggerXRShopPurchase(itemId);
    return;
  }
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

function onXRSelectStart(event) {
  const controller = event.target;
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersections = raycaster.intersectObjects(xrInteractiveGroup.children, true);
  handleXRIntersection(intersections);
}

function onXRSelectEnd(event) {
  // Select ended (Trigger released)
}

// ---- Main Render Frame Loop ----------------------------------------------
function animateXR() {
  const time = Date.now();

  // Periodically synchronize the 3D meshes with the 2D game state (every 400ms)
  if (time - lastXRSyncTime > 400) {
    syncLiveGameStateTo3D();
    lastXRSyncTime = time;
  }

  // Update Orbit controls damping
  if (xrControls) {
    xrControls.update();
  }

  // Handle immersive XR VR controllers raycast laser visual pointer update
  xrControllers.forEach(controller => {
    const laser = controller.getObjectByName('laser');
    if (laser) {
      const tempMatrix = new THREE.Matrix4();
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      const raycaster = new THREE.Raycaster();
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      const intersections = raycaster.intersectObjects(xrInteractiveGroup.children, true);
      if (intersections.length > 0) {
        laser.scale.z = intersections[0].distance;
        laser.material.color.setHex(0xff00cc); // Glowing neon pink on target lock!
      } else {
        laser.scale.z = 4;
        laser.material.color.setHex(0x00f3ff); // Standard cyber cyan
      }
    }
  });

  // Render standard pass
  xrRenderer.render(xrScene, xrCamera);
}

// ---- Global exports -------------------------------------------------------
window.showXRArenaScreen = showXRArenaScreen;
window.initThreeJS = initThreeJS;


