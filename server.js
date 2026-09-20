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
