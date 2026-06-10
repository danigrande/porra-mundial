import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '../i18n/i18n';
import * as api from '../services/api';

interface Props {
  messageId: string | null;
  userId: string;
  userName: string;
  onClose: () => void;
  onSubmitted: (messageId: string, rating: 'up' | 'down', reason?: string) => void;
}

const REASONS = [
  { key: 'incorrect', icon: 'close-circle' },
  { key: 'not_helpful', icon: 'help-circle' },
  { key: 'off_topic', icon: 'chatbox-ellipses' },
  { key: 'rude', icon: 'hand-left' },
  { key: 'other', icon: 'ellipsis-horizontal' },
];

export default function ChatbotFeedbackSheet({ messageId, userId, userName, onClose, onSubmitted }: Props) {
  const { t } = useTranslation();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (messageId) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
      setSelectedReason(null);
    }
  }, [messageId]);

  const handleDismiss = useCallback(() => {
    onClose();
    setSelectedReason(null);
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!messageId || submitting) return;
    setSubmitting(true);
    try {
      await api.submitChatbotFeedback({ messageId, userId, userName, rating: 'down', reason: selectedReason || undefined });
      onSubmitted(messageId, 'down', selectedReason || undefined);
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    } finally {
      setSubmitting(false);
      sheetRef.current?.dismiss();
      setSelectedReason(null);
    }
  }, [messageId, userId, userName, selectedReason, submitting, onSubmitted]);

  if (!messageId) return null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={['45%']}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView style={styles.content} bounces={false}>
        <Text style={styles.title}>{t('chat.feedback_title')}</Text>
        <Text style={styles.subtitle}>{t('chat.feedback_subtitle')}</Text>

        <View style={styles.reasonsList}>
          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.reasonItem, selectedReason === r.key && styles.reasonItemActive]}
              onPress={() => setSelectedReason(r.key === selectedReason ? null : r.key)}
              activeOpacity={0.6}
            >
              <Ionicons
                name={r.icon as any}
                size={22}
                color={selectedReason === r.key ? '#f5a623' : '#64748b'}
                style={{ marginRight: 12 }}
              />
              <Text style={[styles.reasonLabel, selectedReason === r.key && styles.reasonLabelActive]}>
                {t(`chat.feedback_reason_${r.key}`)}
              </Text>
              {selectedReason === r.key && (
                <Ionicons name="checkmark-circle" size={20} color="#f5a623" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => { sheetRef.current?.dismiss(); setSelectedReason(null); }}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, !selectedReason && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selectedReason || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('chat.feedback_submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { backgroundColor: '#475569', width: 36, height: 4, borderRadius: 2, marginTop: 8 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  reasonsList: { marginBottom: 20 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4, backgroundColor: '#334155' },
  reasonItemActive: { backgroundColor: 'rgba(245,166,35,0.15)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.4)' },
  reasonLabel: { color: '#e2e8f0', fontSize: 15 },
  reasonLabelActive: { color: '#f5a623', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#334155', borderRadius: 12 },
  cancelText: { color: '#60a5fa', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#f5a623', borderRadius: 12 },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
