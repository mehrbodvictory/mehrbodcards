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
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};
const CONNECT_TIMEOUT_MS = 20000;
const TIMEOUT_MESSAGE = "Connection timed out. This can happen on restrictive networks (school or work wifi). Try a mobile hotspot or a different network.";

class NetSession {
  constructor({ onInit, onApplied, onStatus, onPeerError, onGuestConfig, onForfeit }) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.onInit = onInit;
    this.onApplied = onApplied;   // (action) => void — apply it locally
    this.onStatus = onStatus || (() => {});
    this.onPeerError = onPeerError || (() => {});
    this.onGuestConfig = onGuestConfig || (() => {}); // host-only: (deckConfig) => void
    this.onForfeit = onForfeit || (() => {}); // fires when the other side quits or disconnects mid-match
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
    const code = this._makeRoomCode();
    this.peer = new Peer('cardbattler-' + code, { debug: 1, config: ICE_CONFIG });
    this.onStatus('connecting');
    return new Promise((resolve, reject) => {
      this.peer.on('open', () => { this.onStatus('waiting'); resolve(code); });
      this.peer.on('error', err => { this.onPeerError(err); reject(err); });
      this.peer.on('connection', conn => {
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
    this.peer = new Peer(undefined, { debug: 1, config: ICE_CONFIG });
    this.onStatus('connecting');
    return new Promise((resolve, reject) => {
      this.peer.on('open', () => {
        this.conn = this.peer.connect('cardbattler-' + code.toUpperCase(), { reliable: true });
        this._wireGuestConn();
        const timeout = setTimeout(() => {
          if (!this.conn.open) this.onPeerError({ type: 'connection-timeout', message: TIMEOUT_MESSAGE });
        }, CONNECT_TIMEOUT_MS);
        this.conn.on('open', () => {
          clearTimeout(timeout);
          this._send({ type: 'guestConfig', deckConfig: this.guestDeckConfig });
          this.onStatus('connected');
          resolve();
        });
      });
      this.peer.on('error', err => { this.onPeerError(err); reject(err); });
    });
  }

  _wireHostConn() {
    this.conn.on('data', data => {
      if (data.type === 'intent') {
        this.onApplied(data.action);
        this._send({ type: 'applied', action: data.action });
      } else if (data.type === 'guestConfig') {
        this.onGuestConfig(data.deckConfig);
      } else if (data.type === 'forfeit') {
        this.onForfeit();
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
      this.onStatus('disconnected');
      this.onForfeit();
    });
  }

  _wireGuestConn() {
    this.conn.on('data', data => {
      if (data.type === 'init') this.onInit(data);
      else if (data.type === 'applied') this.onApplied(data.action);
      else if (data.type === 'forfeit') this.onForfeit();
    });
    this.conn.on('close', () => {
      if (this.manualDisconnect) return;
      this.onStatus('disconnected');
      this.onForfeit();
    });
  }

  // Called when the local player intentionally quits mid-match, so the
  // remaining player doesn't just see a dead connection - they get an
  // explicit, immediate win instead of waiting for a raw disconnect.
  sendForfeit() { this._send({ type: 'forfeit' }); }

  // Called by the local UI when the local human wants to perform an action.
  submitAction(action) {
    if (this.isHost) {
      this.onApplied(action);                  // apply immediately, authoritative
      this._send({ type: 'applied', action });  // tell the guest
    } else {
      this._send({ type: 'intent', action });   // ask the host to apply it
    }
  }

  _send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); }

  // `manualDisconnect` marks this as a deliberate local teardown (quitting,
  // leaving a lobby, etc.) rather than the other peer actually forfeiting -
  // see the 'close' handlers above for why that distinction matters.
  destroy() {
    this.manualDisconnect = true;
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
