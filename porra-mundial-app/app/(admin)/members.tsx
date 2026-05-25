import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { isValidPhoneNumber } from 'libphonenumber-js';

const COUNTRIES = [
  { code: '34', flag: '🇪🇸', name: 'España' },
  { code: '44', flag: '🇬🇧', name: 'Reino Unido' },
  { code: '1', flag: '🇺🇸', name: 'EE.UU.' },
  { code: '52', flag: '🇲🇽', name: 'México' },
  { code: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: '55', flag: '🇧🇷', name: 'Brasil' },
  { code: '56', flag: '🇨🇱', name: 'Chile' },
  { code: '57', flag: '🇨🇴', name: 'Colombia' },
  { code: '51', flag: '🇵🇪', name: 'Perú' },
  { code: '58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '33', flag: '🇫🇷', name: 'Francia' },
  { code: '49', flag: '🇩🇪', name: 'Alemania' },
  { code: '39', flag: '🇮🇹', name: 'Italia' },
  { code: '351', flag: '🇵🇹', name: 'Portugal' },
  { code: '31', flag: '🇳🇱', name: 'Países Bajos' },
  { code: '212', flag: '🇲🇦', name: 'Marruecos' },
];
interface Member {
  name: string;
  phone?: string;
  nickname?: string;
}

export default function MembersManagement() {
  const router = useRouter();
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [countryCode, setCountryCode] = useState('34');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      const res = await api.getPlayers(groupName);
      // Ensure we store an array of Member objects
      if (Array.isArray(res)) {
        const normalized = res.map(item =>
          typeof item === 'string'
            ? { name: item }
            : { name: item.name, phone: item.phone, nickname: item.nickname }
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
    const rawPhone = newPhone.replace(/[^0-9]/g, '');
    const fullPhone = countryCode + rawPhone;
    const fullPhoneWithPlus = '+' + fullPhone;

    if (!newName || !rawPhone) {
      Alert.alert('Error', 'Nombre y teléfono son obligatorios');
      return;
    }
    
    if (rawPhone.length < 5 || !isValidPhoneNumber(fullPhoneWithPlus)) {
      Alert.alert('Error', 'Por favor, introduce un teléfono válido');
      return;
    }

    setAdding(true);
    try {
      await api.addPlayer(groupName, newName, fullPhone);
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
          <View style={styles.phoneInputContainer}>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={countryCode}
                onValueChange={(itemValue) => setCountryCode(itemValue)}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                {COUNTRIES.map(c => (
                  <Picker.Item key={c.code} label={`${c.flag} +${c.code}`} value={c.code} />
                ))}
              </Picker>
            </View>
            <TextInput 
              style={[styles.input, { flex: 1, marginBottom: 0, height: 50 }]} 
              placeholder="Teléfono (ej: 612345678)" 
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={adding}>
            {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Añadir al Grupo</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Miembros Actuales ({members.length})</Text>
          {loading ? (
            <ActivityIndicator color="#f5a623" style={{marginTop: 20}} />
          ) : (
            members.map(member => (
              <View key={member.phone || member.name} style={styles.memberRow}>
                <View>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.phone && <Text style={styles.memberName}>📞 {member.phone}</Text>}
                  {member.nickname && <Text style={styles.memberName}>"{member.nickname}"</Text>}
                  {member.name === auth?.name && <Text style={styles.meTag}>Tú (Admin)</Text>}
                </View>
                {member.name !== auth?.name && (
                  <TouchableOpacity onPress={() => handleRemove(member.name)}>
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
  phoneInputContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pickerContainer: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', minWidth: 120, height: 50, overflow: 'hidden' },
  picker: { color: '#fff', backgroundColor: 'transparent' },
  addButton: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
  section: { marginTop: 10 },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  memberName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  meTag: { color: '#f5a623', fontSize: 12, marginTop: 2 },
});
