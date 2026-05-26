import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { initDb } from '../offline/sqlite';

export function HomeScreen() {
  useEffect(() => { initDb(); }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>ARCHITEX-CAD Mobile</Text>
      <Text style={styles.sub}>Field companion — works offline</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Tasks</Text>
        <Text style={styles.cardText}>• File daily site report</Text>
        <Text style={styles.cardText}>• Capture GPS-tagged photos</Text>
        <Text style={styles.cardText}>• Complete inspection checklist</Text>
        <Text style={styles.cardText}>• Sync when on WiFi</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  sub: { color: '#94a3b8', marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 8, padding: 16 },
  cardTitle: { color: '#38bdf8', fontWeight: '600', marginBottom: 8 },
  cardText: { color: '#cbd5e1', marginBottom: 4 },
});
