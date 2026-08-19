import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { SegmentedControl } from '../ui/SegmentedControl';
import { PickerField, SearchCreateList } from '../ui/PickerField';
import { BuyInField } from '../ui/BuyInField';
import { AmountInput } from '../ui/AmountInput';
import { Stepper } from '../ui/Stepper';
import { sessionNetValues } from '../../store/useAppStore';
import { formatAmount } from '../../lib/format';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Festival, Tournament, Session, TournamentSession, CashSession, GameType, Stake, Player, Stacking } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionKind = 'tournament' | 'cash' | 'stake';

interface StackingDraft {
  player: Player | null;
  kind: 'swap' | 'stack';
  profitShare: number;
  buyInAmount: string; // free-text € amount, seeded with the proportional default and freely editable (including to blank/0)
  buyInAmountTouched: boolean; // once true, buyInAmount stops following profitShare changes
}

interface Draft {
  sessionType: SessionKind;
  festival: Festival | null;
  tournament: Tournament | null;
  buyIn: string;
  reEntries: number;
  cashed: boolean;
  cashOut: string;
  position: string;
  venue: string;
  gameType: GameType;
  stakes: string;
  durationHours: number;
  stackings: StackingDraft[];
  stakingPlayer: Player | null;
  stakingPercentage: number;
  stakingSettled: boolean;
  stakingCashed: boolean;
  stakingTheirCashout: string;
}

const INITIAL_DRAFT: Draft = {
  sessionType: 'tournament',
  festival: null,
  tournament: null,
  buyIn: '',
  reEntries: 0,
  cashed: false,
  cashOut: '',
  position: '',
  venue: '',
  gameType: 'NLH',
  stakes: '2/5',
  durationHours: 4,
  stackings: [],
  stakingPlayer: null,
  stakingPercentage: 10,
  stakingSettled: false,
  stakingCashed: false,
  stakingTheirCashout: '',
};

const STAKES_OPTIONS = ['1/2', '2/5', '5/10', '10/20'];

// ─── Props ───────────────────────────────────────────────────────────────────

export interface SaveRecord {
  session?: Session;
  stake?: Stake;
  newFestival?: Festival;
  newTournament?: Tournament;
  newPlayers?: Player[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (record: SaveRecord) => void;
  festivals: Festival[];
  tournaments: Tournament[];
  players: Player[];
  initialSession?: Session | null;
  initialTournament?: Tournament | null;
  initialFestival?: Festival | null;
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[sharedStyles.fieldLabel, { color: colors.textSecondary }]}>{children}</Text>;
}

