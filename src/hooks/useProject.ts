import { useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useViewerStore } from '../store/viewerStore';
import { openIFCFile } from '../services/fileService';

export function useProject() {
  const { currentProject, recentProjects, openProject, createNewProject, saveProject } =
    useProjectStore();
  const { loadModel } = useViewerStore();

  const openIFC = useCallback(async () => {
    const path = await openIFCFile();
    if (path) {
      openProject(path);
      loadModel(path);
    }
  }, [openProject, loadModel]);

  return {
    currentProject,
    recentProjects,
    openIFC,
    createNewProject,
    saveProject,
  };
}
