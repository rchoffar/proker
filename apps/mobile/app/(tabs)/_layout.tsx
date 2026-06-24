import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  LayoutDashboard,
  TrendingUp,
  Search,
  Dices,
  User,
} from 'lucide-react-native';

const GOLD = '#FFD700';
const INACTIVE = '#5A5A6E';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={24} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          tabBarIcon: ({ color }) => <TrendingUp color={color} size={24} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="finder"
        options={{
          tabBarIcon: ({ color }) => <Search color={color} size={24} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="degen"
        options={{
          tabBarIcon: ({ color }) => <Dices color={color} size={24} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={24} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    height: 64,
    borderRadius: 9999,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'transparent',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
});
