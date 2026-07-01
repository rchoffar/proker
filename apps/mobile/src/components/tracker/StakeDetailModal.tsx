import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Users, Clock } from 'lucide-react-native';
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

function formatCurrency(val: number, showSign = false): string {
  const abs = Math.abs(val);
  const formatted = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (!showSign) return `${formatted} €`;
  return `${val >= 0 ? '+' : '−'}${formatted} €`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

  const statusLabel = !stake.settled ? 'En attente' : stake.cashed ? 'ITM ✓' : 'Éliminé';
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
              <Text style={[styles.typePillText, { color: colors.textSecondary }]}>Staking</Text>
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
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDate(stake.date)}</Text>
            </View>
          </View>

          {/* Profit hero */}
          {stake.settled ? (
            <View style={[styles.profitCard, { borderColor: `${profitColor}28` }]}>
              <View style={[styles.profitGlow, { backgroundColor: `${profitColor}0D` }]} />
              <Text style={[styles.profitLabel, { color: colors.textTertiary }]}>Mon résultat</Text>
              <Text style={[styles.profitValue, { color: profitColor }]}>
                {formatCurrency(profit, true)}
              </Text>
              {myReturn > 0 && (
                <Text style={[styles.profitSub, { color: colors.textTertiary }]}>{formatCurrency(myReturn)} récupérés</Text>
              )}
            </View>
          ) : (
            <View style={[styles.profitCard, { borderColor: colors.hairline }]}>
              <View style={[styles.profitGlow, { backgroundColor: colors.neutralTileBg }]} />
              <Text style={[styles.profitLabel, { color: colors.textTertiary }]}>Résultat</Text>
              <Text style={[styles.profitValue, { color: colors.textTertiary, fontSize: 36 }]}>
                En attente
              </Text>
              <Text style={[styles.profitSub, { color: colors.textTertiary }]}>{formatCurrency(-invested)} engagés</Text>
            </View>
          )}

          {/* Info grid */}
          <View style={[styles.section, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
            <InfoRow label="Joueur" value={player?.name ?? '—'} />
            <Divider />
            <InfoRow label="Buy-in" value={formatCurrency(stake.buyIn)} />
            <Divider />
            <InfoRow label="Pourcentage" value={`${stake.percentage} %`} />
            <Divider />
            <InfoRow label="Mise engagée" value={formatCurrency(invested)} />
            {stake.settled && (
              <>
                <Divider />
                <InfoRow
                  label="Statut"
                  value={statusLabel}
                  valueColor={statusColor}
                />
                {stake.cashed && stake.theirCashout != null && (
                  <>
                    <Divider />
                    <InfoRow label="Leur cashout" value={formatCurrency(stake.theirCashout)} />
                    <Divider />
                    <InfoRow label="Mon retour" value={formatCurrency(myReturn)} />
                    <Divider />
                    <InfoRow
                      label="ROI"
                      value={invested > 0 ? `${((profit / invested) * 100).toFixed(1)} %` : '—'}
                      valueColor={isPositive ? colors.accent : colors.loss}
                    />
                  </>
                )}
              </>
            )}
          </View>

          {stake.notes ? (
            <View style={[styles.notesCard, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
              <Text style={[styles.notesLabel, { color: colors.textTertiary }]}>Notes</Text>
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
