/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Every literal t('…') in the app must resolve to a key that actually exists.
//
// This is not belt-and-braces: it is the ONLY guard on it. The typed-key setup in
// ../types.d.ts does not work (it augments the wrong module — see the comment there), so a
// deleted or misspelled key compiles clean and ships as raw key text on screen. parity.test.ts
// only checks that en and fr agree with each other, so a key missing from BOTH passes it too.
//
// Written after moving 29 shared keys out of the bluff/ofc namespaces into games, where a
// single missed call site would have shown "games:online.quit" on a button.

const I18N_DIR = join(__dirname, '..');
const APP_ROOT = join(I18N_DIR, '..', '..');
const SCAN_DIRS = ['app', 'src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'ios', 'android', '.expo', '__tests__']);

type Json = { [key: string]: string | Json };

function flatten(obj: Json, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.add(path);
    else for (const k of flatten(value, path)) out.add(k);
  }
  return out;
}

function loadEnglish(): Map<string, Set<string>> {
  const dir = join(I18N_DIR, 'en');
  return new Map(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [f.slice(0, -5), flatten(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Json)])
  );
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** i18next stores plurals as `key_one` / `key_other`, so `t('key', { count })` is valid. */
function existsIn(keys: Set<string>, key: string): boolean {
  if (keys.has(key)) return true;
  for (const k of keys) if (k.startsWith(`${key}_`)) return true;
  return false;
}

describe('every literal t() key resolves', () => {
  const english = loadEnglish();
  const files = SCAN_DIRS.flatMap((d) => sourceFiles(join(APP_ROOT, d)));

  it('scans a plausible number of files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds no unresolved keys', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // The namespace a bare t('key') resolves against. Files that only receive a
      // TFunction as a parameter (lib/bluff/labels.ts) declare none — their bare keys
      // are checked at the call site instead, so skip them there.
      const declared = [...src.matchAll(/useTranslation\(\s*'([a-z]+)'/g)].map((m) => m[1]);
      const defaultNs = declared[0];

      for (const match of src.matchAll(/\bt\(\s*'([^']+)'/g)) {
        const raw = match[1];
        const [ns, key] = raw.includes(':') ? raw.split(/:(.+)/) : [defaultNs, raw];
        if (!ns) continue; // bare key in a file with no namespace of its own
        checked++;
        const rel = file.slice(APP_ROOT.length + 1);
        const bucket = english.get(ns);
        if (!bucket) problems.push(`${rel}: t('${raw}') — no such namespace '${ns}'`);
        else if (!existsIn(bucket, key)) problems.push(`${rel}: t('${raw}') — '${key}' missing from ${ns}`);
      }
    }

    expect(checked).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });
});
