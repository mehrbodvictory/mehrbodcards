const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Serve static assets with professional caching controls
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath);
    // Never cache service workers, manifest, HTML, JS, or CSS files so players get live updates immediately
    if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json') || ['.html', '.js', '.css'].includes(ext)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp'].includes(ext)) {
      // Cache image assets for 30 days
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    } else if (['.mp3', '.wav', '.ogg', '.aac'].includes(ext)) {
      // Cache audio tracks and sound effects for 30 days
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    }
  }
}));

// Matchmaking state (stored in-memory, private and safe)
let waitingLobbies = [];

// LAN Lobbies state (local network active hosts with auto-discovery)
const lanRooms = new Map();

// HTTP Server Relay state for VPN / School Wi-Fi fallback multiplayer matches
const relayRooms = new Map();

// Global health probe endpoint
app.all('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), lanRooms: lanRooms.size, relayRooms: relayRooms.size });
});

app.all('/api/matchmaking', (req, res) => {
  res.json({ status: 'ok', waiting: waitingLobbies.length, timestamp: Date.now() });
});

app.all('/api/matchmaking/health', (req, res) => {
  res.json({ status: 'ok', waiting: waitingLobbies.length, timestamp: Date.now() });
});

app.all('/api/relay', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), activeRooms: relayRooms.size });
});

app.all('/api/relay/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), activeRooms: relayRooms.size });
});

// Housekeeping: clean up stale relay rooms older than 15 minutes, and stale LAN rooms older than 45s
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of relayRooms.entries()) {
    if (now - room.lastActive > 900000) {
      relayRooms.delete(code);
    }
  }
  for (const [code, lanRoom] of lanRooms.entries()) {
    if (now - lanRoom.lastHeartbeat > 45000) {
      lanRooms.delete(code);
    }
  }
}, 30000);

/* ---------------- LAN DISCOVERY & DIRECT CONNECT ROUTES ---------------- */
app.get('/api/lan/rooms', (req, res) => {
  const now = Date.now();
  const activeLanList = [];
  for (const [code, room] of lanRooms.entries()) {
    if (now - room.lastHeartbeat <= 45000 && room.status === 'open') {
      activeLanList.push({
        roomCode: room.roomCode,
        roomName: room.roomName || `${room.hostName || 'Host'}'s LAN Match`,
        hostName: room.hostName || 'Host',
        hostAvatar: room.hostAvatar || '⚔️',
        hostLevel: room.hostLevel || 1,
        hostGradient: room.hostGradient || null,
        wager: room.wager || 0,
        createdAt: room.createdAt,
        clientIp: req.ip || req.socket?.remoteAddress || '127.0.0.1'
      });
    }
  }
  res.json({ success: true, rooms: activeLanList, timestamp: now });
});

app.post('/api/lan/host', (req, res) => {
  const { roomCode, roomName, hostInfo, wager } = req.body || {};
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode) return res.status(400).json({ error: 'Invalid roomCode' });

  const existing = lanRooms.get(cleanCode);
  const room = {
    roomCode: cleanCode,
    roomName: roomName || `${hostInfo?.playerName || 'Player'}'s Arena`,
    hostName: hostInfo?.playerName || 'Host Player',
    hostAvatar: hostInfo?.playerAvatar || '⚔️',
    hostLevel: hostInfo?.playerLevel || 1,
    hostGradient: hostInfo?.playerGradient || null,
    wager: Number(wager) || 0,
    status: 'open',
    createdAt: existing?.createdAt || Date.now(),
    lastHeartbeat: Date.now()
  };

  lanRooms.set(cleanCode, room);
  // Ensure relay room is ready as fallback
  getOrCreateRelayRoom(cleanCode);
  res.json({ success: true, roomCode: cleanCode });
});

app.post('/api/lan/heartbeat', (req, res) => {
  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const room = lanRooms.get(cleanCode);
  if (room) {
    room.lastHeartbeat = Date.now();
    return res.json({ success: true });
  }
  res.json({ success: false, error: 'Room not found' });
});

app.post('/api/lan/join', (req, res) => {
  const { roomCode, guestInfo } = req.body || {};
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const room = lanRooms.get(cleanCode);
  if (room) {
    room.status = 'matched';
    room.lastHeartbeat = Date.now();
  }
  const relayRoom = getOrCreateRelayRoom(cleanCode);
  if (relayRoom) relayRoom.guestJoined = true;
  res.json({ success: true, roomCode: cleanCode, roomInfo: room || null });
});

