import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Keyboard, Modal, Alert, ScrollView } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { getAuth } from '../../stores/authStore';
import * as socketService from '../../services/socket';
import * as api from '../../services/api';

const EMOJIS = ['⚽', '🏆', '🔥', '👏', '🙌', '🤣', '😭', '🤯', '💪', '🇸🇦', '🇲🇽', '🇪🇸', '🇦🇷', '🇧🇷', '🇫🇷'];
const STICKERS = [
  'https://cdn-icons-png.flaticon.com/512/5351/5351052.png', // Balón
  'https://cdn-icons-png.flaticon.com/512/824/824248.png',   // Trofeo
  'https://cdn-icons-png.flaticon.com/512/263/263533.png',  // Tarjeta Roja
  'https://cdn-icons-png.flaticon.com/512/263/263535.png',  // Tarjeta Amarilla
  'https://cdn-icons-png.flaticon.com/512/2906/2906756.png', // Portería
  'https://cdn-icons-png.flaticon.com/512/1165/1165187.png', // Silbato
  'https://cdn-icons-png.flaticon.com/512/4302/4302521.png', // Camiseta
  'https://cdn-icons-png.flaticon.com/512/10317/10317804.png' // Copa Oro
];

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

  const searchGifs = async (query: string) => {
    setGifsLoading(true);
    try {
      const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${query}&key=${TENOR_API_KEY}&limit=12&contentfilter=high`);
      const data = await response.json();
      setGifs(data.results || []);
    } catch (e) {
      console.error('GIF search failed', e);
    } finally {
      setGifsLoading(false);
    }
  };

  // ==========================================
  // ACTIONS
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      socketService.sendMessage(groupName, undefined, 'image', base64);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    socketService.sendMessage(groupName, 'Nota de voz enviada', 'audio', uri || '');
  };

  // ==========================================
  // RENDERING
  // ==========================================

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

          <View style={[
            styles.messageBubble, 
            isMe ? styles.messageMe : item.isBot ? styles.messageBot : styles.messageOther,
            (item.type === 'sticker' || item.type === 'gif') && { backgroundColor: 'transparent', borderWidth: 0 }
          ]}>
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
              <View style={styles.audioContainer}>
                <Ionicons name="play" size={24} color="#fff" /><View style={styles.audioBar} /><Text style={styles.audioDuration}>0:05</Text>
              </View>
            )}

            <View style={styles.messageMeta}>
              <Text style={styles.timeText}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isMe && <MaterialCommunityIcons name="check-all" size={14} color="#3b82f6" style={{ marginLeft: 4 }} />}
            </View>
          </View>
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

      {showPicker && (
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
                {EMOJIS.map(e => (
                  <TouchableOpacity key={e} onPress={() => setText(t => t + e)} style={styles.emojiItem}>
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {pickerTab === 'sticker' && (
              <ScrollView contentContainerStyle={styles.stickerList} horizontal={false}>
                <View style={styles.stickerGrid}>
                  {STICKERS.map(s => (
                    <TouchableOpacity key={s} onPress={() => sendMedia('sticker', s)} style={styles.stickerItem}>
                      <Image source={{ uri: s }} style={styles.stickerThumb} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {pickerTab === 'gif' && (
              <View style={{flex: 1}}>
                <TextInput
                  style={styles.gifSearch}
                  placeholder="Buscar en Tenor..."
                  placeholderTextColor="#64748b"
                  value={gifSearch}
                  onChangeText={setGifSearch}
                />
                {gifsLoading ? <ActivityIndicator style={{marginTop: 20}} /> : (
                  <ScrollView contentContainerStyle={styles.gifGrid}>
                    {gifs.map(g => (
                      <TouchableOpacity key={g.id} onPress={() => sendMedia('gif', g.media_formats.tinygif.url)} style={styles.gifItem}>
                        <Image source={{ uri: g.media_formats.tinygif.url }} style={styles.gifThumb} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickImage}><Ionicons name="camera" size={24} color="#8b949e" /></TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TouchableOpacity onPress={() => setShowPicker(!showPicker)}>
            <MaterialCommunityIcons name={showPicker ? "keyboard" : "emoticon-outline"} size={24} color="#8b949e" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={isRecording ? "Grabando..." : "Mensaje..."}
            placeholderTextColor="#64748b"
            value={text}
            onChangeText={(t) => { setText(t); socketService.sendTyping(groupName); }}
            onFocus={() => setShowPicker(false)}
            multiline
          />
        </View>
        <TouchableOpacity 
          style={[styles.sendButton, isRecording && { backgroundColor: '#ef4444' }]} 
          onPress={text.trim() ? handleSend : undefined}
          onPressIn={!text.trim() ? startRecording : undefined}
          onPressOut={isRecording ? stopRecording : undefined}
        >
          <MaterialIcons name={text.trim() ? "send" : isRecording ? "stop" : "mic"} size={22} color="#fff" />
        </TouchableOpacity>
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
  messageSticker: { width: 120, height: 120 },
  messageGif: { width: 180, height: 120, borderRadius: 8 },
  audioContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 150, padding: 5 },
  audioBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  audioDuration: { color: '#fff', fontSize: 10 },
  messageMeta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  timeText: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  typingIndicator: { paddingHorizontal: 20, paddingVertical: 4 },
  typingText: { color: '#64748b', fontSize: 12 },
  
  pickerContainer: { height: 280, backgroundColor: '#151a3a', borderTopWidth: 1, borderTopColor: '#1e2a5a' },
  pickerTabs: { flexDirection: 'row', height: 44, borderBottomWidth: 1, borderBottomColor: '#1e2a5a' },
  pickerTab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerTabActive: { borderBottomWidth: 2, borderBottomColor: '#f5a623' },
  pickerContent: { flex: 1 },
  emojiList: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 },
  emojiItem: { padding: 8 },
  emojiText: { fontSize: 28 },
  stickerList: { flex: 1 },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'center' },
  stickerItem: { padding: 10 },
  stickerThumb: { width: 70, height: 70 },
  gifSearch: { backgroundColor: '#0a0e27', color: '#fff', margin: 10, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: '#1e2a5a' },
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 5, justifyContent: 'center' },
  gifItem: { padding: 2 },
  gifThumb: { width: 110, height: 80, borderRadius: 4 },

  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#0a0e27', alignItems: 'center', gap: 10 },
  attachBtn: { padding: 5 },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#151a3a', borderRadius: 20, alignItems: 'center', paddingHorizontal: 10 },
  input: { flex: 1, color: '#fff', paddingVertical: 8, marginLeft: 10, maxHeight: 100 },
  sendButton: { backgroundColor: '#1e40af', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
});
