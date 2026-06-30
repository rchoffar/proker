import { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { AddSessionModal } from '../tracker/AddSessionModal';
import type { SaveRecord } from '../tracker/AddSessionModal';
import { useAppStore } from '../../store/useAppStore';
import { colors, radius } from '../../design-system/theme';

const FAB_SCREENS = ['/', '/tracker'];

export function GlobalFAB() {
  const [showModal, setShowModal] = useState(false);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { festivals, tournaments, players, addSession, addStake, addFestival, addTournament, addPlayer } = useAppStore();

  const tabBarBottom = insets.bottom > 0 ? insets.bottom + 8 : 20;
  const fabBottom = tabBarBottom + 68 + 16;

  const handleSave = useCallback(
    (record: SaveRecord) => {
      for (const p of record.newPlayers ?? []) {
        if (!players.find((existing) => existing.id === p.id)) addPlayer(p);
      }
      if (record.newFestival && !festivals.find((f) => f.id === record.newFestival!.id)) {
        addFestival(record.newFestival);
      }
      if (record.newTournament && !tournaments.find((t) => t.id === record.newTournament!.id)) {
        addTournament(record.newTournament);
      }
      if (record.session) addSession(record.session);
      if (record.stake) addStake(record.stake);
      setShowModal(false);
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, addSession, addStake]
  );

  if (!FAB_SCREENS.includes(pathname)) return null;

  return (
    <>
      <View style={[styles.fab, { bottom: fabBottom }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowModal(true)}
          activeOpacity={0.82}
        >
          <Plus size={22} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <AddSessionModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        festivals={festivals}
        tournaments={tournaments}
        players={players}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    zIndex: 100,
  },
  button: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
});
