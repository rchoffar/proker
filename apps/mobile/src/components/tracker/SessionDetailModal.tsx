import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, MapPin, Clock, Trophy, Banknote, FileText, Users, Pencil } from 'lucide-react-native';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Session, Festival, Tournament, Player } from '../../types';

interface Props {
  session: Session | null;
  festival?: Festival;
  tournament?: Tournament;
  players?: Player[];
  onClose: () => void;
  onEdit?: () => void;
}

function getNetValues(session: Session): { netProfit: number; yourCashout: number; yourInvested: number } {
  const bs = session.backings ?? [];
  const totalBuyIn = session.type === 'tournament'
    ? (session.reEntries + 1) * session.buyIn
    : session.buyIn;
  const yourInvested = totalBuyIn - bs.reduce((sum, b) => sum + (b.buyInShare / 100) * totalBuyIn, 0);
  const yourCashout = session.cashOut - bs.reduce((sum, b) => sum + (b.profitShare / 100) * session.cashOut, 0);
  return { netProfit: yourCashout - yourInvested, yourCashout, yourInvested };
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

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
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

export function SessionDetailModal({ session, festival, tournament, players = [], onClose, onEdit }: Props) {
  const { colors, scheme } = useTheme();
  if (!session) return null;

  const { netProfit, yourCashout, yourInvested } = getNetValues(session);
  const isPositive = netProfit >= 0;
  const profitColor = isPositive ? colors.accent : colors.loss;
  const isTournament = session.type === 'tournament';
  const hasBackings = (session.backings ?? []).length > 0;

  const title = isTournament ? (festival?.name ?? session.venue) : session.venue;
  const subtitle = isTournament
    ? (tournament?.name ?? null)
    : `${session.stakes} ${session.gameType}`;

  const totalInvested = isTournament
    ? (session.reEntries + 1) * session.buyIn
    : session.buyIn;

  return (
    <Modal
      visible={session !== null}
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
            <View style={[
              styles.typePill,
              isTournament
                ? { borderColor: colors.accent, backgroundColor: colors.accentTint }
                : { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg },
            ]}>
              {isTournament
                ? <Trophy size={11} color={colors.accent} strokeWidth={2} />
                : <Banknote size={11} color={colors.accent} strokeWidth={2} />}
              <Text style={[styles.typePillText, { color: colors.textSecondary }]}>{isTournament ? 'Tournoi' : 'Cash Game'}</Text>
            </View>
            <View style={styles.headerActions}>
              {onEdit && (
                <TouchableOpacity style={styles.closeBtn} onPress={onEdit} activeOpacity={0.7}>
                  <Pencil size={17} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <X size={20} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity */}
          <View style={styles.identity}>
            <Text style={[styles.titleText, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
            <View style={styles.metaRow}>
              <MapPin size={12} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDate(session.date)}</Text>
              <Text style={[styles.dot, { color: colors.textTertiary }]}>·</Text>
              <Clock size={12} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDuration(session.durationHours)}</Text>
            </View>
          </View>

          {/* Profit hero */}
          <View style={[styles.profitCard, { borderColor: `${profitColor}28` }]}>
            <View style={[styles.profitGlow, { backgroundColor: `${profitColor}0D` }]} />
            <Text style={[styles.profitLabel, { color: colors.textTertiary }]}>Résultat net</Text>
            <Text style={[styles.profitValue, { color: profitColor }]}>
              {formatCurrency(netProfit, true)}
            </Text>
            {yourCashout > 0 && (
              <Text style={[styles.profitSub, { color: colors.textTertiary }]}>
                {formatCurrency(yourCashout)} récupérés
              </Text>
            )}
          </View>

          {/* Info sections */}
          <View style={[styles.section, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
            <InfoRow label="Buy-in" value={formatCurrency(session.buyIn)} />

            {isTournament && (
              <>
                <Divider />
                <InfoRow label="Re-entries" value={`${session.reEntries}`} />
                <Divider />
                <InfoRow
                  label={hasBackings ? 'Mise brute' : 'Total investi'}
                  value={formatCurrency(totalInvested)}
                />
                {hasBackings && (
                  <>
                    <Divider />
                    <InfoRow label="Votre mise nette" value={formatCurrency(yourInvested)} />
                  </>
                )}
                <Divider />
                <InfoRow
                  label="Sortie"
                  value={session.cashed ? 'ITM ✓' : 'Éliminé'}
                  valueColor={session.cashed ? colors.accent : colors.textSecondary}
                />
                {session.cashed && session.position && (
                  <>
                    <Divider />
                    <InfoRow
                      label="Position"
                      value={`${session.position}${tournament?.totalPlayers ? ` / ${tournament.totalPlayers}` : ''}`}
                    />
                  </>
                )}
              </>
            )}

            {!isTournament && (
              <>
                <Divider />
                <InfoRow label="Variante" value={session.gameType} />
                <Divider />
                <InfoRow label="Mises" value={session.stakes} />
                {hasBackings && (
                  <>
                    <Divider />
                    <InfoRow label="Votre mise nette" value={formatCurrency(yourInvested)} />
                  </>
                )}
              </>
            )}

            <Divider />
            <InfoRow
              label="ROI session"
              value={yourInvested > 0 ? `${((netProfit / yourInvested) * 100).toFixed(1)} %` : '—'}
              valueColor={isPositive ? colors.accent : colors.loss}
            />
          </View>

          {/* Backing section */}
          {hasBackings && (
            <View style={[styles.section, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
              <View style={styles.sectionHeader}>
                <Users size={13} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Backers</Text>
              </View>
              {(session.backings ?? []).map((b, idx) => {
                const player = players.find((p) => p.id === b.playerId);
                const name = player?.name ?? `Backer ${idx + 1}`;
                const detail = b.buyInShare > 0
                  ? `${b.profitShare} % gains · ${b.buyInShare} % buy-in`
                  : `${b.profitShare} % gains (action)`;
                return (
                  <View key={idx}>
                    {idx > 0 && <Divider />}
                    <InfoRow label={name} value={detail} />
                  </View>
                );
              })}
            </View>
          )}

          {/* Notes */}
          {session.notes ? (
            <View style={[styles.notesCard, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
              <View style={styles.notesHeader}>
                <FileText size={13} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={[styles.notesLabel, { color: colors.textTertiary }]}>Notes</Text>
              </View>
              <Text style={[styles.notesText, { color: colors.textSecondary }]}>{session.notes}</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  dot: {
    fontSize: fontSize.sm,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  notesCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.base,
    gap: spacing.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
