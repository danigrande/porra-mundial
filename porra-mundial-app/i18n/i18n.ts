// ============================================
// i18n — Internationalization Module
// ============================================
// Lightweight i18n for the Expo app.
// Usage:
//   import { useTranslation } from '../i18n/i18n';
//   const { t } = useTranslation();
//   <Text>{t('auth.login')}</Text>

import { useState, useEffect } from 'react';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from './es.json';
import en from './en.json';

const STORAGE_KEY = 'app_language';

type TranslationMap = Record<string, any>;
const translations: Record<string, TranslationMap> = { es, en };

// Supported languages metadata (for LanguageSwitcher)
export const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

let currentLang = 'es'; // Default
let isInitialized = false;

// Listeners for reactive updates
const listeners = new Set<() => void>();

/**
 * Gets the device's default system language.
 */
function getSystemLanguage(): string {
  try {
    if (Platform.OS === 'web') {
      const webLang = navigator.language || (navigator as any).userLanguage;
      if (webLang) {
        return webLang.split('-')[0].toLowerCase();
      }
    } else if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const locale = settings?.AppleLocale || settings?.AppleLanguages?.[0];
      if (locale) {
        return locale.split(/[-_]/)[0].toLowerCase();
      }
    } else if (Platform.OS === 'android') {
      const locale = NativeModules.I18nManager?.localeIdentifier;
      if (locale) {
        return locale.split(/[-_]/)[0].toLowerCase();
      }
    }
  } catch (e) {
    console.warn('[i18n] Error getting system locale:', e);
  }
  return 'es'; // default fallback
}

/**
 * Initialize i18n — call once at app startup.
 * Loads the saved language from AsyncStorage, falling back to system language.
 */
export async function initI18n(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) {
      currentLang = saved;
    } else {
      const sysLang = getSystemLanguage();
      currentLang = translations[sysLang] ? sysLang : 'es';
    }
  } catch (e) {
    console.warn('[i18n] Error loading saved language:', e);
  }
  isInitialized = true;
  return currentLang;
}

/**
 * Translate a key using dot notation.
 * Supports simple interpolation: t('chat.what_to_do', { name: 'Dani' })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[currentLang];

  for (const k of keys) {
    if (value == null) break;
    value = value[k];
  }

  // Fallback to Spanish if key not found in current language
  if (typeof value !== 'string') {
    let fallback: any = translations['es'];
    for (const k of keys) {
      if (fallback == null) break;
      fallback = fallback[k];
    }
    value = typeof fallback === 'string' ? fallback : key;
  }

  // Interpolation: replace {{param}} with values
  if (params && typeof value === 'string') {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue));
    }
  }

  return value;
}

/**
 * Get current language code.
 */
export function getLanguage(): string {
  return currentLang;
}

/**
 * Switch to a different language and persist the choice.
 */
export async function setLanguage(lang: string): Promise<void> {
  if (!translations[lang]) {
    console.warn(`[i18n] Language "${lang}" not available. Available: ${Object.keys(translations).join(', ')}`);
    return;
  }
  currentLang = lang;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    console.warn('[i18n] Error saving language:', e);
  }
  // Notify all listeners
  listeners.forEach(fn => fn());
}

/**
 * React hook for translations.
 * Components using this hook will re-render when the language changes.
 */
export function useTranslation() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const callback = () => forceUpdate(n => n + 1);
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }, []);

  return {
    t,
    language: currentLang,
    setLanguage,
    languages: LANGUAGES,
  };
}

/**
 * Translate a team name or bracket placeholder.
 * If translation key "teams.Team Name" exists, returns it, otherwise returns teamName.
 */
export function tTeam(teamName: string): string {
  if (!teamName) return '';
  
  const trimmed = teamName.trim();
  if (trimmed === 'TBD' || trimmed === 'Por definir' || trimmed.toUpperCase() === 'TBD') {
    return t('common.to_be_defined');
  }

  // Check if teamName is a placeholder like '1A', '2B', etc.
  const groupMatch = trimmed.match(/^([1-2])([A-L])$/);
  if (groupMatch) {
    const pos = groupMatch[1];
    const letter = groupMatch[2];
    return t('predictions.group_position', { pos, letter });
  }

  // Check other placeholders like '3ABCDF' (best third)
  if (/^3[A-L]+$/.test(trimmed)) {
    return t('predictions.best_third');
  }

  // Ganador/Perdedor de partido: "W73", "L101"
  const matchRef = trimmed.match(/^([WL])(\d+)$/);
  if (matchRef) {
    const type = matchRef[1];
    const num = matchRef[2];
    return type === 'W' ? t('predictions.winner_of', { num }) : t('predictions.loser_of', { num });
  }

  const translated = t(`teams.${trimmed}`);
  return translated === `teams.${trimmed}` ? trimmed : translated;
}

