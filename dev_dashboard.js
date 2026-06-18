// ============================================
// DEV DASHBOARD — JavaScript Logic
// ============================================

const API_BASE = (window.CONFIG?.RENDER_URL || 'http://localhost:3000') + '/api/dev';
let DEV_KEY = '';
let currentLogsPage = 1;
let currentRagPage = 1;
let debounceTimer = null;

// ==========================================
// AUTH
// ==========================================

function authenticate() {
  DEV_KEY = document.getElementById('dev-key-input').value.trim();
  if (!DEV_KEY) return;

  fetch(`${API_BASE}/health`, { headers: { 'x-dev-key': DEV_KEY } })
    .then(r => {
      if (!r.ok) throw new Error('Unauthorized');
      return r.json();
    })
    .then(() => {
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      loadAll();
    })
    .catch(() => {
      const err = document.getElementById('auth-error');
      err.style.display = 'block';
      err.textContent = 'Clave incorrecta o servidor no disponible';
    });
}

document.getElementById('dev-key-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') authenticate();
});

// ==========================================
// API HELPERS
// ==========================================

async function devFetch(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: { 'x-dev-key': DEV_KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function devFetchPost(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dev-key': DEV_KEY },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || `HTTP ${res.status}`); }
  return res.json();
}

async function devFetchPut(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-dev-key': DEV_KEY },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || `HTTP ${res.status}`); }
  return res.json();
}

// ==========================================
// TABS
// ==========================================

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  const tabs = ['health', 'logs', 'evals', 'rag', 'rss', 'websearch', 'groups', 'users', 'feedback', 'prds', 'usage'];
  const idx = tabs.indexOf(name);
  document.querySelectorAll('.tab')[idx]?.classList.add('active');
  document.getElementById(`panel-${name}`)?.classList.add('active');

  // Lazy load
  if (name === 'logs') loadLogs();
  if (name === 'evals') { loadEvalsStats(); loadEvals(); }
  if (name === 'benchmarks') loadBenchmarks();
  if (name === 'reviews') { loadReviewStats(); loadReviewQueue(); }
  if (name === 'rag') { loadRagStats(); loadRagMessages(); }
  if (name === 'groups') loadGroups();
  if (name === 'users') loadUsers();
  if (name === 'rss') loadRssStats();
  if (name === 'websearch') loadWebSearchStats();
  if (name === 'feedback') loadFeedback();
  if (name === 'prds') loadPRDs();
  if (name === 'usage') loadUsage();
}

// ==========================================
// LOAD ALL
// ==========================================

function loadAll() {
  loadHealth();
  setInterval(loadHealth, 30000); // Refresh health every 30s
  // NOTE: No cargamos logs/evals aquí — se cargan lazy al hacer click en la tab
}

// ==========================================
// HEALTH PANEL
// ==========================================

async function loadHealth() {
  try {
    const data = await devFetch('/health');
    const s = data.services;

    // Header status dots
    document.getElementById('header-status').innerHTML = `
      <span><span class="status-dot ${s.mongodb.connected ? 'green' : 'red'}"></span><span class="status-label">MongoDB</span></span>
      <span><span class="status-dot ${s.socketio?.active ? 'green' : 'red'}"></span><span class="status-label">Socket.IO</span></span>
      <span><span class="status-dot ${s.groq.configured ? 'green' : 'red'}"></span><span class="status-label">Groq</span></span>
      <span><span class="status-dot ${s.huggingface.configured ? 'green' : 'amber'}"></span><span class="status-label">HF Embed</span></span>
      <span><span class="status-dot ${s.rss?.enabled ? 'green' : 'red'}"></span><span class="status-label">RSS</span></span>
      <span><span class="status-dot ${s.tavily?.configured ? 'green' : 'red'}"></span><span class="status-label">Tavily</span></span>
    `;

    // Health cards
    document.getElementById('health-cards').innerHTML = `
      <div class="card">
        <div class="card-label">MongoDB</div>
        <div class="card-value ${s.mongodb.connected ? 'green' : 'red'}">${s.mongodb.connected ? 'CONNECTED' : 'DOWN'}</div>
        <div class="card-sub">${s.mongodb.state}</div>
      </div>
      <div class="card">
        <div class="card-label">Groq Model</div>
        <div class="card-value cyan" style="font-size:1rem">${s.groq.model}</div>
        <div class="card-sub">temp: ${s.groq.temperature} · max: ${s.groq.maxTokens}</div>
      </div>
      <div class="card">
        <div class="card-label">HuggingFace</div>
        <div class="card-value ${s.huggingface.configured ? 'green' : 'amber'}">${s.huggingface.configured ? 'ACTIVE' : 'DISABLED'}</div>
        <div class="card-sub">Embeddings para RAG</div>
      </div>
      <div class="card">
        <div class="card-label">Socket.IO Chat</div>
        <div class="card-value ${s.socketio?.active ? 'green' : 'red'}">${s.socketio?.active ? 'ACTIVE' : 'DOWN'}</div>
        <div class="card-sub">${s.socketio?.clients || 0} clientes conectados</div>
      </div>
      <div class="card">
        <div class="card-label">RSS Feeds</div>
        <div class="card-value ${s.rss?.enabled ? 'green' : 'red'}">${s.rss?.enabled ? `${s.rss.feeds} feeds / ${s.rss.pollIntervalMinutes}min` : 'DISABLED'}</div>
        <div class="card-sub"><a href="#" onclick="switchTab('rss'); return false;" style="color:var(--accent-cyan)">Ver detalles →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Tavily Web Search</div>
        <div class="card-value ${s.tavily?.configured ? 'green' : 'red'}">${s.tavily?.configured ? 'CONNECTED' : 'NO KEY'}</div>
        <div class="card-sub"><a href="#" onclick="switchTab('websearch'); return false;" style="color:var(--accent-cyan)">Ver detalles →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Server Uptime</div>
        <div class="card-value green">${s.server.uptimeFormatted}</div>
        <div class="card-sub">RAM: ${s.server.memoryMB.heapUsed}/${s.server.memoryMB.heapTotal} MB · ${s.server.nodeVersion}</div>
      </div>
    `;

    // DB stats
    if (s.mongodb.collections) {
      const c = s.mongodb.collections;
      document.getElementById('db-stats-cards').innerHTML = `
        <div class="card"><div class="card-label">RAG Messages</div><div class="card-value cyan">${c.messages.toLocaleString()}</div></div>
        <div class="card"><div class="card-label">Users</div><div class="card-value purple">${c.users}</div></div>
        <div class="card"><div class="card-label">Groups</div><div class="card-value amber">${c.groups}</div></div>
        <div class="card"><div class="card-label">AI Summaries</div><div class="card-value green">${c.summaries}</div></div>
        <div class="card"><div class="card-label">AI Logs</div><div class="card-value cyan">${c.aiLogs}</div></div>
      `;
    }
  } catch (e) {
    document.getElementById('health-cards').innerHTML = `<div class="card"><div class="card-value red">ERROR</div><div class="card-sub">${e.message}</div></div>`;
  }
}

// ==========================================
// AI LOGS PANEL
// ==========================================

function debounceLoadLogs() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { currentLogsPage = 1; loadLogs(); }, 400);
}

