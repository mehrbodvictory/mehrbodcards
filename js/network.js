// Thin wrapper around PeerJS for a 2-player connection.
//
// The host is authoritative: every action (from either player) is applied
// to the engine ONLY on the host, in the order the host receives it. The
// host then broadcasts an 'applied' message so both sides render identical
// state without ever shipping the whole game state over the wire - just the
// seed once, then a stream of small action objects.
//
// Flow (v2.0 adds a deck-config exchange before the match actually starts,
// since each side now picks their own spells/chips in the deck builder
// instead of both being derived purely from the shared seed):
//  Host creates a Peer with a short room code, waits for a connection.
//  Guest connects using that room code, then immediately sends its chosen
//    deck config as { type:'guestConfig', deckConfig }.
//  Host receives guestConfig, builds the match locally, and only then sends
//    { type:'init', seed, wager, hostDeckConfig } - now the guest has both
//    configs (its own, chosen locally, and the host's, just received) and
//    can build the identical match state on its side.
//  Guest sends its intents as { type:'intent', action }.
//  Host applies intents + its own actions locally, then sends
//    { type:'applied', action } back down to the guest for every action
//    (including the host's own), so ordering is identical on both sides.
//
// Restrictive networks (school/office wifi, symmetric NATs, firewalls that
// block direct UDP) can prevent plain STUN-based P2P from ever completing -
// the signaling handshake succeeds but the actual data channel never opens.
// We fix that by also offering TURN relay servers (including TURN-over-TCP
// on port 443, which looks like ordinary HTTPS traffic to a firewall) so a
// connection can still be established by relaying through them, and by
// timing out with a clear, actionable message instead of hanging forever.
function getIceConfig() {
  const defaultStun = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];

  // OpenRelay by Metered is a free public TURN server that provides TURN and STUN relay on ports 80 and 443.
  // This bypasses firewall blockages and symmetric NATs on mobile/cellular data.
  const freeTurn = {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'stun:openrelay.metered.ca:80',
      'stun:openrelay.metered.ca:443'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  };

  return { iceServers: [...defaultStun, freeTurn] };
}

const CONNECT_TIMEOUT_MS = 20000;
const TIMEOUT_MESSAGE = "Connection timed out. This can happen on restrictive networks (school or work wifi). Try a mobile hotspot or a different network.";

class NetSession {
  constructor({ onInit, onApplied, onStatus, onPeerError, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline }) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.onInit = onInit;
    this.onApplied = onApplied;   // (action) => void — apply it locally
    this.onStatus = onStatus || (() => {});
    this.onPeerError = onPeerError || (() => {});
    this.onGuestConfig = onGuestConfig || (() => {}); // host-only: (deckConfig) => void
    this.onForfeit = onForfeit || (() => {}); // fires when the other side quits or disconnects mid-match
    this.onEmote = onEmote || (() => {});
    this.onPing = onPing || (() => {});
    this.onRematchOffer = onRematchOffer || (() => {});
    this.onRematchAccept = onRematchAccept || (() => {});
    this.onRematchDecline = onRematchDecline || (() => {});

    // Disconnect-resilience & action queuing synchronization properties
    this.isReconnecting = false;
    this.reconnectTimeout = null;
    this.actionInFlight = false;
    this.actionInFlightTime = null;
    this.roomCode = '';

