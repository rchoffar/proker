import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Trophy, MapPin, Users, History } from 'lucide-react-native';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import type { Tournament, Festival, TournamentSession } from '../../types';

interface Props {
  tournament: Tournament | null;
  festival?: Festival;
  sessions: TournamentSession[];
  onClose: () => void;
  onAddSession: () => void;
}

function formatCurrency(val: number, showSign = false): string {
  const abs = Math.abs(val);
  const formatted = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (!showSign) return `${formatted} €`;
  return `${val >= 0 ? '+' : '−'}${formatted} €`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: spacing.sm }} />;
}

export function TournamentDetailModal({ tournament, festival, sessions, onClose, onAddSession }: Props) {
  if (!tournament) return null;

  const bestCash = sessions
    .filter((s) => s.cashed && s.position != null)
    .reduce<TournamentSession | null>((best, s) => {
      if (!best) return s;
      return (s.position ?? Infinity) < (best.position ?? Infinity) ? s : best;
    }, null);

  return (
    <Modal
      visible
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
              <Trophy size={11} color="#FFD700" strokeWidth={2} />
              <Text style={styles.typePillText}>Tournoi</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity */}
          <View style={styles.identity}>
            <Text style={styles.titleText}>{tournament.name}</Text>
            {festival && (
              <View style={styles.metaRow}>
                <MapPin size={12} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={styles.metaText}>
                  {festival.name}{festival.location ? ` · ${festival.location}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Buy-in hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroLabel}>Buy-in</Text>
            <AnimatedNumber
              value={tournament.buyIn}
              suffix=" €"
              decimals={0}
              style={styles.heroValue}
            />
            {tournament.totalPlayers ? (
              <View style={styles.playersRow}>
                <Users size={12} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={styles.playersText}>
                  {tournament.totalPlayers.toLocaleString('fr-FR')} joueurs
                </Text>
              </View>
            ) : null}
          </View>

          {/* Info grid */}
          <View style={styles.section}>
            <InfoRow label="Buy-in" value={formatCurrency(tournament.buyIn)} />
            {tournament.totalPlayers ? (
              <>
                <Divider />
                <InfoRow label="Champ" value={`${tournament.totalPlayers.toLocaleString('fr-FR')} joueurs`} />
              </>
            ) : null}
            {festival ? (
              <>
                <Divider />
                <InfoRow label="Festival" value={festival.name} />
                {festival.location ? (
                  <>
                    <Divider />
                    <InfoRow label="Lieu" value={festival.location} />
                  </>
                ) : null}
              </>
            ) : null}
          </View>

          {/* History section */}
          {sessions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <History size={13} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={styles.sectionTitle}>Historique</Text>
                <Text style={styles.sectionCount}>
                  {sessions.length} participation{sessions.length > 1 ? 's' : ''}
                </Text>
              </View>
              {sessions.map((s, idx) => {
                const profit = s.cashOut - (s.reEntries + 1) * s.buyIn;
                const isPositive = profit >= 0;
                return (
                  <View key={s.id}>
                    {idx > 0 && <Divider />}
                    <View style={styles.historyRow}>
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyDate}>{formatDate(s.date)}</Text>
                        <Text style={styles.historyMeta}>
                          {s.cashed
                            ? `Cashé${s.position ? ` · ${s.position}e` : ''}`
                            : 'Éliminé'}
                          {s.reEntries > 0 ? ` · ${s.reEntries} re-entry` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.historyProfit, { color: isPositive ? colors.profit : colors.loss }]}>
                        {formatCurrency(profit, true)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {bestCash?.position != null && (
                <>
                  <Divider />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryText}>
                      Meilleur résultat : {bestCash.position}e place
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* CTA footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.ctaButton} onPress={onAddSession} activeOpacity={0.8}>
            <Text style={styles.ctaText}>Ajouter une session</Text>
          </TouchableOpacity>
        </View>
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
    borderColor: 'rgba(255,215,0,0.25)',
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  typePillText: {
    color: colors.textSecondary,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  heroLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroValue: {
    color: '#FFD700',
    fontSize: fontSize['4xl'],
    fontFamily: fontFamily.extrabold,
    letterSpacing: -1.5,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  playersText: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  section: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionCount: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  historyLeft: {
    flex: 1,
    gap: 3,
  },
  historyDate: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  historyMeta: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  historyProfit: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  summaryRow: {
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['2xl'],
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  ctaButton: {
    backgroundColor: '#FFD700',
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  ctaText: {
    color: '#0A0A0F',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.2,
  },
});
