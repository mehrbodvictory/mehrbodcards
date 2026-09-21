// ---- 3D Immersive Physical Showroom Walkthrough Shop ----------------------

let shop3dScene, shop3dCamera, shop3dRenderer, shop3dControls;
let shopPedestals = []; // Array of { mesh, item, panelMesh, previewMesh }
let shopKeys = {};      // Tracks W, A, S, D, Arrow keys
let lastShopSyncTime = 0;
let shopActivePromptItem = null;

// Raycasting for click/tap interaction
const shopRaycaster = new THREE.Raycaster();
const shopMouse = new THREE.Vector2();

// Movement settings
const moveSpeed = 0.08;
const boundaryRadius = 12;

function show3DShopScreen() {
  // Hide standard 2D shop and open 3D shop screen
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-shop-3d')?.classList.remove('hidden');

  // Initialize 3D Showroom
  init3DShop();
}

function init3DShop() {
  const container = document.getElementById('shop-3d-canvas-container');
  if (!container) return;

  if (shop3dRenderer) {
    onShopWindowResize();
    return;
  }

  // Create scene
  shop3dScene = new THREE.Scene();
  shop3dScene.background = new THREE.Color(0x04050d);
  shop3dScene.fog = new THREE.FogExp2(0x04050d, 0.07);

  // Camera - place at player height (y=1.6) looking slightly down into the showroom
  shop3dCamera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
  shop3dCamera.position.set(0, 1.6, 7);

  // Renderer
  shop3dRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  shop3dRenderer.setPixelRatio(window.devicePixelRatio);
  shop3dRenderer.setSize(container.clientWidth, container.clientHeight);
  container.innerHTML = '';
  container.appendChild(shop3dRenderer.domElement);

  // Orbit-style look controls
  shop3dControls = new THREE.OrbitControls(shop3dCamera, shop3dRenderer.domElement);
  shop3dControls.enableDamping = true;
  shop3dControls.dampingFactor = 0.05;
  shop3dControls.maxPolarAngle = Math.PI / 2 + 0.1; // allow looking slightly up at ceiling/stars
  shop3dControls.minDistance = 1;
  shop3dControls.maxDistance = 15;
  // Pin camera target to floor level so navigation doesn't drift vertically
  shop3dControls.target.set(0, 1, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  shop3dScene.add(ambient);

  const key1 = new THREE.DirectionalLight(0x00f3ff, 0.7);
  key1.position.set(8, 12, 8);
  shop3dScene.add(key1);

  const key2 = new THREE.DirectionalLight(0xff00cc, 0.4);
  key2.position.set(-8, 8, -8);
  shop3dScene.add(key2);

  // Construct Showroom Space & Pedestals
  buildShowroomArchitecture();

  // Resize listener
  window.addEventListener('resize', onShopWindowResize);

  // Setup pointer interaction
  shop3dRenderer.domElement.addEventListener('pointerdown', onShopPointerDown);

  // Setup keyboard walking controls
  window.addEventListener('keydown', (e) => { shopKeys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { shopKeys[e.key.toLowerCase()] = false; });

  // Start animation loop
  shop3dRenderer.setAnimationLoop(animate3DShop);
}

function onShopWindowResize() {
  const container = document.getElementById('shop-3d-canvas-container');
  if (!container || !shop3dCamera || !shop3dRenderer) return;
  shop3dCamera.aspect = container.clientWidth / container.clientHeight;
  shop3dCamera.updateProjectionMatrix();
  shop3dRenderer.setSize(container.clientWidth, container.clientHeight);
}

// ---- Pedestal Dynamic UI Plate Canvas --------------------------------------
function buildPedestalPlateTexture(item) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Solid dark metal background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 128);

  // Neon boundary
  ctx.strokeStyle = item.rarity === 'MYTHIC' ? '#f59e0b' : '#00f3ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 124);

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(item.name || 'Cosmetic', 128, 36);

  // Desc
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Arial';
  let descLine1 = item.desc || '';
  if (descLine1.length > 40) descLine1 = descLine1.substring(0, 38) + '...';
  ctx.fillText(descLine1, 128, 62);

  // Purchase state
  const isOwned = ownsCosmetic(item.id);
  const equippedSleeve = loadEquippedSleeve();
  const isEquipped = item.kind === 'sleeve' && equippedSleeve === item.id;

  ctx.fillStyle = isOwned ? '#10b981' : '#f59e0b';
  ctx.font = 'bold 14px Arial';
  let statusText = '';
  if (isOwned) {
    statusText = isEquipped ? '★ EQUIPPED' : item.kind === 'sleeve' ? 'CLICK TO EQUIP' : '✓ OWNED';
  } else {
    statusText = `🛒 ${item.cost.toLocaleString()} BUX`;
  }
  ctx.fillText(statusText, 128, 100);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ---- Showroom Builder -----------------------------------------------------
function buildShowroomArchitecture() {
  // 1. Grid pattern floor
  const floorGrid = new THREE.GridHelper(32, 32, 0x00f3ff, 0x111827);
  floorGrid.position.y = 0;
  shop3dScene.add(floorGrid);

  // Outer glowing ring
  const boundaryGeom = new THREE.RingGeometry(boundaryRadius, boundaryRadius + 0.1, 64);
  const boundaryMat = new THREE.MeshBasicMaterial({ color: 0xff00cc, side: THREE.DoubleSide });
  const boundary = new THREE.Mesh(boundaryGeom, boundaryMat);
  boundary.rotation.x = Math.PI / 2;
  boundary.position.y = 0.01;
  shop3dScene.add(boundary);

  // 2. Cosmic particle clusters (floating stars)
  const starsGeom = new THREE.BufferGeometry();
  const starsCount = 300;
  const starsPos = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i += 3) {
    starsPos[i] = (Math.random() - 0.5) * 40;
    starsPos[i + 1] = Math.random() * 15 + 1;
    starsPos[i + 2] = (Math.random() - 0.5) * 40;
  }
  starsGeom.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0x00f3ff, size: 0.12, transparent: true, opacity: 0.6 });
  const starField = new THREE.Points(starsGeom, starsMat);
  shop3dScene.add(starField);

  // 3. Build pedestals for each item in COSMETIC_ITEMS
  shopPedestals = [];
  const items = COSMETIC_ITEMS || [];

  const totalPedestals = items.length;
  const spacingRadius = 8; // circle radius

  items.forEach((item, idx) => {
    // Spaced out evenly in a giant circle
    const theta = (idx / totalPedestals) * Math.PI * 2;
    const px = Math.cos(theta) * spacingRadius;
    const pz = Math.sin(theta) * spacingRadius;

    // Pedestal group
    const pedGroup = new THREE.Group();
    pedGroup.position.set(px, 0, pz);
    shop3dScene.add(pedGroup);

    // Physical cylinder base
    const baseGeom = new THREE.CylinderGeometry(0.35, 0.45, 0.8, 16);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2
    });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.4;
    pedGroup.add(base);

    // Pedestal glowing neon rim
    const rimGeom = new THREE.TorusGeometry(0.36, 0.02, 8, 24);
    const rimMat = new THREE.MeshBasicMaterial({ color: item.rarity === 'MYTHIC' ? 0xf59e0b : 0x00f3ff });
    const rim = new THREE.Mesh(rimGeom, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.81;
    pedGroup.add(rim);

    // Dynamic Plate canvas label mounted in front of the pedestal
    const plateTexture = buildPedestalPlateTexture(item);
    const plateGeom = new THREE.PlaneGeometry(0.55, 0.28);
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture, side: THREE.DoubleSide });
    const plate = new THREE.Mesh(plateGeom, plateMat);
    
    // Positioned facing the center of the showroom (player's direction)
    plate.position.set(0, 0.55, 0.42);
    plate.rotation.set(-0.25, 0, 0); // slightly tilted up
    plate.name = `shop_plate_${item.id}`;
    pedGroup.add(plate);

    // 4. Create Floating Preview Mesh representing the item
    let previewMesh;
    if (item.kind === 'theme') {
      // Shifting polyhedron sphere for themes
      const geom = new THREE.IcosahedronGeometry(0.2, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: item.id === 'theme_mrmoney' ? 0x10b981 : 0x00f3ff,
        emissive: item.id === 'theme_mrmoney' ? 0x047857 : 0x0369a1,
        roughness: 0.1,
        metalness: 0.9
      });
      previewMesh = new THREE.Mesh(geom, mat);
    } else if (item.kind === 'sleeve') {
      // Interactive card representation
      const geom = new THREE.BoxGeometry(0.25, 0.38, 0.01);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0x3b82f6,
        roughness: 0.3
      });
      previewMesh = new THREE.Mesh(geom, mat);

      // Add a glowing wire outline
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00f3ff }));
      previewMesh.add(line);
    } else {
      // Floating star or sphere for effects/victory items
      const geom = new THREE.OctahedronGeometry(0.18, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff00cc,
        emissive: 0x701a75,
        roughness: 0.1
      });
      previewMesh = new THREE.Mesh(geom, mat);
    }

    // Place floating just above pedestal (y = 1.1)
    previewMesh.position.set(0, 1.1, 0);
    pedGroup.add(previewMesh);

    shopPedestals.push({
      group: pedGroup,
      item: item,
      panelMesh: plate,
      previewMesh: previewMesh
    });
  });
}

