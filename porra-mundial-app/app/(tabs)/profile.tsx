import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, logout, setCurrentGroup } from '../../stores/authStore';
import * as api from '../../services/api';
import * as socketService from '../../services/socket';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = getAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [nickname, setNickname] = useState('');
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');

  useEffect(() => {
    if (!auth) return;
    
    api.getProfile(auth.phone)
      .then(data => {
        setProfile(data);
        setNickname(data.nickname || auth.name);
        setLikes((data.likes || []).join(', '));
        setDislikes((data.dislikes || []).join(', '));
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [auth]);

  async function handleSave() {
    if (!auth) return;
    setSaving(true);
    
    try {
      const likesArray = likes.split(',').map(s => s.trim()).filter(Boolean);
      const dislikesArray = dislikes.split(',').map(s => s.trim()).filter(Boolean);
      
      await api.updateProfile(auth.phone, auth.currentGroup, {
        nickname,
        likes: likesArray,
        dislikes: dislikesArray,
      });
      
      Alert.alert('Éxito', 'Perfil actualizado para que la IA lo tenga en cuenta.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    socketService.disconnect();
    await logout();
    router.replace('/(auth)/login');
  }

  async function switchGroup(groupName: string) {
    if (!auth) return;
    await setCurrentGroup(groupName);
    
    // Reconectar socket al nuevo grupo
    socketService.disconnect();
    socketService.connect(auth.phone, auth.pin);
    
    // Recargar la app (esto fuerza a que los stores y hooks pillen el nuevo grupo)
    router.replace('/(tabs)/dashboard');
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{auth?.name?.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{auth?.name}</Text>
        <Text style={styles.phone}>{auth?.phone}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus Grupos</Text>
        {auth?.groups.map(g => (
          <TouchableOpacity 
            key={g} 
            style={[styles.groupItem, auth.currentGroup === g && styles.groupActive]}
            onPress={() => switchGroup(g)}
          >
            <Text style={[styles.groupText, auth.currentGroup === g && styles.groupTextActive]}>
              {g} {auth.currentGroup === g && '✓'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Perfil para la IA</Text>
        <Text style={styles.hintText}>
          El Agente Mundial usará estos datos para interactuar contigo en el chat y en los resúmenes.
        </Text>

        <Text style={styles.label}>Apodo</Text>
        <TextInput style={styles.input} value={nickname} onChangeText={setNickname} />

        <Text style={styles.label}>Cosas que te gustan (separadas por comas)</Text>
        <TextInput style={styles.input} value={likes} onChangeText={setLikes} placeholder="Ej: Real Madrid, la cerveza, ganar" placeholderTextColor="#666" />

        <Text style={styles.label}>Cosas que odias (separadas por comas)</Text>
        <TextInput style={styles.input} value={dislikes} onChangeText={setDislikes} placeholder="Ej: VAR, que me ganen, el Barça" placeholderTextColor="#666" />

        <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Guardar Perfil</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  phone: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#151a3a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f5a623',
    marginBottom: 16,
  },
  hintText: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 20,
  },
  groupItem: {
    padding: 12,
    backgroundColor: '#0a0e27',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  groupActive: {
    backgroundColor: '#1e40af33',
    borderColor: '#1e40af',
  },
  groupText: {
    color: '#ccc',
    fontSize: 16,
  },
  groupTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0a0e27',
    borderWidth: 1,
    borderColor: '#1e2a5a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#1e40af',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
