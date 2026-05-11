import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Keyboard, Modal, Alert, ScrollView, Animated, PanResponder } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { getAuth } from '../../stores/authStore';
import * as socketService from '../../services/socket';
import * as api from '../../services/api';

const EMOJIS = [
  '⚽', '🏆', '🔥', '👏', '🙌', '🤣', '😭', '🤯', '💪', '🇸🇦', '🇲🇽', '🇪🇸', '🇦🇷', '🇧🇷', '🇫🇷',
  '😎', '🤩', '🥳', '🤔', '🙄', '😱', '🤫', '🫠', '🤡', '👽', '👾', '🤖', '👑', '💎', '✨',
  '🥅', '🏟️', '🏅', '🥇', '🥈', '🥉', '🏁', '🚩', '📣', '📢', '🔔', '🎵', '🎶', '🍺',
  '🍔', '🍕', '🌮', '🍦', '🍩', '🥤', '🌎', '🌍', '🌏', '🌋', '🚀', '🛸', '🛰️', '⏳', '⌛'
];
const STICKERS: string[] = []; // Los cargaremos dinámicamente

const TENOR_API_KEY = 'LIVEOXIT8AD'; // Public demo key for Tenor

export default function ChatScreen() {
  const [messages, setMessages] = useState<socketService.ChatMessage[]>([]);
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
  
  const flatListRef = useRef<FlatList>(null);
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  useEffect(() => {
    if (!auth) return;
    loadHistory();

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('new-message', (msg: socketService.ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      if (msg.senderId === auth.phone) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    socket.on('chat-history', (data) => {
      if (data.groupName === groupName) {
        setMessages(data.messages);
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
      }
    });

    socket.on('user-typing', (data) => {
      if (data.groupName === groupName && data.userName !== auth.name) {
        setTypingUsers(prev => prev.includes(data.userName) ? prev : [...prev, data.userName]);
      }
    });

    socket.on('user-stopped-typing', (data) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.filter(name => name !== data.userName));
      }
    });

    socket.on('bot-typing', (data) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.includes('Agente Mundial') ? prev : [...prev, 'Agente Mundial']);
      }
    });

    socket.on('bot-stopped-typing', (data) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.filter(name => name !== 'Agente Mundial'));
      }
    });

    return () => {
      socket.off('new-message');
      socket.off('chat-history');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('bot-typing');
      socket.off('bot-stopped-typing');
    };
  }, [auth]);

  async function loadHistory() {
    try {
      setLoading(true);
      const history = await api.getChatHistory(groupName);
      setMessages(history);
      // Forzar scroll al final tras un pequeño delay para que el FlatList renderice
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 300);
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // GIF SEARCH
  // ==========================================
  useEffect(() => {
    if (pickerTab === 'gif') {
      searchGifs(gifSearch || 'world cup 2026');
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
      // Volver a v1 que es más fiable para claves demo
      const response = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=12`);
      const data = await response.json();
      // En v1 el formato es un poco distinto
      const formattedGifs = data.results.map((g: any) => ({
        id: g.id,
        url: g.media[0].tinygif.url
      }));
      setGifs(formattedGifs);
    } catch (e) {
      console.error('GIF search failed', e);
    } finally {
      setGifsLoading(false);
    }
  };

  // ==========================================
  // RENDERING
  // ==========================================

  const handleSend = () => {
    if (!text.trim() || !auth) return;
    socketService.sendMessage(groupName, text, 'text');
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
      Alert.alert('Error', 'No se pudo subir la imagen');
    }
  };

  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
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
      Alert.alert('Error', 'No se pudo reproducir el audio');
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
      Alert.alert('Error', 'No se pudo enviar el audio');
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
          text: '🚩 Reportar contenido', 
          onPress: () => {
            Alert.alert(
              'Reportar',
              '¿Por qué quieres reportar este mensaje?',
              [
                { text: 'Spam', onPress: () => sendReport(message, 'Spam') },
                { text: 'Acoso', onPress: () => sendReport(message, 'Acoso') },
                { text: 'Contenido inapropiado', onPress: () => sendReport(message, 'Contenido inapropiado') },
                { text: 'Cancelar', style: 'cancel' }
              ]
            );
          }
        },
        {
          text: '🚫 Bloquear usuario',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Bloquear', `¿Seguro que quieres bloquear a ${message.senderName}? No volverás a ver sus mensajes.`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Bloquear', style: 'destructive', onPress: () => Alert.alert('Éxito', 'Usuario bloqueado localmente.') }
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
      Alert.alert('Reportado', 'Gracias por avisar. El equipo de moderación revisará el mensaje.');
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar el reporte.');
    }
  };

  const renderMessage = ({ item, index }: { item: socketService.ChatMessage, index: number }) => {
    const isMe = item.senderId === auth?.phone;
    const showDate = index === 0 || new Date(messages[index-1].timestamp).toDateString() !== new Date(item.timestamp).toDateString();
    const dateLabel = new Date(item.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} /><Text style={styles.dateText}>{dateLabel}</Text><View style={styles.dateLine} />
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
            
            {(item.type === 'text' || !item.type) && <Text style={styles.messageText}>{item.text}</Text>}
            
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
              <TouchableOpacity style={styles.audioContainer} onPress={() => playAudio(item._id, item.mediaUrl)}>
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
                    : 'Nota'}
                </Text>
              </TouchableOpacity>
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
        data={messages}
        keyExtractor={item => item._id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      
      {typingUsers.length > 0 && <View style={styles.typingIndicator}><Text style={styles.typingText}>{typingUsers.join(', ')} escribiendo...</Text></View>}

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
                    <Text style={styles.addStickerLabel}>Nuevo</Text>
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
              <View style={{flex: 1}}>
                <TextInput
                  style={styles.gifSearch}
                  placeholder="Buscar GIFs en Tenor..."
                  placeholderTextColor="#64748b"
                  value={gifSearch}
                  onChangeText={setGifSearch}
                />
                {gifsLoading ? <ActivityIndicator style={{marginTop: 20}} /> : (
                  <ScrollView contentContainerStyle={styles.gifGrid}>
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
                <Text style={styles.recordingHint}>Grabando (Bloqueado)</Text>
              ) : (
                <View style={styles.lockIndicator}>
                  <Ionicons name="chevron-up" size={14} color="#64748b" />
                  <Text style={styles.recordingHint}>Desliza para bloquear</Text>
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
                placeholder="Mensaje..."
                placeholderTextColor="#64748b"
                value={text}
                onChangeText={(t) => { setText(t); socketService.sendTyping(groupName); }}
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
  lockIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 }
});
