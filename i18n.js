// Simple i18n system for Vanilla JS

const translations = {
  es: {
    "login": {
      "welcome": "Bienvenido a",
      "title": "Porra Mundial",
      "subtitle": "La forma definitiva de vivir el mundial con tus amigos",
      "phone_label": "Número de Teléfono",
      "phone_placeholder": "600123456",
      "pin_label": "PIN de Acceso (4 dígitos)",
      "pin_placeholder": "Ej: 1234",
      "login_btn": "Entrar a mi Porra",
      "no_account": "¿Aún no tienes cuenta?",
      "create_account": "Crea una aquí.",
      "register_title": "Únete a la Porra",
      "name_label": "Tu Nombre",
      "name_placeholder": "Ej: Dani",
      "group_label": "Código del Grupo",
      "group_placeholder": "Ej: MI_GRUPO_2026",
      "register_btn": "Crear Cuenta",
      "has_account": "¿Ya tienes cuenta?",
      "login_here": "Inicia sesión aquí.",
      "phone_error": "Ingresa un número válido de 9 dígitos.",
      "pin_error": "El PIN debe tener exactamente 4 dígitos.",
      "name_error": "Por favor, ingresa tu nombre.",
      "group_error": "Por favor, ingresa el código de tu grupo.",
      "terms_agree": "Al continuar, aceptas nuestros",
      "terms_link": "Términos y Condiciones",
      "and": "y la",
      "privacy_link": "Política de Privacidad"
    },
    "tabs": {
      "dashboard": "Inicio",
      "predictions": "Pronósticos",
      "results": "Resultados",
      "pool": "El Muro",
      "chat": "Chat"
    },
    "dashboard": {
      "greeting": "¡Hola",
      "points": "pts",
      "bot_summary_title": "Resumen del Agente",
      "bot_placeholder": "Generando el resumen diario...",
      "leaderboard_title": "Clasificación",
      "pos": "Pos",
      "player": "Jugador",
      "points_col": "Puntos",
      "exact": "Exactos",
      "sign": "Signo",
      "diff": "Dif",
      "no_data": "Aún no hay puntuaciones.",
      "points_suffix": "puntos"
    },
    "common": {
      "error": "Error",
      "success": "Éxito",
      "save": "Guardar",
      "cancel": "Cancelar",
      "group": "Grupo",
      "to_be_defined": "Por definir",
      "new": "Nuevo",
      "back": "Volver"
    },
    "admin": {
      "title": "Panel de Control",
      "subtitle_prefix": "Gestión total de",
      "scoring_title": "Reglas de Puntuación",
      "scoring_desc": "Configura cuánto vale cada acierto y el modo de juego.",
      "members_title": "Gestión de Miembros",
      "members_desc": "Añade jugadores, quita miembros o vincula WhatsApp.",
      "reset_title": "Zona de Pruebas: Reset",
      "reset_desc": "Borra todas las predicciones y reinicia el Mundial (Solo para testing).",
      "reset_confirm_title": "Resetear Grupo",
      "reset_confirm_msg": "¿Estás seguro? Se borrarán TODAS las predicciones y se reiniciará el torneo para este grupo. Esta acción no se puede deshacer.",
      "reset_yes": "Sí, Resetear",
      "reset_success": "El grupo ha sido reseteado correctamente.",
      "reset_error": "No se pudo resetear el grupo.",
      "restricted": "Acceso Restringido",
      "restricted_desc": "Solo los administradores del grupo pueden ver esta sección."
    }
  },
  en: {
    "login": {
      "welcome": "Welcome to",
      "title": "World Cup Pool",
      "subtitle": "The ultimate way to experience the World Cup with your friends",
      "phone_label": "Phone Number",
      "phone_placeholder": "600123456",
      "pin_label": "Access PIN (4 digits)",
      "pin_placeholder": "E.g. 1234",
      "login_btn": "Enter my Pool",
      "no_account": "Don't have an account yet?",
      "create_account": "Create one here.",
      "register_title": "Join the Pool",
      "name_label": "Your Name",
      "name_placeholder": "E.g. Dani",
      "group_label": "Group Code",
      "group_placeholder": "E.g. MY_GROUP_2026",
      "register_btn": "Create Account",
      "has_account": "Already have an account?",
      "login_here": "Log in here.",
      "phone_error": "Please enter a valid 9-digit number.",
      "pin_error": "The PIN must be exactly 4 digits.",
      "name_error": "Please enter your name.",
      "group_error": "Please enter your group code.",
      "terms_agree": "By continuing, you agree to our",
      "terms_link": "Terms and Conditions",
      "and": "and the",
      "privacy_link": "Privacy Policy"
    },
    "tabs": {
      "dashboard": "Home",
      "predictions": "Predictions",
      "results": "Results",
      "pool": "The Wall",
      "chat": "Chat"
    },
    "dashboard": {
      "greeting": "Hello",
      "points": "pts",
      "bot_summary_title": "Agent Summary",
      "bot_placeholder": "Generating daily summary...",
      "leaderboard_title": "Leaderboard",
      "pos": "Pos",
      "player": "Player",
      "points_col": "Points",
      "exact": "Exact",
      "sign": "Sign",
      "diff": "Diff",
      "no_data": "No scores yet.",
      "points_suffix": "points"
    },
    "common": {
      "error": "Error",
      "success": "Success",
      "save": "Save",
      "cancel": "Cancel",
      "group": "Group",
      "to_be_defined": "TBD",
      "new": "New",
      "back": "Back"
    },
    "admin": {
      "title": "Control Panel",
      "subtitle_prefix": "Full management of",
      "scoring_title": "Scoring Rules",
      "scoring_desc": "Configure how much each correct pick is worth and the game mode.",
      "members_title": "Member Management",
      "members_desc": "Add players, remove members or link WhatsApp.",
      "reset_title": "Test Zone: Reset",
      "reset_desc": "Delete all predictions and restart the World Cup (Testing only).",
      "reset_confirm_title": "Reset Group",
      "reset_confirm_msg": "Are you sure? ALL predictions will be deleted and the tournament will be reset for this group. This action cannot be undone.",
      "reset_yes": "Yes, Reset",
      "reset_success": "The group has been reset successfully.",
      "reset_error": "Could not reset the group.",
      "restricted": "Restricted Access",
      "restricted_desc": "Only group administrators can view this section."
    }
  }
};

window.i18n = {
  locale: localStorage.getItem('language') || 'es',

  t: function(key, params = {}) {
    const keys = key.split('.');
    let value = translations[this.locale];
    
    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        // Fallback to Spanish
        let fallbackValue = translations['es'];
        for (const fk of keys) {
          if (fallbackValue && fallbackValue[fk]) {
            fallbackValue = fallbackValue[fk];
          } else {
            return key; // Key not found
          }
        }
        value = fallbackValue;
        break;
      }
    }

    if (typeof value === 'string') {
      return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] || '');
    }
    return key;
  },

  changeLanguage: function(lang) {
    if (['en', 'es'].includes(lang)) {
      this.locale = lang;
      localStorage.setItem('language', lang);
      this.updateDOM();
    }
  },

  updateDOM: function() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', this.t(key));
      }
    });
    
    // Dispatch an event so custom scripts know the language changed
    document.dispatchEvent(new Event('languageChanged'));
  },

  init: function() {
    this.updateDOM();
  }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => {
  window.i18n.init();
});
