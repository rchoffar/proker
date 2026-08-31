import { describe, expect, it } from 'vitest';
import { initials } from '../format';

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Rémy Choffardet')).toBe('RC');
    expect(initials('mathieuchfd')).toBe('M');
    expect(initials('Jean Michel Dupont')).toBe('JM');
  });

  // Callers hand this DISPLAY names, not raw pseudos: an online seat reads
  // "mathieuchfd (toi)", and taking the first letter of the first two words made that "M(".
  it('skips words that do not start with a letter', () => {
    expect(initials('mathieuchfd (toi)')).toBe('M');
    expect(initials('mathieuchfd (you)')).toBe('M');
    expect(initials('Auré! (toi)')).toBe('A');
  });

  it('still shows something for a name with no letters at all', () => {
    expect(initials('🙂')).toBe('🙂');
  });

  it('survives empty and whitespace-only names', () => {
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });
});
