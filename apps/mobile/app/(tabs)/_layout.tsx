import { Tabs } from 'expo-router';
import { LayoutDashboard, BarChart3, Dices, History, User } from 'lucide-react-native';
import { FloatingTabBar } from '../../src/components/ui/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="degen"
        options={{
          tabBarIcon: ({ color }) => <Dices color={color} size={22} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="replayer"
        options={{
          tabBarIcon: ({ color }) => <History color={color} size={22} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ color }) => <BarChart3 color={color} size={22} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={22} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
