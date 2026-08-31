import type { UnitMode } from '../types';

export type AppLanguage = 'fr' | 'en';

// This module must stay free of react-native / expo imports so pure-TS code (and vitest)
// can use it. The active language is pushed in by src/i18n on init and on every change.
const LOCALE_TAGS: Record<AppLanguage, string> = { fr: 'fr-FR', en: 'en-US' };

let currentLanguage: AppLanguage = 'fr';

export function setFormatLocale(language: AppLanguage): void {
  currentLanguage = language;
}

function localeTag(): string {
  return LOCALE_TAGS[currentLanguage];
}

// Intl formatter construction is expensive — cache per locale+options.
const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${localeTag()}|${JSON.stringify(options)}`;
  let fmt = numberFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(localeTag(), options);
    numberFormatCache.set(key, fmt);
  }
  return fmt;
}

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${localeTag()}|${JSON.stringify(options)}`;
  let fmt = dateFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(localeTag(), options);
    dateFormatCache.set(key, fmt);
  }
  return fmt;
}

export function formatAmount(val: number): string {
  return numberFormat({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.abs(val));
}

// Bare chip count, no currency symbol — for hand-replayer amounts, which are chips, not money.
export function formatChips(val: number): string {
  return numberFormat({ maximumFractionDigits: 0 }).format(Math.abs(val));
}

// Two-decimal rounding for hand amounts. BB-mode sums accumulate 0.5s and typed decimals,
// so every summation must pass through this or pots drift to 2.4999999999-style values.
export function roundAmount(val: number): number {
  return Math.round(val * 100) / 100;
}

// Unit-aware hand amount: chips stay bare integers, BB mode keeps decimals with a
// locale-formatted number and a "BB" suffix ("12,5 BB" / "12.5 BB"). formatChips would
// silently truncate 0.5 BB to "0".
export function formatHandAmount(val: number, unitMode: UnitMode = 'chips'): string {
  if (unitMode !== 'bb') return formatChips(val);
  return `${numberFormat({ maximumFractionDigits: 2 }).format(roundAmount(Math.abs(val)))} BB`;
}

export function formatLevelDuration(levels: { durationMinutes: number }[]): string {
  const durations = levels.map((l) => l.durationMinutes);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  return min === max ? `${min} min` : `${min}–${max} min`;
}

/**
 * Avatar initials: the first letter of the first two words. Words that do not START with a
 * letter are skipped, because callers hand this display names rather than raw pseudos — an
 * online seat labelled "mathieuchfd (toi)" was coming out as "M(". Falls back to the raw
 * split when nothing starts with a letter, so an emoji pseudo still shows something —
 * indexed by code point, since `w[0]` cuts a surrogate pair in half.
 */
export function initials(name: string): string {
  const words = name.split(' ').filter(Boolean);
  const lettered = words.filter((w) => /^\p{L}/u.test(w));
  return (lettered.length > 0 ? lettered : words)
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase())
    .join('');
}

// Parses 'YYYY-MM-DD' as local midnight. new Date(iso) parses as UTC midnight,
// which shifts the date back a day on negative-UTC-offset devices.
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateParts(iso?: string): { day: string; month: string } {
  if (!iso) return { day: '', month: '' };
  const date = parseIsoDate(iso);
  return {
    day: dateFormat({ day: '2-digit' }).format(date),
    // French short months carry a trailing period ('janv.') — strip it before uppercasing.
    month: dateFormat({ month: 'short' }).format(date).replace('.', '').toUpperCase(),
  };
}

export function formatDateShort(iso: string): string {
  return dateFormat({ day: 'numeric', month: 'short' }).format(parseIsoDate(iso));
}

function formatDateLong(date: Date): string {
  return dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '';
  if (startDate && endDate && startDate !== endDate) {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      // Word order differs per language: '5 – 12 août 2026' vs 'August 5 – 12, 2026'.
      if (currentLanguage === 'en') {
        const month = dateFormat({ month: 'long' }).format(end);
        return `${month} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
      }
      return `${start.getDate()} – ${formatDateLong(end)}`;
    }
    return `${formatDateShort(startDate)} – ${formatDateLong(end)}`;
  }
  const single = startDate ?? endDate!;
  return formatDateLong(parseIsoDate(single));
}

export function formatDateRangeShort(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '';
  if (!endDate || startDate === endDate) {
    const { day, month } = formatDateParts(startDate ?? endDate);
    return formatDayMonth(day, month);
  }
  if (!startDate) {
    const { day, month } = formatDateParts(endDate);
    return formatDayMonth(day, month);
  }
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const startParts = formatDateParts(startDate);
  const endParts = formatDateParts(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    if (currentLanguage === 'en') return `${endParts.month} ${startParts.day} – ${endParts.day}`;
    return `${startParts.day} – ${endParts.day} ${endParts.month}`;
  }
  return `${formatDayMonth(startParts.day, startParts.month)} – ${formatDayMonth(endParts.day, endParts.month)}`;
}

// '05 AOÛT' (fr) vs 'AUG 05' (en).
function formatDayMonth(day: string, month: string): string {
  return currentLanguage === 'en' ? `${month} ${day}` : `${day} ${month}`;
}

// Local-time 'YYYY-MM-DD' for today. toISOString() is UTC and can be a day ahead/behind.
function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function isFestivalOngoing(startDate?: string, endDate?: string, todayIso?: string): boolean {
  if (!startDate) return false;
  const today = todayIso ?? localTodayIso();
  const end = endDate ?? startDate;
  return startDate <= today && today <= end;
}
