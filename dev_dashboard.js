// ============================================
// DEV DASHBOARD — JavaScript Logic
// ============================================

const API_BASE = (window.CONFIG?.RENDER_URL || 'http://localhost:3000') + '/dev';
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

// ==========================================
// TABS
// ==========================================

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  const tabs = ['health', 'logs', 'rag', 'usage'];
  const idx = tabs.indexOf(name);
  document.querySelectorAll('.tab')[idx]?.classList.add('active');
  document.getElementById(`panel-${name}`)?.classList.add('active');

  // Lazy load
  if (name === 'logs') loadLogs();
  if (name === 'rag') { loadRagStats(); loadRagMessages(); }
  if (name === 'usage') loadUsage();
}

// ==========================================
// LOAD ALL
// ==========================================

function loadAll() {
  loadHealth();
  setInterval(loadHealth, 30000); // Refresh health every 30s
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
      <span><span class="status-dot ${s.groq.configured ? 'green' : 'red'}"></span><span class="status-label">Groq</span></span>
      <span><span class="status-dot ${s.huggingface.configured ? 'green' : 'amber'}"></span><span class="status-label">HF Embed</span></span>
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

      ${log.ragContext ? `
        <div class="prompt-block">
          <div class="prompt-label">🧠 RAG Context (${log.ragResultCount || 0} mensajes recuperados)</div>
          <div class="prompt-content rag">${escapeHtml(log.ragContext)}</div>
        </div>
      ` : '<div class="prompt-block"><div class="prompt-label">🧠 RAG Context</div><div class="prompt-content rag" style="color:var(--text-muted);font-style:italic">Sin contexto RAG para esta interacción</div></div>'}

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
        <div class="card-label">Uso Diario Groq</div>
        <div class="card-value ${barClass}">${usagePct}%</div>
        <div class="progress-bar"><div class="progress-fill ${barClass}" style="width:${Math.min(usagePct, 100)}%"></div></div>
        <div class="card-sub">${todayCalls} / ${dailyLimit.toLocaleString()} requests</div>
      </div>
    `;

    // Latency card
    const lat = data.latency;
    document.getElementById('usage-breakdown').innerHTML = `
      <div class="card">
        <div class="card-label">Latencia Media</div>
        <div class="card-value cyan">${Math.round(lat.avg || 0)}ms</div>
        <div class="card-sub">min: ${lat.min || 0}ms · max: ${lat.max || 0}ms</div>
      </div>
      ${data.byType.map(t => `
        <div class="card">
          <div class="card-label">${t._id?.toUpperCase() || 'N/A'}</div>
          <div class="card-value amber">${(t.tokens || 0).toLocaleString()} tok</div>
          <div class="card-sub">${t.calls} calls · avg ${Math.round(t.avgLatency || 0)}ms</div>
        </div>
      `).join('')}
    `;

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
// UTILS
// ==========================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
