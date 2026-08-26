import { createMMKV } from 'react-native-mmkv';

// Single shared MMKV instance + zustand `createJSONStorage` adapter, used by every
// persisted store (app, auth, hand history). One id keeps all persisted state in one file.
const mmkv = createMMKV({ id: 'proker' });

export const mmkvStorage = {
  setItem: (name: string, value: string) => { mmkv.set(name, value); },
  getItem: (name: string) => mmkv.getString(name) ?? null,
  removeItem: (name: string) => { mmkv.remove(name); },
};
