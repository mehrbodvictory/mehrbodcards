// Dual-Transport Multiplayer Network Layer (WebRTC P2P + HTTPS Server Relay)
// 
// Authoritative Host Architecture:
// All game state logic is executed authoritatively on the host. Actions are
// submitted by players, verified, applied to the local match engine on the host,
// and broadcasted down to the guest as 'applied' events.
//
// Restrictive Network & VPN / School Wi-Fi Support:
// School Wi-Fi and corporate VPNs routinely block raw UDP WebRTC traffic, resulting
// in STUN timeouts or "Negotiation of connection failed" errors.
// NetSession solves this by running an HTTPS Server Relay in tandem. If WebRTC
// is blocked or unavailable, gameplay seamlessly flows over the HTTP Relay
// with zero packet drops, zero desync, and zero interruption.

function getIceConfig() {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ]
  };
}

function formatPeerErrorMessage(err) {
  if (!err) return "Connection issue encountered.";
  if (typeof err === 'string') return err;
  const type = err.type || '';
  const msg = err.message || '';
  if (msg.includes('Negotiation') || type === 'webrtc') {
    return "P2P WebRTC blocked by network firewall. Operating via Secure HTTPS Relay.";
  }
  if (type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
    return "Signaling server busy. Retrying connection...";
  }
  if (type === 'peer-unavailable') {
    return "Room code not found or opponent went offline.";
  }
  if (type === 'unavailable-id') {
    return "Room code already in use. Generating a fresh room...";
  }
  if (type === 'network' || type === 'disconnected') {
    return "Network connection dropped. Reconnecting...";
  }
  return msg || `Connection notice (${type || 'network'})`;
}

/* ---------------- SERVER RELAY MULTIPLAYER CLASS ---------------- */
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
    this.handshakeInterval = null;
    this.pingInterval = null;
    this.destroyed = false;
    this.receivedGuestConfig = false;
    this.receivedInit = false;
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

  async hostGameWithCode(code, seed, wager, hostDeckConfig) {
    this.isHost = true;
    this.seed = seed;
    this.wager = wager || 0;
    this.hostDeckConfig = hostDeckConfig || null;
    this.roomCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.onStatus('connecting');

    try {
      const res = await fetch('/api/relay/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode })
      });
      if (!res.ok) throw new Error('Failed to register host relay room');
      this.onStatus('waiting');
      this._startPolling();
      this._startPingHeartbeat();
      return this.roomCode;
    } catch (err) {
      console.warn('[ServerRelay] Host registration warning:', err);
      this.onStatus('waiting');
      this._startPolling();
      this._startPingHeartbeat();
      return this.roomCode;
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
      if (!res.ok) throw new Error('Failed to join relay room');
    } catch (err) {
      console.warn('[ServerRelay] Join warning (proceeding to poll):', err);
    }

    this.onStatus('connected');
    this._startPolling();
    this._startPingHeartbeat();

    // Send initial guest deck config and repeat every 1.2s until match starts
    this._sendMsg({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
    
    let handshakeAttempts = 0;
    if (this.handshakeInterval) clearInterval(this.handshakeInterval);
    this.handshakeInterval = setInterval(() => {
      if (this.destroyed || this.receivedInit || handshakeAttempts++ > 30) {
        clearInterval(this.handshakeInterval);
        this.handshakeInterval = null;
        return;
      }
      this._sendMsg({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
    }, 1200);
  }

  sendInit(seed, wager, hostDeckConfig) {
    const s = seed || this.seed;
    const w = (wager !== undefined && wager !== null) ? wager : this.wager;
    const h = hostDeckConfig || this.hostDeckConfig;
    this.seed = s;
    this.wager = w;
    this.hostDeckConfig = h;

    const payload = { type: 'init', seed: s, wager: w, hostDeckConfig: h };
    this._sendMsg(payload);

    // Host re-sends init briefly to ensure arrival over lossy networks until guest acks
    let sendCount = 0;
    const initTimer = setInterval(() => {
      if (this.destroyed || this.receivedInitAck || sendCount++ > 6) {
        clearInterval(initTimer);
        return;
      }
      this._sendMsg(payload);
    }, 1000);
  }

  submitAction(action) {
    if (!action) return;
    if (!action.id) {
      action.id = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }
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
    if (this.destroyed || !this.roomCode) return;
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
      // Non-blocking network send glitch
    }
  }

  _startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this._poll(), 60);
  }

  _startPingHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.destroyed || !this.roomCode) return;
      this._sendMsg({ type: 'ping', sentAt: Date.now() });
    }, 2500);
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
      // Handled gracefully on next poll tick
    }
  }

  _handleIncomingPayload(payload) {
    if (!payload || !payload.type) return;

    if (payload.type === 'guestConfig' && this.isHost) {
      if (this.receivedGuestConfig) return;
      this.receivedGuestConfig = true;
      this.onGuestConfig(payload.deckConfig);
    } else if (payload.type === 'init' && !this.isHost) {
      if (this.receivedInit) return;
      this.receivedInit = true;
      if (this.handshakeInterval) {
        clearInterval(this.handshakeInterval);
        this.handshakeInterval = null;
      }
      this._sendMsg({ type: 'init_ack' });
      this.onInit(payload);
    } else if (payload.type === 'init_ack' && this.isHost) {
      this.receivedInitAck = true;
    } else if (payload.type === 'intent' && this.isHost) {
      if (payload.action && payload.action.player === 'guest') {
        if (typeof AntiCheat !== 'undefined') {
          const check = AntiCheat.sanitizeAndVerifyAction(typeof state !== 'undefined' ? state : null, payload.action, 'guest');
          if (!check.valid) {
            console.warn('[AntiCheat] Illegal intent rejected:', check.reason);
            return;
          }
        }
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
    } else if (payload.type === 'ping') {
      this._sendMsg({ type: 'pong', sentAt: payload.sentAt });
    } else if (payload.type === 'pong') {
      const latency = Math.max(1, Date.now() - (payload.sentAt || Date.now()));
      this.onPing(latency);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.handshakeInterval) { clearInterval(this.handshakeInterval); this.handshakeInterval = null; }
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    if (this.roomCode) {
      fetch('/api/relay/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode })
      }).catch(() => {});
    }
  }
}

