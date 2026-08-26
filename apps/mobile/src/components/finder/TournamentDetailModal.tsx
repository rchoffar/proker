import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin, Users } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { formatAmount } from '../../lib/format';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { SectionLabel } from '../ui/SectionLabel';
import { BlindStructureTable } from '../tournaments/BlindStructureTable';
import { fontFamily, fontSize, spacing, radius, shadow } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Tournament, Festival } from '../../types';

interface Props {
  tournament: Tournament | null;
  festival?: Festival;
  onClose: () => void;
}

interface DisplayData {
  tournament: Tournament;
  festival?: Festival;
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

export function TournamentDetailModal({ tournament, festival, onClose }: Props) {
  const { colors } = useTheme();
  const { t: tr } = useTranslation('finder');
  const [cache, setCache] = useState<DisplayData | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- retain last content while the sheet animates closed
    if (tournament) setCache({ tournament, festival });
  }, [tournament, festival]);

  const display = tournament ? { tournament, festival } : cache;
  if (!display) return null;

  const { tournament: t, festival: f } = display;

  return (
    <BottomSheet visible={tournament !== null} onClose={onClose}>
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
        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>{tr('detail.buyIn')}</Text>
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
              {tr('detail.players', { count: t.totalPlayers })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info grid */}
      <View style={[styles.section, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
        <InfoRow label={tr('detail.buyIn')} value={formatAmount(t.buyIn)} />
        {t.totalPlayers ? (
          <>
            <Divider />
            <InfoRow label={tr('detail.field')} value={tr('detail.players', { count: t.totalPlayers })} />
          </>
        ) : null}
        {f ? (
          <>
            <Divider />
            <InfoRow label={tr('detail.festival')} value={f.name} />
            {f.location ? (
              <>
                <Divider />
                <InfoRow label={tr('detail.venue')} value={f.location} />
              </>
            ) : null}
          </>
        ) : null}
      </View>

      {/* Blind structure (main event tournaments only) */}
      {t.blindStructure ? (
        <View style={[styles.section, styles.blindSection, { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}>
          <SectionLabel style={styles.blindLabel}>{tr('detail.blindStructure')}</SectionLabel>
          <BlindStructureTable structure={t.blindStructure} />
        </View>
      ) : null}

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
});
