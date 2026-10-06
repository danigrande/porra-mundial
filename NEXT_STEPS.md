# Next Steps — Feedback-to-PRD Pipeline

## Pendientes del usuario (manual)

- [ ] **Crear cuenta en DataStax LangFlow** (gratis) en https://astra.datastax.com
- [ ] **Importar `prediccion mundial.json`** en DataStax y verificar que funciona
- [ ] **Configurar Global Variable** `GROQ_API_KEY` en DataStax Settings
- [ ] **Obtener la URL base de DataStax** (tipo `https://api.langflow.astra.datastax.com`)
- [ ] **Configurar env vars en Render**: `LANGFLOW_FLOW_ID` y `LANGBASE_URL`
- [ ] **Hacer deploy** en Render
- [ ] **Probar el pipeline completo**: dev dashboard → analizar feedback → generar PRD → aprobar

## Pendientes del agente (automático)

- [ ] **Añadir `.env` a `.gitignore`** si no lo está ya (confirmado: `agente_mundial/.gitignore` ya lo excluye)
- [ ] **Mejorar `langflowService.js`**: parsear la respuesta del flow para extraer correctamente el JSON del PM-Agent-Orchestrator
- [ ] **Mejorar `extractPRDFromAnalysis()`**: adaptarlo al schema real de salida del flow
- [ ] **Añadir autenticación al endpoint `/api/prds/approved`** para que solo el coding agent autorizado pueda leer PRDs
- [ ] **Añadir paginación a `/api/prds/approved`** para cuando haya muchos PRDs aprobados
