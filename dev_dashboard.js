// ============================================
// DEV DASHBOARD — JavaScript Logic
// ============================================

const API_BASE = (window.CONFIG?.RENDER_URL || 'http://localhost:3000') + '/api/dev';
let DEV_KEY = '';
let currentLogsPage = 1;
let currentRagPage = 1;
let debounceTimer = null;

// ==========================================
// I18N
// ==========================================

let currentLang = 'es';
let activeTab = 'health';

const LANG = {
  es: {
    'page.title': '🛠️ Agente Mundial — DevOps Panel',
    'header.title': '🛠️ Agente Mundial',

    'auth.title': '🛠️ Panel de DevOps',
    'auth.subtitle': 'Agente Mundial — Panel de Desarrollador',
    'auth.key_placeholder': 'Clave de Desarrollador...',
    'auth.login': 'Acceder',
    'auth.error': 'Clave incorrecta',
    'auth.unauthorized': 'Clave incorrecta o servidor no disponible',

    'header.status.ok': '🟢 OK',
    'header.status.degraded': '🟡 Degradado',
    'header.status.error': '🔴 Error',

    'loading': 'Cargando...',
    'loading.data': 'Cargando datos...',

    'health.title': 'Health',
    'health.services': 'Servicios',
    'health.db': 'Base de Datos',
    'health.connected': 'Conectado',
    'health.disconnected': 'Desconectado',
    'health.players': 'Jugadores',
    'health.groups': 'Grupos',
    'health.messages': 'Mensajes',
    'health.predictions': 'Pronósticos',
    'health.summaries': 'Resúmenes',
    'health.error': 'Error cargando health',

    'logs.title': '📋 Interacciones con IA',
    'logs.filter_type': 'Todos los tipos',
    'logs.type_response': 'Response',
    'logs.type_summary': 'Summary',
    'logs.type_personality': 'Personality',
    'logs.filter_source': 'Todas las fuentes',
    'logs.source_chat': 'App Chat',
    'logs.source_web': 'Web Panel',
    'logs.source_cron': 'Automático (Cron)',
    'logs.source_manual': 'Manual',
    'logs.source_eval_runner': 'Eval Runner',
    'logs.filter_player': 'Jugador...',
    'logs.loading': 'Cargando logs...',
    'logs.empty': 'No hay logs todavía. Genera una interacción con el bot primero.',
    'logs.prev': '← Prev',
    'logs.next': 'Next →',
    'logs.total': 'total',

    'evals.title': '⚖️ Log de Evaluaciones Recientes',
    'evals.lang_title': '🌐 Rendimiento por Idioma',
    'evals.personality_title': '🎭 Rendimiento por Personalidad',
    'evals.filter_all': 'Todas (Pass + Fail)',
    'evals.filter_passed': '✅ Passed',
    'evals.filter_failed': '❌ Failed',
    'evals.filter_all_langs': 'Todos los idiomas',
    'evals.lang_es': 'Español',
    'evals.lang_en': 'Inglés',
    'evals.lang_ko': 'Coreano (Transcreation)',
    'evals.lang_ar': 'Árabe (Transcreation)',
    'evals.lang_th': 'Tailandés (Transcreation)',
    'evals.lang_ja': 'Japonés (Transcreation)',
    'evals.no_data_lang': 'Sin datos de idioma todavía',
    'evals.no_data_personality': 'Sin datos de personalidad todavía',
    'evals.loading': 'Cargando evals...',
    'evals.empty': 'Sin evaluaciones todavía. Genera interacciones con el bot primero.',
    'evals.col_time': 'Tiempo',
    'evals.col_player': 'Jugador',
    'evals.col_lang': 'Idioma',
    'evals.col_personality': 'Personalidad',
    'evals.col_lang_score': 'Lang 🌐',
    'evals.col_quality': 'Quality 🎭',
    'evals.col_status': 'Status',
    'evals.col_attempts': 'Intentos',
    'evals.col_transcreation': 'Transcreation',
    'evals.col_feedback': 'Feedback',
    'evals.pass': '✅ PASS',
    'evals.fail': '❌ FAIL',
    'evals.skip': 'SKIP',
    'evals.detail_title': '⚖️ Eval Detail',
    'evals.detail_score_lang': '🌐 Language Purity',
    'evals.detail_score_quality': '🎭 Quality',
    'evals.detail_attempts': 'intento(s)',
    'evals.detail_force_approved': '⚠️ force_approved',
    'evals.detail_query': '💬 Query',
    'evals.detail_response': '🤖 Response',
    'evals.detail_feedback': '⚖️ Judge Feedback',
    'evals.detail_technical': '🔧 Technical details',
    'evals.detail_tokens': 'Tokens',
    'evals.detail_latency': 'Latencia',
    'evals.detail_source': 'Fuente',
    'evals.detail_type': 'Tipo',
    'evals.detail_success': 'Éxito',
    'evals.detail_transcreation_source': 'Transcreation Source',
    'evals.detail_system_prompt': '🧠 System Prompt',
    'evals.detail_rag': '🔍 RAG Context',

    'benchmarks.title': 'Benchmarks',
    'benchmarks.run': '▶ Run Benchmark',
    'benchmarks.refresh': '🔄',
    'benchmarks.all_datasets': 'All datasets',
    'benchmarks.dataset_intent': 'Intent Classification',
    'benchmarks.dataset_personality': 'Personality Responses',
    'benchmarks.dataset_language': 'Language Purity',
    'benchmarks.dataset_transcreation': 'Transcreation',
    'benchmarks.dataset_edge': 'Edge Cases',
    'benchmarks.dataset_summary': 'Daily Summaries',
    'benchmarks.default_model': 'Default model',
    'benchmarks.loading': 'Loading runs...',
    'benchmarks.chart_passrate': 'Pass Rate Over Time',
    'benchmarks.chart_scores': 'Avg Quality & Language Purity',
    'benchmarks.hover': 'Hover for details · Click legend to toggle datasets',

    'reviews.title': '👁️ Human Review',
    'reviews.status_pending': 'Pending',
    'reviews.status_reviewed': 'Reviewed',
    'reviews.status_all': 'All',
    'reviews.source_all': 'All sources',
    'reviews.source_user_downvote': 'User Downvote',
    'reviews.source_judge_disagree': 'Judge Disagree',
    'reviews.source_force_approved': 'Force Approved',
    'reviews.source_manual': 'Manual',
    'reviews.loading': 'Loading review queue...',

    'rag.title': '🧠 Mensajes almacenados en RAG',
    'rag.stats_title': 'Total Mensajes RAG',
    'rag.search': 'Buscar por nombre o texto...',
    'rag.search_btn': 'Buscar',
    'rag.loading': 'Cargando mensajes...',

    'rss.title': '📰 Artículos Recientes Detectados',
    'rss.refresh': '🔄 Refrescar',
    'rss.loading': 'Cargando actividad RSS...',
    'rss.no_breaking': 'No se han detectado noticias de última hora todavía.',

    'websearch.title': '🔍 Últimas Consultas Web',
    'websearch.refresh': '🔄 Refrescar',
    'websearch.loading': 'Cargando consultas...',
    'websearch.no_queries': 'No hay consultas registradas todavía.',

    'groups.title': '👥 Gestión de Grupos',
    'groups.refresh': '🔄 Refrescar',
    'groups.loading': 'Cargando grupos...',
    'groups.detail_title': 'Gestión de Grupo',

    'users.title': '👤 Gestión de Usuarios',
    'users.refresh': '🔄 Refrescar',
    'users.loading': 'Cargando usuarios...',

    'feedback.title': '💬 Feedback de Usuarios',
    'feedback.p0': 'P0 - Crítico',
    'feedback.p1': 'P1 - Alta',
    'feedback.p2': 'P2 - Media',
    'feedback.p3': 'P3 - Baja',
    'feedback.ppending': 'P-PENDING - Sin analizar',
    'feedback.filter_all_priorities': 'Todas las prioridades',
    'feedback.filter_all_types': 'Todos los tipos',
    'feedback.type_bug': 'Bug',
    'feedback.type_feature': 'Feature',
    'feedback.type_improvement': 'Improvement',
    'feedback.type_other': 'Other',
    'feedback.all': 'Todos',
    'feedback.unanalyzed': 'Sin analizar',
    'feedback.analyzed': 'Analizados',
    'feedback.analyze_all': '🤖 Analizar todo (IA)',
    'feedback.loading': 'Cargando feedback...',
    'feedback.refresh': 'Refrescar',
    'feedback.detail_title': '💬 Detalle de Feedback',

    'prds.title': '📄 PRDs Generados',
    'prds.filter_all': 'Todos los estados',
    'prds.status_draft': 'Draft',
    'prds.status_approved': 'Approved',
    'prds.status_rejected': 'Rejected',
    'prds.status_implemented': 'Implemented',
    'prds.filter_all_priorities': 'Todas las prioridades',
    'prds.loading': 'Cargando PRDs...',
    'prds.detail_title': '📄 Detalle de PRD',

    'usage.title': 'Usage',
    'usage.tokens_chart': '📈 Tokens por día (últimos 7 días)',
    'usage.no_data_week': 'Sin datos de esta semana',

    'corrections.title': '✏️ Correcciones Conversacionales',
    'corrections.filter_all': 'Todos',
    'corrections.status_pending': 'Pending',
    'corrections.status_approved': 'Approved',
    'corrections.status_rejected': 'Rejected',
    'corrections.status_promoted': 'Promoted',
    'corrections.loading': 'Cargando correcciones...',

    'retention.title': 'Retention',
    'retention.active_users': 'Active Users (last 15d)',
    'retention.retention_rate': 'Retention Rate',
    'retention.bot_calls': 'Total Bot Calls (30d)',
    'retention.period': 'Period',
    'retention.group_title': '👥 Comparativa por Grupo',
    'retention.chart_title': '📈 Active Users & Bot Calls (30 días)',
    'retention.loading': 'Cargando...',
    'retention.no_data': 'No hay datos de grupos',
    'retention.no_trend': 'No hay datos de tendencia todavía',
    'retention.refresh': '🔄',

    'rag.empty': 'No hay mensajes en el RAG.',
    'groups.empty': 'No hay grupos creados.',
    'users.empty': 'No hay usuarios en la base de datos.',
    'feedback.empty': 'No hay feedback de usuarios todavía.',
    'prds.empty': 'No hay PRDs generados todavía.',
    'corrections.empty': 'No hay correcciones todavía.',

    'diag.issue_humor': '😐 Humor',
    'diag.issue_language': '🌐 Idioma',
    'diag.issue_personality': '🎭 Personalidad',
    'diag.issue_factuality': '📊 Veracidad',
    'diag.issue_none': '✅ Sin issue',
    'diag.issue_uncategorized': '❓ Sin categoría',
    'diag.type_force_approved': '⚠️ Force Approved',
    'diag.type_judge_calibration': '⚖️ Calibración del Juez',
    'diag.impact': 'impacto',
    'diag.personalities': 'personalidades',
    'diag.llm_analysis_error': 'en análisis LLM',

    'modal.detail_title': 'Detalle de Interacción',
    'modal.tokens_total': 'Tokens Total',
    'modal.prompt_tokens': 'Tokens de Prompt',
    'modal.completion_tokens': 'Tokens de Completion',
    'modal.latency': 'Latencia',
    'modal.model': 'Modelo',
    'modal.rag_query': '🔍 RAG Query',
    'modal.rag_context': '🧠 RAG Context ({n} mensajes recuperados)',
    'modal.rag_context_empty': 'Sin contexto recuperado de la base de datos',
    'modal.system_prompt': '🟣 System Prompt',
    'modal.user_prompt': '💬 User Prompt (lo que se envió a Groq)',
    'modal.groq_response': '🤖 Respuesta de Groq',
    'modal.no_response': 'Sin respuesta (error)',

    'diag.title': '🔬 Diagnostics',
    'diag.analyze': '🔍 Analizar',
    'diag.llm_recommend': '🔮 Recomendaciones con IA',
    'diag.period': 'Período',
    'diag.1day': '1 día',
    'diag.7days': '7 días',
    'diag.14days': '14 días',
    'diag.30days': '30 días',
    'diag.all_personalities': 'Todas las personalidades',
    'diag.analyzing': '⏳ Analizando...',
    'diag.generating': '⏳ Generando...',
    'diag.health_pass': 'pass',
    'diag.health_no_data': 'Sin datos',
    'diag.health_evaluations': 'evaluaciones',
    'diag.health_days': 'días',
    'diag.avg_quality': 'Calidad media',
    'diag.avg_attempts': 'Intentos promedio',
    'diag.hitl': 'HITL',
    'diag.breakdown_title': '📊 Fallos por Categoría',
    'diag.personality_title': '🎭 Diagnóstico por Personalidad',
    'diag.global_recs_title': '💡 Recomendaciones Globales',
    'diag.llm_results_title': '🔮 Análisis con IA',
    'diag.no_issue_data': 'Sin datos de issue — las evaluaciones existentes no tienen evalMainIssue (visible desde ahora en adelante).',
    'diag.no_personality_data': 'Sin datos de personalidad.',
    'diag.no_recs': 'Sin recomendaciones — métricas dentro de lo esperado.',
    'diag.no_global_recs': 'Sin recomendaciones globales.',
    'diag.no_llm_results': 'El análisis no devolvió recomendaciones estructuradas. Revisa que los datos de diagnóstico tengan suficiente volumen.',
    'diag.error': 'Error',

    'help.title': '⚖️ Evals System — Complete Guide',
    'help.subtitle': 'How the AI evaluates itself, when humans step in, and how to run & interpret benchmarks.',
    'help.section1_title': '1. Quality Gate Pipeline',
    'help.section1_text': 'Every response the AI generates passes through the <strong>Quality Gate</strong> — a loop that generates, judges, and retries if the quality is below threshold. This prevents bad responses from reaching users.',
    'help.section2_title': '2. LLM-as-a-Judge',
    'help.section2_text': 'The judge is a separate LLM call (default: <code>llama-3.1-8b-instant</code> at temperature 0.1) that evaluates responses on two axes. It receives the system prompt, humor anchors, and expected language, then returns a JSON verdict.',
    'help.section3_title': '3. Rule-based Fast-path',
    'help.section3_text': 'Before calling the LLM judge, a <strong>regex-based script detector</strong> scans the response. If it finds characters from a non-expected script (e.g. Korean hangul in a Spanish response), the response is automatically failed with <code>language_purity = 0</code> — no LLM call needed.',
    'help.section4_title': '4. Transcreation (Cultural Adaptation)',
    'help.section4_text': 'For non-Latin scripts, the generator first produces a response in the source language (Spanish or English), then <strong>transcreationService.js</strong> adapts it culturally to the target language.',
    'help.section5_title': '5. Benchmarks',
    'help.section5_text': 'A benchmark runs the entire <strong>golden dataset</strong> through the Quality Gate and records pass rates, scores, and regressions.',
    'help.section6_title': '6. Human-in-the-Loop (HITL)',
    'help.section6_text': 'The HITL system captures responses that need human review. A human can verify the judge\'s decision, correct it, and optionally promote good examples to the golden dataset.',
    'help.section7_title': '7. Golden Dataset (13 test queries)',
    'help.section7_text': 'The golden dataset is the canonical set of test cases used by benchmarks. Each entry specifies the input, expected personality, language, and whether transcreation is needed.',
    'help.legend_title': '📖 How to read the Evals table',
    'help.legend_status': 'Status badges',
    'help.legend_pass': '✅ PASS — both thresholds met',
    'help.legend_fail': '❌ FAIL — one or both below threshold',
    'help.legend_skip': 'SKIP — skipped by sample rate',
    'help.legend_scores': 'Score colors',
    'help.legend_green': '🟢 ≥ threshold (good)',
    'help.legend_amber': '🟡 4-7 (needs improvement)',
    'help.legend_red': '🔴 < 4 (critical)',
    'help.legend_badges': 'Transcreation badges',
    'help.legend_tc_check': '✅ ko — transcreated to Korean',
    'help.legend_tc_fallback': '⚠️ FB — transcreation failed, using fallback',
    'help.legend_tc_none': '— no transcreation needed',
    'help.pass_thresholds': 'PASS THRESHOLDS',
    'help.max_retries': 'MAX RETRIES',
    'help.sample_rate': 'SAMPLE RATE',
    'help.transcreation_fallback': 'If transcreation fails after 2 retries, the original Spanish/English response is used as fallback (marked with ⚠️ FB in the evals table).',
    'help.dataset_files': '📁 Dataset files',
    'help.regression': 'The <strong>regression detection</strong> automatically compares the latest run against the previous one. If pass rate drops by 5% or more, a <span style="color:var(--accent-red);">🔴 regression banner</span> appears.',
    'help.hitl_source': 'Source',
    'help.hitl_when': 'When it triggers',
    'help.hitl_priority': 'Priority',
    'help.hitl_force_desc': 'Quality Gate exhausted 3 retries',
    'help.hitl_downvote_desc': 'User gave a rating of 1-2 ⭐ in the chat',
    'help.hitl_disagree_desc': 'Human disagrees with the judge\'s verdict',
    'help.hitl_highest': 'Highest',
    'help.hitl_high': 'High',
    'help.hitl_normal': 'Normal',
    'help.hitl_footer': 'In the <strong>👁️ Human Review</strong> tab you can see pending reviews, submit verdicts (pass/fail with confidence level), and <strong>promote</strong> good responses to the golden dataset.',
    'help.eval_axis': 'Axis',
    'help.eval_range': 'Range',
    'help.eval_threshold': 'Threshold',
    'help.eval_measures': 'What it measures',
    'help.eval_lang_desc': 'Correct language? No mixed scripts? Grammar & register appropriate?',
    'help.eval_quality_desc': 'Humor mechanism used? Fits personality tone? Avoids being robotic/cringe?',
    'help.eval_json_label': '// Judge JSON output format',
    'help.rule_script': 'Detected Script',
    'help.rule_range': 'Unicode Range',
    'help.rule_language': 'Language',
    'help.rule_script_hangul': 'Hangul',
    'help.rule_lang_hangul': 'Korean',
    'help.rule_script_thai': 'Thai',
    'help.rule_lang_thai': 'Thai',
    'help.rule_script_arabic': 'Arabic',
    'help.rule_lang_arabic': 'Arabic, Persian, Urdu',
    'help.rule_script_cjk': 'CJK',
    'help.rule_lang_cjk': 'Chinese, Japanese',
    'help.rule_script_cyrillic': 'Cyrillic',
    'help.rule_lang_cyrillic': 'Russian, Bulgarian, etc.',
    'help.rule_script_devanagari': 'Devanagari',
    'help.rule_lang_devanagari': 'Hindi, Sanskrit, etc.',
    'help.hitl_force_src': 'force_approved',
    'help.hitl_downvote_src': 'user_downvote',
    'help.hitl_disagree_src': 'judge_disagree',
    'help.ds_num': '#',
    'help.ds_id': 'ID',
    'help.ds_personality': 'Personality',
    'help.ds_lang': 'Lang',
    'help.ds_input': 'Input',
    'help.ds_mechanism': 'Expected Mechanism',
    'help.ds_edge': 'Edge?',
    'help.ds_transcreation': 'Transcreation?',
  },
  en: {
    'page.title': '🛠️ World Agent — DevOps Panel',
    'header.title': '🛠️ World Agent',

    'auth.title': '🛠️ DevOps Panel',
    'auth.subtitle': 'Agente Mundial — Developer Dashboard',
    'auth.key_placeholder': 'Developer Key...',
    'auth.login': 'Login',
    'auth.error': 'Wrong key',
        'auth.unauthorized': 'Wrong key or server unavailable',

    'header.status.ok': '🟢 OK',
    'header.status.degraded': '🟡 Degraded',
    'header.status.error': '🔴 Error',

    'loading': 'Loading...',
    'loading.data': 'Loading data...',

    'health.title': 'Health',
    'health.services': 'Services',
    'health.db': 'Database',
    'health.connected': 'Connected',
    'health.disconnected': 'Disconnected',
    'health.players': 'Players',
    'health.groups': 'Groups',
    'health.messages': 'Messages',
    'health.predictions': 'Predictions',
    'health.summaries': 'Summaries',
    'health.error': 'Error loading health',

    'logs.title': '📋 AI Interactions',
    'logs.filter_type': 'All types',
    'logs.type_response': 'Response',
    'logs.type_summary': 'Summary',
    'logs.type_personality': 'Personality',
    'logs.filter_source': 'All sources',
    'logs.source_chat': 'App Chat',
    'logs.source_web': 'Web Panel',
    'logs.source_cron': 'Automatic (Cron)',
    'logs.source_manual': 'Manual',
    'logs.source_eval_runner': 'Eval Runner',
    'logs.filter_player': 'Player...',
    'logs.loading': 'Loading logs...',
    'logs.empty': 'No logs yet. Generate a bot interaction first.',
    'logs.prev': '← Prev',
    'logs.next': 'Next →',
    'logs.total': 'total',

    'evals.title': '⚖️ Recent Evaluations',
    'evals.lang_title': '🌐 Performance by Language',
    'evals.personality_title': '🎭 Performance by Personality',
    'evals.filter_all': 'All (Pass + Fail)',
    'evals.filter_passed': '✅ Passed',
    'evals.filter_failed': '❌ Failed',
    'evals.filter_all_langs': 'All languages',
    'evals.lang_es': 'Spanish',
    'evals.lang_en': 'English',
    'evals.lang_ko': 'Korean (Transcreation)',
    'evals.lang_ar': 'Arabic (Transcreation)',
    'evals.lang_th': 'Thai (Transcreation)',
    'evals.lang_ja': 'Japanese (Transcreation)',
    'evals.no_data_lang': 'No language data yet',
    'evals.no_data_personality': 'No personality data yet',
    'evals.loading': 'Loading evals...',
    'evals.empty': 'No evaluations yet. Generate bot interactions first.',
    'evals.col_time': 'Time',
    'evals.col_player': 'Player',
    'evals.col_lang': 'Language',
    'evals.col_personality': 'Personality',
    'evals.col_lang_score': 'Lang 🌐',
    'evals.col_quality': 'Quality 🎭',
    'evals.col_status': 'Status',
    'evals.col_attempts': 'Attempts',
    'evals.col_transcreation': 'Transcreation',
    'evals.col_feedback': 'Feedback',
    'evals.pass': '✅ PASS',
    'evals.fail': '❌ FAIL',
    'evals.skip': 'SKIP',
    'evals.detail_title': '⚖️ Eval Detail',
    'evals.detail_score_lang': '🌐 Language Purity',
    'evals.detail_score_quality': '🎭 Quality',
    'evals.detail_attempts': 'attempt(s)',
    'evals.detail_force_approved': '⚠️ force_approved',
    'evals.detail_query': '💬 Query',
    'evals.detail_response': '🤖 Response',
    'evals.detail_feedback': '⚖️ Judge Feedback',
    'evals.detail_technical': '🔧 Technical details',
    'evals.detail_tokens': 'Tokens',
    'evals.detail_latency': 'Latency',
    'evals.detail_source': 'Source',
    'evals.detail_type': 'Type',
    'evals.detail_success': 'Success',
    'evals.detail_transcreation_source': 'Transcreation Source',
    'evals.detail_system_prompt': '🧠 System Prompt',
    'evals.detail_rag': '🔍 RAG Context',

    'benchmarks.title': 'Benchmarks',
    'benchmarks.run': '▶ Run Benchmark',
    'benchmarks.refresh': '🔄',
    'benchmarks.all_datasets': 'All datasets',
    'benchmarks.dataset_intent': 'Intent Classification',
    'benchmarks.dataset_personality': 'Personality Responses',
    'benchmarks.dataset_language': 'Language Purity',
    'benchmarks.dataset_transcreation': 'Transcreation',
    'benchmarks.dataset_edge': 'Edge Cases',
    'benchmarks.dataset_summary': 'Daily Summaries',
    'benchmarks.default_model': 'Default model',
    'benchmarks.loading': 'Loading runs...',
    'benchmarks.chart_passrate': 'Pass Rate Over Time',
    'benchmarks.chart_scores': 'Avg Quality & Language Purity',
    'benchmarks.hover': 'Hover for details · Click legend to toggle datasets',

    'reviews.title': '👁️ Human Review',
    'reviews.status_pending': 'Pending',
    'reviews.status_reviewed': 'Reviewed',
    'reviews.status_all': 'All',
    'reviews.source_all': 'All sources',
    'reviews.source_user_downvote': 'User Downvote',
    'reviews.source_judge_disagree': 'Judge Disagree',
    'reviews.source_force_approved': 'Force Approved',
    'reviews.source_manual': 'Manual',
    'reviews.loading': 'Loading review queue...',

    'rag.title': '🧠 RAG Messages',
    'rag.stats_title': 'Total RAG Messages',
    'rag.search': 'Search by name or text...',
    'rag.search_btn': 'Search',
    'rag.loading': 'Loading messages...',

    'rss.title': '📰 Recent Articles Detected',
    'rss.refresh': '🔄 Refresh',
    'rss.loading': 'Loading RSS activity...',
    'rss.no_breaking': 'No breaking news detected yet.',

    'websearch.title': '🔍 Recent Web Searches',
    'websearch.refresh': '🔄 Refresh',
    'websearch.loading': 'Loading queries...',
    'websearch.no_queries': 'No queries registered yet.',

    'groups.title': '👥 Group Management',
    'groups.refresh': '🔄 Refresh',
    'groups.loading': 'Loading groups...',
    'groups.detail_title': 'Group Management',

    'users.title': '👤 User Management',
    'users.refresh': '🔄 Refresh',
    'users.loading': 'Loading users...',

    'feedback.title': '💬 User Feedback',
    'feedback.p0': 'P0 - Critical',
    'feedback.p1': 'P1 - High',
    'feedback.p2': 'P2 - Medium',
    'feedback.p3': 'P3 - Low',
    'feedback.ppending': 'P-PENDING - Unanalyzed',
    'feedback.filter_all_priorities': 'All priorities',
    'feedback.filter_all_types': 'All types',
    'feedback.type_bug': 'Bug',
    'feedback.type_feature': 'Feature',
    'feedback.type_improvement': 'Improvement',
    'feedback.type_other': 'Other',
    'feedback.all': 'All',
    'feedback.unanalyzed': 'Unanalyzed',
    'feedback.analyzed': 'Analyzed',
    'feedback.analyze_all': '🤖 Analyze all (AI)',
    'feedback.loading': 'Loading feedback...',
    'feedback.refresh': 'Refresh',
    'feedback.detail_title': '💬 Feedback Detail',

    'prds.title': '📄 Generated PRDs',
    'prds.filter_all': 'All statuses',
    'prds.status_draft': 'Draft',
    'prds.status_approved': 'Approved',
    'prds.status_rejected': 'Rejected',
    'prds.status_implemented': 'Implemented',
    'prds.filter_all_priorities': 'All priorities',
    'prds.loading': 'Loading PRDs...',
    'prds.detail_title': '📄 PRD Detail',

    'usage.title': 'Usage',
    'usage.tokens_chart': '📈 Tokens per day (last 7 days)',
    'usage.no_data_week': 'No data for this week',

    'corrections.title': '✏️ Conversational Corrections',
    'corrections.filter_all': 'All',
    'corrections.status_pending': 'Pending',
    'corrections.status_approved': 'Approved',
    'corrections.status_rejected': 'Rejected',
    'corrections.status_promoted': 'Promoted',
    'corrections.loading': 'Loading corrections...',

    'retention.title': 'Retention',
    'retention.active_users': 'Active Users (last 15d)',
    'retention.retention_rate': 'Retention Rate',
    'retention.bot_calls': 'Total Bot Calls (30d)',
    'retention.period': 'Period',
    'retention.group_title': '👥 Group Comparison',
    'retention.chart_title': '📈 Active Users & Bot Calls (30 days)',
    'retention.loading': 'Loading...',
    'retention.no_data': 'No group data',
    'retention.no_trend': 'No trend data yet',
    'retention.refresh': '🔄',

    'rag.empty': 'No messages in RAG.',
    'groups.empty': 'No groups created.',
    'users.empty': 'No users in the database.',
    'feedback.empty': 'No user feedback yet.',
    'prds.empty': 'No PRDs generated yet.',
    'corrections.empty': 'No corrections yet.',

    'diag.issue_humor': '😐 Humor',
    'diag.issue_language': '🌐 Language',
    'diag.issue_personality': '🎭 Personality',
    'diag.issue_factuality': '📊 Factuality',
    'diag.issue_none': '✅ No issue',
    'diag.issue_uncategorized': '❓ Uncategorized',
    'diag.type_force_approved': '⚠️ Force Approved',
    'diag.type_judge_calibration': '⚖️ Judge Calibration',
    'diag.impact': 'impact',
    'diag.personalities': 'personalities',
    'diag.llm_analysis_error': 'in LLM analysis',

    'modal.detail_title': 'Interaction Detail',
    'modal.tokens_total': 'Total Tokens',
    'modal.prompt_tokens': 'Prompt Tokens',
    'modal.completion_tokens': 'Completion Tokens',
    'modal.latency': 'Latency',
    'modal.model': 'Model',
    'modal.rag_query': '🔍 RAG Query',
    'modal.rag_context': '🧠 RAG Context ({n} messages retrieved)',
    'modal.rag_context_empty': 'No context retrieved from database',
    'modal.system_prompt': '🟣 System Prompt',
    'modal.user_prompt': '💬 User Prompt (sent to Groq)',
    'modal.groq_response': '🤖 Groq Response',
    'modal.no_response': 'No response (error)',

    'diag.title': '🔬 Diagnostics',
    'diag.analyze': '🔍 Analyze',
    'diag.llm_recommend': '🔮 AI Recommendations',
    'diag.period': 'Period',
    'diag.1day': '1 day',
    'diag.7days': '7 days',
    'diag.14days': '14 days',
    'diag.30days': '30 days',
    'diag.all_personalities': 'All personalities',
    'diag.analyzing': '⏳ Analyzing...',
    'diag.generating': '⏳ Generating...',
    'diag.health_pass': 'pass',
    'diag.health_no_data': 'No data',
    'diag.health_evaluations': 'evaluations',
    'diag.health_days': 'days',
    'diag.avg_quality': 'Avg Quality',
    'diag.avg_attempts': 'Avg Attempts',
    'diag.hitl': 'HITL',
    'diag.breakdown_title': '📊 Failures by Category',
    'diag.personality_title': '🎭 Diagnosis by Personality',
    'diag.global_recs_title': '💡 Global Recommendations',
    'diag.llm_results_title': '🔮 AI Analysis',
    'diag.no_issue_data': 'No issue data — existing evaluations lack evalMainIssue (visible from now on).',
    'diag.no_personality_data': 'No personality data.',
    'diag.no_recs': 'No recommendations — metrics within expected range.',
    'diag.no_global_recs': 'No global recommendations.',
    'diag.no_llm_results': 'The analysis returned no structured recommendations. Check that your diagnostic data has enough volume.',
    'diag.error': 'Error',

    'help.title': '⚖️ Evals System — Complete Guide',
    'help.subtitle': 'How the AI evaluates itself, when humans step in, and how to run & interpret benchmarks.',
    'help.section1_title': '1. Quality Gate Pipeline',
    'help.section1_text': 'Every response the AI generates passes through the <strong>Quality Gate</strong> — a loop that generates, judges, and retries if the quality is below threshold. This prevents bad responses from reaching users.',
    'help.section2_title': '2. LLM-as-a-Judge',
    'help.section2_text': 'The judge is a separate LLM call (default: <code>llama-3.1-8b-instant</code> at temperature 0.1) that evaluates responses on two axes. It receives the system prompt, humor anchors, and expected language, then returns a JSON verdict.',
    'help.section3_title': '3. Rule-based Fast-path',
    'help.section3_text': 'Before calling the LLM judge, a <strong>regex-based script detector</strong> scans the response. If it finds characters from a non-expected script (e.g. Korean hangul in a Spanish response), the response is automatically failed with <code>language_purity = 0</code> — no LLM call needed.',
    'help.section4_title': '4. Transcreation (Cultural Adaptation)',
    'help.section4_text': 'For non-Latin scripts, the generator first produces a response in the source language (Spanish or English), then <strong>transcreationService.js</strong> adapts it culturally to the target language.',
    'help.section5_title': '5. Benchmarks',
    'help.section5_text': 'A benchmark runs the entire <strong>golden dataset</strong> through the Quality Gate and records pass rates, scores, and regressions.',
    'help.section6_title': '6. Human-in-the-Loop (HITL)',
    'help.section6_text': 'The HITL system captures responses that need human review. A human can verify the judge\'s decision, correct it, and optionally promote good examples to the golden dataset.',
    'help.section7_title': '7. Golden Dataset (13 test queries)',
    'help.section7_text': 'The golden dataset is the canonical set of test cases used by benchmarks. Each entry specifies the input, expected personality, language, and whether transcreation is needed.',
    'help.legend_title': '📖 How to read the Evals table',
    'help.legend_status': 'Status badges',
    'help.legend_pass': '✅ PASS — both thresholds met',
    'help.legend_fail': '❌ FAIL — one or both below threshold',
    'help.legend_skip': 'SKIP — skipped by sample rate',
    'help.legend_scores': 'Score colors',
    'help.legend_green': '🟢 ≥ threshold (good)',
    'help.legend_amber': '🟡 4-7 (needs improvement)',
    'help.legend_red': '🔴 < 4 (critical)',
    'help.legend_badges': 'Transcreation badges',
    'help.legend_tc_check': '✅ ko — transcreated to Korean',
    'help.legend_tc_fallback': '⚠️ FB — transcreation failed, using fallback',
    'help.legend_tc_none': '— no transcreation needed',
    'help.pass_thresholds': 'PASS THRESHOLDS',
    'help.max_retries': 'MAX RETRIES',
    'help.sample_rate': 'SAMPLE RATE',
    'help.transcreation_fallback': 'If transcreation fails after 2 retries, the original Spanish/English response is used as fallback (marked with ⚠️ FB in the evals table).',
    'help.dataset_files': '📁 Dataset files',
    'help.regression': 'The <strong>regression detection</strong> automatically compares the latest run against the previous one. If pass rate drops by 5% or more, a <span style="color:var(--accent-red);">🔴 regression banner</span> appears.',
    'help.hitl_source': 'Source',
    'help.hitl_when': 'When it triggers',
    'help.hitl_priority': 'Priority',
    'help.hitl_force_desc': 'Quality Gate exhausted 3 retries',
    'help.hitl_downvote_desc': 'User gave a rating of 1-2 ⭐ in the chat',
    'help.hitl_disagree_desc': 'Human disagrees with the judge\'s verdict',
    'help.hitl_highest': 'Highest',
    'help.hitl_high': 'High',
    'help.hitl_normal': 'Normal',
    'help.hitl_footer': 'In the <strong>👁️ Human Review</strong> tab you can see pending reviews, submit verdicts (pass/fail with confidence level), and <strong>promote</strong> good responses to the golden dataset.',
    'help.eval_axis': 'Axis',
    'help.eval_range': 'Range',
    'help.eval_threshold': 'Threshold',
    'help.eval_measures': 'What it measures',
    'help.eval_lang_desc': 'Correct language? No mixed scripts? Grammar & register appropriate?',
    'help.eval_quality_desc': 'Humor mechanism used? Fits personality tone? Avoids being robotic/cringe?',
    'help.eval_json_label': '// Judge JSON output format',
    'help.rule_script': 'Detected Script',
    'help.rule_range': 'Unicode Range',
    'help.rule_language': 'Language',
    'help.rule_script_hangul': 'Hangul',
    'help.rule_lang_hangul': 'Korean',
    'help.rule_script_thai': 'Thai',
    'help.rule_lang_thai': 'Thai',
    'help.rule_script_arabic': 'Arabic',
    'help.rule_lang_arabic': 'Arabic, Persian, Urdu',
    'help.rule_script_cjk': 'CJK',
    'help.rule_lang_cjk': 'Chinese, Japanese',
    'help.rule_script_cyrillic': 'Cyrillic',
    'help.rule_lang_cyrillic': 'Russian, Bulgarian, etc.',
    'help.rule_script_devanagari': 'Devanagari',
    'help.rule_lang_devanagari': 'Hindi, Sanskrit, etc.',
    'help.hitl_force_src': 'force_approved',
    'help.hitl_downvote_src': 'user_downvote',
    'help.hitl_disagree_src': 'judge_disagree',
    'help.ds_num': '#',
    'help.ds_id': 'ID',
    'help.ds_personality': 'Personality',
    'help.ds_lang': 'Lang',
    'help.ds_input': 'Input',
    'help.ds_mechanism': 'Expected Mechanism',
    'help.ds_edge': 'Edge?',
    'help.ds_transcreation': 'Transcreation?',
  }
};