function SummaryLine({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[sharedStyles.summary, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
      <Text style={[sharedStyles.summaryLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[sharedStyles.summaryValue, { color: color ?? colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function ResultToggle({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; activeColor?: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[sharedStyles.toggle, options.length > 2 && sharedStyles.toggleWrap]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              sharedStyles.toggleBtn,
              { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg },
              active && { backgroundColor: colors.neutralTileBg },
              active && opt.activeColor ? { borderColor: opt.activeColor } : null,
            ]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[sharedStyles.toggleText, { color: colors.textSecondary }, active && { color: opt.activeColor ?? colors.textPrimary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Stacking sub-section (shared by Tournoi & Cash) ─────────────────────────

/** The proportional € amount for a given profit share — used only to seed the field's initial value. */
function defaultStackAmount(profitShare: number, totalBuyIn: number): number {
  return Math.round((profitShare / 100) * totalBuyIn);
}

/** Resolves the effective € amount a stack entry contributes toward the buy-in — swap entries always contribute 0. */
function resolveStackAmount(entry: StackingDraft): number {
  if (entry.kind !== 'stack') return 0;
  return parseFloat(entry.buyInAmount) || 0;
}

function StackingSection({
  draft,
  update,
  players,
  activePicker,
  setActivePicker,
}: {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  players: Player[];
  activePicker: string | null;
  setActivePicker: (v: string | null) => void;
}) {
  const { t } = useTranslation('tracker');
  const { colors } = useTheme();
  const [queries, setQueries] = useState<Record<number, string>>({});
  const buyIn = parseFloat(draft.buyIn) || 0;
  const totalBuyIn = draft.sessionType === 'tournament' ? (draft.reEntries + 1) * buyIn : buyIn;
  const totalProfitPct = draft.stackings.reduce((sum, s) => sum + s.profitShare, 0);
  const yourSharePct = 100 - totalProfitPct;
  const totalBuyInCovered = draft.stackings.reduce((sum, s) => sum + resolveStackAmount(s), 0);
  const yourActualCost = totalBuyIn > 0 ? totalBuyIn - totalBuyInCovered : 0;

  const addStacking = useCallback(() => {
    update({
      stackings: [
        ...draft.stackings,
        { player: null, profitShare: 10, kind: 'stack', buyInAmount: String(defaultStackAmount(10, totalBuyIn)), buyInAmountTouched: false },
      ],
    });
  }, [draft.stackings, totalBuyIn, update]);

  const removeStacking = useCallback((idx: number) => {
    update({ stackings: draft.stackings.filter((_, i) => i !== idx) });
  }, [draft.stackings, update]);

  const updateStacking = useCallback(
    (idx: number, patch: Partial<StackingDraft>) => {
      update({ stackings: draft.stackings.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
    },
    [draft.stackings, update]
  );

  /** Updates profitShare, and — unless the user has manually overridden the amount — keeps buyInAmount following it. */
  const updateProfitShare = useCallback(
    (idx: number, profitShare: number) => {
      const stacking = draft.stackings[idx];
      const followsDefault = stacking.kind === 'stack' && !stacking.buyInAmountTouched;
      updateStacking(idx, {
        profitShare,
        ...(followsDefault ? { buyInAmount: String(defaultStackAmount(profitShare, totalBuyIn)) } : {}),
      });
    },
    [draft.stackings, totalBuyIn, updateStacking]
  );

  return (
    <View style={{ gap: spacing.md }}>
      <FieldLabel>{t('stacking.sectionOptional')}</FieldLabel>

      {draft.stackings.map((stacking, idx) => {
        const pickerKey = `stacking-${idx}`;
        return (
          <View key={idx} style={[stackingStyles.entry, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
            <View style={stackingStyles.entryHeader}>
              <Text style={[sharedStyles.fieldLabelInline, { color: colors.textSecondary }]}>
                {stacking.kind === 'stack' ? t('stacking.stackerN', { n: idx + 1 }) : t('stacking.swapN', { n: idx + 1 })}
              </Text>
              <TouchableOpacity onPress={() => removeStacking(idx)} activeOpacity={0.7}>
                <Text style={[stackingStyles.removeText, { color: colors.loss }]}>{t('stacking.remove')}</Text>
              </TouchableOpacity>
            </View>
            <PickerField
              label={t('stakeDetail.player')}
              value={stacking.player?.name ?? ''}
              placeholder={t('addSession.searchAddPlayer')}
              expanded={activePicker === pickerKey}
              onToggleExpand={() => setActivePicker(activePicker === pickerKey ? null : pickerKey)}
            >
              <SearchCreateList
                items={players.map((p) => p.name)}
                selected={stacking.player?.name ?? ''}
                query={queries[idx] ?? ''}
                onQueryChange={(v) => setQueries((q) => ({ ...q, [idx]: v }))}
                onSelect={(name) => {
                  const existing = players.find((p) => p.name === name);
                  updateStacking(idx, { player: existing ?? { id: `p-${Date.now()}`, name } });
                  setActivePicker(null);
                }}
                onCreate={(name) => {
                  updateStacking(idx, { player: { id: `p-${Date.now()}`, name } });
                  setActivePicker(null);
                }}
                placeholder={t('addSession.searchAddPlayer')}
              />
            </PickerField>
            <Stepper
              label={t('stacking.profitShare')}
              value={stacking.profitShare}
              onDecrement={() => updateProfitShare(idx, Math.max(1, stacking.profitShare - 1))}
              onIncrement={() => updateProfitShare(idx, Math.min(100 - totalProfitPct + stacking.profitShare, stacking.profitShare + 1))}
              min={1}
              max={100 - totalProfitPct + stacking.profitShare}
              format={(v) => t('percent', { value: v })}
            />
            <View style={{ gap: spacing.sm }}>
              <FieldLabel>{t('stacking.type')}</FieldLabel>
              <ResultToggle
                options={[{ key: 'swap', label: t('stacking.swap') }, { key: 'stack', label: t('stacking.stack') }]}
                value={stacking.kind}
                onChange={(k) => {
                  const kind = k as 'swap' | 'stack';
                  if (kind === 'stack' && stacking.kind !== 'stack') {
                    updateStacking(idx, {
                      kind,
                      buyInAmount: String(defaultStackAmount(stacking.profitShare, totalBuyIn)),
                      buyInAmountTouched: false,
                    });
                  } else {
                    updateStacking(idx, { kind });
                  }
                }}
              />
            </View>
            {stacking.kind === 'stack' && (
              <AmountInput
                label={t('stacking.amountInvested')}
                value={stacking.buyInAmount}
                onChange={(v) => updateStacking(idx, { buyInAmount: v, buyInAmountTouched: true })}
              />
            )}
          </View>
        );
      })}

      {totalProfitPct < 100 && (
        <TouchableOpacity style={[stackingStyles.addBtn, { borderColor: colors.hairline }]} onPress={addStacking} activeOpacity={0.7}>
          <Plus size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[stackingStyles.addBtnText, { color: colors.textSecondary }]}>{t('stacking.add')}</Text>
        </TouchableOpacity>
      )}

      {draft.stackings.length > 0 && (
        <SummaryLine
          label={t('stacking.yourShare')}
          value={totalBuyIn > 0
            ? t('stacking.shareWithCost', { pct: yourSharePct, amount: formatAmount(yourActualCost) })
            : t('stacking.shareOnly', { pct: yourSharePct })}
        />
      )}
    </View>
  );
}

// ─── Tournament fields ────────────────────────────────────────────────────────

function TournamentFields({
  draft,
  update,
  festivals,
  tournaments,
  players,
  activePicker,
  setActivePicker,
}: {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  festivals: Festival[];
  tournaments: Tournament[];
  players: Player[];
  activePicker: string | null;
  setActivePicker: (v: string | null) => void;
}) {
  const { t } = useTranslation('tracker');
  const { colors } = useTheme();
  const [festivalQuery, setFestivalQuery] = useState('');
  const [tournamentQuery, setTournamentQuery] = useState('');

  const festivalTournaments = useMemo(
    () => tournaments.filter((tour) => tour.festivalId === draft.festival?.id),
    [tournaments, draft.festival]
  );
  const inferred = draft.tournament != null && tournaments.some((t) => t.id === draft.tournament!.id);

  return (
    <View style={{ gap: spacing.lg }}>
      <PickerField
        label={t('addSession.festivalVenue')}
        value={draft.festival?.name ?? ''}
        placeholder={t('addSession.chooseFestival')}
        expanded={activePicker === 'festival'}
        onToggleExpand={() => setActivePicker(activePicker === 'festival' ? null : 'festival')}
      >
        <SearchCreateList
          items={festivals.map((f) => f.name)}
          selected={draft.festival?.name ?? ''}
          query={festivalQuery}
          onQueryChange={setFestivalQuery}
          onSelect={(name) => {
            const existing = festivals.find((f) => f.name === name);
            update({ festival: existing ?? { id: `f-${Date.now()}`, name }, tournament: null, buyIn: '' });
            setActivePicker(null);
          }}
          onCreate={(name) => {
            update({ festival: { id: `f-${Date.now()}`, name }, tournament: null, buyIn: '' });
            setActivePicker(null);
          }}
          placeholder={t('addSession.searchCreateFestival')}
        />
      </PickerField>

      <PickerField
        label={t('addSession.tournament')}
        value={draft.tournament?.name ?? ''}
        placeholder={draft.festival ? t('addSession.chooseTournament') : t('addSession.chooseFestivalFirst')}
        disabled={!draft.festival}
        expanded={activePicker === 'tournament'}
        onToggleExpand={() => setActivePicker(activePicker === 'tournament' ? null : 'tournament')}
      >
        <SearchCreateList
          items={festivalTournaments.map((t) => t.name)}
          selected={draft.tournament?.name ?? ''}
          query={tournamentQuery}
          onQueryChange={setTournamentQuery}
          onSelect={(name) => {
            const existing = festivalTournaments.find((t) => t.name === name);
            if (existing) {
              update({ tournament: existing, buyIn: String(existing.buyIn) });
              setActivePicker(null);
            }
          }}
          onCreate={(name) => {
            update({
              tournament: { id: `t-${Date.now()}`, festivalId: draft.festival?.id ?? '', name, buyIn: parseFloat(draft.buyIn) || 0 },
            });
            setActivePicker(null);
          }}
          placeholder={t('addSession.searchCreateTournament')}
        />
      </PickerField>

      <BuyInField value={draft.buyIn} onChange={(v) => update({ buyIn: v })} inferred={inferred} inferredNote={t('addSession.buyInInferredNote')} />

      <Stepper
        label={t('detail.reEntries')}
        value={draft.reEntries}
        onDecrement={() => update({ reEntries: Math.max(0, draft.reEntries - 1) })}
        onIncrement={() => update({ reEntries: Math.min(10, draft.reEntries + 1) })}
        max={10}
      />

      <StackingSection draft={draft} update={update} players={players} activePicker={activePicker} setActivePicker={setActivePicker} />

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>{t('addSession.result')}</FieldLabel>
        <ResultToggle
          options={[
            { key: 'out', label: t('status.eliminated'), activeColor: colors.loss },
            { key: 'itm', label: t('status.itm'), activeColor: colors.accent },
          ]}
          value={draft.cashed ? 'itm' : 'out'}
          onChange={(k) => update({ cashed: k === 'itm' })}
        />
      </View>

      {draft.cashed && (
        <Stepper
          label={t('addSession.winnings')}
          value={parseFloat(draft.cashOut) || 0}
          onDecrement={() => update({ cashOut: String(Math.max(0, (parseFloat(draft.cashOut) || 0) - MONEY_STEP)) })}
          onIncrement={() => update({ cashOut: String((parseFloat(draft.cashOut) || 0) + MONEY_STEP) })}
          max={MONEY_MAX}
          format={formatAmount}
        />
      )}
      {draft.cashed && (
        <AmountInput label={t('addSession.positionOptional')} value={draft.position} onChange={(v) => update({ position: v })} placeholder={t('addSession.positionPlaceholder')} unit="#" />
      )}

      <Stepper
        label={t('addSession.duration')}
        value={draft.durationHours}
        onDecrement={() => update({ durationHours: Math.max(0.5, draft.durationHours - 0.5) })}
        onIncrement={() => update({ durationHours: Math.min(48, draft.durationHours + 0.5) })}
        min={0.5}
        max={48}
        format={(v) => t('hoursShort', { hours: v })}
      />
    </View>
  );
}

// ─── Cash fields ──────────────────────────────────────────────────────────────

function CashFields({
  draft,
  update,
  festivals,
  players,
  activePicker,
  setActivePicker,
}: {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  festivals: Festival[];
  players: Player[];
  activePicker: string | null;
  setActivePicker: (v: string | null) => void;
}) {
  const { t } = useTranslation('tracker');
  const { colors } = useTheme();
  const [venueQuery, setVenueQuery] = useState('');
  const knownVenues = useMemo(() => [...new Set(festivals.map((f) => f.name))], [festivals]);

  return (
    <View style={{ gap: spacing.lg }}>
      <PickerField
        label={t('addSession.festivalVenue')}
        value={draft.venue}
        placeholder={t('addSession.chooseOrEnterVenue')}
        expanded={activePicker === 'venue'}
        onToggleExpand={() => setActivePicker(activePicker === 'venue' ? null : 'venue')}
      >
        <SearchCreateList
          items={knownVenues}
          selected={draft.venue}
          query={venueQuery}
          onQueryChange={(v) => { setVenueQuery(v); update({ venue: v }); }}
          onSelect={(v) => { update({ venue: v }); setActivePicker(null); }}
          placeholder={t('addSession.searchVenue')}
        />
      </PickerField>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>{t('detail.variant')}</FieldLabel>
        <ResultToggle
          options={(['NLH', 'PLO'] as GameType[]).map((g) => ({ key: g, label: g }))}
          value={draft.gameType}
          onChange={(k) => update({ gameType: k as GameType })}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>{t('detail.stakes')}</FieldLabel>
        <View style={sharedStyles.chipRow}>
          {STAKES_OPTIONS.map((s) => {
            const active = draft.stakes === s;
            return (
            <TouchableOpacity
              key={s}
              style={[
                sharedStyles.chip,
                { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg },
                active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
              ]}
              onPress={() => update({ stakes: s })}
              activeOpacity={0.7}
            >
              <Text style={[sharedStyles.chipText, { color: active ? colors.accent : colors.textSecondary }, active && { fontFamily: fontFamily.semibold }]}>{s}</Text>
            </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <BuyInField value={draft.buyIn} onChange={(v) => update({ buyIn: v })} />

      <StackingSection draft={draft} update={update} players={players} activePicker={activePicker} setActivePicker={setActivePicker} />

      <Stepper
        label={t('addSession.winnings')}
        value={parseFloat(draft.cashOut) || 0}
        onDecrement={() => update({ cashOut: String(Math.max(0, (parseFloat(draft.cashOut) || 0) - MONEY_STEP)) })}
        onIncrement={() => update({ cashOut: String((parseFloat(draft.cashOut) || 0) + MONEY_STEP) })}
        max={MONEY_MAX}
        format={formatAmount}
      />

      <Stepper
        label={t('addSession.duration')}
        value={draft.durationHours}
        onDecrement={() => update({ durationHours: Math.max(0.5, draft.durationHours - 0.5) })}
        onIncrement={() => update({ durationHours: Math.min(48, draft.durationHours + 0.5) })}
        min={0.5}
        max={48}
        format={(v) => t('hoursShort', { hours: v })}
      />
    </View>
  );
}

// ─── Staking fields (= backing another player) ───────────────────────────────

function StakingFields({
  draft,
  update,
  festivals,
  tournaments,
  players,
  activePicker,
  setActivePicker,
}: {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  festivals: Festival[];
  tournaments: Tournament[];
  players: Player[];
  activePicker: string | null;
  setActivePicker: (v: string | null) => void;
}) {
  const { t } = useTranslation('tracker');
  const { colors } = useTheme();
  const [playerQuery, setPlayerQuery] = useState('');
  const [festivalQuery, setFestivalQuery] = useState('');
  const [tournamentQuery, setTournamentQuery] = useState('');

  const festivalTournaments = useMemo(
    () => (draft.festival ? tournaments.filter((t) => t.festivalId === draft.festival!.id) : []),
    [tournaments, draft.festival]
  );
  const inferred = draft.tournament != null && tournaments.some((t) => t.id === draft.tournament!.id);
  const buyIn = parseFloat(draft.buyIn) || 0;
  const investedNum = (draft.stakingPercentage / 100) * buyIn;
  const theirCashout = parseFloat(draft.stakingTheirCashout) || 0;
  const myReturn = (draft.stakingPercentage / 100) * theirCashout;
  const profit = myReturn - investedNum;

  return (
    <View style={{ gap: spacing.lg }}>
      <PickerField
        label={t('addSession.backedPlayer')}
        value={draft.stakingPlayer?.name ?? ''}
        placeholder={t('addSession.searchAddPlayer')}
        expanded={activePicker === 'stakingPlayer'}
        onToggleExpand={() => setActivePicker(activePicker === 'stakingPlayer' ? null : 'stakingPlayer')}
      >
        <SearchCreateList
          items={players.map((p) => p.name)}
          selected={draft.stakingPlayer?.name ?? ''}
          query={playerQuery}
          onQueryChange={setPlayerQuery}
          onSelect={(name) => {
            const existing = players.find((p) => p.name === name);
            update({ stakingPlayer: existing ?? { id: `p-${Date.now()}`, name } });
            setActivePicker(null);
          }}
          onCreate={(name) => {
            update({ stakingPlayer: { id: `p-${Date.now()}`, name } });
            setActivePicker(null);
          }}
          placeholder={t('addSession.searchAddPlayer')}
        />
      </PickerField>

      <PickerField
        label={t('addSession.festivalVenueOptional')}
        value={draft.festival?.name ?? ''}
        placeholder={t('addSession.chooseFestival')}
        expanded={activePicker === 'stakeFestival'}
        onToggleExpand={() => setActivePicker(activePicker === 'stakeFestival' ? null : 'stakeFestival')}
      >
        <SearchCreateList
          items={festivals.map((f) => f.name)}
          selected={draft.festival?.name ?? ''}
          query={festivalQuery}
          onQueryChange={setFestivalQuery}
          onSelect={(name) => {
            const existing = festivals.find((f) => f.name === name);
            update({ festival: existing ?? { id: `f-${Date.now()}`, name }, tournament: null });
            setActivePicker(null);
          }}
          onCreate={(name) => {
            update({ festival: { id: `f-${Date.now()}`, name }, tournament: null });
            setActivePicker(null);
          }}
          placeholder={t('addSession.searchFestival')}
        />
      </PickerField>

      {draft.festival && (
        <PickerField
          label={t('addSession.tournamentOptional')}
          value={draft.tournament?.name ?? ''}
          placeholder={t('addSession.chooseTournament')}
          expanded={activePicker === 'stakeTournament'}
          onToggleExpand={() => setActivePicker(activePicker === 'stakeTournament' ? null : 'stakeTournament')}
        >
          <SearchCreateList
            items={festivalTournaments.map((t) => t.name)}
            selected={draft.tournament?.name ?? ''}
            query={tournamentQuery}
            onQueryChange={setTournamentQuery}
            onSelect={(name) => {
              const existing = festivalTournaments.find((t) => t.name === name);
              if (existing) {
                update({ tournament: existing, buyIn: String(existing.buyIn) });
                setActivePicker(null);
              }
            }}
            onCreate={(name) => {
              update({
                tournament: { id: `t-${Date.now()}`, festivalId: draft.festival?.id ?? '', name, buyIn: parseFloat(draft.buyIn) || 0 },
              });
              setActivePicker(null);
            }}
            placeholder={t('addSession.searchTournament')}
          />
        </PickerField>
      )}

      <BuyInField label={t('addSession.stakeAmount')} value={draft.buyIn} onChange={(v) => update({ buyIn: v })} inferred={inferred} inferredNote={t('addSession.buyInInferredNote')} />

      <Stepper
        label={t('stakeDetail.percentage')}
        value={draft.stakingPercentage}
        onDecrement={() => update({ stakingPercentage: Math.max(1, draft.stakingPercentage - 1) })}
        onIncrement={() => update({ stakingPercentage: Math.min(100, draft.stakingPercentage + 1) })}
        min={1}
        max={100}
        format={(v) => t('percent', { value: v })}
      />
      {buyIn > 0 && <SummaryLine label={t('stakeDetail.stakeCommitted')} value={formatAmount(investedNum)} />}

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>{t('stakeDetail.status')}</FieldLabel>
        <ResultToggle
          options={[
            { key: 'pending', label: t('status.pending') },
            { key: 'out', label: t('status.eliminated'), activeColor: colors.loss },
            { key: 'itm', label: t('status.itm'), activeColor: colors.accent },
          ]}
          value={!draft.stakingSettled ? 'pending' : draft.stakingCashed ? 'itm' : 'out'}
          onChange={(k) => {
            if (k === 'pending') update({ stakingSettled: false, stakingCashed: false });
            else if (k === 'out') update({ stakingSettled: true, stakingCashed: false });
            else update({ stakingSettled: true, stakingCashed: true });
          }}
        />
      </View>

      {draft.stakingSettled && draft.stakingCashed && (
        <>
          <Stepper
            label={t('stakeDetail.theirCashout')}
            value={theirCashout}
            onDecrement={() => update({ stakingTheirCashout: String(Math.max(0, theirCashout - MONEY_STEP)) })}
            onIncrement={() => update({ stakingTheirCashout: String(theirCashout + MONEY_STEP) })}
            max={MONEY_MAX}
            format={formatAmount}
          />
          {theirCashout > 0 && (
            <SummaryLine label={t('addSession.myProfit')} value={signedAmount(profit)} color={profit >= 0 ? colors.accent : colors.loss} />
          )}
        </>
      )}
    </View>
  );
}

// ─── Edit support & serialization ────────────────────────────────────────────

function sessionToDraft(session: Session, festivals: Festival[], tournaments: Tournament[], players: Player[]): Draft {
  const stackings: StackingDraft[] = (session.stackings ?? []).map((s) => ({
    player: players.find((p) => p.id === s.playerId) ?? { id: s.playerId, name: '' },
    kind: s.kind,
    profitShare: s.profitShare,
    buyInAmount: s.kind === 'stack' ? String(s.buyInAmount) : '',
    buyInAmountTouched: s.kind === 'stack',
  }));

  if (session.type === 'tournament') {
    const tournament = tournaments.find((t) => t.id === session.tournamentId) ?? null;
    const festival = tournament ? festivals.find((f) => f.id === tournament.festivalId) ?? null : null;
    return {
      ...INITIAL_DRAFT,
      sessionType: 'tournament',
      festival,
      tournament,
      buyIn: String(session.buyIn),
      reEntries: session.reEntries,
      cashed: session.cashed,
      cashOut: session.cashed ? String(session.cashOut) : '',
      position: session.position ? String(session.position) : '',
      durationHours: session.durationHours,
      stackings,
    };
  }

  return {
    ...INITIAL_DRAFT,
    sessionType: 'cash',
    venue: session.venue,
    gameType: session.gameType,
    stakes: session.stakes,
    buyIn: String(session.buyIn),
    cashOut: String(session.cashOut),
    durationHours: session.durationHours,
    stackings,
  };
}

/** Builds a Session-shaped object from the draft — used both for the live net preview and the final save. */
function draftToSessionShape(draft: Draft, editing?: Session | null): Session | null {
  const nowIso = new Date().toISOString();
  const id = editing?.id ?? `r-${Date.now()}`;
  const date = editing?.date ?? nowIso;
  const createdAt = editing?.createdAt ?? nowIso;

  const stackings: Stacking[] = draft.stackings
    .filter((s) => s.player !== null)
    .map((s) => ({
      playerId: s.player!.id,
      kind: s.kind,
      profitShare: s.profitShare,
      buyInAmount: resolveStackAmount(s),
    }));

  if (draft.sessionType === 'tournament') {
    if (!draft.tournament) return null;
    const buyIn = parseFloat(draft.buyIn) || 0;
    const cashOut = draft.cashed ? parseFloat(draft.cashOut) || 0 : 0;
    const session: TournamentSession = {
      id,
      type: 'tournament',
      date,
      venue: draft.festival?.name ?? '',
      tournamentId: draft.tournament.id,
      buyIn,
      reEntries: draft.reEntries,
      cashOut,
      cashed: draft.cashed,
      position: draft.position ? parseInt(draft.position, 10) : undefined,
      durationHours: draft.durationHours,
      stackings: stackings.length > 0 ? stackings : undefined,
      createdAt,
    };
    return session;
  }

  if (draft.sessionType === 'cash') {
    const session: CashSession = {
      id,
      type: 'cash',
      date,
      venue: draft.venue,
      gameType: draft.gameType,
      stakes: draft.stakes,
      buyIn: parseFloat(draft.buyIn) || 0,
      cashOut: parseFloat(draft.cashOut) || 0,
      durationHours: draft.durationHours,
      stackings: stackings.length > 0 ? stackings : undefined,
      createdAt,
    };
    return session;
  }

  return null;
}

function buildRecord(draft: Draft, editing?: Session | null): SaveRecord {
  if (draft.sessionType === 'stake') {
    if (!draft.stakingPlayer) return {};
    const nowIso = new Date().toISOString();
    const stake: Stake = {
      id: `r-${Date.now()}`,
      date: nowIso,
      playerId: draft.stakingPlayer.id,
      festivalId: draft.festival?.id,
      tournamentId: draft.tournament?.id,
      buyIn: parseFloat(draft.buyIn) || 0,
      percentage: draft.stakingPercentage,
      settled: draft.stakingSettled,
      cashed: draft.stakingSettled ? draft.stakingCashed : undefined,
      theirCashout: draft.stakingSettled && draft.stakingCashed ? parseFloat(draft.stakingTheirCashout) || 0 : undefined,
      createdAt: nowIso,
    };
    return {
      stake,
      newPlayers: [draft.stakingPlayer],
      newFestival: draft.festival ?? undefined,
      newTournament: draft.tournament ?? undefined,
    };
  }

  const session = draftToSessionShape(draft, editing);
  if (!session) return {};

  const newPlayers = draft.stackings.filter((s) => s.player !== null).map((s) => s.player!);

  if (draft.sessionType === 'tournament') {
    return {
      session,
      newFestival: draft.festival ?? undefined,
      newTournament: draft.tournament ?? undefined,
      newPlayers,
    };
  }

  return { session, newPlayers };
}

function canSave(draft: Draft): boolean {
  switch (draft.sessionType) {
    case 'tournament':
      return draft.festival !== null && draft.tournament !== null && draft.buyIn.trim() !== '';
    case 'cash':
      return draft.venue.trim() !== '' && draft.buyIn.trim() !== '';
    case 'stake':
      return draft.stakingPlayer !== null;
    default:
      return false;
  }
}

function signedAmount(val: number): string {
  return `${val < 0 ? '-' : '+'}${formatAmount(val)}`;
}

const MONEY_STEP = 50;
const MONEY_MAX = 200000;

// ─── Main component ──────────────────────────────────────────────────────────

export function AddSessionSheet({
  visible,
  onClose,
  onSave,
  festivals,
  tournaments,
  players,
  initialSession,
  initialTournament,
  initialFestival,
}: Props) {
  const { t } = useTranslation('tracker');
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const isEditing = initialSession != null;

  const segmentOptions = useMemo<{ key: SessionKind; label: string }[]>(() => [
    { key: 'tournament', label: t('types.tournament') },
    { key: 'cash', label: t('types.cash') },
    { key: 'stake', label: t('types.staking') },
  ], [t]);

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseed the draft each time the sheet opens
    setActivePicker(null);
    if (initialSession) {
      setDraft(sessionToDraft(initialSession, festivals, tournaments, players));
    } else if (initialTournament) {
      setDraft({
        ...INITIAL_DRAFT,
        sessionType: 'tournament',
        tournament: initialTournament,
        festival: festivals.find((f) => f.id === initialTournament.festivalId) ?? null,
        buyIn: String(initialTournament.buyIn),
      });
    } else if (initialFestival) {
      setDraft({
        ...INITIAL_DRAFT,
        sessionType: 'tournament',
        festival: initialFestival,
        tournament: null,
        buyIn: '',
      });
    } else {
      setDraft(INITIAL_DRAFT);
    }
    // Only re-seed when the modal opens or the target changes, not on every draft edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialSession, initialTournament, initialFestival]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSegmentChange = useCallback((key: SessionKind) => {
    setActivePicker(null);
    update({ sessionType: key });
  }, [update]);

  const netPreview = useMemo(() => {
    if (draft.sessionType === 'stake') {
      if (!draft.stakingSettled) return null;
      const buyIn = parseFloat(draft.buyIn) || 0;
      const invested = (draft.stakingPercentage / 100) * buyIn;
      const theirCashout = draft.stakingCashed ? parseFloat(draft.stakingTheirCashout) || 0 : 0;
      const myReturn = (draft.stakingPercentage / 100) * theirCashout;
      return myReturn - invested;
    }
    const shape = draftToSessionShape(draft, initialSession);
    if (!shape) return null;
    return sessionNetValues(shape).profit;
  }, [draft, initialSession]);

  const handleSave = useCallback(() => {
    if (!canSave(draft)) return;
    const record = buildRecord(draft, initialSession);
    onSave(record);
  }, [draft, initialSession, onSave]);

  const canProceed = canSave(draft);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={isEditing ? t('addSession.editTitle') : t('addSession.newTitle')}
      footer={
        <View style={{ gap: spacing.md }}>
          {netPreview !== null && (
            <View style={styles.netRow}>
              <Text style={[styles.netLabel, { color: colors.textSecondary }]}>{t('detail.netResult')}</Text>
              <Text style={[styles.netValue, { color: netPreview >= 0 ? colors.accent : colors.loss }]}>
                {signedAmount(netPreview)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.accent }, !canProceed && styles.ctaDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={!canProceed}
          >
            <Text style={styles.ctaText}>{isEditing ? t('addSession.updateCta') : t('addSession.saveCta')}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <SegmentedControl options={segmentOptions} value={draft.sessionType} onChange={handleSegmentChange} />
      <View style={{ height: spacing.lg }} />

      {draft.sessionType === 'tournament' && (
        <TournamentFields
          draft={draft}
          update={update}
          festivals={festivals}
          tournaments={tournaments}
          players={players}
          activePicker={activePicker}
          setActivePicker={setActivePicker}
        />
      )}
      {draft.sessionType === 'cash' && (
        <CashFields
          draft={draft}
          update={update}
          festivals={festivals}
          players={players}
          activePicker={activePicker}
          setActivePicker={setActivePicker}
        />
      )}
      {draft.sessionType === 'stake' && (
        <StakingFields
          draft={draft}
          update={update}
          festivals={festivals}
          tournaments={tournaments}
          players={players}
          activePicker={activePicker}
          setActivePicker={setActivePicker}
        />
      )}
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sharedStyles = StyleSheet.create({
  fieldLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabelInline: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  summary: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  toggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleWrap: {
    flexWrap: 'wrap',
  },
  toggleBtn: {
    flex: 1,
    minWidth: 90,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});

const stackingStyles = StyleSheet.create({
  entry: {
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});

const styles = StyleSheet.create({
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  netValue: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.extrabold,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
});
