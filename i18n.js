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
      "predictions": "Mis Pronósticos",
      "results": "Calendario",
      "pool": "El Muro",
      "chat": "Chat",
      "profile": "Mi Perfil",
      "scoring": "Sistema Puntos",
      "config": "Configuración"
    },
    "dashboard": {
      "greeting": "¡Hola",
      "points": "pts",
      "bot_summary_title": "Resumen del Agente",
      "bot_placeholder": "Generando el resumen diario...",
      "leaderboard_title": "Clasificación General",
      "pos": "Pos",
      "player": "Jugador",
      "points_col": "Puntos Totales",
      "exact": "Plenos 🎯",
      "sign": "Signo",
      "diff": "Dif",
      "no_data": "Aún no hay puntuaciones.",
      "points_suffix": "puntos",
      "ai_summary_btn": "Resumen IA",
      "breakdown_title": "Desglose de puntos",
      "history_match": "Partido",
      "history_pts": "Pts",
      "history_reason": "Motivo",
      "generating": "Generando resumen...",
      "groups_label": "Grupos",
      "knockout_label": "Eliminatorias",
      "honor_label": "Cuadro de Honor"
    },
    "common": {
      "error": "Error",
      "success": "Éxito",
      "save": "Guardar",
      "cancel": "Cancelar",
      "group": "Grupo",
      "to_be_defined": "Por definir",
      "new": "Nuevo",
      "back": "Volver",
      "logout": "Cerrar Sesión",
      "logout_confirm": "¿Quieres cerrar sesión?",
      "add": "Añadir",
      "loading": "Cargando...",
      "status": "Estado",
      "save_predictions": "Guardar predicciones",
      "saved": "Guardado",
      "saving": "Guardando...",
      "logged_as": "Sesión iniciada como:",
      "cloud_sync": "Tus predicciones se guardarán en la nube.",
      "back_to_pool": "Volver a la Porra"
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
      "restricted_desc": "Solo los administradores del grupo pueden ver esta sección.",
      "player_name_placeholder": "Nombre del jugador",
      "group_prompt": "Primero introduce tu teléfono...",
      "members_current": "Miembros actuales",
      "transfer": "Traspasar",
      "remove": "Quitar"
    },
    "predictions": {
      "title": "Mi predicción",
      "subtitle": "Introduce tus goles para cada partido",
      "closing_in": "Cierre en:",
      "phase_loading": "Cargando fase...",
      "tournament_status": "Estado del torneo",
      "group": "Grupo",
      "teams": "Selecciones",
      "pts": "Pts",
      "dg": "DG",
      "honor_title": "Cuadro de honor y Premios",
      "champion": "Campeón",
      "runnerup": "Subcampeón",
      "boot_gold": "Bota de Oro",
      "boot_silver": "Bota de Plata",
      "boot_bronze": "Bota de Bronce",
      "ball_gold": "Balón de Oro",
      "ball_silver": "Balón de Plata",
      "ball_bronze": "Balón de Bronce",
      "top_scorer": "Máximo Goleador",
      "best_player": "Mejor Jugador",
      "placeholder_name": "Nombre...",
      "round_r32": "Dieciseisavos de Final",
      "round_r16": "Octavos de Final",
      "round_qf": "Cuartos de Final",
      "round_sf": "Semifinales",
      "round_final": "Gran Final",
      "pool_title": "El Muro de la Porra",
      "pool_subtitle": "Listado completo de predicciones de todos los jugadores",
      "pool_header": "Pool de predicciones",
      "pool_desc": "Selecciona un jugador para ver sus resultados",
      "pool_local": "Tus predicciones (Local)",
      "pool_loading": "Cargando jugadores...",
      "pool_error": "Error al cargar datos de la nube.",
      "match": "Partido",
      "jornada": "Jornada"
    },
    "scoring": {
      "title": "Sistema de Puntuación",
      "subtitle": "Consulta los puntos otorgados por cada acierto",
      "admin_only": "Solo el administrador puede modificar estas reglas.",
      "mode_title": "Modo de Predicción",
      "mode_desc": "Elige cómo se jugará la porra en este grupo",
      "mode_a_title": "Opción A: Torneo Completo (Clásico)",
      "mode_a_desc": "Rellenar todo antes de que empiece el Mundial.",
      "mode_b_title": "Opción B: Por Fases (Dinámico)",
      "mode_b_desc": "Las predicciones se abren ronda a ronda.",
      "group_title": "Fase de Grupos",
      "group_desc": "Puntos otorgados en la fase inicial",
      "label_1x2": "Signo 1X2",
      "desc_1x2": "Acertar ganador o empate",
      "label_diff": "Diferencia de goles",
      "desc_diff": "Con el signo acertado",
      "label_exact": "Resultado exacto",
      "label_pos": "Posición exacta",
      "desc_pos": "1º, 2º, 3º o 4º",
      "label_qualify": "Equipo clasificado",
      "ko_title": "Rondas Eliminatorias",
      "ko_desc": "Desde Dieciseisavos hasta la Final",
      "honor_title": "Cuadro de Honor y Premios",
      "honor_desc": "Aciertos a largo plazo al final",
      "champ": "Campeón del Mundo",
      "runner": "Subcampeón",
      "third": "3º Puesto",
      "award_gold": "Bota/Balón de Oro",
      "award_silver": "Bota/Balón de Plata",
      "award_bronze": "Bota/Balón de Bronce",
      "save_config": "Guardar Configuración",
      "modal_title": "¿Cambiar a Modo por Fases?",
      "modal_text": "Al activar la Opción B, las rondas eliminatorias se ocultarán hasta que se abran.",
      "modal_yes": "Si, adelante",
      "modal_no": "No hacer cambios"
    },
    "rules": {
      "title": "Reglas del Juego",
      "subtitle": "Todo lo que necesitas saber para ganar",
      "section1_title": "¿Cómo jugar?",
      "section2_title": "Notificaciones del Bot",
      "section3_title": "Sistema de Puntuación",
      "section4_title": "Rondas Eliminatorias",
      "section5_title": "Premios Especiales",
      "section6_title": "Restricciones",
      "note": "Nota:",
      "admin_mod": "El administrador puede cambiar estas reglas."
    },
    "profile": {
      "title": "Mi Perfil IA",
      "subtitle": "Personaliza cómo te trata el Agente Mundial",
      "nickname": "Nickname (Cómo te llamará la IA)",
      "nickname_placeholder": "Ej: El Mago de la Porra",
      "phone_note": "Identificador único (no editable)",
      "humor_style": "Estilo de Humor",
      "humor_sarcastic": "Sarcástico y mordaz",
      "humor_friendly": "Divertido y amigable",
      "humor_epic": "Épico y motivador",
      "humor_serious": "Analítico y serio",
      "humor_troll": "Troll total 😈",
      "likes": "Cosas que te gustan",
      "likes_placeholder": "Ej: Goles de chilena, ganar al final...",
      "likes_note": "La IA lo usará para felicitarte.",
      "dislikes": "Cosas que NO te gustan",
      "dislikes_placeholder": "Ej: El VAR, perder tiempo...",
      "dislikes_note": "La IA lo usará para picarte.",
      "security_title": "Seguridad - Cambiar PIN",
      "old_pin": "PIN Actual",
      "new_pin": "Nuevo PIN (4 dígitos)",
      "confirm_pin": "Confirmar PIN",
      "update_pin_btn": "Actualizar PIN",
      "success": "¡Perfil guardado!",
      "pin_success": "PIN actualizado"
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
      "predictions": "My Predictions",
      "results": "Fixtures",
      "pool": "The Wall",
      "chat": "Chat",
      "profile": "My Profile",
      "scoring": "Points System",
      "config": "Settings"
    },
    "dashboard": {
      "greeting": "Hello",
      "points": "pts",
      "bot_summary_title": "Agent Summary",
      "bot_placeholder": "Generating daily summary...",
      "leaderboard_title": "Leaderboard",
      "pos": "Pos",
      "player": "Player",
      "points_col": "Total Points",
      "exact": "Perfect 🎯",
      "sign": "Sign",
      "diff": "Diff",
      "no_data": "No scores yet.",
      "points_suffix": "points",
      "ai_summary_btn": "AI Summary",
      "breakdown_title": "Points Breakdown",
      "history_match": "Match",
      "history_pts": "Pts",
      "history_reason": "Reason",
      "generating": "Generating summary...",
      "groups_label": "Groups",
      "knockout_label": "Knockout",
      "honor_label": "Honor Roll"
    },
    "common": {
      "error": "Error",
      "success": "Success",
      "save": "Save",
      "cancel": "Cancel",
      "group": "Group",
      "to_be_defined": "TBD",
      "new": "New",
      "back": "Back",
      "logout": "Log Out",
      "logout_confirm": "Do you want to log out?",
      "add": "Add",
      "loading": "Loading...",
      "status": "Status",
      "save_predictions": "Save predictions",
      "saved": "Saved",
      "saving": "Saving...",
      "logged_as": "Logged in as:",
      "cloud_sync": "Your predictions will be saved in the cloud.",
      "back_to_pool": "Back to Pool"
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
      "restricted_desc": "Only group administrators can view this section.",
      "player_name_placeholder": "Player name",
      "group_prompt": "Enter your phone first...",
      "members_current": "Current members",
      "transfer": "Transfer",
      "remove": "Remove"
    },
    "predictions": {
      "title": "My Predictions",
      "subtitle": "Enter your score predictions for each match",
      "closing_in": "Closing in:",
      "phase_loading": "Loading phase...",
      "tournament_status": "Tournament status",
      "group": "Group",
      "teams": "Teams",
      "pts": "Pts",
      "dg": "GD",
      "honor_title": "Honor Roll and Awards",
      "champion": "Champion",
      "runnerup": "Runner-up",
      "boot_gold": "Golden Boot",
      "boot_silver": "Silver Boot",
      "boot_bronze": "Bronze Boot",
      "ball_gold": "Golden Ball",
      "ball_silver": "Silver Ball",
      "ball_bronze": "Bronze Ball",
      "top_scorer": "Top Scorer",
      "best_player": "Best Player",
      "placeholder_name": "Name...",
      "round_r32": "Round of 32",
      "round_r16": "Round of 16",
      "round_qf": "Quarter-finals",
      "round_sf": "Semi-finals",
      "round_final": "Grand Final",
      "pool_title": "The Wall",
      "pool_subtitle": "Full list of predictions from all players",
      "pool_header": "Prediction Pool",
      "pool_desc": "Select a player to see their results",
      "pool_local": "Your predictions (Local)",
      "pool_loading": "Loading players...",
      "pool_error": "Error loading cloud data.",
      "match": "Match",
      "jornada": "Matchday"
    },
    "scoring": {
      "title": "Scoring System",
      "subtitle": "Check the points awarded for each prediction",
      "admin_only": "Only the group administrator can modify these rules.",
      "mode_title": "Prediction Mode",
      "mode_desc": "Choose how the pool will be played in this group",
      "mode_a_title": "Option A: Full Tournament (Classic)",
      "mode_a_desc": "Fill in everything before the World Cup starts.",
      "mode_b_title": "Option B: By Phases (Dynamic)",
      "mode_b_desc": "Predictions open round by round.",
      "group_title": "Group Phase",
      "group_desc": "Points awarded in the initial phase",
      "label_1x2": "1X2 Sign",
      "desc_1x2": "Predict winner or draw",
      "label_diff": "Goal Difference",
      "desc_diff": "With the correct sign",
      "label_exact": "Exact Score",
      "label_pos": "Exact Position",
      "desc_pos": "1st, 2nd, 3rd or 4th",
      "label_qualify": "Qualified Team",
      "ko_title": "Knockout Rounds",
      "ko_desc": "From Round of 32 to the Final",
      "honor_title": "Honor Roll and Awards",
      "honor_desc": "Long-term predictions at the end",
      "champ": "World Champion",
      "runner": "Runner-up",
      "third": "3rd Place",
      "award_gold": "Golden Boot/Ball",
      "award_silver": "Silver Boot/Ball",
      "award_bronze": "Bronze Boot/Ball",
      "save_config": "Save Settings",
      "modal_title": "Switch to Dynamic Mode?",
      "modal_text": "By activating Option B, knockout predictions will be hidden until each phase opens.",
      "modal_yes": "Yes, proceed",
      "modal_no": "Cancel"
    },
    "rules": {
      "title": "Game Rules",
      "subtitle": "Everything you need to know to win",
      "section1_title": "How to play?",
      "section2_title": "Bot Notifications",
      "section3_title": "Scoring System",
      "section4_title": "Knockout Rounds",
      "section5_title": "Special Awards",
      "section6_title": "Restrictions",
      "note": "Note:",
      "admin_mod": "The administrator can modify these rules."
    },
    "profile": {
      "title": "My AI Profile",
      "subtitle": "Customize how the World Agent treats you",
      "nickname": "Nickname (How the AI calls you)",
      "nickname_placeholder": "E.g. The Pool Wizard",
      "phone_note": "Unique identifier (not editable)",
      "humor_style": "Humor Style",
      "humor_sarcastic": "Sarcastic and biting",
      "humor_friendly": "Fun and friendly",
      "humor_epic": "Epic and motivating",
      "humor_serious": "Analytical and serious",
      "humor_troll": "Total Troll 😈",
      "likes": "Things you like",
      "likes_placeholder": "E.g. Bicycle kicks, winning last minute...",
      "likes_note": "The AI will use this to congratulate you.",
      "dislikes": "Things you DON'T like",
      "dislikes_placeholder": "E.g. VAR, time wasting...",
      "dislikes_note": "The AI will use this to tease you.",
      "security_title": "Security - Change PIN",
      "old_pin": "Current PIN",
      "new_pin": "New PIN (4 digits)",
      "confirm_pin": "Confirm PIN",
      "update_pin_btn": "Update PIN",
      "success": "Profile saved!",
      "pin_success": "PIN updated"
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
