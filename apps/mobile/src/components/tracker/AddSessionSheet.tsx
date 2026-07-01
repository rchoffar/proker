import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { SegmentedControl } from '../ui/SegmentedControl';
import { PickerField, SearchCreateList } from '../ui/PickerField';
import { BuyInField } from '../ui/BuyInField';
import { AmountInput } from '../ui/AmountInput';
import { Stepper } from '../ui/Stepper';
import { sessionNetValues } from '../../store/useAppStore';
import { fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Festival, Tournament, Session, TournamentSession, CashSession, GameType, Stake, Player, Backing } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionKind = 'tournament' | 'cash' | 'stake';

interface BackingDraft {
  player: Player | null;
  profitShare: number;
  paysBuyIn: boolean;
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
  backings: BackingDraft[];
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
  backings: [],
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

// ─── Backing sub-section (shared by Tournoi & Cash) ──────────────────────────

function BackingSection({
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
  const { colors } = useTheme();
  const [queries, setQueries] = useState<Record<number, string>>({});
  const buyIn = parseFloat(draft.buyIn) || 0;
  const totalBuyIn = draft.sessionType === 'tournament' ? (draft.reEntries + 1) * buyIn : buyIn;
  const totalProfitPct = draft.backings.reduce((sum, b) => sum + b.profitShare, 0);
  const yourSharePct = 100 - totalProfitPct;
  const totalBuyInCovered = draft.backings.reduce((sum, b) => sum + (b.paysBuyIn ? b.profitShare : 0), 0);
  const yourActualCost = totalBuyIn > 0 ? ((100 - totalBuyInCovered) / 100) * totalBuyIn : 0;

  const addBacking = useCallback(() => {
    update({ backings: [...draft.backings, { player: null, profitShare: 10, paysBuyIn: true }] });
  }, [draft.backings, update]);

  const removeBacking = useCallback((idx: number) => {
    update({ backings: draft.backings.filter((_, i) => i !== idx) });
  }, [draft.backings, update]);

  const updateBacking = useCallback(
    (idx: number, patch: Partial<BackingDraft>) => {
      update({ backings: draft.backings.map((b, i) => (i === idx ? { ...b, ...patch } : b)) });
    },
    [draft.backings, update]
  );

  return (
    <View style={{ gap: spacing.md }}>
      <FieldLabel>Backing (optionnel)</FieldLabel>

      {draft.backings.map((backing, idx) => {
        const pickerKey = `backing-${idx}`;
        return (
          <View key={idx} style={[backingStyles.entry, { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg }]}>
            <View style={backingStyles.entryHeader}>
              <Text style={[sharedStyles.fieldLabelInline, { color: colors.textSecondary }]}>Backer {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeBacking(idx)} activeOpacity={0.7}>
                <Text style={[backingStyles.removeText, { color: colors.loss }]}>Retirer</Text>
              </TouchableOpacity>
            </View>
            <PickerField
              label="Joueur"
              value={backing.player?.name ?? ''}
              placeholder="Chercher ou ajouter un joueur…"
              expanded={activePicker === pickerKey}
              onToggleExpand={() => setActivePicker(activePicker === pickerKey ? null : pickerKey)}
            >
              <SearchCreateList
                items={players.map((p) => p.name)}
                selected={backing.player?.name ?? ''}
                query={queries[idx] ?? ''}
                onQueryChange={(v) => setQueries((q) => ({ ...q, [idx]: v }))}
                onSelect={(name) => {
                  const existing = players.find((p) => p.name === name);
                  updateBacking(idx, { player: existing ?? { id: `p-${Date.now()}`, name } });
                  setActivePicker(null);
                }}
                onCreate={(name) => {
                  updateBacking(idx, { player: { id: `p-${Date.now()}`, name } });
                  setActivePicker(null);
                }}
                placeholder="Chercher ou ajouter un joueur…"
              />
            </PickerField>
            <Stepper
              label="Part des gains"
              value={backing.profitShare}
              onDecrement={() => updateBacking(idx, { profitShare: Math.max(1, backing.profitShare - 1) })}
              onIncrement={() => updateBacking(idx, { profitShare: Math.min(100 - totalProfitPct + backing.profitShare, backing.profitShare + 1) })}
              min={1}
              max={100 - totalProfitPct + backing.profitShare}
              format={(v) => `${v} %`}
            />
            <View style={{ gap: spacing.sm }}>
              <FieldLabel>Participe au buy-in ?</FieldLabel>
              <ResultToggle
                options={[{ key: 'yes', label: 'Oui' }, { key: 'no', label: 'Non' }]}
                value={backing.paysBuyIn ? 'yes' : 'no'}
                onChange={(k) => updateBacking(idx, { paysBuyIn: k === 'yes' })}
              />
            </View>
          </View>
        );
      })}

      {totalProfitPct < 100 && (
        <TouchableOpacity style={[backingStyles.addBtn, { borderColor: colors.hairline }]} onPress={addBacking} activeOpacity={0.7}>
          <Plus size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[backingStyles.addBtnText, { color: colors.textSecondary }]}>Ajouter un backer</Text>
        </TouchableOpacity>
      )}

      {draft.backings.length > 0 && (
        <SummaryLine
          label="Votre part des gains"
          value={`${yourSharePct} %${totalBuyIn > 0 ? ` — Mise réelle : ${yourActualCost.toFixed(0)} €` : ''}`}
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
  const { colors } = useTheme();
  const [festivalQuery, setFestivalQuery] = useState('');
  const [tournamentQuery, setTournamentQuery] = useState('');

  const festivalTournaments = useMemo(
    () => tournaments.filter((t) => t.festivalId === draft.festival?.id),
    [tournaments, draft.festival]
  );
  const inferred = draft.tournament != null && tournaments.some((t) => t.id === draft.tournament!.id);

  return (
    <View style={{ gap: spacing.lg }}>
      <PickerField
        label="Festival · lieu"
        value={draft.festival?.name ?? ''}
        placeholder="Choisir un festival"
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
          placeholder="Chercher ou créer un festival…"
        />
      </PickerField>

      <PickerField
        label="Tournoi"
        value={draft.tournament?.name ?? ''}
        placeholder={draft.festival ? 'Choisir un tournoi' : 'Choisissez un festival d’abord'}
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
          placeholder="Chercher ou créer un tournoi…"
        />
      </PickerField>

      <BuyInField value={draft.buyIn} onChange={(v) => update({ buyIn: v })} inferred={inferred} />

      <Stepper
        label="Re-entries"
        value={draft.reEntries}
        onDecrement={() => update({ reEntries: Math.max(0, draft.reEntries - 1) })}
        onIncrement={() => update({ reEntries: Math.min(10, draft.reEntries + 1) })}
        max={10}
      />

      <BackingSection draft={draft} update={update} players={players} activePicker={activePicker} setActivePicker={setActivePicker} />

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Résultat</FieldLabel>
        <ResultToggle
          options={[
            { key: 'out', label: 'Éliminé', activeColor: colors.loss },
            { key: 'itm', label: 'ITM', activeColor: colors.accent },
          ]}
          value={draft.cashed ? 'itm' : 'out'}
          onChange={(k) => update({ cashed: k === 'itm' })}
        />
      </View>

      {draft.cashed && (
        <Stepper
          label="Gains"
          value={parseFloat(draft.cashOut) || 0}
          onDecrement={() => update({ cashOut: String(Math.max(0, (parseFloat(draft.cashOut) || 0) - MONEY_STEP)) })}
          onIncrement={() => update({ cashOut: String((parseFloat(draft.cashOut) || 0) + MONEY_STEP) })}
          max={MONEY_MAX}
          format={formatMoney}
        />
      )}
      {draft.cashed && (
        <AmountInput label="Position (optionnel)" value={draft.position} onChange={(v) => update({ position: v })} placeholder="ex. 8" unit="#" />
      )}

      <Stepper
        label="Durée"
        value={draft.durationHours}
        onDecrement={() => update({ durationHours: Math.max(0.5, draft.durationHours - 0.5) })}
        onIncrement={() => update({ durationHours: Math.min(48, draft.durationHours + 0.5) })}
        min={0.5}
        max={48}
        format={(v) => `${v}h`}
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
  const { colors } = useTheme();
  const [venueQuery, setVenueQuery] = useState('');
  const knownVenues = useMemo(() => [...new Set(festivals.map((f) => f.name))], [festivals]);

  return (
    <View style={{ gap: spacing.lg }}>
      <PickerField
        label="Festival · lieu"
        value={draft.venue}
        placeholder="Choisir ou saisir un lieu"
        expanded={activePicker === 'venue'}
        onToggleExpand={() => setActivePicker(activePicker === 'venue' ? null : 'venue')}
      >
        <SearchCreateList
          items={knownVenues}
          selected={draft.venue}
          query={venueQuery}
          onQueryChange={(v) => { setVenueQuery(v); update({ venue: v }); }}
          onSelect={(v) => { update({ venue: v }); setActivePicker(null); }}
          placeholder="Chercher ou saisir un lieu…"
        />
      </PickerField>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Variante</FieldLabel>
        <ResultToggle
          options={(['NLH', 'PLO'] as GameType[]).map((g) => ({ key: g, label: g }))}
          value={draft.gameType}
          onChange={(k) => update({ gameType: k as GameType })}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Mises</FieldLabel>
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

      <BackingSection draft={draft} update={update} players={players} activePicker={activePicker} setActivePicker={setActivePicker} />

      <Stepper
        label="Gains"
        value={parseFloat(draft.cashOut) || 0}
        onDecrement={() => update({ cashOut: String(Math.max(0, (parseFloat(draft.cashOut) || 0) - MONEY_STEP)) })}
        onIncrement={() => update({ cashOut: String((parseFloat(draft.cashOut) || 0) + MONEY_STEP) })}
        max={MONEY_MAX}
        format={formatMoney}
      />

      <Stepper
        label="Durée"
        value={draft.durationHours}
        onDecrement={() => update({ durationHours: Math.max(0.5, draft.durationHours - 0.5) })}
        onIncrement={() => update({ durationHours: Math.min(48, draft.durationHours + 0.5) })}
        min={0.5}
        max={48}
        format={(v) => `${v}h`}
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
  const invested = investedNum.toFixed(0);
  const theirCashout = parseFloat(draft.stakingTheirCashout) || 0;
  const myReturn = (draft.stakingPercentage / 100) * theirCashout;
  const profit = myReturn - investedNum;

  return (
    <View style={{ gap: spacing.lg }}>
      <PickerField
        label="Joueur backé"
        value={draft.stakingPlayer?.name ?? ''}
        placeholder="Chercher ou ajouter un joueur…"
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
          placeholder="Chercher ou ajouter un joueur…"
        />
      </PickerField>

      <PickerField
        label="Festival · lieu (optionnel)"
        value={draft.festival?.name ?? ''}
        placeholder="Choisir un festival"
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
          placeholder="Chercher un festival…"
        />
      </PickerField>

      {draft.festival && (
        <PickerField
          label="Tournoi (optionnel)"
          value={draft.tournament?.name ?? ''}
          placeholder="Choisir un tournoi"
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
            placeholder="Chercher un tournoi…"
          />
        </PickerField>
      )}

      <BuyInField label="Mise" value={draft.buyIn} onChange={(v) => update({ buyIn: v })} inferred={inferred} />

      <Stepper
        label="Pourcentage"
        value={draft.stakingPercentage}
        onDecrement={() => update({ stakingPercentage: Math.max(1, draft.stakingPercentage - 1) })}
        onIncrement={() => update({ stakingPercentage: Math.min(100, draft.stakingPercentage + 1) })}
        min={1}
        max={100}
        format={(v) => `${v} %`}
      />
      {buyIn > 0 && <SummaryLine label="Mise engagée" value={`${invested} €`} />}

      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Statut</FieldLabel>
        <ResultToggle
          options={[
            { key: 'pending', label: 'En attente' },
            { key: 'out', label: 'Éliminé', activeColor: colors.loss },
            { key: 'itm', label: 'ITM', activeColor: colors.accent },
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
            label="Leur cashout"
            value={theirCashout}
            onDecrement={() => update({ stakingTheirCashout: String(Math.max(0, theirCashout - MONEY_STEP)) })}
            onIncrement={() => update({ stakingTheirCashout: String(theirCashout + MONEY_STEP) })}
            max={MONEY_MAX}
            format={formatMoney}
          />
          {theirCashout > 0 && (
            <SummaryLine label="Mon gain" value={`${profit >= 0 ? '+' : ''}${profit.toFixed(0)} €`} color={profit >= 0 ? colors.accent : colors.loss} />
          )}
        </>
      )}
    </View>
  );
}

// ─── Edit support & serialization ────────────────────────────────────────────

function sessionToDraft(session: Session, festivals: Festival[], tournaments: Tournament[], players: Player[]): Draft {
  const backings: BackingDraft[] = (session.backings ?? []).map((b) => ({
    player: players.find((p) => p.id === b.playerId) ?? { id: b.playerId, name: '' },
    profitShare: b.profitShare,
    paysBuyIn: b.buyInShare > 0,
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
      backings,
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
    backings,
  };
}

/** Builds a Session-shaped object from the draft — used both for the live net preview and the final save. */
function draftToSessionShape(draft: Draft, editing?: Session | null): Session | null {
  const nowIso = new Date().toISOString();
  const id = editing?.id ?? `r-${Date.now()}`;
  const date = editing?.date ?? nowIso;
  const createdAt = editing?.createdAt ?? nowIso;

  const backings: Backing[] = draft.backings
    .filter((b) => b.player !== null)
    .map((b) => ({ playerId: b.player!.id, profitShare: b.profitShare, buyInShare: b.paysBuyIn ? b.profitShare : 0 }));

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
      backings: backings.length > 0 ? backings : undefined,
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
      backings: backings.length > 0 ? backings : undefined,
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

  const newPlayers = draft.backings.filter((b) => b.player !== null).map((b) => b.player!);

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

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '+';
  return `${sign}${abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function formatMoney(val: number): string {
  return `${val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

const MONEY_STEP = 50;
const MONEY_MAX = 200000;

// ─── Main component ──────────────────────────────────────────────────────────

const SEGMENT_OPTIONS: { key: SessionKind; label: string }[] = [
  { key: 'tournament', label: 'Tournoi' },
  { key: 'cash', label: 'Cash' },
  { key: 'stake', label: 'Staking' },
];

export function AddSessionSheet({
  visible,
  onClose,
  onSave,
  festivals,
  tournaments,
  players,
  initialSession,
  initialTournament,
}: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const isEditing = initialSession != null;

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
    } else {
      setDraft(INITIAL_DRAFT);
    }
    // Only re-seed when the modal opens or the target changes, not on every draft edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialSession, initialTournament]);

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
      title={isEditing ? 'Modifier la session' : 'Nouvelle session'}
      footer={
        <View style={{ gap: spacing.md }}>
          {netPreview !== null && (
            <View style={styles.netRow}>
              <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Résultat net</Text>
              <Text style={[styles.netValue, { color: netPreview >= 0 ? colors.accent : colors.loss }]}>
                {formatCurrency(netPreview)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.accent }, !canProceed && styles.ctaDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={!canProceed}
          >
            <Text style={styles.ctaText}>{isEditing ? 'Mettre à jour' : 'Enregistrer la session'}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <SegmentedControl options={SEGMENT_OPTIONS} value={draft.sessionType} onChange={handleSegmentChange} />
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

const backingStyles = StyleSheet.create({
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
