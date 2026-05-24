import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

const PROJECTS = [
  { id: 'PRJ-ROAD-001', name: 'Ndola-Lusaka Road Section A', pct: 60 },
  { id: 'PRJ-BLD-002', name: 'Mongu District Hospital', pct: 40 },
  { id: 'PRJ-WAT-003', name: 'Choma Water Supply Upgrade', pct: 80 },
];

export function ProjectsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={PROJECTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.pct}>{item.pct}% complete</Text>
            <View style={styles.bar}><View style={[styles.fill, { width: `${item.pct}%` }]} /></View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 8, padding: 14, marginBottom: 10 },
  name: { color: '#fff', fontWeight: '600' },
  pct: { color: '#94a3b8', marginTop: 4, fontSize: 12 },
  bar: { height: 4, backgroundColor: '#334155', borderRadius: 2, marginTop: 8 },
  fill: { height: 4, backgroundColor: '#38bdf8', borderRadius: 2 },
});
