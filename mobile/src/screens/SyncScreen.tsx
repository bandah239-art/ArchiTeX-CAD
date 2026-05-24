import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { syncToDesktop } from '../services/sync';

export function SyncScreen() {
  const [result, setResult] = useState<{ synced: number; queued: number; last_sync: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const runSync = async () => {
    setLoading(true);
    const r = await syncToDesktop();
    setResult(r);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline Sync</Text>
      <Text style={styles.sub}>Syncs reports and photos to desktop when on same WiFi</Text>
      <TouchableOpacity style={styles.btn} onPress={runSync} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sync Now</Text>}
      </TouchableOpacity>
      {result && (
        <View style={styles.card}>
          <Text style={styles.cardText}>Synced: {result.synced}</Text>
          <Text style={styles.cardText}>Queued: {result.queued}</Text>
          <Text style={styles.cardText}>Last: {new Date(result.last_sync).toLocaleString()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sub: { color: '#94a3b8', marginTop: 4, marginBottom: 20 },
  btn: { backgroundColor: '#0284c7', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#1e293b', borderRadius: 8, padding: 16, marginTop: 16 },
  cardText: { color: '#cbd5e1', marginBottom: 4 },
});
