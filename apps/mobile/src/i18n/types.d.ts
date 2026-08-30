import 'react-i18next';
import type { resources } from './index';

// Intended to type every t() key against the English resources.
//
// ⚠️ IT DOES NOT CURRENTLY DO THAT, and the build passing is not evidence that it does.
// `CustomTypeOptions` is declared by **i18next**, not react-i18next, so augmenting
// 'react-i18next' declares a brand-new interface that nothing reads. A misspelled or
// deleted key compiles clean today — verified 2026-08-30 with a deliberate typo.
//
// Pointing this at 'i18next' switches the checking on and surfaces ~490 errors. Only
// about a third are genuine bad keys; the rest are cross-namespace calls —
// `t('common:back')`, `t('poker:phases.flop')`, `t('bluff:claims.pair')` — which the
// typing only accepts once every namespace referenced is declared at the hook, i.e.
// `useTranslation(['bluff', 'common', 'poker'])`. That is an app-wide sweep of every
// useTranslation call site and belongs in its own change; doing it here would have meant
// rewriting 30 unrelated files. Left as-is deliberately rather than silently.
//
// Until it lands, the real guards on i18n are `npm run lint`
// (i18next/no-literal-string) and src/i18n/__tests__/parity.test.ts (en/fr key +
// placeholder parity). Neither catches a key missing from BOTH languages — that is the
// gap, and it is why moving keys between namespaces has to be grep-verified by hand.
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['en'];
  }
}
