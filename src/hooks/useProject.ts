import { useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useViewerStore } from '../store/viewerStore';
import { openIFCFile } from '../services/fileService';

/**
 * Project actions only. Uses viewer store via getState() so the dashboard
 * does not subscribe to viewer updates (avoids extra re-renders / xeokit coupling).
 */
export function useProject() {
  const { currentProject, recentProjects, openProject, createNewProject, saveProject } =
    useProjectStore();

  const openIFC = useCallback(async () => {
    const path = await openIFCFile();
    if (path) {
      openProject(path);
      useViewerStore.getState().loadModel(path);
    }
  }, [openProject]);

  return {
    currentProject,
    recentProjects,
    openIFC,
    createNewProject,
    saveProject,
  };
}
