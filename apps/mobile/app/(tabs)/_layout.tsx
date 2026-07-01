import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { LayoutDashboard, TrendingUp, Search, User } from 'lucide-react-native';
import { EnvironmentBackground } from '../../src/components/ui/EnvironmentBackground';
import { FloatingTabBar } from '../../src/components/ui/FloatingTabBar';
import { AddSessionSheet } from '../../src/components/tracker/AddSessionSheet';
import type { SaveRecord } from '../../src/components/tracker/AddSessionSheet';
import { useAppStore } from '../../src/store/useAppStore';

export default function TabLayout() {
  const [showAddSession, setShowAddSession] = useState(false);
  const { festivals, tournaments, players, addSession, addStake, addFestival, addTournament, addPlayer } = useAppStore();

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
      setShowAddSession(false);
    },
    [players, festivals, tournaments, addPlayer, addFestival, addTournament, addSession, addStake]
  );

  return (
    <View style={{ flex: 1 }}>
      <EnvironmentBackground />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} onAddPress={() => setShowAddSession(true)} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} strokeWidth={1.5} />,
          }}
        />
        <Tabs.Screen
          name="tracker"
          options={{
            tabBarIcon: ({ color }) => <TrendingUp color={color} size={22} strokeWidth={1.5} />,
          }}
        />
        <Tabs.Screen
          name="finder"
          options={{
            tabBarIcon: ({ color }) => <Search color={color} size={22} strokeWidth={1.5} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color }) => <User color={color} size={22} strokeWidth={1.5} />,
          }}
        />
      </Tabs>

      <AddSessionSheet
        visible={showAddSession}
        onClose={() => setShowAddSession(false)}
        onSave={handleSave}
        festivals={festivals}
        tournaments={tournaments}
        players={players}
      />
    </View>
  );
}
