// ============================================
// SHARED UI — Funciones comunes de la interfaz
// ============================================

export function checkAuth() {
  const raw = localStorage.getItem('worldcup2026_user');
  if (!raw) {
    window.location.href = 'index.html';
    return null;
  }
  try {
    const user = JSON.parse(raw);
    if (!user.phone || !user.groupName) throw new Error();
    
    const navUserInfo = document.getElementById('navUserInfo');
    const displayUserName = document.getElementById('displayUserName');
    if (navUserInfo && displayUserName) {
      navUserInfo.style.display = 'flex';
      displayUserName.textContent = `${user.name} (${user.groupName})`;
    }
    return user;
  } catch (e) {
    localStorage.removeItem('worldcup2026_user');
    window.location.href = 'index.html';
    return null;
  }
}

export function handleLogout() {
  if (confirm('¿Quieres cerrar sesión?')) {
    localStorage.removeItem('worldcup2026_user');
    window.location.href = 'index.html';
  }
}

export function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = isError ? 'toast show error' : 'toast show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * Centralized navigation rendering
 * @param {string} currentPage - The filename of the current page (e.g. 'worldcup.html')
 */
export function renderNavigation(currentPage) {
  const user = checkAuth();
  if (!user) return;

  const navLinks = document.getElementById('navLinks');
  if (!navLinks) return;

  const links = [
    { href: 'player_scores.html', text: 'Clasificación', adminOnly: false },
    { href: 'fixture_testing.html', text: 'Resultados', adminOnly: false },
    { href: 'pool.html', text: 'Predicciones', adminOnly: false },
    { href: 'worldcup.html', text: 'Mi predicción', adminOnly: false },
    { href: 'about_user.html', text: 'Mi Perfil', adminOnly: false },
    { href: 'points_system.html', text: 'Sistema de puntuación', adminOnly: false },
    { href: 'scoring_criteria.html', text: 'Configuración', adminOnly: true }
  ];

  navLinks.innerHTML = links
    .filter(link => !link.adminOnly || user.isAdmin)
    .map(link => `
      <a href="${link.href}" class="nav-link ${currentPage === link.href ? 'active' : ''}">${link.text}</a>
    `).join('');
}

// ==========================================
// ONBOARDING — Wizard para nuevos usuarios
// ==========================================

const ONBOARDING_STEPS = [
  {
    page: 'about_user.html',
    label: 'Mi Perfil',
    icon: '👤',
    hint: '📝 <strong>Personaliza tu perfil</strong> — Elige un nickname, tu equipo favorito y un bio divertida. La IA del bot usará esta info para sus comentarios.',
  },
  {
    page: 'worldcup.html',
    label: 'Mi Predicción',
    icon: '⚽',
    hint: '🎯 <strong>Haz tu primera predicción</strong> — Empieza solo con el <strong>Grupo A</strong> para probar. No te preocupes, podrás completar el resto más tarde.',
  },
  {
    page: 'player_scores.html',
    label: 'Clasificación',
    icon: '🏆',
    hint: '📊 <strong>¡Aquí verás la tabla!</strong> — Tu posición, los puntos de cada jugador, y cómo os va en la porra.',
  },
];

/**
 * Initializes the onboarding wizard on the current page.
 * Call this from any page that participates in the onboarding flow.
 * @param {string} currentPage - filename e.g. 'about_user.html'
 * @returns {boolean} true if onboarding mode is active
 */
