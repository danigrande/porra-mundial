import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/i18n';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';

export default function FeedbackScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const auth = getAuth();

  const [type, setType] = useState<'bug' | 'feature' | null>(null);
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const submitFeedback = async () => {
    if (!type) { Alert.alert(t('common.error'), t('feedback.select_type')); return; }
    if (!subject.trim()) { Alert.alert(t('common.error'), t('feedback.error_subject')); return; }
    if (!detail.trim()) { Alert.alert(t('common.error'), t('feedback.error_detail')); return; }
    if (!auth?.userId) return;

    setSending(true);
    try {
      await api.sendFeedback({
        userId: auth.userId,
        userName: auth.name,
        type,
        subject: subject.trim(),
        detail: detail.trim(),
      });
      Alert.alert(t('common.success'), t('feedback.success'));
      setType(null);
      setSubject('');
      setDetail('');
      loadHistory();
    } catch (e: any) {
      Alert.alert(t('common.error'), t('feedback.error') + ' ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const loadHistory = async () => {
    if (!auth?.userId) return;
    setLoadingHistory(true);
    try {
      const res = await api.getFeedback();
      setHistory(res || []);
    } catch (e) {
      console.error('Error loading feedback history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleVote = async (feedbackId: string) => {
    if (!auth?.userId) return;
    try {
      await api.voteFeedback(feedbackId, auth.userId);
      loadHistory();
    } catch (e: any) {
      console.error('Error voting:', e);
    }
  };

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('feedback.title') }} />

      {/* Type selector */}
      <Text style={styles.label}>{t('feedback.select_type')}</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'bug' && styles.typeBtnBugActive]}
          onPress={() => setType('bug')}
        >
          <Text style={styles.typeIcon}>🐛</Text>
          <Text style={[styles.typeLabel, type === 'bug' && { color: '#ef4444' }]}>{t('feedback.report_bug')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'feature' && styles.typeBtnFeatureActive]}
          onPress={() => setType('feature')}
        >
          <Text style={styles.typeIcon}>💡</Text>
          <Text style={[styles.typeLabel, type === 'feature' && { color: '#22c55e' }]}>{t('feedback.suggest_feature')}</Text>
        </TouchableOpacity>
      </View>

      {/* Subject */}
      <Text style={styles.label}>{t('feedback.subject_label')}</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        maxLength={100}
        placeholderTextColor="#64748b"
      />
      <Text style={styles.counter}>{subject.length}/100</Text>

      {/* Detail */}
      <Text style={styles.label}>{t('feedback.detail_label')}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={detail}
        onChangeText={setDetail}
        multiline
        numberOfLines={4}
        maxLength={1500}
        placeholderTextColor="#64748b"
      />
      <Text style={styles.counter}>{detail.length}/1500</Text>

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitBtn, !type && styles.submitBtnDisabled, type === 'bug' && styles.submitBtnBug, type === 'feature' && styles.submitBtnFeature]}
        onPress={submitFeedback}
        disabled={!type || sending}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>
            {type === 'bug' ? `🐛 ${t('feedback.send_bug')}` : type === 'feature' ? `💡 ${t('feedback.send_feature')}` : t('feedback.select_type_first')}
          </Text>
        )}
      </TouchableOpacity>

      {/* History toggle */}
      <TouchableOpacity style={styles.historyToggle} onPress={() => setShowHistory(!showHistory)}>
        <MaterialIcons name={showHistory ? 'expand-less' : 'expand-more'} size={24} color="#8b5cf6" />
        <Text style={styles.historyToggleText}>📋 {t('feedback.history_title')}</Text>
      </TouchableOpacity>

      {showHistory && (
        loadingHistory ? (
          <ActivityIndicator color="#8b5cf6" style={{ marginTop: 16 }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>📭 {t('feedback.empty')}</Text>
        ) : (
          history.map((f: any) => {
            const isBug = f.type === 'bug';
            const voted = (f.votes || []).includes(auth?.userId);
            const isExpanded = expandedId === f._id;
            return (
              <View key={f._id}>
                <TouchableOpacity
                  style={styles.historyRow}
                  onPress={() => setExpandedId(isExpanded ? null : f._id)}
                >
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.typeBadge, { color: isBug ? '#ef4444' : '#22c55e', backgroundColor: isBug ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)' }]}>
                      {isBug ? '🐛' : '💡'} {isBug ? t('feedback.type_bug') : t('feedback.type_feature')}
                    </Text>
                    <Text style={styles.historySubject} numberOfLines={1}>{f.subject}</Text>
                  </View>
                  <Text style={styles.historyUser}>{f.userName}</Text>
                  <Text style={styles.historyVotes}>{f.voteCount || 0}</Text>
                  <TouchableOpacity
                    style={[styles.voteBtn, voted && styles.voteBtnActive]}
                    onPress={() => handleVote(f._id)}
                  >
                    <Text>👍</Text>
                  </TouchableOpacity>
                  <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color="#64748b" />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>{f.detail}</Text>
                  </View>
                )}
              </View>
            );
          })
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  content: { padding: 20, paddingTop: 20 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn: {
    flex: 1, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  typeBtnBugActive: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  typeBtnFeatureActive: { borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)' },
  typeIcon: { fontSize: 24, marginBottom: 4 },
  typeLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, color: '#fff',
    fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  counter: { textAlign: 'right', color: '#64748b', fontSize: 11, marginTop: 4, marginRight: 4 },
  submitBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  submitBtnBug: { backgroundColor: '#ef4444' },
  submitBtnFeature: { backgroundColor: '#22c55e' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  historyToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 12, gap: 6 },
  historyToggleText: { color: '#8b5cf6', fontSize: 15, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#64748b', fontSize: 14, marginTop: 16 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)', gap: 6,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  historySubject: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  historyUser: { color: '#64748b', fontSize: 11, minWidth: 40 },
  historyVotes: { color: '#94a3b8', fontSize: 13, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  voteBtn: { padding: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  voteBtnActive: { borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)' },
  detailRow: { padding: 12, paddingLeft: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailText: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
});
