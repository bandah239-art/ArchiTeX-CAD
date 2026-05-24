import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { saveToQueue } from '../offline/sqlite';
import { captureGeoTaggedPhoto } from '../services/camera';

export function SiteReportScreen() {
  const [workDone, setWorkDone] = useState('');
  const [skilled, setSkilled] = useState('12');
  const [photos, setPhotos] = useState(0);

  const submit = async () => {
    const report = {
      id: `RPT-${Date.now()}`,
      type: 'site_report',
      project_id: 'PRJ-ROAD-001',
      priority: 2,
      payload: {
        work_done: workDone,
        skilled: Number(skilled),
        unskilled: 24,
        completion_pct: 2.3,
        cumulative_pct: 76.1,
        date: new Date().toISOString(),
      },
    };
    await saveToQueue(report);
    Alert.alert('Saved', 'Report queued for sync when online.');
  };

  const takePhoto = async () => {
    const photo = await captureGeoTaggedPhoto('PRJ-ROAD-001');
    if (photo) setPhotos((p) => p + 1);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Daily Site Report</Text>
      <Text style={styles.label}>Kamwala Market — {new Date().toLocaleDateString()}</Text>
      <Text style={styles.fieldLabel}>Skilled workforce</Text>
      <TextInput style={styles.input} value={skilled} onChangeText={setSkilled} keyboardType="numeric" />
      <Text style={styles.fieldLabel}>Work done today</Text>
      <TextInput style={[styles.input, styles.area]} value={workDone} onChangeText={setWorkDone} multiline placeholder="Describe work completed..." placeholderTextColor="#64748b" />
      <TouchableOpacity style={styles.btnSecondary} onPress={takePhoto}>
        <Text style={styles.btnText}>Take GPS Photo ({photos})</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Submit Report (Offline OK)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  label: { color: '#94a3b8', marginBottom: 16 },
  fieldLabel: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  input: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 6, padding: 10, marginTop: 4 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  btn: { backgroundColor: '#0284c7', borderRadius: 8, padding: 14, marginTop: 16, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#334155', borderRadius: 8, padding: 14, marginTop: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
