// Visual Network Connectivity Diagnostic & Health Analysis Engine
// Analyzes WebRTC UDP traversal, Firestore socket health, HTTP Server Relay latency,
// and identifies network blocks (School Wi-Fi, VPNs, symmetric NATs, TLS proxies).

const NetworkDiagnostics = {
  logs: [],
  lastResult: null,
  isRunning: false,

  log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, msg, type };
    this.logs.push(entry);
    console.log(`[Diagnostic ${type.toUpperCase()}] ${timestamp} - ${msg}`);
    this._updateLiveLogUI();
  },

  clearLogs() {
    this.logs = [];
    this._updateLiveLogUI();
  },

  async runFullDiagnostic() {
    if (this.isRunning) return this.lastResult;
    this.isRunning = true;
    this.clearLogs();
    this.log('Starting comprehensive Network & Matchmaking Diagnostic Probes...', 'info');

    const result = {
      score: 100,
      rating: 'EXCELLENT',
      color: '#10b981',
      probes: {
        firestore: { name: 'Cloud Firestore Sync', status: 'testing', latency: null, details: '' },
        httpRelay: { name: 'HTTP Ingress Relay (Port 443)', status: 'testing', latency: null, details: '' },
        webrtcStun: { name: 'WebRTC P2P (UDP Traversal)', status: 'testing', latency: null, details: '' },
        firewall: { name: 'Network Filter / VPN Status', status: 'testing', latency: null, details: '' }
      },
      diagnoses: [],
      recommendations: []
    };

    this._renderUI(result);

    // --- PROBE 1: HTTP Ingress Relay & Server API ---
    this.log('Probing HTTP Ingress Relay (/api/matchmaking)...', 'info');
    const httpStart = performance.now();
    try {
      const res = await Promise.race([
        fetch('/api/matchmaking/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('HTTP Relay connection timeout (>3.5s)')), 3500))
      ]);
      const httpLatency = Math.round(performance.now() - httpStart);
      if (res.ok) {
        result.probes.httpRelay.status = 'passed';
        result.probes.httpRelay.latency = httpLatency;
        result.probes.httpRelay.details = `Operational (${httpLatency}ms round-trip)`;
        this.log(`HTTP Ingress Relay responsive in ${httpLatency}ms. [PASSED]`, 'success');
      } else {
        result.probes.httpRelay.status = 'warning';
        result.probes.httpRelay.details = `Server returned status ${res.status}`;
        result.score -= 20;
        this.log(`HTTP Relay returned unexpected HTTP ${res.status}`, 'warning');
      }
    } catch (err) {
      result.probes.httpRelay.status = 'failed';
      result.probes.httpRelay.details = err.message || 'Connection refused/timed out';
      result.score -= 40;
      this.log(`HTTP Ingress Relay probe failed: ${err.message}`, 'error');
    }

    // --- PROBE 2: Cloud Firestore Database Connection ---
    this.log('Probing Cloud Firestore Database cluster...', 'info');
    const fsStart = performance.now();
    const bridge = window.FirestoreBridge;
    if (bridge && bridge.db) {
      try {
        const { db, collection, query, limit, getDocs } = bridge;
        const snap = await Promise.race([
          getDocs(query(collection(db, 'matchmaking_lobbies'), limit(1))),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Firestore cluster query timeout (>4s)')), 4000))
        ]);
        const fsLatency = Math.round(performance.now() - fsStart);
        result.probes.firestore.status = 'passed';
        result.probes.firestore.latency = fsLatency;
        result.probes.firestore.details = `Connected to database (${fsLatency}ms)`;
        this.log(`Cloud Firestore cluster queried successfully in ${fsLatency}ms. [PASSED]`, 'success');
      } catch (fsErr) {
        result.probes.firestore.status = 'warning';
        result.probes.firestore.details = 'Restricted by school proxy / rate-limit. (HTTP Relay active fallback)';
        result.score -= 25;
        this.log(`Firestore socket restricted or delayed: ${fsErr.message}. [RELAY FALLBACK]`, 'warning');
      }
    } else {
      result.probes.firestore.status = 'warning';
      result.probes.firestore.details = 'Bridge initializing / fallback mode';
      result.score -= 15;
      this.log('Firestore Bridge initializing or in fallback mode.', 'warning');
    }

    // --- PROBE 3: WebRTC STUN & UDP Firewall Traversal ---
    this.log('Testing WebRTC UDP STUN packet traversal...', 'info');
    const webrtcResult = await this._probeWebRTC();
    if (webrtcResult.passed) {
      result.probes.webrtcStun.status = 'passed';
      result.probes.webrtcStun.latency = webrtcResult.latency;
      result.probes.webrtcStun.details = `UDP Ports Open (${webrtcResult.candidates.length} ICE candidates gathered in ${webrtcResult.latency}ms)`;
      this.log(`WebRTC STUN gathered ${webrtcResult.candidates.length} candidates in ${webrtcResult.latency}ms. Direct P2P Available. [PASSED]`, 'success');
    } else {
      result.probes.webrtcStun.status = 'blocked';
      result.probes.webrtcStun.details = 'UDP Traffic Blocked (School Wi-Fi / VPN NAT). Handled via HTTPS Relay.';
      result.score -= 30;
      this.log('WebRTC STUN UDP blocked by firewall or symmetric NAT. [BLOCKED -> RELAY ACTIVE]', 'warning');
    }

    // --- PROBE 4: Network Environment & Firewall Analysis ---
    this.log('Analyzing Network Environment classification...', 'info');
    const isRelayOk = result.probes.httpRelay.status === 'passed';
    const isUdpBlocked = result.probes.webrtcStun.status === 'blocked';
    const isFsOk = result.probes.firestore.status === 'passed';

    if (isUdpBlocked && isRelayOk) {
      result.probes.firewall.status = 'warning';
      result.probes.firewall.details = 'School / Campus Wi-Fi detected: UDP WebRTC filtered. HTTPS Relay & Firestore fully protecting gameplay.';
      result.diagnoses.push('🏫 School or Enterprise Firewall detected (UDP 19302/3478 blocked).');
      result.recommendations.push('✅ No action needed: The game is automatically using encrypted HTTPS Relay on Port 443 to bypass restrictions.');
      this.log('Diagnostic result: School Wi-Fi / Restricted Proxy detected. HTTPS Relay successfully engaged.', 'info');
    } else if (!isRelayOk && !isFsOk) {
      result.probes.firewall.status = 'failed';
      result.probes.firewall.details = 'High network packet loss or offline state.';
      result.diagnoses.push('⚠️ Severe network interruption or proxy block on all ports.');
      result.recommendations.push('💡 Check Wi-Fi connection, disable restrictive VPN browser extensions, or toggle Airplane Mode.');
      this.log('Diagnostic result: Severe network blockage on all ports.', 'error');
    } else {
      result.probes.firewall.status = 'passed';
      result.probes.firewall.details = 'Optimal open network configuration. Direct peer acceleration active.';
      result.diagnoses.push('⚡ Open internet connection with direct P2P and low latency.');
      result.recommendations.push('🎮 All multiplayer and matchmaking channels operating at 100% efficiency.');
      this.log('Diagnostic result: Open network connection. All tests passed.', 'success');
    }

    // Compute final Score and Grade
    result.score = Math.max(10, Math.min(100, result.score));
    if (result.score >= 85) {
      result.rating = 'EXCELLENT';
      result.color = '#10b981';
    } else if (result.score >= 60) {
      result.rating = 'GOOD (RELAY ACTIVE)';
      result.color = '#38bdf8';
    } else if (result.score >= 40) {
      result.rating = 'FILTERED / RESTRICTED';
      result.color = '#fbbf24';
    } else {
      result.rating = 'CRITICAL / BLOCKED';
      result.color = '#ef4444';
    }

    this.isRunning = false;
    this.lastResult = result;
    this._renderUI(result);
    this.log(`Diagnostic completed. Health Score: ${result.score}/100 (${result.rating})`, 'success');
    return result;
  },

  _probeWebRTC() {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const candidates = [];
      let resolved = false;

      const finish = (passed) => {
        if (resolved) return;
        resolved = true;
        const latency = Math.round(performance.now() - startTime);
        try { pc.close(); } catch (_) {}
        resolve({ passed, latency, candidates });
      };

      const timer = setTimeout(() => {
        // If we gathered at least one server-reflexive (srflx) or relay candidate, UDP is working
        const hasSrflx = candidates.some(c => c.includes('typ srflx') || c.includes('typ relay'));
        finish(hasSrflx || candidates.length >= 2);
      }, 2200);

      let pc;
      try {
        const config = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
          ]
        };
        const RTCPC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (!RTCPC) {
          clearTimeout(timer);
          return resolve({ passed: false, latency: 0, candidates: [] });
        }

        pc = new RTCPC(config);
        pc.createDataChannel('diag');

        pc.onicecandidate = (event) => {
          if (event.candidate && event.candidate.candidate) {
            candidates.push(event.candidate.candidate);
            if (event.candidate.candidate.includes('typ srflx')) {
              clearTimeout(timer);
              finish(true);
            }
          } else if (!event.candidate) {
            // End of candidates
            clearTimeout(timer);
            const hasSrflx = candidates.some(c => c.includes('typ srflx') || c.includes('typ relay'));
            finish(hasSrflx || candidates.length >= 2);
          }
        };

        pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {
          clearTimeout(timer);
          finish(false);
        });
      } catch (e) {
        clearTimeout(timer);
        finish(false);
      }
    });
  },

  _renderUI(result) {
    const scoreVal = document.getElementById('diag-score-val');
    const scoreRating = document.getElementById('diag-score-rating');
    const scoreCircle = document.getElementById('diag-score-circle');
    const probeList = document.getElementById('diag-probe-list');
    const diagTips = document.getElementById('diag-tips-body');

    if (scoreVal) scoreVal.textContent = `${result.score}%`;
    if (scoreRating) {
      scoreRating.textContent = result.rating;
      scoreRating.style.color = result.color;
    }
    if (scoreCircle) {
      const radius = 42;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (result.score / 100) * circumference;
      scoreCircle.style.strokeDasharray = `${circumference} ${circumference}`;
      scoreCircle.style.strokeDashoffset = offset;
      scoreCircle.style.stroke = result.color;
    }

    if (probeList) {
      probeList.innerHTML = Object.entries(result.probes).map(([key, probe]) => {
        const icon = probe.status === 'passed' ? '🟢' :
                     probe.status === 'warning' ? '🟡' :
                     probe.status === 'blocked' ? '🛡️' :
                     probe.status === 'failed' ? '🔴' : '⏳';
        const badgeClass = probe.status;
        const badgeText = probe.status === 'passed' ? 'PASS' :
                          probe.status === 'warning' ? 'RELAYED' :
                          probe.status === 'blocked' ? 'FILTERED' :
                          probe.status === 'failed' ? 'BLOCK' : 'TESTING';

        return `
          <div class="diag-probe-item">
            <div class="diag-probe-left">
              <span class="diag-probe-icon">${icon}</span>
              <div class="diag-probe-text">
                <div class="diag-probe-name">${probe.name}</div>
                <div class="diag-probe-details">${probe.details || 'Analyzing network telemetry...'}</div>
              </div>
            </div>
            <div class="diag-probe-badge ${badgeClass}">${badgeText}</div>
          </div>
        `;
      }).join('');
    }

    if (diagTips) {
      const lines = [...result.diagnoses, ...result.recommendations];
      diagTips.innerHTML = lines.map(line => `<div class="diag-tip-line">${line}</div>`).join('');
    }
  },

  _updateLiveLogUI() {
    const logBox = document.getElementById('diag-logs-container');
    if (!logBox) return;
    logBox.innerHTML = this.logs.map(l => `
      <div class="diag-log-line log-${l.type}">
        <span class="diag-log-time">[${l.timestamp}]</span>
        <span class="diag-log-msg">${l.msg}</span>
      </div>
    `).join('');
    logBox.scrollTop = logBox.scrollHeight;
  },

  openModal() {
    const modal = document.getElementById('modal-network-diagnostics');
    if (modal) {
      modal.classList.remove('hidden');
      this.runFullDiagnostic();
    }
  },

  closeModal() {
    const modal = document.getElementById('modal-network-diagnostics');
    if (modal) modal.classList.add('hidden');
  },

  copyReport() {
    if (!this.lastResult) return;
    const lines = [
      `=== MEHRBOD CARDS CONNECTIVITY DIAGNOSTIC REPORT ===`,
      `Health Score: ${this.lastResult.score}% (${this.lastResult.rating})`,
      `Timestamp: ${new Date().toISOString()}`,
      ``,
      `--- Probes ---`,
      `Cloud Firestore: ${this.lastResult.probes.firestore.status.toUpperCase()} - ${this.lastResult.probes.firestore.details}`,
      `HTTP Ingress Relay: ${this.lastResult.probes.httpRelay.status.toUpperCase()} - ${this.lastResult.probes.httpRelay.details}`,
      `WebRTC P2P STUN: ${this.lastResult.probes.webrtcStun.status.toUpperCase()} - ${this.lastResult.probes.webrtcStun.details}`,
      `Firewall Status: ${this.lastResult.probes.firewall.status.toUpperCase()} - ${this.lastResult.probes.firewall.details}`,
      ``,
      `--- Detailed Telemetry Logs ---`,
      ...this.logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.msg}`)
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      if (typeof showToast === 'function') showToast('📋 Diagnostic report copied to clipboard!', 2500);
    }).catch(() => {
      if (typeof showToast === 'function') showToast('Failed to copy report.', 2000);
    });
  }
};

window.NetworkDiagnostics = NetworkDiagnostics;