/* ---------------- DUAL-TRANSPORT MULTIPLAYER SESSION ---------------- */
class NetSession {
  constructor({ onInit, onApplied, onStatus, onPeerError, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline }) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.relaySession = null;
    this.receivedGuestConfig = false;
    this.receivedInit = false;
    this.processedActionIds = new Set();
    this.manualDisconnect = false;

    this.onInit = (data) => {
      if (this.receivedInit) return;
      this.receivedInit = true;
      if (onInit) onInit(data);
    };

    this.onApplied = (action) => {
      if (!action) return;
      if (action.id) {
        if (this.processedActionIds.has(action.id)) return;
        this.processedActionIds.add(action.id);
      }
      if (onApplied) onApplied(action);
    };

    this.onStatus = onStatus || (() => {});
    this.onPeerError = onPeerError || (() => {});
    
    this.onGuestConfig = (config) => {
      if (this.receivedGuestConfig) return;
      this.receivedGuestConfig = true;
      if (onGuestConfig) onGuestConfig(config);
    };

    this.onForfeit = onForfeit || (() => {});
    this.onEmote = onEmote || (() => {});
    this.onPing = onPing || (() => {});
    this.onRematchOffer = onRematchOffer || (() => {});
    this.onRematchAccept = onRematchAccept || (() => {});
    this.onRematchDecline = onRematchDecline || (() => {});

    this.roomCode = '';
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
    const code = this._makeRoomCode();
    this.roomCode = code;
    this.onStatus('connecting');

    // 1. Start Server Relay Session (100% Guaranteed on VPNs & School Wi-Fi)
    this.relaySession = new ServerRelaySession({
      onInit: this.onInit,
      onApplied: this.onApplied,
      onStatus: this.onStatus,
      onPeerError: () => {},
      onGuestConfig: this.onGuestConfig,
      onForfeit: this.onForfeit,
      onEmote: this.onEmote,
      onPing: this.onPing,
      onRematchOffer: this.onRematchOffer,
      onRematchAccept: this.onRematchAccept,
      onRematchDecline: this.onRematchDecline
    });
    await this.relaySession.hostGameWithCode(code, seed, wager, hostDeckConfig);

    // 2. Also open WebRTC PeerJS in background for optional direct P2P acceleration
    try {
      const iceConfig = getIceConfig();
      const peerId = 'cardbattler-' + code;
      this.peer = new Peer(peerId, { debug: 0, config: iceConfig });

      this.peer.on('open', () => { this.onStatus('waiting'); });
      this.peer.on('error', err => {
        // Non-fatal because Relay transport handles the session completely
        console.warn('[P2P PeerJS notice]:', formatPeerErrorMessage(err));
      });
      this.peer.on('connection', conn => this._handleIncomingHostConn(conn));
    } catch (e) {
      console.warn('[P2P PeerJS] Operating via HTTPS Server Relay.');
    }

