import { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type { ChatMessage } from '../services/socket';

interface Props {
  message: ChatMessage | null;
  isMe: boolean;
  canEdit: boolean;
  onClose: () => void;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage, scope: 'me' | 'everyone') => void;
  onReport: (msg: ChatMessage, reason: string) => void;
  onBlock: (msg: ChatMessage) => void;
  onReact: (msg: ChatMessage, emoji: string) => void;
}

const REPORT_REASONS = [
  { key: 'Spam', label: 'Spam', icon: 'spam' },
  { key: 'Acoso', label: 'Acoso', icon: 'hand-left' },
  { key: 'Contenido inapropiado', label: 'Contenido inapropiado', icon: 'alert-triangle' },
];

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBottomSheet({
  message, isMe, canEdit, onClose, onReply, onEdit, onDelete, onReport, onBlock, onReact,
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (message) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [message]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  if (!message) return null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={['35%', '60%']}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView style={styles.content} bounces={false}>
        {/* Copy */}
        <ActionRow icon="copy" label="Copiar" onPress={() => { Clipboard.setStringAsync(message.text ?? message.mediaUrl ?? ''); sheetRef.current?.dismiss(); }} />

        {/* Reply */}
        <ActionRow icon="chatbubble-ellipses" label="Responder" onPress={() => { onReply(message); sheetRef.current?.dismiss(); }} />

        {/* Quick Reactions */}
        <View style={styles.reactionsRow}>
          <Text style={styles.reactionsLabel}>Reacciona</Text>
          <View style={styles.reactionsList}>
            {QUICK_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => { onReact(message, emoji); sheetRef.current?.dismiss(); }}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Edit */}
        {isMe && canEdit && (
          <ActionRow icon="create" label="Editar" onPress={() => { onEdit(message); sheetRef.current?.dismiss(); }} />
        )}

        {/* Delete */}
        {isMe && (
          <ActionRow
            icon="trash"
            label="Eliminar"
            destructive
            onPress={() => {
              sheetRef.current?.dismiss();
              setTimeout(() => {
                onDelete(message, 'me');
              }, 300);
            }}
          />
        )}

        {/* Divider */}
        {!isMe && <View style={styles.divider} />}

        {/* Report */}
        {!isMe && (
          <>
            <Text style={styles.sectionLabel}>Reportar</Text>
            {REPORT_REASONS.map((r) => (
              <ActionRow
                key={r.key}
                icon="flag"
                label={r.label}
                onPress={() => { onReport(message, r.key); sheetRef.current?.dismiss(); }}
              />
            ))}
          </>
        )}

        {/* Block */}
        {!isMe && (
          <ActionRow
            icon="hand-left"
            label="Bloquear usuario"
            destructive
            onPress={() => { onBlock(message); sheetRef.current?.dismiss(); }}
          />
        )}

        {/* Cancel */}
        <View style={styles.cancelContainer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => sheetRef.current?.dismiss()}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function ActionRow({ icon, label, destructive, onPress }: { icon: string; label: string; destructive?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon as any} size={22} color={destructive ? '#ef4444' : '#e2e8f0'} style={styles.actionIcon} />
      <Text style={[styles.actionLabel, destructive && { color: '#ef4444' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    backgroundColor: '#475569',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  actionIcon: {
    marginRight: 14,
    width: 24,
    textAlign: 'center',
  },
  actionLabel: {
    color: '#e2e8f0',
    fontSize: 16,
  },
  reactionsRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  reactionsLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reactionsList: {
    flexDirection: 'row',
    gap: 6,
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  divider: {
    height: 8,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cancelContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 12,
  },
  cancelText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
});
