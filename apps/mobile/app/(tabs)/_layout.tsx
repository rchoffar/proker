import { Tabs } from 'expo-router';
import { LayoutDashboard, Search, Calendar, Dices, User } from 'lucide-react-native';
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
        name="festivals"
        options={{
          tabBarIcon: ({ color }) => <Search color={color} size={22} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          tabBarIcon: ({ color }) => <Calendar color={color} size={22} strokeWidth={1.5} />,
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
  );
}
