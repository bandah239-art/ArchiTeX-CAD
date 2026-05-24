import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {
  CHECKLIST_PHASES,
  FOUNDATION_CHECKLIST,
} from '@infraafrica/shared';
import {
  initDb,
  loadChecklistState,
  saveChecklistItem,
  saveChecklistNote,
} from '../offline/sqlite';

type Phase = (typeof CHECKLIST_PHASES)[number];

const PHASE_ITEMS: Record<string, { id: string; label: string; phase: string }[]> = {
  foundation: [...FOUNDATION_CHECKLIST],
  structural: [
    { id: 's1', label: 'Column verticality within tolerance', phase: 'structural' },
    { id: 's2', label: 'Beam reinforcement as per drawing', phase: 'structural' },
    { id: 's3', label: 'Slab formwork level and propped', phase: 'structural' },
    { id: 's4', label: 'Structural connections inspected', phase: 'structural' },
  ],
  roofing: [
    { id: 'r1', label: 'Truss spacing verified', phase: 'roofing' },
    { id: 'r2', label: 'Roof sheeting fixings complete', phase: 'roofing' },
    { id: 'r3', label: 'Gutters and downpipes installed', phase: 'roofing' },
  ],
  finishes: [
    { id: 'f1', label: 'Plaster thickness uniform', phase: 'finishes' },
    { id: 'f2', label: 'Floor levels checked', phase: 'finishes' },
    { id: 'f3', label: 'Paint specification confirmed', phase: 'finishes' },
  ],
  handover: [
    { id: 'h1', label: 'Snag list closed out', phase: 'handover' },
    { id: 'h2', label: 'O&M manuals submitted', phase: 'handover' },
    { id: 'h3', label: 'Final inspection signed off', phase: 'handover' },
  ],
};

export function ChecklistScreen() {
  const [phase, setPhase] = useState<Phase>('foundation');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [projectId] = useState('default-site');

  const items = useMemo(() => PHASE_ITEMS[phase] ?? [], [phase]);

  useEffect(() => {
    initDb().then(() =>
      loadChecklistState(projectId).then((state) => {
        setChecked(state.checked);
        setNotes(state.notes);
      })
    );
  }, [projectId]);

  const toggle = async (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    await saveChecklistItem(projectId, id, Boolean(next[id]));
  };

  const onNotesChange = async (value: string) => {
    setNotes(value);
    await saveChecklistNote(projectId, value);
  };

  const doneCount = items.filter((i) => checked[i.id]).length;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Site Inspection Checklist</Text>
      <Text style={styles.sub}>Offline-first — syncs when connected</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phaseRow}>
        {CHECKLIST_PHASES.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPhase(p)}
            style={[styles.phaseChip, phase === p && styles.phaseChipActive]}
          >
            <Text style={[styles.phaseText, phase === p && styles.phaseTextActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.progressCard}>
        <Text style={styles.progressText}>
          {doneCount} / {items.length} complete ({phase})
        </Text>
      </View>

      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.itemRow, checked[item.id] && styles.itemRowDone]}
          onPress={() => toggle(item.id)}
        >
          <View style={[styles.checkbox, checked[item.id] && styles.checkboxChecked]}>
            {checked[item.id] ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={[styles.itemLabel, checked[item.id] && styles.itemLabelDone]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.notesLabel}>Site notes</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        value={notes}
        onChangeText={onNotesChange}
        placeholder="Observations, defects, weather…"
        placeholderTextColor="#64748b"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: '#94a3b8', marginTop: 4, marginBottom: 12 },
  phaseRow: { marginBottom: 12 },
  phaseChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    marginRight: 8,
  },
  phaseChipActive: { backgroundColor: '#0369a1' },
  phaseText: { color: '#94a3b8', fontSize: 12, textTransform: 'capitalize' },
  phaseTextActive: { color: '#fff', fontWeight: '600' },
  progressCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  progressText: { color: '#38bdf8', fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemRowDone: { opacity: 0.75 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#059669', borderColor: '#059669' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  itemLabel: { color: '#e2e8f0', flex: 1, fontSize: 14 },
  itemLabelDone: { textDecorationLine: 'line-through', color: '#94a3b8' },
  notesLabel: { color: '#94a3b8', marginTop: 16, marginBottom: 6, fontSize: 12 },
  notesInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
});
