import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Users, History } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { SectionLabel } from '../ui/SectionLabel';
import { BlindStructureTable } from '../tournaments/BlindStructureTable';
import { fontFamily, fontSize, spacing, radius, shadow } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Tournament, Festival, TournamentSession } from '../../types';

interface Props {
  tournament: Tournament | null;
  festival?: Festival;
  sessions: TournamentSession[];
  onClose: () => void;
  onAddSession: () => void;
}

interface DisplayData {
  tournament: Tournament;
  festival?: Festival;
  sessions: TournamentSession[];
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
  const { colors } = useTheme();
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: spacing.sm }} />;
}

export function TournamentDetailModal({ tournament, festival, sessions, onClose, onAddSession }: Props) {
  const { colors } = useTheme();
  const [cache, setCache] = useState<DisplayData | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- retain last content while the sheet animates closed
    if (tournament) setCache({ tournament, festival, sessions });
  }, [tournament, festival, sessions]);

  const display = tournament ? { tournament, festival, sessions } : cache;
  if (!display) return null;

  const { tournament: t, festival: f, sessions: s } = display;

  const bestCash = s
    .filter((session) => session.cashed && session.position != null)
    .reduce<TournamentSession | null>((best, session) => {
      if (!best) return session;
      return (session.position ?? Infinity) < (best.position ?? Infinity) ? session : best;
    }, null);

  return (
    <BottomSheet
      visible={tournament !== null}
      onClose={onClose}
      footer={
        <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.accent }]} onPress={onAddSession} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Ajouter une session</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.identity}>
        <Text style={[styles.titleText, { color: colors.textPrimary }]}>{t.name}</Text>
        {f && (
          <View style={styles.metaRow}>
            <MapPin size={12} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {f.name}{f.location ? ` · ${f.location}` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Buy-in hero */}
      <View style={[styles.heroCard, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.accentTint }]}>
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Buy-in</Text>
        <AnimatedNumber
          value={t.buyIn}
          suffix=" €"
          decimals={0}
          style={[styles.heroValue, { color: colors.accent }]}
        />
        {t.totalPlayers ? (
          <View style={styles.playersRow}>
            <Users size={12} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.playersText, { color: colors.textTertiary }]}>
              {t.totalPlayers.toLocaleString('fr-FR')} joueurs
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info grid */}
      <View style={[styles.section, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
        <InfoRow label="Buy-in" value={formatCurrency(t.buyIn)} />
        {t.totalPlayers ? (
          <>
            <Divider />
            <InfoRow label="Champ" value={`${t.totalPlayers.toLocaleString('fr-FR')} joueurs`} />
          </>
        ) : null}
        {f ? (
          <>
            <Divider />
            <InfoRow label="Festival" value={f.name} />
            {f.location ? (
              <>
                <Divider />
                <InfoRow label="Lieu" value={f.location} />
              </>
            ) : null}
          </>
        ) : null}
      </View>

      {/* Blind structure (main event tournaments only) */}
      {t.blindStructure ? (
        <View style={[styles.section, styles.blindSection, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
          <SectionLabel style={styles.blindLabel}>Structure de blindes</SectionLabel>
          <BlindStructureTable structure={t.blindStructure} />
        </View>
      ) : null}

      {/* History section */}
      {s.length > 0 && (
        <View style={[styles.section, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
          <View style={styles.sectionHeader}>
            <History size={13} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Historique</Text>
            <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
              {s.length} participation{s.length > 1 ? 's' : ''}
            </Text>
          </View>
          {s.map((session, idx) => {
            const profit = session.cashOut - (session.reEntries + 1) * session.buyIn;
            const isPositive = profit >= 0;
            return (
              <View key={session.id}>
                {idx > 0 && <Divider />}
                <View style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Text style={[styles.historyDate, { color: colors.textPrimary }]}>{formatDate(session.date)}</Text>
                    <Text style={[styles.historyMeta, { color: colors.textTertiary }]}>
                      {session.cashed
                        ? `ITM${session.position ? ` · ${session.position}e` : ''}`
                        : 'Éliminé'}
                      {session.reEntries > 0 ? ` · ${session.reEntries} re-entry` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.historyProfit, { color: isPositive ? colors.accent : colors.loss }]}>
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
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                  Meilleur résultat : {bestCash.position}e place
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      <View style={{ height: 8 }} />
    </BottomSheet>
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
  identity: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  titleText: {
    fontSize: fontSize.displaySheet,
    fontFamily: fontFamily.display,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  heroLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: fontSize['4xl'],
    fontFamily: fontFamily.extrabold,
    letterSpacing: -1,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  playersText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  section: {
    borderWidth: 1,
    borderRadius: radius.md,
    ...shadow.field,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  blindSection: {
    paddingVertical: spacing.base,
  },
  blindLabel: {
    marginBottom: spacing.md,
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
    flex: 1,
  },
  sectionCount: {
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
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  historyMeta: {
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
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  ctaButton: {
    paddingVertical: spacing.base,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.2,
  },
});
