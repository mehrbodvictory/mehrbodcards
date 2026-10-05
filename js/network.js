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
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };
}

function formatPeerErrorMessage(err) {
  if (!err) return "Connection failed. Please check your network.";
  if (typeof err === 'string') {
    if (err.includes('server-error')) return "Signaling server busy/blocked by VPN. Retrying connection...";
    if (err.includes('Negotiation')) return "P2P WebRTC blocked by network firewall. Switching to HTTPS Server Relay...";
    return err;
  }
  const type = err.type || '';
  const msg = err.message || '';
  if (msg.includes('Negotiation') || type === 'webrtc') {
    return "P2P WebRTC blocked by network firewall. Switching to HTTPS Server Relay...";
  }
  if (type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
    return "Signaling server connection interrupted by VPN/firewall. Re-establishing secure TLS relay...";
  }
  if (type === 'peer-unavailable') {
    return "Host room not found or opponent went offline. Retrying...";
  }
  if (type === 'unavailable-id') {
    return "Lobby code already in use. Generating a fresh room code...";
  }
  if (type === 'network' || type === 'disconnected') {
    return "Network connection dropped. Attempting automatic reconnection...";
  }
  if (type === 'browser-incompatible') {
    return "Browser WebRTC feature unavailable.";
  }
  return msg || `Connection issue (${type || 'network'})`;
}

const CONNECT_TIMEOUT_MS = 15000;
const TIMEOUT_MESSAGE = "Connection timed out on WebRTC. Switching to HTTPS Server Relay...";

/* ---------------- SERVER RELAY MULTIPLAYER FALLBACK CLASS ---------------- */
class ServerRelaySession {
  constructor({ onInit, onApplied, onStatus, onPeerError, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline }) {
    this.isHost = false;
    this.roomCode = '';
    this.seed = null;
    this.wager = 0;
    this.hostDeckConfig = null;
    this.guestDeckConfig = null;
    this.lastMsgId = 0;
    this.pollInterval = null;
    this.destroyed = false;
    this.receivedGuestConfig = false;
    this._guestConnectedNotified = false;

    this.onInit = onInit;
    this.onApplied = onApplied;
    this.onStatus = onStatus || (() => {});
    this.onPeerError = onPeerError || (() => {});
    this.onGuestConfig = onGuestConfig || (() => {});
    this.onForfeit = onForfeit || (() => {});
    this.onEmote = onEmote || (() => {});
    this.onPing = onPing || (() => {});
    this.onRematchOffer = onRematchOffer || (() => {});
    this.onRematchAccept = onRematchAccept || (() => {});
    this.onRematchDecline = onRematchDecline || (() => {});
  }

