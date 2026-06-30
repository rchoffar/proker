import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, ChevronLeft, Trophy, Banknote, Minus, Plus, Check, Users } from 'lucide-react-native';
import { colors, fontFamily, fontSize, spacing, radius } from '../../design-system/theme';
import type { Festival, Tournament, Session, TournamentSession, CashSession, GameType, Stake, Player, Backing } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step =
  | 'type'
  | 'festival' | 'tournament' | 'reentries' | 'backing' | 'result_t'
  | 'venue' | 'result_c'
  | 'stake_player' | 'stake_setup' | 'stake_result';

interface Draft {
  sessionType: 'tournament' | 'cash' | 'stake' | null;
  // Tournament / Stake shared
  festival: Festival | null;
  tournament: Tournament | null;
  buyIn: string;
  // Tournament
  reEntries: number;
  cashed: boolean;
  cashOut: string;
  position: string;
  // Cash
  venue: string;
  gameType: GameType;
  stakes: string;
  // Shared
  durationHours: number;
  // Being backed
  backings: Array<{ player: Player | null; profitShare: number; paysBuyIn: boolean }>;
  // Staking
  stakingPlayer: Player | null;
  stakingPercentage: number;
  stakingSettled: boolean;
  stakingCashed: boolean;
  stakingTheirCashout: string;
}

