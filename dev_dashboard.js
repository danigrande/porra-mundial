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

// ==========================================
// TABS
// ==========================================

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  const tabs = ['health', 'logs', 'rag', 'rss', 'websearch', 'groups', 'users', 'usage'];
  const idx = tabs.indexOf(name);
  document.querySelectorAll('.tab')[idx]?.classList.add('active');
  document.getElementById(`panel-${name}`)?.classList.add('active');

  // Lazy load
  if (name === 'logs') loadLogs();
  if (name === 'rag') { loadRagStats(); loadRagMessages(); }
  if (name === 'groups') loadGroups();
  if (name === 'users') loadUsers();
  if (name === 'rss') loadRssStats();
  if (name === 'websearch') loadWebSearchStats();
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

loadHealth();
loadLogs();
