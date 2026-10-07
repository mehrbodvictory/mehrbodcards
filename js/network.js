// Multi-Transport Multiplayer Network Layer (Firestore Realtime + HTTPS Server Relay + WebRTC P2P)
//
// Authoritative Host Architecture:
// All game state logic is executed authoritatively on the host. Actions are
// submitted by players, verified, applied to the local match engine on the host,
// and broadcasted down to the guest as 'applied' events.
//
// Triple-Layer Connection Guarantee (VPN, School Wi-Fi, Multi-Instance Cloud Run):
// 1. Firebase Firestore Realtime Sync (mp_rooms collection with onSnapshot) - Real-time push across all networks
// 2. HTTP Server Relay - Fast REST long-polling
// 3. WebRTC PeerJS - Direct local P2P acceleration when NAT allows

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
  if (!err) return "Connection notice.";
  if (typeof err === 'string') return err;
  const type = err.type || '';
  const msg = err.message || '';
  if (msg.includes('Negotiation') || type === 'webrtc') {
    return "P2P WebRTC blocked by network firewall. Synchronizing via Secure Cloud Relay.";
  }
  if (type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
    return "Signaling server busy. Reconnecting...";
  }
  if (type === 'peer-unavailable') {
    return "Room code not found or host went offline.";
  }
  if (type === 'unavailable-id') {
    return "Room code already in use. Generating a fresh room...";
  }
  if (type === 'network' || type === 'disconnected') {
    return "Network reconnecting...";
  }
  return msg || `Connection notice (${type || 'network'})`;
}

/* ---------------- SERVER RELAY MULTIPLAYER CLASS ---------------- */
class ServerRelaySession {
  constructor({ onInit, onApplied, onStatus, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline, onDisconnectWarning, onReconnected }) {
    this.isHost = false;
    this.roomCode = '';
    this.seed = null;
    this.wager = 0;
    this.hostDeckConfig = null;
    this.guestDeckConfig = null;
    this.lastMsgId = 0;
    this.receivedMsgIds = new Set();
    this.pollInterval = null;
    this.handshakeInterval = null;
    this.pingInterval = null;
    this.destroyed = false;
    this.receivedGuestConfig = false;
    this.receivedInit = false;
    this._guestConnectedNotified = false;
    this._isPolling = false;
    this._consecutivePollErrors = 0;
    this._isDisconnectWarned = false;

    this.onInit = onInit;
    this.onApplied = onApplied;
    this.onStatus = onStatus || (() => {});
    this.onGuestConfig = onGuestConfig || (() => {});
    this.onForfeit = onForfeit || (() => {});
    this.onEmote = onEmote || (() => {});
    this.onPing = onPing || (() => {});
    this.onRematchOffer = onRematchOffer || (() => {});
    this.onRematchAccept = onRematchAccept || (() => {});
    this.onRematchDecline = onRematchDecline || (() => {});
    this.onDisconnectWarning = onDisconnectWarning || (() => {});
    this.onReconnected = onReconnected || (() => {});
  }

  async hostGameWithCode(code, seed, wager, hostDeckConfig) {
    this.isHost = true;
    this.seed = seed;
    this.wager = wager || 0;
    this.hostDeckConfig = hostDeckConfig || null;
    this.roomCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.onStatus('connecting');

    try {
      await fetch('/api/relay/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode })
      });
    } catch (_) {}