function t(key) {
  return LANG[currentLang] && LANG[currentLang][key] !== undefined ? LANG[currentLang][key] : (LANG['es'][key] || key);
}

function applyDataI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = text;
    } else {
      el.textContent = text;
    }
  });
}

function toggleLang() {
  currentLang = currentLang === 'es' ? 'en' : 'es';
  document.getElementById('lang-toggle').textContent = currentLang === 'es' ? '🌐 EN' : '🌐 ES';
  applyDataI18n();
  const active = document.querySelector('.panel.active');
  if (active) switchTab(active.id.replace('panel-', ''));
}

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
      applyDataI18n();
      loadAll();
    })
    .catch(() => {
      const err = document.getElementById('auth-error');
      err.style.display = 'block';
      err.textContent = t('auth.unauthorized');
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

// ==========================================
// MENU
// ==========================================

function toggleMenu() {
  document.getElementById('hamburger-menu').classList.toggle('show');
  document.getElementById('menu-overlay').classList.toggle('show');
}
function closeMenu() {
  document.getElementById('hamburger-menu').classList.remove('show');
  document.getElementById('menu-overlay').classList.remove('show');
}
function toggleGroup(el) {
  el.classList.toggle('collapsed');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMenu();
});

// ==========================================
// TABS
// ==========================================

function switchTab(name) {
  document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  document.querySelector(`.menu-item[data-tab="${name}"]`)?.classList.add('active');
  document.getElementById(`panel-${name}`)?.classList.add('active');

  closeMenu();

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
  if (name === 'feedback-stats') loadFeedbackStats();
  if (name === 'corrections') { loadCorrectionsStats(); loadCorrections(); }
  if (name === 'retention') loadRetention();
  if (name === 'usage') loadUsage();
  if (name === 'diagnostics') loadDiagnostics();
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
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('logs.loading') + '</div>';

  try {
    const data = await devFetch(`/logs${query}`);

    if (!data.logs.length) {
      container.innerHTML = '<div class="loading">' + t('logs.empty') + '</div>';
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
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentLogsPage--; loadLogs()">${t('logs.prev')}</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} ${t('logs.total')})</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentLogsPage++; loadLogs()">${t('logs.next')}</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function openLogDetail(id) {
  const modal = document.getElementById('log-modal');
  const body = document.getElementById('modal-body');
  modal.classList.add('show');
  body.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('loading') + '</div>';

  try {
    const log = await devFetch(`/logs/${id}`);
    const locale = currentLang === 'es' ? 'es-ES' : 'en-US';
    const time = new Date(log.createdAt).toLocaleString(locale);

    body.innerHTML = `
      <div class="metrics-row" style="margin-bottom:1.5rem">
        <div class="metric-chip"><div class="val">${log.tokensUsed || 0}</div><div class="lbl">${t('modal.tokens_total')}</div></div>
        <div class="metric-chip"><div class="val">${log.promptTokens || 0}</div><div class="lbl">${t('modal.prompt_tokens')}</div></div>
        <div class="metric-chip"><div class="val">${log.completionTokens || 0}</div><div class="lbl">${t('modal.completion_tokens')}</div></div>
        <div class="metric-chip"><div class="val" style="color:${log.latencyMs > 3000 ? 'var(--accent-red)' : 'var(--accent-green)'}">${log.latencyMs}ms</div><div class="lbl">${t('modal.latency')}</div></div>
        <div class="metric-chip"><div class="val" style="font-size:0.8rem">${log.model}</div><div class="lbl">${t('modal.model')}</div></div>
      </div>

      <div style="margin-bottom:1rem;font-size:0.8rem;color:var(--text-muted)">
        ${time} · <span class="badge badge-${log.type}">${log.type}</span> · ${log.playerName} · ${log.groupName} · ${log.source}
        ${!log.success ? ' · <span class="badge badge-error">ERROR: ' + (log.errorMessage || '') + '</span>' : ''}
      </div>

      ${log.ragQuery ? `
        <div class="prompt-block">
          <div class="prompt-label">${t('modal.rag_query')}</div>
          <div class="prompt-content" style="border-left: 3px solid var(--accent-cyan)">${escapeHtml(log.ragQuery)}</div>
        </div>
      ` : ''}

      <div class="prompt-block">
        <div class="prompt-label">${t('modal.rag_context').replace('{n}', log.ragResultCount || 0)}</div>
        <div class="prompt-content rag">
          ${log.ragContext ? escapeHtml(log.ragContext) : '<span style="color:var(--text-muted);font-style:italic">' + t('modal.rag_context_empty') + '</span>'}
        </div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">${t('modal.system_prompt')}</div>
        <div class="prompt-content system">${escapeHtml(log.systemPrompt)}</div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">${t('modal.user_prompt')}</div>
        <div class="prompt-content user">${escapeHtml(log.userPrompt)}</div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">${t('modal.groq_response')}</div>
        <div class="prompt-content ai">${escapeHtml(log.groqResponse || t('modal.no_response'))}</div>
      </div>
    `;

    document.getElementById('modal-title').textContent = `${log.type.toUpperCase()} — ${log.playerName}`;
  } catch (e) {
    body.innerHTML = `<div class="loading" style="color:var(--accent-red)">${t('diag.error')}: ${e.message}</div>`;
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
        <div class="card-value" style="color:${passRateColor}">${ov.passRate !== null ? ov.passRate + '%' : t('diag.health_no_data')}</div>
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
      langEl.innerHTML = '<div class="loading">' + t('evals.no_data_lang') + '</div>';
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
      persEl.innerHTML = '<div class="loading">' + t('evals.no_data_personality') + '</div>';
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
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('evals.loading') + '</div>';

  try {
    const data = await devFetch(`/evals${query}`);

    if (!data.logs.length) {
      container.innerHTML = '<div class="loading">' + t('evals.empty') + '</div>';
      document.getElementById('evals-pagination').innerHTML = '';
      return;
    }

    let html = `<table><thead><tr>
      <th>${t('evals.col_time')}</th><th>${t('evals.col_player')}</th><th>${t('evals.col_lang')}</th><th>${t('evals.col_personality')}</th>
      <th>${t('evals.col_lang_score')}</th><th>${t('evals.col_quality')}</th><th>${t('evals.col_status')}</th><th>${t('evals.col_attempts')}</th><th>${t('evals.col_transcreation')}</th><th>${t('evals.col_feedback')}</th>
    </tr></thead><tbody>`;

    data.logs.forEach(log => {
      const time = new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const statusBadge = log.evalSkipped
        ? '<span class="badge" style="background:rgba(255,255,255,0.1)">' + t('evals.skip') + '</span>'
        : log.evalPassed
          ? '<span class="badge badge-success">' + t('evals.pass') + '</span>'
          : '<span class="badge badge-error">' + t('evals.fail') + '</span>';

      const langScore = log.evalScores?.language_purity;
      const qualScore = log.evalScores?.quality;
      const langColor = langScore === undefined ? 'var(--text-muted)' : langScore >= 8 ? 'var(--accent-green)' : langScore >= 5 ? 'var(--accent-amber)' : 'var(--accent-red)';
      const qualColor = qualScore === undefined ? 'var(--text-muted)' : qualScore >= 6 ? 'var(--accent-cyan)' : qualScore >= 4 ? 'var(--accent-amber)' : 'var(--accent-red)';

      const transcreationBadge = log.wasTranscreated
        ? (log.transcreationFallback ? '<span class="badge badge-error" title="Fallback al original">⚠️ FB</span>' : `<span class="badge badge-success">${log.targetLanguage}✓</span>`)
        : '<span style="color:var(--text-muted)">—</span>';

      html += `<tr onclick="openEvalDetail('${log._id}')" style="cursor:pointer;">
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
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentEvalsPage--; loadEvals()">${t('logs.prev')}</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} ${t('logs.total')})</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentEvalsPage++; loadEvals()">${t('logs.next')}</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

// ==========================================
// EVALS — Detail Modal
// ==========================================

async function openEvalDetail(id) {
  const modal = document.getElementById('log-modal');
  const body = document.getElementById('modal-body');
  modal.classList.add('show');
  body.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('loading') + '</div>';

  try {
    const log = await devFetch(`/logs/${id}`);
    const locale = currentLang === 'es' ? 'es-ES' : 'en-US';
    const time = new Date(log.createdAt).toLocaleString(locale);

    const langScore = log.evalScores?.language_purity;
    const qualScore = log.evalScores?.quality;
    const langColor = langScore === undefined ? 'var(--text-muted)' : langScore >= 8 ? 'var(--accent-green)' : langScore >= 5 ? 'var(--accent-amber)' : 'var(--accent-red)';
    const qualColor = qualScore === undefined ? 'var(--text-muted)' : qualScore >= 6 ? 'var(--accent-cyan)' : qualScore >= 4 ? 'var(--accent-amber)' : 'var(--accent-red)';

    const statusBadge = log.evalSkipped
      ? '<span class="badge" style="background:rgba(255,255,255,0.1)">' + t('evals.skip') + '</span>'
      : log.evalPassed
        ? '<span class="badge badge-success">' + t('evals.pass') + '</span>'
        : '<span class="badge badge-error">' + t('evals.fail') + '</span>';

    const issueColors = { language: '#ef4444', humor: '#f59e0b', personality: '#a855f7', factuality: '#3b82f6', none: '#22c55e' };
    const issueColor = issueColors[log.evalMainIssue] || '#888';
    const transcreationDetail = log.wasTranscreated
      ? `${log.targetLanguage}✓${log.transcreationFallback ? ' (fallback)' : ''}`
      : '—';

    body.innerHTML = `
      <div style="margin-bottom:1.2rem;font-size:0.8rem;color:var(--text-muted)">
        🕐 ${time}
        · <strong>${log.playerName}</strong>
        · ${log.anchorsUsed || '—'}
        · <strong>${log.targetLanguage || '?'}</strong>
        · ${log.model || '—'}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
          <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.3rem;">${t('evals.detail_score_lang')}</div>
          <div style="font-size:1.3rem;font-weight:700;color:${langColor};">${langScore !== undefined ? langScore + '/10' : '—'}</div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
          <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.3rem;">${t('evals.detail_score_quality')}</div>
          <div style="font-size:1.3rem;font-weight:700;color:${qualColor};">${qualScore !== undefined ? qualScore + '/10' : '—'}</div>
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1.5rem;">
        ${statusBadge}
        ${log.evalMainIssue ? `<span class="badge" style="background:${issueColor}22;color:${issueColor};border:1px solid ${issueColor}44;">📊 ${log.evalMainIssue}</span>` : ''}
        <span class="badge" style="background:rgba(255,255,255,0.05);">${log.evalAttempts || 1} ${t('evals.detail_attempts')}</span>
        ${log.evalAttempts >= 3 && !log.evalPassed ? '<span class="badge" style="background:rgba(59,130,246,0.2);color:#3b82f6;">' + t('evals.detail_force_approved') + '</span>' : ''}
        <span class="badge" style="background:rgba(255,255,255,0.05);">🔄 ${transcreationDetail}</span>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">${t('evals.detail_query')}</div>
        <div class="prompt-content user">${escapeHtml(log.userPrompt || '—')}</div>
      </div>

      <div class="prompt-block">
        <div class="prompt-label">${t('evals.detail_response')}</div>
        <div class="prompt-content ai">${escapeHtml(log.groqResponse || '—')}</div>
      </div>

      ${log.evalFeedback ? `
      <div class="prompt-block">
        <div class="prompt-label">${t('evals.detail_feedback')}</div>
        <div class="prompt-content" style="border-left:3px solid var(--accent-amber);background:rgba(245,158,11,0.05);">${escapeHtml(log.evalFeedback)}</div>
      </div>` : ''}

      <details style="margin-top:1rem;">
        <summary style="font-size:0.75rem;color:var(--text-muted);cursor:pointer;">${t('evals.detail_technical')}</summary>
        <div style="margin-top:0.8rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.5rem;">
          <div style="background:var(--bg-secondary);border-radius:6px;padding:0.4rem 0.6rem;">
            <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">${t('evals.detail_tokens')}</div>
            <div style="font-size:0.8rem;">${log.tokensUsed || 0} (p:${log.promptTokens || 0} / c:${log.completionTokens || 0})</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:6px;padding:0.4rem 0.6rem;">
            <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">${t('evals.detail_latency')}</div>
            <div style="font-size:0.8rem;color:${log.latencyMs > 3000 ? 'var(--accent-red)' : 'var(--accent-green)'};">${log.latencyMs}ms</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:6px;padding:0.4rem 0.6rem;">
            <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">${t('evals.detail_source')}</div>
            <div style="font-size:0.8rem;">${log.source || '—'}</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:6px;padding:0.4rem 0.6rem;">
            <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">${t('evals.detail_type')}</div>
            <div style="font-size:0.8rem;">${log.type || '—'}</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:6px;padding:0.4rem 0.6rem;">
            <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">${t('evals.detail_success')}</div>
            <div style="font-size:0.8rem;color:${log.success ? 'var(--accent-green)' : 'var(--accent-red)'};">${log.success ? '✅' : '❌ ' + (log.errorMessage || '')}</div>
          </div>
          ${log.wasTranscreated && log.transcreationSource ? `
          <div style="background:var(--bg-secondary);border-radius:6px;padding:0.4rem 0.6rem;grid-column:1/-1;">
            <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">${t('evals.detail_transcreation_source')}</div>
            <div style="font-size:0.75rem;font-family:var(--mono);">${escapeHtml(log.transcreationSource.substring(0, 200))}</div>
          </div>` : ''}
        </div>
      </details>

      ${log.systemPrompt ? `
      <details style="margin-top:0.8rem;">
        <summary style="font-size:0.75rem;color:var(--text-muted);cursor:pointer;">${t('evals.detail_system_prompt')}</summary>
        <div class="prompt-content system" style="margin-top:0.5rem;max-height:300px;overflow-y:auto;">${escapeHtml(log.systemPrompt)}</div>
      </details>` : ''}

      ${log.ragQuery ? `
      <details style="margin-top:0.8rem;">
        <summary style="font-size:0.75rem;color:var(--text-muted);cursor:pointer;">${t('evals.detail_rag')} (${log.ragResultCount || 0})</summary>
        <div class="prompt-content rag" style="margin-top:0.5rem;max-height:300px;overflow-y:auto;">${escapeHtml(log.ragContext || '')}</div>
      </details>` : ''}
    `;

    document.getElementById('modal-title').textContent = `⚖️ ${t('evals.detail_title').replace('⚖️ ','')} — ${log.playerName} · ${log.anchorsUsed || '—'}`;
  } catch (e) {
    body.innerHTML = `<div class="loading" style="color:var(--accent-red)">${t('diag.error')}: ${e.message}</div>`;
    document.getElementById('modal-title').textContent = t('evals.detail_title');
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
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('rag.loading') + '</div>';

  try {
    const data = await devFetch(`/rag/messages${query}`);

    if (!data.messages.length) {
      container.innerHTML = '<div class="loading">' + t('rag.empty') + '</div>';
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
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('groups.loading') + '</div>';

  try {
    const groups = await devFetch('/groups');
    
    if (!groups.length) {
      container.innerHTML = '<div class="loading">' + t('groups.empty') + '</div>';
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
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('users.loading') + '</div>';

  try {
    const users = await devFetch('/users');
    
    if (!users.length) {
      container.innerHTML = '<div class="loading">' + t('users.empty') + '</div>';
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
  title.textContent = `${t('groups.detail_title')}: ${name}`;
  body.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('loading.data') + '</div>';

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
    chart.innerHTML = '<div class="loading">' + t('usage.no_data_week') + '</div>';
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
        <div class="card-sub">${data.lastPollTime ? new Date(data.lastPollTime).toLocaleString(currentLang === 'es' ? 'es-ES' : 'en-US') : '—'}</div>
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
      articlesBody.innerHTML = '<div class="loading">' + t('rss.no_breaking') + '</div>';
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
        <div class="card-sub">${data.lastQueryTime ? new Date(data.lastQueryTime).toLocaleString(currentLang === 'es' ? 'es-ES' : 'en-US') : '—'}</div>
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
      queriesBody.innerHTML = '<div class="loading">' + t('websearch.no_queries') + '</div>';
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
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('feedback.loading') + '</div>';

  try {
    const data = await devFetch(`/feedback${query}`);

    if (!data.feedback.length) {
      container.innerHTML = '<div class="loading">' + t('feedback.empty') + '</div>';
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
          <button class="btn-sm" onclick="event.stopPropagation(); analyzeFeedback('${fb._id}')" style="background:var(--accent-cyan)" title="Analizar con IA">🤖</button>
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
  body.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('loading.data') + '</div>';
  title.textContent = t('feedback.detail_title');

  try {
    const fb = await devFetch(`/feedback/${id}`);
    if (!fb || !fb._id) { body.innerHTML = '<div class="loading">Feedback no encontrado</div>'; return; }

    const locale = currentLang === 'es' ? 'es-ES' : 'en-US';
    const time = new Date(fb.createdAt).toLocaleString(locale);

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
          <div class="prompt-label">Análisis (IA) <small style="color:var(--text-muted);font-weight:normal">· ${new Date(fb.analyzedAt).toLocaleString(locale)}</small></div>
          <div class="prompt-content system" style="max-height:none;white-space:pre-wrap">${escapeHtml(fb.analysis || 'Sin análisis')}</div>
        </div>
        <div style="margin-bottom:1rem">
          <div class="prompt-label">Razón de prioridad</div>
          <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:0.8rem;font-size:0.85rem">${escapeHtml(fb.priorityReason || '—')}</div>
        </div>
      ` : '<div style="margin-bottom:1rem;color:var(--text-muted);font-style:italic">⏳ Pendiente de análisis por IA</div>'}

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
  if (!confirm('¿Analizar todo el feedback pendiente con IA? Puede tomar varios segundos.')) return;
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
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('prds.loading') + '</div>';

  try {
    const data = await devFetch(`/prds${query}`);

    if (!data.prds.length) {
      container.innerHTML = '<div class="loading">' + t('prds.empty') + '</div>';
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
  body.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('loading.data') + '</div>';
  title.textContent = t('prds.detail_title');

  try {
    const prd = await devFetch(`/prds/${id}`);
    if (!prd || !prd._id) { body.innerHTML = '<div class="loading">PRD no encontrado</div>'; return; }

    const locale = currentLang === 'es' ? 'es-ES' : 'en-US';
    const time = new Date(prd.createdAt).toLocaleString(locale);

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
const runDataCache = new Map();
const DATASET_COLORS = {
  intent: { border: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  personality: { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  language: { border: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  transcreation: { border: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  edge: { border: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  summary: { border: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
};
const DATASET_NAMES = { intent: 'Intent', personality: 'Personality', language: 'Language', transcreation: 'Transcreation', edge: 'Edge', summary: 'Summary' };

async function loadBenchmarks() {
  try {
    renderPassRateChart();
    renderScoresChart();
    loadRunHistory();
  } catch (e) {
    console.error('loadBenchmarks error:', e);
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
      pointBackgroundColor: DATASET_COLORS[key].border,
      pointBorderColor: 'transparent',
      pointBorderWidth: 0,
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
          legend: {
            labels: { color: '#c0c0c0', usePointStyle: true },
            onHover: function(e) { if (e.native) e.native.target.style.cursor = 'pointer'; },
            onLeave: function(e) { if (e.native) e.native.target.style.cursor = 'default'; }
          },
          tooltip: {
            callbacks: {
              afterBody: function(items) {
                if (!items.length) return '';
                const idx = items[0].dataIndex;
                const dsIdx = items[0].datasetIndex;
                const r = runs[idx];
                if (!r) return '';
                const key = datasetKeys[dsIdx];
                const ds = key && r.perDataset?.[key];
                const parts = [];
                if (ds && ds.totalTests > 0) {
                  const pct = ((ds.passed || 0) / ds.totalTests * 100).toFixed(1);
                  parts.push(`Pass: ${ds.passed || 0}/${ds.totalTests} (${pct}%)`);
                  if (ds.avgQuality != null) parts.push(`Quality: ${ds.avgQuality}/10`);
                  if (ds.avgLanguagePurity != null) parts.push(`Language: ${ds.avgLanguagePurity}/10`);
                }
                parts.push(`───\nRun: ${r.runId || '—'} | ${r.model || 'default'} | ${r.temperature}°`);
                return parts.join('\n');
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
      pointBackgroundColor: DATASET_COLORS[key].border,
      pointBorderColor: 'transparent',
      pointBorderWidth: 0,
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
          legend: {
            labels: { color: '#c0c0c0', usePointStyle: true },
            onHover: function(e) { if (e.native) e.native.target.style.cursor = 'pointer'; },
            onLeave: function(e) { if (e.native) e.native.target.style.cursor = 'default'; }
          },
          tooltip: {
            callbacks: {
              afterBody: function(items) {
                if (!items.length) return '';
                const idx = items[0].dataIndex;
                const dsIdx = items[0].datasetIndex;
                const r = runs[idx];
                if (!r) return '';
                const key = datasetKeys[dsIdx];
                const ds = key && r.perDataset?.[key];
                const parts = [];
                if (ds) {
                  if (ds.avgQuality != null) parts.push(`Quality: ${ds.avgQuality}/10`);
                  if (ds.avgLanguagePurity != null) parts.push(`Language: ${ds.avgLanguagePurity}/10`);
                }
                parts.push(`───\nRun: ${r.runId || '—'}`);
                return parts.join('\n');
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
            runDataCache.set(r._id, r);
            const avgQ = (()=>{const q=r.results?.filter(x=>x.scores?.quality).reduce((s,x)=>s+(x.scores.quality||0),0); const n=r.results?.filter(x=>x.scores?.quality).length; return n ? (q/n).toFixed(2) : '—';})();
            const pct = r.passRate != null ? r.passRate.toFixed(1) + '%' : '—';
            return `<tr data-id="${r._id}" data-run-id="${r.runId}" onclick="toggleRunExpand('${r._id}', this)">
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

    // Check latest run for regression banner
    const latest = runs[0];
    if (latest?.comparisonWithPrevious?.regressions?.length) {
      document.getElementById('regression-banner').style.display = 'block';
      document.getElementById('regression-banner').innerHTML = `⚠️ <strong>${latest.comparisonWithPrevious.regressions.length}</strong> regression(s) detected vs previous run. <a href="#" onclick="showComparison('${latest._id}', '${latest.comparisonWithPrevious.previousRunId}');return false;">Compare</a>`;
    } else {
      document.getElementById('regression-banner').style.display = 'none';
    }

  } catch (e) {
    document.getElementById('run-history-body').innerHTML = `<div class="text-muted">Error: ${e.message}</div>`;
  }
}

function toggleRunExpand(runId, tr) {
  const tbody = tr.parentNode;
  const existingExpand = tr.nextElementSibling;
  if (existingExpand && existingExpand.classList.contains('expand-row')) {
    existingExpand.remove();
    tr.classList.remove('row-selected');
    return;
  }
  tbody.querySelectorAll('.expand-row').forEach(el => el.remove());
  tbody.querySelectorAll('.row-selected').forEach(el => el.classList.remove('row-selected'));
  tr.classList.add('row-selected');

  const run = runDataCache.get(runId);
  if (!run) return;

  const datasetKeys = Object.keys(run.perDataset || {});
  if (!datasetKeys.length) {
    const emptyTr = document.createElement('tr');
    emptyTr.className = 'expand-row';
    emptyTr.innerHTML = '<td colspan="8"><div class="expand-content"><div class="text-muted">No dataset data available.</div></div></td>';
    tr.after(emptyTr);
    return;
  }

  const cardsHtml = datasetKeys.map(key => {
    const ds = run.perDataset[key];
    const pct = ds && ds.totalTests > 0 ? ((ds.passed || 0) / ds.totalTests * 100).toFixed(1) : '—';
    const qual = ds && ds.avgQuality != null ? ds.avgQuality.toFixed(2) : '—';
    const lang = ds && ds.avgLanguagePurity != null ? ds.avgLanguagePurity.toFixed(2) : '—';
    const color = DATASET_COLORS[key]?.border || '#888';
    return `<div class="dataset-card">
      <div class="ds-name">${DATASET_NAMES[key] || key}</div>
      <div class="ds-stat">${pct}% pass <small>(${ds?.passed || 0}/${ds?.totalTests || 0})</small></div>
      <div class="ds-bar-wrap" style="margin:0.4rem 0;height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden;"><div class="ds-bar-fill" style="height:100%;border-radius:3px;width:${pct};background:${color};"></div></div>
      <div class="ds-stat">Quality: ${qual} ${lang !== '—' ? `<small>· Language: ${lang}</small>` : ''}</div>
      <div class="ds-actions"><button class="btn-sm" onclick="openDatasetDetail('${runId}', '${key}')">View Tests</button></div>
    </div>`;
  }).join('');

  const expandTr = document.createElement('tr');
  expandTr.className = 'expand-row';
  expandTr.innerHTML = `<td colspan="8"><div class="expand-content">${cardsHtml}</div></td>`;
  tr.after(expandTr);
}

function openDatasetDetail(runId, datasetKey) {
  const run = runDataCache.get(runId);
  if (!run) return;

  const tests = (run.results || []).filter(r => r.dataset === datasetKey);
  const dsName = DATASET_NAMES[datasetKey] || datasetKey;

  document.getElementById('modal-title').textContent = `${dsName} — ${tests.length} Tests`;

  const tableRows = tests.map((t, i) => {
    const statusIcon = t.passed ? '✅' : '❌';
    const qualStr = t.scores?.quality != null ? t.scores.quality.toFixed(1) : '—';
    const qualExp = t.expectedScores?.quality != null ? t.expectedScores.quality.toFixed(1) : null;
    const langStr = t.scores?.languagePurity != null ? t.scores.languagePurity.toFixed(1) : '—';
    const langExp = t.expectedScores?.languagePurity != null ? t.expectedScores.languagePurity.toFixed(1) : null;
    const desc = t.description || '';
    const latency = t.latencyMs != null ? `${t.latencyMs}ms` : '—';
    return `<tr onclick="toggleTestDetail(this, ${i})">
      <td>${statusIcon}</td>
      <td><code>${t.testId || '—'}</code>${desc ? `<br><span style="font-size:0.7rem;color:var(--text-muted);">${escapeHtml(desc)}</span>` : ''}</td>
      <td>${qualStr}${qualExp != null ? `<br><span style="font-size:0.65rem;color:var(--text-muted);">exp ${qualExp}</span>` : ''}</td>
      <td>${langStr}${langExp != null ? `<br><span style="font-size:0.65rem;color:var(--text-muted);">exp ${langExp}</span>` : ''}</td>
      <td style="font-size:0.7rem;color:var(--text-muted);">${latency}</td>
    </tr>
    <tr class="test-detail-row" style="display:none;">
      <td colspan="5">
        <div class="test-detail-content">
          ${t.input ? `<div class="detail-label">Input</div><div class="detail-value">${escapeHtml(String(t.input).substring(0, 500))}</div>` : ''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div>
              <div class="detail-label">Response</div>
              <div class="detail-value">${escapeHtml(String(t.response || '(empty)')).substring(0, 1000)}</div>
            </div>
            <div>
              <div class="detail-label">Golden Response</div>
              <div class="detail-value">${escapeHtml(String(t.goldenResponse || '(none)')).substring(0, 1000)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.5rem;">
            <div>
              <div class="detail-label">Scores</div>
              <div class="detail-value" style="background:var(--bg-card);padding:0.4rem;border-radius:4px;border:1px solid var(--border);font-size:0.75rem;">
                ${t.scores && Object.keys(t.scores).length ? Object.entries(t.scores).map(([k,v]) => {
                  const expV = t.expectedScores?.[k];
                  const ok = expV != null ? (v >= expV ? '✅' : '❌') : '';
                  return `<div>${k}: <strong>${v != null ? v.toFixed(1) : '—'}</strong>${expV != null ? ` (expected ${expV}) ${ok}` : ''}</div>`;
                }).join('') : '<span style="color:var(--text-muted);">No score data</span>'}
                ${t.expectedScores && Object.keys(t.expectedScores).length && (!t.scores || !Object.keys(t.scores).length) ?
                  Object.entries(t.expectedScores).map(([k,v]) => `<div style="color:var(--text-muted);">${k}: expected <strong>${v}</strong> (no actual)</div>`).join('') : ''}
              </div>
            </div>
            <div>
              <div class="detail-label">Feedback</div>
              <div class="detail-value" style="white-space:pre-wrap;">${escapeHtml(String(t.feedback || '(none)'))}</div>
            </div>
          </div>
          <div style="margin-top:0.5rem;display:flex;gap:1rem;font-size:0.7rem;color:var(--text-muted);">
            <span>⚡ ${latency}</span>
            <span>🔄 Attempts: ${t.attempts != null ? t.attempts : '—'}</span>
            ${t.forceApproved ? '<span style="color:var(--accent-cyan);">✓ Force approved</span>' : ''}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('modal-body').innerHTML = `
    <table class="test-table">
      <thead><tr><th style="width:32px"></th><th>Test</th><th style="width:70px">Quality</th><th style="width:70px">Lang</th><th style="width:60px">Latency</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
  document.getElementById('log-modal').classList.add('show');
}

function toggleTestDetail(tr, idx) {
  const detailRow = tr.nextElementSibling;
  if (!detailRow || !detailRow.classList.contains('test-detail-row')) return;
  detailRow.style.display = detailRow.style.display === 'none' ? '' : 'none';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
    const rA = data.runA || {};
    const rB = data.runB || {};

    function fmtItem(item) {
      if (item.type === 'pass_flip') {
        const from = item.before ? '✅ Pass' : '❌ Fail';
        const to = item.after ? '✅ Pass' : '❌ Fail';
        return `<code>${item.dataset}.${item.testId}</code> — ${from} → ${to}`;
      }
      if (item.type === 'quality_change') {
        const beforeStr = item.before != null ? item.before.toFixed(1) : '—';
        const afterStr = item.after != null ? item.after.toFixed(1) : '—';
        let delta = '';
        if (item.before != null && item.after != null && item.before > 0) {
          const pct = ((item.after - item.before) / item.before * 100);
          delta = ` (${pct > 0 ? '+' : ''}${pct.toFixed(0)}%)`;
        } else if (item.before != null && item.after != null && item.before === 0) {
          delta = ' (new)';
        }
        return `<code>${item.dataset}.${item.testId}</code> — quality: ${beforeStr} → ${afterStr}${delta}`;
      }
      return `<code>${item.dataset}.${item.testId}</code>`;
    }

    document.getElementById('comparison-view').style.display = 'block';
    document.getElementById('comparison-view').innerHTML = `
      <div class="comparison-section">
        ${data.comparison?.temperatureMismatch ? `<div class="alert-warning">⚠️ Temperature mismatch between runs</div>` : ''}
        <h4 style="font-size:0.85rem;margin-bottom:0.75rem;">📊 Run Comparison</h4>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.75rem;">
          <strong>Run A:</strong> ${rA.runId?.substring(0,12) || '—'} (${rA.model || '?'} · temp ${rA.temperature != null ? rA.temperature : '?'}) &nbsp;|&nbsp;
          <strong>Run B:</strong> ${rB.runId?.substring(0,12) || '—'} (${rB.model || '?'} · temp ${rB.temperature != null ? rB.temperature : '?'})
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem;">
          <div class="card-sm"><div class="label">Pass Rate Delta</div><div class="value" style="color:${(data.comparison?.passRateDelta||0) >= 0 ? 'var(--accent-green)' : '#ef4444'}">${data.comparison?.passRateDelta != null ? (data.comparison.passRateDelta > 0 ? '+' : '') + data.comparison.passRateDelta + '%' : '—'}</div></div>
          <div class="card-sm"><div class="label">Quality Delta</div><div class="value" style="color:${(data.comparison?.qualityDelta||0) >= 0 ? 'var(--accent-green)' : '#ef4444'}">${data.comparison?.qualityDelta != null ? (data.comparison.qualityDelta > 0 ? '+' : '') + data.comparison.qualityDelta.toFixed(2) : '—'}</div></div>
          <div class="card-sm"><div class="label">Language Delta</div><div class="value" style="color:${(data.comparison?.languageDelta||0) >= 0 ? 'var(--accent-green)' : '#ef4444'}">${data.comparison?.languageDelta != null ? (data.comparison.languageDelta > 0 ? '+' : '') + data.comparison.languageDelta.toFixed(2) : '—'}</div></div>
        </div>
        ${reg.length ? `<div style="margin-bottom:0.75rem;"><strong style="color:#ef4444;">Regressions (${reg.length})</strong><ul style="margin:0.3rem 0 0 1rem;font-size:0.78rem;">${reg.map(r => `<li style="margin-bottom:0.2rem;">${fmtItem(r)}</li>`).join('')}</ul></div>` : ''}
        ${impr.length ? `<div style="margin-bottom:0.75rem;"><strong style="color:#22c55e;">Improvements (${impr.length})</strong><ul style="margin:0.3rem 0 0 1rem;font-size:0.78rem;">${impr.map(r => `<li style="margin-bottom:0.2rem;">${fmtItem(r)}</li>`).join('')}</ul></div>` : ''}
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
    console.error('runBenchmark error:', e.message);
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

// ==========================================
// FEEDBACK STATS PANEL
// ==========================================

let currentFeedbackStatsPage = 1;

async function loadFeedbackStats() {
  try {
    const data = await devFetch('/evals/stats?days=30');
    const ov = data.overview;

    // También obtener stats de ChatbotFeedback
    const fbStats = await devFetch('/evals/hitl/stats');

    const avgScore = fbStats.totalReviews > 0
      ? Math.round(((fbStats.agreements || 0) / Math.max(fbStats.totalReviews, 1)) * 100)
      : null;

    document.getElementById('feedback-stats-cards').innerHTML = `
      <div class="card">
        <div class="card-label">Avg User Rating (proxy)</div>
        <div class="card-value ${(ov.avgQuality || 0) >= 6 ? 'green' : 'amber'}">${(ov.avgQuality || 0).toFixed(1)}/10</div>
        <div class="card-sub">Quality score from Judge (eval proxy)</div>
      </div>
      <div class="card">
        <div class="card-label">Judge ⇔ Human Agreement</div>
        <div class="card-value ${avgScore >= 70 ? 'green' : avgScore >= 50 ? 'amber' : 'red'}">${avgScore !== null ? avgScore + '%' : 'Sin datos'}</div>
        <div class="card-sub">${fbStats.agreements || 0} agreements · ${fbStats.disagreements || 0} disagreements</div>
      </div>
      <div class="card">
        <div class="card-label">False Positives (Judge said PASS)</div>
        <div class="card-value red">${fbStats.falsePositives || 0}</div>
        <div class="card-sub">Rate: ${fbStats.falsePositiveRate || 0}%</div>
      </div>
      <div class="card">
        <div class="card-label">False Negatives (Judge said FAIL)</div>
        <div class="card-value amber">${fbStats.falseNegatives || 0}</div>
        <div class="card-sub">Rate: ${fbStats.falseNegativeRate || 0}%</div>
      </div>
    `;

    // Breakdown por personalidad (from evals stats)
    const persEl = document.getElementById('feedback-stats-personality');
    if (data.byPersonality?.length) {
      let html = '<table><thead><tr><th>Personalidad</th><th>Total</th><th>Pass%</th><th>Quality</th></tr></thead><tbody>';
      data.byPersonality.forEach(row => {
        const pct = row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0;
        html += `<tr>
          <td><strong>${row._id || 'N/A'}</strong></td>
          <td>${row.total}</td>
          <td><span class="badge badge-${pct >= 80 ? 'success' : pct >= 60 ? 'amber' : 'error'}">${pct}%</span></td>
          <td>${(row.avgQuality || 0).toFixed(1)}/10</td>
        </tr>`;
      });
      html += '</tbody></table>';
      persEl.innerHTML = html;
    } else {
      persEl.innerHTML = '<div class="loading">' + t('diag.health_no_data') + '</div>';
    }

    // Breakdown por idioma
    const langEl = document.getElementById('feedback-stats-language');
    if (data.byLanguage?.length) {
      let html = '<table><thead><tr><th>Idioma</th><th>Total</th><th>Pass%</th><th>Quality</th></tr></thead><tbody>';
      data.byLanguage.forEach(row => {
        const pct = row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0;
        html += `<tr>
          <td><strong>${row._id || 'N/A'}</strong></td>
          <td>${row.total}</td>
          <td><span class="badge badge-${pct >= 80 ? 'success' : pct >= 60 ? 'amber' : 'error'}">${pct}%</span></td>
          <td>${(row.avgQuality || 0).toFixed(1)}/10</td>
        </tr>`;
      });
      html += '</tbody></table>';
      langEl.innerHTML = html;
    } else {
      langEl.innerHTML = '<div class="loading">' + t('diag.health_no_data') + '</div>';
    }

    // Tabla de ratings recientes (from /evals)
    const evalsData = await devFetch(`/evals?page=${currentFeedbackStatsPage}&limit=20`);
    const tableEl = document.getElementById('feedback-stats-table');
    if (evalsData.logs?.length) {
      let html = '<table><thead><tr><th>Fecha</th><th>Jugador</th><th>Personalidad</th><th>Lang</th><th>Quality</th><th>Status</th></tr></thead><tbody>';
      evalsData.logs.forEach(log => {
        const time = new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const statusBadge = log.evalSkipped
          ? '<span class="badge" style="background:rgba(255,255,255,0.1)">SKIP</span>'
          : log.evalPassed
            ? '<span class="badge badge-success">✅ PASS</span>'
            : '<span class="badge badge-error">❌ FAIL</span>';
        html += `<tr>
          <td style="white-space:nowrap">${time}</td>
          <td>${log.playerName}</td>
          <td style="font-size:0.75rem">${log.anchorsUsed || '—'}</td>
          <td>${log.targetLanguage || '?'}</td>
          <td style="color:${(log.evalScores?.quality || 0) >= 6 ? 'var(--accent-green)' : 'var(--accent-red)'};font-weight:700">${log.evalScores?.quality != null ? log.evalScores.quality + '/10' : '—'}</td>
          <td>${statusBadge}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      tableEl.innerHTML = html;
    } else {
      tableEl.innerHTML = '<div class="loading">' + t('evals.empty') + '</div>';
    }

    const p = evalsData.pagination;
    document.getElementById('feedback-stats-pagination').innerHTML = p ? `
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentFeedbackStatsPage--; loadFeedbackStats()">← Prev</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} total)</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentFeedbackStatsPage++; loadFeedbackStats()">Next →</button>
    ` : '';
  } catch (e) {
    document.getElementById('feedback-stats-cards').innerHTML = `<div class="card"><div class="card-value red">Error</div><div class="card-sub">${e.message}</div></div>`;
  }
}

// ==========================================
// CORRECTIONS PANEL
// ==========================================

let currentCorrectionsPage = 1;

async function loadCorrectionsStats() {
  try {
    const data = await devFetch('/corrections/stats');
    document.getElementById('corrections-cards').innerHTML = `
      <div class="card">
        <div class="card-label">Total Corrections</div>
        <div class="card-value cyan">${data.total}</div>
        <div class="card-sub">Across all groups</div>
      </div>
      <div class="card">
        <div class="card-label">Pending Review</div>
        <div class="card-value ${data.pending > 0 ? 'amber' : 'green'}">${data.pending}</div>
        <div class="card-sub">${data.pending > 0 ? 'Needs human review' : 'All reviewed'}</div>
      </div>
      <div class="card">
        <div class="card-label">Promoted to Golden</div>
        <div class="card-value green">${data.promoted}</div>
        <div class="card-sub">Dataset entries from corrections</div>
      </div>
      <div class="card">
        <div class="card-label">Avg Detector Confidence</div>
        <div class="card-value ${data.avgConfidence >= 0.7 ? 'green' : 'amber'}">${(data.avgConfidence * 100).toFixed(0)}%</div>
        <div class="card-sub">LLM-based correction detector</div>
      </div>
    `;
  } catch (e) {
    document.getElementById('corrections-cards').innerHTML = `<div class="card"><div class="card-value red">Error</div><div class="card-sub">${e.message}</div></div>`;
  }
}

async function loadCorrections() {
  const status = document.getElementById('filter-correction-status')?.value || '';
  let query = `?page=${currentCorrectionsPage}&limit=20`;
  if (status) query += `&status=${status}`;

  const container = document.getElementById('corrections-table-body');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('corrections.loading') + '</div>';

  try {
    const data = await devFetch(`/corrections${query}`);
    if (!data.corrections?.length) {
      container.innerHTML = '<div class="loading">' + t('corrections.empty') + '</div>';
      document.getElementById('corrections-pagination').innerHTML = '';
      return;
    }

    let html = '<table><thead><tr><th>Fecha</th><th>Usuario</th><th>Grupo</th><th>Personalidad</th><th>Original</th><th>Corrección</th><th>Confianza</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';

    data.corrections.forEach(c => {
      const time = new Date(c.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const statusColors = { pending: 'amber', approved: 'green', rejected: 'red', promoted: 'cyan' };
      const statusBadge = `<span class="badge badge-${statusColors[c.status] || 'amber'}">${c.status}</span>`;

      let actions = '';
      if (c.status === 'pending') {
        actions = `
          <button class="btn-sm" onclick="approveCorrection('${c._id}')" style="background:rgba(16,185,129,0.2);color:var(--accent-green);padding:2px 6px">✅ Approve</button>
          <button class="btn-sm" onclick="rejectCorrection('${c._id}')" style="background:rgba(239,68,68,0.2);color:var(--accent-red);padding:2px 6px">❌ Reject</button>
        `;
      } else if (c.status === 'approved') {
        actions = `<button class="btn-sm" onclick="promoteCorrection('${c._id}')" style="background:rgba(59,130,246,0.2);color:var(--accent-blue);padding:2px 6px">⭐ Promote to Golden</button>`;
      } else if (c.status === 'promoted') {
        actions = '<span style="color:var(--accent-green);font-size:0.75rem">✅ In golden dataset</span>';
      }

      html += `<tr>
        <td style="white-space:nowrap;font-size:0.72rem">${time}</td>
        <td><strong>${c.userName || c.userId}</strong></td>
        <td style="font-size:0.75rem">${c.groupName}</td>
        <td style="font-size:0.72rem">${c.personalityId || '—'}</td>
        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.72rem" title="${escapeHtml(c.originalResponse)}">${escapeHtml(c.originalResponse.substring(0, 60))}…</td>
        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.72rem;color:var(--accent-green)" title="${escapeHtml(c.correctedText)}">${escapeHtml(c.correctedText.substring(0, 60))}…</td>
        <td style="font-size:0.75rem">${c.detectorConfidence ? Math.round(c.detectorConfidence * 100) + '%' : '—'}</td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap">${actions}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    const p = data.pagination;
    document.getElementById('corrections-pagination').innerHTML = `
      <button ${p.page <= 1 ? 'disabled' : ''} onclick="currentCorrectionsPage--; loadCorrections()">← Prev</button>
      <span class="page-info">${p.page} / ${p.pages} (${p.total} total)</span>
      <button ${p.page >= p.pages ? 'disabled' : ''} onclick="currentCorrectionsPage++; loadCorrections()">Next →</button>
    `;
  } catch (e) {
    container.innerHTML = `<div class="loading" style="color:var(--accent-red)">Error: ${e.message}</div>`;
  }
}

async function approveCorrection(id) {
  try {
    await devFetchPost(`/corrections/${id}/approve`, {});
    loadCorrections();
    loadCorrectionsStats();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function rejectCorrection(id) {
  try {
    await devFetchPost(`/corrections/${id}/reject`, {});
    loadCorrections();
    loadCorrectionsStats();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function promoteCorrection(id) {
  try {
    await devFetchPost(`/corrections/${id}/promote`, {});
    loadCorrections();
    loadCorrectionsStats();
  } catch (e) {
    alert(`Error promoting: ${e.message}`);
  }
}

// ==========================================
// RETENTION PANEL
// ==========================================

async function loadRetention() {
  try {
    const data = await devFetch('/analytics/retention?days=30');

    const retentionColor = data.retentionRate >= 50 ? 'green' : data.retentionRate >= 30 ? 'amber' : 'red';

    document.getElementById('retention-cards').innerHTML = `
      <div class="card">
        <div class="card-label">${t('retention.active_users')}</div>
        <div class="card-value cyan">${data.activeUsers}</div>
        <div class="card-sub">${t('retention.of_total')} ${data.totalUsers} ${t('retention.users')}</div>
      </div>
      <div class="card">
        <div class="card-label">${t('retention.retention_rate')}</div>
        <div class="card-value ${retentionColor}">${data.retentionRate}%</div>
        <div class="card-sub">${data.retainedUsers} ${t('retention.retained')} · ${data.churnedUsers} ${t('retention.churned')}</div>
      </div>
      <div class="card">
        <div class="card-label">${t('retention.bot_calls')}</div>
        <div class="card-value purple">${data.totalBotCalls}</div>
        <div class="card-sub">${t('retention.avg_per_user')} ${data.avgBotCallsPerUser}</div>
      </div>
      <div class="card">
        <div class="card-label">${t('retention.period')}</div>
        <div class="card-value amber" style="font-size:0.9rem">${data.period}</div>
        <div class="card-sub">${t('retention.rolling')}</div>
      </div>
    `;

    // Trend chart (simple bar chart)
    const chartEl = document.getElementById('retention-trend-chart');
    if (data.trend?.length) {
      let html = '<div style="display:flex;align-items:end;gap:3px;height:120px;padding:0 0.5rem;border-bottom:1px solid var(--border);margin-bottom:0.5rem;">';
      const maxVal = Math.max(...data.trend.map(d => Math.max(d.activeUsers, Math.ceil(d.botCalls / 3))), 1);
      data.trend.slice(-30).forEach(d => {
        const hUsers = (d.activeUsers / maxVal) * 100;
        const hCalls = (Math.ceil(d.botCalls / 3) / maxVal) * 100;
        html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;">
          <div style="width:100%;height:${hCalls}px;background:rgba(59,130,246,0.4);border-radius:2px 2px 0 0;min-height:1px;" title="Calls: ${d.botCalls}"></div>
          <div style="width:100%;height:${hUsers}px;background:rgba(16,185,129,0.6);border-radius:2px 2px 0 0;min-height:1px;" title="Users: ${d.activeUsers}"></div>
        </div>`;
      });
      html += '</div>';
      html += '<div style="display:flex;gap:1rem;font-size:0.7rem;color:var(--text-muted);padding:0 0.5rem;">';
      html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(16,185,129,0.6);border-radius:2px;margin-right:4px;"></span> Active Users</span>';
      html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(59,130,246,0.4);border-radius:2px;margin-right:4px;"></span> Bot Calls (/3)</span>';
      html += '</div>';
      chartEl.innerHTML = html;
    } else {
      chartEl.innerHTML = '<div class="loading">' + t('retention.no_trend') + '</div>';
    }

    // Group comparison table
    const groupEl = document.getElementById('retention-group-table');
    if (data.groupComparison?.length) {
      let html = '<table><thead><tr><th>Grupo</th><th>Calls</th><th>Active Users</th><th>Retention</th></tr></thead><tbody>';
      data.groupComparison.slice(0, 20).forEach(g => {
        const retColor = g.retentionRate >= 50 ? 'green' : g.retentionRate >= 30 ? 'amber' : 'red';
        html += `<tr>
          <td><strong>${g.groupName}</strong></td>
          <td>${g.calls}</td>
          <td>${g.activeUsers}</td>
          <td><span class="badge badge-${retColor}">${g.retentionRate}%</span></td>
        </tr>`;
      });
      html += '</tbody></table>';
      groupEl.innerHTML = html;
    } else {
      groupEl.innerHTML = '<div class="loading">' + t('retention.no_data') + '</div>';
    }
  } catch (e) {
    document.getElementById('retention-cards').innerHTML = `<div class="card"><div class="card-value red">Error</div><div class="card-sub">${e.message}</div></div>`;
  }
}

// ==========================================
// DIAGNOSTICS — Pattern analysis + recommendations
// ==========================================

let diagDataCache = null;
let diagLoading = false;

async function loadDiagnostics() {
  if (diagLoading) return;
  diagLoading = true;

  const btn = document.getElementById('btn-diag-analyze');
  const btnLlm = document.getElementById('btn-diag-llm');
  btn.disabled = true;
  btn.textContent = t('diag.analyzing');
  if (btnLlm) btnLlm.disabled = true;

  document.getElementById('diagnostics-health').innerHTML = '<div class="loading" style="grid-column:1/-1"><span class="spinner"></span> ' + t('diag.analyzing') + '</div>';

  const days = document.getElementById('diag-days').value;
  const personality = document.getElementById('diag-personality').value;
  const params = new URLSearchParams({ days });
  if (personality) params.set('personality', personality);

  try {
    const data = await devFetch(`/diagnostics?${params}`);
    diagDataCache = data;

    renderDiagHealth(data);
    renderDiagIssueBreakdown(data);
    renderDiagPersonalityTable(data);
    renderDiagGlobalRecs(data);
    document.getElementById('diag-llm-results').style.display = 'none';
  } catch (e) {
    document.getElementById('diagnostics-health').innerHTML = `<div class="card"><div class="card-value red">Error</div><div class="card-sub">${e.message}</div></div>`;
  } finally {
    diagLoading = false;
    btn.disabled = false;
    btn.textContent = t('diag.analyze');
    if (btnLlm) btnLlm.disabled = false;
  }
}

function renderDiagHealth(data) {
  const ov = data.overview || {};
  const healthColor = ov.health === 'critical' ? 'red' : ov.health === 'attention' ? 'amber' : 'green';
  document.getElementById('diagnostics-health').innerHTML = `
    <div class="card-sm">
      <div class="label">${ov.healthLabel || t('diag.health_no_data')}</div>
      <div class="value" style="font-size:1.1rem;color:var(--accent-${healthColor})">${ov.passRate != null ? ov.passRate + '% ' + t('diag.health_pass') : '—'}</div>
      <div class="card-sub">${ov.totalEvaluations || 0} ${t('diag.health_evaluations')} · ${ov.period?.days || '?'} ${t('diag.health_days')}</div>
    </div>
    <div class="card-sm">
      <div class="label">${t('diag.avg_quality')}</div>
      <div class="value cyan">${ov.avgQuality != null ? ov.avgQuality + '/10' : '—'}</div>
      <div class="card-sub">Language: ${ov.avgLanguagePurity != null ? ov.avgLanguagePurity + '/10' : '—'}</div>
    </div>
    <div class="card-sm">
      <div class="label">${t('diag.avg_attempts')}</div>
      <div class="value ${ov.avgAttempts > 2 ? 'red' : ov.avgAttempts > 1.5 ? 'amber' : 'green'}">${ov.avgAttempts || '1.0'}</div>
      <div class="card-sub">${ov.forceApproved || 0} force_approved</div>
    </div>
    <div class="card-sm">
      <div class="label">${t('diag.hitl')}</div>
      <div class="value purple">${ov.humanDisagreements || 0}</div>
      <div class="card-sub">${ov.humanDownvotes || 0} downvotes</div>
    </div>
  `;
}

function renderDiagIssueBreakdown(data) {
  const issues = data.breakdownByIssue || {};
  const total = Object.values(issues).reduce((s, i) => s + i.count, 0) || 1;
  const ISSUE_LABELS = {
    humor: { label: t('diag.issue_humor'), color: '#f59e0b' },
    language: { label: t('diag.issue_language'), color: '#ef4444' },
    personality: { label: t('diag.issue_personality'), color: '#a855f7' },
    factuality: { label: t('diag.issue_factuality'), color: '#3b82f6' },
    none: { label: t('diag.issue_none'), color: '#22c55e' }
  };
  const sorted = Object.entries(issues).sort((a, b) => b[1].count - a[1].count);
  const html = sorted.map(([key, val]) => {
    const safeKey = key === null || key === undefined ? 'null' : key;
    const meta = ISSUE_LABELS[safeKey] || { label: safeKey === 'null' ? t('diag.issue_uncategorized') : safeKey, color: '#888' };
    const pct = Math.round((val.count / total) * 100);
    const trendIcon = val.trend === 'up' ? '📈' : val.trend === 'down' ? '📉' : '➡️';
    return `<div class="issue-card" style="border-left:3px solid ${meta.color};padding:0.6rem 0.8rem;background:var(--bg-card);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:600;font-size:0.85rem;">${meta.label}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">${val.count} casos · calidad ${val.avgQuality != null ? val.avgQuality + '/10' : '—'} ${trendIcon}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.1rem;font-weight:700;color:${meta.color};">${pct}%</div>
        <div style="width:60px;height:4px;background:var(--bg-input);border-radius:2px;margin-top:2px;">
          <div style="height:100%;border-radius:2px;width:${pct}%;background:${meta.color};"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('diag-breakdown-issue').innerHTML = html
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.5rem;">${html}</div>`
    : '<div class="text-muted" style="padding:0.5rem;">' + t('diag.no_issue_data') + '</div>';
}

function renderDiagPersonalityTable(data) {
  const personalities = data.byPersonality || [];
  if (!personalities.length) {
    document.getElementById('diag-personality-table').innerHTML = '<div class="text-muted" style="padding:0.5rem;">' + t('diag.no_personality_data') + '</div>';
    return;
  }

  const rows = personalities.map(p => {
    const passColor = p.passRate >= 80 ? 'green' : p.passRate >= 60 ? 'amber' : 'red';
    const issueBadge = p.topIssue && p.topIssue !== 'none'
      ? `<span class="badge badge-${p.topIssue === 'humor' ? 'error' : p.topIssue === 'language' ? 'error' : 'warning'}" style="font-size:0.65rem;">${p.topIssue} ${p.topIssuePct}%</span>`
      : '<span style="color:var(--text-muted);font-size:0.7rem;">✅ estable</span>';

    let recHtml = '';
    if (p.recommendation) {
      const sevColor = p.recommendation.severity === 'high' ? 'red' : p.recommendation.severity === 'medium' ? 'amber' : 'green';
      recHtml = `
        <div class="rec-block" style="background:rgba(255,255,255,0.03);border-radius:6px;padding:0.6rem;margin-top:0.4rem;border-left:3px solid var(--accent-${sevColor});">
          <div style="font-size:0.75rem;color:var(--accent-${sevColor});font-weight:600;">${sevColor === 'red' ? '🔴' : sevColor === 'amber' ? '🟡' : '🟢'} ${p.recommendation.summary || ''}</div>
          <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:0.25rem;">${p.recommendation.details || ''}</div>
          ${p.recommendation.suggestedActions ? `
            <div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">
              ${p.recommendation.suggestedActions.map(a => `
                <span style="font-size:0.65rem;padding:0.2rem 0.4rem;border-radius:4px;background:rgba(59,130,246,0.1);color:var(--accent-cyan);border:1px solid rgba(59,130,246,0.15);">
                  ${a.label} ${a.file ? `<code style="font-size:0.6rem;">${a.file}</code>` : ''}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>`;
    }

    return `
    <tr onclick="this.classList.toggle('row-selected');const n=this.nextElementSibling;if(n&&n.classList.contains('rec-row'))n.style.display=n.style.display==='none'?'':'none';">
      <td><strong>${p.personalityId}</strong></td>
      <td><span class="badge badge-${passColor}">${p.passRate}%</span></td>
      <td>${p.failRate}%</td>
      <td>${p.avgAttempts}</td>
      <td>${p.avgQuality != null ? p.avgQuality + '/10' : '—'}</td>
      <td>${issueBadge}</td>
    </tr>
    <tr class="rec-row" style="display:none;">
      <td colspan="6" style="padding:0 0.5rem 0.5rem 0.5rem;">${recHtml || '<div class="text-muted" style="padding:0.5rem;">' + t('diag.no_recs') + '</div>'}</td>
    </tr>`;
  }).join('');

  document.getElementById('diag-personality-table').innerHTML = `
    <table class="tbl" style="font-size:0.8rem;">
      <thead><tr>
        <th>Personalidad</th><th>Pass Rate</th><th>Fallo</th><th>Intentos</th><th>Calidad</th><th>Problema principal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderDiagGlobalRecs(data) {
  const recs = data.globalRecommendations || [];
  if (!recs.length) {
    document.getElementById('diag-global-recs').innerHTML = '<div class="text-muted" style="padding:0.5rem;">' + t('diag.no_global_recs') + '</div>';
    return;
  }

  const html = recs.map(r => `
    <div class="rec-global" style="padding:0.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;margin-bottom:0.5rem;border-left:3px solid ${r.severity === 'high' ? 'var(--accent-red)' : 'var(--accent-amber)'};">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <div style="font-size:0.8rem;font-weight:600;">${r.type === 'force_approved' ? t('diag.type_force_approved') : r.type === 'judge_calibration' ? t('diag.type_judge_calibration') : '💡 ' + r.type}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.25rem;">${r.message}</div>
        </div>
        <span class="badge badge-${r.severity === 'high' ? 'error' : 'warning'}" style="font-size:0.65rem;">${r.severity}</span>
      </div>
      ${r.suggestedActions ? `
        <div style="margin-top:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap;">
          ${r.suggestedActions.map(a => `
            <span style="font-size:0.65rem;padding:0.2rem 0.4rem;border-radius:4px;background:rgba(59,130,246,0.1);color:var(--accent-cyan);border:1px solid rgba(59,130,246,0.15);">
              ${a.label} · ${t('diag.impact')} ${a.impact}
            </span>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  document.getElementById('diag-global-recs').innerHTML = html;
}

async function runDiagnosticLLM() {
  if (diagLoading) return;
  diagLoading = true;

  if (!diagDataCache) {
    await loadDiagnostics();
    if (!diagDataCache) { diagLoading = false; return; }
  }

  const btn = document.getElementById('btn-diag-llm');
  const btnAnalyze = document.getElementById('btn-diag-analyze');
  btn.disabled = true;
  btn.textContent = t('diag.generating');
  if (btnAnalyze) btnAnalyze.disabled = true;

  const container = document.getElementById('diag-llm-results');
  container.style.display = 'block';
  container.innerHTML = '<div class="loading"><span class="spinner"></span> ' + t('diag.generating') + '</div>';

  try {
    const data = await devFetchPost('/diagnostics/analyze', {
      aggregateData: diagDataCache
    });

    const analysis = data.analysis || {};

    if (analysis.error) {
      container.innerHTML = `<div class="alert-banner alert-red">${t('diag.error')} ${t('diag.llm_analysis_error')}: ${analysis.error}</div>`;
      return;
    }

    let html = `
      <div style="background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(59,130,246,0.05));border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:1.25rem;margin-top:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <h3 style="margin:0;font-size:0.95rem;">${t('diag.llm_results_title')}</h3>
          <span style="font-size:0.65rem;color:var(--text-muted);">${data._meta?.model || ''} · ${data._meta?.personalitiesAnalyzed?.length || 0} ${t('diag.personalities')}</span>
        </div>
        ${analysis.globalNotes ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:1rem;padding:0.5rem;background:rgba(0,0,0,0.15);border-radius:6px;">${analysis.globalNotes}</div>` : ''}
    `;

    if (analysis.personalities && analysis.personalities.length) {
      html += '<div style="display:grid;gap:0.75rem;">';
      for (const p of analysis.personalities) {
        const impColor = p.impact === 'high' ? 'red' : p.impact === 'medium' ? 'amber' : 'green';
        html += `
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:0.75rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
              <strong style="font-size:0.85rem;">${p.personalityId}</strong>
              <span class="badge badge-${impColor}" style="font-size:0.6rem;">${t('diag.impact')} ${p.impact}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">${p.diagnosis || ''}</div>
            ${p.diffSuggestion ? `
              <div style="margin-top:0.5rem;background:rgba(0,0,0,0.2);border-radius:4px;padding:0.4rem;font-family:var(--mono);font-size:0.7rem;color:var(--accent-cyan);white-space:pre-wrap;">
                ${p.diffSuggestion}
                ${p.fileReference ? `<br><span style="color:var(--text-muted);font-size:0.65rem;">📁 ${p.fileReference}</span>` : ''}
              </div>
            ` : ''}
            ${p.alternativeActions && p.alternativeActions.length ? `
              <div style="margin-top:0.4rem;display:flex;gap:0.3rem;flex-wrap:wrap;">
                ${p.alternativeActions.map(a => `<span style="font-size:0.65rem;padding:0.15rem 0.35rem;border-radius:3px;background:rgba(255,255,255,0.05);color:var(--text-muted);">${a}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }
      html += '</div>';
    }

    html += '</div>';

    if (!analysis.personalities && !analysis.globalNotes) {
      html += '<div class="text-muted" style="padding:0.5rem;">' + t('diag.no_llm_results') + '</div>';
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="alert-banner alert-red">Error: ${e.message}</div>`;
    container.style.display = 'block';
  } finally {
    diagLoading = false;
    btn.disabled = false;
    btn.textContent = t('diag.llm_recommend');
    if (btnAnalyze) btnAnalyze.disabled = false;
  }
}

applyDataI18n();
const __langToggle = document.getElementById('lang-toggle');
if (__langToggle) __langToggle.textContent = currentLang === 'es' ? '🌐 EN' : '🌐 ES';

loadHealth();
loadLogs();
