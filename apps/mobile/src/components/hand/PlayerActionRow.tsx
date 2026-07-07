import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { AmountInput } from '../ui/AmountInput';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { initials, formatChips } from '../../lib/format';
import type { ActionType, HandPlayer } from '../../types';

interface Props {
  player: HandPlayer;
  availableActions: ActionType[];
  // Table position (BTN/SB/BB/UTG/...), shown next to the name so the person recording can
  // see who they're looking at without cross-referencing the Joueurs step.
  position?: string;
  // The street's outstanding bet-to amount — 0 if nobody has bet yet. Drives the "Call X"
  // label and the minimum a raise must clear, so whoever is recording the hand can actually
  // see what they're responding to instead of entering amounts blind.
  currentBet?: number;
  disabled?: boolean;
  onAction: (type: ActionType, amount?: number) => void;
}

const LABELS: Record<ActionType, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Miser',
  raise: 'Relancer',
  allin: 'All-in',
  post: 'Poste',
};

// All-in must collect an amount too — otherwise it never updates the street's current bet,
// so a call right after an all-in has nothing correct to match and the pot total silently
// drops that player's chips entirely.
const NEEDS_AMOUNT: ActionType[] = ['bet', 'raise', 'allin'];

export function PlayerActionRow({ player, availableActions, position, currentBet = 0, disabled = false, onAction }: Props) {
  const { colors } = useTheme();
  const [amountFor, setAmountFor] = useState<ActionType | null>(null);
  const [amount, setAmount] = useState('');

  const tonePressableStyle = (type: ActionType) => {
    if (type === 'fold') return { borderColor: colors.loss, backgroundColor: 'transparent' };
    if (type === 'bet' || type === 'raise' || type === 'allin') {
      return { borderColor: colors.accent, backgroundColor: colors.accentTint };
    }
    return { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg };
  };

  const toneTextColor = (type: ActionType) => {
    if (type === 'fold') return colors.loss;
    if (type === 'bet' || type === 'raise' || type === 'allin') return colors.accent;
    return colors.textPrimary;
  };

  const handlePress = (type: ActionType) => {
    if (NEEDS_AMOUNT.includes(type)) {
      setAmountFor(type);
      setAmount('');
      return;
    }
    onAction(type);
  };

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  // A raise must strictly exceed the outstanding bet or it isn't a raise; a fresh bet just
  // needs to be positive. Catches the "0€ raise" / "raise below the current bet" mistakes
  // that used to slip through silently since nothing validated the typed amount at all.
  const minAmount = amountFor === 'raise' ? currentBet : 0;
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > minAmount;

  const confirmAmount = () => {
    if (!amountFor || !amountValid) return;
    onAction(amountFor, parsedAmount);
    setAmountFor(null);
    setAmount('');
  };

  const actionLabel = (type: ActionType) => {
    if (type === 'call' && currentBet > 0) return `Call ${formatChips(currentBet)}`;
    return LABELS[type];
  };

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.neutralTileBg }]}>
          <Text style={[styles.avatarText, { color: colors.textSecondary }]}>{initials(player.name)}</Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {player.name}
          {position ? ` (${position})` : ''}
        </Text>
      </View>

      {!disabled && (
        <View style={styles.actions}>
          {availableActions.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.actionBtn, tonePressableStyle(type)]}
              onPress={() => handlePress(type)}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionText, { color: toneTextColor(type) }]}>{actionLabel(type)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {amountFor && (
        <View style={styles.amountGroup}>
          {currentBet > 0 && (
            <Text style={[styles.amountHint, { color: colors.textTertiary }]}>
              Mise actuelle : {formatChips(currentBet)}
              {amountFor === 'raise' ? ` — relance min. ${formatChips(currentBet + 1)}` : ''}
            </Text>
          )}
          <View style={styles.amountRow}>
            <View style={styles.amountField}>
              <AmountInput value={amount} onChange={setAmount} placeholder="Montant" />
            </View>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.accentBright }, !amountValid && styles.confirmBtnDisabled]}
              onPress={confirmAmount}
              disabled={!amountValid}
              activeOpacity={0.8}
            >
              <Check size={18} color="#0A0A0F" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  name: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  amountGroup: {
    gap: spacing.xs,
  },
  amountHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  amountField: {
    flex: 1,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
