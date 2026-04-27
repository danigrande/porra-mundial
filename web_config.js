// ============================================
// CONFIGURACIÓN GLOBAL DE LA WEB
// ============================================

window.CONFIG = {
  // URL de Google Apps Script (Backend)
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx1_NLJukiXGHYzcWv52zjr_F-0g3pfHc1AaP6CyqStT3YUHHSQC5ctdzHx81m4Lsmp/exec',
  
  // URL del bot en Render (Para los resúmenes de IA)
  RENDER_URL: 'https://porra-mundial.onrender.com'
};

// Exponer variables globales explícitamente para los módulos
window.SCRIPT_URL = window.CONFIG.SCRIPT_URL;
window.RENDER_URL = window.CONFIG.RENDER_URL;