  _makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async hostGame(seed, wager, hostDeckConfig) {
    this.isHost = true;
    this.seed = seed;
    this.wager = wager || 0;
    this.hostDeckConfig = hostDeckConfig || null;
    this.roomCode = this._makeRoomCode();
    this.onStatus('connecting');

    try {
      const res = await fetch('/api/relay/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode })
      });
      if (!res.ok) throw new Error('Failed to create server relay room');
      this.onStatus('waiting');
      this._startPolling();
      return this.roomCode;
    } catch (err) {
      if (this.onPeerError) this.onPeerError(err);
      throw err;
    }
  }

  async joinGame(code, guestDeckConfig) {
    this.isHost = false;
    this.guestDeckConfig = guestDeckConfig || null;
    this.roomCode = (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.onStatus('connecting');

    try {
      const res = await fetch('/api/relay/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode })
      });
      if (!res.ok) throw new Error('Relay room not found or expired');
      this.onStatus('connected');
      this._startPolling();

      // Send guest deck config to host via relay
      await this._sendMsg({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
    } catch (err) {
      if (this.onPeerError) this.onPeerError(err);
      throw err;
    }
  }

  sendInit() {
    this._sendMsg({ type: 'init', seed: this.seed, wager: this.wager, hostDeckConfig: this.hostDeckConfig });
  }

  submitAction(action) {
    if (this.isHost) {
      this.onApplied(action);
      this._sendMsg({ type: 'applied', action });
    } else {
      this._sendMsg({ type: 'intent', action });
    }
  }

  sendForfeit() { this._sendMsg({ type: 'forfeit' }); }
  sendEmote(emoji) { this._sendMsg({ type: 'emote', emoji }); }
  sendRematchOffer() { this._sendMsg({ type: 'rematch_offer' }); }
  sendRematchAccept() { this._sendMsg({ type: 'rematch_accept' }); }
  sendRematchDecline() { this._sendMsg({ type: 'rematch_decline' }); }

  async _sendMsg(payload) {
    if (this.destroyed) return;
    try {
      await fetch('/api/relay/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          sender: this.isHost ? 'host' : 'guest',
          payload
        })
      });
    } catch (e) {
      console.warn('[ServerRelay] Send error:', e);
    }
  }

  _startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this._poll(), 250);
  }

  async _poll() {
    if (this.destroyed || !this.roomCode) return;
    try {
      const res = await fetch('/api/relay/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          sender: this.isHost ? 'host' : 'guest',
          lastId: this.lastMsgId
        })
      });
      if (!res.ok) return;
      const data = await res.json();

      if (this.isHost && data.guestJoined && !this._guestConnectedNotified) {
        this._guestConnectedNotified = true;
        this.onStatus('connected');
      }

      if (Array.isArray(data.messages)) {
        for (const msg of data.messages) {
          if (msg.id > this.lastMsgId) this.lastMsgId = msg.id;
          this._handleIncomingPayload(msg.payload);
        }
      }
    } catch (err) {
      // transient network poll glitch
    }
  }

  _handleIncomingPayload(payload) {
    if (!payload || !payload.type) return;
    if (payload.type === 'guestConfig' && this.isHost) {
      if (this.receivedGuestConfig) return;
      this.receivedGuestConfig = true;
      this.onGuestConfig(payload.deckConfig);
    } else if (payload.type === 'init' && !this.isHost) {
      this.onInit(payload);
    } else if (payload.type === 'intent' && this.isHost) {
      if (payload.action && payload.action.player === 'guest') {
        this.onApplied(payload.action);
        this._sendMsg({ type: 'applied', action: payload.action });
      }
    } else if (payload.type === 'applied' && !this.isHost) {
      this.onApplied(payload.action);
    } else if (payload.type === 'forfeit') {
      this.onForfeit();
    } else if (payload.type === 'emote') {
      this.onEmote(payload.emoji);
    } else if (payload.type === 'rematch_offer') {
      this.onRematchOffer();
    } else if (payload.type === 'rematch_accept') {
      this.onRematchAccept();
    } else if (payload.type === 'rematch_decline') {
      this.onRematchDecline();
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.roomCode) {
      fetch('/api/relay/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode })
      }).catch(() => {});
    }
  }
}

/* ---------------- HYBRID NET SESSION (P2P + AUTOMATIC SERVER RELAY FALLBACK) ---------------- */
class NetSession {
  constructor({ onInit, onApplied, onStatus, onPeerError, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline }) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.relaySession = null;
    this.usingRelay = false;

    this.rawCallbacks = { onInit, onApplied, onStatus, onPeerError, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline };

    this.onInit = onInit;
    this.onApplied = onApplied;   // (action) => void — apply it locally
    this.onStatus = onStatus || (() => {});
    this.onPeerError = (err) => {
      const formatted = formatPeerErrorMessage(err);
      const errObj = (typeof err === 'object' && err !== null) ? { ...err, message: formatted } : { message: formatted };
      if (onPeerError) onPeerError(errObj);
    };
    this.onGuestConfig = onGuestConfig || (() => {});
    this.onForfeit = onForfeit || (() => {});
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

  async _switchToRelayHost(seed, wager, hostDeckConfig) {
    console.warn('[Multiplayer Network] WebRTC P2P unavailable. Seamlessly activating Server Relay Mode...');
    this.usingRelay = true;
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    this.relaySession = new ServerRelaySession(this.rawCallbacks);
    return await this.relaySession.hostGame(seed, wager, hostDeckConfig);
  }

  async _switchToRelayJoin(code, guestDeckConfig) {
    console.warn('[Multiplayer Network] WebRTC P2P negotiation failed. Seamlessly activating Server Relay Mode...');
    this.usingRelay = true;
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    this.relaySession = new ServerRelaySession(this.rawCallbacks);
    return await this.relaySession.joinGame(code, guestDeckConfig);
  }

