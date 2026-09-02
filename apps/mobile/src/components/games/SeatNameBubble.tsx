import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// The add-player popup from Mathieu's setup mockup: a small bubble floating next to the
// tapped seat — name input + « Valider », with existing-player suggestions while typing
// (the ask was "add OR select"). The parent board positions it and owns the outside-tap
// dismiss overlay.

const BUBBLE_W = 232;

interface Props {
  // Seat/slot center in the parent board's coordinates, and which side has room.
  anchor: { x: number; y: number; below: boolean };
  boardWidth: number;
  /**
   * Where the board's top edge is on screen, so the bubble can stay clear of the keyboard —
   * the only thing it needs to know outside its own coordinates. Null skips the clamp.
   */
  boardTopOnScreen?: number | null;
  // Existing player names not yet at the table.
  suggestions: string[];
  onPick: (name: string) => void;
  onClose: () => void;
}

export function SeatNameBubble({ anchor, boardWidth, boardTopOnScreen, suggestions, onPick, onClose }: Props) {
  const { t } = useTranslation('games');
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  // The input autofocuses, so the keyboard is coming up over the bottom of the board — which
  // is exactly where the bottom seat is. The bubble is absolutely positioned, so it does not
  // lengthen the scroll content and `automaticallyAdjustKeyboardInsets` has nothing to push:
  // the suggestions just sat under the keyboard and had to be scrolled to. It watches the
  // keyboard itself instead and never goes below it.
  const [keyboardTopOnScreen, setKeyboardTopOnScreen] = useState<number | null>(null);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardTopOnScreen(e.endCoordinates.screenY));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardTopOnScreen(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const trimmed = query.trim();
  const matches = (trimmed.length > 0
    ? suggestions.filter((n) => n.toLowerCase().includes(trimmed.toLowerCase()))
    : suggestions
  ).slice(0, 3);

  const submit = () => {
    if (!trimmed) return;
    onPick(trimmed);
    onClose();
  };

  const left = Math.max(8, Math.min(anchor.x - BUBBLE_W / 2, boardWidth - BUBBLE_W - 8));
  // Below the seat when the top half is tight; above it otherwise, lifted by the list height.
  const bubbleH = 52 + (matches.length > 0 ? 34 * matches.length : 0);
  const anchored = anchor.below ? anchor.y + 40 : anchor.y - bubbleH - 12;
  // The lowest the bubble may sit and still be whole above the keyboard, in board coordinates.
  // When that is higher than the board itself allows, the top of the board is the best spot
  // left — still visible, since the keyboard never reaches up there.
  const ceiling =
    keyboardTopOnScreen !== null && boardTopOnScreen != null
      ? keyboardTopOnScreen - boardTopOnScreen - bubbleH - 12
      : null;
  const top = Math.max(4, ceiling === null ? anchored : Math.min(anchored, ceiling));

  return (
    <View style={[styles.bubble, { left, top, backgroundColor: colors.surface.sheetBg, borderColor: colors.accent }]}>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('setup.enterName')}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.textPrimary }]}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <TouchableOpacity onPress={submit} disabled={!trimmed} activeOpacity={0.8}>
          <Text style={[styles.validate, { color: colors.accent }, !trimmed && styles.disabled]}>
            {t('setup.validate')}
          </Text>
        </TouchableOpacity>
      </View>
      {matches.map((name) => (
        <TouchableOpacity
          key={name}
          style={[styles.suggestion, { borderTopColor: colors.hairline }]}
          onPress={() => {
            onPick(name);
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.suggestionText, { color: colors.textSecondary }]} numberOfLines={1}>
            {name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_W,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    paddingVertical: 6,
  },
  validate: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  disabled: {
    opacity: 0.4,
  },
  suggestion: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});
