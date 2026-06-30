import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Users, Clock } from 'lucide-react-native';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
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
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: spacing.sm }} />;
}

export function StakeDetailModal({ stake, player, festival, tournament, onClose }: Props) {
  if (!stake) return null;

  const invested = (stake.percentage / 100) * stake.buyIn;
  const myReturn = stake.settled && stake.cashed
    ? (stake.percentage / 100) * (stake.theirCashout ?? 0)
    : 0;
  const profit = myReturn - invested;
  const isPositive = profit >= 0;
  const profitColor = isPositive ? colors.profit : colors.loss;

  const tournamentLabel = tournament?.name ?? null;
  const festivalLabel = festival?.name ?? null;
  const subtitle = [festivalLabel, tournamentLabel].filter(Boolean).join(' · ');

  const statusLabel = !stake.settled ? 'En attente' : stake.cashed ? 'Cashé ✓' : 'Éliminé';
  const statusColor = !stake.settled
    ? colors.textTertiary
    : stake.cashed ? colors.profit : colors.textSecondary;

  return (
    <Modal
      visible={stake !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.typePill}>
              <Users size={11} color="#A5B4FC" strokeWidth={2} />
              <Text style={styles.typePillText}>Staking</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Identity */}
          <View style={styles.identity}>
            <Text style={styles.titleText}>{player?.name ?? '—'}</Text>
            {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
            <View style={styles.metaRow}>
              <Clock size={12} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.metaText}>{formatDate(stake.date)}</Text>
            </View>
          </View>

          {/* Profit hero */}
          {stake.settled ? (
            <View style={[styles.profitCard, { borderColor: `${profitColor}28` }]}>
              <View style={[styles.profitGlow, { backgroundColor: `${profitColor}0D` }]} />
              <Text style={styles.profitLabel}>Mon résultat</Text>
              <Text style={[styles.profitValue, { color: profitColor }]}>
                {formatCurrency(profit, true)}
              </Text>
              {myReturn > 0 && (
                <Text style={styles.profitSub}>{formatCurrency(myReturn)} récupérés</Text>
              )}
            </View>
          ) : (
            <View style={[styles.profitCard, { borderColor: 'rgba(99,102,241,0.20)' }]}>
              <View style={[styles.profitGlow, { backgroundColor: 'rgba(99,102,241,0.06)' }]} />
              <Text style={styles.profitLabel}>Résultat</Text>
              <Text style={[styles.profitValue, { color: colors.textTertiary, fontSize: 36 }]}>
                En attente
              </Text>
              <Text style={styles.profitSub}>{formatCurrency(-invested)} engagés</Text>
            </View>
          )}

          {/* Info grid */}
          <View style={styles.section}>
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
                      valueColor={isPositive ? colors.profit : colors.loss}
                    />
                  </>
                )}
              </>
            )}
          </View>

          {stake.notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{stake.notes}</Text>
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
    color: colors.textSecondary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
  },
  value: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(8,8,14,0.97)',
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
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
    borderColor: 'rgba(99,102,241,0.30)',
    backgroundColor: 'rgba(99,102,241,0.10)',
  },
  typePillText: {
    color: '#A5B4FC',
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
    color: colors.textPrimary,
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.5,
  },
  subtitleText: {
    color: colors.textSecondary,
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
    color: colors.textTertiary,
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
    color: colors.textTertiary,
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
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  section: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  notesCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.base,
    gap: spacing.sm,
  },
  notesLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  notesText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
});
