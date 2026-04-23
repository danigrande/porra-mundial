# 🏆 Agente Mundial — Manual de Despliegue (Render.com)

Tu bot ya está configurado y funcionando localmente. Para que esté online 24/7, sigue estos pasos para subirlo a Render.

## 1. Preparar el código
Asegúrate de que todos los cambios estén guardados. No hace falta subir la carpeta `auth_info` ni `.env` a GitHub (están en el `.gitignore`), ya que las configuraremos en el panel de Render.

## 2. Crear el servicio en Render
1. Ve a [dashboard.render.com](https://dashboard.render.com).
2. Crea un nuevo **Web Service**.
3. Conecta tu repositorio de GitHub.
4. Configuración:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (o el que prefieras)

## 3. Configurar Variables de Entorno
En la pestaña **Environment** de tu servicio en Render, añade todas las variables de tu archivo `.env`:
- `GROQ_API_KEY`: Tu clave de Groq.
- `GOOGLE_SCRIPT_URL`: La URL de tu Google Sheets.
- `PHONE_DANI`: `34680859338`
- `WHATSAPP_GROUP_ID`: `120363422631481458@g.us`
- ... y el resto de teléfonos de tus amigos.

## 4. Persistencia de Sesión (IMPORTANTE)
Como el tier gratuito de Render no guarda archivos al reiniciar, la primera vez que lo despliegues tendrás que:
1. Mirar los **Logs** en el panel de Render.
2. Verás que te pide el **Código de Emparejamiento** (o saldrá un QR en texto).
3. Vincúlalo rápido desde tu móvil.
4. **Tip Pro**: Para que no se "duerma" (cold start), usa un servicio gratuito como [cron-job.org](https://cron-job.org) para que haga una petición a la URL de tu bot (ej: `https://tu-bot.onrender.com`) cada 10 minutos.

¡A disfrutar de la porra! ⚽🤠
