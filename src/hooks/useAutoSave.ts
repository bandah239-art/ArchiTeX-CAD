/**
 * Auto-save hook — calls the project autosave endpoint every 5 minutes when there
 * are unsaved changes and a project is open.
 *
 * Usage:
 *   useAutoSave()   // mount once at AppShell level
 */
import { useEffect, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCalculationStore } from '../store/calculationStore';
import { projectAPI } from '../services/projectAPI';

const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAutoSave(): void {
  const { currentProject, hasUnsavedChanges, markSaved } = useProjectStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(async () => {
      if (!currentProject || !hasUnsavedChanges) return;

      try {
        const calcState = useCalculationStore.getState();
        const snapshot = {
          project: currentProject,
          activeModule: calcState.activeModule,
          currentInputs: calcState.currentInputs,
          auto_saved_at: new Date().toISOString(),
        };

        await projectAPI.autoSave(currentProject.id, snapshot);
        markSaved();
      } catch (err) {
        // Auto-save failures are silent — the user can still manually save
        console.warn('[AutoSave] Failed:', err);
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentProject?.id, hasUnsavedChanges, markSaved]);
}
