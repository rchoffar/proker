import { View } from 'react-native';
import { Tabs } from 'expo-router';
import {
  LayoutDashboard,
  TrendingUp,
  Search,
  Dices,
  User,
} from 'lucide-react-native';
import { FloatingTabBar } from '../../src/components/ui/FloatingTabBar';
import { GlobalFAB } from '../../src/components/ui/GlobalFAB';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
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
          name="degen"
          options={{
            tabBarIcon: ({ color }) => <Dices color={color} size={22} strokeWidth={1.5} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color }) => <User color={color} size={22} strokeWidth={1.5} />,
          }}
        />
      </Tabs>
      <GlobalFAB />
    </View>
  );
}
