  // Manejar estado de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('❌ Error de conexión:', reason, lastDisconnect?.error?.message);

      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada. Elimina ./auth_info y escanea QR de nuevo.');
      } else {
        console.log(`⚠️ Reconectando en 5s...`);
        setTimeout(startBot, 5000);
      }
    }

    if (connection === 'open') {
      console.log('\n✅ ¡Agente Mundial conectado a WhatsApp!\n');
      
      // Imprimir el string de la sesión para que el usuario pueda copiarlo a Render
      if (!process.env.WA_SESSION_DATA) {
        try {
          const creds = fs.readFileSync(`${AUTH_FOLDER}/creds.json`);
          const sessionString = creds.toString('base64');
          console.log('\n------------------ COPIA ESTA SESIÓN PARA RENDER ------------------');
          console.log(sessionString);
          console.log('-------------------------------------------------------------------\n');
          console.log('💡 Pega este texto largo en Render con el nombre: WA_SESSION_DATA\n');
        } catch (e) {
          console.error('Error al generar session string:', e.message);
        }
      }

      console.log(`📋 Escuchando mensajes${config.bot.groupId ? ' en grupo: ' + config.bot.groupId : ' (todos los chats)'}...`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        // Ignorar mensajes propios
        if (msg.key.fromMe) continue;

        // Extraer texto del mensaje
        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.buttonsResponseMessage?.selectedButtonId
          || msg.message?.listResponseMessage?.title
          || '';

        const chatId = msg.key.remoteJid;
        
        // Comprobar si el bot fue mencionado (oficialmente o por texto)
        const botId = sock.user?.id.split(':')[0];
        const botLid = sock.authState.creds.me?.lid?.split(':')[0]?.split('@')[0];
        
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isMentionedOfficial = mentionedJids.some(jid => 
          (botId && jid.includes(botId)) || (botLid && jid.includes(botLid))
        );
        
        const textLower = text.toLowerCase();
        const isMentionedText = (botId && text.includes('@' + botId)) || 
                               (botLid && text.includes('@' + botLid)) ||
                               textLower.includes('@agente') || 
                               textLower.includes('@bot');
        
        const isMentioned = isMentionedOfficial || isMentionedText;

        // En grupos, el emisor real suele estar en participant o participantAlt
        const rawSender = msg.key.participantAlt || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid || '';
        const senderPhone = rawSender.split('@')[0];

        console.log(`📥 Mensaje de ${senderPhone} (Nombre: ${msg.pushName || '?'}): "${text.substring(0, 50)}"`);
        if (isMentioned) console.log('   ✅ Mención detectada');

        if (!text.trim()) {
          continue;
        }

        // Determinar si es grupo o chat privado
        const isGroup = chatId?.endsWith('@g.us');

        // Si hay un grupo configurado, solo responder en ese grupo
        if (config.bot.groupId && isGroup && chatId !== config.bot.groupId) {
          console.log(`⏩ Mensaje de grupo ignorado (ID: ${chatId})`);
          continue;
        }

        // Procesar el mensaje
        const response = await processMessage(text, senderPhone, isGroup, isMentioned);

        if (response) {
          console.log(`🤖 Respondiendo a ${senderPhone}: "${response.substring(0, 50)}..."`);
          await sock.sendMessage(chatId, { text: response });
        }
      } catch (error) {
        console.error('Error procesando mensaje:', error);
      }
    }
  });
}
