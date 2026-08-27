import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { AmountInput } from '../ui/AmountInput';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { initials, formatHandAmount } from '../../lib/format';
import type { ActionType, HandPlayer, UnitMode } from '../../types';

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
  unitMode?: UnitMode;
  // What the player still has behind, and the largest "bet to" they can reach this street
  // (contribution + behind). All-in commits maxTo directly, no amount typed.
  remainingStack?: number;
  maxTo?: number;
  disabled?: boolean;
  // Prefill for the raise field (a "raise to" total, e.g. 2 BB on the hand's first raise) —
  // still fully editable.
  defaultRaiseTo?: number;
  onAction: (type: ActionType, amount?: number) => void;
}

// Bet/raise collect a typed amount. All-in commits maxTo directly when the player's stack is
// known; with no stack set it still must collect an amount — otherwise it never updates the
// street's current bet and the pot silently drops that player's chips entirely.
const NEEDS_AMOUNT: ActionType[] = ['bet', 'raise', 'allin'];

export function PlayerActionRow({
  player,
  availableActions,
  position,
  currentBet = 0,
  unitMode = 'chips',
  remainingStack,
  maxTo,
  disabled = false,
  defaultRaiseTo,
  onAction,
}: Props) {
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const [amountFor, setAmountFor] = useState<ActionType | null>(null);
  const [amount, setAmount] = useState('');

  const tonePressableStyle = (type: ActionType) => {
    if (type === 'fold') return { borderColor: colors.loss, backgroundColor: 'transparent' };
    // All-in gets the table's gold, not the money green — it's a different kind of moment
    // than a routine bet/raise (and green next to green read as "just another raise").
    if (type === 'allin') return { borderColor: colors.gold, backgroundColor: colors.goldTint };
    if (type === 'bet' || type === 'raise') {
      return { borderColor: colors.accent, backgroundColor: colors.accentTint };
    }
    return { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg };
  };

  const toneTextColor = (type: ActionType) => {
    if (type === 'fold') return colors.loss;
    if (type === 'allin') return colors.gold;
    if (type === 'bet' || type === 'raise') return colors.accent;
    return colors.textPrimary;
  };

  const handlePress = (type: ActionType) => {
    if (type === 'allin' && maxTo !== undefined) {
      onAction('allin', maxTo);
      return;
    }
    if (NEEDS_AMOUNT.includes(type)) {
      setAmountFor(type);
      if (type === 'raise' && defaultRaiseTo !== undefined && (maxTo === undefined || defaultRaiseTo <= maxTo)) {
        // A short stack that can't reach the default gets the usual blank field instead of a
        // prefilled invalid amount.
        setAmount(String(defaultRaiseTo));
      } else {
        setAmount('');
      }
      return;
    }
    onAction(type);
  };

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  // A raise must strictly exceed the outstanding bet or it isn't a raise; a fresh bet just
  // needs to be positive. Catches the "0€ raise" / "raise below the current bet" mistakes
  // that used to slip through silently since nothing validated the typed amount at all.
  const minAmount = amountFor === 'raise' ? currentBet : 0;
  const overMax = maxTo !== undefined && parsedAmount > maxTo;
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > minAmount && !overMax;

  const confirmAmount = () => {
    if (!amountFor || !amountValid) return;
    onAction(amountFor, parsedAmount);
    setAmountFor(null);
    setAmount('');
  };

  const actionLabel = (type: ActionType) => {
    // A short stack's call is capped at what they can actually put in — label the real amount.
    if (type === 'call' && currentBet > 0)
      return t('actionButtons.callAmount', {
        amount: formatHandAmount(maxTo !== undefined ? Math.min(currentBet, maxTo) : currentBet, unitMode),
      });
    return t(`actionButtons.${type}`);
  };

  // Whole-sentence hint per combination — never assembled from dash-joined fragments.
  const amountHint = (() => {
    const amountLabel = formatHandAmount(currentBet, unitMode);
    const maxLabel = maxTo !== undefined ? formatHandAmount(maxTo, unitMode) : undefined;
    if (currentBet > 0 && amountFor === 'raise') {
      return maxLabel !== undefined
        ? t('amountHint.minRaiseMax', { amount: amountLabel, max: maxLabel })
        : t('amountHint.minRaise', { amount: amountLabel });
    }
    if (currentBet > 0) {
      return maxLabel !== undefined
        ? t('amountHint.currentBetMax', { amount: amountLabel, max: maxLabel })
        : t('amountHint.currentBet', { amount: amountLabel });
    }
    return maxLabel !== undefined ? t('amountHint.maxOnly', { max: maxLabel }) : '';
  })();

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
        {remainingStack !== undefined && (
          <Text style={[styles.stackText, { color: colors.textTertiary }]}>
            {t('stack', { amount: formatHandAmount(remainingStack, unitMode) })}
          </Text>
        )}
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
          {(currentBet > 0 || maxTo !== undefined) && (
            <Text style={[styles.amountHint, { color: overMax ? colors.loss : colors.textTertiary }]}>{amountHint}</Text>
          )}
          <View style={styles.amountRow}>
            <View style={styles.amountField}>
              <AmountInput value={amount} onChange={setAmount} placeholder={t('amountPlaceholder')} unit={unitMode === 'bb' ? 'BB' : ''} allowDecimal={unitMode === 'bb'} />
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
  stackText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
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
