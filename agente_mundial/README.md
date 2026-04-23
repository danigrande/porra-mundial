# 🏆 Agente Mundial — Bot de WhatsApp para la Porra Mundial 2026

Un chatbot de WhatsApp que responde preguntas sobre la porra del Mundial 2026 con la personalidad del mítico **Andrés Montes**.

## ¿Qué hace?

- 🗣️ **Responde preguntas** de los jugadores: "¿Cómo voy?", "¿Quién va primero?", "¿Por qué tengo tan pocos puntos?"
- 📊 **Publica resúmenes** de la jornada automáticamente a las 23:00
- 🎭 **Personaliza** las respuestas según el perfil de cada jugador
- ⚡ **Ultra-rápido** gracias a Groq (respuestas en <1 segundo)

## Stack tecnológico (100% gratuito)

| Componente | Tecnología |
|-----------|------------|
| Mensajería | WhatsApp via [Baileys](https://github.com/WhiskeySockets/Baileys) |
| IA / LLM | [Groq](https://console.groq.com) (Llama 3.3 70B, tier gratuito) |
| Datos | Google Apps Script + Google Sheets (existente) |
| Hosting | [Render.com](https://render.com) (tier gratuito) |

## Requisitos previos

1. **Node.js 18+** instalado
2. **API Key de Groq** (gratis): [console.groq.com](https://console.groq.com)
3. **Número de WhatsApp** dedicado al bot (recomendado: SIM prepago)

## Instalación

```bash
# 1. Entra en la carpeta del bot
cd agente_mundial

# 2. Instala dependencias
npm install

# 3. Copia y configura las variables de entorno
cp .env.example .env
# Edita .env con tu API key de Groq y los teléfonos de tus amigos
```

## Configuración del `.env`

```env
# API key de Groq (obligatorio)
GROQ_API_KEY=gsk_tu_api_key

# Números de teléfono de los jugadores (sin +, sin espacios)
PHONE_DANI=34612345678
PHONE_JUDAS=34612345679
PHONE_HARRY=34612345680
PHONE_DANI_GRANDE=34612345681

# ID del grupo de WhatsApp (opcional, se obtiene de los logs)
WHATSAPP_GROUP_ID=
```

## Uso

### Ejecutar en local

```bash
npm start
```

1. Aparecerá un **código QR** en la consola
2. Abre WhatsApp en el teléfono del bot → Ajustes → Dispositivos vinculados → Vincular dispositivo
3. Escanea el QR
4. ¡Listo! El bot ya escucha mensajes

### Comandos que entiende el bot

En el grupo, los usuarios deben mencionar al bot ("agente", "bot") para activarlo:

| Mensaje | Qué hace |
|---------|----------|
| `agente, ¿cómo voy?` | Muestra posición y puntos del jugador |
| `bot, ¿quién va primero?` | Muestra el ranking general |
| `agente, ¿por qué tengo tan pocos puntos?` | Análisis personalizado |
| `bot, resumen` | Genera resumen de la jornada |
| `agente, ayuda` | Lista de comandos |

### Encontrar el ID del grupo

Cuando el bot esté conectado, envía un mensaje al grupo y mira los logs. Verás algo como:

```
💬 34612345678: "agente como voy..."
```

El ID del grupo aparecerá en formato `120363XXXXXXXXX@g.us`. Cópialo en `WHATSAPP_GROUP_ID` en tu `.env`.

## Despliegue en Render.com

1. Sube la carpeta `agente_mundial/` a un repo de GitHub
2. Ve a [render.com](https://render.com) → New Web Service
3. Conecta tu repo
4. Configura:
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Añade las variables de entorno (las mismas de `.env`)
6. Deploy 🚀

### ⚠️ Keep-alive (importante)

El tier gratuito de Render duerme el servicio tras 15 min sin tráfico. Para evitarlo:

1. Ve a [cron-job.org](https://cron-job.org) (gratis)
2. Crea un cron job que haga GET a `https://tu-app.onrender.com/health` cada 14 minutos
3. Esto mantiene el bot activo 24/7

## Estructura del proyecto

```
agente_mundial/
├── index.js            # Bot principal (WhatsApp + Express)
├── config.js           # Configuración centralizada
├── dataFetcher.js      # Obtiene datos de Google Sheets
├── scoringEngine.js    # Motor de puntuación
├── groqEngine.js       # Motor IA con Groq
├── messageHandler.js   # Lógica de mensajes
├── package.json        # Dependencias
├── .env.example        # Template de variables de entorno
├── .gitignore          # Ignora node_modules, auth, .env
└── Procfile            # Para Render.com
```

## Notas sobre seguridad

- **Baileys** es una librería no oficial. Existe un riesgo (bajo) de que Meta banee el número del bot
- Usa siempre un **número dedicado** (SIM prepago), nunca tu número personal
- Las credenciales de sesión se guardan en `./auth_info/` — no las subas a GitHub
- La API key de Groq va en `.env` — tampoco la subas a GitHub

## Licencia

Proyecto personal para la Porra Mundial 2026 🏆⚽
