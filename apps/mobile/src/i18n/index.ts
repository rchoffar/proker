import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import fr from './fr.json';
import en from './en.json';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const supportedLocales = ['fr', 'en'];
const defaultLocale = supportedLocales.includes(deviceLocale) ? deviceLocale : 'en';

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: defaultLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
