// Firebase Firestore Matchmaking Client
// Matchmaking discovery uses Firebase Firestore ONLY to pair two players.
// Once paired, the battle itself is 100% Peer-to-Peer (WebRTC via PeerJS),
// consuming 0 server/database resources during live gameplay.

const FIREBASE_CONFIG = {
  projectId: "modular-current-wthv3",
  appId: "1:223543184692:web:a72ddd20a87a01b06a6961",
  apiKey: "AIzaSyAMdOl4wq0LOez1RaRJBKhtH3KafSAc_a0",
  authDomain: "modular-current-wthv3.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-mehrbodcards-2486d43b-39c5-4f6d-97c2-d362e9b3583a",
  storageBucket: "modular-current-wthv3.firebasestorage.app",
  messagingSenderId: "223543184692"
};

let _firestoreDb = null;
let _firebaseInitAttempted = false;

function getFirestoreDb() {
  if (_firestoreDb) return _firestoreDb;
  if (typeof firebase === 'undefined') return null;
  
  if (!firebase.apps || !firebase.apps.length) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
    } catch (e) {
      console.warn('[Firebase] Init app error:', e);
    }
  }

  try {
    // Attempt named database if supported, or default instance
    if (FIREBASE_CONFIG.firestoreDatabaseId && typeof firebase.app().firestore === 'function') {
      try {
        _firestoreDb = firebase.app().firestore(FIREBASE_CONFIG.firestoreDatabaseId);
      } catch (e1) {
        _firestoreDb = firebase.firestore();
      }
    } else if (typeof firebase.firestore === 'function') {
      _firestoreDb = firebase.firestore();
    }
  } catch (e) {
    console.warn('[Firebase] Firestore init failed:', e);
  }
  return _firestoreDb;
}

const LOBBY_STALE_MS = 45000; // 45 seconds timeout for stale lobbies

const FirebaseMatchmaking = {
  isAvailable() {
    return typeof firebase !== 'undefined' && Boolean(getFirestoreDb());
  },

  async testConnection() {
    const db = getFirestoreDb();
    if (!db) return false;
    try {
      // Light read to confirm connectivity
      const snap = await db.collection('matchmaking_lobbies').limit(1).get();
      return true;
    } catch (err) {
      console.warn('[Firebase] testConnection failed:', err);
      return false;
    }
  },

  // Search for an active, unclaimed waiting lobby created recently
  async findAndClaimLobby() {
    const db = getFirestoreDb();
    if (!db) throw new Error("Firebase Firestore is not initialized");

    const cutoffTime = Date.now() - LOBBY_STALE_MS;
    
    // Query recent waiting lobbies
    const snapshot = await db.collection('matchmaking_lobbies')
      .where('status', '==', 'waiting')
      .get();

    if (snapshot.empty) {
      return null;
    }

    // Filter by timestamp client-side as well to guarantee fresh lobby
    const freshDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data && data.createdAt && data.createdAt >= cutoffTime && data.status === 'waiting';
    });

    if (freshDocs.length === 0) {
      return null;
    }

    // Try claiming the oldest waiting lobby atomically
    for (const docSnapshot of freshDocs) {
      const docRef = docSnapshot.ref;
      try {
        const matchedData = await db.runTransaction(async (transaction) => {
          const freshDoc = await transaction.get(docRef);
          if (!freshDoc.exists) return null;
          
          const data = freshDoc.data();
          if (data.status !== 'waiting' || (data.createdAt && data.createdAt < cutoffTime)) {
            return null; // Already claimed or expired
          }

          transaction.update(docRef, {
            status: 'matched',
            guestJoined: true,
            matchedAt: Date.now()
          });

          return data;
        });

        if (matchedData && matchedData.roomCode) {
          console.log('[Firebase Matchmaking] Successfully claimed lobby:', matchedData.roomCode);
          return {
            roomCode: matchedData.roomCode,
            hostPeerId: matchedData.hostPeerId || ('cardbattler-' + matchedData.roomCode)
          };
        }
      } catch (transErr) {
        console.warn('[Firebase Matchmaking] Claim transaction contention, trying next:', transErr);
      }
    }

    return null;
  },

  // Host registers a new lobby in Firestore
  async registerLobby(roomCode) {
    const db = getFirestoreDb();
    if (!db) throw new Error("Firebase Firestore is not initialized");

    const cleanCode = roomCode.toUpperCase().replace(/[^A-Za-z0-9]/g, '');
    const docRef = db.collection('matchmaking_lobbies').doc(cleanCode);

    await docRef.set({
      roomCode: cleanCode,
      hostPeerId: 'cardbattler-' + cleanCode,
      status: 'waiting',
      createdAt: Date.now(),
      guestJoined: false
    });

    console.log('[Firebase Matchmaking] Lobby registered in Firestore:', cleanCode);

    // Housekeeping: clean up old stale lobbies in background
    this.cleanStaleLobbies().catch(() => {});

    return {
      docRef,
      unsubscribe: null
    };
  },

  // Cancel / deregister a lobby
  async cancelLobby(roomCode) {
    const db = getFirestoreDb();
    if (!db || !roomCode) return;

    try {
      const cleanCode = roomCode.toUpperCase().replace(/[^A-Za-z0-9]/g, '');
      await db.collection('matchmaking_lobbies').doc(cleanCode).delete();
      console.log('[Firebase Matchmaking] Lobby removed from Firestore:', cleanCode);
    } catch (e) {
      console.warn('[Firebase Matchmaking] Error deleting lobby:', e);
    }
  },

  // Clean lobbies older than 2 minutes to keep Firestore tidy
  async cleanStaleLobbies() {
    const db = getFirestoreDb();
    if (!db) return;

    try {
      const staleCutoff = Date.now() - 120000;
      const snapshot = await db.collection('matchmaking_lobbies').get();
      const batch = db.batch();
      let deleteCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && data.createdAt < staleCutoff) {
          batch.delete(doc.ref);
          deleteCount++;
        }
      });

      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[Firebase Matchmaking] Purged ${deleteCount} stale lobbies.`);
      }
    } catch (e) {
      // Non-critical background task
    }
  }
};

window.FirebaseMatchmaking = FirebaseMatchmaking;
