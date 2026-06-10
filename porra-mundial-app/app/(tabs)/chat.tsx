import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
         KeyboardAvoidingView, Platform, ActivityIndicator, Image,
         Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { getAuth } from '../../stores/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as socketService from '../../services/socket';
import * as api from '../../services/api';
import { useTranslation } from '../../i18n/i18n';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import MessageBottomSheet from '../../components/MessageBottomSheet';
import InputBar from '../../components/InputBar';
import ChatMessageComponent from '../../components/ChatMessage';
import ChatbotFeedbackSheet from '../../components/ChatbotFeedbackSheet';

export default function ChatScreen() {
  const { groupName: paramGroupName } = useLocalSearchParams<{ groupName: string }>();
  const [messages, setMessages] = useState<socketService.ChatMessage[]>([]);
  const { t } = useTranslation();
  
  // Función para actualizar mensajes sin duplicados (Deduplicación Atómica)
  const setMessagesSafe = (updater: socketService.ChatMessage[] | ((prev: socketService.ChatMessage[]) => socketService.ChatMessage[])) => {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const seen = new Set();
      return next.filter(m => {
        if (!m._id || seen.has(m._id)) return false;
        seen.add(m._id);
        return true;
      });
    });
  };

  const [lastReadId, setLastReadId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUnreadMarker, setShowUnreadMarker] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<{name: string, userId: string, nickname?: string}[]>([]);

  // Reply state
  const [replyToMessage, setReplyToMessage] = useState<socketService.ChatMessage | null>(null);

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action sheet state
  const [actionMessage, setActionMessage] = useState<socketService.ChatMessage | null>(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<socketService.ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [socketConnected, setSocketConnected] = useState(true);
  const pendingMessagesRef = useRef<string[]>([]);
  const auth = getAuth();
  const groupName = paramGroupName || auth?.currentGroup || '';
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lista de mensajes única para la vista (Garantía total contra duplicados)
  const uniqueMessages = useMemo(() => {
    const seen = new Set();
    return messages.filter(m => {
      if (!m._id || seen.has(m._id) || blockedUsers.includes(m.senderId)) return false;
      if (m.deletedFor?.includes(auth?.userId || '')) return false;
      seen.add(m._id);
      return true;
    });
  }, [messages, blockedUsers, auth]);
  
  const [userFeedback, setUserFeedback] = useState<{[msgId: string]: 'up' | 'down'} | null>(null);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const canClearUnread = useRef(false);
  const isAtBottomRef = useRef(true);
  const messagesRef = useRef(messages);
  const showUnreadMarkerRef = useRef(showUnreadMarker);

  useEffect(() => {
    messagesRef.current = messages;
    showUnreadMarkerRef.current = showUnreadMarker;
  }, [messages, showUnreadMarker]);

  useEffect(() => {
    if (auth?.userId) {
        api.getBlockedUsers(auth.userId).then(setBlockedUsers).catch(console.error);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth || !groupName) {
      setLoading(false);
      return;
    }
    const socket = socketService.getSocket();

    // Bug fix: si el socket no existe todavía, no podemos registrar listeners.
    // Esto puede ocurrir si la app se relanza sin pasar por el login.
    // _layout.tsx ya llama a connectSocket() con los datos guardados, así que
    // en la práctica getSocket() debería devolver algo. Pero por seguridad, salimos
    // si es nulo (el usuario sería redirigido a login por el guard de _layout.tsx).
    if (!socket) {
      console.warn('[Chat] Socket no disponible al montar. Usando REST fallback.');
      loadHistory();
      return;
    }

    loadingTimeoutRef.current = setTimeout(() => {
      console.warn('[Chat] Timeout de carga, forzando REST fallback');
      loadHistory();
    }, 45000);

    const onNewMessage = (msg: socketService.ChatMessage) => {
      setMessagesSafe(prev => {
        const newMsgs = [...prev, msg];
        
        if (msg.senderId === auth?.userId || isAtBottomRef.current) {
          updateLastRead(msg._id);
          setShowUnreadMarker(false);
          setUnreadCount(0);
        } else {
          if (showUnreadMarkerRef.current) {
            setUnreadCount(prev => prev + 1);
          } else {
            setShowUnreadMarker(true);
            setUnreadCount(1);
          }
        }
        return newMsgs;
      });
      if (msg.senderId === auth?.userId) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    // Bug fix: si el socket se reconecta mientras el chat está abierto (p.ej. tras
    // pérdida de red), socket.ts ya re-emite join-group automáticamente. Aquí
    // escuchamos el evento 'connect' para resetear el estado de carga y esperar
    // el nuevo chat-history que mandará el servidor.
    const onSocketReconnect = () => {
      console.log('[Chat] Socket reconectado mientras el chat estaba abierto. Re-solicitando historial...');
      // Limpiar el timer del banner de desconexión en caso de reconexión rápida
      if (disconnectBannerTimerRef.current) {
        clearTimeout(disconnectBannerTimerRef.current);
        disconnectBannerTimerRef.current = null;
      }
      setSocketConnected(true);
      setLoading(true);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('[Chat] Timeout de carga tras reconexión, forzando REST fallback');
        loadHistory();
      }, 45000);
    };

    const onChatHistory = async (data: any) => {
      console.log('[Chat] Historial recibido:', data.messages?.length, 'mensajes');
      if (data.groupName === groupName) {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        setMessagesSafe(data.messages);
        setLoading(false);
        
        // El temporizador de "lectura permitida" empieza solo después de cargar el historial
        canClearUnread.current = false;
        setTimeout(() => {
          canClearUnread.current = true;
          console.log('[Unread] Lectura automática activada');
        }, 3000);
        
        // Mover aquí la lógica de mensajes no leídos
        const savedId = await AsyncStorage.getItem(`lastRead_${groupName}`);
        if (savedId && data.messages.length > 0) {
          setLastReadId(savedId);
          const index = data.messages.findIndex((m: any) => m._id === savedId);
          if (index !== -1) {
            if (index < data.messages.length - 1) {
              // Hay mensajes NO leídos después de este — scroll al primero no leído
              const count = data.messages.length - 1 - index;
              setUnreadCount(count);
              setShowUnreadMarker(true);
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ 
                  index: index + 1, 
                  animated: false,
                  viewPosition: 0,
                  viewOffset: 20 
                });
              }, 400);
              return;
            }
            // Último mensaje ya leído — scroll al final
          } else {
            // El último mensaje leído es más antiguo que el historial cargado
            // Mostrar botón "cargar más" y no scroll automático
            setUnreadCount(data.messages.length);
            setShowUnreadMarker(true);
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ 
                index: 0, 
                animated: false,
                viewPosition: 0,
              });
            }, 400);
            return;
          }
        }
        
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
      }
    };

    const onUserTyping = (data: any) => {
      if (data.groupName === groupName && data.userName !== auth.name) {
        setTypingUsers(prev => prev.includes(data.userName) ? prev : [...prev, data.userName]);
      }
    };

    const onUserStoppedTyping = (data: any) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.filter(name => name !== data.userName));
      }
    };

    const onBotTyping = (data: any) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.includes('Agente Mundial') ? prev : [...prev, 'Agente Mundial']);
      }
    };

    const onBotStoppedTyping = (data: any) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.filter(name => name !== 'Agente Mundial'));
      }
    };

    const onMessageReacted = (data: { messageId: string; reactions: { [emoji: string]: string[] } }) => {
      setMessagesSafe(prev => prev.map(m =>
        m._id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    };

    const onMessageEdited = (data: { messageId: string; newText: string; edited: boolean; editedAt: string }) => {
      setMessagesSafe(prev => prev.map(m =>
        m._id === data.messageId ? { ...m, text: data.newText, edited: true, editedAt: data.editedAt } : m
      ));
    };

    const onMessageDeleted = (data: { messageId: string; deleteFor: string; userId?: string }) => {
      if (data.deleteFor === 'everyone') {
        setMessagesSafe(prev => prev.filter(m => m._id !== data.messageId));
      } else if (data.deleteFor === 'me' && data.userId) {
        setMessagesSafe(prev => prev.map(m =>
          m._id === data.messageId
            ? { ...m, deletedFor: [...(m.deletedFor || []), data.userId!] }
            : m
        ));
      }
    };

    const onSocketDisconnect = () => {
      console.log('[Chat] Socket desconectado — esperando 4s antes de mostrar banner');
      // Delay para evitar parpadeo del banner "Reconectando..." durante
      // reconexiones breves (ej. ping timeout y reconexión automática)
      if (disconnectBannerTimerRef.current) clearTimeout(disconnectBannerTimerRef.current);
      disconnectBannerTimerRef.current = setTimeout(() => {
        setSocketConnected(false);
      }, 4000);
    };

    // Inicializar estado de conexión
    setSocketConnected(socket.connected);

    // 1. Registrar listeners PRIMERO
    socket.on('connect', onSocketReconnect);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('new-message', onNewMessage);
    socket.on('chat-history', onChatHistory);
    socket.on('user-typing', onUserTyping);
    socket.on('user-stopped-typing', onUserStoppedTyping);
    socket.on('bot-typing', onBotTyping);
    socket.on('bot-stopped-typing', onBotStoppedTyping);
    socket.on('message-reacted', onMessageReacted);
    socket.on('message-edited', onMessageEdited);
    socket.on('message-deleted', onMessageDeleted);

    // 2. Emitir join-group DESPUÉS de registrar listeners
    // Nota: loading ya está en true desde el estado inicial, no lo reseteamos aquí
    // para evitar una race condition donde chat-history llegue entre el registro
    // de listeners y este setLoading(true), dejando el spinner para siempre.
    socketService.joinGroup(groupName);

    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      if (disconnectBannerTimerRef.current) clearTimeout(disconnectBannerTimerRef.current);
      socket.off('connect', onSocketReconnect);
      socket.off('disconnect', onSocketDisconnect);
      socket.off('new-message', onNewMessage);
      socket.off('chat-history', onChatHistory);
      socket.off('user-typing', onUserTyping);
      socket.off('user-stopped-typing', onUserStoppedTyping);
      socket.off('bot-typing', onBotTyping);
      socket.off('bot-stopped-typing', onBotStoppedTyping);
      socket.off('message-reacted', onMessageReacted);
      socket.off('message-edited', onMessageEdited);
      socket.off('message-deleted', onMessageDeleted);
    };
  }, [auth, groupName]);

  // Eliminamos el useEffect que guardaba al desmontar porque era demasiado agresivo
  // y podía marcar como leído mensajes que el usuario aún no había visto bien.

  useEffect(() => {
    const loadLastRead = async () => {
      const savedId = await AsyncStorage.getItem(`lastRead_${groupName}`);
      setLastReadId(savedId);
    };
    loadLastRead();

    return () => {
      canClearUnread.current = false;
    };
  }, [groupName]);

  // Guardar el último mensaje al salir o actualizar
  const updateLastRead = async (id: string) => {
    await AsyncStorage.setItem(`lastRead_${groupName}`, id);
    setLastReadId(id);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    isAtBottomRef.current = isAtBottom;
    
    // Solo borramos la marca si el usuario está haciendo scroll de forma consciente
    if (isAtBottom && canClearUnread.current) {
      if (showUnreadMarkerRef.current) {
        setShowUnreadMarker(false);
        setUnreadCount(0);
      }
      // Siempre actualizamos el último leído si estamos al fondo
      if (messagesRef.current.length > 0) {
        const lastId = messagesRef.current[messagesRef.current.length - 1]._id;
        if (lastId !== lastReadId) updateLastRead(lastId);
      }
    }
  };

  async function loadHistory() {
    if (!groupName) return;
    console.log('[Chat] Cargando historial vía REST fallback...');
    try {
      const messages = await api.getChatHistory(groupName);
      if (Array.isArray(messages)) {
        setMessagesSafe(messages);
      }
    } catch (e: any) {
      console.warn('[Chat] REST fallback falló:', e.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // RENDERING
  // ==========================================

  useEffect(() => {
    if (groupName) {
      loadGroupMembers();
      
      // Escuchar cambios en el grupo en tiempo real
      const socket = socketService.getSocket();
      if (socket) {
        socket.on('group-updated', (data) => {
          if (data.groupName === groupName) {
            console.log('🔄 Lista de miembros actualizada por socket');
            loadGroupMembers();
          }
        });
      }

      return () => {
        if (socket) {
          socket.off('group-updated');
        }
      };
    }
  }, [groupName]);

  const loadGroupMembers = async () => {
    try {
      console.log(`[Chat] Cargando miembros para el grupo: "${groupName}"...`);
      const players = await api.getPlayers(groupName);
      console.log(`[Chat] Respuesta API jugadores:`, JSON.stringify(players).substring(0, 200));
      
      if (!players || players.length === 0) {
        console.warn('[Chat] ⚠️ La API devolvió 0 jugadores para este grupo');
      }

      // Añadir las opciones "@Agente" y "@Todos" manualmente
      setGroupMembers([
        { name: 'agente', userId: 'bot', nickname: 'Agente' },
        { name: 'todos', userId: 'all', nickname: 'Todos' },
        ...players
      ]);
    } catch (e) {
      console.error('Error cargando miembros:', e);
    }
  };

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState({ position: 0, duration: 1 });
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const playAudio = async (messageId: string, uri: string) => {
    try {
      if (playingId === messageId && soundObject) {
        await soundObject.stopAsync();
        setPlayingId(null);
        return;
      }
      if (soundObject) {
        await soundObject.unloadAsync();
        setSoundObject(null);
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri }, { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPlaybackStatus({ position: status.positionMillis, duration: status.durationMillis || 1 });
            if (status.didJustFinish) setPlayingId(null);
          }
        }
      );
      setSoundObject(sound);
      setPlayingId(messageId);
    } catch (e) {
      console.error('Error reproduciendo audio:', e);
      Alert.alert(t('common.error'), t('chat.audio_play_error'));
    }
  };

  // ==========================================
  // RENDERING
  // ==========================================

  const handleMessageAction = (message: socketService.ChatMessage) => {
    setActionMessage(message);
  };

  const sendReport = async (message: socketService.ChatMessage, reason: string) => {
    try {
      await api.reportContent({
        reporterId: auth?.userId || '',
        reportedId: message.senderId,
        messageId: message._id,
        reason
      });
      Alert.alert(t('chat.reported_title'), t('chat.reported_msg'));
    } catch (e) {
      Alert.alert(t('common.error'), t('chat.report_error'));
    }
  };

  const [editMessageText, setEditMessageText] = useState('');
  const [editMessageIdKey, setEditMessageIdKey] = useState(0);

  const startEdit = (message: socketService.ChatMessage) => {
    setEditingMessageId(message._id);
    setEditMessageText(message.text || '');
    setEditMessageIdKey(k => k + 1);
    setReplyToMessage(null);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditMessageText('');
    setEditMessageIdKey(k => k + 1);
  };

  const toggleReaction = (messageId: string, emoji: string, userId: string | undefined) => {
    if (!userId) return;
    const msg = messages.find(m => m._id === messageId);
    const users = msg?.reactions?.[emoji] || [];
    const add = !users.includes(userId);
    socketService.reactToMessage(messageId, emoji, add);
  };

  const handleDeleteSheet = (message: socketService.ChatMessage, scope: 'me' | 'everyone') => {
    setActionMessage(null);
    socketService.deleteMessage(message._id, scope, groupName);
  };

  const handleBlockSheet = async (message: socketService.ChatMessage) => {
    setActionMessage(null);
    Alert.alert(t('chat.block_user'), t('chat.block_confirm', { name: message.senderName }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('chat.block_action'), style: 'destructive', onPress: async () => {
        try {
          await api.blockUser(auth?.userId || '', message.senderId, groupName);
          setBlockedUsers(prev => [...prev, message.senderId]);
          Alert.alert(t('common.success'), t('chat.block_success'));
        } catch (e: any) {
          Alert.alert(t('common.error'), e.message || 'Error');
        }
      }},
    ]);
  };

  const handleSheetReact = (message: socketService.ChatMessage, emoji: string) => {
    toggleReaction(message._id, emoji, auth?.userId);
  };

  const handleFeedbackUp = useCallback(async (msgId: string) => {
    if (!auth?.userId || !auth?.name) return;
    try {
      await api.submitChatbotFeedback({ messageId: msgId, userId: auth.userId, userName: auth.name, rating: 'up' });
      setUserFeedback(prev => ({ ...prev, [msgId]: 'up' }));
    } catch (e) {
      console.error('Feedback up error:', e);
    }
  }, [auth]);

  const handleFeedbackDown = useCallback((msgId: string) => {
    if (!auth?.userId || !auth?.name) return;
    setFeedbackMessageId(msgId);
  }, [auth]);

  const handleFeedbackSubmitted = useCallback((msgId: string, rating: 'up' | 'down', _reason?: string) => {
    setUserFeedback(prev => ({ ...prev, [msgId]: rating }));
  }, []);

  const handleScrollToMessage = useCallback((msgId: string) => {
    const idx = uniqueMessages.findIndex(m => m._id === msgId);
    if (idx !== -1) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
  }, [uniqueMessages]);

  const renderMessage = ({ item, index }: { item: socketService.ChatMessage, index: number }) => {
    const isMe = item.senderId === auth?.userId;
    const showDate = index === 0 || new Date(messages[index - 1]?.timestamp).toDateString() !== new Date(item.timestamp).toDateString();
    const dateLabel = new Date(item.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const isFirstUnread = showUnreadMarker && lastReadId && messages[index - 1]?._id === lastReadId;
    const isEditing = editingMessageId === item._id;

    return (
      <ChatMessageComponent
        item={item}
        isMe={isMe}
        showDate={showDate}
        dateLabel={dateLabel}
        isFirstUnread={!!isFirstUnread}
        unreadCount={unreadCount}
        isEditing={isEditing}
        selectMode={selectMode}
        selectedIds={selectedIds}
        playingId={playingId}
        playbackStatus={playbackStatus}
        messageIndex={index}
        totalMessages={messages.length}
        lastReadId={lastReadId}
        showUnreadMarker={showUnreadMarker}
        messages={messages}
        authUserId={auth?.userId || ''}
        groupName={groupName}
        onToggleSelect={(id) => {
          const next = new Set(selectedIds);
          if (next.has(id)) next.delete(id); else next.add(id);
          setSelectedIds(next);
        }}
        onLongPress={handleMessageAction}
        onReply={(msg) => setReplyToMessage(msg)}
        onPlayAudio={(id, uri) => playAudio(id, uri)}
        onToggleReaction={(id, emoji, uid) => toggleReaction(id, emoji, uid)}
        onScrollToMessage={handleScrollToMessage}
        onSetSelectedImage={setSelectedImageUrl}
        onFeedbackUp={handleFeedbackUp}
        onFeedbackDown={handleFeedbackDown}
        userFeedback={userFeedback}
      />
    );
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#f5a623" /></View>;

  return (
    <BottomSheetModalProvider>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>

      {/* Barra de estado de conexión */}
      {!socketConnected && (
        <View style={styles.connectionBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={styles.connectionBannerText}>{t('chat.reconnecting')}</Text>
        </View>
      )}

      {/* Visor de imagen a pantalla completa */}
      <Modal visible={!!selectedImageUrl} transparent animationType="fade" onRequestClose={() => setSelectedImageUrl(null)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setSelectedImageUrl(null)}
        >
          {selectedImageUrl && (
            <Image
              source={{ uri: selectedImageUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}
            onPress={() => setSelectedImageUrl(null)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Chat header actions */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setShowSearch(s => !s)} style={styles.chatHeaderBtn}>
          <Ionicons name="search" size={20} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSelectMode(s => !s)} style={styles.chatHeaderBtn}>
          <Ionicons name="checkbox-outline" size={20} color={selectMode ? '#60a5fa' : '#94a3b8'} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={uniqueMessages}
        keyExtractor={item => item._id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollToIndexFailed={info => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
          });
        }}
        removeClippedSubviews={Platform.OS === 'android'}
        windowSize={5}
        maxToRenderPerBatch={15}
        initialNumToRender={12}
      />

      {showUnreadMarker && (
        <TouchableOpacity 
          style={styles.floatingUnread} 
          onPress={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
            setShowUnreadMarker(false);
            if (messages.length > 0) updateLastRead(messages[messages.length - 1]._id);
          }}
        >
          <Ionicons name="chevron-down" size={24} color="#fff" />
          <View style={styles.unreadBadge} />
        </TouchableOpacity>
      )}

      {typingUsers.length > 0 && <View style={styles.typingIndicator}><Text style={styles.typingText}>{typingUsers.join(', ')} {t('chat.typing')}</Text></View>}

      {/* SEARCH BAR */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('chat.search_placeholder')}
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={async (val) => {
              setSearchQuery(val);
              if (!val.trim()) { setSearchResults([]); return; }
              setIsSearching(true);
              try {
                const res = await api.searchChat(groupName, val.trim());
                setSearchResults(res || []);
                setSearchIndex(0);
              } catch (e) { setSearchResults([]); }
              setIsSearching(false);
            }}
            autoFocus
          />
          {isSearching && <ActivityIndicator size="small" color="#f5a623" />}
          {searchResults.length > 0 && (
            <Text style={{ color: '#64748b', fontSize: 12, marginHorizontal: 4 }}>
              {searchIndex + 1}/{searchResults.length}
            </Text>
          )}
          <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* SELECTION MODE BAR */}
      {selectMode && (
        <View style={styles.selectionBar}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('chat.selected_count', { count: selectedIds.size })}</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
            onPress={() => {
              Alert.alert(t('chat.delete_selected'), t('chat.delete_selected_confirm', { count: selectedIds.size }), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('chat.delete_me'), onPress: () => {
                  selectedIds.forEach(id => socketService.deleteMessage(id, 'me', groupName));
                  setSelectedIds(new Set());
                  setSelectMode(false);
                }},
              ]);
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13 }}>🗑️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <InputBar
        groupName={groupName}
        auth={auth}
        replyToMessage={replyToMessage}
        editingMessageId={editingMessageId}
        editMessageText={editMessageText}
        groupMembers={groupMembers}
        onCancelReply={() => setReplyToMessage(null)}
        onCancelEdit={cancelEdit}
      />

      <ChatbotFeedbackSheet
        messageId={feedbackMessageId}
        userId={auth?.userId || ''}
        userName={auth?.name || ''}
        onClose={() => setFeedbackMessageId(null)}
        onSubmitted={handleFeedbackSubmitted}
      />

      <MessageBottomSheet
        message={actionMessage}
        isMe={actionMessage?.senderId === auth?.userId}
        canEdit={
          !!actionMessage &&
          actionMessage.senderId === auth?.userId &&
          actionMessage.type === 'text' &&
          Date.now() - new Date(actionMessage.timestamp).getTime() < 15 * 60 * 1000
        }
        onClose={() => setActionMessage(null)}
        onReply={(msg) => { setReplyToMessage(msg); setActionMessage(null); }}
        onEdit={(msg) => { startEdit(msg); setActionMessage(null); }}
        onDelete={(msg, scope) => handleDeleteSheet(msg, scope)}
        onReport={(msg, reason) => { sendReport(msg, reason); setActionMessage(null); }}
        onBlock={(msg) => handleBlockSheet(msg)}
        onReact={(msg, emoji) => handleSheetReact(msg, emoji)}
      />
    </KeyboardAvoidingView>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27', overflow: 'hidden' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e27' },
  listContent: { padding: 16, paddingBottom: 24 },
  typingIndicator: { paddingHorizontal: 20, paddingVertical: 4 },
  typingText: { color: '#64748b', fontSize: 12 },
  floatingUnread: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  unreadBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#1e40af'
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151a3a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 4 },

  // Chat header
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
    backgroundColor: '#0a0e27',
  },
  chatHeaderBtn: { padding: 4 },

  // Selection mode bar
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  // Connection status banner
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    gap: 6,
  },
  connectionBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