    this.onStatus('waiting');
    this._startPolling();
    this._startPingHeartbeat();
    return this.roomCode;
  }

  async joinGame(code, guestDeckConfig) {
    this.isHost = false;
    this.guestDeckConfig = guestDeckConfig || null;
    this.roomCode = (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.onStatus('connecting');

    try {
      await fetch('/api/relay/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.roomCode })
      });
    } catch (_) {}

    this.onStatus('connected');
    this._startPolling();
    this._startPingHeartbeat();

    // Send initial guest deck config and repeat every 1.0s until match starts
    this._sendMsg({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
    
    let handshakeAttempts = 0;
    if (this.handshakeInterval) clearInterval(this.handshakeInterval);
    this.handshakeInterval = setInterval(() => {
      if (this.destroyed || this.receivedInit || handshakeAttempts++ > 35) {
        clearInterval(this.handshakeInterval);
        this.handshakeInterval = null;
        return;
      }
      this._sendMsg({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
    }, 1000);
  }

  sendInit(seed, wager, hostDeckConfig, guestDeckConfig) {
    const s = seed || this.seed;
    const w = (wager !== undefined && wager !== null) ? wager : this.wager;
    const h = hostDeckConfig || this.hostDeckConfig;
    const g = guestDeckConfig || this.guestDeckConfig;
    this.seed = s;
    this.wager = w;
    this.hostDeckConfig = h;
    this.guestDeckConfig = g;

    const payload = { type: 'init', seed: s, wager: w, hostDeckConfig: h, guestDeckConfig: g };
    this._sendMsg(payload);

    let sendCount = 0;
    const initTimer = setInterval(() => {
      if (this.destroyed || this.receivedInitAck || sendCount++ > 8) {
        clearInterval(initTimer);
        return;
      }
      this._sendMsg(payload);
    }, 800);
  }

  submitAction(action) {
    if (!action) return;
    if (!action.id) {
      action.id = 'act_' + (this.isHost ? 'host' : 'guest') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
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
    } catch (_) {}
  }

  _startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this._poll(), 50);
  }

  _startPingHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.destroyed || !this.roomCode) return;
      this._sendMsg({ type: 'ping', sentAt: Date.now() });
    }, 2000);
  }

  async _poll() {
    if (this.destroyed || !this.roomCode || this._isPolling) return;
    this._isPolling = true;
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
      if (!res.ok) {
        this._consecutivePollErrors++;
        if (this._consecutivePollErrors > 6 && !this._isDisconnectWarned) {
          this._isDisconnectWarned = true;
          this.onDisconnectWarning();
        }
        return;
      }
      
      if (this._isDisconnectWarned) {
        this._isDisconnectWarned = false;
        this._consecutivePollErrors = 0;
        this.onReconnected();
      } else {
        this._consecutivePollErrors = 0;
      }

      const data = await res.json();

      if (this.isHost && data.guestJoined && !this._guestConnectedNotified) {
        this._guestConnectedNotified = true;
        this.onStatus('connected');
      }

      if (Array.isArray(data.messages)) {
        for (const msg of data.messages) {
          if (!msg || !msg.id) continue;
          if (msg.id > this.lastMsgId) this.lastMsgId = msg.id;
          if (this.receivedMsgIds.has(msg.id)) continue;
          this.receivedMsgIds.add(msg.id);
          this._handleIncomingPayload(msg.payload);
        }
      }
    } catch (_) {
      this._consecutivePollErrors++;
      if (this._consecutivePollErrors > 6 && !this._isDisconnectWarned) {
        this._isDisconnectWarned = true;
        this.onDisconnectWarning();
      }
    } finally {
      this._isPolling = false;
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

  resetForRematch() {
    this.receivedInit = false;
    this.receivedInitAck = false;
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

/* ---------------- LAN DISCOVERY BEACON ENGINE ---------------- */
const LanDiscovery = {
  broadcastChannel: null,
  isScanning: false,
  scanInterval: null,
  heartbeatInterval: null,
  hostedRoomCode: null,
  listeners: new Set(),
  knownRooms: new Map(),

  init() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('mehrbodcards_lan_bus');
        this.broadcastChannel.onmessage = (event) => {
          this._handleBroadcastMessage(event.data);
        };
      }
    } catch (_) {}
  },

  addListener(fn) {
    this.listeners.add(fn);
  },

  removeListener(fn) {
    this.listeners.delete(fn);
  },

  _emitUpdate() {
    const list = Array.from(this.knownRooms.values());
    this.listeners.forEach(fn => {
      try { fn(list); } catch (_) {}
    });
  },

  _handleBroadcastMessage(data) {
    if (!data || !data.type) return;
    const now = Date.now();
    if (data.type === 'lan_room_beacon') {
      const room = data.room;
      if (room && room.roomCode) {
        room.lastSeen = now;
        room.isDirectLocal = true;
        this.knownRooms.set(room.roomCode, room);
        this._emitUpdate();
      }
    } else if (data.type === 'lan_room_closed') {
      if (data.roomCode) {
        this.knownRooms.delete(data.roomCode);
        this._emitUpdate();
      }
    }
  },

  startScanning() {
    this.isScanning = true;
    this.knownRooms.clear();
    this._pollLanRooms();
    if (this.scanInterval) clearInterval(this.scanInterval);
    this.scanInterval = setInterval(() => this._pollLanRooms(), 2000);
  },

  stopScanning() {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  },

  async _pollLanRooms() {
    if (!this.isScanning) return;
    const now = Date.now();
    try {
      const res = await fetch('/api/lan/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.rooms)) {
          data.rooms.forEach(r => {
            r.lastSeen = now;
            this.knownRooms.set(r.roomCode, r);
          });
        }
      }
    } catch (_) {}

    // Clean up stale local rooms older than 12s
    for (const [code, room] of this.knownRooms.entries()) {
      if (now - (room.lastSeen || 0) > 12000) {
        this.knownRooms.delete(code);
      }
    }
    this._emitUpdate();
  },

  startHostBeacon(roomCode, roomName, hostInfo, wager) {
    this.hostedRoomCode = roomCode;
    const roomPayload = {
      roomCode,
      roomName: roomName || `${hostInfo?.playerName || 'Player'}'s LAN Match`,
      hostName: hostInfo?.playerName || 'Host Player',
      hostAvatar: hostInfo?.playerAvatar || '⚔️',
      hostLevel: hostInfo?.playerLevel || 1,
      hostGradient: hostInfo?.playerGradient || null,
      wager: wager || 0,
      createdAt: Date.now()
    };

    // Broadcast on local channel immediately
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'lan_room_beacon', room: roomPayload });
    }

    // Register on server API
    fetch('/api/lan/host', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, roomName, hostInfo, wager })
    }).catch(() => {});

    // Periodic heartbeat every 4 seconds
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (!this.hostedRoomCode) return;
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'lan_room_beacon', room: roomPayload });
      }
      fetch('/api/lan/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: this.hostedRoomCode })
      }).catch(() => {});
    }, 4000);
  },

  stopHostBeacon() {
    if (this.hostedRoomCode) {
      const code = this.hostedRoomCode;
      this.hostedRoomCode = null;
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'lan_room_closed', roomCode: code });
      }
      fetch('/api/lan/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code })
      }).catch(() => {});
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
};