    // Real-time ping heartbeat state
    this.pingInterval = null;
  }

  _makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  hostGame(seed, wager, hostDeckConfig) {
    this.isHost = true;
    this.seed = seed;
    this.wager = wager || 0;
    this.hostDeckConfig = hostDeckConfig || null;
    const rawCode = this._makeRoomCode();
    const code = rawCode.replace(/[^A-Za-z0-9]/g, '');
    this.roomCode = code;
    const peerId = 'cardbattler-' + code;
    this.onStatus('connecting');
    return new Promise((resolve, reject) => {
      try {
        const iceConfig = getIceConfig();
        this.peer = new Peer(peerId, { debug: 1, config: iceConfig });
      } catch (err) {
        try {
          this.peer = new Peer(peerId, { debug: 1 });
        } catch (e2) {
          this.onPeerError(e2);
          return reject(e2);
        }
      }

      this.peer.on('open', () => { this.onStatus('waiting'); resolve(code); });
      this.peer.on('error', err => { this.onPeerError(err); reject(err); });
      this.peer.on('disconnected', () => {
        console.warn('[PeerJS] Disconnected from signaling server, attempting reconnect...');
        this.peer.reconnect();
      });
      this.peer.on('connection', conn => {
        // If we are currently reconnecting, or we had an open connection that died, replace it!
        if (this.isReconnecting || (this.conn && !this.conn.open)) {
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.conn = conn;
          this._wireHostConn();
          conn.on('open', () => {
            this.isReconnecting = false;
            this.onStatus('connected');
            this.startPingHeartbeat();
            this._send({ type: 'reconnect_sync' });
          });
          return;
        }

        this.conn = conn;
        this._wireHostConn();
        const timeout = setTimeout(() => {
          if (!conn.open) this.onPeerError({ type: 'connection-timeout', message: TIMEOUT_MESSAGE });
        }, CONNECT_TIMEOUT_MS);
        conn.on('open', () => {
          clearTimeout(timeout);
          // Don't send init yet - wait for the guest's deck config first
          // (see _wireHostConn) so init can carry a fully-formed match.
          this.onStatus('connected');
          this.startPingHeartbeat();
        });
        conn.on('error', err => {
          this.onPeerError(err);
        });
      });
    });
  }

  // Called once the host has the guest's config and has built the match
  // locally - hands the guest everything it needs to build the same state.
  sendInit() {
    this._send({ type: 'init', seed: this.seed, wager: this.wager, hostDeckConfig: this.hostDeckConfig });
  }

  joinGame(code, guestDeckConfig) {
    this.isHost = false;
    this.guestDeckConfig = guestDeckConfig || null;
    const cleanCode = (code || '').toString().trim().toUpperCase().replace(/[^A-Za-z0-9]/g, '');
    this.roomCode = cleanCode;
    this.onStatus('connecting');
    return new Promise((resolve, reject) => {
      try {
        const iceConfig = getIceConfig();
        this.peer = new Peer({ debug: 1, config: iceConfig });
      } catch (err) {
        try {
          this.peer = new Peer({ debug: 1 });
        } catch (e2) {
          this.onPeerError(e2);
          return reject(e2);
        }
      }

      this.peer.on('open', () => {
        try {
          this.conn = this.peer.connect('cardbattler-' + cleanCode, { reliable: true });
          this._wireGuestConn();
          const timeout = setTimeout(() => {
            if (!this.conn || !this.conn.open) this.onPeerError({ type: 'connection-timeout', message: TIMEOUT_MESSAGE });
          }, CONNECT_TIMEOUT_MS);
          this.conn.on('open', () => {
            clearTimeout(timeout);
            this._send({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
            this.onStatus('connected');
            this.startPingHeartbeat();
            resolve();
          });
          this.conn.on('error', err => {
            this.onPeerError(err);
            reject(err);
          });
        } catch (connErr) {
          this.onPeerError(connErr);
          reject(connErr);
        }
      });
      this.peer.on('error', err => { this.onPeerError(err); reject(err); });
      this.peer.on('disconnected', () => {
        console.warn('[PeerJS] Disconnected from signaling server, attempting reconnect...');
        this.peer.reconnect();
      });
    });
  }

  _wireHostConn() {
    this.conn.on('data', data => {
      if (data.type === 'ping') {
        this._send({ type: 'pong', sentAt: data.sentAt });
      } else if (data.type === 'pong') {
        const latency = Date.now() - data.sentAt;
        if (this.onPing) this.onPing(latency);
      } else if (data.type === 'intent') {
        if (!data.action || data.action.player !== 'guest') return;
        this.onApplied(data.action);
        this._send({ type: 'applied', action: data.action });
      } else if (data.type === 'guestConfig') {
        if (this.receivedGuestConfig) return;
        this.receivedGuestConfig = true;
        this.onGuestConfig(data.deckConfig);
      } else if (data.type === 'forfeit') {
        this.onForfeit();
      } else if (data.type === 'reconnect_sync') {
        // Guest reconnected successfully!
        this.isReconnecting = false;
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        this.onStatus('connected');
        if (typeof showToast === 'function') {
          showToast('✅ Opponent reconnected! Resuming match...', 2000);
        }
        this._send({ type: 'reconnect_sync_ack' });
      } else if (data.type === 'emote') {
        if (this.onEmote && this.onEmote !== (() => {})) {
          this.onEmote(data.emoji);
        } else if (typeof triggerEmote === 'function') {
          triggerEmote(typeof remoteKey !== 'undefined' ? remoteKey : 'guest', data.emoji);
        }
      } else if (data.type === 'rematch_offer') {
        this.onRematchOffer();
      } else if (data.type === 'rematch_accept') {
        this.onRematchAccept();
      } else if (data.type === 'rematch_decline') {
        this.onRematchDecline();
      }
    });
    // BUGFIX: destroy() below closes this same `conn`, which fires this
    // exact 'close' handler locally on whichever side called destroy() -
    // including the side that just intentionally quit. Without the
    // `manualDisconnect` guard, quitting your own match used to trigger
    // your own onForfeit() a split second later, flashing "Your opponent
    // forfeited - you win!" at the very person who left. Only a genuine,
    // *unexpected* disconnect (the other peer's tab closing, network drop,
    // etc.) should ever reach onForfeit() here.
    this.conn.on('close', () => {
      if (this.manualDisconnect) return;

      this.isReconnecting = true;
      this.onStatus('reconnecting');
      if (typeof showToast === 'function') {
        showToast('⚠️ Opponent disconnected! Waiting up to 10 seconds for them to reconnect...', 10000);
      }

      this.reconnectTimeout = setTimeout(() => {
        if (this.isReconnecting) {
          this.isReconnecting = false;
          this.onStatus('disconnected');
          this.onForfeit();
        }
      }, 10000);
    });
  }

  _wireGuestConn() {
    this.conn.on('data', data => {
      if (data.type === 'ping') {
        this._send({ type: 'pong', sentAt: data.sentAt });
      } else if (data.type === 'pong') {
        const latency = Date.now() - data.sentAt;
        if (this.onPing) this.onPing(latency);
      } else if (data.type === 'init') {
        this.actionInFlight = false;
        this.actionInFlightTime = null;
        this.onInit(data);
      } else if (data.type === 'applied') {
        this.actionInFlight = false; // Reset lock on authority applied action response
        this.actionInFlightTime = null;
        this.onApplied(data.action);
      } else if (data.type === 'forfeit') {
        this.onForfeit();
      } else if (data.type === 'reconnect_sync_ack') {
        this.isReconnecting = false;
        this.onStatus('connected');
        if (typeof showToast === 'function') {
          showToast('✅ Host reconnected! Resuming match...', 2000);
        }
      } else if (data.type === 'emote') {
        if (this.onEmote && this.onEmote !== (() => {})) {
          this.onEmote(data.emoji);
        } else if (typeof triggerEmote === 'function') {
          triggerEmote(typeof remoteKey !== 'undefined' ? remoteKey : 'host', data.emoji);
        }
      } else if (data.type === 'rematch_offer') {
        this.onRematchOffer();
      } else if (data.type === 'rematch_accept') {
        this.onRematchAccept();
      } else if (data.type === 'rematch_decline') {
        this.onRematchDecline();
      }
    });
    this.conn.on('close', () => {
      if (this.manualDisconnect) return;

      this.isReconnecting = true;
      this.onStatus('reconnecting');
      if (typeof showToast === 'function') {
        showToast('⚠️ Disconnected from match! Attempting to reconnect...', 10000);
      }

      // Reconnect loop
      let attempts = 0;
      const maxAttempts = 4;
      const interval = setInterval(() => {
        if (!this.isReconnecting || this.manualDisconnect) {
          clearInterval(interval);
          return;
        }
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          this.isReconnecting = false;
          this.onStatus('disconnected');
          this.onForfeit();
          return;
        }

        try {
          if (this.conn) {
            try { this.conn.close(); } catch (e) {}
          }
          this.conn = this.peer.connect('cardbattler-' + this.roomCode, { reliable: true });
          this._wireGuestConn();
          this.conn.on('open', () => {
            clearInterval(interval);
            this.isReconnecting = false;
            this.onStatus('connected');
            this.startPingHeartbeat();
            this._send({ type: 'reconnect_sync' });
            if (typeof showToast === 'function') {
              showToast('✅ Reconnected successfully!', 2000);
            }
          });
        } catch (err) {
          console.warn('[P2P Reconnect] Attempt failed:', err);
        }
      }, 2500);
    });
  }

  // Called when the local player intentionally quits mid-match, so the
  // remaining player doesn't just see a dead connection - they get an
  // explicit, immediate win instead of waiting for a raw disconnect.
  sendForfeit() { this._send({ type: 'forfeit' }); }

  sendEmote(emoji) { this._send({ type: 'emote', emoji }); }
  sendRematchOffer() { this._send({ type: 'rematch_offer' }); }
  sendRematchAccept() { this._send({ type: 'rematch_accept' }); }
  sendRematchDecline() { this._send({ type: 'rematch_decline' }); }

  // Called by the local UI when the local human wants to perform an action.
  submitAction(action) {
    if (this.isHost) {
      this.onApplied(action);                  // apply immediately, authoritative
      this._send({ type: 'applied', action });  // tell the guest
    } else {
      if (this.actionInFlight) {
        // If the action has been stuck in flight for more than 1500ms, clear the lock safely
        if (this.actionInFlightTime && Date.now() - this.actionInFlightTime > 1500) {
          console.warn('[P2P Network] Action flight timed out. Resettling lock to prevent permanent freeze.');
          this.actionInFlight = false;
        } else {
          console.warn('[P2P Network] Action already in flight, ignoring input to prevent desync.');
          return;
        }
      }
      this.actionInFlight = true;
      this.actionInFlightTime = Date.now();
      this._send({ type: 'intent', action });   // ask the host to apply it
    }
  }

  startPingHeartbeat() {
    this.stopPingHeartbeat();
    // Host starts a recurring heartbeat to measure latency to client
    this.pingInterval = setInterval(() => {
      if (this.conn && this.conn.open) {
        this._send({ type: 'ping', sentAt: Date.now() });
      } else {
        this.stopPingHeartbeat();
      }
    }, 2500);
  }

  stopPingHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  _send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); }

  // `manualDisconnect` marks this as a deliberate local teardown (quitting,
  // leaving a lobby, etc.) rather than the other peer actually forfeiting -
  // see the 'close' handlers above for why that distinction matters.
  destroy() {
    this.manualDisconnect = true;
    this.stopPingHeartbeat();
    if (this.reconnectTimeout) { clearTimeout(this.reconnectTimeout); this.reconnectTimeout = null; }
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