  async hostGame(seed, wager, hostDeckConfig) {
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
      const iceConfig = getIceConfig();
      try {
        this.peer = new Peer(peerId, { debug: 1, config: iceConfig });
      } catch (err) {
        this._switchToRelayHost(seed, wager, hostDeckConfig).then(resolve).catch(reject);
        return;
      }

      this.peer.on('open', () => { this.onStatus('waiting'); resolve(code); });
      this.peer.on('error', err => {
        console.warn('[PeerJS Host] Error:', err);
        const errStr = (err && (err.message || err.type)) ? String(err.message || err.type) : '';
        if (errStr.includes('Negotiation') || err.type === 'server-error' || err.type === 'socket-error') {
          this._switchToRelayHost(seed, wager, hostDeckConfig).then(resolve).catch(reject);
          return;
        }
        this.onPeerError(err);
        reject(err);
      });
      this.peer.on('disconnected', () => {
        if (this.usingRelay) return;
        console.warn('[PeerJS] Disconnected from signaling server, attempting reconnect...');
        this.peer.reconnect();
      });
      this.peer.on('connection', conn => this._handleIncomingHostConn(conn));
    });
  }

  _handleIncomingHostConn(conn) {
    if (this.usingRelay) return;
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
      if (!conn.open) {
        console.warn('[PeerJS Host] Connection handshake timed out, switching to relay...');
        this._switchToRelayHost(this.seed, this.wager, this.hostDeckConfig);
      }
    }, CONNECT_TIMEOUT_MS);
    conn.on('open', () => {
      clearTimeout(timeout);
      this.onStatus('connected');
      this.startPingHeartbeat();
    });
    conn.on('error', err => {
      this.onPeerError(err);
    });
  }

  sendInit() {
    if (this.usingRelay && this.relaySession) {
      return this.relaySession.sendInit();
    }
    this._send({ type: 'init', seed: this.seed, wager: this.wager, hostDeckConfig: this.hostDeckConfig });
  }

  joinGame(code, guestDeckConfig) {
    this.isHost = false;
    this.guestDeckConfig = guestDeckConfig || null;
    const cleanCode = (code || '').toString().trim().toUpperCase().replace(/[^A-Za-z0-9]/g, '');
    this.roomCode = cleanCode;
    this.onStatus('connecting');

    return new Promise((resolve, reject) => {
      const iceConfig = getIceConfig();
      try {
        this.peer = new Peer({ debug: 1, config: iceConfig });
      } catch (err) {
        this._switchToRelayJoin(code, guestDeckConfig).then(resolve).catch(reject);
        return;
      }

      this.peer.on('open', () => {
        let attempts = 0;
        const maxAttempts = 3;

        const tryConnect = () => {
          attempts++;
          if (this.conn) {
            try { this.conn.close(); } catch (_) {}
          }
          try {
            this.conn = this.peer.connect('cardbattler-' + cleanCode, { reliable: true });
            this._wireGuestConn();

            const timeout = setTimeout(() => {
              if (!this.conn || !this.conn.open) {
                if (attempts < maxAttempts) {
                  console.warn(`[PeerJS Join] Connect attempt ${attempts} timed out, retrying...`);
                  tryConnect();
                } else {
                  this._switchToRelayJoin(code, guestDeckConfig).then(resolve).catch(reject);
                }
              }
            }, 3000);

            this.conn.on('open', () => {
              clearTimeout(timeout);
              this._send({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
              this.onStatus('connected');
              this.startPingHeartbeat();
              resolve();
            });

            this.conn.on('error', err => {
              clearTimeout(timeout);
              const errStr = String(err ? (err.message || err.type) : '');
              if (errStr.includes('Negotiation') || err.type === 'peer-unavailable') {
                if (attempts < maxAttempts) {
                  console.warn(`[PeerJS Join] Attempt ${attempts} failed (${errStr}), retrying...`);
                  setTimeout(tryConnect, 1000);
                } else {
                  this._switchToRelayJoin(code, guestDeckConfig).then(resolve).catch(reject);
                }
              } else {
                this._switchToRelayJoin(code, guestDeckConfig).then(resolve).catch(reject);
              }
            });
          } catch (connErr) {
            this._switchToRelayJoin(code, guestDeckConfig).then(resolve).catch(reject);
          }
        };

        tryConnect();
      });

      this.peer.on('error', err => {
        const errStr = String(err ? (err.message || err.type) : '');
        if (errStr.includes('Negotiation') || err.type === 'server-error') {
          this._switchToRelayJoin(code, guestDeckConfig).then(resolve).catch(reject);
          return;
        }
        this.onPeerError(err);
        reject(err);
      });
      this.peer.on('disconnected', () => {
        if (this.usingRelay) return;
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
        if (typeof AntiCheat !== 'undefined') {
          const check = AntiCheat.sanitizeAndVerifyAction(typeof state !== 'undefined' ? state : null, data.action, 'guest');
          if (!check.valid) {
            console.warn('[AntiCheat] Rejected illegal intent from guest:', check.reason);
            this._send({ type: 'security_violation', reason: check.reason });
            return;
          }
        }
        this.onApplied(data.action);
        this._send({ type: 'applied', action: data.action });
      } else if (data.type === 'state_digest_sync') {
        if (typeof AntiCheat !== 'undefined' && typeof state !== 'undefined') {
          const res = AntiCheat.verifyStateDigest(state, data.digest);
          if (!res.synced) {
            console.warn('[AntiCheat] State divergence detected:', res.reason);
            if (typeof showToast === 'function') showToast('⚠️ Match sync warning: State reconciled.', 3000);
          }
        }
      } else if (data.type === 'guestConfig') {
        if (this.receivedGuestConfig) return;
        if (typeof validateDeckConfigIntegrity === 'function') {
          const check = validateDeckConfigIntegrity(data.deckConfig);
          if (!check.valid) {
            console.warn('[AntiCheat] Illegal guest deck rejected:', check.reason);
            if (typeof showToast === 'function') showToast(`⚠️ Opponent deck failed anti-cheat integrity check: ${check.reason}`, 4000);
            this._send({ type: 'security_violation', reason: check.reason });
            this.destroy();
            return;
          }
        }
        this.receivedGuestConfig = true;
        this.onGuestConfig(data.deckConfig);
      } else if (data.type === 'security_violation') {
        if (typeof showToast === 'function') showToast(`🛡️ Anti-Cheat: Match aborted — ${data.reason || 'Integrity check failed'}`, 4000);
        this.destroy();
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
        if (typeof validateDeckConfigIntegrity === 'function' && data.hostDeckConfig) {
          const check = validateDeckConfigIntegrity(data.hostDeckConfig);
          if (!check.valid) {
            console.warn('[AntiCheat] Illegal host deck rejected:', check.reason);
            if (typeof showToast === 'function') showToast(`⚠️ Host deck failed anti-cheat integrity check: ${check.reason}`, 4000);
            this.destroy();
            return;
          }
        }
        this.actionInFlight = false;
        this.actionInFlightTime = null;
        this.onInit(data);
      } else if (data.type === 'security_violation') {
        if (typeof showToast === 'function') {
          showToast(`🛡️ Anti-Cheat: Match aborted — ${data.reason || 'Configuration rejected'}`, 4000);
        }
        this.destroy();
      } else if (data.type === 'applied') {
        this.actionInFlight = false; // Reset lock on authority applied action response
        this.actionInFlightTime = null;
        this.onApplied(data.action);
      } else if (data.type === 'state_digest_sync') {
        if (typeof AntiCheat !== 'undefined' && typeof state !== 'undefined') {
          const res = AntiCheat.verifyStateDigest(state, data.digest);
          if (!res.synced) {
            console.warn('[AntiCheat] State divergence detected on guest:', res.reason);
          }
        }
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

  sendForfeit() {
    if (this.usingRelay && this.relaySession) return this.relaySession.sendForfeit();
    this._send({ type: 'forfeit' });
  }

  sendEmote(emoji) {
    if (this.usingRelay && this.relaySession) return this.relaySession.sendEmote(emoji);
    this._send({ type: 'emote', emoji });
  }

  sendRematchOffer() {
    if (this.usingRelay && this.relaySession) return this.relaySession.sendRematchOffer();
    this._send({ type: 'rematch_offer' });
  }

  sendRematchAccept() {
    if (this.usingRelay && this.relaySession) return this.relaySession.sendRematchAccept();
    this._send({ type: 'rematch_accept' });
  }

  sendRematchDecline() {
    if (this.usingRelay && this.relaySession) return this.relaySession.sendRematchDecline();
    this._send({ type: 'rematch_decline' });
  }

  // Called by the local UI when the local human wants to perform an action.
  submitAction(action) {
    if (this.usingRelay && this.relaySession) {
      return this.relaySession.submitAction(action);
    }
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
    if (this.relaySession) {
      try { this.relaySession.destroy(); } catch (_) {}
      this.relaySession = null;
    }
    this.stopPingHeartbeat();
    if (this.reconnectTimeout) { clearTimeout(this.reconnectTimeout); this.reconnectTimeout = null; }
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