LanDiscovery.init();
window.LanDiscovery = LanDiscovery;

/* ---------------- TRIPLE-LAYER MULTIPLAYER SESSION ---------------- */
class NetSession {
  constructor({ onInit, onApplied, onStatus, onPeerError, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline, onDisconnectWarning, onReconnected }) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.isLan = false;
    this.relaySession = null;
    this.firebaseSession = null;
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
      const actId = action.id || `act_${action.player || ''}_${action.type || ''}_${action.slot ?? ''}_${action.spellId ?? ''}_${action.chipId ?? ''}`;
      if (this.processedActionIds.has(actId)) return;
      this.processedActionIds.add(actId);
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
    this.onDisconnectWarning = onDisconnectWarning || (() => {});
    this.onReconnected = onReconnected || (() => {});

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

    // 1. Firebase Firestore Realtime Session (Real-time sync across multi-instance Cloud Run & mobile/VPN)
    if (typeof FirebaseRealtimeSession !== 'undefined') {
      this.firebaseSession = new FirebaseRealtimeSession({
        onInit: this.onInit,
        onApplied: this.onApplied,
        onStatus: this.onStatus,
        onGuestConfig: this.onGuestConfig,
        onForfeit: this.onForfeit,
        onEmote: this.onEmote,
        onPing: this.onPing,
        onRematchOffer: this.onRematchOffer,
        onRematchAccept: this.onRematchAccept,
        onRematchDecline: this.onRematchDecline
      });
      this.firebaseSession.hostRoom(code, seed, wager, hostDeckConfig).catch(() => {});
    }