// ---- Showroom Synchronizer ------------------------------------------------
function sync3DShowroomData() {
  shopPedestals.forEach(p => {
    // Re-draw panel canvas textures to accurately reflect purchased/equipped changes
    const newTex = buildPedestalPlateTexture(p.item);
    p.panelMesh.material.map = newTex;
    p.panelMesh.material.needsUpdate = true;
  });
}

// ---- User Pointer Interactions --------------------------------------------
function onShopPointerDown(event) {
  const container = document.getElementById('shop-3d-canvas-container');
  if (!container || !shop3dRenderer || !shop3dCamera) return;

  const rect = shop3dRenderer.domElement.getBoundingClientRect();
  shopMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  shopMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  shopRaycaster.setFromCamera(shopMouse, shop3dCamera);

  // Raycast all child components of our pedestals
  const targets = [];
  shopPedestals.forEach(p => {
    targets.push(p.panelMesh);
    targets.push(p.previewMesh);
  });

  const intersections = shopRaycaster.intersectObjects(targets);
  if (intersections.length > 0) {
    const hitObj = intersections[0].object;
    // Extract item ID from label mesh name
    let itemId = null;
    if (hitObj.name.startsWith('shop_plate_')) {
      itemId = hitObj.name.replace('shop_plate_', '');
    } else {
      // Find parent pedestal
      const ped = shopPedestals.find(p => p.previewMesh === hitObj);
      if (ped) itemId = ped.item.id;
    }

    if (itemId) {
      triggerShopPurchaseAction(itemId);
    }
  }
}

