import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { AmountInput } from '../ui/AmountInput';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { initials } from '../../lib/format';
import type { ActionType, HandPlayer } from '../../types';

interface Props {
  player: HandPlayer;
  availableActions: ActionType[];
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
};

const NEEDS_AMOUNT: ActionType[] = ['bet', 'raise'];

export function PlayerActionRow({ player, availableActions, disabled = false, onAction }: Props) {
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

  const confirmAmount = () => {
    if (!amountFor) return;
    const value = parseFloat(amount.replace(',', '.'));
    onAction(amountFor, Number.isFinite(value) ? value : undefined);
    setAmountFor(null);
    setAmount('');
  };

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.neutralTileBg }]}>
          <Text style={[styles.avatarText, { color: colors.textSecondary }]}>{initials(player.name)}</Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {player.name}
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
              <Text style={[styles.actionText, { color: toneTextColor(type) }]}>{LABELS[type]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {amountFor && (
        <View style={styles.amountRow}>
          <View style={styles.amountField}>
            <AmountInput value={amount} onChange={setAmount} placeholder="Montant" />
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.accentBright }]}
            onPress={confirmAmount}
            activeOpacity={0.8}
          >
            <Check size={18} color="#0A0A0F" strokeWidth={2.5} />
          </TouchableOpacity>
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  amountField: {
    flex: 1,
  },
  confirmBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
