import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '../i18n/i18n';
import * as api from '../services/api';
import SwipeableMessage from './SwipeableMessage';

export interface ChatMessageData {
  _id: string;
  chatId: string;
  senderName: string;
  senderId: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'sticker' | 'gif' | 'file';
  mediaUrl?: string;
  isBot: boolean;
  replyTo?: {
    messageId: string;
    senderName: string;
    text?: string;
    type?: string;
    mediaUrl?: string;
  };
  reactions?: { [emoji: string]: string[] };
  edited?: boolean;
  editedAt?: string;
  deletedFor?: string[];
  timestamp: string;
}

interface Props {
  item: ChatMessageData;
  isMe: boolean;
  showDate: boolean;
  dateLabel: string;
  isFirstUnread: boolean;
  unreadCount: number;
  isEditing: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  playingId: string | null;
  playbackStatus: { position: number; duration: number };
  messageIndex: number;
  totalMessages: number;
  lastReadId: string | null;
  showUnreadMarker: boolean;
  messages: ChatMessageData[];
  authUserId: string;
  groupName: string;
  onToggleSelect: (id: string) => void;
  onLongPress: (msg: ChatMessageData) => void;
  onReply: (msg: ChatMessageData) => void;
  onPlayAudio: (id: string, uri: string) => void;
  onToggleReaction: (id: string, emoji: string, userId: string | undefined) => void;
  onScrollToMessage: (id: string) => void;
  onSetSelectedImage: (url: string | null) => void;
  onOpenFeedback: (msgId: string) => void;
  userFeedback: { [msgId: string]: number } | null;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const renderMessageText = (text: string, edited?: boolean, t?: (key: string) => string) => {
  if (!text) return null;
  const parts = text.split(/(@\w+|https?:\/\/[^\s]+)/g);
  return (
    <Text style={styles.messageText}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          return <Text key={index} style={styles.mentionHighlight}>{part}</Text>;
        }
        if (part.startsWith('http')) {
          return (
            <Text key={index} style={styles.linkHighlight} onPress={() => Linking.openURL(part)}>
              {part}
            </Text>
          );
        }
        return part;
      })}
      {edited && t && <Text style={{ fontSize: 11, color: '#64748b' }}> ({t('chat.edited')})</Text>}
    </Text>
  );
};

