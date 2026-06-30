import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/useAppStore';

export default function ProfileScreen() {
  const resetStore = useAppStore((s) => s.resetStore);

  const handleReset = () => {
    Alert.alert(
      'Reset data',
      'This will clear all sessions, stakes and restore mock data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetStore },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Settings & bankroll coming soon</Text>
        <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetText}>Reset persisted data</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#8A8A9A', fontSize: 14 },
  resetButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.4)',
    backgroundColor: 'rgba(255,71,87,0.12)',
  },
  resetText: { color: '#FF4757', fontSize: 14, fontWeight: '600' },
});