async function loadLogs() {
  const type = document.getElementById('filter-type').value;
  const source = document.getElementById('filter-source').value;
  const player = document.getElementById('filter-player').value;

  let query = `?page=${currentLogsPage}&limit=20`;
  if (type) query += `&type=${type}`;
  if (source) query += `&source=${source}`;
  if (player) query += `&playerName=${encodeURIComponent(player)}`;

  const container = document.getElementById('logs-table-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando logs...</div>';

  try {
    const data = await devFetch(`/logs${query}`);

    if (!data.logs.length) {
      container.innerHTML = '<div class="loading">No hay logs todavía. Genera una interacción con el bot primero.</div>';
      document.getElementById('logs-pagination').innerHTML = '';
      return;
    }

    let html = '<table><thead><tr><th>Timestamp</th><th>Tipo</th><th>Jugador</th><th>Source</th><th>Tokens</th><th>Latencia</th><th>Status</th></tr></thead><tbody>';

    data.logs.forEach(log => {
      const time = new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const typeBadge = `<span class="badge badge-${log.type}">${log.type}</span>`;
      const statusBadge = log.success ? '<span class="badge badge-success">OK</span>' : '<span class="badge badge-error">ERR</span>';

      html += `<tr onclick="openLogDetail('${log._id}')">
        <td>${time}</td>
        <td>${typeBadge}</td>
        <td>${log.playerName}</td>
        <td>${log.source}</td>
        <td>${log.tokensUsed || '-'}</td>
        <td>${log.latencyMs ? log.latencyMs + 'ms' : '-'}</td>
        <td>${statusBadge}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Pagination
    const p = data.pagination;
    document.getElementById('logs-pagination').innerHTML = `
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentLogsPage--; loadLogs()">← Prev</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} total)</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentLogsPage++; loadLogs()">Next →</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function openLogDetail(id) {
  const modal = document.getElementById('log-modal');
  const body = document.getElementById('modal-body');
  modal.classList.add('show');
  body.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando detalle...</div>';

  try {
    const log = await devFetch(`/logs/${id}`);
    const time = new Date(log.createdAt).toLocaleString('es-ES');

    body.innerHTML = `
      <div class="metrics-row" style="margin-bottom:1.5rem">
        <div class="metric-chip"><div class="val">${log.tokensUsed || 0}</div><div class="lbl">Tokens Total</div></div>
        <div class="metric-chip"><div class="val">${log.promptTokens || 0}</div><div class="lbl">Prompt Tokens</div></div>
        <div class="metric-chip"><div class="val">${log.completionTokens || 0}</div><div class="lbl">Completion Tokens</div></div>
        <div class="metric-chip"><div class="val" style="color:${log.latencyMs > 3000 ? 'var(--accent-red)' : 'var(--accent-green)'}">${log.latencyMs}ms</div><div class="lbl">Latencia</div></div>
        <div class="metric-chip"><div class="val" style="font-size:0.8rem">${log.model}</div><div class="lbl">Modelo</div></div>
      </div>

      <div style="margin-bottom:1rem;font-size:0.8rem;color:var(--text-muted)">
        ${time} · <span class="badge badge-${log.type}">${log.type}</span> · ${log.playerName} · ${log.groupName} · ${log.source}
        ${!log.success ? ' · <span class="badge badge-error">ERROR: ' + (log.errorMessage || '') + '</span>' : ''}
      </div>

      ${log.ragQuery ? `
        <div class="prompt-block">
          <div class="prompt-label">🔍 RAG Query</div>
          <div class="prompt-content" style="border-left: 3px solid var(--accent-cyan)">${escapeHtml(log.ragQuery)}</div>
        </div>
      ` : ''}

      <div class="prompt-block">
        <div class="prompt-label">🧠 RAG Context (${log.ragResultCount || 0} mensajes recuperados)</div>
        <div class="prompt-content rag">
          ${log.ragContext ? escapeHtml(log.ragContext) : '<span style="color:var(--text-muted);font-style:italic">Sin contexto recuperado de la base de datos</span>'}
        </div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">🟣 System Prompt</div>
        <div class="prompt-content system">${escapeHtml(log.systemPrompt)}</div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">💬 User Prompt (lo que se envió a Groq)</div>
        <div class="prompt-content user">${escapeHtml(log.userPrompt)}</div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">🤖 Respuesta de Groq</div>
        <div class="prompt-content ai">${escapeHtml(log.groqResponse || 'Sin respuesta (error)')}</div>
      </div>
    `;

    document.getElementById('modal-title').textContent = `${log.type.toUpperCase()} — ${log.playerName}`;
  } catch (e) {
    body.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

function closeModal() {
  document.getElementById('log-modal').classList.remove('show');
}

document.getElementById('log-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ==========================================
// EVALS PANEL
// ==========================================

let currentEvalsPage = 1;

async function loadEvalsStats() {
  try {
    const data = await devFetch('/evals/stats');
    const ov = data.overview;

    const passRateColor = ov.passRate === null ? 'var(--text-muted)'
      : ov.passRate >= 80 ? 'var(--accent-green)'
      : ov.passRate >= 60 ? 'var(--accent-amber)'
      : 'var(--accent-red)';

    document.getElementById('evals-cards').innerHTML = `
      <div class="card">
        <div class="card-label">Pass Rate (${ov.period})</div>
        <div class="card-value" style="color:${passRateColor}">${ov.passRate !== null ? ov.passRate + '%' : 'Sin datos'}</div>
        <div class="card-sub">${ov.passed} passed · ${ov.failed} failed · ${ov.totalEvals} total</div>
      </div>
      <div class="card">
        <div class="card-label">Avg Language Purity</div>
        <div class="card-value ${(ov.avgLangPurity || 0) >= 8 ? 'green' : 'red'}">${(ov.avgLangPurity || 0).toFixed(1)}/10</div>
        <div class="card-sub">Threshold: 8/10 — sin mezcla de idiomas</div>
      </div>
      <div class="card">
        <div class="card-label">Avg Quality</div>
        <div class="card-value ${(ov.avgQuality || 0) >= 6 ? 'cyan' : 'amber'}">${(ov.avgQuality || 0).toFixed(1)}/10</div>
        <div class="card-sub">Threshold: 6/10 — humor y personalidad</div>
      </div>
      <div class="card">
        <div class="card-label">Avg Intentos/Respuesta</div>
        <div class="card-value ${(ov.avgAttempts || 1) <= 1.5 ? 'green' : 'amber'}">${(ov.avgAttempts || 1).toFixed(2)}</div>
        <div class="card-sub">1.0 = aprobado a la primera · >2 = problema</div>
      </div>
    `;

    // Breakdown por idioma
    const langEl = document.getElementById('evals-lang-breakdown');
    if (data.byLanguage?.length) {
      let html = '<table><thead><tr><th>Idioma</th><th>Total</th><th>Pass%</th><th>Lang</th><th>Quality</th></tr></thead><tbody>';
      data.byLanguage.forEach(row => {
        const pct = row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0;
        const color = pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red';
        html += `<tr>
          <td><strong>${row._id || 'N/A'}</strong></td>
          <td>${row.total}</td>
          <td><span class="badge badge-${color}">${pct}%</span></td>
          <td>${(row.avgLangPurity || 0).toFixed(1)}</td>
          <td>${(row.avgQuality || 0).toFixed(1)}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      langEl.innerHTML = html;
    } else {
      langEl.innerHTML = '<div class="loading">Sin datos de idioma todavía</div>';
    }

    // Breakdown por personalidad
    const persEl = document.getElementById('evals-personality-breakdown');
    if (data.byPersonality?.length) {
      let html = '<table><thead><tr><th>Personalidad</th><th>Total</th><th>Pass%</th><th>Lang</th><th>Quality</th></tr></thead><tbody>';
      data.byPersonality.forEach(row => {
        const pct = row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0;
        const color = pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red';
        html += `<tr>
          <td><strong>${row._id || 'N/A'}</strong></td>
          <td>${row.total}</td>
          <td><span class="badge badge-${color}">${pct}%</span></td>
          <td>${(row.avgLangPurity || 0).toFixed(1)}</td>
          <td>${(row.avgQuality || 0).toFixed(1)}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      persEl.innerHTML = html;
    } else {
      persEl.innerHTML = '<div class="loading">Sin datos de personalidad todavía</div>';
    }
  } catch (e) {
    document.getElementById('evals-cards').innerHTML = `<div class="card"><div class="card-value red">Error</div><div class="card-sub">${e.message}</div></div>`;
  }
}

async function loadEvals() {
  const passed = document.getElementById('filter-evals-passed')?.value;
  const lang   = document.getElementById('filter-evals-lang')?.value;

  let query = `?page=${currentEvalsPage}&limit=25`;
  if (passed !== '') query += `&passed=${passed}`;
  if (lang)         query += `&targetLanguage=${lang}`;

  const container = document.getElementById('evals-table-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando evals...</div>';

  try {
    const data = await devFetch(`/evals${query}`);

    if (!data.logs.length) {
      container.innerHTML = '<div class="loading">Sin evaluaciones todavía. Genera interacciones con el bot primero.</div>';
      document.getElementById('evals-pagination').innerHTML = '';
      return;
    }

    let html = `<table><thead><tr>
      <th>Tiempo</th><th>Jugador</th><th>Idioma</th><th>Personalidad</th>
      <th>Lang 🌐</th><th>Quality 🎭</th><th>Status</th><th>Intentos</th><th>Transcreation</th><th>Feedback</th>
    </tr></thead><tbody>`;

    data.logs.forEach(log => {
      const time = new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const statusBadge = log.evalSkipped
        ? '<span class="badge" style="background:rgba(255,255,255,0.1)">SKIP</span>'
        : log.evalPassed
          ? '<span class="badge badge-success">✅ PASS</span>'
          : '<span class="badge badge-error">❌ FAIL</span>';

      const langScore = log.evalScores?.language_purity;
      const qualScore = log.evalScores?.quality;
      const langColor = langScore === undefined ? 'var(--text-muted)' : langScore >= 8 ? 'var(--accent-green)' : langScore >= 5 ? 'var(--accent-amber)' : 'var(--accent-red)';
      const qualColor = qualScore === undefined ? 'var(--text-muted)' : qualScore >= 6 ? 'var(--accent-cyan)' : qualScore >= 4 ? 'var(--accent-amber)' : 'var(--accent-red)';

      const transcreationBadge = log.wasTranscreated
        ? (log.transcreationFallback ? '<span class="badge badge-error" title="Fallback al original">⚠️ FB</span>' : `<span class="badge badge-success">${log.targetLanguage}✓</span>`)
        : '<span style="color:var(--text-muted)">—</span>';

      html += `<tr>
        <td style="white-space:nowrap">${time}</td>
        <td>${log.playerName}</td>
        <td><strong>${log.targetLanguage || '?'}</strong></td>
        <td style="font-size:0.75rem">${log.anchorsUsed || '—'}</td>
        <td style="color:${langColor};font-weight:700">${langScore !== undefined ? langScore + '/10' : '—'}</td>
        <td style="color:${qualColor};font-weight:700">${qualScore !== undefined ? qualScore + '/10' : '—'}</td>
        <td>${statusBadge}</td>
        <td>${log.evalAttempts || 1}</td>
        <td>${transcreationBadge}</td>
        <td style="font-size:0.72rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(log.evalFeedback || '')}">${escapeHtml((log.evalFeedback || '—').substring(0, 60))}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    const p = data.pagination;
    document.getElementById('evals-pagination').innerHTML = `
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentEvalsPage--; loadEvals()">← Prev</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} total)</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentEvalsPage++; loadEvals()">Next →</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

// ==========================================
// RAG EXPLORER
// ==========================================

async function loadRagStats() {
  try {
    const data = await devFetch('/rag/stats');
    const cards = document.getElementById('rag-stats-cards');

    let sendersHtml = data.bySender.slice(0, 5).map(s => `${s._id}: ${s.count}`).join(' · ');

    cards.innerHTML = `
      <div class="card"><div class="card-label">Total Mensajes RAG</div><div class="card-value cyan">${data.totalMessages.toLocaleString()}</div></div>
      <div class="card"><div class="card-label">Usuarios Únicos</div><div class="card-value purple">${data.bySender.length}</div></div>
      <div class="card" style="grid-column: span 2"><div class="card-label">Top Senders</div><div class="card-sub" style="font-family:var(--mono);margin-top:0.5rem">${sendersHtml}</div></div>
    `;
  } catch (e) {
    document.getElementById('rag-stats-cards').innerHTML = '';
  }
}

function debounceLoadRag() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { currentRagPage = 1; loadRagMessages(); }, 400);
}

async function loadRagMessages() {
  const search = document.getElementById('rag-search')?.value || '';
  let query = `?page=${currentRagPage}&limit=20`;
  if (search) query += `&search=${encodeURIComponent(search)}`;

  const container = document.getElementById('rag-messages-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando mensajes...</div>';

  try {
    const data = await devFetch(`/rag/messages${query}`);

    if (!data.messages.length) {
      container.innerHTML = '<div class="loading">No hay mensajes en el RAG.</div>';
      document.getElementById('rag-pagination').innerHTML = '';
      return;
    }

    let html = '';
    data.messages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      html += `<div class="rag-message">
        <span class="rag-sender">${escapeHtml(msg.senderName || msg.senderId)}</span>
        <span class="rag-time">${time}</span>
        <div class="rag-text">${escapeHtml(msg.text)}</div>
      </div>`;
    });

    container.innerHTML = html;

    const p = data.pagination;
    document.getElementById('rag-pagination').innerHTML = `
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentRagPage--; loadRagMessages()">← Prev</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} total)</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentRagPage++; loadRagMessages()">Next →</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

// ==========================================
// GROUPS MANAGEMENT
// ==========================================

async function loadGroups() {
  const container = document.getElementById('groups-table-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando grupos...</div>';

  try {
    const groups = await devFetch('/groups');
    
    if (!groups.length) {
      container.innerHTML = '<div class="loading">No hay grupos creados.</div>';
      return;
    }

    let html = '<table><thead><tr><th>Nombre</th><th>Admin</th><th>Miembros</th><th>Predicciones</th><th>Resúmenes</th><th>Acciones</th></tr></thead><tbody>';
    
    groups.forEach(g => {
      html += `<tr>
        <td><strong>${g.name}</strong></td>
        <td>${g.adminName}</td>
        <td>${g.memberCount}</td>
        <td>${g.predictionCount}</td>
        <td>${g.summaryCount}</td>
        <td>
          <button class="btn-sm" onclick="openGroupDetails('${g.name}')" style="background:var(--accent-blue)">Detalle</button>
          <button class="btn-sm" onclick="deleteGroup('${g.name}')" style="background:var(--accent-red)">Borrar</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

// ==========================================
// USERS MANAGEMENT
// ==========================================

async function loadUsers() {
  const container = document.getElementById('users-table-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando usuarios...</div>';

  try {
    const users = await devFetch('/users');
    
    if (!users.length) {
      container.innerHTML = '<div class="loading">No hay usuarios en la base de datos.</div>';
      return;
    }

    let html = '<table><thead><tr><th>Nombre</th><th>Email</th><th>Nickname</th><th>Grupos</th><th>Admin de</th><th>Predicciones</th><th>Mensajes</th><th>Acciones</th></tr></thead><tbody>';
    
    users.forEach(u => {
      const grupos = (u.groups || []).join(', ') || '<span style="color:var(--text-muted)">ninguno</span>';
      const adminDe = (u.isAdminOf || []).join(', ') || '<span style="color:var(--text-muted)">-</span>';
      const created = new Date(u.createdAt).toLocaleDateString('es-ES');
      html += `<tr>
        <td><strong>${u.name}</strong><br><small style="color:var(--text-muted)">${created}</small></td>
        <td>${u.email || '<span style="color:var(--text-muted)">sin email</span>'}</td>
        <td>${u.nickname || '-'}</td>
        <td style="font-size:0.8rem">${grupos}</td>
        <td style="font-size:0.8rem">${adminDe}</td>
        <td>${u.predictionCount}</td>
        <td>${u.messageCount}</td>
        <td>
          <button class="btn-sm" onclick="deleteUser('${u.name}', '${u._id}')" style="background:var(--accent-red)">🗑️ Borrar</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function deleteUser(userName, userId) {
  const msg = `⚠️ ¿ESTÁS SEGURO? Esto borrará a "${userName}" de la base de datos completa.\n\nConsecuencias:\n• Todas sus predicciones\n• Todos sus mensajes\n• Sus tokens de push\n• Sus bloqueos y reports\n• Será eliminado de todos los grupos\n• Si era admin de algún grupo, ese grupo se quedará sin admin`;

  if (!confirm(msg)) return;
  if (!confirm(`Última confirmación: ¿Borrar permanentemente a "${userName}" y todos sus datos? Esta acción NO se puede deshacer.`)) return;

  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userName)}?userId=${userId}`, {
      method: 'DELETE',
      headers: { 'x-dev-key': DEV_KEY }
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al borrar usuario');
    }
    
    const result = await res.json();
    const d = result.deleted;
    alert(`✅ Usuario "${userName}" eliminado.\n\n• ${d.predictions} predicciones borradas\n• ${d.messages} mensajes borrados\n• ${d.tokens} push tokens eliminados\n• ${d.blocks} bloqueos eliminados\n• ${d.reports} reports eliminados`);
    loadUsers();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function openGroupDetails(name) {
  const modal = document.getElementById('log-modal');
  const body = document.getElementById('modal-body');
  const title = document.getElementById('modal-title');
  
  modal.classList.add('show');
  title.textContent = `Gestión de Grupo: ${name}`;
  body.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando detalles...</div>';

  try {
    const data = await devFetch(`/groups/${encodeURIComponent(name)}/details`);
    const { group, predictions, summaries } = data;

    let html = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
        <div>
          <h4 style="margin-bottom:0.5rem; color:var(--accent-blue)">👥 Miembros (${group.members.length})</h4>
          <div style="max-height:300px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:8px;">
            ${group.members.map(m => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05)">
                <span>${m.name} <small style="color:var(--text-muted)">(${m.email || ''})</small></span>
                <div style="display:flex; gap:5px;">
                  <button class="btn-sm" onclick="setGroupAdmin('${m.name}', '${name}')" title="Hacer Administrador" style="background:rgba(234, 179, 8, 0.2); color:var(--accent-gold); padding:2px 6px">👑</button>
                  <button class="btn-sm" onclick="resetUserPassword('${m.name}', '${name}')" title="Reset Contraseña a PrediccionMundial" style="background:rgba(234, 179, 8, 0.2); color:var(--accent-gold); padding:2px 6px">🔑</button>
                  <button class="btn-sm" onclick="removeMember('${name}', '${m.name}')" title="Quitar del grupo" style="background:rgba(239, 68, 68, 0.2); color:var(--accent-red); padding:2px 6px">Quitar</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div>
          <h4 style="margin-bottom:0.5rem; color:var(--accent-gold)">📊 Predicciones (${predictions.length})</h4>
          <div style="max-height:300px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:8px;">
            ${predictions.map(p => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05)">
                <span>${p.userName}</span>
                <div style="display:flex; gap:4px;">
                  <button class="btn-sm" onclick='viewContent("Predicción: ${p.userName}", ${JSON.stringify(JSON.stringify(p.data))})' style="background:var(--accent-cyan); padding:2px 6px">👁️ Ver</button>
                  <button class="btn-sm" onclick="deletePrediction('${p._id}', '${name}')" style="background:rgba(239, 68, 68, 0.2); color:var(--accent-red); padding:2px 6px">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div style="margin-top:1.5rem;">
        <h4 style="margin-bottom:0.5rem; color:var(--accent-green)">🤖 Resúmenes IA (${summaries.length})</h4>
        <div style="max-height:200px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:8px;">
          ${summaries.map(s => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05)">
              <span>${s.playerName} <small style="color:var(--text-muted)">(${new Date(s.updatedAt).toLocaleDateString()})</small></span>
              <div style="display:flex; gap:4px;">
                <button class="btn-sm" onclick='viewContent("Resumen: ${s.playerName}", ${JSON.stringify(JSON.stringify(s.text))})' style="background:var(--accent-green); padding:2px 6px">👁️ Leer</button>
                <button class="btn-sm" onclick="deleteSummary('${s._id}', '${name}')" style="background:rgba(239, 68, 68, 0.2); color:var(--accent-red); padding:2px 6px">Borrar</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function setGroupAdmin(userName, groupName) {
  if (confirm(`¿Seguro que quieres hacer a ${userName} el NUEVO ADMINISTRADOR de ${groupName}?\n\nEl administrador actual perderá sus privilegios.`)) {
    try {
      const res = await fetch(`${API_BASE}/groups/${encodeURIComponent(groupName)}/admin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-dev-key': DEV_KEY 
        },
        body: JSON.stringify({ newAdminName: userName })
      });
      if (res.ok) {
        alert(`👑 ${userName} es ahora el administrador de ${groupName}`);
        loadGroups(); // Refrescar tabla principal para ver el cambio de admin
        openGroupDetails(groupName); // Refrescar detalle
      } else {
        const err = await res.json();
        throw new Error(err.error);
      }
    } catch (e) { alert(e.message); }
  }
}

async function deleteGroup(name) {
  const cascade = confirm(`⚠️ ¿ESTÁS SEGURO? Estás a punto de borrar el grupo "${name}".\n\n¿Quieres borrar también todas las PREDICCIONES y RESÚMENES asociados? (Acepta para borrar todo, Cancela para borrar solo el grupo)`);
  
  if (confirm(`Última confirmación: ¿Borrar el grupo "${name}"${cascade ? ' y todos sus datos' : ''}?`)) {
    try {
      await fetch(`${API_BASE}/groups/${encodeURIComponent(name)}?cascade=${cascade}`, {
        method: 'DELETE',
        headers: { 'x-dev-key': DEV_KEY }
      });
      loadGroups();
    } catch (e) { alert(e.message); }
  }
}

async function resetUserPassword(userName, groupName) {
  if (confirm(`¿Seguro que quieres resetear la contraseña de ${userName} a "PrediccionMundial"?`)) {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userName)}/reset-password`, {
        method: 'POST',
        headers: { 'x-dev-key': DEV_KEY }
      });
      if (res.ok) {
        alert(`✅ Contraseña de ${userName} reseteada a "PrediccionMundial"`);
        openGroupDetails(groupName);
      } else {
        const err = await res.json();
        throw new Error(err.error);
      }
    } catch (e) { alert(e.message); }
  }
}

async function removeMember(groupName, userName) {
  if (confirm(`¿Quitar a ${userName} del grupo ${groupName}?`)) {
    try {
      await fetch(`${API_BASE}/groups/${encodeURIComponent(groupName)}/members/${encodeURIComponent(userName)}`, {
        method: 'DELETE',
        headers: { 'x-dev-key': DEV_KEY }
      });
      openGroupDetails(groupName);
    } catch (e) { alert(e.message); }
  }
}

async function deletePrediction(id, groupName) {
  if (confirm('¿Borrar esta predicción?')) {
    try {
      await fetch(`${API_BASE}/predictions/${id}`, {
        method: 'DELETE',
        headers: { 'x-dev-key': DEV_KEY }
      });
      openGroupDetails(groupName);
    } catch (e) { alert(e.message); }
  }
}

async function deleteSummary(id, groupName) {
  if (confirm('¿Borrar este resumen?')) {
    try {
      await fetch(`${API_BASE}/summaries/${id}`, {
        method: 'DELETE',
        headers: { 'x-dev-key': DEV_KEY }
      });
      openGroupDetails(groupName);
    } catch (e) { alert(e.message); }
  }
}

// ==========================================
// USAGE PANEL
// ==========================================

async function loadUsage() {
  try {
    const data = await devFetch('/usage');

    // Top cards
    const todayCalls = data.today.calls || 0;
    const dailyLimit = data.limits.dailyRequests;
    const usagePct = Math.round((todayCalls / dailyLimit) * 100);
    const barClass = usagePct > 80 ? 'red' : usagePct > 50 ? 'amber' : 'green';

    document.getElementById('usage-cards').innerHTML = `
      <div class="card">
        <div class="card-label">Tokens Hoy</div>
        <div class="card-value cyan">${(data.today.totalTokens || 0).toLocaleString()}</div>
        <div class="card-sub">${todayCalls} llamadas</div>
      </div>
      <div class="card">
        <div class="card-label">Tokens Semana</div>
        <div class="card-value amber">${(data.week.totalTokens || 0).toLocaleString()}</div>
        <div class="card-sub">${data.week.calls || 0} llamadas</div>
      </div>
      <div class="card">
        <div class="card-label">Tokens Mes</div>
        <div class="card-value purple">${(data.month.totalTokens || 0).toLocaleString()}</div>
        <div class="card-sub">${data.month.calls || 0} llamadas</div>
      </div>
      <div class="card">
        <div class="card-label">Uso Diario Total</div>
        <div class="card-value ${barClass}">${usagePct}%</div>
        <div class="progress-bar"><div class="progress-fill ${barClass}" style="width:${Math.min(usagePct, 100)}%"></div></div>
        <div class="card-sub">${todayCalls} / ${dailyLimit.toLocaleString()} requests</div>
      </div>
    `;

    // Latency card
    const lat = data.latency;
    let breakdownHtml = `
      <div class="card">
        <div class="card-label">Latencia Media</div>
        <div class="card-value cyan">${Math.round(lat.avg || 0)}ms</div>
        <div class="card-sub">min: ${lat.min || 0}ms · max: ${lat.max || 0}ms</div>
      </div>
      ${(data.byType || []).map(t => `
        <div class="card">
          <div class="card-label">${t._id?.toUpperCase() || 'N/A'}</div>
          <div class="card-value amber">${(t.tokens || 0).toLocaleString()} tok</div>
          <div class="card-sub">${t.calls} calls · avg ${Math.round(t.avgLatency || 0)}ms</div>
        </div>
      `).join('')}
    `;

    // Provider breakdown
    if (data.byModel && data.byModel.length) {
      breakdownHtml += data.byModel.map(m => `
        <div class="card">
          <div class="card-label">${m._id || 'Unknown'}</div>
          <div class="card-value cyan">${(m.tokens || 0).toLocaleString()} tok</div>
          <div class="card-sub">${m.calls} calls · avg ${Math.round(m.avgLatency || 0)}ms</div>
        </div>
      `).join('');
    }

    document.getElementById('usage-breakdown').innerHTML = breakdownHtml;

    // Bar chart
    renderBarChart(data.byDay);
  } catch (e) {
    document.getElementById('usage-cards').innerHTML = `<div class="card"><div class="card-value red">Error</div><div class="card-sub">${e.message}</div></div>`;
  }
}

function renderBarChart(byDay) {
  const chart = document.getElementById('tokens-chart');
  if (!byDay || !byDay.length) {
    chart.innerHTML = '<div class="loading">Sin datos de esta semana</div>';
    return;
  }

  const maxTokens = Math.max(...byDay.map(d => d.tokens), 1);

  chart.innerHTML = byDay.map(d => {
    const pct = Math.max((d.tokens / maxTokens) * 100, 2);
    const day = d._id.slice(5); // MM-DD
    return `<div class="bar-col">
      <div class="bar-value">${d.tokens > 1000 ? Math.round(d.tokens / 1000) + 'k' : d.tokens}</div>
      <div class="bar" style="height:${pct}%"></div>
      <div class="bar-label">${day}</div>
    </div>`;
  }).join('');
}

// ==========================================
// RSS STATS
// ==========================================

async function loadRssStats() {
  try {
    const data = await devFetch('/rss-stats');

    // Top cards
    document.getElementById('rss-cards').innerHTML = `
      <div class="card">
        <div class="card-label">Estado</div>
        <div class="card-value ${data.enabled ? 'green' : 'red'}">${data.enabled ? 'ACTIVO' : 'DESHABILITADO'}</div>
        <div class="card-sub">${data.feeds.length} feeds · cada ${data.pollIntervalMinutes} min</div>
      </div>
      <div class="card">
        <div class="card-label">Poll Count</div>
        <div class="card-value cyan">${data.pollCount}</div>
        <div class="card-sub">Último: ${data.lastPollTime ? new Date(data.lastPollTime).toLocaleString('es-ES') : 'nunca'}</div>
      </div>
      <div class="card">
        <div class="card-label">Artículos Parseados</div>
        <div class="card-value amber">${data.articlesParsed}</div>
        <div class="card-sub">${data.worldCupArticles} relacionados con el Mundial · ${data.breakingNews} breaking</div>
      </div>
      <div class="card">
        <div class="card-label">Broadcast</div>
        <div class="card-value purple">${data.broadcastsSent} msgs</div>
        <div class="card-sub">${data.pushNotificationsSent} push · ${data.errors} errores</div>
      </div>
      <div class="card">
        <div class="card-label">Resumen Diario 23:59</div>
        <div class="card-value purple">${data.summariesSent} enviados</div>
        <div class="card-sub">${data.summaryArticles} artículos en total · ${data.dailyArticlesPending} pendientes hoy</div>
      </div>
      <div class="card">
        <div class="card-label">Filtros</div>
        <div class="card-value cyan" style="font-size:0.7rem; line-height:1.3">
          ⚡ Breaking: ${data.breakingFilter}<br>
          📋 Resumen: ${data.summaryFilter}
        </div>
        <div class="card-sub">Resumen: ${data.summaryTime}</div>
      </div>
      <div class="card" style="grid-column: span 2">
        <div class="card-label">Feeds Configurados</div>
        <div class="card-sub" style="font-family:var(--mono); font-size:0.7rem; margin-top:0.5rem">
          ${data.feeds.map((f, i) => `${i + 1}. <a href="${f.trim()}" target="_blank" style="color:var(--accent-cyan)">${escapeHtml(f.trim())}</a>`).join('<br>')}
        </div>
      </div>
    `;

    // Recent breaking news
    const articlesBody = document.getElementById('rss-articles-body');
    if (!data.recentBreaking || data.recentBreaking.length === 0) {
      articlesBody.innerHTML = '<div class="loading">No se han detectado noticias de última hora todavía.</div>';
      return;
    }

    let html = '<table><thead><tr><th>Hora</th><th>Fuente</th><th>Título</th><th>Enlace</th></tr></thead><tbody>';
    data.recentBreaking.forEach(a => {
      const time = new Date(a.time).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      html += `<tr>
        <td style="white-space:nowrap">${time}</td>
        <td style="font-size:0.7rem">${escapeHtml(a.source)}</td>
        <td>${escapeHtml(a.title)}</td>
        <td><a href="${a.link}" target="_blank" style="color:var(--accent-cyan)">🔗</a></td>
      </tr>`;
    });
    html += '</tbody></table>';
    articlesBody.innerHTML = html;
  } catch (e) {
    document.getElementById('rss-cards').innerHTML = `<div class="card"><div class="card-value red">ERROR</div><div class="card-sub">${e.message}</div></div>`;
  }
}

// ==========================================
// WEB SEARCH (TAVILY) STATS
// ==========================================

async function loadWebSearchStats() {
  try {
    const data = await devFetch('/websearch-stats');

    document.getElementById('websearch-cards').innerHTML = `
      <div class="card">
        <div class="card-label">Estado</div>
        <div class="card-value ${data.configured ? 'green' : 'red'}">${data.configured ? 'CONECTADO' : 'SIN API KEY'}</div>
        <div class="card-sub">${data.enabled ? 'Habilitado' : 'Deshabilitado en config'}</div>
      </div>
      <div class="card">
        <div class="card-label">Consultas Realizadas</div>
        <div class="card-value cyan">${data.searchCount}</div>
        <div class="card-sub">${data.totalResults} resultados totales</div>
      </div>
      <div class="card">
        <div class="card-label">Última Consulta</div>
        <div class="card-value amber" style="font-size:0.8rem">${data.lastQuery ? escapeHtml(data.lastQuery.substring(0, 60)) : '—'}</div>
        <div class="card-sub">${data.lastQueryTime ? new Date(data.lastQueryTime).toLocaleString('es-ES') : 'nunca'}</div>
      </div>
      <div class="card">
        <div class="card-label">Errores</div>
        <div class="card-value ${data.errors > 0 ? 'red' : 'green'}">${data.errors}</div>
        <div class="card-sub">maxResults: ${data.maxResults}</div>
      </div>
    `;

    // Recent queries
    const queriesBody = document.getElementById('websearch-queries-body');
    if (!data.recentQueries || data.recentQueries.length === 0) {
      queriesBody.innerHTML = '<div class="loading">No hay consultas registradas todavía.</div>';
      return;
    }

    let html = '<table><thead><tr><th>Hora</th><th>Query</th><th>Resultados</th></tr></thead><tbody>';
    data.recentQueries.forEach(q => {
      const time = new Date(q.time).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      html += `<tr>
        <td style="white-space:nowrap">${time}</td>
        <td style="font-family:var(--mono); font-size:0.8rem">${escapeHtml(q.query)}</td>
        <td>${q.results}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    queriesBody.innerHTML = html;
  } catch (e) {
    document.getElementById('websearch-cards').innerHTML = `<div class="card"><div class="card-value red">ERROR</div><div class="card-sub">${e.message}</div></div>`;
  }
}

// ==========================================
// FEEDBACK PANEL
// ==========================================

let currentFeedbackPage = 1;

async function loadFeedback() {
  const priority = document.getElementById('filter-fb-priority').value;
  const type = document.getElementById('filter-fb-type').value;
  const analyzed = document.getElementById('filter-fb-analyzed').value;

  let query = `?page=${currentFeedbackPage}&limit=30`;
  if (priority) query += `&priority=${priority}`;
  if (type) query += `&type=${type}`;
  if (analyzed) query += `&analyzed=${analyzed}`;

  const container = document.getElementById('feedback-table-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando feedback...</div>';

  try {
    const data = await devFetch(`/feedback${query}`);

    if (!data.feedback.length) {
      container.innerHTML = '<div class="loading">No hay feedback de usuarios todavía.</div>';
      document.getElementById('feedback-pagination').innerHTML = '';
      return;
    }

    let html = '<table><thead><tr><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Prioridad</th><th>Asunto</th><th>Votos</th><th>Acciones</th></tr></thead><tbody>';

    data.feedback.forEach(fb => {
      const time = new Date(fb.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const typeBadge = `<span class="badge badge-${fb.type}">${fb.type}</span>`;
      const priorityBadge = getPriorityBadge(fb.priority);
      const analyzed = fb.analyzedAt ? '✅' : '⏳';

      html += `<tr onclick="openFeedbackDetail('${fb._id}')">
        <td style="white-space:nowrap">${time}</td>
        <td>${escapeHtml(fb.userName)}</td>
        <td>${typeBadge}</td>
        <td>${priorityBadge} ${analyzed}</td>
        <td style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(fb.subject)}</td>
        <td>${fb.voteCount}</td>
        <td>
          <button class="btn-sm" onclick="event.stopPropagation(); analyzeFeedback('${fb._id}')" style="background:var(--accent-cyan)" title="Analizar con LangFlow">🤖</button>
          <button class="btn-sm" onclick="event.stopPropagation(); generatePRD('${fb._id}')" style="background:var(--accent-purple)" title="Generar PRD">📄</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    const p = data.pagination;
    document.getElementById('feedback-pagination').innerHTML = `
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentFeedbackPage--; loadFeedback()">← Prev</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} total)</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentFeedbackPage++; loadFeedback()">Next →</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function openFeedbackDetail(id) {
  const modal = document.getElementById('log-modal');
  const body = document.getElementById('modal-body');
  const title = document.getElementById('modal-title');
  modal.classList.add('show');
  body.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando detalle...</div>';
  title.textContent = '💬 Detalle de Feedback';

  try {
    const fb = await devFetch(`/feedback/${id}`);
    if (!fb || !fb._id) { body.innerHTML = '<div class="loading">Feedback no encontrado</div>'; return; }

    const time = new Date(fb.createdAt).toLocaleString('es-ES');

    body.innerHTML = `
      <div style="margin-bottom:1rem; display:flex; gap:1rem; align-items:center; flex-wrap:wrap">
        <span class="badge badge-${fb.type}">${fb.type}</span>
        ${getPriorityBadge(fb.priority)}
        <span style="color:var(--text-muted);font-size:0.8rem">${fb.userName} · ${time}</span>
        <span style="color:var(--text-muted);font-size:0.8rem">🗳️ ${fb.voteCount} votos</span>
      </div>
      <div style="margin-bottom:1rem">
        <div class="prompt-label">Asunto</div>
        <div style="font-size:1.1rem;font-weight:600;margin-top:0.3rem">${escapeHtml(fb.subject)}</div>
      </div>
      <div style="margin-bottom:1rem">
        <div class="prompt-label">Detalle</div>
        <div class="prompt-content" style="max-height:none;white-space:pre-wrap">${escapeHtml(fb.detail)}</div>
      </div>
      ${fb.analyzedAt ? `
        <div style="margin-bottom:1rem">
          <div class="prompt-label">Análisis (LangFlow) <small style="color:var(--text-muted);font-weight:normal">· ${new Date(fb.analyzedAt).toLocaleString('es-ES')}</small></div>
          <div class="prompt-content system" style="max-height:none;white-space:pre-wrap">${escapeHtml(fb.analysis || 'Sin análisis')}</div>
        </div>
        <div style="margin-bottom:1rem">
          <div class="prompt-label">Razón de prioridad</div>
          <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:0.8rem;font-size:0.85rem">${escapeHtml(fb.priorityReason || '—')}</div>
        </div>
      ` : '<div style="margin-bottom:1rem;color:var(--text-muted);font-style:italic">⏳ Pendiente de análisis por LangFlow</div>'}

      <div style="display:flex;gap:0.5rem;margin-top:1.5rem;flex-wrap:wrap">
        ${!fb.analyzedAt ? `<button class="btn-sm" onclick="analyzeFeedback('${fb._id}')" style="background:var(--accent-cyan)">🤖 Analizar ahora</button>` : ''}
        <button class="btn-sm" onclick="editFeedbackPriority('${fb._id}')" style="background:var(--accent-amber)">✏️ Editar prioridad</button>
        <button class="btn-sm" onclick="generatePRD('${fb._id}')" style="background:var(--accent-purple)">📄 Generar PRD</button>
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function analyzeFeedback(id) {
  try {
    const result = await devFetchPost(`/feedback/${id}/analyze`, {});
    alert(`✅ Feedback analizado\nPrioridad: ${result.feedback.priority}`);
    loadFeedback();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function analyzeAllFeedback() {
  if (!confirm('¿Analizar todo el feedback pendiente con LangFlow? Puede tomar varios segundos.')) return;
  try {
    const result = await devFetchPost('/feedback/analyze-all', {});
    alert(`✅ ${result.analyzed} feedbacks analizados`);
    loadFeedback();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function editFeedbackPriority(id) {
  const newPriority = prompt('Nueva prioridad (P0, P1, P2, P3, P-PENDING):');
  if (!newPriority) return;
  try {
    await devFetchPut(`/feedback/${id}`, { priority: newPriority.toUpperCase() });
    openFeedbackDetail(id);
    loadFeedback();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function generatePRD(feedbackId) {
  try {
    const result = await devFetchPost(`/prds/generate/${feedbackId}`, {});
    alert(`✅ PRD generado: "${result.prd.title}"`);
    switchTab('prds');
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

// ==========================================
// PRDs PANEL
// ==========================================

let currentPRDPage = 1;

async function loadPRDs() {
  const status = document.getElementById('filter-prd-status').value;
  const priority = document.getElementById('filter-prd-priority').value;

  let query = `?page=${currentPRDPage}&limit=30`;
  if (status) query += `&status=${status}`;
  if (priority) query += `&priority=${priority}`;

  const container = document.getElementById('prds-table-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando PRDs...</div>';

  try {
    const data = await devFetch(`/prds${query}`);

    if (!data.prds.length) {
      container.innerHTML = '<div class="loading">No hay PRDs generados todavía. Analiza feedback y genera PRDs desde la pestaña 💬 Feedback.</div>';
      document.getElementById('prds-pagination').innerHTML = '';
      return;
    }

    let html = '<table><thead><tr><th>Fecha</th><th>Título</th><th>Prioridad</th><th>Estado</th><th>Feedback</th><th>Acciones</th></tr></thead><tbody>';

    data.prds.forEach(prd => {
      const time = new Date(prd.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const statusBadge = getStatusBadge(prd.status);
      const fbSubject = prd.feedbackId?.subject || '—';

      html += `<tr onclick="openPRDDetail('${prd._id}')">
        <td style="white-space:nowrap">${time}</td>
        <td style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap"><strong>${escapeHtml(prd.title)}</strong></td>
        <td>${getPriorityBadge(prd.priority)}</td>
        <td>${statusBadge}</td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;font-size:0.75rem">${escapeHtml(fbSubject)}</td>
        <td>
          <button class="btn-sm" onclick="event.stopPropagation(); approvePRD('${prd._id}')" style="background:var(--accent-green)" title="Aprobar">✅</button>
          <button class="btn-sm" onclick="event.stopPropagation(); rejectPRD('${prd._id}')" style="background:var(--accent-red)" title="Rechazar">❌</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    const p = data.pagination;
    document.getElementById('prds-pagination').innerHTML = `
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentPRDPage--; loadPRDs()">← Prev</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} total)</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentPRDPage++; loadPRDs()">Next →</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function openPRDDetail(id) {
  const modal = document.getElementById('log-modal');
  const body = document.getElementById('modal-body');
  const title = document.getElementById('modal-title');
  modal.classList.add('show');
  body.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando detalle...</div>';
  title.textContent = '📄 Detalle de PRD';

  try {
    const prd = await devFetch(`/prds/${id}`);
    if (!prd || !prd._id) { body.innerHTML = '<div class="loading">PRD no encontrado</div>'; return; }

    const time = new Date(prd.createdAt).toLocaleString('es-ES');

    body.innerHTML = `
      <div style="margin-bottom:1rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap">
        ${getStatusBadge(prd.status)}
        ${getPriorityBadge(prd.priority)}
        <span style="color:var(--text-muted);font-size:0.8rem">${time}</span>
      </div>
      <h2 style="margin-bottom:1.5rem;font-size:1.3rem">${escapeHtml(prd.title)}</h2>

      <div class="prompt-block">
        <div class="prompt-label">Problema</div>
        <div class="prompt-content" style="max-height:none;white-space:pre-wrap">${escapeHtml(prd.problemStatement || '—')}</div>
      </div>
      <div class="prompt-block">
        <div class="prompt-label">Solución Propuesta</div>
        <div class="prompt-content system" style="max-height:none;white-space:pre-wrap">${escapeHtml(prd.proposedSolution || '—')}</div>
      </div>
      <div class="prompt-block">
        <div class="prompt-label">Impacto en Usuarios</div>
        <div class="prompt-content" style="max-height:none;white-space:pre-wrap">${escapeHtml(prd.userImpact || '—')}</div>
      </div>
      <div class="prompt-block">
        <div class="prompt-label">Notas Técnicas</div>
        <div class="prompt-content" style="max-height:none;white-space:pre-wrap">${escapeHtml(prd.technicalNotes || '—')}</div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">Criterios de Aceptación</div>
        <div class="prompt-content" style="max-height:none">
          ${prd.acceptanceCriteria?.length ? prd.acceptanceCriteria.map((c, i) => `${i + 1}. ${escapeHtml(c)}`).join('\n') : '—'}
        </div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">Archivos Sugeridos</div>
        <div class="prompt-content" style="max-height:none">
          ${prd.suggestedFiles?.length ? prd.suggestedFiles.map(f => `📄 ${escapeHtml(f)}`).join('\n') : '—'}
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;margin-top:1.5rem;flex-wrap:wrap">
        ${prd.status === 'draft' ? `
          <button class="btn-sm" onclick="updatePRDStatus('${prd._id}','approved')" style="background:var(--accent-green)">✅ Aprobar</button>
          <button class="btn-sm" onclick="updatePRDStatus('${prd._id}','rejected')" style="background:var(--accent-red)">❌ Rechazar</button>
        ` : ''}
        ${prd.status === 'approved' ? `
          <button class="btn-sm" onclick="updatePRDStatus('${prd._id}','implemented')" style="background:var(--accent-blue)">✅ Marcar implementado</button>
          <button class="btn-sm" onclick="updatePRDStatus('${prd._id}','rejected')" style="background:var(--accent-red)">❌ Rechazar</button>
        ` : ''}
        <button class="btn-sm" onclick="editPRDFields('${prd._id}')" style="background:var(--accent-amber)">✏️ Editar</button>
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function updatePRDStatus(id, status) {
  try {
    await devFetchPut(`/prds/${id}`, { status });
    openPRDDetail(id);
    loadPRDs();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function approvePRD(id) {
  if (!confirm('¿Aprobar este PRD para implementación?')) return;
  await updatePRDStatus(id, 'approved');
}

async function rejectPRD(id) {
  if (!confirm('¿Rechazar este PRD?')) return;
  await updatePRDStatus(id, 'rejected');
}

async function editPRDFields(id) {
  // Simple editing via prompt - for full editing we'd need a richer UI
  const field = prompt('Campo a editar (title, problemStatement, proposedSolution, userImpact, technicalNotes):');
  if (!field) return;
  const value = prompt(`Nuevo valor para "${field}":`);
  if (!value) return;

  try {
    await devFetchPut(`/prds/${id}`, { [field]: value });
    openPRDDetail(id);
    loadPRDs();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

// ==========================================
// PRIORITY / STATUS BADGE HELPERS
// ==========================================

function getPriorityBadge(priority) {
  const colors = { 'P0': 'red', 'P1': 'amber', 'P2': 'cyan', 'P3': 'green', 'P-PENDING': 'purple' };
  const color = colors[priority] || 'purple';
  return `<span class="badge badge-priority" style="background:var(--accent-${color}-dim);color:var(--accent-${color})">${priority}</span>`;
}

function getStatusBadge(status) {
  const colors = { 'draft': 'amber', 'approved': 'green', 'rejected': 'red', 'implemented': 'blue' };
  const color = colors[status] || 'purple';
  return `<span class="badge badge-status" style="background:var(--accent-${color}-dim);color:var(--accent-${color})">${status}</span>`;
}

// ==========================================
// UTILS
// ==========================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function viewContent(title, content) {
  // Crear overlay temporal si no existe
  let overlay = document.getElementById('content-viewer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'content-viewer-overlay';
    overlay.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); z-index: 10001;
      display: flex; align-items: center; justify-content: center;
      padding: 2rem; box-sizing: border-box;
    `;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
    document.body.appendChild(overlay);
  }

  // Formatear JSON si parece serlo
  let displayContent = content;
  try {
    const parsed = JSON.parse(content);
    displayContent = JSON.stringify(parsed, null, 2);
  } catch(e) {}

  overlay.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--accent-blue); border-radius: 12px; width: 100%; max-width: 800px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
      <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin:0; color: var(--accent-blue)">${title}</h3>
        <button onclick="document.getElementById('content-viewer-overlay').style.display='none'" style="background:transparent; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
      </div>
      <div style="padding: 1.5rem; overflow-y: auto; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; color: var(--text-primary);">
        ${escapeHtml(displayContent)}
      </div>
      <div style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">
        <button class="btn-sm" onclick="document.getElementById('content-viewer-overlay').style.display='none'" style="background:var(--accent-blue)">Cerrar</button>
      </div>
    </div>
  `;
  overlay.style.display = 'flex';
}

// ==========================================
// BENCHMARKS
// ==========================================

let passRateChart = null;
let scoresChart = null;
let selectedRunId = null;
let selectedRunData = null;
const DATASET_COLORS = {
  intent: { border: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  personality: { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  language: { border: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  transcreation: { border: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  edge: { border: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  summary: { border: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
};
const DATASET_NAMES = { intent: 'Intent', personality: 'Personality', language: 'Language', transcreation: 'Transcreation', edge: 'Edge', summary: 'Summary' };

function renderCards(r) {
  const banner = document.getElementById('regression-banner');
  if (r.comparisonWithPrevious?.regressions?.length) {
    banner.style.display = 'block';
    banner.innerHTML = `⚠️ <strong>${r.comparisonWithPrevious.regressions.length}</strong> regression(s) detected vs previous run. <a href="#" onclick="showComparison('${r._id}', '${r.comparisonWithPrevious.previousRunId}');return false;">Compare</a>`;
  } else {
    banner.style.display = 'none';
  }

  const isSelected = selectedRunId != null;
  document.getElementById('benchmark-cards').innerHTML = `
    ${isSelected ? `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
      <span style="font-size:0.85rem;color:var(--accent-cyan);">📌 Run #${(r.runId || r._id).substring(0, 8)}</span>
      <button onclick="clearSelection()" style="background:var(--accent-cyan);padding:0.3rem 0.7rem;border-radius:6px;font-size:0.75rem;color:white;border:none;cursor:pointer;">🔝 Latest</button>
    </div>` : ''}
    <div class="card-sm"><div class="label">Run ID</div><div class="value">${r.runId || r._id}</div></div>
    <div class="card-sm"><div class="label">Model</div><div class="value">${r.model || 'default'}</div></div>
    <div class="card-sm"><div class="label">Temperature</div><div class="value">${r.temperature}</div></div>
    <div class="card-sm"><div class="label">Pass Rate</div><div class="value">${(r.passRate || 0).toFixed(1)}%</div></div>
    <div class="card-sm"><div class="label">Avg Quality</div><div class="value">${(()=>{const q=r.results?.filter(x=>x.scores?.quality).reduce((s,x)=>s+(x.scores.quality||0),0); const n=r.results?.filter(x=>x.scores?.quality).length; return n ? (q/n).toFixed(2) : '—';})()}</div></div>
    <div class="card-sm"><div class="label">Datasets</div><div class="value">${r.datasets?.join(', ') || 'N/A'}</div></div>
    <div class="card-sm"><div class="label">Date</div><div class="value">${new Date(r.createdAt || r.timestamp).toLocaleString()}</div></div>
  `;
}

async function selectRun(runId) {
  selectedRunId = runId;
  selectedRunData = null;
  try {
    const data = await devFetch(`/evals/runs/${runId}`);
    if (!data || data.error) throw new Error(data?.error || 'Run not found');
    selectedRunData = data;
    renderCards(data);
    renderPassRateChart();
    renderScoresChart();
    loadRunHistory();
  } catch (e) {
    console.error('selectRun error:', e);
    selectedRunId = null;
  }
}

async function clearSelection() {
  selectedRunId = null;
  selectedRunData = null;
  loadBenchmarks();
}

async function loadBenchmarks() {
  selectedRunId = null;
  selectedRunData = null;
  try {
    const data = await devFetch('/evals/runs/latest');
    const r = data.run;
    if (!r) { document.getElementById('benchmark-cards').innerHTML = '<div class="text-muted">No benchmark runs yet.</div>'; return; }

    renderCards(r);
    renderPassRateChart();
    renderScoresChart();
    loadRunHistory();
  } catch (e) {
    document.getElementById('benchmark-cards').innerHTML = `<div class="text-muted">Error loading benchmarks: ${e.message}</div>`;
  }
}

async function renderPassRateChart() {
  try {
    const trends = await devFetch('/evals/trends');
    const runs = trends?.runs || [];
    if (!runs.length) return;

    const labels = runs.map(r => new Date(r.createdAt || r.timestamp).toLocaleDateString());
    const datasetKeys = ['intent', 'personality', 'language', 'transcreation', 'edge', 'summary'];

    const datasets = datasetKeys.map(key => ({
      label: DATASET_NAMES[key],
      data: runs.map(r => {
        const ds = r.perDataset?.[key];
        if (ds && ds.totalTests > 0) {
          return ((ds.passed || 0) / ds.totalTests * 100).toFixed(1);
        }
        return null;
      }),
      borderColor: DATASET_COLORS[key].border,
      backgroundColor: DATASET_COLORS[key].bg,
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: runs.map(r => {
        if (selectedRunId && r.runId === selectedRunId) return '#fff';
        return DATASET_COLORS[key].border;
      }),
      pointBorderColor: runs.map(r => {
        if (selectedRunId && r.runId === selectedRunId) return DATASET_COLORS[key].border;
        return 'transparent';
      }),
      pointBorderWidth: runs.map(r => {
        return selectedRunId && r.runId === selectedRunId ? 2 : 0;
      }),
      spanGaps: false,
    }));

    const ctx = document.getElementById('chart-passrate').getContext('2d');
    if (passRateChart) { passRateChart.destroy(); }

    passRateChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#c0c0c0' } },
          tooltip: {
            callbacks: {
              afterBody: function(items) {
                if (!items.length) return '';
                const idx = items[0].dataIndex;
                const r = runs[idx];
                if (!r) return '';
                return `Run: ${r.runId || '—'}\nModel: ${r.model || 'default'}\nTemp: ${r.temperature}`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#999' } },
          y: { min: 0, max: 100, ticks: { color: '#999', callback: v => v + '%' } }
        }
      }
    });
  } catch (_) {}
}

async function renderScoresChart() {
  try {
    const trends = await devFetch('/evals/trends');
    const runs = trends?.runs || [];
    if (!runs.length) return;

    const labels = runs.map(r => new Date(r.createdAt || r.timestamp).toLocaleDateString());
    const datasetKeys = ['intent', 'personality', 'language', 'transcreation', 'edge', 'summary'];

    const datasets = datasetKeys.map(key => ({
      label: `${DATASET_NAMES[key]} Quality`,
      data: runs.map(r => {
        const ds = r.perDataset?.[key];
        if (ds && ds.avgQuality != null) return ds.avgQuality;
        return null;
      }),
      borderColor: DATASET_COLORS[key].border,
      backgroundColor: DATASET_COLORS[key].bg,
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: runs.map(r => {
        if (selectedRunId && r.runId === selectedRunId) return '#fff';
        return DATASET_COLORS[key].border;
      }),
      pointBorderColor: runs.map(r => {
        if (selectedRunId && r.runId === selectedRunId) return DATASET_COLORS[key].border;
        return 'transparent';
      }),
      pointBorderWidth: runs.map(r => {
        return selectedRunId && r.runId === selectedRunId ? 2 : 0;
      }),
      spanGaps: false,
    }));

    const ctx = document.getElementById('chart-scores').getContext('2d');
    if (scoresChart) { scoresChart.destroy(); }

    scoresChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#c0c0c0' } },
          tooltip: {
            callbacks: {
              afterBody: function(items) {
                if (!items.length) return '';
                const idx = items[0].dataIndex;
                const r = runs[idx];
                if (!r) return '';
                return `Run: ${r.runId || '—'}\nModel: ${r.model || 'default'}\nTemp: ${r.temperature}`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#999' } },
          y: { beginAtZero: true, ticks: { color: '#999' } }
        }
      }
    });
  } catch (_) {}
}

async function loadRunHistory() {
  try {
    const data = await devFetch('/evals/runs?limit=20');
    const runs = data?.runs || [];

    if (!runs.length) {
      document.getElementById('run-history-body').innerHTML = '<div class="text-muted" style="padding:1rem;">No runs yet.</div>';
      return;
    }

    document.getElementById('run-history-body').innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Model</th>
            <th>Temp</th>
            <th>Datasets</th>
            <th>Pass Rate</th>
            <th>Quality</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${runs.map(r => {
            const avgQ = (()=>{const q=r.results?.filter(x=>x.scores?.quality).reduce((s,x)=>s+(x.scores.quality||0),0); const n=r.results?.filter(x=>x.scores?.quality).length; return n ? (q/n).toFixed(2) : '—';})();
            const pct = r.passRate != null ? r.passRate.toFixed(1) + '%' : '—';
            const selected = selectedRunId === r.runId || selectedRunId === String(r._id);
            return `<tr data-id="${r._id}" data-run-id="${r.runId}" onclick="selectRun('${r._id}')" class="${selected ? 'row-selected' : ''}">
              <td><code>${(r.runId || r._id).substring(0, 12)}</code></td>
              <td>${r.model || 'default'}</td>
              <td>${r.temperature}</td>
              <td>${r.datasets?.join(', ') || '—'}</td>
              <td>${pct}</td>
              <td>${avgQ}</td>
              <td>${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
              <td><button class="btn-sm" onclick="event.stopPropagation();showComparison('${r._id}')">Compare</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

  } catch (e) {
    document.getElementById('run-history-body').innerHTML = `<div class="text-muted">Error: ${e.message}</div>`;
  }
}

async function showComparison(runIdA, runIdB) {
  const a = runIdA;
  const b = runIdB || (() => {
    const rows = document.querySelectorAll('#run-history-body tbody tr');
    if (rows.length < 2) return null;
    return rows[1].dataset.id;
  })();

  if (!b) {
    document.getElementById('comparison-view').innerHTML = '<div class="text-muted">Need at least 2 runs to compare.</div>';
    document.getElementById('comparison-view').style.display = 'block';
    return;
  }

  try {
    const data = await devFetch(`/evals/compare/${a}/${b}`);

    const reg = data.comparison?.regressions || [];
    const impr = data.comparison?.improvements || [];
    const same = data.comparison?.unchanged || [];

    document.getElementById('comparison-view').style.display = 'block';
    document.getElementById('comparison-view').innerHTML = `
      <div class="comparison-section">
        ${data.comparison?.temperatureMismatch ? `<div class="alert-warning">⚠️ Temperature mismatch between runs</div>` : ''}
        <h4 style="font-size:0.85rem;margin-bottom:0.75rem;">📊 Run Comparison</h4>
        ${reg.length ? `<div style="margin-bottom:0.75rem;"><strong style="color:#ef4444;">Regressions (${reg.length})</strong><ul>${reg.map(r => `<li>${r.dataset}.${r.testId} — ${r.before > r.after ? `quality dropped ${((r.before - r.after) / r.before * 100).toFixed(0)}%` : `pass: ${r.before}→${r.after}`}</li>`).join('')}</ul></div>` : ''}
        ${impr.length ? `<div style="margin-bottom:0.75rem;"><strong style="color:#22c55e;">Improvements (${impr.length})</strong><ul>${impr.map(r => `<li>${r.dataset}.${r.testId} — quality ${((r.after - r.before) / r.before * 100).toFixed(0)}% better</li>`).join('')}</ul></div>` : ''}
        ${same.length ? `<div><strong style="color:#999;">Unchanged (${same.length})</strong></div>` : ''}
        <button class="btn-sm" onclick="document.getElementById('comparison-view').style.display='none'" style="margin-top:0.75rem;">Close</button>
      </div>
    `;
  } catch (e) {
    document.getElementById('comparison-view').innerHTML = `<div class="text-muted">Error: ${e.message}</div>`;
    document.getElementById('comparison-view').style.display = 'block';
  }
}

async function runBenchmark() {
  const btn = document.getElementById('btn-run-benchmark');
  btn.disabled = true;
  btn.textContent = '⏳ Running...';

  try {
    const model = document.getElementById('benchmark-model').value;
    const dataset = document.getElementById('benchmark-dataset').value;
    const body = {};
    if (model) body.model = model;
    if (dataset && dataset !== 'all') body.dataset = dataset;

    const data = await devFetchPost('/evals/run', body);

    const pollId = data.runId;
    const pollInterval = setInterval(async () => {
      try {
        const pd = await devFetch(`/evals/runs?runId=${pollId}`);
        const run = pd.runs?.[0];
        if (run && run.status === 'completed') {
          clearInterval(pollInterval);
          btn.disabled = false;
          btn.textContent = '▶ Run Benchmark';
          loadBenchmarks();
        }
      } catch (_) {}
    }, 3000);

    setTimeout(() => {
      if (pollInterval) { clearInterval(pollInterval); btn.disabled = false; btn.textContent = '▶ Run Benchmark'; }
    }, 600000);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '▶ Run Benchmark';
    document.getElementById('benchmark-cards').innerHTML = `<div class="text-muted">Error: ${e.message}</div>`;
  }
}

// ==========================================
// HUMAN REVIEW
// ==========================================

async function loadReviewStats() {
  try {
    const stats = await devFetch('/evals/hitl/stats');

    if (!stats) {
      document.getElementById('review-stats-cards').innerHTML = '<div class="text-muted">No review data yet.</div>';
      return;
    }

    const tot = stats.total || 0;
    const rev = stats.reviewed || 0;
    const agree = stats.overallAgreement != null ? (stats.overallAgreement * 100).toFixed(0) + '%' : '—';

    document.getElementById('review-stats-cards').innerHTML = `
      <div class="card-sm"><div class="label">Total Reviews</div><div class="value">${tot}</div></div>
      <div class="card-sm"><div class="label">Reviewed</div><div class="value">${rev}</div></div>
      <div class="card-sm"><div class="label">Agreement Rate</div><div class="value">${agree}</div></div>
      <div class="card-sm"><div class="label">Pending</div><div class="value">${stats.pending || 0}</div></div>
      <div class="card-sm"><div class="label">False Positives</div><div class="value">${stats.falsePositiveRate != null ? (stats.falsePositiveRate * 100).toFixed(0) + '%' : '—'}</div></div>
      <div class="card-sm"><div class="label">False Negatives</div><div class="value">${stats.falseNegativeRate != null ? (stats.falseNegativeRate * 100).toFixed(0) + '%' : '—'}</div></div>
    `;
  } catch (e) {
    document.getElementById('review-stats-cards').innerHTML = `<div class="text-muted">Error: ${e.message}</div>`;
  }
}

async function loadReviewQueue() {
  try {
    const status = document.getElementById('filter-review-status').value;
    const source = document.getElementById('filter-review-source').value;
    const params = new URLSearchParams({ limit: 20 });
    if (status && status !== 'all') params.set('status', status);
    if (source) params.set('source', source);

    const data = await devFetch(`/evals/hitl/pending?${params}`);
    const reviews = data?.reviews || [];

    if (!reviews.length) {
      document.getElementById('review-queue-body').innerHTML = '<div class="text-muted" style="padding:1rem;">No reviews match the current filters.</div>';
      return;
    }

    document.getElementById('review-queue-body').innerHTML = reviews.map(r => `
      <div class="review-card" data-id="${r._id}">
        <div class="review-meta">
          <span class="badge badge-source-${r.source}">${r.source}</span>
          <span class="badge badge-status-${r.status}">${r.status}</span>
          <span class="badge badge-personality">${r.personalityId || '—'}</span>
          <span class="text-muted">${new Date(r.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="review-query"><strong>Query:</strong> ${escapeHtml(r.query || '—')}</div>
        <div class="review-response"><strong>Response:</strong> ${escapeHtml((r.response || '').substring(0, 300))}${(r.response || '').length > 300 ? '...' : ''}</div>
        ${r.judgeScores ? `<div class="review-scores">Judge: ${r.judgePassed ? '✅ Pass' : '❌ Fail'} | Relevance: ${r.judgeScores.relevanceScore?.toFixed(1)} | Accuracy: ${r.judgeScores.accuracyScore?.toFixed(1)} | Language: ${r.judgeScores.languageScore?.toFixed(1)} | Personality: ${r.judgeScores.personalityScore?.toFixed(1)}</div>` : ''}
        ${r.status === 'pending' ? `
          <div class="review-actions">
            <button class="btn-sm btn-pass" onclick="submitReview('${r._id}', true)">✅ Pass</button>
            <button class="btn-sm btn-fail" onclick="submitReview('${r._id}', false)">❌ Fail</button>
            <button class="btn-sm" onclick="showReviewNuance('${r._id}')">⚙️ Nuance</button>
            <button class="btn-sm btn-promote" onclick="promoteToGolden('${r._id}')">💎 Promote</button>
          </div>
        ` : `<div class="review-verdict">Human Verdict: ${r.humanPassed ? '✅ Passed' : '❌ Failed'} (confidence: ${r.humanConfidence || 1}/5)</div>`}
        ${r.promotedToGolden ? `<div class="review-promoted">💎 Promoted to golden dataset</div>` : ''}
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('review-queue-body').innerHTML = `<div class="text-muted">Error: ${e.message}</div>`;
  }
}

async function submitReview(id, passed) {
  try {
    await devFetchPost(`/evals/hitl/${id}/verdict`, { humanPassed: passed, humanConfidence: 3 });
    loadReviewQueue();
    loadReviewStats();
  } catch (e) {
    alert(`Error submitting review: ${e.message}`);
  }
}

function showReviewNuance(id) {
  const html = `
    <div id="nuance-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;">
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;width:400px;max-width:90vw;">
        <h4 style="margin-bottom:1rem;">Nuanced Review</h4>
        <label style="display:block;margin-bottom:0.5rem;">Confidence (1-5):
          <input type="number" id="nuance-confidence" min="1" max="5" value="3" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:0.4rem;margin-top:0.25rem;">
        </label>
        <label style="display:block;margin-bottom:1rem;">Pass?
          <select id="nuance-passed" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:0.4rem;margin-top:0.25rem;">
            <option value="true">Pass</option>
            <option value="false">Fail</option>
          </select>
        </label>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
          <button class="btn-sm" onclick="document.getElementById('nuance-modal').remove()">Cancel</button>
          <button class="btn-sm btn-pass" onclick="submitNuanceVerdict('${id}')">Submit</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function submitNuanceVerdict(id) {
  const passed = document.getElementById('nuance-passed').value === 'true';
  const confidence = parseInt(document.getElementById('nuance-confidence').value) || 3;
  try {
    await devFetchPost(`/evals/hitl/${id}/verdict`, { humanPassed: passed, humanConfidence: confidence });
    document.getElementById('nuance-modal').remove();
    loadReviewQueue();
    loadReviewStats();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function promoteToGolden(id) {
  try {
    await devFetchPost(`/evals/hitl/${id}/promote`, {});
    loadReviewQueue();
  } catch (e) {
    alert(`Error promoting: ${e.message}`);
  }
}

loadHealth();
loadLogs();