const LinkPreviewCard = React.memo(({ url }: { url: string }) => {
  const [preview, setPreview] = useState<{ title: string; description: string; image: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const cached = cache.current.get(url);
    if (cached) { setPreview(cached); return; }
    setLoading(true);
    api.getLinkPreview(url).then(data => {
      if (data?.title) {
        cache.current.set(url, data);
        setPreview(data);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [url]);

  if (loading) return null;
  if (!preview?.title) return null;

  return (
    <TouchableOpacity style={styles.linkPreviewCard} onPress={() => Linking.openURL(url)} activeOpacity={0.8}>
      {preview.image && (
        <Image source={{ uri: preview.image }} style={styles.linkPreviewImage} resizeMode="cover" />
      )}
      <View style={styles.linkPreviewText}>
        <Text style={styles.linkPreviewTitle} numberOfLines={2}>{preview.title}</Text>
        {preview.description && (
          <Text style={styles.linkPreviewDesc} numberOfLines={2}>{preview.description}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const renderLinkPreviews = (text: string) => {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex);
  if (!urls) return null;
  const unique = [...new Set(urls)];
  return <>{unique.map((u, i) => <LinkPreviewCard key={`${u}-${i}`} url={u} />)}</>;
};

function ChatMessageComponent({
  item, isMe, showDate, dateLabel, isFirstUnread, unreadCount, isEditing,
  selectMode, selectedIds, playingId, playbackStatus, messageIndex, totalMessages,
  lastReadId, showUnreadMarker, messages, authUserId, groupName,
  onToggleSelect, onLongPress, onReply, onPlayAudio, onToggleReaction,
  onScrollToMessage, onSetSelectedImage, onOpenFeedback, userFeedback
}: Props) {
  const { t } = useTranslation();

  const toggleSelect = useCallback(() => onToggleSelect(item._id), [item._id, onToggleSelect]);
  const handleLongPress = useCallback(() => onLongPress(item), [item, onLongPress]);
  const handleReply = useCallback(() => onReply(item), [item, onReply]);
  const handlePlayAudio = useCallback(() => onPlayAudio(item._id, item.mediaUrl || ''), [item._id, item.mediaUrl, onPlayAudio]);
  const handleImagePress = useCallback(() => onSetSelectedImage(item.mediaUrl || null), [item.mediaUrl, onSetSelectedImage]);
  const handleOpenFeedback = useCallback(() => onOpenFeedback(item._id), [item._id, onOpenFeedback]);

  const reactions = item.reactions || {};
  const fb = userFeedback?.[item._id];
  const quotedMsgId = item.replyTo?.messageId;

  const handleQuotePress = useCallback(() => {
    if (quotedMsgId) onScrollToMessage(quotedMsgId);
  }, [quotedMsgId, onScrollToMessage]);

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
            <Text style={styles.unreadText}>{unreadCount} {unreadCount === 1 ? t('chat.unread_one') : t('chat.unread_many')}</Text>
          </View>
          <View style={styles.unreadLine} />
        </View>
      )}
      <View style={[styles.messageRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
        {selectMode && (
          <TouchableOpacity onPress={toggleSelect} style={{ padding: 4 }}>
            <Ionicons name={selectedIds.has(item._id) ? 'checkbox' : 'square-outline'} size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {!isMe && (
          <View style={[styles.avatar, { backgroundColor: item.isBot ? '#4c1d95' : '#3b82f6' }]}>
            <Text style={styles.avatarText}>{item.isBot ? '🏆' : item.senderName[0].toUpperCase()}</Text>
          </View>
        )}
        <SwipeableMessage onReply={handleReply} isMe={isMe} disabled={selectMode}>
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={handleLongPress}
            onPress={selectMode ? toggleSelect : undefined}
            style={[
              styles.messageBubble,
              isMe ? styles.messageMe : item.isBot ? styles.messageBot : styles.messageOther,
              (item.type === 'sticker' || item.type === 'gif') && { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }
            ]}
          >
            {!isMe && <Text style={[styles.senderName, item.isBot && { color: '#a78bfa' }]}>{item.senderName}</Text>}

            {item.replyTo && (
              <TouchableOpacity style={styles.quotedMessage} onPress={handleQuotePress}>
                <View style={styles.quoteLine} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.quoteSender}>{item.replyTo.senderName}</Text>
                  {item.replyTo.type === 'image' ? <Text style={styles.quoteText}>📸 Foto</Text>
                    : item.replyTo.type === 'audio' ? <Text style={styles.quoteText}>🎤 Audio</Text>
                    : item.replyTo.type === 'sticker' ? <Text style={styles.quoteText}>🏷️ Sticker</Text>
                    : item.replyTo.type === 'gif' ? <Text style={styles.quoteText}>🎉 GIF</Text>
                    : item.replyTo.type === 'file' ? <Text style={styles.quoteText}>📎 {t('chat.file')}</Text>
                    : <Text style={styles.quoteText} numberOfLines={2}>{item.replyTo.text}</Text>}
                </View>
              </TouchableOpacity>
            )}

            {/* Edit mode — skip rendering when being edited */}
            {(() => {
              if (isEditing) return null;
              return (
              <>
                {(item.type === 'text' || !item.type) && (
                  <>
                    {renderMessageText(item.text || '', item.edited, t)}
                    {renderLinkPreviews(item.text || '')}
                  </>
                )}
                {item.type === 'image' && (
                  <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
                    <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} resizeMode="cover" />
                  </TouchableOpacity>
                )}
                {item.type === 'sticker' && (
                  <Image source={{ uri: item.mediaUrl }} style={styles.messageSticker} resizeMode="contain" />
                )}
                {item.type === 'gif' && (
                  <Image source={{ uri: item.mediaUrl }} style={styles.messageGif} resizeMode="cover" />
                )}
                {item.type === 'file' && (
                  <TouchableOpacity style={styles.fileContainer} onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)}>
                    <Ionicons name="document-attach" size={28} color="#60a5fa" />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={styles.fileName} numberOfLines={1}>{item.text || t('chat.file')}</Text>
                      <Text style={styles.fileSize}>{t('chat.file_open')}</Text>
                    </View>
                    <Ionicons name="open-outline" size={18} color="#60a5fa" />
                  </TouchableOpacity>
                )}
                {item.type === 'audio' && (
                  <TouchableOpacity style={styles.audioContainer} onPress={handlePlayAudio}>
                    <Ionicons name={playingId === item._id ? 'pause' : 'play'} size={24} color="#fff" />
                    <View style={styles.audioBar}>
                      <View style={[styles.audioProgress, {
                        width: playingId === item._id ? `${(playbackStatus.position / playbackStatus.duration) * 100}%` : '0%'
                      }]} />
                    </View>
                    <Text style={styles.audioDuration}>
                      {playingId === item._id ? formatMillis(playbackStatus.position) : t('chat.voice_note')}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.isBot && item.type === 'text' && (
                  <Text style={{ fontSize: 9, color: '#a78bfa', marginTop: 4, fontStyle: 'italic' }}>
                    {t('chat.ai_disclaimer')}
                  </Text>
                )}

                {/* Reactions */}
                {Object.keys(reactions).length > 0 && (
                  <View style={styles.reactionsRow}>
                    {REACTION_EMOJIS.filter(e => reactions[e]?.length).map(emoji => (
                      <TouchableOpacity
                        key={emoji}
                        style={[styles.reactionBadge, reactions[emoji]?.includes(authUserId || '') && styles.reactionBadgeActive]}
                        onPress={() => onToggleReaction(item._id, emoji, authUserId)}
                      >
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                        <Text style={styles.reactionCount}>{reactions[emoji].length}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.reactionAddBtn}
                      onPress={() => {
                        const notReacted = REACTION_EMOJIS.find(e => !reactions[e]?.includes(authUserId || ''));
                        if (notReacted) onToggleReaction(item._id, notReacted, authUserId);
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
              );
            })()}

            {/* Feedback footer for bot messages */}
            {item.isBot && item.type === 'text' && !isEditing && (
              <View style={styles.feedbackFooter}>
                <TouchableOpacity
                  style={styles.feedbackBtn}
                  onPress={handleOpenFeedback}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name={fb !== undefined ? 'star' : 'star-outline'} size={16} color={fb !== undefined ? '#f5a623' : '#64748b'} />
                  <Text style={styles.feedbackLabel}>{fb !== undefined ? fb + '/5' : 'Rate'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.type !== 'sticker' && item.type !== 'gif' && (
              <View style={styles.messageMeta}>
                <Text style={styles.timeText}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMe && <View style={{ width: 18 }} />}
              </View>
            )}
          </TouchableOpacity>
        </SwipeableMessage>
      </View>
    </View>
  );
}

function formatMillis(millis: number) {
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return `${minutes}:${(parseInt(seconds) < 10 ? '0' : '')}${seconds}`;
}

function areEqual(prev: Props, next: Props) {
  if (prev.item._id !== next.item._id) return false;
  if (prev.item.text !== next.item.text) return false;
  if (prev.item.edited !== next.item.edited) return false;
  if (prev.item.reactions !== next.item.reactions) return false;
  if (prev.item.type !== next.item.type) return false;
  if (prev.item.mediaUrl !== next.item.mediaUrl) return false;
  if (prev.item.isBot !== next.item.isBot) return false;
  if (prev.isMe !== next.isMe) return false;
  if (prev.showDate !== next.showDate) return false;
  if (prev.isFirstUnread !== next.isFirstUnread) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.selectMode !== next.selectMode) return false;
  if (prev.selectedIds !== next.selectedIds) return false;
  if (prev.playingId !== next.playingId) return false;
  if (prev.playbackStatus.position !== next.playbackStatus.position) return false;
  if (prev.playbackStatus.duration !== next.playbackStatus.duration) return false;
  if (prev.userFeedback?.[prev.item._id] !== next.userFeedback?.[next.item._id]) return false;
  return true;
}

export default memo(ChatMessageComponent, areEqual);

const styles = StyleSheet.create({
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dateText: { color: '#64748b', fontSize: 11, marginHorizontal: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 16, gap: 8, alignItems: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  messageBubble: { padding: 10, borderRadius: 15, flexShrink: 1 },
  messageMe: { backgroundColor: '#1e40af', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  messageOther: { backgroundColor: '#151a3a', alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  messageBot: { backgroundColor: '#2d1b4e', alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  senderName: { color: '#f5a623', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  messageText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  mentionHighlight: { color: '#3b82f6', fontWeight: 'bold' },
  linkHighlight: { color: '#60a5fa', textDecorationLine: 'underline' },
  messageImage: { width: 200, height: 150, borderRadius: 10, marginTop: 4 },
  messageSticker: { width: 150, height: 150 },
  messageGif: { width: 180, height: 120, borderRadius: 8 },
  audioContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 12, marginTop: 5, minWidth: 160 },
  audioBar: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 10, borderRadius: 2, overflow: 'hidden' },
  audioProgress: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  audioDuration: { color: '#fff', fontSize: 11, fontWeight: '600' },
  messageMeta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  timeText: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  quotedMessage: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8, marginBottom: 6 },
  quoteLine: { width: 3, backgroundColor: '#a78bfa', borderRadius: 2, marginRight: 8 },
  quoteSender: { color: '#a78bfa', fontSize: 11, fontWeight: 'bold' },
  quoteText: { color: '#94a3b8', fontSize: 13 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4, alignItems: 'center' },
  reactionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, gap: 2 },
  reactionBadgeActive: { backgroundColor: 'rgba(59,130,246,0.25)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: '#94a3b8', fontSize: 11 },
  reactionAddBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  fileContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 10, marginTop: 4 },
  fileName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  fileSize: { color: '#64748b', fontSize: 11 },
  linkPreviewCard: { flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginTop: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  linkPreviewImage: { width: '100%', height: 120, backgroundColor: '#151a3a' },
  linkPreviewText: { padding: 8 },
  linkPreviewTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  linkPreviewDesc: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  unreadSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, paddingHorizontal: 10 },
  unreadLine: { flex: 1, height: 1, backgroundColor: 'rgba(59, 130, 246, 0.3)' },
  unreadTag: { backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  feedbackFooter: { flexDirection: 'row', marginTop: 6, gap: 8, alignItems: 'center', alignSelf: 'flex-end' },
  feedbackBtn: { flexDirection: 'row', alignItems: 'center', padding: 2, borderRadius: 4, gap: 3 },
  feedbackLabel: { color: '#64748b', fontSize: 11 },
  feedbackBtnActive: { backgroundColor: 'rgba(245,166,35,0.15)' },
});
