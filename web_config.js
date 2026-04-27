// ============================================
// CONFIGURACIÓN GLOBAL DE LA WEB
// ============================================

window.CONFIG = {
  // URL de Google Apps Script (Legacy/Backup)
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx1_NLJukiXGHYzcWv52zjr_F-0g3pfHc1AaP6CyqStT3YUHHSQC5ctdzHx81m4Lsmp/exec',
  
  // URL del bot/API
  RENDER_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://porra-mundial.onrender.com'
};

// Exponer variables globales explícitamente para los módulos
window.SCRIPT_URL = window.CONFIG.SCRIPT_URL;
window.RENDER_URL = window.CONFIG.RENDER_URL;
console.log('🌐 API URL configurada en:', window.RENDER_URL);
