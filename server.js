const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Serve static assets from project root
app.use(express.static(path.join(__dirname)));

// Matchmaking state (stored in-memory, private and safe)
let waitingLobbies = [];

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

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
