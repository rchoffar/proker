import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { X, Users, Clock } from 'lucide-react-native';
import { formatAmount, formatDateRange } from '../../lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Stake, Player, Festival, Tournament } from '../../types';

interface Props {
  stake: Stake | null;
  player?: Player;
  festival?: Festival;
  tournament?: Tournament;
  onClose: () => void;
}

function signedAmount(val: number): string {
  return `${val >= 0 ? '+' : '−'}${formatAmount(val)}`;
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: valueColor ?? colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: spacing.sm }} />;
}

export function StakeDetailModal({ stake, player, festival, tournament, onClose }: Props) {
  const { t } = useTranslation('tracker');
  const { colors, scheme } = useTheme();
  if (!stake) return null;

  const invested = (stake.percentage / 100) * stake.buyIn;
  const myReturn = stake.settled && stake.cashed
    ? (stake.percentage / 100) * (stake.theirCashout ?? 0)
    : 0;
  const profit = myReturn - invested;
  const isPositive = profit >= 0;
  const profitColor = isPositive ? colors.accent : colors.loss;

  const tournamentLabel = tournament?.name ?? null;
  const festivalLabel = festival?.name ?? null;
  const subtitle = [festivalLabel, tournamentLabel].filter(Boolean).join(' · ');

  const statusLabel = !stake.settled ? t('status.pending') : stake.cashed ? t('status.itmCheck') : t('status.eliminated');
  const statusColor = !stake.settled
    ? colors.textTertiary
    : stake.cashed ? colors.accent : colors.textSecondary;

  return (
    <Modal
      visible={stake !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.surface.sheetBg }]}>
        <BlurView intensity={40} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
          <View style={[styles.handle, { backgroundColor: colors.hairline }]} />
          <View style={styles.headerRow}>
            <View style={[styles.typePill, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
              <Users size={11} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.typePillText, { color: colors.textSecondary }]}>{t('types.staking')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Identity */}
          <View style={styles.identity}>
            <Text style={[styles.titleText, { color: colors.textPrimary }]}>{player?.name ?? '—'}</Text>
            {subtitle ? <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
            <View style={styles.metaRow}>
              <Clock size={12} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDateRange(stake.date.slice(0, 10))}</Text>
            </View>
          </View>

          {/* Profit hero */}
          {stake.settled ? (
            <View style={[styles.profitCard, { borderColor: `${profitColor}28` }]}>
              <View style={[styles.profitGlow, { backgroundColor: `${profitColor}0D` }]} />
              <Text style={[styles.profitLabel, { color: colors.textTertiary }]}>{t('stakeDetail.myResult')}</Text>
              <Text style={[styles.profitValue, { color: profitColor }]}>
                {signedAmount(profit)}
              </Text>
              {myReturn > 0 && (
                <Text style={[styles.profitSub, { color: colors.textTertiary }]}>{t('detail.recovered', { amount: formatAmount(myReturn) })}</Text>
              )}
            </View>
          ) : (
            <View style={[styles.profitCard, { borderColor: colors.hairline }]}>
              <View style={[styles.profitGlow, { backgroundColor: colors.neutralTileBg }]} />
              <Text style={[styles.profitLabel, { color: colors.textTertiary }]}>{t('stakeDetail.result')}</Text>
              <Text style={[styles.profitValue, { color: colors.textTertiary, fontSize: 36 }]}>
                {t('status.pending')}
              </Text>
              <Text style={[styles.profitSub, { color: colors.textTertiary }]}>{t('stakeDetail.committed', { amount: formatAmount(invested) })}</Text>
            </View>
          )}

          {/* Info grid */}
          <View style={[styles.section, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
            <InfoRow label={t('stakeDetail.player')} value={player?.name ?? '—'} />
            <Divider />
            <InfoRow label={t('detail.buyIn')} value={formatAmount(stake.buyIn)} />
            <Divider />
            <InfoRow label={t('stakeDetail.percentage')} value={t('percent', { value: stake.percentage })} />
            <Divider />
            <InfoRow label={t('stakeDetail.stakeCommitted')} value={formatAmount(invested)} />
            {stake.settled && (
              <>
                <Divider />
                <InfoRow
                  label={t('stakeDetail.status')}
                  value={statusLabel}
                  valueColor={statusColor}
                />
                {stake.cashed && stake.theirCashout != null && (
                  <>
                    <Divider />
                    <InfoRow label={t('stakeDetail.theirCashout')} value={formatAmount(stake.theirCashout)} />
                    <Divider />
                    <InfoRow label={t('stakeDetail.myReturn')} value={formatAmount(myReturn)} />
                    <Divider />
                    <InfoRow
                      label={t('stakeDetail.roi')}
                      value={invested > 0 ? t('percent', { value: ((profit / invested) * 100).toFixed(1) }) : '—'}
                      valueColor={isPositive ? colors.accent : colors.loss}
                    />
                  </>
                )}
              </>
            )}
          </View>

          {stake.notes ? (
            <View style={[styles.notesCard, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
              <Text style={[styles.notesLabel, { color: colors.textTertiary }]}>{t('detail.notes')}</Text>
              <Text style={[styles.notesText, { color: colors.textSecondary }]}>{stake.notes}</Text>
            </View>
          ) : null}

          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  label: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
  },
  value: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  identity: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleText: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  metaText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  profitCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  profitGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  profitLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  profitValue: {
    fontSize: 48,
    fontFamily: fontFamily.extrabold,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  profitSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  section: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  notesCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.base,
    gap: spacing.sm,
  },
  notesLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  notesText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
});
