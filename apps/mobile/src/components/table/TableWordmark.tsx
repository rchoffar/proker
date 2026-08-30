import { Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize } from '../../design-system/theme';

// The brand under the board. Every game table carries it, not just the exported video —
// the felt is what ends up in a screenshot or a story either way.
//
// "Ultimate Poker Kit" is on the do-not-translate glossary (apps/mobile/AGENTS.md), so it is
// a literal here rather than a t() key.
export function TableWordmark() {
  return <Text style={styles.wordmark}>Ultimate Poker Kit</Text>;
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.22)',
    marginTop: 14,
    textAlign: 'center',
  },
});
