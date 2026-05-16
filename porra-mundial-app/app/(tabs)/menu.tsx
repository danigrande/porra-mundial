import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, logout } from '../../stores/authStore';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function MenuScreen() {
  const router = useRouter();
  const auth = getAuth();
  const isAdmin = auth?.isAdmin || false;
  const { t } = useTranslation();
  
  const PRIVACY_URL = 'https://tu-app.onrender.com/legal/privacy';
  const TERMS_URL = 'https://tu-app.onrender.com/legal/terms';

  const handleLogout = () => {
    Alert.alert(t('menu.logout_confirm_title'), t('menu.logout_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { 
        text: t('menu.logout'), 
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
        <Text style={styles.title}>{t('menu.title')}</Text>
        <Text style={styles.subtitle}>{t('menu.subtitle')}</Text>
      </View>

      <View style={styles.section}>
        <MenuButton 
          icon="format-list-bulleted" 
          label={t('menu.the_wall')} 
          sublabel={t('menu.the_wall_sub')}
          onPress={() => router.push('/(tabs)/pool')}
          color="#3b82f6"
        />
        <MenuButton 
          icon="person" 
          label={t('menu.my_profile')} 
          sublabel={t('menu.my_profile_sub')}
          onPress={() => router.push('/(tabs)/profile')}
          color="#10b981"
        />
        <MenuButton 
          icon="notifications" 
          label={t('menu.notifications')} 
          sublabel={t('menu.notifications_sub')}
          onPress={() => router.push('/(tabs)/notifications')}
          color="#f43f5e"
        />
        <MenuButton 
          icon="menu-book" 
          label={t('menu.rules')} 
          sublabel={t('menu.rules_sub')}
          onPress={() => router.push('/(tabs)/rules')}
          color="#10b981"
        />
      </View>

      {/* Language Switcher */}
      <View style={styles.section}>
        <View style={styles.languageRow}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(168, 85, 247, 0.08)' }]}>
            <MaterialIcons name="language" size={24} color="#a855f7" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.menuLabel}>{t('menu.language')}</Text>
            <Text style={styles.menuSublabel}>{t('menu.language_sub')}</Text>
          </View>
        </View>
        <View style={styles.switcherContainer}>
          <LanguageSwitcher />
        </View>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('menu.admin_section')}</Text>
          <MenuButton 
            icon="admin-panel-settings" 
            label={t('menu.admin_panel')} 
            sublabel={t('menu.admin_panel_sub')}
            onPress={() => router.push('/(tabs)/admin')}
            color="#f5a623"
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('menu.legal_section')}</Text>
        <MenuButton 
          icon="security" 
          label={t('menu.privacy_policy')} 
          sublabel={t('menu.privacy_sub')}
          onPress={() => Linking.openURL(PRIVACY_URL)}
          color="#94a3b8"
        />
        <MenuButton 
          icon="gavel" 
          label={t('menu.terms_of_use')} 
          sublabel={t('menu.terms_sub')}
          onPress={() => Linking.openURL(TERMS_URL)}
          color="#94a3b8"
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>{t('menu.logout')}</Text>
        </TouchableOpacity>
        <Text style={styles.version}>{t('menu.version')}</Text>
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
  languageRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16 },
  switcherContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  footer: { marginTop: 20, alignItems: 'center' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, gap: 8 },
  logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
  version: { color: '#334155', fontSize: 11, marginTop: 24, fontWeight: '600' }
});
