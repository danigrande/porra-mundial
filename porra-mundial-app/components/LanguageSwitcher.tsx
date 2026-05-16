import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation, LANGUAGES } from '../i18n/i18n';

/**
 * LanguageSwitcher — compact pill-style language toggle.
 * Shows flag + language code for each available language.
 * Usage: <LanguageSwitcher />
 */
export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();

  return (
    <View style={styles.container}>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[styles.pill, language === lang.code && styles.pillActive]}
          onPress={() => setLanguage(lang.code)}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{lang.flag}</Text>
          <Text style={[styles.label, language === lang.code && styles.labelActive]}>
            {lang.code.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  pillActive: {
    backgroundColor: '#1e40af',
    borderColor: '#3b82f6',
  },
  flag: {
    fontSize: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  labelActive: {
    color: '#fff',
  },
});
