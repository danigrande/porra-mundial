import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Keyboard, Modal, Alert, ScrollView, Animated, PanResponder } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { getAuth } from '../../stores/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as socketService from '../../services/socket';
import * as api from '../../services/api';
import { useTranslation } from '../../i18n/i18n';

const EMOJIS = [
  '⚽', '🏆', '🔥', '👏', '🙌', '🤣', '😭', '🤯', '💪', '🇸🇦', '🇲🇽', '🇪🇸', '🇦🇷', '🇧🇷', '🇫🇷',
  '😎', '🤩', '🥳', '🤔', '🙄', '😱', '🤫', '🫠', '🤡', '👽', '👾', '🤖', '👑', '💎', '✨',
  '🥅', '🏟️', '🏅', '🥇', '🥈', '🥉', '🏁', '🚩', '📣', '📢', '🔔', '🎵', '🎶', '🍺',
  '🍔', '🍕', '🌮', '🍦', '🍩', '🥤', '🌎', '🌍', '🌏', '🌋', '🚀', '🛸', '🛰️', '⏳', '⌛'
];
const STICKERS: string[] = []; // Los cargaremos dinámicamente

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
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');

  // GIF State
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);

  // Audio state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recentStickers, setRecentStickers] = useState<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<{name: string, phone: string, nickname?: string}[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  
  // Lista de mensajes única para la vista (Garantía total contra duplicados)
  const uniqueMessages = useMemo(() => {
    const seen = new Set();
    // Filtrar duplicados Y bloqueados
    return messages.filter(m => {
      if (!m._id || seen.has(m._id) || blockedUsers.includes(m.senderId)) return false;
      seen.add(m._id);
      return true;
    });
  }, [messages, blockedUsers]);
  
  const flatListRef = useRef<FlatList>(null);
  const canClearUnread = useRef(false);
  const isAtBottomRef = useRef(true);
  const messagesRef = useRef(messages);
  const showUnreadMarkerRef = useRef(showUnreadMarker);
  const auth = getAuth();
  const groupName = paramGroupName || auth?.currentGroup || '';

  useEffect(() => {
    messagesRef.current = messages;
    showUnreadMarkerRef.current = showUnreadMarker;
  }, [messages, showUnreadMarker]);

  useEffect(() => {
    if (auth?.phone) {
        api.getBlockedUsers(auth.phone).then(setBlockedUsers).catch(console.error);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth || !groupName) return;
    const socket = socketService.getSocket();

    // Bug fix: si el socket no existe todavía, no podemos registrar listeners.
    // Esto puede ocurrir si la app se relanza sin pasar por el login.
    // _layout.tsx ya llama a connectSocket() con los datos guardados, así que
    // en la práctica getSocket() debería devolver algo. Pero por seguridad, salimos
    // si es nulo (el usuario sería redirigido a login por el guard de _layout.tsx).
    if (!socket) {
      console.warn('[Chat] Socket no disponible al montar. El layout debería reconectar.');
      return;
    }

    const onNewMessage = (msg: socketService.ChatMessage) => {
      setMessagesSafe(prev => {
        const newMsgs = [...prev, msg];
        
        if (msg.senderId === auth.phone || isAtBottomRef.current) {
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
      if (msg.senderId === auth.phone) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    // Bug fix: si el socket se reconecta mientras el chat está abierto (p.ej. tras
    // pérdida de red), socket.ts ya re-emite join-group automáticamente. Aquí
    // escuchamos el evento 'connect' para resetear el estado de carga y esperar
    // el nuevo chat-history que mandará el servidor.
    const onSocketReconnect = () => {
      console.log('[Chat] Socket reconectado mientras el chat estaba abierto. Re-solicitando historial...');
      setLoading(true);
      // join-group ya se emite en socket.ts en el handler de 'connect',
      // lo que disparará chat-history en el servidor. Solo necesitamos ponernos
      // en estado loading para mostrar el spinner hasta que llegue.
    };

    const onChatHistory = async (data: any) => {
      console.log('[Chat] Historial recibido:', data.messages?.length, 'mensajes');
      if (data.groupName === groupName) {
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
          if (index !== -1 && index < data.messages.length - 1) {
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

    // 1. Registrar listeners PRIMERO
    socket.on('connect', onSocketReconnect);
    socket.on('new-message', onNewMessage);
    socket.on('chat-history', onChatHistory);
    socket.on('user-typing', onUserTyping);
    socket.on('user-stopped-typing', onUserStoppedTyping);
    socket.on('bot-typing', onBotTyping);
    socket.on('bot-stopped-typing', onBotStoppedTyping);

    // 2. Emitir join-group DESPUÉS de registrar listeners
    setLoading(true);
    socketService.joinGroup(groupName);

    return () => {
      socket.off('connect', onSocketReconnect);
      socket.off('new-message', onNewMessage);
      socket.off('chat-history', onChatHistory);
      socket.off('user-typing', onUserTyping);
      socket.off('user-stopped-typing', onUserStoppedTyping);
      socket.off('bot-typing', onBotTyping);
      socket.off('bot-stopped-typing', onBotStoppedTyping);
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

  // loadHistory queda como respaldo o para recarga manual si fuera necesario, 
  // pero desactivamos su uso automático para evitar duplicados con el socket.
  async function loadHistory() {
    // console.log('loadHistory (REST) desactivado en favor del socket');
  }

  // ==========================================
  // GIF SEARCH
  // ==========================================
  useEffect(() => {
    if (pickerTab === 'gif') {
      searchGifs(gifSearch || 'football goals');
    }
  }, [gifSearch, pickerTab]);

  const createSticker = async () => {
    try {
      console.log('Abriendo galería para sticker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        console.log('Subiendo sticker...', result.assets[0].uri);
        // Usar 'image' como tipo de archivo pero marcar como sticker
        const serverUrl = await api.uploadFile(result.assets[0].uri, 'image');
        console.log('Sticker subido con éxito:', serverUrl);
        setRecentStickers(prev => [serverUrl, ...prev.slice(0, 19)]);
        sendMedia('sticker', serverUrl);
      }
    } catch (e) {
      console.error('Error en createSticker:', e);
      Alert.alert('Error', 'No se pudo crear el sticker');
    }
  };

  const searchGifs = async (query: string) => {
    setGifsLoading(true);
    try {
      const response = await api.searchGiphy(query || 'football');
      if (response && Array.isArray(response)) {
        setGifs(response);
      } else {
        setGifs([]);
      }
    } catch (e: any) {
      console.error('[GIPHY] Error:', e.message);
      setGifs([]);
    } finally {
      setGifsLoading(false);
    }
  };

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
        { name: 'agente', phone: 'bot', nickname: 'Agente' },
        { name: 'todos', phone: 'all', nickname: 'Todos' },
        ...players
      ]);
    } catch (e) {
      console.error('Error cargando miembros:', e);
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    
    // Detectar si el último caracter o palabra sugiere una mención
    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const textAfterAt = val.slice(lastAtPos + 1);
      // Solo mostrar si no hay espacios después del @ o es el final
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    if (val.length > 0 && !isTyping) {
      socketService.sendTyping(groupName);
      setIsTyping(true);
    } else if (val.length === 0 && isTyping) {
      socketService.sendStopTyping(groupName);
      setIsTyping(false);
    }
  };

  const insertMention = (member: any) => {
    const lastAtPos = text.lastIndexOf('@');
    const displayName = member.nickname || member.name || 'Usuario';
    const newText = text.slice(0, lastAtPos) + `@${displayName} `;
    setText(newText);
    setShowMentions(false);
  };

  const handleSend = () => {
    if (!text.trim() || !auth) return;
    // Bug fix: sendMessage devuelve false si el socket no está conectado
    const sent = socketService.sendMessage(groupName, text, 'text');
    if (!sent) {
      Alert.alert(
        'Sin conexión',
        'No se pudo enviar el mensaje. Comprueba tu conexión a internet e inténtalo de nuevo.',
        [{ text: 'OK' }]
      );
      return;
    }
    setText('');
    socketService.sendStopTyping(groupName);
    setIsTyping(false);
    setShowPicker(false);
  };

  const sendMedia = (type: 'image' | 'sticker' | 'gif', url: string) => {
    socketService.sendMessage(groupName, undefined, type, url);
    setShowPicker(false);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        // Subir al servidor primero
        const serverUrl = await api.uploadFile(result.assets[0].uri, 'image');
        socketService.sendMessage(groupName, undefined, 'image', serverUrl);
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('chat.upload_error'));
    }
  };

  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState({ position: 0, duration: 1 });
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);

  const playAudio = async (messageId: string, uri: string) => {
    try {
      // Si ya está sonando este mismo audio, lo paramos
      if (playingId === messageId && soundObject) {
        await soundObject.stopAsync();
        setPlayingId(null);
        return;
      }

      // Si está sonando otro, lo paramos primero
      if (soundObject) {
        await soundObject.unloadAsync();
        setSoundObject(null);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPlaybackStatus({
              position: status.positionMillis,
              duration: status.durationMillis || 1
            });
            if (status.didJustFinish) {
              setPlayingId(null);
            }
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

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (!text.trim()) {
          startRecording();
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < -60 && !isLocked) {
          setIsLocked(true);
          // Opcional: vibración corta si fuera posible
        }
      },
      onPanResponderRelease: () => {
        if (!isLocked) {
          stopRecording(true);
        }
      },
    })
  ).current;

  const startRecording = async () => {
    try {
      // Limpiar grabación anterior si existiera por error
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      setIsLocked(false);

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('Error al empezar a grabar:', err);
      setRecording(null);
    }
  };

  const stopRecording = async (force = false) => {
    if (!recording) return;
    // Si está bloqueado y no es un "force" (botón enviar), no paramos
    if (isLocked && !force) return;

    setIsRecording(false);
    setIsLocked(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Importante: Volver al modo de reproducción normal
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setRecording(null);

      if (uri) {
        const serverUrl = await api.uploadFile(uri, 'audio');
        socketService.sendMessage(groupName, 'Nota de voz enviada', 'audio', serverUrl);
      }
    } catch (e) {
      console.error('Error al parar de grabar:', e);
      setRecording(null);
      Alert.alert(t('common.error'), t('chat.audio_send_error'));
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setIsLocked(false);
    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    } catch (e) {
      setRecording(null);
    }
  };

  // ==========================================
  // RENDERING
  // ==========================================

  const formatMillis = (millis: number) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = ((millis % 60000) / 1000).toFixed(0);
    return `${minutes}:${(parseInt(seconds) < 10 ? '0' : '')}${seconds}`;
  };

  const handleMessageAction = (message: socketService.ChatMessage) => {
    const isMe = message.senderId === auth?.phone;
    if (isMe) return; // No te puedes reportar a ti mismo

    Alert.alert(
      'Acciones de Mensaje',
      `¿Qué quieres hacer con el mensaje de ${message.senderName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: t('chat.report_content'),
          onPress: () => {
            Alert.alert(
              t('chat.report_title'),
              t('chat.report_prompt'),
              [
                { text: t('chat.report_spam'), onPress: () => sendReport(message, 'Spam') },
                { text: t('chat.report_harassment'), onPress: () => sendReport(message, 'Acoso') },
                { text: t('chat.report_inappropriate'), onPress: () => sendReport(message, 'Contenido inapropiado') },
                { text: t('common.cancel'), style: 'cancel' }
              ]
            );
          }
        },
        {
          text: t('chat.block_user'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('chat.block_user'), t('chat.block_confirm', { name: message.senderName }), [
              { text: t('common.cancel'), style: 'cancel' },
              { 
                text: t('chat.block_action'), 
                style: 'destructive', 
                onPress: async () => {
                  try {
                    await api.blockUser(auth?.phone || '', message.senderId, groupName);
                    setBlockedUsers(prev => [...prev, message.senderId]);
                    Alert.alert(t('common.success'), t('chat.block_success'));
                  } catch (e: any) {
                    Alert.alert(t('common.error'), e.message || 'Error');
                  }
                } 
              }
            ]);
          }
        }
      ]
    );
  };

  const sendReport = async (message: socketService.ChatMessage, reason: string) => {
    try {
      await api.reportContent({
        reporterPhone: auth?.phone || '',
        reportedUser: message.senderName,
        messageId: message._id,
        reason
      });
      Alert.alert(t('chat.reported_title'), t('chat.reported_msg'));
    } catch (e) {
      Alert.alert(t('common.error'), t('chat.report_error'));
    }
  };

  // Función para renderizar el texto del mensaje con menciones resaltadas
  const renderMessageText = (text: string) => {
    if (!text) return null;
    
    // Regex para detectar menciones (ej: @Dani, @todos, @Arafat)
    const parts = text.split(/(@\w+)/g);
    
    return (
      <Text style={styles.messageText}>
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            return (
              <Text key={index} style={styles.mentionHighlight}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const renderMessage = ({ item, index }: { item: socketService.ChatMessage, index: number }) => {
    const isMe = item.senderId === auth?.phone;
    const showDate = index === 0 || new Date(messages[index - 1].timestamp).toDateString() !== new Date(item.timestamp).toDateString();
    const dateLabel = new Date(item.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    
    // El marcador aparece justo ANTES del primer mensaje no leído
    const isFirstUnread = showUnreadMarker && lastReadId && messages[index - 1]?._id === lastReadId;

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} /><Text style={styles.dateText}>{dateLabel}</Text><View style={styles.dateLine} />
          </View>
        )}

        {isFirstUnread && (
          <View style={styles.unreadSeparator}>
            <View style={styles.unreadLine} />
            <View style={styles.unreadTag}>
              <Ionicons name="arrow-down" size={12} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.unreadText}>{unreadCount} {unreadCount === 1 ? t('chat.unread_single') : t('chat.unread_plural')}</Text>
            </View>
            <View style={styles.unreadLine} />
          </View>
        )}

        <View style={[styles.messageRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
          {!isMe && (
            <View style={[styles.avatar, { backgroundColor: item.isBot ? '#4c1d95' : '#3b82f6' }]}>
              <Text style={styles.avatarText}>{item.isBot ? '🏆' : item.senderName[0].toUpperCase()}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handleMessageAction(item)}
            style={[
              styles.messageBubble,
              isMe ? styles.messageMe : item.isBot ? styles.messageBot : styles.messageOther,
              (item.type === 'sticker' || item.type === 'gif') && { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }
            ]}
          >
            {!isMe && <Text style={[styles.senderName, item.isBot && { color: '#a78bfa' }]}>{item.senderName}</Text>}

            {(item.type === 'text' || !item.type) && renderMessageText(item.text || '')}

            {item.type === 'image' && (
              <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} resizeMode="cover" />
            )}

            {item.type === 'sticker' && (
              <Image source={{ uri: item.mediaUrl }} style={styles.messageSticker} resizeMode="contain" />
            )}

            {item.type === 'gif' && (
              <Image source={{ uri: item.mediaUrl }} style={styles.messageGif} resizeMode="cover" />
            )}

            {item.type === 'audio' && (
              <TouchableOpacity style={styles.audioContainer} onPress={() => playAudio(item._id, item.mediaUrl || '')}>
                <Ionicons
                  name={playingId === item._id ? "pause" : "play"}
                  size={24}
                  color="#fff"
                />
                <View style={styles.audioBar}>
                  <View style={[styles.audioProgress, {
                    width: playingId === item._id
                      ? `${(playbackStatus.position / playbackStatus.duration) * 100}%`
                      : '0%'
                  }]} />
                </View>
                <Text style={styles.audioDuration}>
                  {playingId === item._id
                    ? formatMillis(playbackStatus.position)
                    : t('chat.voice_note')}
                </Text>
              </TouchableOpacity>
            )}

            {item.isBot && item.type === 'text' && (
              <Text style={{ fontSize: 9, color: '#a78bfa', marginTop: 4, fontStyle: 'italic' }}>
                {t('chat.ai_disclaimer')}
              </Text>
            )}

            {item.type !== 'sticker' && item.type !== 'gif' && (
              <View style={styles.messageMeta}>
                <Text style={styles.timeText}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMe && <MaterialCommunityIcons name="check-all" size={14} color="#3b82f6" style={{ marginLeft: 4 }} />}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#f5a623" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={uniqueMessages}
        keyExtractor={item => item._id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollToIndexFailed={info => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
          });
        }}
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

      {showPicker && !isRecording && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerTabs}>
            <TouchableOpacity onPress={() => setPickerTab('emoji')} style={[styles.pickerTab, pickerTab === 'emoji' && styles.pickerTabActive]}>
              <MaterialCommunityIcons name="emoticon-outline" size={24} color={pickerTab === 'emoji' ? '#fff' : '#64748b'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickerTab('sticker')} style={[styles.pickerTab, pickerTab === 'sticker' && styles.pickerTabActive]}>
              <MaterialIcons name="sticky-note-2" size={24} color={pickerTab === 'sticker' ? '#fff' : '#64748b'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickerTab('gif')} style={[styles.pickerTab, pickerTab === 'gif' && styles.pickerTabActive]}>
              <MaterialCommunityIcons name="file-gif-box" size={24} color={pickerTab === 'gif' ? '#fff' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContent}>
            {pickerTab === 'emoji' && (
              <ScrollView contentContainerStyle={styles.emojiList}>
                {EMOJIS.map((e, index) => (
                  <TouchableOpacity key={`${e}-${index}`} onPress={() => setText(t => t + e)} style={styles.emojiItem}>
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {pickerTab === 'sticker' && (
              <ScrollView style={{ flex: 1 }}>
                <View style={styles.stickerGrid}>
                  <TouchableOpacity style={styles.addStickerItem} onPress={createSticker}>
                    <View style={styles.addStickerBox}>
                      <Ionicons name="add" size={30} color="#f5a623" />
                    </View>
                    <Text style={styles.addStickerLabel}>{t('common.new')}</Text>
                  </TouchableOpacity>

                  {recentStickers.map((url, idx) => (
                    <TouchableOpacity key={idx} onPress={() => sendMedia('sticker', url)} style={styles.stickerItem}>
                      <Image source={{ uri: url }} style={styles.stickerThumb} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {pickerTab === 'gif' && (
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.gifSearch}
                  placeholder={t('chat.gif_search')}
                  placeholderTextColor="#64748b"
                  value={gifSearch}
                  onChangeText={setGifSearch}
                />
                <Text style={{ color: '#64748b', fontSize: 10, textAlign: 'center', marginBottom: 5 }}>Powered by GIPHY</Text>
                {gifsLoading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
                  <ScrollView 
                    contentContainerStyle={styles.gifGrid}
                    keyboardShouldPersistTaps="handled"
                  >
                    {gifs.map(g => (
                      <TouchableOpacity key={g.id} onPress={() => sendMedia('gif', g.url)} style={styles.gifItem}>
                        <Image source={{ uri: g.url }} style={styles.gifThumb} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* MENTIONS SUGGESTIONS */}
      {showMentions && (
        <View style={styles.mentionOverlay}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {groupMembers
              .filter(m => {
                const name = m.name || '';
                const nickname = m.nickname || '';
                // Solo incluir si tiene nombre o apodo Y coincide con la búsqueda
                if (!name && !nickname) return false;
                return name.toLowerCase().includes(mentionQuery) || 
                       nickname.toLowerCase().includes(mentionQuery);
              })
              .map((member, idx) => {
                const displayName = member.nickname || member.name || 'Usuario';
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.mentionItem} 
                    onPress={() => insertMention(member)}
                  >
                    <View style={styles.mentionAvatar}>
                      <Text style={styles.mentionAvatarText}>
                        {displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.mentionName}>{displayName}</Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>
      )}

      {/* INPUT AREA */}
      <View style={styles.inputContainer}>
        {isRecording ? (
          <View style={styles.recordingPanel}>
            <TouchableOpacity onPress={cancelRecording} style={styles.cancelBtn}>
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
            </TouchableOpacity>

            <View style={styles.recordingStatus}>
              <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
              <Text style={styles.recordingTimer}>{recordingTime}s</Text>
              {isLocked ? (
                <Text style={styles.recordingHint}>{t('chat.recording_locked')}</Text>
              ) : (
                <View style={styles.lockIndicator}>
                  <Ionicons name="chevron-up" size={14} color="#64748b" />
                  <Text style={styles.recordingHint}>{t('chat.swipe_to_lock')}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: '#10b981' }]}
              onPress={() => stopRecording(true)}
            >
              <MaterialIcons name="send" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
              <Ionicons name="camera" size={24} color="#8b949e" />
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={t('chat.message_placeholder')}
                placeholderTextColor="#64748b"
                value={text}
                onChangeText={handleTextChange}
                onFocus={() => setShowPicker(false)}
                multiline
              />
              <TouchableOpacity onPress={() => setShowPicker(!showPicker)} style={{ padding: 5 }}>
                <MaterialCommunityIcons name={showPicker ? "keyboard" : "emoticon-outline"} size={24} color="#8b949e" />
              </TouchableOpacity>
            </View>

            {text.trim() ? (
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: '#3b82f6' }]} onPress={handleSend}>
                <MaterialIcons name="send" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <Animated.View
                {...panResponder.panHandlers}
                style={[
                  styles.sendButton,
                  isRecording && { backgroundColor: '#ef4444', transform: [{ scale: 1.2 }] }
                ]}
              >
                <MaterialIcons name={isRecording ? "stop" : "mic"} size={22} color="#fff" />
              </Animated.View>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e27' },
  listContent: { padding: 16, paddingBottom: 24 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dateText: { color: '#64748b', fontSize: 11, marginHorizontal: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 16, gap: 8, alignItems: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  messageBubble: { maxWidth: '75%', padding: 10, borderRadius: 15 },
  messageMe: { backgroundColor: '#1e40af', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  messageOther: { backgroundColor: '#151a3a', borderBottomLeftRadius: 2 },
  messageBot: { backgroundColor: '#2d1b4e', borderBottomLeftRadius: 2 },
  senderName: { color: '#f5a623', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  messageText: { color: '#fff', fontSize: 15 },
  mentionHighlight: { color: '#3b82f6', fontWeight: 'bold' },
  messageImage: { width: 200, height: 150, borderRadius: 10, marginTop: 4 },
  messageSticker: { width: 150, height: 150 },
  messageGif: { width: 180, height: 120, borderRadius: 8 },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 10,
    borderRadius: 12,
    marginTop: 5,
    minWidth: 160
  },
  audioBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 10,
    borderRadius: 2,
    overflow: 'hidden'
  },
  audioProgress: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2
  },
  audioDuration: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600'
  },
  messageMeta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  timeText: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  typingIndicator: { paddingHorizontal: 20, paddingVertical: 4 },
  typingText: { color: '#64748b', fontSize: 12 },
  
  mentionOverlay: {
    backgroundColor: '#151a3a',
    borderTopWidth: 1,
    borderTopColor: '#1e2a5a',
    paddingVertical: 10,
    maxHeight: 60,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mentionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  mentionAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mentionName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  pickerContainer: { height: 280, backgroundColor: '#151a3a', borderTopWidth: 1, borderTopColor: '#1e2a5a' },
  pickerTabs: { flexDirection: 'row', height: 44, borderBottomWidth: 1, borderBottomColor: '#1e2a5a' },
  pickerTab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerTabActive: { borderBottomWidth: 2, borderBottomColor: '#f5a623' },
  pickerContent: { flex: 1 },
  emojiList: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'center' },
  emojiItem: { padding: 8, width: '16.6%', alignItems: 'center' },
  emojiText: { fontSize: 26 },
  stickerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  addStickerBtn: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 30, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#f5a623' },
  addStickerText: { color: '#f5a623', marginTop: 10, fontWeight: 'bold' },
  addStickerItem: { width: '25%', padding: 10, alignItems: 'center' },
  addStickerBox: { width: 60, height: 60, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#f5a623', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(245,166,35,0.1)' },
  addStickerLabel: { color: '#f5a623', fontSize: 10, marginTop: 4, fontWeight: 'bold' },
  stickerList: { flex: 1 },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 },
  stickerItem: { width: '25%', padding: 10, alignItems: 'center' },
  stickerThumb: { width: 60, height: 60, borderRadius: 10 },
  gifSearch: { backgroundColor: '#0a0e27', color: '#fff', margin: 10, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: '#1e2a5a' },
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 5, justifyContent: 'center' },
  gifItem: { padding: 2 },
  gifThumb: { width: 110, height: 80, borderRadius: 4 },

  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#0a0e27', alignItems: 'center', gap: 10 },
  recordingPanel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151a3a',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
  },
  recordingStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8
  },
  recordingTimer: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
    minWidth: 30
  },
  recordingHint: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic'
  },
  cancelBtn: {
    padding: 5
  },
  attachBtn: { padding: 5 },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#151a3a', borderRadius: 20, alignItems: 'center', paddingHorizontal: 10 },
  input: { flex: 1, color: '#fff', paddingVertical: 8, marginLeft: 10, maxHeight: 100 },
  sendButton: { backgroundColor: '#1e40af', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  lockIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  
  // Estilos No Leídos
  unreadSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 10
  },
  unreadLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.3)'
  },
  unreadTag: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold'
  },
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
  }
});
