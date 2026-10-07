// Firebase Realtime Matchmaking and Multiplayer Sync Engine
// Connects to Firestore named database: ai-studio-mehrbodcards-2486d43b-39c5-4f6d-97c2-d362e9b3583a

const FIREBASE_APP_CONFIG = {
  projectId: "modular-current-wthv3",
  appId: "1:223543184692:web:a72ddd20a87a01b06a6961",
  apiKey: "AIzaSyAMdOl4wq0LOez1RaRJBKhtH3KafSAc_a0",
  authDomain: "modular-current-wthv3.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-mehrbodcards-2486d43b-39c5-4f6d-97c2-d362e9b3583a",
  storageBucket: "modular-current-wthv3.firebasestorage.app",
  messagingSenderId: "223543184692"
};

const LOBBY_STALE_MS = 40000;

function getBridge() {
  return window.FirestoreBridge || null;
}

const FirebaseMatchmaking = {
  isAvailable() {
    const bridge = getBridge();
    return Boolean(bridge && bridge.db);
  },

  async findAndClaimLobby(guestConfig = null) {
    const bridge = getBridge();
    if (!bridge || !bridge.db) return null;
    const { db, collection, query, where, getDocs, doc, runTransaction } = bridge;

    const cutoff = Date.now() - LOBBY_STALE_MS;
    try {
      const q = query(
        collection(db, 'matchmaking_lobbies'),
        where('status', '==', 'waiting')
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;

      const freshDocs = snap.docs.filter(d => {
        const data = d.data();
        return data && data.createdAt >= cutoff && data.status === 'waiting';
      });

      for (const d of freshDocs) {
        const code = d.id;
        const docRef = doc(db, 'matchmaking_lobbies', code);
        try {
          const claimed = await runTransaction(db, async (txn) => {
            const fresh = await txn.get(docRef);
            if (!fresh.exists()) return null;
            const data = fresh.data();
            if (data.status !== 'waiting' || (data.createdAt && data.createdAt < cutoff)) {
              return null;
            }
            txn.update(docRef, {
              status: 'matched',
              guestJoined: true,
              matchedAt: Date.now(),
              guestPlayerName: guestConfig?.playerName || 'Player',
              guestPlayerAvatar: guestConfig?.playerAvatar || '⚔️',
              guestPlayerGradient: guestConfig?.playerGradient || null,
              guestPlayerLevel: guestConfig?.playerLevel || 1,
              guestDeckName: guestConfig?.deckName || 'Battle Deck'
            });
            return data;
          });

          if (claimed && claimed.roomCode) {
            return {
              roomCode: claimed.roomCode,
              hostPeerId: 'cardbattler-' + claimed.roomCode,
              hostInfo: {
                playerName: claimed.hostPlayerName || 'Host Player',
                playerAvatar: claimed.hostPlayerAvatar || '⚔️',
                playerGradient: claimed.hostPlayerGradient || null,
                playerLevel: claimed.hostPlayerLevel || 1,
                deckName: claimed.hostDeckName || 'Battle Deck'
              }
            };
          }
        } catch (txnErr) {
          // Contention, try next
        }
      }
    } catch (err) {
      console.warn('[Firebase Matchmaking] Discovery notice:', err);
    }
    return null;
  },

  async registerLobby(roomCode, hostConfig = null) {
    const bridge = getBridge();
    if (!bridge || !bridge.db) return null;
    const { db, doc, setDoc } = bridge;

    const cleanCode = String(roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanCode) return null;

    try {
      const docRef = doc(db, 'matchmaking_lobbies', cleanCode);
      await setDoc(docRef, {
        roomCode: cleanCode,
        hostPeerId: 'cardbattler-' + cleanCode,
        status: 'waiting',
        createdAt: Date.now(),
        guestJoined: false,
        hostPlayerName: hostConfig?.playerName || 'Host Player',
        hostPlayerAvatar: hostConfig?.playerAvatar || '⚔️',
        hostPlayerGradient: hostConfig?.playerGradient || null,
        hostPlayerLevel: hostConfig?.playerLevel || 1,
        hostDeckName: hostConfig?.deckName || 'Battle Deck'
      });
      return docRef;
    } catch (err) {
      console.warn('[Firebase Matchmaking] Lobby register notice:', err);
      return null;
    }
  },

  async cancelLobby(roomCode) {
    const bridge = getBridge();
    if (!bridge || !bridge.db) return;
    const { db, doc, deleteDoc } = bridge;
    const cleanCode = String(roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanCode) return;

    try {
      await deleteDoc(doc(db, 'matchmaking_lobbies', cleanCode));
    } catch (err) {
      // Background cleanup notice
    }
  }
};

/* ---------------- FIRESTORE REALTIME MULTIPLAYER ROOM SESSION ---------------- */
class FirebaseRealtimeSession {
  constructor({ onInit, onApplied, onStatus, onGuestConfig, onForfeit, onEmote, onPing, onRematchOffer, onRematchAccept, onRematchDecline }) {
    this.isHost = false;
    this.roomCode = '';
    this.unsubscribe = null;
    this.destroyed = false;
    this.receivedGuestConfig = false;
    this.receivedInit = false;
    this.processedActionIds = new Set();
    this.seed = null;
    this.wager = 0;
    this.hostDeckConfig = null;
    this.guestDeckConfig = null;

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
  }

  async hostRoom(code, seed, wager, hostDeckConfig) {
    this.isHost = true;
    this.seed = seed;
    this.wager = wager || 0;
    this.hostDeckConfig = hostDeckConfig || null;
    this.roomCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    const bridge = getBridge();
    if (!bridge || !bridge.db) return;
    const { db, doc, setDoc, onSnapshot } = bridge;

    try {
      const roomRef = doc(db, 'mp_rooms', this.roomCode);
      await setDoc(roomRef, {
        roomCode: this.roomCode,
        status: 'waiting',
        hostConfig: {
          seed: this.seed,
          wager: this.wager,
          hostDeckConfig: this.hostDeckConfig
        },
        guestJoined: false,
        actions: [],
        signals: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      this.unsubscribe = onSnapshot(roomRef, (snapshot) => {
        if (this.destroyed || !snapshot.exists()) return;
        const data = snapshot.data();
        this._handleRoomUpdate(data);
      }, (err) => {
        console.warn('[Firestore mp_room] Snapshot notice:', err);
      });
    } catch (e) {
      console.warn('[Firestore mp_room] Host room error:', e);
    }
  }

  async joinRoom(code, guestDeckConfig) {
    this.isHost = false;
    this.guestDeckConfig = guestDeckConfig || null;
    this.roomCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    const bridge = getBridge();
    if (!bridge || !bridge.db) return;
    const { db, doc, setDoc, updateDoc, onSnapshot } = bridge;

    try {
      const roomRef = doc(db, 'mp_rooms', this.roomCode);

      // Join room document
      try {
        await updateDoc(roomRef, {
          guestJoined: true,
          guestConfig: this.guestDeckConfig,
          status: 'ready',
          joinedAt: Date.now(),
          updatedAt: Date.now()
        });
      } catch (_) {
        // If doc not ready yet, setDoc merge
        await setDoc(roomRef, {
          roomCode: this.roomCode,
          guestJoined: true,
          guestConfig: this.guestDeckConfig,
          status: 'ready',
          joinedAt: Date.now(),
          updatedAt: Date.now()
        }, { merge: true });
      }

      this.unsubscribe = onSnapshot(roomRef, (snapshot) => {
        if (this.destroyed || !snapshot.exists()) return;
        const data = snapshot.data();
        this._handleRoomUpdate(data);
      }, (err) => {
        console.warn('[Firestore mp_room] Snapshot notice:', err);
      });
    } catch (e) {
      console.warn('[Firestore mp_room] Join room error:', e);
    }
  }

  sendInit(seed, wager, hostDeckConfig, guestDeckConfig) {
    const bridge = getBridge();
    if (!bridge || !bridge.db || !this.roomCode) return;
    const { db, doc, updateDoc } = bridge;

    try {
      const roomRef = doc(db, 'mp_rooms', this.roomCode);
      updateDoc(roomRef, {
        status: 'active',
        actions: [],
        signals: [],
        initData: {
          seed: seed || this.seed,
          wager: wager !== undefined ? wager : this.wager,
          hostDeckConfig: hostDeckConfig || this.hostDeckConfig,
          guestDeckConfig: guestDeckConfig || this.guestDeckConfig
        },
        updatedAt: Date.now()
      }).catch(() => {});
    } catch (e) {}
  }

  submitAction(action) {
    if (!action) return;
    const bridge = getBridge();
    if (!bridge || !bridge.db || !this.roomCode) return;
    const { db, doc, runTransaction } = bridge;

    if (!action.id) {
      action.id = 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    try {
      const roomRef = doc(db, 'mp_rooms', this.roomCode);
      runTransaction(db, async (txn) => {
        const snap = await txn.get(roomRef);
        if (!snap.exists()) return;
        const currentActions = snap.data().actions || [];
        // Keep last 40 actions
        const updated = [...currentActions.slice(-39), action];
        txn.update(roomRef, {
          actions: updated,
          updatedAt: Date.now()
        });
      }).catch(() => {});
    } catch (e) {}
  }

  sendSignal(type, payload = {}) {
    const bridge = getBridge();
    if (!bridge || !bridge.db || !this.roomCode) return;
    const { db, doc, runTransaction } = bridge;

    const signalObj = {
      id: 'sig_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      sender: this.isHost ? 'host' : 'guest',
      type,
      payload,
      timestamp: Date.now()
    };

    try {
      const roomRef = doc(db, 'mp_rooms', this.roomCode);
      runTransaction(db, async (txn) => {
        const snap = await txn.get(roomRef);
        if (!snap.exists()) return;
        const currentSignals = snap.data().signals || [];
        const updated = [...currentSignals.slice(-19), signalObj];
        txn.update(roomRef, {
          signals: updated,
          updatedAt: Date.now()
        });
      }).catch(() => {});
    } catch (e) {}
  }

  _handleRoomUpdate(data) {
    if (!data) return;

    // 1. Guest connection detection
    if (this.isHost && (data.guestJoined || data.guestConfig) && !this.receivedGuestConfig) {
      this.onStatus('connected');
      if (data.guestConfig) {
        this.receivedGuestConfig = true;
        this.onGuestConfig(data.guestConfig);
      }
    }

    // 2. Init detection for Guest (only trigger when match is officially active with initData)
    if (!this.isHost && (data.status === 'active' || data.initData) && !this.receivedInit) {
      const init = data.initData || data.hostConfig;
      if (init && init.seed) {
        this.receivedInit = true;
        this.onInit(init);
      }
    }

    // 3. Actions sync
    if (Array.isArray(data.actions)) {
      data.actions.forEach(action => {
        if (!action || !action.id) return;
        if (this.processedActionIds.has(action.id)) return;
        this.processedActionIds.add(action.id);
        this.onApplied(action);
      });
    }

    // 4. Signals sync (forfeit, emote, rematch)
    if (Array.isArray(data.signals)) {
      const myRole = this.isHost ? 'host' : 'guest';
      data.signals.forEach(sig => {
        if (!sig || !sig.id || sig.sender === myRole) return;
        if (this.processedActionIds.has(sig.id)) return;
        this.processedActionIds.add(sig.id);

        if (sig.type === 'forfeit') this.onForfeit();
        else if (sig.type === 'emote') this.onEmote(sig.payload?.emoji);
        else if (sig.type === 'rematch_offer') this.onRematchOffer();
        else if (sig.type === 'rematch_accept') this.onRematchAccept();
        else if (sig.type === 'rematch_decline') this.onRematchDecline();
      });
    }
  }

  resetForRematch() {
    this.receivedInit = false;
    this.processedActionIds.clear();
  }

  destroy() {
    this.destroyed = true;
    if (this.unsubscribe) {
      try { this.unsubscribe(); } catch (_) {}
      this.unsubscribe = null;
    }
    const bridge = getBridge();
    if (bridge && bridge.db && this.roomCode && this.isHost) {
      try {
        const { db, doc, deleteDoc } = bridge;
        deleteDoc(doc(db, 'mp_rooms', this.roomCode)).catch(() => {});
      } catch (_) {}
    }
  }
}

window.FirebaseMatchmaking = FirebaseMatchmaking;
window.FirebaseRealtimeSession = FirebaseRealtimeSession;