export function initOnboarding(currentPage) {
  const step = localStorage.getItem('worldcup2026_onboarding');
  if (!step) return false;

  const stepIndex = parseInt(step) - 1;
  const currentStepDef = ONBOARDING_STEPS[stepIndex];
  if (!currentStepDef || currentStepDef.page !== currentPage) return false;

  // Inject CSS
  injectOnboardingCSS();

  // Activate onboarding mode
  document.body.classList.add('onboarding-mode');

  // Inject progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'onboarding-progress';
  progressBar.innerHTML = `
    <div class="onboarding-header">
      <span class="onboarding-badge">Quick Tour</span>
      <span class="onboarding-step-count">Paso ${stepIndex + 1} de ${ONBOARDING_STEPS.length}</span>
    </div>
    <div class="onboarding-steps">
      ${ONBOARDING_STEPS.map((s, i) => `
        <div class="onboarding-step ${i < stepIndex ? 'completed' : ''} ${i === stepIndex ? 'active' : ''} ${i > stepIndex ? 'upcoming' : ''}">
          <div class="step-dot">${i < stepIndex ? '✓' : s.icon}</div>
          <div class="step-label">${s.label}</div>
        </div>
        ${i < ONBOARDING_STEPS.length - 1 ? '<div class="step-line ' + (i < stepIndex ? 'completed' : '') + '"></div>' : ''}
      `).join('')}
    </div>
  `;
  document.body.insertBefore(progressBar, document.body.firstChild);

  // Inject hint banner (after nav, before header)
  const hint = document.createElement('div');
  hint.className = 'onboarding-hint';
  hint.innerHTML = `<p>${currentStepDef.hint}</p>`;
  const header = document.querySelector('.page-header');
  if (header) header.parentNode.insertBefore(hint, header.nextSibling);
  else document.querySelector('.main-content')?.prepend(hint);

  // Inject bottom action bar
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
  const actionBar = document.createElement('div');
  actionBar.className = 'onboarding-action-bar';
  actionBar.innerHTML = `
    <button class="onb-btn-next" onclick="window._onboardingNext()">
      ${isLastStep ? '🎉 ¡Empezar a jugar!' : '➡️ Siguiente paso'}
    </button>
    <button class="onb-btn-skip" onclick="window._onboardingSkip()">
      ${isLastStep ? '' : 'Saltar tour'}
    </button>
    <span class="onb-reassurance">Podrás volver a esta sección cuando quieras desde el menú</span>
  `;
  document.body.appendChild(actionBar);

  // Wire up actions
  window._onboardingNext = () => {
    if (isLastStep) {
      localStorage.removeItem('worldcup2026_onboarding');
      localStorage.setItem('worldcup2026_onboarding_done', 'true');
      window.location.href = 'player_scores.html';
    } else {
      const nextStep = stepIndex + 2;
      localStorage.setItem('worldcup2026_onboarding', String(nextStep));
      window.location.href = ONBOARDING_STEPS[stepIndex + 1].page;
    }
  };

  window._onboardingSkip = () => {
    localStorage.removeItem('worldcup2026_onboarding');
    localStorage.setItem('worldcup2026_onboarding_done', 'true');
    window.location.href = 'player_scores.html';
  };

  return true;
}

function injectOnboardingCSS() {
  if (document.getElementById('onboarding-css')) return;
  const style = document.createElement('style');
  style.id = 'onboarding-css';
  style.textContent = `
    body.onboarding-mode .main-nav { display: none !important; }

    .onboarding-progress {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%);
      border-bottom: 1px solid rgba(99, 102, 241, 0.15);
      padding: 1.2rem 1.5rem 1rem;
    }
    .onboarding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .onboarding-badge {
      background: linear-gradient(135deg, #6366f1, #10b981);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .onboarding-step-count {
      font-size: 0.8rem;
      color: var(--text-muted, #999);
    }
    .onboarding-steps {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
    }
    .onboarding-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-width: 70px;
    }
    .step-dot {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      transition: all 0.3s;
    }
    .onboarding-step.upcoming .step-dot {
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.15);
      opacity: 0.5;
    }
    .onboarding-step.active .step-dot {
      background: linear-gradient(135deg, #6366f1, #818cf8);
      border: 2px solid #6366f1;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
      animation: pulse-dot 2s infinite;
    }
    .onboarding-step.completed .step-dot {
      background: rgba(16, 185, 129, 0.2);
      border: 2px solid #10b981;
      color: #10b981;
      font-size: 0.9rem;
    }
    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 10px rgba(99, 102, 241, 0.3); }
      50% { box-shadow: 0 0 25px rgba(99, 102, 241, 0.5); }
    }
    .step-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-muted, #999);
      text-align: center;
      white-space: nowrap;
    }
    .onboarding-step.active .step-label {
      color: var(--text-primary, #fff);
    }
    .step-line {
      width: 40px;
      height: 2px;
      background: rgba(255,255,255,0.1);
      margin: 0 4px;
      margin-bottom: 22px;
      border-radius: 2px;
    }
    .step-line.completed {
      background: linear-gradient(90deg, #10b981, #6366f1);
    }

    .onboarding-hint {
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin: 0 auto 1.5rem;
      max-width: 700px;
      text-align: center;
    }
    .onboarding-hint p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-secondary, #ccc);
      line-height: 1.6;
    }

    .onboarding-action-bar {
      position: sticky;
      bottom: 0;
      background: rgba(15, 15, 30, 0.97);
      backdrop-filter: blur(12px);
      border-top: 1px solid var(--border-color, #333);
      padding: 1rem 1.5rem;
      text-align: center;
      z-index: 200;
    }
    .onb-btn-next {
      background: linear-gradient(135deg, #6366f1 0%, #10b981 100%);
      color: #fff;
      border: none;
      padding: 0.85rem 2.5rem;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .onb-btn-next:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.35);
    }
    .onb-btn-skip {
      background: none;
      border: none;
      color: var(--text-muted, #999);
      font-size: 0.8rem;
      cursor: pointer;
      padding: 0.5rem 1rem;
      margin-left: 8px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .onb-btn-skip:hover { color: var(--text-primary, #fff); }
    .onb-reassurance {
      display: block;
      margin-top: 6px;
      font-size: 0.7rem;
      color: var(--text-muted, #666);
    }
  `;
  document.head.appendChild(style);
}
