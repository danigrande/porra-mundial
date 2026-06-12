import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, Platform,
         Animated, PanResponder, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from '../i18n/i18n';
import * as api from '../services/api';
import * as socketService from '../services/socket';

const EMOJIS = [
  '⚽', '🏆', '🔥', '👏', '🙌', '🤣', '😭', '🤯', '💪', '🇸🇦', '🇲🇽', '🇪🇸', '🇦🇷', '🇧🇷', '🇫🇷',
  '😎', '🤩', '🥳', '🤔', '🙄', '😱', '🤫', '🫠', '🤡', '👽', '👾', '🤖', '👑', '💎', '✨',
  '🥅', '🏟️', '🏅', '🥇', '🥈', '🥉', '🏁', '🚩', '📣', '📢', '🔔', '🎵', '🎶', '🍺',
  '🍔', '🍕', '🌮', '🍦', '🍩', '🥤', '🌎', '🌍', '🌏', '🌋', '🚀', '🛸', '🛰️', '⏳', '⌛'
];

interface Props {
  groupName: string;
  auth: { userId: string; name: string } | null;
  replyToMessage: any | null;
  editingMessageId: string | null;
  editMessageText?: string;
  groupMembers: Array<{ name: string; userId: string; nickname?: string }>;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export default function InputBar({
  groupName, auth, replyToMessage, editingMessageId, editMessageText,
  groupMembers, onCancelReply, onCancelEdit, onFocusChange
}: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  // GIF state
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [recentStickers, setRecentStickers] = useState<string[]>([]);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recording timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // GIF search
  useEffect(() => {
    if (pickerTab === 'gif') {
      searchGifs(gifSearch || 'football goals');
    }
  }, [gifSearch, pickerTab]);

  // Cleanup typing debounce on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, []);

  // Populate text when editing starts
  useEffect(() => {
    if (editMessageText) {
      setText(editMessageText);
    }
  }, [editingMessageId]);

  const handleTextChange = useCallback((val: string) => {
    setText(val);

    // Mentions detection
    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const textAfterAt = val.slice(lastAtPos + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    // Typing indicator with local debounce (500ms)
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (val.length > 0) {
      if (!isTyping) {
        socketService.sendTyping(groupName);
        setIsTyping(true);
      }
      typingDebounceRef.current = setTimeout(() => {
        socketService.sendStopTyping(groupName);
        setIsTyping(false);
      }, 500);
    } else if (isTyping) {
      socketService.sendStopTyping(groupName);
      setIsTyping(false);
    }
  }, [groupName, isTyping]);

  const insertMention = useCallback((member: any) => {
    const lastAtPos = text.lastIndexOf('@');
    const displayName = member.nickname || member.name || 'Usuario';
    const newText = text.slice(0, lastAtPos) + `@${displayName} `;
    setText(newText);
    setShowMentions(false);
  }, [text]);

  const handleSend = useCallback(() => {
    if (!text.trim() || !auth || !groupName) return;

    if (editingMessageId) {
      socketService.editMessage(editingMessageId, text.trim(), groupName);
      onCancelEdit();
      setText('');
      return;
    }

    const replyData = replyToMessage ? {
      messageId: replyToMessage._id,
      senderName: replyToMessage.senderName,
      text: replyToMessage.text,
      type: replyToMessage.type,
      mediaUrl: replyToMessage.mediaUrl,
    } : undefined;

    const sent = socketService.sendMessage(groupName, text, 'text', undefined, replyData);
    if (!sent) {
      console.warn('[InputBar] Socket desconectado');
      Alert.alert(t('common.error'), t('chat.no_connection_msg'));
      return;
    }
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    setText('');
    onCancelReply();
    if (isTyping) {
      socketService.sendStopTyping(groupName);
      setIsTyping(false);
    }
    setShowPicker(false);
  }, [text, auth, groupName, editingMessageId, replyToMessage, isTyping, onCancelReply, onCancelEdit, t]);

  const sendMedia = useCallback((type: 'image' | 'sticker' | 'gif' | 'file', url: string) => {
    const replyData = replyToMessage ? {
      messageId: replyToMessage._id,
      senderName: replyToMessage.senderName,
      text: replyToMessage.text,
      type: replyToMessage.type,
      mediaUrl: replyToMessage.mediaUrl,
    } : undefined;
    socketService.sendMessage(groupName, undefined, type, url, replyData);
    onCancelReply();
    setShowPicker(false);
  }, [groupName, replyToMessage, onCancelReply]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0].uri) {
        setUploading(true);
        try {
          const serverUrl = await api.uploadFile(result.assets[0].uri, 'image');
          sendMedia('image', serverUrl);
        } catch (e) {
          Alert.alert(t('common.error'), t('chat.image_error'));
        } finally {
          setUploading(false);
        }
      }
    } catch (e) {
      console.error('Error picking image:', e);
    }
  }, [sendMedia, t]);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        setUploading(true);
        try {
          const serverUrl = await api.uploadFile(asset.uri, asset.mimeType || 'file');
          sendMedia('file', serverUrl);
        } catch (e) {
          Alert.alert(t('common.error'), t('chat.file_error'));
        } finally {
          setUploading(false);
        }
      }
    } catch (e) {
      console.error('Error picking file:', e);
    }
  }, [sendMedia, t]);

  // ====== RECORDING ======
  const startRecording = useCallback(async () => {
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    setIsLocked(false);
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async (force = false) => {
    if (!recordingRef.current) return;
    if (isLocked && !force) return;

    setIsRecording(false);
    setIsLocked(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      recordingRef.current = null;

      if (uri) {
        setUploading(true);
        try {
          const serverUrl = await api.uploadFile(uri, 'audio');
          socketService.sendMessage(groupName, 'Nota de voz enviada', 'audio', serverUrl);
        } catch (e) {
          Alert.alert(t('common.error'), t('chat.audio_send_error'));
        } finally {
          setUploading(false);
        }
      }
    } catch (e) {
      console.error('Error stopping recording:', e);
      recordingRef.current = null;
    }
  }, [groupName, isLocked, t]);

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsLocked(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    } catch (e) {
      recordingRef.current = null;
    }
  }, []);

  // ====== STICKERS ======
  const createSticker = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0].uri) {
        setUploading(true);
        try {
          const serverUrl = await api.uploadFile(result.assets[0].uri, 'image');
          setRecentStickers(prev => [serverUrl, ...prev.slice(0, 19)]);
          sendMedia('sticker', serverUrl);
        } catch (e) {
          Alert.alert(t('common.error'), t('chat.sticker_error'));
        } finally {
          setUploading(false);
        }
      }
    } catch (e) {
      console.error('Error creating sticker:', e);
    }
  }, [sendMedia, t]);

  const searchGifs = useCallback(async (query: string) => {
    setGifsLoading(true);
    try {
      const response = await api.searchGiphy(query || 'football');
      setGifs(Array.isArray(response) ? response : []);
    } catch {
      setGifs([]);
    } finally {
      setGifsLoading(false);
    }
  }, []);

  // ====== PAN RESPONDER (Record button) ======
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
  }, [isRecording, pulseAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (!text.trim()) startRecording();
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < -60 && !isLocked) setIsLocked(true);
      },
      onPanResponderRelease: () => {
        if (!isLocked) stopRecording(true);
      },
    })
  ).current;

  return (
    <View>
      {/* MENTIONS SUGGESTIONS */}
      {showMentions && (
        <View style={styles.mentionOverlay}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {groupMembers
              .filter(m => {
                const name = (m.name || '').toLowerCase();
                const nickname = (m.nickname || '').toLowerCase();
                return name.includes(mentionQuery) || nickname.includes(mentionQuery);
              })
              .map((member, idx) => {
                const displayName = member.nickname || member.name || 'Usuario';
                return (
                  <TouchableOpacity key={idx} style={styles.mentionItem} onPress={() => insertMention(member)}>
                    <View style={styles.mentionAvatar}>
                      <Text style={styles.mentionAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.mentionName}>{displayName}</Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>
      )}

      {/* EMOJI / STICKER / GIF PICKER */}
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
                  <ScrollView contentContainerStyle={styles.gifGrid} keyboardShouldPersistTaps="handled">
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

      {/* REPLY BAR */}
      {replyToMessage && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarLabel}>{t('chat.reply_to', { name: replyToMessage.senderName })}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>{replyToMessage.text || 'Media'}</Text>
          </View>
          <TouchableOpacity onPress={onCancelReply}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* EDIT BAR */}
      {editingMessageId && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={[styles.replyBarLabel, { color: '#f5a623' }]}>{t('chat.edit')}</Text>
          </View>
          <TouchableOpacity onPress={onCancelEdit}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
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
            {!text.trim() && (
              <TouchableOpacity style={styles.attachBtn} onPress={pickFile}>
                <Ionicons name="attach" size={24} color="#8b949e" />
              </TouchableOpacity>
            )}
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={editingMessageId ? t('chat.edit') : t('chat.message_placeholder')}
                placeholderTextColor="#64748b"
                value={text}
                onChangeText={handleTextChange}
                onFocus={() => { setShowPicker(false); onFocusChange?.(true); }}
                onBlur={() => onFocusChange?.(false)}
                multiline
              />
              <TouchableOpacity onPress={() => setShowPicker(!showPicker)} style={{ padding: 5 }}>
                <MaterialCommunityIcons name={showPicker ? "keyboard" : "emoticon-outline"} size={24} color="#8b949e" />
              </TouchableOpacity>
            </View>
            {!text.trim() && (
              <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                <Ionicons name="camera" size={24} color="#8b949e" />
              </TouchableOpacity>
            )}
            {text.trim() ? (
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: '#3b82f6' }]} onPress={handleSend}>
                <MaterialIcons name="send" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <Animated.View
                {...panResponder.panHandlers}
                style={[styles.sendButton, isRecording && { backgroundColor: '#ef4444', transform: [{ scale: 1.2 }] }]}
              >
                <MaterialIcons name={isRecording ? "stop" : "mic"} size={22} color="#fff" />
              </Animated.View>
            )}
          </>
        )}
      </View>
      {uploading && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10,14,39,0.85)', justifyContent: 'center', alignItems: 'center',
          zIndex: 999, flexDirection: 'row', gap: 8
        }}>
          <ActivityIndicator size="small" color="#f5a623" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
            {t('common.loading') || 'Cargando...'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  mentionAvatarText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  mentionName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  pickerContainer: { height: 280, backgroundColor: '#151a3a', borderTopWidth: 1, borderTopColor: '#1e2a5a' },
  pickerTabs: { flexDirection: 'row', height: 44, borderBottomWidth: 1, borderBottomColor: '#1e2a5a' },
  pickerTab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerTabActive: { borderBottomWidth: 2, borderBottomColor: '#f5a623' },
  pickerContent: { flex: 1 },
  emojiList: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'center' },
  emojiItem: { padding: 8, width: '16.6%', alignItems: 'center' },
  emojiText: { fontSize: 26 },
  addStickerItem: { width: '25%', padding: 10, alignItems: 'center' },
  addStickerBox: { width: 60, height: 60, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#f5a623', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(245,166,35,0.1)' },
  addStickerLabel: { color: '#f5a623', fontSize: 10, marginTop: 4, fontWeight: 'bold' },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 },
  stickerItem: { width: '25%', padding: 10, alignItems: 'center' },
  stickerThumb: { width: 60, height: 60, borderRadius: 10 },
  gifSearch: { backgroundColor: '#0a0e27', color: '#fff', margin: 10, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: '#1e2a5a' },
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 5, justifyContent: 'center' },
  gifItem: { padding: 2 },
  gifThumb: { width: 110, height: 80, borderRadius: 4 },
  replyBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#151a3a', paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#a78bfa', gap: 8,
  },
  replyBarContent: { flex: 1 },
  replyBarLabel: { color: '#a78bfa', fontSize: 11, fontWeight: 'bold' },
  replyBarText: { color: '#94a3b8', fontSize: 13 },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#0a0e27', alignItems: 'center', gap: 10 },
  recordingPanel: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#151a3a', borderRadius: 25, paddingHorizontal: 15, height: 50,
  },
  recordingStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8 },
  recordingTimer: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 10, minWidth: 30 },
  recordingHint: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
  cancelBtn: { padding: 5 },
  attachBtn: { padding: 5 },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#151a3a', borderRadius: 20, alignItems: 'center', paddingHorizontal: 10 },
  input: { flex: 1, color: '#fff', paddingVertical: 8, marginLeft: 10, maxHeight: 100 },
  sendButton: { backgroundColor: '#1e40af', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  lockIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