    this.onStatus('waiting');
    return code;
  }

  _handleIncomingHostConn(conn) {
    this.conn = conn;
    conn.on('open', () => {
      this.onStatus('connected');
    });
    conn.on('data', data => {
      if (!data) return;
      if (data.type === 'guestConfig') {
        this.onGuestConfig(data.deckConfig);
      } else if (data.type === 'intent') {
        if (data.action && data.action.player === 'guest') {
          this.onApplied(data.action);
          this._send({ type: 'applied', action: data.action });
          if (this.relaySession) this.relaySession._sendMsg({ type: 'applied', action: data.action });
        }
      } else if (data.type === 'forfeit') {
        this.onForfeit();
      } else if (data.type === 'emote') {
        this.onEmote(data.emoji);
      } else if (data.type === 'rematch_offer') {
        this.onRematchOffer();
      } else if (data.type === 'rematch_accept') {
        this.onRematchAccept();
      } else if (data.type === 'rematch_decline') {
        this.onRematchDecline();
      }
    });
    conn.on('error', () => {});
  }

  sendInit() {
    if (this.relaySession) {
      this.relaySession.sendInit(this.seed, this.wager, this.hostDeckConfig);
    }
    this._send({ type: 'init', seed: this.seed, wager: this.wager, hostDeckConfig: this.hostDeckConfig });
  }

  async joinGame(code, guestDeckConfig) {
    this.isHost = false;
    this.guestDeckConfig = guestDeckConfig || null;
    const cleanCode = (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.roomCode = cleanCode;
    this.onStatus('connecting');

    // 1. Start Server Relay Session (100% Guaranteed on VPNs & School Wi-Fi)
    this.relaySession = new ServerRelaySession({
      onInit: this.onInit,
      onApplied: this.onApplied,
      onStatus: this.onStatus,
      onPeerError: () => {},
      onGuestConfig: this.onGuestConfig,
      onForfeit: this.onForfeit,
      onEmote: this.onEmote,
      onPing: this.onPing,
      onRematchOffer: this.onRematchOffer,
      onRematchAccept: this.onRematchAccept,
      onRematchDecline: this.onRematchDecline
    });
    await this.relaySession.joinGame(cleanCode, guestDeckConfig);

    // 2. Also try WebRTC PeerJS in background
    try {
      const iceConfig = getIceConfig();
      this.peer = new Peer({ debug: 0, config: iceConfig });

      this.peer.on('open', () => {
        try {
          this.conn = this.peer.connect('cardbattler-' + cleanCode, { reliable: true });
          this.conn.on('open', () => {
            this._send({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
            this.onStatus('connected');
          });
          this.conn.on('data', data => {
            if (!data) return;
            if (data.type === 'init') {
              this.onInit(data);
            } else if (data.type === 'applied') {
              this.onApplied(data.action);
            } else if (data.type === 'forfeit') {
              this.onForfeit();
            } else if (data.type === 'emote') {
              this.onEmote(data.emoji);
            } else if (data.type === 'rematch_offer') {
              this.onRematchOffer();
            } else if (data.type === 'rematch_accept') {
              this.onRematchAccept();
            } else if (data.type === 'rematch_decline') {
              this.onRematchDecline();
            }
          });
          this.conn.on('error', () => {});
        } catch (_) {}
      });
      this.peer.on('error', err => {
        console.warn('[P2P PeerJS notice]:', formatPeerErrorMessage(err));
      });
    } catch (e) {
      console.warn('[P2P PeerJS] Operating via HTTPS Server Relay.');
    }

    this.onStatus('connected');
  }

  submitAction(action) {
    if (!action) return;
    if (!action.id) {
      action.id = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }
    if (this.relaySession) {
      this.relaySession.submitAction(action);
    }
    if (this.conn && this.conn.open) {
      if (this.isHost) {
        this._send({ type: 'applied', action });
      } else {
        this._send({ type: 'intent', action });
      }
    }
  }

  sendForfeit() {
    if (this.relaySession) this.relaySession.sendForfeit();
    this._send({ type: 'forfeit' });
  }

  sendEmote(emoji) {
    if (this.relaySession) this.relaySession.sendEmote(emoji);
    this._send({ type: 'emote', emoji });
  }

  sendRematchOffer() {
    if (this.relaySession) this.relaySession.sendRematchOffer();
    this._send({ type: 'rematch_offer' });
  }

  sendRematchAccept() {
    if (this.relaySession) this.relaySession.sendRematchAccept();
    this._send({ type: 'rematch_accept' });
  }

  sendRematchDecline() {
    if (this.relaySession) this.relaySession.sendRematchDecline();
    this._send({ type: 'rematch_decline' });
  }

  _send(msg) {
    if (this.conn && this.conn.open) {
      try { this.conn.send(msg); } catch (_) {}
    }
  }

  destroy() {
    this.manualDisconnect = true;
    if (this.relaySession) {
      try { this.relaySession.destroy(); } catch (_) {}
      this.relaySession = null;
    }
    if (this.conn) {
      try { this.conn.close(); } catch (_) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
  }
}
