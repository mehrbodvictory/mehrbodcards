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

// HTTP Server Relay state for VPN / School Wi-Fi fallback multiplayer matches
const relayRooms = new Map();

// Housekeeping: clean up stale relay rooms older than 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of relayRooms.entries()) {
    if (now - room.lastActive > 900000) {
      relayRooms.delete(code);
    }
  }
}, 60000);

app.post('/api/matchmaking/host', (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
  
  // Clean up stale lobbies (older than 40 seconds)
  waitingLobbies = waitingLobbies.filter(l => Date.now() - l.timestamp < 40000);
  
  // Check if already registered
  if (!waitingLobbies.some(l => l.roomCode === roomCode)) {
    waitingLobbies.push({ roomCode, timestamp: Date.now() });
  }
  res.json({ success: true });
});

app.post('/api/matchmaking/join', (req, res) => {
  // Clean up stale lobbies (older than 40 seconds)
  waitingLobbies = waitingLobbies.filter(l => Date.now() - l.timestamp < 40000);
  
  if (waitingLobbies.length > 0) {
    // Pick the oldest active lobby
    const matchedLobby = waitingLobbies.shift();
    res.json({ matchFound: true, roomCode: matchedLobby.roomCode });
  } else {
    res.json({ matchFound: false });
  }
});

app.post('/api/matchmaking/cancel', (req, res) => {
  const { roomCode } = req.body;
  if (roomCode) {
    waitingLobbies = waitingLobbies.filter(l => l.roomCode !== roomCode);
  }
  res.json({ success: true });
});

/* ---------------- SERVER RELAY MP FALLBACK ROUTES ---------------- */
function getOrCreateRelayRoom(roomCode) {
  const cleanCode = String(roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCode) return null;
  let room = relayRooms.get(cleanCode);
  if (!room) {
    room = {
      roomCode: cleanCode,
      guestJoined: false,
      messages: [],
      msgIdCounter: 1,
      lastActive: Date.now()
    };
    relayRooms.set(cleanCode, room);
  }
  return room;
}

app.post('/api/relay/host', (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
  
  const room = getOrCreateRelayRoom(roomCode);
  room.lastActive = Date.now();
  res.json({ success: true, roomCode: room.roomCode });
});

app.post('/api/relay/join', (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });

  const room = getOrCreateRelayRoom(roomCode);
  room.guestJoined = true;
  room.lastActive = Date.now();
  res.json({ success: true, roomCode: room.roomCode });
});

app.post('/api/relay/send', (req, res) => {
  const { roomCode, sender, payload } = req.body;
  if (!roomCode || !sender || !payload) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const room = getOrCreateRelayRoom(roomCode);
  const msg = {
    id: room.msgIdCounter++,
    sender,
    payload,
    timestamp: Date.now()
  };
  room.messages.push(msg);
  // Keep last 150 messages max
  if (room.messages.length > 150) room.messages.shift();
  room.lastActive = Date.now();

  res.json({ success: true, id: msg.id });
});

app.post('/api/relay/poll', (req, res) => {
  const { roomCode, sender, lastId } = req.body;
  if (!roomCode || !sender) {
    return res.status(400).json({ error: 'Missing roomCode or sender' });
  }

  const room = getOrCreateRelayRoom(roomCode);
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
  const { roomCode } = req.body;
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
