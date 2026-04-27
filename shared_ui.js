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
