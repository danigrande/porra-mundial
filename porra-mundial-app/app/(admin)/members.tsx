import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function MembersManagement() {
  const router = useRouter();
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      const res = await api.getPlayers(groupName);
      setMembers(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName || !newPhone) {
      Alert.alert('Error', 'Nombre y teléfono son obligatorios');
      return;
    }
    setAdding(true);
    try {
      await api.addPlayer(groupName, newName, newPhone);
      Alert.alert('Éxito', `Jugador ${newName} añadido.`);
      setNewName('');
      setNewPhone('');
      fetchMembers();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(name: string) {
    Alert.alert(
      'Confirmar',
      `¿Seguro que quieres quitar a ${name} del grupo? Se borrarán sus predicciones.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removePlayer(groupName, name);
              fetchMembers();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Gestión de Miembros', headerTintColor: '#fff', headerStyle: { backgroundColor: '#0a0e27' } }} />
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Añadir Jugador</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Nombre del jugador" 
            placeholderTextColor="#64748b"
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput 
            style={styles.input} 
            placeholder="Teléfono (ej: 34612345678)" 
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={newPhone}
            onChangeText={setNewPhone}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={adding}>
            {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Añadir al Grupo</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Miembros Actuales ({members.length})</Text>
          {loading ? (
            <ActivityIndicator color="#f5a623" style={{marginTop: 20}} />
          ) : (
            members.map(m => (
              <View key={m} style={styles.memberRow}>
                <View>
                  <Text style={styles.memberName}>{m}</Text>
                  {m === auth?.name && <Text style={styles.meTag}>Tú (Admin)</Text>}
                </View>
                {m !== auth?.name && (
                  <TouchableOpacity onPress={() => handleRemove(m)}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
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
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardTitle: { color: '#f5a623', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addButton: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
  section: { marginTop: 10 },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  memberName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  meTag: { color: '#f5a623', fontSize: 12, marginTop: 2 },
});
