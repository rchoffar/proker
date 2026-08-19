import 'react-i18next';
import type { resources } from './index';

// Types every t() key against the English resources: an unknown or misspelled key
// fails `tsc --noEmit`. The en/fr parity vitest test guarantees fr matches.
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['en'];
  }
}
