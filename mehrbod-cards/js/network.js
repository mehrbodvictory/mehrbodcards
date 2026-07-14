// Thin wrapper around PeerJS for a 2-player connection.
//
// The host is authoritative: every action (from either player) is applied
// to the engine ONLY on the host, in the order the host receives it. The
// host then broadcasts an 'applied' message so both sides render identical
// state without ever shipping the whole game state over the wire - just the
// seed once, then a stream of small action objects.
//
// Flow:
//  Host creates a Peer with a short room code, waits for a connection.
//  Guest connects using that room code.
//  Host picks the match seed and sends { type:'init', seed }.
//  Guest sends its intents as { type:'intent', action }.
//  Host applies intents + its own actions locally, then sends
//    { type:'applied', action } back down to the guest for every action
//    (including the host's own), so ordering is identical on both sides.
export class NetSession {
  constructor({ onInit, onApplied, onStatus, onPeerError }) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.onInit = onInit;
    this.onApplied = onApplied;   // (action) => void — apply it locally
    this.onStatus = onStatus || (() => {});
    this.onPeerError = onPeerError || (() => {});
  }

  _makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  hostGame(seed) {
    this.isHost = true;
    this.seed = seed;
    const code = this._makeRoomCode();
    this.peer = new Peer('cardbattler-' + code, { debug: 1 });
    this.onStatus('connecting');
    return new Promise((resolve, reject) => {
      this.peer.on('open', () => { this.onStatus('waiting'); resolve(code); });
      this.peer.on('error', err => { this.onPeerError(err); reject(err); });
      this.peer.on('connection', conn => {
        this.conn = conn;
        this._wireHostConn();
        conn.on('open', () => {
          this._send({ type: 'init', seed: this.seed });
          this.onStatus('connected');
        });
      });
    });
  }

  joinGame(code) {
    this.isHost = false;
    this.peer = new Peer(undefined, { debug: 1 });
    this.onStatus('connecting');
    return new Promise((resolve, reject) => {
      this.peer.on('open', () => {
        this.conn = this.peer.connect('cardbattler-' + code.toUpperCase(), { reliable: true });
        this._wireGuestConn();
        this.conn.on('open', () => { this.onStatus('connected'); resolve(); });
      });
      this.peer.on('error', err => { this.onPeerError(err); reject(err); });
    });
  }

  _wireHostConn() {
    this.conn.on('data', data => {
      if (data.type === 'intent') {
        this.onApplied(data.action);
        this._send({ type: 'applied', action: data.action });
      }
    });
    this.conn.on('close', () => this.onStatus('disconnected'));
  }

  _wireGuestConn() {
    this.conn.on('data', data => {
      if (data.type === 'init') this.onInit(data);
      else if (data.type === 'applied') this.onApplied(data.action);
    });
    this.conn.on('close', () => this.onStatus('disconnected'));
  }

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

  destroy() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}
