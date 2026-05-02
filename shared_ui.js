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
    if (!user.name || !user.groupName) throw new Error();
    
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
    { href: 'scoring_criteria.html', text: 'Configuración', adminOnly: true }
  ];

  navLinks.innerHTML = links
    .filter(link => !link.adminOnly || user.isAdmin)
    .map(link => `
      <a href="${link.href}" class="nav-link ${currentPage === link.href ? 'active' : ''}">${link.text}</a>
    `).join('');
}
