import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/i18n';

interface Member {
  name: string;
  email?: string;
  nickname?: string;
}

export default function MembersManagement() {
  const router = useRouter();
  const { t } = useTranslation();
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName]     = useState('');
  const [newEmail, setNewEmail]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [useRandomPw, setUseRandomPw] = useState(true);
  const [adding, setAdding]       = useState(false);
  const [transferring, setTransferring] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      const res = await api.getPlayers(groupName);
      if (Array.isArray(res)) {
        const normalized = res.map(item =>
          typeof item === 'string'
            ? { name: item }
            : { name: item.name, email: item.email, nickname: item.nickname }
        );
        setMembers(normalized);
      } else {
        setMembers([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!newName.trim()) {
      Alert.alert(t('common.error'), t('admin.name_required'));
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert(t('common.error'), t('admin.valid_email'));
      return;
    }
    if (!useRandomPw && newPassword.length < 8) {
      Alert.alert(t('common.error'), t('admin.password_length'));
      return;
    }

    setAdding(true);
    try {
      const password = useRandomPw ? undefined : newPassword;
      await api.addPlayer(groupName, newName.trim(), cleanEmail, password);
      Alert.alert(t('common.success'), t('admin.add_success', { name: newName.trim() }));
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setUseRandomPw(true);
      fetchMembers();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleTransferAdmin(targetName: string) {
    Alert.alert(
      t('admin.transfer_title'),
      t('admin.transfer_confirm', { name: targetName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.transfer_button'),
          style: 'destructive',
          onPress: async () => {
            if (!auth) return;
            setTransferring(targetName);
            try {
              await api.transferAdmin(groupName, auth.name, targetName);
              Alert.alert(t('common.success'), t('admin.transfer_success', { name: targetName }));
              fetchMembers();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            } finally {
              setTransferring(null);
            }
          }
        }
      ]
    );
  }

  async function handleRemove(name: string) {
    Alert.alert(
      t('common.confirm'),
      `${t('common.remove_confirm')} ${name}? ${t('common.predictions_lost')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removePlayer(groupName, name);
              fetchMembers();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            }
          }
        }
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('admin.members_title'), headerTintColor: '#fff', headerStyle: { backgroundColor: '#0a0e27' }, headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 17 }}>{t('common.back')}</Text>
        </TouchableOpacity>
      ) }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('admin.add_player')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('admin.player_name_placeholder')}
            placeholderTextColor="#64748b"
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder={t('admin.player_email_placeholder')}
            placeholderTextColor="#64748b"
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setUseRandomPw(!useRandomPw)}
          >
            <View style={[styles.checkbox, useRandomPw && styles.checkboxActive]}>
              {useRandomPw && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>{t('admin.random_password')}</Text>
          </TouchableOpacity>

          {!useRandomPw && (
            <TextInput
              style={styles.input}
              placeholder={t('admin.password_placeholder')}
              placeholderTextColor="#64748b"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          )}

          <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={adding}>
            {adding
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.addButtonText}>{t('admin.add_to_group')}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.members_count', { count: members.length })}</Text>
          {loading ? (
            <ActivityIndicator color="#f5a623" style={{ marginTop: 20 }} />
          ) : (
            members.map(member => (
              <View key={member.email || member.name} style={styles.memberRow}>
                <View>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.email   && <Text style={styles.memberDetail}>✉️ {member.email}</Text>}
                  {member.nickname && <Text style={styles.memberDetail}>"{member.nickname}"</Text>}
                  {member.name === auth?.name && <Text style={styles.meTag}>{t('admin.you_admin')}</Text>}
                </View>
                {member.name !== auth?.name && (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => handleTransferAdmin(member.name)}
                      disabled={transferring === member.name}
                    >
                      {transferring === member.name
                        ? <ActivityIndicator color="#d97706" size="small" />
                        : <Ionicons name="shield-checkmark-outline" size={20} color="#d97706" />
                      }
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemove(member.name)}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  content: { padding: 20 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardTitle: { color: '#f5a623', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  section: { marginTop: 10 },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  memberName:   { color: '#fff', fontSize: 16, fontWeight: '600' },
  memberDetail: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  meTag:        { color: '#f5a623', fontSize: 12, marginTop: 2 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  checkLabel: { color: '#94a3b8', fontSize: 14, flex: 1 },
});
