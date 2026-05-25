import { create } from 'zustand';
import type { DrawSnapshot } from './drawStore';
import { useDrawStore } from './drawStore';

export type UndoActionType = 'draw' | 'modifier' | 'delete';

export interface UndoEntry {
  type: UndoActionType;
  label: string;
  before: DrawSnapshot;
  after: DrawSnapshot;
}

interface UndoState {
  past: UndoEntry[];
  future: UndoEntry[];
  maxSize: number;
  canUndo: boolean;
  canRedo: boolean;
  pushDrawAction: (label: string, before: DrawSnapshot, after: DrawSnapshot) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

function syncFlags(past: UndoEntry[], future: UndoEntry[]) {
  return { past, future, canUndo: past.length > 0, canRedo: future.length > 0 };
}

export const useUndoStore = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  maxSize: 50,
  canUndo: false,
  canRedo: false,

  pushDrawAction: (label, before, after) => {
    const entry: UndoEntry = { type: 'draw', label, before, after };
    set((s) => {
      const past = [...s.past, entry].slice(-s.maxSize);
      return syncFlags(past, []);
    });
  },

  undo: () => {
    const { past, future } = get();
    if (!past.length) return;
    const entry = past[past.length - 1];
    useDrawStore.getState().loadSnapshot(entry.before);
    set(syncFlags(past.slice(0, -1), [entry, ...future]));
  },

  redo: () => {
    const { past, future } = get();
    if (!future.length) return;
    const entry = future[0];
    useDrawStore.getState().loadSnapshot(entry.after);
    set(syncFlags([...past, entry], future.slice(1)));
  },

  clear: () => set(syncFlags([], [])),
}));