    // 2. HTTPS Server Relay Session (Guaranteed on VPNs & School Wi-Fi)
    this.relaySession = new ServerRelaySession({
      onInit: this.onInit,
      onApplied: this.onApplied,
      onStatus: this.onStatus,
      onGuestConfig: this.onGuestConfig,
      onForfeit: this.onForfeit,
      onEmote: this.onEmote,
      onPing: this.onPing,
      onRematchOffer: this.onRematchOffer,
      onRematchAccept: this.onRematchAccept,
      onRematchDecline: this.onRematchDecline,
      onDisconnectWarning: this.onDisconnectWarning,
      onReconnected: this.onReconnected
    });
    this.relaySession.hostGameWithCode(code, seed, wager, hostDeckConfig).catch(() => {});

    // 3. WebRTC PeerJS in background for optional direct P2P acceleration
    try {
      const iceConfig = getIceConfig();
      const peerId = 'cardbattler-' + code;
      this.peer = new Peer(peerId, { debug: 0, config: iceConfig });

      this.peer.on('open', () => { this.onStatus('waiting'); });
      this.peer.on('error', () => {});
      this.peer.on('connection', conn => this._handleIncomingHostConn(conn));
    } catch (_) {}

    this.onStatus('waiting');
    return code;
  }

  async hostLanGame(roomName, seed, wager, hostDeckConfig) {
    this.isHost = true;
    this.isLan = true;
    this.seed = seed;
    this.wager = wager || 0;
    this.hostDeckConfig = hostDeckConfig || null;
    const code = this._makeRoomCode();
    this.roomCode = code;
    this.onStatus('connecting');

    // Start LAN local broadcast + server registration
    if (typeof LanDiscovery !== 'undefined') {
      LanDiscovery.startHostBeacon(code, roomName, hostDeckConfig, wager);
    }

    // Server relay for local socket long-polling
    this.relaySession = new ServerRelaySession({
      onInit: this.onInit,
      onApplied: this.onApplied,
      onStatus: this.onStatus,
      onGuestConfig: this.onGuestConfig,
      onForfeit: this.onForfeit,
      onEmote: this.onEmote,
      onPing: (lat) => this.onPing(lat, true),
      onRematchOffer: this.onRematchOffer,
      onRematchAccept: this.onRematchAccept,
      onRematchDecline: this.onRematchDecline,
      onDisconnectWarning: this.onDisconnectWarning,
      onReconnected: this.onReconnected
    });
    this.relaySession.hostGameWithCode(code, seed, wager, hostDeckConfig).catch(() => {});

    // WebRTC Direct P2P on LAN
    try {
      const iceConfig = getIceConfig();
      this.peer = new Peer('cardbattler-' + code, { debug: 0, config: iceConfig });
      this.peer.on('open', () => { this.onStatus('waiting'); });
      this.peer.on('error', () => {});
      this.peer.on('connection', conn => this._handleIncomingHostConn(conn));
    } catch (_) {}

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
    if (this.firebaseSession) {
      this.firebaseSession.sendInit(this.seed, this.wager, this.hostDeckConfig, this.guestDeckConfig);
    }
    if (this.relaySession) {
      this.relaySession.sendInit(this.seed, this.wager, this.hostDeckConfig, this.guestDeckConfig);
    }
    this._send({ type: 'init', seed: this.seed, wager: this.wager, hostDeckConfig: this.hostDeckConfig, guestDeckConfig: this.guestDeckConfig });
  }

  async joinLanGame(code, guestDeckConfig) {
    this.isHost = false;
    this.isLan = true;
    this.guestDeckConfig = guestDeckConfig || null;
    const cleanCode = (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.roomCode = cleanCode;
    this.onStatus('connecting');

    fetch('/api/lan/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: cleanCode, guestInfo: guestDeckConfig })
    }).catch(() => {});

    this.relaySession = new ServerRelaySession({
      onInit: this.onInit,
      onApplied: this.onApplied,
      onStatus: this.onStatus,
      onGuestConfig: this.onGuestConfig,
      onForfeit: this.onForfeit,
      onEmote: this.onEmote,
      onPing: (lat) => this.onPing(lat, true),
      onRematchOffer: this.onRematchOffer,
      onRematchAccept: this.onRematchAccept,
      onRematchDecline: this.onRematchDecline,
      onDisconnectWarning: this.onDisconnectWarning,
      onReconnected: this.onReconnected
    });
    this.relaySession.joinGame(cleanCode, guestDeckConfig).catch(() => {});

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
    } catch (_) {}

    this.onStatus('connected');
  }

  async joinGame(code, guestDeckConfig) {
    this.isHost = false;
    this.guestDeckConfig = guestDeckConfig || null;
    const cleanCode = (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.roomCode = cleanCode;
    this.onStatus('connecting');

    // 1. Firebase Firestore Realtime Session (Real-time sync across multi-instance Cloud Run & mobile/VPN)
    if (typeof FirebaseRealtimeSession !== 'undefined') {
      this.firebaseSession = new FirebaseRealtimeSession({
        onInit: this.onInit,
        onApplied: this.onApplied,
        onStatus: this.onStatus,
        onGuestConfig: this.onGuestConfig,
        onForfeit: this.onForfeit,
        onEmote: this.onEmote,
        onPing: this.onPing,
        onRematchOffer: this.onRematchOffer,
        onRematchAccept: this.onRematchAccept,
        onRematchDecline: this.onRematchDecline
      });
      this.firebaseSession.joinRoom(cleanCode, guestDeckConfig).catch(() => {});
    }

    // 2. HTTPS Server Relay Session (Guaranteed on VPNs & School Wi-Fi)
    this.relaySession = new ServerRelaySession({
      onInit: this.onInit,
      onApplied: this.onApplied,
      onStatus: this.onStatus,
      onGuestConfig: this.onGuestConfig,
      onForfeit: this.onForfeit,
      onEmote: this.onEmote,
      onPing: this.onPing,
      onRematchOffer: this.onRematchOffer,
      onRematchAccept: this.onRematchAccept,
      onRematchDecline: this.onRematchDecline,
      onDisconnectWarning: this.onDisconnectWarning,
      onReconnected: this.onReconnected
    });
    this.relaySession.joinGame(cleanCode, guestDeckConfig).catch(() => {});

    // 3. WebRTC PeerJS in background
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
      this.peer.on('error', () => {});
    } catch (_) {}

    this.onStatus('connected');
  }

  submitAction(action) {
    if (!action) return;
    if (!action.id) {
      action.id = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }
    if (this.isHost) {
      this.onApplied(action);
    }
    if (this.firebaseSession) {
      this.firebaseSession.submitAction(action);
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
    if (this.firebaseSession) this.firebaseSession.sendSignal('forfeit');
    if (this.relaySession) this.relaySession.sendForfeit();
    this._send({ type: 'forfeit' });
  }

  sendEmote(emoji) {
    if (this.firebaseSession) this.firebaseSession.sendSignal('emote', { emoji });
    if (this.relaySession) this.relaySession.sendEmote(emoji);
    this._send({ type: 'emote', emoji });
  }

  sendRematchOffer() {
    if (this.firebaseSession) this.firebaseSession.sendSignal('rematch_offer');
    if (this.relaySession) this.relaySession.sendRematchOffer();
    this._send({ type: 'rematch_offer' });
  }

  sendRematchAccept() {
    if (this.firebaseSession) this.firebaseSession.sendSignal('rematch_accept');
    if (this.relaySession) this.relaySession.sendRematchAccept();
    this._send({ type: 'rematch_accept' });
  }

  sendRematchDecline() {
    if (this.firebaseSession) this.firebaseSession.sendSignal('rematch_decline');
    if (this.relaySession) this.relaySession.sendRematchDecline();
    this._send({ type: 'rematch_decline' });
  }

  _send(msg) {
    if (this.conn && this.conn.open) {
      try { this.conn.send(msg); } catch (_) {}
    }
  }

  resetForRematch() {
    this.receivedInit = false;
    this.receivedGuestConfig = false;
    this.processedActionIds.clear();
    if (this.firebaseSession && typeof this.firebaseSession.resetForRematch === 'function') {
      this.firebaseSession.resetForRematch();
    }
    if (this.relaySession && typeof this.relaySession.resetForRematch === 'function') {
      this.relaySession.resetForRematch();
    }
  }

  destroy() {
    this.manualDisconnect = true;
    if (this.isLan && typeof LanDiscovery !== 'undefined') {
      try { LanDiscovery.stopHostBeacon(); } catch (_) {}
    }
    if (this.firebaseSession) {
      try { this.firebaseSession.destroy(); } catch (_) {}
      this.firebaseSession = null;
    }
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