app.post('/api/lan/leave', (req, res) => {
  const { roomCode } = req.body || {};
  if (roomCode) {
    const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
    lanRooms.delete(cleanCode);
  }
  res.json({ success: true });
});

function getOrCreateRelayRoom(roomCode) {
  const cleanCode = String(roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode) return null;
  let room = relayRooms.get(cleanCode);
  if (!room) {
    room = {
      roomCode: cleanCode,
      hostActive: true,
      guestJoined: false,
      messages: [],
      msgIdCounter: 1,
      lastActive: Date.now()
    };
    relayRooms.set(cleanCode, room);
  }
  return room;
}

app.post('/api/matchmaking/host', (req, res) => {
  const { roomCode, hostInfo } = req.body || {};
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode) return res.status(400).json({ error: 'Invalid roomCode' });
  
  // Clean up stale lobbies (older than 40 seconds)
  waitingLobbies = waitingLobbies.filter(l => Date.now() - l.timestamp < 40000 && l.roomCode !== cleanCode);
  waitingLobbies.push({ roomCode: cleanCode, timestamp: Date.now(), hostInfo: hostInfo || null });
  res.json({ success: true });
});

app.post('/api/matchmaking/join', (req, res) => {
  // Clean up stale lobbies (older than 40 seconds)
  waitingLobbies = waitingLobbies.filter(l => Date.now() - l.timestamp < 40000);
  
  if (waitingLobbies.length > 0) {
    // Pick the oldest active lobby
    const matchedLobby = waitingLobbies.shift();
    res.json({ matchFound: true, roomCode: matchedLobby.roomCode, hostInfo: matchedLobby.hostInfo || null });
  } else {
    res.json({ matchFound: false });
  }
});

app.post('/api/matchmaking/cancel', (req, res) => {
  const { roomCode } = req.body || {};
  if (roomCode) {
    const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
    waitingLobbies = waitingLobbies.filter(l => l.roomCode !== cleanCode);
  }
  res.json({ success: true });
});

/* ---------------- SERVER RELAY MP FALLBACK ROUTES ---------------- */
app.post('/api/relay/host', (req, res) => {
  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
  
  const room = getOrCreateRelayRoom(roomCode);
  if (!room) return res.status(400).json({ error: 'Invalid roomCode' });
  room.hostActive = true;
  room.lastActive = Date.now();
  res.json({ success: true, roomCode: room.roomCode });
});

app.post('/api/relay/join', (req, res) => {
  const { roomCode } = req.body || {};
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });

  const room = getOrCreateRelayRoom(roomCode);
  if (!room) return res.status(400).json({ error: 'Invalid roomCode' });
  room.guestJoined = true;
  room.lastActive = Date.now();
  res.json({ success: true, roomCode: room.roomCode });
});

app.post('/api/relay/send', (req, res) => {
  const { roomCode, sender, payload } = req.body || {};
  if (!roomCode || !sender || !payload) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const room = getOrCreateRelayRoom(roomCode);
  if (!room) return res.status(400).json({ error: 'Invalid roomCode' });

  const msg = {
    id: room.msgIdCounter++,
    sender,
    payload,
    timestamp: Date.now()
  };
  room.messages.push(msg);
  // Keep last 250 messages max
  if (room.messages.length > 250) room.messages.shift();
  room.lastActive = Date.now();

  res.json({ success: true, id: msg.id });
});

app.post('/api/relay/poll', (req, res) => {
  const { roomCode, sender, lastId } = req.body || {};
  if (!roomCode || !sender) {
    return res.status(400).json({ error: 'Missing roomCode or sender' });
  }

  const room = getOrCreateRelayRoom(roomCode);
  if (!room) return res.status(400).json({ error: 'Invalid roomCode' });

  room.lastActive = Date.now();
  const minId = Number(lastId) || 0;
  const newMsgs = room.messages.filter(m => m.id > minId && m.sender !== sender);

  res.json({
    success: true,
    guestJoined: room.guestJoined,
    messages: newMsgs
  });
});

app.post('/api/relay/close', (req, res) => {
  const { roomCode } = req.body || {};
  if (roomCode) {
    const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
    relayRooms.delete(cleanCode);
  }
  res.json({ success: true });
});

// Fallback to index.html for page routes only (avoids corrupt MIME-type parsing errors for missing static files)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || path.extname(req.path) !== '') {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
