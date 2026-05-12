import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, logout } from '../../stores/authStore';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function MenuScreen() {
  const router = useRouter();
  const auth = getAuth();
  const isAdmin = auth?.isAdmin || false;
  
  const PRIVACY_URL = 'https://tu-app.onrender.com/legal/privacy';
  const TERMS_URL = 'https://tu-app.onrender.com/legal/terms';

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Cerrar Sesión', 
        style: 'destructive', 
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        } 
      },
    ]);
  };

  const MenuButton = ({ icon, label, onPress, color = '#fff', sublabel = '' }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#334155" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Menú Principal</Text>
        <Text style={styles.subtitle}>Gestiona tu perfil y explora más opciones</Text>
      </View>

      <View style={styles.section}>
        <MenuButton 
          icon="format-list-bulleted" 
          label="El Muro" 
          sublabel="Ver todas las predicciones del grupo"
          onPress={() => router.push('/(tabs)/pool')}
          color="#3b82f6"
        />
        <MenuButton 
          icon="person" 
          label="Mi Perfil" 
          sublabel="Ajustes de cuenta e IA"
          onPress={() => router.push('/(tabs)/profile')}
          color="#10b981"
        />
        <MenuButton 
          icon="notifications" 
          label="Notificaciones" 
          sublabel="Silenciar o personalizar avisos"
          onPress={() => router.push('/(tabs)/notifications')}
          color="#f43f5e"
        />
        <MenuButton 
          icon="menu-book" 
          label="Reglas del Juego" 
          sublabel="Cómo puntuar y modos de juego"
          onPress={() => router.push('/(tabs)/rules')}
          color="#10b981"
        />
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administración</Text>
          <MenuButton 
            icon="admin-panel-settings" 
            label="Panel de Control" 
            sublabel="Gestionar miembros y reglas"
            onPress={() => router.push('/(tabs)/admin')}
            color="#f5a623"
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal y Privacidad</Text>
        <MenuButton 
          icon="security" 
          label="Política de Privacidad" 
          sublabel="Cómo cuidamos tus datos"
          onPress={() => Linking.openURL(PRIVACY_URL)}
          color="#94a3b8"
        />
        <MenuButton 
          icon="gavel" 
          label="Términos de Uso" 
          sublabel="Condiciones del servicio (EULA)"
          onPress={() => Linking.openURL(TERMS_URL)}
          color="#94a3b8"
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Predicción Mundial v1.2.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  content: { padding: 20, paddingTop: 40 },
  header: { marginBottom: 32 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 4 },
  section: { marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sectionTitle: { color: '#475569', fontSize: 12, fontWeight: '800', marginLeft: 16, marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  textContainer: { flex: 1 },
  menuLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  menuSublabel: { color: '#64748b', fontSize: 12, marginTop: 2 },
  footer: { marginTop: 20, alignItems: 'center' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, gap: 8 },
  logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
  version: { color: '#334155', fontSize: 11, marginTop: 24, fontWeight: '600' }
});
