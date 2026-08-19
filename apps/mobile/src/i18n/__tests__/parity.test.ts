/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Guards the fr/en contract: every key must exist in BOTH languages, with no empty
// values and identical {{placeholder}} sets. Reads the JSON from disk on purpose —
// importing src/i18n would drag expo-localization into the node test env.

const I18N_DIR = join(__dirname, '..');

type Json = { [key: string]: string | Json };

function loadLocale(locale: string): Map<string, Json> {
  const dir = join(I18N_DIR, locale);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  return new Map(files.map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8')) as Json]));
}

function flatten(obj: Json, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();
}

const en = loadLocale('en');
const fr = loadLocale('fr');

describe('i18n en/fr parity', () => {
  it('has the same namespace files in both languages', () => {
    expect([...fr.keys()]).toEqual([...en.keys()]);
  });

  for (const [file, enJson] of en) {
    const frJson = fr.get(file);
    describe(file, () => {
      it('exists in fr', () => {
        expect(frJson, `${file} missing in fr/`).toBeDefined();
      });

      if (!frJson) return;
      const enFlat = flatten(enJson);
      const frFlat = flatten(frJson);

      it('has identical key sets', () => {
        const missingInFr = [...enFlat.keys()].filter((k) => !frFlat.has(k));
        const missingInEn = [...frFlat.keys()].filter((k) => !enFlat.has(k));
        expect(missingInFr, `keys missing in fr/${file}`).toEqual([]);
        expect(missingInEn, `keys missing in en/${file}`).toEqual([]);
      });

      it('has no empty values', () => {
        const emptyEn = [...enFlat].filter(([, v]) => v.trim() === '').map(([k]) => k);
        const emptyFr = [...frFlat].filter(([, v]) => v.trim() === '').map(([k]) => k);
        expect(emptyEn, `empty values in en/${file}`).toEqual([]);
        expect(emptyFr, `empty values in fr/${file}`).toEqual([]);
      });

      it('uses the same {{placeholders}} per key', () => {
        const mismatches = [...enFlat]
          .filter(([key, value]) => {
            const frValue = frFlat.get(key);
            return frValue !== undefined && placeholders(value).join(',') !== placeholders(frValue).join(',');
          })
          .map(([key]) => key);
        expect(mismatches, `placeholder mismatch between en/fr in ${file}`).toEqual([]);
      });
    });
  }
});
