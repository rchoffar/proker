// Hermes ships no Intl.PluralRules — without this polyfill every count-based key
// silently falls back to _other. Must be imported before i18next initializes.
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { setFormatLocale, type AppLanguage } from '../lib/format';

import enAuth from './en/auth.json';
import enCommon from './en/common.json';
import enPoker from './en/poker.json';
import enDashboard from './en/dashboard.json';
import enFinder from './en/finder.json';
import enDegen from './en/degen.json';
import enProfile from './en/profile.json';
import enGames from './en/games.json';
import enBluff from './en/bluff.json';
import enOfc from './en/ofc.json';
import enReplayer from './en/replayer.json';
import enStats from './en/stats.json';

import frAuth from './fr/auth.json';
import frCommon from './fr/common.json';
import frPoker from './fr/poker.json';
import frDashboard from './fr/dashboard.json';
import frFinder from './fr/finder.json';
import frDegen from './fr/degen.json';
import frProfile from './fr/profile.json';
import frGames from './fr/games.json';
import frBluff from './fr/bluff.json';
import frOfc from './fr/ofc.json';
import frReplayer from './fr/replayer.json';
import frStats from './fr/stats.json';

export const resources = {
  en: {
    auth: enAuth,
    common: enCommon,
    poker: enPoker,
    dashboard: enDashboard,
    finder: enFinder,
    degen: enDegen,
    profile: enProfile,
    games: enGames,
    bluff: enBluff,
    ofc: enOfc,
    replayer: enReplayer,
    stats: enStats,
  },
  fr: {
    auth: frAuth,
    common: frCommon,
    poker: frPoker,
    dashboard: frDashboard,
    finder: frFinder,
    degen: frDegen,
    profile: frProfile,
    games: frGames,
    bluff: frBluff,
    ofc: frOfc,
    replayer: frReplayer,
    stats: frStats,
  },
} as const;

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const supportedLocales: readonly string[] = ['fr', 'en'];
export const defaultLocale: AppLanguage = supportedLocales.includes(deviceLocale)
  ? (deviceLocale as AppLanguage)
  : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

// Keep src/lib/format.ts (RN-free on purpose) in sync with the active language.
setFormatLocale(defaultLocale);
i18n.on('languageChanged', (lng) => setFormatLocale(lng === 'fr' ? 'fr' : 'en'));

export default i18n;
