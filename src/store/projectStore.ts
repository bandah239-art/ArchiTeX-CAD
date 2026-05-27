import { create } from 'zustand';
import type { Project } from '../types/project';
import { saveProjectMetaLocal, loadProjectMetaLocal } from '../services/offlineCache';

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  isLoading: boolean;
  openProject: (path: string) => void;
  saveProject: () => void;
  createNewProject: (name: string) => void;
  setCurrentProject: (project: Project | null) => void;
  restoreLastProject: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isLoading: false,

  openProject: (path: string) => {
    set({ isLoading: true });
    const project: Project = {
      id: crypto.randomUUID(),
      name: path.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'Untitled',
      path,
      ifcPath: path,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const recent = [project, ...get().recentProjects.filter((p) => p.path !== path)].slice(0, 10);
    set({ currentProject: project, recentProjects: recent, isLoading: false });
    saveProjectMetaLocal({
      name: project.name,
      path: project.path,
      ifcPath: project.ifcPath,
      openedAt: project.updatedAt,
    });
  },

  saveProject: () => {
    const current = get().currentProject;
    if (current) {
      const updated = { ...current, updatedAt: new Date().toISOString() };
      set({ currentProject: updated });
      saveProjectMetaLocal({
        name: updated.name,
        path: updated.path,
        ifcPath: updated.ifcPath,
        savedAt: updated.updatedAt,
      });
    }
  },

  createNewProject: (name: string) => {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      path: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({ currentProject: project });
    saveProjectMetaLocal({ name: project.name, createdAt: project.createdAt });
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  restoreLastProject: () => {
    const meta = loadProjectMetaLocal();
    if (!meta?.path) return;
    const path = String(meta.path);
    const project: Project = {
      id: crypto.randomUUID(),
      name: String(meta.name ?? path.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') ?? 'Untitled'),
      path,
      ifcPath: String(meta.ifcPath ?? path),
      createdAt: String(meta.openedAt ?? new Date().toISOString()),
      updatedAt: new Date().toISOString(),
    };
    set({ currentProject: project });
  },
}));