function triggerShopPurchaseAction(itemId) {
  const item = COSMETIC_ITEMS.find(x => x.id === itemId);
  if (!item) return;

  if (typeof buyOrEquipCosmetic === 'function') {
    buyOrEquipCosmetic(item);
  } else {
    // Elegant fallback if the main bundle isn't fully bound yet
    const isOwned = ownsCosmetic(item.id);
    if (isOwned) {
      if (item.kind === 'sleeve') {
        equipSleeve(item.id);
        showToast(`Sleeve equipped: ${item.name}! ✨`);
      } else {
        showToast(`You already own ${item.name}! ✓`);
      }
    } else {
      const balance = loadBux();
      if (balance < item.cost) {
        showToast(`Insufficient Bux! Needs ${item.cost} Bux. ◉`);
        return;
      }
      saveBux(balance - item.cost);
      const owned = loadOwnedCosmetics();
      owned.push(item.id);
      saveOwnedCosmetics(owned);
      showToast(`Purchased: ${item.name}! 🛍️`);
    }
  }

  // Refresh floating labels/prices instantly
  sync3DShowroomData();
}

// ---- Keyboard Navigation Core Loop ----------------------------------------
function handleKeyboardMovement() {
  if (!shop3dCamera) return;

  // Derive forward/right directions from camera orientation
  const dir = new THREE.Vector3();
  shop3dCamera.getWorldDirection(dir);
  dir.y = 0; // lock movement to flat floor
  dir.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(dir, shop3dCamera.up).normalize();

  const prevPos = shop3dCamera.position.clone();

  // WASD / Arrow walking directions
  if (shopKeys['w'] || shopKeys['arrowup']) {
    shop3dCamera.position.addScaledVector(dir, moveSpeed);
  }
  if (shopKeys['s'] || shopKeys['arrowdown']) {
    shop3dCamera.position.addScaledVector(dir, -moveSpeed);
  }
  if (shopKeys['a'] || shopKeys['arrowleft']) {
    shop3dCamera.position.addScaledVector(right, moveSpeed);
  }
  if (shopKeys['d'] || shopKeys['arrowright']) {
    shop3dCamera.position.addScaledVector(right, -moveSpeed);
  }

  // Enforce Boundary Circle Collision limit
  const distFromCenter = Math.sqrt(shop3dCamera.position.x * shop3dCamera.position.x + shop3dCamera.position.z * shop3dCamera.position.z);
  if (distFromCenter > boundaryRadius - 0.5) {
    // Restore previous safe coordinates
    shop3dCamera.position.copy(prevPos);
  }

  // Camera Height locking (keep eyes at human height 1.6)
  shop3dCamera.position.y = 1.6;
}

// ---- Main Render Animation Pass ------------------------------------------
function animate3DShop() {
  const time = Date.now();

  // Render loops for floating card rotations
  shopPedestals.forEach((p, idx) => {
    if (p.previewMesh) {
      // Floating sinusoidal bobbing
      p.previewMesh.position.y = 1.1 + Math.sin(time * 0.002 + idx) * 0.04;
      // Elegant spinning rotation
      p.previewMesh.rotation.y += 0.012;
    }
  });

  // Handle walking updates
  handleKeyboardMovement();

  // Periodically synchronize local balance/owned state (every 400ms)
  if (time - lastShopSyncTime > 400) {
    sync3DShowroomData();
    lastShopSyncTime = time;
  }

  // Render step
  shop3dRenderer.render(shop3dScene, shop3dCamera);
}

// ---- Global exports -------------------------------------------------------
window.show3DShopScreen = show3DShopScreen;
window.init3DShop = init3DShop;
window.sync3DShowroomData = sync3DShowroomData;