const INITIAL_DRAFT: Draft = {
  sessionType: null,
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
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function StepTitle({ children }: { children: string }) {
  return <Text style={sharedStyles.stepTitle}>{children}</Text>;
}

function ChipList({
  items,
  selected,
  onSelect,
  onCreate,
  query,
  onQueryChange,
  placeholder,
}: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  onCreate?: (v: string) => void;
  query: string;
  onQueryChange: (v: string) => void;
  placeholder: string;
}) {
  const trimmedQuery = query.trim();
  const filtered = items.filter((i) =>
    i.toLowerCase().includes(query.toLowerCase())
  );
  // A newly-created item lives in draft but not in the items list yet.
  // Show it as a pinned selected chip so the user sees their selection.
  const selectedIsNew = selected.length > 0 && !items.includes(selected);
  const showCreate = trimmedQuery.length > 0
    && !items.some((f) => f.toLowerCase() === trimmedQuery.toLowerCase())
    && trimmedQuery.toLowerCase() !== selected.toLowerCase();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={sharedStyles.inputWrap}>
        <TextInput
          style={sharedStyles.input}
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
        />
      </View>
      <View style={sharedStyles.chipGrid}>
        {selectedIsNew && (
          <TouchableOpacity
            key={`__new__${selected}`}
            style={[sharedStyles.chip, sharedStyles.chipSelected]}
            onPress={() => onSelect(selected)}
            activeOpacity={0.7}
          >
            <Check size={11} color={colors.textPrimary} strokeWidth={2.5} />
            <Text style={[sharedStyles.chipText, sharedStyles.chipTextSelected]}>
              {selected}
            </Text>
          </TouchableOpacity>
        )}
        {filtered.map((item) => (
          <TouchableOpacity
            key={item}
            style={[sharedStyles.chip, selected === item && sharedStyles.chipSelected]}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
          >
            <Text style={[sharedStyles.chipText, selected === item && sharedStyles.chipTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
        {showCreate && onCreate && (
          <TouchableOpacity
            style={[sharedStyles.chip, sharedStyles.chipCreate]}
            onPress={() => { onCreate(trimmedQuery); onQueryChange(''); }}
            activeOpacity={0.7}
          >
            <Plus size={11} color={colors.profit} strokeWidth={2.5} />
            <Text style={[sharedStyles.chipText, { color: colors.profit }]}>
              Créer «{trimmedQuery}»
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Counter({
  label,
  value,
  onDecrement,
  onIncrement,
  min = 0,
  max = 20,
  format,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={sharedStyles.counterWrap}>
      <Text style={sharedStyles.counterLabel}>{label}</Text>
      <View style={sharedStyles.counterRow}>
        <TouchableOpacity
          style={[sharedStyles.counterBtn, value <= min && sharedStyles.counterBtnDisabled]}
          onPress={onDecrement}
          disabled={value <= min}
          activeOpacity={0.7}
        >
          <Minus size={20} color={value <= min ? colors.textTertiary : colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={sharedStyles.counterValue}>
          {format ? format(value) : String(value)}
        </Text>
        <TouchableOpacity
          style={[sharedStyles.counterBtn, value >= max && sharedStyles.counterBtnDisabled]}
          onPress={onIncrement}
          disabled={value >= max}
          activeOpacity={0.7}
        >
          <Plus size={20} color={value >= max ? colors.textTertiary : colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AmountInput({
  label,
  value,
  onChange,
  placeholder = '0',
  unit = '€',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={sharedStyles.fieldLabel}>{label}</Text>
      <View style={sharedStyles.amountRow}>
        <TextInput
          style={sharedStyles.amountInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
        />
        <Text style={sharedStyles.amountUnit}>{unit}</Text>
      </View>
    </View>
  );
}

// ─── Step renderers ───────────────────────────────────────────────────────────

function StepType({ onSelect }: { onSelect: (t: 'tournament' | 'cash' | 'stake') => void }) {
  return (
    <View style={{ gap: spacing.md }}>
      <StepTitle>Quel type d'entrée ?</StepTitle>
      <TouchableOpacity style={typeStyles.card} onPress={() => onSelect('tournament')} activeOpacity={0.8}>
        <View style={typeStyles.iconWrap}>
          <Trophy size={28} color="#FFD700" strokeWidth={1.5} />
        </View>
        <Text style={typeStyles.cardTitle}>Tournoi</Text>
        <Text style={typeStyles.cardSub}>Festival, re-entries, classement</Text>
      </TouchableOpacity>
      <TouchableOpacity style={typeStyles.card} onPress={() => onSelect('cash')} activeOpacity={0.8}>
        <View style={[typeStyles.iconWrap, { backgroundColor: 'rgba(0, 200, 120, 0.12)' }]}>
          <Banknote size={28} color={colors.profit} strokeWidth={1.5} />
        </View>
        <Text style={typeStyles.cardTitle}>Cash Game</Text>
        <Text style={typeStyles.cardSub}>NLH, PLO, toutes les mises</Text>
      </TouchableOpacity>
      <TouchableOpacity style={typeStyles.card} onPress={() => onSelect('stake')} activeOpacity={0.8}>
        <View style={[typeStyles.iconWrap, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
          <Users size={28} color="#A5B4FC" strokeWidth={1.5} />
        </View>
        <Text style={typeStyles.cardTitle}>Staking</Text>
        <Text style={typeStyles.cardSub}>Backer un ami, % des gains</Text>
      </TouchableOpacity>
    </View>
  );
}

function StepFestival({
  festivals,
  draft,
  onUpdate,
}: {
  festivals: Festival[];
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  const [query, setQuery] = useState('');

  const handleSelect = useCallback((name: string) => {
    const existing = festivals.find((f) => f.name === name);
    onUpdate({ festival: existing ?? { id: `f-${Date.now()}`, name }, tournament: null });
  }, [festivals, onUpdate]);

  const handleCreate = useCallback((name: string) => {
    onUpdate({ festival: { id: `f-${Date.now()}`, name }, tournament: null });
  }, [onUpdate]);

  return (
    <View style={{ gap: spacing.lg }}>
      <StepTitle>Festival ou série</StepTitle>
      <ChipList
        items={festivals.map((f) => f.name)}
        selected={draft.festival?.name ?? ''}
        onSelect={handleSelect}
        onCreate={handleCreate}
        query={query}
        onQueryChange={setQuery}
        placeholder="Chercher ou créer un festival…"
      />
    </View>
  );
}

function StepTournament({
  tournaments,
  draft,
  onUpdate,
}: {
  tournaments: Tournament[];
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  const [query, setQuery] = useState('');
  const festivalTournaments = tournaments.filter((t) => t.festivalId === draft.festival?.id);

  const handleSelect = useCallback((name: string) => {
    const existing = festivalTournaments.find((t) => t.name === name);
    if (existing) {
      onUpdate({ tournament: existing, buyIn: String(existing.buyIn) });
    }
  }, [festivalTournaments, onUpdate]);

  const handleCreate = useCallback((name: string) => {
    const buyInNum = parseFloat(draft.buyIn) || 0;
    onUpdate({
      tournament: {
        id: `t-${Date.now()}`,
        festivalId: draft.festival?.id ?? '',
        name,
        buyIn: buyInNum,
      },
    });
  }, [draft.buyIn, draft.festival]);

  return (
    <View style={{ gap: spacing.lg }}>
      <StepTitle>Tournoi</StepTitle>
      <ChipList
        items={festivalTournaments.map((t) => t.name)}
        selected={draft.tournament?.name ?? ''}
        onSelect={handleSelect}
        onCreate={handleCreate}
        query={query}
        onQueryChange={setQuery}
        placeholder="Chercher ou créer un tournoi…"
      />
      <AmountInput
        label="Buy-in"
        value={draft.buyIn}
        onChange={(v) => onUpdate({ buyIn: v })}
        placeholder="500"
      />
    </View>
  );
}

function StepReentries({
  draft,
  onUpdate,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  const buyIn = parseFloat(draft.buyIn) || 0;
  const totalInvested = (draft.reEntries + 1) * buyIn;

  return (
    <View style={{ gap: spacing.xl }}>
      <StepTitle>Re-entries</StepTitle>
      <Counter
        label="Nombre de re-entries"
        value={draft.reEntries}
        onDecrement={() => onUpdate({ reEntries: Math.max(0, draft.reEntries - 1) })}
        onIncrement={() => onUpdate({ reEntries: Math.min(10, draft.reEntries + 1) })}
        max={10}
      />
      {buyIn > 0 && (
        <View style={reentriesStyles.summary}>
          <Text style={reentriesStyles.summaryLabel}>Total investi</Text>
          <Text style={reentriesStyles.summaryValue}>
            {draft.reEntries + 1} × {buyIn.toFixed(0)} € = {totalInvested.toFixed(0)} €
          </Text>
        </View>
      )}
    </View>
  );
}

function StepBacking({
  draft,
  onUpdate,
  players,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
  players: Player[];
}) {
  const buyIn = parseFloat(draft.buyIn) || 0;
  const totalBuyIn = draft.sessionType === 'tournament'
    ? (draft.reEntries + 1) * buyIn
    : buyIn;
  const totalProfitPct = draft.backings.reduce((sum, b) => sum + b.profitShare, 0);
  const yourSharePct = 100 - totalProfitPct;
  const totalBuyInCovered = draft.backings.reduce((sum, b) => sum + (b.paysBuyIn ? b.profitShare : 0), 0);
  const yourActualCost = totalBuyIn > 0 ? ((100 - totalBuyInCovered) / 100) * totalBuyIn : 0;

  const addBacking = useCallback(() => {
    onUpdate({ backings: [...draft.backings, { player: null, profitShare: 10, paysBuyIn: true }] });
  }, [draft.backings, onUpdate]);

  const removeBacking = useCallback((idx: number) => {
    onUpdate({ backings: draft.backings.filter((_, i) => i !== idx) });
  }, [draft.backings, onUpdate]);

  const updateBacking = useCallback(
    (idx: number, patch: Partial<{ player: Player | null; profitShare: number; paysBuyIn: boolean }>) => {
      onUpdate({ backings: draft.backings.map((b, i) => i === idx ? { ...b, ...patch } : b) });
    },
    [draft.backings, onUpdate]
  );

  return (
    <View style={{ gap: spacing.xl }}>
      <StepTitle>Avez-vous un backer ?</StepTitle>

      {draft.backings.length === 0 && (
        <Text style={backingStyles.emptyHint}>
          Aucun backer — vous jouez votre propre mise.
        </Text>
      )}

      {draft.backings.map((backing, idx) => (
        <BackingEntry
          key={idx}
          backing={backing}
          players={players}
          maxProfitShare={100 - totalProfitPct + backing.profitShare}
          onChange={(patch) => updateBacking(idx, patch)}
          onRemove={() => removeBacking(idx)}
        />
      ))}

      {totalProfitPct < 100 && (
        <TouchableOpacity style={backingStyles.addBtn} onPress={addBacking} activeOpacity={0.7}>
          <Plus size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={backingStyles.addBtnText}>Ajouter un backer</Text>
        </TouchableOpacity>
      )}

      {draft.backings.length > 0 && (
        <View style={reentriesStyles.summary}>
          <Text style={reentriesStyles.summaryLabel}>Votre part des gains</Text>
          <Text style={reentriesStyles.summaryValue}>
            {yourSharePct} %
            {totalBuyIn > 0 ? ` — Mise réelle : ${yourActualCost.toFixed(0)} €` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

function BackingEntry({
  backing,
  players,
  maxProfitShare,
  onChange,
  onRemove,
}: {
  backing: { player: Player | null; profitShare: number; paysBuyIn: boolean };
  players: Player[];
  maxProfitShare: number;
  onChange: (patch: Partial<{ player: Player | null; profitShare: number; paysBuyIn: boolean }>) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState('');

  const handleSelect = useCallback((name: string) => {
    const existing = players.find((p) => p.name === name);
    onChange({ player: existing ?? { id: `p-${Date.now()}`, name } });
  }, [players, onChange]);

  const handleCreate = useCallback((name: string) => {
    onChange({ player: { id: `p-${Date.now()}`, name } });
  }, [onChange]);

  return (
    <View style={backingStyles.entry}>
      <View style={backingStyles.entryHeader}>
        <Text style={sharedStyles.fieldLabel}>Backer</Text>
        <TouchableOpacity onPress={onRemove} activeOpacity={0.7}>
          <Text style={backingStyles.removeText}>Retirer</Text>
        </TouchableOpacity>
      </View>
      <ChipList
        items={players.map((p) => p.name)}
        selected={backing.player?.name ?? ''}
        onSelect={handleSelect}
        onCreate={handleCreate}
        query={query}
        onQueryChange={setQuery}
        placeholder="Chercher ou ajouter un joueur…"
      />
      <Counter
        label="Part des gains"
        value={backing.profitShare}
        onDecrement={() => onChange({ profitShare: Math.max(1, backing.profitShare - 1) })}
        onIncrement={() => onChange({ profitShare: Math.min(maxProfitShare, backing.profitShare + 1) })}
        min={1}
        max={maxProfitShare}
        format={(v) => `${v} %`}
      />
      <View style={{ gap: spacing.sm }}>
        <Text style={sharedStyles.fieldLabel}>Participe au buy-in ?</Text>
        <View style={resultStyles.toggle}>
          <TouchableOpacity
            style={[resultStyles.toggleBtn, backing.paysBuyIn && resultStyles.toggleBtnActive]}
            onPress={() => onChange({ paysBuyIn: true })}
            activeOpacity={0.8}
          >
            <Text style={[resultStyles.toggleText, backing.paysBuyIn && { color: colors.textPrimary }]}>Oui</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[resultStyles.toggleBtn, !backing.paysBuyIn && resultStyles.toggleBtnActive]}
            onPress={() => onChange({ paysBuyIn: false })}
            activeOpacity={0.8}
          >
            <Text style={[resultStyles.toggleText, !backing.paysBuyIn && { color: colors.textPrimary }]}>Non</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function StepResultTournament({
  draft,
  onUpdate,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  return (
    <View style={{ gap: spacing.xl }}>
      <StepTitle>Résultat</StepTitle>

      <View style={{ gap: spacing.sm }}>
        <Text style={sharedStyles.fieldLabel}>Sortie</Text>
        <View style={resultStyles.toggle}>
          <TouchableOpacity
            style={[resultStyles.toggleBtn, !draft.cashed && resultStyles.toggleBtnActive, { borderColor: colors.loss }]}
            onPress={() => onUpdate({ cashed: false })}
            activeOpacity={0.8}
          >
            <Text style={[resultStyles.toggleText, !draft.cashed && { color: colors.loss }]}>Éliminé</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[resultStyles.toggleBtn, draft.cashed && resultStyles.toggleBtnActive, { borderColor: colors.profit }]}
            onPress={() => onUpdate({ cashed: true })}
            activeOpacity={0.8}
          >
            <Text style={[resultStyles.toggleText, draft.cashed && { color: colors.profit }]}>Cashé</Text>
          </TouchableOpacity>
        </View>
      </View>

      {draft.cashed && (
        <AmountInput
          label="Cash-out"
          value={draft.cashOut}
          onChange={(v) => onUpdate({ cashOut: v })}
          placeholder="3 000"
        />
      )}

      {draft.cashed && (
        <View style={{ gap: 6 }}>
          <Text style={sharedStyles.fieldLabel}>Position (optionnel)</Text>
          <View style={sharedStyles.amountRow}>
            <TextInput
              style={sharedStyles.amountInput}
              value={draft.position}
              onChangeText={(v) => onUpdate({ position: v })}
              placeholder="ex. 8"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <Text style={sharedStyles.amountUnit}>#</Text>
          </View>
        </View>
      )}

      <Counter
        label="Durée"
        value={draft.durationHours}
        onDecrement={() => onUpdate({ durationHours: Math.max(0.5, draft.durationHours - 0.5) })}
        onIncrement={() => onUpdate({ durationHours: Math.min(48, draft.durationHours + 0.5) })}
        min={0.5}
        max={48}
        format={(v) => `${v}h`}
      />
    </View>
  );
}

function StepVenue({
  draft,
  onUpdate,
  knownVenues,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
  knownVenues: string[];
}) {
  const [query, setQuery] = useState('');

  return (
    <View style={{ gap: spacing.lg }}>
      <StepTitle>Détails de la partie</StepTitle>

      <ChipList
        items={knownVenues}
        selected={draft.venue}
        onSelect={(v) => onUpdate({ venue: v })}
        query={query}
        onQueryChange={(v) => { setQuery(v); onUpdate({ venue: v }); }}
        placeholder="Chercher ou saisir un lieu…"
      />

      <View style={{ gap: spacing.sm }}>
        <Text style={sharedStyles.fieldLabel}>Variante</Text>
        <View style={resultStyles.toggle}>
          {(['NLH', 'PLO'] as GameType[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[resultStyles.toggleBtn, draft.gameType === g && resultStyles.toggleBtnActive]}
              onPress={() => onUpdate({ gameType: g })}
              activeOpacity={0.8}
            >
              <Text style={[resultStyles.toggleText, draft.gameType === g && { color: colors.textPrimary }]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={sharedStyles.fieldLabel}>Mises</Text>
        <View style={sharedStyles.chipGrid}>
          {STAKES_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[sharedStyles.chip, draft.stakes === s && sharedStyles.chipSelected]}
              onPress={() => onUpdate({ stakes: s })}
              activeOpacity={0.7}
            >
              <Text style={[sharedStyles.chipText, draft.stakes === s && sharedStyles.chipTextSelected]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <AmountInput
        label="Buy-in"
        value={draft.buyIn}
        onChange={(v) => onUpdate({ buyIn: v })}
        placeholder="500"
      />
    </View>
  );
}

function StepResultCash({
  draft,
  onUpdate,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  return (
    <View style={{ gap: spacing.xl }}>
      <StepTitle>Résultat</StepTitle>
      <AmountInput
        label="Cash-out"
        value={draft.cashOut}
        onChange={(v) => onUpdate({ cashOut: v })}
        placeholder="1 200"
      />
      <Counter
        label="Durée"
        value={draft.durationHours}
        onDecrement={() => onUpdate({ durationHours: Math.max(0.5, draft.durationHours - 0.5) })}
        onIncrement={() => onUpdate({ durationHours: Math.min(48, draft.durationHours + 0.5) })}
        min={0.5}
        max={48}
        format={(v) => `${v}h`}
      />
    </View>
  );
}

// ─── Staking steps ────────────────────────────────────────────────────────────

function StepStakePlayer({
  draft,
  onUpdate,
  players,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
  players: Player[];
}) {
  const [query, setQuery] = useState('');

  const handleSelect = useCallback((name: string) => {
    const existing = players.find((p) => p.name === name);
    onUpdate({ stakingPlayer: existing ?? { id: `p-${Date.now()}`, name } });
  }, [players, onUpdate]);

  const handleCreate = useCallback((name: string) => {
    onUpdate({ stakingPlayer: { id: `p-${Date.now()}`, name } });
  }, [onUpdate]);

  return (
    <View style={{ gap: spacing.lg }}>
      <StepTitle>Qui avez-vous backé ?</StepTitle>
      <ChipList
        items={players.map((p) => p.name)}
        selected={draft.stakingPlayer?.name ?? ''}
        onSelect={handleSelect}
        onCreate={handleCreate}
        query={query}
        onQueryChange={setQuery}
        placeholder="Chercher ou ajouter un joueur…"
      />
    </View>
  );
}

function StepStakeSetup({
  festivals,
  tournaments,
  draft,
  onUpdate,
}: {
  festivals: Festival[];
  tournaments: Tournament[];
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  const [festivalQuery, setFestivalQuery] = useState('');
  const [tournamentQuery, setTournamentQuery] = useState('');

  const handleSelectFestival = useCallback((name: string) => {
    const existing = festivals.find((f) => f.name === name);
    onUpdate({ festival: existing ?? { id: `f-${Date.now()}`, name }, tournament: null });
  }, [festivals, onUpdate]);

  const handleCreateFestival = useCallback((name: string) => {
    onUpdate({ festival: { id: `f-${Date.now()}`, name }, tournament: null });
  }, [onUpdate]);

  const festivalTournaments = draft.festival
    ? tournaments.filter((t) => t.festivalId === draft.festival!.id)
    : [];

  const handleSelectTournament = useCallback((name: string) => {
    const existing = festivalTournaments.find((t) => t.name === name);
    if (existing) onUpdate({ tournament: existing, buyIn: String(existing.buyIn) });
  }, [festivalTournaments, onUpdate]);

  const handleCreateTournament = useCallback((name: string) => {
    onUpdate({
      tournament: {
        id: `t-${Date.now()}`,
        festivalId: draft.festival?.id ?? '',
        name,
        buyIn: parseFloat(draft.buyIn) || 0,
      },
    });
  }, [draft.buyIn, draft.festival]);

  const buyIn = parseFloat(draft.buyIn) || 0;
  const invested = ((draft.stakingPercentage / 100) * buyIn).toFixed(0);

  return (
    <View style={{ gap: spacing.lg }}>
      <StepTitle>Détails du staking</StepTitle>

      <View style={{ gap: spacing.sm }}>
        <Text style={sharedStyles.fieldLabel}>Festival (optionnel)</Text>
        <ChipList
          items={festivals.map((f) => f.name)}
          selected={draft.festival?.name ?? ''}
          onSelect={handleSelectFestival}
          onCreate={handleCreateFestival}
          query={festivalQuery}
          onQueryChange={setFestivalQuery}
          placeholder="Chercher un festival…"
        />
      </View>

      {draft.festival && (
        <View style={{ gap: spacing.sm }}>
          <Text style={sharedStyles.fieldLabel}>Tournoi (optionnel)</Text>
          <ChipList
            items={festivalTournaments.map((t) => t.name)}
            selected={draft.tournament?.name ?? ''}
            onSelect={handleSelectTournament}
            onCreate={handleCreateTournament}
            query={tournamentQuery}
            onQueryChange={setTournamentQuery}
            placeholder="Chercher un tournoi…"
          />
        </View>
      )}

      <AmountInput
        label="Buy-in total (optionnel)"
        value={draft.buyIn}
        onChange={(v) => onUpdate({ buyIn: v })}
        placeholder="0"
      />

      <Counter
        label="Pourcentage"
        value={draft.stakingPercentage}
        onDecrement={() => onUpdate({ stakingPercentage: Math.max(1, draft.stakingPercentage - 1) })}
        onIncrement={() => onUpdate({ stakingPercentage: Math.min(100, draft.stakingPercentage + 1) })}
        min={1}
        max={100}
        format={(v) => `${v} %`}
      />

      {buyIn > 0 && (
        <View style={reentriesStyles.summary}>
          <Text style={reentriesStyles.summaryLabel}>Mise engagée</Text>
          <Text style={reentriesStyles.summaryValue}>{invested} €</Text>
        </View>
      )}
    </View>
  );
}

function StepStakeResult({
  draft,
  onUpdate,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  const buyIn = parseFloat(draft.buyIn) || 0;
  const invested = (draft.stakingPercentage / 100) * buyIn;
  const theirCashout = parseFloat(draft.stakingTheirCashout) || 0;
  const myReturn = (draft.stakingPercentage / 100) * theirCashout;
  const profit = myReturn - invested;

  return (
    <View style={{ gap: spacing.xl }}>
      <StepTitle>Résultat</StepTitle>

      <View style={{ gap: spacing.sm }}>
        <Text style={sharedStyles.fieldLabel}>Statut</Text>
        <View style={[resultStyles.toggle, { flexWrap: 'wrap' }]}>
          <TouchableOpacity
            style={[resultStyles.toggleBtn, !draft.stakingSettled && resultStyles.toggleBtnActive]}
            onPress={() => onUpdate({ stakingSettled: false, stakingCashed: false })}
            activeOpacity={0.8}
          >
            <Text style={[resultStyles.toggleText, !draft.stakingSettled && { color: colors.textPrimary }]}>
              En attente
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[resultStyles.toggleBtn, draft.stakingSettled && !draft.stakingCashed && resultStyles.toggleBtnActive, { borderColor: draft.stakingSettled && !draft.stakingCashed ? colors.loss : undefined }]}
            onPress={() => onUpdate({ stakingSettled: true, stakingCashed: false })}
            activeOpacity={0.8}
          >
            <Text style={[resultStyles.toggleText, draft.stakingSettled && !draft.stakingCashed && { color: colors.loss }]}>
              Éliminé
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[resultStyles.toggleBtn, draft.stakingSettled && draft.stakingCashed && resultStyles.toggleBtnActive, { borderColor: draft.stakingSettled && draft.stakingCashed ? colors.profit : undefined }]}
            onPress={() => onUpdate({ stakingSettled: true, stakingCashed: true })}
            activeOpacity={0.8}
          >
            <Text style={[resultStyles.toggleText, draft.stakingSettled && draft.stakingCashed && { color: colors.profit }]}>
              Cashé
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {draft.stakingSettled && draft.stakingCashed && (
        <>
          <AmountInput
            label="Leur cashout"
            value={draft.stakingTheirCashout}
            onChange={(v) => onUpdate({ stakingTheirCashout: v })}
            placeholder="3 000"
          />
          {theirCashout > 0 && (
            <View style={reentriesStyles.summary}>
              <Text style={reentriesStyles.summaryLabel}>Mon gain</Text>
              <Text style={[reentriesStyles.summaryValue, { color: profit >= 0 ? colors.profit : colors.loss }]}>
                {profit >= 0 ? '+' : ''}{profit.toFixed(0)} €
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Record builder ───────────────────────────────────────────────────────────

function buildRecord(draft: Draft): SaveRecord {
  const id = `r-${Date.now()}`;
  const now = new Date().toISOString();

  if (draft.sessionType === 'stake' && draft.stakingPlayer) {
    const stake: Stake = {
      id,
      date: now,
      playerId: draft.stakingPlayer.id,
      festivalId: draft.festival?.id,
      tournamentId: draft.tournament?.id,
      buyIn: parseFloat(draft.buyIn) || 0,
      percentage: draft.stakingPercentage,
      settled: draft.stakingSettled,
      cashed: draft.stakingSettled ? draft.stakingCashed : undefined,
      theirCashout: draft.stakingSettled && draft.stakingCashed
        ? parseFloat(draft.stakingTheirCashout) || 0
        : undefined,
      createdAt: now,
    };
    return {
      stake,
      newPlayers: [draft.stakingPlayer],
      newFestival: draft.festival ?? undefined,
      newTournament: draft.tournament ?? undefined,
    };
  }

  const backings: Backing[] = draft.backings
    .filter((b) => b.player !== null)
    .map((b) => ({
      playerId: b.player!.id,
      profitShare: b.profitShare,
      buyInShare: b.paysBuyIn ? b.profitShare : 0,
    }));

  const newPlayers = draft.backings
    .filter((b) => b.player !== null)
    .map((b) => b.player!);

  if (draft.sessionType === 'tournament' && draft.festival && draft.tournament) {
    const buyIn = parseFloat(draft.buyIn) || 0;
    const cashOut = draft.cashed ? parseFloat(draft.cashOut) || 0 : 0;
    const session: TournamentSession = {
      id,
      type: 'tournament',
      date: now,
      venue: draft.festival.name,
      tournamentId: draft.tournament.id,
      buyIn,
      reEntries: draft.reEntries,
      cashOut,
      cashed: draft.cashed,
      position: draft.position ? parseInt(draft.position, 10) : undefined,
      durationHours: draft.durationHours,
      backings: backings.length > 0 ? backings : undefined,
      createdAt: now,
    };
    return {
      session,
      newFestival: draft.festival,
      newTournament: draft.tournament,
      newPlayers,
    };
  }

  const session: Session = {
    id,
    type: 'cash',
    date: now,
    venue: draft.venue,
    gameType: draft.gameType,
    stakes: draft.stakes,
    buyIn: parseFloat(draft.buyIn) || 0,
    cashOut: parseFloat(draft.cashOut) || 0,
    durationHours: draft.durationHours,
    backings: backings.length > 0 ? backings : undefined,
    createdAt: now,
  } as const;
  return { session, newPlayers };
}

// ─── Main modal ───────────────────────────────────────────────────────────────

const TOURNAMENT_STEPS: Step[] = ['type', 'festival', 'tournament', 'reentries', 'backing', 'result_t'];
const CASH_STEPS: Step[] = ['type', 'venue', 'backing', 'result_c'];
const STAKE_STEPS: Step[] = ['type', 'stake_player', 'stake_setup', 'stake_result'];

function getActiveSteps(draft: Draft): Step[] {
  if (draft.sessionType === 'cash') return CASH_STEPS;
  if (draft.sessionType === 'stake') return STAKE_STEPS;
  return TOURNAMENT_STEPS;
}

function getStepLabel(steps: Step[], current: Step): string {
  const idx = steps.indexOf(current);
  return idx >= 0 ? `Étape ${idx + 1}/${steps.length}` : '';
}

function canAdvance(step: Step, draft: Draft): boolean {
  switch (step) {
    case 'type': return draft.sessionType !== null;
    case 'festival': return draft.festival !== null;
    case 'tournament': return draft.tournament !== null && draft.buyIn.trim() !== '';
    case 'reentries': return true;
    case 'venue': return draft.venue.trim() !== '' && draft.buyIn.trim() !== '';
    case 'stake_player': return draft.stakingPlayer !== null;
    case 'stake_setup': return true;
    default: return true;
  }
}

export function AddSessionModal({ visible, onClose, onSave, festivals, tournaments, players }: Props) {
  const [steps, setSteps] = useState<Step[]>(['type']);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);

  const currentStep = steps[steps.length - 1];
  const activeSteps = getActiveSteps(draft);
  const stepLabel = steps.length > 1 ? getStepLabel(activeSteps, currentStep) : '';

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const goBack = useCallback(() => {
    if (steps.length <= 1) { onClose(); return; }
    setSteps((s) => s.slice(0, -1));
  }, [steps, onClose]);

  const handleClose = useCallback(() => {
    setSteps(['type']);
    setDraft(INITIAL_DRAFT);
    onClose();
  }, [onClose]);

  const handleTypeSelect = useCallback((t: 'tournament' | 'cash' | 'stake') => {
    update({ sessionType: t });
    const nextStep: Record<typeof t, Step> = {
      tournament: 'festival',
      cash: 'venue',
      stake: 'stake_player',
    };
    setSteps(['type', nextStep[t]]);
  }, [update]);

  const handleNext = useCallback(() => {
    if (!canAdvance(currentStep, draft)) return;

    const nextMap: Partial<Record<Step, Step>> = {
      festival: 'tournament',
      tournament: 'reentries',
      reentries: 'backing',
      venue: 'backing',
      backing: draft.sessionType === 'cash' ? 'result_c' : 'result_t',
      stake_player: 'stake_setup',
      stake_setup: 'stake_result',
    };
    const next = nextMap[currentStep];
    if (next) {
      setSteps((s) => [...s, next]);
    } else {
      const record = buildRecord(draft);
      onSave(record);
      setSteps(['type']);
      setDraft(INITIAL_DRAFT);
    }
  }, [currentStep, draft, onSave]);

  const isFinalStep = currentStep === 'result_t' || currentStep === 'result_c' || currentStep === 'stake_result';
  const canProceed = canAdvance(currentStep, draft);

  const knownVenues = [...new Set(festivals.map((f) => f.name))];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerBtn} onPress={goBack} activeOpacity={0.7}>
              {steps.length > 1
                ? <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
                : <View style={{ width: 22 }} />}
            </TouchableOpacity>
            <Text style={styles.stepLabel}>{stepLabel}</Text>
            <TouchableOpacity style={styles.headerBtn} onPress={handleClose} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {currentStep === 'type' && <StepType onSelect={handleTypeSelect} />}
            {currentStep === 'festival' && <StepFestival festivals={festivals} draft={draft} onUpdate={update} />}
            {currentStep === 'tournament' && <StepTournament tournaments={tournaments} draft={draft} onUpdate={update} />}
            {currentStep === 'reentries' && <StepReentries draft={draft} onUpdate={update} />}
            {currentStep === 'result_t' && <StepResultTournament draft={draft} onUpdate={update} />}
            {currentStep === 'venue' && <StepVenue draft={draft} onUpdate={update} knownVenues={knownVenues} />}
            {currentStep === 'backing' && <StepBacking draft={draft} onUpdate={update} players={players} />}
            {currentStep === 'result_c' && <StepResultCash draft={draft} onUpdate={update} />}
            {currentStep === 'stake_player' && <StepStakePlayer draft={draft} onUpdate={update} players={players} />}
            {currentStep === 'stake_setup' && (
              <StepStakeSetup festivals={festivals} tournaments={tournaments} draft={draft} onUpdate={update} />
            )}
            {currentStep === 'stake_result' && <StepStakeResult draft={draft} onUpdate={update} />}
          </ScrollView>

          {/* CTA */}
          {currentStep !== 'type' && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.cta, !canProceed && styles.ctaDisabled]}
                onPress={handleNext}
                activeOpacity={0.85}
                disabled={!canProceed}
              >
                {isFinalStep ? (
                  <View style={styles.ctaInner}>
                    <Check size={18} color="#000" strokeWidth={2.5} />
                    <Text style={styles.ctaText}>Enregistrer</Text>
                  </View>
                ) : (
                  <Text style={styles.ctaText}>Continuer</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sharedStyles = StyleSheet.create({
  stepTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    marginBottom: spacing.sm,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    color: colors.textPrimary,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipSelected: {
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipCreate: {
    borderColor: 'rgba(0,200,120,0.35)',
    backgroundColor: 'rgba(0,200,120,0.08)',
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  chipTextSelected: {
    color: colors.textPrimary,
    fontFamily: fontFamily.semibold,
  },
  counterWrap: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  counterLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  counterBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnDisabled: {
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  counterValue: {
    color: colors.textPrimary,
    fontSize: 44,
    fontFamily: fontFamily.extrabold,
    minWidth: 80,
    textAlign: 'center',
    letterSpacing: -1,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingRight: spacing.base,
  },
  amountInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  amountUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
});

const typeStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,215,0,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  cardSub: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});

const reentriesStyles = StyleSheet.create({
  summary: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
});

const resultStyles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
});

const backingStyles = StyleSheet.create({
  emptyHint: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    paddingVertical: spacing.xl,
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
    borderColor: 'rgba(255,255,255,0.20)',
  },
  addBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  entry: {
    gap: spacing.lg,
    padding: spacing.base,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeText: {
    color: colors.loss,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(8,8,14,0.95)',
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  body: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  footer: {
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  cta: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.35,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaText: {
    color: '#000',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
});
