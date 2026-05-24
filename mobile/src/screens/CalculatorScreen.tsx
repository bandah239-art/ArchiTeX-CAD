import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { concreteMix, rebarWeight, beamCheck } from '../services/calculators';

type Tab = 'concrete' | 'rebar' | 'beam';

export function CalculatorScreen() {
  const [tab, setTab] = useState<Tab>('concrete');
  const [volume, setVolume] = useState('5');
  const [barLen, setBarLen] = useState('12');
  const [barQty, setBarQty] = useState('20');
  const [span, setSpan] = useState('6');
  const [depth, setDepth] = useState('450');

  const mix = concreteMix('C25', Number(volume) || 0);
  const rebar = rebarWeight('H16', Number(barLen) || 0, Number(barQty) || 0);
  const beam = beamCheck(Number(span) || 0, Number(depth) || 0);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.tabs}>
        {(['concrete', 'rebar', 'beam'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={styles.tabText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'concrete' && (
        <View>
          <Text style={styles.label}>C25 Volume (m³)</Text>
          <TextInput style={styles.input} value={volume} onChangeText={setVolume} keyboardType="decimal-pad" />
          <Result label="Cement (50kg bags)" value={String(mix.cement_bags)} />
          <Result label="Sand (m³)" value={String(mix.sand_m3)} />
          <Result label="Aggregate (m³)" value={String(mix.aggregate_m3)} />
          <Result label="Water (litres)" value={String(mix.water_litres)} />
        </View>
      )}

      {tab === 'rebar' && (
        <View>
          <Text style={styles.label}>H16 Length (m)</Text>
          <TextInput style={styles.input} value={barLen} onChangeText={setBarLen} keyboardType="decimal-pad" />
          <Text style={styles.label}>Quantity</Text>
          <TextInput style={styles.input} value={barQty} onChangeText={setBarQty} keyboardType="number-pad" />
          <Result label="Total weight (kg)" value={String(rebar.total_kg)} />
          <Result label="Tonnes" value={String(rebar.total_tonnes)} />
        </View>
      )}

      {tab === 'beam' && (
        <View>
          <Text style={styles.label}>Span (m)</Text>
          <TextInput style={styles.input} value={span} onChangeText={setSpan} keyboardType="decimal-pad" />
          <Text style={styles.label}>Depth (mm)</Text>
          <TextInput style={styles.input} value={depth} onChangeText={setDepth} keyboardType="number-pad" />
          <Result label="L/d ratio" value={String(beam.ld_ratio)} />
          <Result label="Status" value={beam.status} />
        </View>
      )}
    </ScrollView>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.result}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, padding: 10, backgroundColor: '#1e293b', borderRadius: 6, alignItems: 'center' },
  tabActive: { backgroundColor: '#0284c7' },
  tabText: { color: '#fff', fontSize: 12, textTransform: 'capitalize' },
  label: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  input: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 6, padding: 10, marginTop: 4 },
  result: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  resultLabel: { color: '#94a3b8' },
  resultValue: { color: '#fff', fontWeight: '600' },
});
